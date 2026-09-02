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

## Continuation Heat Contract: what reaches the prompt, and what the seam refuses

Recorded 2026-08-28 UTC. The continuation request carries a `HeatContract`, and
all three of the fields it puts in front of the model were read differently from
the way the genesis path reads the same object. The contract this seam now
enforces:

**A continuation is refused when its Heat Contract names a tension mode or
intimacy boundary the app does not have.** Every genesis route reaches the engine
through `parseStoryLabBlueprint`, whose `isHeatContract` reads both fields with
`parseOneOf` against `HEAT_TENSION_MODES` and `HEAT_INTIMACY_BOUNDARIES`.
Neither continuation route parses a blueprint — the story route spreads the
request body, and `normalizeContinuationInput` on the job route ends
`heatContract: partial.heatContract` — so both arrived as whatever the body
held, and `formatContinuationStoryLabContext` wrote them into the constraint
block through `formatBlueprintIdLabel`, a bare `split('_').join(' ')`. A tension
mode carrying a newline rendered as its own `- ` line among the app's own
bullets; a non-string threw `value.split is not a function` out of the prompt
builder. `heatContractVocabularyError` in `continueStoryLab` answers both with
`INVALID_REQUEST` naming the field, before any prompt is built.

This is the half left open by the `adultOnlyConfirmed` gate beside it, whose own
comment named these two fields as reaching "the prompt through
`generationContext`" and then closed only the flag. Refused rather than
defaulted, the way genesis refuses: these fields decide how explicit the chapter
is, and choosing a value for a caller who named one the app does not have is
choosing that on their behalf.

**The no-go list is bounded and whitespace-collapsed on the continuation path,
as it already was on genesis.** It was read with a bare `.trim()`, which is the
one exception to the rule `limitStoryLabPromptText` states for itself — that
every Story Lab field reaching a prompt goes through it, "the Heat Contract's
no-go list" named among them. With no continuation route capping the field, that
was its only bound, so 50,000 characters reached the model whole; and with no
collapse, the newline `withMergedContentBoundaries` deliberately writes put the
reader's profile-wide boundaries on a bare line inside a block of `- ` bullets,
where nothing distinguished them from one of the app's own constraints.

**Both sources of that list survive to the prompt.** The field carries two: a
request's own `noGoContent` and the reader's profile-wide `contentBoundaries`,
joined by `withMergedContentBoundaries`. Bounding the merged value at one
source's cap deleted the other — a request at its own cap kept 320 of its 320
characters and 0 of the profile's 320. `STORY_LAB_MERGED_NO_GO_CONTENT_MAX_LENGTH`
is the sum of the two caps and the separator, and each source is now held to its
own cap *before* the join, which is what makes that sum a bound by construction:
by the time the prompt reads the field it is one string, and any bound applied
there has to choose a half to lose.

What is unchanged: the prompt's shape, the request shape, and the model
contract. The `STORY LAB HEAT CONTRACT - CONTINUATION CONSTRAINTS` block still
carries the same lines in the same order; only which characters reach them
changes, and the vocabulary gate refuses requests that were previously served
with unreadable values in that block.

Validation: `tests/story-service-prompt-guards.test.ts` and
`tests/story-lab-real-engine.test.ts`, both in `test:all`. Four counterfactual
mutations — removing the continuation boundary, the merged bound, the vocabulary
gate, and the per-source cap — each fail a suite; the last with the
1,021-character merge that a Codex review round found in this slice's own first
draft. `npm run test:all` exits 0 and
`scripts/recovery/preflight.sh --skip-status` completes.

Tradeoff, stated rather than buried: **capping a source is a floor, not the
boundary these fields should have.** `describeOversizedStoryLabProfileField`
argues the opposite for the same fields at the profile route — they "say what a
reader does not want written", so an oversized value is refused rather than
shortened, because a reader has no way to see that the end of theirs was
dropped. The honest answer for the request's half is a continuation route that
refuses it the way genesis does; until that exists, truncating at the merge is
strictly better than deleting the profile's half outright, but it is still a
truncation of a constraint list.

Open, and wanting the same route-side refusal: `continuationBrief` is unbounded
end to end. No route measures it, `STORY_BLUEPRINT_LIMITS` has no number for it,
and it reaches the prompt as `userInput` composed with the engine's own hidden
guidance (itself bounded at 860). Bounding it means choosing a limit and
publishing it at the form and both routes.

Non-claim: no evidence any of this happens in production output. The Angular
form sends both id fields from closed-set pickers and caps the no-go text, so
reaching any of it needs a request the app does not make. It is worth repairing
because the form is not the enforcement point — the route is — and because two
of the three are silent: a deleted boundary and a truncated one look identical
to a caller.
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
would trade one silent mis-ordering for another.

`inflectedWordForms` in `shared/wordInflections.ts` generates the spellings a
brief may really contain, and a candidate activates when the brief names any of
them as whole words. It has two halves, and the first draft of this slice had
only one:

- **The endings appended.** `oath` → `oaths`, `pact` → `pacts`, `caress` →
  `caressed`.
- **The doubled final consonant**, before the endings that begin with a vowel.
  `plan` → `planning`, `plot` → `plotting`, `commit` → `committed`. Appending
  alone gives `planed`, `ploted` and `commited`, which nobody writes, so a brief
  saying `planning` scored the thread it names **zero** — the exact failure this
  repair exists to stop, arriving from the other direction. Doubling is applied
  to the last character rather than to a stress-tested consonant-vowel-consonant
  stem: the forms are only ever looked up, so a spelling English would not write
  simply never occurs in a brief, and that avoids putting a syllable model in a
  module that compares words.

**The same allowance applies to the whole-candidate score, not only to the
tokens.** A phrase is its words with single spaces between them, so an ending on
the phrase is an ending on its final word: `Blood pact` is named whole by
`settle the blood pacts tonight`. Restricting the six-point phrase score to the
exact spelling cost most of the signal on a brief that names a thread in the
plural — 8 points to 2 — and the courtroom keeps three entries, so that is a
demotion out of the prompt and the preview, not a rounding difference.

The set is now the one declaration for both readers: `storyQualityHeuristics.ts`
builds its regex alternation from `WORD_INFLECTION_SUFFIX_PATTERN`, and this
module reads the forms, because it matches by string comparison and cannot see
that file. Note that the heuristics' pattern form covers only the appended
endings — a keyword there still does not match its doubled-consonant inflection.
That is pre-existing and untouched here; closing it means changing what those
scans match, which is a separate slice.

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

## Continuation continuity: the normalizer read every combining mark as a separator

The section above states this seam's contract as "both sides of the comparison
already pass through `normalizeActivationText`, which leaves letters and numbers
separated by single spaces". That sentence was the whole of the guarantee the
whole-word repair rests on — padding each side with one space makes the
containment test exact only if nothing but letters, numbers and single spaces is
left — and it was true of the code and wrong about words.

A combining mark is neither a letter nor a number, so the class deleted every
one of them and cut apart the word each belonged to. A Devanagari label
normalized to its consonants with the vowel signs replaced by spaces; the same
happened to Thai, to Arabic vowel points, and to any Latin name typed in
decomposed form. Both sides of the comparison shatter identically, so the
whole-candidate match still fired and nothing looked broken — what was lost is
the per-word score beneath it, because the fragments are shorter than
`ACTIVATION_TOKEN_MIN_LENGTH`. A brief naming one word of a thread's label, the
ordinary case that score exists for, scored zero for those scripts and the
courtroom ordered by story position instead.

The contract as it now reads: the normalizer leaves letters, numbers **and the
marks that belong to them** separated by single spaces, with no leading or
trailing space, and canonically composed. The space-padding guarantee is
unchanged — a mark is never a space, so it can never split a part — and the
whole-word reading above still rests on it exactly as stated.

Three things follow, and each is a rule rather than a special case:

- **`NFC` first.** The marks are retained either way, but `é` and `e` + U+0301
  are different strings, so a brief typed one way would not match a label stored
  the other. Composing first makes the two spellings one. Marks that do not
  compose away — most of Devanagari, Thai, and Arabic — are what retaining
  `\p{M}` is for. Neither alone is enough. The order matches
  `buildStoryDownloadFilenameStem` in `shared/storyDownloadFilename.ts`, which
  made this same repair for the download filename, so the two normalizers cannot
  disagree about a name they might both see.
- **A mark belongs to the character before it.** Where that character is itself
  removed — an emoji's variation selector is the case — the mark is orphaned,
  and an orphan at the front of a part is dropped. Without this, `❤️pact`
  normalizes to an invisible selector followed by `pact` and stops matching a
  brief that plainly says `pact`.
- **The token floor counts word characters, not `.length`.** The floor is a
  claim about how much word a token has to be before it carries signal. Counting
  marks lets a two-letter stopword wearing two marks clear a floor built to
  exclude precisely that, which is how the ordering the floor protects gets
  flattened.

What is unchanged: the prompt shape, the request shape, the model contract, and
every score for text that was already ASCII, which has no marks to retain, no
orphans to strip, and the same count either way.

Validation: `tests/continuity-activation.test.ts`, in `test:all`. Devanagari and
Thai labels are asserted to survive whole; the decomposed and precomposed
spellings of one name are asserted to score the same; the orphaned mark is
asserted to score as the word it precedes; the marked stopword is asserted not
to earn a token point while a real content word does; and the ASCII case is
asserted unchanged. Reverting the retained `\p{M}`, the `NFC`, the orphan strip,
or the word-character count each fails the suite.

Non-claim: no evidence this was happening in production output. It needs a story
whose thread labels are written outside Latin script, or a name typed in
decomposed form. It is worth repairing for the reason the section above gives —
the failure is silent, and the panel that previews this decision to the reader
reads the same scorer.
