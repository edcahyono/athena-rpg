# ATHENA — 30-Minute Closeout Presentation Script

**Structure:** Alice's dual-track model. Track A explains *what we designed*.
Track B explains *why it teaches*. Per her guidance, we present the **workflow**,
not a live playthrough — the demo is short and deliberately placed at the end.

**Audience:** mixed — Deloitte leadership and programme designers.
**Runtime:** ~30 minutes. Roughly 4,300 spoken words.
**Rule of thumb:** if you're running late, cut from Track A (§2 world detail),
never from Track B. Track A without Track B is the feature tour Alice warned
against.

---

## 0 · Opening — the core idea [0:00–2:00]

Good morning. Over the past few weeks we built ATHENA: a simulated consulting
engagement that a new analyst plays through, in a browser, in about two to three
hours.

The one-sentence version: **we turned the first month of a consulting
engagement into something you walk through rather than something you're told
about.**

The learner arrives on their first day at a Deloitte office. They are handed a
live client problem — Nike Greater China, revenue down 13%, margins compressed,
domestic competitors taking share. They have to diagnose it, benchmark it,
align with the client, design a five-year strategy, and defend it to a board
that pushes back.

Nobody lectures them. They earn their way to each stage.

I want to be precise about the framing, because it matters. **This is not a game
with a consulting theme, and it is not a guided tour.** It is a simulated
consulting journey. The distinction is that nothing in it is decorative — every
mechanic maps to something a first-year analyst actually has to do, and we'll
show that mapping explicitly in the second half.

---

## 1 · The reasoning behind the design [2:00–5:00]

Start with the problem we were solving.

New-analyst training has a structural weakness: it is mostly **transmission**.
Slides, case readings, a worked example, perhaps a group exercise. It teaches
people *about* consulting. It does not put them in the position of having to
*do* consulting — where the defining experience is not knowing enough and having
to go and find out.

Three specific failures we targeted.

**First — you cannot practise asking good questions by reading.** Question
quality is arguably the core first-year skill, and it is almost never assessed,
because assessing it requires a counterpart who reacts differently to a sharp
question than to a lazy one.

**Second — case studies come pre-digested.** The learner receives a tidy pack of
facts. Real engagements begin with scattered, partial, sometimes contradictory
information held by people with different incentives. The synthesis *is* the
work, and a pre-written case removes it.

**Third — training rarely models the client relationship.** Junior analysts are
surprised by how much of the job is getting a client to *agree* with your
diagnosis before you're allowed to proceed. That isn't a soft skill bolted on
the side. It's a gate.

So the design goal was: **make the learning enjoyable and interactive without
making it shallow.** Every enjoyable mechanic had to carry an assessment
underneath it. If we couldn't answer "what does this measure?", it didn't ship.

---

# TRACK A — The design

## 2 · The framing and the world [5:00–8:30]

ATHENA is a top-down, pixel-art office building. The learner controls an
analyst — their own character, created at the start — and walks the floors,
talking to people.

The building is the curriculum. **Five floors, each a different relationship:**

| Floor | Who's there | What it's for |
|---|---|---|
| **12** | Manager Lin, your Deloitte supervisor | Briefing, alignment meetings, work review |
| **10** | Seven Deloitte domain managers | Coaching and domain checks |
| **11** | Seven Nike mid-level staff | Frontline operational detail |
| **15** | Seven Nike C-suite executives | The client. Timed, limited access |
| **16** | The boardroom | The final pitch and defense |

That vertical structure is not cosmetic. It encodes the **access hierarchy of a
real engagement**: you don't reach the C-suite because you want to. You reach it
because someone senior vouched for you.

## 3 · The roles and what each carries [8:30–12:00]

**The learner is a first-year analyst.** One role, deliberately — this is not a
team-role simulation. The responsibility they carry is the one that matters:
**they own the deliverable.** Manager Lin says so explicitly on day one, and it
is the answer to the very first comprehension check in the game: *your
deliverable is an independent five-year growth strategy — not what the client
tells you to write, but what you conclude after interviewing them.*

Around them sit three tiers of non-player roles, each with a different function.

**Manager Lin — the supervisor.** Briefs each phase, runs the client alignment
meetings, reviews the written work, debriefs at the end. She is the spine of the
experience. If the learner is lost, the answer is always "go and see Lin."

**Seven Deloitte domain managers on Floor 10** — strategy, finance, marketing,
operations, people, digital, product. Each is a coach *and* a gate. They answer
questions about their domain, and they have **deliberate blind spots** — things
they genuinely don't know, which they flag and redirect upward. That redirect is
a designed teaching moment: it models knowing where knowledge sits in an
organisation.

**Seven Nike executives on Floor 15** — CEO, CFO, CMO, COO, CHRO, CTO, CPO.
These are the client, and the scarcest resource in the game. They behave like
real executives: they have moods, they warm to sharp questions, and they cut
meetings short if you waste their time.

**Seven Nike mid-level staff on Floor 11** carry the frontline detail — batch
data, funnel numbers, price bands, exit interviews. Unlimited and untimed. This
is a deliberate lesson: **the detail is downstairs, the judgement is upstairs**,
and a good analyst learns to stop burning executive minutes on questions a
manager could answer.

## 4 · The progression path [12:00–15:30]

There is **no fixed order**, and that's a design decision. The learner picks a
domain track from a mission board. Every track works the same way:

> **Talk to the Deloitte manager → pass their domain check → the matching Nike
> executive unlocks → interview them.**

Seven tracks, any sequence. The engagement itself moves through **five phases** —
Scope, Diagnose, Benchmark, Design, Present — shown as an always-visible tracker,
so the learner always knows where they are in the *consulting lifecycle*, not
just where they are in the building.

Each phase has a deliverable and a gate:

| Phase | Deliverable | Gate |
|---|---|---|
| Scope | Work plan | Sign-off with Lin |
| Diagnose | As-is diagnostic | **As-Is Alignment meeting** |
| Benchmark | Benchmark conclusion | **Benchmark Alignment meeting** |
| Design | Draft five-year strategy | Interim readout accepted |
| Present | Board pitch + defense | The board's verdict |

## 5 · How credibility accumulates [15:30–17:30]

Credibility is the single visible score, and it is earned, never given:

- **+20** — the opening briefing comprehension check
- **+40 per domain check**, seven of them — the largest single source
- **+5 per interview readout**
- **Credibility at each of the two alignment gates**, and **+30** for the interim
  readout

One design choice worth calling out to this audience. On the domain checks, the
learner may retry a question as many times as they need — but **credibility is
awarded on first-attempt accuracy.** They can always reach mastery; the score
still records what they knew walking in. Unlimited retries with a flat award
would mean everyone finishes on full marks and the number stops measuring
anything.

## 6 · Earning the right to present [17:30–19:00]

This is the part I'd most like to land, because it's the spine of the design.

**The boardroom on Floor 16 is locked.** It opens only when all seven executives
have been interviewed — which means passing all seven domain checks first. Before
the board convenes, the learner must also have cleared both client alignment
meetings and had an interim readout accepted by Lin.

So the final presentation is not a level you arrive at. **It is a privilege you
accumulate.** That mirrors the real thing more honestly than any amount of
instruction about it: nobody hands a first-year the client-facing moment. They
earn it by being right in front of enough people.

## 7 · Where quizzes, interactions and submissions appear [19:00–21:00]

Three assessment surfaces, each in a different register.

**Quizzes — the domain checks.** Five multiple-choice questions per track,
generated from the manager's own domain knowledge base. Get one wrong and the
manager explains the reasoning in character, then asks again. You can walk out
mid-check, go and ask more questions, and come back.

I want to be candid about this one, because it's the clearest example of the
design being corrected. **The original version generated the quiz from the
conversation you had just had — and wrote a summary of that conversation into
your notebook to answer from.** It was a reading-comprehension test of a chat
still on screen. It looked like assessment and measured nothing. We rebuilt it to
draw from the domain knowledge base instead, so the only way through is to learn
the material.

**Stakeholder interactions — the interviews.** Free-form conversation with every
persona. Executives are limited to **three meetings of eight minutes each.** The
clock is real, and the meeting is consumed the moment you walk in — which forces
preparation. There's a prep panel for queuing questions before the timer starts.

**Submissions — written work.** Three points. An interview readout at the end of
each executive meeting, graded against the actual transcript. A working document
handed to Manager Lin — written in Word, PDF or Markdown, in whatever tool the
learner prefers — which she audits, and which is then read as their own synthesis
when the alignment gates are graded. And the final board deck.

---

# TRACK B — The consulting-learning process

## 8 · The workflow the game is actually teaching [21:00–24:00]

Everything I've just described is a delivery mechanism for one thing: **the shape
of a consulting engagement.** Same five stages, same order, same dependencies.

**Scope.** Understand what you've been asked to produce before you produce
anything. In-game: the briefing with Lin, and a comprehension check on whose
strategy this is. *Skill: knowing the deliverable.*

**Diagnose (as-is).** Establish what is actually true today, from primary
sources, organised by domain rather than by whoever you happened to speak to
first. In-game: the interviews, the domain checks, the readouts. *Skills: C1
asking effective questions, C2 summarizing information, C4 structured
problem-solving.*

**Benchmark.** Compare against relevant, comparable evidence — and know what you
*cannot* benchmark. The data here is real: Nike Greater China's EBIT trajectory,
Anta's and Li-Ning's positions, Adidas's recovery. Crucially, the CFO persona
**refuses to invent figures Nike doesn't disclose.** *Skill: C5 analytical rigor.*

**Align.** Get the client to agree before proceeding. Two hard gates. You state
your as-is diagnosis, the client challenges it, you revise. Only then may you
benchmark. *Skills: C7 stakeholder alignment, C3 synthesize findings.*

**Design and Present.** Convert an agreed diagnosis into a defensible
recommendation, and hold it under challenge. The board doesn't accept the deck —
it interrogates it with five pointed questions from different executive
perspectives. *Skills: C6 evidence-based recommendation, C8 communication and
defensibility.*

## 9 · The competency model underneath [24:00–26:30]

We designed this backwards from capability, not forwards from features. Eight
competencies; the four Alice named map directly.

| | Competency | How the game exercises it | How it's evidenced |
|---|---|---|---|
| **C1★** | Ask effective questions | Live interviews; personas reward sharp questions | Persona mood; the blind-spot facts you surface |
| **C2★** | Summarize information | Readout after each interview | Graded against the real transcript |
| **C3★** | Synthesize findings | Working document handed to Lin | Her review, plus the alignment gates |
| C4 | Structured problem-solving | Diagnosis organised by domain | Alignment gate grading |
| C5 | Analytical rigor | Benchmarking with real data | Benchmark gate; no fabricated figures |
| C6 | Evidence-based recommendation | The strategy document | Board deck rubric |
| C7 | Stakeholder alignment | Two alignment meetings | Revision after challenge |
| C8★ | Communication & defensibility | Board pitch and defense | Deck score + live defense answers |

★ = Alice's named skills.

The claim we're making is not "this is fun, so people will learn more." It is
narrower and more defensible: **every stage produces an artefact that can be
assessed, and the assessment is against something objective** — a transcript, a
disclosed figure, a cited piece of evidence, a client's stated objection.

## 10 · How this equips a new consultant [26:30–28:00]

Three things a learner leaves with that a slide deck cannot give them.

**They have been wrong in front of a client and had to revise.** The alignment
gates are hard gates. Stating a diagnosis, being challenged, and rewriting it is
the single most transferable experience in the simulation.

**They have felt scarcity.** Three meetings, eight minutes. Every learner wastes
their first executive meeting. That lesson costs nothing here and is expensive to
learn on a live engagement.

**They have produced a defensible document.** Not a worksheet — a real strategy
document, written in a real tool, reviewed against professional criteria.

---

## 11 · How we built it [28:00–29:00]

Briefly, because the audience deserves to know what's underneath.

**All in-game intelligence runs on Claude Sonnet 5** — every persona
conversation, the question generation, the readout grading, the alignment
judgements, the board's challenge questions. One model, chosen for the balance of
reasoning quality and cost at the volume a cohort generates.

**The application itself was built with Claude Opus 4.8, Opus 5 and Fable 5**,
used as engineering collaborators across the build.

**Voyage AI provides the embeddings** for retrieval, so each persona answers from
their own curated knowledge base rather than from general knowledge — that's what
keeps the CFO talking like the CFO. Worth noting: there is a **built-in
keyword-search fallback**, so if that service is ever unavailable the game
degrades in answer quality but keeps running. No single vendor can take it down.

**GitHub** for version control — every change reviewed and reversible.
**Render** for hosting, so a cohort reaches it with a URL and no installation.

## 12 · Demo and close [29:00–30:00]

*[Short demo — 60–90 seconds, pre-loaded to a known state. Do not attempt a
playthrough. Suggested: walk up to a Floor 10 manager, ask one question, take one
domain-check question, get it deliberately wrong, and show the manager explaining
and re-asking. That single loop demonstrates the whole pedagogy.]*

To close on Alice's framing: the goal was to make this **more enjoyable, more
interactive and less tedious — without making it less rigorous.** The test of
that isn't whether people enjoyed it. It's whether, at every point where the
learner was enjoying themselves, something real was being measured.

That's what the second half of this presentation was for.

---

# DELIVERY NOTES — read before presenting

**⚠️ Three things to fix or avoid saying.**

1. **`shared/competencies.js` is out of date.** Its stored evidence lines for
   **C3** and **C6** describe the engagement binder, which has been removed, and
   **C2** references the old exit quiz. The table in §9 reflects what the code
   does *now*. Don't present from the file until it's updated.

2. **Do not claim unsupported findings "block" the alignment gates.** A comment
   in the codebase says so; the code never enforced it. The flags are shown to
   the grader and influence its judgement — they hard-block nothing.

3. **Verify the exact credibility figure for the two alignment gates** before
   quoting a number. Every other figure in §5 is confirmed from the code.

**Timing.** Track A is §2–7 (~16 min); Track B is §8–10 (~7 min). If you overrun,
cut the floor-by-floor table in §2 and the mid-level staff detail in §3.

**Questions to expect from this audience.**
- *"How do you stop the AI making things up?"* → Personas are instructed to
  refuse rather than invent, and are grounded in curated per-persona knowledge.
  The CFO demonstrably declines to state figures Nike doesn't disclose.
- *"How long does it take?"* → Two to three hours, resumable.
- *"How do you know it works?"* → Be honest: the assessment surfaces are built
  and produce scores, but it has not yet run with a cohort. Say that plainly — a
  mixed academic audience will trust the rest of the presentation more for it.
- *"What did you get wrong?"* → Use the quiz story from §7. It's your strongest
  credibility moment, not your weakest.
