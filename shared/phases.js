/**
 * ENGAGEMENT LIFECYCLE — the consulting methodology backbone (v2).
 *
 * This is the single source of truth for the five-phase engagement spine that
 * Alice's review asked us to make the primary progression (instead of "navigate
 * a building"). The building/floors/people are now *resources consulted within
 * a phase*; this model is the actual ladder the player climbs.
 *
 * Each phase declares the deliverable the player submits and the gate that must
 * pass before the next phase unlocks (the anti-"tower-from-flat-ground" rule).
 * The server (sessionStore + routes) is authoritative for phase state; the
 * client renders the Engagement Tracker from it.
 *
 * See docs/DESIGN-consulting-methodology-v2.md Part B.
 */

export const PHASES = [
  {
    id: "mobilize",
    order: 0,
    name: { en: "Mobilization", zh: "项目启动" },
    short: { en: "Mobilize", zh: "启动" },
    deliverable: { en: "Work plan + issue tree", zh: "工作计划 + 议题树" },
    gate: { en: "Manager Lin approves how you've framed the problem.", zh: "林经理认可你对问题的拆解方式。" },
  },
  {
    id: "asis",
    order: 1,
    name: { en: "As-Is Study", zh: "现状诊断" },
    short: { en: "As-Is", zh: "现状" },
    deliverable: { en: "As-is diagnostic (pain points + evidence)", zh: "现状诊断（痛点 + 证据）" },
    gate: { en: "As-Is Alignment Meeting — the client confirms your diagnosis.", zh: "现状对齐会 — 客户确认你的诊断。" },
  },
  {
    id: "benchmark",
    order: 2,
    name: { en: "Benchmarking", zh: "对标分析" },
    short: { en: "Benchmark", zh: "对标" },
    deliverable: { en: "Benchmark conclusion + recommended direction", zh: "对标结论 + 建议方向" },
    gate: { en: "Benchmark Alignment Meeting — the client agrees the priorities.", zh: "对标对齐会 — 客户认可优先事项。" },
  },
  {
    id: "tobe",
    order: 3,
    name: { en: "To-Be Design", zh: "未来蓝图设计" },
    short: { en: "To-Be", zh: "蓝图" },
    deliverable: { en: "Draft 5-year strategy", zh: "五年战略草案" },
    gate: { en: "Interim readout to Manager Lin (midterm-style feedback).", zh: "向林经理做中期汇报（期中式反馈）。" },
  },
  {
    id: "pitch",
    order: 4,
    name: { en: "Final Pitch", zh: "最终汇报" },
    short: { en: "Pitch", zh: "汇报" },
    deliverable: { en: "Board pitch + defense", zh: "董事会汇报 + 答辩" },
    gate: { en: "Terminal assessment — deck score + per-stakeholder checklist.", zh: "终审 — 方案评分 + 各干系人清单。" },
  },
];

export const PHASE_IDS = PHASES.map((p) => p.id);
export const PHASE_MAP = Object.fromEntries(PHASES.map((p) => [p.id, p]));

/** How many executive interviews are required before the As-Is diagnostic can be submitted. */
export const ASIS_MIN_INTERVIEWS = 3;

/** Fresh engagement state for a new session. */
export function newEngagement() {
  return {
    phase: "mobilize", // the phase currently in progress
    completed: Object.fromEntries(PHASE_IDS.map((id) => [id, false])),
    alignments: {
      asis: { agreed: false, attempts: 0, lastFeedback: null },
      benchmark: { agreed: false, attempts: 0, lastFeedback: null },
    },
  };
}

/** Advance the active phase to `phaseId` if it is later than the current one. */
export function setPhase(engagement, phaseId) {
  const target = PHASE_MAP[phaseId];
  const current = PHASE_MAP[engagement.phase];
  if (target && (!current || target.order > current.order)) engagement.phase = phaseId;
}

/**
 * Recompute `completed` + the active `phase` from the session's authoritative
 * signals (flags + alignment agreements + board result). Derived state — safe
 * to call on every read; keeps the Engagement Tracker honest without scattering
 * advance() calls across the routes.
 */
export function syncEngagement(s) {
  const e = s.engagement;
  e.completed.mobilize = !!s.flags?.metSupervisor;
  e.completed.asis = !!e.alignments?.asis?.agreed;
  e.completed.benchmark = !!e.alignments?.benchmark?.agreed;
  e.completed.tobe = !!s.flags?.interimDone;
  e.completed.pitch = !!(s.board?.done && s.board?.result);
  const firstIncomplete = PHASES.find((p) => !e.completed[p.id]);
  e.phase = firstIncomplete ? firstIncomplete.id : "pitch";
  return e;
}
