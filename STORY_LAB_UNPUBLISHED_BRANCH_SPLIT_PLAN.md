# Story Lab Unpublished Branch Split Plan

Created: 2026-06-13 00:00 EDT

## Purpose

Recover the local-only `feature/story-lab-auth-profile-contracts` work by publishing it as small reviewable PRs instead of one oversized PR.

Current verified state when this plan was written:

- local branch: `feature/story-lab-auth-profile-contracts`
- local head: `ecba20e Document unpublished branch recovery plan`
- ahead of `origin/main`: 89 commits
- upstream: none
- matching remote branch: none
- open PR: none
- tracked worktree: clean
- local-only untracked files observed in this workspace remain intentionally out of PR scope; these are not expected to exist in fresh clones:
  - `SPARK_TRIAL_TASKS.md`
  - `STORY_LAB_REVIEW_MISTAKES_2026-06-09.md`
  - `STORY_QUALITY_EVALS_PLAN.md`
  - `tests/grok-smoke.test.ts`

## Operating Rules

- Do not add new product features until this stack is published or intentionally discarded.
- Push a remote backup branch before destructive split work.
- The backup branch is not the merge PR.
- Parent agent owns branch creation, pushes, PRs, review comments, and merges.
- Subagents may help with read-only inventory, risk review, and validation planning only.
- Prefer serial PRs. Merge each slice before extracting the next slice unless a later slice is deliberately stacked.

## Candidate PR Slices

### PR 1: Publishing Discipline And Recovery Docs

Goal: land the process guardrails and the split plan before touching feature code.

Scope correction: after PR #114 opened, Sourcery reported the docs diff was too large for automated review. PR 1 must stay limited to publication discipline, lessons, changelog, and this split checklist. Larger operating/audit docs move to PR 2.

Likely commits:

- `ecba20e Document unpublished branch recovery plan`
- this split-plan doc commit

Key files:

- `AGENTS.md`
- `LESSONS_LEARNED.md`
- `PR70_RECOVERY_CHANGELOG.md`
- `STORY_LAB_UNPUBLISHED_BRANCH_SPLIT_PLAN.md`

Validation:

- `git diff --check`

### PR 2: Operating Docs And Auth/Profile Plan Baseline

Goal: preserve the non-code audit, idea board, overnight plan, and auth/profile plan setup that later code slices reference.

Likely commits:

- `087456a Add Story Lab audit and overnight mode docs`
- `d40a7e3 Reconcile Story Lab storage plan status`
- `36a7ea3 Triage overnight source files`
- `d85d5b8 Add Story Lab research mining notes`
- `75b4099 Plan Story Lab auth profile cloud library`
- doc-only workflow commits such as `dc8d15b`, `27e2cb9` if they apply cleanly

Key files:

- `STORY_LAB_APP_AUDIT.md`
- `STORY_LAB_IDEA_BOARD.md`
- `OVERNIGHT_MODE.md`
- `OVERNIGHT_HANDOFF.md`
- `STORY_LAB_AUTH_PROFILE_CLOUD_LIBRARY_EXEC_PLAN.md`
- `AGENTS.md`
- `LESSONS_LEARNED.md`
- `PR70_RECOVERY_CHANGELOG.md`

Validation:

- `git diff --check`

### PR 3: Auth And Profile Contracts

Goal: add the account/profile domain seam without live provider or database claims.

Likely commits:

- `75b485f Add Story Lab auth profile contract slice`
- `6459454 Add Story Lab profile store slice`
- `99317f1 Add env-gated Story Lab Clerk auth config`
- `b99ad12 Add Clerk auth adapter scaffold`
- `448d0c3 Harden Story Lab profile preferences`

Key files:

- `api/_lib/story-lab/auth/*`
- `api/_lib/story-lab/profile/*`
- `api/_lib/story-lab/contracts.ts`
- `story-generator/src/app/contracts.ts`
- `tests/story-lab-profile-contracts.test.ts`
- `tests/story-lab-configured-auth.test.ts`
- `tests/story-lab-clerk-auth.test.ts`
- `tests/story-lab-profile-store.test.ts`

Validation:

- `npm run test:story-lab-configured-auth`
- `npm run test:story-lab-clerk-auth`
- `npm run test:story-lab-profile-contracts`
- `npm run test:story-lab-profile-store`
- `scripts/recovery/preflight.sh --quick --skip-status`

### PR 4: Cloud Storage And Database Scaffold

Goal: add schema/readiness/config/executor scaffolding while staying guarded when no real `DATABASE_URL` exists.

Likely commits:

- `7144dff Add Story Lab cloud schema scaffold`
- `aa8d848 Add Story Lab cloud storage config seam`
- `c3d77f0 Add Story Lab Neon storage executor`
- `2bd5691 Add Story Lab cloud schema migration helper`
- `bf5cf38 Add Story Lab cloud database readiness smoke`

Key files:

- `api/_lib/story-lab/storage/storyLabCloudSchema.sql`
- `api/_lib/story-lab/storage/storyLabCloudStorageConfig.ts`
- `api/_lib/story-lab/storage/neonStoryLabExecutor.ts`
- `api/_lib/story-lab/storage/storyLabCloudSchemaMigration.ts`
- `api/_lib/story-lab/storage/storyLabCloudDatabaseReadiness.ts`
- `scripts/recovery/apply-story-lab-cloud-schema.ts`
- `scripts/recovery/story-lab-cloud-db-smoke.ts`
- `package.json`
- `package-lock.json`
- related tests

Validation:

- `npm run test:story-lab-cloud-schema`
- `npm run test:story-lab-cloud-schema-migration`
- `npm run test:story-lab-cloud-db-readiness`
- `npm run test:story-lab-cloud-storage-config`
- `npm run test:story-lab-neon-executor`
- `npm run test:all`
- `scripts/recovery/check-vercel-function-count.sh`

### PR 5: Consolidated Account Route

Goal: add one deployable account route for profile and project cloud library operations without spending multiple Vercel function slots.

Likely commits:

- `0d5b659 Add Story Lab account route slice`
- backend account-route part of `a7fbacd Report non-durable account storage mode`

Key files:

- `api/story-lab/account.ts`
- `api/_lib/story-lab/account/accountRouteHandlers.ts`
- `vercel.json`
- `scripts/recovery/check-vercel-function-count.sh`
- `tests/story-lab-account-routes.test.ts`

Validation:

- `npm run test:story-lab-account-routes`
- `npm run test:story-lab-storage-port`
- `npm run test:story-lab-profile-store`
- `scripts/recovery/check-vercel-function-count.sh`
- `scripts/recovery/preflight.sh --quick --skip-status`

### PR 6: Angular Cloud Library Service And UI

Goal: expose local-vs-cloud library state honestly in the Angular app, while preserving anonymous browser-local saves.

Likely commits:

- `ca79e26 Add Story Lab account service methods`
- `def026c Add Story Lab cloud library UI state`
- `29fc248 Show Story Lab cloud account status`
- `033112c Show Story Lab account setup action`
- `504dc84 Gate cloud save on connected account`
- `77b3b13 Gate cloud project actions on connected account`
- `7b87100 Correct cloud controls browser spec`
- `a7fbacd Report non-durable account storage mode`
- `9465073 Show non-durable cloud storage as unavailable`

Key files:

- `story-generator/src/app/story.service.ts`
- `story-generator/src/app/story.service.spec.ts`
- `story-generator/src/app/app.ts`
- `story-generator/src/app/app.html`
- `story-generator/src/app/app.spec.ts`
- frontend contract types

Validation:

- `npx -p node@20 node ./node_modules/typescript/bin/tsc -p story-generator/tsconfig.spec.json --noEmit`
- targeted Angular app spec if Chrome is stable
- `npm run build`
- `scripts/recovery/preflight.sh --quick --skip-status`

### PR 7: Durable Job Owner Scaffolding

Goal: prepare owner-scoped durable job storage seams while keeping active jobs labelled non-durable until Workflow/database route wiring is real.

Likely commits:

- `206e6ea Add Story Lab durable job schema contract`
- `6e348b7 Add Story Lab durable job store scaffold`
- `db86c28 Add Story Lab job store config seam`
- `d8782ab Guard Story Lab job route store config`
- `462425e Pass owner context to durable Story Lab jobs`
- `d7bc5b2 Scope Story Lab job reads by owner`
- `244aef5 Guard durable job updates by owner`
- UI honesty commits `44f3e9b`, `13a95f4` if not better grouped with PR 6

Key files:

- `api/_lib/story-lab/jobs/jobStorePort.ts`
- `api/_lib/story-lab/jobs/postgresStoryLabJobStore.ts`
- `api/_lib/story-lab/jobs/storyLabJobStoreConfig.ts`
- `api/_lib/story-lab/jobs/jobRouteHandlers.ts`
- job route tests
- schema/readiness tests

Validation:

- `npm run test:story-lab-job-store-config`
- `npm run test:story-lab-job-store-port`
- `npm run test:story-lab-job-routes`
- schema/readiness tests
- `scripts/recovery/preflight.sh --quick --skip-status`

### PR 8: Story Quality And Continuation Guidance

Goal: land the story-output guidance improvements independently from account/cloud infrastructure.

Likely commits:

- `5dea9f9` through `c6e2920`
- `0f6ac11`
- `04f9fa2`
- `bf0ad07`
- `038576d`
- `87e0601`
- `c8053a9`
- `cb8f56b`

Key files:

- `api/_lib/story-lab/storyLabEngine.ts`
- `api/_lib/services/storyService.ts`
- `tests/story-lab-real-engine.test.ts`
- `tests/story-quality-evals.test.ts`

Validation:

- `npm run test:story-lab-real-engine`
- `npm run test:story-quality`
- `npm run test:story`

### PR 9: Quality Report And Proving Grounds

Goal: land deterministic story-quality report and Proving Grounds visibility without coupling it to cloud auth.

Likely commits:

- `a9575cc`
- `9f78c04`
- `be84e05`
- `be3f51a`
- `856464f`
- `dc5f433`
- `99218b4`

Key files:

- story quality heuristic/report modules
- `api/story-lab/evaluate.ts`
- Proving Grounds files/specs

Validation:

- `npm run test:story-quality`
- Proving Grounds type/spec checks
- `npm run build`

### PR 10: Story Memory Cards

Goal: land accepted/pinned memory-card UI and continuation integration as a product slice.

Likely commits:

- `be681ca`
- `8debd63`
- `106f078`
- `04537ce`
- `689d7bd`
- `4f7e5e9`
- `60e9774`
- `218341a`
- `00739a9`
- `99c3f81`
- `324b35a`
- `f9b8c08`
- `c803e98`
- `5154b6a`
- `9155971`
- `b9fe761`

Key files:

- `story-generator/src/app/app.ts`
- `story-generator/src/app/app.html`
- `story-generator/src/app/app.css`
- `story-generator/src/app/app.spec.ts`
- frontend contracts
- Story Lab engine/source-map tests

Validation:

- Angular app spec
- `npm run test:story-quality`
- `npm run test:story-lab-real-engine`
- `npm run build`

### PR 11: CSS And Lazy-Loading Cleanup

Goal: recover CSS budget headroom and lazy-load Proving Grounds after major UI slices.

Likely commits:

- `5a46eff`
- `330ae30`
- `16bbf93`

Key files:

- `story-generator/src/app/app.css`
- split component CSS files
- `story-generator/src/app/app.routes.ts`
- style/route splitting tests

Validation:

- `npm run test:story-generator-route-splitting`
- `npm run test:story-generator-component-style-budget`
- `npm run build`

## Extraction Notes

- Do not rely on clean cherry-picks for every slice. Some commits include docs or shared files that may need patch extraction.
- Start from `origin/main` for PR 1.
- After each PR merges, create the next branch from updated `main`.
- If a slice requires earlier types/tests, either move the dependency into that slice or wait until the prerequisite PR merges.
- Keep the original mega branch and remote backup untouched while extracting.
