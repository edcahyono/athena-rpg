/**
 * WORK-REVIEW CRITERIA — what each reviewer looks for when the player asks
 * them to review a draft (contextually, by talking to that NPC).
 *
 * ⚠ ALL PLACEHOLDERS — the program owner will replace these with the real
 * per-reviewer criteria and pass/fail standards. Edit freely; nothing else
 * references the wording, only the keys.
 *
 * REVIEW_CRITERIA is keyed by supervisor + executive personaId.
 * GATEKEEPER_REVIEW is keyed by trackId (the Deloitte domain managers, who are
 * the primary, low-stakes reviewers you meet before the C-suite).
 */

export const GATEKEEPER_REVIEW = {
  strategy: {
    criteria:
      "PLACEHOLDER — judge as a Deloitte Strategy & Business Design senior manager helping a junior prep for the CEO: is the problem structured MECE, is there one clear thesis with explicit trade-offs, and is it grounded in the case (revenue decline, competition, HQ dynamics)? Verdict: strong / acceptable / weak.",
  },
  finance: {
    criteria:
      "PLACEHOLDER — judge as a Deloitte Finance Transformation reviewer prepping a junior for the CFO: does the work distinguish revenue quality from volume, use disclosed figures correctly (EBIT, not invented net profit), and state cost/payoff/risk/exit for proposals? Verdict: strong / acceptable / weak.",
  },
  marketing: {
    criteria:
      "PLACEHOLDER — judge as a Deloitte Customer & Marketing reviewer prepping a junior for the CMO: is there specific consumer insight (post-BCI favorability, guochao), is brand treated as a long-term asset, and is discount-led growth avoided as a lazy lever? Verdict: strong / acceptable / weak.",
  },
  ops: {
    criteria:
      "PLACEHOLDER — judge as a Deloitte Core Business Operations reviewer prepping a junior for the COO: is the plan executable (pilots before big-bangs), does it acknowledge the channel/dealer damage and the SE-Asia quality chain, and does every idea have a 'how'? Verdict: strong / acceptable / weak.",
  },
  hr: {
    criteria:
      "PLACEHOLDER — judge as a Deloitte Human Capital reviewer prepping a junior for the CHRO: does every initiative have an owner, a capability plan, and a realistic change pace, and does it avoid slogans without mechanisms? Verdict: strong / acceptable / weak.",
  },
  tech: {
    criteria:
      "PLACEHOLDER — judge as a Deloitte Enterprise Technology & Performance reviewer prepping a junior for the VP Tech: are digital proposals specific and measurable (conversion, repurchase, private domain) inside the ecosystems Chinese consumers use, with no buzzwords? Verdict: strong / acceptable / weak.",
  },
  product: {
    criteria:
      "PLACEHOLDER — judge as a Deloitte Consumer Products reviewer prepping a junior for the VP Product: does it engage real product reality — China-specific design, icon-release quality, competitor product parity with Anta/Li-Ning? Verdict: strong / acceptable / weak.",
  },
};

export const REVIEW_CRITERIA = {
  supervisor: {
    reviewer: { en: "Manager Lin", zh: "林经理" },
    criteria:
      "Judge as a Deloitte engagement manager reviewing a junior analyst's working document: (1) is the thinking structured (clear sections, MECE-ish logic)? (2) is it grounded in actual case facts AND the benchmarking research (Anta RMB 80.2B +13.3% / 21.8% share; Adidas GC +13% with 11 growth quarters; Li-Ning running at 31% of sales; On APAC +96%) rather than generic filler? (3) is there a point of view, not just a summary? A draft that never once positions Nike against a named competitor's disclosed numbers is not client-ready. Verdict: strong / acceptable / weak.",
  },
  ceo: {
    criteria:
      "Judge as the CEO: one clear thesis, explicit trade-offs, HQ-approval awareness. BENCHMARK BAR: the plan must reckon with the real landscape — Anta at ~2x our GC revenue with 21.8% share, Adidas GC growing +13% for 11 straight quarters in the SAME market we decline in, and On/HOKA exploding in premium running. A credible plan explains WHY competitors grow while we shrink (product relevance, price realization, localization speed — not 'the market') and sequences offense vs defense accordingly. Penalize wish-lists with no prioritization and any plan that ignores the competitive scale gap. Verdict: strong / acceptable / weak.",
  },
  cfo: {
    criteria:
      "Judge as the CFO: real numbers used correctly, revenue quality distinguished from volume; every proposal states cost, payoff horizon, risk, exit. BENCHMARK BAR: margin targets must be anchored to disclosed comparables — Adidas GC operating margin 22.1% and GM 52.6% (proof that pricing discipline works in this market, vs our ~46.0% GM, -420bps), Anta GM 62% / op margin 20.7% / ROE 21.6%, Li-Ning inventory-to-sales 4 months. A 5-year plan without a margin-recovery path against these anchors, or that invents undisclosed figures (Greater China net profit, standalone inventory), is not investable. Discount-tightening proposals must address volume elasticity. Verdict: strong / acceptable / weak.",
  },
  cmo: {
    criteria:
      "Judge as the CMO: brand equity treated as a long-term asset with specific consumer insight. BENCHMARK BAR: favorability fell ~75%→~42% post-BCI while awareness held — plans must target favorability and 'made for me', not awareness; 72% of Z-gen now leans guochao-first — the plan needs a value-identification / cultural-belonging mechanism, not more global-hero campaigns (Adidas' 'In China, for China' and Anta's national-team + local-star model are the working references); the BCI long-tail re-awakens at every big campaign — plans must address it, not hope it fades. Community is a channel (On's run-club playbook vs our declining NRC). Penalize discount-led growth as a brand lever. Verdict: strong / acceptable / weak.",
  },
  coo: {
    criteria:
      "Judge as the COO: executable — pilots before big-bangs, realistic timelines. BENCHMARK BAR: dealer-trust rebuild is a 3-5 year stability commitment (Topsports-style partners now order futures-light and quick-response-heavy — any wholesale plan must accept that); lower-tier coverage was gutted when wholesale halved (361° runs 76% of its stores in tier-3-and-below — that's who occupies the space we left); instant retail runs on dense local store networks we no longer have; supply-chain response needs a China-for-China element (Adidas produces most China product locally; our >70% Vietnam/Indonesia concentration caps response speed), and the SE-Asia quality learning-curve must be managed, not denied. Reference operational bars: Adidas GC inventory ~68 days, balanced three-channel growth. Penalize plans with no 'how'. Verdict: strong / acceptable / weak.",
  },
  chro: {
    criteria:
      "Judge as the CHRO: every initiative has an owner, a capability plan, and a realistic change pace. BENCHMARK BAR: the talent war is real — local brands poach our mid-level backbone with +20-30% comp, bigger mandates and faster decisions, and post-BCI our offer-acceptance is slipping even as application volume holds; retention plans that only match compensation fail this cohort (the decider is career narrative and delegated authority). Competitor references: Anta's three-generation pipeline + share awards and stable 14.8% staff-cost ratio; Adidas' board-level CHRO, succession planning, and listen-develop-perform loop managing 30% turnover. Plans must define HQ-vs-local decision rights and track key-role attrition/succession, not just headcount cost. Penalize slogans without mechanisms. Verdict: strong / acceptable / weak.",
  },
  cto: {
    criteria:
      "Judge as the VP Technology & Digital: digital proposals must be specific and measurable inside the ecosystems Chinese consumers actually use. BENCHMARK BAR: our digital fell 22% while Anta's e-com hit 35.8% of revenue (+15.5%), Li-Ning's 31% with instant-retail integration on all three major platforms plus warehouse RFID, and Xtep's emerging channels (Douyin/WeChat-video/Xiaohongshu) grew +80% — every winning model here is platform-native (platform flagship + mini-program + private domain), not brand-app-centric. Proposals must name the platform, the funnel metric, and the conversion/repurchase/private-domain target, and address membership HEALTH (organic-conversion retention beats promo-acquired installs). R&D seriousness reference: Anta at ~RMB 2B, 2.8% of revenue. Penalize 'digital transformation' buzzwords with no mechanism. Verdict: strong / acceptable / weak.",
  },
  cpo: {
    criteria:
      "Judge as the VP Product: does it engage with actual product reality? BENCHMARK BAR: footwear -13% AND apparel -12% means portfolio-wide relevance failure, not a category blip. The plan should (1) fix running & basketball FIRST — Hoka/On took the ¥1000+ runner, domestic carbon-plate shoes took ¥500-600, and we're priciest exactly where our story is oldest; (2) build a flagship→mainstream→entry tech gradient with clear price-band missions (Adidas runs racing tech down to €150 and €80 price points; Anta converts group R&D into 100k-order commercial products); (3) move localization INTO product definition/testing/in-season replenishment (Adidas' Shanghai creation center + local-for-local production is the bar), not colorways; (4) measure innovation by full-price sell-through, tech coverage of mainstream product, replenishment speed and inventory aging — not tech announcements. Penalize treating product as an afterthought. Verdict: strong / acceptable / weak.",
  },
};
