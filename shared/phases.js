/**
 * ENGAGEMENT LIFECYCLE — the consulting methodology backbone (v2).
 *
 * This is the single source of truth for the four-phase engagement spine that
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
    gate: { en: "Manager Lin checks it against four things she told you up front: at least 3 distinct pain points in different domains, every claim traceable to your transcripts or the project files, a clear order of priority, and no solutions yet. Anything short comes back with her corrected wording, and you resubmit.", zh: "林经理会按她事先讲明的四条标准检查：至少3个分布在不同领域的痛点、每条主张都能追溯到你的访谈记录或项目文件、明确的优先级排序、且暂不涉及解决方案。不达标的部分会附上她改好的措辞退回，你需要改完再交。" },
    guidance: {
      en: "Work all seven domain tracks on F10 — passing each manager's check clears that domain, but no Nike executive opens their door until every one of the seven is behind you. Once they are, Manager Lin debriefs you and the whole F15 C-suite opens at once; that's where the real evidence is. Interview them, then write up your as-is diagnosis in your own document. Lin's four requirements: (1) at least 3 distinct pain points, in different domains — one finding is an observation, not a diagnosis; (2) every claim traceable to something you were actually told or to the project files; (3) a clear order of priority, not an undifferentiated list; (4) no solutions yet — what is broken and how you know, nothing more. Take it to Manager Lin and upload it. She checks every claim against your interview transcripts and the project files, and hands back the ones that aren't supported — with her own corrected wording — plus what to do next. Fix those and resubmit until nothing is left standing on air.",
      zh: "先在10层推进全部七条领域线——通过每位经理的考核只会清掉那一条线，耐克高管的门不会开，直到七条线全部通过。全部通过后，林经理会给你复盘，15层的高管会一次性全部开放——真正的证据在他们那里。访谈他们，然后用你自己的文档写出现状诊断。林经理的四条要求：（1）至少3个痛点，且分布在不同领域——单一发现只是观察，还谈不上诊断；（2）每条主张都能追溯到你实际听到的内容或项目文件；（3）有明确的优先级排序，不能是一份不分轻重的清单；（4）暂不谈解决方案——只说清楚哪里出了问题、你怎么知道的。交给林经理上传。她会拿你的每一条主张去比对访谈记录与项目文件，把站不住的挑出来还给你——附上她改好的措辞，以及下一步该怎么做。改完再交，直到没有一条是凭空而来的。",
    },
  },
  {
    id: "tobe",
    order: 2,
    name: { en: "To-Be Design", zh: "未来蓝图设计" },
    short: { en: "Design", zh: "设计" },
    deliverable: { en: "Draft 5-year strategy — uploaded or typed, reviewed by the whole Deloitte team", zh: "五年战略草案——上传或直接输入，由德勤项目组集体评审" },
    gate: { en: "Design Review — all seven Deloitte managers read your draft together and each returns advice from their own workstream. ONE attempt: it is a review, not a resubmission loop.", zh: "设计评审——七位德勤经理集体审阅你的草案，各自从自己的工作流给出建议。仅有一次机会：这是评审，不是反复提交。" },
    guidance: {
      en: "Draft your 5-year strategy in your own document: recommendations tied to the pain points you evidenced, each with an owner, sequencing and the trade-offs you accept. BENCHMARKING BELONGS HERE — a recommendation is only as good as the comparison behind it, so position Nike against named competitors (Anta, Li-Ning, Adidas, Xtep, 361°) using disclosed, like-for-like metrics. For Nike Greater China that means EBIT margin and revenue growth; Greater China net profit, inventory, ROE and ROIC are NOT disclosed, so quoting them will be challenged. Then bring the draft to the Deloitte team — all seven managers review it together, each judging the part that belongs to their workstream and telling you what to implement, what to change and what to strengthen. You get ONE pass at this, so submit when the draft is genuinely ready.",
      zh: "用你自己的文档起草五年战略：每条建议都要对应你已取证的痛点，并写明责任人、推进节奏和你接受的取舍。【对标属于这个阶段】——一条建议的价值取决于它背后的比较，所以要用已披露、可比口径的指标把耐克与具名对手（安踏、李宁、阿迪达斯、特步、361°）放在一起看。对大中华区而言即 EBIT 利润率与收入增速；大中华区净利润、库存、ROE、ROIC 并未披露，引用会被当场质疑。然后把草案带给德勤项目组——七位经理会集体评审，各自就自己工作流内的部分告诉你该落实什么、该改什么、还能怎么加强。这个环节只有一次机会，草案真正就绪了再交。",
    },
  },
  {
    id: "pitch",
    order: 3,
    name: { en: "Final Pitch", zh: "最终汇报" },
    short: { en: "Present", zh: "汇报" },
    deliverable: { en: "A 10-slide PowerPoint (.pptx) of your 5-year strategy, presented to the full C-suite — then your closing debrief with Manager Lin", zh: "一份10页的PowerPoint（.pptx）五年战略方案，向全体高管汇报——之后与林经理复盘收尾" },
    gate: { en: "Final Presentation — all seven Nike executives read the deck together and each grades it against their own criteria. ONE attempt. The file must be a .pptx of EXACTLY 10 slides; anything else is refused at the door. Then Manager Lin's debrief closes the engagement.", zh: "最终汇报——七位耐克高管集体审阅方案，各自按自己的评分标准打分。仅有一次机会。文件必须是【恰好10页】的 .pptx，不符合要求会被当场退回。最后由林经理复盘收尾。" },
    guidance: {
      en: "The boardroom (F16) opens once all seven executives have been interviewed and the Deloitte team has reviewed your design. Build your 5-year strategy as a PowerPoint deck — it must be a .pptx file and it must be EXACTLY 10 slides; a PDF, a Word file, or a deck of 9 or 11 slides is rejected before anyone reads it. Then present to the full C-suite in one sitting. Each executive grades it through their own lens: the CEO wants one clear thesis with explicit trade-offs, the CFO a margin-recovery path, the CMO favourability, the COO executability, the CHRO owners and capability, the CTO platform-native digital, the CPO real product relevance. You get ONE attempt, so submit the deck you actually want judged. When the board rises, go back to Manager Lin on F12 for your debrief — that is what closes the engagement.",
      zh: "七位高管全部访谈完、且德勤项目组已评审过你的设计之后，16层董事会会议室才会开放。把五年战略做成 PowerPoint：必须是 .pptx 文件，且必须【恰好10页】——PDF、Word，或者9页、11页的方案，都会在有人翻开之前被退回。然后一次性向全体高管汇报。每位高管都会用自己的视角评分：CEO 要一个清晰主线和明确取舍，CFO 要利润率修复路径，CMO 看好感度，COO 看可执行性，CHRO 看责任人与能力建设，CTO 看数字化原生程度，CPO 看产品的真实相关性。只有一次机会，所以交你真正想被评判的那一版。散会后，回12层找林经理复盘——项目由此才算收尾。",
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

/**
 * How many distinct pain points the as-is diagnostic must carry before Manager
 * Lin signs it off.
 *
 * Grounding alone left a hole: one immaculately evidenced observation passed
 * the claim-by-claim check with nothing to prioritise against, and a single
 * finding is an observation, not a diagnosis. Three is the lowest number at
 * which "which of these matters most" is a real question, and it forces the
 * learner to actually use the seven domain interviews they sat through. Told
 * to the learner up front in Lin's briefing (`linBriefDiagnose` in
 * src/i18n.ts), so failing it is never a surprise.
 */
export const ASIS_MIN_PAIN_POINTS = 3;

/** Fresh engagement state for a new session. */
export function newEngagement() {
  return {
    phase: "mobilize", // the phase currently in progress
    completed: Object.fromEntries(PHASE_IDS.map((id) => [id, false])),
    alignments: {
      asis: { agreed: false, attempts: 0, lastFeedback: null },
    },
    // Design Review — the seven Deloitte managers read the draft together.
    // ONE attempt by design, so `done` is set the moment it is submitted,
    // whatever the managers think of it; their advice is the deliverable, not
    // a pass mark. `reviews` is [{ trackId, name, advice }].
    designReview: { done: false, submittedAt: null, reviews: [], summary: null },
  };
}

/**
 * Bring an engagement saved under an older shape up to the current one.
 *
 * The 5-phase spine (…asis → benchmark → tobe…) collapsed to 4 when
 * benchmarking became a grading criterion inside Design rather than a phase of
 * its own. A session persisted mid-engagement can therefore be sitting on
 * `phase: "benchmark"`, a phase id that no longer exists — which would strand
 * it, because syncEngagement() derives the active phase from PHASES and would
 * never match. Anyone who had already cleared the old benchmark gate is
 * credited with Design's predecessor rather than being sent backwards.
 */
export function migrateEngagement(e) {
  if (!e) return newEngagement();
  if (!e.alignments) e.alignments = {};
  if (!e.alignments.asis) e.alignments.asis = { agreed: false, attempts: 0, lastFeedback: null };
  if (!e.designReview) e.designReview = { done: false, submittedAt: null, reviews: [], summary: null };
  // The old benchmark alignment is no longer a gate. If it was agreed, treat
  // that work as already reflected in the design draft rather than discarding
  // the player's progress; either way the key stops being consulted.
  delete e.alignments.benchmark;
  if (e.completed) delete e.completed.benchmark;
  if (e.phase === "benchmark") e.phase = "tobe";
  return e;
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
  // Design closes on the Deloitte team having REVIEWED the draft, not on their
  // approving it: the review is a single pass that returns advice, so gating
  // the phase on a verdict would let one harsh reviewer strand the engagement.
  e.completed.tobe = !!e.designReview?.done;
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
