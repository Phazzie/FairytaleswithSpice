# Story Lab Real Engine Execution Plan

Created: 2026-05-28 02:20 UTC

## Objective

Make the Story Lab UI drive the real story-generation engine without losing advanced Story Lab intent and without creating a permanent lossy adapter layer.

The app currently has:

- a live Story Lab UI backed by `api/story-lab/*`,
- a working real story-generation engine behind `api/story/generate`,
- mock Story Lab response builders in `api/_lib/story-lab/mockData.ts`.

The target is one production generation engine that accepts the richer Story Lab blueprint as first-class input. Mock generation remains available only as development fallback when no provider key exists.

## Implementation Idea Passes

### Implementation Idea V1

Wire `api/story-lab/stories.ts` to call the existing `StoryService.generateStory()` and map the result back into `StoryIterationPayload`. Keep the current Story Lab UI and generated state panels.

### Hostile Senior Review 1

This sounds like the exact adapter debt the user objected to. If you stuff `logline`, protagonist, world details, and directives into `userInput`, you degrade the prompt and bless a translation layer that will become permanent. Also, continuation will drift because generated Story Lab state will not be meaningful enough for later chapters.

### Revised Idea V2

Extend the real generator contract so the engine receives Story Lab context explicitly:

- logline,
- tone,
- protagonist name,
- antagonist name,
- world details,
- narrative directives,
- full theme seed metadata,
- chapter batch size.

Then add a Story Lab orchestration method that calls the real engine with this richer canonical request and derives Story Lab output from real generated chapters. The mapper is limited to UI envelope shaping, not prompt meaning compression.

### Hostile Senior Review 2

Better, but now you may pollute the older `/api/story/generate` contract with Story Lab-only fields and make both routes harder to reason about. You also have to prove the generator prompt actually uses the fields, not just type-accepts them. If tests only check shapes, quality can still be lost.

### Revised Idea V3

Introduce `generationContext` as an additive field on the real generation input. Existing legacy callers remain valid, while Story Lab calls pass rich context. Update prompt construction to use those fields explicitly and visibly. Add contract/shape tests that assert Story Lab input reaches the real prompt contract and that Story Lab endpoints no longer call mock builders in production paths.

### Hostile Senior Review 3

Do not over-abstract provider switching yet. The real problem is mock-vs-real Story Lab. If you introduce OpenAI/Grok provider ports, model registries, visual redesign, and persistence in the same PR, you will make another monster branch. Also, do not delete mocks; they are useful when no API key exists.

### Final Implementation Idea

For this slice:

1. Add a canonical rich generation context to the real story engine input.
2. Make Story Lab genesis and continuation call the real `StoryService` in production-capable paths.
3. Keep `buildGenesisResponse()` / `buildContinuationResponse()` as explicit mock fallback only when the real engine is unavailable or intentionally in mock mode.
4. Convert real generated chapters into Story Lab chapter/state envelopes without discarding chapter HTML, raw content, cliffhanger flags, trope metadata, or story summary.
5. Leave OpenAI/provider abstraction and visual charm restoration as follow-up work.

## Autonomous Execution Plan Passes

### Exec Plan V1

1. Add a helper under `api/_lib/story-lab/`.
2. Update Story Lab routes to call it.
3. Add tests.
4. Validate.

### Hostile Senior Review 1

This is too vague. It does not say which helpers are canonical, which files are touched, how mocks are protected, or how you will avoid Vercel function-count drift. It also skips continuation, which means the first generation might work but the app workflow still breaks.

### Revised Exec Plan V2

1. Create `api/_lib/story-lab/realStoryEngine.ts` as the Story Lab orchestration layer.
2. Extend `api/_lib/types/contracts.ts` with additive `generationContext`.
3. Update `StoryService.buildUserPrompt()` and chapter prompt paths to read `generationContext`.
4. Update `api/story-lab/stories.ts` and continuation route to call the real orchestrator.
5. Keep mock fallback in the same route behind explicit fallback logic.
6. Add root TSX tests for mapping, fallback, and response shape.
7. Run quick preflight and Node 20 Angular build.

### Hostile Senior Review 2

Naming it `realStoryEngine` may hide that `StoryService` is still the actual engine. Also, route fallback can mask real production failures if you silently fall back from a configured provider failure to mock content. That would make a demo look successful while story quality is fake.

### Revised Exec Plan V3

1. Name the orchestration file `storyLabEngine.ts`.
2. In routes, mock fallback is allowed only when no provider key exists or an explicit mock env flag is set. If a provider key exists and real generation fails, return an error.
3. Add telemetry that reports `engine: 'grok'` for real StoryService calls and `engine: 'custom'` for mock fallback.
4. Add tests for "configured provider failure does not silently mock."
5. Update changelog with the fallback policy.

### Hostile Senior Review 3

Still too much if you try to solve continuation perfectly. You do not have durable state yet, and generated state is partly heuristic. Deliver the smallest honest production win: real genesis, real continuation using previous chapter content, and transparent state heuristics. Document what remains heuristic instead of pretending it is solved.

### Final Autonomous Exec Plan

#### Phase 1 - Real Story Lab Genesis

- Add `generationContext` to the real generation contract.
- Update prompt construction to consume Story Lab context explicitly.
- Add `api/_lib/story-lab/storyLabEngine.ts`.
- Update `api/story-lab/stories.ts` so genesis calls the real engine when `XAI_API_KEY` exists.
- Keep mock fallback only when no provider key exists.
- Add tests for real-engine mapping in mock mode and fallback policy.

#### Phase 2 - Real Story Lab Continuation

- Convert Story Lab continuation state and previous chapters into the real continuation request.
- Return real generated continuation chapters in the Story Lab envelope.
- Preserve prior Story Lab state and add heuristic deltas for new chapters.
- Keep transient persistence honest; do not claim durable storage.

#### Phase 3 - Validation And Review

- Run `git diff --check`.
- Run Story Lab engine tests.
- Run root story tests.
- Run `scripts/recovery/preflight.sh --quick --skip-status`.
- Run Node 20 Angular build.
- Update `PR70_RECOVERY_CHANGELOG.md` and `LESSONS_LEARNED.md`.
- Self-review the implementation against this document before opening a PR.

## Current Known Tradeoffs

- Story Lab state extraction from real prose will initially be heuristic. That is acceptable if documented and not represented as AI-analyzed durable continuity.
- Mocks remain useful for local/no-key development but must not mask production provider failures.
- Provider abstraction for OpenAI vs Grok is intentionally deferred until Story Lab is connected to the real engine.
- Visual charm restoration is product work and should follow this engine unification rather than mix into it.

## Continuation Context Corrections

Recorded 2026-08-24 22:35 UTC. The continuation request built by `storyService`
carries three pieces of prose taken from the story so far. All three were being
read out of the raw markup, where deleting a tag welds the last word of one
paragraph to the first of the next (`door.</p><p>Blood` → `door.Blood`), so what
reached the model was not what a reader sees:

- `extractLastChapterSummary` split the welded text on blank lines, found one
  paragraph for the whole story, and returned its opening 150 words as the
  summary of what just happened. The continuation was told the previous chapter
  ended where it began.
- `generateNextChapterHint` had no whitespace after the full stops for its
  `/(?<=[.!?])\s+/` sentence split, so the "closing sentence" it supplies was the
  entire chapter, cut 200 characters in from the opening.
- `createContextExcerpt` read the same welded text for the trailing excerpt it
  supplies.

All three now go through `api/_lib/utils/storyTextBlocks.ts`, the splitter the
cliffhanger scan and the quality heuristics already share. Prompt shape, request
shape, and the model contract are unchanged — only the text placed into them.

`extractCharacterNames` is deliberately not in that list. It matches `[Speaker]:`
tags against the raw markup and never stripped tags at all, so the welding defect
did not reach it and nothing here changes it.

Validation: `tests/story-service-improved.test.ts` covers the summary reaching
the last paragraphs and the hint being the closing sentence, and both were
verified to fail against the pre-fix implementation. `npm run test:all` passes.

Non-claim: this corrects the context supplied to continuation. It is not
evidence about continuation quality, which needs the live provider and remains
the open work Phase 2 describes.

## Continuation append: the heading strip read a heading that was not there

`renderChapterForAppend` writes each chapter's `<h3>Chapter N: Title</h3>` and
strips whatever heading the model already emitted, so the appended story carries
one heading per chapter rather than two. It read that heading with
`^\s*<h3[^>]*>.*?</h3>\s*`, and the `.` in `.*?` cannot cross a newline. A
heading the model wrapped over two lines therefore matched nothing, the strip
was a no-op, and the chapter went into the combined story carrying both its own
heading and the one written for it. `<h3>Chapter 4: Real\nTitle</h3>` is enough
to reproduce it; no attribute is needed.

Filed as row 2 of #296 with the wrong cause — as the same first-`>` truncation
as the title reader — and corrected in the course of #302. Both are real, and
they are different defects: the truncation alone still strips, because the lazy
`.*?` runs on to the real `</h3>`.

The strip now goes through the scanner in `shared/htmlTagScanner.ts`, which is
the reading `exportSanitizer.ts` already uses, and it has moved out of
`StoryService` into `storyContentAnalysis.ts` as `stripLeadingChapterHeading`,
beside `extractChapterTitleAndBody`, which reads the same heading for the
chapter *title*. It had been a private method reachable only through a model
call, which is why the defect went unnoticed: nothing could call it with a
heading to strip without generating a story first.

What is unchanged: the heading this writes, the `<h3>Chapter N: Title</h3>`
shape, the prompt, the request shape and the model contract. Only which
characters count as the model's own heading changes, and only in the direction
of removing a heading that a browser would show as one.

Validation: `tests/chapter-heading-reader.test.ts`, in `test:all`. The reader is
compared against an independent transcription of the WHATWG start-tag states
over every tag interior of length 1..6 on `{a = " ' > space /}` — 134,008
emitting a tag — and ends the tag where a browser does in all of them, against
133,992 for the pattern it replaces, with 0 cases where it is worse. Eight
counterfactual mutations each fail a suite.

Non-claim: no evidence this was happening in production output. The generator is
prompted to emit a bare `<h3>Chapter N: Title</h3>` on one line. This is found by
reading, and it is worth repairing because a doubled heading is silent and
reader-visible, not because it has been observed.

## Continuation continuity: the activation scorer matched substrings

`buildContinuationGuidance` scores every unresolved thread, artifact,
relationship, and continuity warning against the brief the reader wrote, orders
them by that score, and puts the top few in front of the model. That scoring is
`scoreActivationCandidates` in `shared/continuityActivation.ts`, which both this
path and the Story Lab's "Continuity Preview" panel read so the panel describes
the selection the run actually makes.

It compared with `String.prototype.includes`, and the words a promise is named
after are short. `oath` is inside `loathing`, `pact` inside `impact`, `court`
inside `courtesy`. A brief asking for "the impact of her choice" scored a thread
called `Blood pact` as though it had been named, and a brief mentioning
`loathing` did the same for `Broken oath` — 1 point each, the same point a
genuine mention earns. The whole-candidate score, worth six, was the same
comparison asked of a phrase.

The contract this seam now enforces: a candidate is activated by the brief only
where the brief contains it as whole words. Both sides of the comparison already
pass through `normalizeActivationText`, which leaves letters and numbers
separated by single spaces with no leading or trailing space, so padding each
side with one space makes the containment test exact — the same reading
`containsWholeWord` applies with lookarounds, resting here on the normalizer's
own guarantee instead. That matters because `shared/` sits below both trees and
cannot import `api/_lib/utils/wholeWord`, which is the reason this module is in
`shared/` in the first place.

What is unchanged: the prompt shape, the request shape, and the model contract.
The guidance still lists the same kinds of item under the same headings, still
falls back to unresolved-story priority when nothing is activated, and still
scores candidates additively rather than by their strongest. Only which items
clear the bar changes — and only in the direction of dropping items the brief
never named, which previously displaced items it did.

The endings are kept, and that is not incidental. A whole-word matcher with no
inflection table passes the "no false positives" half of this repair and quietly
costs the scan its real signal — the lesson `continuationGuidance` recorded when
it made the same move. The substring reading picked up `oaths` for `oath` and
`pacts` for `pact` for free, and those are matches it got *right*; dropping them
would trade one silent mis-ordering for another. A brief's word therefore
activates a token when it *begins* with that token and finishes it with one of
the seven endings in `shared/wordInflections.ts`, which is the half of the
substring reading that was sound. That set is now the one declaration for both
readers: `storyQualityHeuristics.ts` builds its regex alternation from it, and
this module reads it as a list, because it matches by string comparison and
cannot see that file.

The collisions stay refused under that rule for a reason worth stating rather
than testing for: `loathing` does not begin with `oath`, `impact` does not begin
with `pact`, and `courtesy` begins with `court` but continues `esy`, which is not
an ending a word keeps its meaning across. The endings that would re-open the
family — `less`, which makes `nameless` out of `name`, and `ly`, which makes
`secretly` out of `secret` — are absent from the shared set for exactly that
reason, and are asserted absent.

The one direction not covered: a candidate token of `oaths` is not matched by a
brief saying `oath`. The substring reading did not do that either, so this is the
behaviour it had rather than a narrowing of it.

Residual, stated rather than left to be found: the allowance is "token plus one
ending", and a few unrelated words are spelled exactly that way. `cove` + `r` is
`cover`; `grove` + `r` is `grover`. Those still activate. It is coverage not yet
bought rather than a regression — the substring reading hit them too, and it hit
`loathing`, `impact` and `courtesy` besides — and it is pinned by an assertion so
the day it changes it is deliberate. Buying it means dropping `r`/`rs` from the
shared set, which would cost `lover` and `lovers` for `love`, the form this genre
actually writes and the reason those endings are in the set. That trade belongs
to whoever owns the shared set, across all of its readers, rather than to this
slice.

Validation: `tests/continuity-activation.test.ts`, in `test:all`. The three
collisions are asserted as zeros, the matches the substring reading got right are
asserted as unchanged (a phrase stated in full still scores whole and by each of
its words; a brief that is nothing but the candidate still activates it at both
ends of the string), and removing the boundary fails the suite.

Non-claim: no evidence this was happening in production output. It needs a brief
containing a word that merely contains one of the story's own. It is worth
repairing because the failure is silent and doubly so — the panel that exists to
show the reader this decision was reading the same scorer, so it agreed with the
prompt about a selection both had wrong.
