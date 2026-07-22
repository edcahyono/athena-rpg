/**
 * CONSULTANT WORKSPACE + EVIDENCE / DATA PACKS (v2 Wave 2).
 *
 * The "engagement binder" — the serious, structured layer Alice asked for on
 * top of the playful pixel notebook. Game stats (credibility) accrue
 * automatically; consulting *insight* cannot — the player must author it here:
 * log pain points from evidence, synthesize findings (each citing evidence),
 * and derive recommendations (each citing a finding). Unsupported items and
 * unreconciled stakeholder conflicts are flagged and block the alignment gates.
 *
 * See docs/DESIGN-consulting-methodology-v2.md Parts C & D.
 *
 * Data packs are HAND-AUTHORED (design open-decision #5: consistent &
 * controllable) and grounded in shared/benchmarks.js. Stakeholders hand them
 * over when the player actually engages them (exec interview / mid-level chat).
 */

export const DATA_PACKS = [
  {
    id: "pack-ceo", source: "ceo", type: "strategy",
    title: { en: "Growth & Competitive Position Brief", zh: "增长与竞争格局简报" },
    summary: {
      en: "FY25 Greater China revenue fell ~13% YoY. This is not a soft market: Anta runs ~2x our GC revenue at ~21.8% share, and adidas GC has grown for 11 straight quarters (+13%) in the SAME market we decline in. The gap is relevance and price realization, not category demand.",
      zh: "FY25大中华区收入同比下滑约13%。这不是市场疲软：安踏的大中华区收入约为我们的2倍、市占约21.8%，而阿迪达斯大中华区在我们下滑的同一市场里已连续11个季度增长（+13%）。差距在于品牌相关性与价格实现，而非品类需求。",
    },
    conflictsWith: [],
  },
  {
    id: "pack-cfo", source: "cfo", type: "financials",
    title: { en: "Margin Bridge & P&L Pack", zh: "利润桥与损益分析包" },
    summary: {
      en: "GC EBIT margin fell 39.1%→24.3% over four years; EBIT from $3,243m to $1,602m. The decline reads as a MARGIN problem: clearance discounting to move inventory is destroying price realization. adidas GC rebuilt operating margin 10.1%→22.1% in three years through price discipline — proof the lever works here.",
      zh: "大中华区EBIT利润率四年内从39.1%降至24.3%；EBIT从32.43亿美元降至16.02亿美元。这看起来是个【利润率】问题：为清库存而打折正在摧毁价格实现。阿迪达斯大中华区三年内靠价格纪律把营业利润率从10.1%重建到22.1%——证明这条杠杆在这里有效。",
    },
    conflictsWith: ["pack-cmo"],
  },
  {
    id: "pack-cmo", source: "cmo", type: "brand",
    title: { en: "Brand Health Tracker", zh: "品牌健康度追踪" },
    summary: {
      en: "Brand favorability collapsed ~75%→~42% after the BCI episode while awareness held flat, and 72% of Gen-Z now leans guochao-first. The SAME revenue decline reads as a DEMAND problem: consumers stopped choosing us. Discounting is a symptom of weak pull, not the disease.",
      zh: "在BCI事件后，品牌好感度从约75%崩到约42%，而知名度基本持平；72%的Z世代如今国潮优先。【同一笔】收入下滑看起来是个【需求】问题：消费者不再选择我们。打折是拉力不足的症状，而非病因。",
    },
    conflictsWith: ["pack-cfo"],
  },
  {
    id: "pack-coo", source: "coo", type: "channel",
    title: { en: "Channel & Quality Report", zh: "渠道与质量报告" },
    summary: {
      en: "Wholesale was roughly halved; dealer trust is damaged and partners now order futures-light. Lower-tier coverage was gutted (361° runs 76% of stores in tier-3-and-below — that's the space we vacated). >70% of product is made in Vietnam/Indonesia, capping response speed, and the SE-Asia move brought a quality learning curve behind the complaints.",
      zh: "批发业务大致砍半；经销商信任受损，合作伙伴现在期货订单下得很轻。低线城市覆盖被掏空（361°有76%门店在三线及以下——正是我们腾出的空间）。超过70%的产品在越南/印尼生产，限制了响应速度，而东南亚转移带来的质量学习曲线正是投诉背后的原因。",
    },
    conflictsWith: [],
  },
  {
    id: "pack-chro", source: "chro", type: "org",
    title: { en: "Attrition & Talent Pack", zh: "流失与人才分析包" },
    summary: {
      en: "Local brands are poaching our mid-level backbone with +20-30% comp, bigger mandates and faster decisions; post-BCI our offer-acceptance is slipping even as application volume holds. Retention plans that only match compensation fail this cohort — the deciders are career narrative and delegated authority. Anta runs a three-generation pipeline; adidas has board-level succession planning.",
      zh: "本土品牌以高出20-30%的薪酬、更大的职权和更快的决策在挖我们的中层骨干；BCI之后，即便投递量维持，我们的offer接受率也在下滑。只对标薪酬的保留方案对这一群体无效——决定因素是职业叙事和被授予的决策权。安踏有三代人才梯队；阿迪达斯有董事会层面的继任规划。",
    },
    conflictsWith: [],
  },
  {
    id: "pack-cto", source: "cto", type: "digital",
    title: { en: "Digital Funnel Pack", zh: "数字化漏斗分析包" },
    summary: {
      en: "Our digital fell ~22% while the winners went platform-native: Anta e-com hit 35.8% of revenue (+15.5%), Li-Ning ~31% with instant-retail on all three major platforms, and Xtep's emerging channels (Douyin/WeChat-video/Xiaohongshu) grew +80%. Every winning model is platform flagship + mini-program + private domain — not brand-app-centric. Membership HEALTH (organic retention) beats promo-acquired installs.",
      zh: "我们的数字化下滑约22%，而赢家们都走了平台原生路线：安踏电商占收入35.8%（+15.5%），李宁约31%并在三大平台上做即时零售，特步的新兴渠道（抖音/视频号/小红书）增长+80%。每个成功模型都是平台旗舰店+小程序+私域——而非以品牌App为中心。会员【健康度】（自然留存）胜过促销拉来的下载量。",
    },
    conflictsWith: [],
  },
  {
    id: "pack-cpo", source: "cpo", type: "product",
    title: { en: "Product Portfolio Pack", zh: "产品组合分析包" },
    summary: {
      en: "Footwear -13% AND apparel -12% — a portfolio-wide relevance failure, not a category blip. Hoka/On took the ¥1000+ runner and domestic carbon-plate shoes took ¥500-600, so we're priciest exactly where our story is oldest. adidas runs racing tech down to €80 price points; Anta converts group R&D into 100k-order commercial product. Measure innovation by full-price sell-through, not tech announcements.",
      zh: "鞋类-13%、服装-12%——这是全组合的相关性失灵，不是单一品类的波动。Hoka/On拿下了1000元以上的跑者，国产碳板鞋拿下了500-600元，我们恰恰在故事最老的地方定价最高。阿迪达斯把竞速科技一路下放到80欧元价位；安踏能把集团研发转化成10万双订单的商业化产品。用全价售罄率衡量创新，而不是科技发布会。",
    },
    conflictsWith: [],
  },
];

export const DATA_PACK_MAP = Object.fromEntries(DATA_PACKS.map((p) => [p.id, p]));
export const packForSource = (personaId) => DATA_PACKS.find((p) => p.source === personaId) || null;

/** Fresh, empty workspace for a new session. */
export function newWorkspace() {
  return {
    dataPacks: [],      // [{ id, t }] — packs the stakeholders have handed over
    interviews: [],     // [{ personaId, playerSummary, score, feedback }] — C2, graded vs transcript
    painPoints: [],     // [{ id, domain, statement, severity, evidenceRefs:[refId] }]
    findings: [],       // [{ id, statement, evidenceRefs:[refId] }]  refId = pack-* or pp-*
    recommendations: [],// [{ id, statement, findingRefs:[f-*], targetExecs:[personaId] }]
  };
}

/** Grant the source's data pack if not already received. Returns the pack id or null. */
export function grantPack(ws, personaId) {
  const pack = packForSource(personaId);
  if (!pack) return null;
  if (ws.dataPacks.some((d) => d.id === pack.id)) return null;
  ws.dataPacks.push({ id: pack.id, t: Date.now() });
  return pack.id;
}

/**
 * Derived read-model: resolves data-pack details, and computes the two quality
 * signals the gates care about — `unsupported` items (finding with no evidence,
 * reco with no finding) and `unreconciled` stakeholder conflicts (both packs of
 * a conflicting pair received, but no single finding cites both).
 */
export function workspaceView(ws, lang = "en") {
  const L = (v) => (typeof v === "string" ? v : v?.[lang] || v?.en || "");
  const receivedIds = new Set(ws.dataPacks.map((d) => d.id));
  const dataPacks = ws.dataPacks.map((d) => {
    const p = DATA_PACK_MAP[d.id] || {};
    return { id: d.id, source: p.source, type: p.type, title: L(p.title), summary: L(p.summary), conflictsWith: p.conflictsWith || [] };
  });

  const findings = ws.findings.map((f) => ({
    ...f, unsupported: (f.evidenceRefs || []).length === 0,
  }));
  const findingIds = new Set(findings.map((f) => f.id));
  const recommendations = ws.recommendations.map((r) => ({
    ...r,
    unsupported: (r.findingRefs || []).length === 0
      || !(r.findingRefs || []).some((id) => findingIds.has(id)),
  }));

  // Unreconciled conflicts: a conflicting pair where BOTH packs are in the
  // binder but no finding cites both — the player hasn't reconciled the two
  // altitudes (Part D). Deduplicated per pair.
  const unreconciled = [];
  const seen = new Set();
  for (const d of ws.dataPacks) {
    const p = DATA_PACK_MAP[d.id];
    for (const otherId of p?.conflictsWith || []) {
      if (!receivedIds.has(otherId)) continue;
      const key = [d.id, otherId].sort().join("|");
      if (seen.has(key)) continue;
      seen.add(key);
      const reconciled = ws.findings.some((f) =>
        (f.evidenceRefs || []).includes(d.id) && (f.evidenceRefs || []).includes(otherId));
      if (!reconciled) {
        unreconciled.push({
          packs: [d.id, otherId],
          titles: [L(DATA_PACK_MAP[d.id]?.title), L(DATA_PACK_MAP[otherId]?.title)],
        });
      }
    }
  }

  return {
    dataPacks,
    painPoints: ws.painPoints,
    findings,
    recommendations,
    unreconciled,
    counts: {
      packs: dataPacks.length,
      painPoints: ws.painPoints.length,
      findings: findings.length,
      recommendations: recommendations.length,
      unsupported: findings.filter((f) => f.unsupported).length + recommendations.filter((r) => r.unsupported).length,
      unreconciled: unreconciled.length,
    },
  };
}

/** Compact plain-text digest of the binder — fed into the alignment graders. */
export function workspaceDigest(ws, lang = "en") {
  const v = workspaceView(ws, lang);
  const lines = [];
  if (v.painPoints.length) lines.push("PAIN POINTS:\n" + v.painPoints.map((p) => `- [${p.domain || "?"}] ${p.statement}`).join("\n"));
  if (v.findings.length) lines.push("FINDINGS:\n" + v.findings.map((f) => `- ${f.statement}${f.unsupported ? " (UNSUPPORTED — no evidence cited)" : ` (evidence: ${f.evidenceRefs.length})`}`).join("\n"));
  if (v.recommendations.length) lines.push("RECOMMENDATIONS:\n" + v.recommendations.map((r) => `- ${r.statement}${r.unsupported ? " (UNSUPPORTED — no finding cited)" : ""}`).join("\n"));
  return lines.join("\n\n");
}
