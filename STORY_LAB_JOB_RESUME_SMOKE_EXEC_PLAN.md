# Story Lab Job Resume Smoke Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Story Lab genesis job UI recover visible job progress after a browser reload and prove the mocked browser smoke uses the job route flow.

**Architecture:** Keep the slice small and honest: persist only the active anonymous job handle in browser storage, recover it with `getStoryLabJob()`, and reopen the SSE stream only when the recovered job is not terminal. This is reload-safe inside the current non-durable memory scaffold, not durable across Vercel cold starts or account boundaries.

**Tech Stack:** Angular 20 signals and RxJS in `story-generator/src/app/app.ts`, existing Story Lab job contracts/service methods, Playwright smoke script in `scripts/recovery/story-lab-browser-smoke.mjs`, TypeScript/Karma focused specs, `tsx` backend route tests, and the Vercel function-count guard.

---

## Scope

This slice does:

- Persist the active genesis job id, submitted batch id, and batch size in browser storage while a genesis job is running.
- Restore visible job progress after reload by calling `getStoryLabJob(jobId)`.
- Resume event streaming for non-terminal recovered jobs.
- Clear the active job marker when the job completes, fails, or is cancelled.
- Convert the mocked browser smoke genesis path from `/api/story-lab/stories` to `/api/story-lab/jobs` plus `/events`.

This slice does not:

- Add database-backed jobs.
- Add account ownership.
- Make jobs survive Vercel cold starts.
- Migrate continuation to jobs.
- Remove the old direct generation route.

## Files

- Modify `story-generator/src/app/app.ts`
  - Add a small `ActiveStoryLabJobState` type.
  - Store/recover active genesis job state with `sessionStorage`.
  - Use `getStoryLabJob()` on startup when an active job marker exists.
  - Reuse existing job snapshot handling for recovered jobs.
- Modify `story-generator/src/app/app.html`
  - Add a compact recovered-job cue inside the existing progress panel if needed.
- Modify `story-generator/src/app/app.spec.ts`
  - Add failing specs for active job persistence, recovery after reload, non-terminal stream resume, terminal cleanup, and malformed storage cleanup.
- Modify `scripts/recovery/story-lab-browser-smoke.mjs`
  - Mock `POST /api/story-lab/jobs`.
  - Mock `GET /api/story-lab/jobs/:jobId`.
  - Mock `GET /api/story-lab/jobs/:jobId/events` with queued, running, completed snapshots.
  - Assert the visible progress text sees a running job state before the story panel appears.
- Modify `STORY_LAB_PLATFORM_EVOLUTION_EXEC_PLAN.md`
  - Mark reload-safe job resume and smoke coverage complete only if tests/smoke prove them.
- Modify `PR70_RECOVERY_CHANGELOG.md`
  - Record actions, validation, and remaining non-durable limitations.

## Hostile Review Before Implementation

- Objection: "Session storage is not durable job storage."
  - Response: Correct. This only restores the anonymous browser's active job handle after a page reload. The plan must keep durable Workflow/database/account storage pending.
- Objection: "Reloading a Vercel preview may lose the in-memory job."
  - Response: Correct. The UI should handle `404`/missing job by clearing the active marker and showing a friendly message. It must not pretend cold-start survival.
- Objection: "The smoke could pass without proving job routes."
  - Response: The smoke must fail if the app calls `/api/story-lab/stories` for genesis in mock mode. It should fulfill only job creation/status/events for genesis.
- Objection: "Adding a second progress UI creates design churn."
  - Response: Reuse the existing progress panel and status message. Do not redesign the UI in this slice.
- Objection: "Continuation still uses direct calls."
  - Response: Keep continuation out of scope. The previous slice migrated genesis only; this one makes genesis reload-safe enough to smoke.

## Task 1: Active Job State Tests

**Files:**
- Modify `story-generator/src/app/app.spec.ts`

- [ ] Write a failing spec that starts a running genesis job and expects `sessionStorage` to contain an active job marker with `jobId`, `kind: 'genesis'`, and `batchSize`.
- [ ] Write a failing spec that creates a new component with the stored marker, stubs `getStoryLabJob()` to return a running job, and expects progress to resume from that snapshot.
- [ ] Write a failing spec that recovers a completed job and expects the story workbench to hydrate and the active job marker to be cleared.
- [ ] Write a failing spec that stores malformed JSON and expects startup to clear the marker without throwing.

Run:

```bash
npx -p node@20 -c "node ./node_modules/@angular/cli/bin/ng test --watch=false --browsers=ChromeHeadless --include=src/app/app.spec.ts"
```

Expected before implementation: targeted failures around missing active-job storage/recovery behavior.

## Task 2: Active Job State Implementation

**Files:**
- Modify `story-generator/src/app/app.ts`

- [ ] Add a private storage key, for example `fairytales_story_lab_active_job_v1`.
- [ ] Add `ActiveStoryLabJobState` with `jobId`, `kind`, `batchId`, `batchSize`, `startedAt`, and `statusPath`.
- [ ] Persist the marker immediately after `createStoryLabJob()` returns a non-terminal genesis job.
- [ ] Clear the marker on completed, failed, cancelled, malformed storage, unknown job, and reset workbench.
- [ ] Call `restoreActiveStoryLabJob()` from the constructor after saved-project restore.
- [ ] On restore, call `getStoryLabJob<StoryIterationPayload>(jobId)`, update progress from the returned snapshot, and reopen event streaming when the job is still running/queued.

Run:

```bash
npx -p node@20 -c "node ./node_modules/typescript/bin/tsc -p story-generator/tsconfig.spec.json --noEmit"
npx -p node@20 -c "node ./node_modules/@angular/cli/bin/ng test --watch=false --browsers=ChromeHeadless --include=src/app/app.spec.ts"
```

Expected after implementation: compile exits 0 and targeted app specs pass.

## Task 3: Browser Smoke Job Mocks

**Files:**
- Modify `scripts/recovery/story-lab-browser-smoke.mjs`

- [ ] Remove the mock-mode genesis fulfillment for `POST /api/story-lab/stories`.
- [ ] Add `POST /api/story-lab/jobs` mock that validates `kind === 'genesis'`, creates one job id, and returns a running job response.
- [ ] Add `GET /api/story-lab/jobs/:jobId/events` mock that sends queued, running, and completed SSE snapshots.
- [ ] Add `GET /api/story-lab/jobs/:jobId` mock that returns the latest stored snapshot.
- [ ] Assert visible progress contains a running job phrase such as `Grok is writing your first chapter` before waiting for the story panel.
- [ ] Keep continuation mocked through `/stories/:id/continue` for this slice.

Run:

```bash
STORY_LAB_SMOKE_SKIP_BUILD=1 npm run smoke:story-lab-ui
```

Expected after implementation: mock smoke passes and would fail if genesis tries the old `/api/story-lab/stories` route.

## Task 4: Docs and Final Verification

**Files:**
- Modify `STORY_LAB_PLATFORM_EVOLUTION_EXEC_PLAN.md`
- Modify `PR70_RECOVERY_CHANGELOG.md`

- [ ] Update Phase D file checklist and acceptance only after tests and smoke pass.
- [ ] Record the non-durable limitation in the changelog.
- [ ] Run final verification:

```bash
git diff --check
npx -p node@20 -c "node ./node_modules/typescript/bin/tsc -p story-generator/tsconfig.spec.json --noEmit"
npx -p node@20 -c "node ./node_modules/typescript/bin/tsc -p story-generator/tsconfig.app.json --noEmit"
npx -p node@20 -c "node ./node_modules/@angular/cli/bin/ng test --watch=false --browsers=ChromeHeadless --include=src/app/app.spec.ts"
npx tsx tests/story-lab-job-contracts.test.ts
npx tsx tests/story-lab-job-routes.test.ts
scripts/recovery/check-vercel-function-count.sh
npx -p node@20 -c "npm run build"
STORY_LAB_SMOKE_SKIP_BUILD=1 npm run smoke:story-lab-ui
```

Expected: all commands exit 0. Angular budget warnings are acceptable only if they remain warnings, not errors.

## Stop Conditions

- Stop and fix if the app can call the old direct genesis route in mock smoke.
- Stop and fix if recovered terminal jobs can duplicate chapters.
- Stop and fix if malformed storage crashes app construction.
- Stop and fix if job ids, blueprint loglines, or private story text are written into URLs.
- Stop and fix if the function-count guard rises above `10/12` for this no-route slice.

## Self-Critique After Plan

- Spec coverage: The plan covers reload-safe active-job marker, recovery, event-stream resume, terminal cleanup, browser smoke proof, docs, and verification. Durable storage, auth, and continuation jobs are intentionally excluded.
- Placeholder scan: No task uses TBD/TODO/fill-in language. Every task has files, specific behavior, and commands.
- Type consistency: The planned active job state uses existing `StoryLabJob`/`StoryIterationPayload`/`ChapterBatchSize` concepts already present in `app.ts`.
- Risk: The smoke SSE mock must be written carefully because Playwright route fulfillment needs a valid `text/event-stream` body. If one-shot SSE replay is flaky in the browser, fall back to status polling in the smoke only after proving the UI still opens the job events path.
