# Story Lab App Audit

Last updated: 2026-06-08

## Purpose

This audit is the current working snapshot for Story Lab after the large PR merge and the narrative dials UI merge. It is written for coding agents and for the user. It separates what is actually working from what is only scaffolded, planned, or still needs external provisioning.

## Fresh Evidence

Commands run from `/Users/hbpheonix/fairytaleswithspice` on 2026-06-08:

- `git status --short --branch`
  - Result: `main` tracks `origin/main`.
  - Untracked files present: `SPARK_TRIAL_TASKS.md`, `STORY_QUALITY_EVALS_PLAN.md`, `tests/grok-smoke.test.ts`.
- `gh pr list --state open --json number,title,headRefName,baseRefName,url`
  - Result: no open PRs returned.
- `git log --oneline --decorate -8`
  - Latest commit: `4834914` / PR #113, `feature/story-lab-narrative-dials-ui`, merged into `main`.
- `scripts/recovery/check-vercel-function-count.sh`
  - Result: `10/12`, within limit.
- `scripts/recovery/preflight.sh --quick --skip-status`
  - Result: passed required tools, whitespace/conflict markers, Vercel function count, Angular app typecheck, Angular spec typecheck, and Vercel API function typecheck.
- Angular service-method slice evidence:
  - Story Lab profile/cloud project methods were added to `StoryService`.
  - `story.service.spec.ts` now type-checks profile get/update and cloud project list/save/load/delete client calls.
- Visible cloud-library UI slice evidence:
  - The Angular app now has a Cloud account panel above the local browser save list.
  - The panel now separates account connection state from cloud sync state with a visible `Account Not connected` row until cloud sync actually succeeds.
  - The panel now includes a `Connect account` action that reports sign-in setup status without calling the cloud library route or pretending live auth is configured.
  - Cloud save is now gated on a connected cloud state, so unavailable account state does not fire a doomed save request.
  - Cloud load and delete are now gated on the same connected cloud state, so stale visible cloud projects cannot fire route calls while account sync is unavailable.
  - The panel shows honest unavailable/synced/failed/local-only states and calls the account service for refresh, save, load, and delete.
  - Cloud and local saved-project rows now show accepted memory-card counts when present, using count-only metadata rather than exposing full private card text.
  - Local browser saves remain visible as "Saved here" and are not replaced by cloud state.
  - `npm run build` passed after the new CSS was trimmed below the hard component budget.
- Job status UI honesty evidence:
  - The running job panel now shows the server-provided `non_durable_memory` warning while process-local jobs are active, so the UI does not silently imply crash-safe progress.
  - Browser reload recovery now has focused coverage for vanished process-local genesis and continuation jobs; the app clears stale markers/panels and tells the user the job could not be restored because in-memory job state is gone.
- Continuity Preview UI slice evidence:
  - The sidebar Story Memory section now shows a read-only Continuity Preview with prose labels for the first active/open story debts, world clue, and continuity note.
  - The preview now also shows one `Relationship pressure` item when current character state has a relationship edge.
  - The preview now shows compact source reasons such as `Active story thread`, `Current relationship edge`, `Unresolved world clue`, and `Continuity note to honor`, so users can see why each memory item is active.
  - When the user types a custom continuation brief, the visible preview now prioritizes matching threads, world clues, relationship pressure, and continuity notes, and labels those rows as `Matched custom brief`.
  - The preview now shows compact lifetime labels such as `Series memory` and `Chapter memory` for lifetime-tagged threads and lore artifacts.
  - Story Memory now also renders read-only Memory Card Drafts for the first current character, active promise, and world clue, with trigger phrases such as `Trigger: Mara`.
  - Memory Card Drafts can now be pinned; pinned draft IDs save with browser-local projects and restore when the project reloads.
  - Multi-word memory card draft triggers now include a short alias, such as `Trigger: Moonlit oath, oath`, so a future trigger system has both exact and compact match text.
  - Pinned Memory Card Drafts now append compact `Pinned Memory Cards` prose anchors to UI-driven continuation requests, so pinned cards affect the next chapter without adding a backend route or claiming durable cloud memory.
  - Drafts can now be accepted into a local `Accepted Memory Cards` shelf; accepted cards save with browser-local projects, restore on reload, and use the same visible continuation brief path.
  - Accepted memory cards can now be edited in place for title, detail, and trigger text before save/reload or continuation.
  - Accepted memory cards can now be deleted so rejected memory does not persist into saves or continuation briefs.
  - Accepted memory cards can now be reordered with disabled boundary controls; the order saves with browser-local projects and controls the order of the `Accepted Memory Cards` continuation brief.
  - The continuation panel now shows a compact accepted-memory preview line with count and card titles before users continue.
  - Accepted memory card text now appears in the continuation source map when it activates a hidden continuity anchor, and `tests/story-quality-evals.test.ts` compares the same continuation brief with and without an accepted card to prove the selected anchor changes.
  - The preview uses current `StoryStateSnapshot` data already present on the client, so it adds no route and does not spend the remaining Vercel function slot.
  - Angular spec coverage proves `Pressure rising`, `Relationship pressure`, `World clue`, and `Continuity note` render from seeded story state.
  - Follow-up CSS cleanup reduced the built component CSS budget warning from 14.95 KB to 14.60 KB after the preview landed.
- Mock story length slice evidence:
  - The classic genesis mock story path now scales deterministic fallback prose toward the requested word count for single and multi-chapter requests.
  - `tests/story-service-improved.test.ts` now fails if 700, 900, or 1200 word single-story mock requests fall outside the existing 30% tolerance.
  - It also fails if the 900-word, three-chapter mock genesis total falls outside the same tolerance.
  - Validation output showed single-story mock outputs of 700 -> 665 words, 900 -> 833 words, and 1200 -> 1107 words; three-chapter 900-word mock genesis produced 828 total words.
- Continuity Courtroom slice evidence:
  - Real Story Lab continuations now translate `StoryStateSnapshot` into a compact hidden continuity anchor before calling `StoryService.continueChapter`.
  - The anchor names story debts with prose-facing labels such as `Pressure rising`, `Open promise`, `World clue`, and `Continuity note`.
  - Initial protagonist/antagonist state now seeds a typed relationship edge, and continuation guidance folds one compact `Relationship pressure` line into the existing courtroom anchor.
  - Resolved threads and artifacts are filtered out so the next chapter is not dragged back to already-paid story debts.
  - `tests/story-lab-real-engine.test.ts` captures the continuation service input and proves the original brief plus the `Continuity Courtroom` anchor reach the real-engine seam.
- Chapter Ending Stress Test slice evidence:
  - Real Story Lab continuations now add a compact hidden ending-pressure anchor before the continuation provider call.
  - The anchor considers emotional reveal, danger escalation, and secret exposed, then chooses one deterministic pressure from current story state and the continuation brief.
  - It also folds in a compact scene-pressure mix such as `Secret + Setting` plus a seeded micro-variant without adding a fourth hidden anchor block.
  - The tested state with unresolved lore, continuity warning, and debt/payment language selects `Secret exposed`.
  - `tests/story-lab-real-engine.test.ts` captures the continuation service input and proves the ending-pressure anchor reaches the real-engine seam.
- Cliche Alarm slice evidence:
  - Real Story Lab continuations now add a compact hidden stale-path warning before the continuation provider call.
  - The anchor names one obvious stale path to avoid and ties freshness to a concrete unresolved thread or artifact.
  - The tested debt/payment continuation avoids a formal-demand scene with no personal cost and ties freshness to `Forbidden Love`.
  - `tests/story-lab-real-engine.test.ts` captures the continuation service input and proves the cliche alarm reaches the real-engine seam.
- Hidden-anchor compactness guard evidence:
  - The real-engine seam test now fails if the composed hidden continuation anchors exceed 900 characters.
  - The redundant generic courtroom instruction was removed; concrete thread, artifact, warning, ending-pressure, and stale-path lines still reach the continuation seam.
- Hidden-anchor prose-label eval evidence:
  - `tests/story-quality-evals.test.ts` now fails if hidden continuation guidance exposes mechanical labels such as `Escalating thread`, `Open thread`, `Unresolved artifact`, or `Warning to honor`.
  - The same eval now fails if the Cliche Alarm tells the model to avoid `generic conflict`; the stale-path guidance instead asks for freshness through a concrete target with visible cost.
  - The eval also fails if world clues keep the generic `World Details` name; seeded world artifacts now derive compact names such as `Witness Shells` or `Vow-Binding Songs` from the world-detail text.
  - The eval now fails if a continuation brief asks for a compacted-out thread such as `Blood Oath` and the `Continuity Courtroom` anchor does not prioritize that brief-matched memory.
  - The eval now also fails if a continuation brief asks for a compacted-out unresolved artifact such as `Glass Key` and the `Continuity Courtroom` anchor does not prioritize that brief-matched world clue.
  - The eval now also fails if a continuation brief names a non-first relationship participant such as `Coral Scribe` and the `Relationship pressure` line keeps selecting the older first pair.
  - The eval now also fails if a continuation brief names a compacted-out continuity warning such as the `Coral Scribe` ledger note and the `Continuity note` line keeps selecting older unrelated warnings.
  - `previewStoryLabContinuationGuidance` now exposes the same provider brief, hidden guidance, anchor headings, and character count for future visible continuity-preview UI without adding a route or invoking the provider.
  - `previewStoryLabContinuationGuidance` now also exposes a route-free Context Source Map explaining which thread, artifact, relationship, or warning was activated and whether it matched the continuation brief.
  - The deterministic state still drives the guidance; only the wording shown to the model is less mechanical.
- Deterministic story-quality report evidence:
  - The Story Lab evaluate route now attaches an optional `heuristicReport` to both mock and live evaluation responses.
  - The report is deterministic and advisory: it scores continuity, cliffhanger quality, trope freshness, emotional variety, character consistency, prose quality, and audio-readiness from bounded text signals.
  - Prose quality now includes a small Specificity Lens signal for concrete anchors such as `witness shell`, `reef arch`, and `blood oath`, so the quality scan can distinguish story matter from only sentence shape.
  - Prose quality now also includes a small Sensory Texture signal for concrete cues such as `glow`, `salt`, and `sting`, so the quality scan can notice physically grounded scene detail.
  - Character consistency now includes a small Agency Lens signal for named-character actions such as `pressed` and `touched`, so the scan can notice when characters are doing things on the page.
  - Audio-readiness now includes a small Dialogue Texture signal for speaker variety, such as `Mira`, `Narrator`, and `Lord Brine`, so the scan can distinguish tagged multi-voice scenes from a bare dialogue-line count.
  - `tests/story-quality-evals.test.ts` now fails unless the report includes all seven planned dimensions, normalized 0-100 scores, explainable signals, the prose-quality specificity and sensory-texture signals, the character-consistency agency signal, and the audio-readiness speaker-variety signal.
  - This folds the useful dimensions from the untracked `STORY_QUALITY_EVALS_PLAN.md` into tracked code without committing the untracked planning file unchanged.
- Visible Proving Grounds quality-report evidence:
  - Proving Grounds now renders `heuristicReport` inside evaluated story results as a compact Deterministic Quality Scan panel.
  - The panel shows the advisory overall score, each dimension score, rationale, and the first two explainable signals per dimension.
  - Proving Grounds history cards now show a compact `Quality N` badge for evaluated results with heuristic reports, and comparison cards include the heuristic quality score beside the AI score.
  - `proving-grounds.spec.ts` seeds an evaluated result and fails unless the deterministic panel renders continuity, audio-readiness, overall score, and concrete signals.
  - The new CSS was trimmed back under the component warning budget; `npm run build` no longer reports a Proving Grounds CSS warning.
- Bundle-size cleanup evidence:
  - The Proving Grounds route is now lazy-loaded with `loadComponent`, so the debug/evaluation surface is no longer part of the first-page browser `main` chunk.
  - `tests/story-generator-route-splitting.test.ts` fails if `app.routes.ts` eagerly imports Proving Grounds or uses an eager `component` route for `/proving-grounds`.
  - `npm run build -- --stats-json` showed the previous browser main chunk was `524192` bytes before the split; after the split, `main-H7VW2DYB.js` is `131760` bytes and Proving Grounds is a lazy `78.52 kB` browser chunk.
  - The production build initial total dropped from the prior `558.78 kB` warning state to `481.61 kB`, under the 500 kB soft initial bundle budget.
- Component style-budget evidence:
  - Root Story Lab component styles are now split between `app.css` and `app-reader-library.css` while staying in Angular component-scoped `styleUrls`.
  - `tests/story-generator-component-style-budget.test.ts` minifies each `app*.css` component style file with esbuild and fails if any file exceeds 12,000 bytes.
  - The guard records `app.css` at `11371` bytes and `app-reader-library.css` at `3638` bytes after minification.
  - `npm run build` no longer emits the previous `app.css` component-style budget warning.
- Angular browser-suite evidence:
  - The stale `App re-enables cloud controls after an account route error` spec assertion was corrected to test the visible local-library heading and re-enabled cloud button instead of the unrelated local save-status signal.
  - Targeted app spec run passed with `52 SUCCESS`.
  - Full Angular browser run passed with `93 SUCCESS`.
- Clerk auth adapter scaffold evidence:
  - `api/_lib/story-lab/auth/clerkAuthPort.ts` now extracts Clerk session tokens from `Authorization: Bearer ...`, `cookies.__session`, or raw `Cookie` headers.
  - The adapter still fails closed unless an explicit verifier is injected, so raw provider tokens do not become app users.
  - `api/_lib/story-lab/auth/configuredAuthPort.ts` now supports explicit `STORY_LAB_AUTH_PROVIDER=clerk` selection and fails closed for blank or unknown providers without leaking bearer token text.
  - `tests/story-lab-clerk-auth.test.ts` proves missing verifier denial, bearer-token verification, `__session` extraction, and invalid-token rejection without leaking token text.
  - `tests/story-lab-configured-auth.test.ts` proves env-gated Clerk selection and unknown-provider denial.
  - `npm run test:all` now includes `test:story-lab-clerk-auth`.
- Cloud schema scaffold evidence:
  - `api/_lib/story-lab/storage/storyLabCloudSchema.sql` now records the migration-ready table shape for private profiles, owner-scoped cloud projects, and future durable job snapshots/events.
  - `tests/story-lab-cloud-schema.test.ts` fails if the tracked schema loses the profile table, project table, owner column, project JSON payload, durable job tables, event ordering, or owner indexes.
  - `api/_lib/story-lab/storage/storyLabCloudSchemaMigration.ts` can split and apply that tracked schema through an injected executor.
  - `scripts/recovery/apply-story-lab-cloud-schema.ts` is a guarded real-database apply script that refuses to run unless `DATABASE_URL` is configured.
  - `api/_lib/story-lab/storage/storyLabCloudDatabaseReadiness.ts` and `scripts/recovery/story-lab-cloud-db-smoke.ts` can check the required profile/project/job tables and owner/event indexes when a real `DATABASE_URL` is present.
  - The helper is migration-ready, but no live database has been provisioned or migrated in this environment yet.
- Profile preference hardening evidence:
  - `normalizeStoryLabProfilePreferences` now treats profile preferences as runtime data and allow-lists heat-contract enums, favorite creature ids, favorite tone ids, library sort values, strings, and booleans before persistence.
  - `tests/story-lab-profile-store.test.ts` now fails if malformed client or stored preference values such as unknown creatures, invalid library sort, non-array favorite lists, or string adult confirmation can survive normalization.
  - This hardens profile storage without changing authorization; `AuthUser.userId` remains the ownership source.
- Cloud storage configuration seam evidence:
  - `api/_lib/story-lab/storage/storyLabCloudStorageConfig.ts` now centralizes default profile/project store construction for the account route.
  - `@neondatabase/serverless` and `api/_lib/story-lab/storage/neonStoryLabExecutor.ts` now provide the real Neon/Postgres executor adapter behind that seam.
  - It only creates an executor when a database URL exists, so deploy/build paths still fail closed instead of initializing a missing driver at import time.
  - `tests/story-lab-cloud-storage-config.test.ts` proves missing database env does not initialize a driver, shared injected executors wire both stores, valid database URLs create the bundled Neon executor, and invalid URLs return typed fail-closed errors.
  - `tests/story-lab-neon-executor.test.ts` proves SQL text and params are passed through the Neon wrapper without making live database calls.
  - Cloud project list items now include `acceptedMemoryCardCount`, derived from saved project JSON, so future cloud library UI can show memory-card status without exposing full private card text in list responses.
- Job storage configuration seam evidence:
  - `api/_lib/story-lab/jobs/storyLabJobStoreConfig.ts` now centralizes future job-store selection.
  - The default mode remains `non_durable_memory`, so anonymous job routes are not accidentally changed.
  - Explicit `STORY_LAB_JOB_STORE=postgres` creates the tested Postgres job-store scaffold only when database URL and executor configuration exist.
  - Unknown job-store modes fail closed with `STORY_LAB_JOB_STORE_UNSUPPORTED_MODE` instead of silently falling back.
  - The active job route now resolves through that config seam for the default memory store, rejects unsupported modes with `JOB_STORE_UNAVAILABLE`, and blocks durable Postgres mode until owner-scoped route auth is present.
  - `createStoryLabJobsRouteHandler` now supports injected auth and job-store config for tests/future wiring; durable stores require account auth before job creation and receive `ownerUserId` on create.
  - Job-store status and event reads now accept owner context; non-durable memory filters owner-scoped reads when an owner is supplied, Postgres reads require `ownerUserId`, and route status/event reads pass the authenticated owner for durable stores.
  - Job-store updates now accept owner context; durable route execution passes the authenticated owner through running/completed/failed updates, and Postgres updates require `ownerUserId` plus `where owner_user_id = $2` before writing snapshots/events.
  - `tests/story-lab-job-store-config.test.ts` guards those config paths.
  - `tests/story-lab-job-routes.test.ts` is now included in `npm run test:all` so route-level store-mode failure behavior is covered by normal verification.
- `npm run test:all`
  - Result: passed root story, trope, cliffhanger, Story Lab state, Story Lab real-engine, cloud-schema, cloud-storage-config, Neon executor, and story-quality eval tests.
  - Caveat: ran in mock mode because `XAI_API_KEY` was not present.

Additional branch evidence after the auth/profile account-route slices on `feature/story-lab-auth-profile-contracts`:

- `scripts/recovery/check-vercel-function-count.sh`
  - Result: `11/12`, within limit after intentionally adding `api/story-lab/account.ts`.
- `npm run test:all`
  - Result: passed with `tests/story-lab-account-routes.test.ts` included.
- `scripts/recovery/preflight.sh --quick --skip-status`
  - Result: passed required tools, whitespace/conflict markers, Vercel function count, Angular app typecheck, Angular spec typecheck, and Vercel API function typecheck.

Files inspected during this audit:

- `AGENTS.md`
- `STORY_LAB_PLATFORM_EVOLUTION_EXEC_PLAN.md`
- `STORY_LAB_STORAGE_PORT_EXEC_PLAN.md`
- `api/_lib/story-lab/auth/authPort.ts`
- `api/_lib/story-lab/auth/authorizeProjectAccess.ts`
- `api/_lib/story-lab/storage/storyProjectStore.ts`
- `story-generator/src/app/story-workspace-storage.service.ts`

## Current Health

The app is mechanically healthier than it was before the repo cleanup.

- The original audit snapshot was on `main`, aligned with `origin/main`; current overnight auth/profile work is on `feature/story-lab-auth-profile-contracts`.
- There are no currently open PRs to address.
- The Vercel function budget is not exhausted: `11/12` on the account-route branch.
- Quick preflight passes.
- Root integration/unit checks pass.
- Story Lab UI work has landed through narrative dials, villain pressure, Director's Room notes, job status, batch queue, and job-backed genesis/continuation flows.
- The codebase has explicit seams for account auth, owner-scoped project storage, private profiles, a tracked cloud schema, lazy Neon-backed cloud storage configuration, one consolidated account route, and visible local/cloud library state.
- The auth seam now has an env-selectable Clerk-shaped adapter scaffold, but live Clerk verification/sign-in is still not wired.
- Classic genesis mock generation now has enforced word-count tolerance instead of warning-only length checks.
- Real continuations now receive hidden, deterministic continuity-debt, ending-pressure, and stale-path anchors before generation.
- Story memory contracts now support optional lifetime labels on plot threads and lore artifacts, so future continuation logic can distinguish scene, chapter, and series facts without changing the visible model prompt yet.
- Story evaluation responses now carry a deterministic advisory quality report with seven explainable craft dimensions.
- The initial browser bundle warning has been cleared by lazy-loading Proving Grounds, and the root component-style budget warning has been cleared by splitting scoped Story Lab styles.
- Server/client logging and privacy scaffolding have already received meaningful work in prior phases.

## Current Product Reality

For a normal user, the app is still mostly an anonymous, local-browser Story Lab.

What users can meaningfully experience now:

- Build a Story Lab idea with richer story controls.
- Generate and continue stories through the job-backed UI path.
- See job progress/status while the current process is alive.
- See a warning that current job progress is held in memory for this deployment.
- Use local browser save/load behavior for recent projects.
- See a Cloud account panel that clearly says cloud sync is unavailable until account storage is configured.
- See accepted memory-card counts on saved cloud/local library rows when those projects have accepted memory.
- See the Story Memory / Continuity Preview adjust to a typed custom continuation brief before continuing.
- Use narrative controls such as heat contract, Director's Room notes, villain pressure, and narrative dials.
- Use Proving Grounds evaluation to see a deterministic advisory quality scan when the evaluation response includes `heuristicReport`.

What users cannot honestly rely on yet:

- Signing in.
- Having a user-visible profile.
- Actually saving stories to a cloud account across devices.
- Opening their story library across devices.
- Resuming background generation after a server process dies.
- Getting durable long-running Workflow-backed progress.
- Proving live Grok output in this environment without configuring `XAI_API_KEY`.

## Issue List

### P0: Account Auth Is Not Implemented

There is an `AuthPort`, `authorizeProjectAccess`, and a consolidated account route that calls `authPort.requireUser(req)`, but the active auth port is still deny-by-default. That is good architecture scaffolding. It is not a login system.

Required before this becomes a user feature:

- Pick an auth provider.
- Define session/cookie behavior for Vercel.
- Add login/logout/profile UI.
- Wire a real provider adapter through `AuthPort`.
- Keep forbidden cross-user access covered by tests as the provider adapter lands.

### P0: Cloud Project Storage Is Visible But Not Real Yet

The storage port exists and models owner-scoped saved projects. A consolidated account route exposes profile and project operations behind auth/storage seams, `StoryService` has client methods for those calls, the app now shows a Cloud account panel, `storyLabCloudSchema.sql` records the profile/project table contract, and `storyLabCloudStorageConfig.ts` centralizes lazy Neon-backed store construction. The panel is deliberately honest: it keeps local browser storage visible and reports cloud unavailable/failed until auth and durable storage are configured.

Required before this becomes a user feature:

- Provision or configure a durable database.
- Run `npm run db:story-lab-apply-schema` against a real provisioned database, or execute the tracked schema through the equivalent deployment migration path.
- Run `npm run smoke:story-lab-cloud-db` with a real `DATABASE_URL` to prove the profile/project tables and owner indexes exist.
- Prove the Neon executor against the provisioned database.
- Save, load, list, and delete projects by authenticated owner against real durable storage.
- Make local browser storage a fallback/cache instead of the canonical signed-in source for signed-in users.
- Add login/profile affordances and configured cloud-library states.

### P0: Job Progress Is Not Durable

The Story Lab job route scaffold is useful, but the active route store is still process-local and labelled `non_durable_memory`. A migration-ready `story_lab_jobs` / `story_lab_job_events` schema contract now exists, `api/_lib/story-lab/jobs/postgresStoryLabJobStore.ts` provides a tested injected-executor scaffold, and `storyLabJobStoreConfig.ts` provides an env-gated future selection seam. The route now uses that seam for default memory storage, fails closed for unsupported durable modes, and can pass authenticated owner context into injected durable stores in tests. Status/event reads and job updates are owner-aware now, and the UI now displays the non-durable warning while jobs run, but no production route uses the durable Postgres store yet, so the product should not be described as crash-safe progress.

Required before this becomes durable:

- Integrate the database-backed job store into the job route behind auth.
- Prove owner-scoped job authorization against a real database-backed route.
- Add a Workflow or equivalent durable runner decision.
- Persist job events/snapshots outside the current process.
- Add durable-store recovery tests once the production route can actually read durable job state after process loss.

### P0: Live Provider Proof Is Missing In This Environment

The root tests pass without `XAI_API_KEY`, which is good for local development. It does not prove live Grok output.

Required before live-story claims:

- Run the live-provider smoke with credentials configured.
- Prove telemetry says Grok/live provider, not mock.
- Record the exact command, env requirements, and pass/fail result in a handoff or deployment proof doc.

### Resolved: Continuation Mock Length Uses The Live Prompt Default

The classic genesis mock path now scales to requested word count for both single-story and multi-chapter generation. Continuation mock chapters now scale to the live continuation prompt's default 400-600 word target.

Current proof:

- `tests/story-service-improved.test.ts` fails if mock continuation chapters fall outside 400-600 words.
- Focused validation showed mock continuation chapters at 477 words each.
- This is still a default-length contract. `ChapterContinuationSeam['input']` does not carry a user-configurable continuation word budget.

Remaining future option:

- Add an explicit continuation word-budget field if the product needs continuation length controls beyond the live prompt's 400-600 word default.

### Resolved: Initial Bundle Warning Was Reduced By Route Splitting

Proving Grounds is useful, but it is a debug/evaluation surface rather than the first Story Lab screen. It was contributing component and service code to the initial browser bundle.

Current proof:

- RED: `npm run test:story-generator-route-splitting` failed while `app.routes.ts` eagerly imported Proving Grounds.
- GREEN: the same test passed after `/proving-grounds` moved to `loadComponent`.
- `npm run build -- --stats-json` showed no `src/app/proving-grounds/` files in browser `main-H7VW2DYB.js`.
- `npm run build` showed the initial browser total at `481.61 kB`, with Proving Grounds emitted as a lazy `78.52 kB` browser chunk.

Remaining future option:

- Further reduce total CSS payload when doing larger UI refactors; the current slice clears the per-component warning without redesigning the app.

### Resolved: Root Component Style Warning Was Split Under Budget

The Story Lab root component had grown into one large `app.css` file. Angular's `anyComponentStyle` warning budget is 12 kB, and the single file was minifying to `14959` bytes.

Current proof:

- RED: `npm run test:story-generator-component-style-budget` failed because `app.css` minified to `14959` bytes.
- GREEN: the same test passed after reader, chapter, library, and story-memory styles moved into `app-reader-library.css`.
- `app.css` now minifies to `11371` bytes; `app-reader-library.css` minifies to `3638` bytes.
- Targeted app browser spec passed with `TOTAL: 64 SUCCESS`.
- `npm run build` passed with no component-style budget warnings.

Remaining future option:

- If the UI keeps growing, extract real child components instead of letting the root app component collect every panel style.

### P1: Vercel Function Budget Is Tight

The current branch count is `11/12`. There is room, but not enough to add auth, storage, profile, export, and job routes casually.

Rule:

- Before adding deployable route files, run `scripts/recovery/check-vercel-function-count.sh`.
- If the count reaches `12/12`, consolidate or retire routes before adding more.

### P1: Storage Plan Status Was Reconciled

`STORY_LAB_STORAGE_PORT_EXEC_PLAN.md` was reconciled during the overnight docs pass. Treat the current plan docs and live git state as authoritative if this drifts again.

### P1: Full Browser/Angular Validation Remains Environment-Sensitive

Quick preflight completed here, but historical notes show local Angular/Karma/browser checks can hang in this environment. Overnight work should use shardable checks, direct TypeScript proof, and browser smoke only when the environment is stable.

### P1: Untracked Files Need Triage

The following files are untracked:

- `SPARK_TRIAL_TASKS.md`
- `STORY_QUALITY_EVALS_PLAN.md`
- `tests/grok-smoke.test.ts`

Triage was recorded in `STORY_LAB_IDEA_BOARD.md` on 2026-06-08. Current decision: park `SPARK_TRIAL_TASKS.md`, keep `STORY_QUALITY_EVALS_PLAN.md` as source material for future story-quality planning, and park/revise `tests/grok-smoke.test.ts` before adoption because tracked live-provider smoke paths already exist.

### P2: Competitor/Research Mining Has No Durable Workflow Yet

The user wants autonomous research, idea mining, and occasional weird experiments. Before this doc pass, there was no durable place to store research leads, experiment hypotheses, source links, or rejected ideas.

This is now addressed by `STORY_LAB_IDEA_BOARD.md`. The 2026-06-08 research passes have started populating it with source-backed patterns from adjacent writing tools. The strongest new follow-up is `Context Source Map`: make the app explain why a continuity item was activated for the next generation.

## Auth, Storage, And Profiles Recommendation

Do not start by bolting login UI onto the current app. Start with a provider decision and a storage/profile contract.

Recommended order:

1. Provider decision: choose auth provider and database/storage provider for Vercel.
2. Profile contract: define what a user profile contains, what is private, and what is optional.
3. Storage migration: connect signed-in users to cloud project save/list/load/delete.
4. Library UI: expose a user-facing story shelf.
5. Durable jobs: persist job state and require owner access.
6. Deployment proof: run live provider, auth, storage, and route-budget checks.

## Suggested Next Autonomous Work

Use this order unless a newer user request or failing PR check supersedes it:

1. Implement the provider-backed `AuthPort` adapter behind explicit environment configuration.
2. Configure a real `DATABASE_URL`, execute the schema, and prove the Neon executor against the provisioned database.
3. If no provider/database decision is available, decide and test the continuation mock-length policy or run the next bounded story-output experiment from `STORY_LAB_IDEA_BOARD.md`.
4. Replace the fail-closed cloud UI path with configured auth/storage behavior without breaking anonymous local save once credentials and storage configuration exist.
