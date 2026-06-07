# Story Lab Job Status UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a compact visible Story Lab job status banner so generation, continuation, and reload recovery jobs are understandable while they run.

**Architecture:** Keep the work in the Angular Story Lab component. Add a small signal-backed view model in `app.ts`, render it near the existing progress bar in `app.html`, and style it with the current Story Lab panel language in `app.css`.

**Tech Stack:** Angular signals, Angular template bindings, Jasmine/Karma component specs, existing StoryService job APIs.

---

### Task 1: Failing UI Specs

**Files:**
- Modify: `story-generator/src/app/app.spec.ts`

- [x] Add `ComponentFixture<App>` to the Angular testing imports and keep the fixture from `TestBed.createComponent(App)` in `beforeEach`.
- [x] Add a helper that reads `[data-testid="job-status-panel"]` from the rendered fixture.
- [x] Add a failing spec proving a running genesis job renders a visible job banner with the job label, progress percent, and short job id.
- [x] Add a failing spec proving a recovered continuation job renders a visible recovered banner after reload.
- [x] Add a failing spec proving the banner is hidden when a recovered continuation job cannot be restored because the saved story context is missing.
- [x] Run:

```bash
npx -p node@20 -c "node ./node_modules/@angular/cli/bin/ng test --watch=false --browsers=ChromeHeadless --include='src/app/app.spec.ts'"
```

Result: failed with 2 expected banner failures because `[data-testid="job-status-panel"]` did not exist yet.

### Task 2: Job Status View Model

**Files:**
- Modify: `story-generator/src/app/app.ts`

- [x] Add a `JobStatusPanelState` type.
- [x] Add a `jobStatusPanel` signal initialized to hidden.
- [x] Add helpers to show starting, running, and recovering job state.
- [x] Update genesis and continuation job creation to show the starting/running banner.
- [x] Update reload recovery to show the recovered banner before reading the job snapshot.
- [x] Clear the banner when a job completes, fails, is cancelled, or recovery is abandoned.
- [x] Run the focused app spec command and confirm the new tests pass.

### Task 3: Template And Styling

**Files:**
- Modify: `story-generator/src/app/app.html`
- Modify: `story-generator/src/app/app.css`

- [x] Render a `job-status-panel` section next to the existing progress UI when `jobStatusPanel().visible` is true.
- [x] Include label, title, stage, progress percent, and job id without exposing long unwieldy IDs.
- [x] Style the banner as a compact operational status block using existing Story Lab colors, 8px radius, responsive wrapping, and no nested cards.
- [x] Run the focused app spec command again.

### Task 4: Documentation And Verification

**Files:**
- Modify: `PR70_RECOVERY_CHANGELOG.md`
- Modify: `STORY_LAB_PLATFORM_EVOLUTION_EXEC_PLAN.md`

- [x] Add a changelog note summarizing the job status banner and recovery UX.
- [x] Update the platform plan acceptance checklist to include visible job/recovery status.
- [x] Run:

```bash
git diff --check
npx -p node@20 -c "node ./node_modules/typescript/bin/tsc -p story-generator/tsconfig.spec.json --noEmit"
npx -p node@20 -c "node ./node_modules/typescript/bin/tsc -p story-generator/tsconfig.app.json --noEmit"
npx -p node@20 -c "node ./node_modules/@angular/cli/bin/ng test --watch=false --browsers=ChromeHeadless --include='src/app/app.spec.ts'"
scripts/recovery/check-vercel-function-count.sh
npm run smoke:story-lab-ui
```

Result: all commands passed; function count stayed at `10/12`. The smoke build reported the existing Angular budget warnings.

### Task 5: PR

**Files:**
- All modified files above

- [ ] Commit with `--no-verify` only after the verification commands pass, because local hooks still point at the stale removed path.
- [ ] Push the branch and open a PR.
- [ ] Inspect automated comments and checks.
- [ ] Address actionable review feedback with follow-up commits.
- [ ] Merge only after required checks are green and actionable review comments are handled.
