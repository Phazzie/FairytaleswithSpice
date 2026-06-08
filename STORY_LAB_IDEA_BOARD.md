# Story Lab Idea Board

Last updated: 2026-06-08

## Purpose

This board is the parking lot and selection queue for product ideas, research leads, story-quality improvements, and bounded Weird Lab experiments. It exists so autonomous work can be creative without becoming random.

## Status Labels

- `Now`: should be picked up soon unless a newer user request supersedes it.
- `Soon`: valuable but not first in line.
- `Research`: needs web/source review before implementation.
- `Weird Lab`: small experiment, not guaranteed product work.
- `Parked`: useful but blocked or not timely.
- `Done`: implemented and verified.
- `Rejected`: considered and intentionally not taken.

## Current Priorities

### Now: Reconcile Storage Plan Status

The storage port code exists on `main`, but the storage-port plan still has progress language that may be stale. Update the plan so future agents do not think merged scaffolding is still unmerged work.

Acceptance:

- `STORY_LAB_STORAGE_PORT_EXEC_PLAN.md` accurately distinguishes completed storage-port scaffolding from unfinished cloud account sync.
- No production auth/storage claims are added.

Status:

- Done in overnight slice on 2026-06-08.

### Now: Auth, Profiles, And Cloud Library Plan

Turn auth/storage/profiles into a concrete implementation plan before touching provider code.

Acceptance:

- Provider decision points are explicit.
- User profile contract is sketched.
- Cloud project save/list/load/delete flow is scoped.
- Route/function budget impact is called out.
- Owner-isolation tests are listed.

Status:

- Plan created in `STORY_LAB_AUTH_PROFILE_CLOUD_LIBRARY_EXEC_PLAN.md` during overnight work on 2026-06-08.

Research notes from 2026-06-08:

- Supabase Auth models permanent and anonymous users, issues access tokens tied to users, and supports RLS-driven access. Its docs warn that user-editable metadata must not be used for security-sensitive authorization. Source: https://supabase.com/docs/guides/auth/users, accessed 2026-06-08.
- Vercel's current Postgres guidance says new projects should use Marketplace Postgres integrations rather than legacy Vercel Postgres. Source: https://vercel.com/docs/postgres, accessed 2026-06-08.
- Vercel's Workflow material now positions Workflow SDK as the path for long-running durable work with step isolation, retries, persistence, and observability. Sources: https://vercel.com/workflows and https://vercel.com/blog/a-new-programming-model-for-durable-execution, accessed 2026-06-08.

Product translation:

- Start profiles as private writing preferences, not social profiles.
- Profile fields should be deliberately boring first: display name, default heat contract, default tone/creature preferences, content boundaries, library sort preference, created/updated timestamps.
- Keep account identity separate from profile data. `AuthUser.userId` owns records; editable profile fields do not authorize anything.
- Keep Story Lab jobs non-durable until a Workflow/database decision exists.

### Done: Proving Grounds Route Split

The Story Memory UI work pushed the initial browser bundle above the soft 500 kB warning budget. Proving Grounds was the best narrow target because it is a debug/evaluation route, not the first Story Lab screen.

Acceptance:

- `/proving-grounds` keeps the same route and title.
- Proving Grounds is lazy-loaded instead of eagerly imported by `app.routes.ts`.
- A tracked route-splitting test fails if the route becomes eager again.
- Build stats prove Proving Grounds moved out of the initial browser `main` chunk.

Status:

- Done in overnight slice on 2026-06-08.
- `npm run build -- --stats-json` showed the initial browser total at `481.61 kB` and Proving Grounds as a lazy `78.52 kB` chunk.
- The remaining frontend budget issue is `app.css` at `14.96 kB`, over the 12 kB warning budget but below the hard failure budget.

### Done: Mock Word Budget Gap

The root tests pass while mock generation ignores requested story length. Decide whether mocks should scale with requested word count or whether tests should stop presenting mock length as quality evidence.

Acceptance:

- Either mock generation roughly scales with requested length, or the tests make the limitation explicit.
- The story-quality checks record length variance as a meaningful signal.

Status:

- Done in overnight slices on 2026-06-08.
- Classic single-story mock generation now scales to 700, 900, and 1200 word requests within the existing 30% tolerance.
- Multi-chapter mock genesis now scales by per-chapter target and fails if the total falls outside tolerance.
- Mock continuation chapters now scale to the live continuation prompt's 400-600 word default, with tests failing outside that range.
- Remaining caveat: continuation has no user-configurable word-budget field; it only has the default continuation prompt target.

### Soon: Live Provider Proof

Run live-provider verification only when `XAI_API_KEY` is available. The proof must show provider telemetry and not merely "request did not crash."

Acceptance:

- Exact command documented.
- Missing-key behavior skips cleanly.
- Live run proves Grok/non-mock telemetry when credentials exist.

Triage note, 2026-06-08:

- `tests/grok-smoke.test.ts` remains untracked and should not be adopted as-is.
- The repo already has tracked live-provider smoke paths: `smoke:story-lab-live-provider`, `smoke:grok`, and `tests/grok-multi-agent-smoke.test.ts`.
- If a canonical low-level `StoryService` Grok smoke is still wanted later, revise the untracked file first, fix whitespace, add a deliberate package script, and document how it differs from the tracked live-provider smoke.

### Done: Deterministic Story Quality Report

Turn the useful dimensions from `STORY_QUALITY_EVALS_PLAN.md` into a tracked, no-credentials evaluation slice before any AI judging work.

Acceptance:

- Evaluation output includes continuity, cliffhanger quality, trope freshness, emotional variety, character consistency, prose quality, and audio-readiness.
- Scores are bounded 0-100.
- Signals are explainable enough to debug why the advisory score moved.
- The slice does not require credentials and does not claim to replace live/AI review.

Status:

- Done in overnight slice on 2026-06-08.
- `buildStoryQualityHeuristicReport` now returns a deterministic advisory report with the seven planned dimensions.
- `/api/story-lab/evaluate` attaches the report to both mock and live evaluation responses as optional `heuristicReport`.
- `tests/story-quality-evals.test.ts` guards the dimension count, dimension ids, score bounds, and presence of signals.
- The prose-quality dimension now includes a small Specificity Lens signal that names concrete anchors in the story text, such as `witness shell`, `reef arch`, and `blood oath`.
- The prose-quality dimension now includes a small Sensory Texture signal that names concrete sensory cues, such as `glow`, `salt`, and `sting`.
- The audio-readiness dimension now includes a small Dialogue Texture signal that names concrete speaker variety, such as `Mira`, `Narrator`, and `Lord Brine`.
- Proving Grounds now renders the report as a compact Deterministic Quality Scan panel after evaluation.
- `proving-grounds.spec.ts` guards that the visible panel includes the score, continuity, audio-readiness, and concrete signals.
- Proving Grounds history cards now show a compact `Quality N` badge, and comparison cards include the heuristic quality score beside the AI score.

### Done: Specificity Lens

Origin:

- The user wanted weird/eclectic story-output experiments during autonomous work, not just cleanup.
- Existing quality reporting could say whether prose had decent sentence shape, but not whether the story was using concrete story matter.

Hypothesis:

- A cheap specificity signal can help users and future agents notice when story output has named objects, places, promises, or consequences instead of only generic mood.

User value:

- Proving Grounds quality output becomes more explainable without calling an AI judge or increasing generation prompt length.

Smallest experiment:

- Add a deterministic concrete-anchor extractor to the existing `prose_quality` dimension.
- Keep the seven-dimension contract stable.

Guardrails:

- Do not add provider calls.
- Do not add another hidden continuation anchor.
- Keep the signal advisory and explainable.

Acceptance:

- `tests/story-quality-evals.test.ts` now fails unless the fixture's prose-quality dimension reports `Specific anchors: witness shell, reef arch, blood oath`.

### Done: Dialogue Texture Lens

Origin:

- The user wanted all narrative dials/signals to read as concrete story-state prose instead of abstract numbers.
- Audio-readiness could count dialogue tags, but it could not say whether a scene actually had multiple voices in play.

Hypothesis:

- A cheap speaker-variety signal helps future UI/eval work explain whether a scene is shaped for audio performance, without asking an AI judge to grade voice quality.

User value:

- The quality scan can now say what voices it sees, not only that some tagged dialogue exists.

Smallest experiment:

- Reuse existing `[Speaker]:` tags and add a deterministic `Speaker variety` signal to the existing `audio_readiness` dimension.
- Strip first-appearance voice annotations down to the speaker name so report signals stay readable.

Guardrails:

- Do not add provider calls.
- Do not add another score dimension.
- Keep the signal advisory and human-readable.

Acceptance:

- `tests/story-quality-evals.test.ts` now fails unless the fixture's audio-readiness dimension reports `Speaker variety: Mira, Narrator, Lord Brine`.

### Done: Sensory Texture Lens

Origin:

- The user wanted story-output experiments that improve generated prose rather than only platform plumbing.
- The existing prose-quality scan could detect concrete story objects, but it could not say whether the passage had physical texture on the page.

Hypothesis:

- A tiny sensory signal helps distinguish scene matter that can be felt, seen, heard, or tasted from prose that only moves plot labels around.

User value:

- Proving Grounds quality output can show why a scene reads more grounded without calling an AI judge or changing generation prompts.

Smallest experiment:

- Add a deterministic sensory extractor to the existing `prose_quality` dimension.
- Map word variants such as `glowed` and `stung` to compact report labels such as `glow` and `sting`.
- Keep the seven-dimension contract stable.

Guardrails:

- Do not add provider calls.
- Do not add another score dimension.
- Do not claim the scan can judge beauty, voice, or style quality.

Acceptance:

- `tests/story-quality-evals.test.ts` now fails unless the fixture's prose-quality dimension reports `Sensory texture: glow, salt, sting`.

### Done: Agency Lens

Origin:

- The user wanted weird/eclectic story-output experiments during autonomous work, not only platform cleanup.
- The existing character-consistency scan could identify speakers and named characters, but it could not say whether those characters were acting with visible agency.

Hypothesis:

- A cheap named-action signal helps distinguish scenes where characters make concrete moves from scenes where story pressure only happens around them.

User value:

- Proving Grounds quality output can now explain one more practical craft issue: whether named characters are doing things on the page.

Smallest experiment:

- Add a deterministic agency-action extractor to the existing `character_consistency` dimension.
- Only count actions tied to named-character subjects, so generic instructions or hook words do not inflate the signal.
- Keep the seven-dimension contract stable.

Guardrails:

- Do not add provider calls.
- Do not add another score dimension.
- Do not claim the scan can judge whether the choices are emotionally good, only whether concrete named-character actions are present.

Acceptance:

- `tests/story-quality-evals.test.ts` now fails unless the fixture's character-consistency dimension reports `Agency actions: pressed, touched`.

### Soon: Durable Job Storage

Replace or supplement `non_durable_memory` job state with an owner-scoped durable job table and runner plan.

Acceptance:

- Job snapshots/events survive process loss.
- User cannot access another user's jobs.
- UI recovery works from durable state, not only browser session markers.

### Research: Similar Product Mining

Run source-backed research on adjacent products before implementing inspiration-based features.

Research questions:

- How do AI writing tools represent project memory, style, and continuity?
- How do serialized fiction products create chapter momentum and return visits?
- How do interactive fiction tools present choices without making the story feel mechanical?
- How do drafting tools surface revision advice without overwhelming the writer?

Output:

- Source links and dates.
- Three patterns worth stealing in spirit, not copying.
- One small experiment per pattern.

Research pass, 2026-06-08:

Sources:

- Sudowrite docs list Story Bible, Characters, Worldbuilding, Outline, Scenes & Draft, Chapter Continuity, Visibility Settings, and Saliency Engine as writing-system concepts. Source: https://docs.sudowrite.com/using-sudowrite/1ow1qkGqof9rtcyGnrWUBS, accessed 2026-06-08.
- Novelcrafter's Codex stores story elements such as characters, locations, objects, and research notes as a central story reference. Source: https://www.novelcrafter.com/help/docs/codex/the-codex, accessed 2026-06-08.
- NovelAI Lorebook supports key-triggered context insertion and advanced placement settings. Source: https://docs.novelai.net/en/text/lorebook/, accessed 2026-06-08.
- LivingWriter Elements organize characters, settings, objects, tags, notes, and relationships. Source: https://guides.livingwriter.com/desktop-app-+-web-version/chapters-and-elements/elements-section, accessed 2026-06-08.

Patterns worth mining:

- Structured story memory beats raw prompt stuffing.
- Story elements need relationships and tags, not just freeform text.
- AI context should be selective: activate only the memory that matters to the current scene.
- Continuity tooling should be visible enough for trust but compressed enough not to feel like homework.

Experiments:

- `Story Memory Shelf`: extract characters, places, objects, promises, and pressure threads from saved projects, then let continuation use only the active shelf items.
- `Context Activation Rules`: give each memory item aliases and trigger phrases, then include the item only when current story text or continuation brief references it.
- `Relationship Web Lite`: start with simple typed links such as wants, owes, hides from, protects, betrays, and fears.
- `Continuity Preview`: before Continue Saga, show a compact "what the model will remember" list that can be accepted, edited, or hidden.

Continuity Preview progress:

- Backend/test seam started on 2026-06-08.
- `previewStoryLabContinuationGuidance` exposes the exact continuation provider brief, hidden guidance, anchor headings, and character count without calling the AI provider.
- Read-only UI preview started on 2026-06-08.
- The sidebar Story Memory section now lists prose-labeled state items such as `Pressure rising`, `World clue`, and `Continuity note` from the current client-side `StoryStateSnapshot`.
- The sidebar Story Memory section now also lists one `Relationship pressure` item when current character state has a relationship edge.
- The current UI preview is not editable yet and does not call the backend preview seam; it is the first visible trust layer using already-loaded state.

Relationship Web Lite progress:

- Backend/test seam started on 2026-06-08.
- Initial Story Lab protagonist and antagonist records now include typed `rival` relationship edges instead of leaving the relationship arrays empty.
- Real continuation guidance folds one compact `Relationship pressure` line into the existing `Continuity Courtroom` anchor.
- The existing read-only Story Memory preview now renders one visible `Relationship pressure` item from already-loaded state.
- Relationship pressure selection now uses the continuation brief when multiple relationship pairs exist, so a named participant can beat the older first-pair default.
- This is not an editable relationship graph yet; it is the first state/guidance slice for relationship-aware continuation.

Context Activation Rules progress:

- Backend/test seam started on 2026-06-08.
- When more active threads exist than the compact `Continuity Courtroom` anchor can include, Story Lab now prioritizes a thread whose label/detail matches the continuation brief.
- The first guarded case pulls `Blood Oath` into the compact hidden guidance when the user asks to bring the blood oath into the next room.
- The same activation rule now applies to unresolved lore artifacts; the guarded case pulls `Glass Key` into the compact hidden guidance when the user asks to use the glass key.
- The same activation rule now applies to continuity warnings; the guarded case pulls the `Coral Scribe` ledger warning into the compact hidden guidance when the user asks for that warning.
- This does not add a new hidden anchor block or expose activation scoring to the model.

Additional research pass, 2026-06-08:

- Sudowrite Story Bible docs emphasize a persistent project source of truth that informs synopsis, characters, worldbuilding, outline, scenes, and prose generation; they also note that scene/prose generation only looks at explicitly mentioned characters and worldbuilding elements. Source: https://docs.sudowrite.com/using-sudowrite/1ow1qkGqof9rtcyGnrWUBS/what-is-story-bible/jmWepHcQdJetNrE991fjJC, accessed 2026-06-08.
- Novelcrafter positions its Codex as a project wiki for characters, places, lore, and review, with automatic tracking/linking as a key value. Source: https://www.novelcrafter.com/, accessed 2026-06-08.
- AI Dungeon describes Memory System context as story text plus AI Instructions, Plot Essentials, Author's Note, and relevant Story Cards; its Story Cards split user-visible type/name metadata from the entry text visible to the AI. Sources: https://help.aidungeon.com/faq/the-memory-system and https://help.aidungeon.com/faq/story-cards, accessed 2026-06-08.
- FictionLab Story Cards use trigger words to decide when a card's content becomes available to the AI, while card name/type are mainly user-facing organization metadata. Source: https://fictionlab.gitbook.io/fictionlab/getting-started/story-and-memory-cards, accessed 2026-06-08.
- Twine variables reinforce a simple interactive-fiction lesson: durable story variables and temporary passage variables need different lifetimes. Source: https://twinery.org/cookbook/terms/terms_variables.html, accessed 2026-06-08.

Additional patterns worth mining:

- The next trust layer is activation explanation: show why a memory item is active now, not just that the app has memory somewhere.
- Memory-card metadata should serve the human, while only compact entry text should reach the model.
- Story facts need lifetime labels so scene-only pressure does not become permanent continuity.

Additional candidate slices:

- `Context Source Map`: add a route-free preview field that explains which thread, artifact, warning, and relationship item activated the current continuation anchors.
- `Triggered Card Drafts`: transform detected characters, places, objects, and promises into suggested memory cards with trigger words, but do not auto-inject them until accepted.
- `Variable Lifetime Labels`: tag story facts as `scene`, `chapter`, or `series` lifetime so transient pressure does not pollute long-term continuity.

Context Source Map progress:

- Backend/test seam completed on 2026-06-08.
- `previewStoryLabContinuationGuidance` now returns `contextSourceMap` alongside the provider brief, hidden guidance, anchor headings, and character count.
- The source map uses the same selection rules as the hidden continuation anchors, so it explains the actual selected thread, artifact, relationship, and warning rather than a separate guess.
- The first guarded cases explain brief-matched activation for `Blood Oath`, `Glass Key`, `Mira and Coral Scribe`, and the `Coral Scribe` ledger warning.
- This is not visible in the Angular UI yet; it is the route-free metadata seam needed for the next Continuity Preview trust layer.

Variable Lifetime Labels progress:

- Contract/test seam completed on 2026-06-08.
- `PlotThread` and `LoreArtifact` now accept optional `scene`, `chapter`, or `series` lifetime metadata.
- Generated Story Lab theme threads, fallback romance threads, and world artifacts default to `series`.
- Mock base story threads and the `Crimson Signet Ring` artifact default to `series`; mock chapter-foreshadowed `Broken Oath Scroll` artifacts default to `chapter`.
- Read-only UI preview started on 2026-06-08.
- Story Memory / Continuity Preview rows now show compact labels such as `Series memory` and `Chapter memory` when a thread or artifact has lifetime metadata.
- Continuity warnings still use the existing plain-string contract; migrating them to structured lifetime-aware objects is a separate compatibility slice.

Triggered Card Drafts progress:

- Read-only UI experiment started on 2026-06-08.
- Story Memory now drafts compact character, promise, and world cards from the current `StoryStateSnapshot`.
- Each draft shows a human-facing card type, title, detail, and trigger phrase such as `Trigger: Mara`.
- In-session pinning started on 2026-06-08: each draft can be pinned locally and shows `Pinned` plus a pinned-card count.
- Trigger enrichment started on 2026-06-08: multi-word promise/world titles now add a short alias such as `Trigger: Moonlit oath, oath`.
- Local save persistence started on 2026-06-08: pinned draft IDs are saved with browser-local projects and restored when the project reloads.
- Continuation-brief integration started on 2026-06-08: pinned drafts are appended to UI-driven continuation requests as compact `Pinned Memory Cards` prose anchors.
- Accepted-card shelf started on 2026-06-08: draft cards can be accepted into a local `Accepted Memory Cards` shelf, saved with browser-local projects, and restored when the project reloads.
- Accepted-card editing started on 2026-06-08: accepted card title, detail, and trigger text can be edited before saving/reloading or continuing.
- Accepted-card deletion started on 2026-06-08: accepted cards can be removed before save/reload or continuation.
- Accepted-card output comparison started on 2026-06-08: the story-quality eval now compares a neutral continuation brief against the same brief plus accepted card text and proves the accepted card can activate a different continuity anchor.
- Accepted-card reorder started on 2026-06-08: accepted cards can be moved up/down, saved/reloaded, and sent to continuation in the chosen order.
- Continuation accepted-memory preview started on 2026-06-08: the continuation panel shows the accepted-card count and first card titles before the next chapter is requested.
- Cloud memory-count readiness started on 2026-06-08: cloud project list items carry `acceptedMemoryCardCount` without exposing full accepted-card text.
- Accepted cards and pinned drafts influence continuation only through the visible continuation brief path.

### Research: User Library And Profile Patterns

Research how creative apps present account identity, project libraries, saved drafts, and profile/taste preferences.

Output:

- Recommended profile fields for this app.
- What should stay local/private.
- What should sync.
- What should never be logged.

Research pass, 2026-06-08:

- User profiles should begin as private writing preferences and library controls.
- Cloud library should sync saved projects, chapter metadata, story state, accepted craft notes, and continuity summaries.
- Raw story text, prompts, heat boundaries, and generated artifacts need redaction and owner-scoped access before cloud sync.
- A future profile table should not trust user-editable metadata for authorization; authorization should stay tied to `AuthUser.userId` and owner columns.

## Untracked File Triage

Triage date: 2026-06-08

### Parked: `SPARK_TRIAL_TASKS.md`

Decision:

- Leave untracked for now.
- Treat as a historical Spark trial log, not active product guidance.
- Do not commit it into the product repo unless the user wants a permanent experiment-history folder.

Why:

- The checklist is already completed.
- Several items describe old branch and PR #87 context.
- The durable lessons are now better represented by `OVERNIGHT_MODE.md`, `STORY_LAB_APP_AUDIT.md`, and current execution plans.

### Partially Adopted As Source Material: `STORY_QUALITY_EVALS_PLAN.md`

Decision:

- Keep as useful source material for story-quality work.
- Do not commit it unchanged yet.
- The seven core quality dimensions have been folded into tracked code as a deterministic advisory `heuristicReport`.
- Leave the untracked plan parked until any remaining AI-judge, audio, or reporting ideas are reconciled with current code.

Why:

- The plan identifies useful eval dimensions: continuity, cliffhanger quality, trope freshness, emotional variety, character consistency, prose quality, and audio-readiness.
- The repo already has tracked `tests/story-quality-evals.test.ts`, so the untracked plan needs a current-state reconciliation before becoming durable docs.

### Park/Revise Before Adoption: `tests/grok-smoke.test.ts`

Decision:

- Leave untracked for now.
- Do not add a package script yet.
- Revisit only if a low-level `StoryService` smoke is needed in addition to the existing tracked live-provider smoke paths.

Why:

- It overlaps with tracked smoke scripts.
- It is gated correctly in spirit, but it needs cleanup and a clear reason to exist before becoming part of the suite.
- Live-provider work needs credentials and telemetry proof; this file alone would not prove deployed Story Lab behavior.

## Weird Lab Queue

### Done: Tension Thread Translator

Build a tiny deterministic translator that turns numeric/internal narrative state into prose anchors before generation.

Why it might matter:

- The user explicitly liked the idea that dials should become concrete prose instead of showing only numbers.
- It could improve story continuity without exposing mechanical labels to the model.

Experiment:

- Pick 3 to 5 threads.
- Map each to behavioral prose.
- Feed only prose anchors into continuation context.
- Compare before/after continuation samples.

Status:

- Covered by the narrative dials UI merge and verified again during the 2026-06-08 overnight pass.
- The app stores selected dial option IDs internally and appends only prose anchors to UI-driven continuation briefs.
- `STORY_LAB_NARRATIVE_DIALS_UI_EXEC_PLAN.md` records the original RED/GREEN proof, and `story-generator/src/app/app.spec.ts` covers every narrative dial option.
- Future numeric story-state translators can build on this pattern, but this idea is no longer an unstarted Weird Lab item.

### Done: Continuity Courtroom

Before a continuation runs, generate a compact list of contradictions, open promises, and unresolved emotional debts.

Why it might matter:

- It gives the model a clearer memory target.
- It could make continuations feel less generic.

Experiment:

- Start with deterministic extraction from current story state.
- Add one optional AI-assisted review later.
- Show the result as a hidden generation anchor or Director's Room note.

Status:

- Done in overnight slice on 2026-06-08.
- Real Story Lab continuations now append a hidden `Continuity Courtroom` anchor to the continuation request sent through `StoryService.continueChapter`.
- The anchor is deterministic and compact: it includes unresolved plot threads, unresolved lore artifacts, and continuity warnings from `StoryStateSnapshot`.
- Resolved threads and resolved artifacts are intentionally filtered out so already-paid debts do not keep polluting the next chapter.
- Verified by `tests/story-lab-real-engine.test.ts`, which captures the service input and proves the anchor reaches the real-engine seam.

### Done: Chapter Ending Stress Test

Generate or score three possible chapter-ending directions before selecting the final continuation brief.

Why it might matter:

- Current story quality depends heavily on endings and hooks.
- A cheap ending review could create more serialized momentum.

Experiment:

- Produce three ending intents: emotional reveal, danger escalation, secret exposed.
- Score for specificity, consequence, and next-chapter pull.
- Use the winning intent as continuation context.

Status:

- Done in overnight slice on 2026-06-08.
- Real Story Lab continuations now append a hidden `Chapter Ending Stress Test` anchor alongside the continuity courtroom anchor.
- The anchor lists the three ending candidates, chooses one deterministic ending pressure from current story state plus the continuation brief, and tells the model to answer one question while leaving a sharper one active.
- The first selector is intentionally simple and deterministic. It does not claim to evaluate generated prose quality.
- Verified by `tests/story-lab-real-engine.test.ts`, which captures the continuation service input and proves the ending-pressure anchor reaches the real-engine seam.

### Done: Cliche Alarm

Name the most obvious stale version of the next scene, then instruct the generator to avoid that path.

Why it might matter:

- Trope freshness is already a story-quality concern.
- A negative target can be simpler than a complex creativity prompt.

Experiment:

- Add a pre-generation "avoid this obvious beat" note.
- Compare output against existing trope-subversion checks.

Status:

- Done in overnight slice on 2026-06-08.
- Real Story Lab continuations now append a hidden `Cliche Alarm` anchor alongside the continuity and ending-pressure anchors.
- The anchor names one concrete stale path to avoid and one freshness rule tied to an unresolved story thread or artifact.
- The tested debt/payment continuation avoids the obvious formal-demand scene and ties freshness to `Forbidden Love`.
- Verified by `tests/story-lab-real-engine.test.ts`, which captures the continuation service input and proves the cliche alarm reaches the real-engine seam.

### Done: Scene Pressure Mixer

Combine emotional, secret, deadline, social, and setting pressure into one compact continuation anchor.

Why it might matter:

- Villain pressure already works as a UI concept.
- A broader pressure mixer could make continuations more dynamic without adding many new controls.

Experiment:

- Use existing villain pressure UI as the first source.
- Add one random secondary pressure only when it does not contradict the story state.
- Keep the generated brief visible to the user.

Status:

- Done in overnight slice on 2026-06-08.
- Implemented as one compact `Scene pressure mix` line inside the existing `Chapter Ending Stress Test` hidden anchor, not as a fourth hidden block.
- The first version is seeded rather than uncontrolled random so it can be tested: the chosen ending supplies the primary pressure, current story state supplies the secondary pressure, and a stable hash selects a compact micro-variant.
- `tests/story-quality-evals.test.ts` proves the pressure mix appears as `Secret + Setting; ...` for the fixture and that no new `Scene Pressure Mixer:` block is added.
- `tests/story-lab-real-engine.test.ts` proves the line reaches the real continuation seam while the 900-character compactness guard still passes.

## Idea Template

Use this template when adding new ideas:

```md
### Status: Idea Name

Origin:

Hypothesis:

User value:

Smallest experiment:

Guardrails:

Acceptance:
```
