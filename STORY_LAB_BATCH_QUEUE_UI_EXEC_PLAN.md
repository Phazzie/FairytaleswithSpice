# Story Lab Batch Queue UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Story Lab's existing batch queue visible so users can see current, completed, and failed generation/continuation batches.

**Architecture:** Reuse the existing `activeBatchQueue`, `hasFinishedBatchQueueItems`, and `clearFinishedBatchQueue()` state in `app.ts`. Add a compact rendered panel in `app.html`, minimal helper formatting in `app.ts`, and focused styles in `app.css`.

**Tech Stack:** Angular signals, Angular templates, Jasmine/Karma DOM specs.

---

### Task 1: RED Specs

**Files:**
- Modify: `story-generator/src/app/app.spec.ts`

- [x] Add a rendered DOM helper for `[data-testid="batch-queue-panel"]`.
- [x] Add a failing spec proving a running genesis job renders the batch queue with label, status, and chapter count.
- [x] Add a failing spec proving completed batches can be cleared with a visible button.
- [x] Run the focused app spec and confirm the new specs fail because the panel is not rendered.

### Task 2: UI Implementation

**Files:**
- Modify: `story-generator/src/app/app.ts`
- Modify: `story-generator/src/app/app.html`
- Modify: `story-generator/src/app/app.css`

- [x] Add `trackBatch` and status-label helpers if the template needs them.
- [x] Render the batch queue panel when `activeBatchQueue().length` is nonzero.
- [x] Show each batch label, status, chapter count, and error message when present.
- [x] Show a compact clear button only when finished or failed batches exist.
- [x] Style the panel as an operational list, not a nested card.

### Task 3: Docs And Verification

**Files:**
- Modify: `PR70_RECOVERY_CHANGELOG.md`
- Modify: `STORY_LAB_PLATFORM_EVOLUTION_EXEC_PLAN.md`

- [x] Record the UI slice and validation evidence.
- [x] Run:

```bash
git diff --check
npx -p node@20 -c "node ./node_modules/typescript/bin/tsc -p story-generator/tsconfig.spec.json --noEmit"
npx -p node@20 -c "node ./node_modules/typescript/bin/tsc -p story-generator/tsconfig.app.json --noEmit"
npx -p node@20 -c "node ./node_modules/@angular/cli/bin/ng test --watch=false --browsers=ChromeHeadless --include='src/app/app.spec.ts'"
scripts/recovery/check-vercel-function-count.sh
npm run smoke:story-lab-ui
```

Expected: all commands pass; function count remains `10/12`.

Actual validation:

- RED: the focused app spec failed with 2 expected failures before implementation because the rendered batch queue panel and clear button were missing.
- `git diff --check`: passed.
- `npx -p node@20 -c "node ./node_modules/typescript/bin/tsc -p story-generator/tsconfig.spec.json --noEmit"`: passed.
- `npx -p node@20 -c "node ./node_modules/typescript/bin/tsc -p story-generator/tsconfig.app.json --noEmit"`: passed.
- `npx -p node@20 -c "node ./node_modules/@angular/cli/bin/ng test --watch=false --browsers=ChromeHeadless --include='src/app/app.spec.ts'"`: passed with `36 SUCCESS`.
- `scripts/recovery/check-vercel-function-count.sh`: passed at `10/12`.
- `npm run smoke:story-lab-ui`: passed in mock mode.
