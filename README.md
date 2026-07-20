# ATHENA RPG

Retro Pokémon-style top-down corporate training game for Deloitte's China Consulting
New Analyst Program (CCNAP). You play **Athena**, a new analyst building an independent
5-year growth strategy for Nike Greater China — by exploring a Deloitte office tower,
earning credibility, and interviewing seven AI-backed Nike executives.

This is a separate project from the `consult-athena` chat site, but it **reuses its
persona/RAG backend** (`shared/personas.config.js`, `shared/promptBuilder.js`,
`server/rag/*`) as the conversation engine.

## Run it

```bash
npm install
cp .env.example .env   # add your ANTHROPIC_API_KEY (already copied if you scaffolded locally)
npm run dev            # server on :3002 + Vite on :5175
```

Open http://localhost:5175. Production: `npm start` (builds and serves everything on :3002).

## The loop

1. **Floor 12** — talk to Manager Lin (supervisor, mandatory) → onboarding + first check.
2. **Floor 13** — complete free-response tasks for Deloitte staff (graded by Haiku, credibility-gated).
3. **Floor 14** — Senior Manager tasks (unlocks at credibility **A = 100**, placeholder).
4. **Floor 15** — the 7 Nike C-suite personas (unlocks at **B = 250**, placeholder), each with
   **3 timed 8-minute meetings** (placeholders) — server-enforced, no reload cheating.
5. **Floor 16** — final board meeting: all 7 personas, LLM-routed group replies.
6. Back to Manager Lin for the narrative debrief (NOT the official grade — the written
   strategy document remains the real deliverable).

Floors 10/11 are flavor (IT, facilities). Press **Q** for the notebook/quest log
(auto-collects quotes + your notes, exportable as .txt).

## Tuning

All placeholder balance numbers live in `shared/gameConfig.js` (thresholds, interaction
counts, timers) and `shared/gameContent.js` (tasks, rubrics, credibility values).

## Server-authoritative state

`server/game/sessionStore.js` persists sessions to `server/data/sessions.json`.
Credibility, task outcomes, consumed executive meetings and timers are enforced
server-side; the client only autosaves position and notes.

## Deferred (by design, v1)

Final custom pixel art (textures are procedurally generated placeholders in
`src/scenes/BootScene.ts`), Tiled .tmx maps (layouts are string grids in
`src/config/world.ts`), coach console, mobile controls.
