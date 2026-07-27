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
    short: { en: "Scope", zh: "立项" },
    deliverable: { en: "Work plan + issue tree", zh: "工作计划 + 议题树" },
    gate: { en: "Manager Lin approves how you've framed the problem.", zh: "林经理认可你对问题的拆解方式。" },
    guidance: {
      en: "Report to Manager Lin at reception (F12) and take the case brief. Your deliverable is an INDEPENDENT 5-year growth strategy for Nike Greater China — what you conclude after interviewing them, not what the client tells you to write. Then open the mission board (M) and pick any domain track; there is no set order.",
      zh: "到12层前台向林经理报到，领取案例简报。你的交付物是一份【独立的】耐克大中华区五年增长战略——是你访谈之后自己的结论，而不是客户让你写的内容。然后按 M 打开任务板，任选一条领域线，顺序不限。",
    },
  },
  {
    id: "asis",
    order: 1,
    name: { en: "As-Is Study", zh: "现状诊断" },
    short: { en: "Diagnose", zh: "诊断" },
    deliverable: { en: "As-is diagnostic (pain points + evidence)", zh: "现状诊断（痛点 + 证据）" },
    gate: { en: "As-Is Alignment Meeting — the client confirms your diagnosis.", zh: "现状对齐会 — 客户确认你的诊断。" },
    guidance: {
      en: "Interview at least 3 Nike executives on F15 — unlock each one by passing their Deloitte manager's check on F10. Log the pain points, findings and supporting quotes in your binder (B). Then report back to Manager Lin. The client panel agrees only if your diagnosis (a) is grounded in what their executives actually said, (b) names specific, real pain points rather than platitudes, and (c) shows prioritisation instead of an undifferentiated list.",
      zh: "在15层至少访谈3位耐克高管——每位都需先通过其在10层对口德勤经理的考核才能解锁。把痛点、发现和支撑引述记入工作底稿（B）。然后回去向林经理汇报。客户方只有在你的诊断满足以下三点时才会认可：(a) 有高管原话作依据，(b) 指出具体真实的痛点而非套话，(c) 体现出优先级排序，而不是罗列一堆。",
    },
  },
  {
    id: "benchmark",
    order: 2,
    name: { en: "Benchmarking", zh: "对标分析" },
    short: { en: "Benchmark", zh: "对标" },
    deliverable: { en: "Benchmark conclusion + recommended direction", zh: "对标结论 + 建议方向" },
    gate: { en: "Benchmark Alignment Meeting — the client agrees the priorities.", zh: "对标对齐会 — 客户认可优先事项。" },
    guidance: {
      en: "Compare Nike China against named competitors (Anta, Li-Ning, Adidas, Xtep, 361°) using only disclosed, like-for-like metrics — for Nike Greater China that means EBIT margin and revenue growth. Greater China net profit, inventory, ROE and ROIC are NOT disclosed, so quoting them will be challenged. Name concrete relative strengths and weaknesses versus specific peers and land a prioritised direction. The CEO and CFO must both agree before you may design.",
      zh: "用已披露、可比口径的指标把耐克中国与具名对手（安踏、李宁、阿迪达斯、特步、361°）对标——对大中华区而言即 EBIT 利润率与收入增速。大中华区净利润、库存、ROE、ROIC 并未披露，引用会被当场质疑。要针对具体对手指出明确的相对优势与劣势，并给出有优先级的方向。CEO 与 CFO 都认可后，才能进入设计阶段。",
    },
  },
  {
    id: "tobe",
    order: 3,
    name: { en: "To-Be Design", zh: "未来蓝图设计" },
    short: { en: "Design", zh: "设计" },
    deliverable: { en: "Draft 5-year strategy", zh: "五年战略草案" },
    gate: { en: "Interim readout to Manager Lin (midterm-style feedback).", zh: "向林经理做中期汇报（期中式反馈）。" },
    guidance: {
      en: "Draft your 5-year strategy in the binder (B): recommendations tied to the pain points you evidenced, each with an owner, sequencing and the trade-offs you accept. Then give Manager Lin an interim readout. She passes you if you state a point of view — what you actually believe, not just a summary of facts — tie it to something you genuinely heard, and name what you still need to test.",
      zh: "在工作底稿（B）中起草五年战略：每条建议都要对应你已取证的痛点，并写明责任人、推进节奏和你接受的取舍。然后向林经理做中期汇报。她的通过标准是：你提出了明确观点（你真正相信什么，而不只是复述事实）、观点能追溯到你实际听到的内容，并说明还需要验证什么。",
    },
  },
  {
    id: "pitch",
    order: 4,
    name: { en: "Final Pitch", zh: "最终汇报" },
    short: { en: "Present", zh: "汇报" },
    deliverable: { en: "Board pitch + defense", zh: "董事会汇报 + 答辩" },
    gate: { en: "Terminal assessment — deck score + per-stakeholder checklist.", zh: "终审 — 方案评分 + 各干系人清单。" },
    guidance: {
      en: "Interview all seven executives at least once — that unlocks the boardroom (F16) — then take your place at the table. Each executive judges your deck through their own lens: the CEO wants one clear thesis with explicit trade-offs, the CFO a margin-recovery path, the CMO favourability, the COO executability, the CHRO owners and capability, the CTO platform-native digital, the CPO real product relevance. You then defend it under their challenge questions. Final score = 60% deck + 40% defence.",
      zh: "把七位高管都至少访谈一次，即可解锁16层董事会会议室，然后到桌前就座。每位高管都会用自己的视角评判你的方案：CEO 要一个清晰主线和明确取舍，CFO 要利润率修复路径，CMO 看好感度，COO 看可执行性，CHRO 看责任人与能力建设，CTO 看数字化原生程度，CPO 看产品的真实相关性。随后你要在他们的追问下答辩。最终得分 = 方案 60% + 答辩 40%。",
    },
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
