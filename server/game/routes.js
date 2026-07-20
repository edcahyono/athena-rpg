/**
 * /api/game/* — game endpoints.
 *
 * Persona conversations reuse the exact prompt-building + retrieval engine
 * from the consult-athena chat site (buildSystemPrompt + BM25 retrieve).
 * Server-authoritative: interaction counts, timers, and executive unlocks
 * (via gatekeeper checks — see shared/gameContent.js TRACKS).
 * Fully bilingual: every endpoint accepts { language: "en" | "zh" }.
 */
import express from "express";
import { PERSONAS, PERSONA_MAP } from "../../shared/personas.config.js";
import { buildSystemPrompt } from "../../shared/promptBuilder.js";
import { GAME_CONFIG } from "../../shared/gameConfig.js";
import { TASKS, TRACKS, trackForPersona, trackById } from "../../shared/gameContent.js";
import { buildGatekeeperPrompt } from "../../shared/gatekeeperPrompt.js";
import { REVIEW_CRITERIA, GATEKEEPER_REVIEW } from "../../shared/reviewCriteria.js";
import { BENCHMARKS } from "../../shared/benchmarks.js";
import { retrieve } from "../rag/retriever.js";
import { callAnthropic, CHAT_MODEL, LIGHT_MODEL, parseModelJson } from "../anthropic.js";
import { gradeQuizAnswers } from "./grading.js";
import { extractText } from "./extract.js";
import { INJECTION_GUARD } from "./guards.js";
import {
  getSession, touch, publicState, addQuestEntry, addCredibility, resetSession,
} from "./sessionStore.js";

const router = express.Router();
const MAX_TOKENS = Number(process.env.MAX_TOKENS || 900);
const now = () => Date.now();

const langOf = (req) => (req.body?.language === "zh" ? "zh" : "en");
const LB = (v, lang) => (typeof v === "string" ? v : v?.[lang] || v?.en || "");
const TT = (lang, en, zh) => (lang === "zh" ? zh : en);

/* ------------------------------ helpers ------------------------------ */

function toModelMessages(transcript, selfId, lang) {
  const out = [];
  for (const m of transcript) {
    const isSelf = m.role === "persona" && m.personaId === selfId;
    const role = isSelf ? "assistant" : "user";
    const label = m.role === "learner"
      ? TT(lang, "Learner", "学习者")
      : LB(PERSONA_MAP[m.personaId]?.title, lang) || "Colleague";
    const text = isSelf ? m.text : `[${label}]: ${m.text}`;
    if (out.length && out[out.length - 1].role === role) out[out.length - 1].content += `\n\n${text}`;
    else out.push({ role, content: text });
  }
  if (!out.length || out[0].role !== "user") {
    out.unshift({ role: "user", content: TT(lang, "[Learner]: (meeting begins)", "[学习者]:（会议开始）") });
  }
  return out;
}

function coldNote(warmth) {
  if (warmth >= 0) return "";
  return `\n\nRELATIONSHIP NOTE: your earlier conversations with this learner felt superficial to you — their questions were shallow. Stay professional and in character, but be noticeably brisker and cooler with them; give shorter answers and less unprompted help than you otherwise would.`;
}

/**
 * C-suite answer discipline for timed 1:1 meetings — they know everything,
 * but they only give you what you specifically ask for.
 */
const FOCUSED_ANSWER_RULE = `

TIMED-MEETING ANSWER DISCIPLINE (overrides general generosity):
- The learner's meetings with you are short, timed, and limited. Answer ONLY the specific question asked — answer it fully and honestly, but do not volunteer a tour of your whole domain, recite your full situation, or dump figures that were not asked about.
- One question, one focused answer. If the question is vague or broad ("tell me about your area", "what should the strategy be"), give a brief, honest sketch and push back gently: ask them to pick the specific thread they want, as a real executive would with a junior consultant on the clock.
- You may end an answer with AT MOST one short pointer to an adjacent thread worth pulling ("there's a longer story behind the discount cycle — ask if you want it"), but never explain it unprompted.
- Never enumerate everything you know. What the learner fails to ask about, they simply don't get.

NUMERIC DISCIPLINE (non-negotiable):
- State a specific figure ONLY if it appears in your knowledge base or the reference material for this turn. If you don't have the exact number, say so and give the qualitative direction instead ("margin compressed sharply" rather than inventing basis points).
- Never approximate a plausible-sounding number to seem authoritative. A junior consultant will quote you — a wrong number from you becomes a wrong number in their strategy.`;

// Prompt-injection guard — see server/game/guards.js (tested by npm run eval:injection).

/**
 * In-meeting mood — evolves WITHIN a meeting, not just across meetings.
 * Driven by the same shallow/substantive classifier as warmth, but scoped to
 * the active interaction: engaged execs volunteer extra insight, execs worn
 * down by weak questions get curt, and at mood <= CUTOFF they end the meeting
 * early. Time pressure adds a "rushed" register near the end of the slot.
 */
const MOOD_CUTOFF = -3;

function moodNote(mood, remainingRatio) {
  let note = "";
  if (mood >= 2) {
    note += `\n\nIN-MEETING MOOD: this conversation is genuinely engaging you — the learner's questions are sharp. Let it show: answer with more energy, and this turn you may ALSO volunteer one short unprompted insight or anecdote adjacent to their question (a real executive opens up when the questions are good). Keep the focused-answer discipline otherwise.`;
  } else if (mood <= -2) {
    note += `\n\nIN-MEETING MOOD: this meeting is wearing your patience — the learner's questions have been shallow. Be noticeably curt THIS TURN: shorter answers, no extra warmth, and let mild impatience show through professional phrasing ("as I said…", a glance at the clock). If the next question is weak too, you are close to ending the meeting early.`;
  }
  if (remainingRatio < 0.25) {
    note += `\n\nTIME PRESSURE: the meeting slot is almost over. You are visibly rushed — compress your answer, and it's natural to mention you have to wrap up soon.`;
  }
  return note;
}

const CUTOFF_LINES = {
  en: [
    "Let me stop you there. I don't think we're using this time well — come back when you've done your homework. My assistant will show you out.",
    "I'm going to end here. These questions needed more preparation. Talk to the Deloitte team downstairs first next time.",
  ],
  zh: [
    "我先打断一下。我觉得这段时间没有被用好——做好功课再来吧。我的助理会送你出去。",
    "今天就到这里。这些问题需要更充分的准备。下次先和楼下的德勤团队聊过再来。",
  ],
};
const cutoffLine = (lang) => {
  const arr = CUTOFF_LINES[lang] || CUTOFF_LINES.en;
  return arr[Math.floor(Math.random() * arr.length)];
};

/**
 * Cheap numeric-grounding scan — zero extra model calls, so no latency cost.
 * Extracts digit tokens from the reply and checks each appears somewhere in
 * the approved corpus for this turn (retrieved chunks + persona config).
 * Unmatched numbers don't block the reply (speed first) — they're flagged on
 * the session for coach review and logged to the server console.
 */
function scanNumericGrounding(s, personaId, reply, retrievedChunks) {
  const corpus = (JSON.stringify(PERSONA_MAP[personaId] || {}) + JSON.stringify(retrievedChunks || []))
    .replace(/[,，]/g, "");
  const numbers = reply.match(/\d[\d,，.]*\d|\d/g) || [];
  const suspect = [];
  for (const raw of numbers) {
    const n = raw.replace(/[,，]/g, "");
    if (n.length < 2 && Number(n) < 10) continue; // single small digits ("3 things") are noise
    if (!corpus.includes(n)) suspect.push(raw);
  }
  if (suspect.length) {
    s.groundingFlags = s.groundingFlags || [];
    s.groundingFlags.push({ t: Date.now(), personaId, numbers: [...new Set(suspect)].slice(0, 10), reply: reply.slice(0, 200) });
    if (s.groundingFlags.length > 100) s.groundingFlags.splice(0, s.groundingFlags.length - 100);
    console.warn(`[grounding] ${personaId} reply contains unverified numbers:`, [...new Set(suspect)].slice(0, 5).join(", "));
  }
}

async function personaReply(session, personaId, lang, extraSystem = "", groupIds = null) {
  const persona = PERSONA_MAP[personaId];
  const state = session.personas[personaId];
  const transcript = groupIds ? session.board.transcript : state.transcript;
  const query = [...transcript].reverse().find((m) => m.role === "learner")?.text || "";

  let retrievedChunks = [];
  try {
    // Mid-level personas ground on their parent executive's Q&A store.
    retrievedChunks = await retrieve(persona.ragId || personaId, query);
  } catch (e) {
    console.warn("[rag]", e.message);
  }

  let personaArg = persona;
  let mode = "individual";
  if (groupIds) {
    mode = "group";
    personaArg = [persona, ...groupIds.filter((id) => id !== personaId).map((id) => PERSONA_MAP[id])];
  }
  const system =
    buildSystemPrompt(personaArg, { mode, language: lang, retrievedChunks }) +
    coldNote(state.warmth) + INJECTION_GUARD + extraSystem;

  const raw = await callAnthropic({
    model: CHAT_MODEL,
    max_tokens: MAX_TOKENS,
    system,
    messages: toModelMessages(transcript, personaId, lang),
  });
  const reply = raw.replace(/\[\[REDIRECT:[a-z]+\]\]/g, "").trim();
  scanNumericGrounding(session, personaId, reply, retrievedChunks);
  return reply;
}

/** Haiku shallow-question classifier — feeds persona warmth (soft-fail tracking). */
async function classifyQuestion(text, personaTitle) {
  try {
    const out = await callAnthropic({
      model: LIGHT_MODEL,
      max_tokens: 10,
      system:
        `A junior consultant is interviewing the ${personaTitle} of Nike Greater China to build a growth strategy. The question may be in English or Chinese. ` +
        `Classify it. SUBSTANTIVE = specific, role-relevant, moves the analysis forward (asks about numbers, causes, trade-offs, competitors, execution). ` +
        `SHALLOW = generic small talk, vague ("tell me everything"), lazy ("what should my strategy be?"), or something they could have looked up. ` +
        `Reply with exactly one word: SUBSTANTIVE or SHALLOW.`,
      messages: [{ role: "user", content: text.slice(0, 1000) }],
    });
    return /SHALLOW/i.test(out) ? -1 : 1;
  } catch {
    return 0; // classifier failure never blocks play
  }
}

const interviewedCount = (s) => Object.values(s.personas).filter((p) => p.used > 0).length;

/** Executive access requires passing that domain's gatekeeper check. */
function requireTrackPassed(s, personaId, lang) {
  const track = trackForPersona(personaId);
  if (!track) return;
  const t = s.tasks[track.taskId];
  if (!t || !["passed"].includes(t.status)) {
    throw Object.assign(new Error(TT(lang,
      "This executive only takes meetings arranged through the engagement team — pass the domain manager's check first.",
      "这位高管只接受项目组安排的会面——请先通过对应领域经理的考核。")), { status: 403 });
  }
}

const CLOSINGS = {
  en: [
    "I'm sorry — I have to run to my next meeting. Good luck with the strategy.",
    "That's all the time I have today. My assistant will show you out.",
    "I need to jump on a call with HQ. Let's leave it there.",
  ],
  zh: [
    "抱歉——我得赶下一个会了。祝你的战略顺利。",
    "今天就到这里吧。我的助理会送你出去。",
    "我得上一个和总部的电话会。今天先聊到这。",
  ],
};
const closing = (lang) => {
  const arr = CLOSINGS[lang] || CLOSINGS.en;
  return arr[Math.floor(Math.random() * arr.length)];
};

/* ------------------------------ session ------------------------------ */

router.post("/session", (req, res) => {
  const s = getSession(req.body?.sessionId);
  res.json(publicState(s));
});

// Wipe all progress for this session (client reloads into a fresh engagement).
router.post("/reset", (req, res) => {
  const id = req.body?.sessionId;
  if (typeof id === "string" && id) resetSession(id);
  res.json({ ok: true });
});

// Autosave: client position/floor + player-authored notes + appearance only.
// Protected fields (credibility, interactions, tasks) never come from the client.
router.post("/save", (req, res) => {
  const s = getSession(req.body?.sessionId, false);
  const { client, notes, profile } = req.body || {};
  if (client && typeof client === "object") {
    const floor = Number(client.floor);
    if (GAME_CONFIG.floors.includes(floor)) s.client.floor = floor;
    if (Number.isFinite(client.x)) s.client.x = client.x;
    if (Number.isFinite(client.y)) s.client.y = client.y;
  }
  if (typeof notes === "string") s.notes = notes.slice(0, 8000);
  if (profile && typeof profile === "object" && JSON.stringify(profile).length < 2000) s.profile = profile;
  touch(s);
  res.json({ ok: true });
});

// Whitelisted one-way flags and player choices.
router.post("/event", (req, res) => {
  const s = getSession(req.body?.sessionId, false);
  const { type, trackId } = req.body || {};
  const lang = langOf(req);
  if (type === "metSupervisor" && !s.flags.metSupervisor) {
    s.flags.metSupervisor = true;
    addQuestEntry(s, "task", TT(lang, "Onboarding complete", "入职报到完成"),
      TT(lang,
        "Manager Lin briefed you: build an independent 5-year growth strategy for Nike Greater China. Pick any domain track from the mission board (menu, M) — pass its manager's check to unlock the matching Nike executive.",
        "林经理已向你交代：为耐克大中华区撰写一份独立的五年增长战略。从任务板（菜单M）任选一条领域线——通过该线经理的考核即可解锁对应的耐克高管。"));
    touch(s);
  }
  // Player picked an active mission from the mission board.
  if (type === "selectMission" && (TRACKS[trackId] || trackId === null)) {
    s.selectedMission = TRACKS[trackId] ? trackId : null;
    touch(s);
  }
  res.json(publicState(s));
});

/* ------------------------------- checks -------------------------------- */

router.post("/dialogue-check", (req, res) => {
  const s = getSession(req.body?.sessionId, false);
  const { taskId, choice } = req.body || {};
  const lang = langOf(req);
  const task = TASKS[taskId];
  if (!task || task.type !== "choice") return res.status(400).json({ error: "Unknown check" });
  if (s.tasks[taskId]?.status === "passed") return res.json({ ...publicState(s), result: "already" });
  const pass = Number(choice) === task.correct;
  if (pass) {
    s.tasks[taskId] = { status: "passed", delta: task.credibility };
    addQuestEntry(s, "task", TT(lang, "Check passed: ", "考核通过：") + LB(task.title, lang), LB(task.prompt, lang));
    addCredibility(s, task.credibility, LB(task.title, lang));
  }
  touch(s);
  res.json({ ...publicState(s), result: pass ? "pass" : "fail" });
});

/* --------------------- gatekeeper conversations (F13/F14) -------------- */
/**
 * Deloitte domain managers are a free, unlimited, untimed conversation — the
 * "practice" tier. The player asks whatever they want; the gatekeeper knows
 * the case deeply but has deliberate blind spots (see gameContent TRACKS),
 * and deflects those honestly with a [[UNKNOWN:execId:topic]] tag that gets
 * stripped and logged to the notebook as a lead ("ask the CMO about X").
 * On leaving, the gatekeeper quizzes the player on THIS conversation.
 */

function gatekeeperNpcFromTrack(trackId) {
  // Minimal display identity — full roster lives in src/config/world.ts on
  // the client; the server only needs name/role for the system prompt.
  const NAMES = {
    strategy: { name: { en: "Wu Jianguo", zh: "吴建国" }, role: { en: "Senior Manager, Strategy & Business Design", zh: "高级经理，战略与业务设计" } },
    finance: { name: { en: "Priya", zh: "普莉亚" }, role: { en: "Senior Consultant, Finance Transformation", zh: "高级顾问，财务转型" } },
    marketing: { name: { en: "Marcus", zh: "马克" }, role: { en: "Manager, Customer & Marketing", zh: "经理，客户与营销" } },
    ops: { name: { en: "Sarah Deng", zh: "邓莎拉" }, role: { en: "Senior Manager, Core Business Operations", zh: "高级经理，核心业务运营" } },
    hr: { name: { en: "Coco Ye", zh: "叶可可" }, role: { en: "Manager, Human Capital", zh: "经理，人力资本" } },
    tech: { name: { en: "Ryan Xu", zh: "徐锐" }, role: { en: "Manager, Enterprise Technology & Performance", zh: "经理，企业技术与绩效" } },
    product: { name: { en: "Chen Jing", zh: "陈静" }, role: { en: "Consultant, Consumer Products", zh: "顾问，消费品行业" } },
  };
  return NAMES[trackId];
}

router.post("/gatekeeper/chat", async (req, res) => {
  try {
    const s = getSession(req.body?.sessionId, false);
    const { trackId, text } = req.body || {};
    const lang = langOf(req);
    const track = trackById(trackId);
    if (!track) return res.status(400).json({ error: "Unknown track" });
    if (typeof text !== "string" || !text.trim() || text.length > 2000)
      return res.status(400).json({ error: "Message must be 1–2000 characters" });
    if (["passed"].includes(s.tasks[track.taskId]?.status))
      return res.status(409).json({ error: TT(lang, "You've already passed this check.", "你已经通过这项考核了。") });

    const g = s.gatekeepers[trackId];
    g.transcript.push({ role: "learner", text: text.trim() });
    if (g.transcript.length > 40) g.transcript.splice(0, g.transcript.length - 40);

    const npc = gatekeeperNpcFromTrack(trackId);
    const system = buildGatekeeperPrompt(track, npc, lang) + INJECTION_GUARD;
    const messages = g.transcript.map((m) => ({
      role: m.role === "learner" ? "user" : "assistant",
      content: m.text,
    }));

    const raw = await callAnthropic({ model: CHAT_MODEL, max_tokens: 700, system, messages });

    // Strip [[UNKNOWN:execId:topic]] tags, log each as a fresh notebook lead.
    const leads = [];
    const reply = raw.replace(/\[\[UNKNOWN:([a-z]+):([^\]]+)\]\]/g, (_, execId, topic) => {
      const key = `${execId}:${topic.trim().toLowerCase()}`;
      if (!g.knownGaps.includes(key)) {
        g.knownGaps.push(key);
        leads.push({ execId, topic: topic.trim() });
      }
      return "";
    }).trim();

    g.transcript.push({ role: "gatekeeper", text: reply });
    // (A clean bullet summary of the whole chat is written to the notebook when
    // the player leaves — see /gatekeeper/quiz — instead of raw per-turn logs.)

    for (const lead of leads) {
      const execTitle = LB(PERSONA_MAP[lead.execId]?.title, lang) || lead.execId;
      addQuestEntry(s, "lead",
        TT(lang, `Ask ${execTitle} about: ${lead.topic}`, `记得问${execTitle}：${lead.topic}`),
        TT(lang, `${LB(npc.name, lang)} doesn't have visibility into this — it's above the Deloitte team's line of sight.`,
          `${LB(npc.name, lang)}对此没有信息——这已经超出德勤团队的了解范围了。`));
    }
    touch(s);
    res.json({ ...publicState(s), text: reply, leads });
  } catch (err) {
    console.error("[gatekeeper chat]", err.message, err.detail || "");
    res.status(err.status || 500).json({ error: err.message });
  }
});

/**
 * Leaving triggers the check: generate 2 short questions AND a concise
 * bullet summary of the main points from THIS conversation (both in one call).
 * The summary is written to the notebook (replacing any prior one for this
 * track) so the player has clean notes to answer from — not a raw transcript.
 */
router.post("/gatekeeper/quiz", async (req, res) => {
  try {
    const s = getSession(req.body?.sessionId, false);
    const { trackId } = req.body || {};
    const lang = langOf(req);
    const track = trackById(trackId);
    if (!track) return res.status(400).json({ error: "Unknown track" });
    const g = s.gatekeepers[trackId];

    const convo = g.transcript.length
      ? g.transcript.map((m) => `${m.role === "learner" ? "Learner" : "Manager"}: ${m.text}`).join("\n")
      : "(The learner left without asking anything.)";

    let questions, summary;
    try {
      const out = await callAnthropic({
        model: LIGHT_MODEL,
        max_tokens: 1200,
        system:
          `A junior consultant just finished (or skipped) a conversation with a Deloitte domain manager about Nike Greater China. Based on the conversation below:\n` +
          `1) Write a "summary" — 3-5 concise bullet points capturing the KEY FACTS the manager actually shared (numbers, causes, competitor moves). Each bullet on its own line starting with "• ". If the conversation is empty/thin, base the bullets on this domain background: ${track.knowledge.slice(0, 600)}.\n` +
          `2) Write exactly 2 short quiz "questions" that test whether the learner absorbed those specific points (answerable in 1-3 sentences).\n` +
          `Write BOTH English and Chinese versions of the summary and each question (same meaning). ` +
          `Reply with ONLY JSON: {"summary":{"en":"• ...\\n• ...","zh":"• ...\\n• ..."},"questions":[{"en":"...","zh":"..."},{"en":"...","zh":"..."}]}`,
        messages: [{ role: "user", content: convo.slice(0, 3000) }],
      });
      const parsed = parseModelJson(out);
      questions = Array.isArray(parsed.questions) && parsed.questions.length === 2 ? parsed.questions : null;
      summary = parsed.summary && (parsed.summary.en || parsed.summary.zh) ? parsed.summary : null;
    } catch { /* fall through to fallback */ }

    if (!questions) {
      questions = [
        { en: `In your own words, summarize the main issue in the ${LB(track.name, "en")} domain for Nike Greater China.`,
          zh: `用你自己的话总结一下耐克大中华区在${LB(track.name, "zh")}领域的主要问题。` },
        { en: `Name one thing this domain's manager would NOT be able to answer, and who you'd ask instead.`,
          zh: `说出一件这个领域的经理无法回答的事，以及你会去问谁。` },
      ];
    }
    g.quiz = { questions, generatedAt: now() };

    // Save/refresh the conversation summary in the notebook (dedup per track).
    if (summary) {
      const npc = gatekeeperNpcFromTrack(trackId);
      s.questLog = s.questLog.filter((e) => !(e.type === "summary" && e._track === trackId));
      s.questLog.push({
        t: Date.now(), type: "summary", _track: trackId,
        title: TT(lang, `Notes — your chat with ${LB(npc.name, "en")}`, `笔记 — 与${LB(npc.name, "zh")}的对话`),
        body: LB(summary, lang).slice(0, 1200),
      });
      if (s.questLog.length > 400) s.questLog.splice(0, s.questLog.length - 400);
    }
    touch(s);
    res.json({ questions, summary: summary || null });
  } catch (err) {
    console.error("[gatekeeper quiz]", err.message, err.detail || "");
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.post("/gatekeeper/grade", async (req, res) => {
  try {
    const s = getSession(req.body?.sessionId, false);
    const { trackId, answers } = req.body || {};
    const lang = langOf(req);
    const track = trackById(trackId);
    if (!track) return res.status(400).json({ error: "Unknown track" });
    if (!Array.isArray(answers) || answers.length !== 2 || answers.some((a) => typeof a !== "string" || !a.trim() || a.length > 2000))
      return res.status(400).json({ error: "Both answers are required (1–2000 characters each)." });
    // Only a genuine PASS closes the check — so a passed track can't be re-graded.
    if (s.tasks[track.taskId]?.status === "passed")
      return res.json({ ...publicState(s), result: "already", feedback: TT(lang, "You already passed this check.", "你已经通过这项考核了。") });

    const g = s.gatekeepers[trackId];
    const quiz = g.quiz?.questions || [];
    const convo = g.transcript.length
      ? g.transcript.map((m) => `${m.role === "learner" ? "Learner" : "Manager"}: ${m.text}`).join("\n")
      : "(no prior conversation)";
    const qa = quiz.map((q, i) => `Q${i + 1}: ${LB(q, "en")}\nA${i + 1}: ${answers[i]}`).join("\n\n");

    const { grade, feedback } = await gradeQuizAnswers(convo, qa, lang);

    // STRICT gate: only PASS unlocks the executive and grants credibility.
    // PARTIAL and FAIL are both retryable — the learner keeps revising until
    // they genuinely get the full picture, with feedback each time.
    if (grade === "pass") {
      s.tasks[track.taskId] = { status: "passed", delta: track.credibility, feedback };
      addQuestEntry(s, "task", TT(lang, "Check passed: ", "考核通过：") + LB(track.name, lang),
        qa.slice(0, 500) + "\n" + TT(lang, "Feedback: ", "反馈：") + feedback);
      addCredibility(s, track.credibility, LB(track.name, lang));
      const execTitle = LB(PERSONA_MAP[track.personaId]?.title, lang);
      addQuestEntry(s, "unlock", TT(lang, `Executive unlocked: ${execTitle}`, `高管已解锁：${execTitle}`),
        TT(lang, "Their office is on Floor 15. Meetings are timed and limited — prep first.", "TA的办公室在15层。会面限时限次——先做好准备。"));
    } else {
      // Not yet — keep it open (retryable), no credibility, executive stays locked.
      s.tasks[track.taskId] = { status: "failed", delta: 0, feedback, grade };
    }
    touch(s);
    res.json({ ...publicState(s), result: grade, feedback, delta: grade === "pass" ? track.credibility : 0 });
  } catch (err) {
    console.error("[gatekeeper grade]", err.message, err.detail || "");
    res.status(err.status || 500).json({ error: err.message });
  }
});

/* --------------------- C-suite interviews (timed) ---------------------- */

router.post("/interaction/start", (req, res) => {
  const s = getSession(req.body?.sessionId, false);
  const { personaId } = req.body || {};
  const lang = langOf(req);
  const persona = PERSONA_MAP[personaId];
  if (!persona) return res.status(400).json({ error: "Unknown persona" });
  requireTrackPassed(s, personaId, lang);
  const st = s.personas[personaId];
  if (st.active && now() < st.active.expiresAt) {
    return res.json({ ...publicState(s), expiresAt: st.active.expiresAt }); // resume live session
  }
  if (st.used >= GAME_CONFIG.csuite.maxInteractions) {
    return res.status(409).json({
      error: TT(lang, `${LB(persona.shortTitle, "en")}'s calendar is full — no meetings left.`, `${LB(persona.shortTitle, "zh")}的日程已满——没有剩余会面次数了。`),
    });
  }
  st.used += 1; // consumed the moment the meeting starts — no rewinding
  st.active = { startedAt: now(), expiresAt: now() + GAME_CONFIG.csuite.timePerInteractionSeconds * 1000 };
  addQuestEntry(s, "meeting",
    TT(lang, `Meeting ${st.used}/${GAME_CONFIG.csuite.maxInteractions} started: `, `会面开始（${st.used}/${GAME_CONFIG.csuite.maxInteractions}）：`) + LB(persona.title, lang), "");
  touch(s);
  res.json({ ...publicState(s), expiresAt: st.active.expiresAt });
});

router.post("/chat", async (req, res) => {
  try {
    const s = getSession(req.body?.sessionId, false);
    const { personaId, text } = req.body || {};
    const lang = langOf(req);
    const persona = PERSONA_MAP[personaId];
    if (!persona) return res.status(400).json({ error: "Unknown persona" });
    if (typeof text !== "string" || !text.trim() || text.length > 2000)
      return res.status(400).json({ error: "Message must be 1–2000 characters" });
    const st = s.personas[personaId];

    // Mid-level staff: untimed, unlimited conversations — no meeting slot, no
    // clock, no mood cutoff. Access still requires the parent line's check.
    if (persona.tier === "mid") {
      requireTrackPassed(s, persona.parent, lang);
      st.transcript.push({ role: "learner", text: text.trim() });
      if (st.transcript.length > 60) st.transcript.splice(0, st.transcript.length - 60);
      const reply = await personaReply(s, personaId, lang, FOCUSED_ANSWER_RULE);
      st.transcript.push({ role: "persona", personaId, text: reply });
      touch(s);
      return res.json({ ...publicState(s), text: reply, ended: false });
    }

    if (!st.active) return res.status(409).json({ error: TT(lang, "No active meeting with this persona.", "当前没有与这位高管的进行中会面。") });
    if (now() >= st.active.expiresAt) {
      st.active = null;
      touch(s);
      return res.json({ ...publicState(s), ended: true, text: closing(lang) });
    }

    // In-meeting mood: if the previous turns already dragged mood past the
    // cutoff, the exec ends the meeting NOW — being cut off is the lesson.
    st.active.mood = st.active.mood || 0;
    if (st.active.mood <= MOOD_CUTOFF) {
      const line = cutoffLine(lang);
      st.transcript.push({ role: "persona", personaId, text: line });
      addQuestEntry(s, "meeting",
        TT(lang, `${LB(persona.shortTitle, "en")} ended the meeting early`, `${LB(persona.shortTitle, "zh")}提前结束了会面`),
        TT(lang, "Too many shallow questions — the slot was still consumed.", "问题太浅——会面次数照样消耗。"));
      st.warmth -= 1; // walking out leaves a mark that carries to the finale
      st.active = null;
      touch(s);
      return res.json({ ...publicState(s), ended: true, text: line, cutOff: true });
    }

    st.transcript.push({ role: "learner", text: text.trim() });
    if (st.transcript.length > 60) st.transcript.splice(0, st.transcript.length - 60);

    // Mood from PRIOR turns shapes this reply (keeps classify + reply parallel
    // — no added latency); this turn's classification updates mood for next turn.
    const remainingRatio = (st.active.expiresAt - now()) / (GAME_CONFIG.csuite.timePerInteractionSeconds * 1000);
    const [reply, warmthDelta] = await Promise.all([
      personaReply(s, personaId, lang, FOCUSED_ANSWER_RULE + moodNote(st.active.mood, remainingRatio)),
      classifyQuestion(text, persona.title.en),
    ]);
    st.warmth += warmthDelta;
    if (st.active) st.active.mood += warmthDelta;
    st.transcript.push({ role: "persona", personaId, text: reply });
    addQuestEntry(s, "quote", `${LB(persona.shortTitle, lang)}: "${text.trim().slice(0, 80)}"`, reply);

    // server re-checks expiry AFTER generation too — the clock doesn't pause for the model
    const ended = now() >= st.active.expiresAt;
    if (ended) st.active = null;
    touch(s);
    res.json({
      ...publicState(s),
      text: reply,
      ended,
      closingText: ended ? closing(lang) : null,
      remainingMs: ended ? 0 : st.active.expiresAt - now(),
    });
  } catch (err) {
    console.error("[game chat]", err.message, err.detail || "");
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.post("/interaction/end", (req, res) => {
  const s = getSession(req.body?.sessionId, false);
  const st = s.personas[req.body?.personaId];
  if (st?.active) {
    st.active = null;
    touch(s);
  }
  res.json(publicState(s));
});

/* ----------------------- final board meeting --------------------------- */

router.post("/board/start", (req, res) => {
  const s = getSession(req.body?.sessionId, false);
  const lang = langOf(req);
  const n = interviewedCount(s);
  if (n < PERSONAS.length) {
    throw Object.assign(new Error(TT(lang,
      `The board convenes once you've interviewed all seven executives — you're at ${n}/7.`,
      `访谈完七位高管后董事会才会召开——你目前完成了${n}/7。`)), { status: 403 });
  }
  if (!s.flags.interimDone) {
    throw Object.assign(new Error(TT(lang,
      "Manager Lin expects an interim readout before the board convenes — see her on Floor 12 first.",
      "董事会召开前，林经理要先听你的中期汇报——请先去12层找她。")), { status: 403 });
  }
  if (s.board.done) return res.status(409).json({ error: TT(lang, "The board meeting is already concluded.", "董事会会议已经结束了。") });
  if (!s.board.active || now() >= s.board.active.expiresAt) {
    s.board.active = { startedAt: now(), expiresAt: now() + GAME_CONFIG.boardMeeting.timeSeconds * 1000 };
    addQuestEntry(s, "meeting", TT(lang, "FINAL BOARD MEETING started", "最终董事会会议开始"),
      TT(lang, "All seven Nike Greater China executives are in the room. Pitch your resource-allocation strategy.", "耐克大中华区七位高管齐聚一室。汇报你的资源分配战略。"));
    touch(s);
  }
  res.json({ ...publicState(s), expiresAt: s.board.active.expiresAt });
});

router.post("/board/chat", async (req, res) => {
  try {
    const s = getSession(req.body?.sessionId, false);
    const { text } = req.body || {};
    const lang = langOf(req);
    if (typeof text !== "string" || !text.trim() || text.length > 3000)
      return res.status(400).json({ error: "Message must be 1–3000 characters" });
    if (!s.board.active) return res.status(409).json({ error: TT(lang, "The board meeting is not in session.", "董事会会议尚未开始。") });
    if (now() >= s.board.active.expiresAt) {
      s.board.active = null;
      s.board.done = true;
      touch(s);
      return res.json({ ...publicState(s), ended: true, replies: [{ personaId: "ceo", text: TT(lang, "We're out of time — thank you, everyone. Athena, your supervisor will debrief you.", "时间到了——谢谢各位。Athena，你的主管会和你复盘。") }] });
    }

    s.board.transcript.push({ role: "learner", text: text.trim() });

    // Route: which executives respond (reuses the group-chat routing approach).
    const allIds = PERSONAS.map((p) => p.id);
    let responders;
    try {
      const roster = PERSONAS.map((p) => `id="${p.id}" — ${p.title.en}: ${p.tagline.en}`).join("\n");
      const judgment = await callAnthropic({
        model: LIGHT_MODEL,
        max_tokens: 80,
        system:
          `You route a consultant's statement (English or Chinese) in a board meeting with these participants:\n${roster}\n` +
          `Output ONLY a JSON array of the 1-3 ids whose domains the statement most genuinely touches, most relevant first. If it addresses the whole room broadly, pick the 2-3 most relevant.`,
        messages: [{ role: "user", content: text.slice(0, 1500) }],
      });
      const parsed = JSON.parse(judgment.match(/\[.*\]/s)?.[0] || "[]").filter((id) => allIds.includes(id));
      responders = parsed.length ? [...new Set(parsed)].slice(0, 3) : ["ceo"];
    } catch {
      responders = ["ceo"];
    }

    const extra = `\n\nBOARD MEETING FINALE: this is the learner's final pitch of their 5-year Nike Greater China strategy and resource allocation. React as an executive hearing a pitch — probe, agree, or push back from your lens. Keep it to a tight paragraph.`;
    const replies = [];
    for (const pid of responders) {
      const reply = await personaReply(s, pid, lang, extra, allIds);
      s.board.transcript.push({ role: "persona", personaId: pid, text: reply });
      replies.push({ personaId: pid, text: reply });
      addQuestEntry(s, "board", LB(PERSONA_MAP[pid].shortTitle, lang) + TT(lang, " (board)", "（董事会）"), reply);
    }
    if (s.board.transcript.length > 80) s.board.transcript.splice(0, s.board.transcript.length - 80);

    const ended = now() >= s.board.active.expiresAt;
    if (ended) { s.board.active = null; s.board.done = true; }
    touch(s);
    res.json({ ...publicState(s), replies, ended, remainingMs: ended ? 0 : s.board.active.expiresAt - now() });
  } catch (err) {
    console.error("[board]", err.message, err.detail || "");
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.post("/board/end", (req, res) => {
  const s = getSession(req.body?.sessionId, false);
  const lang = langOf(req);
  if (s.board.active) {
    s.board.active = null;
    s.board.done = true;
    addQuestEntry(s, "meeting", TT(lang, "Board meeting concluded", "董事会会议结束"), TT(lang, "You wrapped the pitch.", "你完成了汇报。"));
    touch(s);
  }
  res.json(publicState(s));
});

/**
 * Board deck review — the player presents an uploaded 5-year strategy deck
 * (PPTX/PDF/DOCX, extracted client-side to text) and EACH of the seven
 * executives evaluates it against their own criteria (REVIEW_CRITERIA), so
 * the CFO weighs financials, the CHRO org capability, etc. Returns a
 * per-executive verdict + comments. Runs in parallel for speed.
 */
router.post("/board/review-deck", async (req, res) => {
  try {
    const s = getSession(req.body?.sessionId, false);
    const { text } = req.body || {};
    const lang = langOf(req);
    const n = interviewedCount(s);
    if (n < PERSONAS.length) {
      return res.status(403).json({ error: TT(lang,
        `Present to the board once you've interviewed all seven executives — you're at ${n}/7.`,
        `访谈完七位高管后才能向董事会汇报——你目前完成了${n}/7。`) });
    }
    if (typeof text !== "string" || !text.trim() || text.length > 40000)
      return res.status(400).json({ error: TT(lang, "Deck text must be 1–40,000 characters.", "汇报内容需为1–40,000字符。") });

    const evals = await Promise.all(PERSONAS.map(async (p) => {
      const crit = REVIEW_CRITERIA[p.id]?.criteria || `Judge as the ${p.title.en}, from your functional priorities.`;
      const bench = BENCHMARKS[p.id] ? `\nYOUR BENCHMARKING FILE (verified figures — judge the deck against these):\n${BENCHMARKS[p.id]}\n` : "";
      try {
        const out = await callAnthropic({
          model: CHAT_MODEL,
          max_tokens: 700,
          system:
            `You are ${LB(p.title, "en")} of Nike Greater China, sitting on the board hearing a junior consultant's final 5-year strategy pitch (deck text below). ` +
            `Evaluate it ONLY from your functional lens.\nYOUR CRITERIA:\n${crit}\n${bench}\n` +
            `Stay fully in character. Reply with ONLY JSON: {"verdict":"strong"|"acceptable"|"weak","comments":"<2-3 concise sentences from your perspective — what satisfies you, what worries you — written in ${lang === "zh" ? "Simplified Chinese" : "English"}>"}`,
          messages: [{ role: "user", content: text.slice(0, 40000) }],
        });
        const parsed = parseModelJson(out);
        const verdict = ["strong", "acceptable", "weak"].includes(parsed.verdict) ? parsed.verdict : "acceptable";
        const comments = (typeof parsed.comments === "string" && parsed.comments.trim())
          ? parsed.comments.slice(0, 800) : TT(lang, "Noted.", "了解。");
        return { personaId: p.id, name: LB(p.title, lang), short: LB(p.shortTitle, lang), verdict, comments };
      } catch (e) {
        return { personaId: p.id, name: LB(p.title, lang), short: LB(p.shortTitle, lang), verdict: "error", comments: TT(lang, "(couldn't reach this executive — try again)", "（暂时联系不到这位高管——请重试）") };
      }
    }));

    s.board.deckReviewed = true;
    addQuestEntry(s, "board", TT(lang, "Board reviewed your strategy deck", "董事会审阅了你的战略汇报"),
      evals.map((e) => `${e.short}: ${e.verdict} — ${e.comments}`).join("\n"));
    touch(s);
    res.json({ ...publicState(s), evals });
  } catch (err) {
    console.error("[board review-deck]", err.message, err.detail || "");
    res.status(err.status || 500).json({ error: err.message });
  }
});

/* --------------------- interim readout (Manager Lin) -------------------- */
/**
 * Mid-engagement synthesis checkpoint — after 3+ executive interviews the
 * player gives Manager Lin an interim readout ("what do you believe now and
 * why"). Required before the board convenes; mirrors how real engagements
 * run (client updates, not a single final reveal).
 */
router.post("/interim", async (req, res) => {
  try {
    const s = getSession(req.body?.sessionId, false);
    const { answer } = req.body || {};
    const lang = langOf(req);
    if (s.flags.interimDone)
      return res.json({ ...publicState(s), result: "already", feedback: TT(lang, "You've already given your interim readout.", "你已经做过中期汇报了。") });
    const n = interviewedCount(s);
    if (n < 3) {
      return res.status(403).json({ error: TT(lang,
        `Come back after at least 3 executive interviews — you're at ${n}.`,
        `至少访谈3位高管后再来——你目前完成了${n}位。`) });
    }
    if (typeof answer !== "string" || !answer.trim() || answer.length > 4000)
      return res.status(400).json({ error: "Answer must be 1–4000 characters" });

    const recentQuotes = s.questLog.filter((e) => e.type === "quote").slice(-10)
      .map((e) => `${e.title}: ${e.body.slice(0, 150)}`).join("\n");
    const out = await callAnthropic({
      model: LIGHT_MODEL,
      max_tokens: 350,
      system:
        `You grade a trainee consultant's INTERIM READOUT on the Nike Greater China case — a mid-engagement synthesis of what they believe so far and why, after interviewing ${n} of 7 executives. It may be in English or Chinese.\n` +
        `WHAT THEY'VE ACTUALLY HEARD (recent interview excerpts):\n${recentQuotes.slice(0, 2500)}\n\n` +
        `PASS if the readout states a current point of view (not just facts), ties it to something they actually heard, and names what they still need to test. PARTIAL if it's a fact summary without a stance or next steps. FAIL if generic, empty, or contradicts the case facts. ` +
        `Reply with ONLY JSON: {"grade":"pass"|"partial"|"fail","feedback":"<two specific sentences as Manager Lin — warm but candid, written in ${lang === "zh" ? "Simplified Chinese" : "English"}>"}`,
      messages: [{ role: "user", content: answer }],
    });
    let grade = "partial", feedback = TT(lang, "Noted. Keep testing it.", "记下了。继续验证。");
    {
      const parsed = parseModelJson(out);
      if (["pass", "partial", "fail"].includes(parsed.grade)) grade = parsed.grade;
      if (typeof parsed.feedback === "string") feedback = parsed.feedback.slice(0, 500);
    }

    // ⚠ PLACEHOLDER credibility values
    const delta = grade === "pass" ? 30 : grade === "partial" ? 15 : 0;
    if (grade !== "fail") s.flags.interimDone = true; // fail = revise and return
    addQuestEntry(s, "task",
      TT(lang, `Interim readout ${grade}`, grade === "fail" ? "中期汇报未过" : grade === "pass" ? "中期汇报通过" : "中期汇报部分通过"),
      TT(lang, "Your readout: ", "你的汇报：") + answer.slice(0, 300) + "\n" + TT(lang, "Lin: ", "林经理：") + feedback);
    if (delta) addCredibility(s, delta, TT(lang, "Interim readout", "中期汇报"));
    touch(s);
    res.json({ ...publicState(s), result: grade, feedback, delta });
  } catch (err) {
    console.error("[interim]", err.message, err.detail || "");
    res.status(err.status || 500).json({ error: err.message });
  }
});

/* --------------------- work review (file upload) ------------------------ */
/**
 * The player uploads a working document; a chosen reviewer (Manager Lin or
 * any unlocked executive) audits it against per-persona criteria
 * (shared/reviewCriteria.js — placeholders until the owner defines them).
 * Feedback only, no credibility — this is a quality audit, not a check.
 */
router.post("/review-work", async (req, res) => {
  try {
    const s = getSession(req.body?.sessionId, false);
    const { reviewerId, filename, text } = req.body || {};
    const lang = langOf(req);
    if (typeof text !== "string" || !text.trim() || text.length > 30000)
      return res.status(400).json({ error: TT(lang, "Document must be 1–30,000 characters of text.", "文档需为1–30,000字符的文本。") });

    // Resolve one of three reviewer kinds: supervisor, a Deloitte gatekeeper
    // (by their NPC id, gated on having talked to them), or a Nike executive
    // (by personaId, gated on having passed their domain check).
    let criteria, reviewerName, identity;
    const gkTrackId = Object.keys(TRACKS).find((k) => TRACKS[k].npcId === reviewerId);

    if (reviewerId === "supervisor") {
      criteria = REVIEW_CRITERIA.supervisor.criteria;
      reviewerName = LB(REVIEW_CRITERIA.supervisor.reviewer, lang);
      identity = "You are Manager Lin, a warm but exacting Deloitte engagement manager.";
    } else if (gkTrackId) {
      if (!s.gatekeepers[gkTrackId]?.transcript?.length) {
        return res.status(403).json({ error: TT(lang,
          "Talk with this manager first before asking them to review your work.",
          "先和这位经理聊过，再请TA审阅你的草稿。") });
      }
      const npc = gatekeeperNpcFromTrack(gkTrackId);
      criteria = GATEKEEPER_REVIEW[gkTrackId].criteria;
      reviewerName = `${LB(npc.name, lang)} · ${LB(npc.role, lang)}`;
      identity = `You are ${npc.name.en}, ${npc.role.en}, a Deloitte consultant mentoring a junior analyst on the Nike Greater China engagement.`;
    } else if (PERSONA_MAP[reviewerId]) {
      const track = trackForPersona(reviewerId);
      const t = track && s.tasks[track.taskId];
      if (!t || !["passed"].includes(t.status)) {
        return res.status(403).json({ error: TT(lang,
          "This executive doesn't review documents from analysts they haven't met — pass their domain manager's check first.",
          "这位高管不审阅未见过的分析师的文档——请先通过对应领域经理的考核。") });
      }
      criteria = REVIEW_CRITERIA[reviewerId]?.criteria || "Judge as a senior Nike Greater China executive.";
      reviewerName = LB(PERSONA_MAP[reviewerId].title, lang);
      identity = `You are the ${PERSONA_MAP[reviewerId].title.en} of Nike Greater China.`;
    } else {
      return res.status(400).json({ error: "Unknown reviewer" });
    }
    const crit = { criteria };

    const out = await callAnthropic({
      model: CHAT_MODEL,
      max_tokens: 1000,
      system:
        `${identity} A junior consultant has submitted a working document for your review (filename: ${String(filename || "untitled").slice(0, 100)}). ` +
        `REVIEW CRITERIA:\n${crit.criteria}\n\n` +
        `Audit the document honestly against the criteria. Stay fully in character. ` +
        `Reply with ONLY JSON: {"verdict":"strong"|"acceptable"|"weak","comments":"<3-4 concise sentences: what works, what doesn't, and the single most important fix — written in ${lang === "zh" ? "Simplified Chinese" : "English"}>"}`,
      messages: [{ role: "user", content: text.slice(0, 30000) }],
    });
    let verdict = "acceptable", comments = TT(lang, "Reviewed.", "已审阅。");
    {
      const parsed = parseModelJson(out);
      if (["strong", "acceptable", "weak"].includes(parsed.verdict)) verdict = parsed.verdict;
      if (typeof parsed.comments === "string" && parsed.comments.trim()) comments = parsed.comments.slice(0, 1000);
    }

    addQuestEntry(s, "review",
      TT(lang, `Work review (${verdict}) — ${reviewerName}`, `文档审阅（${verdict === "strong" ? "优秀" : verdict === "acceptable" ? "合格" : "待改进"}）— ${reviewerName}`),
      `${String(filename || "untitled").slice(0, 80)}\n${comments}`);
    touch(s);
    res.json({ ...publicState(s), verdict, comments, reviewerName });
  } catch (err) {
    console.error("[review-work]", err.message, err.detail || "");
    res.status(err.status || 500).json({ error: err.message });
  }
});

/* --------------------- document text extraction ------------------------- */

// Uploaded .pdf / .docx / .txt → plain text (fills the review textarea).
// Server-wide JSON limit is 8mb (server.js) to admit base64 file payloads.
router.post("/extract-text", async (req, res) => {
  try {
    const { filename, fileBase64 } = req.body || {};
    if (typeof fileBase64 !== "string" || !fileBase64) {
      return res.status(400).json({ error: "Missing file data" });
    }
    const buffer = Buffer.from(fileBase64, "base64");
    const text = await extractText(String(filename || ""), buffer);
    res.json({ text });
  } catch (err) {
    console.error("[extract-text]", err.message);
    res.status(err.status || 500).json({ error: err.message });
  }
});

/* ------------------------------ debrief -------------------------------- */

router.post("/debrief", async (req, res) => {
  try {
    const s = getSession(req.body?.sessionId, false);
    const lang = langOf(req);
    const taskLines = Object.entries(s.tasks)
      .map(([id, t]) => `${id}: ${t.status} (+${t.delta})`).join(", ") || "none";
    const warmthLines = PERSONAS
      .map((p) => `${p.shortTitle.en}: warmth ${s.personas[p.id].warmth}, meetings used ${s.personas[p.id].used}`)
      .join("; ");
    let text;
    try {
      text = await callAnthropic({
        model: LIGHT_MODEL,
        max_tokens: 500,
        system:
          `You are Manager Lin, a warm but candid Deloitte engagement manager, debriefing a new analyst ("Athena") at the end of a training simulation. ` +
          `This is narrative closing feedback only — NOT the official grade (their written strategy document is assessed separately). ` +
          `Write entirely in ${lang === "zh" ? "Simplified Chinese (简体中文)" : "English"}. ` +
          `Speak in second person, 3 short paragraphs max: (1) what they did well, (2) what to sharpen (mention if any executives found their questions shallow — negative warmth means shallow), (3) send-off reminding them the real deliverable is their written strategy.`,
        messages: [{
          role: "user",
          content: `Final credibility: ${s.credibility}. Checks: ${taskLines}. Executive rapport: ${warmthLines}. Board meeting done: ${s.board.done}.`,
        }],
      });
    } catch {
      text = TT(lang,
        `Solid first engagement, Athena. You finished with ${s.credibility} credibility. Remember: this walkthrough isn't your grade — your written 5-year strategy is the real deliverable. Go write it.`,
        `第一个项目做得不错，Athena。你最终拿到了${s.credibility}信誉值。记住：这次演练不是你的成绩——你写的五年战略才是真正的交付物。去写吧。`);
    }
    s.flags.debriefDone = true;
    addQuestEntry(s, "debrief", TT(lang, "Debrief from Manager Lin", "林经理的复盘"), text);
    touch(s);
    res.json({ ...publicState(s), text });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// Sync throws (locked execs, unknown sessions) surface as JSON, not HTML stacks.
router.use((err, _req, res, _next) => {
  res.status(err.status || 500).json({ error: err.message });
});

export default router;
