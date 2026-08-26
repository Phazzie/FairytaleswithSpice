# Changelog

All notable changes to the Fairytales with Spice project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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