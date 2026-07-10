# Story Lab Storage Port ExecPlan

Created: 2026-06-05 03:48 EDT
Reconciled: 2026-06-13

## Purpose / Big Picture

Implement Phase C from `STORY_LAB_PLATFORM_EVOLUTION_EXEC_PLAN.md`: a Story Lab storage port and local/test adapters without provisioning a database, adding deployable routes, or claiming cloud persistence.

Current state as of 2026-06-13: this route-free storage-port scaffold is merged into `main` through PR #102 (`4d21e4f`). The remaining platform work is not this Phase C scaffold; it is the later auth/provider/profile/cloud-library work that turns the scaffold into a signed-in user feature.

The user-visible outcome is not account sync yet. The observable technical outcome is that the app has a typed owner-scoped persistence boundary ready for future account sync:

- anonymous browser-local saving remains unchanged;
- route code can continue to run without `DATABASE_URL`;
- storage imports do not throw when no database exists;
- every store operation is shaped around an authenticated owner, not API keys;
- the in-memory store is explicitly non-durable;
- the Postgres adapter is a dependency-injected scaffold that lazy-reads configuration and fails closed until a real executor/migration is provided.

This plan is intentionally route-free. At the time Phase C was written, the Vercel function-count guard was `12/12`; route-budget work later reduced the count. Phase C still must not add `api/story-lab/storage*` routes or claim cloud sync.

## Live Signed-In Durability Proof Boundary

- This storage-port plan is scaffold-and-route-free only; it is not itself a cloud durability proof.
- Use the `Live Signed-In Durability Proof (Credential-Safe)` section in `STORY_LAB_AUTH_PROFILE_CLOUD_LIBRARY_EXEC_PLAN.md` for the credential-safe, signed-in proof sequence.
- Durable proof for this plan still depends on that active auth/cloud work and should be recorded as separate evidence before changing PR language to cloud-stable claims.

## Progress

- [x] Started from merged `main` after PR #100 was merged.
- [x] Created branch `feature/story-lab-storage-port`.
- [x] Read `.agent/PLANS.md`, `AGENTS.md`, `STORY_LAB_PLATFORM_EVOLUTION_EXEC_PLAN.md`, current Story Lab contracts, auth helpers, local browser storage service, and recovery lessons.
- [x] Ran hostile expert review against the initial Phase C direction.
- [x] Revised the plan to keep storage route-free, dependency-injected, owner-scoped, and non-durable unless a real database executor is provided.
- [x] Implement storage port contracts.
- [x] Implement non-durable in-memory store.
- [x] Implement Postgres adapter scaffold with lazy `DATABASE_URL`.
- [x] Add focused storage port tests.
- [x] Add hostile-review-driven Postgres owner-conflict save coverage.
- [x] Fix any Postgres save path that can imply cross-owner overwrite success.
- [x] Update platform plan, changelog, and lessons with focused storage evidence.
- [x] Address Gemini review comments for missing metadata and corrupt stored JSON handling.
- [x] Run focused validation and recovery preflight.
- [x] Push, open PR, address review/checks, and merge the PR.
- [x] Reconcile this plan against PR #102 merge evidence, route-budget changes, and the later split-recovery plan.
- [x] Use `STORY_LAB_AUTH_PROFILE_CLOUD_LIBRARY_EXEC_PLAN.md` for future account/profile/cloud-library work instead of treating this Phase C storage plan as active implementation permission.

## Surprises & Discoveries

- `api/_lib/story-lab/contracts.ts` re-exports `SavedStoryProject` from the Angular contract file. Phase C can reuse that exact saved-project payload rather than inventing a second persisted project shape.
- `AuthPort` and `authorizeProjectAccess` already exist from Phase B. The storage port should accept an `AuthUser` for every owner-scoped operation and use the same denial semantics.
- There is already a browser-local `StoryWorkspaceStorageService`, but it is frontend-only and explicitly anonymous/local. Phase C must not replace it or make it look like cloud sync.
- `api/_lib/story-lab/stateStore.ts` has transient server memory for continuity. That helper is not owner-scoped and should remain separate from the account-sync storage port.

## Decision Log

- Decision: Store methods take `AuthUser`, never request headers or API keys.
  Rationale: Auth provider selection remains blocked, but Phase C can enforce that persistence is account-owned once a caller has a user.
- Decision: The storage port operates on `SavedStoryProject`.
  Rationale: This is the existing Story Lab project snapshot shape with blueprint, summary, state, chapters, telemetry, and continuity metadata. Reusing it avoids drift between local browser save and future cloud sync.
- Decision: The in-memory adapter is named `createNonDurableInMemoryStoryProjectStore`.
  Rationale: The repo has already learned that in-memory Vercel state must not be implied durable.
- Decision: The Postgres adapter takes a `PostgresQueryExecutor` option instead of importing `pg`, Neon, or another database package.
  Rationale: There is no provisioned database or dependency in this slice. Importing the adapter without env must not throw, and future driver selection should happen with provisioning.
- Decision: The Postgres adapter lazy-reads `DATABASE_URL` only when an operation is called.
  Rationale: Module import must be safe in tests, preflight, and Vercel builds where no cloud database exists.
- Decision: No route files are added.
  Rationale: Phase C is a backend seam only. Cloud-sync endpoints need a separate auth/provider/storage plan and function-budget review.

## Outcomes & Retrospective

Current implementation state as of 2026-06-13:

- Files changed for this slice:
  - `AGENTS.md`: points agents at this active storage-port plan.
  - `STORY_LAB_STORAGE_PORT_EXEC_PLAN.md`: living plan and hostile review record.
  - `api/_lib/story-lab/storage/storyProjectStore.ts`: shared owner-scoped storage contract and result helpers.
  - `api/_lib/story-lab/storage/inMemoryStoryProjectStore.ts`: non-durable local/test adapter.
  - `api/_lib/story-lab/storage/postgresStoryProjectStore.ts`: dependency-injected Postgres scaffold.
  - `tests/story-lab-storage-port.test.ts`: focused storage contract tests.
- Hostile review found that the Postgres save path could ignore a zero-row upsert result and imply success after a cross-owner id conflict. The adapter now requires `returning ...` rows from the database and returns `STORY_LAB_PROJECT_FORBIDDEN` if the owner-scoped upsert returns none.
- Gemini review found that missing `summary`, `chapters`, `blueprint`, or `state` fields could throw in metadata paths, and that corrupt database JSON needed explicit handling. The storage helpers now use safe metadata fallbacks, and the Postgres row parser fails closed with a typed storage error instead of returning a fabricated project.
- Validation passed:
  - `git diff --check`;
  - `npx tsx tests/story-lab-storage-port.test.ts` -> `Story Lab storage port tests passed`;
  - `npx tsx tests/story-lab-auth.test.ts` -> `Story Lab auth and authorization tests passed`;
  - `npm run test:story-lab-state` -> `Story-lab state delta tests passed`;
  - `scripts/recovery/check-vercel-function-count.sh` -> `Vercel function count check: 12/12`;
  - `scripts/recovery/preflight.sh --quick --skip-status` -> `Preflight completed`.
- PR #102 was merged into `main` with merge commit `4d21e4f`.
- This plan is complete for Phase C storage-port scaffolding only.
- Still not implemented by this plan: auth provider integration, user profiles, cloud project library UI, durable database provisioning/migrations, storage routes, owner-scoped cloud save/load/list/delete endpoints, and signed-in account sync.

## Context and Orientation

Repository root: this checkout. Run commands from the repository root.

Active branch for the original implementation: `feature/story-lab-storage-port`.

Current work should use the split-recovery branches described in `STORY_LAB_UNPUBLISHED_BRANCH_SPLIT_PLAN.md`.

Important files:

- `story-generator/src/app/contracts.ts`: defines `SavedStoryProject`, `StoryGenerationSeam`, `StorySummary`, `StoryStateSnapshot`, and chapters.
- `api/_lib/story-lab/contracts.ts`: backend re-export of Story Lab contract types.
- `story-generator/src/app/story-workspace-storage.service.ts`: current anonymous browser-local storage. Do not replace in this slice.
- `api/_lib/story-lab/auth/authPort.ts`: `AuthUser` and deny-by-default auth port.
- `api/_lib/story-lab/auth/authorizeProjectAccess.ts`: owner authorization helper.
- `api/_lib/story-lab/stateStore.ts`: transient continuity state. Do not confuse it with durable account storage.
- `scripts/recovery/check-vercel-function-count.sh`: route guard; must stay within the Vercel limit.

Unrelated untracked files to leave alone:

- `SPARK_TRIAL_TASKS.md`
- `STORY_QUALITY_EVALS_PLAN.md`
- `tests/grok-smoke.test.ts`

## Hostile Expert Review

Reviewer stance: hostile storage/security/deployment reviewer who wants this rejected unless it prevents future account-sync mistakes.

Objections:

1. A generic `save(project)` API is dangerous. It lets routes save private story data without proving account ownership.
2. A Postgres adapter that imports a driver or reads env at module load can break Vercel builds before provisioning exists.
3. An in-memory adapter can become accidental production behavior if its name is neutral.
4. Saving the whole project as one JSON blob would conflict with the relational schema already documented in the platform plan.
5. Adding routes now would violate the function-count guard and expand the branch into Phase D.
6. Tests that only prove happy-path save/load miss the privacy boundary. They must prove cross-owner access fails and missing database config fails closed.

Revisions made:

- Every port method takes `AuthUser`.
- The in-memory factory name includes `NonDurable`.
- The Postgres adapter exposes readiness/configuration and returns a typed unconfigured error instead of throwing.
- The Postgres adapter maps project, chapter, and state values toward the planned tables instead of inventing a permanent JSON-only storage contract.
- No route files are in scope.
- Tests must cover owner isolation, clone safety, deletion, import without `DATABASE_URL`, and configured-fake-executor SQL paths.

Second hostile review before continuation:

1. The first Postgres executor test proves the generated `saveProject` SQL contains an owner column, but it does not prove the adapter handles an `id` conflict owned by another account. A SQL `on conflict ... do update ... where owner_user_id = excluded.owner_user_id` can return zero rows when the owner does not match. If the adapter ignores that zero-row result and returns the caller's record, it has implied a save that did not happen and hidden an owner-boundary violation.
2. The storage contract should document why the in-memory adapter can return `STORY_LAB_PROJECT_FORBIDDEN` for cross-owner load/delete while the Postgres load/delete path may return null or `deleted: false` when the owner-scoped query sees no row. The privacy-preserving behavior is acceptable, but it must be intentional rather than accidental.
3. The PR must stay narrowly about the storage port. The unrelated untracked Spark/story-quality/grok-smoke files should remain unstaged unless a separate cleanup decision is made.

Revisions required by second review:

- Add a fake-executor test where a configured Postgres save returns no rows and assert that `saveProject` returns `STORY_LAB_PROJECT_FORBIDDEN` without leaking story text.
- Change the Postgres save SQL path to use `returning ...`, map successful rows back through the existing row parser, and treat zero returned rows as an owner-conflict failure.
- Keep Postgres load/delete owner-scoped and document that they avoid revealing whether a project id exists for another owner.

## Plan of Work

Implement a small storage boundary under `api/_lib/story-lab/storage/`:

- `storyProjectStore.ts`: shared contract, result types, owner-scoped record types, and helpers.
- `inMemoryStoryProjectStore.ts`: non-durable test/local adapter with owner isolation and clone safety.
- `postgresStoryProjectStore.ts`: dependency-injected Postgres scaffold that lazy-reads `DATABASE_URL`, refuses to operate when unconfigured, and uses the planned relational table names when an executor is supplied.

Add `tests/story-lab-storage-port.test.ts` using the root `tsx` harness.

Keep frontend storage unchanged. Phase C only prepares the backend storage port; it does not wire cloud sync into UI.

## Concrete Steps

1. Create `api/_lib/story-lab/storage/storyProjectStore.ts`.
2. Define:
   - `StoryProjectStorageMode = 'non_durable_memory' | 'postgres'`;
   - `StoryProjectStoreErrorCode = 'STORY_LAB_STORAGE_UNCONFIGURED' | 'STORY_LAB_STORAGE_DRIVER_MISSING' | 'STORY_LAB_PROJECT_NOT_FOUND' | 'STORY_LAB_PROJECT_FORBIDDEN' | 'STORY_LAB_STORAGE_ERROR'`;
   - `StoryProjectStoreResult<T>`;
   - `StoredStoryProjectRecord`;
   - `StoryProjectListItem`;
   - `StoryProjectStore`.
3. Add helper functions:
   - `cloneSavedStoryProject`;
   - `createStoredStoryProjectRecord`;
   - `toStoryProjectListItem`;
   - `projectAccessRecordFromStoredProject`;
   - `createStoryProjectStoreError`.
4. Create `api/_lib/story-lab/storage/inMemoryStoryProjectStore.ts`.
5. Implement owner-scoped `saveProject`, `loadProject`, `listProjects`, and `deleteProject`.
6. Create `api/_lib/story-lab/storage/postgresStoryProjectStore.ts`.
7. Define:
   - `PostgresQueryExecutor`;
   - `PostgresStoryProjectStoreOptions`;
   - `createPostgresStoryProjectStore`.
8. The Postgres adapter must:
   - not read `process.env.DATABASE_URL` at module import;
   - expose `isConfigured()`;
   - return `STORY_LAB_STORAGE_UNCONFIGURED` without throwing if no database URL is available;
   - return `STORY_LAB_STORAGE_DRIVER_MISSING` if a URL exists but no executor is injected;
   - use owner id in every query;
   - avoid logging or embedding story text in errors.
9. Add `tests/story-lab-storage-port.test.ts`.
10. Add the hostile-review regression test for zero-row Postgres save results.
11. Fix `api/_lib/story-lab/storage/postgresStoryProjectStore.ts` so successful saves are based on returned rows.
12. Update `STORY_LAB_PLATFORM_EVOLUTION_EXEC_PLAN.md`, `PR70_RECOVERY_CHANGELOG.md`, and `LESSONS_LEARNED.md`.
13. Validate.
14. Commit, push, create PR, address checks/review, and merge.
15. For future cloud-sync work, stop using this Phase C plan as implementation permission and use the auth/profile/cloud-library checklist.

## Validation and Acceptance

Run from the repository root:

- `git diff --check`
- `npx tsx tests/story-lab-storage-port.test.ts`
- `npx tsx tests/story-lab-auth.test.ts`
- `npm run test:story-lab-state`
- `scripts/recovery/check-vercel-function-count.sh`
- `scripts/recovery/preflight.sh --quick --skip-status`

Expected results:

- all commands pass;
- function count remains within the Vercel limit;
- importing the Postgres adapter without `DATABASE_URL` passes;
- in-memory store save/load/list/delete is owner-scoped;
- cross-owner load/delete returns forbidden/not accessible behavior and does not leak private story text;
- fake Postgres executor receives owner-scoped SQL and parameters;
- no deployable `api/story-lab/storage*` route exists.

## Idempotence and Recovery

- Re-running tests should not depend on global store state. Each test must create its own store.
- The in-memory store must clone project payloads on save/load/list to prevent callers mutating internal state.
- The Postgres adapter must not open sockets, import database drivers, or require env during import.
- If `DATABASE_URL` is absent, storage operations fail closed with a typed result instead of throwing.
- If validation fails, fix the specific adapter/contract and rerun focused tests before preflight.
- If GitHub checks fail after push, address review/check failures on the same branch and re-run the relevant local proof before pushing again.

## Artifacts and Notes

PR #100 was merged before this plan started:

- PR: `https://github.com/Phazzie/FairytaleswithSpice/pull/100`
- Merge commit: `e4add59eb4dfaf128effe6fb0547fc4f27308566`

PR #102 merged this Phase C storage-port scaffold:

- PR: `https://github.com/Phazzie/FairytaleswithSpice/pull/102`
- Merge commit: `4d21e4f`

Phase C must remain smaller than account sync:

- no auth provider adapter;
- no schema migration file;
- no Neon/Vercel Marketplace setup;
- no UI cloud-sync button;
- no storage route;
- no job route;
- no Blob/email/audio export.

## Interfaces and Dependencies

No new npm dependencies.

The Postgres adapter depends on this injected interface:

```ts
export interface PostgresQueryExecutor {
  query<T = unknown>(sql: string, params: readonly unknown[]): Promise<{ rows: T[] }>;
}
```

Future provisioning work can wrap Neon, `pg`, or another Vercel-compatible Postgres client behind that interface after database selection and migrations exist.
