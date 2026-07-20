/**
 * NPC interaction dispatcher — what happens when the player presses E on
 * someone. Scripted NPCs and AI-backed personas both speak through the same
 * retro textbox. All text bilingual; flow: brief → check → executive unlock.
 */
import { NpcDef, NPCS, PROP_LINES } from "../config/world";
import { TASKS, TRACKS, trackForPersona } from "../../shared/gameContent.js";
import { PERSONA_MAP } from "../../shared/personas.config.js";
import { api, state } from "../net/api";
import {
  showLines, showChoice, chatMode, sequentialQuiz, prepPanel, taskPanel, reviewWorkPanel, boardDeckPanel, showLoading, toast,
  startTimer, stopTimer, updateHUD,
} from "../ui/ui";
import { L, fmt, UI, lang } from "../i18n";

const $ = (id: string) => document.getElementById(id)!;

const pick = <T>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];
const nameOf = (npc: NpcDef) => `${L(npc.name)} · ${L(npc.role)}`;

export async function interactProp(char: string): Promise<void> {
  const lines = PROP_LINES[char];
  if (lines && lines.length) await showLines("…", [L(pick(lines))]);
}

export async function interact(npc: NpcDef, currentFloor: number): Promise<void> {
  try {
    if (npc.kind === "flavor") return await flavor(npc);
    if (!state.flags.metSupervisor && npc.kind !== "supervisor") {
      return await showLines(nameOf(npc), [L(UI.talkSupervisorFirst)]);
    }
    switch (npc.kind) {
      case "supervisor": return await supervisor(npc);
      case "task": return await taskNpc(npc);
      case "persona": return await personaNpc(npc);
      case "midpersona": return await midNpc(npc);
      case "board": return await boardTable(npc);
    }
  } catch (err: any) {
    toast(err.message || "Something went wrong.");
  } finally {
    updateHUD(currentFloor);
  }
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
    "How you get there is up to you. Our domain managers sit on Floors 13 and 14 — strategy, finance, marketing, operations, people, digital, product. Any order you like. Each one briefs you, checks you, and if you pass, the matching Nike executive on 15 takes your meeting.",
    "Pick your first track from the mission board — press M. Executives' calendars are timed and limited, so prepare before you knock. Your notebook (Q) collects everything.",
  ],
  zh: [
    "Athena！来得正好。欢迎加入中国咨询新人计划（CCNAP）。",
    "这是你的项目：耐克大中华区。上个财年收入下滑13%，生产转移到东南亚后质量投诉不断，安踏和李宁还借着国潮抢走份额。",
    "你的交付物是一份【独立的】五年增长战略。不是客户让你写什么就写什么——而是你访谈完他们之后，自己得出的结论。",
    "怎么走完全由你决定。我们的领域经理在13层和14层——战略、财务、营销、运营、人才、数字化、产品。顺序随你。每位经理会给你做简报、出考核，通过之后，15层对应的耐克高管才会见你。",
    "按M打开任务板，选你的第一条线。高管的日程限时限次，敲门前先做好准备。你的笔记本（Q）会收集一切。",
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
    await showLines(name, [fmt(LIN_LINES.passRight, { n: t.credibility }), L(LIN_LINES.passGo)]);
    toast(fmt(UI.credToast, { n: t.credibility }));
    await api.event("metSupervisor");
    return;
  }
  if (state.board.done && !state.flags.debriefDone) {
    await showLines(name, [L(LIN_LINES.debriefIntro)]);
    const res = await api.debrief();
    await showLines(name, [res.text, L(LIN_LINES.debriefOutro)]);
    return;
  }
  if (state.flags.debriefDone) {
    return await showLines(name, [L(LIN_LINES.allDone)]);
  }
  const n = Object.values(state.personas).filter((p) => p.used > 0).length;

  // Mid-engagement synthesis checkpoint — after 3+ interviews Lin wants an
  // interim readout (and the board won't convene without it).
  if (!state.flags.interimDone && n >= 3) {
    await showLines(name, [L(UI.interimIntro)]);
    const answer = await taskPanel(L(UI.interimTitle), fmt(UI.interimPrompt, { n }));
    if (answer === null) return;
    const res = await api.interim(answer);
    if (res.delta) toast(fmt(UI.credToast, { n: res.delta }));
    await showLines(name, [res.result === "fail" ? `${res.feedback} ${L(UI.interimRetry)}` : res.feedback]);
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
 * passing (or partial) unlocks the matching executive on Floor 15.
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
  if (passed) {
    return await showLines(name, [L(track.doneLine)]);
  }
  if (t?.status === "failed") {
    await showLines(name, [L(track.retryLine)]);
  }

  chatMode({
    name,
    greeting: hasTalked ? L(UI.gkGreetReturn) : L(track.greeting),
    send: async (text) => {
      const res = await api.gatekeeperChat(trackId, text);
      if (res.leads?.length) toast(L(UI.gkLeadToast));
      return { entries: [{ name, text: res.text }], ended: false };
    },
    // LEAVE just leaves — the check is its own button, taken when the player
    // decides they're ready (so stepping out never forces the quiz load).
    check: {
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

async function runExitQuiz(trackId: string, gkName: string, track: any) {
  // Generate the quiz + a bullet summary behind a blocking "…" line, then jump
  // straight in — no walk-away gap. The summary is the player's reference notes.
  const loading = showLoading(gkName, L(UI.gkGeneratingQuiz));
  let questions: any[], summary: any;
  try {
    ({ questions, summary } = await api.gatekeeperQuiz(trackId));
  } finally {
    loading.close();
  }
  if (summary) toast(L(UI.gkSummarySaved));
  const summaryText = summary ? L(summary) : "";
  const qLabels = questions.map((q: any) => L(q));

  // Answer → grade → (if not a clean PASS) feedback + revise, looping until the
  // player genuinely gets the full picture or steps away. Only PASS unlocks.
  let prev: string[] = [];
  while (true) {
    const answers = await sequentialQuiz(gkName, qLabels, summaryText, prev);
    if (!answers) return; // stepped away — nothing consumed, can retake later
    prev = answers;

    const grading = showLoading(gkName, L(UI.gkGrading));
    let res: any;
    try {
      res = await api.gatekeeperGrade(trackId, answers);
    } finally {
      grading.close();
    }

    if (res.result === "pass") {
      toast(fmt(UI.credToast, { n: res.delta }));
      await showLines(gkName, [fmt(UI.gkCheckPassed, { feedback: res.feedback, n: res.delta })]);
      const exec = NPCS.find((n) => n.id === `persona-${track.personaId}`)!;
      toast(`🔓 ${L(exec.name)} — F15`);
      return;
    }

    // Not passed — give the manager's feedback, then offer to revise right now.
    await showLines(gkName, [res.feedback]);
    const again = await showChoice(gkName, L(UI.gkRevisePrompt), [L(UI.gkReviseYes), L(UI.gkReviseLater)]);
    if (again !== 0) return; // review notes and come back later
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

  chat = chatMode({
    name,
    greeting: resuming ? L(UI.resumeLine) : L(UI.meetGreeting),
    send: async (text) => {
      const res = await api.chat(pid, text);
      return {
        entries: [{ name, text: res.text }],
        ended: !!res.ended,
        closingText: res.closingText || res.text,
      };
    },
    onLeave: async () => {
      stopTimer();
      await api.endInteraction(pid).catch(() => {});
    },
  });
}

/* ------------------- mid-level staff (untimed, unlimited) --------------- */

/**
 * Mid-level Nike digital humans (F11) — one per C-suite line, unlocked with
 * their boss's track. No meeting slots, no clock: they hold the frontline
 * detail (batch data, funnels, price bands, exit interviews) and route
 * strategy questions UP to their C-suite, cross-line questions SIDEWAYS.
 */
async function midNpc(npc: NpcDef) {
  const pid = npc.personaId!;
  const persona: any = PERSONA_MAP[pid];
  const name = nameOf(npc);
  const track: any = trackForPersona(persona.parent);
  const passed = track && state.tasks[track.taskId]?.status === "passed";
  if (!passed) {
    const gk = NPCS.find((n) => n.id === track.npcId)!;
    const boss: any = PERSONA_MAP[persona.parent];
    return await showLines(name, [
      fmt(UI.midLocked, { boss: L(boss.shortTitle), gk: L(gk.name), floor: gk.floor }),
    ]);
  }
  chatMode({
    name,
    greeting: L(persona.greeting),
    send: async (text) => {
      const res = await api.chat(pid, text);
      return { entries: [{ name, text: res.text }], ended: false };
    },
    onLeave: () => updateHUD(npc.floor),
  });
}

/* --------------------------- final boardroom --------------------------- */

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

    // Choose how to present: upload a polished deck (each exec evaluates it
    // from their own lens), or speak live and take their questions.
    const mode = await showChoice(L(UI.boardTitle), L(UI.boardPresentPrompt), [L(UI.boardPresentDeck), L(UI.boardPresentLive)]);
    if (mode === 0) {
      const evals = await boardDeckPanel();
      if (!evals) return; // cancelled — come back when ready
      await showLines(L(UI.boardTitle), [L(UI.boardDeckReactions)]);
      for (const e of evals) {
        const tag = e.verdict === "strong" ? "✅" : e.verdict === "weak" ? "⚠️" : e.verdict === "error" ? "…" : "➖";
        await showLines(e.name, [`${tag} ${e.comments}`]);
      }
      await api.boardEnd().catch(() => {});
      toast(L(UI.boardConcluded));
      return; // deck presented + evaluated — the board is concluded
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
      await api.boardEnd().catch(() => {});
      toast(L(UI.boardConcluded));
    },
  });
}
