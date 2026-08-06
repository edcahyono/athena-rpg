/**
 * NPC interaction dispatcher — what happens when the player presses E on
 * someone. Scripted NPCs and AI-backed personas both speak through the same
 * retro textbox. All text bilingual; flow: brief → check → executive unlock.
 */
import { NpcDef, NPCS, PROP_LINES } from "../config/world";
import { TASKS, TRACKS, trackForPersona } from "../../shared/gameContent.js";
import { ASIS_MIN_INTERVIEWS } from "../../shared/phases.js";
import { PERSONA_MAP } from "../../shared/personas.config.js";
import { api, state } from "../net/api";
import {
  showLines, showChoice, chatMode, sequentialQuiz, mcqPanel, prepPanel, taskPanel, reviewWorkPanel, boardDeckPanel, boardResultPanel, showLoading, toast,
  startTimer, stopTimer, updateHUD, withEngagement,
} from "../ui/ui";
import { L, fmt, UI, lang } from "../i18n";

const $ = (id: string) => document.getElementById(id)!;

const pick = <T>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];
const nameOf = (npc: NpcDef) => `${L(npc.name)} · ${L(npc.role)}`;

// Per-phase manager briefing: the first time the player sees Lin in a new
// phase, she explains what this phase is for. localStorage tracks which phases
// have already been briefed (purely narrative — safe to keep client-side).
const PHASE_BRIEF: Record<string, any> = {
  asis: UI.linBriefDiagnose,
  tobe: UI.linBriefDesign,
  pitch: UI.linBriefPresent,
};
const BRIEFED_KEY = "athena-briefed";
const getBriefed = (): Record<string, boolean> => {
  try { return JSON.parse(localStorage.getItem(BRIEFED_KEY) || "{}"); } catch { return {}; }
};
const markBriefed = (phase: string) => {
  const b = getBriefed(); b[phase] = true;
  try { localStorage.setItem(BRIEFED_KEY, JSON.stringify(b)); } catch { /* ignore */ }
};

// Hand the player the real case brief — triggers a browser download to their
// computer (served from /public). Fired once, when onboarding completes.
function downloadCaseBrief() {
  try {
    const a = document.createElement("a");
    a.href = "/CCNAP-Nike-Case-Introduction.pdf";
    a.download = "CCNAP - Nike Case Introduction.pdf";
    document.body.appendChild(a); a.click(); a.remove();
    toast(L(UI.briefToast));
  } catch { /* download is best-effort */ }
}

export async function interactProp(char: string): Promise<void> {
  const lines = PROP_LINES[char];
  if (lines && lines.length) await showLines("…", [L(pick(lines))]);
}

export async function interact(npc: NpcDef, currentFloor: number): Promise<void> {
  // Held for the whole dispatched exchange. Flows like Manager Lin's document
  // submissions close their panel BEFORE awaiting the server, leaving nothing
  // on screen for seconds at a time; without this the escorted NPC reads that
  // silence as the end of the conversation and walks back to their desk.
  return withEngagement(async () => {
    try {
      if (npc.kind === "flavor") return await flavor(npc);
      if (!state.flags.metSupervisor && npc.kind !== "supervisor") {
        return await showLines(nameOf(npc), [L(UI.talkSupervisorFirst)]);
      }
      switch (npc.kind) {
        case "supervisor": return await supervisor(npc);
        case "task": return await taskNpc(npc);
        case "persona": return await personaNpc(npc);
        case "board": return await boardTable(npc);
      }
    } catch (err: any) {
      toast(err.message || "Something went wrong.");
    } finally {
      updateHUD(currentFloor);
    }
  });
}

/* ------------------------------ flavor --------------------------------- */

async function flavor(npc: NpcDef) {
  await showLines(nameOf(npc), [L(pick(npc.lines || ["…"]))]);
}

/* ----------------------------- supervisor ------------------------------ */

const LIN_INTRO = {
  en: [
    "Athena! Right on time. Welcome to the China Consulting New Analyst Program.",
    "Here's your engagement: Nike Greater China. Revenue down 13% last fiscal year, quality complaints since production moved to Southeast Asia, and Anta and Li-Ning eating share with the guochao wave.",
    "Your deliverable is an INDEPENDENT 5-year growth strategy. Not what the client tells you to write — what YOU conclude after interviewing them.",
    "How you get there is up to you. Our domain managers sit on Floor 10 — strategy, finance, marketing, operations, people, digital, product. Any order you like. Each one briefs you and checks you — pass all seven and I'll personally clear you to meet the whole Nike C-suite on 15.",
    "Pick your first track from the mission board — press M. Executives' calendars are timed and limited, so prepare before you knock.",
  ],
  zh: [
    "Athena！来得正好。欢迎加入中国咨询新人计划（CCNAP）。",
    "这是你的项目：耐克大中华区。上个财年收入下滑13%，生产转移到东南亚后质量投诉不断，安踏和李宁还借着国潮抢走份额。",
    "你的交付物是一份【独立的】五年增长战略。不是客户让你写什么就写什么——而是你访谈完他们之后，自己得出的结论。",
    "怎么走完全由你决定。我们的领域经理都在10层——战略、财务、营销、运营、人才、数字化、产品。顺序随你。每位经理会给你做简报、出考核——全部七项通过后，我会亲自批准你去见15层全部耐克高管。",
    "按M打开任务板，选你的第一条线。高管的日程限时限次，敲门前先做好准备。",
  ],
};

const LIN_LINES = {
  passRight: { en: "Exactly right. That independence is the whole point. (+{n} credibility)", zh: "完全正确。这份「独立」正是关键所在。（信誉值 +{n}）" },
  passGo: { en: "Now open the mission board (M) and pick your first domain. There's no wrong first choice.", zh: "现在打开任务板（M），选你的第一条领域线。第一步没有错误选项。" },
  tryAgain: { en: "Hmm — not quite. Read the brief again: whose strategy is it, and what makes it valuable? Pick another answer.", zh: "嗯……不太对。再读一遍简报：这份战略是谁的？它的价值在哪里？换一个答案再试试。" },
  debriefIntro: { en: "You're back from the boardroom. Sit down — let's debrief.", zh: "你从董事会会议室回来了。坐——我们复盘一下。" },
  debriefOutro: { en: "Remember — this walkthrough was practice. The graded deliverable is your written strategy document. Go write something great.", zh: "记住——这次演练只是练习。真正要评分的交付物是你写的战略文档。去写出点了不起的东西吧。" },
  allDone: { en: "We're done here, Athena. Go write that strategy document. And get some sleep — that's an order.", zh: "这里的事结束了，Athena。去写你的战略文档吧。还有，去睡个觉——这是命令。" },
  hint: { en: "Pick any track from the mission board (M) — {n}/7 executives interviewed so far. Once you've met all seven, the boardroom on 16 opens.", zh: "从任务板（M）任选一条线——目前已访谈{n}/7位高管。见完全部七位，16层的董事会会议室就会开放。" },
  hintBoard: { en: "All seven interviewed. The boardroom on 16 is waiting — walk in with a clear strategy.", zh: "七位都谈完了。16层的董事会会议室在等你——带着清晰的战略进场吧。" },
};

async function supervisor(npc: NpcDef) {
  const name = nameOf(npc);
  if (!state.flags.metSupervisor) {
    await showLines(name, LIN_INTRO[lang]);
    const t: any = TASKS["task-brief-check"];
    // A comprehension check, not a trap: wrong picks get a nudge and another
    // try, so nobody starts the engagement down 20 credibility for a misclick.
    while (true) {
      const choice = await showChoice(name, L(t.prompt), t.options.map((o: any) => L(o)));
      const res = await api.dialogueCheck("task-brief-check", choice);
      if (res.result === "pass") break;
      await showLines(name, [L(LIN_LINES.tryAgain)]);
    }
    await showLines(name, [fmt(LIN_LINES.passRight, { n: t.credibility })]);
    toast(fmt(UI.credToast, { n: t.credibility }));
    await api.event("metSupervisor");
    // MOBILIZATION happens here, in dialogue. Its deliverable is the work plan,
    // and the player writes it in the notebook — so hand over both tools and
    // name the deliverable before any phase brief that assumes them.
    await showLines(name, [L(UI.linToolsBrief), L(UI.linWorkPlan)]);
    // Hand over the case brief (downloads to their computer), then brief the
    // first phase (Diagnose) right away so they know what to do next.
    downloadCaseBrief();
    await showLines(name, [L(UI.briefHandover), L(UI.linBriefDiagnose), L(LIN_LINES.passGo)]);
    markBriefed("asis");
    return;
  }
  if (state.board.done && !state.flags.debriefDone) {
    await showLines(name, [L(LIN_LINES.debriefIntro)]);
    const res: any = await api.debrief();
    if (res.delta) toast(fmt(UI.credToast, { n: res.delta }));
    await showLines(name, [res.text, L(LIN_LINES.debriefOutro)]);
    return;
  }
  if (state.flags.debriefDone) {
    return await showLines(name, [L(LIN_LINES.allDone)]);
  }

  // First visit in a new phase → Lin briefs you on what this phase is for,
  // before you're allowed to work the gate. Once briefed, fall through.
  const phase = state.engagement.phase;
  if (PHASE_BRIEF[phase] && !getBriefed()[phase]) {
    markBriefed(phase);
    return await showLines(name, [L(PHASE_BRIEF[phase])]);
  }

  // Mandatory post-diagnostic debrief. All seven domain checks are in, but the
  // C-suite still won't take a meeting — the server enforces the same bound in
  // requireTrackPassed(), so this is what actually opens Floor 15, not a
  // narrative nicety. One-time: it flips a flag and falls through for good.
  const checksPassed = Object.values(TRACKS).filter((tr: any) => state.tasks[tr.taskId]?.status === "passed").length;
  if (checksPassed >= Object.keys(TRACKS).length && !state.flags.execBriefingDone) {
    await showLines(name, [L(UI.linExecBriefing1), L(UI.linExecBriefing2)]);
    await api.event("execBriefingDone");
    return;
  }

  const n = Object.values(state.personas).filter((p) => p.used > 0).length;
  const align = state.engagement.alignments;

  // Working-document review. Sits BEFORE the alignment gates on purpose: the
  // document you hand over here is read as your own synthesis when those gates
  // are graded, so submitting it afterwards would be too late to count. You
  // write it in whatever tool you like and Lin audits it against her standards.
  if (!state.flags.workDocDone && n >= 3) {
    const choice = await showChoice(name, L(UI.linWorkDocPrompt), [L(UI.linWorkDocYes), L(UI.linWorkDocLater)]);
    if (choice !== 0) return await showLines(name, [L(UI.linWorkDocLaterLine)]);
    await reviewWorkPanel("supervisor", name);
    return;
  }

  // Phase gate 1 — As-Is Alignment. After enough interviews to have a diagnosis,
  // the client must confirm the as-is before any design work is allowed.
  // The interview minimum lives in shared/phases.js. It was duplicated here as
  // a literal 3, so lowering the constant changed nothing and Lin simply never
  // offered the meeting — the "I passed every check and nothing happens" wall.
  if (!align.asis.agreed && n >= ASIS_MIN_INTERVIEWS) {
    await showLines(name, [L(UI.asisIntro)]);
    // Carries the last submission across the revise loop so the box reopens
    // with the learner's own draft in it. Lin's corrections are per-claim edits
    // to a long document; reopening blank meant retyping the whole diagnosis to
    // fix one sentence, which is why people abandoned the revision.
    let draft = "";
    while (true) {
      const answer = await taskPanel(L(UI.asisTitle), L(UI.asisPrompt), align.asis.lastFeedback || undefined, draft);
      if (answer === null) return;
      draft = answer;
      const res = await api.alignmentAsis(answer);
      if (res.delta) toast(fmt(UI.credToast, { n: res.delta }));
      if (res.result === "agreed" || res.result === "already") {
        // Gate cleared → advance to Design and brief it right away. The
        // design review itself belongs to the Deloitte team on F10, so the
        // brief ends by sending the player there rather than back to Lin.
        await showLines(name, [fmt(UI.asisAgreed, { n: res.delta || 25 }), L(UI.linBriefDesign)]);
        markBriefed("tobe");
        return;
      }
      // Show the claims Lin actually rejected, each with her corrected wording.
      // A bare "revise this" tells the learner nothing about which sentence was
      // invented, which is the entire point of checking claim by claim.
      const flagged = (res.claims || []).filter((c: any) => c.verdict !== "supported");
      await showLines(name, [
        `${res.feedback}`,
        ...flagged.slice(0, 6).map((c: any) =>
          `“${c.claim}”\n${c.verdict === "contradicted" ? "✕" : "?"} ${c.correction || c.evidence || ""}`),
        L(UI.asisRevise),
      ]);
      const again = await showChoice(name, L(UI.asisRevise), [L(UI.alignReviseBtn), L(UI.alignLaterBtn)]);
      if (again !== 0) return;
    }
  }

  // Phase gate 2 — Design. Deliberately NOT held here: the design review is a
  // group meeting with the seven Deloitte managers on F10, not a submission to
  // Lin, so all she does now is point the player at the team. (The old
  // Benchmark Alignment gate stood here; benchmarking is a criterion inside
  // that review now, not a phase of its own.)

  // Mid-engagement synthesis checkpoint — after the design is reviewed Lin
  // wants an interim readout (and the board won't convene without it).
  if (!state.flags.interimDone && n >= 3) {
    await showLines(name, [L(UI.interimIntro)]);
    const answer = await taskPanel(L(UI.interimTitle), fmt(UI.interimPrompt, { n }));
    if (answer === null) return;
    const res = await api.interim(answer);
    if (res.delta) toast(fmt(UI.credToast, { n: res.delta }));
    if (res.result === "fail") {
      await showLines(name, [`${res.feedback} ${L(UI.interimRetry)}`]);
    } else {
      // Readout accepted → advance to the final Present phase and brief it.
      await showLines(name, [res.feedback, L(UI.linBriefPresent)]);
      markBriefed("pitch");
    }
    return;
  }

  // Once all seven executives are interviewed, Lin is the ONE reviewer who
  // will look over the player's draft strategy before the board — a final
  // gut-check on the polished deliverable.
  if (n >= 7 && !state.board.done) {
    const choice = await showChoice(name, L(UI.linReviewPrompt), [L(UI.linReviewYes), L(UI.linReviewNo)]);
    if (choice === 0) return await reviewWorkPanel("supervisor", name);
    return await showLines(name, [L(LIN_LINES.hintBoard)]);
  }

  await showLines(name, [fmt(LIN_LINES.hint, { n })]);
}

/* --------------------------- gatekeeper NPCs --------------------------- */

/**
 * Flow: the gatekeeper is a LIVE, unlimited, untimed conversation — ask
 * whatever you want. They know the case deeply but have deliberate blind
 * spots; hitting one auto-logs a lead to the notebook ("ask the CMO about
 * X"). Leaving triggers a 2-question quiz generated from THAT conversation;
 * passing (or partial) counts toward all seven — only once every track is
 * passed, and Lin has debriefed the diagnostic, does Floor 15 open at all.
 */
async function taskNpc(npc: NpcDef) {
  const name = nameOf(npc);
  const trackId = npc.trackId!;
  const track: any = (TRACKS as any)[trackId];
  const t = state.tasks[track.taskId];
  const passed = !!t && (t.status === "passed");
  const hasTalked = !!state.gatekeepers[trackId]?.hasTalked;

  // Already cleared this manager's check → just a friendly word; the executive
  // is already unlocked. (Document review lives with Manager Lin, not here.)
  if (t?.status === "failed") {
    await showLines(name, [L(track.retryLine)]);
  }

  // DESIGN REVIEW — convened here rather than with Lin, because the reviewers
  // ARE the seven managers. Any of them can call the team together, so the
  // player doesn't have to guess which desk holds the meeting. One attempt: the
  // server refuses a second, so the offer disappears once it's been used.
  const align0 = state.engagement?.alignments;
  if (align0?.asis?.agreed && !state.engagement?.designReview?.done) {
    const choice = await showChoice(name, L(UI.designReviewPrompt), [L(UI.designReviewYes), L(UI.designReviewLater)]);
    if (choice === 0) {
      await showLines(name, [L(UI.designReviewIntro)]);
      const draft = await taskPanel(L(UI.designReviewTitle), L(UI.designReviewBrief), L(UI.designReviewOneShot));
      if (draft !== null) {
        const loading = showLoading(name, L(UI.designReviewLoading), 26000);
        let res: any;
        try {
          res = await api.designReview(draft);
        } catch (e: any) {
          loading.close();
          toast(e.message);
          return updateHUD(npc.floor);
        }
        loading.close();
        if (res.delta) toast(fmt(UI.credToast, { n: res.delta }));
        // Each manager speaks in turn, named with their workstream, so the
        // advice reads as a room of people rather than one blob of feedback.
        await showLines(L(UI.designReviewRoom), (res.reviews || []).map(
          (r: any) => `${r.name} · ${r.workstream}\n${r.advice}`));
        await showLines(name, [L(UI.designReviewDone)]);
        return updateHUD(npc.floor);
      }
    }
  }

  chatMode({
    name,
    // Passing used to end the relationship — one closing line and the door shut.
    // They stay available to consult afterwards; only the check itself is spent.
    greeting: passed ? L(track.doneLine) : hasTalked ? L(UI.gkGreetReturn) : L(track.greeting),
    send: async (text) => {
      const res = await api.gatekeeperChat(trackId, text);
      if (res.leads?.length) toast(L(UI.gkLeadToast));
      return { entries: [{ name, text: res.text }], ended: false };
    },
    // LEAVE just leaves — the check is its own button, taken when the player
    // decides they're ready (so stepping out never forces the quiz load).
    // Once passed there is nothing left to take: the server already answers a
    // repeat attempt with 409, so offering the button only invites a dead end.
    check: passed ? undefined : {
      label: L(UI.gkTakeCheck),
      onCheck: async () => {
        // fires after chatMode's own lifecycle has ended — no enclosing
        // try/catch left on the stack, so failures must be handled right here.
        try {
          await runExitQuiz(trackId, name, track);
        } catch (err: any) {
          toast(err.message || "Something went wrong.");
        } finally {
          updateHUD(npc.floor);
        }
      },
    },
    onLeave: () => updateHUD(npc.floor),
  });
}

/**
 * The domain check: five multiple-choice questions drawn from the manager's own
 * knowledge base, not from the conversation you just had. Answer wrong and the
 * manager explains the reasoning, then you retry that same question — you can
 * always walk out mid-check to go ask more and come back, and the server
 * remembers which questions you've already cleared.
 */
async function runExitQuiz(trackId: string, gkName: string, track: any) {
  const loading = showLoading(gkName, L(UI.gkGeneratingQuiz));
  let questions: any[];
  try {
    ({ questions } = await api.gatekeeperQuiz(trackId));
  } catch (e: any) {
    return toast(e.message);
  } finally {
    loading.close();
  }
  if (!questions?.length) return;

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const options = q.options.map((o: any) => L(o));
    // Retry loop for THIS question — a wrong answer is a teaching moment, not
    // a dead end, so the only ways out are getting it right or stepping away.
    for (;;) {
      const choice = await mcqPanel(gkName, i, questions.length, L(q.q), options);
      if (choice === null) return; // stepped away — cleared questions are kept

      let res: any;
      try {
        res = await api.gatekeeperAnswer(trackId, i, choice);
      } catch (e: any) {
        toast(e.message);
        return;
      }

      if (res.correct) {
        if (res.done) {
          toast(fmt(UI.credToast, { n: res.delta }));
          await showLines(gkName, [fmt(UI.gkCheckPassed, { feedback: res.feedback, n: res.delta })]);
          // Reports THIS check as complete and how many remain — no "🔓 <exec>
          // — F15", which announced an unlock that hasn't happened: Floor 15
          // stays shut until all seven pass and Lin has debriefed the
          // diagnostic (requireTrackPassed, server-side).
          const passed = Object.values(TRACKS).filter((tr: any) => state.tasks[tr.taskId]?.status === "passed").length;
          toast(fmt(UI.gkCheckDoneToast, { done: passed, total: Object.keys(TRACKS).length }));
        }
        break;
      }
      // Wrong — the manager walks through it, then the same question comes back.
      await showLines(gkName, [L(res.why), L(UI.gkTryAgain)]);
    }
  }
}

/* ----------------------- C-suite persona (timed) ----------------------- */

async function personaNpc(npc: NpcDef) {
  const pid = npc.personaId!;
  const persona: any = PERSONA_MAP[pid];
  const pstate = state.personas[pid];
  const cfg = state.config.csuite;
  const name = nameOf(npc);

  // Domain gate: this executive only meets analysts vouched for by their
  // Deloitte counterpart. When the door isn't earned, the EXECUTIVE turns you
  // away themselves — in character — rather than an assistant intercepting you.
  const track: any = trackForPersona(pid);
  const passed = track && ["passed"].includes(state.tasks[track.taskId]?.status);
  if (!passed) {
    const gk = NPCS.find((n) => n.id === track.npcId)!;
    const rejects = (UI.execRejectLines as any)[lang] as string[];
    const reject = rejects[Math.floor(Math.random() * rejects.length)];
    return await showLines(name, [
      reject,
      fmt(UI.execRejectHint, { gk: L(gk.name), floor: gk.floor, exec: L(npc.name) }),
    ]);
  }

  if (pstate.used >= cfg.maxInteractions && !pstate.active) {
    return await showLines(`${L(NPCS.find((n) => n.id === "exec-ea")!.name)}`, [
      fmt(UI.calendarFull, { exec: L(persona.shortTitle) }),
    ]);
  }

  const resuming = pstate.active && pstate.active.expiresAt > Date.now();
  if (!resuming) {
    const ok = await prepPanel({
      title: name,
      sub: L(persona.tagline),
      remaining: fmt(UI.meetingsLeft, {
        a: cfg.maxInteractions - pstate.used, b: cfg.maxInteractions,
        m: Math.round(cfg.timePerInteractionSeconds / 60),
      }),
      warn: L(UI.execWarning),
    });
    if (!ok) return;
  }

  const started = await api.startInteraction(pid);
  const totalMs = cfg.timePerInteractionSeconds * 1000;
  let chat: { finish: (msg?: string) => void };

  startTimer(fmt(UI.meetingTimer, { t: L(persona.shortTitle) }), started.expiresAt, totalMs, () => {
    chat?.finish(L(UI.outOfTime));
  });

  let turns = 0; // did they actually interview, or just open the door and leave?

  chat = chatMode({
    name,
    greeting: resuming ? L(UI.resumeLine) : L(UI.meetGreeting),
    send: async (text) => {
      const res = await api.chat(pid, text);
      turns += 1;
      return {
        entries: [{ name, text: res.text }],
        ended: !!res.ended,
        closingText: res.closingText || res.text,
      };
    },
    onLeave: async () => {
      stopTimer();
      await api.endInteraction(pid).catch(() => {});
      // C2 (summarize) is assessed here, walking out of the room, rather than
      // in a panel the player has to remember to open later. The server grades
      // it against the real transcript, so it can't be bluffed.
      // Runs after chatMode's lifecycle — must self-handle its own errors.
      if (!turns) return;
      if ((state.workspace?.interviews || []).some((r: any) => r.personaId === pid)) return; // one per executive
      try {
        const summary = await taskPanel(L(UI.readoutTitle), fmt(UI.readoutPrompt, { exec: L(persona.shortTitle) }));
        if (summary === null) return; // skipping is allowed — it just costs the credibility
        const res: any = await api.workspaceSummary(pid, summary);
        await showLines(name, [fmt(UI.readoutScored, { n: res.score }), res.feedback]);
      } catch (err: any) {
        toast(err?.message || "Couldn't save that readout.");
      }
    },
  });
}

/* --------------------------- final boardroom --------------------------- */

/**
 * Defense stage (Wave 3, Part F) — after the deck/pitch is scored, the recipient
 * fires 5 challenge questions at its weakest points; the player answers, and the
 * final score = 60% deck + 40% defense. Returns the merged score/checklist, or
 * null if the player backs out (their deck score then stands).
 */
async function runDefense(): Promise<{ score: number; checklist: any[] } | null> {
  let qres: any;
  try { qres = await api.defenseQuestions(); } catch (e: any) { toast(e.message); return null; }
  const questions = (qres.questions || []).map((q: any) => q.text).filter(Boolean);
  if (!questions.length) return null;
  await showLines(L(UI.defenseTitle), [L(UI.defenseIntro)]);
  const answers = await sequentialQuiz(L(UI.defenseTitle), questions, "", []);
  if (answers === null) return null; // backed out — deck score stands
  const g: any = await api.defenseGrade(answers);
  await showLines(L(UI.defenseTitle), [g.feedback, fmt(UI.defenseResult, { deck: g.deckScore, def: g.defenseScore, final: g.finalScore })]);
  return { score: g.finalScore, checklist: g.checklist || [] };
}

async function boardTable(_npc: NpcDef) {
  const boardName = lang === "zh" ? "董事会会议室" : "Boardroom";
  if (state.board.done) {
    return await showLines(boardName, [L(UI.boardDoneLine)]);
  }
  const n = Object.values(state.personas).filter((p) => p.used > 0).length;
  if (n < 7) {
    const guan = NPCS.find((x) => x.id === "board-ea")!;
    return await showLines(nameOf(guan), [fmt(UI.boardNotReady, { n })]);
  }
  if (!state.flags.interimDone) {
    const guan = NPCS.find((x) => x.id === "board-ea")!;
    return await showLines(nameOf(guan), [L(UI.boardNeedInterim)]);
  }
  const resuming = state.board.active && state.board.active.expiresAt > Date.now();
  if (!resuming) {
    const ok = await prepPanel({
      title: L(UI.boardPrepTitle),
      sub: L(UI.boardPrepSub),
      remaining: fmt(UI.boardPrepNote, { m: Math.round(state.config.boardMeeting.timeSeconds / 60) }),
      // Rubric shown BEFORE the pitch — assessment, not guesswork.
      rubricTitle: L(UI.boardRubricTitle),
      rubric: [L(UI.boardRubric1), L(UI.boardRubric2), L(UI.boardRubric3), L(UI.boardRubric4), L(UI.boardRubric5)],
      priorityHint: L(UI.boardPriorityHint),
    });
    if (!ok) return;

    // Who receives the pitch — the sim board, or a classroom instructor.
    const rc = await showChoice(L(UI.boardTitle), L(UI.recipientPrompt), [L(UI.recipientBoard), L(UI.recipientProf)]);
    await api.setRecipient(rc === 1 ? "professorGuo" : "board").catch(() => {});

    // Choose how to present: upload a polished deck (each exec evaluates it
    // from their own lens), or speak live and take their questions.
    const mode = await showChoice(L(UI.boardTitle), L(UI.boardPresentPrompt), [L(UI.boardPresentDeck), L(UI.boardPresentLive)]);
    if (mode === 0) {
      const review = await boardDeckPanel();
      if (!review) return; // cancelled — come back when ready
      await showLines(L(UI.boardTitle), [L(UI.boardDeckReactions)]);
      for (const e of review.evals || []) {
        const tag = e.verdict === "strong" ? "✅" : e.verdict === "weak" ? "⚠️" : e.verdict === "error" ? "…" : "➖";
        await showLines(e.name, [`${tag} ${e.comments}`]);
      }
      // Defense stage — the recipient challenges the pitch; final = deck + defense.
      const defended = await runDefense();
      await api.boardEnd().catch(() => {});
      const finalScore = defended ? defended.score : review.score;
      const finalChecklist = defended ? defended.checklist : (review.checklist || []);
      if (typeof finalScore === "number") await boardResultPanel(finalScore, finalChecklist);
      toast(L(UI.boardConcluded));
      return; // deck presented + defended — the board is concluded
    }
  }

  const started = await api.boardStart();
  const totalMs = state.config.boardMeeting.timeSeconds * 1000;
  let chat: { finish: (msg?: string) => void };

  startTimer(L(UI.boardTimer), started.expiresAt, totalMs, async () => {
    await api.boardEnd().catch(() => {});
    chat?.finish(L(UI.outOfTime));
  });

  chat = chatMode({
    name: L(UI.boardTitle),
    greeting: L(UI.boardGreeting),
    send: async (text) => {
      const res = await api.boardChat(text);
      const entries = (res.replies || []).map((r: any) => ({
        name: L(PERSONA_MAP[r.personaId]?.title) || "Executive",
        text: r.text,
      }));
      return { entries, ended: !!res.ended };
    },
    onLeave: async () => {
      stopTimer();
      // Runs after chatMode's lifecycle — must self-handle errors here.
      try {
        const r: any = await api.boardEnd();
        // Defense stage, then the deliverable: final score + per-exec checklist.
        const defended = await runDefense();
        const score = defended ? defended.score : r?.score;
        const checklist = defended ? defended.checklist : (r?.checklist || []);
        if (typeof score === "number") await boardResultPanel(score, checklist);
      } catch { /* scoring is best-effort; the meeting still concluded */ }
      toast(L(UI.boardConcluded));
    },
  });
}
