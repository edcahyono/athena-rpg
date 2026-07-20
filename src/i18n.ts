/**
 * i18n — the whole game runs fully in English or fully in Chinese.
 * Language is chosen on the start screen (and can be switched in the menu;
 * switching reloads so Phaser-rendered labels re-render too).
 */
export type Lang = "en" | "zh";
export type BL = { en: string; zh: string } | string;

export let lang: Lang = (localStorage.getItem("athena-lang") as Lang) || "en";
export const hasChosenLang = () => !!localStorage.getItem("athena-lang");

export function setLang(l: Lang) {
  lang = l;
  localStorage.setItem("athena-lang", l);
}

/** Resolve a bilingual value in the current language. */
export const L = (v: BL): string => (typeof v === "string" ? v : v[lang] || v.en);

export const UI = {
  // HUD
  credibility: { en: "Credibility", zh: "信誉值" },
  hudHint: { en: "Arrows/WASD · E talk · Q notebook", zh: "方向键/WASD · E对话 · Q笔记" },
  menuBtn: { en: "⏸", zh: "⏸" },
  menuBtnTitle: { en: "Pause / Menu (M)", zh: "暂停 / 菜单 (M)" },
  execsUnlocked: { en: "executives unlocked", zh: "位高管已解锁" },
  interviewed: { en: "interviewed", zh: "已访谈" },
  // main menu / pause
  mmContinue: { en: "▶ Continue", zh: "▶ 继续游戏" },
  mmStart: { en: "▶ Start", zh: "▶ 开始游戏" },
  mmSub: { en: "Wisdom Wields Victory", zh: "智慧制胜" },
  quitToMenu: { en: "Quit to menu", zh: "退出到主菜单" },
  restartEngagement: { en: "↺ Restart engagement", zh: "↺ 重新开始项目" },
  restartTitle: { en: "Restart engagement?", zh: "重新开始项目？" },
  restartMsg: { en: "This wipes ALL progress — credibility, checks, interviews, notebook, the board pitch, AND your character — and starts over from the very beginning, including the character creator. Only your language setting is kept. This cannot be undone.", zh: "这将清除【所有】进度——信誉值、考核、访谈、笔记本、董事会汇报以及你的角色——并从最开始重新来过（包括角色创建）。只保留语言设置。此操作无法撤销。" },
  restartConfirm: { en: "Yes, wipe it and restart", zh: "确认清除并重新开始" },
  cancel: { en: "Cancel", zh: "取消" },
  engagementStatus: { en: "Engagement status", zh: "项目进度" },
  execProgress: { en: "Executives: {u}/7 unlocked · {i}/7 interviewed", zh: "高管：{u}/7 已解锁 · {i}/7 已访谈" },
  // objective
  pickMission: { en: "Choose a mission — open the menu (M)", zh: "选择一个任务 — 打开菜单 (M)" },
  pickMissionWhy: { en: "There's no set order: pick any domain track, pass its Deloitte manager, and that unlocks the matching Nike executive.", zh: "没有固定顺序：任选一条领域线，通过德勤经理的考核，即可解锁对应的耐克高管。" },
  reportToLin: { en: "Report to Manager Lin (F12, Reception)", zh: "向林经理报到（12层·前台）" },
  reportToLinWhy: { en: "She has your case brief — nothing starts without it.", zh: "案件简报在她那里——不报到什么都开始不了。" },
  debriefLin: { en: "Debrief with Manager Lin (F12)", zh: "找林经理复盘（12层）" },
  debriefLinWhy: { en: "Every engagement ends with a debrief — hear how you did.", zh: "每个项目都以复盘收尾——听听你的表现。" },
  engagementDone: { en: "Engagement complete!", zh: "项目完成！" },
  engagementDoneWhy: { en: "Export your notebook (Q) and write your 5-year strategy — that's the real deliverable.", zh: "导出笔记（Q），去写你的五年战略——那才是真正的交付物。" },
  seeGatekeeper: { en: "See {name} (F{floor})", zh: "去见 {name}（{floor}层）" },
  gatekeeperWhy: { en: "Ask {name} about the {track} domain — leave when ready and they'll quiz you on your conversation. Pass and {exec} takes your meeting.", zh: "向 {name} 请教{track}领域的问题——准备好后离开，TA会就你们的对话考核你。通过后 {exec} 才会见你。" },
  interviewExec: { en: "Interview {name} (F15)", zh: "访谈 {name}（15层）" },
  interviewExecWhy: { en: "Meetings are timed and limited — prep your questions first.", zh: "会面限时限次——先准备好问题再敲门。" },
  boardObjective: { en: "Make your final pitch in the Boardroom (F16)", zh: "去董事会会议室做最终汇报（16层）" },
  boardObjectiveWhy: { en: "All seven executives interviewed. Walk in with a clear strategy — they will push back.", zh: "七位高管都已访谈。带着清晰的战略进场——他们会挑战你。" },
  // elevator
  elevator: { en: "🛗 Elevator", zh: "🛗 电梯" },
  elevatorHint: { en: "The boardroom opens once all seven executives are interviewed.", zh: "访谈完七位高管后，董事会会议室才会开放。" },
  stayHere: { en: "Stay here", zh: "留在本层" },
  lockedBoard: { en: "Locked — interview all 7 executives first ({n}/7 done).", zh: "未解锁——请先访谈全部7位高管（已完成{n}/7）。" },
  floorToast: { en: "🛗 Floor {n}", zh: "🛗 {n}层" },
  // panels
  notebook: { en: "📓 Notebook / Quest Log", zh: "📓 笔记本 / 任务日志" },
  notebookHint: { en: "Auto-collected facts, quotes and tasks. Your own notes:", zh: "自动收集的事实、语录与任务。你的笔记：" },
  exportTxt: { en: "⬇ Export as text", zh: "⬇ 导出为文本" },
  close: { en: "Close", zh: "关闭" },
  nothingYet: { en: "Nothing yet. Go talk to people.", zh: "还没有内容。去和人聊聊吧。" },
  submitAnswer: { en: "Submit answer", zh: "提交答案" },
  notYet: { en: "Not yet", zh: "再想想" },
  writeSomething: { en: "Write something first.", zh: "先写点内容吧。" },
  writeAnswerPh: { en: "Write your answer…", zh: "写下你的答案……" },
  // prep
  prepTitle: { en: "🗒 Prep — {t}", zh: "🗒 会前准备 — {t}" },
  prepNote: { en: "Queue and organize your questions below — the clock only starts when you begin. Notes are saved to your notebook.", zh: "在下方整理你要问的问题——计时在开始后才启动。笔记会自动保存。" },
  prepStart: { en: "▶ Start the meeting (clock starts!)", zh: "▶ 开始会面（开始计时！）" },
  prepBack: { en: "Back away quietly", zh: "悄悄退下" },
  meetingsLeft: { en: "Meetings remaining: {a}/{b} · each lasts {m} minutes. Starting one CONSUMES it — no rewinds.", zh: "剩余会面次数：{a}/{b} · 每次{m}分钟。开始即消耗一次——不可回退。" },
  midLocked: { en: "I sit in the {boss}'s line — I only talk shop with analysts the engagement team has vouched for on that line. Pass {gk}'s check (F{floor}) first, then come back. I'll have time for you; I always do.", zh: "我在{boss}条线上——只有项目组在这条线担保过的分析师，我才能跟你聊业务。先通过{gk}的考核（F{floor}层），再回来找我。我有的是时间。" },
  execWarning: { en: "⚠️ Executive time is scarce. Visits are LIMITED and each meeting is TIMED — once you walk in, a visit is spent whether you use it well or not. Write your questions below BEFORE you start, so none of your chances go to waste.", zh: "⚠️ 高管的时间非常稀缺。会面次数有限、每次限时——一旦进门，无论用得好不好都算消耗一次。开始之前先在下方写好你的问题，别浪费任何一次机会。" },
  // menu
  menuTitle: { en: "☰ Menu — Engagement Status", zh: "☰ 菜单 — 项目进度" },
  missionBoard: { en: "📌 Mission board — pick your track", zh: "📌 任务板 — 选择你的路线" },
  missionBoardHint: { en: "No fixed order. Each track: a Deloitte manager briefs & checks you → the matching Nike executive unlocks.", zh: "没有固定顺序。每条线：德勤经理简报并考核你 → 解锁对应的耐克高管。" },
  setActive: { en: "Set active", zh: "设为当前" },
  active: { en: "✔ Active", zh: "✔ 当前任务" },
  directory: { en: "🏢 Building directory", zh: "🏢 楼层人员名录" },
  backToOffice: { en: "Back to the office", zh: "返回办公区" },
  language: { en: "Language: English (switch to 中文)", zh: "语言：中文（切换到 English）" },
  nextStep: { en: "🎯 Next step:", zh: "🎯 下一步：" },
  progressLine: { en: "Checks passed: {t}/7 · Executives interviewed: {i}/7 · Board pitch: {b}", zh: "考核通过：{t}/7 · 高管访谈：{i}/7 · 董事会汇报：{b}" },
  done: { en: "done", zh: "已完成" },
  pending: { en: "pending", zh: "待完成" },
  unlocks: { en: "unlocks", zh: "解锁" },
  // track statuses
  stNotStarted: { en: "not started", zh: "未开始" },
  stTalking: { en: "conversation started — leave to take the check", zh: "对话已开始——离开时接受考核" },
  stRetry: { en: "check: retry", zh: "考核：可重试" },
  stPassed: { en: "check passed — exec unlocked", zh: "考核通过——高管已解锁" },
  stInterviewed: { en: "executive interviewed ✓", zh: "高管已访谈 ✓" },
  // directory statuses
  willBrief: { en: "ask them anything", zh: "可以随便问" },
  chat: { en: "chat", zh: "闲聊" },
  startHere: { en: "⟵ START HERE", zh: "⟵ 从这里开始" },
  briefedYou: { en: "briefed you", zh: "已给你简报" },
  meetingsLeftShort: { en: "{a}/{b} meetings left", zh: "剩{a}/{b}次会面" },
  lockedShort: { en: "locked — pass {name}", zh: "未解锁——先通过{name}" },
  finalPitch: { en: "final pitch", zh: "最终汇报" },
  pitchMade: { en: "pitch made ✓", zh: "已完成汇报 ✓" },
  // dialogue / chat
  you: { en: "You", zh: "你" },
  ask: { en: "ASK", zh: "提问" },
  leave: { en: "LEAVE", zh: "离开" },
  askPh: { en: "Ask your question… (Enter to send)", zh: "输入你的问题……（回车发送）" },
  connectionHiccup: { en: "(connection hiccup: {e}) Try again.", zh: "（连接出错：{e}）请重试。" },
  credToast: { en: "⭐ +{n} credibility", zh: "⭐ 信誉值 +{n}" },
  partialCredit: { en: "Partial credit.", zh: "部分得分。" },
  tryAgainLater: { en: "Take another pass at it — come back when you're ready.", zh: "再打磨一下——准备好了再来。" },
  talkSupervisorFirst: { en: "Oh — you must be the new analyst. Before anything else, go see your supervisor, Manager Lin. She's by the reception on Floor 12.", zh: "哦——你就是新来的分析师吧。先去见你的主管林经理，她在12层前台旁边。" },
  execLockedLine: { en: "I'm sorry — {exec} only takes meetings arranged through our engagement team. Pass {gk}'s check first ({gkRole}, F{floor}).", zh: "抱歉——{exec}只接受项目组安排的会面。请先通过{gk}的考核（{gkRole}，{floor}层）。" },
  // Executive rejects the player directly when the door isn't earned yet.
  execRejectLines: {
    en: [
      "…Who are you? I don't recall Vivian putting anything on my calendar for you.",
      "Sorry kid, I don't have time for a meeting that isn't on my schedule. Come back when you're actually booked in.",
      "Hold on — do we have an appointment? I don't take unscheduled walk-ins. Talk to the engagement team first.",
      "I'm mid-quarter and slammed. If Vivian didn't set this up, it isn't happening today.",
    ],
    zh: [
      "……你是哪位？我不记得薇薇安在我日程上安排过和你的会面。",
      "抱歉，孩子，我没时间见一个不在我日程上的人。等你真正被安排上了再来。",
      "等等——我们有约吗？我不接待临时到访的人。先去找项目组吧。",
      "我这个季度忙得脚不沾地。如果不是薇薇安安排的，今天就免谈。",
    ],
  },
  execRejectHint: { en: "(Pass {gk}'s check on F{floor} to get on {exec}'s calendar.)", zh: "（先通过{floor}层{gk}的考核，才能排进{exec}的日程。）" },
  calendarFull: { en: "I'm sorry — {exec}'s calendar has no more slots for you this engagement. Whatever you learned will have to be enough.", zh: "抱歉——本项目内{exec}的日程已经没有留给你的时间了。你了解到的信息只能到此为止。" },
  boardNotReady: { en: "The board convenes once you've interviewed all seven executives — you're at {n}/7.", zh: "访谈完七位高管后董事会才会召开——你目前完成了{n}/7。" },
  boardDoneLine: { en: "The room is quiet now. Your pitch has been made — Manager Lin on Floor 12 wants to debrief you.", zh: "会议室已经安静下来。你的汇报结束了——12层的林经理等着和你复盘。" },
  boardGreeting: { en: "The CEO nods at you. \"You have the room, Athena. Give us your strategy — where does Nike China play, and where does the money go?\"", zh: "CEO向你点头。「Athena，这个会议室交给你了。讲讲你的战略——耐克中国在哪里竞争，资源投向哪里？」" },
  boardConcluded: { en: "Board meeting concluded — see Manager Lin (F12) for your debrief.", zh: "董事会会议结束——去12层找林经理复盘。" },
  meetingTimer: { en: "Meeting with {t}", zh: "与{t}会面中" },
  boardTimer: { en: "FINAL BOARD MEETING", zh: "最终董事会会议" },
  resumeLine: { en: "…as I was saying. Where were we?", zh: "……接着刚才说。我们讲到哪了？" },
  meetGreeting: { en: "Sit. You asked for my time — use it. The clock is running.", zh: "坐。是你约的我——那就用好这段时间。计时已经开始。" },
  outOfTime: { en: "…and that's time.", zh: "……时间到了。" },
  boardTitle: { en: "The Board", zh: "董事会" },
  boardPrepTitle: { en: "FINAL BOARD MEETING", zh: "最终董事会会议" },
  boardPrepSub: { en: "All seven Nike Greater China executives, one room. Pitch your 5-year strategy and how you'd allocate resources — they will react, probe, and push back.", zh: "耐克大中华区七位高管齐聚一室。汇报你的五年战略和资源分配——他们会回应、追问、反驳。" },
  boardPrepNote: { en: "One session · {m} minutes. This is the finale.", zh: "仅一场 · {m}分钟。这是最终环节。" },
  // Board — present a deck vs. pitch live
  boardPresentPrompt: { en: "How would you like to present your 5-year strategy to the board?", zh: "你想如何向董事会汇报你的五年战略？" },
  boardPresentDeck: { en: "📊 Present my prepared deck (upload PPTX / PDF / DOCX).", zh: "📊 汇报我准备好的材料（上传PPTX / PDF / DOCX）。" },
  boardPresentLive: { en: "🎤 Speak live — take their questions in real time.", zh: "🎤 现场汇报——实时回答他们的提问。" },
  boardDeckTitle: { en: "📊 Present your 5-year strategy", zh: "📊 汇报你的五年战略" },
  boardDeckHint: { en: "Upload your deck (PPTX / PDF / DOCX / TXT / MD, max 12 MB) or paste your key points. Each of the seven executives will evaluate it from their own lens — the CFO on financials, the CHRO on org capability, and so on.", zh: "上传你的材料（PPTX / PDF / DOCX / TXT / MD，最大12MB）或粘贴要点。七位高管会各自从自己的视角评估——CFO看财务，CHRO看组织能力，以此类推。" },
  boardDeckSubmit: { en: "Present to the board", zh: "向董事会汇报" },
  boardDeckReading: { en: "The board is reviewing your strategy…", zh: "董事会正在评审你的战略……" },
  boardDeckReactions: { en: "The board weighs in, one by one:", zh: "董事会成员逐一发表意见：" },
  boardRubricTitle: { en: "📋 How the board will judge your pitch:", zh: "📋 董事会将如何评判你的汇报：" },
  boardRubric1: { en: "One clear, viable and SUSTAINABLE 5-year thesis for Nike China — not a wish list.", zh: "一个清晰、可行且【可持续】的耐克中国五年主张——不是愿望清单。" },
  boardRubric2: { en: "Addresses all four problems: slowing growth, brand trust, product quality, discount-driven premium erosion.", zh: "回应全部四大问题：增长放缓、品牌信任、产品质量、折扣侵蚀溢价。" },
  boardRubric3: { en: "Differentiates Nike from Anta and Li-Ning — not copying them.", zh: "让耐克区别于安踏和李宁——而不是模仿它们。" },
  boardRubric4: { en: "Concrete resource allocation: where the money goes first, and why.", zh: "具体的资源分配：钱先投到哪里，为什么。" },
  boardRubric5: { en: "Balances ALL stakeholders and states the trade-offs explicitly.", zh: "平衡【所有】利益相关者，并明确说出取舍。" },
  boardPriorityHint: { en: "⚖ Not every voice weighs equally: the CEO (growth thesis) and CFO (financial viability) carry the most weight; the COO and CMO come next; the CHRO, CTO and CPO matter — but are supporting voices. Allocate your airtime accordingly.", zh: "⚖ 各方的分量并不相同：CEO（增长主张）和CFO（财务可行性）分量最重；COO和CMO次之；CHRO、CTO和CPO重要——但属于支持性声音。请据此分配你的汇报时间。" },
  boardNeedInterim: { en: "Manager Lin expects an interim readout before the board convenes — see her on Floor 12 first.", zh: "董事会召开前，林经理要先听你的中期汇报——请先去12层找她。" },

  // interim readout
  interimObjective: { en: "Give Manager Lin an interim readout (F12)", zh: "向林经理做中期汇报（12层）" },
  interimObjectiveWhy: { en: "You've interviewed {n} executives — real engagements synthesize mid-way, not only at the end. Required before the board.", zh: "你已访谈{n}位高管——真实项目会在中途做阶段性汇总，而不是只在最后。这是董事会前的必经步骤。" },
  interimTitle: { en: "Interim readout", zh: "中期汇报" },
  interimPrompt: { en: "You've spoken to {n} of the seven executives. Tell me: what do you BELIEVE so far and why — and what do you still need to test before you'd stand behind it? (3-6 sentences)", zh: "七位高管你已经谈了{n}位。告诉我：到目前为止你【相信】什么，为什么——在你敢为它背书之前，还需要验证什么？（3-6句话）" },
  interimIntro: { en: "Good timing — sit down. Before you go further, I want an interim readout. Not a fact dump: what do you believe, and why?", zh: "来得正好——坐。在你继续之前，我要听一次中期汇报。不是罗列事实：你相信什么，为什么？" },
  interimRetry: { en: "That was a summary, not a point of view. Go think, then come back and tell me what you actually believe.", zh: "那是摘要，不是观点。回去想想，然后告诉我你真正相信什么。" },

  // Manager Lin's final pre-board review offer (after all 7 interviews)
  linReviewPrompt: { en: "You've now met all seven of them. Before you walk into that boardroom — do you want me to look over your draft strategy first?", zh: "七位你都见过了。在你走进董事会会议室之前——要不要我先帮你把你的战略草稿过一遍？" },
  linReviewYes: { en: "Yes — review my draft strategy (upload / paste).", zh: "好——请审阅我的战略草稿（上传/粘贴）。" },
  linReviewNo: { en: "Not yet — I'll head to the board.", zh: "还不用——我直接去董事会。" },
  // work review (file upload, scoped to one reviewer)
  reviewTitle: { en: "📄 Review my work", zh: "📄 审阅我的草稿" },
  reviewWithHint: { en: "Show {name} a working document (.pdf / .docx / .txt / .md, max 5 MB) — or paste text below. They'll audit it against their standards; long documents are read up to ~30,000 characters.", zh: "把工作文档拿给 {name} 看（.pdf / .docx / .txt / .md，最大5MB）——或在下方粘贴文本。TA会按自己的标准审阅；长文档最多读取约30,000字符。" },
  reviewExtracting: { en: "Extracting text from {f}…", zh: "正在从{f}提取文本……" },
  reviewChooseFile: { en: "Choose file…", zh: "选择文件……" },
  reviewReviewer: { en: "Reviewer", zh: "审阅人" },
  reviewSubmit: { en: "Submit for review", zh: "提交审阅" },
  reviewReading: { en: "{name} is reading your document…", zh: "{name}正在阅读你的文档……" },
  reviewVerdictStrong: { en: "Verdict: STRONG", zh: "评定：优秀" },
  reviewVerdictAcceptable: { en: "Verdict: ACCEPTABLE", zh: "评定：合格" },
  reviewVerdictWeak: { en: "Verdict: WEAK", zh: "评定：待改进" },
  reviewBadFile: { en: "Please choose a .pdf, .docx, .pptx, .txt or .md file under 12 MB.", zh: "请选择12MB以内的.pdf、.docx、.pptx、.txt或.md文件。" },
  reviewSaved: { en: "📓 Review saved to your notebook (Q)", zh: "📓 审阅意见已存入笔记本（Q）" },

  // usage dashboard
  usageBtn: { en: "💳 Usage & cost", zh: "💳 用量与费用" },
  usageTitle: { en: "💳 Model usage & estimated cost", zh: "💳 模型用量与预估费用" },
  usageToday: { en: "Today", zh: "今天" },
  usageTotal: { en: "All time", zh: "累计" },
  usageCalls: { en: "calls", zh: "次调用" },
  usageTokens: { en: "tokens (in / out)", zh: "tokens（输入/输出）" },
  usageCost: { en: "est. cost", zh: "预估费用" },
  usageNote: { en: "Estimates use published per-token pricing; actual billing may differ slightly.", zh: "按公开的token单价估算；实际账单可能略有差异。" },

  // welcome back
  welcomeBack: { en: "☕ Welcome back, Athena", zh: "☕ 欢迎回来，Athena" },
  welcomeAway: { en: "You were away {t}. Here's where you left off:", zh: "你离开了{t}。这是你上次的进度：" },
  welcomeProgress: { en: "Credibility {c} · Checks {t}/7 · Executives interviewed {i}/7", zh: "信誉值{c} · 考核通过{t}/7 · 高管访谈{i}/7" },
  welcomeContinue: { en: "▶ Continue the engagement", zh: "▶ 继续项目" },
  awayHours: { en: "{n} hour(s)", zh: "{n}小时" },
  awayDays: { en: "{n} day(s)", zh: "{n}天" },

  // gatekeeper conversation + exit quiz
  gkGreetReturn: { en: "You again. Ask, if you must — hit TAKE CHECK when you're actually ready. LEAVE if you're just wandering.", zh: "又是你。要问就问——真准备好了就按「接受考核」。只是路过的话，就离开吧。" },
  gkTakeCheck: { en: "✓ TAKE CHECK", zh: "✓ 接受考核" },
  gkGeneratingQuiz: { en: "Alright — let's see what stuck. Give me a second.", zh: "好——看看你记住了什么。稍等一下。" },
  gkQuizTitle: { en: "📝 Quick check — {name}", zh: "📝 快速考核 — {name}" },
  gkQuizIntro: { en: "Two questions based on what we just discussed:", zh: "根据我们刚才聊的内容，两个问题：" },
  gkAnswerPh: { en: "Your answer…", zh: "你的答案……" },
  gkSubmitQuiz: { en: "Submit answers", zh: "提交答案" },
  gkLeadToast: { en: "📌 New lead added to your notebook", zh: "📌 笔记本新增一条线索" },
  gkAlreadyPassed: { en: "You've already passed this check.", zh: "你已经通过这项考核了。" },
  // Sequential Q&A check
  gkQuestionOf: { en: "Question {i} of {n}", zh: "第 {i} / {n} 题" },
  gkNextQuestion: { en: "Next question ▸", zh: "下一题 ▸" },
  gkSubmitAnswers: { en: "Submit for grading", zh: "提交评分" },
  gkYourNotes: { en: "📓 Your notes from this conversation", zh: "📓 你与TA对话的笔记" },
  gkSummarySaved: { en: "📓 Chat summary saved to your notebook (Q)", zh: "📓 对话摘要已存入笔记本（Q）" },
  gkGrading: { en: "Let me look over your answers…", zh: "我看看你的回答……" },
  gkRevisePrompt: { en: "Not quite there yet. You need the full picture before I can send you up to the executive — want to revise your answers?", zh: "还差一点。在我把你送去见高管之前，你得先把情况彻底搞清楚——要修改你的回答吗？" },
  gkReviseYes: { en: "Yes — let me revise my answers now.", zh: "好——现在就修改我的回答。" },
  gkReviseLater: { en: "Let me review my notes and come back.", zh: "让我看看笔记，稍后再来。" },
  gkCheckPassed: { en: "That's it — you've got the picture. {feedback} (+{n} credibility)", zh: "对了——你把情况摸清了。{feedback}（信誉值 +{n}）" },
  // Contextual review-with-this-manager offer
  gkOfferPrompt: { en: "What do you need? More background before you face {exec} — or my eyes on something you've written?", zh: "需要什么？是在见{exec}之前再补充些背景，还是想让我看看你写的东西？" },
  gkOfferAskMore: { en: "Keep interviewing you — I'll take your check when I leave.", zh: "继续向你请教——离开时接受你的考核。" },
  gkOfferReview: { en: "Get feedback on a document I've drafted (upload / paste).", zh: "请你点评我起草的文档（上传/粘贴）。" },
  gkOfferCatchUp: { en: "Just catching up — nothing right now.", zh: "只是随便聊聊——暂时没别的事。" },
  gkReviewInvite: { en: "One more thing — if you want a second pair of eyes on your work before you present to the C-suite, bring it back to me any time. I'll tell you straight if it'll hold up.", zh: "还有一件事——在你向高管层汇报之前，如果想让人帮你把把关，随时把东西拿来给我。能不能撑得住，我会跟你直说。" },
  gkNothingElse: { en: "Alright. My door's open when you need it.", zh: "好。需要的时候，我的门随时开着。" },

  // creator
  createTitle: { en: "CREATE YOUR ANALYST", zh: "创建你的分析师" },
  gender: { en: "Gender", zh: "性别" },
  female: { en: "Female", zh: "女" },
  male: { en: "Male", zh: "男" },
  skin: { en: "Skin", zh: "肤色" },
  hairstyle: { en: "Hairstyle", zh: "发型" },
  hairColor: { en: "Hair color", zh: "发色" },
  topType: { en: "Top", zh: "上衣款式" },
  topColor: { en: "Top color", zh: "上衣颜色" },
  bottomType: { en: "Bottoms", zh: "下装款式" },
  bottomColor: { en: "Bottoms color", zh: "下装颜色" },
  shoes: { en: "Shoes", zh: "鞋子" },
  randomize: { en: "🎲 Surprise me", zh: "🎲 随机一套" },
  startGame: { en: "▶ START DAY ONE", zh: "▶ 开始第一天" },
  creatorBack: { en: "◀ BACK", zh: "◀ 返回" },
  chooseLang: { en: "Choose your language", zh: "选择语言" },
  // cutscene captions
  cs1: { en: "Six months ago. 2 a.m. One application, sent into the dark — Deloitte China, Consulting.", zh: "六个月前，凌晨两点。一份简历投进了夜色里——德勤中国，管理咨询。" },
  cs2: { en: "Three interview rounds. Case after case. \"Estimate the sportswear market of Chengdu…\"", zh: "三轮面试，案例一个接一个。「请估算成都运动服饰市场的规模……」" },
  cs3: { en: "Then the email came. OFFER — Analyst, China Consulting New Analyst Program.", zh: "然后邮件来了。OFFER——分析师，中国咨询新人计划（CCNAP）。" },
  cs4: { en: "Today. Day one. Somewhere upstairs, a client named Nike is waiting.", zh: "今天，是第一天。楼上某处，一个叫耐克的客户正在等着。" },
  csHint: { en: "▼ click / press E", zh: "▼ 点击 / 按E键" },
  serverOffline: { en: "Cannot reach the game server: {e}. Is it running on :3002?", zh: "无法连接游戏服务器：{e}。请确认 :3002 端口已启动。" },
  fullscreen: { en: "⛶ Fullscreen (F)", zh: "⛶ 全屏 (F)" },
};

/** Tiny template helper: fmt(UI.floorToast, {n: 13}) */
export function fmt(v: BL, vars: Record<string, string | number> = {}): string {
  let s = L(v);
  for (const [k, val] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(val));
  return s;
}
