/**
 * GAME CONTENT — domain tracks, shared by client (dialogue) and server
 * (grading rubrics, credibility, exec-unlock gating — server-authoritative).
 *
 * MISSION MODEL (player-chosen, no fixed order):
 *   Each TRACK = one Deloitte domain manager (gatekeeper) → one Nike executive.
 *   The gatekeeper is a LIVE CONVERSATION (LLM-backed, unlimited time/turns —
 *   the "practice" tier), not a scripted briefing: the player asks whatever
 *   they want. Gatekeepers know the case deeply but are NOT C-suite — they
 *   have real, deliberate blind spots (budgets, headcount, personal views of
 *   the executive) and say so honestly, pointing the player at the exact
 *   Nike executive who'd know. That deflection auto-logs to the notebook as
 *   a lead ("Ask the CMO about the brand-repair budget").
 *
 *   When the player leaves the conversation, the gatekeeper quizzes them
 *   with 2 short questions generated FROM that specific conversation
 *   (Haiku), so the check reflects what was actually discussed. Passing (or
 *   partial) unlocks the matching executive's calendar on Floor 15.
 *
 * All player-facing text is bilingual {en, zh}. Knowledge-base prose feeds
 * an LLM system prompt and stays English (the LANGUAGE directive in the
 * prompt handles output language), except where noted.
 */

export const TASKS = {
  "task-brief-check": {
    type: "choice",
    npc: "supervisor",
    title: { en: "Engagement briefing check", zh: "项目简报确认" },
    prompt: {
      en: "Quick check before I let you loose on the building — what is YOUR deliverable on this engagement?",
      zh: "放你去各楼层之前先确认一下——这个项目里，你自己的交付物是什么？",
    },
    options: [
      { en: "A 5-year independent growth strategy for Nike Greater China, written by me.", zh: "一份由我独立撰写的耐克大中华区五年增长战略。" },
      { en: "A summary of whatever Nike's executives tell me to write.", zh: "把耐克高管们让我写的内容汇总一下。" },
      { en: "A plan to help Anta and Li-Ning grow faster.", zh: "一份帮助安踏和李宁更快增长的计划。" },
    ],
    correct: 0,
    credibility: 20,
  },
};

/**
 * TRACKS — the mission board. Player picks any track in any order.
 * Passing that track's exit quiz (pass or partial) unlocks the matching
 * executive. Server enforces the unlock; this map is the single source of
 * truth for gatekeeper identity, knowledge, and blind spots.
 */
export const TRACKS = {
  strategy: {
    taskId: "track-strategy", npcId: "gk-strategy", personaId: "ceo",
    name: { en: "Strategy & Business Design", zh: "战略与业务设计" },
    credibility: 40,
    greeting: {
      en: "Sit down. You want the CEO's calendar eventually — ask me anything about how this problem is structured.",
      zh: "坐吧。你迟早要约CEO的时间——问我任何关于这个问题该怎么拆解的事。",
    },
    knowledge:
      "Issue trees must be MECE (mutually exclusive, collectively exhaustive). Candidate branches for Nike China: market & competition, brand & consumer perception, product & quality, channel & pricing, enablers (organization, digital). Greater China FY2025: revenue $6.586B (-13%), EBIT -31%. CEO Chen Wei (President & GM) thinks in trade-offs, translates constantly for an impatient HQ, has run the region 5 years after 26 years at Nike. He can approve day-to-day operating calls but major budget shifts, M&A, and global launch timing need HQ approval.",
    unknowns: [
      { topic: { en: "how much real autonomy China has vs. what HQ actually controls", zh: "中国区到底有多少自主权，总部实际管控到什么程度" }, execId: "ceo" },
      { topic: { en: "whether Chen Wei personally leans offense (aggressive share-taking) or defense (stabilize first)", zh: "陈韦本人更倾向进攻（抢份额）还是防守（先稳住）" }, execId: "ceo" },
      { topic: { en: "the exact multi-year budget HQ has actually approved for China", zh: "总部实际批准给中国区的多年期预算具体是多少" }, execId: "cfo" },
    ],
    doneLine: { en: "That tree will hold. Chen Wei's office is on 15 — he answers exactly what you ask, so ask well.", zh: "这棵树立得住。陈韦的办公室在15层——你问什么他答什么，所以问得准一点。" },
    retryLine: { en: "Not sharp enough yet. Go back in, ask better questions, and try the check again.", zh: "还不够到位。再进去聊聊，问得更准一些，然后重新接受考核。" },
  },

  finance: {
    taskId: "track-finance", npcId: "gk-finance", personaId: "cfo",
    name: { en: "Finance Transformation", zh: "财务转型" },
    credibility: 40,
    greeting: {
      en: "Zhou Mingyuan won't give you a minute without 'revenue quality' in your vocabulary. Ask me what you need.",
      zh: "没弄懂「收入质量」这个词，周明远不会给你一分钟。想问什么就问。",
    },
    knowledge:
      "'Revenue quality' is CFO Zhou Mingyuan's core lens — healthy full-price/sustainable revenue vs. discount-stimulated volume. FY2025: revenue $6.586B (-13%), EBIT $1.602B (-31%), gross margin -420bps (bad FX + inventory write-downs), tariffs add ~$1B annualized cost pressure. Nike does NOT disclose Greater China net profit or inventory as standalone metrics — EBIT is the profitability measure. His four questions for any plan: how much does it cost, how long to pay off, where's the risk, how do we exit if it fails.",
    unknowns: [
      { topic: { en: "the actual Greater China net profit or inventory figures (not publicly disclosed by Nike)", zh: "大中华区实际的净利润或库存数字（耐克未公开披露）" }, execId: "cfo" },
      { topic: { en: "the exact ROI hurdle rate Zhou uses to approve or reject a budget", zh: "周明远批预算时用的具体投资回报率门槛" }, execId: "cfo" },
      { topic: { en: "whether Zhou would personally trade short-term profit for brand-trust repair", zh: "周明远本人是否愿意用短期利润换品牌信任修复" }, execId: "cfo" },
    ],
    doneLine: { en: "You'll survive him now. Floor 15 — lead with a specific number, he warms up fast when you do.", zh: "现在你能在他面前撑住了。15层——开口先给具体数字，他会立刻对你热络起来。" },
    retryLine: { en: "Zhou would have ended that meeting. Go back in, sharpen your questions, and retake the check.", zh: "换成周明远，会面已经结束了。再进去问得更准一些，然后重新接受考核。" },
  },

  marketing: {
    taskId: "track-marketing", npcId: "gk-marketing", personaId: "cmo",
    name: { en: "Customer & Marketing", zh: "客户与营销" },
    credibility: 40,
    greeting: {
      en: "Zhang Aiwei's whole world is one question: what does this do to the brand? Ask me about the brand file.",
      zh: "张艾薇的整个世界只有一个问题：这件事对品牌意味着什么？来问问品牌档案的事吧。",
    },
    knowledge:
      "CMO Zhang Aiwei's lens: 'what does this do to the Nike brand?' Post-2021-BCI-cotton-incident, tracked brand favorability slid from ~75% to ~42%. Guochao (national pride) surge: consumers shifted from brand worship to value identification, favoring local brands. Her deepest fear: Nike sliding from premium sports brand to ordinary discount brand — irreversible once it happens. She is allergic to discount-led growth and opens up on specific consumers, not campaigns.",
    unknowns: [
      { topic: { en: "the actual marketing budget allocated to brand-repair campaigns", zh: "实际投入品牌修复活动的营销预算" }, execId: "cmo" },
      { topic: { en: "which specific celebrity/KOL partnerships are being considered post-BCI", zh: "BCI事件后具体在考虑哪些明星/KOL合作" }, execId: "cmo" },
      { topic: { en: "Zhang Aiwei's honest read on how many years brand trust actually takes to rebuild", zh: "张艾薇对品牌信任重建实际需要几年的真实判断" }, execId: "cmo" },
    ],
    doneLine: { en: "You're ready for her. Floor 15 — and remember: ask about people, not campaigns.", zh: "你可以去见她了。15层——记住：问「人」，别问campaign。" },
    retryLine: { en: "Half-formed answers won't survive her. Go back in, ask sharper questions, and retake the check.", zh: "半吊子的回答在她面前撑不住。再进去问得更犀利一些，然后重新接受考核。" },
  },

  ops: {
    taskId: "track-ops", npcId: "gk-ops", personaId: "coo",
    name: { en: "Core Business Operations", zh: "核心业务运营" },
    credibility: 40,
    greeting: {
      en: "Zhao Zhengping's trademark: can it be done, how long, what does it need? Ask me about the channel and quality mess.",
      zh: "赵正平的招牌三连问：行不行？多久？要什么？来问问渠道和质量这摊子事吧。",
    },
    knowledge:
      "COO Zhao Zhengping asks 'can it be done, how long, what does it need?' Quality: >70% of production moved to Vietnam/Indonesia, early batches shipped with defects (misaligned labels, glue overflow) concentrated on popular retro releases; only ~17% of footwear still made in China. Channel: major wholesale partners halved 2020-22, gutting lower-tier-city coverage and removing dealers' inventory 'reservoir' role; FY2025 wholesale -13%, direct -12%, digital -22% — both engines shrinking at once. He believes in pilots over big-bangs; dealer trust rebuilds over years, no shortcuts.",
    unknowns: [
      { topic: { en: "exact current inventory levels or write-down figures", zh: "当前具体的库存水平或跌价准备金额" }, execId: "cfo" },
      { topic: { en: "Zhao Zhengping's real shortlist of pilot cities for channel rebuild", zh: "赵正平真正在考虑的渠道重建试点城市名单" }, execId: "coo" },
      { topic: { en: "whether Nike will actually reshore any production back to China", zh: "耐克是否真的会把部分产能迁回中国" }, execId: "coo" },
    ],
    doneLine: { en: "That'll hold up. Floor 15 — skip the fancy frameworks with him, he wants ground truth.", zh: "这能站得住脚了。15层——跟他别整花哨的框架，他要的是一线实况。" },
    retryLine: { en: "You listed facts but didn't connect them. Go back in, ask about the chain of cause and effect, and retake the check.", zh: "你列出了事实但没串起来。再进去问问因果链条，然后重新接受考核。" },
  },

  hr: {
    taskId: "track-hr", npcId: "gk-hr", personaId: "chro",
    name: { en: "Human Capital", zh: "人力资本" },
    credibility: 40,
    greeting: {
      en: "Everyone forgets my domain until their strategy dies in execution. Ask me whether the org can actually carry your ideas.",
      zh: "所有人都会忽略我这个领域——直到他们的战略死在执行上。来问问组织到底扛不扛得动。",
    },
    knowledge:
      "CHRO Shen Ruolin asks 'can the organization carry it?' Context: HQ keeps parachuting category leads in, regional autonomy is shrinking, leadership keeps changing — momentum and continuity bleed with every reshuffle. Anta and Li-Ning are now attractive employers competing for the same design/digital/marketing/channel talent — the Nike halo alone doesn't win the talent war anymore. Her four questions for any plan: who owns it, what capability is missing, how do we train it, how do we measure it.",
    unknowns: [
      { topic: { en: "actual headcount or layoff plans", zh: "具体的人员编制或裁员计划" }, execId: "chro" },
      { topic: { en: "compensation benchmarking data against Anta/Li-Ning", zh: "与安踏/李宁对标的薪酬基准数据" }, execId: "chro" },
      { topic: { en: "Shen Ruolin's honest read on morale after the recent leadership changes", zh: "沈若琳对近期高层变动后士气的真实判断" }, execId: "chro" },
    ],
    doneLine: { en: "She'll take you seriously now. Floor 15 — she's the kindest of the seven, and the hardest to fool.", zh: "现在她会认真对待你了。15层——七个人里她最温和，也最难糊弄。" },
    retryLine: { en: "That idea had no owner. Go back in, pin down who's accountable, and retake the check.", zh: "那个想法没有负责人。再进去问清楚谁该担责，然后重新接受考核。" },
  },

  tech: {
    taskId: "track-tech", npcId: "gk-tech", personaId: "cto",
    name: { en: "Enterprise Technology & Performance", zh: "企业技术与绩效" },
    credibility: 40,
    greeting: {
      en: "Lin Zhiyao measures everything — conversion, repurchase, private-domain scale. Ask me about the digital ecosystem gap.",
      zh: "林知遥什么都要量化——转化率、复购率、私域规模。来问问数字生态断层的事吧。",
    },
    knowledge:
      "VP Tech Lin Zhiyao: Nike Greater China digital sales fell 22% in FY2025. Nike's global-app-centric digital stack sits outside Douyin/Xiaohongshu/Tmall/WeChat, where Chinese consumers actually live — a structural ecosystem gap. Anta's e-commerce reached 35.1% of group revenue (+21.8%), with AI-assisted design ordering past RMB 2 billion. She measures conversion, repurchase, private-domain audience; hates buzzwords, loves specific measurable scenarios.",
    unknowns: [
      { topic: { en: "the exact tech budget allocated for platform rebuild", zh: "平台重建实际分配的技术预算" }, execId: "cto" },
      { topic: { en: "which specific AI/data initiatives are already greenlit internally", zh: "内部已经批准的具体AI/数据项目有哪些" }, execId: "cto" },
      { topic: { en: "Lin Zhiyao's real appetite for going Douyin-first over the global app", zh: "林知遥对「抖音优先于全球App」这个方向的真实意愿" }, execId: "cto" },
    ],
    doneLine: { en: "That'll interest her. Floor 15 — bring metrics, leave buzzwords at the door.", zh: "这个她会感兴趣。15层——带上指标，把流行词留在门外。" },
    retryLine: { en: "'Digital transformation' is not a scenario. Go back in, get specific and measurable, and retake the check.", zh: "「数字化转型」不是场景。再进去问得具体、可衡量一些，然后重新接受考核。" },
  },

  product: {
    taskId: "track-product", npcId: "gk-product", personaId: "cpo",
    name: { en: "Consumer Products", zh: "消费品行业" },
    credibility: 40,
    greeting: {
      en: "Product is where China gets physical — shoes on shelves, bought or not. Ask me about the competitor picture.",
      zh: "产品是中国这场仗真刀真枪的地方——鞋摆上货架，买或不买。来问问竞品格局吧。",
    },
    knowledge:
      "Anta and Li-Ning have nearly closed the product gap with Nike: near-parity quality and design, local supply chains giving shorter lead times and lower cost, Li-Ning's streetwear reinvention made 'China-cool' a product category. Nike's counter-move: products designed specifically for Chinese consumers, not global products with Chinese subtitles. The Southeast Asia production-shift quality complaints landed hardest on the retro icons people queue for.",
    unknowns: [
      { topic: { en: "what's actually in the Nike China product pipeline for next year", zh: "耐克中国明年产品管线里实际有什么" }, execId: "cpo" },
      { topic: { en: "whether local-only SKUs designed just for China are being greenlit", zh: "是否有专为中国设计的本土专属SKU获批" }, execId: "cpo" },
      { topic: { en: "the VP Product's personal view on whether the Southeast Asia quality fixes are working", zh: "产品副总裁本人对东南亚质量整改是否见效的真实判断" }, execId: "cpo" },
    ],
    doneLine: { en: "Now you know the battlefield. Floor 15 — the VP loves anyone who talks about actual shoes.", zh: "现在你摸清战场了。15层——聊到具体的鞋，副总裁就会喜欢你。" },
    retryLine: { en: "Too vague — 'they're cheaper' is a price point, not a product story. Go back in and retake the check.", zh: "太空了——「他们更便宜」是个价格点，不是产品故事。再进去聊聊，然后重新接受考核。" },
  },
};

export function trackForPersona(personaId) {
  return Object.entries(TRACKS).find(([, t]) => t.personaId === personaId)?.[1] || null;
}

export function trackById(trackId) {
  return TRACKS[trackId] || null;
}
