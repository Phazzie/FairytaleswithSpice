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
  - The panel shows honest unavailable/synced/failed/local-only states and calls the account service for refresh, save, load, and delete.
  - Local browser saves remain visible as "Saved here" and are not replaced by cloud state.
  - `npm run build` passed after the new CSS was trimmed below the hard component budget.
- Continuity Preview UI slice evidence:
  - The sidebar Story Memory section now shows a read-only Continuity Preview with prose labels for the first active/open story debts, world clue, and continuity note.
  - The preview uses current `StoryStateSnapshot` data already present on the client, so it adds no route and does not spend the remaining Vercel function slot.
  - Angular spec coverage proves `Pressure rising`, `World clue`, and `Continuity note` render from seeded story state.
  - Follow-up CSS cleanup reduced the built component CSS budget warning from 14.95 KB to 14.60 KB after the preview landed.
- Mock story length slice evidence:
  - The classic genesis mock story path now scales deterministic fallback prose toward the requested word count for single and multi-chapter requests.
  - `tests/story-service-improved.test.ts` now fails if 700, 900, or 1200 word single-story mock requests fall outside the existing 30% tolerance.
  - It also fails if the 900-word, three-chapter mock genesis total falls outside the same tolerance.
  - Validation output showed single-story mock outputs of 700 -> 665 words, 900 -> 833 words, and 1200 -> 1107 words; three-chapter 900-word mock genesis produced 828 total words.
- Continuity Courtroom slice evidence:
  - Real Story Lab continuations now translate `StoryStateSnapshot` into a compact hidden continuity anchor before calling `StoryService.continueChapter`.
  - The anchor names story debts with prose-facing labels such as `Pressure rising`, `Open promise`, `World clue`, and `Continuity note`.
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
  - `previewStoryLabContinuationGuidance` now exposes the same provider brief, hidden guidance, anchor headings, and character count for future visible continuity-preview UI without adding a route or invoking the provider.
  - The deterministic state still drives the guidance; only the wording shown to the model is less mechanical.
- Deterministic story-quality report evidence:
  - The Story Lab evaluate route now attaches an optional `heuristicReport` to both mock and live evaluation responses.
  - The report is deterministic and advisory: it scores continuity, cliffhanger quality, trope freshness, emotional variety, character consistency, prose quality, and audio-readiness from bounded text signals.
  - `tests/story-quality-evals.test.ts` now fails unless the report includes all seven planned dimensions, normalized 0-100 scores, and explainable signals.
  - This folds the useful dimensions from the untracked `STORY_QUALITY_EVALS_PLAN.md` into tracked code without committing the untracked planning file unchanged.
- Visible Proving Grounds quality-report evidence:
  - Proving Grounds now renders `heuristicReport` inside evaluated story results as a compact Deterministic Quality Scan panel.
  - The panel shows the advisory overall score, each dimension score, rationale, and the first two explainable signals per dimension.
  - Proving Grounds history cards now show a compact `Quality N` badge for evaluated results with heuristic reports, and comparison cards include the heuristic quality score beside the AI score.
  - `proving-grounds.spec.ts` seeds an evaluated result and fails unless the deterministic panel renders continuity, audio-readiness, overall score, and concrete signals.
  - The new CSS was trimmed back under the component warning budget; `npm run build` no longer reports a Proving Grounds CSS warning.
- Angular browser-suite evidence:
  - The stale `App re-enables cloud controls after an account route error` spec assertion was corrected to test the visible local-library heading and re-enabled cloud button instead of the unrelated local save-status signal.
  - Targeted app spec run passed with `52 SUCCESS`.
  - Full Angular browser run passed with `93 SUCCESS`.
- Clerk auth adapter scaffold evidence:
  - `api/_lib/story-lab/auth/clerkAuthPort.ts` now extracts Clerk session tokens from `Authorization: Bearer ...`, `cookies.__session`, or raw `Cookie` headers.
  - The adapter still fails closed unless an explicit verifier is injected, so raw provider tokens do not become app users.
  - `tests/story-lab-clerk-auth.test.ts` proves missing verifier denial, bearer-token verification, `__session` extraction, and invalid-token rejection without leaking token text.
  - `npm run test:all` now includes `test:story-lab-clerk-auth`.
- Cloud schema scaffold evidence:
  - `api/_lib/story-lab/storage/storyLabCloudSchema.sql` now records the migration-ready table shape for private profiles and owner-scoped cloud projects.
  - `tests/story-lab-cloud-schema.test.ts` fails if the tracked schema loses the profile table, project table, owner column, project JSON payload, or owner indexes.
  - `api/_lib/story-lab/storage/storyLabCloudSchemaMigration.ts` can split and apply that tracked schema through an injected executor.
  - `scripts/recovery/apply-story-lab-cloud-schema.ts` is a guarded real-database apply script that refuses to run unless `DATABASE_URL` is configured.
  - `api/_lib/story-lab/storage/storyLabCloudDatabaseReadiness.ts` and `scripts/recovery/story-lab-cloud-db-smoke.ts` can check the required profile/project tables and owner indexes when a real `DATABASE_URL` is present.
  - The helper is migration-ready, but no live database has been provisioned or migrated in this environment yet.
- Cloud storage configuration seam evidence:
  - `api/_lib/story-lab/storage/storyLabCloudStorageConfig.ts` now centralizes default profile/project store construction for the account route.
  - `@neondatabase/serverless` and `api/_lib/story-lab/storage/neonStoryLabExecutor.ts` now provide the real Neon/Postgres executor adapter behind that seam.
  - It only creates an executor when a database URL exists, so deploy/build paths still fail closed instead of initializing a missing driver at import time.
  - `tests/story-lab-cloud-storage-config.test.ts` proves missing database env does not initialize a driver, shared injected executors wire both stores, valid database URLs create the bundled Neon executor, and invalid URLs return typed fail-closed errors.
  - `tests/story-lab-neon-executor.test.ts` proves SQL text and params are passed through the Neon wrapper without making live database calls.
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
- The auth seam now has a Clerk-shaped adapter scaffold, but live Clerk verification/sign-in is still not wired.
- Classic genesis mock generation now has enforced word-count tolerance instead of warning-only length checks.
- Real continuations now receive hidden, deterministic continuity-debt, ending-pressure, and stale-path anchors before generation.
- Story evaluation responses now carry a deterministic advisory quality report with seven explainable craft dimensions.
- Server/client logging and privacy scaffolding have already received meaningful work in prior phases.

## Current Product Reality

For a normal user, the app is still mostly an anonymous, local-browser Story Lab.

What users can meaningfully experience now:

- Build a Story Lab idea with richer story controls.
- Generate and continue stories through the job-backed UI path.
- See job progress/status while the current process is alive.
- Use local browser save/load behavior for recent projects.
- See a Cloud account panel that clearly says cloud sync is unavailable until account storage is configured.
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

The Story Lab job route scaffold is useful, but the store is process-local and labelled `non_durable_memory`. It should not be described as crash-safe progress.

Required before this becomes durable:

- Add a database-backed job table.
- Add owner-scoped job authorization.
- Add a Workflow or equivalent durable runner decision.
- Persist job events/snapshots outside the current process.
- Add recovery tests that simulate missing in-memory state.

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

This is now addressed by `STORY_LAB_IDEA_BOARD.md`, but the board still needs to be populated by actual research passes.

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
