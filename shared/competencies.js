/**
 * TARGET CAPABILITY MODEL (v2 Part A) — the eight consulting competencies the
 * game is designed backward from (Alice pt 16: define the outcome first, design
 * mechanics around it). Surfaced in-game as an explicit "skills you're building"
 * reference so the educational value of each activity is legible (Alice pt 3).
 *
 * `alice: true` marks the five capabilities Alice named explicitly.
 */
export const COMPETENCIES = [
  {
    id: "C1", alice: true,
    skill: { en: "Ask effective questions", zh: "提出有效的问题" },
    exercisedBy: { en: "Live interviews with gatekeepers, deputies and the C-suite — personas reward sharp, role-relevant questions and visibly cool on lazy ones.", zh: "与把关人、副手和高管的现场访谈——干系人会奖励犀利、切题的问题，对敷衍的问题明显变冷淡。" },
    evidence: { en: "Persona warmth/mood and the question-quality classifier; surfacing the deliberately-hidden blind-spot facts.", zh: "干系人的热度/情绪与问题质量分类器；挖出被刻意隐藏的盲点事实。" },
  },
  {
    id: "C2", alice: true,
    skill: { en: "Summarize information", zh: "提炼与总结信息" },
    exercisedBy: { en: "Writing your own readout of each interview in the binder — graded against the actual transcript for accuracy and concision.", zh: "在工作簿里为每次访谈亲手写下你的纪要——按真实对话记录评估其准确性与精炼度。" },
    evidence: { en: "Player-authored interview readouts scored; the exit quiz tests what mattered, not trivia.", zh: "玩家撰写的访谈纪要得分；离场测验考的是关键要点，而非琐碎细节。" },
  },
  {
    id: "C3", alice: true,
    skill: { en: "Synthesize findings", zh: "综合形成洞见" },
    exercisedBy: { en: "In the binder: turning evidence (data packs + interviews) into findings, and reconciling conflicting stakeholder inputs.", zh: "在工作簿里：把证据（数据包+访谈）转化为发现，并调和相互矛盾的干系人输入。" },
    evidence: { en: "Every finding cites ≥1 piece of evidence; conflicting packs reconciled in a single finding.", zh: "每条发现引用至少一项证据；相互冲突的数据包在同一条发现中被调和。" },
  },
  {
    id: "C4", alice: false,
    skill: { en: "Structured problem-solving", zh: "结构化解决问题" },
    exercisedBy: { en: "Framing the mandate before interviewing and keeping the analysis MECE across domains.", zh: "在访谈前拆解任务，并让分析在各领域保持相互独立、完全穷尽（MECE）。" },
    evidence: { en: "Mobilization sign-off with Manager Lin; a diagnosis organized by domain, not a data dump.", zh: "与林经理的启动确认；按领域组织的诊断，而非资料堆砌。" },
  },
  {
    id: "C5", alice: false,
    skill: { en: "Analytical rigor & benchmarking", zh: "分析严谨性与对标" },
    exercisedBy: { en: "Building a Nike-vs-peer comparison from the data packs; the CFO's disclosure-limit traps are live.", zh: "用数据包构建耐克对同业的对比；CFO的披露边界陷阱是真实存在的。" },
    evidence: { en: "Comparable metrics only, no fabricated figures; the benchmark alignment gate passes.", zh: "只用可比指标、不编造数字；通过对标对齐关卡。" },
  },
  {
    id: "C6", alice: false,
    skill: { en: "Evidence-based recommendation", zh: "基于证据的建议" },
    exercisedBy: { en: "Deriving recommendations that each trace back to a finding — unsupported leaps are flagged.", zh: "推导每条都能追溯到某个发现的建议——缺乏支撑的跳跃会被标记。" },
    evidence: { en: "Recommendation → finding → evidence chain intact; no orphan recommendations.", zh: "建议→发现→证据链完整；没有无依据的建议。" },
  },
  {
    id: "C7", alice: false,
    skill: { en: "Stakeholder alignment", zh: "干系人对齐" },
    exercisedBy: { en: "The two alignment meetings and the interim readout — present back, absorb pushback, revise.", zh: "两次对齐会与中期汇报——汇报、吸收反驳、修改。" },
    evidence: { en: "Revised your work after client challenge; alignment gates are hard gates.", zh: "在客户挑战后修改了工作；对齐关卡是硬性关卡。" },
  },
  {
    id: "C8", alice: true,
    skill: { en: "Communication & defensibility", zh: "沟通与经得起质询" },
    exercisedBy: { en: "The intermediate deliverables (midterm-style), the final deck, and the defense stage where execs challenge your pitch.", zh: "阶段性交付物（期中式）、最终方案，以及高管质询你汇报的答辩环节。" },
    evidence: { en: "Deck rubric score plus live defense answers under challenge.", zh: "方案评分，加上在质询下的现场答辩表现。" },
  },
];

export const ALICE_SKILL_COUNT = COMPETENCIES.filter((c) => c.alice).length;
