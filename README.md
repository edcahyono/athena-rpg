# ATHENA RPG

A retro top-down pixel-art **consulting simulation** for Deloitte's China Consulting
New Analyst Program (CCNAP). You play a new analyst tasked with producing an
**independent 5-year growth strategy for Nike Greater China** — by running a real
engagement inside a Deloitte office tower: framing the problem, interviewing seven
AI-backed Nike executives, benchmarking against named competitors, aligning with the
client, and defending a final pitch to the board.

It is framed as a *simulated engagement*, not a tour and not a quiz. There are hard
gates, and you can fail them.

Live at **[consult-athena.xyz](https://consult-athena.xyz)**. Bilingual throughout
(English / 简体中文).

This project reuses the `consult-athena` chat site's persona/RAG backend
(`shared/personas.config.js`, `shared/promptBuilder.js`, `server/rag/*`) as its
conversation engine.

## Run it

```bash
npm install
cp .env.example .env   # add your ANTHROPIC_API_KEY
npm run dev            # server on :3002 + Vite on :5175
```

Open <http://localhost:5175>. Production: `npm start` (builds, then serves everything
on :3002).

| Command | What it does |
| --- | --- |
| `npm run dev` | Server + Vite dev server with `/api` proxy |
| `npm start` | Production build + serve on one port |
| `npm run ingest` | Rebuild the RAG stores from `qa.source.json` |
| `npm run eval:grader` | Grader calibration harness |
| `npm run eval:injection` | Prompt-injection resistance harness |

## The engagement spine

Progression is the **five-phase engagement lifecycle** (`shared/phases.js`), not the
building. Floors and people are resources you consult *within* a phase. Each phase
has a deliverable and a hard gate; the gate chain is enforced server-side, so you
cannot design a strategy before the client has agreed what is broken.

| # | Phase | Deliverable | Gate |
| --- | --- | --- | --- |
| 0 | Mobilization | Scoping + mandate | Manager Lin approves your framing |
| 1 | As-Is Study | Diagnostic: pain points + evidence | **As-Is Alignment Meeting** (needs ≥3 exec interviews) |
| 2 | Benchmarking | Benchmark conclusion + direction | **Benchmark Alignment Meeting** (needs as-is agreed) |
| 3 | To-Be Design | Draft 5-year strategy | Interim readout to Lin (needs benchmark agreed) |
| 4 | Final Pitch | Board deck + defence | Terminal assessment — 60% deck + 40% defence |

> **Known gap:** Phase 0 currently declares a "work plan + issue tree" deliverable in
> `shared/phases.js`, but no issue-tree builder exists — `mobilize` completes on
> `flags.metSupervisor`. The builder is scoped in
> `docs/DESIGN-consulting-methodology-v2.md` Part G and not yet built.

## The building

Mirrors the real building — there is no floor 13 or 14.

| Floor | Who's there |
| --- | --- |
| 10 | Deloitte engagement team — the seven domain gatekeepers |
| 11 | Nike China middle management — the executives' deputies |
| 12 | Reception — **Manager Lin**, your supervisor. Day one starts here. |
| 15 | Nike Greater China executive floor — the seven C-suite |
| 16 | Boardroom — locked until all seven executives are interviewed |

## The mission model

Seven **tracks** (`shared/gameContent.js`), played in any order. Each pairs a Deloitte
gatekeeper with the Nike executive they prepare you for:

| Track | Gatekeeper prepares you for |
| --- | --- |
| Strategy & Business Design | CEO |
| Finance Transformation | CFO |
| Customer & Marketing | CMO |
| Core Business Operations | COO |
| Human Capital | CHRO |
| Enterprise Technology & Performance | CTO |
| Consumer Products | CPO |

Gatekeepers are **live, unlimited-length conversations** — the low-stakes practice
tier. They know the case deeply but carry deliberate blind spots (budgets, headcount,
their executive's personal views). When you hit one they say so and point you at the
executive who *would* know, and that deflection auto-logs to your notebook as a lead.

Leaving the conversation triggers a **2-question check generated from that specific
conversation**, not a fixed bank. Pass or partial unlocks that executive's calendar on
Floor 15.

Executive meetings are capped at **3 sessions × 8 minutes** each; the board runs
**15 minutes**. Personas track warmth across meetings and mood within one — shallow
questions make them curt, and a bad enough meeting ends early.

## Credibility

Visible standing, accumulated as you go. It is **not** the phase gate — phase
advancement comes from the alignment meetings alone.

| Source | Value |
| --- | --- |
| Opening briefing check | 20 |
| Each of the 7 tracks passed | 40 (280 total) |
| Each interview readout scoring ≥70 | 5 (35 total) |
| As-Is alignment agreed | 25 |
| Benchmark alignment agreed | 25 |
| Interim readout | 30 pass / 15 partial |
| **Maximum** | **~415** |

## The binder

Press **B**. The engagement binder is the structured layer beneath the pixel notebook
(`shared/workspace.js`): log pain points from evidence, synthesize findings, derive
recommendations.

The rule that makes it real — **every finding must cite at least one piece of
evidence, and every recommendation must cite a finding**. Unsupported items are
flagged, as are unreconciled conflicts between stakeholder data packs, and both
**block the alignment gates**.

Data packs are hand-authored from the owner-supplied benchmarking files and handed
over by stakeholders when you genuinely engage them.

## Controls

| Key | Action |
| --- | --- |
| Arrows / WASD | Move |
| **E** | Interact |
| **Q** | Notebook / quest log (exportable as .txt) |
| **B** | Engagement binder |
| **M** | Mission board / menu |
| **F** | Fullscreen |

## Grounding and factual discipline

Personas are RAG-grounded (`server/rag/*`) in a corpus of real disclosed figures.
The design deliberately teaches **disclosure limits**: Nike does not publish Greater
China net profit, inventory, ROE, ROA or ROIC, so only EBIT margin and revenue growth
are validly benchmarkable. The CFO is built to challenge any player quoting a figure
that does not exist, and to reject direct ranking of Nike's pre-overhead segment EBIT
against standalone peers.

Competitor figures in `shared/benchmarks.js` are real disclosed numbers. The Nike
baseline stays FY2025 (revenue $6.586B, −13%; EBIT $1.602B, −31%) with a fictional
leadership cast.

## Architecture

- **Client** — Phaser 3 + TypeScript + Vite. All pixel art is **generated
  procedurally at runtime** in `src/scenes/BootScene.ts` and `src/game/charDraw.ts`
  (~324 textures, no image files). Floor layouts are string grids in
  `src/config/world.ts`.
- **Server** — Node + Express. **Server-authoritative**: credibility, task outcomes,
  unlocks, consumed executive meetings and timers are all enforced server-side, so
  reloading cannot cheat them. The client only autosaves position and notes.
  Sessions persist to `server/data/sessions.json` via `server/game/sessionStore.js`.
- **Models** — `server/anthropic.js`. `CHAT_MODEL` and `LIGHT_MODEL` both default to
  `claude-sonnet-5`.
- **Retrieval** — Voyage `voyage-3.5` embeddings when `VOYAGE_API_KEY` is set,
  falling back to a fully functional BM25 index when it isn't.
- **Hosting** — Render behind Cloudflare.

## Auxiliary consoles

| Route | Purpose | Auth |
| --- | --- | --- |
| `/coach` | Edit the RAG corpus and rebuild persona stores without touching code | `COACH_ADMINS` |
| `/usage` | Token usage and cost | `requireAdminAuth` |

Set `COACH_MODE=false` to hide the coach console entirely before handing the app to
learners.

## Admin / QA mode

The title screen's bottom-right **ADMIN** button prompts for `ADMIN_CODE`; entering it
correctly drops straight into the game with every gate unlocked and every check
auto-passing. Built for flow testing and for staging live demos.

> Admin currently grants 300 credibility (tasks + tracks only) — it skips the
> alignment, readout and interim awards, so the QA state does not match the ~415 a
> real playthrough can reach.

## Environment

See `.env.example`. `ANTHROPIC_API_KEY` is required; everything else has a default.

**Two variables must be overridden in production** — their defaults are published in
this repo:

- `ADMIN_CODE` — otherwise anyone reading the repo can skip the entire engagement.
- `COACH_ADMINS` — otherwise anyone reading the repo can rewrite the grounding corpus.

## Known gaps

Tracked honestly so nobody is surprised:

- **Issue-tree / work-plan builder** — Phase 0's declared deliverable is not
  implemented (see above).
- **`GATEKEEPER_REVIEW` criteria** (`shared/reviewCriteria.js`) still carry a
  `PLACEHOLDER` prefix and are injected into live prompts. The seven C-suite
  `REVIEW_CRITERIA` are fully authored.
- **Grader calibration fixtures** (`server/eval/samples.json`) — 5 synthetic samples
  across 7 tracks, pending owner-supplied real answers.
- **Balance numbers** (`shared/gameConfig.js`) — interaction counts, timers and
  per-check credibility are unvalidated placeholders.
- **HUD objective** — `src/game/objective.ts` never names the two alignment meetings;
  it points at the interim readout while Lin correctly runs alignment first.
- **No automated test suite** — the two eval harnesses test model behaviour, not the
  gate logic.
- **Mobile controls** and Tiled `.tmx` maps remain deferred by design.

## Docs

`docs/DESIGN-consulting-methodology-v2.md` — the v2 design: target capability model
(8 competencies), phase structure, workspace schema, evidence system, alignment
gates, defence stage, and the implementation waves.
