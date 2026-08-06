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
import { resolveTrack } from "./trackKnowledge.js";
import { REVIEW_CRITERIA, GATEKEEPER_REVIEW } from "../../shared/reviewCriteria.js";
import { BENCHMARKS } from "../../shared/benchmarks.js";
import { ASIS_MIN_INTERVIEWS } from "../../shared/phases.js";
import { grantPack, DATA_PACK_MAP, packForSource } from "../../shared/workspace.js";
import { retrieve } from "../rag/retriever.js";
import { callAnthropic, CHAT_MODEL, LIGHT_MODEL, parseModelJson } from "../anthropic.js";
import { readDeck, REQUIRED_SLIDES } from "../pptx.js";
import { extractText } from "./extract.js";
import { INJECTION_GUARD } from "./guards.js";
import {
  getSession, hasSession, touch, publicState, addQuestEntry, addCredibility, resetSession,
} from "./sessionStore.js";

const router = express.Router();
// Executive interview replies. Raised from 900: bilingual answers ran past it
// and stopped mid-sentence. callAnthropic() continues past the ceiling now, so
// this is a cost guard rather than the thing that decides answer length.
const MAX_TOKENS = Number(process.env.MAX_TOKENS || 1600);
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

/** Hand the stakeholder's data pack to the binder (once) + log it. */
function grantWorkspacePack(s, personaId, lang) {
  if (!s.workspace) return;
  const granted = grantPack(s.workspace, personaId);
  if (granted) {
    const pack = DATA_PACK_MAP[granted];
    // The pack's actual content goes in the notebook entry, not a pointer to a
    // separate panel — the notebook (Q) is where the player reads it now.
    addQuestEntry(s, "datapack",
      TT(lang, `📁 Data pack received: ${LB(pack.title, "en")}`, `📁 收到数据包：${LB(pack.title, "zh")}`),
      LB(pack.summary, lang));
  }
}

/** Executive access requires passing that domain's gatekeeper check. */
function requireTrackPassed(s, personaId, lang) {
  // No admin exemption: in admin mode the gatekeeper's check passes on any
  // answer, but you still have to go and take it before the executive will see
  // you — the unlock order is part of the flow being tested.
  const track = resolveTrack(trackForPersona(personaId));
  if (!track) return;
  // The C-suite opens once, for everyone, after the WHOLE diagnostic is done —
  // not one executive at a time. Gating each office on its own manager's check
  // let a learner meet the CEO having understood a seventh of the business,
  // which inverts the lesson: you diagnose before you prescribe.
  const all = Object.values(TRACKS);
  const passed = all.filter((tr) => s.tasks[tr.taskId]?.status === "passed").length;
  if (passed < all.length) {
    throw Object.assign(new Error(TT(lang,
      `The Nike executives receive the team once the diagnostic is complete — you've cleared ${passed} of ${all.length} domain checks on Floor 10.`,
      `诊断阶段全部完成后，耐克高管才会接待项目组——你已通过10层 ${passed}/${all.length} 项领域考核。`)), { status: 403 });
  }
  // All seven checks alone don't open the door — Manager Lin still has to
  // debrief the diagnostic and clear the team in, the same way she'd never let
  // an analyst walk straight from the last domain manager into the C-suite.
  if (!s.flags.execBriefingDone) {
    throw Object.assign(new Error(TT(lang,
      "The diagnostic is done, but the executives won't see you until Manager Lin has debriefed you on it. Go find her on Floor 12.",
      "诊断已经完成，但你还没向林经理复盘，高管暂时不会见你。去12层找她。")), { status: 403 });
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
  // `resumed` lets the client tell "your save is here" from "the server has
  // never heard of you". They are otherwise indistinguishable: a session lost
  // to a restart is silently re-created empty under the same id, and the
  // player just sees their progress gone with no explanation.
  const resumed = hasSession(req.body?.sessionId);
  const s = getSession(req.body?.sessionId);
  res.json({ ...publicState(s), resumed });
});

/**
 * Admin / QA mode — a GRADING bypass, not a progress skip. The code is checked
 * HERE, on the server; the client never decides.
 *
 * Once on, every graded answer is accepted: the briefing check takes any
 * choice, gatekeeper checks and both alignment meetings always agree, the
 * interim readout always passes, and the deck/defence always score full marks.
 *
 * Everything else stays exactly as a real player experiences it. Admin does NOT
 * pre-award credibility, pre-complete phases, or pre-unlock executives — you
 * still walk the whole flow, still need the gatekeeper check before an
 * executive will see you, still need three interviews before the as-is
 * alignment, and still spend your three meetings per executive. Credibility is
 * earned as you pass each check, so the bar reads like a real run.
 *
 * The flag lives on the session, so it can be switched off again without a
 * reload and never leaks into another player's game.
 */
const ADMIN_CODE = process.env.ADMIN_CODE || "THUxDeloitte";
router.post("/admin", (req, res) => {
  const s = getSession(req.body?.sessionId, false);
  const { code, off } = req.body || {};
  if (off) {
    s.admin = false;
    touch(s);
    return res.json({ ...publicState(s), ok: true });
  }
  if (typeof code !== "string" || code !== ADMIN_CODE) return res.status(403).json({ error: "bad_code" });
  s.admin = true;
  // Deliberately grants nothing: no credibility, no completed tasks, no
  // unlocked executives, no phase advancement. The engagement is walked in the
  // normal order — admin only means the graders accept whatever you answer, so
  // credibility and progress still accrue check by check, as in a real run.
  addQuestEntry(s, "task", "[ADMIN] Admin mode enabled",
    "Checks and graded submissions now accept any answer. Progress, credibility and unlocks are unchanged — you still walk the full engagement. QA tool, not part of the engagement.");
  touch(s);
  res.json({ ...publicState(s), ok: true });
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
        "Manager Lin briefed you: build an independent 5-year growth strategy for Nike Greater China. Pick any domain track from the mission board (menu, M) — pass all seven managers' checks, then Lin will clear you to meet the whole Nike C-suite.",
        "林经理已向你交代：为耐克大中华区撰写一份独立的五年增长战略。从任务板（菜单M）任选一条领域线——通过全部七位经理的考核后，林经理会批准你去见耐克全部高管。"));
    touch(s);
  }
  // Player picked an active mission from the mission board.
  if (type === "selectMission" && (TRACKS[trackId] || trackId === null)) {
    s.selectedMission = TRACKS[trackId] ? trackId : null;
    touch(s);
  }
  // Manager Lin's mandatory post-diagnostic briefing. Only takes once all
  // seven domain checks are passed — everything else stays server-authoritative.
  if (type === "execBriefingDone" && !s.flags.execBriefingDone) {
    const allTracksPassed = Object.values(TRACKS).every((tr) => s.tasks[tr.taskId]?.status === "passed");
    if (allTracksPassed) {
      s.flags.execBriefingDone = true;
      addQuestEntry(s, "task", TT(lang, "Diagnostic debrief complete", "诊断复盘完成"),
        TT(lang,
          "Manager Lin has cleared you to meet the whole Nike C-suite on Floor 15.",
          "林经理已批准你去见15层全部耐克高管。"));
      touch(s);
    }
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
  const pass = s.admin || Number(choice) === task.correct; // admin: any choice passes
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
    strategy: { name: { en: "Zhou Mingzhe", zh: "周明哲" }, role: { en: "Manager, Strategy & Business Design", zh: "经理，战略与业务设计" } },
    finance: { name: { en: "Priya", zh: "普莉亚" }, role: { en: "Manager, Finance Transformation", zh: "经理，财务转型" } },
    marketing: { name: { en: "Tang Yawen", zh: "唐雅文" }, role: { en: "Manager, Brand & Consumer Insight", zh: "经理，品牌与消费者洞察" } },
    ops: { name: { en: "Fang Yuan", zh: "方远" }, role: { en: "Manager, Operations & Supply Chain", zh: "经理，运营与供应链" } },
    hr: { name: { en: "Su Ruoheng", zh: "苏若衡" }, role: { en: "Manager, Organization & Talent Transformation", zh: "经理，组织与人才转型" } },
    tech: { name: { en: "Lu Xingzhi", zh: "陆行知" }, role: { en: "Manager, Enterprise Technology & Performance", zh: "经理，企业技术与绩效" } },
    product: { name: { en: "Chen Jing", zh: "陈静" }, role: { en: "Manager, Consumer Products & Product Strategy", zh: "经理，消费品行业与产品战略" } },
  };
  return NAMES[trackId];
}

router.post("/gatekeeper/chat", async (req, res) => {
  try {
    const s = getSession(req.body?.sessionId, false);
    const { trackId, text } = req.body || {};
    const lang = langOf(req);
    const track = resolveTrack(trackById(trackId));
    if (!track) return res.status(400).json({ error: "Unknown track" });
    if (typeof text !== "string" || !text.trim() || text.length > 2000)
      return res.status(400).json({ error: "Message must be 1–2000 characters" });
    if (["passed"].includes(s.tasks[track.taskId]?.status))
      return res.status(409).json({ error: TT(lang, "You've already passed this check.", "你已经通过这项考核了。") });

    const g = s.gatekeepers[trackId];
    g.transcript.push({ role: "learner", text: text.trim() });
    if (g.transcript.length > 40) g.transcript.splice(0, g.transcript.length - 40);

    const npc = gatekeeperNpcFromTrack(trackId);
    // Roster of the OTHER domains so this manager can route sideways instead of
    // deflecting when asked about a function that isn't theirs.
    const sidewaysRoster = Object.entries(TRACKS)
      .filter(([tid, t]) => tid !== trackId && t.npcId && t.personaId)
      .map(([tid, t]) => `  · ${LB(t.name, lang)} — ${LB(gatekeeperNpcFromTrack(tid).name, lang)} (their Deloitte manager), or the ${LB(PERSONA_MAP[t.personaId].title, lang)} upstairs`)
      .join("\n");
    const system = buildGatekeeperPrompt(track, npc, lang, sidewaysRoster) + INJECTION_GUARD;
    const messages = g.transcript.map((m) => ({
      role: m.role === "learner" ? "user" : "assistant",
      content: m.text,
    }));

    // 700 clipped bilingual answers mid-sentence often enough to notice. The
    // ceiling is a safety net, not a length target — the prompt still asks for
    // a paragraph or two — and callAnthropic() now continues past it anyway.
    const raw = await callAnthropic({ model: CHAT_MODEL, max_tokens: 1400, system, messages });

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
/** Shape check on model output — a malformed MCQ must never reach the player. */
function validMcq(m) {
  return m && m.q && m.q.en && m.q.zh
    && Array.isArray(m.options) && m.options.length === 4
    && m.options.every((o) => o && typeof o.en === "string" && typeof o.zh === "string" && o.en.trim() && o.zh.trim())
    && Number.isInteger(m.correct) && m.correct >= 0 && m.correct < 4
    && m.why && m.why.en && m.why.zh;
}

/**
 * The domain check: 5 multiple-choice questions drawn from the TRACK'S OWN
 * KNOWLEDGE BASE — the same material the manager teaches from in conversation.
 *
 * Deliberately NOT generated from the transcript. The previous version wrote
 * the questions from the chat you had just had and saved a bullet summary into
 * the notebook "so the player has clean notes to answer from", which made the
 * check a reading-comprehension test of a conversation still on screen. Drawing
 * from track.knowledge means the only way through is to actually learn the
 * domain: ask the manager until you know it, then answer. Getting one wrong is
 * not a dead end — the manager explains and you try that question again.
 */
router.post("/gatekeeper/quiz", async (req, res) => {
  try {
    const s = getSession(req.body?.sessionId, false);
    const { trackId } = req.body || {};
    const lang = langOf(req);
    const track = resolveTrack(trackById(trackId));
    if (!track) return res.status(400).json({ error: "Unknown track" });
    if (s.tasks[track.taskId]?.status === "passed")
      return res.status(409).json({ error: TT(lang, "You've already passed this check.", "你已经通过这项考核了。") });

    const g = s.gatekeepers[trackId];

    // Generation is genuinely flaky: the model intermittently truncates the
    // (large, bilingual) JSON mid-array, or returns fewer than the 5 questions
    // it was asked for. Both are transient, so retry rather than failing the
    // player's check — a 503 here reads to them as the game being broken.
    let mcqs = null;
    for (let attempt = 0; attempt < 3 && !mcqs; attempt++) {
      try {
        const out = await callAnthropic({
          model: LIGHT_MODEL,
          // Five bilingual MCQs — question + 4 options + a teaching explanation,
          // each in English AND Chinese — is a lot of output, and Chinese runs
          // near one token per character. At 3000 this truncated every time.
          max_tokens: 8000,
          system:
            `You write domain checks for junior consultants on a Nike Greater China engagement.\n` +
            `From the DOMAIN MATERIAL below, write EXACTLY 5 multiple-choice questions (not 2, not 4 — five) testing genuine ` +
            `understanding — causes, trade-offs, and what the numbers MEAN — not trivia recall. Exactly 4 options each, exactly one correct.\n` +
            `DISTRACTOR RULE — this decides whether the check is worth anything. Every wrong option must be something a real ` +
            `junior consultant might actually believe or write in a draft. Never absurd, never self-evidently false, never a ` +
            `joke. Do not write options that can be eliminated on tone alone: avoid "always", "never", "only", "entirely", ` +
            `accusations of fraud, and invented rules. A reader who has NOT studied the material should find all four options ` +
            `credible; only someone who understands it should be able to pick the right one.\n` +
            `Keep each option under 18 words. For each question write "why": TWO sentences the manager says to explain the ` +
            `correct answer to someone who got it wrong — in character, teaching rather than scolding.\n` +
            `Write BOTH English and Chinese for every question, option and explanation (same meaning).\n` +
            `Reply with ONLY JSON, no prose before or after: {"mcqs":[{"q":{"en":"","zh":""},"options":[{"en":"","zh":""},{"en":"","zh":""},{"en":"","zh":""},{"en":"","zh":""}],"correct":0,"why":{"en":"","zh":""}}]}`,
          messages: [{ role: "user", content: `DOMAIN: ${LB(track.name, "en")}\n\nDOMAIN MATERIAL:\n${track.knowledge}` }],
        });
        const parsed = parseModelJson(out);
        const list = Array.isArray(parsed.mcqs) ? parsed.mcqs.filter(validMcq) : [];
        // Over-generation is fine and common; take the first five.
        if (list.length >= 5) mcqs = list.slice(0, 5);
        else {
          console.error(`[gatekeeper quiz] attempt ${attempt + 1} rejected:`, JSON.stringify({
            chars: out.length, topLevelKeys: Object.keys(parsed), valid: list.length,
          }));
        }
      } catch (e) {
        console.error(`[gatekeeper quiz] attempt ${attempt + 1} threw:`, e.message);
      }
    }

    // No silent fallback to a canned quiz: a check the player can pass without
    // knowing the domain is worse than no check at all.
    if (!mcqs) {
      return res.status(503).json({ error: TT(lang,
        "The check couldn't be prepared right now — step away and try again in a moment.",
        "暂时无法准备考核——请稍后再来。") });
    }

    g.quiz = {
      mcqs,
      answered: new Array(mcqs.length).fill(false),
      firstTry: new Array(mcqs.length).fill(null),
      generatedAt: now(),
    };
    touch(s);
    // The correct indices stay server-side — the client never receives the key.
    res.json({ questions: mcqs.map((m) => ({ q: m.q, options: m.options })) });
  } catch (err) {
    console.error("[gatekeeper quiz]", err.message, err.detail || "");
    res.status(err.status || 500).json({ error: err.message });
  }
});

/**
 * One answer at a time. Wrong → the manager's explanation comes back and the
 * question stays open for another attempt. The credibility award is set by
 * FIRST-attempt accuracy, so retrying to mastery is always allowed but the
 * score still reflects what the player actually knew walking in.
 */
router.post("/gatekeeper/answer", async (req, res) => {
  try {
    const s = getSession(req.body?.sessionId, false);
    const { trackId, index, choice } = req.body || {};
    const lang = langOf(req);
    const track = resolveTrack(trackById(trackId));
    if (!track) return res.status(400).json({ error: "Unknown track" });

    const quiz = s.gatekeepers[trackId]?.quiz;
    if (!quiz || !Array.isArray(quiz.mcqs) || !quiz.mcqs.length)
      return res.status(409).json({ error: TT(lang, "No check in progress.", "当前没有进行中的考核。") });
    if (!Number.isInteger(index) || index < 0 || index >= quiz.mcqs.length)
      return res.status(400).json({ error: "Bad question index" });
    if (!Number.isInteger(choice) || choice < 0 || choice > 3)
      return res.status(400).json({ error: "Bad choice" });
    if (s.tasks[track.taskId]?.status === "passed")
      return res.json({ ...publicState(s), correct: true, done: true, delta: 0, why: null, feedback: null });

    const m = quiz.mcqs[index];
    const correct = !!s.admin || choice === m.correct;
    if (quiz.firstTry[index] === null) quiz.firstTry[index] = correct;
    if (correct) quiz.answered[index] = true;

    const done = quiz.answered.every(Boolean);
    let delta = 0, feedback = null;
    if (done) {
      const firstPass = quiz.firstTry.filter(Boolean).length;
      // Full marks for finishing, however many attempts each question took. The
      // award used to scale with first-attempt accuracy, which docked
      // credibility for a wrong answer the learner then went and corrected —
      // penalising the exact behaviour the retry loop exists to encourage, on a
      // score that gates nothing. The first-try count is still reported back as
      // feedback, because that IS worth knowing; it just no longer costs.
      delta = track.credibility;
      feedback = TT(lang,
        `${firstPass}/${quiz.mcqs.length} right first time.`,
        `首次作答正确 ${firstPass}/${quiz.mcqs.length}。`);
      s.tasks[track.taskId] = { status: "passed", delta, feedback };
      addQuestEntry(s, "task", TT(lang, "Check passed: ", "考核通过：") + LB(track.name, lang), feedback);
      addCredibility(s, delta, LB(track.name, lang));
      // No single track unlocks its executive anymore — the C-suite opens
      // together, once ALL seven are passed and Lin has debriefed it.
      const allTracksPassed = Object.values(TRACKS).every((tr) => s.tasks[tr.taskId]?.status === "passed");
      if (allTracksPassed) {
        addQuestEntry(s, "unlock", TT(lang, "All seven domain checks passed", "七项领域考核全部通过"),
          TT(lang, "Report back to Manager Lin on Floor 12 for a debrief — she'll clear you to meet the whole Nike C-suite on Floor 15.",
            "回12层向林经理复盘——她会批准你去见15层全部耐克高管。"));
      }
    }
    touch(s);
    res.json({ ...publicState(s), correct, why: correct ? null : m.why, done, delta, feedback });
  } catch (err) {
    console.error("[gatekeeper answer]", err.message, err.detail || "");
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
  grantWorkspacePack(s, personaId, lang); // stakeholder hands over their data pack
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

router.post("/board/end", async (req, res) => {
  const s = getSession(req.body?.sessionId, false);
  const lang = langOf(req);
  if (s.board.active) {
    s.board.active = null;
    s.board.done = true;
    addQuestEntry(s, "meeting", TT(lang, "Board meeting concluded", "董事会会议结束"), TT(lang, "You wrapped the pitch.", "你完成了汇报。"));
    touch(s);
  }

  // Live-pitch deliverable: score 0-100 + per-executive fulfilled checklist,
  // graded once from the actual board transcript against each exec's
  // evaluation mindset (the reserved grading metadata — never used in chat).
  const pitched = s.board.transcript.some((m) => m.role === "learner");
  if (s.board.done && pitched && !s.board.result) {
    try {
      const rubric = PERSONAS.map((p) => `${p.id} (${p.shortTitle.en}): ${p.evaluationMindset.en}`).join("\n");
      const convo = s.board.transcript
        .map((m) => (m.role === "learner" ? `Learner: ${m.text}` : `${m.personaId}: ${m.text}`)).join("\n").slice(-12000);
      const out = await callAnthropic({
        model: LIGHT_MODEL,
        max_tokens: 400,
        system:
          `You grade a trainee consultant's FINAL BOARD PITCH of a 5-year Nike Greater China strategy (transcript below; may be English or Chinese). ` +
          `Each executive's bar:\n${rubric}\n` +
          `For each executive, decide fulfilled=true only if the pitch genuinely addressed their bar. Then give one overall deliverable score 0-100 ` +
          `(90+: board-ready with clear thesis, trade-offs, numbers; 70s: solid but gaps; 50s: partial; below 40: unprepared). ` +
          `Reply with ONLY JSON: {"score":<0-100>,"checklist":[{"id":"ceo","fulfilled":true|false},...one entry per executive id above...]}`,
        messages: [{ role: "user", content: convo || "(empty)" }],
      });
      const parsed = parseModelJson(out);
      const byId = Object.fromEntries((Array.isArray(parsed.checklist) ? parsed.checklist : []).map((c) => [c.id, !!c.fulfilled]));
      const checklist = PERSONAS.map((p) => ({
        personaId: p.id, short: LB(p.shortTitle, lang), name: LB(p.title, lang), fulfilled: byId[p.id] ?? false,
      }));
      const score = Math.max(0, Math.min(100, Math.round(Number(parsed.score) || 0)));
      s.board.result = { score, checklist, mode: "live", t: Date.now() };
      addQuestEntry(s, "board", TT(lang, `Board verdict — deliverable score ${score}/100`, `董事会评定 — 交付物得分 ${score}/100`),
        checklist.map((c) => `${c.fulfilled ? "✓" : "✗"} ${c.short}`).join("  ·  "));
      touch(s);
    } catch (e) {
      console.error("[board score]", e.message);
    }
  }
  const r = s.board.result;
  res.json({ ...publicState(s), score: r?.score ?? null, checklist: r?.checklist ?? null });
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
    const { filename, fileBase64 } = req.body || {};
    const lang = langOf(req);
    const n = interviewedCount(s);
    if (n < PERSONAS.length) {
      return res.status(403).json({ error: TT(lang,
        `Present to the board once you've interviewed all seven executives — you're at ${n}/7.`,
        `访谈完七位高管后才能向董事会汇报——你目前完成了${n}/7。`) });
    }
    // Design is now a prerequisite for Present: the C-suite hears a strategy the
    // Deloitte team has already been through, not a first draft.
    if (!s.engagement.designReview?.done) {
      return res.status(403).json({ error: TT(lang,
        "The team reviews your design before the executives see it — take your draft to the Deloitte managers first.",
        "高管看到方案之前，项目组要先评审你的设计——请先把草案交给德勤经理们。") });
    }
    // ONE attempt, like the design review. The deck is the terminal graded
    // deliverable; re-submitting until the wording lands would make the grade
    // meaningless.
    if (s.board.deckReviewed) {
      return res.status(409).json({ error: TT(lang,
        "The executives have already graded your deck — that was your one attempt.",
        "高管已经为你的方案评分了——这个环节只有一次机会。") });
    }

    // HARD SPEC, refused at the door: a .pptx of EXACTLY 10 slides. "Fit it into
    // ten slides" is part of the exercise, so this is validated before a single
    // executive reads anything. readDeck() returns a machine-readable reason the
    // client renders in the player's language.
    if (typeof fileBase64 !== "string" || !fileBase64) {
      return res.status(400).json({ error: TT(lang,
        `Upload your strategy deck — a PowerPoint (.pptx) of exactly ${REQUIRED_SLIDES} slides.`,
        `请上传你的战略方案——必须是恰好${REQUIRED_SLIDES}页的 PowerPoint（.pptx）文件。`), reason: "missing" });
    }
    const deck = await readDeck(filename, Buffer.from(fileBase64, "base64"));
    if (!deck.ok) {
      const msg = deck.reason === "ext"
        ? TT(lang, `That's a .${deck.detail} file. The deck must be a PowerPoint (.pptx) — export it and try again.`,
                   `这是一个 .${deck.detail} 文件。方案必须是 PowerPoint（.pptx）——请导出后重新上传。`)
        : deck.reason === "slides"
        ? TT(lang, `The deck has ${deck.detail} slides. It must be exactly ${REQUIRED_SLIDES} — no more, no fewer.`,
                   `这份方案有 ${deck.detail} 页。必须恰好 ${REQUIRED_SLIDES} 页——不多不少。`)
        : TT(lang, "That file couldn't be opened as a PowerPoint. Re-save it as .pptx and try again.",
                   "这个文件无法作为 PowerPoint 打开。请重新保存为 .pptx 后再试。");
      // 422, not 500: the upload was understood and refused on its merits.
      return res.status(422).json({ error: msg, reason: deck.reason, detail: deck.detail ?? null });
    }
    const text = deck.text;

    // Admin: the deck is a graded submission, so it accepts anything — and
    // skipping seven live executive reviews makes a QA pass quick as well.
    const evals = s.admin ? PERSONAS.map((p) => ({
      personaId: p.id, name: LB(p.title, lang), short: LB(p.shortTitle, lang),
      verdict: "strong", fulfilled: true,
      comments: TT(lang, "[ADMIN] Auto-accepted.", "[管理员] 自动通过。"),
    })) : await Promise.all(PERSONAS.map(async (p) => {
      const crit = REVIEW_CRITERIA[p.id]?.criteria || `Judge as the ${p.title.en}, from your functional priorities.`;
      const bench = BENCHMARKS[p.id] ? `\nYOUR BENCHMARKING FILE (verified figures — judge the deck against these):\n${BENCHMARKS[p.id]}\n` : "";
      try {
        const out = await callAnthropic({
          model: CHAT_MODEL,
          max_tokens: 700,
          system:
            `You are ${LB(p.title, "en")} of Nike Greater China, sitting on the board hearing a junior consultant's final 5-year strategy pitch (deck text below). ` +
            `Evaluate it ONLY from your functional lens.\nYOUR CRITERIA:\n${crit}\n${bench}\n` +
            `Stay fully in character. Reply with ONLY JSON: {"verdict":"strong"|"acceptable"|"weak","fulfilled":true|false,"comments":"<2-3 concise sentences from your perspective — what satisfies you, what worries you — written in ${lang === "zh" ? "Simplified Chinese" : "English"}>"} — "fulfilled" means: does this deck genuinely address YOUR function's core asks per your criteria (not merely mention them)?`,
          messages: [{ role: "user", content: text.slice(0, 40000) }],
        });
        const parsed = parseModelJson(out);
        const verdict = ["strong", "acceptable", "weak"].includes(parsed.verdict) ? parsed.verdict : "acceptable";
        const comments = (typeof parsed.comments === "string" && parsed.comments.trim())
          ? parsed.comments.slice(0, 800) : TT(lang, "Noted.", "了解。");
        const fulfilled = typeof parsed.fulfilled === "boolean" ? parsed.fulfilled : verdict !== "weak";
        return { personaId: p.id, name: LB(p.title, lang), short: LB(p.shortTitle, lang), verdict, fulfilled, comments };
      } catch (e) {
        return { personaId: p.id, name: LB(p.title, lang), short: LB(p.shortTitle, lang), verdict: "error", fulfilled: false, comments: TT(lang, "(couldn't reach this executive — try again)", "（暂时联系不到这位高管——请重试）") };
      }
    }));

    // Deliverable score 0-100: average of the seven verdicts (errors excluded).
    const VERDICT_PTS = { strong: 100, acceptable: 70, weak: 40 };
    const scored = evals.filter((e) => e.verdict in VERDICT_PTS);
    const score = scored.length ? Math.round(scored.reduce((a, e) => a + VERDICT_PTS[e.verdict], 0) / scored.length) : 0;
    const checklist = evals.map((e) => ({ personaId: e.personaId, short: e.short, name: e.name, fulfilled: !!e.fulfilled }));

    s.board.deckReviewed = true;
    s.board.deckText = text.slice(0, 40000); // kept so the defense stage can challenge it
    s.board.result = { score, checklist, mode: "deck", deckScore: score, t: Date.now() };
    addQuestEntry(s, "board", TT(lang, `Board verdict — deliverable score ${score}/100`, `董事会评定 — 交付物得分 ${score}/100`),
      evals.map((e) => `${e.fulfilled ? "✓" : "✗"} ${e.short}: ${e.verdict} — ${e.comments}`).join("\n"));
    touch(s);
    res.json({ ...publicState(s), evals, score, checklist });
  } catch (err) {
    console.error("[board review-deck]", err.message, err.detail || "");
    res.status(err.status || 500).json({ error: err.message });
  }
});

/* --------------------- settings + defense (Wave 3) ---------------------- */

/** Who the final pitch is presented to — the sim board, or a classroom instructor. */
function recipientFraming(s, lang) {
  const prof = s.settings?.recipient === "professorGuo";
  return prof
    ? { who: TT(lang, "Professor Guo and a teaching panel", "郭教授与教学评审组"),
        context: TT(lang, "a classroom defense — rubric-scored, with room for an instructor override", "课堂答辩——按评分标准打分，并保留教师复核空间") }
    : { who: TT(lang, "the Nike Greater China board", "耐克大中华区董事会"),
        context: TT(lang, "a live board defense", "现场董事会答辩") };
}

router.post("/settings", (req, res) => {
  const s = getSession(req.body?.sessionId, false);
  const { recipient } = req.body || {};
  if (recipient === "board" || recipient === "professorGuo") s.settings.recipient = recipient;
  touch(s);
  res.json(publicState(s));
});

/**
 * C2 — "summarize information". The player writes their own readout of an
 * interview; it is graded against the ACTUAL transcript for accuracy, signal
 * and concision (not recall of trivia). Stored in the binder; small credibility.
 */
router.post("/workspace/summary", async (req, res) => {
  try {
    const s = getSession(req.body?.sessionId, false);
    const lang = langOf(req);
    const { personaId, summary } = req.body || {};
    const persona = PERSONA_MAP[personaId];
    if (!persona) return res.status(400).json({ error: "Unknown persona" });
    if (typeof summary !== "string" || !summary.trim() || summary.length > 2000)
      return res.status(400).json({ error: TT(lang, "Write 1–2000 characters.", "请填写1–2000字符。") });
    const st = s.personas[personaId];
    const transcript = (st?.transcript || []).map((m) => `${m.role === "learner" ? "You" : LB(persona.shortTitle, "en")}: ${m.text}`).join("\n");
    if (!transcript) return res.status(403).json({ error: TT(lang, "Interview this person before writing your readout.", "先访谈这位高管再写纪要。") });
    const out = await callAnthropic({
      model: LIGHT_MODEL, max_tokens: 500,
      system:
        `A trainee consultant wrote a READOUT summarizing their interview with the ${LB(persona.title, "en")} of Nike Greater China. ` +
        `Grade the summary against the ACTUAL transcript for (a) accuracy — reflects what was said, no invented facts; (b) signal — captures what MATTERED, not trivia; (c) concision. Score 0-100. ` +
        `Reply with ONLY JSON: {"score":<0-100>,"feedback":"<2 sentences as their engagement manager, in ${lang === "zh" ? "Simplified Chinese" : "English"}>"}\nTRANSCRIPT:\n${transcript.slice(0, 6000)}`,
      messages: [{ role: "user", content: summary.slice(0, 2000) }],
    });
    const parsed = parseModelJson(out);
    const score = s.admin ? 100 : Math.max(0, Math.min(100, Math.round(Number(parsed.score) || 0)));
    const feedback = s.admin
      ? TT(lang, "[ADMIN] Auto-accepted.", "[管理员] 自动通过。")
      : (typeof parsed.feedback === "string" ? parsed.feedback.slice(0, 400) : TT(lang, "Noted.", "了解。"));
    const rec = { personaId, playerSummary: summary.trim(), score, feedback };
    const i = s.workspace.interviews.findIndex((x) => x.personaId === personaId);
    if (i >= 0) s.workspace.interviews[i] = rec; else s.workspace.interviews.push(rec);
    if (score >= 70) addCredibility(s, 5, TT(lang, `Interview readout: ${LB(persona.shortTitle, lang)}`, `访谈纪要：${LB(persona.shortTitle, lang)}`));
    addQuestEntry(s, "review", TT(lang, `Readout graded (${score}/100) — ${LB(persona.shortTitle, lang)}`, `纪要评分（${score}/100）— ${LB(persona.shortTitle, lang)}`), feedback);
    touch(s);
    res.json({ ...publicState(s), score, feedback });
  } catch (err) {
    console.error("[ws summary]", err.message);
    res.status(err.status || 500).json({ error: err.message });
  }
});

/**
 * DEFENSE STAGE (Part F). After the deck is scored, the recipient challenges
 * the pitch: 5 pointed questions aimed at its weakest parts. The player answers
 * (a defense thread), and the final score = 60% deck + 40% defense.
 */
router.post("/board/defense/questions", async (req, res) => {
  try {
    const s = getSession(req.body?.sessionId, false);
    const lang = langOf(req);
    if (!s.board.result) return res.status(403).json({ error: TT(lang, "Present your strategy to the board first, then defend it.", "请先向董事会汇报你的战略，再进行答辩。") });
    if (s.board.defense?.questions?.length)
      return res.json({ ...publicState(s), questions: s.board.defense.questions.map((q) => ({ execId: q.execId, text: LB(q, lang) })), recipient: s.settings.recipient });
    const source = s.board.deckText || s.board.transcript.filter((m) => m.role === "learner").map((m) => m.text).join("\n") || "(the pitch)";
    const fr = recipientFraming(s, lang);
    const rubric = PERSONAS.map((p) => `${p.id} (${p.shortTitle.en}): ${p.evaluationMindset.en}`).join("\n");
    const out = await callAnthropic({
      model: LIGHT_MODEL, max_tokens: 2600,
      system:
        `You run the DEFENSE stage of a 5-year strategy pitch for Nike Greater China, in front of ${fr.who}. The consultant just presented (material below). ` +
        `Produce exactly 5 pointed CHALLENGE questions, each from a different executive's lens, targeting the WEAKEST or riskiest parts of the pitch (trade-offs dodged, numbers unsupported, competitor reality ignored, methodology overreach). Each executive's bar:\n${rubric}\n` +
        `Keep each question to ONE sharp sentence (max ~30 words) — a pointed challenge, not a paragraph. ` +
        `Reply with ONLY JSON: {"questions":[{"execId":"cfo","en":"...","zh":"..."}, ...exactly 5, distinct execIds...]}. ` +
        `Do NOT use double-quote characters inside the "en"/"zh" text — if you must quote a phrase, use single quotes, so the JSON stays valid.`,
      messages: [{ role: "user", content: String(source).slice(0, 8000) }],
    });
    const parsed = parseModelJson(out);
    let qs = Array.isArray(parsed.questions) ? parsed.questions.filter((q) => q && (q.en || q.zh)).slice(0, 5) : [];
    if (!qs.length) qs = [{ execId: "ceo", en: "What is the single biggest risk to your plan, and how do you de-risk it?", zh: "你计划里最大的风险是什么，你如何降低它？" }];
    s.board.defense = { questions: qs, graded: false };
    touch(s);
    res.json({ ...publicState(s), questions: qs.map((q) => ({ execId: q.execId, text: LB(q, lang) })), recipient: s.settings.recipient });
  } catch (err) {
    console.error("[defense q]", err.message);
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.post("/board/defense/grade", async (req, res) => {
  try {
    const s = getSession(req.body?.sessionId, false);
    const lang = langOf(req);
    const { answers } = req.body || {};
    if (!s.board.defense?.questions?.length) return res.status(409).json({ error: TT(lang, "Start the defense first.", "请先开始答辩。") });
    if (s.board.defense.graded)
      return res.json({ ...publicState(s), ...s.board.result, checklist: s.board.result.checklist || [], already: true });
    if (!Array.isArray(answers) || !answers.length || answers.some((a) => typeof a !== "string"))
      return res.status(400).json({ error: TT(lang, "Answer each challenge.", "请回答每一个质询。") });
    const qs = s.board.defense.questions;
    const qa = qs.map((q, i) => `Q${i + 1} [${q.execId}]: ${LB(q, "en")}\nA${i + 1}: ${(answers[i] || "").slice(0, 1500)}`).join("\n\n");
    const fr = recipientFraming(s, lang);
    const out = await callAnthropic({
      model: LIGHT_MODEL, max_tokens: 400,
      system:
        `You grade the DEFENSE answers a trainee consultant gave when ${fr.who} challenged their Nike Greater China strategy. ` +
        `A strong defense directly answers the challenge, concedes real trade-offs, and cites evidence rather than deflecting. Give one defense score 0-100 (90+: holds up under fire; 70s: mostly solid, some hand-waving; 50s: partial; <40: crumbles). ` +
        `Reply with ONLY JSON: {"score":<0-100>,"feedback":"<2-3 sentences as ${fr.who}, in ${lang === "zh" ? "Simplified Chinese" : "English"}>"}`,
      messages: [{ role: "user", content: qa.slice(0, 8000) }],
    });
    const parsed = parseModelJson(out);
    const defenseScore = s.admin ? 100 : Math.max(0, Math.min(100, Math.round(Number(parsed.score) || 0)));
    const feedback = s.admin
      ? TT(lang, "[ADMIN] Auto-passed.", "[管理员] 自动通过。")
      : (typeof parsed.feedback === "string" ? parsed.feedback.slice(0, 500) : TT(lang, "Noted.", "了解。"));
    const deckScore = s.board.result?.deckScore ?? s.board.result?.score ?? 0;
    const finalScore = Math.round(deckScore * 0.6 + defenseScore * 0.4);
    s.board.defense.graded = true;
    s.board.result = { ...s.board.result, defenseScore, finalScore, score: finalScore, defended: true };
    s.board.done = true;
    addQuestEntry(s, "board", TT(lang, `Defense complete — final score ${finalScore}/100`, `答辩完成——最终得分 ${finalScore}/100`),
      TT(lang, `Deck ${deckScore} · Defense ${defenseScore}`, `方案 ${deckScore} · 答辩 ${defenseScore}`) + `\n${feedback}`);
    touch(s);
    res.json({ ...publicState(s), deckScore, defenseScore, finalScore, feedback, checklist: s.board.result.checklist || [] });
  } catch (err) {
    console.error("[defense grade]", err.message);
    res.status(err.status || 500).json({ error: err.message });
  }
});

/* --------------------- consultant workspace (binder) -------------------- */
/**
 * The engagement binder (Part C). The player authors pain points, then
 * synthesizes findings (each MUST cite evidence: a data pack or a pain point),
 * then derives recommendations (each MUST cite a finding). The server owns
 * id-minting and reference validation so orphan/unsupported items can't be
 * faked; workspaceView (client) computes the unsupported/unreconciled flags.
 */
const WS_LIMITS = { painPoint: 24, finding: 24, recommendation: 24 };
let wsSeq = 0;
const mkId = (prefix) => `${prefix}-${Date.now().toString(36)}${(wsSeq++).toString(36)}`;

router.post("/workspace/add", (req, res) => {
  const s = getSession(req.body?.sessionId, false);
  const lang = langOf(req);
  const { kind, statement, refs, targetExecs, domain, severity } = req.body || {};
  const ws = s.workspace;
  if (!["painPoint", "finding", "recommendation"].includes(kind))
    return res.status(400).json({ error: "Unknown workspace item kind" });
  if (typeof statement !== "string" || !statement.trim() || statement.length > 600)
    return res.status(400).json({ error: TT(lang, "Write 1–600 characters.", "请填写1–600字符。") });

  if (kind === "painPoint") {
    if (ws.painPoints.length >= WS_LIMITS.painPoint) return res.status(409).json({ error: TT(lang, "Pain-point list is full.", "痛点清单已满。") });
    const packIds = new Set(ws.dataPacks.map((d) => d.id));
    const evidenceRefs = (Array.isArray(refs) ? refs : []).filter((r) => packIds.has(r)).slice(0, 12);
    ws.painPoints.push({ id: mkId("pp"), domain: String(domain || "").slice(0, 40), severity: String(severity || "").slice(0, 20), statement: statement.trim(), evidenceRefs });
  } else if (kind === "finding") {
    if (ws.findings.length >= WS_LIMITS.finding) return res.status(409).json({ error: TT(lang, "Findings list is full.", "发现清单已满。") });
    const packIds = new Set(ws.dataPacks.map((d) => d.id));
    const ppIds = new Set(ws.painPoints.map((p) => p.id));
    const evidenceRefs = (Array.isArray(refs) ? refs : []).filter((r) => packIds.has(r) || ppIds.has(r)).slice(0, 12);
    ws.findings.push({ id: mkId("f"), statement: statement.trim(), evidenceRefs });
  } else {
    if (ws.recommendations.length >= WS_LIMITS.recommendation) return res.status(409).json({ error: TT(lang, "Recommendations list is full.", "建议清单已满。") });
    const fIds = new Set(ws.findings.map((f) => f.id));
    const findingRefs = (Array.isArray(refs) ? refs : []).filter((r) => fIds.has(r)).slice(0, 12);
    const execs = (Array.isArray(targetExecs) ? targetExecs : []).filter((id) => PERSONA_MAP[id]).slice(0, 7);
    ws.recommendations.push({ id: mkId("r"), statement: statement.trim(), findingRefs, targetExecs: execs });
  }
  touch(s);
  res.json(publicState(s));
});

router.post("/workspace/remove", (req, res) => {
  const s = getSession(req.body?.sessionId, false);
  const { kind, id } = req.body || {};
  const ws = s.workspace;
  const list = kind === "painPoint" ? ws.painPoints : kind === "finding" ? ws.findings : kind === "recommendation" ? ws.recommendations : null;
  if (!list) return res.status(400).json({ error: "Unknown workspace item kind" });
  const i = list.findIndex((x) => x.id === id);
  if (i >= 0) {
    const [removed] = list.splice(i, 1);
    // Cascade: drop references to the removed item so nothing dangles.
    if (kind === "painPoint") for (const f of ws.findings) f.evidenceRefs = (f.evidenceRefs || []).filter((r) => r !== removed.id);
    if (kind === "finding") for (const r of ws.recommendations) r.findingRefs = (r.findingRefs || []).filter((x) => x !== removed.id);
    touch(s);
  }
  res.json(publicState(s));
});

/* --------------------- alignment meetings (phase gates) ----------------- */
/**
 * The two hard gates of the engagement spine (docs Part E). Manager Lin
 * convenes a client-alignment session; the player submits the phase deliverable
 * as free text and a client panel (LLM, in the client's voice) either AGREES
 * (signs off — the gate opens and the phase advances) or CHALLENGES (the player
 * revises and resubmits). This is the "don't build a tower from flat ground"
 * mechanism: you cannot benchmark until the as-is is agreed, cannot design the
 * to-be until the benchmark direction is agreed.
 *
 * Reuses the /interim grading shape (single LIGHT_MODEL call, revise-loop).
 */
async function gradeAlignment({ kind, answer, evidence, lang }) {
  const framing = kind === "asis"
    ? `You are the Nike Greater China client panel (the CEO plus the two most relevant executives) sitting in an AS-IS ALIGNMENT MEETING. A junior Deloitte consultant presents their diagnosis of your current state — the key pain points and the evidence behind them — before they are allowed to benchmark or design anything.\n` +
      `AGREE only if the diagnosis (a) is grounded in what your executives actually said (see excerpts), (b) names real, specific pain points rather than platitudes, and (c) shows some prioritization (not an undifferentiated list). Otherwise CHALLENGE: name what is wrong, missing, or misprioritized, in the client's own voice.`
    : `You are the Nike Greater China client panel (the CEO plus the CFO) sitting in a BENCHMARK ALIGNMENT MEETING. A junior Deloitte consultant presents where Nike stands versus named competitors (Anta, Li-Ning, Adidas, Xtep, 361°) and the growth direction they recommend, before they are allowed to design the strategy.\n` +
      `AGREE only if the benchmark (a) compares like-for-like on metrics that are actually disclosed and relevant (respecting that only EBIT margin and revenue growth are validly benchmarkable for Nike China — undisclosed Nike-China ROE/ROA/ROIC/net profit do NOT exist), (b) names concrete relative strengths and weaknesses versus specific peers, and (c) lands a prioritized direction. Otherwise CHALLENGE: dispute irrelevant comparisons or methodology errors in the client's own voice.`;
  const out = await callAnthropic({
    model: LIGHT_MODEL,
    max_tokens: 400,
    system:
      `${framing}\n\nWHAT YOUR EXECUTIVES ACTUALLY TOLD THIS CONSULTANT (interview excerpts):\n${(evidence || "(none captured)").slice(0, 2800)}\n\n` +
      `Be a realistic senior client: brisk, not effusive. Reply with ONLY JSON: {"agreed":true|false,"feedback":"<2-3 specific sentences in the client's voice, written in ${lang === "zh" ? "Simplified Chinese" : "English"} — if agreeing, confirm the shared starting point; if challenging, say exactly what to fix>"}`,
    messages: [{ role: "user", content: answer.slice(0, 4000) }],
  });
  let agreed = false, feedback = TT(lang, "Let's tighten this before we proceed.", "在推进之前，我们先把这部分收紧。");
  const parsed = parseModelJson(out);
  if (typeof parsed.agreed === "boolean") agreed = parsed.agreed;
  if (typeof parsed.feedback === "string" && parsed.feedback.trim()) feedback = parsed.feedback.slice(0, 600);
  return { agreed, feedback };
}

function alignmentEvidence(s, lang) {
  const quotes = s.questLog.filter((e) => e.type === "quote").slice(-14)
    .map((e) => `${e.title}: ${e.body.slice(0, 160)}`).join("\n");
  // The player's own working document, once they've handed one to any reviewer.
  // This is where their synthesis lives now — they write it in Word/Docs/Markdown
  // and upload it, instead of assembling it in a structured binder panel.
  const doc = s.workDoc?.text
    ? `\n\nTHE CONSULTANT'S WORKING DOCUMENT (${s.workDoc.filename || "untitled"}):\n${s.workDoc.text.slice(0, 6000)}`
    : "";
  return quotes + doc;
}

/**
 * Everything a claim may legitimately rest on: what the player was actually
 * told in this session, plus the curated corpus behind the personas.
 *
 * Transcripts alone cannot catch invention. A learner can write a plausible
 * figure nobody ever said, and with only their own notes to check against,
 * "not in the transcript" is indistinguishable from "said in a conversation we
 * truncated". The persona project files give the verifier the same ground truth
 * the personas themselves answer from.
 */
async function groundingEvidence(s, text) {
  const transcripts = s.questLog
    .filter((e) => e.type === "quote" || e.type === "fact")
    .slice(-40)
    .map((e) => `[${e.title}] ${e.body}`)
    .join("\n");

  // Retrieve against every executive corpus: a diagnosis spans domains, and we
  // cannot know in advance which one a given claim belongs to.
  const seen = new Set();
  const chunks = [];
  for (const p of PERSONAS) {
    try {
      for (const d of await retrieve(p.id, text.slice(0, 1200))) {
        if (seen.has(d.id)) continue;
        seen.add(d.id);
        chunks.push(`[${p.id}] ${d.question_en || d.question_zh}\n${(d.answer_en || d.answer_zh || "").slice(0, 500)}`);
      }
    } catch (err) {
      // Retrieval enriches the check; it is not the mechanism. Losing one store
      // must not take the whole verification down.
      console.warn(`[asis grounding] retrieval failed for ${p.id}:`, err.message);
    }
  }
  return {
    transcripts: transcripts || "(no interviews recorded yet)",
    corpus: chunks.join("\n\n") || "(no project files matched)",
  };
}

/**
 * Claim-by-claim verification of an as-is diagnosis.
 *
 * A verdict per claim rather than one overall pass/fail: the point is to show
 * WHICH sentence is unsupported and what the evidence actually says. Lin
 * supplies the corrected wording herself, so a learner is never left guessing
 * what would have been acceptable.
 *
 * This checks GROUNDING, not truth — whether a claim is supported by the
 * evidence available. It cannot certify that a well-grounded claim is correct.
 */
async function verifyAsIs({ answer, transcripts, corpus, lang }) {
  const zh = lang === "zh";
  const out = await callAnthropic({
    model: LIGHT_MODEL,
    max_tokens: 2000,
    system:
      `You are Manager Lin, a Deloitte engagement manager reviewing a junior consultant's AS-IS DIAGNOSIS of Nike Greater China before it goes to the client.\n\n` +
      `Split their document into its distinct factual CLAIMS — pain points, findings, figures, causal statements. Ignore headings and filler. For each claim decide:\n` +
      `- "supported": the evidence below backs it. Quote the specific line that does.\n` +
      `- "unsupported": nothing in the evidence backs it. This includes invented figures, competitor facts nobody stated, and confident causal claims with no basis.\n` +
      `- "contradicted": the evidence says otherwise. Quote what it actually says.\n\n` +
      `For every claim that is NOT supported, write a correction in your own voice: what the evidence actually supports and how they should restate it. Be concrete — give them the corrected sentence, do not just say "check your sources".\n\n` +
      `INTERVIEW TRANSCRIPTS AND NOTES FROM THIS ENGAGEMENT:\n${transcripts.slice(0, 6000)}\n\n` +
      `PROJECT FILES (the curated corpus behind these executives):\n${corpus.slice(0, 8000)}\n\n` +
      `Set "clean" true ONLY when every claim is "supported". Write all prose in ${zh ? "Simplified Chinese" : "English"}.\n` +
      `Reply with ONLY JSON: {"clean":true|false,"summary":"<2 sentences in your voice>","claims":[{"claim":"<their words, trimmed>","verdict":"supported|unsupported|contradicted","evidence":"<the line that backs or refutes it, or empty>","correction":"<your corrected version, empty when supported>"}]}`,
    messages: [{ role: "user", content: answer.slice(0, 6000) }],
  });
  const parsed = parseModelJson(out);
  const claims = Array.isArray(parsed.claims) ? parsed.claims.slice(0, 30) : [];
  const bad = claims.filter((c) => c.verdict !== "supported");
  // Trust the per-claim verdicts over the model's own summary flag: the claims
  // are what the learner is shown, so the gate must agree with what they read.
  const clean = claims.length > 0 && bad.length === 0;
  const summary = typeof parsed.summary === "string" && parsed.summary.trim()
    ? parsed.summary.slice(0, 600)
    : TT(lang, "Let's go through this.", "我们过一遍。");
  return { clean, claims, unsupported: bad.length, summary };
}

router.post("/alignment/asis", async (req, res) => {
  try {
    const s = getSession(req.body?.sessionId, false);
    const { answer } = req.body || {};
    const lang = langOf(req);
    const a = s.engagement.alignments.asis;
    if (a.agreed)
      return res.json({ ...publicState(s), result: "already", feedback: TT(lang, "The client already signed off on your as-is diagnosis.", "客户已经认可了你的现状诊断。") });
    if (!s.flags.metSupervisor)
      return res.status(403).json({ error: TT(lang, "Get your mandate from Manager Lin first.", "请先向林经理领取任务。") });
    const n = interviewedCount(s);
    if (n < ASIS_MIN_INTERVIEWS) {
      return res.status(403).json({ error: TT(lang,
        `Diagnose before you align — interview at least ${ASIS_MIN_INTERVIEWS} executives first (you're at ${n}).`,
        `先诊断再对齐——至少访谈${ASIS_MIN_INTERVIEWS}位高管（你目前${n}位）。`) });
    }
    // The deliverable is the document handed to Manager Lin. Typed text is
    // still accepted so the gate keeps working without an upload.
    const submitted = (typeof answer === "string" && answer.trim()) ? answer : (s.workDoc?.text || "");
    if (!submitted.trim())
      return res.status(400).json({ error: TT(lang,
        "Give Manager Lin your as-is document first — pain points, findings, and what they rest on.",
        "先把你的现状文档交给林经理——痛点、发现，以及它们的依据。") });

    if (s.admin) {
      a.agreed = true;
      a.attempts += 1;
      a.lastFeedback = TT(lang, "[ADMIN] Auto-agreed.", "[管理员] 自动通过。");
      addCredibility(s, 25, TT(lang, "As-Is alignment agreed", "现状对齐达成"));
      touch(s);
      return res.json({ ...publicState(s), result: "agreed", feedback: a.lastFeedback, claims: [], delta: 25 });
    }

    const { transcripts, corpus } = await groundingEvidence(s, submitted);
    const { clean, claims, unsupported, summary } = await verifyAsIs({ answer: submitted, transcripts, corpus, lang });

    a.attempts += 1;
    a.lastFeedback = summary;
    const delta = clean ? 25 : 0;
    if (clean) {
      a.agreed = true;
      addCredibility(s, delta, TT(lang, "As-Is alignment agreed", "现状对齐达成"));
    }
    // Log the corrections, not just the verdict — this is the record the player
    // works from when revising, and it is the teaching content of the gate.
    const corrections = claims
      .filter((c) => c.verdict !== "supported")
      .map((c) => `• ${c.claim}\n  → ${c.correction || c.evidence || ""}`)
      .join("\n")
      .slice(0, 1200);
    addQuestEntry(s, "task",
      TT(lang, clean ? "As-Is Alignment agreed" : `As-Is review — ${unsupported} claim(s) to fix`,
        clean ? "现状对齐达成" : `现状复核 — ${unsupported}处待修正`),
      summary + (corrections ? "\n" + corrections : ""));
    touch(s);
    res.json({ ...publicState(s), result: clean ? "agreed" : "revise", feedback: summary, claims, unsupported, delta });
  } catch (err) {
    console.error("[alignment asis]", err.message, err.detail || "");
    res.status(err.status || 500).json({ error: err.message });
  }
});

/**
 * DESIGN REVIEW — the seven Deloitte managers read the draft strategy together.
 *
 * Replaces the old Benchmark Alignment gate. Benchmarking did not disappear; it
 * moved INTO this review as a criterion, because a comparison is only worth
 * making in service of a recommendation. Judging it as its own phase taught
 * learners to produce a competitor table and then never use it.
 *
 * ONE attempt, deliberately. This is a review, not a resubmission loop: the
 * managers' advice IS the deliverable, so the phase completes on submission
 * whatever they conclude. Gating it on a verdict would let a single harsh
 * reviewer strand the engagement with no way forward.
 */
router.post("/design/review", async (req, res) => {
  try {
    const s = getSession(req.body?.sessionId, false);
    const { text } = req.body || {};
    const lang = langOf(req);
    const dr = s.engagement.designReview;

    if (dr.done) {
      return res.status(409).json({ error: TT(lang,
        "The team has already reviewed your design — that was your one pass at it.",
        "项目组已经评审过你的设计了——这个环节只有一次机会。") });
    }
    if (!s.engagement.alignments.asis.agreed) {
      return res.status(403).json({ error: TT(lang,
        "Design comes after the diagnosis is agreed — settle the As-Is with Manager Lin first.",
        "先完成现状诊断再做设计——请先与林经理达成现状对齐。") });
    }
    // The draft can be typed or uploaded; either way it arrives here as text.
    const submitted = (typeof text === "string" && text.trim()) ? text : (s.workDoc?.text || "");
    if (!submitted.trim() || submitted.length > 40000) {
      return res.status(400).json({ error: TT(lang,
        "Give the team your draft strategy first — typed here or uploaded as a file (1–40,000 characters).",
        "请先提交你的战略草案——可以直接输入，也可以上传文件（1–40,000字符）。") });
    }

    const tracks = Object.entries(TRACKS);
    const reviews = s.admin
      ? tracks.map(([trackId, t]) => ({
          trackId, name: LB(gatekeeperNpcFromTrack(trackId).name, lang), workstream: LB(t.name, lang),
          advice: TT(lang, "[ADMIN] Auto-reviewed.", "[管理员] 自动评审。"),
        }))
      : await Promise.all(tracks.map(async ([trackId, t]) => {
          const npc = gatekeeperNpcFromTrack(trackId);
          const bench = BENCHMARKS[t.personaId]
            ? `\nBENCHMARKING REFERENCE (verified figures — hold their comparisons to these):\n${BENCHMARKS[t.personaId]}\n`
            : "";
          try {
            const out = await callAnthropic({
              model: CHAT_MODEL,
              max_tokens: 900,
              system:
                `You are ${LB(npc.name, "en")}, ${LB(npc.role, "en")}, the Deloitte manager who owns the ${LB(t.name, "en")} workstream on the Nike Greater China engagement. ` +
                `${t.persona ? `\nWHO YOU ARE:\n${t.persona}\n` : ""}` +
                `\nWHAT YOU KNOW:\n${t.knowledge}\n${bench}` +
                `\nThe junior analyst has brought their DRAFT 5-year growth strategy to the team for review. Read it and respond ONLY about the part that belongs to YOUR workstream — do not review the whole document, and do not repeat another workstream's job.\n` +
                `Cover three things in your own voice: what they should IMPLEMENT as-is, what needs CHANGING and why, and how the weakest part of your area could be STRENGTHENED. Where they benchmark against competitors, check the comparison is like-for-like and say so if it is not. Be specific and concrete — name the recommendation you are reacting to. Be candid: this is the one review they get, so an easy pass helps nobody.\n` +
                `Stay fully in character. Reply with ONLY JSON: {"advice":"<3-5 sentences in ${lang === "zh" ? "Simplified Chinese" : "English"}>"}`,
              messages: [{ role: "user", content: submitted.slice(0, 40000) }],
            });
            const parsed = parseModelJson(out);
            const advice = (typeof parsed.advice === "string" && parsed.advice.trim())
              ? parsed.advice.slice(0, 1200)
              : TT(lang, "Noted — nothing to add from my workstream.", "了解——我这条线暂时没有补充。");
            return { trackId, name: LB(npc.name, lang), workstream: LB(t.name, lang), advice };
          } catch (e) {
            console.error(`[design review] ${trackId}:`, e.message);
            return { trackId, name: LB(npc.name, lang), workstream: LB(t.name, lang),
              advice: TT(lang, "(couldn't reach this manager — their notes will follow)", "（暂时联系不到这位经理——他们的意见稍后补上）") };
          }
        }));

    dr.done = true;
    dr.submittedAt = now();
    dr.reviews = reviews;
    const delta = 25;
    addCredibility(s, delta, TT(lang, "Design reviewed by the team", "设计已通过项目组评审"));
    addQuestEntry(s, "task",
      TT(lang, "Design Review — the team's advice", "设计评审 — 项目组意见"),
      reviews.map((r) => `${r.name} (${r.workstream}): ${r.advice}`).join("\n\n").slice(0, 1800));
    touch(s);
    res.json({ ...publicState(s), result: "reviewed", reviews, delta });
  } catch (err) {
    console.error("[design review]", err.message, err.detail || "");
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
    // Was gated on the benchmark alignment, which no longer exists — reading
    // alignments.benchmark.agreed threw once the phase was removed. The design
    // review is its successor in the spine, so gate on that instead.
    if (!s.engagement.designReview?.done) {
      return res.status(403).json({ error: TT(lang,
        "The interim readout comes after the team has reviewed your design — take your draft to the Deloitte managers first.",
        "中期汇报要在项目组评审过你的设计之后——请先把草案交给德勤经理们。") });
    }
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
    if (s.admin) {
      grade = "pass";
      feedback = TT(lang, "[ADMIN] Auto-passed.", "[管理员] 自动通过。");
    } else {
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
 *
 * An executive's review is feedback only. Manager Lin's is credited once, the
 * first time you bring her a document, because that submission is a required
 * step on the spine rather than an optional second opinion.
 */
const WORKDOC_CREDIBILITY = { strong: 20, acceptable: 12, weak: 5 };

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
      const track = resolveTrack(trackForPersona(reviewerId));
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

    // Handing a document to Manager Lin IS the review mission — any later
    // submission just refreshes the document, it doesn't re-open the task.
    // Credited once, on the first submission, and scaled by her verdict: the
    // point is to bring your manager real work, so a weak document still beats
    // never showing her anything.
    if (reviewerId === "supervisor") {
      if (!s.flags.workDocDone) {
        addCredibility(s, WORKDOC_CREDIBILITY[verdict] || 0,
          TT(lang, "Working document reviewed by Manager Lin", "林经理审阅了你的工作文档"));
      }
      s.flags.workDocDone = true;
    }
    // Keep the latest submitted document: the alignment meetings read it as the
    // consultant's own synthesis, alongside their interview quotes.
    s.workDoc = {
      filename: String(filename || "untitled").slice(0, 100),
      text: text.slice(0, 12000),
      t: Date.now(),
    };
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

/**
 * Credibility for closing the loop with Manager Lin. Deliberately modest next
 * to the alignment gates (+25) and the interim readout (+30): reporting back is
 * expected professional conduct, not a feat. It is credited so the scoreboard
 * agrees with the lesson — the engagement ends with your manager, not the board.
 */
const DEBRIEF_CREDIBILITY = 15;

router.post("/debrief", async (req, res) => {
  try {
    const s = getSession(req.body?.sessionId, false);
    const lang = langOf(req);
    // The debrief now closes the engagement (shared/phases.js syncEngagement),
    // so it must not be reachable before the board has actually sat. Without
    // this the final phase could be ticked off without ever pitching.
    if (!s.board?.done) {
      return res.status(403).json({ error: TT(lang,
        "The debrief comes after the board meeting — pitch first, then come and see me.",
        "复盘要在董事会之后——先完成汇报，再来找我。") });
    }
    if (s.flags.debriefDone) {
      return res.status(409).json({ error: TT(lang, "We've already had your debrief.", "我们已经复盘过了。") });
    }
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
    // Closing the loop with your manager is itself part of the job, so it is
    // credited like every other gate on the spine rather than being unpaid work
    // after the "real" ending.
    addCredibility(s, DEBRIEF_CREDIBILITY, TT(lang, "Reported back to Manager Lin", "向林经理复盘汇报"));
    touch(s);
    res.json({ ...publicState(s), text, delta: DEBRIEF_CREDIBILITY });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// Sync throws (locked execs, unknown sessions) surface as JSON, not HTML stacks.
router.use((err, _req, res, _next) => {
  res.status(err.status || 500).json({ error: err.message });
});

export default router;
