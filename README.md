# MINDVAULT

An endless reasoning and puzzle game that runs entirely in the browser, plus a separate campaign of hand-written murder mysteries.

- **Endless Reasoning**: puzzles are generated on demand from seeded rule systems. Each one is checked for a single defensible answer before you see it, and comes with three progressive hints and a full explanation.
- **Murder Mysteries**: six authored cases. Each has a victim, four or five suspects, statements, evidence, red herrings, an evidence board, a timeline and an accusation. Every case is checked by a formal verifier so that the full evidence points to exactly one culprit.

Statistics in MINDVAULT are practice statistics. They are **not** an IQ score or a validated measure of intelligence.

## Running it locally

Requirements: Node.js 20.19+ or 22.12+ (needed by Vite 7) and npm.

```bash
npm install          # the repo's .npmrc sets legacy-peer-deps
npm run dev          # http://localhost:5173 with hot reload
```

Production build:

```bash
npm run build        # type-checks, then builds into dist/
npm run preview      # serves dist/ at http://localhost:4173
```

`dist/` is a static site that uses relative paths and a hash router, so it can be hosted from any folder or static host.

Offline play: in a production build, a service worker precaches every built file on the first visit. After that the whole game works without a network, including the mysteries and puzzle generation. The dev server does not register the service worker.

## What's in the game

### Endless Reasoning

There are 34 generator families across seven categories:

| Category | Families |
|---|---|
| Visual patterns | 3×3 matrices (Raven-style attribute rules), 2×2 visual analogies, visual sequences, odd one out |
| Fluid reasoning | symbol transformation rules, number machines, rule induction (accepted/rejected cards), symbol equations |
| Logic & deduction | ordering, round-table seating, weekly schedules, logic grids, truth-tellers and liars, logical implication |
| Spatial | rotation & reflection, paper folding, cube nets, grid navigation, shape assembly |
| Observation & memory | sequence recall, location memory, spot the difference, change detection, detail recall, comparing records |
| Riddles & teasers | number sequences, numerical teasers, matchstick equations, counting figures, "What am I?", letter riddles, anagrams, classic riddles |
| Lateral thinking | yes/no investigation scenarios, multiple-choice explanations, free-text explanations with self-comparison |

**Puzzle contents.** Every puzzle has:
- an id, seed and generator version;
- a category and difficulty;
- instructions and locally drawn SVG visuals;
- a hidden rule and the answer, or a list of accepted answers;
- three progressive hints;
- an explanation with the answer, rule, steps, why each alternative fails, and the skills involved;
- a structural fingerprint used to avoid repetition.

**Play options:** Show Hint, Reveal Answer (which ends the attempt as unsolved), Skip (not counted as wrong), Pause (hides the puzzle and stops the timer), Save, and Replay.

**Session setup.** Choose a single category or mix any of them. Mixed play never repeats a category twice in a row. Other options:
- a fixed difficulty, or adaptive difficulty tracked separately for each category;
- timed or untimed;
- hints on or off;
- a session of 10, 25 or unlimited puzzles.

**Daily challenge.** Five puzzles from different categories, rising in difficulty. They are derived from the date, so everyone running the same version of the game gets the same set.

**Difficulty tiers:** Initiate, Analyst, Investigator, Mastermind. Each tier changes rule count, number of distractors, depth of the deduction chain, grid size and exposure time, calibrated per family.

### Murder Mysteries

| # | Case | Setting |
|---|---|---|
| 1 | The Keeper of Gull Rock | a tidal-island lighthouse museum and a rising sea |
| 2 | The Silent Auction | a gallery charity gala and an office door that logs every code |
| 3 | Cue Thirty-Four | a theatre dress rehearsal and a falling counterweight |
| 4 | Death Under the Perseids | a mountain observatory during a meteor shower |
| 5 | The Northern Star | an overnight sleeper train with a locked connecting door |
| 6 | The Victoria House | a tropical glasshouse and a thermometer that noticed every door |

**Investigation.** Interview suspects, inspect evidence, and pin items to the board. Pair a statement with a piece of evidence to test whether they contradict each other. Not every lie is a confession: the red herrings are deliberate. Then accuse a culprit, name the method and pick your key evidence.

**Scoring.** Your first accusation in each case is recorded separately from replays. You can replay a case, or give up and read the full solution.

## Architecture

```
src/
  engine/              pure TypeScript, no React
    rng.ts             seeded PRNG (mulberry32 + cyrb53 hash)
    types.ts           Puzzle, Visual, Interaction, Answer, Explanation …
    generator.ts       generator contract + shared choice builder
    registry.ts        buildPuzzle / regeneratePuzzle / generatePuzzle (bounded retries)
    validation.ts      shared validator every puzzle must pass
    answers.ts         answer checking, free-text normalisation and matching
    diversity.ts       fingerprints, bounded history, novelty scoring
    visual/            attribute + rule engine for visual puzzles
    logic/             CSP solver (solution counting + narrated deduction)
    spatial/           polyominoes, cube nets and folding
    content/           authored riddles, lateral cases, word lists
    generators/        the 34 generator families, by category
  mysteries/           case data, types and the formal case verifier
  state/               storage wrapper, progression, persisted collections, daily set
  ui/                  React screens, puzzle player, inputs, SVG renderers
  styles/global.css
build/sw-template.js   service worker template (vite.config.ts fills in the file list)
```

### How a puzzle is made and checked

1. **Seeding.** A puzzle is a pure function of `(generator, version, difficulty, seed)`. The RNG is seeded from the generator, difficulty and seed, so the same reference always rebuilds the same puzzle. A reference from a different generator version is refused rather than rebuilt differently.
2. **Generation.** `generate()` builds a candidate. It throws `RejectCandidate` when the candidate is unsound: for example, more than one rule fits, a distractor is also correct, or a clue set does not pin down a unique solution.
3. **Generator check.** Each generator's own `verify()` re-derives the answer independently:
   - Logic puzzles go through the CSP solver, which counts solutions and must find exactly one.
   - Visual puzzles use rule-hypothesis enumeration: every rule that fits the shown cells must predict the same answer.
   - Truth-teller and implication puzzles are checked exhaustively over all assignments.
   - Cube nets are checked by folding.
   - Matchstick equations enumerate every possible single move.
4. **Shared check.** `validatePuzzle()` then enforces the general contract:
   - exactly one correct option, and a reason for every distractor;
   - hints that don't leak the answer;
   - an explanation that names the answer;
   - JSON-serialisable output.
5. **Bounded retries.** Generation retries with fresh seeds, up to 80 attempts per generator and a 4-second hard limit. It never loops forever.

### Anti-repetition and memory

- **Fingerprints.** Each puzzle carries a fingerprint: a structural key (the rule combination), feature tokens and an exact-detail key.
- **History.** A bounded history of recent fingerprints (40 per category, 220 in total) penalises exact repeats, recently seen structures and overused features. Selection prefers under-used combinations.
- **Reset.** You can reset this history from History or Settings.
- **Storage.** Only puzzle references and seeds are stored, never puzzle bodies. Everything persisted is bounded: 100 recent puzzles, 100 saved, 30 sessions, 60 daily records and 20 accusations per case. A long session stays in the tens of kilobytes.
- **Generation and storage failures.** Puzzles are generated one at a time, with one prefetched. Storage writes go through a defensive wrapper:
  - if writes fail, it falls back to memory;
  - when the quota is hit, it trims the larger lists and retries;
  - corrupted data is sanitised on load.

### Accessibility

- Shading is always encoded twice, as a pattern and a colour.
- Every interaction works from the keyboard.
- Screen-reader labels describe the visuals and options.
- Optional settings: larger text, high contrast, reduced motion (which follows the system setting by default) and longer memorisation time.

## Testing

```bash
npm test                      # all unit, generator and UI tests (Vitest)
npm run typecheck             # tsc -b
MV_SEEDS=200 npm test         # generator sweep with 200 seeds per generator per difficulty
PROBE=logic npm test -- probe # rejection-rate report for generators whose id starts with "logic"
```

What the suites cover:
- **Generators** (`src/engine/__tests__/gen.*.test.ts`). Every generator is run at every difficulty over many seeds; the default is 40, and `MV_SEEDS` raises it. Each accepted puzzle must:
  - pass the shared validator;
  - accept its correct response and reject a wrong one;
  - have exactly one correct option;
  - rebuild identically from its reference.

  Generators must also stay productive and varied.
- **Core** (`core.test.ts`):
  - RNG reproducibility;
  - free-text matching;
  - the CSP solver;
  - cube nets: exactly the 11 nets and 24 views;
  - matchstick moves;
  - sequence rules and figure counting;
  - visual rule inference;
  - integrity of the authored content;
  - surface-cue checks: the correct written option must not be systematically the longest, and matchstick options include true equations that can't be reached in one move.
- **Diversity** (`diversity.test.ts`): history bounds and novelty scoring.
- **Mysteries** (`src/mysteries/mysteries.test.ts`): each case passes the formal verifier, which checks that:
  - exactly one suspect could have committed the murder in the time window;
  - every listed contradiction really holds;
  - each elimination cites the evidence that excludes the suspect;
  - the culprit is exposed by at least one contradiction.
- **State** (`src/state/state.test.ts`):
  - XP and levels;
  - first attempts kept separate from replays and practice;
  - skip and reveal semantics;
  - adaptive promotion and demotion;
  - daily streaks and the deterministic daily set;
  - sanitisers and bounded memory;
  - storage failure handling: corrupt JSON, quota errors with retry, unserialisable values.
- **UI** (`src/ui/ui.test.tsx`, run in jsdom):
  - answering correctly and incorrectly, and seeing the explanation;
  - progressive hints and the reveal confirmation;
  - typed answers, self-comparison and the multiple-choice fallback;
  - the memorise phase;
  - home and navigation, and starting a session;
  - a full mystery accusation flow, with the first result kept separate;
  - the screen error boundary.

## Known limitations

- **Lateral thinking and classic riddles draw on finite authored sets.** There are 22 scenarios plus two parametric families, and about 45 classic riddles, alongside generated word and number riddles. The anti-repetition history keeps repeats apart, but these categories will recycle sooner than the generated ones.
- **Free-text answers are matched heuristically.** Matching uses normalisation, light stemming, small edit distances and negation checks against explicit accepted answers. When an answer isn't recognised, the game shows the accepted answers and lets you compare your own wording. Answers you count yourself are marked self-assessed. Open lateral explanations are always self-assessed against key points.
- **Difficulty and adaptivity are design heuristics, not psychometric calibration.**
  - Tiers are set by generator parameters.
  - Adaptive play promotes when your average over the last six first attempts is at least 0.78, with at least five attempts.
  - It demotes when that average is 0.3 or below.
- **Daily-challenge consistency.** The set is consistent for a given app version. A generator version bump changes it, and older saved references from that generator are reported as unavailable rather than silently altered.
- **The mysteries are a finite campaign by design.**
