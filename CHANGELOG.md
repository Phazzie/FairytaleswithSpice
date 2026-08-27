# Changelog

All notable changes to the Fairytales with Spice project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### ***WORST TO BEST*** Story Lab Auth & Profile Storage failure logging (`clerkAuthPort.ts`, `postgresStoryLabProfileStore.ts`) — the last two `console.warn` call sites in the backend, on the two failure paths that decide whether a signed-in user's session and profile data are trustworthy (August 27, 2026)

- Every sibling paid-surface service (`imageService.ts`, `exportService.ts`, `security.ts`'s
  `authenticateRequest`, `api/story-lab/evaluate.ts`) had already been migrated off bare
  `console.warn`/`console.error` onto the structured `logWarn`/`logError` in
  `api/_lib/utils/logger.ts`. `clerkAuthPort.ts`'s session-verification failure and
  `postgresStoryLabProfileStore.ts`'s save/load failures were the two call sites left behind —
  and they guard the paths that matter most for account integrity: whether a signed-in user's
  session is real, and whether their profile data actually got saved or loaded. A bare
  `console.warn` here carried no request/user correlation, skipped `redactSensitiveLogData`, and
  never reached the shared `logBuffer` the Error Display panel reads via `getRecentLogs()` — an
  operator watching that panel during a production auth or profile incident would have seen
  nothing.
- `clerkAuthPort.ts`'s `requireUser` now logs a verification failure through `logWarn` with the
  request's own correlation id (`readRequestCorrelationId(req)`, the same helper every route
  already uses) and an `endpoint` tag, instead of a structureless `console.warn`.
- `postgresStoryLabProfileStore.ts`'s `saveProfile`/`loadProfile` now log a storage failure
  through `logWarn` with the acting user's id and an `endpoint` tag naming the failing operation
  (`postgresStoryLabProfileStore.save`/`.load`), instead of `console.warn`.
- No behavior change to any success path, no contract changes.
- Added regression coverage in `tests/story-lab-clerk-auth.test.ts` and
  `tests/story-lab-profile-store.test.ts` asserting the failures land in the structured log
  buffer with the expected correlation context, and updated the existing malformed-profile test
  (previously spying on raw `console.warn`) to read `logger.getRecentLogs()` instead, since a
  single `logWarn` call now produces more than one `console.warn` line.

### ***WORST TO BEST*** Story Lab's mock generation engine (`mockData.ts`) — the actual runtime path for every keyless deployment, local dev session, and CI run, discarding nearly all of its own input (August 27, 2026)

- `mockData.ts` is what every local dev session, CI run, and any deployment without
  `XAI_API_KEY` actually generates from — `shouldUseMockStoryLab()` returns true whenever the
  runtime isn't production and no key is configured. `buildGenesisResponse` used to read only
  `input.logline` and `input.chapterBatchSize` off the blueprint; `creature`, `themes`,
  `spicyLevel`, `tone`, `protagonistName`, `antagonistName`, and `worldDetails` were all accepted
  and silently discarded. Every mock story was "Selene of the Velvet Court" against "Marcellus
  Nightbloom" in a vampire-coded court, regardless of whether the reader picked werewolf, siren,
  or dragon — so testing "does the creature picker do anything" locally had no signal either way.
- Added a `CREATURE_FLAVORS` table (one entry per `CreatureArchetype`, the same pattern
  `imageService.ts`'s `getCreatureContext` already reads) so the protagonist, love interest,
  rival, court setting, thread, and both lore artifacts all vary by the creature actually
  requested. The vampire entry keeps its original names byte-for-byte, since
  `tests/story-lab-state.test.ts` already asserts on `'Crimson Signet Ring'`/`'Broken Oath
  Scroll'` for a vampire fixture.
- `protagonistName`/`antagonistName` now override the flavor's default cast names when supplied;
  `tone`/`spicyLevel` now flow into the generated `StorySummary` instead of a hardcoded
  `dark_romance`/`3`; a supplied `worldDetails` sentence is now appended to the opening chapter
  instead of being dropped. A `NARRATIVE_TONE_MOOD`/`NARRATIVE_TONE_CHAPTER_TITLE` table gives
  chapter text and titles their own tone-driven variation (`dark_romance` keeps the original
  "Midnight Reverie" title).
- Removed the two module-level `let` counters (`storyRevisionCounter`, `chapterIdCounter`) that
  incremented forever across a warm process's lifetime with no reset — unlike `stateStore.ts`'s
  `resetTransientStorySnapshots()`, built for exactly this kind of isolation. A fresh story's
  `state.revision` is now always `1`; chapter ids are now `chapter-${randomUUID()}`. Two stories
  generated in the same process can no longer get arbitrary, order-dependent starting revisions.
- A continuation's input carries the story's ongoing state and summary rather than the original
  blueprint, so it has no `creature` to look a flavor up by; its chapter text now reuses the
  `narrativeVoice` and `tone` the genesis already established instead of always emitting the
  same hardcoded phrasing, while character/artifact names introduced mid-continuation (possible
  when a genesis with `chapterBatchSize: 1` makes chapter 2 land inside a continuation call) keep
  falling back to the vampire cast, exactly as this module always named them — no contract change
  was in scope for this pass.
- Added `tests/story-lab-mock-data.test.ts`: this module's first direct unit coverage. Creature-
  driven character/artifact/voice variation, name overrides, tone/spicyLevel flowing into the
  summary instead of being hardcoded, `worldDetails` reaching the opening chapter, revision
  determinism across repeated genesis calls in one process, chapter id uniqueness, and a
  continuation carrying its established tone/voice forward.

### ***WORST TO BEST*** Story Continuity State Tracking (`storyStateBuilder.ts`) — the state-merge module every genesis/continuation request is built from, shipped with zero unit tests and a real resolved-thread bug (August 27, 2026)

- `storyStateBuilder.ts` builds/merges the `StoryStateSnapshot` (characters, plot threads, world
  artifacts, beats, deltas) every Story Lab genesis and continuation request is built from and
  read back against. It was extracted out of `storyLabEngine.ts` in a prior worst-to-best pass
  specifically because that file's worst flaw was "zero unit tests" on its most complex logic —
  but the extraction gave the sibling `continuationGuidance.ts` module a direct test file and
  left this one with none. It was reachable only indirectly through the full-engine integration
  test.
- Found a real bug while adding coverage: `mergeThreads()` only ever applied
  `status: 'escalating'` to threads named in a chapter's `delta.escalatedThreads` — it never
  applied `status: 'resolved'` to threads named in the same chapter's `delta.resolvedThreads`,
  even though `buildStateDelta()` in the same file already computes and reports
  `resolvedThreads` in the outgoing delta right next to it. The delta a client sees claimed a
  thread got resolved; the persisted `StoryStateSnapshot.threads` array never reflected it.
- Not cosmetic: `continuationGuidance.ts`'s `isUnresolvedThread()` (`status !== 'resolved'`)
  drives which threads get surfaced to the AI as "unresolved" in the Continuity Courtroom brief,
  ending-pressure selection, and continuation-pressure scoring — all reading `thread.status`
  directly. In the non-AI/heuristic continuity path this bug was unconditional: a resolved
  thread never left the "unresolved" pool. `mockData.ts`'s `applyChapterDeltas` already merges
  resolution correctly — this ports that same, already-proven pattern into the real engine's
  state builder instead of inventing a new one.
- Added `tests/story-lab-state-builder.test.ts`: first direct unit coverage for
  `buildStateSnapshot` (genesis vs. continuation paths, revision increments), initial
  character/thread construction, world-artifact name derivation (its three regex patterns and
  the empty-input fallback), the thread-resolution fix (including resolution taking priority
  over escalation for the same thread id), `buildChapterDelta`'s batch-boundary flagging, and
  `buildStateDelta`'s revision/summary tracking.
- Fixed `mergeThreads` to apply `status: 'resolved'` for resolved thread ids, mirroring the
  existing escalation branch. No other behavior change.

### ***WORST TO BEST*** Real-Time Story Streaming (`StreamingStoryComponent`) — a fake-progress demo left live after its predecessor's cleanup, retired (August 27, 2026)

- A prior PR retired a *duplicate* SSE route and left `api/story-lab/stream/genesis.ts` live;
  a follow-up found wiring `StreamingStoryComponent` into nav leaked the reader's free-text
  logline/character names/world details into the `EventSource` query string (server access
  logs, proxies, browser history) and reverted only the nav link, leaving the component, its
  `StoryService.streamStoryGeneration` method, and the route in place "for a future fix that
  never came." Two more cosmetic bugfixes landed on the unreachable component since.
- It never actually streamed: `stream/genesis.ts` `await`ed the entire `generateStoryLabGenesis()`
  batch — however long real generation took — with zero progress frames sent during the wait,
  then replayed the already-finished chapters back through fixed `setTimeout`s (500ms apart) as
  fabricated per-chapter "progress." A canned animation over a blocking call, not real-time
  generation.
- It was a hardcoded demo, literally labeled so in its own header comment ("Streaming Story
  Component Example"): a fixed vampire/dark-romance/900-word blueprint, ignoring whatever the
  reader actually built in the form.
- It duplicated a feature that already ships and works: `AppComponent`'s job-based progress UI
  (`openJobEventStream`) is the real, production progress path — genuine per-chapter SSE
  snapshots against the job system, wired into the main generation flow. This component was a
  second, parallel "live progress" implementation that was fake, unreachable, and
  privacy-unsafe, sitting next to the one that's real.
- Deleted `story-generator/src/app/streaming-story/` (component + spec),
  `StoryService.streamStoryGeneration` and its test coverage, `api/story-lab/stream/genesis.ts`
  and its route registration/rate-limit tier/dedicated tests
  (`story-lab-stream-genesis.test.ts`, `story-lab-stream-parse.test.ts`), and repointed the
  `EventSource` query-parameter-auth coverage in `api-access-control.test.ts` onto the
  surviving job event stream route it was always meant to protect. Confirmed zero remaining
  references before and after.
- No behavior change to any reachable path: the job-based generation/progress flow this app
  actually serves is untouched.

### ***WORST TO BEST*** storyLabEngine — five concerns in one 1,726-line file, a 700-line prompt-guidance subsystem with zero unit tests, and a whitespace helper hand-rolled three different ways (August 27, 2026)

- `api/_lib/story-lab/storyLabEngine.ts` was the largest file in the repo and
  had never had a structural pass — only three narrow one-line bugfixes had
  touched it (#239, #250, #256). It mixed five unrelated concerns with zero
  internal module boundaries: route orchestration
  (`generateStoryLabGenesis`/`continueStoryLab`), a hand-rolled
  prompt-engineering subsystem (three independent "brief builders" —
  Continuity Courtroom, Chapter Ending Stress Test, Cliché Alarm — with their
  own activation-scoring math and budget-trimming, ~700 of the file's 1,726
  lines), state-merge logic, response-shaping, and a set of generic string
  utilities.
- Concrete duplication: `collapseWhitespace` was hand-rolled as a
  character-by-character loop, while the exact same job already existed as a
  one-line regex in `storyQualityHeuristics.ts` and, differently shaped again,
  in `storyContentAnalysis.ts` (extracted from `StoryService` in the prior
  worst-to-best PR). Three implementations of one function.
- The ~700-line prompt-guidance subsystem — the part with the most branching
  logic (activation scoring, ending-pressure selection, cliché-path selection)
  — had zero unit tests of its own; it was only reachable indirectly through
  `story-lab-real-engine.test.ts`/`story-lab-continuity-merge.test.ts`/
  `story-lab-continuity-prompt.test.ts`, exercised only through the two route
  entry points.
- Extracted the prompt-guidance/"Continuity Courtroom" subsystem into a new
  module, `api/_lib/story-lab/continuationGuidance.ts`, as pure exported
  functions (unchanged behavior).
- Extracted the state-merge/snapshot logic (`buildStateSnapshot`,
  `buildInitialCharacters`, `buildInitialThreads`, `buildWorldArtifact`,
  `mergeThreads`, `mergeUniqueById`, `buildStateDelta`, `buildChapterDelta`)
  into a new module, `api/_lib/story-lab/storyStateBuilder.ts`.
- Added `api/_lib/utils/whitespace.ts`, one canonical `collapseWhitespace`,
  and repointed `storyLabEngine.ts` and `storyQualityHeuristics.ts` at it
  instead of their own copies.
- `storyLabEngine.ts` now holds only route orchestration and response-shaping:
  1,726 → 676 lines.
- Added `tests/story-lab-continuation-guidance.test.ts` — direct, no-AI,
  no-service-instantiation coverage for activation scoring (including a
  non-Latin-script regression case), unresolved-thread priority fallback,
  resolved-thread exclusion, chapter-ending pressure selection, cliché-alarm
  path selection, and the memory-card-stripping helper — all previously
  untested at the unit level.

### ***WORST TO BEST*** StoryService content-analysis heuristics — pure string logic trapped in a 2,200-line god class, tested only through `as any` casts (August 27, 2026)

- `api/_lib/services/storyService.ts` was the largest file in the repo: a
  `StoryService` class mixing AI orchestration, prompt building, mock-content
  generation, and a cluster of content-analysis heuristics
  (`extractCharacterNames`, `extractPlotThreads`, `analyzeEmotionalTone`,
  `extractThemesFromContent`, `extractSpicyLevelFromContent`,
  `extractLastChapterSummary`, and more) that infer metadata from
  previously-generated prose to feed the next continuation prompt — all as
  private methods on one class, alongside a live XAI client, cliffhanger
  service, and trope service.
- Those exact heuristics are what the last several "quick wins" PRs patched one
  bug at a time (#258 spicy level misread out of "hearth"/"gloves", #259 five
  emotions misread out of "danger"/"reached", #261 "witch" read out of
  "switch"). The tests proved the design was wrong: `tests/story-service-improved.test.ts`
  and `tests/story-service-prompt-guards.test.ts` reached into these private
  methods via `(service as any).extractLastChapterSummary(...)` casts and a
  hand-redeclared `analyzeEmotionalTone` interface, just to call a pure
  string-to-string function.
- Extracted every state-free content-analysis/formatting method into a new
  module, `api/_lib/services/storyContentAnalysis.ts`, as plain exported
  functions with unchanged behavior. `StoryService` now imports and calls
  them; `storyService.ts` shrank from 2,219 to 1,682 lines. `detectCliffhanger`
  stayed on the class since it delegates to `this.cliffhangerService`.
- Added `tests/story-content-analysis.test.ts`, which imports the new module
  directly — no `as any`, no class instantiation, no API key — and gives
  `extractCharacterNames`, `extractPlotThreads`, `extractChapterTitleAndBody`,
  `createContextExcerpt`, `getCreatureDisplayName`, `getSpicyLabel`, and
  `formatChapterContent` their first dedicated tests; previously they were
  reachable only through the full `generateStory`/`continueChapter` pipeline.
  Cleaned up the `as any` reach-ins and the hand-rolled interface in the two
  existing test files, which now import the module directly as well.
- Pure extraction and test cleanup — no behavior change. Verified with
  `tsc --noEmit` over the API layer and the Angular app/specs, and the full
  `npm run test:all` backend suite (all green).

### 🐛 Three Quick Wins — a witch read out of "switch", a reset instant fifty thousand years out, an evaluation refusal reported as an outage (August 26, 2026)

#### Three story-quality dimensions still reading substrings

- `scoreEmotionalVariety` and `extractSensoryTextures` were moved onto whole-word
  matching one slice ago; the three dimensions beside them in the same file —
  `scoreContinuity`, `scoreCliffhangerQuality`, and `scoreTropeFreshness` — were
  left on `String.prototype.includes`, and they look for exactly the kind of
  short word this genre writes longer words around.
- `oath` is inside `loathe` and `loathing`, so a chapter about loathing someone
  was credited with repeating a continuity promise. A `forbidden_love` seed looks
  for `love`, which is inside `gloves` and `clover`; a `slow_burn` seed looks for
  `burn`, inside `burnished`. The creature check was the worst of them: `fairy`
  is inside `fairytale` — the word this app is named for — `witch` inside
  `switch`, `dragon` inside `dragonfly`, and `demon` inside `demonstrate`, so
  "she switched off the lamp" reported `Creature appears: witch` for a story with
  no witch in it. `cost` is inside `costume`, in a genre that writes masquerades,
  and `door`/`price`/`blood`/`name` are inside `doorway`/`priceless`/`bloodless`/
  `nameless` — four of the eight hook words the cliffhanger dimension credits an
  ending for, matched by the words that negate them.
- These three dimensions cannot list their inflections the way the emotion
  families do, because the words arrive from the request rather than from a fixed
  lexicon: the creature and the theme words are whatever blueprint was sent. So
  the new `containsWordForm` states the same Unicode-lookaround boundary the
  other scans use and allows the endings that keep a word the same word
  (`loved`, `lovers`, `burning`, `oaths`, `costs`), plus the two irregular
  plurals that land on the contract's own archetypes (`fairies`, `werewolves`).
  Endings that build a *different* word — the `less` of `priceless`, the `ly` of
  `secretly` — are deliberately absent.

#### A rate-limit reset instant no client can read

- `enforceApiAccessControl` put `checkRateLimit`'s reset instant onto
  `X-RateLimit-Reset` unconverted — `Date.now()` milliseconds, e.g.
  `1787012345678`. Read as the header is defined everywhere it is read (GitHub,
  Stripe, every generated client that knows the name treat it as a UTC epoch in
  seconds), that is a date some fifty thousand years out: a client backing off
  until the reset never came back, and one merely displaying it showed the reader
  a seven-digit year. No convention anywhere uses milliseconds here. This is the
  same reading `Retry-After` already got, and the reason that header was added.
- `X-RateLimit-Limit` was missing entirely, so `X-RateLimit-Remaining: 3` could
  not be read as a fraction — the budget is per route and per tier, and nothing
  in the response said what this route's was.
  `SECURITY_FIXES_QUICK_REFERENCE.md` has documented all three headers at this
  call site since it was written.
- Both are now sent, and `X-RateLimit-Limit` was added to `EXPOSED_HEADERS` in
  the CORS policy: a header a cross-origin page cannot read is a header that was
  not sent, which is the reason the rest of that list exists.
  `error.resetTime` in the 429 body is unchanged and still milliseconds — it is
  this API's own field, read by this app.

#### An evaluation refusal reported as an outage

- `PromptEvaluationService.evaluateStory` answers a fixed placeholder whenever
  the evaluate call does not come back successful, and Proving Grounds marks it
  honestly — a badge, a "🔁 Retry Evaluation" button, and a notice reading
  "the evaluation API was unavailable". But the fallback was reached for every
  unsuccessful call alike, and the reasons are not alike:
  `/api/story-lab/evaluate` refuses a `storyContent` past its 60,000-character
  cap with `400 INVALID_EVALUATION_REQUEST` naming the field, a caller with no
  API key with `401`, and a caller past its budget with `429`. Each of those is
  something the reader can act on, and each was reported as an outage — the one
  thing none of them is. The API answered; it said no, and said why.
- The refusal message is now carried onto the placeholder as
  `mockEvaluationReason` — read out of either shape it arrives in, the parsed
  body of a `success: false` answer or `HttpErrorResponse.error` for a non-2xx
  one, which is the reading `readApiErrorMessage` already gives a failed
  generation on the same page — and printed under the notice and in the status
  line. A call that never reached the API has nothing to quote and says nothing,
  so the outage wording still stands where it is true.
- The component's `catch` around the evaluation claimed "mock scoring remains
  available when the API is unavailable", describing a fallback that had already
  happened one line above it, and the service never rejects, so it was
  unreachable besides. It now reports only what it can know.

### ***WORST TO BEST*** Backend Seam Contracts — 120 dead lines describing features that were never built (August 26, 2026)

- `api/_lib/types/contracts.ts` is the canonical "seam contract" reference every
  story/export/cliffhanger service imports from — the one file a reader goes to
  in order to learn what the app's boundaries actually are. About a quarter of
  its 534 lines described two seams nothing implements: `StreamingStoryGenerationSeam`,
  a pre-SSE "real-time generation" contract superseded by the real streaming
  route, and `AudioConversionSeam` (plus its supporting `VoiceType`,
  `CharacterVoiceType`, `AudioSpeed`, `AudioFormat`, `AudioProgress` types), a
  fully-specified audio-conversion contract with its own error codes even
  though audio generation is explicitly deferred and out of scope. Neither had
  a single import anywhere in the repo.
- Removed both interfaces and their now-unused supporting types (534 → 403
  lines). Pure deletion — verified with a repo-wide grep for every removed
  symbol, `tsc --noEmit` over the API layer and the Angular app/specs, the full
  `npm run test:all` backend suite, and the Angular test suite, all clean.
  Recorded here so the removal reads as deliberate cleanup rather than an
  accidental drop of a real seam.

### 🐛 Three Quick Wins — a words-per-second with no clock in it, an image prompt nothing measures, a continuation numbered NaN (August 26, 2026)

#### A generation speed that was not a speed

- The streaming panel reported `generationSpeed` as
  `Math.max(Math.floor(wordsGenerated / 20), 1)` — the word count divided by a
  constant — and rendered it as `words/sec` beside a `~Ns remaining` computed by
  dividing the remaining words by that same number. The two readings cancel, so
  the estimate collapsed onto a figure that depends only on how far through the
  story the stream is: halfway through any story it said twenty seconds, on a fast
  connection and on a slow one alike.
- The `Math.max(…, 1)` floor made it worse at the one moment it mattered. A
  generation that had stalled completely still reported `1 word/sec` and counted
  down as though it were working, because a floor of one cannot express "nothing
  is arriving".
- Added `shared/streamingProgressEstimate.ts`, which takes the elapsed
  milliseconds the caller has and answers the words seen per second actually
  spent, plus the seconds remaining at that rate — or `null` when nothing has been
  measured yet, so the panel can say nothing rather than say zero. The percentage
  and the word budget are read defensively, since one arrives from the server and
  the other from a form.
- `StreamingStoryComponent` stamps the stream's start time and reads both numbers
  from the shared module; the `~Ns remaining` span renders only once a speed
  exists. New `tests/streaming-progress-estimate.test.ts`, wired into `test:all`.

#### The one free-text field on the image route that nothing measured

- `ImageService.buildImagePrompt` takes `imagePrompt` in preference to the story
  when it is present, so it is the text that reaches `grok-2-image` verbatim — and
  nothing bounded it. A caller could send a megabyte of prose under that name and
  have it billed by the token and given the function's whole time budget: the same
  failure `STORY_BLUEPRINT_LIMITS` and `STORY_EVALUATION_LIMITS` were written for,
  on the last route that did not have it.
- The other branch of the same method has been capped at 200 characters
  (`IMAGE_SCENE_DESCRIPTION_MAX_LENGTH`) all along, so the two ways of describing
  one picture disagreed by however much the caller felt like sending.
- Added `IMAGE_GENERATION_LIMITS.maxImagePromptLength` (1200, matching
  `maxNarrativeDirectivesLength`) and checked it in `validateImageInput`, beside
  the creature, theme, style, and aspect-ratio checks — so an oversized prompt is
  `INVALID_INPUT` naming the field rather than `IMAGE_GENERATION_FAILED` after the
  request has been sent. A non-string `imagePrompt` is refused there too: the
  contract types it as a string and the wire does not, and `buildImagePrompt`
  treated any truthy value as a prompt.

#### A paid continuation numbered NaN

- `previouslyGeneratedChapters` arrives in the request body, and the routes that
  reach `continueStoryLab` check that it is an array and nothing about what is in
  it. Both of the engine's readings of that array are `Math.max` over
  `chapter.chapterNumber`, which answers `NaN` for a single entry carrying no
  number — a chapter saved by an older shape of the record, a hand-written body, a
  client that sent its own summaries.
- `NaN` then travelled the whole way through a paid generation without throwing.
  `currentChapterCount: NaN` reached `StoryService.continueChapter`, which numbers
  what it writes `currentChapterCount + 1`, so the model was asked to continue from
  chapter `NaN`; `toStoryLabChapters` numbered every chapter it handed back `NaN`
  too, since `NaN` is falsy and its `||` fallback is `NaN + index`. The response
  serialized those as `null`: chapters titled `Chapter NaN`, `chapterId`s of
  `…-chapter-NaN`, and an `appendedChapterNumbers` of `[null]` for the client to
  append to a project by.
- `continueStoryLab` now refuses such a batch with the same `INVALID_REQUEST` the
  neighbouring check gives, naming the offending entry's index and nothing of its
  text, and does so before the generation is billed. The guard lives in the engine
  rather than in one route, so the job route reaches it too.

### 🔌 Error Logging & Display: a built and tested panel that was never plugged in (August 26, 2026)

- `ErrorDisplayComponent` (component, template, CSS, 4 passing unit tests) subscribed
  to the real, actively-used `ErrorLoggingService` but was never mounted anywhere in
  the app — not in `app.html`, not routed, not referenced outside its own directory.
  100% dead code from a user's perspective.
- There was also no Angular `ErrorHandler` override, so an uncaught exception never
  reached `ErrorLoggingService` in the first place — the wire was missing on both
  ends of the pipe.
- Added `GlobalErrorHandler` (`src/app/global-error-handler.ts`), which forwards
  uncaught errors to `ErrorLoggingService.logCritical` and still delegates to
  Angular's default `ErrorHandler` so existing console output doesn't regress.
  Provided via `{ provide: ErrorHandler, useClass: GlobalErrorHandler }` in
  `app.config.ts`.
- Mounted `<app-error-display>` next to the existing `<app-debug-panel>`, gated by
  the same `?debug=1` signal — matching the panel's own self-description
  (":bug: Debug Errors") and the existing convention for debug-only surfaces,
  rather than shipping it to every reader.
- Wrapped both debug-only panels in an `@defer (when showDebugPanel())` block so
  neither component's code ships in the initial bundle for the vast majority of
  readers who never pass `?debug=1` — a bonus fix over just wiring the panel in,
  since mounting it eagerly pushed the initial bundle over its 500kB budget.

### 🐛 Three Quick Wins — a preflight nobody may cache, an export that fails without saying so, a cut between the halves of a character (August 26, 2026)

#### Every cross-origin request paid for its own preflight

- `buildCorsHeaders` set the origin, methods, request headers, exposed headers,
  and credentials, and never set `Access-Control-Max-Age`. The absence is not a
  neutral default: a browser with no value falls back to its own, which is five
  seconds in Chromium and in Safari.
- Every paid `POST` route here is preflighted — the app sends
  `Content-Type: application/json`, which is not on the CORS safelist — so on
  any deployment serving the page and the API from different origins, a reader
  generating a story, continuing it, exporting it, and asking for a chapter
  image paid a second round trip for all four, and paid it again for anything
  more than five seconds later.
- The answer never varies with the request: it is this route's method list and
  this route's accepted headers. It is now cached for ten minutes, the largest
  window every major browser honours in full — Chromium caps the header at 7200
  seconds and Safari at 600 — and short enough that a deployment changing its
  allowed methods or origins is not held to the old answer for long.
- Set on every response rather than only on the preflight, because the routes
  answer preflights from three places (`applyCorsPolicy`, the jobs route's own
  `OPTIONS` branch, `createCorsMiddleware`) and a browser ignores the header
  everywhere it is not a preflight.

#### The one export failure the app could not describe was the one where nothing was wrong with the export

- `/api/export/save` hands the exported bytes back inline as a `data:` URI, and
  `AppComponent.exportStory` decoded it with `dataUriToBlob` inside its `next`
  callback. `dataUriToBlob` throws for a URI it cannot decode, and RxJS does not
  route a throw from `next` to that subscription's `error` handler — it reports
  it as an unhandled error and abandons the rest of the branch. So the two lines
  that tell the reader the export is ready never ran either: the spinner
  stopped, no file was saved, and nothing said why, on the one failure where the
  route had already answered `success: true`.
- The decode is now guarded and reports through the same notification and status
  path every other export refusal uses.
- `dataUriToBlob` was also refusing data URIs that are perfectly ordinary. Its
  pattern read the media type as everything before the first `;`, but RFC 2397
  lets the media type carry parameters — `data:text/plain;charset=utf-8;base64,…`
  is a legal data URI, and the one this app's own exports would grow the moment a
  text format declared its encoding. The type is now read as everything before
  the `;base64` that ends the header, so the parameters survive onto the `Blob`,
  where a charset belongs, and the header tokens are matched case-insensitively.

#### Three prompt excerpts still cut in UTF-16 code units

- `StoryService.createContextExcerpt` (`text.slice(-1200)`, the
  `PREVIOUS CHAPTER EXCERPT` a continuation is written from),
  `StoryService.generateNextChapterHint` (`candidate.slice(0, 197)`, the
  `nextChapterHint` the reader is shown), and `buildContinuityPrompt`
  (`.slice(0, 2200)` per chapter, the prose the continuity state is derived
  from) all cut with a code-unit count.
- A cut can land between the halves of a surrogate pair, and nothing throws:
  `JSON.stringify` escapes a lone surrogate rather than refusing it, so the
  prompt was simply built with a character the story never contained and the
  story's own astral character was gone. That is the failure `chunkByCodePoint`
  in the export service and `capUtf8Bytes` in the download filename stem both
  iterate code points to avoid.
- The other half is the word: an arbitrary offset ends — or, for the tail,
  starts — mid-word, so the model is shown a fragment and asked to continue from
  it. `ImageService`'s `capAtWordBoundary` already had both readings right, so
  it moves to `api/_lib/utils/textExcerpt.ts` beside a `tailAtWordBoundary` that
  mirrors it for the excerpt that has to end where the story ends, and all four
  call sites share one reading.

### 🐛 Three Quick Wins — a cast the scan cannot see, a promise the courtroom cannot match, a 429 that says nothing (August 26, 2026)

#### The character-consistency scan could only read an ASCII cast

- `NAMED_CHARACTER_RUN_PATTERN` was `\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b`, so
  `The lock broke; Мира pressed the blood oath.` produced no character signals at
  all, and `José` was cut down to `Jos` — the accented letter is not `[a-z]`, so
  the run ended at it and the dimension named a character the story does not
  have.
- Both results travel further than the count. `extractAgencyActions` is handed
  this list, so no action either character took anywhere in the chapter could be
  credited to them; the signal the dimension prints, `Named character count`,
  counted a cast it could not see.
- `\b` cannot be the boundary once the pattern reaches past ASCII: it is defined
  against `[A-Za-z0-9_]`, so there is no word boundary between a space and `М`
  and an anchored `\bМира\b` matches nothing anywhere. The pattern now states
  that property as lookarounds and matches on `\p{Lu}`/`\p{Ll}`/`\p{M}`, which is
  the reading `slugId` and the story-download filename stem were already fixed
  to. The name pattern the agency scan builds per character is boundaried the
  same way. A script with no case at all has no capital to key on and still
  arrives through the `[Speaker]:` tags that seed the set.
- The shared normalizer feeding the agency and concrete-anchor scans kept only
  `[a-z'\s-]`, which **deleted** every other letter rather than separating it.
  `extractConcreteAnchors` pairs each token with the one after it, so
  `she opened Мирина door` normalized to `she opened door` and scored the anchor
  `opened door` — a generic reference counted as a concrete one, from a phrase
  that is not in the story. That is the same welding `a door` → `opened door`
  was already fixed for once.

#### The continuity courtroom could not match a non-Latin promise against the brief

- Both sides of the activation comparison go through `normalizeActivationText`,
  so what it deletes is invisible to the score. `[^a-z0-9 ]+` deleted every
  letter outside ASCII, which normalized a thread labelled `Клятва Миры` to the
  empty string: `scoreActivationCandidates` filtered it out as a candidate and
  scored it zero however plainly the reader's brief named it.
- The courtroom then chose which threads, artifacts, and warnings to put in front
  of the model by story order alone — the reader asks the next batch to pay off
  one promise and is given the first `CONTINUITY_COURTROOM_MAX_THREADS` instead —
  and `describeActivationReason` reported "Included by unresolved-story priority"
  for every one of them.
- A partly-Latin name failed less visibly: `José's pact` became `jos s pact`, so
  the whole-candidate match could never fire and the word tokens the score falls
  back to were `pact` and a `jos` that matches nothing a reader would type.
- Matching on `[^\p{L}\p{N} ]+` keeps those words whole and leaves ASCII text
  scoring exactly as before: the separator run each unsupported character used to
  become is the separator run it becomes now.

#### A 429 told the client nothing it could act on

- `enforceApiAccessControl` answered `429 RATE_LIMITED` with `error.resetTime` in
  the body and `X-RateLimit-Remaining`/`X-RateLimit-Reset` on the response, and
  no `Retry-After`. Nothing outside this app reads the first three, and all of
  them are absolute epoch milliseconds — turning one into a delay means trusting
  the caller's clock against the server's. So an ordinary client knew only that
  it had been refused, and the retry it would guess at is the one the limit
  exists to prevent: on routes budgeted at ten requests per fifteen minutes, the
  guess is wrong by minutes.
- `Retry-After` is now set from the same reset instant, as whole seconds and
  never below one — RFC 9110 defines the delta-seconds form as a non-negative
  integer, and `0` reads as "retry immediately", which is exactly what a caller
  at its limit must not do.
- It was invisible to a browser either way. `Retry-After` is not on the CORS
  response safelist (`Cache-Control`, `Content-Language`, `Content-Length`,
  `Content-Type`, `Expires`, `Last-Modified`, `Pragma`, and nothing else), and
  neither are the two `X-RateLimit-*` headers. Every deployment serving the app
  and the API from different origins had a browser client that could see the 429
  and not one of the three values that say what to do about it, so all three join
  `X-Request-ID` in `Access-Control-Expose-Headers`.

### 🧹 The routes every real request goes through had none of the correlation id, access-control preamble, or redacted logging their unreachable twins did (August 26, 2026)

#### `/api/story-lab/stories` and `/api/story-lab/stories/:storyId/continue` hand-rolled the preamble every other paid route shares

- `StoryService.generateStory` in `story-generator/src/app/story.service.ts` builds every real
  request against `/api/story-lab/...` — genesis through `/api/story-lab/stories`, continuation
  through `/api/story-lab/stories/:storyId/continue`. Those two files still applied CORS, the
  `405` for a non-POST method, and `enforceApiAccessControl` as three separate calls, the way
  `/api/story/generate`, `/api/story/continue`, `/api/image/generate`, and `/api/export/save` did
  before `beginPostRoute` collected that sequence into one call — see the "hundred and forty-four
  identical tokens" note on `api/_lib/http/postRoutePreamble.ts`. The two Story Lab routes never
  got the same treatment, so they carried no `X-Request-ID`, no correlation id in their log lines,
  and no `logWarn` on any of their several 400 paths — a rejected genesis blueprint or a malformed
  continuation body left nothing behind but a bare `console.error` on the unexpected-failure branch,
  keyed by nothing that ties it back to the request that caused it.
- Both routes now open with `beginPostRoute`, the same call the other four paid routes make, and
  every 400 and the unexpected-error catch now go through `logWarn` / `logError` with `requestId`
  and `endpoint` attached. The genesis success line logs `creature`, `tone`, `spicyLevel`,
  `desiredWordBudget`, and `chapterBatchSize` verbatim — the blueprint parser has already checked
  each one against a closed set by the time this line runs — and runs `themes` through
  `toLoggableThemes`, since the parser only checks a theme's shape, not that its `id` is a
  recognised value. `logline`, `narrativeDirectives`, `worldDetails`, both character names, and
  `heatContract.noGoContent` are never logged, not even redacted; only `logline`'s length is kept.
  The continuation route's four 400 paths each log a short static reason
  (`missing_body`, `storyId_type_mismatch`, `storyId_conflict`, `incomplete_continuation_input`) and
  its success line logs `storyId` through `toLoggableStoryId` and a chapter *count*, never
  `continuationBrief` or chapter text.

#### `/api/story/generate` and `/api/story/continue` are gone

- Those two files carried exactly the infrastructure the paragraph above describes — and nothing
  ever called them. `expressApiRoutes.ts`'s own doc comment already said the Angular app talks only
  to `/api/story-lab/...`; grepping the client for `/api/story/generate` and `/api/story/continue`
  confirms it turns up nothing. Both routes duplicated `StoryService.generateStory` and
  `continueChapter` logic that `storyLabEngine.ts` already calls, through its own request/response
  shapes, on the path real traffic takes. They cost two of the twelve-function Vercel budget for a
  codepath nothing could reach, so they are deleted along with their entries in
  `expressApiRoutes.ts`, `scripts/recovery/check-vercel-function-count.sh` (now `9/12`), and
  `api/README.md`. See `api/README.md`'s "Retired route files" for the fuller account.

### 🐛 Three Quick Wins — a hook the scan cannot name, a variety score that can only say "varied", a saved history that takes the page down with it (August 26, 2026)

#### The placeholder cliffhanger type still leaked through the exclamation half of the check

- The previous entry closed this for a chapter with no hook at all, and keyed
  both per-type fields on `cliffhangerDetected`. That is the wider of the two
  conditions available: it is true for any chapter whose last paragraph ends on
  `?` **or** `!`, because `CLIFFHANGER_PUNCTUATION_PATTERN` accepts both. The `?`
  side was covered by accident — the fallback beside it assigns `mystery`, so a
  real type follows — but `!` has no fallback.
- So `She ran!`, a genuine hook matching none of the patterns, was reported with
  `cliffhangerType: 'plot_twist'` (the placeholder), three continuation
  instructions written for a twist, and a five-point variety penalty whenever the
  chapter before it genuinely was a twist. That is the same defect the previous
  entry describes, on the branch it did not reach.
- Detecting **that** a chapter stops on a hook and detecting **which kind** are
  two different findings, and only the second can key a per-type answer. Both
  fields are now keyed on `detectedType`, so an unclassified hook still reports
  its text and strength — it is a real hook — and simply names no type-specific
  advice. `hasIdentifiedCliffhangerType` names the distinction for callers.

#### `varietyScore` was a constant, and the constant said "no repetition"

- `CliffhangerService.analyze` takes the hook types that came before and scores
  **3 out of 8** when the new chapter repeats one. The continuation loop in
  `StoryService.continueChapter` called it with one argument, so
  `previousCliffhangers` defaulted to `[]` on every chapter of every batch.
- The score could therefore only ever be `8` — "these hooks do not repeat" —
  including for a three-chapter batch that ends all three chapters on the
  identical beat. It is not an internal number: it travels back to the caller as
  `cliffhangerAnalysis.varietyScore` on the continuation response, so the one
  signal that response carries about a serial repeating itself was a constant
  asserting there was none.
- The types are produced by the very loop that needed them. They are now
  collected as each chapter is scanned and fed to the next — and only where the
  scan actually classified the hook, so the `plot_twist` placeholder above cannot
  be pushed forward and charge the next chapter with repeating a twist nothing
  identified.

#### One unreadable entry in the Proving Grounds history took down the whole page

- `loadTestHistory` read `localStorage` as `StoredProvingGroundsTestResult[]` and
  mapped straight over it, which asserts a shape rather than checking one. What
  comes back is whatever is under the key: a half-written save, a value left by
  an older shape of the record, a hand-edited one.
- An entry without a readable `timestamp` becomes `new Date(undefined)` — an
  `Invalid Date` — and the history list renders it through
  `{{ test.timestamp | date:'short' }}`. Angular's `DatePipe` **throws** on a
  date it cannot convert (`NG02100: InvalidPipeArgument`), and it throws during
  change detection, so one bad entry does not degrade a row: it takes down the
  entire Proving Grounds page, on every load, permanently. The 🗑️ that would
  delete the entry is on the page that will not render, so there is no way back
  from inside the app. `configuration.promptTemplate.name` is the same story one
  dereference deeper.
- The sibling `StoryWorkspaceStorageService.readProjects` already filters its own
  reads for exactly these reasons. This one now does the same: the parsed value
  must be an array, entries are kept only if they carry the fields the template
  dereferences, and the restore applies the same `MAX_TEST_HISTORY_ENTRIES` cap
  the write does — so a stored list longer than the cap is trimmed when it is
  read rather than on whatever generation happens to come next.

### 🐛 Three Quick Wins — a job stream throttled off fifteen seconds in, a score penalty that says nothing, continuation advice for a hook that is not there (August 26, 2026)

#### The Story Lab job event stream was rate-limited as if it were the genesis stream

- `/api/story-lab/jobs/:jobId/events` replays the events a job has recorded so
  far and then **ends the response** — every time, for a job that is still
  running. That is the design, and both sides document it:
  `shared/eventStreamRetry.ts` exists precisely to tell the Angular reader that
  the resulting `error` is a reconnect rather than a failure, and
  `StoryService.streamStoryLabJobEvents` keeps the subscription alive through
  it. So a browser `EventSource` reopens the connection roughly every three
  seconds for as long as the generation runs.
- Wiring access control into the route (#244) gave it `RATE_LIMITS.STREAMING`:
  **five requests per fifteen minutes**. That tier is sized for
  `/api/story-lab/stream/genesis`, the opposite kind of stream — one connection
  held open for a whole paid generation, which the reader deliberately never
  reopens because reconnecting there re-runs the generation from the beginning.
- One reader watching one job therefore spent the entire budget about fifteen
  seconds in. Every reconnect after that was answered `429`, so the job kept
  running on the server while the page reported *"Story generation updates
  stopped"* — and could not get them back for fifteen minutes. The route spends
  nothing: it reads the job store and replays recorded snapshots.
- Adds `RATE_LIMITS.STORY_LAB_JOB_EVENTS`, sized for the polling the route's own
  design causes — fifteen minutes of uninterrupted three-second reconnects is
  three hundred requests — and leaves `STREAMING` to the single-connection
  genesis stream it was written for. The regression test drives twenty
  consecutive reconnects without resetting the limit between them, which is what
  every other scenario in that file does.

#### The audio-readiness dimension penalised overlong paragraphs without saying so

- `scoreAudioReadiness` swings a story's score by **thirty points** on one check
  — `+12` when no paragraph runs past ninety words, `-18` when one does — and
  printed a signal only for the passing case. A penalised story came back with a
  rationale claiming to check paragraph length and a signal list that was
  entirely about dialogue, so the reader was handed a lower number with nothing
  explaining it and nothing to act on.
- Every other dimension already reports what moved it: `scoreTropeFreshness`
  prints the stale phrases that cost it points. This now prints how many
  paragraphs are too long and how long the worst one runs, and the threshold is
  named (`AUDIO_READINESS_MAX_PARAGRAPH_WORDS`) rather than inlined.

#### Cliffhanger analysis suggested continuations for a hook it had not found

- `CliffhangerAnalysis.cliffhangerType` is a closed set with no "none" member, so
  a chapter with no cliffhanger still has to be labelled *something* — it falls
  to `plot_twist`. Every other field on the analysis knows that label is a
  placeholder and reports nothing: `cliffhangerStrength` floors at `0`,
  `cliffhangerText` is empty.
- The two fields a caller actually acts on did not. `suggestedContinuations`
  handed back three instructions written for a twist — *"Reveal the first
  consequence of the twist"* — for a chapter the same scan had just said ends on
  no hook at all. `varietyScore` was worse: it asked whether the **placeholder**
  appeared in `previousCliffhangers`, so a chapter with no cliffhanger scored 3
  out of 8 for repetition whenever the chapter before it genuinely was a
  `plot_twist` — a sameness penalty for a hook that does not exist.
- The whole analysis travels back to the caller as `cliffhangerAnalysis` on the
  continuation response, so both were public answers about something the service
  had not detected. An undetected cliffhanger now suggests nothing and cannot
  repeat anything; the detected side — suggestions, and the variety penalty for a
  genuinely repeated type — is unchanged and covered by the existing assertions
  plus new ones.

### 🐛 Three Quick Wins — a blend voice missing from every prompt preview, a theme picker no reader can reach, a form refusing what the API accepts (August 26, 2026)

#### Proving Grounds never showed the third author the API actually blends in

- `selectRandomAuthorStyles` in `api/_lib/config/authorStyles.ts` builds every
  story's prompt from **two** voices out of the creature's own bank and **one**
  out of a second bank belonging to other creatures — a werewolf story is written
  by two werewolf voices and one vampire or fae one. That third voice is the
  entire reason the API keeps a `getSecondaryAuthorStyles` table.
- `GenerationLogicService.selectRandomAuthors`, whose stated job is to "simulate
  the random selection logic from storyService", drew `2 + randomInt(2)` voices
  and took all of them from the primary bank. So the panel disagreed with the run
  twice over: the blend voice was absent from every preview for every one of the
  ten creatures, and a preview that happened to roll three named three
  same-creature voices where the generator had used two.
- This is the second half of the fallthrough fixed in the previous slice. That
  one made the panel read the right *primary* bank for `siren` and `djinn`; the
  secondary bank had never been ported at all, so the panel was still describing
  a prompt the run did not use — the failure a prompt-comparison tool cannot
  afford, because the reader has no way to tell.
- `getSecondaryAuthorStyles` is ported with the API's pairings, and the counts are
  named (`PRIMARY_AUTHOR_COUNT`, `SECONDARY_AUTHOR_COUNT`) rather than left as a
  coin flip. The spec that accepted "anything from two authors up to the size of
  the bank" was accepting the defect exactly; it is replaced by one asserting the
  two-plus-one shape for every creature and one naming the pairings.
- Porting the pairings surfaced that the panel's `werewolfStyles` and `fairyStyles`
  were not the API's banks either — six of the twelve werewolf voices and three of
  the twelve fae ones were names `WEREWOLF_STYLES` and `FAIRY_STYLES` have never
  held, in a different order and with different voice samples and traits, and
  `Nalini Singh` appeared twice inside the panel's own werewolf bank. Every
  creature except siren borrows werewolf or fae for its blend voice, so pointing
  the selection at the right banks while the banks themselves were wrong would
  have left almost every preview still able to name an author the server could not
  pick. Both are now the API's, transplanted rather than retyped, and pinned by
  name the way the siren and djinn banks already were.
- The two banks were also what made a preview able to name the *same* author
  twice. `Kresley Cole` and `Laurell K. Hamilton` sat in both the panel's vampire
  and werewolf banks, and `Nalini Singh` and `Jennifer L. Armentrout` in both its
  werewolf and fae ones, so a vampire or fae draw could take one voice from each
  bank and get one author — losing the variety the third voice exists for, and
  handing two identical keys to a template that tracked by author name, which
  Angular answers with an NG0955 runtime error rather than a render. The API's ten
  banks share no name at all, within a bank or between any creature's two pools,
  so the port removes the collision; a spec now states that property so a later
  bank edit fails a test instead of a reader's screen, and the template tracks the
  draw by position, which is the only identity a freshly-shuffled list has.

#### Proving Grounds offered ten themes, five of which no reader can send

- Its `themeOptions` was a thirteenth copy of the theme vocabulary and it was the
  other one: ten classic `ThemeType` ids with descriptions written for that page.
  `app.ts` builds its picker from `STORY_LAB_THEME_SEEDS`, so those twelve seeds
  are the only themes any request the app makes actually carries. The two lists
  overlap on five ids.
- Seven of the app's themes — `court_intrigue`, `blood_oaths`, `slow_burn`,
  `enemies_to_lovers`, `magical_bargain`, `secret_identity`, `forced_proximity` —
  could not be tested at all in the one screen built for testing prompts, and five
  of the ids on offer (`betrayal`, `power_dynamics`, `manipulation`, `seduction`,
  `desire`) are ones no reader can pick.
- The five shared ids were the worse half, because they looked right. A seed's
  `label` and `description` are carried into the generation prompt, not merely
  printed beside a checkbox, so `Dark Secrets / Hidden history threatens the bond.`
  here and `Hidden Secrets / Someone is lying beautifully.` in the app are two
  different prompts under one id — a comparison tool reporting on prose the app
  would never have asked for, with nothing in the output to say so.
- The picker now reads `shared/storyLabThemeSeeds.ts`, the module the previous
  slice created for exactly this class of drift, and its selection cap moves from
  a hard-coded three to `STORY_BLUEPRINT_LIMITS.maxThemes` — the five the route
  accepts and `FormValidationService` enforces. The label states that number
  rather than restating it.

#### The blueprint form refused loglines the API would have accepted

- `parseStoryLabBlueprint` reads `logline` through `.trim()`, and `worldDetails`
  and `narrativeDirectives` through `optionalString`, which trims too — and only
  then compares against `STORY_BLUEPRINT_LIMITS`. `FormValidationService` measured
  the raw value.
- So surrounding whitespace counted on one side of the seam and not the other. A
  logline pasted with a trailing newline — the ordinary result of copying a
  paragraph out of a document — was refused by the form at exactly the cap the
  route accepts it under, with a message telling the reader to shorten prose that
  was already short enough.
- `describeNarrativeDirectivesOverflow` in the shared limits module was written to
  avoid this and says so in its own comment: measuring the field any other way
  "would refuse a request the route would have taken". Both readers of the shared
  numbers now measure it the same way the route does.
- `heatContract.noGoContent` is deliberately left as it was: the parser checks that
  field's length *without* trimming, so trimming it in the form would accept a
  contract the route refuses — the drift running the more expensive way.
- The parser's own trimming of `logline` and `worldDetails` was stated nowhere,
  which is how the form came to disagree with it. `tests/story-lab-blueprint-parser.test.ts`
  now pins it, beside the `narrativeDirectives` case that was already covered.

### 🐛 Three Quick Wins — an image style logged verbatim, the app's own themes reported as unrecognized, two creatures previewed as a third (August 26, 2026)

#### `/api/image/generate` wrote the caller's `style` into the log as it arrived

- The route's request line reports four caller-supplied fields. `storyId`,
  `creature`, and `themes` each go through `loggableRequestParameters`, which
  exists so that a value is repeated only when it is on the contract's own
  allow-list. `style` did not: it was written as `style: input.style`.
- Nothing before that line constrains it. The route's guard tests the field for
  truthiness — `!input.style` — and the closed-set check lives in
  `ImageService.validateImageInput`, which has not run yet. So a body of
  `{"style": "Dana is in treatment at the clinic on Rosewood", …}` put that
  sentence in the console and in the buffer the debug panel reads, verbatim,
  under a log key that is deliberately kept. The token redaction every logged
  string still passes through does not help: it removes credentials, addresses,
  and URLs, not prose.
- `ImageStyle` names five values, so there is a list to be recognised against.
  `toLoggableImageStyle` joins its three siblings, reading
  `VALIDATION_RULES.imageStyle.allowedValues` rather than restating them. A
  request the app itself makes — which always sends one of the five — is logged
  exactly as it was.

#### The same line reported the app's own themes as unrecognized

- `toLoggableThemes` filtered against `VALIDATION_RULES.themes.allowedValues`,
  the eighteen classic `ThemeType`s. No screen in this repository sends those.
  `app.ts` builds its picker from twelve Story Lab `ThemeSeed`s and passes
  `theme.id` straight through, and seven of the twelve — `court_intrigue`,
  `blood_oaths`, `slow_burn`, `enemies_to_lovers`, `magical_bargain`,
  `secret_identity`, `forced_proximity` — are on no other list.
- So the filter was rejecting the app's own traffic. A reader who picked "Court
  Intrigue" and "Blood Oaths" and generated a chapter image produced the request
  line `themes: [], unrecognizedThemeCount: 2` — the marker that means "the
  caller sent something that is not a theme", written about the two themes the
  picker itself offered. The diagnostic the module exists to preserve, *which
  themes were asked for*, was blanked for exactly the requests that matter and
  kept intact only for a vocabulary nothing sends.
- This is the second time the same drift has been fixed in the same route:
  `ImageService.mapThemeToVisualElement` described those seven seeds to the image
  model as `mysterious elements` until it was taught both vocabularies. The list
  had one copy, in `app.ts`, and no reader on the server side of the seam could
  see it. It now lives in `shared/storyLabThemeSeeds.ts`, which the picker, the
  log allow-list, and `tests/image-service.test.ts` all read — that test having
  previously asserted against its own transcription of the list, so a seed added
  to the picker and not to the test would have passed.
- Widening the allow-list does not turn the filter off. A value from neither
  picker is still reported by count rather than repeated.

#### Proving Grounds showed a siren and a djinn the fairy author bank

- `GenerationLogicService.getAllAuthorStyles` — the panel's preview of which
  authors the API will be asked to write like — fell `siren` and `djinn` through
  to `fairyStyles`. The API has had its own `SIREN_STYLES` and `DJINN_STYLES`
  since that identical fallthrough was fixed in `api/_lib/config/authorStyles.ts`;
  the browser-side copy was left behind.
- For two of the ten creatures the screen therefore reported a bank of twelve fae
  authors — Sarah J. Maas, Holly Black, Julie Kagawa — for a story the server
  generated from four sea or wish voices. A prompt-comparison tool that shows a
  prompt the run did not use is worse than one that shows nothing, because the
  reader has no way to tell which they are looking at.
- The spec was asserting the defect: `fairy, siren, and djinn share the same
  fairy-styles pool` was a passing test over the drift. It is replaced by one
  that requires every creature's bank to differ from every other's, and one that
  names the siren and djinn authors the API actually uses — a borrowed bank is
  still a non-empty, creature-shaped list, so only the contents catch it.

### 🐛 Three Quick Wins — every Story Lab refusal read as an outage, an adult gate that covered one chapter, a token count blanked from its own log (August 26, 2026)

#### Every failure the story generator reported was served as HTTP 500 by the Story Lab routes

- `/api/story-lab/stories` and `/api/story-lab/stories/:storyId/continue` choose
  their status through `getStoryLabResponseStatus`, which carried a table of
  four codes: `CONTENT_POLICY_VIOLATION`, `INVALID_BLUEPRINT`, and
  `INVALID_REQUEST` for `400`, and `AI_UNAVAILABLE` for `503`.
- Those four are the codes the Story Lab engine raises for itself, and they are
  not the codes these routes mostly return. The engine forwards the classic
  `StoryService`'s error verbatim through `storyLabErrorResponse` — that service
  is what actually generates the story behind both routes — so its whole
  vocabulary arrived at a table that had never heard of it. A blueprint its
  validator rejects answers `INVALID_INPUT`, a throttled key `RATE_LIMITED`, an
  exhausted one `QUOTA_EXCEEDED`, a provider outage `AI_SERVICE_UNAVAILABLE`, a
  story past the cap `CONTENT_TOO_LARGE`: every one of them was served as `500`.
- `500` says the service broke, which is the one thing none of those is. A retry
  policy keyed on `5xx` retries a request that will be refused identically
  forever; a rate limit that should back off does not; an uptime probe and a
  proxy's error-rate metric record an outage over a caller's malformed field.
  The classic `/api/story/*` routes have answered the right status for these
  exact codes since `getApiResponseStatus` was introduced — the same code
  arriving through a Story Lab route is the same failure.
- The reading is now shared rather than restated: `INVALID_BLUEPRINT` moved into
  the shared table beside the two Story Lab codes already there, and
  `getStoryLabResponseStatus` delegates. What stays local is the one rule that
  is genuinely this route's own — a `success: true` envelope with no payload is
  a service failure, because these routes promise a story iteration and a caller
  has nothing to render without one.

#### The adult-reader confirmation gate covered chapter 1 and no chapter after it

- `generateStoryLabGenesis` refuses a Heat Contract whose `adultOnlyConfirmed`
  is not `true`, before any provider call. `continueStoryLab` did not check at
  all — and continuation is the route that writes every chapter after the first.
- The contract is not decoration on that path. `continueStoryLab` passes it into
  the classic service as `generationContext.heatContract`, carrying the tension
  mode and the intimacy boundary — `literary_on_page` among them — that decide
  how explicit the prose is. So a continuation could name a contract that
  withheld the confirmation and still be generated under the terms that same
  rejected contract set. The Angular form will not submit without the
  confirmation ticked, but the form is not the enforcement point; the route is,
  and it serves most of the story the reader actually reads.
- Both callers now go through one `heatContractPolicyError`, which differs only
  in whether a contract is required. Genesis still refuses an absent one. A
  continuation that names no contract is asking for more of the story it already
  has under the terms it was begun on, so that stays served exactly as before —
  the gate is on a contract the caller supplies, not on one it omits.

#### `promptTokens` was written to every log entry as `[REDACTED]`

- `SENSITIVE_KEY_PATTERNS` blanks a key without looking at what is under it,
  which is right for the prose it exists to catch. `/prompt/i` also matches
  `promptTokens` — a declared field of `LogContext`, filled by `storyService`
  from the provider's own usage report on every story and continuation call.
- So the input-token count of every paid request was replaced by `[REDACTED]`
  while `completionTokens` beside it went through untouched. The one number that
  says what a request cost to send was the one number the log did not keep, and
  a redacted field keeps its name, so nothing in the entry said the value had
  been dropped.
- The existing redaction test asserted `serialized.includes('promptTokens')` —
  the key, which survives redaction by definition — so it passed against the
  defect. It now asserts the value, and asserts that `prompt`, `systemPrompt`,
  `imagePrompt`, and `promptText` are still blanked.
- The fix is a named exemption for the one key rather than a suffix rule. "Any
  key ending in `Tokens`" reads better and would unblank `accessTokens` and
  `refreshTokens`, which are credentials and not counts.

### 🐛 Three Quick Wins — seven creatures with no tropes, seven themes with no picture, an export refusal read as an outage (August 26, 2026)

#### Trope subversion was silently off for seven of the ten creatures

- `TropeSubversionService` is what keeps a generation off the stock version of
  its own premise. It picks two or three tropes for the chosen creature, appends
  the HIDDEN UNIQUENESS DIRECTIVES block telling the model to subvert them, and
  serializes the selection into `tropeMetadata` so every later continuation is
  told to honour the same inversions.
- `TROPE_DATABASE` had banks for three creatures: vampire, werewolf, and fairy.
  `CreatureType` has named ten archetypes since the Story Lab blueprint was
  introduced, so `supportsCreature` answered `false` for siren, djinn, witch,
  dragon, demon, angel, and mermaid, and `selectTropeSubversions` returned
  `undefined` for all seven. No directives reached the genesis prompt and
  `tropeMetadata` was `undefined`, so no continuation carried any either: for
  seven of the ten choices the form offers, the feature was off end to end, and
  the only visible sign was that those stories read like the first thing anyone
  would write about a siren.
- Each of the seven now has a bank in the shape of the original three — ten
  common tropes and five subversive ones — because `createWeightedTropePool`
  pushes each common entry three times, and the selector needs enough distinct
  ids to fill a request of three without repeating the same handful across every
  generation. A thinner bank would have quietly given its creature less variety
  than the rest.
- The trope test could not have caught this. Every loop in it iterates
  `Object.keys(TROPE_DATABASE)`, so a creature the table never had is not a
  failing case, it is a case that never runs — the table was being asked about
  itself. The check now comes from `CREATURE_ARCHETYPES`, and the file also
  asserts the per-bank depth, that no two tropes share an id (the id is the
  selection and deserialization key, so a duplicate is one trope wearing two
  names), and that every trope carries the subversion instruction that is the
  only part of it the prompt actually sends.

#### Seven of the twelve themes the picker offers reached the image model as "mysterious elements"

- `mapThemeToVisualElement` was keyed on `ThemeType`, the eighteen classic
  themes — and the only client this route has does not send those. `app.ts`
  builds its picker from `availableThemes`, twelve Story Lab `ThemeSeed`s, and
  passes `theme.id` straight through to `/api/image/generate`.
- Five of the twelve happen to spell a classic theme. The other seven —
  `court_intrigue`, `blood_oaths`, `slow_burn`, `enemies_to_lovers`,
  `magical_bargain`, `secret_identity`, and `forced_proximity` — matched nothing
  and fell to the shared `mysterious elements` fallback, so a reader who chose
  "Enemies to Lovers" and "Forced Proximity" had both choices reach the model as
  `Visual elements: mysterious elements, mysterious elements`, and every image
  the app can produce from those seven looked like every other.
- The seam types `themes` as `string[]` rather than as a closed set, so both
  vocabularies are legitimate input here and both are answered now: the classic
  entries stay for a caller that sends them, and the seed ids sit beside them,
  worded from the same seed descriptions the story prompt is built from, so the
  picture and the prose are asked for the same thing.
- The image-service test now walks the picker's twelve ids the way its sibling
  walks the ten creatures, asserting that none falls back and that no two share
  a visual element — distinctness being what proves each theme is described as
  itself rather than that the fallback was renamed.

#### An export the service refused is no longer reported as an unreachable service

- `/api/export/save` answers a real HTTP status for every refusal, so a rejected
  export no longer arrives as a `success: false` body on a `200` — it arrives on
  the error channel, with the same envelope inside it saying which of the
  route's four refusals it was: a story past the 500KB cap, a body missing a
  required field, a format the renderer does not support, or the service itself
  failing.
- The subscription discarded it. `error: () => { ... }` reported all four as
  "Could not reach the export service.", which is the one thing none of them
  is — the request reached the service and was answered — so a reader whose saga
  had outgrown the cap was told to check their connection over something they
  could fix by exporting fewer chapters or choosing another format. It was the
  only subscription in the component not reading its error through
  `formatHttpError`; the image, generation, continuation, cloud-library, and job
  subscriptions all do.
- The connection wording stays as the fallback, which is the one case it
  actually describes: a transport failure carries no envelope. Both paths have a
  spec.
- Incidental: `downloads generated story HTML locally` was failing. It flushes
  `tick()` and expects the object URL to have been revoked, but the revoke is
  scheduled `OBJECT_URL_REVOKE_DELAY_MS` out — the bare call flushes 0ms and
  never reaches it. The export spec directly below it already carried the
  corrected form and a comment explaining exactly this; this one kept the old
  call when the delay was introduced. The Angular suite is green again.

### 🐛 Three Quick Wins — two creatures written as a third, themes outside the contract, a welded chapter (August 26, 2026)

#### A siren is no longer written by the fae court, and neither is a djinn

- `AUTHOR_STYLE_MAP` gives every creature the voice bank its prompt is built
  from. `siren` and `djinn` both pointed at `FAIRY_STYLES`, so two of the ten
  choices the blueprint offers had the one setting that most decides how the
  prose sounds replaced by another creature's: Holly Black and Sarah J. Maas
  directing a story about neither, while the eight other creatures each had a
  bank of their own.
- `SIREN_STYLES` and `DJINN_STYLES` are four voices each, in the same invented-
  house form the witch, dragon, demon, angel, and mermaid banks use — drowning
  song and salt debt for the siren, wish law and lamp-bound servitude for the
  djinn. `getSecondaryAuthorStyles` gives each its own pairing too, rather than
  the fae court's.
- The style-bank test passed straight through this. Its creature-language
  assertion looks for "siren", "bargain", and "debts" in the bank's combined
  text, and `FAIRY_STYLES` ends on a Bargainer entry that says all three, so
  siren and djinn were credited with creature-specific language they had
  borrowed; the stricter "must not reuse another creature's bank" loop beneath
  it named only the five creatures added last. Both creatures are in that loop
  now, and a new assertion checks that no two creatures share a bank object at
  all, which is what the three hard-coded comparisons were approximating.

#### `themesContinued` reports themes

- The contract types the field as `ThemeType[]` — the closed set of eighteen ids
  the theme picker offers and `VALIDATION_RULES.themes.allowedValues` lists —
  and `extractThemesFromContent` was declared `any[]`, which is what let two
  things through it.
- When nothing matched, the answer was `['romance', 'fantasy']`. Neither is a
  theme: no story can be generated with either, no picker can render either, and
  a caller mapping the ids back to labels gets nothing for both. The honest
  answer is the empty list, which is what a continuation that carried no
  configured theme now returns.
- Six of the eighteen themes had no keywords at all, so `dominance`,
  `submission`, `temptation`, `sin`, `lust`, and `deceit` could never be
  reported however plainly a chapter carried them — a scene naming all six came
  back as `power_dynamics, desire`. `lust` was worse than merely absent: the word
  sat in `desire`'s keyword list, so it was credited to a theme the reader may
  not have chosen while its own theme stayed unreachable. The table is keyed by
  `ThemeType` now, so a theme added to the contract without keywords here is a
  compile error rather than a silent blind spot.
- Keywords are matched as whole words. That is what makes the six new entries
  safe to spell as their own names: `sin` as a substring is inside `rising`,
  `using`, and `singing`, and `lust` is inside `lustre`. The inflections the
  substring form picked up for free are listed instead, and `used` is gone from
  `manipulation` — "she used the key" is not a story about being used.
- The scan reads the rendered text rather than the markup, like the cliffhanger,
  image, and story-quality scanners: the multi-word keywords (`secret love`,
  `star-crossed`, `false promise`) are exactly the ones a welded
  `door.</p><p>Blood` boundary hides.

#### A plain-text chapter that opens with a title keeps its paragraphs

- `formatStoryContent` wraps a provider answer that arrived as plain text. To
  find the title it split on newlines and dropped every blank line — including
  the ones two lines below, which are the paragraph separators the very next
  step splits on. Rejoining what was left produced a body with no blank line
  anywhere in it, so `split('\n\n')` returned the whole story as a single block
  and every paragraph the model wrote was welded into one `<p>`.
- It fired only for a story that opens with a title line; the same story without
  one kept its paragraphs, because that branch never touched the lines. Only the
  blank lines above the title are dropped now.

### 🐛 Three Quick Wins — the Proving Grounds bench, and a dropped image reason (August 26, 2026)

#### Proving Grounds no longer spends a generation on a request the route always refuses

- The page packs the selected template's system and user prompts — and the
  generation-logic summary once the reader has asked to see it — into the
  blueprint's `narrativeDirectives`, which `parseStoryLabBlueprintFromBody` caps
  at `STORY_BLUEPRINT_LIMITS.maxNarrativeDirectivesLength` (1,200). The template
  the page opens on, "Current Production", builds about 4,600 characters, so the
  default configuration of the prompt bench could not generate at all, and the
  shorter templates — which fit on their own — joined it once the generation
  logic was attached to the run.
- `describeNarrativeDirectivesOverflow` is asked before the request is sent, and
  the page names the template, the length, the cap, and the three things the
  reader can change. It measures `.trim().length` because the parser trims
  before it measures — a check that counted the whitespace would refuse a
  request the route would have taken. `tests/story-lab-blueprint-parser.test.ts`
  takes both readings at the boundary so they cannot drift apart.
- A generation that fails for any other reason now reports what the API said.
  Since the routes answer real statuses, a refusal arrives through `HttpClient`'s
  error path with the envelope on it, and the page was replacing that with
  "Story generation failed. Check the debug panel or console for details."

#### "Export Results" is a button that downloads something

- The Proving Grounds history export built a `data:` URI and clicked an anchor it
  had created but never attached — the same pattern the story download had before
  `downloadHtmlDocument` replaced it with an attached anchor over an object URL.
  Firefox does not dispatch a synthetic click on a detached anchor, so the button
  did nothing there at all, and a `data:` URI carries its whole payload in the
  URL, which twenty-five generated stories with their prompts and evaluations are
  not.
- `downloadTextDocument` is the same attach-click-detach over an object URL that
  the story download already uses, parameterized by MIME type; `downloadHtmlDocument`
  now delegates to it, so both buttons share one implementation and one test.
- The revoke moved inside that cleanup. It sat after the `try`, so a click that
  throws — a browser that refuses the download, an extension that replaced the
  handler — skipped it, and a browser holds a blob alive for the life of the tab
  until its URL is revoked. Every refused attempt stranded a whole story or a
  whole exported history in memory, on the path least likely to be noticed.

#### A failed chapter illustration says why it failed

- `generateChapterImage` was the one subscription in the component whose error
  handler ignored its argument, answering "Image generation failed. Please try
  again." for every failure. An unsupported style, an exhausted image quota, and
  a deployment with no image provider configured are all reasons that retrying
  does not fix, and the route names each of them in the envelope that reaches
  the error path.
- It now reads through `formatHttpError` with that sentence as the fallback,
  like every other subscription in the component.

### 🐛 Three Quick Wins (August 26, 2026)

#### A keyless deployment no longer passes its canned evaluation off as a Grok score
- `/api/story-lab/evaluate` answers a fixed `score: 75` and a fixed set of
  strengths, weaknesses, and suggestions — written about a story it never read —
  whenever `XAI_API_KEY` is not configured, and it went out as a plain
  `success: true`. Proving Grounds exists to compare prompt variants by these
  scores, so on such a deployment a reader was comparing 75 against 75 and
  reading the tie as a result.
- The mock now carries `isMockEvaluation: true`, which the frontend already
  understands: PR #233 gave the *client-side* fallback the same marker, and
  `proving-grounds.html` renders the "⚠️ Offline mock evaluation" notice, tags
  the score in the history and comparison views, and offers "🔁 Retry
  Evaluation" instead of locking into a false "✅ Evaluated" wherever it is set.
  Only the server-side fallback — the one every reader of a keyless deployment
  actually reaches — was still unmarked. The `heuristicReport` beside it is a
  real deterministic scan and travels with the successful path too, so it could
  never have been what told the two apart.

#### The HTML export stops welding the words on either side of a tag it drops
- `sanitizeStoryHtmlForExport` replaces any tag outside its allow-list with
  nothing at all, so a block-level one ran two pieces of story together:
  `<h4>The Vault</h4><div>She opened the door.</div>` exported as
  `The VaultShe opened the door.` and `<td>One</td><td>Two</td>` as `OneTwo`,
  while the plain-text export of the same story put each on its own line. This
  is the `door.</p><p>Blood` welding `splitStoryIntoTextBlocks` exists to
  prevent, on the last export path that still had it.
- A dropped block-level tag is now a `<br>` boundary. The boundary is held until
  something follows it, so a leading or trailing one never reaches the document
  and a run of them — `</td></tr></table><div>` — writes the single break a
  reader sees; a dropped tag beside an allowed `</p>` adds nothing, and a `<br>`
  the generator wrote is the story's own and is left alone. Inline tags are
  still dropped without a break, which is also what a reader sees.

#### The caller no longer decides what this service's logs are made of
- `/api/story/generate`, `/api/image/generate`, and `/api/export/save` each read
  `req.headers['x-request-id']` exactly as sent, wrote it back as the
  `X-Request-ID` response header, and stamped it into every log line for the
  request — including the structured `LogContext.requestId` that reaches the
  thousand-entry log buffer. Nothing bounded its length or its shape, so a
  kilobyte of header text was a kilobyte on every line the request wrote, kept
  in the buffer, and repeatable at the rate the route can be called.
- `readRequestCorrelationId` honours a supplied id when it is plausibly one —
  which is the entire value of the header, since a caller tracing a request
  across their logs and this service's needs it to survive — and mints
  `req_<uuid>` otherwise. A bad id is replaced rather than refused: it names the
  request, it is not part of what was asked for.

### 🐛 Three Quick Wins (August 25, 2026)

#### A running Story Lab job is no longer reported as a failed one
- `/api/story-lab/jobs/:jobId/events` replays the events a job has recorded and
  then ends the response, so the browser drops the connection and reopens it
  after every replay of a job that has not finished. `EventSource` fires `error`
  on that drop, and `StoryService.streamStoryLabJobEvents` read it as a failure:
  it errored the subscription and closed the very connection that was about to
  reconnect, so the app told the reader "Story generation updates stopped" and
  abandoned a batch the server was still generating.
- The reader now distinguishes the two things an `EventSource` `error` can mean
  by `readyState` (`shared/eventStreamRetry.ts`): a pending reconnect is left
  alone, and only an error the browser will not retry ends the stream. The
  genesis stream deliberately keeps failing on the first error — reconnecting
  there restarts a paid generation from the beginning.

#### The API enforces the blueprint size limits, not just the form
- The logline, world details, narrative directives, theme count, and the Heat
  Contract's no-go list were capped only in the Angular `FormValidationService`.
  `/api/story-lab/stories` takes the same blueprint as a POST body and
  `/api/story-lab/stream/genesis` takes it as a query string, and every one of
  those fields goes straight into the Grok prompt the route pays for, so a
  caller that skipped the form could send unbounded prose into a paid
  generation.
- `parseStoryLabBlueprint` now refuses a blueprint past any of those caps,
  naming the field and the limit like every other invalid field it reports. The
  numbers live in `shared/storyBlueprintLimits.ts`, which the form reads too, so
  the two readings cannot drift apart.

#### "Download story" works outside Chrome, and the blob outlives the click
- The download built an anchor, set `download` on it, and clicked it without
  ever putting it in the page. A synthetic click only follows a `download` on an
  attached anchor — Firefox dispatched nothing at all, so the button did nothing
  and said nothing.
- The object URL was revoked on the next task, racing the transfer the click
  starts: a browser that had not begun reading the blob was handed a URL that no
  longer resolved. `shared/htmlDocumentDownload.ts` attaches the anchor, clicks
  it, takes it back out (even if the click throws), and revokes the URL well
  after the browser has had a chance to start.

### 🐛 Deployment Parity Fixes (August 25, 2026)

#### Story Lab API reachable on the Node/Docker deployment
- The Express server registered four hand-written legacy routes and none of the
  `/api/story-lab/*` paths the Angular app actually calls, so every Story Lab
  request fell through to the SSR handler and came back as the index page with
  `200 OK`. All serverless handlers are now mounted through
  `registerApiRoutes`, including the query rewrites `vercel.json` performs for
  the job and account paths.

#### Legacy routes no longer a second implementation
- `/api/health`, `/api/story/generate`, `/api/story/continue`, and
  `/api/export/save` now run the same handlers on both deployments. The Node
  deployment had drifted: no 500KB export byte cap, no string checks on
  `content`/`title`, no redacted structured logging, no `X-Request-ID`, and a
  bare health payload where the serverless route answers an `ApiResponse`.

#### Unsuccessful responses answer a real HTTP status
- The legacy story, continuation, export, and image routes ended in
  `res.status(200).json(result)` whatever the envelope said. `getApiResponseStatus`
  maps the error code to a status, so a refusal, an invalid request, and a
  provider outage are no longer all reported as `200 OK`.

#### Supporting corrections
- `parseStoryLabBlueprint` now names a missing `heatContract` as an invalid
  field instead of returning a blueprint whose declared type said it was there.
  The engine already refused those requests with `CONTENT_POLICY_VIOLATION`.
- The Story Lab account, job, profile, and blueprint modules now type-check
  under the Angular app's strict configuration, which reaches them through the
  Node server.

### 🔧 Technical Improvements (December 20-22, 2025)

#### Grok Model Updates
- **Model Name Refactoring**: Deduplicated Grok model name using private class constant for better maintainability
- **Model Version Update**: Updated Grok model from `grok-4-fast-reasoning` to `grok-4-1-fast-reasoning`

#### Test Coverage Enhancements
- **Token Calculation Tests**: Added token calculation tests to test runner
- **Test Infrastructure**: Refactored tests to use shared utilities, reducing code duplication
- **Async Test Fixes**: Fixed all 5 async timing test failures - all 108 tests now pass

#### Build & Deployment
- **Vercel Configuration**: Added comprehensive Vercel deployment configuration
- **Build Fixes**: Fixed critical build and test errors
- **Vercel Config Updates**: Enhanced Vercel config to support token calculation tests

#### Files Changed:
- Grok model service refactored with private class constant
- Test runner configuration updated
- Vercel deployment configuration files added
- Build scripts and test utilities improved

---

## [2.2.0] - 2025-01-XX

### 🌊 Real-Time Story Streaming (October 11, 2025)

#### Complete SSE Implementation
- **Frontend Streaming Service**: Added `generateStoryStreaming()` method with EventSource-based real-time updates
- **Backend SSE Support**: Enhanced `/api/story/stream` endpoint to accept GET requests for EventSource compatibility
- **Real-Time Progress**: Users see incremental content, word counts, generation speed, and estimated completion time
- **Model Consistency Fix**: Fixed `grok-beta` reference to `grok-4-fast-reasoning` in streaming function
- **Component Refactor**: Updated streaming-story component to use service layer instead of direct EventSource

#### Files Updated (4 total):
- **`story-generator/src/app/story.service.ts`**: New `generateStoryStreaming()` method with progress callbacks (+140 lines)
- **`api/story/stream.ts`**: Added GET request support for query parameters (EventSource compatibility)
- **`story-generator/src/api/lib/services/storyService.ts`**: Fixed line 158 model from `grok-beta` to `grok-4-fast-reasoning`
- **`story-generator/src/app/streaming-story/streaming-story.component.ts`**: Refactored to use service layer

#### Streaming Features:
- **Progress Updates**: Connected → Chunk → Complete event flow
- **Real-Time Metrics**: Words generated, generation speed (words/sec), percentage complete
- **Automatic Extraction**: Title extraction from content, cliffhanger detection
- **Error Handling**: Connection failures, stream interruptions, graceful degradation
- **Cleanup Management**: Automatic EventSource closure on completion/error/unsubscribe

#### User Experience Benefits:
✅ 50% reduction in perceived wait time (immediate feedback vs 21-second blank screen)  
✅ Progressive content display with typing indicator  
✅ Real-time word count and speed metrics  
✅ Estimated time remaining calculation  
✅ Better engagement during generation  

See `STREAMING_COMPLETION_SUMMARY.md` for comprehensive documentation.

---

### 🔧 Production-Ready Logging System (October 10, 2025)

#### Enterprise-Level Observability
- **Structured Logging Utility**: Created comprehensive logger with request correlation, performance tracking, and error details
- **Request Correlation IDs**: Track multi-step operations across services with unique request IDs
- **Performance Metrics**: Automatic tracking of API response times, token usage, and processing durations
- **API Error Capture**: Full stack traces, HTTP status codes, and API response bodies for debugging
- **Environment-Aware**: Verbose logging in development, minimal in production
- **Specialized Log Functions**: API errors, performance, user actions, and critical system failures

#### Files Updated (6 total):
- **`api/lib/utils/logger.ts`**: New 520-line logging utility (singleton pattern, log buffering, sanitization)
- **`api/lib/services/storyService.ts`**: 11 logging integration points (request tracking, performance, errors)
- **`api/lib/services/audioService.ts`**: 15 logging integration points (multi-voice tracking, ElevenLabs metrics)
- **`api/story/generate.ts`**: Request ID generation, validation logging, error tracking
- **`api/story/continue.ts`**: Request ID generation, validation logging, error tracking
- **`api/audio/convert.ts`**: Request ID generation, validation logging, error tracking

#### Logging Features:
- **5 Log Levels**: Debug (dev only), Info, Warn, Error, Critical
- **Context Capture**: Request ID, user input, API tokens, response times, status codes
- **Error Details**: Name, message, stack trace, HTTP status, API responses
- **Sensitive Data Protection**: Auto-redaction of API keys, passwords, tokens
- **Log Buffer**: In-memory storage of recent 1000 logs for debugging
- **External Logging Ready**: Placeholder for Sentry/Datadog/CloudWatch integration

#### Benefits:
✅ Trace entire request flows with correlation IDs  
✅ Measure performance at each pipeline step  
✅ Debug API failures with full context  
✅ Monitor token consumption and costs  
✅ Track user actions for analytics  
✅ Production-ready error monitoring  

See `ERROR_LOGGING_IMPROVEMENTS.md` for comprehensive documentation.

---

### �🚀 Digital Ocean Migration

#### Zero Technical Debt Migration
- **Express Server Integration**: Added API routes to existing SSR server (no adapter pattern, no abstraction layer)
- **Service Layer Preservation**: All seam contracts remain unchanged in `api/lib/services/` (seam-driven compliance)
- **Direct Route Implementation**: Copy-pasted serverless function logic into Express routes (5 endpoints: health, generate, continue, audio, export)
- **Buildpack Deployment**: Digital Ocean auto-detection (no Dockerfile needed)

#### Changed Files (3 total, ~180 lines)
- `story-generator/src/server.ts`: Added middleware (JSON, CORS) + 5 API routes (142 lines added)
- `story-generator/package.json`: Added `build:prod`, `start:prod` scripts + Node 20 engine requirement (3 lines added)
- `.do/app.yaml`: Digital Ocean App Platform configuration (buildpack, health checks, environment variables) (new file, 47 lines)

#### Deployment Details
- **Method**: Digital Ocean App Platform with Node.js buildpack
- **Build**: `cd story-generator && npm install && npm run build:prod`
- **Runtime**: `cd story-generator && npm run start:prod`
- **Port**: 8080 (configurable via PORT env var)
- **Cost**: $5/month (basic-xxs tier)
- **Region**: NYC (configurable to SFO, AMS, etc.)

#### Technical Approach
- **Seam-Driven Compliance**: Service layer untouched, only HTTP transport changed (Vercel functions → Express routes)
- **Mock Fallbacks**: Development mode works without API keys
- **Zero Refactoring**: Direct code copy-paste, no architectural changes
- **Simple Migration**: ~150 lines of actual code changes

### 🔧 Technical Debt Status
**Created**: 0 new items  
**Deferred**: Root package.json TypeScript dependency (non-critical, scale-only issue)  
**Maintained**: All existing seam contracts and service layer architecture

---

## [2.1.0] - 2025-09-21

### 🎉 Major Features Added

#### Multi-Voice Audio System
- **Advanced Character Voices**: Implemented character-specific voices for vampires, werewolves, fairies, and humans
- **Speaker Tag Recognition**: Automatically detects `[Character]:` patterns in generated stories
- **Gender Detection**: Intelligently assigns male/female voices based on character names
- **Seamless Audio Merging**: Combines multiple voice segments with proper timing and silence
- **90+ Emotion Mapping**: Maps emotional states to voice parameters for enhanced expressiveness

#### Enhanced Story Generation
- **TV-Quality Prompts**: Upgraded story generation with professional narrative structures
- **Real-Time Progress**: Added progress indicators with realistic status updates during generation
- **Character Development**: Enhanced character depth and interaction patterns
- **Chapter Continuity**: Improved chapter continuation with theme and tone consistency

#### Audio Player Integration
- **Built-in Audio Player**: Added native HTML5 audio player with controls
- **Download Functionality**: Direct download links for generated audio files
- **Duration Display**: Shows audio length and playback information
- **Format Support**: MP3, WAV, and AAC audio format options

### 🛠️ Technical Improvements

#### Deployment & Infrastructure
- **Angular Budget Fixes**: Resolved CSS bundle size limits for successful Vercel deployment
- **Serverless Optimization**: Enhanced API endpoints for better Vercel serverless function performance
- **Environment Configuration**: Improved environment variable handling across development and production
- **Build Optimization**: Streamlined build process with better dependency management

#### Code Quality & Documentation
- **Comprehensive Comments**: Added detailed JSDoc documentation throughout codebase
- **Type Safety**: Enhanced TypeScript strict mode compliance
- **Error Handling**: Improved error logging and user feedback systems
- **Debug Panel**: Enhanced debugging tools with API health checks and error monitoring

#### User Experience
- **Responsive Design**: Improved mobile and tablet compatibility
- **Loading States**: Added visual feedback for all async operations
- **Success Messages**: Clear confirmation for completed actions
- **Progress Visualization**: Real-time progress bars with percentage indicators

### 🔧 Technical Details

#### Frontend (Angular 20.3)
- Enhanced form validation and user input handling
- Improved component lifecycle management
- Better state management for complex UI operations
- Optimized bundle size and performance

#### Backend (Serverless Functions)
- Advanced audio processing with multi-voice support
- Enhanced story generation with improved prompts
- Better error handling and logging
- Optimized API response times

#### Infrastructure
- Vercel deployment configuration updates
- Environment variable management improvements
- Build process optimization
- Dependency management streamlining

### 🐛 Bug Fixes
- Fixed Angular CSS budget warnings during build
- Resolved TypeScript compilation errors in API services
- Fixed Vercel install command sequence
- Corrected audio player display issues
- Resolved theme selection state management

### 📚 Documentation Updates
- Comprehensive README.md with feature overview
- Detailed API documentation
- Code comments and JSDoc additions
- Development setup instructions
- Troubleshooting guide

### 🔄 Migration Notes
- No breaking changes for existing users
- Enhanced theme system (compatible with previous selections)
- Audio features are additive (backward compatible)
- Environment variables are optional (defaults to mock mode)

---

## [2.0.0] - 2025-09-15 (Previous Release)

### Major Features
- Initial seam-driven architecture implementation
- Basic story generation with creature selection
- Theme-based story customization
- Export functionality (PDF, EPUB, DOCX, etc.)
- Debug panel for development
- Comprehensive test coverage (95%+)
- Enterprise CI/CD pipeline
- Vercel deployment integration

### Technical Foundation
- Angular 20.3 frontend framework
- TypeScript strict mode compliance
- Serverless API architecture
- Mock service implementations
- Contract-based development approach

---

## Development Guidelines

### Version Numbering
- **Major (X.0.0)**: Breaking changes or significant architectural updates
- **Minor (X.Y.0)**: New features, enhancements, backward-compatible changes
- **Patch (X.Y.Z)**: Bug fixes, documentation updates, minor improvements

### Release Process
1. Update version in package.json files
2. Update this CHANGELOG.md
3. Create release branch
4. Run full test suite
5. Deploy to staging
6. Merge to main
7. Tag release
8. Deploy to production

### Contributing
When contributing, please:
- Add entries to the "Unreleased" section
- Follow the established format
- Include technical details for developers
- Note any breaking changes
- Reference issue numbers when applicable

---

*For detailed technical documentation, see the [API Documentation](./api/README.md) and [Development Guide](./DEVELOPMENT.md).*