/**
 * DOM UI layer — the retro textbox (all conversations, scripted AND AI, render
 * through it), modal panels (elevator / notebook / prep / checks / menu with
 * mission board), HUD, session timer, toasts. Fully bilingual via i18n.
 */
import { state, api, sessionId } from "../net/api";
import { GAME_CONFIG, unlockedFloor } from "../../shared/gameConfig.js";
import { TRACKS } from "../../shared/gameContent.js";
import { PHASES } from "../../shared/phases.js";
import { workspaceView } from "../../shared/workspace.js";
import { COMPETENCIES } from "../../shared/competencies.js";
import { PERSONA_MAP } from "../../shared/personas.config.js";
import { NPCS } from "../config/world";
import { computeObjective } from "../game/objective";
import { clearProfile } from "../game/profile";
import { L, fmt, UI, lang, setLang } from "../i18n";

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

export const ui = {
  dialogueOpen: false,
  panelOpen: false,
  cutscene: false,
  get busy() {
    return this.dialogueOpen || this.panelOpen || this.cutscene;
  },
};

/* ------------------------------- HUD ---------------------------------- */

const interviewedCount = () => (state ? Object.values(state.personas).filter((p) => p.used > 0).length : 0);
const unlockedExecCount = () =>
  state ? Object.values(TRACKS).filter((t: any) => ["passed"].includes(state.tasks[t.taskId]?.status)).length : 0;

// Rough credibility "mastery" target, so the HUD bar has something to fill
// toward: brief check (20) + interim (30) + every track's check credibility.
const CRED_TARGET = 20 + 30 + Object.values(TRACKS).reduce((a: number, t: any) => a + (t.credibility || 40), 0);

// Quit-to-menu handler — main.ts wires this; default is a plain reload.
let quitHandler: () => void = () => location.reload();
export function setQuitHandler(fn: () => void) { quitHandler = fn; }

// Relabel handler — OfficeScene wires this to re-render its Phaser NPC labels
// in the new language, so switching language never needs a full page reload.
let relabelHandler: () => void = () => {};
export function setRelabelHandler(fn: () => void) { relabelHandler = fn; }

export function applyStaticLabels() {
  $("hud-menu").textContent = L(UI.menuBtn);
  $("hud-menu").title = L(UI.menuBtnTitle);
  $("hud-fullscreen").textContent = "⛶";
  $("hud-fullscreen").title = L(UI.fullscreen);
  $("hud-notebook").title = L(UI.notebook);
  const binder = document.getElementById("hud-binder"); if (binder) binder.title = L(UI.wsBtn);
  ($("dlg-input") as HTMLInputElement).placeholder = L(UI.askPh);
  $("dlg-send").textContent = L(UI.ask);
  $("dlg-leave").textContent = L(UI.leave);
}

export function updateHUD(floor: number) {
  $("hud-floor").textContent = `F${floor}`;
  if (!state) return;
  const pct = Math.min(100, Math.round((state.credibility / CRED_TARGET) * 100));
  ($("cred-fill") as HTMLElement).style.width = `${pct}%`;
  $("cred-label").textContent = `${L(UI.credibility)} ${state.credibility}`;
  renderTracker();
}

/**
 * Engagement Tracker — the always-visible 5-phase spine (the v2 backbone).
 * Reads the server-authoritative engagement state; each step shows done /
 * in-progress / locked so the player always knows where they are in the
 * consulting lifecycle, not just where they are in the building.
 */
let lastTrackerPhase: string | null = null;
function renderTracker() {
  const eng = state?.engagement;
  const bar = $("tracker");
  if (!eng || !state.flags.metSupervisor) { bar.hidden = true; return; }
  bar.hidden = false;
  // Announce a phase change so the player knows to go get their next brief.
  if (lastTrackerPhase && eng.phase !== lastTrackerPhase) {
    const np = PHASES.find((p) => p.id === eng.phase);
    if (np) toast(fmt(UI.phaseAdvanced, { label: L(np.short) }));
  }
  lastTrackerPhase = eng.phase;
  $("tracker-title").textContent = L(UI.trackerTitle);
  const steps = $("tracker-steps");
  steps.innerHTML = "";
  for (const ph of PHASES) {
    const done = !!eng.completed[ph.id];
    const current = eng.phase === ph.id && !done;
    const el = document.createElement("span");
    el.className = "tstep" + (done ? " done" : current ? " current" : " locked");
    el.textContent = `${done ? "✓" : current ? "▸" : "•"} ${L(ph.short)}`;
    el.title = `${L(ph.name)} (${done ? L(UI.phaseDone) : current ? L(UI.phaseCurrent) : L(UI.phaseLocked)})\n${L(ph.deliverable)}`;
    steps.appendChild(el);
  }
}

export function toast(msg: string) {
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = msg;
  $("toasts").appendChild(el);
  setTimeout(() => el.remove(), 4200);
}

let lastObjLabel = "";
export function updateObjectiveBanner(label: string, why: string) {
  if (label === lastObjLabel) return;
  lastObjLabel = label;
  $("obj-label").textContent = label;
  $("obj-why").textContent = why ? `— ${why}` : "";
}

/* ----------------------------- textbox -------------------------------- */

const dlg = () => $("dialogue");
const dlgText = () => $("dlg-text");

function typewriter(el: HTMLElement, text: string): Promise<void> {
  return new Promise((resolve) => {
    el.textContent = "";
    let i = 0;
    const iv = setInterval(() => {
      i = Math.min(text.length, i + 3);
      el.textContent = text.slice(0, i);
      el.scrollTop = el.scrollHeight;
      if (i >= text.length) { clearInterval(iv); resolve(); }
    }, 12);
    const skip = () => { clearInterval(iv); el.textContent = text; resolve(); el.removeEventListener("click", skip); };
    el.addEventListener("click", skip);
  });
}

function openBox(name: string) {
  ui.dialogueOpen = true;
  dlg().hidden = false;
  $("dlg-name").textContent = name;
  $("dlg-choices").hidden = true;
  $("dlg-input-row").hidden = true;
  $("dlg-hint").hidden = true;
}

export function closeDialogue() {
  ui.dialogueOpen = false;
  dlg().hidden = true;
}

/** A blocking, non-advanceable "…" line held on screen until close() is
 *  called — keeps the player locked in place while something loads (e.g.
 *  the exit quiz), so there's no walk-away gap before it appears. */
export function showLoading(name: string, text: string): { close: () => void } {
  openBox(name);
  dlgText().textContent = text;
  return { close: () => closeDialogue() };
}

/** Scripted lines, advanced with E / Space / Enter / click. */
export function showLines(name: string, lines: string[]): Promise<void> {
  return new Promise(async (resolve) => {
    openBox(name);
    for (const line of lines) {
      await typewriter(dlgText(), line);
      $("dlg-hint").hidden = false;
      await waitAdvance();
      $("dlg-hint").hidden = true;
    }
    closeDialogue();
    resolve();
  });
}

function waitAdvance(): Promise<void> {
  return new Promise((resolve) => {
    const onKey = (e: KeyboardEvent) => {
      if (["e", "E", " ", "Enter"].includes(e.key)) { cleanup(); resolve(); }
    };
    const onClick = () => { cleanup(); resolve(); };
    const cleanup = () => {
      window.removeEventListener("keydown", onKey);
      dlg().removeEventListener("click", onClick);
    };
    window.addEventListener("keydown", onKey);
    dlg().addEventListener("click", onClick);
  });
}

/** Multiple-choice inside the textbox. Resolves with chosen index. */
export function showChoice(name: string, prompt: string, options: string[]): Promise<number> {
  return new Promise(async (resolve) => {
    openBox(name);
    await typewriter(dlgText(), prompt);
    const box = $("dlg-choices");
    box.innerHTML = "";
    box.hidden = false;
    options.forEach((opt, i) => {
      const b = document.createElement("button");
      b.textContent = `▸ ${opt}`;
      b.onclick = () => { closeDialogue(); resolve(i); };
      box.appendChild(b);
    });
  });
}

/**
 * Live AI-chat mode inside the same retro textbox.
 */
export function chatMode(opts: {
  name: string;
  greeting: string;
  send: (text: string) => Promise<{ entries: { name: string; text: string }[]; ended: boolean; closingText?: string }>;
  onLeave: () => void;
  /** Optional second exit button (e.g. the gatekeeper's "take check") — LEAVE
   *  then just leaves, so stepping out never forces the assessment. */
  check?: { label: string; onCheck: () => void };
}) {
  openBox(opts.name);
  const input = $<HTMLInputElement>("dlg-input");
  const row = $("dlg-input-row");
  const sendBtn = $<HTMLButtonElement>("dlg-send");
  const leaveBtn = $<HTMLButtonElement>("dlg-leave");
  const checkBtn = $<HTMLButtonElement>("dlg-check");
  let closed = false;

  const showEntries = async (entries: { name: string; text: string }[]) => {
    for (const e of entries) {
      $("dlg-name").textContent = e.name;
      await typewriter(dlgText(), e.text);
      if (entries.length > 1) { $("dlg-hint").hidden = false; await waitAdvance(); $("dlg-hint").hidden = true; }
    }
  };

  const finish = (msg?: string, after: () => void = opts.onLeave) => {
    if (closed) return;
    closed = true;
    row.hidden = true;
    input.onkeydown = null;
    stopTimer();
    const wrap = async () => {
      if (msg) { $("dlg-name").textContent = opts.name; await typewriter(dlgText(), msg); $("dlg-hint").hidden = false; await waitAdvance(); }
      closeDialogue();
      after();
    };
    wrap();
  };

  const submit = async () => {
    const text = input.value.trim();
    if (!text || sendBtn.disabled) return;
    input.value = "";
    sendBtn.disabled = true;
    $("dlg-name").textContent = L(UI.you);
    dlgText().textContent = text;
    await typewriter(dlgText(), text + "\n\n…");
    try {
      const res = await opts.send(text);
      if (closed) return; // player hit LEAVE mid-reply — don't clobber the exit flow
      await showEntries(res.entries);
      if (res.ended) return finish(res.closingText || L(UI.outOfTime));
    } catch (err: any) {
      if (closed) return;
      dlgText().textContent = fmt(UI.connectionHiccup, { e: err.message });
    } finally {
      sendBtn.disabled = false;
      if (!closed) input.focus();
    }
  };

  typewriter(dlgText(), opts.greeting).then(() => {
    row.hidden = false;
    input.focus();
  });
  sendBtn.disabled = false;
  sendBtn.onclick = submit;
  input.onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } e.stopPropagation(); };
  leaveBtn.onclick = () => finish();
  checkBtn.hidden = !opts.check;
  if (opts.check) {
    checkBtn.textContent = opts.check.label;
    checkBtn.onclick = () => finish(undefined, opts.check!.onCheck);
  }

  return { finish };
}

/* ---------------------------- session timer ---------------------------- */

let timerIv: ReturnType<typeof setInterval> | null = null;

export function startTimer(label: string, expiresAt: number, totalMs: number, onExpire: () => void) {
  const bar = $("timerbar");
  bar.hidden = false;
  stopTimer();
  const tick = () => {
    const left = Math.max(0, expiresAt - Date.now());
    const m = Math.floor(left / 60000), s = Math.floor((left % 60000) / 1000);
    $("timer-label").textContent = `${label} — ${m}:${String(s).padStart(2, "0")}`;
    $("timer-fill").style.width = `${(left / totalMs) * 100}%`;
    ($("timer-fill") as HTMLElement).style.background = left < 60000 ? "#e05555" : "#ff9d5e";
    if (left <= 0) { stopTimer(); onExpire(); }
  };
  tick();
  timerIv = setInterval(tick, 1000);
}

export function stopTimer() {
  if (timerIv) clearInterval(timerIv);
  timerIv = null;
  $("timerbar").hidden = true;
}

/* ------------------------------ panels --------------------------------- */

function openPanel(html: string): HTMLElement {
  ui.panelOpen = true;
  $("panel-backdrop").hidden = false;
  const p = $("panel");
  p.innerHTML = html;
  return p;
}

export function closePanel() {
  ui.panelOpen = false;
  $("panel-backdrop").hidden = true;
}

/** Elevator floor select. Resolves with floor number or null. */
export function elevatorPanel(current: number): Promise<number | null> {
  return new Promise((resolve) => {
    const p = openPanel(`<h2>${L(UI.elevator)}</h2><div class="row" id="floors"></div>
      <p class="muted">${L(UI.elevatorHint)}</p>
      <div class="row"><button id="pcancel">${L(UI.stayHere)}</button></div>`);
    const floors = [...GAME_CONFIG.floors].reverse();
    const box = p.querySelector("#floors")!;
    const n = interviewedCount();
    for (const f of floors) {
      const info = (GAME_CONFIG.floorInfo as any)[f];
      const open = unlockedFloor(f, n);
      const b = document.createElement("button");
      b.textContent = `F${f} — ${L(info.name)}${open ? "" : " 🔒"}`;
      b.style.width = "100%";
      if (!open) b.classList.add("locked");
      b.onclick = () => {
        if (!open) {
          toast(fmt(UI.lockedBoard, { n }));
          return;
        }
        if (f === current) { closePanel(); resolve(null); return; }
        closePanel(); resolve(f);
      };
      box.appendChild(b);
    }
    (p.querySelector("#pcancel") as HTMLButtonElement).onclick = () => { closePanel(); resolve(null); };
  });
}

/** Free-response check panel. Resolves with answer text or null.
 *  `note` (optional) shows prior reviewer feedback as context on a revise pass. */
export function taskPanel(title: string, prompt: string, note?: string): Promise<string | null> {
  return new Promise((resolve) => {
    const noteBlock = note ? `<p class="warnbox">${esc(note)}</p>` : "";
    const p = openPanel(`<h2>📋 ${esc(title)}</h2><p>${esc(prompt)}</p>${noteBlock}
      <textarea id="ptext" placeholder="${L(UI.writeAnswerPh)}"></textarea>
      <div class="row"><button id="psubmit">${L(UI.submitAnswer)}</button><button id="pcancel">${L(UI.notYet)}</button></div>`);
    (p.querySelector("#psubmit") as HTMLButtonElement).onclick = () => {
      const v = (p.querySelector("#ptext") as HTMLTextAreaElement).value.trim();
      if (!v) return toast(L(UI.writeSomething));
      closePanel(); resolve(v);
    };
    (p.querySelector("#pcancel") as HTMLButtonElement).onclick = () => { closePanel(); resolve(null); };
  });
}

/**
 * Sequential exit quiz — one question at a time, each with its own answer box
 * and the conversation summary available as reference notes. `initial` lets a
 * revision start from the player's previous answers. Resolves with all answers
 * (in order) or null if they back out. Empty questions array → [].
 */
export function sequentialQuiz(
  gatekeeperName: string, questions: string[], summaryText: string, initial: string[] = [],
): Promise<string[] | null> {
  const answers = [...initial];
  const notesBlock = summaryText
    ? `<details class="quiz-notes"><summary>${L(UI.gkYourNotes)}</summary><div>${esc(summaryText)}</div></details>`
    : "";

  const askOne = (i: number): Promise<string | null> => new Promise((resolve) => {
    const isLast = i === questions.length - 1;
    const p = openPanel(`<h2>${fmt(UI.gkQuizTitle, { name: esc(gatekeeperName) })}</h2>
      <p class="muted">${fmt(UI.gkQuestionOf, { i: i + 1, n: questions.length })}</p>
      ${notesBlock}
      <p><b>${esc(questions[i])}</b></p>
      <textarea id="pans" placeholder="${L(UI.gkAnswerPh)}">${esc(answers[i] || "")}</textarea>
      <div class="row"><button id="pnext">${isLast ? L(UI.gkSubmitAnswers) : L(UI.gkNextQuestion)}</button><button id="pcancel">${L(UI.notYet)}</button></div>`);
    const ta = p.querySelector("#pans") as HTMLTextAreaElement;
    ta.focus();
    (p.querySelector("#pnext") as HTMLButtonElement).onclick = () => {
      const v = ta.value.trim();
      if (!v) return toast(L(UI.writeSomething));
      resolve(v);
    };
    (p.querySelector("#pcancel") as HTMLButtonElement).onclick = () => { closePanel(); resolve(null); };
  });

  return (async () => {
    for (let i = 0; i < questions.length; i++) {
      const a = await askOne(i);
      if (a === null) return null; // backed out — nothing consumed
      answers[i] = a;
    }
    closePanel();
    return answers;
  })();
}

/** Prep screen before a timed executive session. Resolves true to start.
 *  `rubric` (optional) renders judgment criteria up front — real training
 *  programs show the rubric BEFORE the task, not after. */
export function prepPanel(opts: { title: string; sub: string; remaining: string; warn?: string; rubric?: string[]; rubricTitle?: string; priorityHint?: string }): Promise<boolean> {
  return new Promise((resolve) => {
    const rubricHtml = opts.rubric?.length
      ? `<div class="rubric"><b>${esc(opts.rubricTitle || "")}</b><ul>${opts.rubric.map((r) => `<li>${esc(r)}</li>`).join("")}</ul>${opts.priorityHint ? `<p class="rubric-priority">${esc(opts.priorityHint)}</p>` : ""}</div>`
      : "";
    const p = openPanel(`<h2>${fmt(UI.prepTitle, { t: esc(opts.title) })}</h2>
      <p>${esc(opts.sub)}</p><p class="muted">${esc(opts.remaining)}</p>
      ${opts.warn ? `<div class="warnbox">${esc(opts.warn)}</div>` : ""}
      ${rubricHtml}
      <p class="muted">${L(UI.prepNote)}</p>
      <textarea id="ptext">${esc(state.notes || "")}</textarea>
      <div class="row"><button id="pstart">${L(UI.prepStart)}</button><button id="pcancel">${L(UI.prepBack)}</button></div>`);
    const save = () => api.save(state.client, (p.querySelector("#ptext") as HTMLTextAreaElement).value);
    (p.querySelector("#pstart") as HTMLButtonElement).onclick = () => { save(); closePanel(); resolve(true); };
    (p.querySelector("#pcancel") as HTMLButtonElement).onclick = () => { save(); closePanel(); resolve(false); };
  });
}

/** "Welcome back" panel after a break — real analysts don't finish in one sitting. */
export function welcomePanel(awayLabel: string, objectiveLabel: string): Promise<void> {
  return new Promise((resolve) => {
    const checks = Object.values(TRACKS).filter((t: any) => ["passed"].includes(state.tasks[t.taskId]?.status)).length;
    const p = openPanel(`<h2>${L(UI.welcomeBack)}</h2>
      <p>${fmt(UI.welcomeAway, { t: awayLabel })}</p>
      <p><b>${fmt(UI.welcomeProgress, { c: state.credibility, t: checks, i: interviewedCount() })}</b></p>
      <p>${L(UI.nextStep)} ${esc(objectiveLabel)}</p>
      <div class="row"><button id="pgo">${L(UI.welcomeContinue)}</button></div>`);
    (p.querySelector("#pgo") as HTMLButtonElement).onclick = () => { closePanel(); resolve(); };
  });
}

const FILE_ACCEPT = ".txt,.md,.pdf,.docx,.pptx,text/plain,text/markdown,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation";

/** Wire a file <input> to fill a textarea — pdf/docx/pptx go through the
 *  server-side extractor; txt/md read locally. Returns a live filename getter. */
function wireFileUpload(p: HTMLElement): () => string {
  let filename = "pasted-text";
  (p.querySelector("#pfile") as HTMLInputElement).onchange = (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const ta = p.querySelector("#ptext") as HTMLTextAreaElement;
    const isBinary = /\.(pdf|docx|pptx)$/i.test(file.name);
    if (file.size > 12 * 1024 * 1024 || (!isBinary && !/\.(txt|md)$/i.test(file.name))) {
      toast(L(UI.reviewBadFile));
      return;
    }
    filename = file.name;
    const reader = new FileReader();
    if (isBinary) {
      ta.value = fmt(UI.reviewExtracting, { f: file.name });
      reader.onload = async () => {
        const base64 = String(reader.result || "").split(",")[1] || "";
        try {
          const res = await api.extractText(file.name, base64);
          ta.value = res.text;
        } catch (err: any) {
          ta.value = "";
          toast(err.message || L(UI.reviewBadFile));
        }
      };
      reader.readAsDataURL(file);
    } else {
      reader.onload = () => { ta.value = String(reader.result || "").slice(0, 40000); };
      reader.readAsText(file);
    }
  };
  return () => filename;
}

/** Review-work panel — scoped to ONE reviewer (the NPC you're talking to):
 *  upload/paste a document and get their in-character audit. */
export function reviewWorkPanel(reviewerId: string, reviewerLabel: string): Promise<void> {
  return new Promise((resolve) => {
  const p = openPanel(`<h2>${L(UI.reviewTitle)}</h2>
    <p class="muted">${fmt(UI.reviewWithHint, { name: esc(reviewerLabel) })}</p>
    <div class="row">
      <input type="file" id="pfile" accept="${FILE_ACCEPT}" />
    </div>
    <textarea id="ptext" placeholder="${L(UI.writeAnswerPh)}" style="height:160px"></textarea>
    <div class="row"><button id="psubmit">${L(UI.reviewSubmit)}</button><button id="pcancel">${L(UI.close)}</button></div>
    <div id="preview-result"></div>`);

  const filename = wireFileUpload(p);

  (p.querySelector("#pcancel") as HTMLButtonElement).onclick = () => { closePanel(); resolve(); };
  (p.querySelector("#psubmit") as HTMLButtonElement).onclick = async () => {
    const text = (p.querySelector("#ptext") as HTMLTextAreaElement).value.trim();
    if (!text) return toast(L(UI.writeSomething));
    const btn = p.querySelector("#psubmit") as HTMLButtonElement;
    btn.disabled = true;
    const resultBox = p.querySelector("#preview-result") as HTMLElement;
    resultBox.innerHTML = `<p class="muted">${esc(fmt(UI.reviewReading, { name: reviewerLabel }))}</p>`;
    try {
      const res = await api.reviewWork(reviewerId, filename(), text);
      const verdictLabel = res.verdict === "strong" ? L(UI.reviewVerdictStrong) : res.verdict === "weak" ? L(UI.reviewVerdictWeak) : L(UI.reviewVerdictAcceptable);
      resultBox.innerHTML = `<div class="rubric"><b>${esc(verdictLabel)}</b> — ${esc(res.reviewerName)}<p>${esc(res.comments)}</p></div>`;
      toast(L(UI.reviewSaved));
    } catch (err: any) {
      resultBox.innerHTML = `<p class="muted">${esc(err.message)}</p>`;
    } finally {
      btn.disabled = false;
    }
  };
  });
}

/** Board verdict — deliverable score 0-100 + per-executive fulfilled checklist. */
export function boardResultPanel(score: number, checklist: { short: string; name: string; fulfilled: boolean }[]): Promise<void> {
  return new Promise((resolve) => {
    const rows = (checklist || []).map((c) =>
      `<div class="dir-row"><span class="who"><b>${esc(c.short)}</b> — ${esc(c.name)}</span><span class="status">${c.fulfilled ? L(UI.fulfilledYes) : L(UI.fulfilledNo)}</span></div>`
    ).join("");
    const p = openPanel(`<h2>${L(UI.boardScoreTitle)}</h2>
      <div class="pbar"><div style="width:${Math.max(0, Math.min(100, score))}%"></div><span>${L(UI.boardScoreLabel)}: ${score}/100</span></div>
      <h2 style="margin-top:14px">${L(UI.boardChecklistTitle)}</h2>
      ${rows}
      <div class="row"><button id="pclose" class="primary">${L(UI.close)}</button></div>`);
    (p.querySelector("#pclose") as HTMLButtonElement).onclick = () => { closePanel(); resolve(); };
  });
}

/** Board deck panel — upload/paste the final 5-year strategy; resolves with the
 *  full review response {evals, score, checklist} (or null if cancelled). */
export function boardDeckPanel(): Promise<any | null> {
  return new Promise((resolve) => {
    const p = openPanel(`<h2>${L(UI.boardDeckTitle)}</h2>
      <p class="muted">${L(UI.boardDeckHint)}</p>
      <div class="row"><input type="file" id="pfile" accept="${FILE_ACCEPT}" /></div>
      <textarea id="ptext" placeholder="${L(UI.writeAnswerPh)}" style="height:150px"></textarea>
      <div class="row"><button id="psubmit">${L(UI.boardDeckSubmit)}</button><button id="pcancel">${L(UI.cancel)}</button></div>
      <div id="deck-result"></div>`);
    wireFileUpload(p);
    (p.querySelector("#pcancel") as HTMLButtonElement).onclick = () => { closePanel(); resolve(null); };
    (p.querySelector("#psubmit") as HTMLButtonElement).onclick = async () => {
      const text = (p.querySelector("#ptext") as HTMLTextAreaElement).value.trim();
      if (!text) return toast(L(UI.writeSomething));
      const btn = p.querySelector("#psubmit") as HTMLButtonElement;
      btn.disabled = true;
      (p.querySelector("#deck-result") as HTMLElement).innerHTML = `<p class="muted">${L(UI.boardDeckReading)}</p>`;
      try {
        const res = await api.boardReviewDeck(text);
        closePanel();
        resolve(res);
      } catch (err: any) {
        (p.querySelector("#deck-result") as HTMLElement).innerHTML = `<p class="muted">${esc(err.message)}</p>`;
        btn.disabled = false;
      }
    };
  });
}

/* ------------------------------- menu ---------------------------------- */

const trackStatus = (trackId: string): { text: string; done: boolean } => {
  const t: any = (TRACKS as any)[trackId];
  const task = state.tasks[t.taskId];
  const passed = task && ["passed"].includes(task.status);
  if (passed && state.personas[t.personaId]?.used > 0) return { text: L(UI.stInterviewed), done: true };
  if (passed) return { text: L(UI.stPassed), done: false };
  if (task?.status === "failed") return { text: L(UI.stRetry), done: false };
  if (state.gatekeepers[trackId]?.hasTalked) return { text: L(UI.stTalking), done: false };
  return { text: L(UI.stNotStarted), done: false };
};

/** Generic yes/no confirmation. Resolves true on confirm. */
export function confirmPanel(title: string, message: string, confirmLabel: string): Promise<boolean> {
  return new Promise((resolve) => {
    const p = openPanel(`<h2>${esc(title)}</h2>
      <p>${esc(message)}</p>
      <div class="menu-actions">
        <button id="pyes" class="danger">${esc(confirmLabel)}</button>
        <button id="pno" class="primary">${L(UI.cancel)}</button>
      </div>`);
    (p.querySelector("#pyes") as HTMLButtonElement).onclick = () => { closePanel(); resolve(true); };
    (p.querySelector("#pno") as HTMLButtonElement).onclick = () => { closePanel(); resolve(false); };
  });
}

/** Menu — progress, mission board (pick your track), and the directory. */
export function menuPanel(objective: { label: string; why: string }) {
  const doneChecks = Object.values(TRACKS).filter((t: any) => ["passed"].includes(state.tasks[t.taskId]?.status)).length;
  const interviewed = interviewedCount();

  // Mission board — one row per track, any order.
  const board = Object.entries(TRACKS).map(([id, t]: [string, any]) => {
    const gk = NPCS.find((n) => n.id === t.npcId)!;
    const exec = NPCS.find((n) => n.id === `persona-${t.personaId}`)!;
    const st = trackStatus(id);
    const isActive = state.selectedMission === id;
    return `<div class="dir-row">
      <span class="who"><b>${esc(L(t.name))}</b><br/>
        <span class="muted">${esc(L(gk.name))} (F${gk.floor}) → ${L(UI.unlocks)} ${esc(L(exec.name))}</span></span>
      <span class="status">${st.text}<br/>
        ${st.done ? "" : `<button class="mission-pick${isActive ? " sel" : ""}" data-track="${id}">${isActive ? L(UI.active) : L(UI.setActive)}</button>`}
      </span>
    </div>`;
  }).join("");

  // Directory grouped by floor.
  const floors = [...new Set(NPCS.map((n) => n.floor))].sort((a, b) => a - b);
  const dir = floors.map((f) => {
    const info = (GAME_CONFIG.floorInfo as any)[f];
    const locked = !unlockedFloor(f, interviewed);
    const rows = NPCS.filter((n) => n.floor === f).map((n) => {
      let status = "";
      if (n.kind === "supervisor") status = state.flags.metSupervisor ? L(UI.briefedYou) : L(UI.startHere);
      else if (n.kind === "task") {
        const trackId = Object.keys(TRACKS).find((k) => (TRACKS as any)[k].taskId === n.taskId)!;
        status = trackStatus(trackId).text;
      } else if (n.kind === "persona") {
        const track = Object.values(TRACKS).find((t: any) => t.personaId === n.personaId) as any;
        const gk = NPCS.find((x) => x.id === track.npcId)!;
        const passed = ["passed"].includes(state.tasks[track.taskId]?.status);
        const p = state.personas[n.personaId!];
        status = passed
          ? fmt(UI.meetingsLeftShort, { a: state.config.csuite.maxInteractions - p.used, b: state.config.csuite.maxInteractions })
          : fmt(UI.lockedShort, { name: L(gk.name) });
      } else if (n.kind === "midpersona") {
        const parent = (PERSONA_MAP[n.personaId!] as any)?.parent;
        const track = Object.values(TRACKS).find((t: any) => t.personaId === parent) as any;
        const passed = track && ["passed"].includes(state.tasks[track.taskId]?.status);
        status = passed ? L(UI.chat) : "🔒";
      } else if (n.kind === "board") status = state.board.done ? L(UI.pitchMade) : locked ? "🔒" : L(UI.finalPitch);
      else status = L(UI.chat);
      return `<div class="dir-row"><span class="who"><b>${esc(L(n.name))}</b> — ${esc(L(n.role))}</span><span class="status">${status}</span></div>`;
    }).join("");
    return `<div class="dir-floor">F${f} · ${L(info.name)}${locked ? " 🔒" : ""}</div>${rows}`;
  }).join("");

  // Overall engagement completion: 7 checks + 7 interviews + interim + board.
  const totalSteps = 16;
  const completed = doneChecks + interviewed + (state.flags.interimDone ? 1 : 0) + (state.board.done ? 1 : 0);
  const pct = Math.round((completed / totalSteps) * 100);

  const p = openPanel(`<h2>${L(UI.menuTitle)}</h2>
    <div class="menu-actions">
      <button id="pclose" class="primary">${L(UI.backToOffice)}</button>
      <button id="plang">${L(UI.language)}</button>
      <button id="pquit" class="danger">${L(UI.quitToMenu)}</button>
      <button id="prestart" class="danger">${L(UI.restartEngagement)}</button>
    </div>
    <h2>${L(UI.engagementStatus)}</h2>
    <div class="pbar"><div style="width:${pct}%"></div><span>${completed}/${totalSteps} · ${pct}%</span></div>
    <p class="muted">${L(UI.credibility)} ${state.credibility} · ${fmt(UI.execProgress, { u: unlockedExecCount(), i: interviewed })} · ${L(UI.done)}: ${state.board.done ? "🏛" : "—"}</p>
    <p><b>${L(UI.nextStep)}</b> ${esc(objective.label)}<br/><span class="muted">${esc(objective.why)}</span></p>
    <h2 style="margin-top:14px">${L(UI.missionBoard)}</h2>
    <p class="muted">${L(UI.missionBoardHint)}</p>
    ${board}
    <h2 style="margin-top:14px">${L(UI.directory)}</h2>
    ${dir}`);

  (p.querySelector("#pclose") as HTMLButtonElement).onclick = closePanel;
  (p.querySelector("#pquit") as HTMLButtonElement).onclick = () => { closePanel(); quitHandler(); };
  (p.querySelector("#prestart") as HTMLButtonElement).onclick = async () => {
    closePanel();
    const ok = await confirmPanel(L(UI.restartTitle), L(UI.restartMsg), L(UI.restartConfirm));
    if (!ok) return menuPanel(objective); // cancelled — reopen the menu
    await api.reset().catch(() => {});
    localStorage.removeItem("athena-seen-intro"); // replay onboarding from the top
    clearProfile(); // back through the character creator too — only language is kept
    location.reload();
  };
  (p.querySelector("#plang") as HTMLButtonElement).onclick = () => {
    setLang(lang === "en" ? "zh" : "en");
    relabelHandler();                        // re-render the Phaser NPC labels + HUD in place
    menuPanel(computeObjective(state));      // re-render this panel + fresh localized objective — no reload
  };
  p.querySelectorAll<HTMLButtonElement>(".mission-pick").forEach((b) => {
    b.onclick = async () => {
      const id = b.dataset.track!;
      await api.selectMission(state.selectedMission === id ? null : id);
      closePanel();
    };
  });
}

/* ----------------------------- quest log ------------------------------- */

const TYPE_ICON: Record<string, string> = {
  task: "📋", credibility: "⭐", unlock: "🔓", meeting: "🕐", quote: "💬", board: "🏛", debrief: "🎓", fact: "📚", lead: "📌", review: "📄",
};

export function questLogPanel() {
  const entries = [...(state?.questLog || [])].reverse();
  const rows = entries.map((e) =>
    `<div class="quest-entry"><b>${TYPE_ICON[e.type] || "•"} ${esc(e.title)}</b>${esc(e.body || "")}</div>`
  ).join("") || `<p class="muted">${L(UI.nothingYet)}</p>`;
  const p = openPanel(`<h2>${L(UI.notebook)}</h2>
    <p class="muted">${L(UI.notebookHint)}</p>
    <textarea id="pnotes">${esc(state?.notes || "")}</textarea>
    <div class="row"><button id="pexport">${L(UI.exportTxt)}</button><button id="pclose">${L(UI.close)}</button></div>
    ${rows}`);
  (p.querySelector("#pclose") as HTMLButtonElement).onclick = () => {
    api.save(state.client, (p.querySelector("#pnotes") as HTMLTextAreaElement).value);
    closePanel();
  };
  (p.querySelector("#pexport") as HTMLButtonElement).onclick = () => {
    const notes = (p.querySelector("#pnotes") as HTMLTextAreaElement).value;
    const txt = [
      `ATHENA RPG — Notebook export (session ${sessionId})`,
      `${L(UI.credibility)}: ${state.credibility}`,
      ``, `=== NOTES ===`, notes, ``, `=== LOG ===`,
      ...entries.map((e) => `[${new Date(e.t).toLocaleString()}] (${e.type}) ${e.title}\n${e.body || ""}\n`),
    ].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([txt], { type: "text/plain" }));
    a.download = "athena-notebook.txt";
    a.click();
  };
}

/**
 * Skills-you're-building reference (Wave 3 / Part A) — makes the learning
 * outcomes explicit: what each activity trains and how it's assessed.
 */
export function competenciesPanel() {
  const rows = COMPETENCIES.map((c: any) => `<div class="skill-row"><h3>${c.alice ? "★ " : ""}${esc(L(c.skill))}</h3>
    <p><b>${L(UI.skillExercised)}:</b> ${esc(L(c.exercisedBy))}</p>
    <p class="muted"><b>${L(UI.skillEvidence)}:</b> ${esc(L(c.evidence))}</p></div>`).join("");
  const p = openPanel(`<h2>${L(UI.skillsTitle)}</h2><p class="muted">${L(UI.skillsIntro)}</p>${rows}
    <div class="row"><button id="pclose">${L(UI.close)}</button></div>`);
  (p.querySelector("#pclose") as HTMLButtonElement).onclick = () => closePanel();
}

/**
 * The Engagement Binder (Wave 2) — the formal workspace. Data packs arrive
 * automatically; the player authors pain points → findings (cite evidence) →
 * recommendations (cite findings). Re-renders after every add/remove so the
 * unsupported / unreconciled flags update live. workspaceView (shared) computes
 * the flags and resolves bilingual pack text in the current language.
 */
export function workspacePanel() {
  const render = () => {
    const v = workspaceView(state.workspace, lang);
    const chip = (id: string, label: string) => `<label class="ws-chk"><input type="checkbox" value="${id}"> ${esc(label)}</label>`;
    const packChips = v.dataPacks.map((p) => chip(p.id, p.title)).join("") || `<span class="muted">${L(UI.wsNoPacks)}</span>`;
    const painChips = v.painPoints.map((p) => chip(p.id, p.statement.slice(0, 48))).join("") || `<span class="muted">${L(UI.wsEmpty)}</span>`;
    const findChips = v.findings.map((f) => chip(f.id, f.statement.slice(0, 48))).join("") || `<span class="muted">${L(UI.wsEmpty)}</span>`;

    const packCards = v.dataPacks.length
      ? v.dataPacks.map((p) => `<div class="ws-pack"><b>${esc(p.title)}</b> <span class="ws-src">${esc((p.source || "").toUpperCase())}</span><p>${esc(p.summary)}</p></div>`).join("")
      : `<p class="muted">${L(UI.wsNoPacks)}</p>`;
    const warns = v.unreconciled.map((u) => `<p class="warnbox">${fmt(UI.wsUnreconciled, { a: esc(u.titles[0]), b: esc(u.titles[1]) })}</p>`).join("");
    const row = (kind: string, x: any, badge = "") =>
      `<div class="ws-item${badge && badge.includes("wsUnsupported") ? " ws-bad" : ""}"><span>${esc(x.statement)}${badge}</span><button class="ws-x" data-kind="${kind}" data-id="${x.id}">${L(UI.wsRemove)}</button></div>`;
    const painList = v.painPoints.map((p) => row("painPoint", p)).join("") || `<p class="muted">${L(UI.wsEmpty)}</p>`;
    const findList = v.findings.map((f) => row("finding", f,
      f.unsupported ? ` <em class="ws-warn">${L(UI.wsUnsupported)}</em>` : ` <em class="ws-ok">${f.evidenceRefs.length} ${L(UI.wsEvidence)}</em>`)).join("") || `<p class="muted">${L(UI.wsEmpty)}</p>`;
    const recList = v.recommendations.map((r) => row("recommendation", r,
      r.unsupported ? ` <em class="ws-warn">${L(UI.wsUnsupported)}</em>` : "")).join("") || `<p class="muted">${L(UI.wsEmpty)}</p>`;

    // C2 — interview readouts: one per executive actually interviewed.
    const execIds = Object.keys(state.personas).filter((id) => state.personas[id].used > 0 && PERSONA_MAP[id] && (PERSONA_MAP as any)[id].tier !== "mid");
    const roMap: Record<string, any> = Object.fromEntries((state.workspace.interviews || []).map((r) => [r.personaId, r]));
    const readoutList = execIds.length ? execIds.map((id) => {
      const ro = roMap[id];
      return `<div class="ws-ro"><b>${esc(L((PERSONA_MAP as any)[id].shortTitle))}</b> ${ro ? `<em class="ws-ok">${fmt(UI.wsReadoutScore, { n: ro.score })}</em>` : ""}
        <textarea id="ws-ro-${id}" class="ws-ta" placeholder="${L(UI.wsReadoutPh)}">${esc(ro?.playerSummary || "")}</textarea>
        <button class="ws-add ws-ro-save" data-id="${id}">${L(UI.wsReadoutSave)}</button>${ro ? `<p class="ws-ro-fb">${esc(ro.feedback)}</p>` : ""}</div>`;
    }).join("") : `<p class="muted">${L(UI.wsNoInterviews)}</p>`;

    const p = openPanel(`<h2>${L(UI.wsTitle)}</h2>
      <p class="muted">${L(UI.wsIntro)}</p>
      <p class="ws-counts">${fmt(UI.wsCounts, { packs: v.counts.packs, pains: v.counts.painPoints, finds: v.counts.findings, recs: v.counts.recommendations, bad: v.counts.unsupported })} · <a id="ws-skills" class="ws-link">${L(UI.wsSkillsBtn)}</a></p>
      ${warns}
      <div class="ws-sec"><h3>${L(UI.wsReadouts)}</h3><p class="muted">${L(UI.wsReadoutHint)}</p>${readoutList}</div>
      <div class="ws-sec"><h3>${L(UI.wsPacks)}</h3><div class="ws-packs">${packCards}</div></div>
      <div class="ws-sec"><h3>${L(UI.wsPains)}</h3>${painList}
        <textarea id="ws-pain-t" class="ws-ta" placeholder="${L(UI.wsPainPh)}"></textarea>
        <div class="ws-chk-label">${L(UI.wsPickEvidencePack)}</div><div class="ws-chks" id="ws-pain-packs">${packChips}</div>
        <button class="ws-add" id="ws-add-pain">${L(UI.wsAdd)}</button></div>
      <div class="ws-sec"><h3>${L(UI.wsFindings)}</h3>${findList}
        <textarea id="ws-find-t" class="ws-ta" placeholder="${L(UI.wsFindingPh)}"></textarea>
        <div class="ws-chk-label">${L(UI.wsPickEvidencePack)}</div><div class="ws-chks" id="ws-find-packs">${packChips}</div>
        <div class="ws-chk-label">${L(UI.wsPickEvidencePain)}</div><div class="ws-chks" id="ws-find-pains">${painChips}</div>
        <button class="ws-add" id="ws-add-find">${L(UI.wsAdd)}</button></div>
      <div class="ws-sec"><h3>${L(UI.wsRecs)}</h3>${recList}
        <textarea id="ws-rec-t" class="ws-ta" placeholder="${L(UI.wsRecPh)}"></textarea>
        <div class="ws-chk-label">${L(UI.wsPickFindings)}</div><div class="ws-chks" id="ws-rec-finds">${findChips}</div>
        <button class="ws-add" id="ws-add-rec">${L(UI.wsAdd)}</button></div>
      <div class="row"><button id="pclose">${L(UI.close)}</button></div>`);

    const checked = (sel: string) => Array.from(p.querySelectorAll<HTMLInputElement>(`${sel} input:checked`)).map((c) => c.value);
    const val = (id: string) => (p.querySelector(id) as HTMLTextAreaElement).value.trim();
    p.querySelectorAll<HTMLElement>(".ws-x").forEach((b) => {
      b.onclick = async () => { await api.workspaceRemove(b.dataset.kind!, b.dataset.id!); render(); };
    });
    (p.querySelector("#ws-add-pain") as HTMLButtonElement).onclick = async () => {
      const t = val("#ws-pain-t"); if (!t) return toast(L(UI.writeSomething));
      await api.workspaceAdd("painPoint", { statement: t, refs: checked("#ws-pain-packs") }); render();
    };
    (p.querySelector("#ws-add-find") as HTMLButtonElement).onclick = async () => {
      const t = val("#ws-find-t"); if (!t) return toast(L(UI.writeSomething));
      const refs = [...checked("#ws-find-packs"), ...checked("#ws-find-pains")];
      if (!refs.length) return toast(L(UI.wsNeedEvidence));
      await api.workspaceAdd("finding", { statement: t, refs }); render();
    };
    (p.querySelector("#ws-add-rec") as HTMLButtonElement).onclick = async () => {
      const t = val("#ws-rec-t"); if (!t) return toast(L(UI.writeSomething));
      const refs = checked("#ws-rec-finds");
      if (!refs.length) return toast(L(UI.wsNeedFinding));
      await api.workspaceAdd("recommendation", { statement: t, refs }); render();
    };
    (p.querySelector("#ws-skills") as HTMLElement).onclick = () => competenciesPanel();
    p.querySelectorAll<HTMLElement>(".ws-ro-save").forEach((b) => {
      b.onclick = async () => {
        const id = b.dataset.id!;
        const t = (p.querySelector(`#ws-ro-${id}`) as HTMLTextAreaElement).value.trim();
        if (!t) return toast(L(UI.writeSomething));
        try {
          const r: any = await api.workspaceSummary(id, t);
          toast(fmt(UI.wsReadoutScore, { n: r.score }));
          render();
        } catch (e: any) { toast(e.message); }
      };
    });
    (p.querySelector("#pclose") as HTMLButtonElement).onclick = () => closePanel();
  };
  render();
}

function esc(s: string) {
  return (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
