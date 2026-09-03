# Story Lab Auth, Profile, And Cloud Library Checklist

Created: 2026-06-13

## Purpose

Turn the existing Story Lab storage/auth scaffolding into a signed-in cloud library without breaking anonymous local use or making false durability claims.

The desired user-visible outcome is:

- anonymous users can still create, continue, and locally save stories in the browser;
- signed-in users can have a private profile with writing preferences;
- signed-in users can save, list, load, and delete Story Lab projects from cloud storage;
- the app has a clear local-only versus cloud-synced distinction;
- no user can read, modify, or delete another user's projects;
- future durable job work has owner/user context available, but this plan does not claim crash-safe background jobs.

## Current Reality On Main

This checklist is current after PR #118, the consolidated account-route change set, the Angular cloud-library UI change set, and the "Story Lab Cloud Account/Auth" worst-to-best PR that wired a real Clerk provider end to end.

- `AuthPort` exists and is deny-by-default.
- `authorizeProjectAccess` exists.
- `StoryProjectStore` exists with non-durable memory and injected Postgres scaffolds.
- Story Lab profile, cloud-library, and preference contract types exist.
- Configured auth selection fails closed unless a supported provider is configured.
- The Clerk auth adapter has a real verifier wired into the production `configuredAuthPort` singleton (`@clerk/backend`'s `verifyToken`, gated on `CLERK_SECRET_KEY`), and the Angular app has a live sign-in flow: an unauthenticated `GET /account/auth-config` endpoint reports whether a deployment has a provider, publishable key, and secret key all configured together; `AuthService` lazy-loads `@clerk/clerk-js` only when it does, and `authInterceptor` attaches a freshly-fetched bearer token to authenticated account requests. Deploying this against a real Clerk tenant with `STORY_LAB_AUTH_PROVIDER=clerk`, `CLERK_PUBLISHABLE_KEY`, and `CLERK_SECRET_KEY` set has not been proven end to end against a live Clerk tenant in this environment (no credentials available here) — that live-provider proof is still open.
- Token verification passes `authorizedParties` (the configured origin allowlist plus this deployment's own `VERCEL_URL`/`VERCEL_BRANCH_URL`/`VERCEL_PROJECT_PRODUCTION_URL` — platform-injected, never a request header) so a correctly-signed token whose `azp` claim names an untrusted sibling origin is rejected rather than accepted on signature validity alone; if that allowlist parses to empty (an all-invalid `STORY_LAB_ALLOWED_ORIGINS` value with no platform URL available), the verifier fails closed instead of handing Clerk an unchecked allowlist, and `GET /account/auth-config` shares that same check so it never advertises `provider: 'clerk'` in the one case the verifier refuses to exist. `AuthService.signOut()` propagates a rejected Clerk sign-out instead of clearing local state anyway, and every cloud-library request (`refreshCloudLibrary`/save/load/delete, mutually exclusive via `isCloudLibraryBusy`) has its in-flight subscription cancelled *before* `signOutOfCloudAccount()` awaits Clerk's own sign-out call, not after, so a response authenticated under the old session cannot resurrect that account's data even if it arrives while sign-out is still in flight; the constructor effect driving all of this also tracks a client-side-decoded `accountId`, not just signed-in/out, so a multi-session account swap with no intermediate sign-out is caught too. See `PR70_RECOVERY_CHANGELOG.md`'s 2026-09-03 entries for the finding-by-finding history, including a since-corrected round that briefly trusted a caller-supplied forwarded-host header for this same boundary.
- Profile stores exist for non-durable memory and injected Postgres execution.
- Cloud schema, guarded migration/readiness helpers, guarded cloud storage config, and Neon executor scaffolding exist.
- One consolidated account route exists for profile and project operations behind injectable auth/profile/project stores.
- The Angular app can load account status, show local-vs-cloud library state, and call the consolidated account route for profile/project operations.
- Cloud save/load/delete controls are gated on connected account state, and `non_durable_memory` account storage is shown as cloud-unavailable.
- Browser-local `StoryWorkspaceStorageService` remains the current user-visible save path.
- Story Lab job storage now has owner-scoped store ports, a Postgres scaffold, guarded config, and route owner checks.
- The active default job mode remains `non_durable_memory`, and the UI shows non-durable job warnings instead of claiming crash-safe progress.
- Vercel function count is `11/12` with the account route included.
- The large local branch is being split through `STORY_LAB_UNPUBLISHED_BRANCH_SPLIT_PLAN.md`.

Not live yet:

- end-to-end sign-in proof against a real Clerk tenant (the verifier and frontend flow are wired and tested with mocked/DI'd Clerk clients, but no live Clerk credentials are available in this environment to prove it against a real tenant);
- private user profiles in durable storage;
- cloud project save/list/load/delete proven against a live durable database;
- database provisioning or executed migrations;
- durable jobs.

## Operating Rules

- Keep anonymous local saves working.
- Keep auth, profile, storage, route, and UI slices reviewable.
- Do not install provider SDKs or database drivers unless the slice explicitly justifies the dependency.
- Do not add multiple account/profile/project route files; prefer one consolidated account route if route work is in scope.
- Do not claim "cloud save" until signed-in save/load/list/delete works against durable storage and has live proof.
- Do not claim "durable jobs" until job progress survives process loss.
- Treat user profile fields as preferences, not authorization metadata.
- Use `AuthUser.userId` and owner columns for authorization.

## Live Signed-In Durability Proof (Credential-Safe)

- Goal: prove live signed-in save/list/load/delete behavior against durable storage before any cloud claims; this code remains scaffolded/fail-closed until a real signed-in run with durable DB credentials is completed.
- Required env names only (set in the signed-in runtime; never paste values in docs):
  - `STORY_LAB_AUTH_PROVIDER=clerk`
  - `DATABASE_URL=<postgres_host>`
- Proof sequence:
  1. Configure `STORY_LAB_AUTH_PROVIDER` + `DATABASE_URL` and confirm route config is loaded with a non-deny auth/provider path.
  2. Provision the durable database and apply `storyLabCloudSchema.sql` against the same `DATABASE_URL`.
  3. Run cloud database readiness check and verify required tables/indexes are present.
  4. Sign in as **user A** and call:
     - `/api/story-lab/account/profile` (GET) to confirm signed-in profile status loads;
     - `/api/story-lab/account/projects` (GET) to confirm owner-scoped project collection access.
  5. Create/save at least one project as user A through `/api/story-lab/account/projects` (POST); confirm project save receipt is returned and not storage-fallback.
  6. Call `/api/story-lab/account/projects/{projectId}` (GET) to load the saved project and verify body includes `storageMode: "cloud_postgres"`.
  7. Call `/api/story-lab/account/projects` (GET) again and `/api/story-lab/account/projects/{projectId}` (DELETE) to verify list/delete endpoints return `storageMode: "cloud_postgres"` and expected delete outcome.
  8. Repeat with signed-in **user B** (different identity): list should not return user A project; load/delete on user A project id must fail with access-denied semantics.
  9. Record evidence bundle (timestamped request/response evidence, endpoint outcomes, and storageMode verification) before updating PR language to claim live cloud proof.
- Non-claims for this plan until evidence is collected:
  - no signed-in cloud durability claims;
  - no ownership breach assumptions;
  - no cross-user project access assumptions.

## Phase Checklist

### Phase 0: Publication Recovery

- [x] Push a remote backup branch for the unpublished local stack.
- [x] Open PR #114 for publication discipline and split planning.
- [x] Address PR #114 review comments.
- [x] Merge PR #114.
- [x] Land the operating-docs baseline through PR #115.
- [x] Land auth/profile contracts through PR #116.
- [x] Land cloud schema/storage readiness through PR #118.
- [x] Land consolidated account route.
- [x] Land Angular cloud library UI.
- [x] Land durable job owner scaffolding only if kept honest as non-durable in the active UI.

### Phase 1: Auth And Profile Contracts

Goal: add the account/profile domain seam without live provider or database claims.

Status:

- Merged through PR #116 on 2026-06-13.
- Implemented profile/cloud-library contract types.
- Added fail-closed configured auth selection.
- Added Clerk-shaped auth adapter scaffold that requires an injected verifier.
- Added non-durable and injected-Postgres profile store scaffolds.
- Hardened profile preference normalization from runtime data.
- Centralized runtime preference allowed values in shared contract constants to prevent type/runtime drift.
- Added redacted auth/profile storage warnings that avoid logging tokens, emails, story text, SQL params, or raw provider payloads.
- Still not live auth, signed-in UI, durable profiles, or cloud project sync.

Candidate local commits:

- `75b485f Add Story Lab auth profile contract slice`
- `6459454 Add Story Lab profile store slice`
- `b99ad12 Add Clerk auth adapter scaffold`
- `99317f1 Add env-gated Story Lab Clerk auth config`
- `448d0c3 Harden Story Lab profile preferences`

Expected files:

- `api/_lib/story-lab/auth/configuredAuthPort.ts`
- `api/_lib/story-lab/auth/clerkAuthPort.ts`
- `api/_lib/story-lab/profile/*`
- `api/_lib/story-lab/contracts.ts`
- `story-generator/src/app/contracts.ts`
- focused tests under `tests/`

Validation:

- `npm run test:story-lab-auth`
- `npm run test:story-lab-storage-port`
- `npm run test:story-lab-configured-auth`
- `npm run test:story-lab-clerk-auth`
- `npm run test:story-lab-profile-contracts`
- `npm run test:story-lab-profile-store`
- `npx -p node@20 node ./node_modules/typescript/bin/tsc -p story-generator/tsconfig.spec.json --noEmit`
- `scripts/recovery/preflight.sh --quick --skip-status`

Acceptance:

- missing provider config denies by default;
- blank or unknown provider selection fails closed;
- Clerk-shaped token extraction requires an injected verifier before returning an app user;
- profile preferences are normalized from runtime data before persistence;
- no route or UI claims cloud sync.

Validation on 2026-06-13:

- RED baseline: `npm run test:story-lab-profile-contracts`, `npm run test:story-lab-configured-auth`, and `npm run test:story-lab-profile-store` were missing scripts before the slice.
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

### Phase 2: Cloud Schema And Storage Readiness

Goal: add schema/readiness/config/executor scaffolding while staying guarded when no real `DATABASE_URL` exists.

Status:

- Merged through PR #118 on 2026-06-13.
- Adds migration-ready SQL for private profiles and owner-scoped story projects.
- Adds cloud storage config that creates profile/project stores only when `DATABASE_URL` and an executor are available.
- Adds a Neon executor wrapper with injectable query creation for tests.
- Adds guarded schema-apply and readiness-smoke scripts that refuse missing `DATABASE_URL`.
- Does not execute a migration, provision a database, add an account route, or claim live cloud persistence.
- Review follow-up fixed explicit empty env handling, CommonJS-safe schema loading, SQL splitting, readiness table detection, and Neon `.query(text, params)` regression coverage.

Candidate local commits:

- `7144dff Add Story Lab cloud schema scaffold`
- `aa8d848 Add Story Lab cloud storage config seam`
- `c3d77f0 Add Story Lab Neon storage executor`
- `2bd5691 Add Story Lab cloud schema migration helper`
- `bf5cf38 Add Story Lab cloud database readiness smoke`

Validation:

- `npm run test:story-lab-cloud-schema`
- `npm run test:story-lab-cloud-schema-migration`
- `npm run test:story-lab-cloud-db-readiness`
- `npm run test:story-lab-cloud-storage-config`
- `npm run test:story-lab-neon-executor`
- `npm run test:all`
- `scripts/recovery/check-vercel-function-count.sh`

Acceptance:

- schema drift tests cover profile, project, and future job tables;
- guarded scripts refuse missing `DATABASE_URL`;
- driver creation is lazy and testable with injected executors;
- no live database migration is claimed unless actually run.

Validation on 2026-06-13:

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

### Phase 3: Consolidated Account Route

Goal: add one deployable account route for profile and project cloud library operations.

Status:

- Implemented in the consolidated account-route change set.
- Adds one Vercel function at `api/story-lab/account.ts`.
- Adds rewrites for profile, project collection, and project item account paths into the single function.
- Uses `createStoryLabCloudStorage()` for default profile/project stores so missing cloud configuration fails closed.
- Supports injected non-durable stores for tests without claiming `cloud_postgres`.
- Rejects malformed project ids and incomplete project save bodies before store access.
- Sanitizes public store error messages from injected/future stores.
- Removes the global wildcard `/api/*` Vercel CORS header so private account routes rely on route-level credentialed CORS.
- Still not live provider auth, signed-in Angular UI, executed database migration, provisioned database, or durable cloud sync proof.

Candidate local commits:

- `0d5b659 Add Story Lab account route slice`
- account-route hunk from `aa8d848 Add Story Lab cloud storage config seam`
- backend account service contract part of `ca79e26 Add Story Lab account service methods`
- backend account-route part of `a7fbacd Report non-durable account storage mode`

Validation:

- `npm run test:story-lab-account-routes`
- `npm run test:story-lab-storage-port`
- `npm run test:story-lab-profile-store`
- `scripts/recovery/check-vercel-function-count.sh`
- `scripts/recovery/preflight.sh --quick --skip-status`

Acceptance:

- profile and project operations share one deployable route target;
- function count stays within the limit;
- cross-owner access fails;
- non-durable injected stores report `non_durable_memory`, not `cloud_postgres`.

Validation on 2026-06-13:

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

### Phase 4: Angular Cloud Library Service And UI

Goal: expose local-vs-cloud library state honestly in the Angular app while preserving anonymous browser-local saves.

Status:

- Implemented by the Angular cloud-library UI change set.
- Adds account-service methods for profile status and project save/list/load/delete calls against the consolidated account route.
- Adds cloud-library UI state for account status, setup action, cloud save/load/delete controls, and local-vs-cloud messaging.
- Gates cloud project actions on connected account state while preserving anonymous browser-local saves.
- Displays non-durable account storage as unavailable for cloud sync instead of implying durability.
- Still not live provider auth, signed-in browser flow, executed migration, provisioned database, durable cloud sync proof, or durable jobs.

Candidate local commits:

- `ca79e26 Add Story Lab account service methods`
- `def026c Add Story Lab cloud library UI state`
- `29fc248 Show Story Lab cloud account status`
- `033112c Show Story Lab account setup action`
- `504dc84 Gate cloud save on connected account`
- `77b3b13 Gate cloud project actions on connected account`
- `7b87100 Correct cloud controls browser spec`
- frontend part of `a7fbacd Report non-durable account storage mode`
- `9465073 Show non-durable cloud storage as unavailable`

Validation:

- `npx -p node@20 node ./node_modules/typescript/bin/tsc -p story-generator/tsconfig.spec.json --noEmit`
- targeted Angular specs if Chrome is stable
- `npm run build`
- `scripts/recovery/preflight.sh --quick --skip-status`

Acceptance:

- local browser saves remain visible and usable;
- cloud calls are gated until account state is connected;
- failed or unavailable account state does not imply durable cloud sync;
- non-durable account storage is displayed as cloud-unavailable.

Validation on 2026-06-21:

- `npm run recovery:preflight -- cloud-library-ui --quick`: passed.
- `npm run recovery:preflight -- cloud-library-ui`: passed and wrote `tmp/recovery/cloud-library-ui-evidence.md`.
- `git diff --check`: passed.
- `scripts/recovery/check-vercel-function-count.sh`: passed at `11/12`.
- `npx -p node@20 node ./node_modules/typescript/bin/tsc -p story-generator/tsconfig.spec.json --noEmit`: passed.
- `npx -p node@20 node ./node_modules/typescript/bin/tsc -p story-generator/tsconfig.app.json --noEmit`: passed.
- `npm run build`: passed with existing Angular bundle and CSS budget warnings.
- Targeted Angular browser specs built successfully, but local `ChromeHeadless` did not capture before timeout after two retries; this was not counted as passing browser-spec proof.

### Phase 5: Durable Job Owner Scaffolding

Goal: prepare owner-scoped durable job storage seams while keeping active jobs labelled non-durable until Workflow/database route wiring is real.

Status:

- Implemented by the durable job owner scaffolding change set.
- Added job schema/readiness contract coverage for future `story_lab_jobs` and `story_lab_job_events` tables.
- Added a `StoryLabJobStore` port, non-durable adapter compatibility, Postgres job store scaffold, and guarded job-store config.
- Routed job create/read/event operations through configured job storage and authenticated owner context where durable storage is configured.
- Guarded job reads and updates by owner so cross-owner job access fails closed.
- Kept the active default job mode as `non_durable_memory` and added UI/recovery copy that says in-memory job state is not crash-safe.
- Still not a live Workflow runner, not executed database migration proof, not provisioned database proof, and not process-loss durable job proof.

Candidate local commits:

- `206e6ea Add Story Lab durable job schema contract`
- `6e348b7 Add Story Lab durable job store scaffold`
- `db86c28 Add Story Lab job store config seam`
- `d8782ab Guard Story Lab job route store config`
- `462425e Pass owner context to durable Story Lab jobs`
- `d7bc5b2 Scope Story Lab job reads by owner`
- `244aef5 Guard durable job updates by owner`

Acceptance:

- durable stores require authenticated owner context;
- default job mode remains `non_durable_memory`;
- UI and docs do not claim crash-safe progress.

Validation on 2026-06-21:

- `npm run recovery:preflight -- durable-job-owner`: passed and wrote `tmp/recovery/durable-job-owner-evidence.md`.
- `npm run test:story-lab-job-store-config`: passed.
- `npm run test:story-lab-job-store-port`: passed.
- `npm run test:story-lab-job-routes`: passed.
- `npx -p node@20 node ./node_modules/typescript/bin/tsc -p story-generator/tsconfig.spec.json --noEmit`: passed.
- `npx -p node@20 node ./node_modules/typescript/bin/tsc -p story-generator/tsconfig.app.json --noEmit`: passed.
- `npm run build`: passed with existing Angular bundle and CSS budget warnings.

## Research Notes

- Supabase Auth can model permanent and anonymous users and supports RLS, but user-editable metadata must not be used for authorization. Source: https://supabase.com/docs/guides/auth/users, accessed 2026-06-08.
- Vercel Postgres guidance points new projects toward Marketplace Postgres integrations rather than legacy Vercel Postgres. Source: https://vercel.com/docs/postgres, accessed 2026-06-08.
- Vercel Workflow is the later durable-execution direction, not part of the first cloud-library slice. Sources: https://vercel.com/workflows and https://vercel.com/blog/a-new-programming-model-for-durable-execution, accessed 2026-06-08.
- Clerk backend docs describe bearer tokens and `__session` cookies. Any adapter must verify these through an explicit verifier and fail closed without one. Sources: https://clerk.com/docs/request-authentication/backend and https://clerk.com/docs/backend-requests/manual-jwt, accessed 2026-06-08.

## PR Language Guard

Use precise language in PRs:

- Say "contract," "port," "scaffold," "guarded script," or "non-durable store" when that is what shipped.
- Say "live cloud sync" only after signed-in save/load/list/delete works against durable storage.
- Say "provider-backed auth" only after the provider SDK/verifier is wired and verified.
- Say "durable jobs" only after progress survives process loss.
