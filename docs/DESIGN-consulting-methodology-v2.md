# ATHENA RPG — v2 Design & Plan: Consulting Methodology as the Backbone

**Status:** proposal, for owner review (responds to Alice's Week-N review feedback).
**Author:** design pass, 2026-07-21.
**Core thesis:** today the game's backbone is *the building* (floors, access-gating, "who do I
unlock next"). Alice's feedback says the backbone must be *the consulting engagement
lifecycle*. Everything else she raised — formal workspace, evidence/data packs, "don't build a
tower from flat ground", the defense stage, backward design — are consequences of that reframe.

This document does three things:
- **Part A** — backward design: the target capability model (skills → activities → evidence →
  assessment). Per Alice pt 16: define the outcome first, design mechanics around it.
- **Part B** — the phase structure: floor → phase → deliverable → gate.
- **Part C–F** — the supporting systems: consultant workspace, evidence/data packs, alignment
  gates, defense stage.
- **Part G** — gap analysis vs. the current build + phased implementation waves.

---

## PART A — Target Capability Model (backward design)

**The graduate profile:** after completing ATHENA, a Deloitte new joiner should be able to run
the spine of a real engagement — diagnose a client's current state from primary interviews,
benchmark it against comparable players, align findings with the client before proceeding,
synthesize evidence into a defensible recommendation, and defend that recommendation under
challenge.

Eight competencies, each mapped to the game activity that exercises it, the evidence that proves
the player developed it, and the assessment that grades it. The five capabilities Alice named
explicitly are tagged **[Alice]**.

| # | Consulting skill | Game activity that exercises it | Evidence the player developed it | Assessment / assignment |
|---|---|---|---|---|
| C1 | **Ask effective questions** **[Alice]** (client interviewing; sharp, role-relevant probes) | Live interviews with gatekeepers, mid-level staff, and C-suite; personas reward specific questions and visibly cool on lazy/generic ones (mood system) | Question-quality classifier score per turn; count of substantive vs shallow questions; whether the player surfaced the deliberately-hidden blind-spot facts | Interview scorecard per session; credibility only accrues from substantive lines of questioning |
| C2 | **Summarize information** **[Alice]** (distill signal from a long exchange) | Post-interview: player writes/edits the interview summary in the workspace (not just the auto-summary) | Player-authored summary graded against the actual transcript for accuracy + concision | Short exit quiz reworked to test comprehension of *what mattered*, not recall of trivia |
| C3 | **Synthesize findings** **[Alice]** (connect evidence across sources into findings) | Workspace: link data-pack evidence + interview points → named "findings"; reconcile conflicting stakeholder inputs | A findings set where each finding cites ≥1 piece of collected evidence; conflicts explicitly resolved | As-Is diagnostic gate (Part E-1); synthesis rubric on evidence→finding links |
| C4 | **Structured problem-solving** (MECE issue trees, hypothesis-driven) | Mobilization: player structures the problem into a work plan before interviewing (issue tree builder) | A MECE-checked issue tree; interviews tagged to the branch they test | Work-plan gate at end of Phase 0 (supervisor reviews structure) |
| C5 | **Analytical rigor / benchmarking** (interpret data, compare like-for-like, respect disclosure limits) | Benchmarking phase: build a Nike-vs-peer comparison from the data packs; the CFO methodology rules (segment-EBIT caveat, "can/cannot benchmark") are live traps | A benchmark table using only comparable metrics; no fabricated/undisclosed figures; relative strengths & weaknesses named | Benchmark alignment gate (Part E-2); auto-check for methodology violations |
| C6 | **Evidence-based recommendation** (findings → to-be direction, no unsupported leaps) | To-be design: every recommendation in the workspace must link back to findings; unsupported recos are flagged | Recommendation set where each reco traces finding → evidence; "tower from flat ground" blocked | Deck rubric (already built) checks evidence linkage per stakeholder |
| C7 | **Stakeholder alignment** (present back, absorb pushback, revise) | The two alignment meetings + the two interim-readout rounds; clients challenge and can reject | Player revised work after client challenge at least once; agreement reached before advancing | Alignment gates are hard gates — cannot proceed without client sign-off |
| C8 | **Communication & defensibility** (exec-ready storyline; defend under fire) **[covers Alice "intermediate assignments"/midterm-style]** | Interim readouts (midterm-style assignments), final deck, and the new **defense stage** where execs challenge the pitch | Deck structure score + live defense answers under time pressure | Final score = deck rubric (0–100) **+** defense performance (Part F) |

**"Intermediate assignments resembling midterm work" [Alice]** are realized as: (1) the Phase-0
**work plan**, (2) the Phase-1 **as-is diagnostic**, (3) the Phase-2 **benchmark conclusion**, and
(4) the two **interim readouts** — each is a submitted, graded intermediate deliverable, not just a
conversation.

---

## PART B — Phase Structure: Floor → Phase → Deliverable → Gate

**The reframe:** an always-visible **Engagement Tracker** (5 phases) becomes the primary
progression. Floors/people are *resources you consult within the current phase*, not the
progression itself. The existing cast and unlock mechanics are preserved — they now live *inside*
Phase 1. This directly answers Alice pt 2 ("make the business process the backbone, not navigation")
and pt 9 ("don't build a tower from flat ground").

| Phase | Floor(s) / setting | What the player does | Deliverable (submitted) | Gate to advance |
|---|---|---|---|---|
| **0 · Mobilization** | F12 Reception + Manager Lin | Receive the mandate; structure the problem into a MECE issue tree; draft an interview/work plan | **Work plan + issue tree** | Supervisor (Lin) reviews the structure — MECE-ish, hypotheses stated, right people targeted. Revise until approved. |
| **1 · As-Is Study** (diagnosis) | F13–F14 gatekeepers (earn access) → F11 mid-level → F15 execs (timed) | Interview across all 7 domains to diagnose the current state; collect data packs; log pain points with evidence | **As-Is diagnostic** (pain points + evidence, per domain) | **As-Is Alignment Meeting** (Part E-1): present back to a client panel; they confirm, correct, or reject; revise until agreed. |
| **2 · Benchmarking** | Benchmark data packs + targeted exec follow-ups | Compare Nike vs Anta / Li-Ning / Adidas / Xtep / 361°; identify relative strengths & weaknesses; propose a growth direction | **Benchmark conclusion + recommended direction** | **Benchmark Alignment Meeting** (Part E-2): client disputes irrelevant comparisons; player must justify relevance and land agreed priorities. |
| **3 · To-Be Design** | Workspace synthesis; optional exec re-consults | Build the 5-year strategy from agreed priorities; link every reco to findings | **Draft strategy deck** | **Interim readouts to Lin** (2 rounds, already built) — midterm-style feedback before the board. |
| **4 · Final Pitch + Defense** | F16 Boardroom | Present the deck to all 7 execs; then **defend** against their challenges | **Final deck + defense transcript** | Terminal assessment: deck rubric score (0–100) + defense score + per-stakeholder ✓/✗ checklist. |

**Floors that don't map to a phase** (F10 IT, flavor NPCs) stay as texture — explicitly *not*
gated or graded, so they don't dilute the learning spine (Alice pt 1: revise creative elements that
don't teach a consulting behavior — we keep these as optional color, not required path).

**Ordering rule (the anti-"tower" gate):** Phase N+1 content is locked until Phase N's alignment
gate passes. You cannot benchmark before your as-is is agreed; you cannot design the to-be before
the benchmark direction is agreed; you cannot pitch before the interim readout. This is the
structural core of Alice pts 7, 8, 9.

---

## PART C — Consultant Workspace Schema (the "formal notebook")

Alice pt 4: the pixel notebook is fine for the playful layer but not for serious analysis. Add a
**visually distinct, formal workspace** — think "engagement binder", not cartoon. Game stats
(credibility) accrue automatically; *consulting insight cannot* — the player must author it.

Proposed data model (server-authoritative, persisted per session):

```
workspace = {
  engagementLog: [        // auto + manual timeline, Day 1 / Day 2 / …
    { day, phase, t, kind: "interview"|"datapack"|"gate"|"note", ref, summary }
  ],
  interviews: [
    { id, personaId, phase, t,
      autoSummary,          // system-generated
      playerSummary,        // C2: player writes/edits this — graded
      keyQuotes: [ ... ],   // notable lines the player clipped
      dataPacksReceived: [dataPackId, ...] }
  ],
  dataPacks: [             // Part D — concrete artifacts from stakeholders
    { id, source: personaId, phase, title, type: "financials"|"channel"|"brand"|"org"|"product"|"digital",
      content, conflictsWith: [dataPackId?], analyzed: bool }
  ],
  painPoints: [           // C3 building blocks
    { id, domain, statement, severity, evidenceRefs: [ {kind:"interview"|"datapack", id} ] }
  ],
  findings: [             // C3/C6 — each MUST cite evidence
    { id, statement, phase, evidenceRefs: [...], conflictResolved: bool }
  ],
  recommendations: [      // C6 — each MUST cite findings (no orphan recos)
    { id, statement, findingRefs: [...], targetExecs: [personaId, ...] }
  ],
  notes: [ { id, text, tags: [...], links: [refs] } ],
  deliverables: {         // the submitted intermediate assignments
    workPlan, asIsDiagnostic, benchmarkConclusion, interimReadouts: [], finalDeck
  }
}
```

**Workspace is directly usable for the final deliverable:** the deck builder reads
`findings` + `recommendations` + linked `evidenceRefs`, so a player who kept a disciplined
workspace can assemble a defensible deck; one who didn't, cannot. Export targets: Markdown first
(trivial), then DOCX/PPTX via the extraction/generation tooling already in the repo (Alice pt 4
"support PowerPoint, Word, or Markdown if feasible").

---

## PART D — Evidence / Data-Pack System

Alice pt 5: interactions should sometimes yield concrete project materials, not only dialogue.

- **Stakeholders hand over data packs.** e.g. VP Finance → a margin-bridge pack; COO/Legend Wang
  → a channel + quality-complaint report; CMO/Su Qing → brand-tracking data; CHRO/Cindy Zhao →
  attrition & exit-interview extract. Grounded in the real benchmarking data already in the repo.
- **Some packs conflict** (C3): e.g. the CFO frames the decline as discount-driven margin erosion;
  the CMO frames the *same* revenue drop as brand-favorability collapse. The player must reconcile
  — both are true at different altitudes — and say so in a finding. Unreconciled conflicts are
  flagged at the As-Is gate.
- **Packs must be cited.** A finding with no evidence ref, or a reco with no finding ref, is
  surfaced as "unsupported" and blocks the relevant gate.
- **Received packs live in the workspace** and are the raw material the deck builder draws on.

---

## PART E — Alignment Gates (the heart of the feedback)

### E-1 · As-Is Alignment Meeting (after Phase 1)

Alice pt 7 + 9. A real consultant presents the diagnosis back and confirms a shared starting point
before proceeding.

- Player submits the **as-is diagnostic** (pain points + evidence).
- A **client panel** (CEO + 2–3 relevant execs) responds in character: confirm what's right,
  **challenge** what's wrong/missing, flag misread priorities.
- Player must **revise and resubmit** until the client agrees. Agreement is a hard gate to
  benchmarking.
- Assessment: did the diagnosis match reality (accuracy), and did the player incorporate the
  pushback (responsiveness)?

### E-2 · Benchmark Alignment Meeting (after Phase 2)

Alice pt 8 + 9.

- Player submits the **benchmark conclusion**: where Nike is stronger/weaker vs named peers, and a
  recommended growth direction.
- Client **disputes irrelevant comparisons** ("that dimension isn't a priority for us") and
  **methodology errors** (using undisclosed Nike-China ROE as if it existed — already a live trap
  in the CFO logic).
- Player justifies relevance or drops the comparison; agreed priorities become the *only* sanctioned
  inputs to the to-be design. Hard gate to Phase 3.

Both gates reuse the existing persona + grading infrastructure (LLM-graded against a rubric, with
revise-loops), so this is incremental, not a new engine.

---

## PART F — Final Pitch + Defense Stage

Alice pt 14/15. The final proposal is not uploaded-and-auto-scored in isolation.

1. Player submits the final deck (existing upload + rubric scoring, already built).
2. Each of the 7 execs poses **1–2 challenge questions** from their lens (a thesis-defense panel).
3. Player answers in a **timed defense thread**.
4. **Final score = deck rubric (0–100) + defense score**, with the per-stakeholder ✓/✗ checklist
   already built. The defense tests whether the player *understands and can defend* the reco, not
   just whether the document looks polished.
5. **Recipient is configurable** (Alice pt 15): "present to the CEO/board" for the sim, or
   re-target to **"Professor Guo"** for classroom deployment; rubric-scored with optional instructor
   override rather than fully automated.

---

## PART G — Gap Analysis vs. Current Build + Implementation Waves

**Already live (partial credit — reduces scope):**
- Intermediate feedback / interim readout to Lin, 2 rounds — Alice pt 6, she said 2 is sufficient. ✅
- Final deliverable score 0–100 + per-stakeholder ✓/✗ checklist — Alice pt 14 (minus the defense). ✅
- Real FY21–25 benchmarking data + zero-hallucination + methodology traps — the raw material for
  Phase 2 and E-2. ✅ (as grounding; not yet a player-facing phase)
- Notebook — exists, but "cute", must be upgraded to the formal workspace. ⚠️
- Timed/limited exec meetings, mood system, question-quality classifier — the engine for C1. ✅

**Genuinely new work:**
- The Engagement Tracker + phase gates (B) — the backbone.
- Two alignment meetings (E-1, E-2).
- Formal workspace + evidence/data-pack system (C, D).
- Defense stage (F).
- Issue-tree / work-plan builder (Phase 0).
- Quizzes reworked from recall → judgment (C2), evidence-linkage checks (C3/C6).

**Suggested waves** (each independently shippable & testable end-to-end — Alice pt 10):

- **Wave 1 — Backbone + gates** (pts 1,2,7,8,9): Engagement Tracker, phase locking, the two
  alignment meetings. Converts "navigate a building" → "run an engagement". Highest leverage.
- **Wave 2 — Workspace + evidence** (pts 4,5): formal workspace UI + schema, data packs, evidence→
  finding→reco linkage, Markdown export.
- **Wave 3 — Defense + learning-outcome polish** (pts 3,14,16): defense stage, judgment-based
  quizzes, per-activity learning-outcome copy, credibility tied to demonstrated behaviors,
  configurable recipient / instructor scoring.

**Testing mandate (Alice pt 10):** each wave is played start→finish in the browser, verifying every
submission, gate, feedback loop, and score — and specifically that evidence collected early is
available and useful at the deck/defense stage.

---

## Open decisions for the owner (please react)

1. **Competency list (Part A)** — approve the 8 competencies, or add/remove? This is the foundation
   everything else is designed backward from.
2. **Phase↔floor mapping (Part B)** — keep the building and overlay phases (proposed), or physically
   re-theme floors as phases?
3. **Scope of Wave 1** — is the backbone + 2 alignment gates the right first milestone, or do you
   want the formal workspace in the first wave too (they're somewhat coupled)?
4. **Classroom vs sim framing** — build the configurable "Professor Guo / instructor override"
   recipient now, or defer until a real course deployment is confirmed?
5. **Data-pack authoring** — should data packs be authored by hand from the benchmarking files, or
   generated per-session by the model from the persona's knowledge? (Hand-authored = consistent &
   controllable; generated = more varied but needs guardrails.)
