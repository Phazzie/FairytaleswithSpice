# Story Lab Continuation Job UI ExecPlan

Created: 2026-06-07 EDT

## Goal

Move the visible Story Lab Continue Saga UI from the legacy direct continuation request to the Story Lab job route, matching the already-merged genesis job UI behavior.

## Why This Matters

Generate now behaves like a job-backed product flow. Continue Saga still behaves like an older one-shot request. That split makes progress handling inconsistent and keeps the second main writing action outside the job seam needed for future durable Workflow/database-backed generation.

After this slice:

- Continue Saga creates a `kind: 'continuation'` Story Lab job.
- The UI updates progress from continuation job snapshots/events.
- Completed continuation jobs append chapters to the current story.
- Failed or cancelled continuation jobs fail the active batch cleanly without losing existing chapters.
- Tests prove the UI no longer calls the direct continuation endpoint for user-facing continuation.

## Files

- Modify: `story-generator/src/app/app.ts`
  - Replace direct `continueStory()` usage in `continueSaga()` with `createStoryLabJob({ kind: 'continuation', continuation: request })`.
  - Add continuation job snapshot/event handling.
  - Keep browser-session active job restore limited to genesis for this slice.
- Modify: `story-generator/src/app/app.spec.ts`
  - Change continuation UI specs to require job creation.
  - Add a running-job progress/event test.
  - Add a failed continuation job test.
- Modify: `scripts/recovery/story-lab-browser-smoke.mjs`
  - Make mocked smoke reject legacy continuation route usage.
  - Let continuation flow use `/api/story-lab/jobs` with `kind: 'continuation'`.
- Modify: `STORY_LAB_PLATFORM_EVOLUTION_EXEC_PLAN.md`
  - Mark continuation visible UI migration progress.
- Modify: `PR70_RECOVERY_CHANGELOG.md`
  - Record branch actions and verification.

## Hostile Reviewer Critique

- Product risk: if Continue only changes internally, the user still cannot tell anything improved. Mitigation: wire continuation job status into the existing visible progress/status text and smoke-check progress.
- Architecture risk: storing continuation jobs in browser session could imply durability the app does not have. Mitigation: do not add continuation reload recovery in this slice; keep that as a later explicit durable-state gate.
- Testing risk: only checking a happy path could allow the old direct continuation endpoint to remain active. Mitigation: unit specs assert `continueStory` is not called, and smoke mocks return an error if legacy continuation route is used.
- Scope risk: broad refactor of genesis helpers could regress already-merged Generate behavior. Mitigation: use the smallest shared helper or continuation-specific helper needed, then run existing genesis specs too.

## Checklist

- [x] Write failing Angular specs proving Continue Saga should create a continuation job instead of calling `continueStory`.
- [x] Run targeted Angular spec and confirm the new tests fail for the expected reason.
- [x] Implement the minimal UI changes in `app.ts`.
- [x] Run targeted Angular spec and confirm genesis plus continuation UI specs pass.
- [x] Update mocked browser smoke so legacy continuation route fails.
- [x] Run job contract/route checks and browser smoke.
- [x] Update platform/changelog docs.
- [x] Run final verification.
- [ ] Commit, push, create PR, inspect checks/comments, address actionable feedback, and merge if clean.

## Verification Commands

```bash
git diff --check
npx -p node@20 -c "node ./node_modules/typescript/bin/tsc -p story-generator/tsconfig.spec.json --noEmit"
npx -p node@20 -c "node ./node_modules/typescript/bin/tsc -p story-generator/tsconfig.app.json --noEmit"
npx -p node@20 -c "node ./node_modules/@angular/cli/bin/ng test --watch=false --browsers=ChromeHeadless --include=src/app/app.spec.ts"
npx tsx tests/story-lab-job-contracts.test.ts
npx tsx tests/story-lab-job-routes.test.ts
scripts/recovery/check-vercel-function-count.sh
npm run smoke:story-lab-ui
```
