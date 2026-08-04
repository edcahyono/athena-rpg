# ATHENA — Complete System Workflow

Every operation the system performs, from process boot to the closing debrief,
with each Anthropic API call marked at the point it fires.

Diagrams are Mermaid. GitHub renders them natively; in VS Code use the Markdown
Preview Mermaid extension.

**Verified against the code on 2026-08-03.** Line references are to the commit
this document was added in. Grep before trusting a line number.

---

## 1. Topology

Three processes' worth of concern in one Node server, plus a static client.

```mermaid
flowchart TB
  subgraph Client["Browser — Vite/Phaser bundle"]
    BS["BootScene<br/>generates all textures"]
    IS["IntroScene"]
    OS["OfficeScene<br/>world, movement, NPCs"]
    UI["DOM overlay<br/>panels, dialogue, HUD"]
  end

  subgraph Server["Express — server/server.js"]
    GR["/api/game/*<br/>game/routes.js"]
    CR["/api/coach/*<br/>coach/routes.js<br/>gated by COACH_MODE"]
    US["/usage dashboard"]
    ST["static dist/"]
  end

  subgraph Data["Persistence — paths.js decides repo vs DATA_DIR"]
    SESS["sessions.json"]
    USAGE["usage.json"]
    QA["qa/qa.source.json"]
    RAG["rag-store/*.json"]
  end

  subgraph External["External APIs"]
    ANTH["Anthropic Messages API"]
    VOY["Voyage embeddings<br/>optional"]
  end

  Client -->|JSON over HTTP| GR
  Client --> ST
  GR --> SESS
  GR --> ANTH
  GR --> RAG
  RAG --> VOY
  CR --> QA
  CR --> RAG
  CR --> ANTH
  ANTH --> USAGE
```

**Key design property:** the server is authoritative for every gate. The client
renders guidance and can be lied to; it cannot unlock anything. Each gate is
enforced a second time in the route that would benefit from it.

---

## 2. Server boot

```mermaid
flowchart TD
  A["node server/server.js"] --> B["seedDataDir()"]
  B --> C{"DATA_DIR set?"}
  C -->|no| D["Use repo paths.<br/>Filesystem is ephemeral on Render."]
  C -->|yes| E["mkdir the disk tree"]
  E --> F{"qa.source.json<br/>already on disk?"}
  F -->|no| G["Copy repo seed across"]
  F -->|yes| H["Leave it alone —<br/>a coach wrote it, it is newer"]
  G --> I
  H --> I
  D --> I["loadStores()"]
  I --> J["Read rag-store/*.json<br/>skip meta.json + gatekeeper-knowledge.json<br/>skip anything without a docs array"]
  J --> K{"Any store carries<br/>embeddings AND<br/>VOYAGE_API_KEY present?"}
  K -->|yes| L["Retrieval mode: cosine similarity"]
  K -->|no| M["Retrieval mode: bilingual BM25"]
  L --> N["loadGatekeeperKnowledge()"]
  M --> N
  N --> O["Read gatekeeper-knowledge.json<br/>into memory, per track"]
  O --> P{"COACH_MODE !== 'false'"}
  P -->|true| Q["Mount /coach + /api/coach<br/>behind requireCoachAuth"]
  P -->|false| R["Coach surface absent entirely"]
  Q --> S["app.listen(PORT)"]
  R --> S
```

Boot is **fail-loud but non-fatal**: a missing store directory logs a warning and
disables retrieval rather than crashing, so the game still runs with personas
answering from their static `knowledge` only.

---

## 3. Content pipeline — coach console to persona memory

This is the only path by which knowledge enters the game. It runs entirely
outside a play session.

```mermaid
flowchart TD
  A["Coach opens /coach<br/>authenticates against COACH_ADMINS"] --> B["GET /api/coach/chunks<br/>returns 15 folders + counts + filenames"]
  B --> C["Coach picks ONE folder<br/>7 execs · 7 gatekeepers · general"]
  C --> D["POST /api/coach/upload<br/>x-folder + x-filename headers, raw body"]
  D --> E["fileToText()<br/>pdf / docx / txt / md / json / csv"]
  E --> F["Truncate at 200k chars"]
  F --> G["segmentText()<br/>split on paragraph breaks, ~3800 chars"]
  G --> H["Return jobId immediately<br/>extraction continues in background"]
  H --> I["For each segment:<br/>LLM CALL 16 — extractSegment()"]
  I --> J["callAnthropicRaw + tool_choice record_chunks<br/>returns tool_use block, NOT text"]
  J --> K["Normalize ids, dedupe, collect proposals"]
  K --> L["Client polls GET /upload/status/:jobId"]
  L --> M["Coach REVIEWS proposals in the UI"]
  M --> N{"Approve?"}
  N -->|no| Z["Discard — nothing was ever saved"]
  N -->|yes| O["POST /commit/:jobId"]
  O --> P["Every pair tagged personas:[job.folder]<br/>source: job.filename"]
  P --> Q["writeSource() — snapshot to qa/backups/ first"]
  Q --> R["POST /api/coach/ingest"]
  R --> S["runIngestion()"]

  S --> T["Split chunks by folder"]
  T --> U["GATEKEEPER folders<br/>pulled out first"]
  T --> V["EXEC + GENERAL folders"]
  U --> W["Compile whole into<br/>gatekeeper-knowledge.json<br/>60k soft cap per track"]
  V --> X["Fold general into EVERY exec store"]
  X --> Y["Build BM25 tf/df/len per persona"]
  Y --> AA{"VOYAGE_API_KEY?"}
  AA -->|yes| AB["Embed retrievable chunks only"]
  AA -->|no| AC["BM25 only"]
  AB --> AD["Write rag-store per persona"]
  AC --> AD
  W --> AE["loadGatekeeperKnowledge() hot reload"]
  AD --> AF["loadStores() hot reload"]
```

**Why the split matters.** Executive folders become *searchable* indexes queried
per question. Gatekeeper folders are *not* searchable — they are pasted whole
into the prompt that writes the quiz, because a quiz author needs the entire
syllabus at once, not the three chunks nearest a query.

**Isolation is structural.** Each persona's index physically contains only its
own folder plus `general`. The CFO cannot surface the CTO's material regardless
of phrasing, because that material is not in the file being searched. This is
not a prompt instruction that could be talked around.

---

## 4. Client boot and session start

```mermaid
sequenceDiagram
  participant U as Player
  participant B as BootScene
  participant SS as startScreen
  participant API as GameAPI
  participant SV as sessionStore

  U->>B: load page
  B->>B: procedurally draw EVERY sprite
  B->>B: export portraits to FACES map
  B->>SS: show language + character creator
  U->>SS: pick en/zh, build avatar
  SS->>API: POST /session
  API->>SV: create or resume session
  SV-->>API: sessionId + state
  API-->>SS: publicState — transcripts stripped
  SS->>U: IntroScene, then OfficeScene at F12
```

`publicState()` is the trust boundary: full interview transcripts live
server-side and are never shipped to the browser.

---

## 5. The engagement — full progression

The spine. Five phases, each closing with Manager Lin except where noted.

```mermaid
flowchart TD
  START(["Spawn at F12 reception"]) --> M1["Talk to Manager Lin"]
  M1 --> M2["dialogue-check — deterministic MCQ<br/>no LLM"]
  M2 --> M3["flags.metSupervisor = true<br/>+credibility"]
  M3 --> M4["linToolsBrief + linWorkPlan<br/>notebook handed over"]
  M4 --> M5["Case brief PDF downloads<br/>to the player's computer"]
  M5 --> M6["linBriefDiagnose"]
  M6 --> PHASE1

  subgraph PHASE1["PHASE 2 — AS-IS / DIAGNOSE"]
    T1["Open mission board M<br/>pick any of 7 tracks"] --> T2["F10 — talk to the gatekeeper"]
    T2 --> T3["LLM CALL 3 — gatekeeper reply"]
    T3 --> T4["TAKE CHECK"]
    T4 --> T5["LLM CALL 4 — write 5 MCQs<br/>FROM THIS CONVERSATION"]
    T5 --> T6["Answer them — graded by<br/>integer comparison, no LLM"]
    T6 --> T7{"All 5 correct<br/>eventually?"}
    T7 -->|no| T6
    T7 -->|yes| T8["task.status = passed<br/>credibility scaled by first-try<br/>accuracy, 50% floor"]
    T8 --> T9["Matching F15 executive UNLOCKED"]
    T9 --> T10["F15 interview — see section 6"]
    T10 --> T11{"All 7 tracks passed?"}
    T11 -->|no| T1
    T11 -->|yes| T12["Write the diagnosis in your OWN document"]
    T12 --> T13["Take it to Lin — upload or paste"]
    T13 --> T14["LLM CALLS 11 + 12<br/>grade + claim-by-claim verify"]
    T14 --> T15{"Every claim<br/>supported?"}
    T15 -->|no| T16["Flagged claims returned<br/>with Lin's corrected wording"]
    T16 --> T12
    T15 -->|yes| T17["alignments.asis.agreed = true<br/>+25 credibility"]
  end

  T17 --> PHASE2

  subgraph PHASE2["PHASE 3 — BENCHMARK"]
    B1{"All 7 executives<br/>interviewed?"} -->|no| B2["Lin refuses the meeting"]
    B2 --> B1
    B1 -->|yes| B3["Submit benchmark conclusion"]
    B3 --> B4["LLM CALL 11 — gradeAlignment"]
    B4 --> B5{"Agreed?"}
    B5 -->|no| B3
    B5 -->|yes| B6["alignments.benchmark.agreed = true"]
  end

  B6 --> PHASE3

  subgraph PHASE3["PHASE 4 — TO-BE / DESIGN"]
    D1["Draft the 5-year strategy"] --> D2["Interim readout to Lin"]
    D2 --> D3["LLM CALL 13 — grade readout"]
    D3 --> D4{"pass or partial?"}
    D4 -->|fail| D1
    D4 -->|yes| D5["flags.interimDone = true<br/>+30 or +15"]
  end

  D5 --> PHASE4

  subgraph PHASE4["PHASE 5 — PITCH"]
    P1{"7 interviews AND<br/>interimDone?"} -->|no| P2["403 — board will not convene"]
    P1 -->|yes| P3["F16 boardroom unlocks"]
    P3 --> P4["Optional: LLM CALL 7<br/>pre-submit deck review"]
    P4 --> P5["Pitch — LLM CALL 5 per turn"]
    P5 --> P6["LLM CALL 6 — board verdict"]
    P6 --> P7["LLM CALL 9 — challenge questions"]
    P7 --> P8["LLM CALL 10 — grade the defence"]
    P8 --> P9["Score = 60% deck + 40% defence"]
  end

  P9 --> F1["Return to Lin on F12"]
  F1 --> F2["LLM CALL 15 — closing debrief"]
  F2 --> F3["flags.debriefDone = true<br/>+15 credibility"]
  F3 --> DONE(["Engagement complete —<br/>requires debriefDone"])
```

---

## 6. Executive interview loop (F15)

The most expensive loop in the system: two LLM calls per player turn.

```mermaid
sequenceDiagram
  participant P as Player
  participant C as Client
  participant R as GameRoutes
  participant RAG as Retriever
  participant A as Anthropic

  P->>C: approach executive
  C->>R: POST /interaction/start
  R->>R: requireTrackPassed — 403 if check not passed
  R->>R: decrement meeting budget, start 8-min timer
  R-->>C: expiresAt

  loop each question, until time or budget out
    P->>C: type a question
    C->>R: POST /chat
    R->>RAG: retrieve(personaId, query)
    RAG->>RAG: cosine OR BM25, whichever mode booted
    RAG->>RAG: apply relevance floor
    Note over RAG: Below the floor returns NOTHING.<br/>Never pad the prompt with noise.
    RAG-->>R: top-N chunks or empty
    R->>A: LLM CALL 1 — personaReply (CHAT_MODEL)
    A-->>R: in-character reply
    R->>R: scanNumericGrounding — flag ungrounded figures
    R->>A: LLM CALL 2 — classifyQuestion (LIGHT_MODEL)
    A-->>R: depth rating
    R->>R: adjust warmth — persists to the debrief
    R->>R: append to server-side transcript, log quotes
    R-->>C: reply + updated state
  end

  P->>C: end meeting
  C->>R: POST /interaction/end
  opt player writes a readout
    C->>R: POST /workspace/summary
    R->>A: LLM CALL 8 — score it (LIGHT_MODEL)
    A-->>R: score 0-100
    R->>R: +5 credibility if 70 or above
  end
```

**Warmth** is a hidden per-executive score of question quality. It never blocks
anything; it surfaces at the debrief, where shallow questioning is named.

---

## 7. As-Is verification — the anti-hallucination gate

The most interesting logic in the codebase. Two LLM calls with different jobs.

```mermaid
flowchart TD
  A["Player uploads or pastes<br/>their as-is diagnosis"] --> B{"Typed answer<br/>present?"}
  B -->|no| C["Fall back to workDoc.text —<br/>the document already given to Lin"]
  B -->|yes| D["groundingEvidence()"]
  C --> D
  D --> E["Collect last 40 quote/fact<br/>entries from the quest log"]
  D --> F["retrieve() across ALL 7 personas<br/>using the submission as the query"]
  E --> G["evidence bundle:<br/>transcripts + corpus"]
  F --> G
  G --> H["LLM CALL 12 — verifyAsIs (LIGHT_MODEL)"]
  H --> I["Per-claim verdicts:<br/>supported / unsupported / contradicted<br/>each with evidence + a correction"]
  I --> J{"claims > 0 AND<br/>zero bad verdicts?"}
  J -->|no| K["clean = false"]
  K --> L["Return flagged claims<br/>with Lin's corrected wording"]
  L --> M["Player revises and resubmits"]
  M --> A
  J -->|yes| N["clean = true"]
  N --> O["LLM CALL 11 — gradeAlignment"]
  O --> P["asis.agreed = true, +25"]
```

**What this checks is grounding, not truth.** A claim passes if it is supported
by the transcripts or the project files. If the coach uploads something false,
a claim repeating that falsehood is "supported". The gate stops invention, not
error — worth stating plainly to anyone who asks whether it validates accuracy.

---

## 8. Complete Anthropic call inventory

Every call in the product. `CHAT_MODEL` and `LIGHT_MODEL` both default to
`claude-sonnet-5` and are independently overridable by environment variable.

| # | Site | Fires on | Model | Purpose | RAG? |
|---|------|----------|-------|---------|------|
| 1 | `routes.js:166` `personaReply()` | every `/chat` and `/board/chat` turn | CHAT | Executive or deputy replies in character | **yes** |
| 2 | `routes.js:180` `classifyQuestion()` | every `/chat` turn | LIGHT | Rate question depth, drives warmth | no |
| 3 | `routes.js:413` | `/gatekeeper/chat` | CHAT | Gatekeeper briefing conversation | no — compiled knowledge |
| 4 | `routes.js:491` | `/gatekeeper/quiz` | LIGHT | Write 5 MCQs from the conversation just had | no |
| 5 | `routes.js:767` | `/board/chat` | LIGHT | Board-room judgment during the pitch | no |
| 6 | `routes.js:820` | `/board/end` | LIGHT | Final board verdict | no |
| 7 | `routes.js:880` | `/board/review-deck` | CHAT | Pre-submission deck critique | no |
| 8 | `routes.js:956` | `/workspace/summary` | LIGHT | Score an interview readout 0-100 | no |
| 9 | `routes.js:997` | `/board/defense/questions` | LIGHT | Generate per-executive challenge questions | no |
| 10 | `routes.js:1032` | `/board/defense/grade` | LIGHT | Grade the live defence | no |
| 11 | `routes.js:1139` `gradeAlignment()` | `/alignment/asis`, `/alignment/benchmark` | LIGHT | Agree or reject an alignment submission | no |
| 12 | `routes.js:1219` `verifyAsIs()` | `/alignment/asis` | LIGHT | Claim-by-claim grounding check | **yes** |
| 13 | `routes.js:1386` | `/interim` | LIGHT | Grade the interim readout | no |
| 14 | `routes.js:1477` | `/review-work` | CHAT | Audit an uploaded working document | no |
| 15 | `routes.js:1575` | `/debrief` | LIGHT | Closing narrative feedback | no |
| 16 | `coach/routes.js:228` `extractSegment()` | `/api/coach/upload`, per segment | CHAT | Document to Q&A pairs via `tool_use` | no |
| 17 | `grading.js:16` | **offline eval only** | LIGHT | Legacy 2-question quiz grader | no |
| 18 | `injectionEval.js:43` | offline eval | CHAT | Probe a persona with an injection attempt | no |
| 19 | `injectionEval.js:63` | offline eval | LIGHT | Judge whether the guard held | no |

### Transport behaviour, applied to all of the above

```mermaid
flowchart LR
  A["callAnthropic / callAnthropicRaw"] --> B["POST /v1/messages"]
  B --> C{"HTTP status"}
  C -->|2xx| D["Record tokens + cost<br/>to usage.json"]
  C -->|"408 409 429 500 502 503 504 529"| E{"attempt < 3?"}
  E -->|yes| F["Honour Retry-After if sent,<br/>else 500ms x 2^n + jitter"]
  F --> B
  E -->|no| G["Throw — route returns 500"]
  C -->|other 4xx| G
  D --> H{"Raw variant?"}
  H -->|yes| I["Return full response —<br/>tool_use blocks + stop_reason"]
  H -->|no| J["Return concatenated text only"]
```

`callAnthropic()` discards non-text blocks. Anything relying on `tool_use`
**must** use `callAnthropicRaw()` — this was a real bug that made coach upload
silently impossible.

---

## 9. What is deliberately NOT an LLM call

Worth knowing, because it is where the system is fast, free and deterministic.

| Operation | Mechanism |
|---|---|
| MCQ answer marking | `choice === m.correct` integer comparison |
| Credibility arithmetic | `track.credibility * (0.5 + 0.5 * firstTryRatio)` |
| Lin's opening dialogue check | Fixed options, fixed correct index |
| Every phase gate | Boolean flags on the session |
| Executive unlock | `tasks[taskId].status === "passed"` |
| Board unlock | 7 interviews AND `interimDone` |
| Engagement completion | `board.done && board.result && debriefDone` |
| Phase derivation | `syncEngagement()` — first incomplete phase wins |
| Objective guidance | `computeObjective()` — pure function of state |
| Meeting budget and timers | Server-side counters and timestamps |
| Persona knowledge isolation | Separate files on disk |

The rule: **LLMs judge prose; arithmetic and gates are code.** No gate anywhere
depends on a model returning well-formed output.

---

## 10. Persistence and failure modes

```mermaid
flowchart TD
  A{"DATA_DIR set?"} -->|no| B["Everything under the repo checkout"]
  B --> C["On Render: WIPED on every deploy AND restart.<br/>Learner progress and coach uploads both vanish<br/>with no error logged anywhere."]
  A -->|yes| D["Everything under the mounted disk"]
  D --> E["Survives deploys. Repo copies become<br/>first-boot seed only — a later deploy<br/>will NOT overwrite coach edits."]
  E --> F["Consequence: wiping the repo corpus does<br/>NOT wipe production. The disk is authoritative."]
```

| Failure | Behaviour |
|---|---|
| No `ANTHROPIC_API_KEY` | Coach upload 500s with a clear message; game chat throws |
| Anthropic 529 overloaded | Retried up to 3 times, then surfaced |
| No `VOYAGE_API_KEY` | Silent, correct fallback to BM25 |
| RAG store missing | Warning; retrieval disabled; personas use static knowledge |
| Store file malformed | That file skipped with a warning; others still load |
| Model returns unparseable JSON | Graders default to the **harsh** outcome — never award credit for garbage |
| Retrieval finds nothing relevant | Returns empty rather than padding the prompt |

---

## 11. Known stale paths

Honest notes for whoever maintains this next.

- **`server/game/grading.js`** documents itself as backing a live
  `/gatekeeper/grade` endpoint. That endpoint no longer exists — the check is
  now 5 MCQs marked deterministically. The module is reached only by
  `server/eval/graderEval.js`, so the offline calibration harness is grading a
  prompt production never runs.
- **`shared/workspace.js`** and the `/workspace/add` and `/workspace/remove`
  routes are partially vestigial. Data packs are still granted and stored, but
  the structured authoring panel that consumed them was removed from the client.
- **`ws*` strings in `src/i18n.ts`** describe an "Engagement Binder" panel that
  no longer renders. Nothing reads most of them.
- **`shared/reviewCriteria.js`** still carries 7 `PLACEHOLDER` entries, so
  per-executive document-review standards are not fully authored.
