# Story Lab Route Budget Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Free three Vercel function slots for future Story Lab job routes by retiring unused or duplicate deployable API routes without changing story generation behavior.

**Architecture:** Keep all shared services under `api/_lib`, keep current story and Story Lab generation routes intact, and remove only deployable route entrypoints that are not part of the active Angular user flow. The debug panel will use the existing root `/api/health` endpoint instead of a duplicate Story Lab-specific health endpoint.

**Tech Stack:** TypeScript Vercel functions under `api/`, Angular 20 debug UI under `story-generator/src/app`, recovery shell scripts under `scripts/recovery`, and root `tsx`/TypeScript/preflight validation.

---

## Purpose / Big Picture

The Story Lab platform plan is blocked from adding the three future job routes:

- `api/story-lab/jobs.ts`
- `api/story-lab/jobs/[jobId].ts`
- `api/story-lab/jobs/[jobId]/events.ts`

The repository currently has a deployable Vercel function guard at `12/12`. This plan reduces the active deployable route count from 12 to 9 by removing:

- `api/story/stream-demo.ts`, a hard-coded demo SSE endpoint not used by the Angular app;
- `api/story-lab/health.ts`, a duplicate health endpoint used only by the debug panel and mocked browser smoke;
- `api/image/generate.ts`, an image-generation route not used by the Angular app.

This does not delete shared service code such as `api/_lib/services/imageService.ts`, and it does not add any replacement route. The observable result is that `scripts/recovery/check-vercel-function-count.sh` reports `9/12`, while the app and Story Lab routes still type-check and pass recovery preflight.

## Progress

- [x] Confirmed live branch started from `main` with only unrelated untracked files: `SPARK_TRIAL_TASKS.md`, `STORY_QUALITY_EVALS_PLAN.md`, and `tests/grok-smoke.test.ts`.
- [x] Read `AGENTS.md`, `.agent/PLANS.md`, `PR70_RECOVERY_PLAN.md`, `PR70_RECOVERY_LEDGER.md`, recent `PR70_RECOVERY_CHANGELOG.md`, recent `LESSONS_LEARNED.md`, and `STORY_LAB_PLATFORM_EVOLUTION_EXEC_PLAN.md`.
- [x] Confirmed current deployable functions are 12 Vercel route files.
- [x] Confirmed live-code references to `/api/story-lab/health` are `story-generator/src/app/debug-panel/debug-panel.ts` and `scripts/recovery/story-lab-browser-smoke.mjs`.
- [x] Confirmed no Angular app references to `/api/image/generate` or `/api/story/stream-demo`.
- [x] Created branch `feature/story-lab-route-budget`.
- [x] Remove the three retired deployable route files.
- [x] Redirect debug panel and browser smoke health usage to `/api/health`.
- [x] Update the Vercel function-count allow-list to expect 9 functions.
- [x] Update active docs and recovery ledgers.
- [x] Run validation and record evidence.
- [ ] Push, open PR, address review, and merge if checks pass.

## Surprises & Discoveries

- Project-local `.worktrees/` is not ignored in this checkout. To avoid adding tool-only ignore churn, this work runs on a normal feature branch in the current checkout.
- The root `/api/health` endpoint returns `{ success: true, data: { status: "healthy", timestamp, version, environment, services, cors } }`, while `/api/story-lab/health` returns `{ status: "ok", time }`. The debug panel must adapt to the root shape.
- `story-generator/src/server.ts` contains a local Express `/api/image/generate` route. This plan does not touch that local development server route because it is not a Vercel deployable function under root `api/`.
- Gemini Code Assist review correctly pointed out that the debug panel should not crash on malformed successful health payloads. The local payload type now accepts non-healthy statuses and missing nested fields.

## Decision Log

- Decision: Retire route entrypoints, not shared services.
  Rationale: Function budget is consumed by root `api/**/*.ts` route files outside `_lib`; service code under `_lib` can remain for future image work or local tooling without using a Vercel slot.
- Decision: Keep `/api/health` and delete `/api/story-lab/health`.
  Rationale: One health endpoint is enough for debug/readiness, and the root route already reports Grok config/mock status.
- Decision: Keep `/api/export/save`.
  Rationale: The platform plan says future server export should reuse or replace that route deliberately; deleting it in this slice would conflate route-budget work with export architecture.
- Decision: Do not add rewrite aliases or replacement endpoints for deleted routes.
  Rationale: The goal is to free route capacity. Aliases would either consume the same function budget or hide stale callers.
- Decision: Update active docs and route guards, but do not rewrite historical DigitalOcean/recovery artifacts broadly.
  Rationale: Historical files explain old decisions. Active agent guidance, API docs, route tables, changelog, and lessons must reflect current deployable shape.

## Hostile Expert Review

An expert reviewer hostile to this change would object:

1. "You are probably deleting public endpoints that some UI or smoke test still calls."
   Response: Search live app and script references before deletion. The only live health consumers are redirected to `/api/health`; no live Angular consumer references image generation or stream demo.
2. "You are hiding the problem by deleting functionality instead of consolidating routes."
   Response: These three routes are either duplicate, demo-only, or unused by the shipped Story Lab UI. Core generation routes remain.
3. "Removing `api/image/generate.ts` could erase reusable provider logic."
   Response: Delete only the Vercel route file. Keep `api/_lib/services/imageService.ts` and local server code untouched.
4. "The function-count script could pass while stale docs keep telling agents the routes exist."
   Response: Update `AGENTS.md`, `api/README.md`, the active platform plan, `PR70_RECOVERY_CHANGELOG.md`, and `LESSONS_LEARNED.md`.
5. "The root health endpoint has a different response contract, so the debug panel might look broken."
   Response: Update `HealthPayload` and health-state mapping in `debug-panel.ts`, and add a focused Angular spec that proves `/api/health` is called and marked healthy.
6. "Future Phase D still needs three route files, and 9/12 only barely fits."
   Response: This slice intentionally frees exactly three slots and records that future Phase D work must run the function-count guard before and after adding routes.

## Outcomes & Retrospective

- Outcome: The active deployable Vercel route count is reduced from 12 to 9 by retiring duplicate/demo/unused route entrypoints. The debug panel and mocked browser smoke now use root `/api/health`.
- Validation evidence:
  - `git diff --check`: passed.
  - `scripts/recovery/check-vercel-function-count.sh`: passed with `Vercel function count check: 9/12`.
  - `npx -p node@20 node ./node_modules/typescript/bin/tsc -p story-generator/tsconfig.spec.json --noEmit`: passed.
  - `scripts/recovery/preflight.sh --quick --skip-status`: passed.
  - After Gemini review follow-up, the same four checks passed again.
- PR and merge evidence: Pending until this branch is pushed and reviewed.
- Remaining risks: Historical docs still mention retired routes as past context; active Vercel docs and route guards now mark them retired.

## Context and Orientation

Repository root: this checkout.

Active branch for this work: `feature/story-lab-route-budget`.

The Vercel function-count guard enumerates active route files by running:

```bash
find api -path '*/_*' -prune -o \( -name '*.ts' ! -name '*.spec.ts' ! -name '*.test.ts' -print \) | sort
```

Files under `api/_lib` are pruned and do not count as deployable functions. Keep helpers and services there.

Current function files before this plan:

- `api/export/save.ts`
- `api/health.ts`
- `api/image/generate.ts`
- `api/story-lab/evaluate.ts`
- `api/story-lab/health.ts`
- `api/story-lab/stories.ts`
- `api/story-lab/stories/[storyId]/continue.ts`
- `api/story-lab/stream/genesis.ts`
- `api/story/continue.ts`
- `api/story/generate.ts`
- `api/story/stream-demo.ts`
- `api/story/stream.ts`

Expected function files after this plan:

- `api/export/save.ts`
- `api/health.ts`
- `api/story-lab/evaluate.ts`
- `api/story-lab/stories.ts`
- `api/story-lab/stories/[storyId]/continue.ts`
- `api/story-lab/stream/genesis.ts`
- `api/story/continue.ts`
- `api/story/generate.ts`
- `api/story/stream.ts`

Do not stage or modify unrelated untracked files:

- `SPARK_TRIAL_TASKS.md`
- `STORY_QUALITY_EVALS_PLAN.md`
- `tests/grok-smoke.test.ts`

## Plan of Work

Task 1 removes the deployable route entrypoints. Task 2 adapts the debug panel and smoke route mocks to the root health endpoint. Task 3 updates the function-count guard and active docs. Task 4 runs validation and records evidence. Task 5 publishes the branch for review.

## Concrete Steps

### Task 1: Retire unused deployable route files

Files:

- Delete `api/story/stream-demo.ts`
- Delete `api/story-lab/health.ts`
- Delete `api/image/generate.ts`

Steps:

- [x] Run `rg -n "story-lab/health|/api/story-lab/health|api/story-lab/health|story/stream-demo|/api/story/stream-demo|api/story/stream-demo|image/generate|/api/image/generate|api/image/generate" .` and confirm live-code references match this plan.
- [x] Delete the three route files above.
- [x] Re-run the same `rg` command and confirm no live-code references remain except historical docs or deliberate local Express `story-generator/src/server.ts` references.

### Task 2: Redirect debug health to `/api/health`

Files:

- Modify `story-generator/src/app/debug-panel/debug-panel.ts`
- Modify `story-generator/src/app/debug-panel/debug-panel.spec.ts`
- Modify `scripts/recovery/story-lab-browser-smoke.mjs`

Steps:

- [x] In `debug-panel.ts`, change the health request path from `/api/story-lab/health` to `/api/health`.
- [x] Replace the local `HealthPayload` interface with the root health shape: `status: 'healthy'`, `timestamp`, `version`, `environment`, `services.grok`, and `cors.allowedOrigin`.
- [x] Mark the panel healthy when `response.success` is true and `response.data.status === 'healthy'`.
- [x] Use `response.data.timestamp` for the displayed timestamp.
- [x] Use a concise message such as `grok: configured` or `grok: mock`.
- [x] Add a focused spec in `debug-panel.spec.ts` using `HttpTestingController` that calls `component.checkApiHealth()`, expects a `GET` to `/api/health`, flushes a root health payload, and asserts `component.health().state === 'healthy'`.
- [x] In `scripts/recovery/story-lab-browser-smoke.mjs`, replace the mock `**/api/story-lab/health` route with `**/api/health` and return the root health payload shape.

### Task 3: Update function guard and active documentation

Files:

- Modify `scripts/recovery/check-vercel-function-count.sh`
- Modify `AGENTS.md`
- Modify `api/README.md`
- Modify `README.md` only where it presents `/api/image/generate` as an active route
- Modify `STORY_LAB_PLATFORM_EVOLUTION_EXEC_PLAN.md`
- Modify `PR70_RECOVERY_CHANGELOG.md`
- Modify `LESSONS_LEARNED.md`
- Modify this plan

Steps:

- [x] Remove the three retired route files from `EXPECTED_FUNCTIONS`.
- [x] Keep `MAX_FUNCTION_COUNT=12` so future work still has the platform budget visible.
- [x] Run `scripts/recovery/check-vercel-function-count.sh` and confirm it prints `Vercel function count check: 9/12`.
- [x] Update active route tables to remove `/api/image/generate`, `/api/story-lab/health`, and `/api/story/stream-demo`.
- [x] Add a platform-plan note that route consolidation completed and future Phase D job routes may spend the three freed slots only after re-running the guard.
- [x] Add changelog and lesson entries with exact validation evidence.

### Task 4: Validate

Run from repository root:

- [x] `git diff --check`
- [x] `scripts/recovery/check-vercel-function-count.sh`
- [x] `npx -p node@20 node ./node_modules/typescript/bin/tsc -p story-generator/tsconfig.spec.json --noEmit`
- [x] `scripts/recovery/preflight.sh --quick --skip-status`

Expected result:

- `git diff --check` exits 0.
- Function count prints `9/12`.
- Angular spec type-check exits 0.
- Quick preflight exits 0.

If any command fails, fix the branch before committing. If Angular/Karma browser execution hangs, record the exact command and environment rather than treating it as a pass.

### Task 5: Publish and review

Steps:

- [x] Run `git status --short` and ensure only intended tracked files plus the known unrelated untracked files are present.
- [x] Commit intended files on `feature/story-lab-route-budget`.
- [ ] Push the branch to `origin`.
- [ ] Open a PR with summary and validation evidence.
- [ ] Watch GitHub checks and review comments.
- [ ] Address actionable review feedback with focused commits.
- [ ] Merge only after required checks pass or skipped checks have an explicit non-code reason.

## Validation and Acceptance

Accept this work only when:

- The deployable function list is exactly the nine expected route files.
- `scripts/recovery/check-vercel-function-count.sh` prints `9/12`.
- The debug panel health check calls `/api/health` and handles the root health payload.
- Story generation routes remain untouched: `/api/story/generate`, `/api/story/stream`, `/api/story/continue`, `/api/story-lab/stories`, `/api/story-lab/stories/[storyId]/continue`, `/api/story-lab/stream/genesis`, and `/api/story-lab/evaluate`.
- Shared service code under `api/_lib` remains available.
- Active docs no longer advertise retired deployable routes as current Vercel API endpoints.

## Idempotence and Recovery

If deletion is interrupted, re-run the function-count script. It will fail if deleted files remain listed or if unexpected route files remain.

If the debug panel breaks, compare its local `HealthPayload` with `api/health.ts`. The debug panel is allowed to use a local interface because `api/health.ts` is a Vercel entrypoint, but the field names must match exactly.

If review finds a real consumer of a retired route, stop and choose one of these outcomes:

- preserve the route and consolidate a different deployable function;
- update that consumer to use an existing route;
- explicitly defer Phase D route growth until more capacity is freed.

Do not create a new route alias as a workaround in this branch.

## Artifacts and Notes

The current branch intentionally ignores these unrelated untracked files:

- `SPARK_TRIAL_TASKS.md`
- `STORY_QUALITY_EVALS_PLAN.md`
- `tests/grok-smoke.test.ts`

The route reference search before edits found live-code matches in:

- `story-generator/src/app/debug-panel/debug-panel.ts`
- `scripts/recovery/story-lab-browser-smoke.mjs`
- `scripts/recovery/check-vercel-function-count.sh`

Historical docs may still mention retired routes. Update active docs only unless a stale mention would mislead current Vercel operation.

## Interfaces and Dependencies

Root health response consumed by the debug panel:

```typescript
type HealthPayload = {
  status: 'healthy';
  timestamp: string;
  version: string;
  environment: string;
  services: {
    grok: 'configured' | 'mock';
  };
  cors: {
    allowedOrigin: string;
  };
};
```

Function-count script interface:

- Input: route files discovered under root `api/` excluding `_lib`, `.spec.ts`, and `.test.ts`.
- Output before this work: `Vercel function count check: 12/12`.
- Output after this work: `Vercel function count check: 9/12`.

No new npm packages, Vercel settings, environment variables, auth providers, storage providers, or external services are required.
