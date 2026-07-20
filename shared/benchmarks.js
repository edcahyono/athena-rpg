/**
 * COMPETITIVE BENCHMARKING DIGESTS — distilled from the owner-supplied files:
 *   · Nike中国竞对Benchmarking数据表（CEO、CTO）.xlsx
 *   · Nike中国对Benchmarking数据表（CMO、COO）.xlsx
 *   · Nike中国竞对Benchmarking报告_CPO_CHRO.docx（安踏/阿迪年报为主）
 *
 * One digest per C-suite lens. Injected verbatim into that persona's system
 * prompt (and their mid-level deputy's) as VERIFIED reference data, and used
 * by the board-deck REVIEW_CRITERIA as the standards decks are judged against.
 *
 * FICTION GUARD: the game's Nike baseline stays FY2025 (revenue $6.586B,
 * -13%, EBIT -31%, GM ~46.0%) with the fictional leadership cast. Competitor
 * figures below are the real disclosed numbers from the source files.
 * Real-world Nike leadership/rebrand facts from the sources are deliberately
 * excluded so the simulation cast stays coherent.
 */

export const BENCHMARKS = {
  ceo: `COMPETITIVE LANDSCAPE (disclosed figures; mixed fiscal calendars — flag calendar mismatches when comparing):
- Nike Greater China baseline: FY2025 revenue $6.586B (-13% reported), EBIT $1.602B (-31%), gross margin ~46.0% (-420bps). Channel mix ~55% wholesale.
- Anta Group: FY2025 revenue RMB 80.219B (+13.3%) — first Chinese sportswear group past RMB 80B, and now roughly 2x Nike Greater China's revenue scale. Net profit RMB 13.588B (-12.9% reported; +13.9% excluding a one-off Amer listing gain). Group gross margin 62.0%. Market share 21.8% — #1 in China four years running. Brand split: Anta core RMB 34.754B (+3.7%), FILA RMB 28.469B, other brands (Kolon/Descente etc.) RMB 17.0B (+59.2%). Multi-brand + globalizing (Jack Wolfskin acquisition, PUMA stake).
- Adidas Greater China: FY2025 revenue €3.62B (+13% currency-neutral) — 11 consecutive growth quarters (vs Nike's consecutive decline quarters). "In China, for China" localization strategy; balanced channel growth (wholesale +12%, own retail +13%, e-com +16%). Proof that the 'fewer discounts + localize' path works in this market.
- Li-Ning: FY2025 revenue RMB 29.598B (+3.2%), net profit RMB 2.936B (-2.6%). Running overtook basketball as its #1 category (16%→31% of sales; 26M pairs of professional running shoes). Net cash RMB 19.97B. Single-brand, pro-sports focus, 2025-2028 Chinese Olympic Committee partner.
- Xtep: FY2025 revenue RMB 14.151B (+4.2%); core brand stalling (+1.5%) but Saucony+Merrell +30.8% (still only 11.6% of sales). Claims China's #1 running brand; marathon sub-3h wear-rate above Nike.
- 361°: FY2025 revenue RMB 11.1B (+10.6%), net profit +14% — the only brand with 5 straight years of revenue AND profit growth. 76% of stores in tier-3-and-below cities; value-for-money positioning.
- New forces: HOKA global +24% (~24 China direct stores, now slowing expansion to consolidate); On global +30% with APAC +96.4% — China is On's fastest-growing and second-largest market, 80+ stores targeting 100 by 2026.
STRATEGIC READ: market demand exists — competitors are growing double digits in the same market where Nike declines. The gap is product relevance, price realization and localization speed, not the market.`,

  cfo: `FINANCIAL BENCHMARKS (disclosed figures, for margin/efficiency comparison):
- Nike Greater China baseline: FY2025 revenue $6.586B (-13%), EBIT $1.602B (-31%), gross margin ~46.0% (-420bps: adverse FX + inventory write-downs). EBIT margin ~18-20%. Nike does NOT disclose Greater China net profit or standalone inventory.
- Adidas Greater China: gross margin 52.6% (+2.9pct) — a full ~6-7 points above Nike GC and 1pct above Adidas' own group average; operating margin 22.1% (+1.5pct) — best-in-class for this market. Achieved via price-system discipline (less discounting), not volume.
- Anta Group: gross margin 62.0% — industry's highest (multi-brand premium mix); group operating margin 20.7%; ROE 21.57%; operating cash flow RMB 20.996B (+25.4%). Inventory turnover 123 days; payables 51 days.
- Li-Ning: gross margin 49.4%, operating margin 13.2% (+0.4pct), ROE 10.9%; inventory-to-sales ratio a healthy 4 months; net cash RMB 19.97B.
- Xtep: operating margin 14.3%, ROE 14.5%; receivables at 126 days — far worse than Anta (20-26d) or Li-Ning (13-15d): a working-capital cautionary case.
- 361°: operating margin 15.9%, ROE 13.5%; operating cash flow +1067% — big quality-of-earnings improvement.
- On: group gross margin 62.8% (+2.2pct) — comparable to Anta, showing premium running commands luxury-level margins.
BENCHMARK STANDARDS FOR ANY PLAN: Adidas GC's 22.1% operating margin and 52.6% GM define what disciplined pricing achieves HERE, in this market, now. Anta's 62% GM shows the multi-brand premium ceiling. Any 5-year plan should state its margin-recovery path against these anchors, quantify the discount-tightening/volume-elasticity trade-off, and respect what Nike does/doesn't disclose (EBIT is the profitability measure; never invent GC net profit or inventory figures).`,

  cmo: `BRAND & CONSUMER BENCHMARKS:
- Nike China: brand favorability slid from ~75% to ~42% post-BCI; awareness held, but "favorability" and "made for me" dropped — worst among lower-tier-city youth. 72% of Z-generation consumers now say they'd prefer guochao/local brands first. Consumer sport scenarios shifting from "competition" to commute-lite/weekend-hiking/casual-running. Global-star endorsement model (LeBron/Ronaldo) losing local resonance. Nike Run Club activity and stickiness declining.
- Adidas GC: brand momentum recovered — 11 straight growth quarters; Samba/Gazelle retro wave re-won Z-gen; "In China, for China, love China" narrative lands as 'this brand gets China'.
- Anta: leads guochao cultural identity; Olympic national-team sponsorship + top local celebrities (Wang Yibo, Gu Ailing). Narrative: "Chinese strength / national pride". Consumers moved from buying logos to buying expertise + cultural identity.
- Li-Ning: "China Li-Ning" rewired local sports-fashion narrative; "Chinese creation / cultural confidence"; CBA + local basketball athletes; running now its #1 category — pro-runner word of mouth as brand engine.
- Xtep: owns mass-marathon community credibility (sub-3h wear-rate above Nike); 361° owns value-for-money in tier-3+ cities.
- On: Z-gen + middle-class runner cult brand via community ops (run clubs, triathlon events) — the community playbook Nike Run Club once defined.
STRATEGIC READ: the fight is no longer brand-worship vs brand-worship; it's value-identification and cultural belonging. Competitors answer "does this brand support Chinese athletes / understand my life" — Nike's global-hero narrative currently doesn't. Judgment standard for any brand plan: does it rebuild favorability (not awareness), name a Z-gen emotional connection mechanism, respect the BCI long-tail (every big campaign re-awakens it), and avoid discount-led growth that cheapens the premium narrative.`,

  coo: `OPERATIONS & CHANNEL BENCHMARKS:
- Nike GC baseline: wholesale -13%, Nike Direct -12%, digital -22% in FY2025 — both engines shrinking at once. >70% of footwear capacity in Vietnam/Indonesia. Dealer trust damaged by the DTC-era cuts: major wholesale partners halved 2020-22, gutting lower-tier-city coverage; partners like Topsports now order cautiously (lower futures share, quick-response quotas, reorder on sell-through).
- Adidas GC: balanced three-engine growth (wholesale +12%, own retail +13%, e-com +16%); inventory turnover ~68 days; operating margin 22.1% — discipline, not scale, drives it.
- Anta: (core brand) DTC 53.8% / e-com 37.0% / wholesale 9.2%; ~12,000+ stores across brands; inventory 123 days; new store formats ("Super Anta") hitting ~3x monthly store efficiency of regular doors.
- Li-Ning: direct 22.5% / wholesale 46.6% / e-com 29.5%; 1,026+ "Gen-9" upgraded stores (~RMB 360k monthly store efficiency); inventory-to-sales 4 months; RFID rolling out across all warehouses.
- 361°: 76% of stores in tier-3-and-below — the lower-tier coverage Nike lost when wholesale was cut.
- Instant retail (30-min delivery) runs on dense local store networks as forward inventory: Anta/Li-Ning are structurally advantaged; Nike's thinned physical network is missing this growth window. Li-Ning already on Meituan/Taobao/JD instant platforms.
- Supply-chain responsiveness: local brands' domestic supply chains give shorter lead times and fast reaction; Adidas produces most China-market product locally for in-season response. Nike's SE-Asia concentration means slower response and the quality learning-curve issue (complaint rates rose in the first 2 years post-move, narrowing as yields improve).
JUDGMENT STANDARD FOR ANY OPS PLAN: dealer-trust repair is a 3-5 year stability commitment, not a quarter's initiative; pilots before big-bangs; lower-tier coverage and instant-retail readiness need a physical-network answer; supply-chain response speed needs a China-for-China element, not just cost optimization.`,

  cto: `DIGITAL & TECHNOLOGY BENCHMARKS:
- Nike GC baseline: digital sales -22% (FY2025) — the global App-centric stack sits outside Douyin/Xiaohongshu/Tmall/WeChat where Chinese consumers actually live. Store-digitization pilots expanding (~100 doors incl. House of Innovation).
- Anta: e-commerce 35.8% of group revenue (+15.5%); R&D spend ~RMB 2B (+24%, 2.8% of revenue, six global design/R&D centers); multi-brand flagship operations across Tmall/JD/Douyin; new-format stores at ~3x standard store efficiency.
- Li-Ning: e-com 31% of revenue (+2pct); completed instant-retail integration on all three major platforms (Meituan flash, Taobao flash, JD seconds); "超䨻" capsule midsole tech launched 2025; RFID full-chain warehouse management deploying; committing to AI/big-data fusion investment.
- Xtep: Douyin/WeChat-video/Xiaohongshu channels growing +80%; 160X racing shoe at 6th generation.
- Adidas GC: e-com +16%, fastest of its three channels; balanced platform presence; ~12.4% marketing-spend ratio maintained.
- HOKA: Shanghai flagship "flying-run lab" (plantar-pressure scan, 3D gait analysis, cardio testing) + AI gait-analysis app roadmap — retail-as-tech-experience.
- On: LightSpray one-piece spray-on upper as hero tech; runner-base stores with rental/experience services.
STRATEGIC READ: every winning digital model in this market is platform-native (Tmall/JD/Douyin/WeChat mini-program + private domain), NOT brand-app-centric. Membership economics: growth increasingly promo-acquired with weaker retention — health metrics (organic conversion, repurchase, private-domain scale) beat vanity installs. JUDGMENT STANDARD: digital proposals must name the platform, the funnel metric and the conversion/repurchase target inside China's ecosystems; 'digital transformation' without a platform-native mechanism is a buzzword.`,

  cpo: `PRODUCT & INNOVATION BENCHMARKS (from the CPO benchmarking report; FY2024 annual reports as横向 baseline):
- Nike GC baseline: FY2025 footwear -13% / apparel -12% — simultaneous double-digit declines mean it's NOT a single-category blip; product relevance, launch cadence, discount structure and localization all need scrutiny. Full China SKU price-band distribution undisclosed.
- Anta (product logic): brand matrix separates missions — Anta core = mass professional sport, FILA = premium sport-fashion, Descente/Kolon = high-end outdoor. FY2024: Anta segment RMB 33.52B (+10.6%), FILA RMB 26.63B (+6.1%). R&D ~RMB 2B (2.8% of revenue), six global R&D centers, 70+ universities, 800+ suppliers. Tech commercialization at scale: 安踏膜 waterproof membrane in the 风暴甲 shell jacket; FILA 柔心纱 fabric across 100k+ apparel orders. Expanding into hiking/camping (Kolon MOVE ALPHA, KS-2000).
- Adidas (product logic): Performance × Lifestyle dual engine. Footwear 59% of net sales (up from 57%). Tech-gradient discipline: flagship racing tech (Adizero Adios Pro 4) → Evo SL carries the tech to the €150 point → Duramo SL serves sub-€80 — flagship sets the standard, mainstream spreads it, entry captures scale. Parallel same-year iteration across AE1 basketball, Ultraboost 5, Supernova 2 etc. Shanghai creation center: local design/development/sourcing with the mandate to adjust assortment and launches; most China-market product made locally for in-season speed.
- Amer (niche lesson): Arc'teryx/Salomon prove Chinese consumers pay premium for clear scenarios + credible expertise — pick outdoor scenes where Nike (ACG) has real assets; don't fight specialists everywhere.
- Running-category squeeze on Nike: Hoka (max cushion) and On (Swiss tech) took ¥1000+ serious/middle-class runners; domestic carbon-plate shoes at ¥500-600 deliver marathon performance at half price. Nike is priciest exactly where its story is oldest.
JUDGMENT STANDARD FOR ANY PRODUCT PLAN: fix running & basketball FIRST (assets worth defending), don't spread evenly; build a flagship→mainstream→entry tech gradient with clear price-band missions; move localization from colorways INTO product definition/testing/in-season replenishment; measure innovation by full-price sell-through, tech coverage of mainstream product, replenishment speed, category margin and inventory aging — not by tech announcements.`,

  chro: `ORGANIZATION & TALENT BENCHMARKS (from the CHRO benchmarking report):
- Nike GC baseline: China headcount not separately disclosed (never invent it). Organization in flux: restructuring, tech-function outsourcing, and leadership churn create capability-retention risk. Key risk framing: track KEY ROLES, not total headcount and cost.
- Anta: co-CEO structure + multi-brand group shared platforms (R&D/supply-chain/digital/talent). 2024: ~65,900 employees (+8.9%); staff-cost ratio 14.8% (stable while expanding); revenue per head ~RMB 1.075M. Culture: consumer-first, high standards, cadres lead by example; EVP "超越自我，成就不凡". "高中青" three-generation pipeline + five talent categories (business/cadre/professional/echelon/young). ~3.67M award shares granted to selected employees. Its own annual report lists merchandising, design, IT and supply-chain talent shortage/attrition as a principal risk — the same talent pool Nike competes for.
- Adidas: 4-member executive board with clean functional ownership — CHRO (Michelle Robertson) sits ON the executive board; structured multi-horizon succession planning. 2024: 62,035 employees (+5%), revenue per head ~€382k, turnover 30% (17,711 departures) — high churn managed via a "listen–develop–perform–succeed–DEI" loop: engagement surveys to the board, up-to-40% remote work, digital learning and leadership programs; women in leadership 40.7% → 50% target by 2033.
- Nike-relevant reading of the talent war: local brands poach mid-level backbone with +20-30% comp, higher titles, bigger mandates and faster decisions ("China is the home game, not a branch office"). Post-BCI the employer brand shows structural strain: application volumes hold but offer-acceptance slips when candidates hold local-giant offers; new candidate concerns about foreign brands' long-term China commitment.
JUDGMENT STANDARD FOR ANY ORG/TALENT PLAN: define HQ-vs-local decision rights explicitly (reduce duplicate reporting and cross-timezone waits, not just layers); build a key-talent map around the priority categories (running, basketball, product innovation, retail partners, local digital); pair retention with career-narrative and mandate — not comp alone; make culture observable in hiring/promotion/performance standards; track proactive attrition of key roles, succession coverage and engagement — not just labor cost.`,
};
