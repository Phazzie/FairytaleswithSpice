# Story Lab Job Routes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the three Story Lab job API routes that replace sensitive EventSource query-string generation with opaque `job_<uuid>` status and events paths.

**Architecture:** Spend one route slot freed by `STORY_LAB_ROUTE_BUDGET_EXEC_PLAN.md`, keep reusable job logic under `api/_lib/story-lab/jobs`, rewrite status/events URLs into the same deployable function while storage is process-local, and label the current execution mode as `non_durable_memory`. The branch adds a backend job scaffold and Angular client seam methods, but it does not claim durable Workflow execution, cloud persistence, account sync, audio, export jobs, or a redesigned progress UI.

**Tech Stack:** TypeScript Vercel functions under `api/`, shared Story Lab contracts under `story-generator/src/app/contracts.ts` and `api/_lib/story-lab/jobs`, Angular `HttpClient` and `EventSource` methods in `story-generator/src/app/story.service.ts`, custom `tsx` integration tests under `tests/`, and recovery validation scripts.

---

## Purpose / Big Picture

Story Lab currently has a direct POST genesis route and a GET stream route that still carries blueprint fields in an EventSource query string. Phase B4 created opaque job-id helpers but did not add routes because the Vercel function guard was saturated. PR #103 lowered the active route count to `9/12`, which means Phase D can add a job function without exceeding the 12-function guard.

The first implementation used three deployable files, but review correctly identified that process-local memory cannot be shared across separate Vercel functions. The branch now serves the three public URLs through one deployable `api/story-lab/jobs.ts` function and Vercel rewrites.

The user-visible outcome of this slice is not a new visible progress UI yet. The observable outcome is a typed job API surface:

1. `POST /api/story-lab/jobs` accepts a genesis or continuation job request in the body and returns an opaque job id plus status/events paths.
2. `GET /api/story-lab/jobs/:jobId` returns the current non-durable job snapshot without exposing blueprint text in the path.
3. `GET /api/story-lab/jobs/:jobId/events` returns SSE snapshots for queued, running, completed, or failed state.
4. Angular `StoryService` has methods for creating, reading, and subscribing to jobs so the next UI slice can switch progress wiring without inventing contracts.

This branch deliberately keeps the current direct generation routes working. It does not delete `/api/story-lab/stories` or `/api/story-lab/stream/genesis`, and it does not pretend that an in-memory map survives Vercel cold starts.

## Progress

- [x] Confirmed live checkout is `main...origin/main` with only unrelated untracked files: `SPARK_TRIAL_TASKS.md`, `STORY_QUALITY_EVALS_PLAN.md`, and `tests/grok-smoke.test.ts`.
- [x] Read `AGENTS.md`, `.agent/PLANS.md`, `STORY_LAB_PLATFORM_EVOLUTION_EXEC_PLAN.md`, `STORY_LAB_ROUTE_BUDGET_EXEC_PLAN.md`, recent `PR70_RECOVERY_CHANGELOG.md`, recent `LESSONS_LEARNED.md`, current Story Lab routes, job contracts, CORS helper, parser, engine, state store, storage port, and frontend `StoryService`.
- [x] Confirmed `scripts/recovery/check-vercel-function-count.sh` reports `9/12` before this branch.
- [x] Created branch `feature/story-lab-job-routes`.
- [x] Wrote this ExecPlan and hostile review.
- [x] Add shared job response contracts and non-durable job store.
- [x] Add the public job route family through one deployable job function and rewrites.
- [x] Add Angular client seam methods and focused specs.
- [x] Add route/store tests for opaque ids, SSE snapshots, missing-provider failures, and invalid job ids.
- [x] Update function-count allow-list and active docs.
- [x] Run focused validation and record evidence.
- [x] Commit, push, open PR, address review, and merge only if checks pass.

## Surprises & Discoveries

- `api/_lib/story-lab/jobs/jobContracts.ts` already exists from Phase B4. It owns `createOpaqueStoryLabJobId`, `assertOpaqueStoryLabJobId`, and `buildStoryLabJobPaths`.
- There is no job store yet. Current generation state is transient memory in `api/_lib/story-lab/stateStore.ts`.
- `generateStoryLabGenesis()` and `continueStoryLab()` already fail closed in production when `XAI_API_KEY` is missing by returning `AI_UNAVAILABLE`. The job scaffold should preserve that behavior by creating a failed job, not by falling back to mock prose in production.
- The full Phase D plan mentions UI reload survival and progress UI. That requires a separate frontend integration slice because this branch must first stabilize the job API contract and non-durable limitations.

### W4 Schema/Readiness Proof

Current schema/readiness proof covers durable-job storage shape for future work:
- `story_lab_jobs` and `story_lab_job_events` tables are present in schema migration + tested as executed statements.
- Required indexes for owner/idempotency and event sequence/replay (`story_lab_jobs_owner_updated_idx`, `story_lab_jobs_owner_idempotency_idx`, `story_lab_job_events_job_sequence_idx`, `story_lab_job_events_owner_job_idx`) are asserted in readiness checks.
- Foreign-key link from `story_lab_job_events(job_id, owner_user_id)` to `story_lab_jobs(job_id, owner_user_id)` is included in the SQL contract.

Process-loss proof is not yet done; route/store durability is still non-durable process-local and is blocked by separate execution proof work.

## Decision Log

- Decision: Use the existing `jobContracts.ts` instead of creating a second competing `contracts.ts`.
  Rationale: Phase B4 already introduced the opaque id/path helpers in `jobContracts.ts`. Duplicating contract files would invite drift.
- Decision: Add job API types to `story-generator/src/app/contracts.ts` and re-export/use them from backend job helpers.
  Rationale: `AGENTS.md` requires frontend/backend seam alignment when a feature crosses the UI/API boundary.
- Decision: Implement a non-durable in-memory job store under `api/_lib/story-lab/jobs/jobStore.ts`.
  Rationale: No Vercel Workflow, queue, auth provider, or database-backed job table is provisioned. The scaffold is useful only if it is honest about that limitation.
- Decision: `POST /api/story-lab/jobs` runs the current generation work inside the request and then stores a completed or failed job snapshot.
  Rationale: Without Workflow or a worker, returning a queued job that runs elsewhere would be fake durability. The SSE endpoint can still replay queued, running, and terminal snapshots from the event history.
- Decision: Keep direct Story Lab routes alive.
  Rationale: The current UI depends on them. Removing them belongs in a later migration after the UI uses job routes.
- Decision: Do not implement export or audio jobs in this branch.
  Rationale: Export and audio require Blob/private artifacts, provider choices, cost caps, and retention/deletion behavior beyond this backend job scaffold.

## Hostile Expert Review

An expert reviewer hostile to this plan would object:

1. "This is fake background work."
   Response: The plan labels the mode `non_durable_memory`, runs work synchronously in the POST request, and records that Workflow/queue/database work is still required before claiming durable progress.
2. "Adding status/events as separate functions breaks process-local state."
   Response: The branch starts at `9/12`, adds one deployable job function, rewrites status/events URLs into that function, and must end with the guard at `10/12`.
3. "The path might still leak private blueprint text."
   Response: Status and events paths are built only from `job_<uuid>`. Request bodies may contain private data, but URLs must not.
4. "Status/events endpoints may reveal another user's job."
   Response: No account auth is active in this scaffold. Treat jobs as opaque local development handles and do not connect cloud storage or account sync in this branch. Durable owner-scoped authorization remains a later auth/provider gate.
5. "SSE can hang CI or serverless functions."
   Response: The non-durable events route replays stored snapshots and closes. It is not a long-held background worker connection.
6. "The frontend service could log job URLs with private data."
   Response: Job URLs contain only opaque ids. The service should log counts/status, not raw blueprint text.
7. "Production missing-key behavior might silently return mock content."
   Response: Tests must set production-like env without `XAI_API_KEY` and assert the job terminal state is `failed` with `AI_UNAVAILABLE`.

## Outcomes & Retrospective

Outcome:

- Added and merged the backend Story Lab job-route scaffold and Angular job client seam. The scaffold creates opaque `job_<uuid>` ids, stores process-local snapshots, replays SSE events, and labels durability as `non_durable_memory`.
- Validation evidence during implementation: `git diff --check`, `npx tsx tests/story-lab-job-contracts.test.ts`, `npx tsx tests/story-lab-job-routes.test.ts`, `npx -p node@20 node ./node_modules/typescript/bin/tsc -p story-generator/tsconfig.spec.json --noEmit`, `scripts/recovery/check-vercel-function-count.sh`, and `scripts/recovery/preflight.sh --quick --skip-status`.
- PR and merge evidence: PR #104, "Add Story Lab job route scaffold" (https://github.com/Phazzie/FairytaleswithSpice/pull/104), merged 2026-06-07 at commit `564e29f613d0629da74ea86121555f0ac4e7f861`; current `main` contains the job route family and job UI/client wiring.
- Remaining risks: durable Workflow/queue/database/auth ownership remains future work; job progress must keep `non_durable_memory` wording until process-loss durable behavior is proven.

## Context and Orientation

Repository root: this checkout.

Active branch: `feature/story-lab-job-routes`.

Files that already matter:

- `api/_lib/story-lab/jobs/jobContracts.ts`: opaque job id/path helpers and current job type definitions.
- `tests/story-lab-job-contracts.test.ts`: existing opaque-id/path tests.
- `api/story-lab/stories.ts`: current direct genesis route.
- `api/story-lab/stories/[storyId]/continue.ts`: current direct continuation route.
- `api/story-lab/stream/genesis.ts`: current EventSource route that still carries blueprint query fields.
- `api/_lib/story-lab/storyLabEngine.ts`: current genesis and continuation execution functions.
- `api/_lib/story-lab/validation/blueprintParser.ts`: shared body/query blueprint parser.
- `api/_lib/http/corsPolicy.ts`: required CORS helper for private Story Lab routes.
- `story-generator/src/app/contracts.ts`: frontend seam contracts.
- `story-generator/src/app/story.service.ts`: Angular API client.
- `scripts/recovery/check-vercel-function-count.sh`: deployable route allow-list and count guard.

Do not stage or modify unrelated untracked files:

- `SPARK_TRIAL_TASKS.md`
- `STORY_QUALITY_EVALS_PLAN.md`
- `tests/grok-smoke.test.ts`

## Plan of Work

Task 1 creates shared job contracts and the non-durable store. Task 2 creates the public job route family through one deployable function and rewrites. Task 3 adds frontend client methods and specs. Task 4 adds route/store tests. Task 5 updates docs and the route-count guard. Task 6 validates and publishes.

## Concrete Steps

### Task 1: Shared job contracts and store

Files:

- Modify `story-generator/src/app/contracts.ts`.
- Modify `api/_lib/story-lab/jobs/jobContracts.ts`.
- Create `api/_lib/story-lab/jobs/jobStore.ts`.
- Update `tests/story-lab-job-contracts.test.ts`.

Steps:

- [x] Add aligned frontend job types: `StoryLabJobKind`, `StoryLabJobStatus`, `StoryLabJobError`, `StoryLabJob`, `StoryLabJobPaths`, `StoryLabJobDurability`, `StoryLabJobEvent`, `StoryLabJobCreationRequest`, and `StoryLabJobCreationResponse`.
- [x] Reuse or re-export those types from `jobContracts.ts` while preserving `createOpaqueStoryLabJobId`, `assertOpaqueStoryLabJobId`, and `buildStoryLabJobPaths`.
- [x] Add a `non_durable_memory` durability object with a plain warning that jobs are process-local and not crash-safe.
- [x] Create a non-durable store that clones job snapshots, records event history for every status transition, returns `null` for missing jobs, and can be reset in tests.

### Task 2: Job route files

Files:

- Create `api/story-lab/jobs.ts`.
- Modify `vercel.json`.

Steps:

- [x] `POST /api/story-lab/jobs` must use `applyCorsPolicy` with `POST, OPTIONS`, validate body shape, create an opaque job id, run genesis or continuation synchronously, store queued/running/completed or failed events, and return an `ApiResponse<StoryLabJobCreationResponse>`.
- [x] `GET /api/story-lab/jobs/:jobId` must use `applyCorsPolicy` with `GET, OPTIONS`, reject invalid ids with `400`, return `404` for unknown ids, and return the stored job snapshot plus paths/durability.
- [x] `GET /api/story-lab/jobs/:jobId/events` must use `applyCorsPolicy` with `GET, OPTIONS`, reject invalid ids with `400`, return `404` for unknown ids, write SSE headers, replay stored job events, and end the response.
- [x] Unsupported job kinds `export` and `audio` must return `400` in this branch with an explicit message that those jobs require later provider/storage planning.

### Task 3: Angular client seam

Files:

- Modify `story-generator/src/app/story.service.ts`.
- Modify `story-generator/src/app/story.service.spec.ts`.

Steps:

- [x] Add `createStoryLabJob(request)`, `getStoryLabJob(jobId)`, and `streamStoryLabJobEvents(jobId, onEvent)` methods.
- [x] Ensure the service logs job kind/status/path facts, not raw blueprint or chapter text.
- [x] Add specs proving POST `/api/story-lab/jobs`, GET `/api/story-lab/jobs/:jobId`, and EventSource `/api/story-lab/jobs/:jobId/events`.

### Task 4: Route/store tests

Files:

- Create `tests/story-lab-job-routes.test.ts`.
- Update `tests/story-lab-job-contracts.test.ts` if contract fields change.

Steps:

- [x] Test a mock-mode genesis job returns an opaque job id, paths with only the id, `non_durable_memory` durability, and a terminal `completed` snapshot.
- [x] Test status GET returns the stored job without exposing private blueprint terms in paths.
- [x] Test events GET replays `queued`, `running`, and terminal snapshots as SSE and closes.
- [x] Test invalid job ids return `400` and unknown valid ids return `404`.
- [x] Test production-like missing `XAI_API_KEY` creates a failed job with `AI_UNAVAILABLE`, not mock prose.

### Task 5: Docs and route guard

Files:

- Modify `scripts/recovery/check-vercel-function-count.sh`.
- Modify `AGENTS.md`.
- Modify `api/README.md`.
- Modify `STORY_LAB_PLATFORM_EVOLUTION_EXEC_PLAN.md`.
- Modify `PR70_RECOVERY_CHANGELOG.md`.
- Modify `LESSONS_LEARNED.md`.
- Modify this plan.

Steps:

- [x] Add the job function to the allow-list and verify the guard prints `10/12`.
- [x] Update active API docs with the new job route family and the non-durable limitation.
- [x] Update the platform plan so Phase D backend job routes are marked as scaffolded while full UI progress, Workflow, durable storage, and account auth remain pending.
- [x] Record validation evidence and self-review in the changelog and this plan.

### Task 6: Validate and publish

Run from repository root:

- [x] `git diff --check`
- [x] `npx tsx tests/story-lab-job-contracts.test.ts`
- [x] `npx tsx tests/story-lab-job-routes.test.ts`
- [x] `npx -p node@20 node ./node_modules/typescript/bin/tsc -p story-generator/tsconfig.spec.json --noEmit`
- [x] `scripts/recovery/check-vercel-function-count.sh`
- [x] `scripts/recovery/preflight.sh --quick --skip-status`

Expected results:

- Function count prints `10/12`.
- Job route tests prove completed and failed non-durable jobs.
- Quick preflight exits 0.

If validation passes, commit intended files. Normal commit/push hooks may still point at stale `pocketfm-contest-forge`; if they fail before running useful checks, use `--no-verify` only after recording validation evidence.

## Validation and Acceptance

Accept this branch only when:

- Public job URLs route through one deployable function and function count is `10/12`.
- Job ids are opaque `job_<uuid>` values, and status/events paths contain no blueprint/story text.
- `POST /api/story-lab/jobs` supports genesis and continuation job requests.
- Production-like missing provider config creates a failed job with `AI_UNAVAILABLE`.
- `GET /api/story-lab/jobs/:jobId/events` replays snapshots and closes.
- `StoryService` exposes typed job methods for the next UI slice.
- Docs explicitly say this is non-durable and process-local until Workflow/queue/database/auth work lands.

## Idempotence and Recovery

If the store state leaks across tests, call the exported reset helper before each route test.

If route count exceeds 12, stop and remove unintended route files. Do not add helper files outside `api/_lib`.

If generation tests are slow or call a live provider unexpectedly, set `STORY_LAB_FORCE_MOCK=1` for mock tests and explicitly unset production env after missing-key tests.

If frontend EventSource tests are brittle under Node, keep them at URL-construction/spec level and leave full browser smoke for the UI integration branch.

If review asks for durable job behavior, push back unless Workflow/queue/database provisioning is included in scope.

## Artifacts and Notes

This branch intentionally leaves these pending:

- full progress UI and reload recovery;
- durable Workflow execution;
- owner-scoped job storage;
- account auth/provider integration;
- export/audio job execution;
- removal of legacy direct Story Lab generation routes.

## Interfaces and Dependencies

No new npm packages are required.

The non-durable job response shape:

```typescript
interface StoryLabJobCreationResponse<TResult = unknown> {
  job: StoryLabJob<TResult>;
  paths: StoryLabJobPaths;
  durability: {
    mode: 'non_durable_memory';
    durable: false;
    warning: string;
  };
}
```

The event response shape:

```typescript
interface StoryLabJobEvent<TResult = unknown> {
  eventId: string;
  type: 'snapshot';
  emittedAt: string;
  job: StoryLabJob<TResult>;
}
```

The route helper must never put request body fields into the status or events path. Use `buildStoryLabJobPaths(jobId)` only.
