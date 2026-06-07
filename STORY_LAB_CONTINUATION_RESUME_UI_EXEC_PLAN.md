# Story Lab Continuation Resume UI ExecPlan

Created: 2026-06-07 EDT

## Goal

Extend the existing browser-session active job recovery so in-flight Continue Saga jobs can survive a browser reload when the current story is already saved in local browser storage.

## Why This Matters

Generate already stores an active job marker and can recover progress after reload. Continue Saga now uses jobs too, but if the browser reloads while a continuation job is running, the app forgets that active continuation job. This slice closes that UI gap without pretending the backend job store is durable.

## Scope

- Store a continuation active-job marker when a continuation job is still running.
- Restore a running continuation job after reload if a saved local story is available.
- Apply a completed recovered continuation job to the restored local story.
- Clear continuation markers on malformed storage, missing local story context, completion, failure, and cancellation.
- Keep the same `non_durable_memory` warning: this is browser-session recovery only, not Vercel Workflow/database durability.

## Files

- Modify: `story-generator/src/app/app.ts`
  - Expand `ActiveStoryLabJobState.kind` from genesis-only to `genesis | continuation`.
  - Store active continuation jobs from `continueSaga()`.
  - Route `restoreActiveStoryLabJob()` by job kind.
  - Label recovered batches as `Genesis` or `Continuation`.
  - Clear continuation markers on terminal continuation states.
- Modify: `story-generator/src/app/app.spec.ts`
  - Add failing specs for storing active continuation markers.
  - Add failing specs for running and completed continuation recovery.
  - Add failing spec for clearing continuation markers when no saved story context exists.
- Modify: `STORY_LAB_PLATFORM_EVOLUTION_EXEC_PLAN.md`
  - Mark browser-session continuation recovery complete.
- Modify: `PR70_RECOVERY_CHANGELOG.md`
  - Record red/green validation and remaining durability limitation.

## Hostile Reviewer Critique

- Product risk: users may think reload recovery means durable cloud recovery. Mitigation: changelog/platform docs explicitly keep this browser-session only.
- Data risk: continuation recovery without a restored story would append chapters into an empty workbench. Mitigation: do not call the job API for continuation recovery unless a saved story and state are loaded first.
- Regression risk: generic active-job parsing could break existing genesis recovery. Mitigation: keep existing genesis specs and add continuation-specific specs.
- Scope risk: this could drift into database/Workflow storage. Mitigation: no new routes, storage providers, schemas, or external dependencies in this slice.

## Checklist

- [x] Write failing Angular specs for active continuation marker storage and recovery.
- [x] Run focused Angular spec and confirm expected failures.
- [x] Implement continuation active-job storage and kind-aware restore.
- [x] Run focused Angular spec and confirm genesis plus continuation recovery pass.
- [x] Update docs/changelog.
- [x] Run final verification.
- [ ] Commit, push, create PR, inspect checks/comments, address feedback, and merge if clean.

## Verification Commands

```bash
git diff --check
npx -p node@20 -c "node ./node_modules/typescript/bin/tsc -p story-generator/tsconfig.spec.json --noEmit"
npx -p node@20 -c "node ./node_modules/typescript/bin/tsc -p story-generator/tsconfig.app.json --noEmit"
npx -p node@20 -c "node ./node_modules/@angular/cli/bin/ng test --watch=false --browsers=ChromeHeadless --include=src/app/app.spec.ts"
npx tsx tests/story-lab-job-contracts.test.ts
npx tsx tests/story-lab-job-routes.test.ts
scripts/recovery/check-vercel-function-count.sh
```
