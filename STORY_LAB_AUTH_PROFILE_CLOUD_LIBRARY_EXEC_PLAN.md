# Story Lab Auth, Profile, And Cloud Library ExecPlan

Created: 2026-06-08 07:12 EDT

## Purpose / Big Picture

Turn the existing Story Lab storage/auth scaffolding into a signed-in cloud library without breaking anonymous local use or making false durability claims.

The user-visible outcome of this plan is:

- anonymous users can still create, continue, and locally save stories in the browser;
- signed-in users can have a private profile with writing preferences;
- signed-in users can save, list, load, and delete Story Lab projects from cloud storage;
- the app has a clear "local only" versus "cloud synced" distinction;
- no user can read, modify, or delete another user's projects;
- future durable job work has owner/user context available, but this plan does not claim crash-safe background jobs.

This plan starts from the current merged state:

- `AuthPort` exists and is deny-by-default.
- `authorizeProjectAccess` exists.
- `StoryProjectStore` exists with non-durable memory and Postgres scaffolds.
- Browser-local `StoryWorkspaceStorageService` remains the current user-visible save path.
- Story Lab jobs are still `non_durable_memory` and not account-owned.
- Vercel function count is currently `10/12`.

Slice 3 adds the consolidated account route and moves the branch function count to `11/12`.

## Progress

- [x] Read `.agent/PLANS.md`, `AGENTS.md`, `STORY_LAB_APP_AUDIT.md`, `OVERNIGHT_MODE.md`, `STORY_LAB_STORAGE_PORT_EXEC_PLAN.md`, current auth/storage contracts, job route handlers, and local storage UI references.
- [x] Ran source-backed research pass for adjacent writing tools and platform docs; recorded findings in `STORY_LAB_IDEA_BOARD.md`.
- [x] Wrote this implementation plan as the next platform slice after the route-free storage port.
- [ ] Review this plan before installing auth/database dependencies or adding production routes.
- [x] Implement profile/account contracts.
- [x] Add fail-closed `configuredAuthPort` boundary without installing a provider SDK.
- [x] Add focused profile/cloud contract and configured-auth tests, and wire them into `npm run test:all`.
- [x] Implement profile store contracts with non-durable memory and injected Postgres scaffolds.
- [x] Add focused profile store tests and wire them into `npm run test:all`.
- [x] Implement provider-backed `AuthPort` adapter behind explicit env configuration.
- [x] Implement one consolidated Story Lab account route with rewrites instead of many deployable function files.
- [x] Wire cloud library methods into the Angular service.
- [x] Wire cloud library UI into the Angular app.
- [x] Add focused owner-isolation, profile, route, and UI tests.
- [x] Add Clerk-shaped `AuthPort` adapter scaffold with token extraction and injected verifier.
- [x] Add migration-ready cloud schema SQL contract and focused schema drift test.
- [x] Add lazy cloud storage config factory and focused executor-readiness test.
- [x] Add Neon/Postgres driver dependency and executor adapter behind the storage config seam.
- [x] Add schema application helper and guarded recovery script for real `DATABASE_URL` runs.
- [x] Add guarded cloud database readiness smoke for real `DATABASE_URL` runs.
- [x] Run validation and update handoff for Slice 1.
- [x] Run validation and update handoff for Slices 2 and 3.
- [x] Run validation and update handoff for Slice 4a service methods.
- [x] Run validation and update handoff for Slice 4b visible UI state.

## Surprises & Discoveries

- `StoryWorkspaceStorageService` is local-browser only and already supports list/save/load/delete. It should remain the anonymous fallback, not be replaced abruptly.
- Current job routes use credentialed CORS but not account ownership. They must not be described as user-private durable jobs until a later job-persistence plan.
- The existing storage port takes `AuthUser` already, which is the right seam. Future route work should call `authPort.requireUser(req)` once and pass the resulting `AuthUser` into storage.
- Current provider research says editable auth metadata is not a safe authorization source. User profile preferences can live in metadata only if they are treated as display/preferences, never ownership.
- Profile preferences arrive as runtime data from clients or stored JSON. They now need allow-list normalization before persistence; static TypeScript types are not enough at this boundary.
- Clerk's current backend docs describe bearer session tokens for cross-origin requests and the `__session` cookie for same-origin requests. The adapter scaffold extracts only those token sources and still requires an injected verifier before it returns a user. Sources: https://clerk.com/docs/request-authentication/backend and https://clerk.com/docs/backend-requests/manual-jwt, accessed 2026-06-08.
- Vercel function budget is usable but tighter after Slice 3. Account/profile/project cloud APIs now share one deployable route file, and the branch count is `11/12`.
- The cloud library UI can land before live auth/database provisioning as long as it tells the truth: local browser saves remain active, and cloud sync shows unavailable or failed until the account route is configured.
- The Postgres profile/project scaffolds had implied table expectations, but there was no tracked migration-ready SQL artifact until `api/_lib/story-lab/storage/storyLabCloudSchema.sql`.
- The default account route used to construct Postgres stores directly. It now routes through `storyLabCloudStorageConfig.ts`, so future driver wiring has one lazy, test-covered seam.
- `@neondatabase/serverless@1.1.0` requires Node `>=19.0.0`; the repo's existing preflight/build path uses Node 20 for Angular validation and the local API typecheck passed after the dependency landed.

## Decision Log

- Decision: Use `AuthPort` as the only auth boundary exposed to Story Lab routes.
  Rationale: Existing code already established this seam. Routes should not inspect raw provider headers except inside an adapter.
- Decision: Recommend Clerk as the first production auth adapter path, with the adapter isolated behind `AuthPort`.
  Rationale: Clerk is available through Vercel Marketplace and is auth-focused. If the user later chooses Supabase Auth, only the adapter should change.
- Decision: Store profiles and Story Lab project ownership in the app database, not editable auth metadata.
  Rationale: Authorization must be tied to `AuthUser.userId` and owner columns. User-editable profile fields are preferences, not security data.
- Decision: Use Marketplace Postgres/Neon-compatible storage for the first durable library path.
  Rationale: The existing Postgres storage adapter already accepts an injected executor and the platform plan previously selected relational storage for projects, chapters, story state, exports, and jobs.
- Decision: Add one deployable account route file, not separate profile/project route files.
  Rationale: Function count was `10/12` at plan creation. One route plus rewrites raises it to `11/12` while preserving one remaining slot.
- Decision: Keep local browser storage active after cloud sync lands.
  Rationale: Anonymous users should not lose the product. Signed-in users need a cloud canonical source, but local storage can remain a recent-project cache and import source.
- Decision: Do not implement durable jobs in this plan.
  Rationale: Durable jobs need Workflow/database persistence, idempotent AI side effects, and owner-scoped job records. This plan can prepare user context but should not broaden into job execution.

## Outcomes & Retrospective

Current implementation state as of 2026-06-08:

- Added profile/cloud-library contract types to `story-generator/src/app/contracts.ts`.
- Re-exported those types through `api/_lib/story-lab/contracts.ts`.
- Added `api/_lib/story-lab/profile/profileDefaults.ts` with fail-closed, adult-unconfirmed default profile preferences.
- Added `api/_lib/story-lab/auth/configuredAuthPort.ts`, which delegates only to an injected provider and otherwise denies by default.
- `configuredAuthPort` now explicitly supports `STORY_LAB_AUTH_PROVIDER=clerk`, still fails closed for blank/unknown providers, and still requires a verifier before Clerk sessions become app users.
- Added `api/_lib/story-lab/auth/clerkAuthPort.ts`, a Clerk-shaped adapter scaffold that extracts bearer or `__session` tokens, requires an injected verifier, and fails closed without leaking token text.
- Added `api/_lib/story-lab/storage/storyLabCloudSchema.sql` as the migration-ready cloud library schema contract for private profiles and owner-scoped story projects.
- Extended `storyLabCloudSchema.sql` with future durable job tables: `story_lab_jobs` for owner-scoped job snapshots and `story_lab_job_events` for ordered public event snapshots.
- Added `api/_lib/story-lab/jobs/jobStorePort.ts` and `api/_lib/story-lab/jobs/postgresStoryLabJobStore.ts` as the tested port and injected-executor Postgres scaffold for future durable job snapshots/events.
- Added `api/_lib/story-lab/storage/storyLabCloudSchemaMigration.ts` to split and apply the tracked schema through an injected executor.
- Added `scripts/recovery/apply-story-lab-cloud-schema.ts` and `db:story-lab-apply-schema` for guarded real-database schema application.
- Added `api/_lib/story-lab/storage/storyLabCloudDatabaseReadiness.ts` and `scripts/recovery/story-lab-cloud-db-smoke.ts` to check the required profile/project/job tables and owner/event indexes when a real database URL is configured.
- Added `api/_lib/story-lab/storage/storyLabCloudStorageConfig.ts` as the lazy cloud storage configuration seam for account-route profile/project stores.
- Added `api/_lib/story-lab/storage/neonStoryLabExecutor.ts`, a Neon driver adapter that maps `sql.query(text, params)` into the existing `{ rows }` executor shape.
- Updated `api/_lib/story-lab/account/accountRouteHandlers.ts` so default stores come from the cloud storage config factory instead of direct Postgres construction.
- Added `@neondatabase/serverless` to root dependencies.
- Added focused tests:
  - `tests/story-lab-profile-contracts.test.ts`
  - `tests/story-lab-configured-auth.test.ts`
  - `tests/story-lab-clerk-auth.test.ts`
  - `tests/story-lab-cloud-schema.test.ts`
  - `tests/story-lab-cloud-schema-migration.test.ts`
  - `tests/story-lab-cloud-db-readiness.test.ts`
  - `tests/story-lab-cloud-storage-config.test.ts`
  - `tests/story-lab-neon-executor.test.ts`
  - `tests/story-lab-job-routes.test.ts`
  - `tests/story-lab-job-store-config.test.ts`
  - `tests/story-lab-job-store-port.test.ts`
  - `tests/story-lab-profile-store.test.ts`
- Added npm scripts for the new focused tests and included them in `npm run test:all`.
- Added `test:story-lab-clerk-auth`, `test:story-lab-cloud-schema`, `test:story-lab-cloud-schema-migration`, `test:story-lab-cloud-db-readiness`, `test:story-lab-cloud-storage-config`, `test:story-lab-neon-executor`, `test:story-lab-job-routes`, and `test:story-lab-job-store-config` to `npm run test:all`.
- Added `api/_lib/story-lab/jobs/storyLabJobStoreConfig.ts` as the env-gated future job-store selection seam; default routes stay non-durable, unsupported modes fail closed, and injected durable stores require route auth before creation.
- Added an injectable job route handler seam so tests can prove authenticated durable creation receives `ownerUserId`.
- Added owner-aware job-store read contracts so durable status/event reads can filter by `ownerUserId`; route tests prove durable status/events pass authenticated owner context.
- Added `api/_lib/story-lab/profile/storyLabProfileStore.ts` with typed profile storage results, clone helpers, default profile construction, owner checks, and no-email-leak error helpers.
- Hardened `normalizeStoryLabProfilePreferences` so malformed runtime values are sanitized through allow-lists before profile persistence.
- Added `api/_lib/story-lab/profile/inMemoryStoryLabProfileStore.ts` as a non-durable local/test profile store.
- Added `api/_lib/story-lab/profile/postgresStoryLabProfileStore.ts` as an injected-executor Postgres profile scaffold that fails closed when `DATABASE_URL` or an executor is missing.
- Added `api/story-lab/account.ts` as the single deployable Story Lab account route.
- Added `api/_lib/story-lab/account/accountRouteHandlers.ts` for profile/project account route behavior behind injectable auth, profile-store, and project-store seams.
- Added `vercel.json` rewrites for profile, project collection, and project item paths into the single account function.
- Updated `scripts/recovery/check-vercel-function-count.sh` to intentionally allow `api/story-lab/account.ts`; function count is now `11/12`.
- Added `tests/story-lab-account-routes.test.ts` for fail-closed auth, credentialed CORS, profile read/write, project save/list/load/delete, cross-owner denial, and missing-storage failures.
- Added the account route test script to `npm run test:all`.
- Added cloud-facing project load/delete contract types.
- Added `StoryService` methods for profile get/update and cloud project list/save/load/delete.
- Added Angular service specs for the new account-route client methods.
- Adjusted the account route project-load response to return a cloud-facing load result instead of exposing the backend store record shape.
- Added visible cloud/local library state to the Angular app:
  - a Cloud account panel above the existing local saved-project list;
  - a visible account-connection row that reads `Account Not connected` while sign-in/cloud sync is not available;
  - a visible `Connect account` action that reports setup status without calling cloud-library routes or claiming live sign-in;
  - cloud save gating so unavailable account state does not fire a doomed save request;
  - visible unavailable/synced/failed/local-only status text;
  - refresh, save-to-cloud, load, and delete hooks through `StoryService`;
  - local browser save behavior remains visible and available.
- Added Angular component specs that prove cloud unavailable state does not replace local saves, refresh can render cloud projects, saving the active workbench calls the account service without disabling local save, and failed cloud refreshes re-enable cloud controls.
- Extended the cloud UI spec so the panel must show the account connection row without pretending login is live.
- Extended the cloud UI spec so the account action must surface setup status without calling the cloud project list service.
- Extended the cloud UI spec so `Save to cloud` is disabled until cloud state is connected, and the direct save method also avoids cloud-save calls while sign-in is unavailable.
- Slice 4b validation passed:
  - RED: `npx -p node@20 node ./node_modules/typescript/bin/tsc -p story-generator/tsconfig.spec.json --noEmit` failed on missing app cloud-library UI state/methods;
  - GREEN: same Angular spec typecheck passed after implementation;
  - `npm run build` passed after trimming the new CSS under the hard component budget;
  - `npm run test:all` passed;
  - `scripts/recovery/preflight.sh --quick --skip-status` passed;
  - `scripts/recovery/check-vercel-function-count.sh` -> `11/12`.
- Cloud schema validation passed:
  - RED: `npx tsx tests/story-lab-cloud-schema.test.ts` failed on the missing schema file;
  - GREEN: `npm run test:story-lab-cloud-schema`;
  - `npm run test:all`;
  - `scripts/recovery/preflight.sh --quick --skip-status`;
  - function count remained `11/12`.
- Cloud schema migration validation passed:
  - RED: `npx tsx tests/story-lab-cloud-schema-migration.test.ts` failed on the missing migration module;
  - GREEN: `npm run test:story-lab-cloud-schema-migration`;
  - `env -u DATABASE_URL npm run db:story-lab-apply-schema` exited `1` with an honest missing-`DATABASE_URL` message;
  - Vercel API function typecheck command from `scripts/recovery/preflight.sh`;
  - `npm run test:all`;
  - `scripts/recovery/preflight.sh --quick --skip-status`;
  - function count remained `11/12`.
- Cloud database readiness validation passed:
  - RED: `npx tsx tests/story-lab-cloud-db-readiness.test.ts` failed on the missing readiness module;
  - GREEN: `npm run test:story-lab-cloud-db-readiness`;
  - `env -u DATABASE_URL npm run smoke:story-lab-cloud-db` exited `1` with an honest missing-`DATABASE_URL` message;
  - Vercel API function typecheck command from `scripts/recovery/preflight.sh`;
  - `npm run test:all`;
  - `scripts/recovery/preflight.sh --quick --skip-status`;
  - function count remained `11/12`.
- Durable job schema readiness validation passed:
  - RED: `npx tsx tests/story-lab-cloud-schema.test.ts` failed because `story_lab_jobs` did not exist;
  - RED: `npx tsx tests/story-lab-cloud-db-readiness.test.ts` failed because missing job tables/indexes were not reported;
  - GREEN: `npx tsx tests/story-lab-cloud-schema.test.ts`;
  - GREEN: `npx tsx tests/story-lab-cloud-db-readiness.test.ts`.
- Durable job store port validation passed:
  - RED: `npx tsx tests/story-lab-job-store-port.test.ts` failed because the port/Postgres scaffold did not exist;
  - GREEN: `npm run test:story-lab-job-store-port`;
  - `npx tsx tests/story-lab-job-contracts.test.ts`;
  - `npx tsx tests/story-lab-job-routes.test.ts`.
- Cloud storage config validation passed:
  - RED: `npx tsx tests/story-lab-cloud-storage-config.test.ts` failed on the missing config module;
  - GREEN: `npm run test:story-lab-cloud-storage-config`;
  - `npm run test:story-lab-account-routes`;
  - `npm run test:story-lab-storage-port`;
  - `npm run test:story-lab-profile-store`;
  - Vercel API function typecheck command from `scripts/recovery/preflight.sh`;
  - `npm run test:all`;
  - `scripts/recovery/preflight.sh --quick --skip-status`;
  - function count remained `11/12`.
- Neon executor validation passed:
  - RED: `npx tsx tests/story-lab-neon-executor.test.ts` failed on the missing executor module;
  - `npm install @neondatabase/serverless --no-audit --no-fund`;
  - GREEN: `npm run test:story-lab-neon-executor`;
  - `npm run test:story-lab-cloud-storage-config`;
  - `npm run test:story-lab-account-routes`;
  - Vercel API function typecheck command from `scripts/recovery/preflight.sh`;
  - `npm run test:all`;
  - `scripts/recovery/preflight.sh --quick --skip-status`;
  - function count remained `11/12`.
- Slice 4a validation passed:
  - RED: `npx -p node@20 node ./node_modules/typescript/bin/tsc -p story-generator/tsconfig.spec.json --noEmit` failed on missing `StoryService` cloud/profile methods;
  - GREEN: same Angular spec typecheck passed;
  - `npm run test:story-lab-account-routes`;
  - `git diff --check`;
  - `scripts/recovery/check-vercel-function-count.sh` -> `11/12`;
  - `npm run test:all`;
  - `scripts/recovery/preflight.sh --quick --skip-status`.
- Slice 3 validation passed:
  - RED: `./node_modules/.bin/tsx tests/story-lab-account-routes.test.ts` failed on missing account route module;
  - GREEN: `./node_modules/.bin/tsx tests/story-lab-account-routes.test.ts`;
  - `npm run test:story-lab-account-routes`;
  - `./node_modules/.bin/tsx tests/story-lab-job-routes.test.ts`;
  - `npm run test:story-lab-profile-store`;
  - `npm run test:story-lab-storage-port`;
  - `scripts/recovery/check-vercel-function-count.sh` -> `11/12`;
  - `git diff --check`;
  - `scripts/recovery/preflight.sh --quick --skip-status`;
  - `npm run test:all`.
- Slice 2 focused validation passed:
  - RED: `npx tsx tests/story-lab-profile-store.test.ts` failed on missing profile store modules;
  - GREEN: `npx tsx tests/story-lab-profile-store.test.ts`;
  - Script path: `npm run test:story-lab-profile-store`.
- Slice 2 final validation passed:
  - `git diff --check`;
  - `scripts/recovery/check-vercel-function-count.sh` -> `10/12`;
  - `npm run test:story-lab-configured-auth`;
  - `npm run test:story-lab-auth`;
  - `npm run test:story-lab-storage-port`;
  - `npm run test:all`;
  - `scripts/recovery/preflight.sh --quick --skip-status`.
- Slice 1 validation passed:
  - `git diff --check`;
  - `scripts/recovery/check-vercel-function-count.sh` -> `10/12`;
  - `npm run test:all`;
  - `scripts/recovery/preflight.sh --quick --skip-status`.
- No executed database migration/provisioning, live auth provider, live database proof, real cloud sync, login/profile management UI, or durable job behavior has landed yet.
- A migration-ready SQL contract exists, but it is not automatically executed by the app.
- The migration-ready SQL contract includes future durable job tables, and a Postgres job store scaffold exists, but the active job route still uses `non_durable_memory` unless a future owner-scoped durable route is implemented.
- Job route tests now prove durable creation, status reads, and event reads receive authenticated owner context through injection, but they do not prove live database-backed durable operation.
- A guarded schema-apply script exists, but it has only been tested with fake executors and missing-env refusal here.
- A guarded cloud database readiness smoke exists, but it has only been tested with fake executors and missing-env refusal here.
- A Neon executor adapter exists, but it has only been validated with injected fake queries and typechecks, not a live database.
- The Clerk adapter scaffold is not live auth by itself; it still needs a real Clerk verifier/SDK wiring and frontend sign-in flow.

Expected retrospective evidence after implementation:

- signed-in profile and cloud project flows are observable in the UI;
- anonymous local save still works;
- cross-user project access fails in route tests;
- function count stays within limit;
- live provider/auth/storage behavior is documented in `OVERNIGHT_HANDOFF.md` or the active PR.

## Context and Orientation

Repository root: `/Users/hbpheonix/fairytaleswithspice`.

Current branch during plan creation: `main`.

Important files:

- `AGENTS.md`: repo operating guide. Link this plan there before implementation.
- `STORY_LAB_APP_AUDIT.md`: current app health and platform gaps.
- `OVERNIGHT_MODE.md`: autonomous task-selection rules.
- `STORY_LAB_STORAGE_PORT_EXEC_PLAN.md`: completed route-free storage-port scaffold.
- `api/_lib/story-lab/auth/authPort.ts`: `AuthPort`, `AuthUser`, deny-by-default adapter.
- `api/_lib/story-lab/auth/authorizeProjectAccess.ts`: owner authorization helper.
- `api/_lib/story-lab/storage/storyProjectStore.ts`: owner-scoped saved-project store contract.
- `api/_lib/story-lab/storage/postgresStoryProjectStore.ts`: injected Postgres adapter scaffold.
- `api/_lib/story-lab/storage/storyLabCloudSchema.sql`: migration-ready profile/project schema contract.
- `api/_lib/story-lab/storage/storyLabCloudSchemaMigration.ts`: schema split/apply helper for real database migrations.
- `api/_lib/story-lab/storage/storyLabCloudDatabaseReadiness.ts`: table/index readiness checker for live DB smoke.
- `api/_lib/story-lab/storage/storyLabCloudStorageConfig.ts`: lazy database URL/executor seam for the account route.
- `api/_lib/story-lab/storage/neonStoryLabExecutor.ts`: Neon driver adapter for the shared query executor.
- `story-generator/src/app/story-workspace-storage.service.ts`: anonymous browser-local library.
- `story-generator/src/app/app.ts` and `story-generator/src/app/app.html`: visible Story Lab UI and library panel.
- `story-generator/src/app/story.service.ts`: Angular API client seam.
- `api/_lib/story-lab/jobs/jobRouteHandlers.ts`: non-durable job routes; do not broaden into durable jobs here.
- `scripts/recovery/check-vercel-function-count.sh`: route budget guard.

Current untracked files to leave alone unless a separate cleanup decision is made:

- `SPARK_TRIAL_TASKS.md`
- `STORY_QUALITY_EVALS_PLAN.md`
- `tests/grok-smoke.test.ts`

## Plan of Work

Build this in five slices.

### Slice 1: Contracts And Provider Boundary

Add shared contracts for:

- `StoryLabUserProfile`
- `StoryLabProfilePreferences`
- `CloudStoryProjectList`
- `CloudStoryProjectSaveReceipt`
- `CloudLibrarySyncState`

Add server auth adapter scaffolding:

- `api/_lib/story-lab/auth/configuredAuthPort.ts`
- `api/_lib/story-lab/auth/clerkAuthPort.ts`
- tests that prove missing provider config fails closed.

No UI and no provider dependency are required until the adapter implementation is explicit. If a provider SDK is installed, it must be isolated to the adapter.

### Slice 2: Profile And Project Store Ports

Add a profile store beside the project store:

- `api/_lib/story-lab/profile/storyLabProfileStore.ts`
- `api/_lib/story-lab/profile/inMemoryStoryLabProfileStore.ts`
- `api/_lib/story-lab/profile/postgresStoryLabProfileStore.ts`
- `api/_lib/story-lab/storage/storyLabCloudStorageConfig.ts`
- `api/_lib/story-lab/storage/neonStoryLabExecutor.ts`
- `api/_lib/story-lab/jobs/jobStorePort.ts`
- `api/_lib/story-lab/jobs/postgresStoryLabJobStore.ts`

The migration-ready table shape now lives in:

- `api/_lib/story-lab/storage/storyLabCloudSchema.sql`

It defines `story_lab_profiles` with `preferences_json`, `story_projects` with `owner_user_id`, `story_id`, denormalized display fields, and `project_json`, plus future durable `story_lab_jobs` and `story_lab_job_events` tables. The guarded apply path is `npm run db:story-lab-apply-schema` when a real `DATABASE_URL` is present. The guarded readiness path is `npm run smoke:story-lab-cloud-db`. Keep project storage on the existing `StoryProjectStore` contract. Do not create a second project persistence shape. Keep job routes labelled non-durable until route/auth wiring uses `StoryLabJobStore`.

### Slice 3: Consolidated Account Route

Add one deployable route file:

- `api/story-lab/account.ts`

Use rewrites for readable paths:

- `GET /api/story-lab/account/profile`
- `PUT /api/story-lab/account/profile`
- `GET /api/story-lab/account/projects`
- `POST /api/story-lab/account/projects`
- `GET /api/story-lab/account/projects/:projectId`
- `DELETE /api/story-lab/account/projects/:projectId`

Every handler must:

- apply centralized credentialed CORS;
- call `authPort.requireUser(req)`;
- pass `AuthUser` into profile/project stores;
- avoid logging raw story text, prompts, heat boundaries, emails, auth headers, or artifact URLs;
- return `ApiResponse<T>` envelopes;
- fail closed when auth or storage is unconfigured.

Expected function count after this slice: `11/12`, not higher.

### Slice 4: Angular Service And UI

Add `StoryService` methods:

- `getStoryLabProfile`
- `updateStoryLabProfile`
- `listCloudStoryProjects`
- `saveCloudStoryProject`
- `loadCloudStoryProject`
- `deleteCloudStoryProject`

Update the UI:

- show local library as local-only when anonymous or auth is unconfigured;
- show sign-in/account unavailable messaging without claiming cloud sync;
- when signed in and configured, show cloud project list;
- let users save current local project to cloud;
- let users load/delete cloud projects;
- show whether the current project is local-only, synced, or sync failed.

Do not add social profile features. Profiles are private writing preferences and library settings.

### Slice 5: Validation, Handoff, And Provider Notes

Update:

- `STORY_LAB_APP_AUDIT.md`
- `OVERNIGHT_HANDOFF.md`
- active PR/handoff docs

Record:

- provider selected;
- env vars required;
- database/provisioning state;
- route count;
- tests run;
- user-visible limits.

## Concrete Steps

1. Confirm live state with `git status --short --branch`.
2. Run `scripts/recovery/check-vercel-function-count.sh`.
3. Add this plan to `AGENTS.md`.
4. Add profile/cloud library contracts to `story-generator/src/app/contracts.ts` and re-export the backend-facing types through `api/_lib/story-lab/contracts.ts`.
5. Add `configuredAuthPort.ts` that returns deny-by-default unless provider env is configured.
6. Add `clerkAuthPort.ts` only after provider SDK/dependency decision is explicit.
7. Add profile store contracts and in-memory/Postgres scaffolds.
8. Add focused profile store tests.
9. Add consolidated `api/story-lab/account.ts`.
10. Add `vercel.json` rewrites into the single account function.
11. Add account route tests for profile, project list/save/load/delete, missing auth, missing storage, and cross-owner access.
12. Add Angular `StoryService` cloud methods.
13. Update `app.ts` and `app.html` cloud/local library UI.
14. Add focused Angular spec coverage.
15. Run validation.
16. Commit, open PR, address review/checks, and update handoff.

## Validation and Acceptance

Run from repository root:

- `git diff --check`
- `npx tsx tests/story-lab-auth.test.ts`
- `npx tsx tests/story-lab-storage-port.test.ts`
- `npx tsx tests/story-lab-profile-store.test.ts`
- `npx tsx tests/story-lab-account-routes.test.ts`
- `npx -p node@20 node ./node_modules/typescript/bin/tsc -p story-generator/tsconfig.spec.json --noEmit`
- `scripts/recovery/check-vercel-function-count.sh`
- `scripts/recovery/preflight.sh --quick --skip-status`

Expected results:

- all focused tests pass;
- function count is within limit and expected to be `11/12` after one new account route;
- anonymous local library still works;
- missing auth config fails closed with `UNAUTHORIZED`;
- missing storage config fails closed with a retryable storage-unconfigured response;
- authenticated user can save/list/load/delete only their own projects;
- profile preferences cannot authorize access;
- no story text or prompt text appears in route errors or logs.

Browser verification, when environment allows:

- run `npm run smoke:story-lab-ui`;
- verify a generated project can still save locally;
- verify cloud UI displays honest unavailable/configured states based on auth/storage config.

## Idempotence and Recovery

- Route handlers must be safe to retry. Saving the same project should update the owner-scoped record, not duplicate it.
- Missing provider env must not break module import, preflight, or local mock use.
- If provider SDK install causes build failures, revert the adapter dependency and leave the provider decision in the plan.
- If function count reaches `12/12`, stop route work and consolidate before adding more deployable files.
- If account route tests reveal cross-owner leakage, stop UI work and fix server authorization first.
- If database provisioning is unavailable, keep Postgres paths as injected/tested scaffolds and do not claim cloud sync.

## Artifacts and Notes

Research sources captured in `STORY_LAB_IDEA_BOARD.md` on 2026-06-08:

- Clerk/Vercel Marketplace auth research: https://vercel.com/marketplace/clerk
- Supabase Auth user and metadata guidance: https://supabase.com/docs/guides/auth/users
- Vercel Postgres current guidance toward Marketplace integrations: https://vercel.com/docs/postgres
- Vercel Workflow durable execution material: https://vercel.com/workflows and https://vercel.com/blog/a-new-programming-model-for-durable-execution
- Adjacent writing tools: Sudowrite, Novelcrafter, NovelAI, and LivingWriter.

Provider env names should be finalized during implementation. Candidate names:

- `CLERK_SECRET_KEY`
- `CLERK_JWT_ISSUER`
- `CLERK_JWT_AUDIENCE`
- `DATABASE_URL`
- `FRONTEND_URL`

Do not store user story text in external services beyond the selected database until retention, deletion, export, and owner-access behavior is implemented and tested.

## Interfaces and Dependencies

New server-facing interfaces:

```ts
export interface StoryLabUserProfile {
  userId: string;
  displayName: string;
  preferences: StoryLabProfilePreferences;
  createdAt: string;
  updatedAt: string;
}

export interface StoryLabProfilePreferences {
  defaultHeatContract: HeatContract;
  favoriteCreatures: CreatureArchetype[];
  favoriteTones: NarrativeTone[];
  contentBoundaries?: string;
  librarySort: 'updated_desc' | 'created_desc' | 'title_asc';
}

export interface StoryLabProfileStore {
  loadProfile(user: AuthUser): Promise<StoryLabProfileStoreResult<StoryLabUserProfile | null>>;
  saveProfile(user: AuthUser, profile: StoryLabUserProfile): Promise<StoryLabProfileStoreResult<StoryLabUserProfile>>;
}
```

Route handlers should depend on these interfaces and existing `StoryProjectStore`, not on concrete provider SDKs.
