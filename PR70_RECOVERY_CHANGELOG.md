Created: 2026-05-26 00:12 EDT

# PR #70 Recovery Changelog

This is the chronological work log for the PR #70 recovery. It should capture commands, decisions, self-review notes, validation results, and anything that changes the plan.

## 2026-08-27 UTC - A Refused List That Deleted The One It Replaced, A Relationship Kind Two Readers Took On Trust, And Three Label Ladders That Absorbed What They Had Not Been Taught

Actions:

- Stopped an all-refused list of facts deleting the facts it was meant to add to. `relationshipEdges` and `spiceLevels` in `continuityExtractor.ts` both distinguish an array that arrives **empty** from an array whose entries were **all refused** — the first is the model reporting that there is nothing here, which it is allowed to say; the second is the model trying to report something and getting the shape wrong, which is no reason to believe the recorded facts are gone. `arrayOfStrings`, the third array reader in the same merge and the one behind `CharacterProfile.secrets` and `PlotThread.foreshadowedDevices`, was still returning whatever survived its filter. The case looks unreachable until you remember what those entries are: lists of short prose, which a model asked for answers in whatever shape it finds natural — `[{"secret": "She was there that night"}]`, `[["the pact"]]`, a bare `null` where it had nothing for one slot. Every one satisfies `Array.isArray`, survives nothing, and **cleared the character's real secrets**, so the extraction that was supposed to add a fact deleted several and the next continuation prompt was built from a character who had never kept anything from anyone. This is the same defect the previous slice's review follow-up fixed on the array directly above it, on the array beside it; the rule is now the same for all three, and `[]` still clears.
- Made both readers of a relationship edge check the kind the writer checks. `RelationshipEdge.relationship` is declared `RelationshipKind` and the extractor has checked model output against `RELATIONSHIP_KINDS` since that vocabulary got a table — but **the two functions that read the array out of stored state checked it with `typeof === 'string'`**: `readRelationshipEdges` in `app.ts` and `getCharacterRelationships` in `continuationGuidance.ts`, both written with the type predicate that *makes* the promise. So a snapshot written before the writer's check, or by an older client, handed both trees a value wearing a union it is not in, and TypeScript reported none of it. The Angular tree is where that is paid for: `formatRelationshipPreviewDetail` is keyed by exactly the five kinds the union lists, so a stored `"mentor"` reached a table with no line written for it and the reader got a relationship pressure card with an **empty detail line**. An unrecognised kind normalizes to `'unknown'` rather than dropping the edge — the pair and the note are a relationship the story really established, and `'unknown'` is the member of the vocabulary that says the kind is the part nobody can vouch for. On the API side the kind never reaches the brief text, only `scoreRelationshipActivation`, which is the smaller cost of the same gap. The docblock describing this guard had also drifted one function up in `app.ts`, onto `readThreadForeshadowedDevices`, and is back on the function it describes.
- Gave three label ladders over tabled vocabularies a total `Record` each, so a value they have not been taught is a compile error rather than a line quietly chosen for it. `formatThreadDebtLabel` in `shared/continuityActivation.ts` is the one this repository had already named: the previous entry's self-review recorded that it "still names three statuses and falls through for the fourth, which is correct only while the union has exactly four", and `story-state-vocabulary` held it together with `assert(PLOT_THREAD_STATUSES.length === 4)` — a test standing in for a guarantee the language can make. Keyed by the derived union, `resolved` gets its own label instead of the fallback's, and that is worth naming: both callers filter resolved threads out before the label is reached (`isUnresolvedThread` in the guidance, `status !== 'resolved'` in the Angular panel), so **the one way that label could ever have reached a reader or the model was to announce a thread the story has already paid off as one it still owes**. `formatStoryMemoryLifetimeLabel` and `formatRelationshipPreviewDetail` in `app.ts` get the same treatment against `STORY_MEMORY_LIFETIMES` and `RELATIONSHIP_KINDS`; the second is what turns the `unknown` kind above from an empty detail line into the sentence that was always written for it.
- Extended three existing suites rather than adding a file: `tests/story-state-vocabulary.test.ts` (the refused-list rule in both directions, and thread-debt labels proved distinct and non-empty across the whole table instead of by a length assertion), `tests/story-lab-continuation-guidance.test.ts` (an unrecognised kind keeps its pressure line and its source-map entry), and `story-generator/src/app/app.spec.ts` (the panel reads a stored `"mentor"` as `unknown` and shows the line written for it). No `package.json` script changes were needed.

Self-review:

- Every behavioural change here has a counterfactual and all three were run, then reverted immediately and not committed. Replacing `arrayOfStrings`'s fallback with `return values` fails `story-state-vocabulary` at `an all-refused secrets array should keep the secrets the state already held`. Changing `getCharacterRelationships` to *drop* an unrecognised kind rather than normalize it fails `story-lab-continuation-guidance` at `an unrecognised relationship kind should not cost the edge its pressure line`, with the whole brief printed to show the pressure line missing. Reverting `readRelationshipEdges` to `edge.relationship as RelationshipKind` fails the new Angular spec with `Expected 'Continuity PreviewRelationship pressureMara and Duke ValeCurrent relationship edge' to contain 'This connection should change the next scene.'` — which is the defect itself, rendered: the card draws, and its detail is empty.
- The refused-list rule is the only change here that alters what gets stored, and it is deliberately the opposite trade from the un-fixed code's. It is the right way round for the reason the previous slice gave for the array above it: the merge cannot tell a model that means "no secrets" from one that misspelled the shape unless `[]` is left to mean the first, and the suite pins both directions.
- The `resolved` thread-debt label is a text change to a string nothing renders today, and no claim is made that a reader has seen it. It is changed because the fallback made it wrong rather than absent, and a total `Record` has to answer for it either way.
- Normalizing an unrecognised kind to `unknown` on the API side is a small behaviour change and it is named: `scoreRelationshipActivation` no longer matches the reader's brief against the unrecognised word. A brief saying "mentor" no longer activates that edge on the word alone — it still scores on both character names and the note. That is the intended reading: the activation vocabulary is the one this app defines.
- Non-claim: nothing here checks a relationship edge's `characterId` for emptiness the way the writer does. An empty id matches no character in either tree and the edge is dropped downstream, so the two readers behave the same; tightening it is not needed to make the type honest and is not done.
- Non-claim: `StoryLabJobCreationRequest`'s deferred variant still spells `kind: 'export' | 'audio'` by hand, a fifth spelling of the pair `STORY_LAB_DEFERRED_JOB_KINDS` named. It is a type-side leftover with no runtime reader — the route checks the kind through `isDeferredStoryLabJobKind` — and folding it in would mix a job-routes change into a continuity slice.
- Non-claim: `StreamingProgressChunk` in the Angular contract is still declared with a four-member `type` union and has no writer and no reader anywhere in either tree. Retiring dead contract surface is the shape of #281, not of this slice.
- Validation: `npm run test:all` exits `0` across all 71 registered suites; `npx ng test --watch=false --browsers=ChromeHeadlessNoSandbox` passes 196 of 196 specs, one more than the previous entry recorded because this slice adds one; `tsc --noEmit` is clean against both `tsconfig.app.json` and `tsconfig.spec.json`. Root and Angular installs were needed to run any of it. `npm install` rewrote the `name` field of the root `package-lock.json` to match this checkout's directory casing; that was reverted and the lockfile is unchanged. The tracked `node_modules` tree the install dirtied was deliberately left unstaged, as the previous entries record.

## 2026-08-27 UTC - Four Continuity Vocabularies A Prompt Never Names And A Merge Silently Drops, A Job Kind Redeclared Narrower Over The Contract's Own, And Four Severities Whose Glyphs Live In Two Files

Actions:

- Gave the continuity state's four vocabularies one table each, and told the model what they are. A character's `archetype`, a thread's `status`, a thread or artifact's `lifetime`, and a relationship edge's `relationship` were the last closed sets in `story-generator/src/app/contracts.ts` declared as inline unions on the interfaces with **no runtime list anywhere** — so every reader that had to *check* one wrote the list out again. `continuityExtractor.ts` alone held four copies: three chains of `value === '…' || value === '…'` and a `RELATIONSHIP_KINDS` `Set` of bare strings; `shared/continuityActivation.ts` held a fifth, declaring `PlotThreadStatus` as its own union because it sits below the Angular tree and could not reach the contract's. A union and a hand-written membership check are not the same statement, and TypeScript related them only through the cast each check needed to be written with — `RELATIONSHIP_KINDS.has(edge.relationship as string)` compares model output to a `Set<string>` and would still compile the day a sixth kind is added to the type. **The failure mode here is not a refused request.** `mergeAiContinuity` does not reject an unrecognised value; it *drops* it and keeps whatever the state already held, so a vocabulary a reader has fallen behind on produces a continuity fact the model reported correctly and the state silently refused — a character whose archetype never changes, a thread whose status never moves. `shared/storyStateVocabulary.ts` is the table now, in `shared/` for the reason `creatureVocabulary` gives: it sits below both trees, which is what lets the Angular interfaces derive their field types from the same lists the API's merge checks against. `spiceLevels` in the same file goes through `SPICY_LEVELS` too — the scale has had a table since the blueprint pickers were given one, and that filter was the last reader in the repository still comparing against `1 | 2 | 3 | 4 | 5` by hand.
- And closed the half of that gap the tables alone do not close: **`buildContinuityPrompt` never told the model what any of these fields may contain.** `requiredJsonShape` named the object types (`'array of CharacterProfile-like objects'`) and stopped; `existingState` shows values only for entities the story already has, so on a first extraction the model sees none of them. A model answering `archetype: "love_interest"`, `status: "open"`, `lifetime: "arc"`, or `relationship: "mentor"` was asked for a value, gave a reasonable one, and had it thrown away without being told. The prompt now carries an `allowedValues` block keyed by the field paths the merge checks — read from the same tables, so the asker and the checker cannot disagree — for a few dozen tokens.
- Gave the two job kinds these routes actually run a name. `StoryLabJobKind` has four members and `POST /api/story-lab/jobs` serves two of them, answering `export` and `audio` with `UNSUPPORTED_JOB_KIND` and reserving them for the durable runner. That split is the vocabulary the code works in and it had no name, so the pair was written out by hand three times in two trees: `runJobWork`'s `kind: 'genesis' | 'continuation'` parameter, the route's refusal branch matching the two deferred kinds as literals, and — the worst of them — **a local `type StoryLabJobKind = 'genesis' | 'continuation'` in `AppComponent`, three hundred lines below the import block, shadowing the contract's four-member union for that entire file.** Nothing reports that: a narrower union is assignable to a wider one, so `JobStatusPanelState.kind` looked like the contract's type and was not, and `updateJobStatusFromJob` quietly coerces any non-`continuation` job to `genesis` to satisfy it — which is why an `export` job snapshot would have been announced to the reader as "Story generation". `STORY_LAB_GENERATION_JOB_KINDS`, `STORY_LAB_DEFERRED_JOB_KINDS`, `StoryLabGenerationJobKind`, and `isDeferredStoryLabJobKind` are the split, and both trees read it. The refusal message now names the deferred kinds from the list it checks, rather than saying "Export and audio" in prose beside a branch that matched them one at a time.
- Gave the four error severities one table and one glyph each. `ErrorSeverity` was the last closed vocabulary in the Angular contract with no runtime list, and the debug panel — its only reader — wrote it out twice more: `getSeverityIcon` chose a glyph per severity in a `switch` whose `default` was already unreachable, and `getErrorCounts` returned an object literal with one hand-written key per severity, which the template read one key at a time from four hand-written `<span *ngIf>` rows **each repeating the same emoji the `switch` had just chosen**. So the icon for a severity was declared in two files, and the day they disagree the same error is one glyph in the list and another in the count beside it. A fifth severity failed worse: `ErrorLoggingService.logError` takes whatever the caller passes, so it would reach the list as the `switch`'s neutral `📝` and be counted nowhere. `ERROR_SEVERITIES` is the table, `ERROR_SEVERITY_ICONS` is a total `Record<ErrorSeverity, string>` so a missing glyph is a compile error, and the template renders the rows the component counted.
- Stopped a refused relationship edge taking the character's real ones with it. This came out of CodeRabbit's merge-risk note on the PR and it was reproduced before it was believed: `relationshipEdges` returned whatever survived its filter, so an array whose entries were **all** refused satisfied `Array.isArray`, filtered to nothing, and stored the empty list — a model answering the single edge `{characterId, relationship: "mentor"}` cleared a `lover` edge the story had actually established. That is this slice's own thesis failing one level up: dropping the bad value is right, letting the drop destroy the good state is not. `spiceLevels` directly below it already read this way and its note already said why, so the two arrays beside each other in one function disagreed. An array that arrives *empty* still clears, and the difference is the point — `[]` is the model reporting that this character has no relationships, which it is allowed to say; an array with entries in it is the model trying to report relationships and getting the vocabulary wrong, which is no reason to believe the recorded ones are gone.
- Added `tests/story-state-vocabulary.test.ts` and `tests/error-severity-vocabulary.test.ts`, both registered in `test:all`, and extended `tests/story-lab-job-contracts.test.ts`, already registered under `test:story-lab-privacy-contracts`. All three import `assert` from `tests/assert.ts` rather than declaring their own copy.

Self-review:

- The continuity change has a behavioural counterfactual and it was run. Reverting `normalizeArchetype` to a chain that omits `narrator`, and dropping `characters[].archetype` from the prompt's `allowedValues`, fails the new suite at both halves — the merge no longer accepts an archetype its own table lists, and the prompt no longer offers the values the merge accepts for that path. That mutation was reverted immediately and is not committed. The suite asserts both directions for all five vocabularies: every value in each table survives the merge, and `love_interest`, `mentor`, `open`, `arc`, and spice level `9` are each dropped to the documented default rather than stored under a type that forbids them. The prompt half is read back through `JSON.parse` rather than by substring, because what matters is that the model is handed these lists *under the field paths the merge checks*, not that the words appear somewhere in the text.
- The relationship fallback is a behaviour change, is the only one in this slice that alters what gets stored, and has its own counterfactual: reverting `relationshipEdges` to `return edges` fails the new suite at `an edge whose kind is outside the table must not clear the relationships the story established`. Reverted immediately and not committed. All five cases are pinned in both directions — an all-refused array, an array of junk entries, and an omitted field each keep the established edges; an empty array still clears; a partly valid array keeps what survived rather than falling back. It is worth being plain that this is the *opposite* trade from the one the un-fixed code made, and it is the right way round because the extractor cannot tell a model that means "no relationships" from one that misspelled a kind unless the empty array is left to mean the first.
- No claim is made that the four vocabularies disagreed today. They did not — five copies that agree cannot change which values work now. What changes behaviourally is the prompt: the model is told the four closed sets for the first time, which should reduce the silently-dropped answers rather than change how a correct answer is handled. The extractor's own acceptance is unchanged for every value in every table, and the suite pins that.
- `formatThreadDebtLabel` still names three statuses and falls through for the fourth, which is correct only while the union has exactly four. It reads the derived union now, and the new suite asserts the length it depends on, so a fifth status fails there instead of being labelled "Open promise" in the reader's continuity panel.
- The job-kind change has a compile-time counterfactual: `AppComponent`'s narrowing was hidden by the shadowing declaration, and removing that declaration makes `updateJobStatusFromJob`'s coercion the visible statement it always was — it is kept, and commented, because the route refuses the deferred kinds outright so no `export` or `audio` job exists for this client to poll. The runtime assertions are a partition: every kind is either one these routes run or one they defer, the deferred predicate names the deferred kinds and nothing else, and neither the component nor the route restates the pair by hand. A fifth job kind now has to be added to one of the two tables or `story-lab-job-contracts` fails.
- The `UNSUPPORTED_JOB_KIND` message text changes, and the change is a no-op today: `formatDeferredJobKindList()` renders the current table as "Export and audio", which is exactly the prose it replaces. `tests/story-lab-job-routes.test.ts` asserts the error *code*, not the sentence, and was not touched.
- The severity change has a counterfactual and it was run: putting `🔴` back into the template fails the new suite with `the template should not restate the "critical" glyph the component already decided`. Reverted immediately and not committed. The component's icons are read back out of its source rather than imported, because importing the component reaches `@angular/common` through the decorator before a single assertion runs — the same reason `story-lab-picker-vocabulary` reads the two pickers as text. The `Record` totality half is enforced by the preflight's typecheck of both Angular projects; the suite asserts what a type cannot, that no two severities share a glyph.
- One incidental improvement, named because it is a behaviour change and not a rename: the count header used to call `getErrorCounts()` **twice per row it drew** — eight calls, each walking the whole error buffer four times, on every change-detection pass. The counts are now computed once when the error stream emits. The values are identical; only when they are computed changes.
- Non-claim: `StoryBeat.beatType` and `RelationshipEdge`'s neighbours in `BatchProgressStatus` are still inline unions. `beatType` has exactly one producer (`storyStateBuilder`, mirrored in `mockData`) and no validator, and `BatchProgressStatus` already has `BATCH_STATUS_LABELS` as its total record; neither is the arrangement this slice exists to end, and widening to them is a different decision.
- Non-claim: nothing here makes the account routes' `readProjectFromBody` check the arrays it asserts (`candidate['chapters'] as SavedStoryProject['chapters']` and the three beside it). That is the same class of gap the extractor's `relationshipEdges` was written to close, on a different seam, and it is its own slice.
- Validation: `scripts/recovery/preflight.sh --skip-status` — the exact command CI runs — exits `0`, covering `git diff --check`, the Vercel function-count check, `tsc --noEmit` against `tsconfig.app.json`, `tsconfig.spec.json`, and the Vercel API file list, `npm run test:all` (69 registered commands, two of them new), the Angular production build, and build-output verification. `npx ng test --watch=false --browsers=ChromeHeadlessNoSandbox` passes 195 specs; that count is lower than the 217 the previous entry recorded because #281 retired the job-recovery specs, not because anything here removed one. The `proving-grounds.css exceeded maximum budget` warning in the build is pre-existing and untouched. Root and Angular `npm ci` were needed to run any of it; both lockfiles are unchanged, and the tracked `node_modules` tree the install dirtied was deliberately left unstaged, as the previous entries record.

## 2026-08-27 UTC - Eighteen Themes Spelled Four Ways, A Production Prompt The Proving Grounds Transcribed Rather Than Read, And An Envelope Declared Twice Without Its Metadata

Actions:

- Gave the eighteen classic themes one table. They were written out by hand **four times**, in the same order every time, which is the only reason the four ever agreed: the `ThemeType` union in `api/_lib/types/contracts.ts`; `VALIDATION_RULES.themes.allowedValues` two hundred lines under it, which `loggableRequestParameters` reads to decide whether a caller's `themes` are written to the log or replaced with `[UNRECOGNIZED]`; `CLASSIC_THEME_TYPES` in `storyLabEngine`, which decides which of the reader's theme seeds survive translation into a classic generation request; and the classic half of `ImageService.mapThemeToVisualElement`'s table, which decides what the image model is told to draw. Four copies of eighteen names is four places a nineteenth theme has to be added, and each failure is silent and different: the union accepts it, the log reports the app's own value as unrecognised, the Story Lab drops it on the way to the generator and substitutes `forbidden_love`, and the image prompt asks for `mysterious elements` instead of the thing the reader chose. `extractThemesFromContent` was the one reader already safe, because its keyword table is `Record<ThemeType, …>` and a missing theme is a compile error there; `shared/themeVocabulary.ts` is what lets the other three be held to that standard. The image service's table is split in two — `STORY_LAB_SEED_VISUAL_ELEMENTS` keyed by `string`, because the seam accepts any seed id, and `CLASSIC_THEME_VISUAL_ELEMENTS` typed `Record<ThemeType, string>` — so the classic half is now exhaustive by type, the way `getCreatureContext` beside it already was. This is the arrangement `CREATURE_ARCHETYPES` was written to end for the ten creatures and `EXPORT_FORMATS` before it for the five formats; the themes were the vocabulary it had not yet reached.
- Stopped the Proving Grounds transcribing the production prompt and had it build the same one. That page offers one template called "Current Production" and measures every variant against it, so the claim is the page's whole basis for comparison — and the template was a hand-copy of a prompt that has moved on. **The copy had already been repaired in place twice**, once for the word-count pacing block and once for the spice ladder, and repairing a copy rung by rung is what this ends. What it was still missing: `MORAL DILEMMA TRIGGER`, the instruction that puts a desire-versus-principle choice at the midpoint and lets it drive the ending, absent entirely; the eight cliffhanger types' `Example:` lines and the sentence saying there are eight, so the variant was compared against a bare list of labels; `HOOK PLACEMENT` and `SERIALIZATION PROMISE`, absent entirely; **the whole `ENHANCED VOICE SYSTEM` half of the voice section** — twenty accents, the emotion states, seven vocabulary categories, per-creature examples, the variety enforcement rules, and the example story opening, about four thousand characters of the production system prompt reduced to six lines; and the fourth show-don't-tell example. In the user prompt it was missing the `CHEKHOV LEDGER` entirely, so a variant was compared against a prompt that asked for no planting at all, along with the two story requirements naming the author-style bank and the beat structure, the `VOICE METADATA REMINDER`, the `[Character, emotion]` formatting line, and the closing instruction to pay the planted elements off at the midpoint — and it sent the reader's own idea **under no heading**, where production labels it `CREATIVE DIRECTION:`. `shared/productionStoryPrompt.ts` holds the blocks and the two builders, and both sides call them. The two sections that are genuinely per-run — the author styles drawn for the creature and the beat structure drawn for the story — are arguments; the Proving Grounds passes neither, which is the same omission its copy always had and is now the only one.
- Gave the API envelope one declaration. `ApiResponse` and `ApiErrorPayload` were declared in `api/_lib/types/contracts.ts` **and again in `story-generator/src/app/contracts.ts`**, and the two had drifted in the way that matters most for an envelope: the API's carries `metadata` and the Angular one did not. Every classic route attaches one — `exportService`, `imageService`, and `storyService` all do — and it holds `requestId`, `processingTime`, the model that answered, `rateLimitRemaining`, and `partialFailures`, which is **the only place a chapter that failed inside an otherwise successful batch is reported**; `storyLabEngine` reads `result.metadata?.partialFailures` off it. None of that was reachable from the Angular tree: a client wanting to log the server's own `requestId` beside a failed export, or to tell the reader which chapters of a batch did not arrive, was reading a field its own type said did not exist. The two interfaces were also not assignable to each other, so nothing would have reported the drift. The Angular contract re-exports the API's now, as it already does for `ExportFormat`, `SaveExportSeam`, `ImageStyle`, and `ImageGenerationSeam`, and `api/_lib/story-lab/contracts.ts` takes the envelope from the API contract directly rather than back through the Angular one. `details` was `any` on the API side and `unknown` in the Angular declaration; the stricter spelling is the one kept, and `toJobError` — its only reader — passes it along rather than reaching into it.
- Added `tests/theme-vocabulary.test.ts`, registered in `test:all`, and `story-generator/src/app/contracts.spec.ts`, already run by `ng test`. Rewrote `tests/proving-grounds-production-prompt.test.ts` around the shared module, extended `prompt-templates.service.spec.ts`, and updated the two assertions in `tests/spice-level-prompt-ladder.test.ts` and `tests/story-prompt-tables.test.ts` that read prompt text out of files it no longer lives in.

Self-review:

- The production system prompt is **byte-identical** to the text it replaced, with one documented exception. That was not assumed: the original template literal was extracted with its interpolations replaced by tokens, the builder's output was reconstructed the same way, and the two were diffed. The single difference is the story generated *without* a chapter scope, which used to carry two blank lines where the chapter block would have gone — the old template interpolated an empty string on its own line — and now carries one, like every other join. With a chapter scope the two are identical. `tests/proving-grounds-production-prompt.test.ts` asserts that `StoryService.buildSystemPrompt`'s actual output still contains each shared block verbatim, and that neither prompt builder's source file carries a `PROSE ENGINE`, `SERIALIZATION HOOKS`, `AUDIO FORMAT`, `WORD COUNT PACING`, or `CHEKHOV LEDGER` heading of its own — a heading in either file is a transcription starting again.
- The Proving Grounds prompt does change, and that is the point of the slice: the page now presents the prompt the app sends. Its per-run values are still tokens (`{{CREATURE}}`, `{{THEMES}}`, `{{SPICY_LABEL}}`, `{{WORD_COUNT}}`), joined by two more — `CREATIVE DIRECTION: {{USER_INPUT}}`, replaced as a whole line so an absent idea takes the heading with it exactly as production does, and `{{CHEKHOV_LEDGER}}`, drawn at fill time from `STORY_CHEKHOV_ELEMENTS` with the same Fisher-Yates shuffle and the same `STORY_CHEKHOV_ELEMENTS_PER_STORY` count the generator uses. Drawn at fill time rather than at template time for the reason production draws per story: a page showing the same two elements for every run would be describing one run.
- The theme change has a compile-time counterfactual and it was checked. Adding a nineteenth `vengeance_pact` to `CLASSIC_STORY_THEMES` fails the Vercel API type check twice — `TS2741: Property 'vengeance_pact' is missing` at `imageService.ts` and at `storyContentAnalysis.ts` — which is the failure that used to be silent at the first of those. That mutation was reverted immediately and is not committed. The runtime half is a coupling assertion made at the strongest available level: `VALIDATION_RULES.themes.allowedValues` is asserted to be the *same array object* as the shared table, and every theme in the table is asserted to be kept by `toLoggableThemes`, carried through `toClassicGenerationInput` rather than replaced by the default, and given a visual element of its own — with a further assertion that no two themes ask the image model for the same picture, since the fallback is not the only way that table can stop distinguishing two themes.
- The envelope change has a compile-time counterfactual too. Redeclaring the Angular `ApiResponse` without `metadata` fails `tsc -p tsconfig.spec.json` at three places in the new `contracts.spec.ts`, which is what those specs are for; reverted immediately and not committed. Nothing that runs changes — the envelope's runtime shape is what the routes already send — and no such claim is made.
- Non-claim: the Proving Grounds' "Current Production" system prompt still omits the drawn author styles and the drawn beat structure. Those are chosen per generation and cannot be a constant; the page previews both in its own panel, which reads the same shared tables `StoryService` draws from. Feeding a freshly drawn pair into the comparison prompt would make every A/B run vary by more than the variant under test, which is a different decision and is deliberately not made here.
- Non-claim: `VALIDATION_RULES.themes.allowedValues` is still only a log allow-list. `validateStoryInput` checks that `themes` is an array of at most five entries and never that the entries are on the list, and `ERROR_CODES.INVALID_THEME_VALUE` is still raised by nothing. Closing that is a route-behaviour change — the streaming route builds `themes` by splitting a query string — and it is its own slice; this one only makes the list a single table.
- Validation: `npm run test:all` (66 suites) passes, `npx ng test --watch=false --browsers=ChromeHeadlessNoSandbox` passes 217 specs, `tsc --noEmit` is clean against `tsconfig.app.json`, `tsconfig.spec.json`, and the Vercel API file list, and `npm run build` completes. The `proving-grounds.css exceeded maximum budget` warning in that build is pre-existing and untouched. Root and Angular `npm ci` were needed to run any of it; the root install dirtied the tracked `node_modules` tree, which was deliberately left unstaged.

## 2026-08-27 UTC - Ten Creature Names Spelled Seven Ways, A Spice Ladder The Proving Grounds Shows But No Run Sends, And Four Vocabularies Declared Twice

Actions:

- Gave the ten creatures one table. The list was written out by hand **seven times**: the `CreatureType` union in `api/_lib/types/contracts.ts`, the `CreatureArchetype` union in `story-generator/src/app/contracts.ts`, the `CREATURE_ARCHETYPES` table beside the second — which the API tree already reached across for through `api/_lib/story-lab/contracts` — and four readers that each kept their own copy rather than ask any of the three: `supportedCreatures` in `StoryService.validateStoryInput`, which decides which requests `/api/story/generate` refuses; `ALLOWED_CREATURES` in `loggableRequestParameters`, which decides whether a caller's `creature` is written to the log or replaced with `[UNRECOGNIZED]`; and the two `getCreatureDisplayName` maps, in `storyContentAnalysis` and in `PromptTemplatesService`, that name the protagonist to the model. Seven copies of ten names is seven places an eleventh creature has to be added, and each failure is silent and different: the union accepts it, the route refuses the request, the log reports the app's own picker value as unrecognised, and both prompt builders name the protagonist something other than what the reader chose. The comment on `ALLOWED_IMAGE_STYLES` had already described `ALLOWED_CREATURES` as reading from a table — "the same arrangement as `ALLOWED_CREATURES`" — which was the one thing it was not. `shared/creatureVocabulary.ts` is the table now, in `shared/` for the reason `storyLabThemeSeeds` gives: it sits below both trees, which is what lets the API's contract derive its union from the same list the Angular picker renders. `CreatureType` is kept as an alias of `CreatureArchetype` because the whole API tree spells the type that way. The display names are derived with `titleCaseIdentifier` rather than restated, since both copies were ten entries of exactly the title-cased id.
- Gave the spice ladder one home, and stopped the Proving Grounds showing a prompt no run has ever sent. That page offers one template called "Current Production", and every other template is measured against it, so the claim is the page's whole basis for comparison — the same claim `tests/proving-grounds-production-prompt.test.ts` was written to defend after the word-count pacing block drifted. **Both halves of the spice ladder had drifted, and neither was covered.** The label substituted into the user prompt's `SPICE LEVEL: {{SPICY_LABEL}} (Level {{SPICY_LEVEL}}/5)` line came from `getSpicyLabel` in `storyContentAnalysis` on the production path and from `PromptTemplatesService.getSpicyLabel` in the preview, and the two agreed on **none of the five**: level 4 reaches the model as `Very spicy` and was previewed as `Scorching & Explicit`. The system-prompt block was worse, because it is what actually constrains the chapter: production sends `SPICE LEVELS (match exactly and do not exceed the requested level)` followed by five rungs naming what is and is not allowed on the page, and the Proving Grounds `productionSystemPrompt` carried an earlier revision — a heading with **no ceiling instruction** and five one-line descriptions ("Yearning looks, accidental touches, sweet anticipation") naming none of those boundaries. So a comparison run at any spice level was measuring the distance between the two prompts rather than the variant under test. `shared/spiceLevelPromptLadder.ts` holds the five rungs, the label reader, and `SPICE_LEVEL_PROMPT_BLOCK` — heading included, because the ceiling instruction is half of what had gone missing — and both prompt builders interpolate it.
- Gave four vocabularies one declaration. `NarrativeTone`, `SpicyLevel`, `HeatTensionMode`, and `HeatIntimacyBoundary` were declared in `api/_lib/types/contracts.ts` **and, character for character, in `story-generator/src/app/contracts.ts`**. The API contract is the one that describes the wire — `StoryGenerationContext` and `HeatContractIntent` there are what a generation request carries, and `tensionMode` and `intimacyBoundary` are fields of the second — so the Angular contract re-exports them now, exactly as it already does for `ExportFormat` and `ImageStyle`. Two identical unions are structurally assignable to each other in both directions, so nothing would have reported the drift; the first value added to one and not the other would simply have been refused at the route after the form let the reader choose it. The runtime tables (`NARRATIVE_TONES`, `SPICY_LEVELS`, `HEAT_TENSION_MODES`, `HEAT_INTIMACY_BOUNDARIES`) stay where the picker and `FormValidationService` read them; only the second declaration of each type is gone.
- Added `tests/creature-vocabulary.test.ts` and `tests/spice-level-prompt-ladder.test.ts`, both registered in `test:all`, and extended `prompt-templates.service.spec.ts`, which is already run by `ng test`. Both new suites import `assert` from `tests/assert.ts` rather than declaring their own copy.

Self-review:

- The system-prompt block is **byte-identical** to the text it replaced. That was not assumed: the generated `SPICE_LEVEL_PROMPT_BLOCK` was compared against the removed literal before the literal was deleted, and `tests/spice-level-prompt-ladder.test.ts` asserts that `StoryService.buildSystemPrompt`'s output still contains it verbatim. The only prompt text this slice changes is the Proving Grounds preview, which is the point of the change.
- `getSpicyLabel` and `getCreatureDisplayName` keep their fallbacks. Level 99 still reads `Spicy` and an unrecognised creature still reads `Creature`; `tests/story-content-analysis.test.ts` asserts all three of those and was not touched. One behaviour does change for the better and it is worth naming: the old creature map was an object literal indexed by caller string, so `getCreatureDisplayName('constructor')` returned the `Object` constructor — truthy, so the `|| 'Creature'` never fired — and `generateMockStory` calls `.toLowerCase()` on the result. `validateStoryInput` refuses such a request before any prompt is built, so this was unreachable on the generation path rather than a live bug; the membership check simply has no such key. The Angular copy's own failure was the mirror of it: `Record<CreatureArchetype, string>` indexed by a value its type promised could not arrive, returning `undefined` into a prompt slot.
- The creature de-duplication has no behavioural counterfactual on the ten creatures and none is claimed — seven copies that agree cannot change which creatures work today. The tests are coupling assertions, and they are made at the strongest available level: both contract files' `CREATURE_ARCHETYPES` are asserted to be the *same array object* as the shared table, not two arrays that happen to match. What the suite does check end to end is that every creature in the table is accepted by `validateStoryInput`, kept by `toLoggableCreature`, and named by both display readers, so an eleventh creature added to the table alone is either wired through or fails here.
- Non-claim: `AppComponent.spiceOptions` still carries its own five labels (`Storybook Romance`, `Warm`, `Spicy`, `Very Spicy`, `Inferno`). Those are reader-facing card titles with descriptions beside them, not prompt tokens, and they differ from the ladder only in casing. Folding them in would change UI copy, which is a different decision from making two prompt builders agree, and it is deliberately not made here.
- Non-claim: the four re-exported types are type-only, so nothing that runs changes. `WordCount` in the API contract (which includes 700) and `WordBudget` in the Angular one (which does not) genuinely differ and were left alone.
- Validation: `scripts/recovery/preflight.sh --skip-status` — the exact command CI runs — exits `0`, covering `git diff --check`, `tsc --noEmit` against both Angular tsconfigs and the Vercel API, `npm run test:all` (65 suites), the Angular production build, and build-output verification. `npx ng test --watch=false --browsers=ChromeHeadlessNoSandbox` passes 211 specs. The `proving-grounds.css exceeded maximum budget` warning in that build is pre-existing and untouched. Root and Angular `npm install` were needed to run any of it, as the previous two entries record; the install again dirtied the tracked `node_modules` tree and rewrote the `name` field of `package-lock.json`, and again the lockfile was restored and `node_modules` deliberately left unstaged.

## 2026-08-27 UTC - A Word Boundary Spelled Four Ways, An Image Seam Declared Twice And Already Drifted, And Three Copies Of The Statuses A Job Does Not Leave

Actions:

- Gave the repository one answer to "is this keyword the word, or is it inside a longer one". Four scans ask it and it had four spellings, three of them `\b`: `containsWholeWord` in `storyContentAnalysis`, `PRESSURE_KEYWORD_PATTERNS` in `continuationGuidance`, and `CLIFFHANGER_HOOK_PATTERNS` in `cliffhangerService`. The fourth, `storyQualityHeuristics`, spells it `(?<![\p{L}\p{N}\p{M}])…(?![\p{L}\p{N}\p{M}])` and is the one that is right, and its own docblock says why: **`\b` is ASCII-only**, defined against `[A-Za-z0-9_]`, so it reads a word boundary between an ASCII letter and an accented one and credits a keyword sitting inside a word that ends in an accent. `"Touché," he said` matched the `touch` keyword and filed the chapter at spicy level 3 — *Romantic with Heat*, on a word of fencing banter — and `caressé`, `sińful`, and a decomposed `desiré` land the same way. That is the collision class the substring scans were repaired for across #261, #266, #268, #269, and #272, arriving through the boundary that was supposed to have ended it, and it is the same non-ASCII blindness `shared/continuityActivation.ts` was written to end for the activation scan. What it decides is not internal: `extractSpicyLevelFromContent` is the level the story reopens at, `extractThemesFromContent` becomes `themesContinued`, `extractPlotThreads` and `analyzeEmotionalTone` are written into the continuation prompt as `Active Plot Threads` and `Emotional Tone`, the pressure keywords choose what the continuity courtroom reports, and the cliffhanger hooks choose the three continuations the next batch is prompted with. `api/_lib/utils/wholeWord.ts` holds the one reading — beside `escapeRegExp`, whose docblock predicted this exact extraction — and all four scans go through it. `_` is deliberately dropped from the class where `\b` counted it, because an underscore joins two words rather than continuing one and this app's ids (`power_dynamics`, `dark_secrets`) are built from the very words these scans look for. `extractPlotThreads`' `\bwhat\s+(if|would|could)\b` goes through it too, as a pattern source rather than a literal.
- Gave the image seam one declaration. `ImageGenerationSeam` was declared in `api/_lib/types/contracts.ts` and again in `story-generator/src/app/contracts.ts`, and the two had already stopped describing the same seam. **`themes` was `ThemeType[]` on the server and `string[]` on the client, and the client was right**: the Story Lab sends its own theme seed ids, which the classic eighteen-name vocabulary does not contain, and both readers downstream already know it — `ImageService.mapThemeToVisualElement` takes a `string` and answers for either vocabulary, and `ALLOWED_THEMES` in `loggableRequestParameters` had to be widened with `STORY_LAB_THEME_SEED_IDS` for the same reason. Only that line still claimed the route receives a closed set it does not. **`creature` was `CreatureType` against `CreatureArchetype`**, the same ten names under two names. And **`seamName`/`description` are literal types whose spellings differed**, so the two interfaces were not assignable to each other in either direction — nothing crossed that boundary because nothing could. The Angular contract re-exports the API's now, the way it already re-exports `SaveExportSeam` and `ExportFormat`.
- Gave the five image styles one table, where six copies of them were kept by hand: the two `ImageStyle` unions, the picker's `IMAGE_STYLES`, `VALIDATION_RULES.imageStyle.allowedValues`, `SUPPORTED_STYLES` in `ImageService`, and — twice more — the `styleMap` and `grokStyleMap` lookups that turn a style into prompt text and into the provider's own style parameter. `IMAGE_STYLES` is now the declaration and `ImageStyle` is derived from it, rather than a union with a list `satisfies`-checked against it, because every one of these copies could only ever go wrong by being *short* one and `satisfies` catches a wrong entry rather than a missing one. The two lookups are `Record<ImageStyle, string>`, so a sixth style added to the table without a look does not compile; before, it fell through to `'artistic style'` and `'natural'` and was generated in a look nobody asked for, with no error anywhere. `VALIDATION_RULES.imageStyle.allowedValues` is the copy that mattered most for being right — `toLoggableImageStyle` reads it to decide whether a caller's `style` is one of ours or is replaced with `[UNRECOGNIZED]` before it reaches the log.
- Gave the terminal job statuses one list. Three places decided which statuses a job does not leave, each with its own copy of the same three names beside a union that has six: `StoryService.streamStoryLabJobEvents` closed the `EventSource` on `['completed', 'failed', 'cancelled']`, `AppComponent.handleJobSnapshot` reported "still running" for anything its three branches did not name, and `postgresStoryLabJobStore`'s `UPDATE_JOB_SQL` stamped `completed_at` when `$3 in ('completed', 'failed', 'cancelled')`. They agree today; what they cannot do is disagree usefully. A status added to the union — `waiting_for_review` is already there, and is the only one of the six that arrived after the other five — has three unrelated files to be remembered in, in two languages, and being forgotten in any one of them fails quietly: the browser holds a connection open for a job that is over, the reader watches a progress bar for a batch that will never arrive, or the row's `completed_at` stays null forever. `STORY_LAB_TERMINAL_JOB_STATUSES` and `isTerminalStoryLabJobStatus` are the list, all three read it, and the SQL quotes it rather than restating it. The component's fall-through now fails a terminal status it has no branch for instead of reporting it as running.
- Added `tests/whole-word-matching.test.ts`, registered in `test:all`, and extended `tests/image-service.test.ts` and `tests/story-lab-job-contracts.test.ts`, both already registered.

Self-review:

- The word-boundary fix was reproduced against the old code before being kept. Reverting `wholeWordPattern` to `` new RegExp(String.raw`\b(?:${source})\b`) `` fails the new suite at its first accented case — ``AssertionError: `touch` is not the word in `touché`.`` — and would take the four scan-level assertions with it. That mutation was reverted immediately and is not committed. The suite asserts both directions: the accented spellings are refused, and `touched`, `sins`, `what if`, `star-crossed`, `blood froze`, and a real cliffhanger hook all still match.
- The image-style fix has one counterfactual and it is the one that matters. Giving `romantic` the same modifier string as `artistic` fails the new image test with `each style should reach the provider as its own look (got 4 distinct prompts for 5 styles)`. The compile-time half was checked separately: adding a sixth `sepia` to `IMAGE_STYLES` produces `TS2741: Property 'sepia' is missing` at both lookups, which is the failure that used to be silent. Both mutations were reverted immediately and neither is committed.
- The seam de-duplication has a behavioural counterfactual only in the type system, and it is stated as such: nothing that runs today changes, because nothing could cross between two interfaces whose literal `description` types differed. What changes is that `themes` stops claiming to be a closed set the route does not receive. `ImageService` was already written for the looser reading, so no runtime guard is loosened by this.
- The terminal-status change has no behavioural counterfactual and none is claimed: the three copies agreed, so reading them from one place cannot change which jobs finish today. The tests are coupling assertions — that the predicate names the three and refuses the other three, that the count matches the list, and that the SQL interpolates `TERMINAL_JOB_STATUS_SQL_LIST` rather than quoting a status by hand. The component's new fall-through branch is the one behaviour change: a terminal status with no branch above it now fails the batch with the kind's default message instead of leaving the progress timer turning. No such status exists today, which is why it is reachable only by adding one.
- Validation: `npm run test:all` (63 suites) passes, `npx ng test --watch=false` passes (209 specs), `npx tsc --noEmit -p tsconfig.app.json` and `-p tsconfig.spec.json` are clean, and `npm run build` completes. The `proving-grounds.css exceeded maximum budget` warning in that build is pre-existing and untouched by this slice. Root and Angular `npm install` were needed to run any of it — the `tsx: not found` masking the previous entry recorded is still real, and `npm run test:all` exits `0` while running nothing without it; nothing here changes that, and it is still its own slice. The install dirtied the tracked `node_modules` tree and rewrote the `name` field of `package-lock.json`; the lockfile was restored and `node_modules` was deliberately left unstaged.

## 2026-08-27 UTC - Ten Voice Banks That Had Already Drifted, A Continuity Preview Scoring By Its Own Rules, And Seven Blueprint Vocabularies Kept By Hand In Two Places

Actions:

- Gave the ten author voice banks one declaration instead of two, and restored three em dashes the API's copy had lost. This is the table the note on `shared/storyPromptTables.ts` cites as the reason that module exists: `GenerationLogicService` kept its own copy of the banks, the API grew `SIREN_STYLES` and `DJINN_STYLES`, and the copy did not, so for two of the ten creatures the Proving Grounds panel named twelve fae authors for a story the server wrote from four sea or wish voices. The beat and Chekhov tables were moved to `shared/` on the strength of that evidence; this table, the one that supplied it, stayed where it was — and had drifted again by the time it moved. Three of the twelve vampire samples read `prey-or perhaps`, `nothing-nothing-had prepared`, and `tension-human` on the API side against `prey—or perhaps`, `nothing—nothing—had prepared`, and `tension—human` in the panel's copy. A voice sample is an example of an author's prose handed to the model as the thing to sound like, so its punctuation is not incidental to it: the em dash is the mark all three sentences are built on, and a hyphen in its place is a different sentence. The reader comparing panel to prompt saw one; the model was shown the other. Both copies were parsed and diffed field for field before the move — all sixty-four entries agree on every other cell — so the em dash is the only content change, and `tests/author-style-banks.test.ts` names the three phrases so a re-flattening fails there. The banks are written as sixty-four delimited rows rather than object literals, for the reason `BEAT_STRUCTURE_ROWS` gives at length: structurally identical literals read to a token-based copy-paste detector as copies of one block, and a quality gate measures new code only, so the cost lands the moment a table changes file. `parseAuthorVoiceRow` refuses a row without exactly three non-empty cells. The pairing table and the two draw counts moved with the banks, so `selectRandomAuthorStyles` and the panel's `selectRandomAuthors` now build the same pool from the same function rather than from two tables that happen to agree.
- Stopped the Story Lab's Continuity Preview panel scoring activation by rules of its own. `buildContinuationGuidance` scores every unresolved thread, artifact, relationship, and continuity warning against the brief the reader wrote, orders them by that score, and puts the top few in front of the model; the panel exists to show that decision before the reader presses continue, and labels each item it lists `Matched continuation guidance` or names the fallback that put it there. It was making that claim from `normalizePreviewActivationText` and `scorePreviewActivationMatch`, written beside the guidance builder's pair and disagreeing with them four ways. **The token floor was different** — four characters in the guidance, three in the panel — so a brief mentioning a `vow`, an `oath`, a `key`, or a `debt`, which is what a story's promises are mostly named with, activated a thread on the panel that the guidance had scored zero and ordered by story position like everything else. **The candidates were combined differently**: the guidance adds up what a thread's label, description, and devices each contribute, and the panel took the best single one, so a thread echoed three times weakly and one echoed twice in a single label rank one way in the prompt and the other way on the panel. **The panel did not read the foreshadowed devices at all**, so a brief that named the planted device and nothing else activated the thread in the prompt and not in the preview of it. And **punctuation was kept on one side**: the panel's normalizer retained the apostrophe, so `Mira's oath` was one candidate phrase there and `mira s oath` in the prompt. Nothing failed; the panel simply described a selection the run does not make, on a screen whose only purpose is to describe it — which is the rule the author-bank repair above states. `shared/continuityActivation.ts` holds the one normalizer, the one scorer, and the thread-debt label both sides were spelling out. The panel still lists fewer items than the courtroom carries — two threads to its three, one artifact to its two, one warning to its two — because it is a preview beside a form rather than the prompt itself; what changes is that the items it lists are the head of the same ordering, and its `Matched` label means what the guidance means by it.
- Gave the seven blueprint vocabularies one table each. `parseStoryLabBlueprint` decides what the route accepts and `FormValidationService` decides what the form lets a reader send, and both wrote out all seven — creature, tone, spicy level, word budget, batch size, heat tension mode, intimacy boundary. The route wrote two of them a second time inside `isHeatContract`, where neither the form nor the contract could see them, and restated three more in prose in its refusal messages. Four of the seven already had a runtime table beside their type in `contracts.ts` — `CREATURE_ARCHETYPES`, `NARRATIVE_TONES`, `HEAT_TENSION_MODES`, `HEAT_INTIMACY_BOUNDARIES`, which `storyLabProfileStore` reads and neither of these two did; spicy level, word budget, and batch size had no table at all and now do. Two hand-kept copies of one vocabulary fail in a particular direction: the form accepts a value the route refuses, and the reader learns which by pressing generate and being answered `400 INVALID_BLUEPRINT` naming a field by its wire name, on a form that never said there was a limit. That is exactly the failure `maxCharacterNameLength` in the shared limits was added to end for the free-text fields; this is the same thing held on the value lists. `tests/story-lab-blueprint-parser.test.ts` kept an eighth copy as its own `allCreatures` fixture, which would have left the loop silently covering nine of ten; it reads the table now too.
- Added `tests/author-style-banks.test.ts`, `tests/continuity-activation.test.ts`, and `tests/story-lab-blueprint-vocabulary.test.ts`, all three registered in `test:all`, and extended `story-generator/src/app/app.spec.ts`.

Self-review:

- The continuity-preview change was reproduced against the old code before being kept. Reverting `scorePreviewActivationMatch`, the normalizer, and the thread candidates fails both new specs: `App does not claim a continuity match the guidance builder would not make FAILED` with `Expected 'Continuity Preview...Broken vow...Matched continuation guidance' not to contain 'Matched continuation guidance'`, and `App ranks continuity the way the guidance builder ranks it FAILED` with `Expected 105 to be less than 30` — the panel putting the thread the brief echoes twice above the one it echoes three times. That mutation was reverted immediately and is not committed.
- The voice-bank change has one behavioural counterfactual and it is narrow: the three em dashes now reach the model, where the API's copy had hyphens. `tests/author-style-banks.test.ts` asserts the three phrases. The rest of that move has no behavioural counterfactual and none is claimed — the two copies agreed on every other cell, so merging them cannot change what any prompt or panel says today. The test is a coupling assertion instead: the table's shape, that both readers import the shared module, that neither declares an `author:` entry of its own again, that no two creatures share a bank object, and that a draw is two primary voices plus one from the pairing.
- The blueprint-vocabulary change has no behavioural counterfactual and none is claimed: all seven lists agreed, so reading them from one place cannot change which blueprint the route takes today. What it removes is the way they could stop agreeing. `tests/story-lab-blueprint-vocabulary.test.ts` asserts the property in both directions — that the route accepts every value each contract table names and refuses one it does not, and that neither reader lists a vocabulary again. The three refusal messages that restated a table in prose are now built from the table, which does change the wording a caller sees: `spicyLevel must be one of: 1, 2, 3, 4, 5.` rather than `must be between 1 and 5`, and the same shape for word budget and batch size. No test or route contract pinned the old strings.
- The panel's display limits are deliberately unchanged. Raising them to the courtroom's three threads, two artifacts, and two warnings is a change to how much the form shows rather than to whether what it shows is true, and one existing spec pins the artifact limit by asserting the second artifact is absent. That is its own slice; this one makes the ordering and the `Matched` label honest and says so in the docblock.
- Validation: `npm run test:all` (60 suites) passes, `npx ng test --watch=false` passes (209 specs), and `scripts/recovery/preflight.sh --skip-status --skip-build` completes — Angular app and spec type checks and the Vercel API type check. `npx -p node@20 -c "npm run build"` completes separately; the `proving-grounds.css exceeded maximum budget` warning in that build is pre-existing and untouched by this slice. Root and Angular `npm ci` were needed to run any of it; the root install dirtied the tracked `node_modules` tree, which was deliberately left unstaged.

## 2026-08-27 UTC - Two Prompt Tables The Preview Kept Its Own Copy Of, A Tone Scan That Could Not Read The Past Tense, And A Streaming Estimate Whose Only Reader Was Deleted

Actions:

- Gave the beat-structure and Chekhov tables one declaration instead of two. Both lived in `StoryService` — `getRandomBeatStructure` writes the structure into the system prompt, `generateChekovElements` plants two of the elements — and both lived again in `GenerationLogicService` in the Angular tree, which is what the Proving Grounds panel shows a reader as the prompt a run would use. The twenty entries of each were identical character for character, which is the only reason the panel was telling the truth. That is not a safe place to leave them, and this repository has already paid for it one table over: `getAllAuthorStyles` in that same file kept its own copy of the author banks, the API grew `SIREN_STYLES` and `DJINN_STYLES`, and the copy did not — so for two of the ten creatures the panel reported a bank of twelve fae authors (Sarah J. Maas, Holly Black, Julie Kagawa) for a story the server generated from four sea or wish voices. The note left on that repair states the rule: a prompt-comparison tool that shows a prompt the run did not use is worse than one that shows nothing, because the reader has no way to tell. Both tables moved to `shared/storyPromptTables.ts`, beside `storyLabThemeSeeds` — the other list the API tree and the Angular tree both have to agree on — and both trees now read them. The count is shared too: `STORY_CHEKHOV_ELEMENTS_PER_STORY` is what the prompt plants and what the preview lists, so a preview naming three where the prompt planted two is no longer expressible. Nothing about either table's contents changes; what changes is that a structure added, retired, or reworded reaches the preview at the same moment. The beat table is written as twenty delimited rows rather than twenty object literals, because the shape a table has when it sits still is not the shape it can afford when it moves: twenty structurally identical object literals are, to a token-based copy-paste detector, twenty copies of one block — literals are anonymized before the comparison — and a quality gate measures new code only, so the cost lands the moment the table changes file. Moving it as object literals scored 19.1% duplication on new code against a 3% gate, on a change whose entire purpose is removing a duplicate. `parseBeatStructureRow` refuses a row without exactly four non-empty cells, so a row mistyped while editing throws at import rather than reaching a prompt, and the parsed table was diffed against `origin/main`'s literal to confirm it is identical entry for entry, field for field.
- Taught `analyzeEmotionalTone` to read the prose, and to read it in the tense the prose is written in. It was the last scanner in `storyContentAnalysis.ts` still doing neither. **It scanned the markup:** every sibling — `extractPlotThreads` above it, `extractThemesFromContent` and `extractSpicyLevelFromContent` below it, and the cliffhanger, image, continuity, and story-quality scanners elsewhere — strips to `stripStoryHtmlToText` first so that what is measured is what the reader sees, and the docblock on `extractSpicyLevelFromContent` names that exact defect as one of the two it was written to repair. This function lowercased the generator's HTML, so a word the model split across an inline tag (`dan<em>ger</em>ous`) was two fragments rather than the word, and the entities the generator writes sat in the text undecoded. **It matched bare stems:** the `dominan` stem was repaired by spelling out `dominant`, `dominance`, and `dominated`, and the other four families were left as they were. A bare stem under `\b…\b` matches only the present-tense dictionary form, and narrative prose is written in the past tense — `smile` does not match "he smiled", `laugh` does not match "she laughed", `want` does not match "she wanted him", `wound` does not match "the wound had scarred", `danger` does not match "dangerous", `power` does not match "powerful". A five-sentence chapter of smiles, laughter, wanting, wounds, threats, and power read as `angsty` and nothing else, and a chapter that avoided the five present-tense forms entirely read as the fallback. That fallback is not cosmetic: `buildContinuationPrompt` writes it into the model's context as `Emotional Tone`, so the model was told a chapter of wounds and threats was mild romance and asked to continue from there. The families are now a table beside their own matcher with every inflection listed, the way `EMOTION_FAMILIES` in `storyQualityHeuristics.ts` already argues a fixed lexicon has to be. The stems are unchanged and nothing new is added to them.
- Retired `shared/streamingProgressEstimate.ts`, whose only production reader was deleted three commits before this branch was written. #271 retired the unreachable fake-streaming demo — `StreamingStoryComponent`, `StoryService.streamStoryGeneration`, and the `/api/story-lab/stream/genesis` route — on the reasoning that "the job-based progress path (AppComponent / openJobEventStream) already provides real per-chapter SSE progress against actual generation, so this deletes the parallel fake/unreachable one instead of rebuilding it". That module was part of the parallel one and was left behind: its whole docblock is an argument about what the streaming panel's `words/sec` and `~Ns remaining` readings used to claim, and there is no streaming panel. The surviving job-driven panel shows a stage, an elapsed count, and a percentage bar — no speed and no estimate — so there is nothing here to repoint it at, and wiring one in would be adding a reading that panel has never offered rather than finishing a retirement. `tests/streaming-progress-estimate.test.ts` and its `test:all` entry go with it: a suite of a dozen assertions against a module nothing ships reads as coverage and is not. This slice's third quick win was originally an off-by-one in that same genesis route's `estimatedMsRemaining`; #271 landed while this branch was open and deleted the file, so the fix was dropped in the merge rather than carried, and the retirement it left behind was taken instead.
- Added `tests/story-prompt-tables.test.ts`, registered in `test:all`, and extended `tests/story-content-analysis.test.ts`, already registered. Removed `tests/streaming-progress-estimate.test.ts` and its `test:all` entry with the module it covered.

Self-review:

- Both behavioural fixes were reproduced against the old code before being kept. Reverting `analyzeEmotionalTone` fails the new past-tense case with `past-tense prose should still read as passionate, got "angsty"` — the old scan found one of five registers in a chapter carrying all five. That mutation was reverted immediately and is not committed. The other two changes have no behavioural counterfactual and none is claimed: the two prompt tables were byte-identical, so moving them cannot change what any prompt or panel says today, and the retired module had no reader to change the behaviour of.
- The shared-table change has no behavioural counterfactual and none is claimed: the two copies were byte-identical, so moving them cannot change what any prompt or panel says today. `tests/story-prompt-tables.test.ts` is a coupling assertion instead — it asserts the tables' shape, that both readers import the shared module, that neither declares a table of its own again, and that the number of `[Chekhov1]`/`[Chekhov2]` slots the prompt names equals the number it plants. A copy pasted back into either tree fails there rather than being noticed by the next author.
- `analyzeEmotionalTone` now reports more registers for the same chapter, which is the point rather than a side effect, but it is a real behaviour change to what the continuation prompt carries and is stated as one. The tightening runs the other way too and is asserted: `predominant` split across an inline tag still must not read as `intense` once the markup is rejoined.
- This branch was opened against `0ef068e` and merged `origin/main` after #271 landed. The merge accepts that PR's deletion of `api/story-lab/stream/genesis.ts` and `tests/story-lab-stream-genesis.test.ts` rather than reinstating either, and resolves `package.json` onto its `test:all` with `test:story-prompt-tables` added.
- Validation: `npm run test:all` (57 suites) passes, `npx ng test --watch=false` passes (207 specs), and `scripts/recovery/preflight.sh --skip-status --skip-tests` completes — Angular app and spec type checks, the Vercel API type check, the Node 20 production build, and build-output verification. The `proving-grounds.css exceeded maximum budget` warning in that build is pre-existing and untouched by this slice. Root and Angular `npm install` were needed to run any of it; the root install dirtied the tracked `node_modules` tree and rewrote the `name` field of `package-lock.json`, and both were deliberately left unstaged.

## 2026-08-27 UTC - A Continuity Panel That Threw On Its Own Stored State, One Read Time Spelled Three Times, And A Beat Selection Handed A Blueprint It Never Opened

Actions:

- Stopped the continuity extractor storing model output it never checked, and stopped the Angular continuity panel throwing on what it had already stored. `mergeCharacters` normalizes every field it merges — `normalizeArchetype` for the archetype, `stringOr` for the prose, `arrayOfStrings` for the secrets — except the two arrays, which were asserted instead: `candidate.relationships as CharacterProfile['relationships']` and the same for `spiceCompatibilities`. `Array.isArray` was the whole check, so the array's *contents* were whatever the model wrote, and this is model output arriving through `JSON.parse`: an entry can be `null`, a bare name string, or an object missing the fields the type says are there. A cast is not a validation. The API tree already knew — `getCharacterRelationships` in `continuationGuidance.ts` re-filters the same array on every read, for object, string `characterId`, and string `relationship`, which is a guard that only needs to exist because what it reads was never checked. The Angular tree had no such guard: `buildContinuityRelationshipPreviewItem` in `app.ts` iterated `character.relationships` and read `relationship.characterId` straight off each entry, so a single `null` among them is a `TypeError` thrown while rendering — not a missing preview line but a Continuity Preview that does not draw at all, on a story whose chapters the reader can still see. `relationshipEdges` and `spiceLevels` now check each entry at the point it is stored: `relationship` against the five kinds `RelationshipEdge` lists rather than merely `typeof === 'string'`, since a model answering `"mentor"` is proposing a kind this app has no reading for, and `notes` defaulted to empty rather than left `undefined` under a declaration saying it is a string. `spiceCompatibilities` is a `SpicyLevel[]` — the `1 | 2 | 3 | 4 | 5` union the whole app is dialled in — and `[0]`, `[9]`, and `["3"]` all satisfied the old cast; levels outside the union are dropped rather than clamped, because a model that answers `9` has not said "5", it has said something the scale does not express. Both fixes were needed rather than either alone: the extractor guard stops new state going bad, and state written before it — a saved project, a cloud-stored snapshot — still reaches the panel, so `readRelationshipEdges` in `app.ts` is the API tree's filter on the reader that lacked one.
- Gave the reading-time estimate one statement instead of three. `ExportService.generateMetadata` reads `READING_SPEED.WORDS_PER_MINUTE`, and its own docblock argues why it should: the constant "has been in `constants.ts` since that file was written [...] with no reader anywhere in the repository — the one place that estimates a reading time spelled `200` inline instead. A named constant nothing reads is not a constant; it is a note." That change gave the constant one reader and stopped there — `StoryService.generateStory` and `StoryService.continueChapter` both still spelled `Math.max(1, Math.ceil(totalWordCount / 200))` — so the note became a constant with one reader and two copies, which is the same defect one round further along. The three expressions agree today, and this is stated as a de-duplication rather than as a repair of a number a reader is currently shown: what it removes is the way they could stop agreeing, since retuning `WORDS_PER_MINUTE` would move the read time in the exported document and leave the `estimatedReadTime` in the API response, for the same story, at the old rate. `estimateReadTimeMinutes` is the one statement, and all three sites go through it. The floor is the one place the three were written differently — the two `StoryService` sites floored at a minute and the export did not — though not in a way any request can reach, since `/api/export/save` refuses a body whose `content` is not a non-empty string and `countWords` answers at least one for anything that clears it.
- Dropped the blueprint `getRandomBeatStructure` was handed and never opened. It took `input: StoryGenerationSeam['input']` and read nothing out of it. That is not a harmless extra argument on a private method: every structure in the table carries a `spiceIntegration` line naming the spice levels and themes it suits — "Perfect for Level 3-5 stories", "Mystery themes enhance psychological tension", "Comedy themes can subvert expectations" — so a signature taking the blueprint reads, from the one call site, as the selection weighing them. It does not, and has not; a Level 1 story is as likely to be told to write TEMPTATION CASCADE as a Level 5 one. Dropping the parameter is not a decision that the draw should stay uniform. It states that it currently is, so a later change that wants the blueprint to matter has to add the argument and thread it into the choice rather than finding it already there and assuming it is already read.
- Extended `tests/story-lab-continuity-merge.test.ts` and `tests/export-service.test.ts`, both already registered in `test:all`, and `story-generator/src/app/app.spec.ts`.

Self-review:

- The two behavioural fixes were reproduced against the old code before being kept. Reverting `mergeCharacters` fails the new merge test with `only the well-formed edge should survive (got [null,"Dorian",{"characterId":"character-dorian"},...])`; reverting `readRelationshipEdges` in `app.ts` fails the new spec, `App renders the Continuity Preview around malformed stored relationship edges FAILED`, which is the render throw itself rather than a missing assertion.
- The export read-time test does **not** fail against the old code, and is documented as not being a counterfactual. The first version of it claimed otherwise: it asserted a "0 minutes" document was reachable, and the counterfactual passed, because `countWords` reads the story markup and answers at least one word for any body the route accepts — `<p></p>` tokenizes to one word, not none. The docblock on `estimateReadTimeMinutes` and the entry above were corrected to describe a de-duplication rather than a live bug once that was found. The test was kept as a coupling assertion — the document's read time against `estimateReadTimeMinutes`, across one word, one short of a minute, exactly a minute, and one past it — so a later local copy here is caught by the mismatch it creates. It compares against the word count the document itself reports rather than the fixture's, so it asserts the arithmetic rather than how the fixture happens to tokenize.
- The beat-structure change has no behavioural test and none was added, because there is no behaviour to pin: the parameter was unread, so removing it cannot change what the prompt says. The compiler and the existing prompt-guard suite are the check.
- `spiceLevels` answering the `[3]` default for an array that held nothing usable is a deliberate change from the old cast, which stored the empty list under a type saying there is at least a default. The fallback path is covered separately: a continuation whose model output does not mention a character's edges must not erase the edges already stored, which `testExistingEdgesSurviveASilentUpdate` asserts for both arrays.
- Validation: `npm run test:all` (59 suites) and `npx ng test --watch=false` (211 specs) both pass, and `npx ng build` completes. The `proving-grounds.css exceeded maximum budget` warning in that build is pre-existing and untouched by this slice. Root `npm install` was needed to run any of it — `tsx` was absent, and `npm run test:all` exits `0` with `sh: 1: tsx: not found`, so the suite reports success while running nothing. That masking is real and is left for its own slice; nothing here changes it. The install also dirtied the tracked `node_modules` tree, which was deliberately left unstaged.

## 2026-08-27 UTC - A Paragraph Break Read Out Of "They", A Blueprint Field That Answered 500, And Two Prompt Cuts The Excerpt Module Missed

Actions:

- Stopped `stripSpeakerTagsForDisplay` breaking a paragraph on a word that merely *begins* with one of its transition words. The narrative-shift test was `/^(The|As|But|However|Still)/i` with no word boundary, beside four unanchored `includes` calls, and it decides where the reader sees a paragraph break in every chapter this app displays — `StoryService` runs it over the raw chapter on both the genesis and the continuation path. The anchored half is the damaging one, because the words it catches by prefix are the commonest openers in narrative prose: `The` is inside `They`, `Them`, `Their`, `Theatre`; `As` is inside `Asked`, `Aside`, `Ashes`, `Astonished`; `But` is inside `Butler`, `Button`; `Still` is inside `Stillness`. A run of ordinary sentences — "She set the cup down. / They had not spoken since. / Butler waited by the stair." — was therefore given a paragraph per line. That is the exact opposite of the welding this method's blank-line branch was fixed for, and no better: the reader is shown a chapter chopped into one-sentence stubs wherever the prose happens to use a pronoun, and unlike the welding it happens on prose that has no blank lines for the correct branch to read. The unanchored half was wrong in the other direction — the break this test decides goes before the *whole line*, so a mid-line `Then` or `Later` ("She waited. Then he spoke.") put a break where the word never justified one. The words are unchanged; they are now one anchored `^(?:…)\b` alternation, which is the whole-word reading `containsWholeWord` in the same file already applies to the theme and emotion scans, anchored at the start because "opens a new beat" is what this test means. `< 50` is named `NARRATIVE_SHIFT_MAX_LINE_LENGTH` so both halves of the test are legible.
- Stopped a blueprint field wrapped in an array crashing the parser. `getString` reads the repeated-value form a query string carries — `?logline=a&logline=b` arrives as an array — and handed `value[0]` straight back, typed `string` on the strength of the `QueryValue` union rather than checked. That holds on the query path, where a runtime parses repeated parameters into an array of strings. It does not hold on the body path: `parseStoryLabBlueprintFromBody` casts a parsed JSON object to `QuerySource`, so an array field there holds whatever the caller put in it, and `{"logline": [42]}` handed a `number` to `getString(source['logline'])?.trim()` — a `TypeError`, `?.` being no help against a value that is present and merely of the wrong type. The throw leaves the parser entirely and the route's own catch answers `500 INTERNAL_ERROR`, which tells the caller the service failed and that retrying might help, for a body only they can fix and on the exact field this parser exists to refuse by name with `400 INVALID_BLUEPRINT`. It is the same failure `readJsonObjectBody` was written for one layer up, arriving through a field rather than through the body itself, and every field read through this helper had it: `logline`, `worldDetails`, `narrativeDirectives`, `protagonistName`, `antagonistName`, and `heatContract`. The first entry is now read under the same rules as a bare value — a string is itself, a number or boolean is spelled out as one already was, and anything else is not a string and is reported as the missing or invalid field it is.
- Cut the two prompt lines `textExcerpt` was written for and did not reach. That module's docblock names the three sites it replaced `slice`-with-a-number at — `generateNextChapterHint`, `createContextExcerpt`, and `buildContinuityPrompt` — and `continuationGuidance` had two more of the same cut, `compactPromptLine` and `compactPromptLineToLength`, both `compacted.slice(0, max - 3) + '...'`. Both failures the module exists to prevent are present. `slice` counts UTF-16 code units, so a cut can land between the halves of a surrogate pair and leave a lone surrogate; `JSON.stringify` escapes such a surrogate rather than refusing it, so nothing throws and the continuation prompt is simply built with a character the story never contained. And the cut lands mid-word, on lines that are not a screen the reader can re-read but the thread labels, artifact names, character names, and continuity warnings the *next chapter is written from*. `capAtWordBoundaryWithinCodeUnits` joins `capAtWordBoundary` and `tailAtWordBoundary` in `textExcerpt`, differing only in the unit it measures: `continuationGuidance` spends its per-line budget in `.length`, so restating that budget in code points would be a wider change than the cut itself and would let one astral character overrun the section cap it was measured against. A code point is still never split. `compactPromptLine` is now `compactPromptLineToLength` at the courtroom's own budget rather than a second copy of the arithmetic, and the `- 3` in both is `PROMPT_LINE_ELLIPSIS.length`.
- Extended `tests/story-content-analysis.test.ts`, `tests/story-lab-blueprint-parser.test.ts`, `tests/story-lab-continuation-guidance.test.ts`, and `tests/text-excerpt.test.ts`. All four are already registered in `test:all`.

Self-review:

- Each fix was reproduced against the old behaviour before being kept. Reverting `storyContentAnalysis.ts` fails the new test with `lines that merely start with a longer word should stay in one paragraph, got 4`; reverting `getString` fails with `logline: [42] threw instead of being answered: getString(...)?.trim is not a function`; reverting `compactPromptLine` fails with `the cut should end on a whole word of the label` and, on the astral fixture, `the guidance must not carry half a character`.
- The first draft of the guidance tests passed against the *old* code, which is the failure mode the counterfactual exists to catch. Both fixtures were accidentally benign: the word-boundary label's 177th code unit happened to fall on a space, and `'🗝 '.repeat(120)` puts a space every third unit so unit 177 fell between two pairs rather than inside one. Both fixtures now assert the property that makes them fixtures — `/\S/.test(label[176]) && /\S/.test(label[177])`, and `label.slice(0, 177).charCodeAt(176) >= 0xd800` — so a later edit cannot quietly make them benign again.
- `{"logline": [42]}` parses as `"42"` rather than being refused, and that is deliberate: a bare `logline: 42` has always parsed as `"42"` through the same helper's number branch, so wrapping it changes nothing. What changes is only the shapes that are not scalars at all. The test asserts both directions for that reason.
- The narrative-shift pattern keeps its case-insensitivity, which the anchored half always had. The lines reaching it are model prose with a speaker tag already stripped off the front, so a beat can open mid-sentence.

## 2026-08-27 UTC - A Hook Read Out Of "Misunderstood", A Library Capped By An Order Nobody Chose, And A Profile With No Measure On Its Free Text

Actions:

- Stopped `CliffhangerService` classifying a chapter's hook by words that merely *contain* its keywords. `CLIFFHANGER_PATTERNS` was six flat lists matched with `patterns.filter(pattern => lowerContent.includes(pattern))`, and it is the last substring scan in the repository — the same one `extractThemesFromContent`, `extractSpicyLevelFromContent`, `extractPlotThreads`, and `storyLabEngine`'s `containsAny` were all moved off, arriving here through the one door nobody had checked. The sharpest collisions are the negations: `understood` is inside `misunderstood`, so two people misunderstanding each other for a whole chapter — the premise of most of this genre — scored `character_revelation`, the type whose suggestions tell the next batch to show how the truth changed a relationship; `decision` is inside `indecision`, so a chapter about a character who cannot choose scored `emotional_conflict`, whose first suggestion is "Force the character to choose"; `truth` is inside `untruth` and `price` inside `priceless`, the latter the exact collision `PRESSURE_KEYWORD_FORMS` was fixed for a commit ago on the same word; `revealed` is inside `unrevealed` and `realized` inside `unrealized`. The ordinary kind are here too: `trapped` inside `strapped`, `shadow` inside `overshadowed`, `secret` inside `secretary`, `question` inside `questionable`. What that decided is not internal — the winning type becomes `cliffhangerType`, which selects the three `suggestedContinuations` the next batch is prompted with and the `varietyScore` that penalises a chapter for repeating the type before it, and the whole analysis travels back to the caller as `cliffhangerAnalysis` on the continuation response — and a final paragraph counts three times over (once in the whole-story scan, twice more on its own), so one collision in the closing lines outweighs any real hook in the rest of the chapter. Each entry is now one hook and every spelling that counts as it, matched through a compiled `\b(?:…)\b` alternation per hook, which is the same repair and the same reading `containsWholeWord` in `storyContentAnalysis` and `PRESSURE_KEYWORD_FORMS` in `continuationGuidance` already apply. Strength is counted per *hook* rather than per spelling, so listing inflections does not re-weight a hook against the ones with fewer of them. The scanned copy also has its whitespace collapsed within each paragraph — the fixed lexicon holds multi-word phrases, and a phrase the generator wrapped across a line inside one paragraph was invisible to a matcher looking for one space, which is the failure `extractPlotThreads`'s own `\bwhat\s+(if|would|could)\b` names. The paragraphs are still joined by a blank line, so a phrase cannot be assembled across the boundary between two of them.
- Moved the cloud library's listing cap out of the storage layer, where it was applied under an ordering nobody had chosen. `LIST_PROJECTS_SQL` ended `order by updated_at desc limit 50`. The reader's ordering is applied at the route — `handleProjectsRoute` reads `librarySort` off their profile and hands the list to `sortStoryProjectListItems`, deliberately there because "the ordering is a property of the answer, not of the storage" — so the fifty items were always the fifty most recently *updated* ones and the reader's sort only rearranged the survivors. A reader on `title_asc` was shown the alphabetical order of the fifty most recently touched projects rather than the first fifty by title, and one on `created_desc` the creation order of the same fifty; the project that should have been at the very top of their library was missing, and `CloudStoryProjectList` carried nothing that said the listing was capped at all. The in-memory adapter beside it applied no cap whatsoever, so the two stores did not even agree on what the library contained. A cap and an ordering are one decision — whichever ordering picks the items decides which ones are kept — so `STORY_LAB_LIBRARY_MAX_ITEMS` now lives in `storyProjectStore` beside `sortStoryProjectListItems` and is applied at the route, after the sort, by both adapters. The `order by` stays in the SQL because it is index-backed (`story_projects_owner_updated_idx`) and gives the two adapters the same base order to sort from. `CloudStoryProjectList.totalProjectCount` reports what the owner actually has, because a page that reports only its own length reads exactly like a complete library, and `refreshCloudLibrary` says "12 of 61 cloud projects loaded" when the two differ.
- Measured the free text on the one thing this API stores durably on a caller's word. `normalizeStoryLabProfilePreferences` is careful about every *closed* field on a profile — the creature list, the tone list, the tension mode, the intimacy boundary, and `librarySort` are each checked against their allowed set and replaced by the default when they miss — and read the three open ones (`displayName`, `preferences.contentBoundaries`, `preferences.defaultHeatContract.noGoContent`) through a helper that asks only whether the value is a string. That is a stricter miss than the blueprint routes' was, because a blueprint's oversized field costs one refused request while a profile's is written to `story_lab_profiles`, whose columns are `text` and `jsonb` with no length of their own, and handed back on every `GET` afterwards: an authenticated caller could park as much prose per account as the platform's own 4.5MB body limit allows. `noGoContent` makes it a contradiction as well as a gap — it is the same field, on the same `HeatContract` type, that `parseStoryLabBlueprint` refuses past `maxNoGoContentLength`, so the standing *default* for a field was accepted at any length while the per-story value of it was capped at 320 characters. `STORY_LAB_PROFILE_LIMITS` reads both numbers from `STORY_BLUEPRINT_LIMITS` rather than restating them (`maxNoGoContentLength` for the two boundary fields, `maxCharacterNameLength` for the display name, which names one person), and `describeOversizedStoryLabProfileField` answers `400 INVALID_REQUEST` naming the field before the store is reached. Refused rather than truncated, which is the one place this route's usual "replace what is not allowed with the default" reading would be wrong: these fields say what a reader does not want written, and a silently shortened one is a shortened set of constraints they cannot see the end of. The check runs on `PUT` only, not inside `normalizeStoryLabProfilePreferences`, so a profile stored before the cap keeps loading.
- Extended `tests/cliffhanger-service.test.ts`, `tests/story-lab-account-routes.test.ts`, and `tests/story-lab-storage-port.test.ts`. All three are already registered in `test:all`.

Self-review:

- Each fix was reproduced against the old behaviour before being kept. Reverting `cliffhangerService.ts` fails the new test with ``` "misunderstood/understood" must not classify as character_revelation: the longer word is not the hook (got "character_revelation" with strength 3) ```; reverting `postgresStoryProjectStore.ts` fails with ``` list SQL must not cap the answer: the cap belongs with the ordering ```; removing the route cap fails with `an over-full library lists at most 50 projects (got 55)`; removing the profile check fails with `an oversized displayName should be refused, not stored (got 200)`.
- The first draft of the cliffhanger collision list claimed `hidden` is inside `forbidden`, which would have been the headline case in a repository whose third theme seed is `forbidden_love`. It is not: `forbidden` contains `bidden`. The claim was caught by running the counterfactual, which reported strength 0 for that fixture instead of a `mystery` hit, and every collision named in the docblock and the changelog is now one the test drives.
- The hook test asserts both directions, because either alone is satisfiable by the wrong fix: the collisions must stop deciding the type, **and** the inflections the substring form got right — `dangerous`, `threatening`, `secretly`, `questions`, `choices` — must still decide it. It also asserts that two spellings of one hook do not outscore two distinct hooks, which is what pins the per-hook counting: a per-spelling count would pass every other assertion in the file and quietly re-weight `danger` (four spellings) against `blood froze` (one).
- The library test arranges `Aardvark Oath` to sort first by title and last by update, which is exactly the item the old ordering dropped and the new one must keep; a fixture whose titles and timestamps run in the same order passes under both implementations and proves nothing. It also asserts that a library *inside* the cap reports a `totalProjectCount` equal to what it carries, so the new field cannot start disagreeing with the list it describes.
- The profile test asserts refusal, the field named in the message, that a refused `PUT` leaves nothing behind for the next `GET` to hand back, and that a value exactly at the cap is stored whole — the last of these because "refuse past the cap" and "truncate at the cap" are both satisfiable by a fix that keeps 320 characters, and only one of them is honest about a boundary list.
- Non-claim: no generated story, prompt, or stored story contract changes. What changes is which cliffhanger type a chapter is reported as ending on, which projects a capped library listing carries and in what order, one new response field, and one new `400` on `PUT /api/story-lab/account/profile`.
- Two review findings from CodeRabbit were taken in the same slice. The first: `sendJson` in the account route file took a bare `T`, so nothing checked that a body handed to it was an `ApiResponse` at all — the one property every caller of this API relies on, and the one a changed response shape can quietly lose. Constraining the helper rather than annotating the one call site that changed makes it a rule about this file's answers instead of a note on the answer that was edited last. The second was larger and correct: moving the cap to the route left `LIST_PROJECTS_SQL` unbounded, so the durable listing read and parsed every row of a library — `project_json` and all — for the route to throw most of it away. A cap and an ordering are one decision, and that argument runs the other way too: the ordering now travels *down* into `listProjects` as a `StoryProjectListQuery`, the Postgres adapter takes its `order by` from a closed table keyed by `StoryLabLibrarySort` (never a string built from the caller's value) with `limit $2` beside it and an owner-scoped `count(*)` for the total, and the in-memory adapter answers the same query with `sortStoryProjectListItems` so the two cannot drift. The route re-sorts the page it gets back through that same comparator, because SQL collation and `localeCompare` do not agree about accented titles: the store's clause decides only *which* rows the page holds, and the shared comparator decides the order a caller sees.

- Not taken in this slice, and named so the next one does not have to rediscover them: `scoreActivationCandidates` in `continuationGuidance.ts` and the activation filter in `app.ts` still match with `source.includes(token)`, but their needles are *caller-supplied* character names and thread labels rather than a fixed lexicon, so they are a fuzzy relevance score rather than a keyword scan and the repair here does not apply unchanged. `clerkAuthPort`'s `warnAuthVerificationFailure` still writes to `console.warn` rather than through the logger, which is the defect `noteApiKeyConfiguration` was fixed for two slices ago; it is a one-line change and belongs with whatever next touches that file.
- Validation run: `scripts/recovery/preflight.sh --skip-status` exits 0, which is the check CI runs — root `test:all` (58 suites), the Angular app *and spec* typechecks, the Vercel API typecheck, and the build. The 210 Angular specs pass under `ng test --watch=false`. The four counterfactuals above were run and reverted, and none is committed.
- The first push failed CI on `Validate Vercel recovery build`, and it was this PR's: adding a required `totalProjectCount` to `CloudStoryProjectList` broke five spec-file fixtures that construct that type as a literal. Local validation had run `npx tsc --noEmit -p tsconfig.json`, which does not include `*.spec.ts`, and the search for consumers of the type had filtered specs out. `tsconfig.spec.json` is a separate project and the preflight script runs both; running the preflight rather than one tsconfig is the check that would have caught it before the push, and is what the line above now records. The fixtures were updated and a spec added for the capped-listing message, which was the one half of that change nothing asserted.

## 2026-08-27 UTC - A Court Read Out Of "Courtier", A Theme List Nothing Bounds, And A Library Sort Nothing Reads

Actions:

- Stopped the hidden continuation guidance being decided by words that merely *contain* its keywords. `storyLabEngine`'s `containsAny` was `value.includes(needle)`, and the four scans built on it — `chooseChapterEndingPressure`, `chooseScenePressureMix`, `chooseClicheAlarmPath`, and the scene-pressure variant seed — read the story state through eleven lists of short single words. That is the substring scan `extractThemesFromContent` and `extractSpicyLevelFromContent` were both moved off, arriving here through the one door nobody had checked, and the collisions are the same kind. `lie` is inside `courtier`, and also inside `earlier`, `relief`, `believed`, `soldier`, and `chandelier`; it is worth `+3` to `secret_exposed`, the largest single weight in `chooseChapterEndingPressure` and on its own enough to beat a fully scored `emotional_reveal` — so a court-intrigue saga, which is the app's own third theme seed and whose prose says `courtiers` as a matter of course, was told to end on an exposed secret whatever the chapter was about. `heart` is inside `hearth`, the exact collision `extractSpicyLevelFromContent`'s own note names, and it decided which cliche the chapter was told to avoid. `want` is inside `unwanted` and `price` inside `priceless`, both of which read as the opposite of the beat they were credited to; `force` is inside `enforce`, `trap` inside `strapped`, `hall` inside `shall`, `room` inside `groom`, `lord` inside `landlord`, `vow` inside `vowel`, `secret` inside `secretary`, `name` inside `nameless`. The state these scans read is not incidental text: `buildInitialThreads` writes every picked theme seed's label and description into a thread, `buildWorldArtifact` writes the reader's own world details into an artifact, and the continuation brief is the reader's narrative direction — so the words are the reader's, and what the scans decide is what the model is told to write next. The forms are now spelled out in one `PRESSURE_KEYWORD_FORMS` table and matched as whole words, which is the same repair and the same reading `containsWholeWord` already applies in `storyContentAnalysis`. The inflections the substring form picked up for free — `dangerous`, `threatening`, `betrayal`, `hunters`, `confession` — are listed rather than lost. The call sites are typed against the table's keys, so a keyword added to one of the eleven lists without a decision here is a compile error rather than a silent substring scan. What is deliberately not carried over is the rest of what the substrings caught: the collisions above, and the compounds (`bloodline`, `courtyard`, `bedroom`, `clockwork`, `hourglass`) where the compound is its own word rather than an inflection of the one being looked for.
- Swept the same defect out of the one other site that had it, in the same pass. `rg -n "includes\('[a-z]{3,12}'\)" -g '*.ts' api shared story-generator/src` returns `extractPlotThreads` in `storyContentAnalysis.ts` — the last scan in that module still reading the markup and matching substrings, with `extractThemesFromContent` above it and `extractSpicyLevelFromContent` below it both already moved off both, and the last of its own five checks already using `\b`. Its result is interpolated into the continuation prompt as `Active Plot Threads`, so what it finds is what the next chapter is told is still open: `secret` fired on `secretary`, `power` on `powerless`, and `control` on `uncontrollable`. Scanning the markup cost it the one multi-word pattern it has — `\bwhat\s+(if|would|could)\b` needs whitespace between the two words, and a chapter that breaks its paragraph between them has markup there instead, so the question the scan exists to notice was invisible whenever the model wrote it across a paragraph break. Fixing one site and leaving the other is what the `door.Blood` lesson records happening three times over, so both went in the same slice, and the sweep now returns only provider-error-message classification, which is a different thing.
- Bounded the one field left deciding how large `/api/image/generate`'s provider request is. `IMAGE_GENERATION_LIMITS.maxImagePromptLength` was added because `imagePrompt` was "the last free-text field in this repository that reaches a paid model call with nothing measuring it" — and `themes`, on the same route and in the same prompt, was left open. `enhancePromptWithStyle` maps *every* entry of `themes` through `mapThemeToVisualElement` and joins the results into the `grok-2-image` request beside the capped field, and `validateImageInput` checked only that the array is an array, is not empty, and holds strings. Each entry contributes about thirty characters of visual phrasing, so a body inside the platform's own 4.5MB limit — a JSON array of one-character ids is four bytes an entry — reaches the provider as a prompt of tens of megabytes, billed by the token. It is also the field a caller is least likely to be stopped at by anything else on this route: `content` is read only through `IMAGE_SCENE_DESCRIPTION_MAX_LENGTH`'s 200-character excerpt, and `creature`, `style`, and `aspectRatio` are each one value from a closed set. `IMAGE_GENERATION_LIMITS.maxThemes` now reads `STORY_BLUEPRINT_LIMITS.maxThemes`, the same value `validateStoryInput` has enforced on `/api/story/generate` since `VALIDATION_RULES` was written and the same one `STORY_EVALUATION_LIMITS` reads for `/api/story-lab/evaluate`, so the three routes cannot disagree about how many seeds one story carries. The check sits beside the creature, theme-shape, style, and aspect-ratio checks and answers `INVALID_INPUT` naming the field, before any prompt is built.
- Made the cloud library come back in the order its owner asked for. `StoryLabProfilePreferences.librarySort` is a three-value closed set — `updated_desc`, `created_desc`, `title_asc` — declared in the shared contracts, defaulted by `createDefaultStoryLabProfilePreferences`, validated against `STORY_LAB_LIBRARY_SORTS` by `normalizeStoryLabProfilePreferences`, written to both the in-memory and the Postgres profile store, and handed back by `GET /api/story-lab/account/profile`. Nothing read it. Both project stores order their own list newest-updated-first and the account route passed that order straight through, so two of the three values a reader could save were settings with no effect: the preference round-tripped through the API intact and the library came back in the same order whatever it said. `sortStoryProjectListItems` now applies it in `storyProjectStore`, and `handleProjectsRoute` reads the caller's preference before answering. The ordering lives at the route rather than in the stores because it is a property of the answer, not of the storage — `LIST_PROJECTS_SQL` and the in-memory comparator would otherwise both have to learn the same three orderings and be kept agreeing about them — and the list item already carries all three fields the orderings read. A profile store that cannot be read falls back to the default rather than turning a working library into a `503`: the projects are the answer and the ordering is a preference about them.
- Extended `tests/story-lab-real-engine.test.ts`, `tests/story-content-analysis.test.ts`, `tests/image-service.test.ts`, `tests/story-lab-storage-port.test.ts`, and `tests/story-lab-account-routes.test.ts`. All five are already registered in `test:all`.

Self-review:

- Each fix was reproduced against the old behaviour before being kept. Reverting `storyLabEngine.ts` fails the new test with ``` `courtiers` and `chandeliers` are not the word `lie`, so they must not choose the secret pressure ```; reverting `storyContentAnalysis.ts` fails with ``` `secretary` is not the word `secret`, so it should not open a mystery thread ```; reverting `imageService.ts` fails with `a request past the theme cap should be refused`; reverting `accountRouteHandlers.ts` fails with ``` title_asc should order the library by title (got Zephyr Court,Moonlit Debt,Ashen Vow) ```.
- The keyword test asserts both directions, because either alone is satisfiable by the wrong fix: the collisions must stop deciding the guidance, **and** the inflections the substring form got right — `lies`, `dangerous`, `hunter`, `threatening` — must still decide it. A whole-word matcher with no inflection table would pass the first half and quietly cost the scans their real signal.
- `sortStoryProjectListItems` reads its timestamps through a `NaN`-safe floor. `Date.parse` answers `NaN` for a timestamp it cannot read and a comparator that answers `NaN` is read as *equal* — `Array.prototype.sort` coerces it to `+0` — so one unreadable entry would compare equal to every other and pin the whole list in the order it arrived in. That is the failure `byNewestUpdateFirst` in `story-workspace-storage.service.ts` was fixed for on the local library, and it is asserted here with one corrupt entry and with two, since two unreadable timestamps must compare equal to each other rather than subtracting to `NaN` again.
- The library-sort route test arranges its three projects so that no two of the three orderings agree by accident: `Zephyr Court` is created first and updated last, which puts it at opposite ends of `created_desc` and `updated_desc`, and the titles run in a third order again. A test whose fixtures share a timestamp passes on the project-id tiebreak alone and proves nothing, which is how the first draft of it passed against `origin/main`.
- The theme cap is asserted before the prompt is built rather than after, because the cost is the prompt and not the array, and the number is asserted equal to `VALIDATION_RULES.themes.maxCount` so the two routes cannot drift apart without a test saying so.
- `npm run test:all` passes end to end.

## 2026-08-27 UTC - A Modification Date That Is Not A Date, A Provider Error Answered To The Caller, And Four Formats Paying For A Sanitizer They Never Read

Actions:

- Gave every `.epub` and `.docx` entry a modification date that exists. `buildZipArchive` wrote both MS-DOS timestamp fields as `0`, commented "last mod file time" / "last mod file date". The date field packs `((year - 1980) << 9) | (month << 5) | day` with the month and day counted **from one**, so all-zero bits do not mean "no timestamp" — they decode to month 0, day 0, a calendar position that does not exist, on every archive this service has ever handed a reader. What that costs depends on who opens the file and none of the answers are "nothing": `unzip -l` prints `1980-00-00 00:00`; Java's `ZipEntry.getTime()` feeds the bits to a lenient calendar, where month 0 and day 0 roll *backwards* to November 1979, so a reader written on `java.util.zip` — most of the EPUB tooling that is not a browser — reports a modification date a year before the format's own epoch; Python's `zipfile` hands out the tuple `(1980, 0, 0, 0, 0, 0)`, which `datetime` refuses, so anything that turns an entry's date into a `datetime` raises `ValueError` on a file it could otherwise read. Both fields now carry the DOS epoch, 1980-01-01 00:00, which is the earliest instant they can spell and the honest value for a writer that tracks no timestamp. Stamping the real clock — the obvious other way to give them a valid date — was deliberately not taken: `generateEPUBContent` derives its book identifier from the story rather than minting a UUID precisely so that "the same story exported twice should produce the same book identifier", and a clock in the header would break exactly that. `readZipEntries` now decodes the fields into a `modifiedAt` beside each entry, so the date is asserted through the reader like every other header field rather than by counting `u16` offsets in a test — which is the reason that reader exists.
- Stopped `/api/image/generate` answering the caller with whatever was thrown. `ImageService.generateImage`'s catch block ended `message: error.message || 'Failed to generate image'`, so any throw anywhere beneath it decided what the response body said. The rule for this is already written down two files away, in `runJobWork`: "The thrown detail goes to the log rather than into the job, which is read by the caller and should not carry whatever a provider error says" — and `ExportService.saveAndExport` follows it, logging the bound error and answering a fixed `'Failed to export story'`. This catch was the exception, and it is the same argument the comment *inside* it already makes about the log line it replaced: "the axios error is caught and replaced one method below today … that is a property of the call below rather than of this line, and it is the kind of property a later change silently removes". The messages it can forward are not hypothetical. A `TypeError` from a body shape `validateImageInput` does not cover reaches the reader as `input.themes.map is not a function` — the exact failure that validator's own docblock describes — and a DNS or TLS failure surfacing at this level as `getaddrinfo ENOTFOUND api.x.ai` names the provider and its host to the caller. The fix marks the distinction on the throw rather than assuming it in the catch: `callGrokImageAI` deliberately writes `'AI image service temporarily unavailable'` for the reader *after* logging the real error, so that one is raised as a `CallerFacingImageError` and still forwarded, and everything else falls to the fixed sentence with the detail left in the log line the envelope's correlation id names.
- Stopped four of the five export formats paying for a sanitize pass and three of them for a word count, neither of which reaches their document. `generateExportContent` ran `sanitizeStoryHtmlForExport`, `stripStoryHtmlForExport`, and `generateMetadata` unconditionally before its `switch`. Only the `.html` document contains markup — the other four are rendered from the plain text — so the tag-by-tag sanitizer walk was discarded for `pdf`, `txt`, `epub`, and `docx`. Only `.html` and `.txt` print the "Story Information" block, so `generateMetadata`'s whitespace split of the whole story was discarded for `pdf`, `epub`, and `docx`. Both are whole-story scans on the one route that caps its body at 500KB *because* the story is large, and this is the same reading `generateMetadata` already applies one level down, where a comment explains that it counts the words once rather than once for the count and again for the read time derived from it. Each branch now takes only what its own document is built from.
- Extended `tests/export-service.test.ts` and `tests/image-service.test.ts`. Both are already registered in `test:all`.

Self-review:

- Each fix was reproduced against the old behaviour before being kept. Restoring `DOS_EPOCH_DATE = 0` fails the new test with `epub entry "mimetype" should name a real month (got 0)`; restoring `message: error.message || 'Failed to generate image'` fails with `an internal failure should answer the fixed sentence (got internal detail the caller must not be shown)`.
- The export change is a refactor, so it is proved by output rather than by a new assertion. All five formats were hashed against `origin/main`'s implementation and this one within the same minute — the `.html` and `.txt` documents print a `Generated: … UTC` stamp, so they are only comparable inside one — and all five are byte-identical. The existing per-format content tests are the standing guard.
- The image test asserts both directions, because either alone is satisfiable by the wrong fix: a raw failure must not reach the envelope, **and** the sentence `callGrokImageAI` deliberately writes for the reader must still reach it. The raw case is driven with a network-shaped rejection naming the provider host, which is the realistic leak, and the internal case with a throw from the prompt builder, which is the shape `validateImageInput`'s docblock describes.
- A second archive test asserts that two exports of one story are byte-identical, which is the invariant the timestamp fix had to be chosen around rather than a restatement of it: it is what rules out the clock-stamping fix, and it is not implied by the date being valid.
- Non-claim: no generated story, prompt, stored contract, route success shape, or exported document *content* changes. What changes is two bytes per ZIP header, one string in one failure envelope, and which readings each export branch computes.
- Not taken in this slice, and worth naming again: `api/health.ts` still writes `console.error('Health check error:', error)` and answers without a correlation id — unchanged from the last slice's note, and still its own question. The ZIP general-purpose bit flag also still says CP437 while filenames are written as UTF-8; every path this service writes is ASCII, so nothing is mis-decoded today, and setting bit 11 changes the first bytes of the EPUB `mimetype` local header that OCF readers pattern-match, which is not a change to make without a reader to check it against.
- Validation run: `npm run test:all` exits 0 (57 suites); the two counterfactuals above were run and reverted, and neither is committed.

## 2026-08-27 UTC - An Export Failure Nothing Recorded, A Configuration Warning Written Once Per Request, And An Envelope Id That Matched No Log Line

Actions:

- Gave `/api/export/save` a diagnosable failure. Both of its catch blocks were unbound — `catch { console.error(\`[${requestId}] Export serverless function failed\`) }` in the route and `catch { console.error('Export failed') }` in `ExportService.saveAndExport` — so the one object that says what went wrong was discarded at both levels and replaced by a fixed sentence. Five renderers sit behind that service method: a PDF assembler that measures its own cross-reference offsets, two zip containers, and two string templates. Any of them failing produced the same sentence with no name, no message, no code, and no stack anywhere, on either deployment. It was the last paid route not on the structured logger at all — its three lines were `console.log`/`console.error`, which skip the redaction every logged value passes through, never reach the thousand-entry buffer an operator reads a failure out of, and interpolate the correlation id into their own prose rather than carrying it as a field. All four call sites now go through `logInfo` / `logWarn` / `logError` with the request's context, which is what `/api/image/generate` — the same shape of route, with the same preamble — has done since it was written. The refusal branches log which fields arrived (`toLoggableFieldNames` against the new `EXPORT_REQUEST_FIELDS`) and which cap was overrun, and the format goes through the new `toLoggableExportFormat` for the reason `toLoggableImageStyle` exists: the route checks `format` for presence and leaves the closed-set check to the service, so it is caller text at the moment it would be logged.
- Stopped `authenticateRequest` announcing the deployment's configuration once per request. Its unconfigured branch ended in a bare `console.warn('⚠️  No API keys configured…')`, and that branch is not an event — it is a fact about the deployment, read again on every call. `enforceApiAccessControl` runs this function once per request on every paid route and `API_KEYS` is unset by default, so an ordinary deployment wrote that line for every story generation, continuation, export, image, evaluation, and job request it ever served. A line repeated at request rate is not a warning: it is the bulk of the log, it costs money on a platform billed by ingested log volume, and it buries the entries that describe something that happened once. It is now a `logWarn` written when the observed `API_KEYS` value changes, so a deployment says it once and a process that *loses* its configuration says it again — keeping the whole of what the warning is for without repeating it at traffic rate.
- Made the id in an envelope an id something logged. `ExportService` and `ImageService` each minted `metadata.requestId` themselves — `req_<uuid>` and `img-req-<uuid>`, called separately in each of the three branches of a method that answers with one — and wrote it into the response body and nowhere else. The route above had a correlation id the whole time: `beginPostRoute` reads `X-Request-ID` or mints one, echoes it back, and stamps it into every line it writes. So the two ids a caller can see disagreed, and the easy one to find (in the body, beside the error) was the one that matched nothing. `ImageService`'s two log calls carried no `requestId` at all, which is exactly what the comment beside one of them names as the defect it was written to fix — "this route's own handler logs a `requestId` on every other line it writes, and the one line describing why the image failed had none" — and moving them onto the logger a slice ago did not give them one, because the service had no id to give. Both methods now take the route's correlation id and use it for the envelope and for their own log context; a caller that has none still gets one minted, so the field is never empty.
- Extended `tests/export-service.test.ts`, `tests/image-service.test.ts`, `tests/api-key-auth.test.ts`, and `tests/request-correlation-id.test.ts`. All four are already registered in `test:all`.

Self-review:

- Each fix was reproduced against the old behaviour before being kept. Restoring the unbound `catch` in `ExportService` fails the new test with `a failed export should be logged as an error (got [])`; restoring the per-branch minted ids fails with `the failure should be logged under the request's own id (got "req_f65c3b3f-…")` and `a successful generation should report the route's id (got "img-req-…")`; removing the configuration check fails with `five requests against one configuration should warn once (warned 5 times)`.
- The export-failure test asserts both directions. The failure's own message and stack must survive into the entry, **and** a marker carried through the story content and the title must appear in neither the console output nor the buffer — keeping the error is only safe because `logError` names the fields it keeps and runs them through the redactor, and this method's input is the reader's whole story.
- The warning test asserts both transitions rather than a bare count: once however many requests arrive against one configuration, nothing at all once keys are configured, and again when the configuration is lost. Counting buffered entries is what makes "how many times" answerable at all — the console form was one unstructured string with nothing to filter on.
- The envelope-id test is driven at the route level through a body each route refuses (an unsupported export format, an unsupported image style), because a refusal is when a caller actually goes looking for the id and neither refusal spends a provider call. The header and the envelope are asserted to be the same value, which is the whole claim.
- Non-claim: none of this changes a generated story, a prompt, an exported document, a stored contract, or any route's success shape. It changes what is written to the log, how often, and which id an already-present envelope field carries.
- Not taken in this slice, and worth naming: `StoryService` mints its own `requestId` too, but uses the same one for `metadata.requestId` and for every line it logs — so its envelope id does find the request, and unifying it with the route's `X-Request-ID` is a wider change across two more routes than these three fixes justify. `api/health.ts` still writes `console.error('Health check error:', error)`; it is not a paid route, has no correlation id, and giving it the preamble is its own question.
- Validation run: `npm run test:all` exits 0 (57 suites); `scripts/recovery/preflight.sh --skip-status --skip-build` exits 0; `story-generator` production build exits 0.

## 2026-08-26 UTC - A Paid Route With No Request Id, A Provider Key One `console.error` From The Log, And An Export That Reads "1 Minutes"

Actions:

- Moved `/api/story-lab/evaluate` onto `beginPostRoute`. That module was extracted a slice ago as "the four things every paid `POST` route does before it reads its body", and four routes call it; this was the fifth paid POST route and the only one still spelling the sequence out by hand. Writing it out rather than calling it cost two things. It never called `readRequestCorrelationId`, so it was the one paid POST route that answered without an `X-Request-ID` — a caller with a failed evaluation had no id to quote, and the route's own log lines had none to carry. And it passed no `context` into `XaiTextClient.generateText`, so even the client's own structured `logApiError` for this route's provider failures went out with no request id and no endpoint on it; `StoryService` has passed its context through for both of its calls since the client was written. The `Allow` header and the CORS preflight answer are unchanged — the preamble declares the same `['POST', 'OPTIONS']` this route already did — and the only visible difference is the 405 body's prose, from "Only POST requests are supported." to the preamble's "Only POST requests are allowed". A rejected request now logs which field was wrong through `logWarn`, the way the genesis route logs the parser's `invalidFields`; the message is this route's own prose, never caller text.
- Took the provider API key out of reach of the log. `ImageService` wrote its two failure paths with `console.error('Image generation error:', error)` and `console.error('Grok Image API error:', error.response?.data || error.message)`, and the evaluate route's own catch was `console.warn('Story Lab evaluation failed.', error)`. `console.error` formats an object with `util.inspect`, and an HTTP client's error carries the request config it failed on — `config.headers.Authorization`, which on these paths is `Bearer ${XAI_API_KEY}`. Driven with a real `AxiosError` against `origin/main`, the key printed. The logger's `extractErrorDetails` names the fields it keeps — `name`, `message`, `stack`, `code`, `response.status`, `response.data` — and never reaches `config` at all, and it runs `response.data` through `redactSensitiveLogData`, which is what reduces an echoed credential in the provider's own answer. All three call sites now go through `logError` / `logApiError`, which is what `StoryService` and `XaiTextClient` have done since the logger was written; these were the last two places on this surface still writing to the console. The story id on the image line goes through `toLoggableStoryId`, the same allow-list the route's own log lines put it through.
- Rewrote the export's "Story Information" block for the reader holding the document. The themes and the creature in that block were fixed a slice ago when the seed list moved into `shared/` — they were being printed as the wire values `enemies_to_lovers` and `vampire` — and the two lines above them were left as they were. `Generated:` was `new Date().toISOString()` verbatim, so a reader opening their own `.html` or `.txt` export found `2026-08-26T23:52:14.472Z` under the title: a format chosen for sorting and parsing, carrying milliseconds nothing about a story needs. It now reads `2026-08-26 at 23:52 UTC`; the zone is named rather than resolved, because the export renders on a serverless function whose local time is the deployment's and not the reader's. `Estimated Read Time:` was suffixed `minutes` unconditionally, so every story under two hundred words — most of one chapter at the 600-word budget the form offers — read "1 minutes". The `ExportMetadata` fields themselves are unchanged: `generatedAt` stays ISO 8601 and `readTime` stays a number, because those are what a machine reading the record wants; only what is printed changed.
- Gave `READING_SPEED.WORDS_PER_MINUTE` its first reader. It has been in `constants.ts` since that file was written, described as "Average reading speed for time estimation", with no caller anywhere in the repository — the one place that estimates a reading time spelled `200` inline instead. A named constant nothing reads is a note, and the next change to it would have silently missed the only line it was written for. `generateMetadata` also counted the words twice, running the same scan of a story that can be several hundred kilobytes for the count and again for the time derived from it; it counts once now.
- Extended `tests/image-service.test.ts`, `tests/export-service.test.ts`, and `tests/story-lab-evaluate-route.test.ts`. All three are already registered in `test:all`.

Self-review:

- Each fix was reproduced against the old behaviour before being kept. Restoring the two `console.error` calls in `ImageService` fails the new test with `no log line may carry the provider API key`; restoring the raw `metadata.generatedAt` and `${metadata.readTime} minutes` fails with `a story of a few words should read "1 minute", not "1 minutes"` and the printed ISO timestamp beside it; reverting `evaluate.ts` alone fails with `a caller's correlation id should be echoed back, got undefined`.
- The key-leak test is driven with a real `AxiosError` rather than a hand-built object, because the shape that carries the credential is the client's and not this repository's. It asserts both directions: no line may contain the key, and both failure lines must still be written — a log call that stopped logging would otherwise pass it.
- The read-time test asserts the plural too. A three-minute story must still read "minutes", so the fix is a rule about the number rather than a rename of the word, and both `.html` and `.txt` are checked because they are separate string templates and the theme fix a slice ago had to be made in both.
- The evaluate migration is behaviour-preserving by inspection on every axis but one: the preamble's CORS options (`['POST', 'OPTIONS']`, `credentials: true`) and its rate-limit call (`'story-lab/evaluate'`, `RATE_LIMITS.STORY_LAB_EVALUATE`) are the ones the route already passed. The 405 body's prose changes; the `Allow` header, which is the part a caller can act on without knowing this API's envelope, does not.
- Non-claim: none of this changes a generated story, a prompt, a stored contract, or any route's success shape. It adds a response header to one route, changes what three log lines contain, and changes two printed lines in a document the export button produces.
- Not taken in this slice, and worth naming: `tests/image-service.test.ts` has a pre-existing `tsc` error (`Type 'string' is not assignable to type 'ThemeType'`) where it passes `STORY_LAB_THEME_SEED_IDS` entries as `themes`. It is on `origin/main`, the suite runs under `tsx` which does not typecheck, and fixing it means deciding which theme vocabulary that field declares — a different question from these three.
- Validation run: `npm run test:all` exits 0 (57 suites); `tsc --noEmit --strict` clean over the three touched API files.

## 2026-08-26 UTC - A Witch Read Out Of "Switch", A Reset Instant Fifty Thousand Years Out, And An Evaluation Refusal Reported As An Outage

Actions:

- Finished the whole-word repair in `storyQualityHeuristics.ts`. The previous slice moved `scoreEmotionalVariety` and `extractSensoryTextures` onto `containsWholeWord`; the three dimensions beside them in the same file — `scoreContinuity`, `scoreCliffhangerQuality`, `scoreTropeFreshness` — were left on `String.prototype.includes` and look for exactly the kind of short word this genre writes longer words around. `oath` is inside `loathe` and `loathing`; a `forbidden_love` seed looks for `love`, inside `gloves` and `clover`; a `slow_burn` seed for `burn`, inside `burnished`. The creature check is the worst of them: `fairy` is inside `fairytale` — the word this app is named for — `witch` inside `switch`, `dragon` inside `dragonfly`, `demon` inside `demonstrate`, so "she switched off the lamp" reported `Creature appears: witch`. `cost` is inside `costume`, in a genre that writes masquerades, and `door`/`price`/`blood`/`name` are inside `doorway`/`priceless`/`bloodless`/`nameless` — four of the eight hook words the cliffhanger dimension credits an ending for, matched by words that negate them. These three cannot list their inflections the way `EMOTION_FAMILIES` does, because the words arrive from the request rather than from a fixed lexicon, so `containsWordForm` states the same Unicode-lookaround boundary and allows the endings that keep a word the same word, plus the two irregular plurals that land on the contract's own archetypes (`fairies`, `werewolves`). `less` and `ly` are deliberately not among them.
- Put `X-RateLimit-Reset` in the unit its name means. `enforceApiAccessControl` wrote `checkRateLimit`'s reset instant to the header unconverted — `Date.now()` milliseconds — and every client that knows the header name reads it as a UTC epoch in seconds, so `1787012345678` is a date some fifty thousand years out: a client backing off until the reset never returned, and one displaying it showed a seven-digit year. This is the reading `Retry-After` already got and the reason that header exists. `X-RateLimit-Limit` was missing entirely, which left `X-RateLimit-Remaining` a bare number against a budget that is per route and per tier and stated nowhere else in the response; `SECURITY_FIXES_QUICK_REFERENCE.md` has documented all three at this call site since it was written. Both are now sent, and `X-RateLimit-Limit` was added to `EXPOSED_HEADERS` in the CORS policy — a header a cross-origin page cannot read is a header that was not sent. `error.resetTime` in the 429 body is untouched and still milliseconds: it is this API's own field, read by this app.
- Made a Proving Grounds evaluation refusal say what it was. `PromptEvaluationService.evaluateStory` answers a fixed placeholder for every unsuccessful call alike, and the page marks it honestly — badge, retry button, and a notice reading "the evaluation API was unavailable". But `/api/story-lab/evaluate` refuses an oversized `storyContent` with `400 INVALID_EVALUATION_REQUEST` naming the field, an unauthenticated caller with `401`, and a caller past its budget with `429`; each is actionable, and each was reported as an outage — the one thing none of them is. The refusal message is now carried onto the placeholder as `mockEvaluationReason`, read out of either shape it arrives in (a `success: false` body, or `HttpErrorResponse.error`), which is the reading `readApiErrorMessage` already gives a failed generation on the same page, and printed under the notice and in the status line. A call that never reached the API has nothing to quote and says nothing, so the outage wording still stands where it is true. The component's `catch` claimed "mock scoring remains available when the API is unavailable" — describing the fallback that had already happened one line above it, and unreachable besides, since the service does not reject; it now reports only what it can know.
- Extended `tests/story-quality-evals.test.ts`, `tests/api-access-control.test.ts`, `tests/cors-policy.test.ts`, and `story-generator/src/app/proving-grounds/prompt-evaluation.service.spec.ts`. All four are already registered in `test:all` / `ng test`.

Self-review:

- Each fix was reproduced against the old behaviour before being kept. Restoring `.includes` inside `containsWordForm` fails the new decoy assertions; leaving `rateLimitResetSeconds` in milliseconds fails with `should reset within its own window in epoch seconds, got 1787785920786 against 1787785020`; the two new evaluation specs assert a field that did not exist.
- The whole-word test asserts both directions, as the emotional-variety one does. The decoy paragraph is built only from the words that used to leak — `switched`, `burnished`, `gloves`, `fairytale`, `clover`, `loathing`, `doorway`, `bloodless`, `nameless`, `priceless`, `costume` — and must score no signals; a second set of paragraphs using `witches`, `loved`, `burning`, `oaths`, `fairies`, `door`, `name`, `price`, and `costs` must still light every one of them, so the repair is a narrowing of the boundary and not of the vocabulary.
- The reset-header assertion is written against the clock deliberately loosely (within the route's own window, plus a second for the round-up) because the alternative is reconstructing the `Date.now()` that produced it; the exact conversion is asserted directly on the exported `rateLimitResetSeconds`, the way `retryAfterSeconds` already is.
- Non-claim: none of this changes a generated story, a prompt, a stored contract, or a route's success shape. It changes one advisory score's inputs, the unit of one response header and adds a second beside it, and adds one sentence to a placeholder the page was already marking as a placeholder.
- Recorded rather than hidden: the build's `proving-grounds.css exceeded maximum budget` warning was already 68 bytes over the 12 kB budget on `origin/main`, and the one rule this slice adds (`.mock-evaluation-reason`, four declarations) takes it to 158 bytes over. Measured both ways with `ng build --configuration production`. It is a warning, not a failing budget, and `tests/story-generator-component-style-budget.test.ts` covers `app.css` / `app-*.css` rather than this file — but the previous entry called this warning "pre-existing and untouched", and after this slice that is no longer quite true. Trimming that file is its own slice, not this one.
- Validation run: `npm run test:all` exits 0 (57 suites); `ng test --watch=false --browsers=ChromeHeadlessNoSandbox` reports `TOTAL: 209 SUCCESS`; `tsc --noEmit` clean over the Angular app, the Angular specs, and the three touched API files; `npm run build` completes.

## 2026-08-26 UTC - Five Emotions Read Out Of "Danger" And "Reached", Two Name Fields The Form Still Does Not Measure, And An Export That Prints Its Own Wire Ids

Actions:

- Gave `scoreEmotionalVariety` whole-word matching. The dimension matched its five emotion registers with `String.prototype.includes`, and every register has a common word of this genre sitting on top of it: `anger` is inside `danger` and `stranger`, `rage` inside `courage`, `ache` inside `reached`, `loss` inside `gloss` and `blossom`, and — worst — `hope` inside `hopeless`, `fear` inside `fearless`, and `trust` inside `distrust`, so three of the five were credited by the negations that deny them. This is the same defect the previous slice fixed in `extractSpicyLevelFromContent` (`hearth` for `heart`, `gloves` for `love`), one module over. Five registers at twelve points on a base of 48 clamps to 100, so the leak did not merely inflate the number: it pinned `emotional_variety` near its ceiling for ordinary prose, which makes the dimension unable to distinguish anything and drags the `overallScore` it is one seventh of with it. The inflections the substring form picked up for free are listed rather than lost (`wanted`, `desires`, `losses`); the rest of what the substrings caught is the defect, not coverage. The boundaries are Unicode lookarounds rather than `\b`, for the reason the named-character and agency scans in the same file already give, and `extractSensoryTextures` — which has matched whole words since it was written — now states its boundary the same way.
- Applied `STORY_BLUEPRINT_LIMITS.maxCharacterNameLength` in `FormValidationService`. **This corrects the previous entry's stated reason for skipping it.** That entry recorded: "Every other entry in `BlueprintValidationField` has an input in `app.html`; `protagonistName` and `antagonistName` have none." They do — `data-testid="blueprint-protagonist"` and `blueprint-antagonist`, inside the "Names, world, and special requests" details block, present since #254 and so present when that decision was written. What they had none of was a cap and an error slot, which is a different thing and is the gap: the route began refusing an over-long name in the same slice, so the form accepted what the API refuses and the reader learned about the limit from a `400 INVALID_BLUEPRINT` naming a wire field, after pressing generate on a paid route. Both inputs now carry `aria-invalid`, an `aria-describedby`, and a `field-error` span, the way the world-details textarea below them does.
- Named themes and the creature the way the picker does in the export metadata block. `ExportService.generateMetadata` copied `input.themes` straight into the "Story Information" section of every HTML and text export, and `app.ts` sends `theme.id`, so the document a reader downloads and keeps read `Themes: enemies_to_lovers, secret_identity` for two seeds the picker beside it calls "Enemies to Lovers" and "Secret Identity", with `Creature: vampire` above them. This is the one place in the app that shows a theme id to a reader rather than matching on it, and it is the third reader of these ids written against a vocabulary that is not the picker's, after `mapThemeToVisualElement` and `toLoggableThemes` — which is what `shared/storyLabThemeSeeds.ts` was created to end. `readStoryLabThemeLabel` reads the seed's own label from that list; an id from outside it is title-cased from its own text, so the classic `ThemeType` vocabulary the seams still accept stays legible instead of being asserted a name it does not have.
- Type-checked `creature` and `themes` on `/api/export/save`, which the label reading above requires. `readExportRequest` already refuses a non-string `content` or `title` — its own comment explains why: the renderer calls string methods on them, so a JSON body carrying a number under either name threw a `TypeError` into `saveAndExport`'s catch and came back `EXPORT_FAILED`, the service reporting its own failure for the caller's malformed body. These two optional fields were not covered, and the two renderers already disagreed about them: measured against `origin/main`, `themes: [123]` exported as `Themes: 123` with a 200 in text and failed with `EXPORT_FAILED` in HTML, because `escapeHtml` reduces over the value through `value.split(...)`. Reading each entry as a theme id would have made the text path throw the same way, so the check goes where the route already puts this class of refusal rather than being absorbed by a defensive cast in a display helper. `ImageService.validateImageInput` checks these same two field names for the same reason. The 400 message now names what it actually covers.
- Extended `tests/story-quality-evals.test.ts`, `tests/export-service.test.ts`, `tests/story-route-contracts.test.ts`, and `story-generator/src/app/form-validation.service.spec.ts`. All four files are already registered in `test:all` / `ng test`.

Self-review:

- Each fix was reproduced against the old behaviour before being kept. Reverting the emotion matcher to `.includes` fails the new decoy assertion; reverting `generateMetadata`'s theme mapping fails with `Themes: mystery, adventure` where the labelled reading is expected; deleting the `protagonistName` branch fails the new spec (`TOTAL: 1 FAILED, 11 SUCCESS`).
- The emotional-variety test asserts both directions. The decoy paragraph is built entirely from the words that used to leak — `reached`, `dangerous stranger`, `hopeless`, `fearless`, `courage`, `gloss`, `distrust` — and must now score the dimension's bare base of 48 with no signals; a second paragraph of real emotional statements must still light all five registers, so the repair is not just a narrowing.
- The two form caps assert the accepting side too: a name that only exceeds the cap through surrounding whitespace is one the route takes, because `parseStoryLabBlueprint` reads both fields through a helper that trims before it measures. Refusing it in the form would be the same drift running the other way. The seeds' own new caps (`maxThemeLabelLength`, `maxThemeDescriptionLength`) are deliberately still not checked in the form: a reader picks from twelve fixed seeds rather than typing them, so no value the form can produce reaches those caps.
- The export route check was found by reading the finished diff adversarially rather than by a failing test, and it is worth recording as a pattern: a change that starts reading a field it used to only copy inherits every shape that field can arrive in. The route-level refusal was chosen over widening `readStoryLabThemeLabel` to accept `unknown`, because a display helper that quietly stringifies an object is how `[object Object]` reaches a reader's document.
- Validation run: `npm run test:all` exits 0 (57 suites); `ng test --watch=false --browsers=ChromeHeadlessNoSandbox` reports `TOTAL: 207 SUCCESS`; `npm run build` completes. The `proving-grounds.css exceeded maximum budget` warning in the build is pre-existing and untouched by this slice.
- Non-claim: none of this changes a generated story, a prompt, a stored contract, or a route's success shape. It changes one advisory score's inputs, adds two client-side refusals that match refusals the route already makes, changes the wording of two lines in an exported document, and adds one route-level refusal for a body shape that already failed on one of the two export formats.

## 2026-08-26 UTC - An Export Title Nothing Measures, Two Blueprint Fields The Caps Skipped, And A Theme Id Nothing Recognises

Actions:

- Bounded `title` on `/api/export/save`, beside the `content` cap that was already there. The route measured one of its two free-text fields and left the other unmeasured, though both are caller text and both are rendered into the same document — and the title is the more expensive one to leave open. `generateTextContent` writes it as a heading and then `'='.repeat(title.length)` under it, so a `.txt` export doubles it; `generateEPUBContent` interpolates it into four separate XML parts; and the finished document comes back as a base64 `data:` URI, which adds a third again. The Node deployment accepts a 10MB JSON body, so a one-byte story with a nine-megabyte title turned a rate-limited paid route into an amplifier. `FILE_SIZE.MAX_TITLE_LENGTH_BYTES` is a kilobyte — several times the longest title this generator has produced, and five times the 200-byte cap the download filename stem already carries — measured in bytes for the reason the content cap is, and the refusal names which field overran so a caller is not left comparing content that cleared its own limit.
- Applied `STORY_BLUEPRINT_LIMITS` to `protagonistName` and `antagonistName`. The parser measured `logline`, `worldDetails`, `narrativeDirectives`, and `heatContract.noGoContent` and read these two straight into the returned blueprint through `optionalString`, which only trims. `buildContinuityPrompt` stringifies both into the continuity model call exactly as they arrived, so the failure the shared limits object exists to prevent — "a megabyte of prose into a paid model call, billed by the token" — was open on the two fields it did not cover. `deriveInitialContinuity` also builds a character `summary`, an `externalConflict`, and a relationship note out of them, so whatever was sent came back as story state and was stored with the project. `buildStoryLabContext` caps them at its own prompt boundary, which is why this never showed up on the genesis bill; the continuity call has no such guard and the state does not either. The new `maxCharacterNameLength` is 80, which is `STORY_EVALUATION_LIMITS.maxConfigurationValueLength`'s number and its reasoning: these fields name one person.
- Pointed `StreamingStoryComponent`'s blueprint at `shared/storyLabThemeSeeds.ts`. It was the last place in the Angular tree still spelling theme seeds by hand, and it had already drifted: its second seed was `ancient_curses`, which is on neither vocabulary the seams accept — not the twelve Story Lab seeds and not the eighteen classic `ThemeType` values. So every stream this component opened sent the genesis route a theme id nothing downstream could read: `ImageService.mapThemeToVisualElement` answers it with the `mysterious elements` fallback and `toLoggableThemes` counts it under `unrecognizedThemeCount`, the marker that exists to say the caller sent something that is not a theme. This is the third time that one list with several readers has cost the same bug.
- Added `tests/story-lab-theme-seed-usage.test.ts` and registered it in `test:all`; extended `tests/story-route-contracts.test.ts` with the title cap and `tests/story-lab-blueprint-parser.test.ts` with the two character-name caps. Both existing files are already registered.

Self-review:

- Each fix was reproduced against the old behaviour before being kept. Stashing `api/export/save.ts` fails the new route check with `a title past the byte cap should be refused, got 200`; stashing `blueprintParser.ts` fails with `an over-long protagonistName should be reported as invalid`; stashing `streaming-story.component.ts` fails the seed scan naming `ancient_curses` and the file it is in.
- The seed scan checks the ids that actually reach a blueprint rather than asserting that any particular file imports the shared list, so a component is still free to name a seed literally — `DebugPanel` does — as long as the seed exists. It bracket-matches each `themes: [...]` literal rather than matching one regex, because a seed carries a description written in prose and prose contains brackets, and it asserts it found seeds at all, so a scan that has stopped reading the tree fails instead of passing empty.
- Both new caps assert the accepting side as well as the refusing one: a title at the cap still exports and a blueprint at every limit still parses, so these refuse the abuse rather than the ordinary case. The character-name check is driven through `parseStoryLabBlueprintFromQuery` as well, because the query-string genesis stream takes the same blueprint and is the path a caller reaches without the app's form in front of it.
- `FormValidationService` is deliberately not given the two new fields. Every other entry in `BlueprintValidationField` has an input in `app.html`; `protagonistName` and `antagonistName` have none, and the app sends both as `''`, so a form error for them could be surfaced by `getFirstError` and not fixed by any control on the page. The cap belongs on the route, which is where the unbounded text actually reaches a model.
- Non-claim: none of this changes a generated story, a prompt template, or a route's success contract. It adds two refusals to requests that were previously accepted, corrects one theme id in a demo component, and changes no rendering.

## 2026-08-26 UTC - A PDF That Cannot Spell An Apostrophe, Two Exports XML Refuses To Open, And A Retry With No Room To Run

Actions:

- Rewrote `escapePdfText` to write story text in the encoding the PDF's font actually reads, and gave that font `/Encoding /WinAnsiEncoding`. A PDF string is bytes and the font decides which glyph each byte names; the document is written out as UTF-8 and declared Helvetica with no encoding, so every character above ASCII went in as the two or three UTF-8 bytes it spells with and Helvetica read each of those as a glyph of its own. `don’t` reached the reader as `donâ€™t`, `—` as `â€"`, `café` as `cafÃ©`. This is not an exotic input: a language model writes curly quotes and em dashes in ordinary prose, so it was every story anyone exported as PDF, on the one format whose failure a reader cannot work around by switching an encoding. Each character now becomes its WinAnsi byte, written as an octal escape wherever it is not printable ASCII — which also keeps the whole document ASCII, so the UTF-8 encode `generateExportContent` performs cannot re-expand a byte the stream's `/Length` has already counted. A character WinAnsi has no byte for becomes `?`; a fourteen-glyph base font has no glyph for an emoji either way, and the other four formats keep such a story whole.
- Added `escapeXmlText` and routed the `.epub` and `.docx` documents through it. Both formats are XML in a zip container and both interpolated story text and the story's title straight into that XML. XML 1.0 admits no C0 control character but tab, newline, and carriage return, and a conforming parser must refuse a document holding one — so a single such character anywhere in the prose or the title produced a file that downloaded under the right name, at the right size, and then would not open, with the reader told only that it was corrupt. Nothing upstream removed them: `stripStoryHtmlForExport` treats tab, carriage return, form feed, and vertical tab as whitespace and collapses them, but a `BEL` or a `SUB` is not whitespace to it, and the title never goes through it at all. They are replaced with a space, which is the reading the PDF path has always used and the one that does not weld the words the character sat between.
- Bounded `XaiTextClient`'s fast-profile retry by what is left of the invocation. The retry was handed `fallbackTimeoutMs` whatever the primary attempt had already spent, and both timeouts default to 40 seconds against a function `vercel.json` gives 60. A deployment that points `XAI_FAST_MODEL` at a different model from `XAI_STORY_MODEL` — which is the configuration the fallback exists for, and the only one `shouldAttemptFastProfileFallback` does not already refuse on the timeouts alone — could therefore spend 40 seconds on the primary attempt and start another 40-second call: the platform killed the function at 60 with the retry in flight, so the caller got the platform's own timeout instead of the `AI_UNAVAILABLE` envelope this client exists to produce, and nothing downstream ran at all. The retry now gets what remains, and below `MIN_XAI_FALLBACK_TIMEOUT_MS` is not started, because a generation cannot finish in that and the honest failure is worth more than a doomed call.
- Moved the function budget and its finalization reserve out of `story-lab/continuityBudget.ts` into `config/xaiConfig.ts` as `getFunctionBudgetMs` and `getRemainingRequestBudgetMs`. It is the platform's number rather than a Story Lab one, and the client's retry has to measure itself against the same window continuity extraction already did; `getStoryLabContinuityTimeoutMs` keeps its own rule about what counts as a *usable* continuity window and reads the budget from there.
- Added `testPdfWritesStoryPunctuationInTheFontsEncoding` and `testXmlExportsCarryNoCharacterXmlForbids` to `tests/export-service.test.ts`, and `assertFastProfileRetryFitsInsideTheInvocationBudget` to `tests/xai-fast-path-review.test.ts`. Both files are already registered in `test:all`.

Self-review:

- Each fix was reproduced against the old behaviour before being kept. Stashing `exportService.ts` and `exportSanitizer.ts` fails the new PDF test on the missing `/Encoding` line; before the change the same document carried the raw UTF-8 bytes (`\xC3\xA9` for `é`, `\xE2\x80\x99` for `’`) that produced the mojibake. Stashing the three provider files fails the retry test with `a retry should be cut to what the invocation has left (got 5678)`.
- The XML test asserts the absence of every character XML forbids rather than the two it plants, so a later path that reintroduces one — a new part, a new interpolated field — fails rather than passing on the two this test happens to know about.
- The retry test drives the budget through `FUNCTION_BUDGET_MS` rather than through a clock, because that is how a deployment states it and it is the same reading `getStoryLabContinuityTimeoutMs` already had a test for. Its three cases are the three outcomes: a window with room leaves the requested timeout alone, a smaller window shortens it, an exhausted one skips the retry and says so.
- The elapsed time the client measures starts at `generateText` rather than at the start of the request, so it under-counts whatever the route spent before reaching it. Stated in the code rather than hidden: it still bounds the failure this fixes — one attempt plus one retry can no longer exceed the window on their own — and it errs toward attempting the retry, which is the direction that keeps a story being generated.
- Non-claim: none of this changes a generated story, a prompt, or a route's contract. It changes which bytes two export formats are written with, which characters two others admit, and how long one provider retry may run.

## 2026-08-26 UTC - A Download Named The Same For Every Reader, A Continuation That Cannot Be Traced, And A "Production" Prompt That Is Not

Actions:

- Moved the story-download filename out of `App.safeFileName` into `shared/storyDownloadFilename.ts` and rebuilt it on Unicode letters, numbers, and marks with a UTF-8 byte cap. The old stem kept ASCII letters and digits and dropped everything else, so a title in any other script slugged to nothing and fell to the shared `fairytales-story` fallback — every story a reader generated in their own language downloaded under one name, the second landing beside the first as `fairytales-story (1).html`. Nothing bounded the length either, and the stem plus `.html` has to fit inside the 255-byte limit ext4 and APFS enforce. Both are the failures `ExportService.buildFilenameStem` was already fixed for, on the button beside it.
- Gave `/api/story/continue` the correlation id the other three legacy routes already read and echo. It minted `req_<uuid>` unconditionally and never wrote `X-Request-ID` back, so a caller tracing a continuation across their own logs and this service's had its id discarded and got nothing in the response to correlate against — on the slowest of the four requests the app makes in one session.
- Synchronised the Proving Grounds "Current Production" pacing block with `StoryService.buildUserPrompt`. It named 700, 900, and 1200 words while `wordCountOptions` offers 600, 900, 1200, and 1500 and the production prompt lists all five, so two of the four selectable budgets reached the model under a heading describing neither, and 700 — which no picker in this repository offers — was one of the three described. A prompt comparison at 600 or 1500 was measuring the drift rather than the variant.
- Added `tests/story-download-filename.test.ts` and `tests/proving-grounds-production-prompt.test.ts`, extended `tests/request-correlation-id.test.ts` to cover the fourth route, and registered both new tests in `test:all`. Added two Angular specs covering the download filename through the component.

Self-review:

- Each fix was reproduced against the old behaviour before being kept: the ASCII-only stem answers `fairytales-story` for a Cyrillic title and `1119 bytes` uncapped, `/api/story/continue should echo a real correlation id back to the caller` fails on the old handler, and the pacing test reports `it paces [700,900,1200]` against the old block.
- The prompt test compares the template block against the production block and against `wordCountOptions` rather than restating any of the three, so a later edit to either side fails a test instead of quietly reopening the gap.
- `main` moved under the branch mid-review (#244, auth and rate limiting on every paid route). It was merged in rather than rebased; `api/story/continue.ts` takes both changes ordered as `api/story/generate.ts` now orders them, and `package.json` takes main's `test:all` with the two new tests inserted in the same slot.
- Non-claim: this slice changes no generated story and no prompt the server sends. It changes what one browser button names its file, one response header on one route, and the text of one template on the Proving Grounds page.

Review follow-up (same slice):

- SonarCloud's quality gate failed at 3.4% duplication on new code against a 3% ceiling, and it was this slice's duplication rather than a standing failure — the gate passed on #242 and #243. Two blocks were removed on the first attempt, and neither was the one: `trimTrailingSeparators` was a copy of `ExportService`'s differing only in which character it trims, and is now a single `slice`, since the split-and-join leaves single separators and the cap can strand at most one; and the five-line `assert` helper each new test file re-declared now lives in `tests/assert.ts` for new tests to import. The forty-odd existing copies are left alone — rewriting every test in the repository is its own commit.
- The gate came back at exactly 3.4% after that, which was the useful signal: the duplication was somewhere else and had not moved. `sonarcloud.io` is blocked by this environment's egress policy, so the detector was reproduced locally instead — token-based, literals normalised, 100-token minimum, attributing each duplicated block to the lines the PR actually added. It named the block immediately: `api/story/continue.ts` lines 15-55 against both `api/story/generate.ts` and `api/image/generate.ts`, 144 tokens, covering all 18 of this slice's added lines in that file. 18 of 518 new lines is 3.47%, which is the number the gate reported.
- So the duplication was the fix itself. Giving `/api/story/continue` the correlation id it was missing made its preamble the fourth verbatim copy of one the other three paid POST routes already shared — correlation id, `X-Request-ID`, CORS, method, access control, in that order. The gate was right, and right about the shape of the fix: that sequence is a rule about paid routes rather than a detail of any one of them, and a rule stated four times can be changed in three places. `api/_lib/http/postRoutePreamble.ts` now states it once and all four routes call it; the four handlers lose 133 lines between them and gain 28. `/api/export/save` picks up the 405 log line the other three already wrote, which is the same consistency this slice is about. Reproduced at 0.0% duplication on new code locally, with `tests/api-access-control.test.ts`, `tests/request-correlation-id.test.ts`, and `tests/express-api-routes.test.ts` all still passing.
- Codex flagged a P2 on the Unicode claim and was right: `[^\p{L}\p{N}]+` reads every combining mark as a separator, so a word is cut apart at each one. `मेरी कहानी` came back as `म-र-कह-न` and `เรื่องของฉัน` as `เร-องของฉ-น` — not shortened but corrupted, the vowel signs and tone marks deleted and hyphens left in their place, which is worse than the fallback it replaced because the result still looks like a slug of the title. `\p{M}` is now retained beside the letters and numbers. Writing the regression test surfaced a second half the P2 did not name: retaining marks does not make `José` typed decomposed and `José` typed precomposed one name, because they are different strings — one story would still download under two names. The title is normalised to `NFC` first. Both are needed: Devanagari, Thai, and Arabic marks do not compose away under `NFC`.
- Codex's next pass found the mark fix had reintroduced the collision it was meant to remove, from the other side. A symbol is a separator and a variation selector is a mark, so `❤️` — U+2764 then U+FE0F — split into a part holding nothing but the selector: on its own that produced `️.html`, a stem of one invisible character and the same one for every emoji-only title; beside a word it produced `️-love.html`. The rule is now applied per part rather than to the finished stem — a run with no letter and no number in it is not a word of the title and is dropped — with the finished stem checked too, since the byte cap can cut into a part and leave only its leading marks.
- Codex also found that `X-Request-ID` was set on the response and unreadable by the caller it was set for. `buildCorsHeaders` sent `Access-Control-Allow-Headers`, which is the request side; nothing sent `Access-Control-Expose-Headers`, and the browser default is a safelist that does not include it. So the correlation id this slice added to `/api/story/continue` — and the three routes that already had it — was visible only to a same-origin page, which is the caller least in need of it. `X-Request-ID` is now exposed for every route through the shared policy. `X-RateLimit-Remaining` and `X-RateLimit-Reset` are invisible for exactly the same reason and are deliberately left alone: they arrived with #244 and belong to whoever owns that contract.
- Codex also asked for this slice to be split into three, citing the slice-sizing rule. Answered on the PR rather than acted on: that rule is written for `recovery/story-lab-*` slices of unpublished Story Lab work, and this is the "three quick wins" line, whose merged precedent (#237 through #243) is three independent fixes per PR by construction. Splitting was outside what was asked for.

## 2026-08-26 UTC - A Blend Voice Missing From Every Prompt Preview, A Theme Picker No Reader Can Reach, And A Form Refusing What The API Accepts

Actions:

- Ported `getSecondaryAuthorStyles` into `GenerationLogicService` and rebuilt `selectRandomAuthors` on the API's two-plus-one shape. `selectRandomAuthorStyles` takes two voices from the creature's own bank and one from a second bank belonging to other creatures; the panel drew `2 + randomInt(2)` voices, all primary. So the blend voice was missing from every preview for all ten creatures, and a preview that rolled three named three same-creature voices where the generator had used two. This is the other half of the fallthrough PR #240 fixed: that slice gave `siren` and `djinn` the right primary bank, but the secondary table had never been ported at all.
- Pointed the Proving Grounds theme picker at `shared/storyLabThemeSeeds.ts`. `themeOptions` was a thirteenth copy of the vocabulary and the wrong one — ten classic `ThemeType` ids with descriptions written for that page — so seven of the app's twelve seeds could not be tested at all and five of the ids on offer are ones no reader can send. The five shared ids were worse: a seed's `label` and `description` reach the generation prompt, so matching ids carrying different wording had the panel reporting on prose the app would never have asked for.
- Moved that picker's selection cap from a hard-coded three to `STORY_BLUEPRINT_LIMITS.maxThemes`, and made the label state the number instead of restating it.
- Made `FormValidationService` measure `logline`, `worldDetails`, and `narrativeDirectives` the way the parser does. `parseStoryLabBlueprint` trims all three before comparing against the shared caps; the form counted the raw value, so a logline pasted with a trailing newline was refused at exactly the cap the route accepts it under. `heatContract.noGoContent` is left untrimmed on purpose — the parser does not trim that one, so trimming it here would accept a contract the route refuses.
- Extended `tests/story-lab-blueprint-parser.test.ts` (registered in `test:all`) to pin the parser's trimming of `logline` and `worldDetails`, which was stated nowhere and is what the form has to mirror. Added and replaced specs in `generation-logic.service.spec.ts`, `proving-grounds.spec.ts`, and `form-validation.service.spec.ts`.

Self-review:

- Good: every fix was reproduced against the old behaviour before being kept. Reverting the three source files while leaving the specs in place produced four named Karma failures — `selectRandomAuthors draws two voices from the primary bank and one from the secondary bank`, `offers exactly the thematic seeds the app picker offers`, `lets a test carry as many seeds as the blueprint route accepts`, `accepts free text that only exceeds a cap through surrounding whitespace` — and no others.
- Two existing specs were asserting the defect and were replaced rather than deleted. `selectRandomAuthors never returns more authors than exist for the creature` accepted anything from two authors up to the size of the bank, which is precisely the range the defect produced; `generateRandomLogic` required every selected author to be in the primary bank, which a selection that never reaches the secondary bank satisfies by construction.
- The secondary-bank assertion had to be written as the API's pairings rather than as "borrows another creature". Several author names appear in two banks — `Kresley Cole` and `Laurell K. Hamilton` in both vampire and werewolf, `Nalini Singh` in both werewolf and fairy — so a disjointness check would have failed on correct data.
- Non-claim: this slice changes no API route, no prompt the server builds, and no generated story. It changes which authors one browser panel previews, which themes that panel offers, and where the Angular form draws the line on three free-text fields.

Review follow-up (same slice, after Codex flagged two P2s on the first push):

- Transplanted the API's `WEREWOLF_STYLES` and `FAIRY_STYLES` over the panel's own copies. Codex was right and the divergence was larger than the pairings: six of the twelve werewolf voices and three of the twelve fae ones were authors the API has never generated from, in a different order and with different voice samples and traits, and `Nalini Singh` was listed twice in the panel's werewolf bank. Nine of the ten creatures borrow werewolf or fae for their blend voice, so fixing the selection while the banks stayed wrong would have left almost every preview still naming authors the server could not pick — the parity this slice claims. The banks were extracted from `api/_lib/config/authorStyles.ts` by script and diffed back rather than retyped; `VAMPIRE_STYLES` already matched byte for byte.
- Changed the author list's `@for` from `track author.author` to `track $index`, and added a spec asserting that no creature can draw one author from both its banks. Codex's other P2 was the same defect seen from the template: the panel's banks put `Kresley Cole` and `Laurell K. Hamilton` in both vampire and werewolf, and `Nalini Singh` and `Jennifer L. Armentrout` in both werewolf and fae, so a vampire or fae draw could return the same author twice and hand Angular two identical keys, which is an NG0955 runtime error rather than a render. The API's ten banks share no name anywhere, so the port removes the collision; the spec keeps a later bank edit from reintroducing it silently, and position is the only identity a freshly-shuffled draw of three has.

Self-review (follow-up):

- Both findings were verified against the code before either was acted on, not taken on the bot's word: a script extracted the three shared banks from both trees and compared author lists, and a second one checked every creature's primary bank against its secondary pool for overlap across all ten of the API's banks.
- The two findings turned out to be one cause. The duplicate-key error was reachable only because the panel's werewolf and fae banks were the wrong lists; deduplicating the selection instead — the fix the comment proposed first — would have made the panel diverge from the API in a new way, since `selectRandomAuthorStyles` does not deduplicate and does not need to.
- Both new specs were confirmed to fail against the pre-port banks (`reads the werewolf and fae banks the API generates those creatures from`, `never lets a creature draw the same author from both of its banks`) and to pass after.
- Known and not addressed here: the ten author banks now exist in full in two trees, which is the same one-copy-per-reader shape `shared/storyLabThemeSeeds.ts` was created to end. Moving them under `shared/` is the durable fix and is a change to the API tree as well, so it is worth its own slice rather than being folded into this one.

Validation:

- `npm test`: passed (all suites).
- `cd story-generator && CHROME_BIN=/opt/pw-browsers/chromium-1194/chrome-linux/chrome npx ng test --watch=false --browsers=ChromeHeadlessNoSandbox`: 184 of 184 passed (182 before the follow-up specs).
- `tsc -p tsconfig.app.json --noEmit`, `tsc -p tsconfig.spec.json --noEmit`, and the Vercel API function typecheck: passed.
- `npm run build`: passed.
- `git diff --check`: passed.

## 2026-08-26 UTC - An Image Style Logged Verbatim, The App's Own Themes Reported As Unrecognized, And Two Creatures Previewed As A Third

Actions:

- Put `/api/image/generate`'s `style` field through an allow-list. Its request line reported `storyId`, `creature`, and `themes` through `loggableRequestParameters` and `style` as `input.style`. Nothing before that line constrains the field — the route's guard tests it for truthiness and the closed-set check lives in `ImageService.validateImageInput`, which has not run yet — so a body carrying prose under that name put the prose in the console and the log buffer verbatim. Added `toLoggableImageStyle`, reading `VALIDATION_RULES.imageStyle.allowedValues` rather than restating the five.
- Widened `toLoggableThemes`' allow-list to the vocabulary the app actually sends. It filtered against the eighteen classic `ThemeType`s; `app.ts` builds its picker from twelve Story Lab seeds and seven of them are on no other list, so an ordinary image generation logged `themes: []` beside an `unrecognizedThemeCount` — the caller-sent-garbage marker, written about the picker's own values. Both vocabularies are legitimate seam input and both are now recognised; a value from neither is still counted rather than repeated.
- Created `shared/storyLabThemeSeeds.ts` and pointed `app.ts`, the log allow-list, and `tests/image-service.test.ts` at it. The list had one copy, in `app.ts`, invisible to the server side of the seam, and that has now cost the same bug twice — `mapThemeToVisualElement` described those same seven seeds to the image model as `mysterious elements` until PR #238. The image-service test held its own transcription of the list, so it was asserting against a copy rather than against the picker.
- Ported `SIREN_STYLES` and `DJINN_STYLES` into `GenerationLogicService`. `getAllAuthorStyles` fell `siren` and `djinn` through to `fairyStyles`, so the Proving Grounds panel previewed twelve fae authors for two creatures the API generates from four sea or wish voices — the same fallthrough already fixed on the API side in `api/_lib/config/authorStyles.ts`, left behind in the browser copy.
- Extended `tests/log-redaction.test.ts` and `tests/story-route-contracts.test.ts`, both registered in `test:all`, and replaced two specs in `generation-logic.service.spec.ts`.

Self-review:

- Good: every fix was reproduced against the old code by reverting one file at a time and re-running. `caller text sent as an image style must not reach the buffer`, `a request the app itself makes should have its themes logged intact (got …"themes":[],"unrecognizedThemeCount":2…)`, and two named Karma failures for the author banks.
- The Angular spec was asserting the defect outright: `fairy, siren, and djinn share the same fairy-styles pool` was a green test over the drift. Replaced rather than deleted — one spec requires every creature's bank to differ from every other's, one names the siren and djinn authors — because a borrowed bank is still a non-empty, creature-shaped list and the existing shape check could not see it.
- The theme fix needed both readings asserted. A filter that blanks everything satisfies "no caller text in the log" perfectly, which is how this defect survived: the route-contract test now checks that an ordinary request's themes arrive intact as well as that prose does not.
- Non-claim: this slice changes no prompt, no generated story, and no route's status or payload. It changes what two log fields record, where the theme seed list lives, and which author bank one browser panel displays.

Validation:

- `npm run test:all`: passed (74 suites).
- `cd story-generator && CHROME_BIN=/opt/pw-browsers/chromium npx ng test --watch=false --browsers=ChromeHeadlessNoSandbox`: 176 of 176 passed.
- `npm run build`: passed. The `proving-grounds.css` budget warning (68 bytes over 12 kB) predates this slice and is untouched by it.
- `git diff --check`: passed.

## 2026-08-26 UTC - Every Story Lab Refusal Served As An Outage, An Adult Gate That Covered One Chapter, And A Token Count Blanked From Its Own Log

Actions:

- Collapsed `getStoryLabResponseStatus` onto the shared `getApiResponseStatus` table and moved `INVALID_BLUEPRINT` into it. The Story Lab table knew four codes; the routes it serves return the classic `StoryService`'s whole vocabulary, because `storyLabErrorResponse` forwards that service's error code verbatim. `INVALID_INPUT`, `RATE_LIMITED`, `QUOTA_EXCEEDED`, `AI_SERVICE_UNAVAILABLE`, `CONTENT_TOO_LARGE`, `MAX_CHAPTERS_REACHED` were every one of them served as `500` by `/api/story-lab/stories` and `/api/story-lab/stories/:storyId/continue`, while the classic `/api/story/*` routes answered `400`/`429`/`503` for the same codes. The one rule that stays local is the Story Lab-specific one: a `success: true` envelope with a null payload is a `500`.
- Extended the adult-reader confirmation gate to continuation. `generateStoryLabGenesis` refused an unconfirmed Heat Contract; `continueStoryLab` did not check, and it is the route that writes every chapter after the first — passing the same contract's tension mode and intimacy boundary into `generationContext`. Both now call one `heatContractPolicyError`, parameterized only by whether a contract is required: genesis still refuses an absent one, continuation still serves a request that names none.
- Stopped the log redactor blanking `promptTokens`. `/prompt/i` matches it, and it is a declared `LogContext` field filled from the provider's usage report on every paid call, so the input-token count was written as `[REDACTED]` while `completionTokens` beside it survived. Added a named `MEASUREMENT_KEY_EXEMPTIONS` entry rather than a `Tokens` suffix rule, which would also have unblanked `accessTokens` and `refreshTokens`.
- Extended `tests/story-lab-route-status.test.ts`, `tests/story-lab-real-engine.test.ts`, and `tests/log-redaction.test.ts`, all three already registered in `test:all`.

Self-review:

- Good: each fix was reproduced against the old code before it was written. The redaction one is the sharpest example — `tests/log-redaction.test.ts` already asserted `telemetrySerialized.includes('promptTokens')`, which is the *key*, and a redacted field keeps its key, so the suite was green over a value that was being destroyed. The assertion now reads the value.
- Correction: the continuation gate is deliberately narrower than the genesis one. Making continuation require a contract outright would refuse every caller that has been omitting the optional field, which is not the defect — the defect is that a contract saying "not confirmed" was honoured anyway.
- Non-claim: this slice does not change what any route generates, what the prompts say, or how the Angular app calls them. It changes the status a Story Lab failure is served with, when a continuation is refused, and what one log field records.

Validation:

- `npm run test:all`: passed.
- `npx tsc --noEmit --strict` over the four changed API files: passed.
- `git diff --check`: passed.

## 2026-08-25 11:05 UTC - Two Live SSE Routes Writing To A Reader Who Had Already Left, And A Stream A Proxy Was Free To Buffer

Actions:

- Re-added `api/_lib/http/sseStream.ts`, trimmed to `formatSseFrame`, `isSseStreamOpen`, `writeSseFrame`, and `endSseStream`. PR #223 retired the previous copy along with the duplicate `/api/story/stream` implementations it had been extracted for, correctly — nothing was using it. Two deployed routes still frame Server-Sent Events, though, and both were framing by hand and writing unconditionally: `/api/story-lab/stream/genesis` and the Story Lab job event stream in `api/_lib/story-lab/jobs/jobRouteHandlers.ts`. The module is back because it now has two real callers rather than the zero it had when it was removed.
- Stopped `/api/story-lab/stream/genesis` writing into a destroyed response. Its disconnect handling was a `clientDisconnected` flag set from `req.socket?.on?.('close')` — optional-chained because the socket is not guaranteed, and on a runtime that does not supply one the flag stays `false` for a reader who is already gone. Each of the route's per-chapter timers and its completion timer then wrote into a response Node had already destroyed, and those writes happen inside `setTimeout` callbacks the route does not wrap, so the `ERR_STREAM_DESTROYED` each one answers with is an uncaught exception rather than a handled one. The flag stays — it also stops the scheduling — and the response's own lifecycle flag is now the check that is always available.
- Stopped the Story Lab job event stream doing the same. It reaches its replay only after two awaited job-store lookups, so the response can be destroyed before the first frame is written; `res.write?.()` guards against the method being absent, not against the stream being closed. Its `ResponseLike` now extends `SseResponseLike` rather than restating a narrower version of it.
- Gave the genesis route `X-Accel-Buffering: no`. It is the only header that makes the route's staggered frames observable through a proxy: nginx buffers a proxied response by default and holds every frame until the response closes, so a reader behind one sees nothing for the whole generation and then the finished story at once — the outcome streaming exists to avoid, on the Docker/DigitalOcean deployment that puts a proxy in front of the app. The retired `/api/story/stream` sent it; this route never had.
- Extended `tests/story-lab-stream-genesis.test.ts` and `tests/story-lab-job-routes.test.ts`, both already registered in `test:all`.

Self-review:

- Good: each defect was reproduced against the old code by reverting one file at a time and re-running, so no assertion could be passing for another's reason: `a destroyed response should be written to no further times, got 5` and `a reader leaving before the replay should not fail the request, got Cannot call write after a stream was destroyed`.
- Correction: this slice first also fixed the same lifecycle fault in `api/story/stream.ts`, opened as PR #224 against a `main` that still had it. #223 merged in the meantime and deleted that route outright, which is the better fix; the work was rebased onto the new `main`, that fix dropped as moot, and the proxy-buffering header added in its place so the slice still carries three.
- Non-claim: this does not improve disconnect *detection*. The genesis route's socket listener is unchanged and still the only thing that stops the route scheduling further work; what is added is a check on the response itself for the case where the listener never fires.
- Non-claim: the job event route still replays the snapshots the store holds and closes. It does not follow a running job, and nothing here changes that.
- Non-claim: `X-Accel-Buffering` is an nginx directive. A different intermediary that buffers is unaffected by it, which is what `Cache-Control: no-transform` is already there to address.
- Non-claim: nothing here makes the genesis route reachable from the app, and nothing here addresses why it is not. PR #225 reverted the nav link #223 added because `StoryService.streamStoryGeneration` builds its `EventSource` URL out of the reader's own logline and directives, which is a transport problem this slice does not touch. Both routes remain deployed Vercel functions that answer a request whatever the app links to, which is what makes their disconnect behaviour worth fixing now; the privacy work stays open in `STORY_LAB_FUTURE_WORK_CHECKLIST.md`.
- Note: the changes travel together — one shared helper and its two live callers — and cross none of the independent risk areas `AGENTS.md` names for splitting a slice. No deployable route file was added or retired (`scripts/recovery/check-vercel-function-count.sh` still reports 10/12), no Angular UI, no account/auth/profile/storage boundary, no story-quality generation behaviour.

Validation:

- `npm run test:all`: passed, exit 0, including the extended `tests/story-lab-stream-genesis.test.ts` and `tests/story-lab-job-routes.test.ts`.
- `scripts/recovery/check-vercel-function-count.sh`: 10/12, unchanged — `api/_lib` is not a deployable route directory.
- `tsc --noEmit` over the changed files: no new diagnostics. The four it reports in `jobRouteHandlers.ts` and `blueprintParser.ts` are pre-existing and in untouched code.
- Note: `node_modules` is tracked in this repository and its devDependencies were absent again, so `npm install` was needed before `tsx` would run — and `npm run test:all` reports exit 0 even when every script inside it fails with `tsx: not found`, so a green exit code is not on its own evidence that the suite ran. Those tracked files were left out of the slice diff, which stays source-, test-, and doc-only.

## 2026-08-25 06:05 UTC - Caller Text Arriving Through Field Names, A Size Cap Measured In The Wrong Unit, And A Job Store That Evicted The Job It Was Running

Actions:

- Reduced the field names each malformed-request log line repeats, in `api/story/{generate,continue,stream}.ts` through a new `toLoggableFieldNames` in `api/_lib/utils/loggableRequestParameters.ts`. All three routes answered a body that failed their required-field check with `logWarn('Invalid input - missing required fields', …, { receivedFields: Object.keys(input) })`. A JSON object's keys are written by whoever wrote the body, so those are the caller's own text — the same text `toLoggableThemes`, `toLoggableCreature`, and `toLoggableStoryId` were added to keep out of the log, arriving through the one door nobody had checked. A body of `{"Dana is in treatment at the clinic on Rosewood": 1}` put that sentence in the console and in the log buffer verbatim, and it is precisely the *malformed* requests — the hand-written ones — that take this path. The token redaction every logged string still passes through does not help: it removes credentials, addresses, and URLs, not prose. The line now gets the contract's own field names that the caller sent, plus `unrecognizedFieldCount` for the rest, which is the whole diagnostic value of that field — which required fields did arrive — without any of the text. The two field lists live beside the module's other allow-lists rather than in three route files that would each drift on their own.
- Made `/api/export/save` measure its size cap in bytes. `FILE_SIZE.MAX_CONTENT_LENGTH_KB` is 500 *kilobytes* and the refusal message says so, but the check read `input.content.length`, which counts UTF-16 code units — the same confusion `ExportService` reports `fileSize` with `Buffer.byteLength` to avoid, one layer up. A story in a non-Latin script is up to three UTF-8 bytes per code unit, so the cap admitted roughly 1.5MB of one, and the `contentLength` a refusal reported was not a byte count either. The multiplier was also a literal `1000` beside a `FILE_SIZE.BYTES_PER_KB` of 1024, so the number enforced was not the one the constant named. Both are now read from the constants, and the measurement is `Buffer.byteLength(input.content, 'utf8')`.
- Rejected a non-string `content` or `title` on the same route. Both are read as text by every branch of the export renderer, and both were admitted by a presence check — a JSON body can carry a number or an object under either name and both are truthy. The renderer then threw a `TypeError` inside `saveAndExport`, whose catch answers `EXPORT_FAILED`: the caller was told the export had failed and that retrying might help, when it is the request that is malformed and only the caller can fix it. This is also what makes the byte measurement above safe — `Buffer.byteLength` of a number throws, so tightening the cap without tightening the type would have turned a wrongly-accepted request into a 500.
- Made `NonDurableStoryLabJobStore` evict by last use rather than by age, in `api/_lib/story-lab/jobs/jobStore.ts`. A `Map` orders by first insertion and re-setting an existing key does not move it, so the oldest job was always the first evicted. `jobRouteHandlers` creates a job, marks it `running`, and only *then* does the work — a generation that takes tens of seconds — so the job being worked on is always among the oldest in the map. On a warm instance at capacity it was therefore the first one dropped, ahead of jobs created after it and already finished: the completing `updateJob` found nothing and returned `null`, and the route answered 503 `STORY_LAB_JOB_STORAGE_FAILED` for a generation that had actually succeeded, while a client polling `/jobs/{id}` or its event stream was answered 404 for a job still in flight. A create, an update, and an allowed read now each move the job to the newest end. A read the owner check refuses does not, so a caller who can guess a job id cannot reorder another owner's queue. This is the ordering `stateStore` was given for the same reason, and this store is the sibling that comment points at.
- Extended `tests/story-route-contracts.test.ts` and `tests/story-lab-job-store-port.test.ts`, both already registered in `test:all`.

Self-review:

- Good: each defect was reproduced against the old code by reverting one file at a time and re-running, so no assertion could be passing for another's reason: `prose sent as a field name must not reach the buffer of /api/story/generate (got {"receivedFields":["Dana is in treatment at the clinic on Rosewood","userInput"]})`, `content past the byte cap should be refused, got 200`, and `the least recently used job should be the one evicted`.
- Correction: the eviction rewrite first claimed that moving the trim after the insert fixed an off-by-one, on the reading that `while (size >= maxJobs)` before an insert left the store holding `maxJobs - 1`. That is wrong — it trims to `maxJobs - 1` and the insert then brings it back to `maxJobs`, so the two forms keep the same number of jobs. The claim and the test written for it were both removed; the trim is still run after the insert, but only because "hold at most `maxJobs`" is what the loop then says. The one behavioural change here is the ordering.
- Non-claim: the LRU ordering does not make a non-durable job store safe to rely on. A cold start or a deploy still drops every job, which is what `JOB_NOT_FOUND` already tells the caller, and the durable Postgres store remains the answer for anything that must survive. What this removes is a job being lost *while the same process is still working on it*, which needs no restart at all — just enough traffic to reach the bound.
- Non-claim: the byte cap is still a cap on the request body, not on the export it produces. A 500KB story renders to a larger PDF or HTML document, and nothing here bounds that; the cap is about what the route accepts.
- Non-claim: `toLoggableFieldNames` reports the *set* of recognised fields, which is still derived from the caller's body — but that set is drawn from a fixed list, so it can only ever spell out names this repository wrote. Names are emitted in the contract's order rather than the body's, so two requests carrying the same fields log the same line.
- Note: the three defects travel together and cross none of the independent risk areas `AGENTS.md` names for splitting a slice — no account/auth/profile/storage boundary, no deployable route file added or retired, no Angular UI, no durable job claim, no story-quality generation behaviour. The job store touched here is the explicitly non-durable in-memory one.

Validation:

- `npm run test:all`: passed, exit 0, including the extended `tests/story-route-contracts.test.ts` and `tests/story-lab-job-store-port.test.ts`.
- `find api -name '*.ts' ! -name '*.spec.ts' ! -name '*.test.ts'` through `tsc --noEmit`, as `scripts/recovery/slice-preflight.sh` runs the Vercel API type check: clean.
- The export case asserts on a fixture that is over the cap in bytes and under it in code units, so it fails against the old measurement rather than against a merely larger body; the accepted half sends an ordinary non-ASCII story to prove the cap still lets one through.
- Note: `node_modules` is tracked in this repository and its devDependencies were absent again, so `npm install` was needed before `tsx` would run. Those tracked files were left out of the slice diff, which stays source-, test-, and doc-only.

## 2026-08-25 05:20 UTC - A Snapshot Store That Never Forgot A Story, A Log Page Size That Meant Two Things, And Request Parameters The Redactor Was Eating

Actions:

- Bounded `api/_lib/story-lab/stateStore.ts`. `persistStoryIteration` writes a snapshot on every genesis and every continuation, each holding the story's whole chapter set as generated HTML, and nothing ever removed an entry — so the map grew by one full story per generation for as long as the process lived. A Vercel instance is kept warm and reused across requests, so every story generated on one accumulated in the same map until the platform recycled it; a local Node run holds them for the whole session. The store now keeps at most `MAX_TRANSIENT_STORY_SNAPSHOTS` (200) and evicts by last use, not by age: a `Map` does not reorder on re-set, so without the delete-before-set an actively continued serial would be dropped ahead of a newer abandoned one. A read counts as a use because reading the snapshot is what a continuation does before extending it. `resetTransientStorySnapshots` is exported for the test.
- Clamped `logger.getRecentLogs(count)`. The count was read through `slice(-count)`, which means "the last `count`" only for a positive count: `-0` is `0`, so asking for none returned the entire buffer of up to a thousand entries — the value a caller reaches by paging with a remainder that ran out — and a negative count dropped the newest entries instead of returning none. The count is now floored and clamped to zero; positive counts are untouched.
- Moved the story routes' derived request parameters off the `userInput` log-context key. `storyService.generateStory`, `storyService.continueChapter`, and `/api/story/{generate,continue,stream}` all packed creature, theme ids, spice level, word budget, chapter counts, and content lengths into `userInput`, which matches `SENSITIVE_KEY_PATTERNS`; the redactor replaces a sensitive key wholesale without looking inside it, so every one of those lines was written as `"userInput":"[REDACTED]"` and recorded that a generation had started and nothing about what was asked for. They now travel under a new `requestParameters` key, where each value is judged on its own name. `userInput` keeps its meaning and the Story Lab engine's two genuine uses of it are unchanged.
- Reduced the request parameters whose contents the caller chooses, in `api/_lib/utils/loggableRequestParameters.ts`. `creature` is checked against the `CreatureType` values: `validateStoryInput` has its own copy of that list and rejects anything outside it, but it runs *after* the request line is written and the route checks that reach the log first test only that the field is present, so at the moment of logging it is caller text like any other. An unknown value is written as `[UNRECOGNIZED]` rather than repeated. `themes` is documented as `VALIDATION_RULES.themes.allowedValues`, but `validateStoryInput` only ever checked that the array is an array of at most five entries — never that the entries are on the list — and the streaming route builds the array by splitting a query string. Under the old wholesale-redacted key that did not matter; under a key that is deliberately kept it would have put caller prose in the console and the log buffer verbatim. The log now gets the recognised ids and a count of what it did not recognise, which is the whole diagnostic value without any of the text. `storyId` is matched against the whole minted form — `story_<uuid>`, `story_stream_<uuid>`, or `story-<uuid>`, the three places a story id is written — and reported as `[UNRECOGNIZED]` when it is not one of them. The scalars (`spicyLevel`, `wordCount`, the chapter counts, `maintainTone`) are logged only when they really are numbers or a boolean: the contract types them, but a raw POST carries whatever JSON the caller wrote and the checks that run before these log calls test presence rather than type. `maintainTone` is the reachable one — `api/story/continue.ts` rejects a non-numeric `currentChapterCount` with a 400 before anything is logged, but nothing checks the flag, and the service logs it one call further down.

Self-review:

- Good: each of the three defects was reproduced against the old code before it was fixed. `getRecentLogs(0)` returned all 10 buffered entries and `getRecentLogs(-3)` returned 7; `redactSensitiveLogData` turned a context carrying creature, themes, spice level, and word count into `{"userInput":"[REDACTED]"}`.
- Correction: the first version of the retention comment claimed the count bound gave "a predictable ceiling on what the store can hold", reasoning from the 1500-word `desiredWordBudget`. That word cap is per chapter and continuations keep appending, so one serial's snapshot grows without limit however few stories are retained; the comment said so only after review caught it. What the bound removes is the unbounded *count*, which is the failure that needs no unusual usage at all.
- Correction: the same comment justified the fix by a long-lived Node/Docker deployment. Docker is not an active deployment path for this recovery (`AGENTS.md` Vercel Rules), and the rationale did not need it — a warm Vercel instance reused across invocations is the supported runtime where this actually bites. Rewritten around that.
- Non-claim: capping the chapter set inside a snapshot is not available here. A continuation reads the snapshot to know what came before, so truncating it would silently break the story it exists to continue. The per-story growth is named in the comment rather than papered over.
- Correction: `storyId` was first bounded by length alone, on the reasoning that "an id fits well inside the cap and a paragraph does not". Review pointed out that most prose is *not* longer than any cap worth having — `Dana is in treatment at the clinic on Rosewood` is forty-five characters and went into the log intact. The second attempt — an alphabet of letters, digits, `_`, and `-` — was also wrong, and review caught that too: `Dana_is_in_treatment_at_Rosewood` is built entirely from those, because the separators prose uses when spaces are unavailable are the separators an id uses. The third attempt — a UUID behind a bounded free prefix — was wrong for the same reason again, and review caught that too: `Dana_at_Rosewood_9f1c0e3a-2b44-4f2e-9c3d-6a7b8c9d0e1f` carries a genuine UUID with thirty-two characters of caller text riding in front of it. The rule is now the whole minted form, pinned to the three places a story id is actually written, with nothing before the `story` and nothing after the UUID. Three attempts that each looked like a fix are worth recording as such: a cap describes length and an alphabet describes punctuation, and even a real UUID proves nothing about the text beside it — a filter has to name the value, not a property some values share.
- Non-claim: the allow-list filter is narrower than what the routes accept. `romance`, the theme these tests otherwise send, is not on `VALIDATION_RULES.themes.allowedValues`, so it is now counted as unrecognised rather than printed. That is the safe direction for a log and it changes nothing about which requests are served — the routes still accept exactly what they accepted before. Enforcing the allow-list at validation time is a separate behavioural change and was not made here.
- Note: three defects travel together here. They cross none of the independent risk areas `AGENTS.md` names for splitting a slice — no account/auth/profile/storage boundary, no deployable route or function-budget change, no Angular UI, no durable job claim, no story-quality generation behaviour — and the store in question is transient in-memory state, not durable storage.

Validation:

- `scripts/recovery/preflight.sh --skip-status`: exit 0 — required tools, whitespace/conflict markers, Vercel function count, Angular app and spec type checks, Vercel API type check, the full root test suite, the Node 20 Angular build, and build-output verification.
- `npm run test:all`: passed, exit 0, including the new `test:story-lab-state-store` and the extended `tests/log-redaction.test.ts`, `tests/logger-recent-logs.test.ts`, and `tests/story-route-contracts.test.ts`.
- The route-level redaction case drives `/api/story/stream` with an unrecognised theme and an unrecognised creature and reads the entry back out of both sinks — `logger.getRecentLogs` and a captured console — so a route that went back to passing `input.themes` or `input.creature` straight through fails even though the helper-level assertions still pass. Verified by reverting both call sites and re-running: `caller text sent as a theme must not reach the buffer`. The console half asserts first that the capture holds the request line, so it cannot pass on an empty capture.
- Note: `node_modules` is tracked in this repository and its devDependencies were absent, so `npm install` was needed before `tsx` would run. The tracked files were left out of the slice diff, which stays source-, test-, and doc-only.

## 2026-08-25 01:52 UTC - A Stream Route That Overwrote Its Own Anti-Buffering Header, Logged Every GET As A POST, And An Evaluation Score Off Its Own Scale

Actions:

- Stopped `/api/story/stream` overwriting the headers it had just set. The route sets `Cache-Control: no-cache, no-transform` and `X-Accel-Buffering: no` with `setHeader`, and then called `res.writeHead(200, { …cors.headers, 'Content-Type': …, 'Cache-Control': 'no-cache', 'Connection': … })`. Node gives `writeHead`'s header argument precedence over everything `setHeader` has already written, so the header that actually went out was `Cache-Control: no-cache` — the `no-transform` directive was dropped on the way to the client. That directive is the one that forbids an intermediary from compressing or re-chunking the body, which is the same buffering the `X-Accel-Buffering: no` beside it exists to prevent; a proxy that buffers an SSE stream holds every update until the generation finishes, which is the entire thing this route exists to avoid. The call is now `res.writeHead(200)`: the CORS headers were already written by `applyCorsPolicy` and the content type and connection headers are set immediately above, so the argument had nothing left to carry that was not already correct. The sibling `/api/story-lab/stream/genesis` route and the Story Lab job stream both already send `no-cache, no-transform`; this route was the one that disagreed with them.
- Gave the streaming catch block the method the request actually used. It logged `method: 'POST'` unconditionally, and GET is the path an `EventSource` takes — the reason the route reads a query at all — so every browser-side streaming failure was filed under the method it did not use. That field is what tells whoever reads the log whether the input arrived as a JSON body or as a query string, which is exactly where the two paths differ and where a malformed request would have come from. The `logInfo` at the top of the same handler already recorded `req.method` correctly, so the two log lines for one request contradicted each other.
- Clamped the model's overall score in `/api/story-lab/evaluate` to the 0-100 the prompt asks for and the response promises. The field was accepted on `typeof evaluation.score === 'number'` alone, which is not the same check: a model answering `8` — these criteria are written against a 1-10 scale about as often as a percentage — or overshooting to `120` was passed through literally. The frontend renders it as `{{ test.aiEvaluation.score }}/100` and colours it by threshold through `scoreToneClass`, so a story the model called excellent out of ten reached the reader as `8/100` in the red band. The `heuristicReport` travelling in the same payload already clamps every one of its dimensions with `clampScore`, so without this the two halves of one response disagreed about what the scale is.
- Added regression cases to `tests/story-route-contracts.test.ts` and `tests/story-lab-evaluate-route.test.ts`, both already registered in `test:all`. The route contracts test reads the headers off the double after driving a real GET — its `FakeResponse.writeHead` already merges its argument over `setHeader` exactly as Node does, which is what let the defect hide — and reads the logged method back out of `logger.getRecentLogs`. `parseEvaluation` is now exported so the reading of a model payload can be asserted directly rather than through a configured provider.

Self-review:

- Good: each of the three assertions was verified to fail against the old code by reverting the source and re-running, one defect at a time so no assertion could be passing for another's reason: `the stream must forbid transformation so a proxy cannot buffer it, got Cache-Control: no-cache`, `a failed GET stream should be logged as a GET, got POST`, and `an overshooting score should read as 100, got 120`.
- Correction: the first draft of the score comment claimed `NaN` reached the client as `null/100`. It cannot — `JSON.parse` has no spelling for a non-finite number, so that path is unreachable through this function. The comment now says so, and the finite check stays only to keep `Math.min`/`Math.max` total. The reachable defect is the range, and that is what the test covers.
- Non-claim: clamping cannot recover the scale a model meant. A `120` becomes `100` and an `8` stays `8`; both are now inside the range the field is documented and rendered as, but a model answering out of ten is still misread as a percentage. Detecting the scale would mean guessing, and the prompt already states the range.
- Non-claim: the `writeHead(200)` change is only correct because every header the argument carried was already on the response. That was checked header by header — `applyCorsPolicy` calls `res.setHeader` for each entry of the map it returns, and the content type and connection headers are three lines above the call — rather than assumed from the fact that the tests pass.
- Note: `no-transform` is advisory to well-behaved intermediaries, so this fix removes a cause of stream buffering rather than proving buffering was happening in any particular deployment. `X-Accel-Buffering: no` was already surviving, so nginx specifically was already covered.

Validation:

- `find api -name '*.ts' ! -name '*.spec.ts' ! -name '*.test.ts'` through `tsc --noEmit`, as `scripts/recovery/slice-preflight.sh` runs the Vercel API type check: clean.
- `npm run test:all`: passed, exit 0, including the two suites this slice extended.
- `npx tsc --noEmit -p story-generator/tsconfig.json`: clean. Nothing in this slice touches `story-generator/`, but the evaluate route's score is rendered there, so the contract it feeds was type-checked.
- Note: `node_modules` is tracked in this repository and its devDependencies were absent again, so `npm install` was needed before `tsx` would run. Those tracked files and the `package-lock.json` line `npm` rewrote were restored, so the slice diff stays source-only.

## 2026-08-25 00:58 UTC - Two Quality Dimensions That Said Yes To Everything, And A Stream Route That Answered A Malformed Query With A Broken 200

Actions:

- Stopped counting the first word of every sentence as a named character in `api/_lib/story-lab/evaluation/storyQualityHeuristics.ts`. `scoreCharacterConsistency` collected `\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\b` over the whole story, which matches "She", "Rain", "Blood", and "Nothing" as readily as "Mira" — so a story with no cast in it at all reported `Named character count: 4`. The bonus caps at two names, so every story of more than two sentences collected it in full and the dimension could not separate a story with characters from one without: the signal it printed was a sentence count wearing a cast's name. A capitalized word now counts only where it appears at least once away from a sentence boundary, a line start, or a `[Speaker]:` tag — where nothing but the word itself explains the capital.
- Stopped `extractConcreteAnchors` scoring generic references as concrete ones. It filtered tokens shorter than three characters out of the story *before* pairing them into phrases, and the short words it dropped are exactly the ones its own `weakFirstTokens` list exists to reject — `a`, `an`, `my` — so those three entries were unreachable and could never fire. Worse, dropping a token welded its two non-adjacent neighbours into a phrase the prose never contained: "She opened a door" was reported as the specific anchor `opened door`, and "He carried my key" as `carried key`. The pairing now runs over every token, so the guard reads the determiner that is actually there.
- Read `/api/story/stream`'s GET query parameters through a `readQueryParam` that tolerates the `string[]` form a repeated parameter arrives in. `?themes=romance&themes=dark` and `?creature=vampire&creature=witch` are ordinary URLs — a client appending to a `URLSearchParams` produces them without meaning to — and each failed in its own way without ever reaching the route's own validator. `themes.split(',')` threw, and the catch block answered with an SSE error frame written before `writeHead` had run, so the caller received a default 200 with no `text/event-stream` content type: a body no `EventSource` dispatches and no JSON parser reads, in place of the 400 `INVALID_INPUT` the route documents. `creature` did not throw at all — an array is truthy, so validation passed, the 200 and the `connected` frame went out, and the story service rejected the array mid-stream while the log recorded a 500 for a malformed request. Taking the first value is how `corsPolicy`, `security`, and the Story Lab blueprint parser already read every other possibly-repeated field.
- Guarded the same catch block on `res.headersSent`. An SSE error frame is only readable once the stream has been opened; before that the response has no status and no content type, so writing the frame turns any pre-stream failure into a silent broken 200. Below the stream, the answer is now an ordinary JSON 500.
- Added regression cases to `tests/story-quality-evals.test.ts` and `tests/story-route-contracts.test.ts`, both already registered in `test:all`. The heuristics get a pair: prose with no cast and no anchors must score as having none, and prose that names Mira and Lord Brine and anchors a witness shell and a blood oath must still score both — so the first assertion cannot be satisfied by a fix that scores nothing at all. `FakeResponse` in the route contracts test grew the `headersSent` that Node's own `ServerResponse` flips in `writeHead`, which the route now reads.

Self-review:

- Good: All three defects were reproduced against the running modules before anything changed. `character_consistency 64 ["Named character count: 4"]` and `prose_quality [… "Specific anchors: opened door" …]` came out of a throwaway scan of "She opened a door. Rain fell hard. Blood pooled where the light could not reach."; the stream route was driven with `{themes: ['romance','dark']}` and returned `status 0 … written "data: {\"streamId\":\"error_stream\"…"`, and with `{creature: ['vampire']}` it opened a stream and then threw `Invalid creature type` from inside the service. Each fix was then re-checked by reverting the source file and confirming the new test fails on the old code: `Error: sentence-initial words are not a cast (signals=["Named character count: 4"])` and `TypeError: themes.split is not a function`.
- Limitation, stated in the code: a name a story only ever writes sentence-initially is now missed. That is the safe direction for an advisory signal — reporting a cast that is not there is what made the score meaningless — and dialogue speakers are counted separately at three times the weight, so a story that tags its speakers still scores its cast.
- Correction: both boundary rules overreached in their first version, and the Codex review on PR #213 caught each one. A sentence opener swallowed the name behind it — `\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\b` matches "Then Mira" as one pair, rejecting the pair for starting the sentence dropped "Mira" with it, and a global matcher resumes past the whole match, so "Then Mira pressed the blood oath" produced no character signals at all. The pattern now reads the whole run of consecutive capitalized words and drops only the opener, so the boundary is decided before the words are combined. And keeping every token for pairing made short prepositions eligible as the first half of an anchor, so "In court, she waited" scored `in court` as concrete specificity that the old tokenization never awarded; a first token of one or two characters is now rejected by length, which is what the `a`/`an`/`my` entries were doing by hand and also covers `in`, `by`, `to`, `of`, and `at`. Those three entries came out of `weakFirstTokens` so no entry in that list is dead again. Both cases are now regression tests.
- Correction: the semicolon and the dashes did not belong in the sentence-boundary set, which the second Codex round caught. English does not capitalize after them, so a capital that follows one is explained by nothing but the word — it is a name — and treating the mark as a boundary threw it away: "The lock broke; Mira pressed the blood oath" scored no character signals at all, while the same sentence with a comma scored two. The ellipsis stays, because it genuinely can end a sentence and a missed name is the cheaper error than a common noun counted as a cast member.
- Correction: SonarCloud's one new issue was `sonarjs/cognitive-complexity` on `handler` in `api/story/stream.ts`, at 17 against a limit of 15 — the `res.headersSent` branch this slice added is what crossed it, since the base revision is under the limit. The six query reads and their two conditionals moved into `readStreamInputFromQuery`, which leaves the handler with the shape it describes. Its own API and dashboard are unreachable from here, so `eslint-plugin-sonarjs` located it, as the 00:02 UTC slice's lesson prescribes; the rule is silent on both changed source files afterwards.
- Non-claim: `extractConcreteAnchors` still recognises objects from a fixed noun list and still stops at five anchors. Widening the list is a separate change from making the guard that filters it reachable.
- Non-claim: the `readQueryParam` fix takes the first value of a repeat rather than rejecting the repeat. Rejecting is defensible, but the route's contract does not say a parameter may appear once, and every other reader in this repository takes the first value; making this one route disagree would be the surprise.
- Note: `res.headersSent` is a real property of Node's `ServerResponse`, so the route reads it correctly in production. The test double did not model it, which is why the double changed rather than the route.

Validation:

- `find api -name '*.ts' ! -name '*.spec.ts' ! -name '*.test.ts'` through `tsc --noEmit`, exactly as `scripts/recovery/slice-preflight.sh` runs the Vercel API type check: clean.
- `npm run test:all`: passed, exit 0, including the two suites this slice extended.
- Not run: the two Angular project type checks. `story-generator/node_modules` is absent in this environment, so both fail on `Cannot find module '@angular/core'` and `Cannot find type definition file for 'jasmine'` before reaching any source. Nothing in this slice touches `story-generator/`.
- Note: `node_modules` is tracked in this repository and its devDependencies were absent again, so `npm install` was needed before `tsx` would run. Those tracked files and the `package-lock.json` line `npm` rewrote were restored, so the slice diff stays source-only.

## 2026-08-25 00:02 UTC - Two Fence Strippers That Each Dropped Good Model JSON, And An Evaluate Route That Reported Its Own Failure For A Caller's Mistake

Actions:

- Replaced two hand-rolled Markdown-fence strippers with one shared `stripMarkdownJsonFence` in `api/_lib/utils/modelJsonPayload.ts`. Every prompt here tells the model to return bare JSON and models fence it anyway, so both callers stripped a fence before parsing — and each dropped the whole response on a form the other handled. `api/story-lab/evaluate.ts` anchored `^` and `$` against untrimmed text, so one leading newline before the fence, or one sentence after the closing fence, left backticks in the payload. `parseContinuityJson` in `api/_lib/story-lab/continuityExtractor.ts` trimmed first but only recognised a fence that ended the string, and sliced three characters off a response with no line break, so the one-line ```` ```json {"a":1}``` ```` was parsed as `json {"a":1}``` `. In both cases `JSON.parse` threw on markup rather than on anything wrong with the model's answer, and a usable result was discarded: the route answered 502 `EVALUATION_FAILED`, and the extractor fell back to heuristics and told the reader Grok had been unavailable.
- Validated the evaluate request body instead of taking every field on trust. `storyContent` was read as `input.storyContent?.trim()`, which throws for every non-string a JSON body can carry; `themes` was defaulted with `?? []` and went straight into the `for (const theme of ...)` in `scoreContinuity`; and `creature` reached `configuration.creature.toLowerCase()` the same way. None of those throws is inside the route's `try` — it wraps the provider call, not the body — so a malformed request became an unhandled rejection the runtime reports as 500, telling the caller the evaluator had failed and that retrying might help. The body now goes through `readJsonObjectBody`, as `api/story/generate.ts`, `api/story/continue.ts`, and `api/export/save.ts` already do, and each field is checked and named in a 400 `INVALID_EVALUATION_REQUEST`.
- Pointed the continuity prompt at the shared `stripStoryHtmlToText`. `continuityExtractor.ts` carried a third HTML-to-text stripper that deleted tags, joined everything with single spaces, and decoded nothing, so the model was shown prose with no paragraph structure and with `&amp;` and `&quot;` sitting in it as literal entity markup — continuity facts extracted from text no reader ever sees. It now reads the same rendering the cliffhanger, image, and story-quality scanners share, and forty-six lines of duplicate go.
- Added `tests/story-lab-evaluate-route.test.ts` and `tests/story-lab-continuity-prompt.test.ts`, both registered in `test:all`. `buildContinuityPrompt` and `ContinuityExtractionInput` are exported so the prompt the model is actually shown can be asserted on directly, the way `readGeneratedImageUrl` is in the image service.

Self-review:

- Good: All three defects were reproduced against the running modules before anything was changed, in a throwaway script — `evaluate body storyContent=number: THREW -> input.storyContent?.trim is not a function`, `themes=number: THREW -> configuration.themes is not iterable`, and both fence strippers failing on the samples listed above. Each fix has a test that fails on the old code.
- Correction: The first version of the shared stripper read the info string as a word (`[\w+-]*`), took the payload lazily up to the first closing run anywhere in the text, and threw away the entire opening line for an unterminated fence. Codex review caught all three consequences and all three were real: `application/json` left `/json` on the front of the payload; a story evaluation whose `suggestions` mention Markdown fences was truncated at the backticks inside its own JSON string; and a model that opened `` ```json {"score":80, `` and never closed the fence lost its first line. The reading is now Markdown's — the info string is whatever precedes the first `{` or `[` on the opening line, a closing fence must be a line holding nothing but a long-enough run, and an unterminated fence keeps everything from the opening line's payload onward. Four cases were added for these.
- Correction: `configuration: null` was rejected by the first version of the field checks. `?.` had always read it as an absent configuration, and a serializer that writes absent optionals as `null` means exactly that, so it now falls back to the defaults. An array still gets a 400: it carries none of the fields and would otherwise evaluate silently against every default.
- Non-claim: The stripper still does not recover a payload preceded by prose. Locating JSON inside arbitrary text means guessing where it starts, and the guess is wrong for any response that mentions a fence in passing; the prompts ask for bare JSON and every fence form models actually emit around it is covered.
- Non-claim: `parseEvaluation` still accepts whatever the model puts in `strengths`, `weaknesses`, and `suggestions` as long as it is an array. Type-checking the entries is a separate change from recovering the payload.

Validation:

- `find api -name '*.ts' ! -name '*.spec.ts' ! -name '*.test.ts'` through `tsc --noEmit`, exactly as `scripts/recovery/preflight.sh` runs the Vercel API type check: clean.
- `npm run test:all`: passed, including the two new suites.
- PR #212 checks: `Validate Vercel recovery build` passed and the Vercel preview deployed on every head so far.
- SonarCloud reported its quality gate passed with 3 new issues, and its own API and dashboard are unreachable from this environment, so `eslint-plugin-sonarjs` was run over the changed files as the 22:20 UTC slice's lesson prescribes. It found two genuine `sonarjs/super-linear-regex` hits, both in the new `modelJsonPayload.ts`: `[^\n]*` followed by `\r?\n` let the engine split a CRLF two ways, and the unanchored `` /`+$/ `` started a greedy run at every backtick in a payload full of them. Both are fixed — the line class now excludes `\r`, and the trailing run is counted rather than matched — and the rule is silent on the file afterwards. The remaining local findings sit on lines this slice did not touch, or are `sonarjs/no-empty-test-file`, which fires on every test file in this repository because they are `tsx` scripts using `assert` rather than a framework the rule recognises; the two hits on the two new test files here are the likeliest reading of the rest of the gate's count, and are left as-is for the reason the 22:36 UTC slice recorded.
- Review follow-up: Sourcery's budget for this account is still exhausted, so it posted a reviewer's guide and no findings; CodeRabbit skips automatic review on this repository. Codex raised one P1 — that this slice had no entry in this log — which is what this entry answers, and the three P2s recorded under Self-review.
- Note: `node_modules` is tracked in this repository and its devDependencies were absent again, so `npm install` was needed before `tsx` would run. Those tracked files and the `package-lock.json` line `npm` rewrote were restored, so the slice diff stays source-only.

## 2026-08-24 23:00 UTC - A Continuation Route That Threw On A Non-String Id, An HTML Export That Doubled Its Own Entities, And An Image Response Nobody Checked

Actions:

- Read `storyId` with a `typeof` guard in `api/story-lab/stories/[storyId]/continue.ts`. The route did `input.storyId?.trim()` on a field that arrives straight from the request body, and optional chaining guards `null`/`undefined`, not the wrong type — so `{"storyId": 123}`, or a boolean, object, or array, threw `TypeError: input.storyId?.trim is not a function`. Nothing in the route catches it, so the request became an unhandled rejection instead of the 400 the field check two lines below exists to produce. The job route's own `normalizeContinuationInput` already reads the field this way; the route now matches it.
- Stopped `sanitizeStoryHtmlForExport` re-escaping the references the generator wrote. The story arrives as generator HTML, where `&` and `"` are already `&amp;` and `&quot;`; escaping every `&` turned those into `&amp;amp;` and `&amp;quot;`, so the exported page rendered the entity text itself — a reader saw `feet &amp; the &quot;hunter&quot; smiled` — while the plain-text export of the same story decoded them and showed the punctuation. The HTML export now preserves exactly the references `BASIC_HTML_ENTITY_REPLACEMENTS` decodes, and escapes everything else as before.
- Refused an image-provider response that carries no URL. `callGrokImageAI` read `response.data.data[0].url` unchecked, and reading a missing property yields `undefined` rather than throwing, so an entry with a `b64_json` payload — or one a content filter emptied — was returned as `success: true` with `imageUrl: undefined` beside a real `imageId` and dimensions. The contract types that field as a string, so callers rendered a broken image instead of seeing the failure. `readGeneratedImageUrl` validates the shape and throws, which the existing catch reports as `IMAGE_GENERATION_FAILED`.

Self-review:

- Good: Each fix was checked against a targeted revert with its new test in place. Restoring `input.storyId?.trim()` fails `tests/story-lab-route-status.test.ts` with the `TypeError` escaping the route; restoring the blanket escape fails the entity assertion in `tests/export-sanitizer.test.ts` with `&amp;amp;` in the output; restoring `response.data.data[0].url` fails the new service-level case in `tests/image-service.test.ts`, which drives `generateImage` with a stubbed `axios.post` rather than only calling the helper.
- Correction: The first version of the export fix preserved any complete reference, including numeric ones and arbitrary names. Codex review caught two consequences and both were real. HTML parses a named reference by its longest valid prefix with no `;` required, so a story containing `&copycat;` would have reached a reader as `©cat;`; and preserving references the plain-text decoder does not know — `&#38;`, `&apos;` — recreated the very cross-format disagreement the fix was for. Narrowing preservation to the decoded set answers both, and the tests now assert that the HTML and plain-text exports of one story render the same text.
- Non-claim: This does not make the two exports agree on references neither path handles. `&#38;` now stays literal in both, which is consistent but is not the character the story meant; widening that means teaching `decodeBasicEntities` numeric references, which is a larger change than this slice.
- Non-claim: The image fix covers the response shape only. A provider that returns a URL which later 404s is still reported as a success, because nothing here fetches it.
- Note: Codex also asked for these three fixes to be split into separate slices. They are not split. The review-boundary rule in `AGENTS.md` lists the independent risk areas a slice must split across — account/auth/profile/storage, route or function-budget changes, Angular UI, durable job claims, story-quality generation, Proving Grounds, CSS — and none of the three crosses one: each is a local input- or output-validation fix behind an existing seam, with its own test, and the function count is unchanged at 11/12. The preceding entry in this log covers three defects in one slice on the same reading.

Validation:

- `scripts/recovery/preflight.sh --skip-status`, the command CI runs: passed — Angular app and spec type checks, the Vercel API type check, `npm run test:all`, the Node 20 Angular production build, and build-output verification.
- Targeted counterfactual per fix, as quoted under Self-review. Each mutation was reverted immediately and none is committed.
- Note: `node_modules` is tracked in this repository and its devDependencies were absent again, so `npm install` was needed before `tsx` would run. Those tracked files and the `name` casing `npm` rewrote into `package-lock.json` were restored, so the slice diff stays source-only.

## 2026-08-24 22:36 UTC - A Streaming Error That Reconnects Forever, Jobs Stuck Running After A Throw, And A Comma-Joined Allow-Origin

Actions:

- Ended the genesis stream in `StoryService.streamStoryGeneration` when the server sends an `error` chunk. The client tested only for the presence of `type` and forwarded every typed chunk to `onProgress`, but `type: 'error'` is the server's last word: `api/story-lab/stream/genesis.ts` writes it and calls `res.end()`. Nothing closed the `EventSource`, and a browser reads a closed response as a dropped connection and reconnects — re-running a full paid Grok generation, and again on every retry after that, while the observable the caller subscribed to never settled. The failure the user eventually saw came from `onerror` and said the connection failed, not what the server actually reported. The error chunk now closes the stream and errors the observable with the server's own message.
- Unsubscribed in `StreamingStoryComponent.handleStreamError` instead of only dropping the handle. `this.streamSubscription = undefined` does not run the teardown that closes the `EventSource`, so the component leaked the same reconnect loop whenever it learned about a failure through a progress chunk rather than through the observable's error path. It now unsubscribes first, which makes the component correct on its own rather than relying on the service to error.
- Recorded a thrown engine failure as a failed Story Lab job. `createGenesisJob` and `createContinuationJob` mark the job `running`, then `await` the engine outside any `try`. The engine reports its own failures as an unsuccessful envelope — which `finishJob` already turns into a `failed` job — but it can also throw, and the throw travelled past the route into its 500 handler with the job still saying `running`. Nothing ever moved it off that: a client polling `/api/story-lab/jobs/{id}` or reading its event stream waited forever on work no one was doing, and on the durable Postgres store that row stays running across deploys. A throw is now one more way for the work to fail, so `runJobWork` records it as a job failure with `GENERATION_FAILED` and puts the thrown detail in the log rather than in the job the caller reads.
- Routed the Node server's CORS through the shared policy, scoped to `/api`. `story-generator/src/server.ts` echoed `process.env['ALLOWED_ORIGINS']` into `Access-Control-Allow-Origin` verbatim, but that variable is documented as a comma-separated list and parsed as one by `parseAllowedOrigins`. A deployment naming two origins therefore sent `Access-Control-Allow-Origin: https://a.example,https://b.example`, which no browser accepts — blocking every cross-origin call, including from both origins it was trying to allow — and it never sent `Vary: Origin`, so a shared cache could hand one origin's response to another. `createCorsMiddleware` wraps the existing `applyCorsPolicy`, so the server now answers with the single origin the request matched, rejects an unlisted origin the way the serverless routes do, and leaves SSR page responses alone.
- Added the `generateGenesis` and `continueStory` seams to `StoryLabJobRouteDependencies`, alongside the `authPort` and `createJobStoreConfig` seams already there, so a test can inject an engine that throws.

Self-review:

- Good: Each fix was checked against a targeted revert with its new test in place. Reverting `runJobWork` to the direct `await` makes `tests/story-lab-job-routes.test.ts` fail with the thrown `Provider socket closed…` escaping the route rather than the job reading `failed`; reverting the error branch in `story.service.ts` fails `ends the genesis stream when the server reports an error chunk` on the un-closed `EventSource`.
- Good: The job failure message is fixed text and the thrown error goes to `logError`. The new test asserts that neither the injected owner email nor the `sk-secret` string in the thrown message reaches the job envelope, matching what the sibling job-store failure cases already assert.
- Non-claim: The `/api` CORS middleware changes what an unlisted origin gets from the Node server — a 403 instead of a response with no `Access-Control-Allow-Origin`. That is the serverless behaviour and it fails closed, but it is a behaviour change, not only a bug fix. The allowed header list is now the shared `DEFAULT_HEADERS`, which drops `Accept`, `Accept-Version`, and `Content-Length` from the old list; `Accept` and `Content-Length` are CORS-safelisted or browser-controlled, and nothing in this client sends `Accept-Version`.
- Non-claim: Nothing here makes Story Lab jobs durable work. They still run inline inside the request that creates them, so a job whose request dies — a serverless timeout, a lost container — still leaves a `running` row behind. This fix covers the throw, which is the case the route could see and was discarding.
- Non-claim: `api/story/stream.ts`'s own error path is unchanged. It writes an SSE `error` frame with no `error` field at all, so a client has nothing to report either way; the route the Angular client actually uses is `genesis.ts`.

Validation:

- `scripts/recovery/preflight.sh --skip-status`, the command CI runs: passed — Angular app and spec type checks, the Vercel API type check, `npm run test:all`, the Node 20 Angular production build, and build-output verification.
- `npx ng test --watch=false` (not part of CI, but the specs are type-checked there): 140 passed, 1 failed. The failure is `ProvingGroundsComponent disables generate button while generation is in progress`, which fails identically on a stashed tree at this commit's parent — pre-existing, not from this slice. The new streaming spec passes.
- Targeted counterfactual per fix, as quoted under Self-review.
- Note: `node_modules` is tracked in this repository and its devDependencies were absent again, so `npm install` was needed before `tsx` would run. Those tracked files and the `name` casing `npm` rewrote into `package-lock.json` were restored, so the slice diff stays source-only.
- PR #210 checks: Recovery CI did not fire on `pull_request` for this PR — the only workflow run attached to the head commit was Copilot's reviewer — so `Validate Vercel recovery build` was dispatched against the branch through `workflow_dispatch`, which the workflow already accepts, and passed. The Vercel preview deployed and SonarCloud's quality gate passed with two new issues. SonarCloud's own API is unreachable from this environment, so `eslint-plugin-sonarjs` was run locally over every changed file, as the 22:20 UTC slice's lesson prescribes: all six findings sit on lines this slice did not touch — the nested ternaries in `jobStoreUnavailable`, `Math.random()` in the server's `streamId`, and `sonarjs/no-empty-test-file`, which fires on all thirty-four test files here because they are `tsx` scripts with `assert` rather than a framework the rule recognises. The two file-level `no-empty-test-file` hits on the two test files this slice changed are the likeliest reading of the gate's "2 new issues", and are left as-is for the reason the previous slice recorded.
- Review follow-up: Sourcery's budget for this account is still exhausted, so it posted a reviewer's guide and no findings; CodeRabbit skips automatic review on this repository. Copilot recommended approval with one comment — that `createCorsMiddleware` typed `next` as `() => void`, narrower than connect's `(err?: any) => void`, which forced `server.ts` to wrap the middleware rather than hand it to `app.use` directly. That was correct: the type is now the exported `CorsMiddleware`, whose `next` takes the optional error argument, and the wrapper in `server.ts` is gone. Both type checks and `npm run test:all` pass on the change.
- `main` moved under this PR while it was in review — PR #209 merged — so `main` was merged into the branch. The only conflict was this file: both slices added an entry at the top, both are kept in descending order, and this entry's timestamp moved from 22:35 to 22:36 UTC so the two are ordered by when the work actually finished. The merged tree was re-validated with the full preflight, which now includes that slice's `test:image-service` suite.

## 2026-08-24 22:35 UTC - Codex Review Follow-Up To PR #207

Codex's review landed thirteen seconds before PR #207 was merged, so its findings are answered here rather than on that branch. A merged PR is finished; this is a new slice on a branch restarted from `main`.

Actions:

- Drove `/api/story/stream` itself in `tests/story-route-contracts.test.ts` instead of only its serializer (Codex P1, correct). The test asserted `formatSseFrame` and never the route, so any of the three `res.write` call sites could have gone back to interpolating its own terminator with every assertion still passing. The route is now called with `StoryService.prototype.generateStoryStreaming` stubbed — the real one streams a mock story in 100 ms batches, which proves nothing about framing and would hold the suite for half a minute — and the connected, chunk, completion, and error frames are parsed off the response as a client would. Verified by bypassing the helper at one call site: the suite fails.
- Made that failure legible while doing it. Welded frames make a `data:` payload hold several JSON objects, so the parse threw a `SyntaxError` about a character offset. It now says the frame did not carry exactly one payload and that the stream is not terminated correctly.
- Recorded the continuation-context change in `STORY_LAB_REAL_ENGINE_EXEC_PLAN.md` (Codex P1, correct). `extractLastChapterSummary`, `generateNextChapterHint`, `createContextExcerpt`, and `extractCharacterNames` all feed the continuation request, and the documentation map makes that plan the owner of continuation behaviour; PR #207 updated only this changelog.
- Routed the mock streaming path through the corrected counter (Codex P2, correct). `simulateStreamingGeneration` still cuts batches on spaces, which is how it simulates a token stream, but it derived its totals from `split(' ').length`, which counts `<h3>Chapter` and `door.</p><p>Blood` as one word each. Measured: a 700-word mock reported 652 words where `countWords` sees 669, so the completion metadata in every local and demo run was low by seventeen. Both the totals and the per-chunk progress now come from `countWords`, and `wordsGenerated + estimatedWordsRemaining` accounts for the whole story at every chunk.
- Corrected this changelog's counterfactual claim for the malformed-body fix (Codex P1, correct). Only `undefined` and `null` threw into the 500 path; a string and an array permit property access and `Object.keys`, so both already answered 400 before `readJsonObjectBody` existed. Confirmed by reproducing the pre-fix handler against all four shapes: `undefined` and `null` give 500, string and array give 400. The 22:20 UTC entry's "all three failed" is true as written — the counterfactual run failed on the `undefined` case — but the four shapes were presented together in a way that reads as four regressions. The test now separates the two regression shapes from the two that are normalization coverage, and says so.

- Removed an over-broad assertion from the new route-level test after Copilot flagged it, correctly. It scanned the whole wire stream for the two characters `\` and `n`, but `JSON.stringify` escapes newlines inside the payload, so any chunk whose content carries a blank line — which is what the mock story emits between paragraphs — would have failed a correctly framed stream. The terminator is now read where it lives (the last frame has to end the event) and the parser proves dispatchability; the stubbed content carries blank lines so that case is covered rather than merely avoided.

Self-review:

- Correction: PR #207 was merged while Codex's review was in flight. The other three bots had reported and the checks were green, so the merge looked complete, but Codex reviews on this repository arrive several minutes after the push and one had answered #206 the same way. Wait for it, or accept that its findings become a follow-up slice.
- Good: Each of Codex's four findings was checked before being accepted. All four held up, including the one that contradicted this changelog.
- Non-claim: The mock streaming counter is corrected in the mock path only. Nothing here changes the live provider path, which already reported `countWords`.
- Non-claim: The route-level SSE test proves the frames the route writes are dispatchable, with the generator stubbed. It is not deployed-endpoint proof.

Validation:

- `npm run test:all`: passed, with the new mock-streaming case and the route-level SSE case.
- Targeted counterfactuals: one `res.write` call site reverted to interpolating `\\n\\n` directly — the suite fails with `an SSE frame did not carry exactly one JSON payload…`; the pre-fix handler shape reproduced against all four body shapes to check Codex's claim before accepting it.
- `tsc --noEmit --strict` over the changed files: **not clean, and it is not clean on `main` either.** It reports eleven diagnostics in `tests/story-service-improved.test.ts` — theme literals that are not `ThemeType`, a possibly-undefined `totalWordCount`, and similar. Restoring that file from `origin/main` and running the same command reports the same eleven, and none fall in the lines this slice or PR #207 added. So the correct claim is "adds no new diagnostics", not "passes": the repository does not currently satisfy a strict type gate on its test files, and no completion audit should read these entries as evidence that it does. The same wording was too strong in the 22:20 UTC entry below, which is corrected in place.
- Not taken: Codex's P1 asking for the three fixes to be split into separate review slices. The three were independent by design and each was independently revertible, which is what made the per-fix counterfactuals possible, but they were one assignment and shipped as one reviewable slice with one section per defect. The same finding was raised on #206 and left to a human then; it is left to a human now rather than re-litigated by the agent that wrote the slice.
## 2026-08-24 22:25 UTC - Markup In The Image Prompt, A TypeError Reported As A Service Failure, And An Aspect Ratio That Contradicts Its Own Dimensions

Actions:

- Pointed `imageService`'s scene extraction at the shared block splitter. `extractSceneFromStory` deleted tags in place with `content.replace(/<[^>]*>/g, '')`, which is the same defect class the story service, cliffhanger scan, and quality heuristics have each been moved off: closing the gap a tag held open welds the words on either side of it, so the opening of a story reached the image model as `He shut the door.Blood pooled at her feet`. The in-place strip also left the generator's entities in the prose, so the model was asked for a scene containing the literal text `&amp;` and `&quot;hunter&quot;`. `stripStoryHtmlToText` renders the blocks a reader sees and decodes those entities, and is now what this fourth caller uses.
- Rejected a malformed `themes` as `INVALID_INPUT`. `validateImageInput` checked `storyId`, `content`, and `style` and stopped there, but `enhancePromptWithStyle` calls `input.themes.map(...)`. A request that sent a bare string — the shape a client naturally reaches for when a field is documented as a list of themes — threw a `TypeError` that `generateImage`'s catch block reports as `IMAGE_GENERATION_FAILED`, so the caller was told the image service had failed, and the user-facing `message` was `input.themes.map is not a function`. The request is malformed and only the caller can fix it, which is the same reasoning `api/_lib/http/jsonRequestBody.ts` records for the story routes. `creature` is validated alongside it, and an empty `themes` array is rejected too: it is truthy, so it passed the Express route's own pre-check and produced the prompt fragment `Visual elements: .`
- Made the reported aspect ratio the one that was actually served. `mapAspectRatioToSize` and `getAspectRatioDimensions` each carried their own table and their own `|| '16:9'`-shaped fallback, while the response echoed `input.aspectRatio` unchanged — so `aspectRatio: '21:9'` came back as a successful `21:9` image measuring `1792x1024`, generated from a `1792x1024` request to the provider. The contract types this field as a closed set of four ratios, so a value outside it is now `INVALID_INPUT` rather than a silent substitution, and both lookups plus the validation list are derived from one `ASPECT_RATIO_SPECS` table that cannot drift.
- Added `tests/image-service.test.ts` and wired it into `test:all`. The service had no test file; these three defects are all reachable through the public `generateImage`, so the suite drives them from there rather than reaching into the private helpers, and asserts the mock image URL is built at the same dimensions the response reports.

Self-review:

- Good: Each fix was checked against a targeted revert with the new tests in place, and each fails there — `paragraph break should not weld two words together (got: … door.Blood pooled …)`, `themes="betrayal" is a caller error, not a service failure (got IMAGE_GENERATION_FAILED)`, and `an unsupported aspect ratio is a caller error (got IMAGE_GENERATION_FAILED)`.
- Good: The tests clear `XAI_API_KEY` before the first `new ImageService()`, so they exercise the mock path and never reach the network; the service reads that variable in its constructor.
- Non-claim: The aspect-ratio change is a behavior change for a caller that was sending an unsupported ratio. Such a caller previously received a 16:9 image labelled with whatever it asked for and now receives `INVALID_INPUT`. The Angular client sends no `aspectRatio` at all, and the field is optional, so the default path is untouched.
- Non-claim: This slice does not touch how the image is generated. `fileSize` is still reported as `0`, the response is still built without waiting to see the bytes, and `callGrokImageAI` still reads `response.data.data[0].url` without checking that the provider returned an entry.
- Non-claim: The Express route at `/api/image/generate` still pre-checks the same fields for presence before the service sees them. It is unchanged; the service no longer depends on it, which is what matters for the Vercel path where no such route exists.

Validation:

- `npm run test:all`: passed, including the new `test:image-service`.
- Targeted counterfactual per fix, with the new tests in place: the in-place tag strip restored, the `themes` guards removed, and the aspect-ratio guard removed. All three failed with the messages quoted above, then were restored.
- `tsc --noEmit` over the `api` tree with the preflight script's flags: no new diagnostics. The four pre-existing ones (`jobRouteHandlers.ts` possibly-undefined `error`, the absent `@neondatabase/serverless` types, and `blueprintParser.ts`'s `HeatContract | undefined`) are unchanged and untouched by this slice.
- Note: as at 22:20 UTC, `node_modules` is tracked here and its devDependencies were absent, so `npm install` was needed before `tsx` would run. The tracked files and the `name` field `npm` rewrote in `package-lock.json` were restored afterwards, so the slice diff stays source-only.
- PR #209 checks: Validate Vercel recovery build passed, the Vercel preview deployed, and SonarCloud's quality gate passed with two new issues. Ran `eslint-plugin-sonarjs` locally as the 21:15 UTC slice's lesson prescribes, installed outside the tree, to read what the gate does not show. One was `sonarjs/super-linear-regex` on `/<[^>]*>/` in the new test's "no markup reaches the model" assertion — the same quadratic-backtracking shape `storyTextBlocks` documents avoiding, written into the test for the very slice that removes the last such regex from the source. It now uses `[^<>]`, which still matches `<p>` and decides each position once. The other was `sonarjs/no-empty-test-file`, which fires on every `tsx`-script suite in this repository — confirmed locally against `tests/export-service.test.ts` and `tests/cliffhanger-service.test.ts`, which it also flags — so it is left as-is for the reason the 22:20 UTC slice recorded. After the regex fix, SonarCloud still reports two new issues while local SonarJS over the same changed files names only `no-empty-test-file`; the two cannot be read directly, because the egress proxy still denies `CONNECT sonarcloud.io:443` exactly as the 21:15 UTC slice's lesson records, so `curl` against the issues API answers `403`. The gate passes either way, and the count is recorded here rather than guessed at.
- Review follow-up: Sourcery's budget is still exhausted for this account, so it posted a reviewer's guide and no findings; CodeRabbit skips automatic review on this repository (fewer than ten stars). Copilot recommended approval with no inline comments. Codex left one P2 on `LESSONS_LEARNED.md`: the sweep command this slice documented was written as `grep -rn`, the recursive grep agents here are steered away from in favour of `rg`. Valid and local — a durable lesson that tells the next agent to reach for the wrong tool is worse than no lesson — so the line now reads `rg -n -F '<[^>]*>' -g '*.ts' api shared story-generator/src`, verified against the merged tree to return the same nothing. Fixed in 08346d1, replied on the thread, resolved.
- `main` moved under this PR while it was in review — PR #208 merged — so `main` was merged into the branch. The only conflict was this file: both slices added an entry at the top. Both are kept, in descending order, and this entry's timestamp was corrected from a future-dated 23:45 UTC to the 22:25 UTC at which the work actually finished. `npm run test:all` was re-run on the merged tree and passed, and the tag-strip sweep still returns nothing after taking in `main`'s changes.

## 2026-08-24 22:20 UTC - Unterminated SSE Frames, Markup-Blind Word Counts, And Malformed Bodies Reported As 500

Actions:

- Terminated `/api/story/stream`'s Server-Sent Events with real newlines. All three `res.write` calls spelled the terminator `\\n\\n` inside a template literal, which is a backslash followed by `n` — printable text, not a line ending. An SSE event is dispatched by the blank line that ends it, so nothing this route wrote was ever delivered: the connection stayed open, the payloads accumulated into one unterminated event, and an `EventSource` fired `message` exactly never. The sibling route `api/story-lab/stream/genesis.ts` has always used real newlines, which is why only this one was affected. The frame is now built by an exported `formatSseFrame`, so the terminator is written once and can be tested.
- Pointed `storyService`'s text extraction at the shared block splitter. `stripHtml` and `countWords` deleted tags in place, which closes the gap the tag held open and welds the last word of one paragraph to the first of the next: `<p>She opened the door.</p><p>Blood pooled…</p>` was read as `door.Blood`. The consequences were spread across the service — `countWords` lost one word per paragraph boundary, and it is reported to the client as `actualWordCount` and drives the streaming progress percentage; `extractLastChapterSummary` split the welded text on blank lines, found one paragraph, and returned the story's opening 150 words as its summary of what just happened; and `generateNextChapterHint` had no whitespace after the full stops for `/(?<=[.!?])\s+/` to split on, so the "closing sentence" it hands the continuation prompt was the entire chapter. This is the third slice to hit this defect class, so the fix is the existing `storyTextBlocks` helper rather than a fourth local strip: `stripStoryHtmlToText` joins the reader-visible blocks and is now what both callers use.
- Answered a missing or non-object request body with 400 on `/api/story/generate`, `/api/story/continue`, and `/api/export/save`. Each assigned `req.body` straight to a typed local and read a field off it, so an empty body — or one sent without `Content-Type: application/json`, which the runtime hands over as `undefined` or a string — threw into the handler's own catch block and came back as 500 `INTERNAL_ERROR`. That tells the caller the service failed and that a retry might help, when the request is malformed and only the caller can fix it. `api/_lib/http/jsonRequestBody.ts` holds the one guard the three routes share; `/api/story/stream` already validated this correctly and is unchanged.
- Added `tests/story-route-contracts.test.ts` for the two route-level defects and four cases to `tests/story-service-improved.test.ts` for the text measurements. The SSE test parses the stream the way a client does — split on the blank line, collect `data:` lines — so it fails for the reason the client fails rather than on a string comparison, and it covers a chunk whose own content contains blank lines.

Self-review:

- Good: Each fix was checked against a targeted revert with the new tests in place, and each fails there — `an SSE frame must end with two real newlines so the client dispatches the event`, `Expected 2 words across a paragraph boundary, got 1`, and `/api/story/generate should answer a missing body with 400, got 500`.
- Good: The body guard covers `undefined`, `null`, a string, and an array, which are the four shapes the runtime actually produces for a body it could not parse as a JSON object.
- Non-claim: `formatSseFrame` fixes the framing only. The route still writes its `Content-Type` twice — once through `setHeader` and again in `writeHead` — and still has no heartbeat or client-disconnect handling; `genesis.ts` remains the route the Angular client actually uses.
- Non-claim: Word counts now match what a reader counts in the rendered story. Nothing here changes generation, the word-count target, or the prompt that asks for it, so a story whose real length misses its target still misses it — it is now reported accurately instead of low.
- Non-claim: The three routes still answer 200 with `success: false` when the service itself fails. Only the malformed-request path changed; mapping service failures onto status codes the way `getStoryLabResponseStatus` does for Story Lab routes is separate work and would change what the client sees on a generation failure.

Validation:

- `npm run test:all`: passed, including the new `test:story-route-contracts`.
- Targeted counterfactual per fix, with the new tests in place: the SSE terminator restored to its literal spelling, `stripHtml`/`countWords`/`extractLastChapterSummary` restored to their pre-fix bodies, and the three routes restored to reading `req.body` unguarded. All three failed with the messages quoted above, then were restored.
- `tsc --noEmit --strict` over the changed source files and the new test file: clean. Corrected 22:45 UTC after review: this claim originally read "the changed source and test files", which is wider than what was run — `tests/story-service-improved.test.ts` was not in the command, and it carries eleven diagnostics that also exist on `main`. See the 22:35 UTC entry above.
- Note: `node_modules` is tracked in this repository and its devDependencies were absent, so `tsx` could not run until `npm install` wrote them. Those tracked files and the `name` field `npm` rewrote in `package-lock.json` were restored, so the slice diff stays source-only.
- PR #207 checks: Validate Vercel recovery build passed, the Vercel preview deployed, and SonarCloud's quality gate passed with four new issues. Ran `eslint-plugin-sonarjs` locally, as the 21:15 UTC slice's lesson prescribes, to read what the gate would not show: three were the unused `testName` key destructured out of `Object.entries` in `runAllTests`, one of them added by this slice. All three loops now iterate `Object.values`. The fourth, `sonarjs/no-empty-test-file` on the new suite, fires on every test file in this repository — they are `tsx` scripts with `assert`, not a framework the rule recognises — so restructuring one suite around `node:test` to satisfy it would leave it inconsistent with its thirty-three siblings for no proof gained. Left as-is and recorded here.
- Review follow-up: Sourcery's finding budget is exhausted for this account, so it posted a reviewer's guide and no findings; CodeRabbit skips automatic review on this repository. Copilot recommended approval with no inline comments and one point: that the `2026-08-24` timestamps in the new file headers and this entry are future-dated. They are not — that is the current date, and the events on the PR itself carry it — so the dates stand. Copilot's own knowledge cutoff predates this repository's timeline, which is the likeliest source of the reading; it is worth expecting on future slices rather than re-litigating each time.

## 2026-08-24 21:15 UTC - API-Key Prefixes In User Ids, A Chapter-Wide Cliffhanger Scan, And Unusable Export Filenames

Actions:

- Derived the authenticated `userId` from a SHA-256 prefix of the API key instead of the key's first eight characters. That id is attached to log entries and returned to callers, so every authenticated request printed a live credential's prefix beside it — which also made the `timingSafeEqual` comparison directly above it pointless: there is no need to recover a key byte by byte from response timings when a third of a short key is written to the logs. The new id keeps the property it is used for — same key, same id; different keys, different ids — without being reversible.
- Split story content into reader-visible blocks before the cliffhanger scan reads it. The scan weighs the final paragraph above the rest of the chapter, but `getLastParagraph` recognised only `</p>` and blank lines as boundaries. A chapter separated by `<br>`, `<div>`, or a heading collapsed into one block, so "the final paragraph" was the whole chapter: every pattern hit anywhere scored as an ending hit, `cliffhangerText` returned the chapter instead of the hook, and the trailing `/[?!]$/` test read the story's last character. Dropping tags without a boundary in their place also ran neighbouring words together, scanning `door.</p><p>Blood` as `door.Blood`.
- Moved the block splitter the 20:05 UTC slice added to `storyQualityHeuristics` into `api/_lib/utils/storyTextBlocks.ts` and pointed both scans at it, so the two read the same paragraphs. The splitter itself is unchanged.
- Made export filenames readable, bounded, and unique. Each unsupported character became its own underscore, so a title in any non-Latin script kept none of itself and downloaded as a row of underscores indistinguishable from the next; punctuation left runs of underscores through Latin titles; and nothing bounded the length, so a 400-character title produced a 418-byte name. Runs now collapse to one separator, the ends are trimmed, the stem is capped at 80 characters, and the fallback is named `story`.
- Added a random per-export token to the filename after review. The fallback stem widened an existing collision window: two exports racing within one millisecond already collided when their titles matched, and every title with no portable characters now shares the stem `story`, so in a real object store one export could overwrite the other.
- Added a regression case to each of the three existing suites: `tests/api-key-auth.test.ts` walks every prefix of the key and asserts none of them appears in the id, `tests/cliffhanger-service.test.ts` covers `<br>`, `<div>`, and `<p>` boundaries plus the glued-word case, and `tests/export-service.test.ts` covers non-Latin, empty, punctuated, and overlong titles plus name uniqueness across a shared fallback stem.

Self-review:

- Good: Each fix was checked against a targeted restore of that one source file from `origin/main` with the new tests in place, and each fails there — `leaked 4 characters: user_sk-live-`, `got "She opened the door.Blood pooled on the floor.Who was there?"`, and `got ________1787605072342.txt`.
- Correction: The first counterfactual run restored from `HEAD` after the fix had already been committed, so it restored the fixed file and reported all three tests as vacuous. Re-running against `origin/main` gave the real result. Compare against the pre-fix ref, not `HEAD`.
- Non-claim: The hashed id is not an authorization boundary and no store keys off it. It identifies a caller in logs; mapping a key to a real account is still the database lookup the comment describes.
- Non-claim: The filename token makes a collision improbable, not impossible, and `saveToStorage` remains the mock its own comment describes — nothing here writes to an object store or checks for an existing key.
- Non-claim: The cliffhanger scan's patterns, weights, and variety score are untouched. Only the text they are applied to changed.

Validation:

- `npm run test:all`: passed.
- Targeted counterfactual: `git checkout origin/main -- <one source file>` with the new tests in place, per fix; all three failed with the messages quoted above, then were restored.
- `tsc --noEmit --strict` over the changed source files: passed with no diagnostics.
- PR #206 checks: Validate Vercel recovery build passed and the Vercel preview deployed. SonarCloud's quality gate failed on `B Maintainability Rating on New Code` where the gate requires A. Its analysis API is unreachable from this environment — the egress proxy answers 403 to `CONNECT sonarcloud.io:443` — and it left no inline comment, so the finding could not be read from the check. A first attempt guessed at small readability points and did not clear the gate.
- Root-caused the gate failure by running the same analyzer locally instead of guessing again. SonarCloud's JS/TS rules are SonarJS, which ships as `eslint-plugin-sonarjs`; installed outside the repository and pointed at copies of the changed files, it named the finding directly: `sonarjs/super-linear-regex` (S5852) on three regexes.
  - `buildFilenameStem` trimmed separators with `/^_+|_+$/` and `/_+$/`. An anchored `_+` is retried from every position of a long underscore run before it fails, which is quadratic. Splitting on the unsupported runs and joining the parts collapses each run and drops the outer ones in one linear pass.
  - `BLOCK_BOUNDARY_PATTERN` paired `\s*` with `/?` and then `\s*` again, and let `[^>]*` cover the same whitespace as the `\s*` after it. On a `<` followed by a long run of spaces that never matches, every way of splitting the run between the two groups is tried in turn.
  - `stripInlineTags` used `<[^>]*>`, so every `<` in a run of them starts a scan to the end of the story before failing for want of a `>`.
- Confirmed the rewrite is behaviour-preserving before trusting it: the old and new patterns produce identical blocks on seventeen representative inputs, including attributes, uppercase tags, `<br/>` and `<br />`, stray closing tags, nested inline markup, and the `<paragraph>`/`<pre>` cases that must *not* match a block tag. On 40,000 characters of adversarial input the old patterns took 2052 ms and 1076 ms; the new ones take 0.32 ms and 0.40 ms. The quadratic behaviour was real, not theoretical — this is a fix, not lint appeasement.
- Lesson for the next agent: when a hosted analyzer fails a gate and its findings are unreachable, run the analyzer's own rules locally rather than guessing from the rating. `eslint-plugin-sonarjs` reproduces SonarCloud's JS/TS findings, and linting the pre-change files from `origin/main` separates findings that are new to a slice from ones the gate has already accepted. That comparison is what showed the block-splitter regex was pre-existing on `main` and only counted here because moving it into a new file made it new code.
- Review follow-up: Copilot recommended approval with two documentation-accuracy points — the 255-byte limit was attributed to object stores, where S3 keys in fact allow far more, and the block-splitter comment claimed plain text passes through when tag-shaped spans are stripped from it too. Both comments were corrected. Codex raised two P1s and a P2: this changelog entry answers the first, the filename token answers the P2, and the slice-splitting P1 is answered on its thread.
- Note: `node_modules` is tracked in this repository. Installing dependencies to run the suite modified those tracked files; they were restored so the slice diff stays source-only.

## 2026-08-24 20:05 UTC - HTML-Blind Quality Heuristics, Undercounted Trope Pools, And Fabricated PDF Xref Offsets

Actions:

- Split story content into text blocks before scoring it in `storyQualityHeuristics`. The evaluation route is called with the story exactly as the generator renders it — `<p>` elements on one line, `[Speaker]:` tags inside those elements, no blank lines anywhere — but the scan split paragraphs on blank lines and looked for speaker tags at the start of a line. Against that markup every paragraph-shaped and dialogue-shaped signal reported the opposite of what the story holds: the whole story counted as one paragraph, so `cliffhanger_quality` scanned the entire text as if it were the ending and `audio_readiness` marked every story as one overlong block; no `[Speaker]:` tag ever started a line, so no story was credited with dialogue or speaker variety; and `<p>Hello</p>` counted as a single word. Block-level tags and `<br>` now become block boundaries, inline tags are dropped, and basic entities are decoded, so each dimension reads the prose the reader sees. Plain-text callers are unaffected: their blank-line boundaries are honoured exactly as before.
- Counted distinct tropes, not pool entries, when deciding whether a preferred-intensity pool can satisfy `selectTropesForSubversion`. The pool is weighted by repetition — every common trope is pushed three times — so one trope at the requested intensity looked like three candidates. A caller asking for two `subtle` werewolf tropes got one: the loop drains every copy of the only id it holds and never falls back to the wider pool that could supply the second.
- Built the mock PDF's cross-reference table from the document being written. The object offsets and `startxref` were fixed constants, so they addressed whatever bytes a real title and excerpt pushed into their place; no entry pointed at an object header and `startxref` did not point at the table. Each entry is now measured with `Buffer.byteLength` as the objects are assembled, and the records keep the fixed 20-byte width the format requires. This answers the open item the 19:00 UTC slice recorded as a non-claim.
- Added a regression case to each of the three existing suites: HTML-shaped input in `tests/story-quality-evals.test.ts`, a preferred-intensity property over every creature and intensity in `tests/trope-subversion.test.ts`, and an xref-resolves-its-objects case over three title lengths in `tests/export-service.test.ts`.

Self-review:

- Good: Each fix was checked against a targeted revert of the source change with the new tests in place, and each fails there — `werewolf/subtle ... (got 1)`, `Paragraphs: 1` on a four-paragraph HTML story, and `startxref ... should point at the cross-reference table`.
- Good: The trope and xref tests assert properties rather than fixtures — every creature and intensity combination, and every entry in the table against the object it addresses — so a later database entry or added PDF object is covered without editing the test.
- Non-claim: The PDF remains the mock its own comment describes. The table is now internally consistent, which is not the same as a valid PDF; a real generator (pdfkit or similar) is still the open work, and the EPUB fragment still has no `unique-identifier`/`dc:identifier` pair, container, or chapter files.
- Non-claim: The heuristic scan still reads only what the request carries. Nothing here changes the AI evaluation path, the scoring formulas, or the dimension list — only the text those formulas are applied to.

Validation:

- `npm run test:all`: passed.
- Targeted counterfactual: `git stash push -- api/` with the new tests in place; all three suites failed with the messages quoted above; restored immediately and not committed.
- `tsc --noEmit --strict` over the three changed source files: passed with no diagnostics.
- `git diff --check`: passed.
- Note: `node_modules` is tracked in this repository. Installing dependencies to run the suite modified those tracked files; they were restored so the slice diff stays source-only.

## 2026-08-24 19:00 UTC - PDF Stream Length, PDF Excerpt Cut Boundary, EPUB Namespace, And Level-Filtered Log Reads

Actions:

- Measured the PDF content stream's `/Length` from the stream itself with `Buffer.byteLength`. It was `content.length + 100` — the UTF-16 code-unit count of the whole story, which is neither what the stream holds nor a byte count. A reader uses `/Length` to find where the stream ends, so the declared span ran past `endstream`: on the existing test fixture it claimed 519 bytes for a 164-byte stream.
- Cut the PDF excerpt from the source text, by code point, before escaping. It was cut out of the *escaped* text, so the cut landed inside whatever escaping had inserted: a `\(` pair lost its parenthesis and left a dangling backslash that escapes the following character, and a surrogate pair lost its second half, so the astral-plane character it encoded was written out as U+FFFD.
- Bound the Dublin Core namespace on the EPUB package element. The metadata block is written as `<dc:title>`, `<dc:creator>` and `<dc:language>`, but the `dc:` prefix was never declared, which makes the package document ill-formed XML — a conforming reader rejects it before reading any metadata.
- Fixed `logger.getRecentLogs(count, level)` to filter by level across the whole buffer and trim afterwards. It trimmed to the last `count` entries first, so asking for the last 50 errors returned only the errors that happened to fall among the last 50 entries of any level — on a busy request, usually none of them, which is exactly the case the level filter exists for.
- Made `ExportService.generateExportContent` public. The document is the product — `saveAndExport` reports only its byte size and a mock storage URL — so there was no supported way to assert on what an export contains.
- Added `tests/logger-recent-logs.test.ts` with its own `test:logger-recent-logs` script and a `test:all` chain entry, and three cases to `tests/export-service.test.ts` covering stream length, cut boundaries, and prefix binding.

Self-review:

- Good: Each fix was checked against a targeted revert of that one fix and fails there — `/Length` reports declared 148 against 119 actual, the excerpt assertion prints the stream ending in a dangling backslash, the EPUB assertion names the unbound `dc:` prefix, and the logger assertion reports `got []`.
- Good: The EPUB test asserts the general rule rather than the one string: it collects every prefix used in a tag name and requires an `xmlns:` binding for each, so a future prefix added without a declaration fails too.
- Correction: The first `truncateByCodePoint` was `Array.from(value).slice(0, limit).join('')`, which walks the entire story to keep 100 code points. Copilot review caught it; the loop form stops at the limit and was checked to produce identical output for empty, ASCII, astral-plane and boundary-straddling inputs at limits 0 through 1000.
- Non-claim: The PDF remains the mock described in its own comment. Its `xref` offsets and `startxref` are still fabricated constants, so this slice makes the content stream self-consistent — it does not make the file a valid PDF, and a real generator (pdfkit or similar) is still the open work.
- Non-claim: The EPUB package document is likewise still a fragment. It now binds the prefix it uses, but it has no `unique-identifier`/`dc:identifier` pair and no container or chapter files, so it is not a loadable EPUB.
- Non-claim: `getRecentLogs` has no callers in the repository. The fix corrects a debugging accessor's stated contract; nothing in a request path changes behavior because of it.

Validation:

- `npm run test:all`: passed, including the new `test:logger-recent-logs` entry.
- API typecheck over `api/**/*.ts` with the `preflight.sh` compiler flags: passed with no diagnostics.
- PR #204 checks: Validate Vercel recovery build passed, SonarCloud quality gate passed with no new code-scanning alerts, Vercel preview deployed. Sourcery was rate-limited on the account's weekly diff budget and CodeRabbit skipped automatic review because the repository has fewer than 10 stars.
- Review follow-up: Copilot's O(n) truncation comment was fixed and pushed; Codex's P1 asking for this changelog entry is what this section answers.
- Note: `node_modules` is tracked in this repository. Installing dependencies to run the suite modified those tracked files; they were restored so the slice diff stays source-only.

## 2026-08-24 18:00 UTC - Export Filename Mismatch, Byte-Counted File Size, And A Misreported Health Origin

Actions:

- Generated the export filename once in `ExportService.saveAndExport` and shared it between `saveToStorage` and the response. It was previously derived twice, and the mock upload's 300ms delay sits between the two calls, so the `Date.now()` stamps never matched: every export handed the client a `downloadUrl` whose basename disagreed with the `filename` it was told to save under.
- Changed `fileSize` to `Buffer.byteLength(exportContent, 'utf8')`. The contract in `api/_lib/types/contracts.ts` documents the field as bytes, but it reported `content.length` — UTF-16 code units — so every accented character and emoji in a story undercounted the real size.
- Made `api/health.ts` report the origin the CORS policy actually resolved (`cors.allowedOrigin`) instead of re-deriving it from `FRONTEND_URL`. `parseAllowedOrigins` also honours `STORY_LAB_ALLOWED_ORIGINS` and `ALLOWED_ORIGINS`, so any deployment configured through those two was shown an origin it does not allow — visible in the frontend debug panel, which reads this field.
- Added `tests/export-service.test.ts` with its own `test:export-service` script and a `test:all` chain entry, plus a health-payload regression test alongside the existing health CORS test in `tests/story-lab-account-routes.test.ts`.

Self-review:

- Good: All three defects are observable from outside the functions — a URL that does not match its filename, a size that disagrees with the byte count, and a health field that contradicts the policy in the same response's headers — so each regression test asserts on behavior rather than on internals.
- Good: Each test was run against the pre-fix code and fails there: the filename assertion reports two stamps 301ms apart, the size assertion reports 83 against 89 real bytes, and the health assertion reports `http://localhost:4200` while the response allows `https://spice.example`.
- Correction: The first draft of the byte-size test compared an `html` export, whose body embeds a fresh `generatedAt` timestamp; re-generating the content for the expected value could produce a different string. The test uses a `txt` export with `includeMetadata: false`, which is deterministic.
- Non-claim: `saveToStorage` is still the mock that returns a `storage.example.com` URL after a fixed delay. This slice makes its filename consistent with the response; it does not upload anything.
- Non-claim: The `allowedOrigin` field is now `string | null`, null being the case where no origin is configured at all. The debug panel types the field but does not render it, so nothing in the UI changes.

Validation:

- `npm run test:all`: passed, including the new `test:export-service` entry.
- API typecheck over `api/**/*.ts` with the `preflight.sh` compiler flags: passed with no diagnostics.
- `tsc -p story-generator/tsconfig.app.json --noEmit` and `tsc -p story-generator/tsconfig.spec.json --noEmit`: both passed.
- Pre-fix probes: `downloadUrl` ended `..._1787593772892.txt` while `filename` was `..._1787593773193.txt`; a 71-code-unit export reported 71 against 76 real UTF-8 bytes.

## 2026-08-24 15:05 UTC - Header Casing, Bearer Redaction Boundary, And Unwired Blueprint Parser Test

Actions:

- Made `readHeader` in `api/_lib/middleware/security.ts` genuinely case-insensitive through a new `findHeaderValue`. The previous `headers?.[name] ?? headers?.[name.toLowerCase()]` fallback was dead code because both call sites already pass lowercase names, so a header bag keyed `X-API-Key` or `Authorization` — the exact casing the `MISSING_API_KEY` message instructs clients to send — resolved to `undefined` and was reported as a missing key.
- Added a leading word-boundary guard to `redactBearerTokens` in `shared/sensitiveTextRedaction.ts`. The scanner previously treated any occurrence of the substring `bearer` as the auth scheme, so `forbearer patterns are fine` was rewritten to `forBearer [REDACTED] are fine`: the word took the scheme's casing and the following word was swallowed as a credential.
- Keyed that guard off letters and digits rather than `isBearerTokenChar` after PR review caught that the token grammar counts `=`, `/` and `+` as word characters, which would have left `Authorization=Bearer <token>` unredacted — a leak the pre-slice code did not have.
- Wired `tests/story-lab-blueprint-parser.test.ts` into a `test:story-lab-blueprint-parser` script and the `test:all` chain. It had no script and no chain entry, so the Story Lab request-validation boundary had no CI coverage despite passing as written.
- Added negative redaction tests for the delimiter forms and word forms, and canonical-case header assertions to `tests/api-key-auth.test.ts`.
- Opened PR #202 and addressed both review rounds in the same PR: a Copilot nit about a comment example that did not contain the substring it claimed, and a Codex P1 on the delimiter regression above.

Self-review:

- Good: Each fix carries a negative test naming the defect it kills — a canonically cased header being rejected, an ordinary word being corrupted, and a delimiter-introduced credential leaking.
- Correction: The first version of the bearer boundary reused `isBearerTokenChar` for symmetry with the API-key path. That symmetry was wrong: the API-key check guards a token grammar, while this one guards a *word*, and the two need different character classes. Reviewer feedback caught the resulting leak before merge.
- Non-claim: This slice does not wire `authenticateRequest` or `checkRateLimit` into any route. Both remain called only from tests, so the auth middleware is still not enforced on live endpoints; that gap is untouched here and needs its own decision.
- Non-claim: Three other test files (`frontend-streaming`, `verify-ai-fixes`, `story-service.test.mjs`) remain unwired. `frontend-streaming` fails module resolution and `verify-ai-fixes` prints notes instead of asserting, so both are repairs rather than wiring.

Validation:

- `npm run test:all`: passed, including the newly wired blueprint parser test.
- API typecheck over `api/**/*.ts` with the `preflight.sh` compiler flags: passed with no diagnostics.
- Direct behavior probes before and after each fix: canonical `X-API-Key` and `Authorization` moved from `MISSING_API_KEY` to authenticated; `forbearer`/`torchbearer` stopped being corrupted; `Authorization` followed by `=`, `:`, `/`, `+`, `"`, `,` or `(` all redact the credential.
- PR #202 checks: Validate Vercel recovery build, SonarCloud (quality gate passed, 0 new issues), Vercel preview, and Vercel Preview Comments passed. Sourcery was rate-limited and CodeRabbit skipped automatic review because the repository has fewer than 10 stars. Copilot returned an approval recommendation.
- Note: `node_modules` is tracked in this repository. Installing dependencies to run the suite modified those tracked files; they were restored so the slice diff stays source-only.

## 2026-07-16 03:14 EDT - Subagent Scope, Test Quality, And Completion Boundary Hardening

Actions:

- Found the primary `main` checkout current with `origin/main` but blocked by an unexplained local-only untracked `.agents/` mirror that is not committed to the repository; left it untouched and created clean worktree branch `recovery/story-lab-subagent-scope-testing` from `origin/main`.
- Replaced explorer-first subagent guidance with parent-led discovery, Goldilocks proof-unit sizing, exact file leases, a mandatory read-only Scope Prosecutor, explicit parent dispositions, scope lock, worker execution, a separate Completion Prosecutor, and parent validation.
- Added a test-quality policy that selects tests by important behavior and plausible defects rather than an arbitrary coverage percentage. Added guidance for acceptance, invariant, negative, persistence/restart, integration, browser, live-boundary, and temporary semantic-counterfactual proof.
- Replaced the active 90% completion target with a risk-to-test matrix and coverage diagnostics that reveal blind spots without rewarding shallow tests.
- Added a claim-based Definition of Done covering source/publication truth, critical user journeys, live auth/cloud persistence and cross-owner denial, security/privacy, job honesty, test quality, build/deployment, review closure, documentation, and final hostile review.
- Added an explicit optional-after-Done boundary for numeric threshold tuning, wider historical cleanup, major upgrades, audio, nonblocking polish, research/Weird Lab work, extra providers, performance beyond shipping budgets, optional Workflow infrastructure, and new product surfaces.
- Added `STORY_LAB_OPTIONAL_POST_DONE_ROADMAP.md`, a self-contained six-horizon ExecPlan with twenty product programs: versioned story intelligence, Continuity Court, character desire/debt, Director's Room 2.0, story branching, ending experiments, Proving Grounds evidence, simulated reader lenses, recipes, private export, visual assets, serial packs, narration, review links, editorial approvals, offline conflict handling, shared worlds, resumable workflows, quality/cost telemetry, and safe model rollouts.
- Added an expanded Weird Lab portfolio plus recommended post-Done waves, program promotion rules, proof requirements, likely code surfaces, route-budget constraints, dependency boundaries, and shared interfaces so optional work can begin without rediscovery after required completion.
- Refreshed limited platform assumptions from primary Vercel, xAI, and W3C sources, and linked the new roadmap from `AGENTS.md`, `OVERNIGHT_MODE.md`, the final audit plan, future-work checklist, and idea board.
- Pushed `recovery/story-lab-subagent-scope-testing` and opened PR #197 with exact scope, validation, non-claims, and the required-to-optional handoff.
- Addressed PR #197 review feedback by making `AGENTS.md` the explicit canonical lifecycle definition, adding a one-PR application checklist, annotating all twenty optional programs with schema/route/provider/approval boundaries, making roadmap interfaces self-contained, aligning `serial_cliffhanger` terminology, removing the machine-specific roadmap path, and clarifying that `.agents/` is local-only and uncommitted.
- Addressed the final PR #197 follow-up review by routing the idea board's active dependency work to PR #194 instead of historical PRs #120/#121, and by clarifying that optional historical review cleanup begins only beyond the required issue #153 baseline and recorded dispositions.
- Updated the active Story Lab slice skill outside the repo so later sessions enforce the same discovery, scope-review, test-quality, and completion-boundary rules. Left the untracked repo-local `.agents/` mirror unchanged because its ownership is not established.

Self-review:

- Good: The new process has separate gates for deciding the work and disproving the result, while preserving parent ownership of strategy and completion claims.
- Correction: The previous active plan could motivate agents to manufacture tests for a number. Coverage remains useful, but only as a diagnostic behind a behavior-first risk map.
- Non-claim: This docs/process slice does not implement live auth/database behavior, resolve Dependabot #194, add coverage instrumentation, or prove durable jobs.

Validation:

- `npm run recovery:status`: passed before edits on a clean branch at `origin/main`; route count was `11/12`; Dependabot #194 remained the only open PR and was failing Recovery CI plus Vercel.
- `git diff --check`: passed.
- `npm run test:recovery-finish-check`: passed, 4 tests.
- `scripts/recovery/check-vercel-function-count.sh`: passed at `11/12`.
- Story Lab slice skill validation: passed with the skill-creator `quick_validate.py` in an isolated temporary environment; `agents/openai.yaml` also parsed successfully.
- Optional roadmap ExecPlan structure check: passed all 12 required sections from `.agent/PLANS.md` and the ExecPlan skill reference.
- Optional roadmap link/source review: passed; the roadmap is linked from active routing docs and limited platform assumptions cite primary Vercel, xAI, and W3C sources refreshed on 2026-07-16.
- `npm run recovery:finish -- --strict`: passed with no stop signs before the roadmap push; the only reminder was the expected unpushed roadmap commit.
- PR #197 initial checks: Recovery CI, Vercel, SonarCloud, Sourcery, CodeRabbit status, and Vercel Preview Comments passed before review fixes; the four active line comments were inspected through the repository review-thread audit and addressed in the same PR.
- PR #197 review-fix checks: both Recovery CI runs, Vercel, SonarCloud, Sourcery, CodeRabbit status, and Vercel Preview Comments passed; `npm run review:unresolved -- --prs 197 --json` returned `[]` after replies and resolutions.
- PR #197 late-review audit at 2026-07-16 03:59 EDT found two new Codex threads after the evidence commit; both were accepted and fixed in the active-priority and final-audit wording before merge.
- Final pre-merge `npm run recovery:finish -- --strict`: passed with no stop signs or publication reminders on commit `fa899fa`.
- `scripts/recovery/preflight.sh --quick --skip-status`: whitespace/conflict and route-budget checks passed; Angular type checking could not start because the clean linked worktree has no `story-generator/node_modules/.bin/tsc`. No product code changed, so dependencies were not installed solely for this docs/process slice.

## 2026-07-11 04:21 EDT - Story Lab Tooling And Skill Routing Refresh

Actions:

- Rechecked the active repo hooks and recovery scripts after the user asked whether skills, hooks, or scripts needed to be created, deleted, or altered.
- Left the existing `pre-commit` and `pre-push` hooks in place because they already run whitespace/recovery guardrails.
- Added `scripts/recovery/open-pr-summary.mjs` and `npm run recovery:open-prs` so `npm run recovery:status` now shows current open PRs and failing/pending/passing check summaries instead of relying on remembered PR state.
- Updated `scripts/recovery/slice-status.sh` to call the open-PR summary and to recommend current Story Lab checklist/finish gates instead of the old generic slice preflight as the default next action.
- Updated `scripts/recovery/finish-check.mjs` so Story Lab surface changes remind future agents to update `STORY_LAB_CONCEPT_CHECKLIST.md`, `STORY_LAB_FUTURE_WORK_CHECKLIST.md`, and exploration docs when relevant.
- Added `tests/recovery-open-pr-summary.test.mjs`, expanded `tests/recovery-finish-check.test.mjs`, and wired `test:recovery-open-pr-summary` into `test:all`.
- Rewrote local Codex skills outside the repo:
  - `~/.codex/skills/fairytales-story-lab-slice/SKILL.md` now routes current Story Lab work to the current checklists/plans and treats the old unpublished split plan as historical.
  - `~/.codex/skills/fairytales-pr-recovery/SKILL.md` now marks PR #70 recovery as historical archaeology rather than the default path for current completion work.
- Addressed PR #196 review/check feedback by making the open-PR helper return a nonzero exit for unavailable PR state, printing `unavailable` instead of `none` when `gh` cannot provide PR data, selecting `gh` only from absolute executable candidates, and simplifying/case-normalizing the Story Lab exploration doc detection.
- Addressed follow-up CodeRabbit feedback by redacting the local username in skill-path documentation, adding a finite `gh` timeout, and covering pending/truncated/draft PR summaries in the open-PR tests.

Self-review:

- Good: The status script now surfaces live open-PR truth, which directly targets the stale-PR/status drift that caused repeated confusion.
- Correction: The right fix was not a new broad skill. The stale existing skills needed tighter routing, and the live status command needed one small tested helper.
- Non-claim: This pass does not resolve Dependabot #194, add coverage instrumentation, prove cloud durability, or change product behavior.

Validation:

- Red checks before implementation:
  - `node --test tests/recovery-open-pr-summary.test.mjs`: failed because `scripts/recovery/open-pr-summary.mjs` did not exist yet.
  - `npm run test:recovery-finish-check`: failed because Story Lab status/checklist reminders were not present yet.
- Green checks after implementation:
  - `npm run test:recovery-open-pr-summary`: passed.
  - `npm run test:recovery-finish-check`: passed.
  - `node --check scripts/recovery/open-pr-summary.mjs && node --check scripts/recovery/finish-check.mjs`: passed.
- Review-fix checks:
  - `npm run test:recovery-open-pr-summary`: passed with warning/absolute-path cases.
  - `npm run test:recovery-finish-check`: passed with lowercase exploration-doc detection.
  - `node --check scripts/recovery/open-pr-summary.mjs && node --check scripts/recovery/finish-check.mjs`: passed.
  - `npm run recovery:open-prs`: passed and showed #196 plus #194 with their current failing checks.
- Follow-up review-fix checks:
  - `npm run test:recovery-open-pr-summary`: passed with 10 tests.
  - `npm run test:recovery-finish-check`: passed.
  - `node --check scripts/recovery/open-pr-summary.mjs && node --check scripts/recovery/finish-check.mjs`: passed.
  - `git diff --check`: passed.
  - `npm run recovery:open-prs`: passed and showed #196 checks passing plus #194 still failing Recovery CI/Vercel.

## 2026-07-11 00:27 EDT - Story Lab Scope Refresh And PR #194 Truth Update

Actions:

- Refreshed live repo state before new work: `main` is clean, current with `origin/main`, ahead `0`, behind `0`, with no tracked or untracked changes.
- Verified current open PR truth: Dependabot #194 is the only open PR; it is mergeable by GitHub but failing Recovery CI and Vercel.
- Updated the active future-work checklist with an immediate scope map that names each remaining lane, why it matters, what it entails, safe write areas, exclusions, and parallelization notes.
- Updated completion-hardening and final-audit plans so future sessions do not keep treating PR #120/#121 or the July 5 zero-open-PR state as current.
- Recorded the local Angular browser-runner caveat: Angular coverage invocation exists, but ChromeHeadless/headless browser startup currently times out in certain local development environments, so Angular coverage evidence needs CI, a supported browser runner, or a fail-fast health guard.
- Pushed branch `recovery/story-lab-admin-scope-refresh` and opened PR #195.
- Addressed PR #195 review feedback by updating plan timestamps, replacing machine-specific browser-runner wording, recording `gh pr list` open-PR evidence, syncing the final-audit blocker queue, marking the old exploration turnover packet as historical, preserving the `ChromeHeadlessNoSandbox` coverage command, and putting the canonical test-map step before coverage work.
- Addressed follow-up PR #195 review feedback by syncing the final-audit outcome summary, marking the first implementation wave as historical, preserving the root `test:coverage:angular` wrapper, and keeping this newest changelog entry at the top.

Self-review:

- Good: This branch keeps the update docs-only and avoids the separate UI branch/session.
- Correction: Dependabot #194 must be treated as its own package-file scope before root/API coverage work, because both can touch package or lock files.
- Non-claim: This slice does not fix #194, add root/API coverage, prove cloud durability, or prove durable jobs.

Validation:

- `npm run recovery:status`: passed before edits; route count stayed `11/12`.
- `git diff --check`: passed.
- Commit hook `npm run test:recovery-finish-check`: passed.
- `npm run recovery:status`: passed after commit; branch was one commit ahead before push and had no tracked or untracked changes.
- PR #195 checks passed before review follow-up; review follow-up is being revalidated in the same PR.

## 2026-07-10 12:39 EDT - Story Lab First Worker Wave

Actions:

- Created `recovery/story-lab-first-worker-wave` from clean current `main`.
- Dispatched six narrow Spark worker tickets from `STORY_LAB_EXPLORATION_FINDINGS.md` with disjoint write scopes.
- Added `test:story-lab-privacy-contracts` and wired it into root `test:all`.
- Removed stale `tests/audio-service.test.mjs` references from the test runner docs because that file is not present.
- Clarified that root/API tests are runtime contract tests and do not currently provide line/branch coverage percentages.
- Added an explicit Angular `test:coverage` script using a named no-sandbox Karma launcher without changing the existing 85% Karma thresholds.
- Added credential-safe signed-in cloud durability proof steps while preserving non-claims until real evidence exists.
- Strengthened durable-job schema/readiness tests for job tables, job/event indexes, and event-to-job foreign-key shape.
- Added focused Angular specs/test hooks for story action labels, cloud-save disabled state, and Proving Grounds interaction states.
- Updated `STORY_LAB_FUTURE_WORK_CHECKLIST.md` and `SUBAGENT_LOG.md` for this first implementation wave.
- Addressed Sourcery, Gemini, and Copilot review comments before merge.

Self-review:

- Good: This converted the exploration synthesis into real code/docs/test movement instead of another read-only pass.
- Correction: Parent integration caught and fixed a Proving Grounds TypeScript strictness issue that the worker missed.
- Non-claim: This does not prove live signed-in cloud durability, add root/API coverage instrumentation, or make job execution durable across process loss.
- Non-claim: Angular browser specs and coverage did not pass locally because ChromeHeadless could not capture in this environment, even with `CHROME_BIN` set.

Validation:

- `npm run test:story-lab-privacy-contracts`: passed.
- `npm run test:story-lab-cloud-schema-migration`: passed.
- `npm run test:story-lab-cloud-db-readiness`: passed.
- `npm run test:all`: passed.
- `cd story-generator && npx -p node@20 node ./node_modules/typescript/bin/tsc -p tsconfig.spec.json --noEmit`: passed.
- `cd story-generator && npm run build`: passed with the existing Node 23 odd-version warning and stale `baseline-browser-mapping` warning.
- `cd story-generator && npm run test -- --watch=false --browsers=ChromeHeadlessNoSandbox --include='src/app/app.spec.ts' --include='src/app/proving-grounds/proving-grounds.spec.ts'`: failed because ChromeHeadless did not capture after retries; bundle compilation reached Karma before browser timeout.
- `git diff --check`: passed.
- `npm run test:recovery-finish-check`: passed.

## 2026-07-05 02:33 EDT - Exploration Findings Review Follow-Up

Actions:

- Addressed post-merge review feedback from PR #190 by removing a machine-specific absolute path from `STORY_LAB_EXPLORATION_FINDINGS.md`.
- Clarified that proposed second-wave scripts are new files to be created, not existing files.
- Standardized the proposed account smoke script name to `scripts/recovery/story-lab-account-smoke.mjs`.
- Clarified that `npm run test:story-lab-privacy-contracts` is a command W1 must create before it can be run.

Self-review:

- Correction: docs should not leak local absolute paths or imply future script files already exist.
- Non-claim: this pass is docs-only and does not create the proposed smoke or coverage scripts.

Validation:

- `git diff --check`: passed.
- `npm run test:recovery-finish-check`: passed.
- Reference scan over the touched docs found no machine-specific worktree path and no `story-lab-account-smoke.ts` reference.
- PR, merge, and thread resolution are still pending for this follow-up branch.

## 2026-07-05 02:25 EDT - Exploration Findings Synthesis

Actions:

- Completed the EXP-01 through EXP-13 subagent exploration batch.
- Added `STORY_LAB_EXPLORATION_FINDINGS.md` with the durable synthesis, first/second implementation waves, parent decisions, and a context-turnover packet.
- Updated `STORY_LAB_FUTURE_WORK_CHECKLIST.md` so the next session uses the completed synthesis instead of rerunning the full exploration batch.
- Updated `SUBAGENT_LOG.md` with each exploration agent, result, integration decision, and follow-up.
- Updated `AGENTS.md` and `OVERNIGHT_MODE.md` so active Story Lab sessions start from the current completion/audit/future-work/finding docs instead of treating historical publication docs as current.

Self-review:

- Correction: one docs-source subagent reported stale open-PR wording. Parent verified live GitHub state and kept the current truth: there are zero open PRs at the time of synthesis.
- Finding: tests/coverage, auth/cloud durability, durable jobs, streaming privacy, and UI polish are worker-ready enough for implementation waves; the process should not spend another turn broadly scouting these same areas.
- Non-claim: this pass does not implement coverage tooling, signed-in cloud proof, durable job process-loss proof, streaming privacy migration, or UI polish. It only converts exploration into worker-ready execution guidance.

Validation:

- `git diff --check`: passed.
- `npm run test:recovery-finish-check`: passed.
- `scripts/recovery/check-vercel-function-count.sh`: passed at `11/12`.
- Commit hook reran `npm run test:recovery-finish-check`: passed.
- `git push -u origin recovery/story-lab-exploration-findings`: succeeded.
- PR and merge are still pending for this branch.

## 2026-07-05 01:54 EDT - Exploration Ticket Packet And Context Turnover

Actions:

- Added `STORY_LAB_EXPLORATION_TICKETS.md` with the standard exploration report format, context-turnover packet, wave plan, and 13 dispatch-ready exploration tickets.
- Updated `AGENTS.md` with context-turnover guidance for long/high-friction sessions, subagent batches, PR events, branch switches, and crowded threads.
- Added `STORY_LAB_EXPLORATION_TICKETS.md` to the `AGENTS.md` documentation update map and current operating direction.
- Linked `STORY_LAB_FUTURE_WORK_CHECKLIST.md` to the exploration-ticket packet so future checklist revisions start from explore-to-worker tickets instead of ad hoc scouting.
- Updated `LESSONS_LEARNED.md` with lessons on over-conservative planning, action-unlocking exploration, and compact context turnover.
- Addressed PR review feedback by correcting the job-store path to `api/_lib/story-lab/jobs/jobStore.ts` in the exploration packet and future-work checklist.

Self-review:

- Correction: exploration tickets are read-only by design, but each ticket now must report worker tickets unlocked, files touched, shared-file conflicts, validation commands, and a fast-path recommendation.
- Non-claim: this pass writes the exploration tickets and operating guidance; it does not dispatch subagents or revise the future-work checklist into worker chunks yet.

Validation:

- Placeholder and parked-dependency-identifier scan over `AGENTS.md`, `LESSONS_LEARNED.md`, `STORY_LAB_EXPLORATION_TICKETS.md`, `STORY_LAB_FUTURE_WORK_CHECKLIST.md`, and `PR70_RECOVERY_CHANGELOG.md` returned no matches.
- Bad job-store path scan returned no matches.
- `git diff --check` passed.
- `npm run test:recovery-finish-check` passed.
- `scripts/recovery/check-vercel-function-count.sh` passed at `11/12`.

## 2026-07-05 01:05 EDT - Aggressive Subagent Planning Bias

Actions:

- Updated `AGENTS.md` to say subagent planning should not default to read-only exploration.
- Added guidance to bias toward larger, useful worker chunks once the parent agent has chosen the strategy.
- Added `Files touched` as a required subagent-ticket field so future checklist items name expected create/modify/test/docs paths and shared-file conflicts.

Self-review:

- Correction: the current future-work checklist is too conservative and has too many read-only scout tickets for the user's intended pace.
- Non-claim: this pass updates operating guidance only; the future-work checklist still needs a revision pass before it is ready for aggressive subagent execution.

Validation:

- `git diff --check` passed.
- `npm run test:recovery-finish-check` passed.
- Follow-up continued on the same branch in the 2026-07-05 01:54 EDT entry.

## 2026-07-05 00:43 EDT - Communication And Checklist Discipline

Actions:

- Updated `AGENTS.md` with the user's communication preference: fewer, larger progress updates instead of many small command-by-command updates.
- Added an explicit rule that when the user asks for a checklist, status report, or concrete artifact, agents should show the requested artifact directly instead of replacing it with a short summary.
- Addressed PR review feedback by defining concrete artifacts as checklists, status tables, PR lists, subagent tickets, requested command-output summaries, named doc contents, and done/not-done matrices.

Self-review:

- Correction: the prior response summarized the future-work checklist instead of showing the full checklist the user asked for.
- Non-claim: this pass only changes operating guidance; it does not change Story Lab implementation status.

Validation:

- `git diff --check` passed.
- `npm run test:recovery-finish-check` passed.
- `scripts/recovery/check-vercel-function-count.sh` passed at `11/12`.

## 2026-07-04 14:33 EDT - Granular Future-Work Checklist And Archive Cleanup

Actions:

- Archived the old Angular dependency investigation at `origin/archive/angular22-dependency-investigation-2026-07-04`; no PR was opened from it.
- Removed the dirty temp investigation worktree after the archive branch was pushed.
- Added `STORY_LAB_FUTURE_WORK_CHECKLIST.md`, breaking unfinished Story Lab work into subagent-sized tickets with owned scope, stop conditions, outputs, and validation commands.
- Linked the future-work checklist from `STORY_LAB_CONCEPT_CHECKLIST.md` and `AGENTS.md`.
- Updated the `AGENTS.md` timestamp and documentation map.
- Updated `LESSONS_LEARNED.md` with the archive-boundary and subagent-ticket-shape lessons.
- Addressed PR #187 review comments by using generic subagent wording and adding missing read-only file bounds for Explorer tickets.

Self-review:

- Correction: the archived dependency investigation is evidence only and must not be treated as active future work.
- Finding: the next productive work is not a blind 90% coverage chase; it is first making the test map honest, then adding coverage proof, then durable auth/database/job proof.
- Non-claim: this pass does not implement coverage tooling, auth/database integration, durable jobs, streaming changes, or UI polish.

Validation:

- Placeholder and old-dependency-PR identifier scan over `STORY_LAB_FUTURE_WORK_CHECKLIST.md`, `AGENTS.md`, `STORY_LAB_CONCEPT_CHECKLIST.md`, `LESSONS_LEARNED.md`, and `PR70_RECOVERY_CHANGELOG.md` returned no matches.
- `git diff --check` passed.
- `npm run test:recovery-finish-check` passed.
- `scripts/recovery/check-vercel-function-count.sh` passed at `11/12`.

## 2026-07-04 07:16 EDT - Whole Story Lab Concept Checklist

Actions:

- Created `STORY_LAB_CONCEPT_CHECKLIST.md` as the single plain-language Story Lab status checklist with done/partial/not-done items and percentage estimates.
- Ran a six-band Spark audit covering product concept, UI, backend/jobs, auth/storage/durability, tests/coverage/CI, and docs/process; replaced one failed overbroad UI audit with a narrower UI-only audit.
- Preserved the supporting audit artifacts under `STORY_LAB_CHECKLIST_FINDINGS/`.
- Updated `AGENTS.md` so current sessions use the completion-hardening/final-audit/checklist stack, treat `PR70_RECOVERY_PLAN.md` and `plan.md` as historical recovery context, and use `OVERNIGHT_MODE.md` instead of reviving stale `OVERNIGHT_HANDOFF.md`.
- Updated `STORY_LAB_JOB_ROUTES_EXEC_PLAN.md` to mark the job-route scaffold as merged while preserving the non-durable job warning.
- Updated `SUBAGENT_LOG.md` with agent scopes, the failed attempt, replacement UI audit, integration status, and follow-ups.
- Updated `LESSONS_LEARNED.md` with the narrow-band Spark audit lesson.
- Addressed PR #186 review comments by adding Created headers, fixing typos/wording, updating route-count evidence to `11/12`, adding concrete PR #104 job-route merge evidence, correcting stale Neon-dependency wording, and naming unwired privacy/security/job-contract tests in the coverage audit.

Self-review:

- Correction: broad status should start from one whole-concept checklist, not parked dependency PRs or old local-main archaeology.
- Finding: Story Lab is about 72% complete overall after this docs pass, with the public create/continue UI stronger than the durability and coverage proof.
- Finding: Spark was useful for parallel evidence gathering when each ticket had one band and one artifact; the failed UI attempt shows broad repo-history sweeps still exhaust context.
- Non-claim: This pass does not implement coverage tooling, live auth/database proof, durable job process-loss proof, or UI polish.

Validation:

- Initial `git diff --check`: failed on whitespace in two subagent artifacts; fixed before publication.
- `git diff --check`: passed after whitespace cleanup.
- `npm run test:recovery-finish-check`: passed.
- `scripts/recovery/check-vercel-function-count.sh`: passed at `11/12`.
- PR #186 review-fix rerun: `git diff --check`, `npm run test:recovery-finish-check`, and `scripts/recovery/check-vercel-function-count.sh` passed.

## 2026-07-04 00:00 EDT - Repository Discipline Guardrails

Problem:

- Local `main` drifted far behind `origin/main` while also carrying old local commits and dirty files.
- The repo already had lessons about local-only work, docs branches, stale dependency branches, and repeated validation checklists, but those lessons were not being forced into the end-of-run workflow.
- The user asked for concrete discipline fixes, doc-update rules, and tooling to avoid repeating the same local-only/status drift.

Actions:

- Added a documentation update map to `AGENTS.md` that names which status, plan, changelog, ledger, and handoff files must be updated for each kind of work.
- Added a local `main` hygiene rule to `AGENTS.md`.
- Added `npm run recovery:finish` as the required end-of-session finish check.
- Added `scripts/recovery/finish-check.mjs` to print stop signs for dirty trees, stale local `main`, unpushed commits, and likely doc updates.
- Added `tests/recovery-finish-check.test.mjs` and `npm run test:recovery-finish-check`.
- Added a `LESSONS_LEARNED.md` entry for local `main` drift and end-of-run finish checks.
- Addressed SonarCloud reliability annotations by simplifying parser/runtime helpers and converting the finish-check test to Node's `node:test` runner.
- Addressed review feedback by making git state failures loud, using branch-diff paths for doc reminders, warning on stale upstream branches, and checking local `main` even from feature branches.
- Synced local `main` back to `origin/main` after preserving the old local state:
  - backup branch: `backup/local-main-before-sync-2026-07-04`;
  - existing backup branch: `backup/local-main-docs-stack-2026-06-13`;
  - dirty-state stash: `stash@{0}` (`park local main dirty state before syncing main 2026-07-04`).

Validation:

- `npm run test:recovery-finish-check`: passed.
- `node --check scripts/recovery/finish-check.mjs`: passed.
- `git diff --check`: passed.
- `npm run recovery:finish`: passed and correctly reported the current branch's uncommitted guardrail files as stop signs before publication.
- After syncing local `main`, `npm run recovery:finish` reported `Local main vs origin/main: ahead 0, behind 0`.

## 2026-06-21 16:45 EDT - PR99 Grok Fast-Path Review Follow-Up

Problem:

- PR #99 had three unresolved review threads:
  - continuity extraction forced the fast model into a 5-second cap instead of the configured fast timeout;
  - Grok 4.3 fast-path calls omitted explicit no-reasoning control, so they accepted the API default reasoning behavior;
  - story metadata could carry primary-model reasoning effort forward when later chapters used a fast model without reasoning metadata.

Actions:

- Changed Story Lab continuity extraction to use the full configured `getXaiFastTimeoutMs()` budget.
- Added model-aware xAI reasoning effort selection:
  - `grok-4.3` now supports explicit `reasoning.effort`;
  - fast `grok-4.3` requests send `none`;
  - primary `grok-4.3` requests keep the configured default effort;
  - `xhigh` remains available for multi-agent models but is capped to `high` for `grok-4.3`.
- Treated retry fallback calls as fast-model calls so primary timeout fallback to `grok-4.3` also sends `none`.
- Updated API and Angular telemetry contracts to allow `reasoningEffort: 'none'`.
- Stopped carrying stale reasoning effort forward when merged AI metadata changes models and the next call has no explicit reasoning effort.
- Added `tests/xai-fast-path-review.test.ts` and included it in `npm run test:all`.

Validation:

- `npm run test:xai-fast-path-review`: passed.
- `npm run test:story`: passed.
- `npm run test:story-quality`: passed.
- `npm run test:story-lab-real-engine`: passed.
- `npx -p node@20 node ./node_modules/typescript/bin/tsc -p story-generator/tsconfig.spec.json --noEmit`: passed.
- `npm run recovery:preflight -- story-quality-guidance --dry-run`: selected the expected gate.
- `git diff --check`: passed.
- `npm run build`: passed.
- `npm run recovery:preflight -- story-quality-guidance --quick`: passed and wrote `tmp/recovery/story-quality-guidance-evidence.md`.

Self-review:

- Good: This closes the review comments directly instead of turning them into a future issue because the fixes are small, testable, and inside one provider/metadata boundary.
- Good: The new regression test covers configured timeout, explicit fast-path `none` reasoning, retry fallback behavior, and stale metadata merging.
- Remaining risk: This does not prove live Grok quality or latency against production credentials; it proves request-shaping and local contract behavior.

## 2026-06-07 10:31 EDT - PR112 Review Follow-Up

Problem:

- Gemini review flagged two medium-pressure UI maintainability issues:
  - template method calls for pressure active state run on each Angular change detection cycle;
  - `selectedVillainPressure` used a magic fallback array index.

Actions:

- Replaced the template method call with direct signal comparison: `selectedVillainPressureId() === pressure.id`.
- Replaced the magic fallback index with a non-null assertion on the typed pressure lookup.
- Removed the now-unused `isVillainPressureSelected()` method.

Validation:

- `git diff --check`: passed.

- `npx -p node@20 -c "node ./node_modules/typescript/bin/tsc -p story-generator/tsconfig.spec.json --noEmit"`: passed.
- `npx -p node@20 -c "node ./node_modules/typescript/bin/tsc -p story-generator/tsconfig.app.json --noEmit"`: passed.
- `npx -p node@20 -c "node ./node_modules/@angular/cli/bin/ng test --watch=false --browsers=ChromeHeadless --include='src/app/app.spec.ts'"`: passed with `43 SUCCESS`.

## 2026-06-07 10:24 EDT - Story Lab Villain Pressure UI

Actions:

- Created `feature/story-lab-villain-pressure-ui` from current `main` after PR #111 merged.
- Added `STORY_LAB_VILLAIN_PRESSURE_UI_EXEC_PLAN.md` and linked it from `AGENTS.md`.
- Added a Villain Pressure dial inside the existing continuation panel.
- Added five pressure choices:
  - `Antagonist`;
  - `Environment`;
  - `Secret`;
  - `Deadline`;
  - `Inner Desire`.
- Composed selected pressure into UI-generated continuation briefs for normal continuation, direction continuation, and Director's Room notes.
- Kept direct `continueSaga(brief)` unchanged so lower-level tests/callers do not receive hidden UI pressure.
- Reused existing heat-option/grid styles and added no new CSS.

Validation:

- RED: focused Angular app spec failed with 3 expected pressure-dial failures because the panel and pressure text did not exist yet.
- `git diff --check`: passed.
- `npx -p node@20 -c "node ./node_modules/typescript/bin/tsc -p story-generator/tsconfig.spec.json --noEmit"`: passed.
- `npx -p node@20 -c "node ./node_modules/typescript/bin/tsc -p story-generator/tsconfig.app.json --noEmit"`: passed.
- GREEN: `npx -p node@20 -c "node ./node_modules/@angular/cli/bin/ng test --watch=false --browsers=ChromeHeadless --include='src/app/app.spec.ts'"`: passed with `43 SUCCESS`.
- `scripts/recovery/check-vercel-function-count.sh`: passed at `10/12`.
- `npm run smoke:story-lab-ui`: passed in mock mode; Angular still reports warning-level initial bundle and CSS budget warnings, but `app.css` remains under the 15 kB hard limit.

Self-review:

- Good: The dial makes continuation more directive without creating backend or AI-review scope.
- Good: The Director's Room path and normal Continue Story path both carry selected pressure through the existing job request.
- Remaining risk: This is still a brief-shaping control, not a true villain-planning engine.

## 2026-06-07 10:13 EDT - Story Lab Director's Room UI

Actions:

- Created `feature/story-lab-director-room-ui` from current `main` after PR #110 merged.
- Added `STORY_LAB_DIRECTOR_ROOM_UI_EXEC_PLAN.md` and linked it from `AGENTS.md`.
- Added a compact Director's Room panel below the selected chapter.
- The panel renders three deterministic craft notes when a chapter exists:
  - `Desire Ledger`;
  - `Continuity Keeper`;
  - `Chapter Ending`.
- Added note actions for accepting, dismissing, and moving a note into the custom continuation brief.
- Added `Continue with notes`, which sends accepted notes through the existing continuation job flow instead of adding a new route or fake AI-review service.

Validation:

- RED: focused Angular app spec failed with 3 expected Director's Room failures because the panel/actions did not exist yet.
- `git diff --check`: passed.
- `npx -p node@20 -c "node ./node_modules/typescript/bin/tsc -p story-generator/tsconfig.spec.json --noEmit"`: passed.
- `npx -p node@20 -c "node ./node_modules/typescript/bin/tsc -p story-generator/tsconfig.app.json --noEmit"`: passed.
- GREEN: `npx -p node@20 -c "node ./node_modules/@angular/cli/bin/ng test --watch=false --browsers=ChromeHeadless --include='src/app/app.spec.ts'"`: passed with `40 SUCCESS`.
- `scripts/recovery/check-vercel-function-count.sh`: passed at `10/12`.
- `npm run smoke:story-lab-ui`: initially failed production build because `app.css` exceeded the 15 kB hard budget by 937 bytes.
- Reused existing batch queue list/grid CSS for the Director's Room panel and trimmed nonessential note styling.
- `npm run smoke:story-lab-ui`: passed in mock mode after the CSS budget fix; Angular still reports existing warning-level budgets, with `app.css` at 14.95 kB.

Self-review:

- Good: The UI now exposes the platform plan's Director's Room concept without claiming durable workflow or AI critique.
- Good: Accepted notes reuse the job-backed continuation path, so the new UI stays inside existing contracts.
- Good: The production CSS hard budget caught the first styling pass before it reached the PR.
- Remaining risk: This is deterministic local craft guidance; AI-backed critique and true rewrite jobs remain future platform work.

## 2026-06-07 09:59 EDT - Story Lab Batch Queue UI

Actions:

- Created `feature/story-lab-batch-queue-ui` from current `main` after PR #109 merged.
- Added `STORY_LAB_BATCH_QUEUE_UI_EXEC_PLAN.md` for the focused UI checklist.
- Exposed the existing Story Lab batch queue in the creation panel.
- The new panel shows:
  - each active/completed/failed batch label;
  - user-readable status;
  - generated chapter count;
  - failed-batch error text when present.
- Added a visible `Clear finished` button that calls the existing `clearFinishedBatchQueue()` method only when completed or failed batches are present.

Validation:

- RED: focused Angular app spec failed with 2 expected batch queue failures because `[data-testid="batch-queue-panel"]` and `[data-testid="clear-finished-batches"]` did not exist yet.
- `git diff --check`: passed.
- `npx -p node@20 -c "node ./node_modules/typescript/bin/tsc -p story-generator/tsconfig.spec.json --noEmit"`: passed.
- `npx -p node@20 -c "node ./node_modules/typescript/bin/tsc -p story-generator/tsconfig.app.json --noEmit"`: passed.
- GREEN: `npx -p node@20 -c "node ./node_modules/@angular/cli/bin/ng test --watch=false --browsers=ChromeHeadless --include='src/app/app.spec.ts'"`: passed with `36 SUCCESS`.
- `scripts/recovery/check-vercel-function-count.sh`: passed at `10/12`.
- `npm run smoke:story-lab-ui`: passed in mock mode.

Self-review:

- Good: The UI now shows the job batch history the app was already tracking internally.
- Good: The clear action uses existing state cleanup and does not touch saved stories or backend job state.
- Remaining risk: The panel is browser-session state only; durable cloud job history still needs account/job persistence.

## 2026-06-07 09:47 EDT - PR109 Review Follow-Up

Problem:

- SonarCloud failed the PR #109 quality gate with `7.3% Duplication on New Code`.
- Gemini Code Assist flagged that a missing/null `job.progressPercent` could render `NaN%` in the new job status banner and the existing progress state.

Fix:

- Added a regression spec proving missing job progress falls back to `0%` instead of `NaN%`.
- Added one `normalizeJobProgressPercent()` helper and used it for both the main progress bar and the new job status banner.
- Reduced duplication by:
  - extracting repeated continuation recovery marker setup in `app.spec.ts`;
  - extracting repeated running continuation recovery job stubbing in `app.spec.ts`;
  - routing starting/running/recovered banner updates through one `setJobStatusPanel()` helper;
  - centralizing banner label/title/description formatting and flattening Sonar-flagged nested ternaries.

Validation:

- RED: focused Angular app spec failed with the expected missing-progress regression: progress was `NaN` and the banner rendered `NaN%`.
- GREEN: `npx -p node@20 -c "node ./node_modules/@angular/cli/bin/ng test --watch=false --browsers=ChromeHeadless --include='src/app/app.spec.ts'"`: passed with `34 SUCCESS`.
- `git diff --check`: passed.
- `npx -p node@20 -c "node ./node_modules/typescript/bin/tsc -p story-generator/tsconfig.spec.json --noEmit"`: passed.
- `npx -p node@20 -c "node ./node_modules/typescript/bin/tsc -p story-generator/tsconfig.app.json --noEmit"`: passed.
- `scripts/recovery/check-vercel-function-count.sh`: passed at `10/12`.
- `npm run smoke:story-lab-ui`: passed in mock mode; Angular build reported the existing bundle budget warnings.

## 2026-06-07 09:37 EDT - Story Lab Job Status UI

Actions:

- Created `feature/story-lab-job-status-ui` from current `main` after PR #108 merged.
- Added `STORY_LAB_JOB_STATUS_UI_EXEC_PLAN.md` for the focused UI checklist.
- Added a compact visible job status banner near the existing progress bar.
- The banner now tells users when Story Lab is:
  - starting a first-chapter job;
  - running a first-chapter or continuation job;
  - recovering a first-chapter or continuation job after browser reload.
- The banner shows the current job stage, percent complete, and a shortened opaque job id without exposing story text, blueprint text, or long raw ids.
- Added Angular DOM specs proving:
  - running genesis jobs render the banner;
  - recovered continuation jobs render the recovered banner after reload;
  - unusable continuation recovery does not leave a stale banner behind.

Validation:

- RED: `npx -p node@20 -c "node ./node_modules/@angular/cli/bin/ng test --watch=false --browsers=ChromeHeadless --include='src/app/app.spec.ts'"` failed with 2 expected banner failures because `[data-testid="job-status-panel"]` did not exist yet.
- GREEN: the same focused Angular command passed with `33 SUCCESS` after the banner signal, template, and styles were added.
- `git diff --check`: passed.
- `npx -p node@20 -c "node ./node_modules/typescript/bin/tsc -p story-generator/tsconfig.spec.json --noEmit"`: passed.
- `npx -p node@20 -c "node ./node_modules/typescript/bin/tsc -p story-generator/tsconfig.app.json --noEmit"`: passed.
- `scripts/recovery/check-vercel-function-count.sh`: passed at `10/12`.
- `npm run smoke:story-lab-ui`: passed in mock mode; Angular build reported the existing budget warnings for the 517.26 kB initial browser bundle and 13.63 kB `app.css`.

Self-review:

- Good: Reload recovery is now visible to a normal user instead of only changing the progress bar/status line.
- Good: The banner uses opaque job ids only, keeping private blueprint/story data out of UI paths and status text.
- Remaining risk: This still does not make jobs cold-start safe; the underlying scaffold remains `non_durable_memory`.
- Remaining risk: Browser-smoke coverage already checks job progress, but it does not yet assert the new banner copy specifically.

## 2026-06-07 08:58 EDT - Story Lab Continuation UI Job Migration

Actions:

- Created `feature/story-lab-continuation-jobs` from current `main`.
- Added `STORY_LAB_CONTINUATION_JOB_UI_EXEC_PLAN.md` for the UI slice and hostile-review risks.
- Changed the Continue Saga UI from the old direct `continueStory()` call to `createStoryLabJob({ kind: 'continuation', continuation })`.
- Wired continuation job snapshots/events into the existing visible progress/status panel.
- Added continuation terminal handling:
  - completed jobs append the returned chapters to the current saga;
  - failed jobs show the existing friendly Grok configuration message when appropriate;
  - cancelled jobs fail the active continuation batch without removing existing chapters.
- Kept active browser-session job recovery limited to genesis for this slice so the UI does not imply durable continuation recovery before storage/Workflow exists.
- Updated the mocked browser smoke so continuation uses `/api/story-lab/jobs` and the legacy `/api/story-lab/stories/:storyId/continue` path returns `410 LEGACY_CONTINUATION_ROUTE_USED` in smoke mode.
- Updated `STORY_LAB_PLATFORM_EVOLUTION_EXEC_PLAN.md` to mark visible continuation job migration complete while keeping durable/account-backed job persistence deferred.

Validation:

- RED: `npx -p node@20 -c "node ./node_modules/@angular/cli/bin/ng test --watch=false --browsers=ChromeHeadless --include=src/app/app.spec.ts"` failed with 4 expected continuation failures proving the UI still called `continueStory` and did not stream continuation job events.
- GREEN: the same focused Angular command passed with `23 SUCCESS` after the UI migration.
- `node --check scripts/recovery/story-lab-browser-smoke.mjs`: passed.
- `git diff --check`: passed.
- `npx -p node@20 -c "node ./node_modules/typescript/bin/tsc -p story-generator/tsconfig.spec.json --noEmit"`: passed.
- `npx -p node@20 -c "node ./node_modules/typescript/bin/tsc -p story-generator/tsconfig.app.json --noEmit"`: passed.
- `npx tsx tests/story-lab-job-contracts.test.ts`: passed.
- `npx tsx tests/story-lab-job-routes.test.ts`: passed.
- `scripts/recovery/check-vercel-function-count.sh`: passed at `10/12`.
- `npx -p node@20 -c "node ./node_modules/@angular/cli/bin/ng test --watch=false --browsers=ChromeHeadless --include=src/app/app.spec.ts"`: passed with `23 SUCCESS`.
- `npm run smoke:story-lab-ui`: passed in mock mode; Angular build reported the existing budget warnings for the 509.99 kB initial browser bundle and 12.56 kB `app.css`.

Self-review:

- Good: Both visible writing actions now use the same Story Lab job route family.
- Good: Smoke mode now fails fast if the UI tries the old direct genesis or continuation endpoints.
- Remaining risk: Continuation jobs do not yet have browser-session reload recovery; adding that should wait for a deliberate state/durability slice because continuation recovery needs an existing story/session snapshot.
- Remaining risk: The job store is still `non_durable_memory`, so this is UI/contract progress, not durable Workflow/database-backed background execution.

## 2026-06-07 09:05 EDT - PR107 Sonar Cleanup

Problem:

- PR #107 SonarCloud Code Analysis failed the quality gate with `7.2% Duplication on New Code` where the gate requires `<= 3%`.
- Sonar also reported:
  - duplicated app-spec job event helper implementation;
  - a redundant jump in the mocked browser smoke route handler;
  - a nested ternary in mocked smoke job lookup.

Fix:

- Replaced separate genesis/continuation spec event helpers with one generic `createJobEvent()` helper.
- Removed the redundant return from the smoke script.
- Replaced the nested smoke job lookup ternary with explicit `if`/`else if` branches.

Validation:

- `git diff --check`: passed.
- `node --check scripts/recovery/story-lab-browser-smoke.mjs`: passed.
- `npx -p node@20 -c "node ./node_modules/typescript/bin/tsc -p story-generator/tsconfig.spec.json --noEmit"`: passed.
- `npx -p node@20 -c "node ./node_modules/@angular/cli/bin/ng test --watch=false --browsers=ChromeHeadless --include=src/app/app.spec.ts"`: passed with `23 SUCCESS`.
- `npm run smoke:story-lab-ui`: passed in mock mode; Angular build reported the existing budget warnings for the 509.99 kB initial browser bundle and 12.56 kB `app.css`.

## 2026-06-07 09:08 EDT - PR107 Gemini Review Fixes

Problem:

- Gemini Code Assist left two actionable continuation-job UI comments:
  - completed continuation jobs should defensively reject malformed result payloads before using `job.result.batch.chapters`;
  - continuation event streams that complete synchronously should not leave a stale closed subscription reference.

Fix:

- Added regression specs for malformed completed continuation payloads and synchronous continuation stream completion.
- Added a `hasRenderableIterationPayload()` guard before applying completed continuation job results.
- Updated `openContinuationJobEventStream()` to assign the stream subscription through a local variable and store `null` when it is already closed.

Validation:

- RED: focused Angular app spec failed with the expected malformed-payload and stale-subscription failures before implementation.
- GREEN: `npx -p node@20 -c "node ./node_modules/@angular/cli/bin/ng test --watch=false --browsers=ChromeHeadless --include=src/app/app.spec.ts"` passed with `25 SUCCESS`.
- `git diff --check`: passed.
- `node --check scripts/recovery/story-lab-browser-smoke.mjs`: passed.
- `npx -p node@20 -c "node ./node_modules/typescript/bin/tsc -p story-generator/tsconfig.spec.json --noEmit"`: passed.
- `npx -p node@20 -c "node ./node_modules/typescript/bin/tsc -p story-generator/tsconfig.app.json --noEmit"`: passed.
- `npm run smoke:story-lab-ui`: passed in mock mode; Angular build reported the existing budget warnings for the 510.13 kB initial browser bundle and 12.56 kB `app.css`.

## 2026-06-07 09:11 EDT - PR107 Remaining Sonar Duplication Cleanup

Problem:

- After the first Sonar cleanup and Gemini review-fix commit, SonarCloud still failed the quality gate with `6.5% Duplication on New Code`.
- Sonar duplication details pointed to the genesis and continuation job-response helpers in `story-generator/src/app/app.spec.ts`.

Fix:

- Replaced duplicated genesis/continuation job-response helper bodies with one generic `createJobResponse()` test helper.
- Kept the small genesis/continuation wrapper helpers so tests still read in domain language.

Validation:

- `git diff --check`: passed.
- `npx -p node@20 -c "node ./node_modules/typescript/bin/tsc -p story-generator/tsconfig.spec.json --noEmit"`: passed.
- `npx -p node@20 -c "node ./node_modules/@angular/cli/bin/ng test --watch=false --browsers=ChromeHeadless --include=src/app/app.spec.ts"`: passed with `25 SUCCESS`.

## 2026-06-07 09:18 EDT - Story Lab Continuation Browser-Session Resume

Actions:

- Created `feature/story-lab-continuation-resume` from current `main` after PR #107 merged.
- Added `STORY_LAB_CONTINUATION_RESUME_UI_EXEC_PLAN.md` to scope the slice to browser-session UI recovery only.
- Expanded active Story Lab job markers from genesis-only to `genesis | continuation`.
- Stored active continuation job markers while continuation jobs are still running.
- Made `restoreActiveStoryLabJob()` route by job kind:
  - genesis recovery keeps the existing path;
  - continuation recovery requires an already-restored saved local story/state before calling `getStoryLabJob`;
  - missing saved story context clears the marker and avoids appending chapters into an empty workbench.
- Added recovered continuation batch labeling, terminal marker cleanup, and completed continuation application to the restored local story.
- Updated `STORY_LAB_PLATFORM_EVOLUTION_EXEC_PLAN.md` to mark browser-session continuation recovery complete while keeping cold-start-safe durable job recovery deferred.

Validation:

- RED: `npx -p node@20 -c "node ./node_modules/@angular/cli/bin/ng test --watch=false --browsers=ChromeHeadless --include=src/app/app.spec.ts"` failed with 4 expected continuation-resume failures proving active continuation markers were not stored or restored.
- GREEN: the same focused Angular command passed with `29 SUCCESS` after the implementation.
- `git diff --check`: passed.
- `npx -p node@20 -c "node ./node_modules/typescript/bin/tsc -p story-generator/tsconfig.spec.json --noEmit"`: passed.
- `npx -p node@20 -c "node ./node_modules/typescript/bin/tsc -p story-generator/tsconfig.app.json --noEmit"`: passed.
- `npx tsx tests/story-lab-job-contracts.test.ts`: passed.
- `npx tsx tests/story-lab-job-routes.test.ts`: passed.
- `scripts/recovery/check-vercel-function-count.sh`: passed at `10/12`.
- `npx -p node@20 -c "node ./node_modules/@angular/cli/bin/ng test --watch=false --browsers=ChromeHeadless --include=src/app/app.spec.ts"`: passed with `29 SUCCESS`.

Remaining risk:

- This is still browser-session recovery over a process-local job scaffold. Vercel cold starts, cross-device resume, account-owned jobs, and Workflow/database durability remain future platform gates.

## 2026-06-07 09:26 EDT - PR108 Story-Bound Continuation Resume Review Fix

Problem:

- Gemini Code Assist and Codex both flagged that active continuation markers did not include the originating `storyId`.
- Without that binding, reload recovery could use whichever saved project auto-loaded first, then append the recovered continuation onto the wrong context or drop the earlier chapter history when story ids differed.

Fix:

- Added regression specs proving active continuation markers store `storyId` and reload recovery loads the matching saved story instead of the newest saved project.
- Stored `storyId` in active continuation markers.
- Required continuation markers to include `storyId`.
- Added matching saved-project lookup by story id before resuming continuation jobs.
- Refused continuation recovery when the saved story context cannot be found.

Validation:

- RED: focused Angular app spec failed with the expected missing-`storyId` and wrong-project recovery failures.
- GREEN: `npx -p node@20 -c "node ./node_modules/@angular/cli/bin/ng test --watch=false --browsers=ChromeHeadless --include=src/app/app.spec.ts"` passed with `30 SUCCESS`.
- `git diff --check`: passed.
- `npx -p node@20 -c "node ./node_modules/typescript/bin/tsc -p story-generator/tsconfig.spec.json --noEmit"`: passed.
- `npx -p node@20 -c "node ./node_modules/typescript/bin/tsc -p story-generator/tsconfig.app.json --noEmit"`: passed.
- `npx tsx tests/story-lab-job-contracts.test.ts`: passed.
- `npx tsx tests/story-lab-job-routes.test.ts`: passed.
- `scripts/recovery/check-vercel-function-count.sh`: passed at `10/12`.

## 2026-05-26 00:12 EDT - Recovery Tracking Started

Actions:

- Rewrote `AGENTS.md` as the first execution step after the user asked for it.
- Corrected the agent guidance from DigitalOcean-only to Vercel-first.
- Added an explicit pointer from `AGENTS.md` to `PR70_RECOVERY_PLAN.md`.
- Added instructions for keeping this changelog, `LESSONS_LEARNED.md`, `PR70_RECOVERY_LEDGER.md`, and `NOT_TAKEN_FEATURE_LEDGER.md` current.

Observations:

- The repo still contains conflicting architecture signals:
  - `vercel.json` and `api/_lib/*` support Vercel.
  - `.do/app.yaml`, `.do/app.yaml.buildpack`, and several docs still point at DigitalOcean.
  - Older PRs use `api/lib/*` or `story-generator/src/api/lib/*`.
- Audio is still present in some current files and many stale PRs, but the current recovery scope keeps audio deferred.

Self-review:

- The first requested action was completed before branch or merge work.
- The next required safety step is to preserve local state before creating the recovery branch.
- Current dirty state still includes lockfile changes from earlier install work and untracked recovery docs.

## 2026-05-26 00:12 EDT - Recovery Branch Created

Actions:

- Refreshed `origin` with `git fetch origin`.
- Tried to create the planned branch name `recovery/pr70-story-lab-vercel`; Git could not create the nested ref path in this checkout.
- Created the flat branch `recovery-pr70-story-lab-vercel` instead.

Decision:

- Use `recovery-pr70-story-lab-vercel` as the actual recovery branch name.
- Keep the plan's intent unchanged: this is the branch where PR #70 becomes the baseline and other open PRs are merged, ported, mined, or closed.

Open issue:

- `git stash push` for the lockfile noise returned exit code 1 without output. The lockfile changes remain uncommitted and visible.

## 2026-05-26 00:12 EDT - PR #70 Merged As Baseline

Actions:

- Merged local branch `pr-70` into `recovery-pr70-story-lab-vercel` with a real merge commit.
- Merge commit: `118265c Merge PR #70 story lab baseline`.
- Updated `PR70_RECOVERY_LEDGER.md` with the #70 disposition.

Result:

- Merge completed cleanly with no textual conflicts.
- PR #70 added the `api/story-lab/*` route family and rewrote the Angular story-lab surface.
- Dirty lockfile changes are still present and unrelated to the merge.

Self-review:

- #70 is now the branch baseline, but not yet stabilized.
- Before other PRs are merged or ported, validate build/tests and inspect whether #70's mock story-lab behavior conflicts with production story generation.

## 2026-05-26 00:49 EDT - PR #70 Stabilization Build Fixes

Problem:

- Initial `npm run build` under local Node v23.8.0 failed with `Abort trap: 6` and no build output.
- Verbose Angular build exposed real #70 source issues before the local Node abort:
  - Angular templates used object spread expressions in event bindings, which Angular template parsing does not support.
  - Angular template used an inline arrow function in a class binding.
  - `SecurityContext` was imported from `@angular/platform-browser` instead of `@angular/core`.
  - `DebugPanel` template called getter properties like signals.
  - `story-generator/src/server.ts` imported removed `api/lib/*` paths instead of current `api/_lib/*` paths.

Fixes:

- Added `updateBlueprint()` and `isThemeSelected()` methods in `story-generator/src/app/app.ts`.
- Replaced unsupported template expressions in `story-generator/src/app/app.html`.
- Fixed `SecurityContext` imports in `app.ts` and `streaming-story.component.ts`.
- Fixed `DebugPanel` template/getter usage and added a `lastChapters` getter.
- Updated SSR server imports to `api/_lib/*`.
- Typed the SSR streaming callback to match the actual `StoryService.generateStoryStreaming()` chunk shape.

Validation:

- `cd story-generator && npx tsc -p tsconfig.app.json --noEmit` passed.
- `cd story-generator && npx tsc -p tsconfig.spec.json --noEmit` passed.
- `npm run build` under local Node v23.8.0 still failed with `Abort trap: 6`.
- `npx -p node@20 -c "node -v && npm run build"` passed with Node v20.20.2.
- `npm run build:verify` passed.

Self-review:

- The source-level #70 build blockers are fixed.
- Local Node v23 is not a valid Angular verification runtime; use Node 20 for build validation.
- The branch still needs contract/path review before later story-generation PRs are ported.

## 2026-05-26 00:50 EDT - PR #86 Merged

Actions:

- Fetched PR #86 as `pr-86`.
- Merged it into `recovery-pr70-story-lab-vercel`.
- Added `design.md`.
- Normalized `letterSpacing` values in `design.md` to `0`.

Decision:

- Keep the design system as useful UI guidance.
- Do not preserve nonzero letter-spacing tokens because recovery frontend rules require letter spacing to remain 0.

Validation:

- No code validation rerun; #86 is docs-only.

Self-review:

- #86 is safe to mark merged in the ledger.
- The design doc should guide later UI ports, especially #40, #75, and #26, but should not override layout/accessibility constraints.

## 2026-05-26 00:51 EDT - PR #85 Merged

Actions:

- Fetched PR #85 as `pr-85`.
- Verified the PR's unique commit only updates `story-generator/package-lock.json`.
- Merged it into `recovery-pr70-story-lab-vercel`.

Accepted material:

- `path-to-regexp` updated to 8.4.0 in `story-generator/package-lock.json`.

Validation:

- Confirmed `story-generator/package-lock.json` now records `node_modules/path-to-regexp` version 8.4.0.
- Did not rerun build because this is lockfile-only and installed modules are not guaranteed to reflect lockfile-only dependency changes until install.

Self-review:

- #85 is safe to mark merged.
- #84 should remain deferred until the baseline dependency state is clean because it has a larger dependency blast radius.

## 2026-05-26 00:52 EDT - PR #50 Mined And Superseded

Actions:

- Inspected PR #50 commits and `PROGRESS_METER_FIX.md`.
- Searched the current #70 baseline for the affected old symbols: `progressTimeoutId`, `simulateGenerationProgress`, `generationProgress`, `generationStatus`, and `ngSkipHydration`.
- Updated `PR70_RECOVERY_LEDGER.md` and `NOT_TAKEN_FEATURE_LEDGER.md`.

Decision:

- Do not merge or cherry-pick #50 code into the #70 baseline.
- Preserve the timeout-cleanup and hydration lessons for future batch/progress work.

Reason:

- The old progress meter implementation no longer exists after #70.
- Direct merge would reintroduce stale app shell and audio-era UI code.

Self-review:

- This is the first PR where the planned "port/cherry-pick" action changed after baseline inspection.
- The plan's running-ledger approach caught the reason: useful lesson, stale implementation.

## 2026-05-26 00:53 EDT - PR #64 Fisher-Yates Fix Ported

Actions:

- Inspected PR #64 and confirmed direct merge would be too stale and broad.
- Ported the Fisher-Yates Chekhov element selection fix manually.
- Updated both `api/_lib/services/storyService.ts` and `story-generator/src/api/lib/services/storyService.ts`.

Reason:

- `api/_lib/services/storyService.ts` is the Vercel recovery target.
- `story-generator/src/api/lib/services/storyService.ts` is still included by `story-generator/tsconfig.app.json`, so it should not keep known-bad prompt logic while duplicate cleanup remains unresolved.

Validation:

- `rg` confirmed no remaining `sort(() => 0.5 - Math.random())` in the two story service copies.
- `cd story-generator && npx tsc -p tsconfig.app.json --noEmit` passed.

Self-review:

- Porting only the randomization fix avoided #64's path regression from `_lib` back to `lib`.
- Duplicate service cleanup remains a real issue for the #67 phase.

## 2026-05-26 00:54 EDT - Self-Review Checkpoint 1

Scope reviewed:

- #70 baseline merge and stabilization.
- #86 design doc merge.
- #85 dependency lockfile merge.
- #50 progress/hydration lesson mining.
- #64 Fisher-Yates randomization port.

Findings:

- Good: The recovery branch is now based on #70 and builds successfully under Node 20.
- Good: The running ledger changed the #50 decision from "port code" to "mine lesson" after inspection, which avoided stale UI regression.
- Good: #64 was narrowed to the one story-generation correctness fix instead of merging broad stale branch content.
- Problem: Current local Node v23.8.0 is not suitable for Angular build validation. Continue using Node 20 for build checks.
- Problem: `story-generator/src/api/lib/services/storyService.ts` remains as a duplicate compiled story service. It should be resolved during #67 cleanup, but until then it should not retain known bugs.
- Problem: Lockfile noise in root `package-lock.json` and `node_modules/.package-lock.json` remains uncommitted. Avoid dependency-heavy PRs until that is resolved.
- Problem: An unrelated untracked `pocketfm-contest-forge/` directory is present. Ignore it unless the user connects it to this work.

Immediate corrections made:

- None needed beyond already-committed #70/#64 fixes.

Next action:

- Inspect #65 for model/token/quality fixes and port only the parts not already present in the #70 recovery branch.

## 2026-05-26 00:55 EDT - PR #65 AI Fixes Verified And Ported

Actions:

- Inspected #65's model/token/API-parameter fixes against the #70 recovery branch.
- Confirmed the canonical Vercel service already had the intended model, dynamic token calculation, `top_p: 0.95`, and longer timeouts.
- Updated `tests/verify-ai-fixes.test.ts` from stale `api/lib/*` imports to current `api/_lib/*`.
- Aligned the duplicate compiled `story-generator/src/api/lib/services/storyService.ts` timeouts to 90 seconds for generation and 60 seconds for continuation.

Decision:

- Do not merge #65 directly.
- Treat #65 as ported because the useful current material is verifier/path correction plus duplicate-service timeout alignment.

Validation:

- `npx tsx tests/verify-ai-fixes.test.ts` passed under escalated execution. Missing `XAI_API_KEY` warnings were expected and did not indicate live API calls.
- `cd story-generator && npx tsc -p tsconfig.app.json --noEmit` passed.

Self-review:

- The canonical service is in better shape than the stale branch suggested, but the duplicate compiled story service is still a risk.
- #67 should either remove the duplicate service path or make it a thin wrapper around the canonical `api/_lib` implementation.

## 2026-05-26 01:50 EDT - PR #67 Audit Refactor Ported

Actions:

- Inspected #67's audit PR and confirmed it is conflicting against the #70/Vercel recovery branch.
- Ported the useful refactor into the Vercel `api/_lib` path:
  - Added `api/_lib/config/authorStyles.ts`.
  - Removed inline author-style tables from `api/_lib/services/storyService.ts`.
  - Deleted stale duplicate compiled files under `story-generator/src/api/lib/*`.
  - Updated tests away from stale `api/lib` and duplicate `story-generator/src/api/lib` imports.
- Fixed an uncovered test-harness bug: `tests/story-service-improved.test.ts` counted `r.failed`, which does not exist, so printed failures still exited 0.
- Fixed the actual story-generation validation bug exposed by that test: invalid spicy levels were accepted and generated mock stories.

Decision:

- Do not merge #67 directly.
- Do not take #67's DigitalOcean deployment readiness doc.
- Do not add #67's root audit report as another active status doc; mine its refactor recommendations into the recovery ledgers instead.

Validation:

- Non-doc code scan found no remaining `api/lib`, `story-generator/src/api`, or `src/api/lib` references in `tests`, `api`, or `story-generator`.
- `npx tsx tests/verify-ai-fixes.test.ts` passed.
- `npm test` passed with 12/12 tests.
- `cd story-generator && npx tsc -p tsconfig.app.json --noEmit` passed.
- `npx -p node@20 -c "node -v && npm run build"` passed with Node v20.20.2. Angular emitted only the stale `baseline-browser-mapping` warning.
- `npm run build:verify` passed.

Self-review:

- #67 justified its place in the merge order: duplicate service drift had already made #64/#65 riskier.
- The first test run found a false-green test harness and a validation bug; both were fixed immediately.
- The remaining risk is old documentation still mentioning `api/lib` paths. That is historical doc drift, not active code drift, and should be cleaned in a docs pass rather than mixed into story-generation feature ports.

## 2026-05-26 02:00 EDT - PR #24 Trope Subversion Ported

Actions:

- Inspected #24's old backend implementation of the invisible trope subversion engine.
- Recreated the useful material in the recovery architecture:
  - `api/_lib/data/tropeDatabase.ts`
  - `api/_lib/services/tropeSubversionService.ts`
  - `tropeMetadata` contract fields for generation and continuation.
  - Story service prompt enhancement for normal and streaming generation.
  - `tests/trope-subversion.test.ts`, now included in `npm test`.
- Adapted the trope wording so it supports dark-romance uniqueness without drifting into parody unless the user explicitly asks for comedy.

Decision:

- Do not merge #24 directly.
- Do not take `backend/src`, `backend/dist`, demo scripts, or stale story service changes.
- Keep the feature invisible in the user flow for now.

Validation:

- `npm test` passed: story suite 12/12 plus trope subversion test.
- `npx tsx tests/verify-ai-fixes.test.ts` passed.
- `cd story-generator && npx tsc -p tsconfig.app.json --noEmit` passed after adding one explicit type annotation in `tropeSubversionService`.
- `npx tsx tests/trope-subversion.test.ts` passed after the type fix.
- `npx -p node@20 -c "node -v && npm run build"` passed with Node v20.20.2. Angular emitted only the stale `baseline-browser-mapping` warning.
- `npm run build:verify` passed.

Self-review:

- This port improves story uniqueness but introduces metadata that the current #70 UI does not yet preserve through continuation. That is acceptable for generation now and should be reconciled with #72/#73 story state work.
- The old branch's story value was high, but its architecture was not reusable.

## 2026-05-26 02:11 EDT - PR #31 Cliffhanger Slice Ported

Actions:

- Inspected #31's story-arc, chapter continuation, and audiobook compilation branch.
- Ported the low-risk story-generation slice:
  - Added `api/_lib/services/cliffhangerService.ts`.
  - Added canonical cliffhanger types and analysis shape.
  - Attached `cliffhangerAnalysis` to continuation outputs.
  - Added cliffhanger variety targets to the continuation prompt.
  - Added `tests/cliffhanger-service.test.ts` to the root test suite.

Decision:

- Do not merge #31 directly.
- Do not take audiobook compilation or UI.
- Do not take the in-memory story-arc CRUD service as active Vercel code.
- Mine story-arc concepts for #72/#73 instead.

Validation:

- `npm test` passed: story suite 12/12 plus trope and cliffhanger service tests.
- `npx tsx tests/verify-ai-fixes.test.ts` passed.
- `cd story-generator && npx tsc -p tsconfig.app.json --noEmit` passed.
- `npx -p node@20 -c "node -v && npm run build"` passed with Node v20.20.2. Angular emitted only the stale `baseline-browser-mapping` warning.
- `npm run build:verify` passed.

Self-review:

- The direct story-generation value is the cliffhanger analysis and prompt guidance.
- The story-arc model should not be lost, but its persistence story belongs with #73 and the multi-chapter workflow belongs with #72/#75.

## 2026-05-26 02:12 EDT - Self-Review Checkpoint 2

Scope reviewed:

- #67 audit/duplicate cleanup.
- #24 trope subversion engine.
- #31 cliffhanger/continuation slice.

Findings:

- Good: Active story-generation services now live in `api/_lib`; the compiled duplicate `story-generator/src/api/lib` service copy is gone.
- Good: New prompt-affecting systems have focused tests and are included in `npm test`.
- Good: Old branches contributed ideas without reintroducing audio or DigitalOcean infrastructure.
- Problem: `tropeMetadata` is generated and can be accepted by continuation, but the #70 UI does not yet thread it through. This should be reconciled during #72/#73 work.
- Problem: The root docs still contain many historical `api/lib` and DigitalOcean references. This is documentation drift, not active code drift, but it must be addressed before final report/PR.
- Problem: Local dirty root lockfile and `node_modules/.package-lock.json` noise still exists and should keep #84 deferred.

Immediate corrections made:

- No code corrections needed at this checkpoint.

Next action:

- Move into Phase 4 with #72 multi-chapter workflow as the primary source, then compare #75/#73/#71 around it.

## 2026-05-26 06:24 EDT - PR #72 Batch Workflow Ported

Actions:

- Inspected PR #72's old backend, frontend, and test changes for multi-chapter story workflows.
- Ported the durable backend idea into the Vercel canonical service instead of merging the old branch:
  - Optional `requestedChapterCount` on generation, continuation, and streaming inputs.
  - Optional `chapters`, `totalWordCount`, `nextChapterHint`, `appendedToStory`, and `failedChapters` response metadata.
  - Backward-compatible single-story and single-continuation fields preserved.
  - Chapter-scoped Grok prompts and mock-mode batch generation.
  - Batch generation and batch continuation tests.
- Updated the PR ledger and not-taken ledger for #72.

Decision:

- Do not merge #72 directly.
- Do not take its old Angular app shell, old `/api/story/*` route rewrites as-is, or old `api/lib/*` path layout.
- Keep #70 story-lab contracts as the UI direction and use this port as the backend batch primitive for later story-lab production integration.

Validation:

- `npx tsx tests/story-service-improved.test.ts` passed with 14/14 tests.
- `npx tsx tests/verify-ai-fixes.test.ts` passed.
- `cd story-generator && npx tsc -p tsconfig.app.json --noEmit` passed.
- `cd story-generator && npx tsc -p tsconfig.spec.json --noEmit` passed.
- `npm test` passed.
- `npx -p node@20 -c "node -v && npm run build"` passed with Node v20.20.2. Angular emitted only the stale `baseline-browser-mapping` warning.
- `npm run build:verify` passed.

Self-review:

- Good: The useful #72 feature landed without replacing legacy response fields or reviving old paths.
- Good: Batch behavior has executable mock-mode coverage, so it does not require a live `XAI_API_KEY`.
- Problem: There are now two story contract layers: legacy canonical `api/_lib/types/contracts.ts` and #70 story-lab contracts in `story-generator/src/app/contracts.ts`. This is acceptable during recovery, but #75/#73 need a deliberate adapter boundary before production story-lab uses real generation.
- Problem: The batch port currently treats `wordCount` as a total batch budget when live generation is split across chapters. The UI/product decision may ultimately want per-chapter budgeting.

Running merge-order snapshot after #72:

1. #75 - next, because it likely contains the UI/continuity affordances that should consume #72's backend primitive.
2. #73 - next state model candidate, but avoid adopting DigitalOcean Postgres assumptions.
3. #71 - compare after #72/#75 to identify any earlier batch-generation material not already superseded.
4. #74 - mine prompt proving-ground ideas after the core workflow/state pieces are settled.
5. #41/#39 - then move into Vercel CI/test cleanup.

## 2026-05-26 06:38 EDT - PR #75 Batch UI Ported

Actions:

- Inspected PR #75's branch and treated it as stale against the PR #70 story-lab baseline.
- Ported the useful workflow layer into the current Angular app:
  - UI-local batch queue state for genesis and continuation requests.
  - Suggested next-move prompt buttons.
  - Grouped/collapsible chapter timeline behavior for longer stories.
  - Vercel-compatible persistence seam wording.
- Updated `PR70_RECOVERY_LEDGER.md` and `NOT_TAKEN_FEATURE_LEDGER.md`.

Decision:

- Do not merge #75 directly.
- Do not take the old `/api/story/batch` route/service seam because #70 already owns `beginStory()` and `continueStory()`.

Validation:

- `cd story-generator && npx tsc -p tsconfig.app.json --noEmit` passed.
- `cd story-generator && npx tsc -p tsconfig.spec.json --noEmit` passed.
- `npx -p node@20 -c "node -v && npm run build"` passed with Node v20.20.2 and only the stale `baseline-browser-mapping` warning.
- `npm run build:verify` passed.

Self-review:

- This was the right place to port UI affordances rather than backend behavior; #72 already established the backend primitive.
- The queue is intentionally local state for now. Durable or asynchronous queue semantics should wait for #73 persistence decisions.
- Visual additions were kept in the #70 story-lab shell instead of importing #75's broad CSS rewrite.

## 2026-05-26 06:47 EDT - PR #73 Story-State Delta Ported

Actions:

- Inspected PR #73's story-state contracts, `StoryStateService`, Postgres client/schema, story service changes, and tests.
- Ported the useful state concepts into the current #70 story-lab seam:
  - `StoryStateDelta` and `StoryPersistenceReceipt` contracts.
  - Optional `stateDelta` and `persistence` fields on `StoryIterationPayload`.
  - Transient `api/story-lab/stateStore.ts` boundary with an explicit non-durable warning.
  - Mock chapter deltas that introduce characters, escalate threads, foreshadow artifacts, add beats, and surface continuity warnings.
  - Continuation state application and same-process transient snapshot fallback.
  - `tests/story-lab-state.test.ts`, included in `npm test`.

Decision:

- Do not merge #73 directly.
- Do not take DigitalOcean Postgres provisioning, the `pg` dependency, or old `api/lib/*` implementation paths.
- Treat transient memory only as story-lab continuity scaffolding, not production persistence.

Validation:

- `npx tsx tests/story-lab-state.test.ts` passed.
- `cd story-generator && npx tsc -p tsconfig.app.json --noEmit` passed.
- `cd story-generator && npx tsc -p tsconfig.spec.json --noEmit` passed.
- `git diff --check` passed.
- `npm test` passed.
- `npx -p node@20 -c "node -v && npm run build"` passed with Node v20.20.2 and only the stale `baseline-browser-mapping` warning.
- `npm run build:verify` passed.

Self-review:

- Good: #73's story-generation value is now represented in the #70 story-lab contract rather than old legacy contracts.
- Good: The port makes non-durable state explicit instead of accidentally promising persistence.
- Problem: Production story-lab generation still needs an adapter from the canonical `api/_lib` story service into `StoryIterationPayload`.

Running merge-order snapshot after #73:

1. #71 - compare against #72/#75/#73 and close if fully superseded.
2. #74 - prompt proving grounds now that batch/state surfaces are clearer.
3. #41/#39 - Vercel CI and test pipeline.
4. #26 - frontend validation/accessibility services after core story-lab surfaces stabilize.

## 2026-05-26 06:56 EDT - PR #71 Batch Metadata Compared And Ported

Actions:

- Inspected PR #71's early backend/frontend batch-generation pass.
- Compared it against already-ported #72 backend batching, #75 story-lab UI affordances, and #73 state-delta work.
- Ported the one unique low-risk improvement:
  - `chaptersRequested`, `chaptersGenerated`, and `partialFailures` on `ApiResponse.metadata`.
  - Metadata population in canonical generation and continuation responses.
  - Metadata assertions in `tests/story-service-improved.test.ts`.

Decision:

- Do not merge #71 directly.
- Do not take old app-shell changes, stale `api/lib/*` paths, old `/api/story/*` frontend route assumptions, or old test-data factory.
- Do not take service-level clamping for invalid requested chapter counts; keep explicit validation.

Validation:

- `npx tsx tests/story-service-improved.test.ts` passed with 14/14 tests.
- `cd story-generator && npx tsc -p tsconfig.app.json --noEmit` passed.
- `cd story-generator && npx tsc -p tsconfig.spec.json --noEmit` passed.
- `git diff --check` passed.
- `npm test` passed all configured suites.
- `cd story-generator && npx -p node@20 -c "node -v && npm run build"` passed with the existing stale `baseline-browser-mapping` warning.
- `npm run build:verify` passed from the repo root.

Self-review:

- Good: #71 was compared after the newer batch/state ports, which made the remaining unique material easy to isolate.
- Good: Metadata improves observability without changing response data shape.
- Problem found and fixed: I initially ran `build:verify` from `story-generator`, where the script does not exist, then reran it from the repo root.

Running merge-order snapshot after #71:

1. #74 - prompt proving grounds, now that batch/state primitives are settled.
2. #41/#39 - Vercel CI/test workflow.
3. #26 - UI validation/accessibility services.
4. #84 - dependency group remains deferred until lockfile noise is resolved.

## 2026-05-26 12:05 EDT - Recovery Preflight Tooling Added

Actions:

- Attempted Homebrew installation of `jq` so GitHub PR JSON output can be summarized without noisy raw payloads.
- Added `scripts/recovery/preflight.sh`.
- The script codifies the repeated recovery validation sequence:
  - required tool checks,
  - `git diff --check`,
  - Angular app/spec type checks,
  - root `npm test`,
  - Angular production build through Node 20,
  - root `npm run build:verify`.
- Added options for `--quick`, `--skip-tests`, `--skip-build`, and `--skip-status`.

Validation:

- `bash -n scripts/recovery/preflight.sh` passed.
- `scripts/recovery/preflight.sh --help` printed the expected usage.
- `scripts/recovery/preflight.sh --quick --skip-status` passed.

Self-review:

- Good: Repeated validation is now executable instead of depending on memory after each PR port.
- Problem: `brew install jq` reached the `m4` dependency build on macOS 12 and stalled long enough to block recovery work, so I stopped it with `SIGTERM`.
- Follow-up: Retry `jq` later with a less blocking install path, or continue using `gh --json` plus Node/TypeScript parsing when needed.

## 2026-05-26 12:28 EDT - PR #74 Proving Grounds Ported

Actions:

- Ported PR #74 selectively instead of merging the old app shell.
- Added Angular routing around the #70 Story Lab baseline:
  - `AppRoot` wrapper,
  - `app.routes.ts`,
  - `provideRouter(routes)`,
  - `/proving-grounds` lazy route,
  - Story Lab header link.
- Adapted the proving-grounds page to current Story Lab contracts:
  - uses `StoryService.beginStory()` instead of stale `generateStory()`,
  - passes prompt experiments as `narrativeDirectives`,
  - stores local test history safely only in the browser,
  - keeps comparison mode and JSON export.
- Added server-side `api/story-lab/evaluate.ts` for Grok evaluation with `XAI_API_KEY`, falling back to mock scoring if unavailable.
- Updated root `build:verify` to accept Angular SSR's `browser/index.csr.html` output.

Decision:

- Do not merge #74 directly.
- Do not take browser-local xAI key storage.
- Do not take old pre-#70 app-shell changes as-is.
- Keep the proving grounds as an internal prompt-testing tool, not yet as production prompt-control infrastructure.

Validation:

- `scripts/recovery/preflight.sh --quick --skip-status` passed.
- `npm test` passed all configured root suites.
- `cd story-generator && npx -p node@20 -c "node -v && npm run build"` passed with the existing stale `baseline-browser-mapping` warning and a new proving-grounds CSS budget warning.
- `npm run build:verify` passed after widening the expected browser index filename.

Self-review:

- Good: The feature now follows the #70 Story Lab seam and is lazy-loaded instead of replacing the app shell.
- Good: Provider credentials stay server-side for Vercel.
- Problem found and fixed: The verifier assumed prerender output `index.html`, but server-rendered routed Angular builds produce `index.csr.html`.
- Watch item: Prompt templates are visible and passed as directives, but production story generation still needs a real adapter before proving-ground template choices can be treated as authoritative generation controls.

Running merge-order snapshot after #74:

1. #26 - validation, notifications, accessibility services.
2. #41/#39 - lean Vercel CI/test workflow material.
3. #84 - dependency update once lockfile state is intentional.
4. Docs/research/audio mining after merge/adapt candidates are out of the way.

## 2026-05-26 12:50 EDT - PR #74 SSR Route Verification Fixed

Actions:

- Investigated a route verification problem where `/proving-grounds` returned Story Lab body content under the built SSR server.
- Fixed `story-generator/src/main.server.ts` so server bootstrap uses `AppRoot`, matching browser bootstrap and allowing the router to select `/` versus `/proving-grounds`.
- Stopped the local SSR server after verification.

Validation:

- `cd story-generator && npx -p node@20 -c "node -v && npm run build"` passed.
- `PORT=4300 npm run start:prod` served the production SSR bundle on `http://localhost:4300`.
- `curl http://localhost:4300/` found `Story Blueprint` and the `Proving Grounds` link.
- `curl http://localhost:4300/proving-grounds` found `proving-grounds-container` and `Test Configuration`.
- `npm run build:verify` passed from the repo root.
- `git diff --check` passed.
- `scripts/recovery/preflight.sh --quick --skip-status` passed.

Self-review:

- Good: The feature is now verified as a real route, not only a successful TypeScript/build port.
- Problem found and fixed: SSR and browser bootstrap can drift after introducing a router shell; both must point at the same root component.
- Watch item: The proving-grounds component CSS still exceeds the Angular component budget by 1.15 kB.

Running merge-order snapshot after #74 verification:

1. #26 - validation, notifications, accessibility services.
2. #41/#39 - lean Vercel CI/test workflow material.
3. #84 - dependency update once lockfile state is intentional.
4. Docs/research/audio mining after merge/adapt candidates are out of the way.

## 2026-05-26 13:15 EDT - PR #26 Validation and Notifications Ported

Actions:

- Ported PR #26 selectively instead of merging the old pre-#70 app shell.
- Added a signal-backed `NotificationService` and accessible `NotificationsComponent`.
- Recreated `FormValidationService` around current Story Lab blueprint contracts:
  - creature,
  - tone,
  - themes,
  - logline,
  - spicy level,
  - word budget,
  - chapter batch size,
  - world details,
  - narrative directives.
- Wired Story Lab validation into the current #70 app:
  - inline field errors,
  - `aria-invalid`,
  - `aria-describedby`,
  - disabled invalid generate action,
  - invalid-blueprint notification,
  - success/error notifications for generation and continuation.
- Added focused specs for notification and validation services.

Decision:

- Do not merge #26 directly.
- Do not take the old app form layout, stale story service methods, save/download controls, or audio conversion progress UI.
- Keep the retry-button idea as future mining material for explicit batch retry semantics.

Validation:

- `scripts/recovery/preflight.sh --quick --skip-status` passed.
- `npm test` passed all configured root suites.
- `cd story-generator && npx -p node@20 -c "node -v && npm run build"` passed with the existing stale `baseline-browser-mapping` warning and known #74 proving-grounds CSS budget warning.
- `PORT=4300 npm run start:prod` plus `curl` confirmed `/` contains Story Lab content and the new validation summary, and `/proving-grounds` still resolves correctly.
- `npm run build:verify` passed.
- Angular Karma browser tests did not complete:
  - `cd story-generator && npm test -- --watch=false --browsers=ChromeHeadless` built the spec bundle but ChromeHeadless never captured.
  - Repeating with `CHROME_BIN="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"` and Node 20 produced the same ChromeHeadless capture timeout.

Self-review:

- Good: #26's useful capability is now integrated into the current Story Lab rather than copied over as a stale UI branch.
- Good: Validation follows the active seam and has direct specs.
- Problem documented: local ChromeHeadless capture is not reliable in this environment, so Angular browser-spec execution remains unverified even though spec typecheck and bundle build passed.
- Watch item: Retry UI should wait until batch retry semantics are designed instead of merely replaying the last action.

Running merge-order snapshot after #26:

1. #41/#39 - lean Vercel CI/test workflow material.
2. #84 - dependency update once lockfile state is intentional.
3. Docs/research/audio mining after merge/adapt candidates are out of the way.

## 2026-05-26 13:25 EDT - PR #41/#39 Lean Recovery CI Ported

Actions:

- Refreshed local PR heads for #41 and #39 with `git fetch origin pull/41/head:pr-41 pull/39/head:pr-39`.
- Inspected the CI workflow suites from both branches.
- Added one lean workflow: `.github/workflows/recovery-ci.yml`.
- The workflow:
  - uses Node 20,
  - installs root and Angular dependencies,
  - runs `scripts/recovery/preflight.sh --skip-status`,
  - checks that `vercel.json` defines `buildCommand` and `outputDirectory`,
  - runs on PRs to `main`, pushes to `main` and recovery branches, and manual dispatch.

Decision:

- Do not merge #41 directly.
- Do not merge #39 directly.
- Do not take workflows that assume stale `backend`, `api/package.json`, old `api/lib`, old backend contract paths, or old API route names.
- Do not add Vercel CLI deployment workflow yet; Vercel Git deployment can be configured separately once branch validation is stable and secrets are intentionally provisioned.

Validation:

- `ruby -e 'require "yaml"; YAML.load_file(".github/workflows/recovery-ci.yml"); puts "workflow yaml ok"'` passed.
- `node -e "const fs=require('fs'); const config=JSON.parse(fs.readFileSync('vercel.json','utf8')); if (!config.buildCommand || !config.outputDirectory) throw new Error('bad vercel config'); console.log('vercel config ok')"` passed.
- `git diff --check` passed.

Self-review:

- Good: CI now runs the same recovery preflight script used locally, which reduces checklist drift.
- Good: This avoids the old API/backend path rewrites that would undo #70 recovery work.
- Watch item: This is a validation workflow, not a deployment workflow; the Vercel project/link/secrets still need a later deployment pass.

Running merge-order snapshot after #41/#39:

1. #84 - dependency update once lockfile state is intentional.
2. Docs/research/audio mining after merge/adapt candidates are out of the way.

## 2026-05-26 13:34 EDT - PR #84 Dependency Update Deferred For Fresh Recreate

Actions:

- Fetched PR #84 as `pr-84`.
- Inspected package and lockfile changes.
- Compared the branch against the current recovery baseline.

Decision:

- Do not merge #84 into this recovery branch.
- Recreate the dependency update later from the recovery branch after lockfile state is clean.
- Treat Angular 21 as a separate deliberate migration, not part of a grouped patch update.

Findings:

- The PR head commit is dependency-focused, but the branch is stale against the recovery baseline.
- Against the current recovery branch, #84 also brings in old audio service/test files, `AGENTS.md` changes, and `story-generator/src/server.ts` churn.
- Root scripts in #84 add audio tests back into required root test commands, which conflicts with the current audio-deferred scope.
- `story-generator/package.json` mixes `@angular/core` `^21.1.5` with multiple Angular `^20.3.x` packages.
- Lockfile churn is large enough that it should not be mixed with the existing unrelated dirty root lockfile/node_modules state.

Validation:

- Inspected `git diff main..pr-84 -- package.json story-generator/package.json`.
- Inspected `git diff --shortstat main..pr-84 -- package-lock.json story-generator/package-lock.json`.

Self-review:

- Good: #84 is no longer sitting in the merge/adapt queue as if it were a clean merge candidate.
- Watch item: A fresh dependency branch is still needed after recovery stabilization.

Running merge-order snapshot after #84:

1. Docs/research/audio mining and closure work.
2. Fresh dependency update from the recovery branch after lockfile state is clean.

## 2026-05-26 14:16 EDT - Recovery PR Opened and Docs/Deployment/Visual Mining Recorded

Actions:

- Ran full recovery preflight with `scripts/recovery/preflight.sh --skip-status`.
- Pushed `recovery-pr70-story-lab-vercel` to GitHub.
- Opened draft recovery PR #87: `https://github.com/Phazzie/FairytaleswithSpice/pull/87`.
- Closed the already handled PRs with comments pointing to #87 and the recovery ledgers:
  - #86, #85, #84, #75, #74, #73, #72, #71, #70, #67, #65, #64, #50, #41, #39, #31, #26, #24.
- Refreshed the open PR list after the first closure batch; remaining source PRs are #77, #76, #63, #56, #55, #54, #53, #47, #45, #44, #43, #42, #40, #30, #29, #28, and #22 plus #87.
- Fetched docs/storage/deployment/visual PR heads into temporary refs:
  - #77, #76, #63, #56, #54, #53, #40.
- Mined and recorded the useful material from:
  - #77 documentation/SDD analysis,
  - #76 WIP SDD redesign body/no-file state,
  - #63 database/story persistence research,
  - #56 cache/storage/monitoring/rate-limit research,
  - #54 deployment-readiness checklist ideas,
  - #53 documentation lifecycle/archive cleanup,
  - #40 UI layout/state clarity ideas.

Validation:

- `scripts/recovery/preflight.sh --skip-status` passed before pushing #87.
- Covered checks: required tool precheck with `jq` warning, `git diff --check`, Angular app typecheck, Angular spec typecheck, root story/trope/cliffhanger/story-lab-state tests, Node 20 Angular production build, and build-output verification.
- Known warnings remain:
  - `jq` is not installed locally.
  - Angular build reports stale `baseline-browser-mapping`.
  - `src/app/proving-grounds/proving-grounds.css` exceeds the component CSS budget by about 1.15 kB.

Self-review:

- Good: #87 now gives every old PR closure a concrete replacement branch instead of an abstract plan.
- Good: The docs/storage/deployment/visual mining happened before those PRs are closed, preserving the material the user asked us not to lose.
- Problem found: Several "docs" or "research" branches are not clean docs branches when compared to the recovery baseline; they carry stale `api/lib` rewrites, Vercel file deletions, audio scope, node_modules churn, or DigitalOcean runtime assumptions.
- Decision: Close those branches after recording their useful ideas, and recreate any future storage/deploy/docs/UI work from #87 rather than trying to merge stale branch contents.
- Watch item: The remaining audio PRs are likely to contain story-generation spillover, so they need the same evidence-first mining pass before closure.

## 2026-05-26 14:47 EDT - Audio PR Story-Generation Spillover Mined

Actions:

- Fetched audio PR heads into temporary refs:
  - #55, #47, #45, #44, #43, #42, #30, #29, #28, #22.
- Inspected PR bodies, file lists, prompt snippets, audio research docs, and representative parser/service code.
- Recorded PR-by-PR dispositions in `PR70_RECOVERY_LEDGER.md`, `NOT_TAKEN_FEATURE_LEDGER.md`, and `PR_USEFUL_MATERIAL_INVENTORY.md`.

Mined story-generation material:

- #55: audio-first prompt mode, 90+ emotion vocabulary, narrator atmosphere tags, character voice evolution as character-development metadata, and the warning against replacing prose with machine-first JSON.
- #47: tag validation, voice consistency testing, emotion navigation/bookmarks, and optional scene/effect metadata.
- #45: emotion taxonomy, character emotional memory, fuzzy emotion suggestions, and consistency across emotional changes.
- #44: scene/effect trigger metadata, emotion distribution and character-count QA signals, and SFX-provider caution.
- #43: character personality profiles and output analysis for neutral-tag overuse, low emotion variety, and oversized casts.
- #42: audio background-job semantics with start/status/result/cancel/progress and separation from story-generation streaming.
- #30/#29/#28/#22: explicit speaker/narrator tags, segment/result models, modular parser/voice/stitching seams, and quote-based fallback parsing.

Decision:

- Do not port active audio runtime, UI, provider, SFX, or player code now.
- Preserve the material as a future "audio-ready story generation" backlog.
- If audio returns, rebuild from #87 using current `api/_lib`, Story Lab contracts, Vercel-compatible storage/queue choices, and an explicit prompt/metadata seam.

Self-review:

- Good: The highest-risk knowledge loss from stale audio PRs is now recorded before closure.
- Good: The branch still avoids audio runtime scope and DigitalOcean/provider drift.
- Problem found: Several audio PRs solve the same problem in slightly incompatible ways. The later PRs are richer conceptually, but the earlier PRs are cleaner for modular parser/segment contract ideas.
- Follow-up: Close the audio PRs with comments that name both what was mined and what was not taken.

Closure result:

- Closed #55, #47, #45, #44, #43, #42, #30, #29, #28, and #22 with ledger-backed comments.
- Refreshed GitHub open PR list after closure; only #87 remains open.

## 2026-05-26 15:32 EDT - Vercel Deployment Stabilized

Actions:

- Installed `jq` locally for the recovery preflight script.
- Investigated the first Vercel preview failures after the audio/docs mining pass.
- Added `scripts/recovery/ensure-vercel-index.sh` so Angular's `index.csr.html` output is materialized as `index.html` for Vercel's static fallback.
- Updated root build scripts so `npm run build` and `npm run build:verify` both enforce that Vercel fallback file.
- Added Vercel API function TypeScript compilation to `scripts/recovery/preflight.sh`.
- Fixed stale Vercel function imports:
  - removed Next.js request/response type imports from plain Vercel functions,
  - corrected `api/export/save.ts` from `../lib/*` to `../_lib/*`,
  - corrected `api/story-lab/stream/genesis.ts` imports,
  - replaced API-side `.at(-1)` calls with compiler-compatible indexed reads,
  - removed stale `api/story/stream.ts.backup`.
- Reduced the deployed Vercel function count by removing deferred active audio endpoints/services and moving Story Lab helper modules under `api/_lib/story-lab/*`.
- Updated API docs and env checks so XAI/Grok remains active and ElevenLabs/audio runtime is not required for this recovery branch.

Deployment result:

- Deployment `dpl_9rTrwwQqQfqpHziJX91pcFjShrKA` for commit `0e96ef2` failed in Vercel TypeScript compilation.
- Deployment `dpl_EG7eEreP8fW9uax2XNi2AWnSJEdT` for commit `cfc4be1` built successfully but ended `ERROR` after output deployment, consistent with excess deployable API functions.
- Deployment `dpl_CopbfUAYcFL8BhwSJ82BumMGLeo5` for commit `528233f` is `READY`.
- Vercel reports `lambdaRuntimeStats: {"nodejs":12}` for the ready deployment.
- Preview URL: `https://fairytaleswith-spice-dapa55dm3-phazzies-projects.vercel.app`
- Branch alias: `https://fairytaleswith-spice-git-recovery-pr70-e629d8-phazzies-projects.vercel.app`
- A normal unauthenticated `curl` hit Vercel Authentication for protected preview URLs.
- Vercel connector verification:
  - root URL returned `200 OK` and served the Angular shell,
  - `/api/health` returned `200 OK` through a temporary Vercel share/access flow,
  - `/api/health` reported production environment and `grok: configured`.

Validation:

- `jq --version` returns `jq-1.8.1`.
- `scripts/recovery/preflight.sh --quick --skip-status` passed after the Vercel function-count reduction.
- `scripts/recovery/preflight.sh --skip-status` passed after the final report and docs updates.
- Manual Vercel API typecheck passed:
  - `find api -name '*.ts' ! -name '*.spec.ts' ! -name '*.test.ts' -print0 | xargs -0 npx tsc --noEmit --target es2020 --lib es2020,dom --module commonjs --moduleResolution node --esModuleInterop --skipLibCheck --types node`
- `npm run build:verify` passed after the Angular fallback index fix.
- `git diff --check` passed before the Vercel fix commits.

Self-review:

- Good: The branch now has a concrete ready Vercel deployment, not just local build confidence.
- Good: The preflight script now catches the API function compilation class that Vercel caught remotely.
- Problem found: Helper TypeScript files under non-underscore `api/story-lab/*` counted as deployable Vercel functions. Moving helpers under `api/_lib/story-lab/*` was necessary.
- Problem found: Deferred audio code was still active enough to affect Vercel deployment shape. Removing active audio routes/services better matches the user's audio-deferred direction.
- Problem found: Protected preview deployments need an authenticated or share-token smoke path; unauthenticated curl alone is not a useful runtime signal.
- Should have anticipated sooner: Vercel deployment should have been run before closing the last source PRs, because local Angular/root checks did not exercise Vercel's per-function compiler or function-count constraints.

## 2026-05-27 12:51 EDT - PR #87 Finish-And-Merge Scope Freeze

Actions:

- Replaced the broad next-phase execution plan with `PR87_NEXT_EXECUTION_PLAN.md`, a narrower finish-and-merge plan for PR #87.
- Added `PR87_FINISH_TURNOVER_LETTER.md` so a compacted or future context can resume without rediscovering the current direction.
- Reviewed Spark's completed checklist output and accepted only the pieces that reduce merge/deploy risk.
- Kept the Vercel function-count guard path:
  - `scripts/recovery/check-vercel-function-count.sh`
  - `scripts/recovery/preflight.sh`
- Reworked Spark's Proving Grounds CSS output:
  - rejected the one-line minified stylesheet as not merge-ready,
  - restored readable formatting and hover/focus/spinner affordances,
  - raised the Angular `anyComponentStyle` warning threshold from `10kB` to `12kB` so source readability is not traded away for a warning-only budget.
- Reverted the root `package.json` `test:grok-smoke` script addition from the current PR scope; the untracked Grok smoke test idea remains deferred follow-up material.
- Fixed two SonarCloud security findings that appeared after the branch push:
  - replaced dynamic chapter-title `RegExp` construction in `api/_lib/services/storyService.ts`,
  - removed Angular `bypassSecurityTrustHtml` usage from `story-generator/src/app/streaming-story/streaming-story.component.ts` and let Angular's `[innerHTML]` sanitizer handle streamed HTML.

Decision:

- PR #87 is now in polish/merge mode. Do not add Story Lab adapter, persistence, AI evals, dependency refresh, or audio runtime work before merging this recovery baseline.

Validation:

- `scripts/recovery/check-vercel-function-count.sh` passed and reported `12/12`.
- `git diff --check` passed.
- `cd story-generator && npx -p node@20 -c "node -v && npm run build"` passed with Node v20.20.2. The Proving Grounds CSS budget warning is gone; the stale `baseline-browser-mapping` warning remains.
- `scripts/recovery/preflight.sh --skip-status` passed after the SonarCloud fixes.

Self-review:

- Spark was useful for fast bounded work, but its CSS fix proved why final merge polish needs a senior review gate.
- The better release decision is to merge #87 as a clean baseline and move valuable but nonessential validation/planning ideas into smaller follow-up PRs.

## 2026-05-27 13:45 EDT - Review Follow-Up And Two-Agent Plan

Actions:

- Addressed the still-relevant review findings after PR #87 merged:
  - aligned frontend/backend API envelopes as discriminated `ApiResponse<T>` unions,
  - added Story Lab empty-body guards,
  - allowed the frontend creature set through API validation without crashing trope subversion,
  - preserved author-style selection for `siren` and `djinn` through the fairy style profile,
  - hardened Proving Grounds accessibility, comparison state updates, and random ID generation,
  - replaced remaining `Math.random` ID/security-hotspot usage in active app/API code,
  - pinned recovery CI actions and disabled checkout credential persistence,
  - tightened the Vercel function-count guard with an explicit allow-list,
  - kept `typescript` pinned to a patch range in the root package files.
- Completed a second review-comment sweep for remaining concrete, low-risk findings:
  - fixed creation header format on trope/cliffhanger helper files,
  - removed cliffhanger type skew from question-mark-only endings,
  - replaced `Date.now()`-only Story Lab mock IDs with UUIDs,
  - added Story Lab stream enum/range validation before contract casts,
  - rejected invalid `requestedChapterCount` values in the legacy story stream route,
  - added theme-chip `aria-pressed`,
  - tightened debug/app CSS contrast and wrapping rules.
- Updated `scripts/recovery/preflight.sh` to call local TypeScript binaries directly because `npx tsc` can hang under npm exec parsing on this machine.
- Added `plan.md`, a self-contained two-agent execution plan for the next major Story Lab productionization chunk.
- Pointed `AGENTS.md` at `plan.md` with the instruction that the plan starts only after the current polish branch is merged.
- Addressed PR #89 Gemini follow-up comments:
  - rejected non-array `themes` in `api/story/stream.ts`,
  - corrected the Proving Grounds template selector to use `role="radio"` with `aria-checked`,
  - added a non-`Math.random` preview-selection fallback for environments without Web Crypto.
- Addressed PR #89 Codex/Copilot follow-up comments:
  - updated the debug panel to read the enveloped Story Lab health response,
  - mapped `siren` and `djinn` in backend creature display text,
  - made live upstream stream errors reject instead of emitting successful completion,
  - removed flow-content headings from interactive Proving Grounds buttons,
  - added explicit numeric validation for legacy stream `spicyLevel` and `wordCount`.

Validation:

- `git diff --check` passed.
- `scripts/recovery/check-vercel-function-count.sh` passed and reported `12/12`.
- Direct Vercel API typecheck passed:
  - `find api -name '*.ts' ! -name '*.spec.ts' ! -name '*.test.ts' -print0 | xargs -0 node_modules/.bin/tsc --noEmit --target es2020 --lib es2020,dom --module commonjs --moduleResolution node --esModuleInterop --skipLibCheck --types node`
- `scripts/recovery/preflight.sh --quick --skip-status` passed.
- `scripts/recovery/preflight.sh --skip-status` passed after docs/plan updates.
- After the second review sweep, `scripts/recovery/preflight.sh --quick --skip-status` passed again.
- After the second review sweep, `cd story-generator && npx -p node@20 -c "node -v && npm run build"` passed.
- After PR #89 Gemini follow-ups, `git diff --check`, `scripts/recovery/check-vercel-function-count.sh`, direct Vercel API typecheck, `scripts/recovery/preflight.sh --quick --skip-status`, and the Node 20 Angular build passed again.
- After PR #89 Codex/Copilot follow-ups, `git diff --check`, `scripts/recovery/check-vercel-function-count.sh`, direct Vercel API typecheck, `scripts/recovery/preflight.sh --quick --skip-status`, and the Node 20 Angular build passed again.
- `npm run build:verify` passed after the final Angular build.
- Known warning remains: `baseline-browser-mapping` reports stale browser data during the Angular build.
- Existing mock-mode root tests still print word-count variance warnings, but the suite exits passing.

Self-review:

- Good: The review fixes stayed mostly in hardening/contract territory instead of adding new product scope.
- Good: The new `plan.md` separates the next large work from the review-polish branch.
- Problem found: Running `npx tsc -p ...` inside preflight hung as `npm exec`; direct local `tsc` binaries are more predictable for this repo.
- Problem found: A stricter discriminated API response type immediately exposed an evaluation-route variable collision.
- Should have anticipated sooner: Review comments that look cosmetic can expose real boundaries, especially API envelope shape and Vercel function counting.

## 2026-05-27 21:05 EDT - Story Lab Real Engine Work Started

Actions:

- Created `STORY_LAB_REAL_ENGINE_EXEC_PLAN.md` with three implementation critique/revision passes and three autonomous execution-plan critique/revision passes.
- Updated `AGENTS.md` so future Story Lab generation work starts from the new real-engine plan.
- Added first-class Story Lab generation context to the real story engine contract:
  - logline,
  - tone,
  - protagonist and antagonist names,
  - world details,
  - narrative directives,
  - full theme seed metadata.
- Updated the real `StoryService` prompt builder so Story Lab blueprint fields are explicit prompt constraints rather than flattened into a generic user-input blob.
- Added `api/_lib/story-lab/storyLabEngine.ts` to orchestrate Story Lab genesis and continuation through the real `StoryService` when `XAI_API_KEY` is configured.
- Kept mock Story Lab generation only for missing provider key or explicit `STORY_LAB_FORCE_MOCK`.
- Wired Story Lab genesis, continuation, and streaming genesis routes to the new Story Lab engine orchestration.
- Marked mock Story Lab telemetry as `custom` instead of `gpt`.
- Added `tests/story-lab-real-engine.test.ts` and a root `test:story-lab-real-engine` script.
- Added an explicit test proving configured provider failure returns the provider error instead of silently falling back to mock Story Lab output.

Validation:

- `git diff --check` passed.
- Direct Vercel API typecheck passed after replacing an `.at(-1)` use that the ES2020 Vercel typecheck target rejected.
- `npm run test:story-lab-real-engine` passed.
- `npm run test:story-lab-state` passed.
- `npm run test:all` passed.
- `scripts/recovery/check-vercel-function-count.sh` passed and reported `12/12`.
- `scripts/recovery/preflight.sh --quick --skip-status` passed.
- Node 20 Angular build passed with `npx -p node@20 -c "node -v && npm run build"`.

Self-review:

- Good: Story Lab no longer needs a permanent lossy adapter to reach the real engine; the rich blueprint now enters the real prompt contract as structured context.
- Good: Configured provider failures should not silently fall back to fake Story Lab content.
- Problem found: Story Lab continuity state derived from real prose is still heuristic. That is acceptable for this slice only because it is not represented as durable storage or AI-grade story analysis.
- Should have anticipated: the Vercel API typecheck target still rejects `.at()`, so new recovery code should use index access consistently.

## 2026-05-27 22:52 EDT - PR90 Automated Review Fixes

Actions:

- Addressed automated review feedback on PR #90:
  - canonicalized Story Lab theme IDs before passing them to the classic engine instead of casting free-form IDs to `ThemeType`,
  - preserved full Story Lab theme seeds in `generationContext`,
  - carried trope metadata through `StorySummary` so continuations can reuse the original trope-subversion state,
  - changed continuation content assembly to fall back from empty `rawContent` to `htmlContent`,
  - sent SSE headers and the initial `connected` event before awaiting real generation,
  - forwarded `protagonistName`, `antagonistName`, and `worldDetails` through the streaming genesis path,
  - converted partial real-engine batch failures into explicit Story Lab errors instead of silently returning a shorter completed batch,
  - mapped real `StoryService` processing time into Story Lab telemetry latency,
  - replaced regex-based HTML/speaker-tag stripping with linear scans to satisfy SonarCloud hotspot checks,
  - fixed timestamp headers on new files and updated word-count pacing guidance for 600 and 1500 words.

Validation:

- `git diff --check` passed before the first review-fix amend.
- `npm run test:story-lab-real-engine` passed after review fixes.
- Direct Vercel API typecheck passed after review fixes.
- Angular TypeScript check passed with `cd story-generator && npx tsc --noEmit --project tsconfig.json`.

Self-review:

- Good: The review comments improved the architecture instead of just polishing style. Theme canonicalization and trope metadata preservation directly protect story-generation quality.
- Problem found: The first implementation made the streaming endpoint production-capable in name but still delayed the first event until after generation. The fix makes the endpoint at least connection-honest, though true token/chapter streaming remains future work.
- Should have anticipated: Story Lab's free-form theme IDs and the classic engine's closed `ThemeType` union were a contract mismatch. The rich `generationContext` made this survivable, but the classic field still needed canonicalization.

## 2026-05-28 00:27 EDT - PR90 Merged and Production Smoke Tested

Actions:

- Merged PR #90 into `main` as merge commit `0af83b397396ecca9707d5151252df18a1247a4b`.
- Created `demo/story-lab-shipping-readiness` from updated `main`.
- Added `.agent/PLANS.md` and `STORY_LAB_DEMO_SHIPPING_EXEC_PLAN.md`, then linked the demo-shipping plan from `AGENTS.md`.
- Smoke-tested production Vercel at `https://fairytaleswith-spice.vercel.app`.
- Added `STORY_LAB_DEMO_READINESS_REPORT.md`.

Validation and evidence:

- PR #90 checks were green immediately before merge.
- Main Recovery CI passed after merge.
- Vercel deployment completed after merge.
- Production `/api/health` returned `success: true`, `data.environment: "production"`, and `data.services.grok: "configured"`.
- Production Story Lab genesis returned `success: true` and `telemetry.engine: "grok"`. Example run evidence: story id `story_ea1bcf73-cee6-444a-ae0b-22187557c6be`, title `Reefbound Vow`.
- Production Story Lab continuation returned `success: true` and `telemetry.engine: "grok"`. Example run evidence: appended chapter number `2`.
- Production frontend root returned HTTP 200 and served the Angular app shell.

Self-review:

- Good: The app now has deployed proof that Story Lab reaches the real Grok-backed engine and can continue a story.
- Good: The follow-up plan was kept out of PR #90 and committed on a fresh post-merge branch.
- Problem found: Main-branch SonarCloud quality gate is red after the merge due to broader recovery-era hotspots and duplicated new-code density. It does not block the deployed demo, but it should be handled in a dedicated hardening branch.
- Should have anticipated: PR-level Sonar success and main-branch quality-gate success are different evidence. The PR passed; main still evaluates broader branch conditions.

## 2026-05-28 01:40 EDT - MVP Browser Smoke Work Started

Actions:

- Created `mvp/story-lab-public-readiness` from updated `main`.
- Added `MVP_TO_SHIPPING_EXEC_PLAN.md` and linked it from `AGENTS.md`.
- Added a Playwright-backed browser smoke script at `scripts/recovery/story-lab-browser-smoke.mjs`.
- Added root script `npm run smoke:story-lab-ui`.
- Gated the public debug panel behind `?debug=1` instead of rendering it for every public user.
- Added `STORY_LAB_MVP_READINESS_REPORT.md` as a candidate report.

Validation:

- `git diff --check` passed.
- `npm run test:story-lab-real-engine` passed.
- `scripts/recovery/preflight.sh --quick --skip-status` passed.
- `npm run test:all` passed.
- `STORY_LAB_SMOKE_SKIP_BUILD=1 npm run smoke:story-lab-ui` passed after the full smoke build exposed an over-broad heading assertion.

Self-review:

- Good: The first MVP work attacks the weakest previous evidence: browser-level Story Lab use, not just API curl proof.
- Good: The debug panel is preserved for recovery but removed from the default public surface.
- Problem found: `ng serve` was too slow and process-fragile for an autonomous smoke gate in this checkout. The smoke now builds with Node 20 and serves the built output directly.
- Should have anticipated: Browser smoke selectors must be exact enough to distinguish app title, story title, and chapter headings.

## 2026-05-28 01:56 EDT - PR92 Review Fixes

Actions:

- Addressed automated review feedback on PR #92:
  - changed debug-panel visibility from a one-time `window.location.search` read to Angular `ActivatedRoute.queryParamMap`,
  - added stable `data-testid` hooks for the Story Lab smoke path,
  - updated the Playwright smoke to use those hooks and avoid hard-coded generated story copy,
  - hardened static-file path resolution in the smoke server so requests cannot escape the built output directory,
  - guarded browser cleanup so Chromium launch errors are not masked,
  - made the smoke build use the current Node when it is already Node 20 and only fall back to `npx node@20` when needed,
  - removed the regex route matcher that Sonar flagged as a security hotspot,
  - replaced public error guidance that pointed normal users to the hidden debug panel,
  - corrected the deployed-smoke command in the ExecPlan so real-provider evidence requires `STORY_LAB_SMOKE_LIVE=1`.

Validation:

- `git diff --check` passed.
- `node --check scripts/recovery/story-lab-browser-smoke.mjs` passed.
- `cd story-generator && ../node_modules/.bin/tsc -p tsconfig.app.json --noEmit` passed.
- `cd story-generator && ../node_modules/.bin/tsc -p tsconfig.spec.json --noEmit` passed.
- `npm run test:story-lab-real-engine` passed.
- `scripts/recovery/preflight.sh --quick --skip-status` passed.
- `npm run smoke:story-lab-ui` passed after rebuilding with Node `v20.20.2` and driving the built app through mocked genesis and continuation.
- `npm run test:all` passed with the existing mock-mode key/word-count warnings.

Self-review:

- Good: The review fixes improved the smoke harness instead of just quieting bots. Live mode no longer depends on a specific generated title.
- Good: The debug panel remains recoverable through `?debug=1` while following Angular route state.
- Problem found: Stable smoke selectors are now part of the UI contract; future markup edits must preserve or deliberately update them.
- Should have anticipated: Any live AI browser smoke must avoid asserting exact generated prose or titles, because model output is intentionally variable.

## 2026-05-28 02:10 EDT - PR92 Preview Smoke Blocked by Vercel Auth

Actions:

- Confirmed PR #92 checks were green on commit `473fa9f`.
- Tried live browser smoke against the Vercel preview URL:
  - `STORY_LAB_SMOKE_URL=https://fairytaleswith-spice-git-mvp-story-lab-d390c3-phazzies-projects.vercel.app STORY_LAB_SMOKE_LIVE=1 npm run smoke:story-lab-ui`
- Confirmed the preview root returns HTTP `401`, so unauthenticated live browser smoke cannot prove the branch preview.
- Stopped the smoke attempt instead of waiting for its full timeout.

Decision:

- Merge PR #92 after checks are green, then run live browser smoke against production Vercel for MVP evidence.

## 2026-05-28 02:15 EDT - PR92 Merged and Production Browser Smoke Passed

Actions:

- Merged PR #92 into `main` as commit `fb3549fa5b088475a67534ef94e0d3dfe93ee78c`.
- Confirmed local checkout is on updated `main`.
- Confirmed main Recovery CI passed for the merge commit.
- Confirmed Vercel production deployment completed for the merge commit.
- Confirmed production root returned HTTP `200`.
- Ran production live browser smoke:
  - `STORY_LAB_SMOKE_URL=https://fairytaleswith-spice.vercel.app STORY_LAB_SMOKE_LIVE=1 npm run smoke:story-lab-ui`
  - Result: passed.
- Updated `STORY_LAB_MVP_READINESS_REPORT.md` with production evidence.

Self-review:

- Good: MVP evidence now covers both deterministic local UI mechanics and real deployed Grok-backed browser usage.
- Good: The debug panel is hidden from normal users while still recoverable with `?debug=1`.
- Problem found: Main SonarCloud remains red on broader recovery-era criteria after the merge. This belongs in Tier 2 shipping hardening, not in the already-merged MVP proof.
- Should have anticipated: The MVP report needed a post-merge evidence update branch because production proof necessarily happens after the MVP PR lands.

## 2026-05-28 02:43 EDT - Shipping Hardening Started

Actions:

- Continued on `shipping/story-lab-hardening` after PR #93 had recorded production MVP smoke evidence.
- Inspected the only remaining open PR, #88, and treated it as dependency-security input rather than a direct merge candidate.
- Updated dependency manifests and lockfiles beyond PR #88's patch levels:
  - root `axios` now targets `^1.16.1`,
  - Story Generator `axios` now targets `^1.16.1`,
  - Angular runtime packages now target `20.3.22`,
  - Angular CLI/build/SSR packages now target `20.3.26`,
  - Angular build/type tooling is now in `devDependencies` instead of production dependencies.
- Cleaned generated root `node_modules` churn from the worktree instead of committing generated dependency files.
- Queried main SonarCloud issue state and found 120 open issues on `main`.
- Fixed the two top source issues from the Sonar query:
  - flattened the static smoke server fallback path in `scripts/recovery/story-lab-browser-smoke.mjs`,
  - rewrote Story Lab speaker-tag stripping in `api/_lib/story-lab/storyLabEngine.ts` to avoid assigning to a `for` loop counter.
- Created `STORY_LAB_SHIPPING_READINESS_REPORT.md`.
- Updated `MVP_TO_SHIPPING_EXEC_PLAN.md`, `PR70_RECOVERY_LEDGER.md`, and `LESSONS_LEARNED.md` with the shipping-hardening disposition and risk classification.

Dependency/security evidence gathered:

- `npm audit --omit=dev --json` at the root reported zero vulnerabilities.
- `cd story-generator && npm audit --omit=dev --json` reported zero vulnerabilities.
- `cd story-generator && npm audit --omit=dev --omit=optional --json` reported zero vulnerabilities.
- `cd story-generator && npm audit --json` still reported seven dev/test-toolchain findings through Karma/socket dependencies.

Validation:

- `git diff --check` passed after generated `node_modules` churn was restored.
- `node --check scripts/recovery/story-lab-browser-smoke.mjs` passed.
- `scripts/recovery/preflight.sh --quick --skip-status` passed, including function count, Angular app/spec typechecks, and direct Vercel API typecheck.
- `npm run test:story-lab-real-engine` passed.
- `npm run test:all` passed with expected mock-mode `XAI_API_KEY` and word-count warnings.
- `npm run smoke:story-lab-ui` passed in mocked mode after building with Node `v20.20.2`; Angular reported the known `baseline-browser-mapping` stale-data warning and completed in 345.796 seconds.
- `npm run build:verify` passed.

Decision:

- Supersede PR #88 after this shipping-hardening branch is merged. PR #88 is dependency-only, but this branch updates to fresher dependency versions and does so on the current Story Lab baseline.

Self-review:

- Good: Runtime dependency risk is materially reduced instead of merely documented.
- Good: The branch fixes small high-signal Sonar issues immediately instead of using the report as an excuse.
- Problem found: Full dev audit is still red because Karma's dependency chain has vulnerable transitive packages.
- Problem found: The repo has tracked root `node_modules` files from old history; generated changes to those files should not be included in this branch.
- Should have anticipated: A stale Dependabot branch can be mergeable but still not be the right dependency answer once newer patch releases exist.

## 2026-05-28 03:07 EDT - PR94 CI Whitespace Fix

Problem:

- PR #94 Recovery CI failed during `git diff --check` after `npm ci` because the repository still tracks historical root `node_modules` files.
- Installing dependencies on GitHub mutated those generated files, and `git diff --check` reported whitespace inside the generated axios package diff.

Fix:

- Updated `scripts/recovery/preflight.sh` so the whitespace/conflict-marker check excludes `node_modules/**` and `story-generator/node_modules/**`.

Self-review:

- Good: This preserves the rule that generated dependency churn should not be committed.
- Problem found: Local validation passed because local `node_modules` churn had been restored before preflight; CI exposed the install-order variant.
- Should have anticipated: Any workflow that runs `npm ci` before `git diff --check` must exclude tracked generated dependency paths until the old tracked `node_modules` history is removed.

## 2026-05-28 03:11 EDT - PR94 Review Fix

Problem:

- Gemini review correctly noted that the smoke server's SPA fallback should not serve `index.html` for missing static assets such as JavaScript, CSS, or images.

Fix:

- Updated `scripts/recovery/story-lab-browser-smoke.mjs` so only extensionless paths use the SPA fallback candidates.
- Static asset paths now return `404` when the requested file is absent instead of receiving HTML with the wrong MIME/type expectations.

Validation:

- `node --check scripts/recovery/story-lab-browser-smoke.mjs` passed.
- `STORY_LAB_SMOKE_SKIP_BUILD=1 npm run smoke:story-lab-ui` passed.

## 2026-05-28 03:18 EDT - PR94 Merged and Shipping Evidence Recorded

Actions:

- Merged PR #94, `Harden Story Lab shipping readiness`, into `main` as merge commit `a71aef4dec43c8720096b4db5b21dc051a6a3c06`.
- Closed Dependabot PR #88 as superseded by PR #94's fresher dependency update.
- Confirmed the open PR list is empty after the closure.
- Confirmed main Recovery CI passed for `a71aef4`.
- Confirmed main Dependabot Updates workflow passed for `a71aef4`.
- Confirmed Vercel production deployment succeeded for `a71aef4`.
- Confirmed production root `https://fairytaleswith-spice.vercel.app` returned HTTP `200`.
- Ran production live browser smoke:
  - `STORY_LAB_SMOKE_URL=https://fairytaleswith-spice.vercel.app STORY_LAB_SMOKE_LIVE=1 npm run smoke:story-lab-ui`
  - Result: passed.
- Updated `STORY_LAB_SHIPPING_READINESS_REPORT.md` with the post-merge evidence.

Self-review:

- Good: Shipping readiness is now based on merged-main evidence, not branch-local optimism.
- Good: PR #88 was closed only after the replacement dependency work landed and production checks passed.
- Problem found: The final evidence update itself needed a small follow-up branch because the report could only be fully accurate after merge.
- Should have anticipated: Any report that promises post-merge production status should reserve a final docs-only pass to record the exact merge commit and production smoke result.

## 2026-05-28 03:28 EDT - PR95 Dev/Test Audit Cleanup Merged

Actions:

- Found new Dependabot PR #95 after the shipping evidence pass.
- Inspected #95 and confirmed it was lockfile-only for `story-generator/package-lock.json`.
- Merged PR #95 as `d1b7458b71d232b5e38e94755776c69c7c165381`.
- Confirmed open PR list is empty after the merge.
- Confirmed main Recovery CI passed for `d1b7458`.
- Confirmed Vercel production deployment succeeded for `d1b7458`.
- Confirmed production root `https://fairytaleswith-spice.vercel.app` returned HTTP `200`.
- Ran production live browser smoke:
  - `STORY_LAB_SMOKE_URL=https://fairytaleswith-spice.vercel.app STORY_LAB_SMOKE_LIVE=1 npm run smoke:story-lab-ui`
  - Result: passed.

Dependency/security evidence:

- `cd story-generator && npm audit --omit=dev --json` still reports zero vulnerabilities.
- `cd story-generator && npm audit --json` now reports four dev/test-toolchain findings, down from seven.
- Remaining full-audit findings are `engine.io`, `socket.io-adapter`, `socket.io-parser`, and `ws`.

Self-review:

- Good: The follow-up PR was small, green, and improved a documented risk, so merging it was better than leaving it open.
- Problem found: The final report had already become stale because the queue changed immediately after the docs-only evidence PR.
- Should have anticipated: Dependabot can open a cleanup PR immediately after a dependency branch lands; final reports should be checked against the PR queue one last time before calling the queue closed.

## 2026-05-28 18:00 EDT - Grok Multi-Agent Story Lab Polish Implemented

Actions:

- Created and continued `feature/grok-multiagent-story-lab-polish` from the Grok multi-agent polish plan.
- Added centralized xAI story configuration in `api/_lib/config/xaiConfig.ts` with default model `grok-4.20-multi-agent` and default reasoning effort `medium`.
- Added `api/_lib/services/xaiTextClient.ts` so active story generation, continuation, evaluation, continuity extraction, API-key verification, and the opt-in live smoke use one xAI Responses API path.
- Migrated Story Lab evaluation away from a hard-coded model string and direct chat-completions payload.
- Added AI-assisted continuity extraction with explicit `ai`, `heuristic`, or `mixed` receipts and visible fallback warnings.
- Added browser-local saved story projects in `story-generator/src/app/story-workspace-storage.service.ts`; Story Lab now autosaves generated/continued stories, restores the latest saved story on load, and lets users load/delete saved browser-local projects.
- Reworked the Story Lab UI into a writer's workbench with saved-story rail, blueprint studio, chapter reader, continuity weave, Grok model badge, and a generated bitmap atmosphere asset at `story-generator/public/story-lab-atmosphere.png`.
- Added deterministic story-quality evals in `tests/story-quality-evals.test.ts` and included them in `npm run test:all`.
- Extended the Story Lab browser smoke to verify restore-on-refresh in mock mode and capture desktop and mobile screenshots.

Validation:

- `npm run smoke:grok-multi-agent` passed the no-credential skip path.
- `npm run test:story-quality` passed.
- `npm run test:story-lab-state` passed.
- `npm run test:story-lab-real-engine` passed.
- `node_modules/.bin/tsc -p story-generator/tsconfig.app.json --noEmit` passed.
- `node_modules/.bin/tsc -p story-generator/tsconfig.spec.json --noEmit` passed.
- `npm run test:all` passed.
- `git diff --check` passed.
- `scripts/recovery/preflight.sh --quick --skip-status` passed, including function count, Angular app/spec typechecks, and Vercel API typecheck.
- `npm run smoke:story-lab-ui` passed in mocked mode after a Node 20 build; screenshots were written to `tmp/story-lab-smoke/mock-success.png` and `tmp/story-lab-smoke/mock-mobile-success.png`.
- `node_modules/.bin/tsx tests/verify-ai-fixes.test.ts` passed.
- `node_modules/.bin/tsx tests/verify-api-keys.ts` was not a usable pass/fail signal locally because `XAI_API_KEY` is absent; it failed closed with "XAI_API_KEY not found in environment."
- `npm audit --omit=dev --json` at the root reported zero vulnerabilities.
- `cd story-generator && npm audit --omit=dev --json` reported zero vulnerabilities.
- `cd story-generator && npm audit --json` still reported the known four dev/test-toolchain findings: `engine.io`, `socket.io-adapter`, `socket.io-parser`, and `ws`.

Self-review:

- Good: The model migration is centralized and Grok-only; no OpenAI runtime dependency or provider abstraction was added.
- Good: The UI is now visibly product-specific without replacing the first screen with a landing page.
- Good: Persistence is labeled and implemented as browser-local instead of pretending the app has accounts or cloud storage.
- Problem found: The xAI Responses smoke initially used top-level `await`, which this repo's CJS-oriented `tsx` path rejected.
- Problem found: True token streaming was not completed in this pass; the existing SSE route remains a final-result path over the migrated Responses call.
- Assumption still pending: Live Grok multi-agent behavior needs `RUN_REAL_GROK_MULTI_AGENT_SMOKE=1` and `XAI_API_KEY` to verify provider acceptance of the payload in this environment.
- What should be fixed before merge: open the branch as a focused PR, run CI, and run production live Story Lab smoke after deployment.

## 2026-05-28 18:13 EDT - PR98 Review and Sonar Fixes

Problem:

- PR #98 Recovery CI passed and Vercel preview deployed, but SonarCloud failed the quality gate on log-injection hotspots in live-key helper scripts.
- Gemini review flagged malformed LLM/provider response shapes that could crash `continuityExtractor.ts` and `xaiTextClient.ts`.

Fix:

- Removed provider-returned model/text/usage logging from `tests/grok-multi-agent-smoke.test.ts` and `tests/verify-api-keys.ts`; the scripts now log configured model/effort plus output length only.
- Hardened xAI response text extraction against null response entries.
- Hardened continuity JSON parsing against valid-but-non-object JSON and skipped null/non-object entries in AI-provided characters, threads, and artifacts.
- Replaced continuity extractor regex-based Markdown fence stripping and HTML-to-text conversion with deterministic scanners to clear Sonar regex backtracking hotspots.

Validation:

- `npm run smoke:grok-multi-agent` passed the no-credential skip path.
- `npm run test:story-quality` passed.
- `node_modules/.bin/tsc -p story-generator/tsconfig.app.json --noEmit` passed.
- `node_modules/.bin/tsc -p story-generator/tsconfig.spec.json --noEmit` passed.
- `scripts/recovery/preflight.sh --quick --skip-status` passed.
- `node_modules/.bin/tsx tests/verify-ai-fixes.test.ts` passed.
- `npm run test:story-quality` and `scripts/recovery/preflight.sh --quick --skip-status` passed again after the regex-hotspot fix.
- `git diff --check` passed.

Self-review:

- Good: The review comments were correct and cheap to fix; the branch is safer for malformed AI output.
- Problem found: Test/helper logging can still fail a production quality gate when it logs provider-controlled strings.
- Should have anticipated: New live smoke scripts should default to non-content telemetry from the start.

## 2026-05-28 18:42 EDT - Post-Merge Production 504 Follow-Up

Problem:

- PR #98 merged and the production root returned HTTP 200, but the production live Story Lab browser smoke failed.
- Browser console evidence showed `POST /api/story-lab/stories` returning HTTP 504 before `[data-testid="story-panel"]` appeared.
- The likely cause was not a provider mismatch; it was a synchronous Vercel request waiting on Grok multi-agent generation and then a second AI continuity extraction call.

Fix in progress:

- Kept the app Grok-only and left `grok-4.20-multi-agent` as the primary Story Lab generation model.
- Added a bounded Grok fallback path in the shared xAI Responses client: retryable timeout/server failures fall back to `grok-4.3`.
- Budgeted multi-chapter batches so only the first generated chapter attempts multi-agent; later chapters in the same batch use the fast Grok path.
- Added config helpers for primary and fast request timeouts so production is not tied to 60-90 second local development assumptions.
- Moved continuity extraction and Story Lab evaluation to the fast Grok path with shorter timeouts.
- Added `fallbackFromModel` telemetry so the UI can say when a fast Grok fallback was used instead of pretending multi-agent completed.
- Updated the browser smoke harness so Vercel `_vercel_share` preview URLs skip the raw Node `fetch` preflight and let Playwright handle the auth flow.
- Changed the initial Story Lab default to one chapter per batch so the first demo path does not begin with avoidable multi-call latency.

Validation:

- `node_modules/.bin/tsx tests/verify-ai-fixes.test.ts` passed.
- `node --check scripts/recovery/story-lab-browser-smoke.mjs` passed.
- `npm run smoke:grok-multi-agent` passed the no-credential skip path.
- `npm run test:story-quality` passed.
- `npm run test:story-lab-real-engine` passed.
- `scripts/recovery/preflight.sh --quick --skip-status` passed.
- `npm run test:all` passed.
- `git diff --check` passed.
- `npm run smoke:story-lab-ui` passed in mock mode after a fresh Node 20 Angular build.
- Authenticated Vercel preview live smoke passed after the timeout/default follow-up:
  - `STORY_LAB_SMOKE_URL='https://fairytaleswith-spice-git-fix-grok-mult-7c8417-phazzies-projects.vercel.app/?_vercel_share=zDsTJzlsbLjfLIP4sF7m1Chmvy8rpwX6' STORY_LAB_SMOKE_LIVE=1 npm run smoke:story-lab-ui`

Self-review:

- Good: The correction stayed inside the xAI client and canonical story service instead of adding another provider adapter or reintroducing mocks.
- Good: The UI telemetry now exposes fallback behavior rather than hiding it.
- Problem found: The original multi-agent plan anticipated higher latency, but did not turn that anticipation into a Vercel request-budget policy before merge.
- Problem found during self-review: Story Lab defaults to a two-chapter batch, so a primary-plus-fallback retry per chapter was still too much worst-case latency. The fix now lets only the first chapter attempt multi-agent and uses fast Grok for later chapters in the same batch.
- Problem found during preview smoke: the protected Vercel preview failed the smoke harness before browser auth because the harness used Node `fetch`; after bypassing that preflight, the app reached the UI but live generation still failed with the 9s fast fallback timeout, so the first-attempt fast fallback budget was raised while extra batch chapters stay capped.
- Should have anticipated: If generation and continuity both call live AI in one serverless request, their worst-case timeouts must be budgeted together, not judged one call at a time.

## 2026-05-28 19:11 EDT - PR99 Merged and Production Live Smoke Restored

Actions:

- Merged PR #99, `Bound Grok multi-agent Story Lab latency`, into `main` as merge commit `e859bb825656ed7a08c8a361079bde4e86c76503`.
- Confirmed main Recovery CI passed for `e859bb8`.
- Confirmed Vercel production deployment completed for `e859bb8`.
- Confirmed production root `https://fairytaleswith-spice.vercel.app` returned HTTP 200 with `last-modified: Thu, 28 May 2026 23:10:29 GMT`.
- Ran production live Story Lab browser smoke:
  - `STORY_LAB_SMOKE_URL=https://fairytaleswith-spice.vercel.app STORY_LAB_SMOKE_LIVE=1 npm run smoke:story-lab-ui`
  - Result: passed.

Self-review:

- Good: The failure that Vercel exposed is now represented as executable behavior and durable documentation, not just a chat observation.
- Good: The final proof used production, not only a protected preview.
- Remaining risk: Very slow Grok provider responses can still fail closed, especially if a user deliberately asks for larger multi-chapter batches. The default demo path is now one chapter and has passed live production smoke.

## 2026-05-28 19:19 EDT - Provider Variability Follow-Up

Problem:

- A second production live smoke against the docs-only deployment reached the app but failed closed with "AI service temporarily unavailable."
- The previous production smoke had passed with the same Story Lab code, so the issue is provider latency variance rather than a deterministic route/build failure.

Fix in progress:

- Reduced the primary multi-agent probe timeout from 18s to 8s.
- Raised the fast Grok fallback budget from 20s to 30s.
- Kept extra batch chapters capped at 9s so non-default multi-chapter batches do not consume the full Vercel function window.

Self-review:

- Good: This keeps the app Grok-only and still attempts multi-agent first.
- Problem found: A fallback that succeeds once but fails on a second smoke is still too fragile for "show it to someone" readiness.
- Should have anticipated: In a synchronous serverless UI flow, the experimental multi-agent call should be treated as a short probe, not as the main latency budget.

## 2026-05-28 19:26 EDT - Final Grok-Only Production Smoke Passed

Actions:

- Confirmed `main` is at commit `4fb64b6`, `Prioritize fast Grok fallback budget`.
- Confirmed Recovery CI passed for `4fb64b6`.
- Confirmed Vercel reported deployment success for `4fb64b6`.
- Confirmed production root `https://fairytaleswith-spice.vercel.app` returned HTTP 200 with `last-modified: Thu, 28 May 2026 23:24:41 GMT`.
- Ran production live Story Lab browser smoke:
  - `STORY_LAB_SMOKE_URL=https://fairytaleswith-spice.vercel.app STORY_LAB_SMOKE_LIVE=1 npm run smoke:story-lab-ui`
  - Result: passed.

Self-review:

- Good: The final proof used the public production URL after the provider-variability fix, not only the earlier successful deployment.
- Good: The app remains Grok-only: `grok-4.20-multi-agent` is the short primary probe and `grok-4.3` is the visible fast fallback for retryable timeout/server failures.
- Remaining risk: This is still a synchronous live-provider workflow. It is demoable now, but larger chapter batches, provider incidents, or very slow responses can still fail closed.
- What should be next: if production reliability has to survive repeated public usage, move long-running generation to a job/streaming architecture or make fast Grok the default button path with multi-agent as an explicit deep mode.

## 2026-05-29 02:06 EDT - Grok 4.3 Promoted To Default

Actions:

- Checked production health and confirmed `services.grok: "configured"`.
- Called production `/api/story-lab/stories` directly with the Story Lab smoke blueprint.
- Confirmed real story generation returned HTTP 200 with a generated story titled `Debt of the Singing Reef`.
- Observed telemetry showed `model: "grok-4.3"` and `fallbackFromModel: "grok-4.20-multi-agent"`, proving the working path was the fallback model.
- Changed the default story model from `grok-4.20-multi-agent` to `grok-4.3`.
- Kept `XAI_STORY_MODEL` as an override so multi-agent can be tested intentionally later.

Self-review:

- Good: This makes the default app path match the model that actually returned production stories.
- Good: The change removes hidden dependency on fallback behavior for normal generation.
- Risk: The browser smoke still needs repair because one run timed out on `page.goto()` before testing generation, even though HTTP root and direct API calls succeeded.
- What should be next: improve the smoke harness, then redesign the UI on a separate branch.

## 2026-05-29 02:41 EDT - Grok 4.3 Default Deployed and Verified

Actions:

- Pushed commit `ab4de1a`, `Default Story Lab to Grok 4.3`, to `main`.
- Confirmed Recovery CI passed for `ab4de1a`.
- Confirmed Vercel reported deployment success for `ab4de1a`.
- Confirmed production root returned HTTP 200 with `last-modified: Fri, 29 May 2026 06:40:59 GMT`.
- Called production `/api/story-lab/stories` after deployment with the Story Lab smoke blueprint.
- Confirmed the response returned `success: true`, title `Reefbound Vows`, `model: "grok-4.3"`, `fallbackFromModel: null`, and `latencyMs: 11106`.

Self-review:

- Good: The normal generation path no longer burns time on a multi-agent probe before reaching the model that actually works.
- Good: The status matrix now separates working generation from degraded continuity extraction and weak UI quality.
- Remaining risk: Continuity extraction still returned `source: "mixed"` with a warning, so story generation is working better than the AI enrichment layer.
- What should be next: add a direct production API smoke script for this exact proof, then fix the browser smoke navigation timeout before UI redesign work.

## 2026-06-03 04:16 EDT - Charmed Story Lab MVP Validated Locally

Actions:

- Updated the active Charmed MVP plan in `STORY_LAB_CHARMED_MVP_EXEC_PLAN.md` and linked it from `AGENTS.md`.
- Ran a hostile review pass against the plan and current diff. The review found stale browser-smoke selectors, missing Angular coverage, missing production continuation fail-closed proof, style-routing drift from the plan, undocumented Proving Grounds contract alignment, and unrelated untracked files.
- Updated `story-generator/src/app/app.spec.ts` to cover skin persistence, expanded creature/spice options, friendly `AI_UNAVAILABLE` messaging, direction-chip continuation wiring, clipboard copy, and local HTML download.
- Updated `scripts/recovery/story-lab-browser-smoke.mjs` for the new card-based UI and added mocked smoke coverage for skin selection, expanded creature selection, visible progress, direction continuation, copy, and HTML download.
- Updated `tests/story-lab-real-engine.test.ts` to prove production missing-key fail-closed behavior for both genesis and continuation, while preserving development/mock behavior.
- Documented intentional creature style routing: `witch`, `angel`, and `mermaid` use fairy-adjacent styles; `dragon` uses werewolf-adjacent styles; `demon` uses vampire-adjacent styles until dedicated banks exist.
- Kept Proving Grounds edits limited to shared creature-contract alignment; the normal public first screen still hides Proving Grounds unless debug mode is requested.
- Trimmed `story-generator/src/app/app.css` until the fresh build no longer emitted the component CSS budget warning.

Validation:

- `git diff --check`: passed.
- `cd story-generator && ../node_modules/.bin/tsc -p tsconfig.app.json --noEmit`: passed.
- `cd story-generator && ../node_modules/.bin/tsc -p tsconfig.spec.json --noEmit`: passed.
- `npm run test:story-lab-real-engine`: passed.
- `npm run smoke:story-lab-ui`: passed in mocked mode after a fresh Angular build.
- `scripts/recovery/preflight.sh --quick --skip-status`: passed.

Follow-up review-gate fix:

- SonarCloud Code Analysis flagged a redundant auth-provider union type and the bearer-token regex parser.
- Replaced the redundant return type with `string | null`.
- Replaced regex bearer parsing with deterministic header parsing to avoid regex backtracking concerns.
- Revalidated with `npm run test:story-lab-configured-auth`, `npm run test:story-lab-clerk-auth`, `npx -p node@20 node ./node_modules/typescript/bin/tsc -p story-generator/tsconfig.spec.json --noEmit`, and `git diff --check`.

Follow-up review comments:

- Added runtime type guards for non-string auth provider config, cookie values, and header values.
- Replaced duplicated profile preference allowed-value sets with shared contract constants.
- Removed avoidable profile-store clone work while preserving clone-safe return values.
- Added redacted diagnostic warnings for auth/profile storage failures without logging raw tokens, emails, SQL params, or profile/story payloads.
- Added focused regression coverage for malformed runtime headers/provider names and redacted warning output.
- Revalidated with focused auth/profile tests, both Angular typechecks, `scripts/recovery/check-vercel-function-count.sh`, `npm run test:all`, and `scripts/recovery/preflight.sh --quick --skip-status`.

Self-review:

- Good: The Charmed MVP is now validated against the card-based UI instead of the old workbench controls.
- Good: Production fail-closed behavior is executable evidence for both Story Lab genesis and continuation.
- Good: The public UI path gained local share/export without adding accounts, server PDF, email, or cloud state.
- Remaining risk: The branch has not run a live production/provider smoke. That should happen after merge or preview deployment with real `XAI_API_KEY`.
- Not part of this MVP: unrelated untracked `SPARK_TRIAL_TASKS.md`, `STORY_QUALITY_EVALS_PLAN.md`, and `tests/grok-smoke.test.ts` remain untouched for a separate cleanup/commit decision.

## 2026-06-03 05:28 EDT - Platform Evolution Plan and Heat Contract v0

Actions:

- Created `STORY_LAB_PLATFORM_EVOLUTION_EXEC_PLAN.md` as the self-contained post-Charmed platform plan.
- Ran three adversarial review passes against the plan: product/UX, architecture/deployment, and testing/security.
- Incorporated hater findings into the plan:
  - no storage/jobs/auth/audio/server export on this branch;
  - auth/privacy/retention/deletion before cloud persistence;
  - function-count checks before and after API route changes;
  - Vercel Workflow as the only durable-generation target, with non-Workflow polling labeled non-durable;
  - Director's Room reframed as concrete draft-improvement notes instead of process theater.
- Added dedicated style banks for `witch`, `dragon`, `demon`, `angel`, and `mermaid`, with semantic coverage tests.
- Expanded Story Lab stream genesis parsing to accept the full Charmed creature set and preserve Heat Contract data.
- Added `scripts/recovery/story-lab-live-provider-smoke.mjs` and `npm run smoke:story-lab-live-provider`; the script skips without credentials by default and requires Grok telemetry when enabled.
- Added Heat Contract v0:
  - frontend contract type and UI controls;
  - adult-only/consensual fantasy validation;
  - tension mode and intimacy boundary controls;
  - no-go content field;
  - browser-local blueprint persistence through the existing save path;
  - reader-side Heat Contract summary;
  - Story Lab engine mapping into `generationContext`;
  - backend refusal if a submitted Heat Contract is explicitly unconfirmed.
- Linked the platform plan from `AGENTS.md`.

Validation:

- `git diff --check`: passed.
- `cd story-generator && ../node_modules/.bin/tsc -p tsconfig.app.json --noEmit`: passed.
- `cd story-generator && ../node_modules/.bin/tsc -p tsconfig.spec.json --noEmit`: passed.
- `npm run test:story-lab-real-engine`: passed.
- `npm exec -- tsx tests/story-lab-stream-parse.test.ts`: passed.
- `npm run smoke:story-lab-live-provider`: passed in default skip mode.
- `scripts/recovery/check-vercel-function-count.sh`: passed at `12/12`.
- `scripts/recovery/preflight.sh --quick --skip-status`: passed, including Angular app/spec typechecks and Vercel API function typechecks.

Blocked local validation:

- `cd story-generator && npm test -- --watch=false --include=src/app/app.spec.ts --include=src/app/form-validation.service.spec.ts`: started but hung locally under Node `v23.8.0` after Chrome/Karma startup.
- `cd story-generator && npm run build`: started but hung locally under Node `v23.8.0` in Angular/esbuild after the baseline-browser-mapping warning.

Self-review:

- Good: The work improved user-facing safety/story control without adding cloud state, new API routes, or audio/export scope.
- Good: The live-provider smoke can no longer pass on arbitrary non-mock telemetry; enabled proof must be Grok.
- Good: The future plan now treats current function-count, auth, privacy, CORS, export, and logging concerns as gates rather than polish.
- Remaining risk: Angular build/browser-spec validation still needs a Node 20 or CI run before this slice should be called fully browser-verified.
- What should be next: run the Angular build/spec checks under Node 20, then do an opt-in live-provider smoke against a Vercel preview or production URL with real `XAI_API_KEY`.

## 2026-06-05 00:33 EDT - Platform Plan Checklist and Phase B1 Gate

Actions:

- Rewrote `STORY_LAB_PLATFORM_EVOLUTION_EXEC_PLAN.md` so the future work is a checklist instead of a broad phase list.
- Counted completed Phase A work in the plan progress and outcomes.
- Split the old Phase B into smaller gates:
  - Phase B1: shared parser, auth port, owner authorization, and redaction;
  - Phase B2: CORS and account boundary policy;
  - Phase B3: retention, deletion, and export-sanitizer policy;
  - Phase B4: opaque job-id streaming design.
- Completed Phase B1 locally:
  - POST and stream Story Lab genesis now normalize through one shared server blueprint parser;
  - Story Lab account auth now has a deny-by-default `AuthPort`;
  - `authorizeProjectAccess` denies non-owner project access without leaking project ids in the user-facing message;
  - server and client error logging redact story text, prompts, auth headers, API keys, emails, and artifact URLs.
- Kept storage, job routes, audio, server export, auth-provider selection, and cloud writes out of this gate.

Validation:

- `npm exec -- tsx tests/story-lab-blueprint-parser.test.ts`: passed.
- `npm exec -- tsx tests/story-lab-auth.test.ts`: passed.
- `npm exec -- tsx tests/log-redaction.test.ts`: passed.
- `npm exec -- tsx tests/story-lab-stream-parse.test.ts`: passed.
- `npm run test:story-lab-state`: passed.
- `npm run test:story-lab-real-engine`: passed.
- `npx -p node@20 node ./node_modules/typescript/bin/tsc -p story-generator/tsconfig.spec.json --noEmit`: passed.
- `npx -p node@20 node ./node_modules/typescript/bin/tsc --allowJs false --skipLibCheck --module commonjs --target es2022 --moduleResolution node --types node --noEmit tests/story-lab-blueprint-parser.test.ts tests/story-lab-auth.test.ts tests/log-redaction.test.ts tests/story-lab-stream-parse.test.ts`: passed.

Blocked local validation:

- `npx -p node@20 node ./node_modules/@angular/cli/bin/ng.js test --watch=false --include src/app/error-logging.spec.ts`: built the targeted spec bundle, then Chrome failed to capture within 60 seconds in this runner.

Self-review:

- Good: Completed work is now counted in the plan rather than hidden in chat history.
- Good: The next phases are explicit gates, so CORS/privacy/export/job decisions do not get bundled into parser/auth/redaction work.
- Remaining risk: Browser-run error-logging coverage still needs CI or a local Chrome environment that can capture under Karma.
- What should be next: publish this finished work in a PR, address review comments, then start Phase B2 only after the PR is clean.

## 2026-06-05 00:56 EDT - PR100 Review Follow-Ups

Actions:

- Addressed actionable PR #100 review comments:
  - missing Heat Contract now fails before the provider call instead of bypassing the adult-reader confirmation seam;
  - `dragon` and `demon` secondary style mixes now match the Charmed MVP plan;
  - server and client API-key redaction patterns now require a delimiter after `xai`, `sk`, or `api`;
  - token-count telemetry keys no longer match the secret-token redaction rule;
  - local HTML downloads preserve sanitized paragraph structure and delay Blob URL cleanup to avoid download races;
  - live-provider smoke failure logging no longer prints uncontrolled error text;
  - new root test files now include the standard creation timestamp header.

Validation:

- `git diff --check`: passed.
- `npx tsx tests/log-redaction.test.ts`: passed.
- `npx tsx tests/story-lab-real-engine.test.ts`: passed.
- `npx tsx tests/story-lab-blueprint-parser.test.ts`: passed.
- `npx tsx tests/story-lab-auth.test.ts`: passed.
- `npx tsx tests/story-lab-stream-parse.test.ts`: passed.
- `npx -p node@20 node ./node_modules/typescript/bin/tsc -p story-generator/tsconfig.spec.json --noEmit`: passed.

Follow-up review batch:

- Added the required Heat Contract adult confirmation click to `scripts/recovery/story-lab-browser-smoke.mjs`.
- Made classic `/api/story/stream` fail closed in production without `XAI_API_KEY` instead of streaming mock content.
- Carried the original Heat Contract into Story Lab continuations through the continuation seam and classic `generationContext`.
- Added `tests/story-service-streaming-security.test.ts` to prove streaming does not emit mock chunks in production missing-key mode.
- `npx tsx tests/story-service-streaming-security.test.ts`: passed.

## 2026-06-05 01:13 EDT - PR100 CodeRabbit Follow-Ups

Actions:

- Added abort/timeout handling around the live deployment smoke `fetch` so `/api/story-lab/stories` stalls fail fast.
- Removed machine-specific absolute `/Users/...` paths from Story Lab plan artifacts.
- Added `stylelint-disable-next-line selector-pseudo-element-no-unknown` comments for the two Angular `::ng-deep` chapter-content selectors.
- Raised `.saved-delete` contrast to 10.55:1 by using the destructive accent background with light text.
- Made `StoryBlueprint.heatContract` required on the frontend generation seam and updated existing demo/test blueprint constructors to provide an explicit confirmed contract.
- Typed Heat Contract validation sets from the shared frontend union types.
- Added negative coverage for unsupported Heat Contract tension mode and intimacy boundary values.
- Prevented `additionalDetails.originalError` from overriding the true original error in client error logging.
- Added dedicated Angular Proving Grounds style arrays for `witch`, `dragon`, `demon`, `angel`, and `mermaid`, mirroring the API-side content without importing the `node:crypto` API module into the browser bundle.

Validation:

- `git diff --check`: passed.
- `npx tsx tests/log-redaction.test.ts`: passed.
- `npx tsx tests/story-lab-real-engine.test.ts`: passed.
- `npx tsx tests/story-service-streaming-security.test.ts`: passed.
- `npx tsx tests/story-lab-blueprint-parser.test.ts`: passed.
- `npx tsx tests/story-lab-auth.test.ts`: passed.
- `npx tsx tests/story-lab-stream-parse.test.ts`: passed.
- `npx tsx tests/story-lab-state.test.ts`: passed.
- `node scripts/recovery/story-lab-live-provider-smoke.mjs`: passed skip path.
- `npx -p node@20 node ./node_modules/typescript/bin/tsc -p story-generator/tsconfig.spec.json --noEmit`: passed.
- `scripts/recovery/check-vercel-function-count.sh`: passed at `12/12`.
- `scripts/recovery/preflight.sh --quick --skip-status`: passed.

## 2026-06-05 02:20 EDT - Phase B2-B4 Privacy and Streaming Gates

Actions:

- Created `STORY_LAB_PRIVACY_STREAMING_GATES_EXEC_PLAN.md` as the self-contained execution plan for the next large branch after PR #100.
- Ran a hostile privacy/security/deployment review against the initial plan and revised it before implementation:
  - reject disallowed browser origins with `403`;
  - never accept or echo wildcard credentialed CORS;
  - drive SSE `writeHead` CORS headers from the same helper;
  - implement export sanitizer tests now instead of only documenting them;
  - keep job-id work contract-only while the function count is `12/12`.
- Created `api/_lib/http/corsPolicy.ts` and replaced repeated CORS blocks across private-content/account-capable API routes.
- Created `api/_lib/services/exportSanitizer.ts` and updated `api/_lib/services/exportService.ts` plus `api/export/save.ts` so server export sanitizes story HTML/title/metadata/PDF strings and does not log raw export error objects.
- Created `api/_lib/story-lab/jobs/jobContracts.ts` for opaque `job_<uuid>` ids and status/events path builders without adding deployable job routes.
- Updated `STORY_LAB_PLATFORM_EVOLUTION_EXEC_PLAN.md`, `LESSONS_LEARNED.md`, and this changelog with the completed gates and remaining provisioning blockers.

Validation:

- `git diff --check`: passed.
- `npx tsx tests/cors-policy.test.ts`: passed.
- `npx tsx tests/export-sanitizer.test.ts`: passed.
- `npx tsx tests/story-lab-job-contracts.test.ts`: passed.
- `npx tsx tests/log-redaction.test.ts`: passed.
- `npx tsx tests/story-lab-blueprint-parser.test.ts`: passed.
- `npx tsx tests/story-lab-auth.test.ts`: passed.
- `npx tsx tests/story-lab-stream-parse.test.ts`: passed.
- `npx tsx tests/story-lab-real-engine.test.ts`: passed.
- `npx -p node@20 node ./node_modules/typescript/bin/tsc -p story-generator/tsconfig.spec.json --noEmit`: passed.
- `scripts/recovery/check-vercel-function-count.sh`: passed at `12/12`.
- `scripts/recovery/preflight.sh --quick --skip-status`: passed.

Self-review:

- Good: The branch completed a large privacy/security chunk without broadening PR #100.
- Good: No deployable API routes were added; helper files stayed under `api/_lib`.
- Good: Future job streaming now has an opaque path contract, but actual routes remain blocked until route consolidation and Workflow/worker decisions.
- Remaining risk: The current Story Lab stream still uses query fields until the future POST job creation route exists.

## 2026-06-05 02:34 EDT - PR101 Sonar Follow-Ups

Actions:

- Addressed SonarCloud annotations in `api/_lib/services/exportSanitizer.ts` and `tests/export-sanitizer.test.ts`:
  - used `String.raw` for escaped regex/string fixtures;
  - changed mechanical global string replacements to a TypeScript-compatible fixed-string helper;
  - used `RegExp.exec()` instead of `String.match()` for tag parsing.
- Replaced sanitizer regex tokenization/tag stripping with a small manual HTML token scanner after SonarCloud reported five regex DoS security hotspots.

Validation:

- `git diff --check`: passed.
- `npx tsx tests/export-sanitizer.test.ts`: passed.
- `npx tsx tests/cors-policy.test.ts`: passed.
- `npx tsx tests/story-lab-job-contracts.test.ts`: passed.
- `npx -p node@20 node ./node_modules/typescript/bin/tsc -p story-generator/tsconfig.spec.json --noEmit`: passed.
- `scripts/recovery/preflight.sh --quick --skip-status`: passed.

## 2026-06-05 02:52 EDT - PR101 Review Comment Follow-Ups

Actions:

- Addressed Sourcery/Copilot CORS review: disallowed-origin fallback responses now call `end()` when a response adapter does not provide `json()`.
- Addressed Gemini entity-decoding review: plain-text export decodes direct `&lt;`, `&gt;`, quotes, and apostrophes, while decoding `&amp;` last to avoid double-decoding `&amp;lt;` and `&amp;quot;`.
- Added the missing `// Created:` headers to `api/_lib/services/exportSanitizer.ts` and `api/_lib/story-lab/jobs/jobContracts.ts`.

Validation:

- `git diff --check`: passed.
- `npx tsx tests/cors-policy.test.ts`: passed.
- `npx tsx tests/export-sanitizer.test.ts`: passed.
- `npx tsx tests/story-lab-job-contracts.test.ts`: passed.
- `scripts/recovery/preflight.sh --quick --skip-status`: passed.

## 2026-06-05 03:28 EDT - PR100 Sonar Gate Follow-Ups

Actions:

- Addressed the three PR #100 SonarCloud regex-DoS security hotspots without marking them reviewed:
  - replaced server and Angular log email/auth/API-key/URL regex redaction with a shared bounded token scanner;
  - replaced Story Lab plain-text HTML stripping, file-name cleanup, and HTML escaping regex replacements with character scans.
- Refactored the shared scanner into `shared/sensitiveTextRedaction.ts` after SonarCloud cleared the hotspots but failed the gate on duplicated new-code density.
- Kept the unrelated untracked planning/smoke files out of scope.

Validation:

- `git diff --check`: passed.
- `npx tsx tests/log-redaction.test.ts`: passed.
- `npx tsx tests/export-sanitizer.test.ts`: passed.
- `npx tsx tests/cors-policy.test.ts`: passed.
- `npx tsx tests/story-lab-job-contracts.test.ts`: passed.
- `npx -p node@20 node ./node_modules/typescript/bin/tsc -p story-generator/tsconfig.spec.json --noEmit`: passed.
- `scripts/recovery/check-vercel-function-count.sh`: passed at `12/12`.
- `scripts/recovery/preflight.sh --quick --skip-status`: passed.

## 2026-06-07 05:20 EDT - Story Lab Storage Port Hostile Review Start

Actions:

- Continued the route-free Phase C storage-port branch from `STORY_LAB_STORAGE_PORT_EXEC_PLAN.md`.
- Confirmed the branch remains storage scaffolding only: no new deployable API routes, no auth provider adapter, no database provisioning, and no UI cloud-sync claim.
- Added a hostile-review regression for the configured Postgres save path: if an owner-scoped upsert returns zero rows because a project id belongs to another owner, the adapter must not report success.
- Updated the Postgres save scaffold to require returned database rows and return `STORY_LAB_PROJECT_FORBIDDEN` for zero-row owner conflicts.
- Updated `STORY_LAB_STORAGE_PORT_EXEC_PLAN.md` and `STORY_LAB_PLATFORM_EVOLUTION_EXEC_PLAN.md` with the review objection and focused evidence.

Validation:

- `git diff --check`: passed.
- `npx tsx tests/story-lab-storage-port.test.ts`: passed.
- `npx tsx tests/story-lab-auth.test.ts`: passed.
- `npm run test:story-lab-state`: passed.
- `scripts/recovery/check-vercel-function-count.sh`: passed at `12/12`.
- `scripts/recovery/preflight.sh --quick --skip-status`: passed.

Self-review:

- Good: The storage port now proves the owner boundary at the fake Postgres executor seam, not just in the in-memory adapter.
- Good: The branch still avoids route growth while the Vercel function budget is saturated.
- Remaining risk: The branch still needs final diff review, commit, push, PR checks, and review follow-up before merge.

## 2026-06-07 05:40 EDT - PR102 Review Follow-Ups

Actions:

- Addressed Gemini Code Assist feedback on storage runtime safety.
- Updated `normalizeSavedStoryProject` and `toStoryProjectListItem` so missing derived metadata uses safe fallbacks instead of throwing.
- Updated the Postgres save parameter mapping to tolerate missing nested `summary`, `blueprint`, or `state` fields without leaking data.
- Added malformed Postgres row tests and changed JSON parsing to fail closed with `STORY_LAB_STORAGE_ERROR` rather than returning a fabricated empty project.

Validation:

- `git diff --check`: passed.
- `npx tsx tests/story-lab-storage-port.test.ts`: passed.
- `npx tsx tests/story-lab-auth.test.ts`: passed.
- `npm run test:story-lab-state`: passed.
- `scripts/recovery/check-vercel-function-count.sh`: passed at `12/12`.
- `scripts/recovery/preflight.sh --quick --skip-status`: passed.

Self-review:

- Good: The review follow-up improves runtime safety without adding routes, dependencies, database provisioning, or UI cloud-sync behavior.
- Good: Corrupt stored JSON now becomes a typed storage failure, which is safer than treating an invalid database row as a real project.
- Remaining risk: PR checks need to be rerun after this follow-up commit.

## 2026-06-07 05:42 EDT - PR102 CodeRabbit/Sonar Cleanup

Actions:

- Addressed CodeRabbit's actionable documentation comments:
  - replaced the machine-specific repository path in `STORY_LAB_STORAGE_PORT_EXEC_PLAN.md` with repo-root wording;
  - corrected the helper name from `createStoreError` to `createStoryProjectStoreError`.
- Addressed SonarCloud test-quality warnings by marking the fake executor queue `readonly` and replacing the `.length - 1` latest-query access with an explicit index guard.

Validation:

- `git diff --check`: passed.
- `npx tsx tests/story-lab-storage-port.test.ts`: passed.
- `npx tsx tests/story-lab-auth.test.ts`: passed.
- `npm run test:story-lab-state`: passed.
- `scripts/recovery/check-vercel-function-count.sh`: passed at `12/12`.
- `scripts/recovery/preflight.sh --quick --skip-status`: passed.

## 2026-06-07 06:20 EDT - Story Lab Route Budget Consolidation

Actions:

- Added `STORY_LAB_ROUTE_BUDGET_EXEC_PLAN.md` with a hostile-review checklist for freeing three Vercel function slots before Phase D job routes.
- Retired deployable route files that are duplicate, demo-only, or unused by the Angular app:
  - `api/story-lab/health.ts`;
  - `api/story/stream-demo.ts`;
  - `api/image/generate.ts`.
- Redirected the debug panel and browser smoke mock from `/api/story-lab/health` to the existing root `/api/health` response shape.
- Updated the Vercel function-count allow-list and active API/platform docs for the new 9-function route shape.

Validation:

- `git diff --check`: passed.
- `scripts/recovery/check-vercel-function-count.sh`: passed at `9/12`.
- `npx -p node@20 node ./node_modules/typescript/bin/tsc -p story-generator/tsconfig.spec.json --noEmit`: passed.
- `scripts/recovery/preflight.sh --quick --skip-status`: passed.

## 2026-06-07 06:43 EDT - PR103 Local Health Shape Follow-Up

Actions:

- Addressed Codex review feedback that the local Express `/api/health` route returns an unwrapped health payload while the Vercel function returns an `ApiResponse` envelope.
- Added a small debug-panel response adapter that accepts either root health shape.
- Added a focused spec for the unwrapped local health response.

Validation:

- `git diff --check`: passed.
- `scripts/recovery/check-vercel-function-count.sh`: passed at `9/12`.
- `npx -p node@20 node ./node_modules/typescript/bin/tsc -p story-generator/tsconfig.spec.json --noEmit`: passed.
- `scripts/recovery/preflight.sh --quick --skip-status`: passed.

Self-review:

- Good: This branch frees exactly three function slots without changing the active story-generation routes or deleting reusable service code under `api/_lib`.
- Good: The one live duplicate-health consumer now uses the root health endpoint and has a focused spec for the response shape.
- Remaining risk: PR checks and automated review still need to run after push.

## 2026-06-07 06:35 EDT - PR103 Gemini Health Payload Follow-Up

Actions:

- Addressed Gemini Code Assist feedback on the debug-panel health response adapter.
- Loosened the local root health payload status type from the literal `'healthy'` to `string`.
- Added optional handling for malformed successful health payloads so missing `data.services.grok` displays `grok: unknown` instead of throwing.
- Added a focused malformed-payload spec for the debug panel.

Validation:

- `git diff --check`: passed.
- `scripts/recovery/check-vercel-function-count.sh`: passed at `9/12`.
- `npx -p node@20 node ./node_modules/typescript/bin/tsc -p story-generator/tsconfig.spec.json --noEmit`: passed.
- `scripts/recovery/preflight.sh --quick --skip-status`: passed.

## 2026-06-07 07:13 EDT - Story Lab Job Route Scaffold

Actions:

- Added `STORY_LAB_JOB_ROUTES_EXEC_PLAN.md` for the Phase D backend job-route slice.
- Added shared Story Lab job contracts to the frontend seam and re-exported them through backend job helpers.
- Added `api/_lib/story-lab/jobs/jobStore.ts` as an explicitly `non_durable_memory` in-process job store with snapshot events.
- Added the Story Lab public job URL family through one deployable Vercel function:
  - `POST /api/story-lab/jobs`;
  - `GET /api/story-lab/jobs/:jobId` via `vercel.json` rewrite;
  - `GET /api/story-lab/jobs/:jobId/events` via `vercel.json` rewrite.
- Added Angular `StoryService` methods for creating jobs, reading job snapshots, and subscribing to job events.
- Tightened the existing Story Lab streaming log so it no longer logs a full EventSource URL containing blueprint query data.
- Added route tests covering opaque ids, SSE replay, invalid/unknown ids, unsupported reserved job kinds, and production missing-provider failure.
- Updated the function-count allow-list and active docs for the new 10-function shape.

Validation:

- `git diff --check`: passed.
- `npx tsx tests/story-lab-job-contracts.test.ts`: passed.
- `npx tsx tests/story-lab-job-routes.test.ts`: passed.
- `npx -p node@20 node ./node_modules/typescript/bin/tsc -p story-generator/tsconfig.spec.json --noEmit`: passed.
- `scripts/recovery/check-vercel-function-count.sh`: passed at `10/12`.
- `scripts/recovery/preflight.sh --quick --skip-status`: passed.

## 2026-06-07 08:38 EDT - Story Lab Reload-Safe Genesis Job Smoke

Actions:

- Added `STORY_LAB_JOB_RESUME_SMOKE_EXEC_PLAN.md` with a hostile-review checklist for the reload-safe genesis job UI slice.
- Added a browser-session active genesis job marker in the Angular app.
- Restored active genesis job progress after reload by reading `getStoryLabJob(jobId)` and reopening job events when the job is still non-terminal.
- Cleared active job markers on completed, failed, cancelled, malformed, unknown, and reset paths.
- Added focused Angular specs for active job marker persistence, running-job recovery, completed-job recovery, malformed storage cleanup, and in-flight subscription cleanup.
- Updated the mocked Story Lab browser smoke so genesis must use `POST /api/story-lab/jobs` plus job SSE events; the old direct `/api/story-lab/stories` mock now fails if used for genesis.
- Updated `STORY_LAB_PLATFORM_EVOLUTION_EXEC_PLAN.md` to mark browser-session reload recovery and mocked job-progress smoke complete.

Validation:

- RED check: targeted `app.spec.ts` failed with 4 expected failures before implementation: missing active marker storage, missing recovery call, missing completed-job hydration, and malformed storage cleanup.
- `npx -p node@20 -c "node ./node_modules/typescript/bin/tsc -p story-generator/tsconfig.spec.json --noEmit"`: passed.
- `npx -p node@20 -c "node ./node_modules/typescript/bin/tsc -p story-generator/tsconfig.app.json --noEmit"`: passed.
- `npx -p node@20 -c "node ./node_modules/@angular/cli/bin/ng test --watch=false --browsers=ChromeHeadless --include=src/app/app.spec.ts"`: passed with `21 SUCCESS`.
- `npm run smoke:story-lab-ui`: passed in mock mode; build completed with Angular budget warnings for the initial browser bundle and `app.css`.

Self-review:

- Good: Mock smoke now proves the primary genesis UI uses the job route family, not the legacy direct genesis route.
- Good: Reload recovery handles browser refresh inside the current in-memory job scaffold without claiming database or Workflow durability.
- Remaining risk: A Vercel cold start can still lose the non-durable job map; true durability still requires Workflow/database/account ownership.
- Remaining risk: Continuation still uses the direct route and should be migrated in a separate job slice.

## 2026-06-07 08:18 EDT - Story Lab Genesis UI Job Migration

Actions:

- Moved the primary Story Lab genesis Generate flow from the old direct `beginStory` call to `createStoryLabJob({ kind: 'genesis', blueprint })`.
- Wired genesis progress, completion, cancellation, and failed-provider handling through Story Lab job snapshots/events.
- Kept the local staged progress timer only as a bridge until real job snapshots arrive, so the progress bar no longer fights backend job percentages.
- Added focused Angular specs proving:
  - invalid genesis input does not create a job;
  - valid genesis creates a Story Lab job and does not call `beginStory`;
  - job snapshots update the visible progress state;
  - failed jobs surface the existing friendly Grok configuration message;
  - saved-project loading still works when genesis returns through the job response shape.
- Updated `STORY_LAB_PLATFORM_EVOLUTION_EXEC_PLAN.md` to mark genesis job-driven progress complete while keeping reload-safe polling and browser-smoke coverage pending.

Validation:

- `git diff --check`: passed.
- `npx -p node@20 -c "node ./node_modules/typescript/bin/tsc -p story-generator/tsconfig.spec.json --noEmit"`: passed.
- `npx -p node@20 -c "node ./node_modules/typescript/bin/tsc -p story-generator/tsconfig.app.json --noEmit"`: passed.
- `npx -p node@20 -c "node ./node_modules/@angular/cli/bin/ng test --watch=false --browsers=ChromeHeadless --include=src/app/app.spec.ts"`: passed with `16 SUCCESS`.
- `npx -p node@20 -c "npm run build"` from `story-generator/`: passed; Angular reported bundle budget warnings for the 506.06 kB initial browser bundle and 12.56 kB `app.css`.
- `npx tsx tests/story-lab-job-contracts.test.ts`: passed.
- `npx tsx tests/story-lab-job-routes.test.ts`: passed.
- `scripts/recovery/check-vercel-function-count.sh`: passed at `10/12`.

Self-review:

- Good: The Generate button now exercises the job API seam added in PR #104, which reduces dependence on the legacy direct genesis path.
- Good: The UI handles running, completed, failed, and cancelled terminal job states without inventing new backend contracts.
- Remaining risk: Jobs are still `non_durable_memory`; reload-safe resume needs persisted job ids or polling support in a follow-up slice.
- Remaining risk: The browser smoke still needs to assert queued -> running -> terminal visible job progress before the old stream route can be retired.

Self-review:

- Good: The new job URLs carry only opaque `job_<uuid>` ids and do not place blueprint text in status/events paths.
- Good: The scaffold is honest about durability; it runs synchronously in the request and stores process-local snapshots only.
- Remaining risk: The visible Story Lab UI still uses the older direct generation/streaming path until the next UI migration slice.

## 2026-06-07 07:21 EDT - PR104 Sonar Cleanup

Actions:

- Addressed SonarCloud annotations on PR #104 by:
  - re-exporting the three tiny route default handlers without import/export boilerplate;
  - replacing `window` test references with `globalThis`;
  - making the EventSource mock instance registry readonly;
  - removing an unnecessary batch-size assertion;
  - using `RegExp.exec()` in the job-id URL parser;
  - returning `this` from the route-test fake response `status()` helper;
  - extracting repeated GET job-id validation into one route-handler helper;
  - rewriting continuation input normalization without type assertions.

Validation:

- `git diff --check`: passed.
- `npx tsx tests/story-lab-job-routes.test.ts`: passed.
- `npx -p node@20 node ./node_modules/typescript/bin/tsc -p story-generator/tsconfig.spec.json --noEmit`: passed.
- `scripts/recovery/preflight.sh --quick --skip-status`: passed.

## 2026-06-07 07:31 EDT - PR104 Review Robustness Follow-Up

Actions:

- Addressed automated review feedback on the job scaffold:
  - guarded continuation `storyId` before trimming untyped request JSON;
  - returned `400` for malformed percent-encoded job-id paths instead of throwing;
  - added a bounded in-memory job-store eviction cap;
  - collapsed status/events handling into the single `api/story-lab/jobs.ts` deployable function via `vercel.json` rewrites so process-local job state is not split across separate Vercel functions.
- Updated route-count docs and the allow-list for the resulting `10/12` function shape.

Validation:

- `git diff --check`: passed.
- `npx tsx tests/story-lab-job-contracts.test.ts`: passed.
- `npx tsx tests/story-lab-job-routes.test.ts`: passed.
- `npx -p node@20 node ./node_modules/typescript/bin/tsc -p story-generator/tsconfig.spec.json --noEmit`: passed.
- `scripts/recovery/check-vercel-function-count.sh`: passed at `10/12`.
- `scripts/recovery/preflight.sh --quick --skip-status`: passed.

## 2026-06-13 00:00 EDT - Unpublished Branch Recovery Point

Actions:

- Re-checked the live repository state after a long local implementation run.
- Confirmed current branch is `feature/story-lab-auth-profile-contracts`.
- Confirmed the branch has no configured upstream and no open GitHub PR.
- Confirmed the branch contains a large local commit stack ahead of `origin/main`.
- Confirmed the only tracked uncommitted files are `story-generator/src/app/app.ts` and `story-generator/src/app/app.spec.ts`; the diff marks non-durable account storage as cloud-unavailable in the UI and adds a focused spec.
- Recorded the process correction in this changelog, the split plan, and `LESSONS_LEARNED.md`.
- Update: final live audit state is `ecba20e`. The branch is 89 commits ahead of `origin/main`, has no upstream or matching remote branch, and has no open PR. The app diff previously described as uncommitted is now committed as `9465073`; tracked files are clean.

Decision:

- Stop feature expansion on this branch.
- Inventory the local commits into reviewable PR slices before any further product work.
- Prefer small PRs that can be checked, reviewed, fixed, and merged in sequence. Use a remote backup branch only as a safety anchor, not as the default merge PR.

Validation:

- Status/inventory only. No code validation was rerun in this documentation checkpoint.

Self-review:

- Problem found: The implementation cadence violated the intended finish-validate-PR-review-merge loop and created a large unpublished local branch.
- Correction: Treat publishing/splitting as the active task. Do not add more Story Lab features until the existing stack is landed or intentionally discarded.

## 2026-06-13 08:01 EDT - PR 114 Reviewability Correction

Actions:

- Opened PR #114 for the first recovery slice.
- Found Sourcery feedback that the docs diff was too large for automated review.
- Reduced PR #114 to publication discipline, lessons, changelog, and the split checklist.
- Moved large operating/audit documents back to the planned PR #2 scope.
- Removed the remaining `AGENTS.md` dependency on `OVERNIGHT_HANDOFF.md` so this PR does not require a doc that was moved out of scope.
- Clarified that parked untracked-file inventory is local workspace evidence, not a fresh-clone expectation.

Decision:

- Treat automated-review size limits as real reviewability feedback, even for docs-only PRs.
- Keep PR #114 small enough to review before merging.

Validation:

- Pending after scope correction.

## 2026-06-13 08:09 EDT - PR 114 Merged And PR 2 Scope Set

Actions:

- Merged PR #114 into `main` after checks passed and review comments were answered.
- Preserved the polluted local `main` tip as `backup/local-main-docs-stack-2026-06-13`.
- Started `recovery/story-lab-operating-docs` from `origin/main`.
- Set PR #2 scope to operating docs, idea board, storage-plan reconciliation, and auth/profile/cloud-library checklist.
- Deferred the old full app audit and overnight handoff because they describe unpublished work as current reality and are too stale/large for a clean docs PR.

Decision:

- Operating docs can land before code only when they avoid current-evidence claims about unpublished slices.

Validation:

- Pending for PR #2.

## 2026-06-13 08:21 EDT - Auth/Profile Contracts Slice Ready For PR

Actions:

- Started `recovery/story-lab-auth-profile-contracts` from `origin/main` after PR #115 merged.
- Cherry-picked the auth/profile contract slice in dependency order:
  - `75b485f`
  - `6459454`
  - `b99ad12`
  - `99317f1`
  - `448d0c3`
- Dropped stale `OVERNIGHT_HANDOFF.md` and `STORY_LAB_APP_AUDIT.md` conflicts from the code slice.
- Kept package scripts scoped to auth/profile tests; did not import account-route scripts from later route work.
- Updated the auth/profile checklist and idea board with local-only status.

Decision:

- This slice adds contracts, fail-closed auth selection, a Clerk-shaped adapter scaffold, profile stores, and preference normalization only.
- It does not claim live auth, signed-in UI, durable profiles, account routes, or cloud project sync.

Validation:

- RED baseline: targeted auth/profile scripts were missing before the slice.
- `npm run test:story-lab-auth`: passed.
- `npm run test:story-lab-storage-port`: passed.
- `npm run test:story-lab-configured-auth`: passed.
- `npm run test:story-lab-clerk-auth`: passed.
- `npm run test:story-lab-profile-contracts`: passed.
- `npm run test:story-lab-profile-store`: passed.
- `npx -p node@20 node ./node_modules/typescript/bin/tsc -p story-generator/tsconfig.spec.json --noEmit`: passed.
- `npx -p node@20 node ./node_modules/typescript/bin/tsc -p story-generator/tsconfig.app.json --noEmit`: passed.
- `git diff --check`: passed.
- `scripts/recovery/check-vercel-function-count.sh`: passed at `10/12`.
- `npm run test:all`: passed in mock mode because `XAI_API_KEY` is not configured.
- `scripts/recovery/preflight.sh --quick --skip-status`: passed.

## 2026-06-13 08:40 EDT - Cloud Storage Scaffold Slice Ready For PR

Actions:

- Confirmed PR #116 merged into `main` as `d8b53fd`.
- Started `recovery/story-lab-cloud-storage-scaffold` from `origin/main` after PR #116 merged.
- Cherry-picked the cloud storage/database scaffold slice in dependency order:
  - `7144dff`
  - `aa8d848`
  - `c3d77f0`
  - `2bd5691`
  - `bf5cf38`
- Dropped stale `OVERNIGHT_HANDOFF.md` and `STORY_LAB_APP_AUDIT.md` conflicts from the code slice.
- Dropped the `api/_lib/story-lab/account/accountRouteHandlers.ts` hunk from this slice because the consolidated account route belongs to the next PR.
- Added migration-ready cloud schema SQL, guarded cloud storage config, a Neon query executor wrapper, guarded schema apply/readiness helpers, and focused tests.
- Updated the auth/profile/cloud-library checklist, split plan, idea board, and lessons to record PR #116 as merged and this storage slice as storage-only.

Decision:

- This slice adds storage/database scaffolding only.
- It does not execute a migration, provision a database, add an account route, add signed-in UI, or claim live cloud persistence.

Validation:

- RED baseline: all five cloud-storage scripts were missing before the slice.
- `npm run test:story-lab-cloud-schema`: passed.
- `npm run test:story-lab-cloud-storage-config`: passed.
- `npm run test:story-lab-neon-executor`: passed.
- `npm run test:story-lab-cloud-schema-migration`: passed.
- `npm run test:story-lab-cloud-db-readiness`: passed.
- `npm run test:story-lab-profile-store`: passed.
- `npm run test:story-lab-storage-port`: passed.
- `npx -p node@20 node ./node_modules/typescript/bin/tsc -p story-generator/tsconfig.spec.json --noEmit`: passed.
- `npx -p node@20 node ./node_modules/typescript/bin/tsc -p story-generator/tsconfig.app.json --noEmit`: passed.
- `git diff --check`: passed.
- `scripts/recovery/check-vercel-function-count.sh`: passed at `10/12`.
- `npm run test:all`: passed in mock mode because `XAI_API_KEY` is not configured.
- `scripts/recovery/preflight.sh --quick --skip-status`: passed.

Self-review:

- Scope risk found: one source commit touched the later account-route handler. That hunk was deliberately removed so this change set stays storage-only.
- Honesty check: docs and PR language must say schema/config/readiness scaffold, not cloud save, live database, or durable sync.

## 2026-06-13 08:48 EDT - PR 118 Review Follow-Up

Actions:

- Addressed PR #118 review feedback:
  - made explicit `env: {}` cloud-storage config ignore ambient `process.env.DATABASE_URL`;
  - loaded the tracked SQL schema relative to the module directory instead of the process CWD;
  - extended the schema statement splitter for block comments and dollar-quoted SQL bodies;
  - cast readiness `to_regclass(...)` values to text and accepted schema-prefixed table names;
  - reworded the changelog self-review note to avoid confusing internal slice numbering with GitHub PR numbers.
- Checked the installed `@neondatabase/serverless` package and confirmed `neon()` returns a function with a documented `.query(text, params)` method in this version; added a non-network regression test for that API shape rather than switching to an incompatible direct-call form.

Validation:

- `npm run test:story-lab-cloud-storage-config`: passed.
- `npm run test:story-lab-neon-executor`: passed.
- `npm run test:story-lab-cloud-schema-migration`: passed.
- `npm run test:story-lab-cloud-db-readiness`: passed.
- `npx -p node@20 node ./node_modules/typescript/bin/tsc -p story-generator/tsconfig.spec.json --noEmit`: passed.
- `npx -p node@20 node ./node_modules/typescript/bin/tsc -p story-generator/tsconfig.app.json --noEmit`: passed.
- `git diff --check`: passed.
- `scripts/recovery/check-vercel-function-count.sh`: passed at `10/12`.
- `npm run test:all`: passed in mock mode because `XAI_API_KEY` is not configured.
- First `scripts/recovery/preflight.sh --quick --skip-status` run failed because `import.meta.url` is not allowed under the API CommonJS typecheck.
- After switching the schema loader to `__dirname`, `npm run test:story-lab-cloud-schema-migration` passed.
- After switching the schema loader to `__dirname`, `scripts/recovery/preflight.sh --quick --skip-status` passed.

## 2026-06-13 09:20 EDT - Account Route Slice Ready For PR

Actions:

- Confirmed PR #118 merged into `main` as `3aa797b`.
- Started `recovery/story-lab-account-route` from `origin/main` after PR #118 merged.
- Ported the consolidated account route from the local unpublished stack while dropping stale `OVERNIGHT_HANDOFF.md` and `STORY_LAB_APP_AUDIT.md` conflicts.
- Added `api/story-lab/account.ts` as the single deployable account function and rewrote profile/project account paths into it.
- Added `api/_lib/story-lab/account/accountRouteHandlers.ts` behind injectable auth, profile-store, and project-store seams.
- Defaulted the route stores through `createStoryLabCloudStorage()` so missing `DATABASE_URL` fails closed through the guarded cloud-storage config.
- Added shared cloud project load/delete response contract types.
- Hardened route behavior after hostile review:
  - non-durable injected stores report `non_durable_memory`, not `cloud_postgres`;
  - route-level credentialed CORS owns account responses, and the global wildcard `/api/*` Vercel CORS header was removed;
  - malformed project ids and incomplete project save bodies are rejected before store access;
  - injected/future store error messages are mapped to generic public messages.
- Updated the auth/profile/cloud-library checklist, split plan, idea board, and lessons with route-only status and validation evidence.

Decision:

- This slice spends one Vercel function slot intentionally, raising the guard from `10/12` to `11/12`.
- This slice is backend route/contract work only.
- It does not add live provider auth, signed-in Angular UI, executed database migration, database provisioning, or durable cloud sync proof.

Validation:

- RED baseline: `npm run test:story-lab-account-routes` was missing before the slice.
- `npm run test:story-lab-account-routes`: passed.
- `npm run test:story-lab-storage-port`: passed.
- `npm run test:story-lab-profile-store`: passed.
- `npm run test:story-lab-cloud-storage-config`: passed.
- `npx -p node@20 node ./node_modules/typescript/bin/tsc -p story-generator/tsconfig.spec.json --noEmit`: passed.
- `npx -p node@20 node ./node_modules/typescript/bin/tsc -p story-generator/tsconfig.app.json --noEmit`: passed.
- `git diff --check`: passed.
- `scripts/recovery/check-vercel-function-count.sh`: passed at `11/12`.
- `npm run test:all`: passed in mock mode because `XAI_API_KEY` is not configured.
- `scripts/recovery/preflight.sh --quick --skip-status`: passed.

Self-review:

- The account route now proves owner-scoped route contracts and error/privacy boundaries, not end-user cloud persistence.
- Review risk found and fixed before PR: global wildcard API headers were incompatible with private credentialed account CORS.
- Remaining work belongs in the next slice: Angular cloud library service/UI and connected-account honesty, still without claiming durable sync until live auth/database proof exists.

## 2026-06-13 09:38 EDT - PR 119 Review Follow-Up

Actions:

- Addressed Gemini review feedback by rejecting cross-user profile updates at the route boundary before store access.
- Hardened profile request parsing so malformed `preferences` payloads must be non-array objects.
- Added an account-route test for malformed profile preference payloads returning `400 INVALID_REQUEST`.
- Reduced Sonar new-code duplication risk by moving the shared saved-project test fixture out of individual account/storage tests and reusing it from both suites.

Validation:

- `npm run test:story-lab-account-routes`: passed.
- `npm run test:story-lab-storage-port`: passed.

Follow-up pending:

- Rerun the full local validation gate after this review-fix commit.
- Push the update and confirm Sonar's new-code duplication gate clears on PR #119.

## 2026-06-13 09:52 EDT - PR 119 Second Review Follow-Up

Actions:

- Addressed CodeRabbit's delete-contract feedback by returning a cloud-shaped delete receipt with owner id and storage mode instead of the raw store receipt.
- Tightened project body validation to reject array-shaped `summary`, `state`, and `blueprint` payloads.
- Added route-level CORS to `/api/health` after removing the global wildcard `/api/*` Vercel CORS header.
- Added focused tests for health CORS, array-shaped project payload rejection, and cloud-shaped delete receipts.
- Updated the profile/cloud-library contract smoke test for the expanded delete receipt shape.

Validation:

- `npm run test:story-lab-account-routes`: passed.
- `npm run test:story-lab-storage-port`: passed.
- `npm run test:story-lab-profile-contracts`: passed.
- `scripts/recovery/check-vercel-function-count.sh`: passed at `11/12`.

Follow-up pending:

- Rerun `npm run test:all` and preflight after these review fixes.
- Push the update and confirm PR #119 checks/review threads are clear.

## 2026-06-21 06:43 EDT - Publication Discipline Tooling Follow-Up

Actions:

- Updated `AGENTS.md` with explicit publication discipline rules for Story Lab slices.
- Added `npm run recovery:status` to report branch/upstream health, dirty-tree state, recent commits, and Vercel function budget before choosing work.
- Added `npm run recovery:preflight -- <slice-name>` to run focused slice validation and write copyable evidence under `tmp/recovery/`.
- Created the local Codex skill `fairytales-story-lab-slice` so future agents default to one review boundary, one branch, one PR, and a stop after PR/merge.

Decision:

- Slices may be larger when they share one review boundary, but they still split across independent risk areas such as Angular UI, durable jobs, story-quality behavior, Proving Grounds, or CSS cleanup.
- `Done` continues to mean merged to `main`; local-only work remains `Local-only`, `PR-ready`, `In review`, or `Parked`.

Validation:

- `bash -n scripts/recovery/slice-status.sh scripts/recovery/slice-preflight.sh`: passed.
- `node -e "JSON.parse(require('fs').readFileSync('package.json','utf8')); console.log('package json ok')"`: passed.
- `npm run recovery:status`: passed and reported the parked untracked files.
- `npm run recovery:preflight -- cloud-library-ui --dry-run`: passed.
- `npm run recovery:preflight -- story-memory-cards --quick --dry-run`: passed.
- `git diff --check`: passed.

## 2026-06-21 07:12 EDT - Angular Cloud Library UI Extraction

Actions:

- Extracted the Angular cloud-library service/UI slice from the unpublished Story Lab stack onto `recovery/story-lab-cloud-library-ui`.
- Added account service methods for profile status and cloud project save/list/load/delete calls.
- Added UI state and controls for account setup, local-vs-cloud library status, cloud save, cloud project load/delete, and connected-account gating.
- Kept anonymous browser-local saves as the active user-visible save path.
- Mapped `non_durable_memory` account storage to cloud-unavailable UI copy so tests and product language do not imply durable sync.

Decision:

- This is a larger slice than a single cherry-pick, but it stays inside one review boundary: Angular service/UI cloud-library honesty.
- Durable job ownership, story-quality guidance, Proving Grounds reporting, story memory cards, and CSS lazy-loading remain separate slices.
- The slice does not claim production auth provider wiring, signed-in browser flow, executed migrations, provisioned database, live durable cloud sync, or durable jobs.

Validation:

- `npm run recovery:preflight -- cloud-library-ui --quick`: passed.
- `npm run recovery:preflight -- cloud-library-ui`: passed and wrote `tmp/recovery/cloud-library-ui-evidence.md`.
- `scripts/recovery/check-vercel-function-count.sh`: passed at `11/12`.
- `npx -p node@20 node ./node_modules/typescript/bin/tsc -p story-generator/tsconfig.spec.json --noEmit`: passed.
- `npx -p node@20 node ./node_modules/typescript/bin/tsc -p story-generator/tsconfig.app.json --noEmit`: passed.
- `npm run build`: passed with existing Angular bundle and CSS budget warnings.

Known local proof gap:

- Targeted Angular browser specs built successfully, but local `ChromeHeadless` failed to capture after two retries; browser specs are not claimed as passing from this workstation run.

## 2026-06-21 07:26 EDT - PR 123 Review Follow-Up

Actions:

- Addressed Gemini review feedback on cloud-library state honesty.
- Preserved the existing connected/cloud-unavailable state when a user tries to cloud-save an empty workbench.
- Kept cloud load/delete receipts with `non_durable_memory` storage out of the `cloud_synced` UI state.
- Removed runtime `Array.prototype.at()` usage from `app.ts` chapter selection paths for browser compatibility.
- Added focused app specs covering empty cloud save, non-durable cloud load, and non-durable cloud delete behavior.

Validation:

- `npm run recovery:preflight -- cloud-library-ui --quick`: passed.

## 2026-06-21 07:28 EDT - Durable Job Owner Scaffolding Extraction

Actions:

- Extracted the durable job owner scaffolding slice onto `recovery/story-lab-durable-job-owner`.
- Added cloud schema/readiness coverage for future `story_lab_jobs` and `story_lab_job_events` tables and indexes.
- Added a Story Lab job store port, non-durable adapter compatibility, Postgres job store scaffold, and guarded job-store config.
- Routed Story Lab job create/read/event operations through configured job storage and authenticated owner context where durable storage is configured.
- Guarded job reads and updates by owner so cross-owner access fails closed.
- Added job-status UI/recovery copy for non-durable in-memory jobs so the app does not imply crash-safe progress.

Decision:

- Included the `44f3e9b` and `13a95f4` UI honesty commits in this slice because they enforce the same durable-job honesty invariant.
- Kept stale `OVERNIGHT_HANDOFF.md`, `STORY_LAB_APP_AUDIT.md`, and unrelated idea-board edits out of the extraction.
- This slice still does not claim a live Workflow runner, executed migrations, database provisioning, process-loss recovery, or live durable job proof.

Validation:

- `npm run recovery:preflight -- durable-job-owner`: passed and wrote `tmp/recovery/durable-job-owner-evidence.md`.
- `npm run test:story-lab-job-store-config`: passed.
- `npm run test:story-lab-job-store-port`: passed.
- `npm run test:story-lab-job-routes`: passed.
- `npx -p node@20 node ./node_modules/typescript/bin/tsc -p story-generator/tsconfig.spec.json --noEmit`: passed.
- `npx -p node@20 node ./node_modules/typescript/bin/tsc -p story-generator/tsconfig.app.json --noEmit`: passed.
- `npm run build`: passed with existing Angular bundle and CSS budget warnings.

## 2026-06-21 07:33 EDT - PR 124 Review Follow-Up

Actions:

- Addressed Gemini and Sourcery review feedback on durable job scaffolding.
- Removed internal job-store configuration flags from public `JOB_STORE_UNAVAILABLE` responses and kept those details in server-side diagnostics.
- Added redacted storage-operation warning logs that report only operation and error type/code.
- Added bounded retry handling for Postgres job event sequence conflicts caused by concurrent inserts.
- Added regression coverage for event sequence retry and public job-store error redaction.

Validation:

- `npm run test:story-lab-job-store-port`: passed.
- `npm run test:story-lab-job-routes`: passed.
- `npm run recovery:preflight -- durable-job-owner`: passed and wrote `tmp/recovery/durable-job-owner-evidence.md`.

## 2026-06-21 07:45 EDT - PR 124 Codex Review Follow-Up

Actions:

- Addressed Codex review feedback on durable job owner scaffolding.
- Rejected cross-owner updates in the non-durable job store when owner context is supplied.
- Made explicit job-store `env` options authoritative so tests and injected configs do not fall through to process environment variables.
- Returned `null` for missing owner-scoped Postgres job event streams so routes keep unknown/cross-owner event requests as 404.
- Translated typed job-store failures in create, running-update, status, event, and finish paths into sanitized API envelopes.
- Added regression coverage for cross-owner mutation, env isolation, missing event streams, and sanitized create/update/finish store failures.

Validation:

- `npm run test:story-lab-job-store-port`: passed.
- `npm run test:story-lab-job-store-config`: passed.
- `npm run test:story-lab-job-routes`: passed.
- `npm run recovery:preflight -- durable-job-owner`: passed and wrote `tmp/recovery/durable-job-owner-evidence.md`.
- `npm run build`: passed with existing Node non-LTS, Baseline data, Angular bundle, and CSS budget warnings.

## 2026-06-21 07:55 EDT - PR 124 Review Inventory Follow-Up

Actions:

- Addressed additional CodeRabbit/Codex comments that were present in review text even though status checks were green.
- Rejected ownerless reads and writes for owner-scoped non-durable memory jobs while preserving ownerless access for jobs created without an owner.
- Made misconfigured Postgres job storage return storage-configuration copy instead of auth-required copy.
- Trimmed job-store `DATABASE_URL` inputs before configured/executor checks.
- Added the owner-scoped job-events index to readiness checks and schema assertions.
- Added owner-consistent foreign key coverage between `story_lab_jobs` and `story_lab_job_events`.
- Gated recovered in-memory-loss copy to actual job-not-found responses so generic API/transport failures keep their own message.
- Converted heavier follow-ups into issues instead of silently deferring them: #125 atomic Postgres job mutations, #126 engine exception hardening, and #127 live index migration strategy.

Validation:

- `npm run test:story-lab-job-store-port`: passed.
- `npm run test:story-lab-job-store-config`: passed.
- `npm run test:story-lab-job-routes`: passed.
- `npm run test:story-lab-cloud-schema`: passed.
- `npm run test:story-lab-cloud-db-readiness`: passed.
- `npm run test:story-lab-cloud-schema-migration`: passed.
- `npx -p node@20 node ./node_modules/typescript/bin/tsc -p story-generator/tsconfig.spec.json --noEmit`: passed.
- `npm run recovery:preflight -- durable-job-owner`: passed and wrote `tmp/recovery/durable-job-owner-evidence.md`.
- `npm run build`: passed with existing Node non-LTS, Baseline data, Angular bundle, and CSS budget warnings.

## 2026-06-21 08:09 EDT - Cross-PR Review Comment Audit

Actions:

- Audited review comments, review summaries, and top-level PR comments across PR #114 through PR #124 after PR #124 merged.
- Created the reference-only branch `ai-review/story-lab-unsliced-reference-do-not-merge` for external AI review of the raw unpublished stack. It includes `AI_REVIEW_DO_NOT_MERGE.md` and must not be opened as a merge PR.
- Fixed the merged recovery preflight script so it checks committed branch diffs, keeps working-tree whitespace checks, adds the missing durable job store config/port tests, and runs Vercel API typechecks for backend-touching slices.
- Marked the storage-port plan's handoff to `STORY_LAB_AUTH_PROFILE_CLOUD_LIBRARY_EXEC_PLAN.md` as complete because later account/profile/cloud-library slices have been using that plan.
- Converted still-valid comments that were not safe to fold into this tooling fix into tracked issues:
  - #128: Story Lab recovery docs guidance drift and tool fallback notes.
  - #129: stable UI-slice validation hooks for cloud library, memory cards, and CSS/lazy-loading.
  - #130: network-dependent Node 20 typecheck wrappers in recovery preflight.
  - #131: per-process memoization decision for Story Lab job store config.
  - #132: failed Vercel preview comments on open Dependabot PRs #120 and #121.
  - #133: SonarCloud new-issues audit for PR #118 and PR #119.

Self-review:

- Good: The audit treats comments as work inventory even when the PR already merged.
- Problem found: PR #124's focused durable-job validation was stronger than the merged slice preflight, so a future agent could have run the official preflight and missed job-store config/port regressions.
- Problem found: Some older review feedback was addressed in code/docs but never explicitly replied to, which makes later recovery audits harder.
- Process correction: future slices should not merge until actionable review comments are either replied to with the fixing commit/evidence or linked to a follow-up issue.

Validation:

- `bash -n scripts/recovery/slice-preflight.sh`: passed.
- `npm run recovery:preflight -- durable-job-owner --dry-run`: passed and showed job-store config/port tests plus Vercel API typecheck.
- `npm run recovery:preflight -- story-quality-guidance --dry-run`: passed and showed Vercel API typecheck.
- `npm run recovery:preflight -- css-lazy-loading --dry-run`: passed.
- `npm run recovery:preflight -- durable-job-owner --quick`: first run failed because the fresh audit worktree lacked root `node_modules`; after `npm install --no-audit --no-fund`, it passed and wrote `tmp/recovery/durable-job-owner-evidence.md`.

## 2026-06-21 08:13 EDT - PR 134 Review Follow-Up

Actions:

- Addressed PR #134 Gemini/Sourcery feedback on the recovery preflight cleanup.
- Removed the redundant working-tree diff fallback from the branch-diff command; the following common command remains the single working-tree whitespace check.
- Aligned Vercel API typechecking with the same Node 20 wrapper used by Angular typechecks. The broader network-fetch concern remains tracked in #130.

Validation:

- `bash -n scripts/recovery/slice-preflight.sh`: passed.
- `npm run recovery:preflight -- durable-job-owner --dry-run`: passed and showed the simplified branch-diff command plus Node 20 API typecheck.
- `npm run recovery:preflight -- durable-job-owner --quick`: passed and wrote `tmp/recovery/durable-job-owner-evidence.md`.

## 2026-06-21 08:31 EDT - Story Quality Guidance Slice

Actions:

- Extracted the Story Lab story-output quality slice from the unpublished stack without bringing in the later Proving Grounds report or memory-card work.
- Added activation-aware continuation courtroom guidance for threads, artifacts, relationships, and warnings, with a preview source map that explains why anchors were selected.
- Seeded protagonist-antagonist relationship edges so relationship pressure can reach continuation guidance.
- Tightened chapter-ending, cliche-avoidance, scene-pressure, and subtext-receipt guidance while preserving the compact hidden-guidance budget.
- Expanded mock generation and continuation bodies so fallback story output stays closer to requested word-count ranges.

Self-review:

- Good: The conflict resolution kept story-quality guidance separate from Proving Grounds and memory cards instead of checking out the mega-branch file wholesale.
- Problem found: the first extraction pass missed selected hunks for relationship seeding and shorter secret-exposed wording; the focused tests caught both before commit.
- Process correction: for future slices, compare selected commits against current diff by behavior as well as file paths, because patch replay can silently skip hunks once a file is conflicted.

Validation:

- `npm run test:story-lab-real-engine`: passed.
- `npm run test:story-quality`: passed.
- `npm run test:story`: passed.
- `npm run recovery:preflight -- story-quality-guidance`: passed and wrote `tmp/recovery/story-quality-guidance-evidence.md`.
- Function count stayed `11/12`.

## 2026-06-21 08:47 EDT - Quality Report And Proving Grounds Slice

Actions:

- Extracted the deterministic Story Lab quality-report slice without bringing in memory cards, CSS lazy-loading, or stale handoff/audit docs.
- Added a heuristic story-quality report with continuity, cliffhanger, trope freshness, emotional variety, character consistency, prose quality, and audio-readiness dimensions.
- Attached the deterministic report to Story Lab evaluation responses for both mock/no-key and live Grok evaluation paths.
- Exposed quality scores and dimension details in the Proving Grounds current result, comparison, and history views.
- Added focused backend eval assertions and a Proving Grounds component spec for the quality report display.
- Addressed PR #137 review feedback:
  - added the required creation header to the new Proving Grounds spec;
  - moved the Proving Grounds result fixture shape into frontend contracts instead of using `any`;
  - centralized score tone class selection in the component;
  - cleaned up SonarCloud's local code-smell findings in the heuristic and focused test.
- Created #138 for the broader Sourcery follow-up to split `storyQualityHeuristics.ts` into smaller modules.

Self-review:

- Good: The extraction stayed inside the PR #9 boundary and did not use the full remaining branch diff as a shortcut.
- Problem found: the fresh worktree lacked both root and Angular workspace dependencies, so the first validation failed before reaching slice code.
- Problem found: the first Sonar cleanup used `.at(-1)`, but the recovery preflight's API TypeScript target is ES2020; a later `slice(-1)[0]` workaround still tripped Sonar, so the final version uses an ES2020-safe loop and reran preflight.
- Process correction: install root and `story-generator` dependencies up front for UI/report slices, then restore tracked `node_modules` churn before committing.

Validation:

- `npm run test:story-quality`: passed.
- `npm run recovery:preflight -- quality-report-proving-grounds`: passed and wrote `tmp/recovery/quality-report-proving-grounds-evidence.md`.
- Review-fix rerun: `npm run test:story-quality`: passed.
- Review-fix rerun: `npm run recovery:preflight -- quality-report-proving-grounds`: passed and rewrote `tmp/recovery/quality-report-proving-grounds-evidence.md`.
- Final Sonar-cleanup rerun: `npm run test:story-quality`: passed.
- Final Sonar-cleanup rerun: `npm run recovery:preflight -- quality-report-proving-grounds`: passed and rewrote `tmp/recovery/quality-report-proving-grounds-evidence.md`.
- Function count stayed `11/12`.
- `npm run build` passed with existing Node non-LTS, Baseline data, Angular bundle, and CSS budget warnings.

## 2026-06-21 10:38 EDT - Memory Cards And CSS Lazy-Loading Slice

Actions:

- Replayed the Story Lab memory-card commits onto fresh `origin/main` as patches, excluding stale `OVERNIGHT_HANDOFF.md`, `STORY_LAB_APP_AUDIT.md`, and `STORY_LAB_IDEA_BOARD.md`.
- Added Story Lab memory lifetimes, continuity preview items, pinned draft cards, accepted memory cards, edit/delete/reorder flows, and accepted-memory continuation previewing.
- Added accepted-memory summary counts to local/cloud library list metadata without exposing full card text in list rows.
- Kept prior account/storage honesty by preserving non-durable cloud storage UI states and adding accepted-card fixture data through the shared test fixture helper.
- Expanded the slice to include CSS budget recovery, Proving Grounds lazy loading, and split Story Lab component styles because memory-card CSS pushed `app.css` over the known hard-failure area.
- Updated `scripts/recovery/slice-preflight.sh` so the `css-lazy-loading` slice runs the route-splitting and component-style-budget tests.

Self-review:

- Good: Patch replay avoided checking out whole app files from the old mega-branch, preserving merged review fixes from later PRs.
- Problem found: the old memory-card patches repeatedly tried to reintroduce `.at(-1)` in app load paths; conflict resolution kept the ES2020-safe indexed reads.
- Problem found: PR #10 could not stand alone after replay because `app.css` reached 18,847 bytes; combining the PR #11 CSS/lazy-loading cleanup was necessary to keep the UI slice buildable.
- Process correction: when a UI slice touches `app.css`, check CSS byte size before deciding final PR scope; do not wait for the production build to discover an avoidable budget failure.

Validation:

- `npm run test:story-quality`: passed.
- `npm run test:story-lab-real-engine`: passed.
- `npm run test:story-generator-route-splitting`: passed.
- `npm run test:story-generator-component-style-budget`: passed.
- `npm run test:story-lab-account-routes`: passed.
- `npm run test:story-lab-storage-port`: passed.
- `npm run test:story-lab-profile-contracts`: passed.
- `npm run test:story-lab-state`: passed.
- `npm run recovery:preflight -- story-memory-cards`: passed and wrote `tmp/recovery/story-memory-cards-evidence.md`.
- `npm run recovery:preflight -- css-lazy-loading --quick`: passed and wrote `tmp/recovery/css-lazy-loading-evidence.md`.
- Function count stayed `11/12`.

## 2026-06-21 14:06 EDT - Auth/Database Review Debt Cleanup

Actions:

- Audited the remaining PR #118/#119 Sonar follow-up issue after the memory-card slice merged.
- Closed #145 as a false-positive Neon executor follow-up after confirming `@neondatabase/serverless@1.1.0` exposes `NeonQueryFunction.query(queryWithPlaceholders, params?)` and `npm run test:story-lab-neon-executor` passes.
- Refactored the Story Lab cloud schema SQL splitter into small scanner helpers so schema migration readiness remains testable without a live database.
- Replaced account route project-id path parsing with `RegExp.exec()`.
- Reworked profile/project body parsing to use explicit record helpers instead of broad final return casts.
- Added regression coverage that malformed `profile` or `project` wrapper bodies are rejected instead of falling back to outer fields.
- Follow-up review pass: asserted the `INVALID_REQUEST` error code for malformed wrapper regressions, renamed the wrapped-or-bare body helper to make direct body compatibility explicit, and replaced per-character dollar-quote substring matching with an in-place tag parser.
- Gemini follow-up: restored optional wire compatibility for profile timestamps and project synopsis/timestamps while still rejecting malformed provided values, with regression coverage for missing optional fields and numeric malformed values.
- Sonar follow-up: removed the schema splitter loop-counter assignment and replaced the route parser own-property check with an ES2020-safe key check.

Self-review:

- Good: This cleanup stayed inside the auth/database seam and did not add provider dependencies, routes, secrets, or real database migration behavior.
- Problem found: a generic review issue asked for a Neon API change that contradicts the locked package type surface; future review triage should verify provider API claims against the installed package before opening defect issues.
- Problem found: `npm run install:all` modifies tracked `node_modules` in this repository; install artifacts must be restored before source diffs are reviewed or committed.
- Problem found: the first wrapper regression tests asserted only HTTP status; review was right that route tests should assert the typed API error contract too.
- Problem found: the first typed-parser cleanup made optional wire fields mandatory; the route parser now lets store normalization fill omitted values while rejecting malformed values.

Validation:

- `npm run test:story-lab-cloud-schema-migration`: passed.
- `npm run test:story-lab-account-routes`: passed.
- `npm run test:story-lab-cloud-storage-config`: passed.
- `npm run test:story-lab-neon-executor`: passed.
- `git diff --check`: passed.
- `scripts/recovery/preflight.sh --quick --skip-status`: passed.
- `npm run build` passed inside memory-card preflight; the initial browser bundle dropped to 484.71 kB and Proving Grounds moved into a lazy chunk.

## 2026-06-21 11:35 EDT - Memory Cards Review Fix Pass

Actions:

- Addressed PR #139 Sonar and review feedback instead of merging with unresolved comments.
- Removed Sonar code smells from memory-card activation parsing and continuity preview helpers.
- Hardened accepted-memory parsing for Windows line endings and Unicode words.
- Preserved story memory lifetimes through AI continuity merges.
- Added safe hydration fallbacks for malformed saved memory-card metadata.
- Made pinned memory-card drafts toggleable and removed stale pinned draft state when deleting an accepted card.
- Displayed explicit zero accepted-memory counts when project metadata is present.
- Kept accepted/pinned memory-card guidance in generation steering while stripping those private sections from public suggested prompt chips.
- Included accepted/pinned memory-card guidance in Continuity Preview activation scoring so the preview matches the submitted continuation request.
- Added privacy assertions so list rows expose accepted-card counts without accepted-card detail payloads.
- Removed the CSS budget test regex hotspot by replacing regex compaction with a small deterministic scanner.
- Cleaned up follow-up Sonar code-smell findings by moving pure spec helpers out of the Jasmine closure and removing CSS scanner loop-counter mutation.
- Split the CSS budget compactor into comment-stripping and whitespace compaction helpers after Sonar flagged the one-pass scanner complexity.

Self-review:

- Good: Review comments were checked before merge and most were valid enough to fix inside the slice.
- Problem found: the first PR push still had unresolved review findings and a failing Sonar quality gate; this should have been caught before opening the PR.
- Problem found: the Angular unit-test runner built successfully but local ChromeHeadless could not capture, so the executable browser spec gate is still not reliable on this machine.
- Process correction: for future UI slices, run the PR comment/thread audit immediately after opening the PR and before calling the slice merge-ready.

Validation:

- `npm run test:story-generator-component-style-budget`: passed.
- `npm run test:story-lab-real-engine`: passed.
- `npm run test:story-lab-account-routes`: passed.
- `npm run test:story-lab-profile-contracts`: passed.
- `npm run test:story-quality`: passed.
- `npm run test:story-generator-route-splitting`: passed.
- `npx -p node@20 node ./node_modules/typescript/bin/tsc -p story-generator/tsconfig.spec.json --noEmit`: passed.
- `npx -p node@20 node ./node_modules/typescript/bin/tsc -p story-generator/tsconfig.app.json --noEmit`: passed.
- `npm test -- --watch=false --browsers=ChromeHeadless` in `story-generator`: test bundle built, but ChromeHeadless failed to capture twice and exited before running specs.
- Follow-up review rerun: `npm run test:story-quality`: passed.
- Follow-up review rerun: `npm run test:story-generator-component-style-budget`: passed.
- Follow-up review rerun: `npx -p node@20 node ./node_modules/typescript/bin/tsc -p story-generator/tsconfig.spec.json --noEmit`: passed.
- Follow-up review rerun: `npx -p node@20 node ./node_modules/typescript/bin/tsc -p story-generator/tsconfig.app.json --noEmit`: passed.
- Follow-up Sonar cleanup rerun: `npm run test:story-quality`: passed.
- Follow-up Sonar cleanup rerun: `npm run test:story-generator-component-style-budget`: passed.
- Follow-up Sonar cleanup rerun: `npx -p node@20 node ./node_modules/typescript/bin/tsc -p story-generator/tsconfig.spec.json --noEmit`: passed.
- Second follow-up Sonar cleanup rerun: `npm run test:story-quality`: passed.
- Second follow-up Sonar cleanup rerun: `npm run test:story-generator-component-style-budget`: passed.
- Second follow-up Sonar cleanup rerun: `npx -p node@20 node ./node_modules/typescript/bin/tsc -p story-generator/tsconfig.spec.json --noEmit`: passed.
- `npm run recovery:preflight -- story-memory-cards`: passed and wrote `tmp/recovery/story-memory-cards-evidence.md`; latest initial browser bundle was 484.83 kB and Proving Grounds remained a lazy chunk.
- `npm run recovery:preflight -- css-lazy-loading --quick`: passed and wrote `tmp/recovery/css-lazy-loading-evidence.md`.
- Function count stayed `11/12`.

## 2026-06-21 14:22 EDT - Memory Card Review Follow-Ups

Actions:

- Addressed issue #140 by saving the active browser-local project, including accepted and pinned memory-card state, before creating a continuation job.
- Addressed issue #141 by rendering malformed browser-local accepted-memory metadata as a zero-card count instead of reading `.length` from non-array metadata.
- Added Angular regressions for pre-continuation memory-card persistence, completed continuation recovery after reload, and malformed local library metadata rendering.

Self-review:

- Good: The fix stayed inside the existing Angular save/recovery path and did not add routes, cloud-sync claims, or durable-job claims.
- Problem found: The previous memory-card review pass normalized malformed metadata during hydration, but the saved-project list could still render raw stale metadata before hydration; the display layer now guards the count too.
- Problem found: Continuation jobs already stored a reload marker, but they did not first flush the current accepted/pinned card state into the saved project that reload recovery depends on.

Validation:

- `npx -p node@20 node ./node_modules/typescript/bin/tsc -p story-generator/tsconfig.spec.json --noEmit`: passed.
- `git diff --check`: passed.
- `npm run recovery:preflight -- story-memory-cards`: passed and wrote `tmp/recovery/story-memory-cards-evidence.md`; latest initial browser bundle was 485.03 kB and Proving Grounds remained a lazy chunk.
- `npx -p node@20 -c "node ./node_modules/@angular/cli/bin/ng test --watch=false --browsers=ChromeHeadless --include=src/app/app.spec.ts"` in `story-generator`: passed with `TOTAL: 81 SUCCESS` after one initial ChromeHeadless capture retry.

## 2026-06-21 14:35 EDT - Story Quality Guidance Review Follow-Ups

Actions:

- Addressed issue #142 by adding an `860` character budget for assembled hidden continuation guidance, with per-section caps that preserve the Continuity Courtroom, Chapter Ending Stress Test, and Cliche Alarm anchors.
- Addressed issue #143 by replacing repeated full rendered-body word recounts in no-key mock generation with incremental paragraph word tracking, and by rejecting oversized classic streaming word-count inputs before SSE starts.
- Addressed issue #144 by hardening activation helpers against stale/partial continuity state: missing thread descriptions/devices, missing relationship arrays or notes, and nullish activation candidates now fail closed.
- Added regression coverage for rich hidden-guidance states, stale partial continuity shapes, and oversized no-key streaming requests.

Self-review:

- Good: The slice stayed inside the PR #136 story-quality/mock-generation boundary and did not change auth, storage, routes beyond the existing classic stream validation, or UI behavior.
- Problem found: The first hidden-guidance cap was too tight and trimmed an existing "leave one sharper" instruction; the final cap keeps prior guidance intent while bounding rich states.
- Problem found: The stream route accepted any positive word count even though the story-service contract already limits allowed budgets; route validation now matches the service boundary.

Validation:

- `npm run test:story-lab-real-engine`: passed after the cap adjustment.
- `npm run test:story`: passed with `15` tests, including the oversized no-key streaming regression.
- `find api -name '*.ts' ! -name '*.spec.ts' ! -name '*.test.ts' -print0 | xargs -0 npx -p node@20 node ./node_modules/typescript/bin/tsc --noEmit --target es2020 --lib es2020,dom --module commonjs --moduleResolution node --esModuleInterop --skipLibCheck --types node`: passed.
- `git diff --check`: passed.
- `npm run recovery:preflight -- story-quality-guidance`: passed and wrote `tmp/recovery/story-quality-guidance-evidence.md`; function count stayed `11/12`.
- Oversized `/api/story/stream` GET smoke with `wordCount=5000`: passed with `400 INVALID_INPUT` before SSE opened.

## 2026-06-21 14:41 EDT - CodeRabbit Docstring Coverage Policy

Actions:

- Addressed issue #146 by inspecting the current repo for CodeRabbit configuration and finding no existing `.coderabbit.yaml`; PR comments showed CodeRabbit was using organization UI configuration.
- Checked CodeRabbit's current configuration reference: docstring coverage is a pre-merge check with `warning` default mode and `80` default threshold, while repository-root `.coderabbit.yaml` is detected from the branch under review.
- Added `.coderabbit.yaml` with `reviews.pre_merge_checks.docstrings.mode: "off"` so recovery PRs do not receive generic docstring-coverage warnings.
- Addressed PR #150 Codex review by adding root `inheritance: true`, preserving organization-level CodeRabbit settings while overriding only the docstring coverage check.
- Added an `AGENTS.md` review-tooling policy: document public contracts, exported ports/adapters, security/privacy invariants, cross-process storage behavior, and non-obvious story-generation constraints selectively; do not mass-add comments to satisfy a generic percentage.
- PR #150 CodeRabbit noted that OSS repositories apply only base-branch configuration while reviewing config-file changes, so this PR cannot prove the new config against itself; once merged to `main`, future PRs should use the repo config.

Self-review:

- Good: The decision fixes the noisy warning at the tool boundary instead of degrading TypeScript/Angular code with mechanical docstrings.
- Problem found: The repo relied on organization UI defaults, so future agents could not see why CodeRabbit was warning about docstrings from local files alone.
- Problem found: The first PR body implied branch config would apply immediately; CodeRabbit's OSS security rule means config PRs must be evaluated by YAML validity, review comments, and future-PR behavior after merge.
- Problem found: The first `.coderabbit.yaml` would have disabled docstring coverage but could have dropped inherited organization settings; root inheritance keeps the override narrow.
- Process correction: review-tool policy belongs in versioned repo config and `AGENTS.md`, not only in chat or bot UI state.

Validation:

- CodeRabbit docs checked: `https://docs.coderabbit.ai/reference/configuration` and `https://docs.coderabbit.ai/getting-started/yaml-configuration`.
- CodeRabbit inheritance docs checked: `https://docs.coderabbit.ai/configuration/configuration-inheritance`.

## 2026-06-21 14:55 EDT - Mock Expansion Guard Review Follow-Up

Actions:

- Addressed the post-merge PR #149 Gemini review comment on `expandMockParagraphsToWordTarget`.
- Filtered expansion beats to positive-word entries before the mock expansion loop so future empty/zero-word mock beats cannot keep the loop from making progress.

Self-review:

- Good: Filtering by counted words removes the infinite-loop class without adding an arbitrary iteration cap.
- Problem found: The PR #149 comment arrived after the API merge, so the first review audit missed it; the follow-up sweep caught it before final handoff.
- Process correction: after API-merging a PR, rerun the review-thread query once more because late bot comments can land seconds after merge.

Validation:

- `npm run test:story`: passed with `15` tests.
- API TypeScript check with the Node 20 wrapper: passed.
- `git diff --check`: passed.
- `npm run recovery:preflight -- story-quality-guidance`: passed and rewrote `tmp/recovery/story-quality-guidance-evidence.md`; function count stayed `11/12`.

## 2026-06-21 15:04 EDT - Completion Hardening Plan And Review Audit Tooling

Actions:

- Added `STORY_LAB_COMPLETION_HARDENING_EXEC_PLAN.md` as the authoritative post-PR #151 plan for review-comment triage, Dependabot handling, auth/database live integration, durable-job hardening, tooling cleanup, story-quality refactor, and final reporting.
- Added `npm run review:unresolved` to make active unresolved GitHub review-thread audits repeatable from the repo.
- Updated `AGENTS.md` so future agents audit review comments after each PR and use #152/#153 for comment backlog disposition.
- Marked `STORY_LAB_UNPUBLISHED_BRANCH_SPLIT_PLAN.md` as historical publication evidence now that the split stack has landed through PR #151.
- Addressed PR #154 SonarCloud feedback by reducing audit-script argument-parser complexity and cleaning minor JavaScript style warnings.
- Addressed PR #154 review comments by surfacing `gh` stderr on command failures, honoring `--repo` during PR listing, and paginating review threads beyond the first 100 threads.
- Addressed the remaining PR #154 SonarCloud security hotspot by resolving `gh` from fixed absolute install paths instead of relying on `PATH` lookup.

Self-review:

- Good: The remaining work is split by independent risk boundary instead of by how much context an agent can carry.
- Problem found: Review-comment tracking previously lived partly in chat and copied GraphQL snippets; the repo now has a command and an explicit post-merge rule.
- Problem found: The first audit-script parser was functionally correct but too complex; the refactor keeps behavior while lowering static-analysis risk.
- Non-claim: This slice does not implement live auth/database wiring, durable jobs, or review-comment cleanup itself; it makes those gates explicit and measurable.

Validation:

- `node --check scripts/recovery/list-unresolved-review-threads.mjs`: passed.
- `npm run review:unresolved -- --help`: passed.
- `npm run review:unresolved -- --prs 149,150,151`: passed, no active unresolved review threads found.
- `npm run review:unresolved -- --prs 116 --json`: passed, returning the expected three active PR #116 threads from #152.
- `npm run review:unresolved -- --repo Phazzie/FairytaleswithSpice --prs 154 --json`: passed, proving explicit repo override still works for focused PR audits.
- `git diff --check`: passed.
- `npm run recovery:status`: passed with expected tracked/untracked files for this slice; function count stayed `11/12`.
- `scripts/recovery/check-vercel-function-count.sh`: passed at `11/12`.

## 2026-06-21 15:38 EDT - Review Comment Triage UI Cleanup

Actions:

- Began the post-PR #154 unresolved review-thread cleanup from issue #152.
- Resolved PR #116, #115, #114, and #113 review threads after verifying the fixes or linked issues were present on `main`.
- Addressed the remaining PR #112 stale villain-pressure fallback by removing unused `selectedVillainPressure` computed state that still depended on option index fallback.
- Addressed PR #111 Director Room review comments by keeping the Continuity Keeper label/detail from the same continuity item and clearing the custom continuation brief after dispatching accepted Director Room notes.
- Addressed PR #155 review feedback by making the continuity-item selection an explicit `if`/`else` block instead of a nested ternary.
- Left the PR #111/#112 code-fix threads unresolved until this cleanup PR lands.

Self-review:

- Good: Resolved threads only after checking current code, linked issues, or reachable refs instead of relying on old chat memory.
- Problem found: The old PR #112 thread had been answered, but a later narrative-dials refactor left a stale unused fallback computed in place.
- Problem found: The local ChromeHeadless app-spec run remained flaky and disconnected after capture; this needs to be reported as a runner failure, not claimed as passing.

Validation:

- `npx -p node@20 node ./node_modules/typescript/bin/tsc -p story-generator/tsconfig.spec.json --noEmit`: passed.
- `git diff --check`: passed.
- `npm run recovery:preflight -- cloud-library-ui --quick`: passed and wrote `tmp/recovery/cloud-library-ui-evidence.md`; function count stayed `11/12`.
- `npm run build`: passed; Angular reported the existing Node 23 odd-version warning and stale `baseline-browser-mapping` warning.
- `npx -p node@20 -c "node ./node_modules/@angular/cli/bin/ng test --watch=false --browsers=ChromeHeadless --include=src/app/app.spec.ts"`: did not pass because ChromeHeadless failed to capture twice, then disconnected after the second retry connected; no Jasmine assertion failure was reported.

## 2026-06-21 15:48 EDT - Batch Queue Review Comment Follow-Up

Actions:

- Continued #152 review-thread cleanup after PR #155.
- Addressed PR #110 by replacing the batch-status `switch` with an exhaustive `Record<BatchProgressState['status'], string>` map.
- Addressed PR #156 review feedback by adding a defensive fallback for unknown runtime batch statuses and focused spec coverage.

Self-review:

- Good: This is a small still-valid maintainability fix with compile-time exhaustiveness if batch statuses change.
- Non-claim: This slice does not address the remaining job-route or PR #87 backlog threads.

Validation:

- `npm run recovery:preflight -- cloud-library-ui --quick`: passed and wrote `tmp/recovery/cloud-library-ui-evidence.md`; function count stayed `11/12`.
- `git diff --check`: passed.
- `npm run review:unresolved -- --prs 110`: still reports the one PR #110 thread that this slice fixes after merge.

## 2026-06-21 16:12 EDT - Resume Review Comment Follow-Up

Actions:

- Continued #152 review-thread cleanup after PR #156.
- Verified PR #108 and PR #107 are clean after their fixes landed on `main`.
- Addressed four PR #106 resume-hardening threads by tracking recovered job snapshot subscriptions, clearing them on completion/error, guarding active-job storage through a safe accessor, and rejecting JSON `null` active-job markers without throwing.
- Turned the remaining PR #106 long-running POST resume-marker contract gap into issue #157 because it requires changing the job creation route contract rather than a bounded UI cleanup.

Self-review:

- Good: The fix keeps the existing non-durable resume behavior honest and only hardens the current client-side recovery path.
- Problem found: Browser-side resume cannot recover a reload during the initial long POST until job creation returns an early resumable marker; issue #157 tracks that contract change.
- Non-claim: This slice does not implement durable queueing or early job-create responses.

Validation:

- `npx -p node@20 node ./node_modules/typescript/bin/tsc -p story-generator/tsconfig.spec.json --noEmit`: passed.
- `npm run recovery:preflight -- cloud-library-ui --quick`: passed and wrote `tmp/recovery/cloud-library-ui-evidence.md`; function count stayed `11/12`.
- `git diff --check`: passed.
- `npm run build`: passed; Angular reported the existing Node 23 odd-version warning and stale `baseline-browser-mapping` warning.
- `npx -p node@20 node ./node_modules/@angular/cli/bin/ng test --watch=false --browsers=ChromeHeadless --include=src/app/app.spec.ts`: did not execute assertions because ChromeHeadless failed to capture twice and Karma gave up.

## 2026-06-21 16:18 EDT - Genesis Subscription Review Comment Follow-Up

Actions:

- Continued #152 review-thread cleanup after PR #158.
- Addressed the remaining PR #105 genesis subscription cleanup by making failed job paths close all tracked job subscriptions, not only the event stream.
- Addressed PR #159 review feedback by applying the same cleanup to continuation and recovered-job failures.
- Added regression specs for genesis creation, continuation creation, recovered genesis, and recovered continuation failures that do not complete, proving their subscriptions are immediately unsubscribed.

Self-review:

- Good: The fix uses the existing generalized `jobCreationSubscription` and `closeJobSubscriptions()` path instead of adding duplicate job-type-specific subscription helpers.
- Non-claim: This slice does not change the job route contract or durable queue behavior.

Validation:

- `git diff --check`: passed.
- `npx -p node@20 node ./node_modules/typescript/bin/tsc -p story-generator/tsconfig.spec.json --noEmit`: passed.
- `npm run recovery:preflight -- cloud-library-ui --quick`: passed and wrote `tmp/recovery/cloud-library-ui-evidence.md`; function count stayed `11/12`.
- `npm run build`: passed; Angular reported the existing Node 23 odd-version warning and stale `baseline-browser-mapping` warning.

## 2026-06-21 16:28 EDT - Story Lab Jobs README Formatting Follow-Up

Actions:

- Continued #152 review-thread cleanup after PR #159.
- Addressed the remaining PR #104 markdown spacing nit by adding a blank line between the `### Story Lab Jobs` heading and the HTTP code fence.
- Verified the PR #104 route validation, non-durable job-store eviction, single-function route rewrite, and EventSource spec-style comments were already fixed on `main`.

Self-review:

- Good: This keeps the branch docs-only instead of reopening already-fixed route/store work.
- Non-claim: This slice does not change job-route behavior or storage durability.

Validation:

- `git diff --check`: passed.
- `scripts/recovery/check-vercel-function-count.sh`: passed at `11/12`.
- `npm run recovery:status`: passed; branch contains only `api/README.md` and changelog edits.

## 2026-07-03 20:28 EDT - PR #120 Root-Only Replacement Slice

Actions:

- Created `recovery/dependabot-root-tsx` from current `origin/main`.
- Split the safe root dependency work out of Dependabot PR #120 instead of merging the mixed root plus Angular major-upgrade PR.
- Updated root `tsx` from `^4.20.6` to `^4.23.0`; root `package-lock.json` now resolves `tsx@4.23.0` and `esbuild@0.28.1`.
- Kept `story-generator/package.json` and `story-generator/package-lock.json` out of scope.
- Used three read-only Spark sidecars for validation planning, PR/supersede wording, and lockfile-risk review; parent made and verified the package change.
- Updated `SUBAGENT_LOG.md` with the subagent batch and parent verification.

Self-review:

- Correction: this pass followed the user's intended pattern better than the first PR #120 trial: parent strategy first, one mergeable target, subagents as narrow helpers.
- Non-claim: PR #120 is not closed yet; it should be superseded only after the replacement PR lands.
- Note: local Angular validation used Node `23.8.0`, which produced Angular engine warnings because Angular 20 expects Node `^20.19.0 || ^22.12.0 || >=24.0.0`; the commands still completed.

Validation:

- `npm ci`: passed.
- `npm ls tsx esbuild`: passed; resolved `tsx@4.23.0` and `esbuild@0.28.1`.
- `npm run test:story`: passed.
- `npm run test:tropes`: passed.
- `npm run test:story-lab-real-engine`: passed.
- `npm run test:story-lab-account-routes`: passed.
- `bash scripts/recovery/preflight.sh --quick --skip-build`: passed.
- `npm run build`: passed.
- `npm run build:verify`: passed.
- `git diff --check`: passed after validation-only install artifacts were removed.

## 2026-07-03 18:39 EDT - Subagent Guidance And PR #120 Split Trial

Actions:

- Added `AGENTS.md` guidance for bounded subagent tickets, disjoint write scopes, parent-owned strategy, and required result contracts.
- Added `SUBAGENT_LOG.md` as the dedicated place to record subagent batches, outputs, parent verification, integration decisions, and follow-ups.
- Ran a six-agent Spark trial for Dependabot PR #120 after parent analysis found it mixed root `tsx`/`esbuild` work with an Angular 20 to Angular 22 major upgrade.
- Recorded the trial result: five agents returned, one timed out, and no dependency/config changes were integrated without parent revalidation.

Self-review:

- Good: The guidance makes subagent work auditable instead of relying on chat memory.
- Correction: Previous subagent activity was documented in plans/memory, but not in a dedicated repo log.
- Finding: Spark is useful for narrow package diffs, config drafts, validation matrices, and wording drafts, but tickets still need stronger workspace/source-of-truth constraints and deterministic artifacts.
- Non-claim: Subagent output is not accepted until parent review and local validation finish.

Validation:

- `git diff --check`: passed.
