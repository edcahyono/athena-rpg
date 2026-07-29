# Handover — session of 2026-07-28

Everything below is committed and pushed to `main` (`91cd3b2`). Nothing is in
progress or half-applied.

---

## 1. API key — RESOLVED 2026-07-28

The local `ANTHROPIC_API_KEY` was replaced and **auth is confirmed working**.
`VOYAGE_API_KEY` was always fine (RAG boots in embeddings mode).

Still to do: **update the key in Render**, or production keeps running on the
revoked one.

Note for future debugging: `node -e` does NOT load `.env`. Use
`node --env-file=.env -e` or the probe falsely reports a missing key.

---

## 2. Run and verify

```bash
npm run dev             # vite, http://localhost:5175
node server/server.js   # api,  http://localhost:3002
npx tsc --noEmit && npm run build
```

Health check: `curl -s -o /dev/null -w "%{http_code}" http://localhost:3002/api/health`

**Always clean synthetic sessions out of `server/data/sessions.json` before
committing** — test runs write real entries there.

---

## 3. What shipped, and what still needs verifying

Five commits this session. All are `tsc`-clean, build-clean and load without
console errors. Each section says what was and wasn't checked.

### `661033c` — gatekeeper checks are now 5 MCQs

Questions come from `track.knowledge` instead of the conversation transcript.
The old version generated questions from the chat you'd just had *and wrote a
bullet summary into the notebook to answer from* — it handed over the answer
key. Wrong answers now get an in-character explanation and a retry.

**VERIFIED 2026-07-28 — and one real bug found and fixed.** Generation was
failing 100% of the time with a bogus 503: `max_tokens: 3000` truncated the
large bilingual JSON mid-array, which parsed to `{}`. Same failure mode already
recorded for the defense questions. Fixed by raising to 8000, tightening option
length, and — because generation is genuinely flaky (it also sometimes returns
2 questions instead of 5) — wrapping it in a **3-attempt retry**. All 7 tracks
now return 5 questions; 2 retries fired across a 6-track run, so the loop earns
its keep.

**Question quality: good, with a caveat.** The questions test real
understanding (revenue quality vs headline growth, why GC net profit can't be
cited, what an EBIT-fell-31%/revenue-fell-13% gap implies). Distractors were
initially weak — several eliminable by absurdity alone — so the prompt now
carries an explicit distractor rule. After it, roughly one weak option per
question remains (the occasional "always", one stray fraud accusation).
**Worth spot-checking a few before a demo**, but it is no longer guessable.

Scoring: credibility scales 50–100% of the track's value by **first-attempt**
accuracy. Unlimited retries, but the score reflects what you knew walking in.
One-line change in `/gatekeeper/answer` if you want flat mastery scoring.

### `681f207` — working-document review is a Lin mission

Triggers at `n >= 3` on F12, **before** the alignment gates, because the
document is read as your synthesis when those are graded. The old `n >= 7`
offer was too late to ever count.

**Unverified: a real submission flipping `workDocDone`** (needs `/review-work`,
which needs the key). Verify: 3+ interviews → talk to Lin → upload → confirm the
flag flips, the objective advances to the interim readout, and the document text
reaches the As-Is grader.

No credibility for the submission itself — the gates award their own. Change if
you disagree.

### `c9ad1db` — greeting NPCs walk to you

They crossed on a clamped row and always finished at their own column, in front
of their desk. Now they cross on row 8 (the only desk-free lane) and stop
`MEET_GAP` tiles from you, facing where they stopped.

**Unverified: the animation.** Keyboard input doesn't reach the Phaser canvas in
the agent browser pane and `window.game` isn't exposed, so no live greeting could
be driven. Geometry was checked across 42 position combinations. **Walk up to
someone on F10 and look.** `MEET_GAP` (OfficeScene.ts) is the distance dial.

Also fixed: Lin's day-one scene stopped her two rows short, and she was never
added to `greeted`, so she replayed her whole walk-out the next time you spoke
to her.

### `ecc64bc` — binder removed, title-screen admin button removed

Admin/QA mode still reachable from the in-game pause menu (**M**).
C2 readouts moved to the end of each interview. Data packs now carry their
content in the notebook entry instead of pointing at the deleted binder.

---

## 4. Traps — things that are not what they look like

**"Unsupported findings block the alignment gates" is FALSE.** The claim lives
only in a comment (`shared/workspace.js:9`). `unsupported`/`unreconciled` appear
nowhere as a gate condition in `routes.js` — they're computed, labelled in the
digest text shown to the grader, and that's all. They influence an LLM
judgement; they hard-block nothing. **Do not put this on a board slide.**

**`server/game/grading.js` looks dead but isn't.** No longer used by the game
after the MCQ change, but `server/eval/graderEval.js:23` still imports it. I
deleted it, broke the eval harness, and restored it. Your grader benchmark now
measures a grader that is no longer in the player's path — retarget or retire it
deliberately.

**Session migrations are lazy.** They run in `getSession()` on access, not at
boot. Restarting the server does not migrate anything. I misread this once and
reported a working migration as broken.

**The agent browser pane can't drive Phaser.** Keyboard events don't reach the
canvas; `window.game` is not reliably exposed. DOM/HUD verification works fine
(`document.getElementById(...).click()`), in-world movement does not.

---

## 5. Open work

| Item | Notes |
|---|---|
| **Update the key in Render** | Local is fixed; production still has the revoked one. |
| `DATA_DIR` for Render | `sessions.json` is on ephemeral disk — progress is lost on redeploy. |
| `PLACEHOLDER` gatekeeper criteria | All seven `REVIEW_CRITERIA` entries are still placeholder text. |
| Tighten MCQ distractors further | ~1 weak option per question survives the new rule. |
| Verify readout grading + Lin upload | Now unblocked; still not exercised end to end. |
| Eyeball the NPC greeting walk | Needs a human; two minutes on F10. |
| `graderEval.js` retarget | Benchmarks a grader no longer in the product. |

---

## 6. Environment notes

- **Disk filled up mid-session** (`ENOSPC`, 0 bytes free) and blocked all writes.
  Currently ~4.6 GB free — still 98% full. Worth clearing more.
- A **fact-forcing hook** requires stating importers, affected API, data schemas
  and the verbatim user instruction before the first edit to any file. It fires
  once per file per session. `ECC_GATEGUARD=off` disables it.
- Ports: vite **5175**, api **3002**.
- This session cost roughly **$400**. Most of it went on repeated codebase
  investigation — this document exists so a fresh session doesn't repeat it.

---

## 7. Design decisions taken, in case you want to revisit

1. MCQ credibility keys off **first-attempt** accuracy, not final. Flat scoring
   means everyone eventually scores full marks and the number stops measuring.
2. Quiz generation **fails closed** (503) rather than falling back to a canned
   quiz. A check passable without domain knowledge is worse than no check.
3. Correct answers never reach the client — `/gatekeeper/quiz` returns questions
   and options only.
4. The document review awards **no** credibility; the gates it feeds award their
   own.
5. C2 was kept when the binder was removed, because it's one of the five
   competencies named in Alice's brief and the binder was its only mechanism.
