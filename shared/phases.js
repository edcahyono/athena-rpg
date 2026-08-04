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
    deliverable: { en: "Work plan (written in your notebook)", zh: "工作计划（写在笔记本里）" },
    gate: { en: "Manager Lin approves how you've framed the problem.", zh: "林经理认可你对问题的拆解方式。" },
    guidance: {
      en: "Report to Manager Lin at reception (F12) and take the case brief. Your deliverable is an INDEPENDENT 5-year growth strategy for Nike Greater China — what you conclude after interviewing them, not what the client tells you to write. Lin hands you the notebook (Q), which auto-logs quotes and leads and has a free pad for your own thinking. Write your work plan there — the domains you'll cover, the real question under the brief, and what you'd need to see to answer it. Everything you later submit you write in your own document and bring to Lin as a file. Then open the mission board (M) and pick any domain track; there is no set order.",
      zh: "到12层前台向林经理报到，领取案例简报。你的交付物是一份【独立的】耐克大中华区五年增长战略——是你访谈之后自己的结论，而不是客户让你写的内容。林经理会交给你笔记本（Q）：自动记录引述与线索，并留有空白区域供你写自己的思考。把工作计划写在那里——你要覆盖哪些领域、简报底下真正的问题是什么、以及你需要看到什么才能回答它。之后所有要提交的东西，都由你用自己的文档撰写，并以文件形式交给林经理。然后按 M 打开任务板，任选一条领域线，顺序不限。",
    },
  },
  {
    id: "asis",
    order: 1,
    name: { en: "As-Is Study", zh: "现状诊断" },
    short: { en: "Diagnose", zh: "诊断" },
    deliverable: { en: "As-is diagnostic — your own document, handed to Manager Lin", zh: "现状诊断——你自己写的文档，交给林经理" },
    gate: { en: "Manager Lin reads it claim by claim against your interview transcripts and the project files. Anything unsupported comes back with her corrected wording, and you resubmit.", zh: "林经理会逐条拿它比对你的访谈记录与项目文件。凡是没有依据的，都会附上她改好的措辞退回，你需要改完再交。" },
    guidance: {
      en: "Work all seven domain tracks on F10 — passing each manager's check clears that domain, but no Nike executive opens their door until every one of the seven is behind you. Once they are, Manager Lin debriefs you and the whole F15 C-suite opens at once; that's where the real evidence is. Interview them, then write up your as-is diagnosis in your own document: the pain points, the findings, and what each one rests on. Take it to Manager Lin and upload it. She checks every claim against your interview transcripts and the project files, and hands back the ones that aren't supported — with her own corrected wording. Fix those and resubmit until nothing is left standing on air.",
      zh: "先在10层推进全部七条领域线——通过每位经理的考核只会清掉那一条线，耐克高管的门不会开，直到七条线全部通过。全部通过后，林经理会给你复盘，15层的高管会一次性全部开放——真正的证据在他们那里。访谈他们，然后用你自己的文档写出现状诊断：痛点、发现，以及每一条的依据。交给林经理上传。她会拿你的每一条主张去比对访谈记录与项目文件，把站不住的挑出来还给你——并附上她改好的措辞。改完再交，直到没有一条是凭空而来的。",
    },
  },
  {
    id: "benchmark",
    order: 2,
    name: { en: "Benchmarking", zh: "对标分析" },
    short: { en: "Benchmark", zh: "对标" },
    deliverable: { en: "Benchmark conclusion + prioritised direction", zh: "对标结论 + 有优先级的方向" },
    gate: { en: "Benchmark Alignment Meeting — Manager Lin convenes it on F12 once you've interviewed all seven executives; the CEO and CFO are the ones judging.", zh: "对标对齐会——七位高管全部访谈完后，由林经理在12层召集；评判的是 CEO 与 CFO。" },
    guidance: {
      en: "Compare Nike China against named competitors (Anta, Li-Ning, Adidas, Xtep, 361°) using only disclosed, like-for-like metrics — for Nike Greater China that means EBIT margin and revenue growth. Greater China net profit, inventory, ROE and ROIC are NOT disclosed, so quoting them will be challenged. Name concrete relative strengths and weaknesses versus specific peers and land a prioritised direction. Take it to Manager Lin on F12 once you've interviewed all seven executives — she convenes the alignment meeting, and the CEO and CFO judge it there. You do not pitch them separately.",
      zh: "用已披露、可比口径的指标把耐克中国与具名对手（安踏、李宁、阿迪达斯、特步、361°）对标——对大中华区而言即 EBIT 利润率与收入增速。大中华区净利润、库存、ROE、ROIC 并未披露，引用会被当场质疑。要针对具体对手指出明确的相对优势与劣势，并给出有优先级的方向。七位高管全部访谈完之后，把它带给12层的林经理——由她召集对齐会，CEO 与 CFO 在会上评判。你不需要单独去找他们汇报。",
    },
  },
  {
    id: "tobe",
    order: 3,
    name: { en: "To-Be Design", zh: "未来蓝图设计" },
    short: { en: "Design", zh: "设计" },
    deliverable: { en: "Draft 5-year strategy", zh: "五年战略草案" },
    gate: { en: "Interim readout to Manager Lin — the boardroom will not convene until she has heard it.", zh: "向林经理做中期汇报——她没听过，董事会就不会召开。" },
    guidance: {
      en: "Draft your 5-year strategy in your own document: recommendations tied to the pain points you evidenced, each with an owner, sequencing and the trade-offs you accept. Then give Manager Lin an interim readout. She passes you if you state a point of view — what you actually believe, not just a summary of facts — tie it to something you genuinely heard, and name what you still need to test.",
      zh: "用你自己的文档起草五年战略：每条建议都要对应你已取证的痛点，并写明责任人、推进节奏和你接受的取舍。然后向林经理做中期汇报。她的通过标准是：你提出了明确观点（你真正相信什么，而不只是复述事实）、观点能追溯到你实际听到的内容，并说明还需要验证什么。",
    },
  },
  {
    id: "pitch",
    order: 4,
    name: { en: "Final Pitch", zh: "最终汇报" },
    short: { en: "Present", zh: "汇报" },
    deliverable: { en: "Board pitch + defence, then your closing debrief with Manager Lin", zh: "董事会汇报 + 答辩，之后与林经理复盘收尾" },
    gate: { en: "Terminal assessment — deck score + per-stakeholder checklist — and then Manager Lin's debrief. The engagement is not finished until you report back to her.", zh: "终审——方案评分 + 各干系人清单——最后是林经理的复盘。没有回去向她汇报，项目就不算结束。" },
    guidance: {
      en: "Two things unlock the boardroom (F16): all seven executives interviewed at least once, and your interim readout already given to Manager Lin. Then take your place at the table. Each executive judges your deck through their own lens: the CEO wants one clear thesis with explicit trade-offs, the CFO a margin-recovery path, the CMO favourability, the COO executability, the CHRO owners and capability, the CTO platform-native digital, the CPO real product relevance. You then defend it under their challenge questions. Final score = 60% deck + 40% defence. When the board rises, go back to Manager Lin on F12 for your debrief — that is what closes the engagement.",
      zh: "解锁16层董事会会议室需要两件事：七位高管都至少访谈过一次，并且已经向林经理做过中期汇报。然后到桌前就座。每位高管都会用自己的视角评判你的方案：CEO 要一个清晰主线和明确取舍，CFO 要利润率修复路径，CMO 看好感度，COO 看可执行性，CHRO 看责任人与能力建设，CTO 看数字化原生程度，CPO 看产品的真实相关性。随后你要在他们的追问下答辩。最终得分 = 方案 60% + 答辩 40%。散会后，回12层找林经理复盘——项目由此才算收尾。",
    },
  },
];

export const PHASE_IDS = PHASES.map((p) => p.id);
export const PHASE_MAP = Object.fromEntries(PHASES.map((p) => [p.id, p]));

/**
 * How many executive interviews are required before the As-Is diagnostic can be
 * submitted.
 *
 * Zero by design decision: the gate is now the QUALITY of the diagnosis, not a
 * headcount of meetings. Every claim is checked against the transcripts and the
 * project files, so a learner who skipped the executives has nothing to ground
 * their document in and fails on the evidence — the same lesson the quota
 * taught, delivered where it actually bites. Kept rather than deleted so
 * raising the bar again is a one-line change.
 */
export const ASIS_MIN_INTERVIEWS = 0;

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
  // The board is not the last step. Every other phase in this spine closes by
  // reporting back to Manager Lin, and the engagement closes the same way — she
  // delivers the terminal assessment. Marking pitch complete on the board alone
  // let the tracker show a finished engagement while the debrief was still owed,
  // which taught exactly the wrong habit: present and walk away.
  e.completed.pitch = !!(s.board?.done && s.board?.result && s.flags?.debriefDone);
  const firstIncomplete = PHASES.find((p) => !e.completed[p.id]);
  e.phase = firstIncomplete ? firstIncomplete.id : "pitch";
  return e;
}
