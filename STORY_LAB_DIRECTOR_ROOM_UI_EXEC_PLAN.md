# Story Lab Director's Room UI ExecPlan

Created: 2026-06-07 10:13 EDT

## Purpose / Big Picture

Add the first visible "Director's Room" slice to Story Lab: after a story chapter exists, the reader panel should show a compact craft-notes panel with practical next-chapter guidance. Users can accept a note, dismiss a note, or move a note into the custom continuation brief. Accepted notes can be sent through the existing continuation job flow.

This is intentionally a UI-first slice. It does not add a new AI reviewer, backend route, durable workflow, account storage, or server-side revision pipeline. The panel uses deterministic local notes derived from the selected chapter, current story state, Heat Contract, and blueprint.

## Progress

- [x] Started fresh branch `feature/story-lab-director-room-ui` from `main` after PR #110 merged.
- [x] Read `AGENTS.md`, `.agent/PLANS.md`, active Story Lab platform plan, current Angular component/template/styles/specs, and relevant contracts.
- [x] Selected the recommended design: a compact local Director's Room panel that feeds accepted notes into existing continuation jobs.
- [x] Ran hostile review before implementation and constrained the scope.
- [x] Add failing Angular DOM specs for visible Director's Room behavior.
- [x] Implement local Director's Room note model, actions, template, and styles.
- [x] Update recovery/platform docs with evidence.
- [ ] Run verification, commit, push PR, address comments/checks, and merge if clean.

## Surprises & Discoveries

- The current app already has the right seams: selected chapter, story state, Heat Contract, custom continuation brief, and job-backed continuation.
- The safest first version is not a "rewrite this chapter" backend flow. It should improve the next continuation request until durable jobs and AI review passes exist.
- The platform plan already names Director's Room as "a compact improvement panel," so this slice should avoid dashboard-style process theater.
- The first smoke run failed production build because `app.css` exceeded the 15 kB hard budget by 937 bytes. Reusing the existing batch queue list/grid styles brought component CSS back under the hard budget at 14.95 kB.

## Decision Log

- Decision: Use deterministic local notes in this branch.
  Rationale: It gives users visible craft guidance now without pretending we added an AI critique service or durable workflow.
- Decision: Keep notes scoped to the selected chapter.
  Rationale: Users need the panel to respond to what they are reading, not generic app state.
- Decision: Accepted notes become continuation instructions.
  Rationale: The existing continuation job path is already tested and user-facing; this branch should reuse it instead of adding new routes.
- Decision: Dismissed notes remain visible as dismissed rather than disappearing.
  Rationale: This avoids confusing layout jumps and lets tests prove the user's choice.

## Outcomes & Retrospective

- What became better for users: Story Lab now shows a compact Director's Room panel after a chapter exists, with three practical craft notes that can shape the next continuation.
- What became better technically: The panel is a deterministic Angular UI layer over existing selected chapter, continuity, Heat Contract, and continuation-job state. It adds no backend route or storage claim.
- What was intentionally deferred: AI-backed critique, true chapter rewrite jobs, durable accepted-note persistence, and account/cloud sync.
- What hostile review still objected to: The panel is not an AI editor yet; copy and behavior must continue to frame it as local next-chapter guidance.
- What validation proved: RED/GREEN focused Angular app specs proved the panel is hidden before a chapter exists, renders three notes for a selected chapter, supports accepted/dismissed/brief behavior, and sends accepted notes through the existing continuation job flow. Mocked browser smoke passed after trimming CSS under the production budget.

## Context and Orientation

Repository root: `/Users/hbpheonix/fairytaleswithspice`.

Current branch: `feature/story-lab-director-room-ui`.

Primary files:

- `story-generator/src/app/app.ts`: Angular Story Lab component state/actions. Add the note model, computed notes, accept/dismiss/rewrite actions, and continuation dispatch helper here.
- `story-generator/src/app/app.html`: render the panel below the selected chapter and above existing continuation controls.
- `story-generator/src/app/app.css`: style the panel as a compact tool surface, not nested cards.
- `story-generator/src/app/app.spec.ts`: add focused DOM specs and continuation request assertions.
- `PR70_RECOVERY_CHANGELOG.md`: record work and validation.
- `STORY_LAB_PLATFORM_EVOLUTION_EXEC_PLAN.md`: mark the Director's Room UI slice as started/completed.

Existing unrelated untracked files must stay untouched:

- `SPARK_TRIAL_TASKS.md`
- `STORY_QUALITY_EVALS_PLAN.md`
- `tests/grok-smoke.test.ts`

## Hostile Review

Critical risks before implementation:

- The UI could imply an AI editor is reviewing prose when it is only local deterministic guidance.
  Fix: copy and method names must call them "notes" and "next chapter" guidance, not AI review.
- The branch could accidentally add a new backend route or workflow claim.
  Fix: touch only Angular UI/specs and recovery docs.
- Accepted notes could bypass the already-tested job path.
  Fix: tests must assert `createStoryLabJob({ kind: 'continuation', ... })` receives the accepted note text.

Important risks:

- The panel could show before a story exists and clutter the initial creation flow.
  Fix: render only when `selectedChapter()` exists.
- Rejected notes could disappear and create layout jumps.
  Fix: keep notes visible with a dismissed status.
- Long note text could overflow the reader panel on mobile.
  Fix: use compact text, wrapping, and existing mobile column behavior.

Minor polish that should not block:

- Future AI-backed critique, chapter rewrite jobs, and accept/reject persistence belong after durable jobs/storage.

## Plan of Work

### Task 1: RED Specs

Files:

- Modify `story-generator/src/app/app.spec.ts`.

Steps:

- [x] Add DOM helpers for `[data-testid="director-room-panel"]` and rendered text.
- [x] Add a spec proving the panel is hidden before a chapter exists.
- [x] Add a spec proving a seeded story renders three craft note names: `Desire Ledger`, `Continuity Keeper`, and `Chapter Ending`.
- [x] Add a spec proving accepting Director's Room notes and clicking `Continue with notes` sends the accepted note text through the existing continuation job request.
- [x] Run the focused Angular spec and confirm the new tests fail because the panel/actions do not exist yet.

### Task 2: UI Implementation

Files:

- Modify `story-generator/src/app/app.ts`.
- Modify `story-generator/src/app/app.html`.
- Modify `story-generator/src/app/app.css`.

Steps:

- [x] Add `DirectorRoomNote`, note status, and note id types local to `app.ts`.
- [x] Add a `directorRoomDecisions` signal keyed by selected chapter and note id.
- [x] Add a `directorRoomNotes` computed value that returns three notes when a chapter exists:
  - `Desire Ledger`: focus the next chapter on the protagonist's want or current goal.
  - `Continuity Keeper`: carry forward an active thread, artifact, warning, or chapter summary.
  - `Chapter Ending`: request a sharper ending bet based on cliffhanger state.
- [x] Add public actions:
  - `acceptDirectorRoomNote(note)`
  - `dismissDirectorRoomNote(note)`
  - `useDirectorRoomNoteAsBrief(note)`
  - `continueWithDirectorRoomNotes()`
  - `trackDirectorRoomNote(...)`
- [x] Render the panel under the selected chapter, above existing continuation controls.
- [x] Use existing `continueSaga()` to dispatch accepted notes; do not add service methods.
- [x] Style note rows and controls so they wrap on mobile and do not create nested card UI.

### Task 3: Docs And Verification

Files:

- Modify `PR70_RECOVERY_CHANGELOG.md`.
- Modify `STORY_LAB_PLATFORM_EVOLUTION_EXEC_PLAN.md`.
- Modify this plan.

Steps:

- [x] Mark checklist items complete as they pass.
- [x] Record validation evidence in the changelog and platform plan.
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

- RED: focused Angular app spec failed with 3 expected failures before implementation because the Director's Room panel/actions were missing.
- `git diff --check`: passed.
- `npx -p node@20 -c "node ./node_modules/typescript/bin/tsc -p story-generator/tsconfig.spec.json --noEmit"`: passed.
- `npx -p node@20 -c "node ./node_modules/typescript/bin/tsc -p story-generator/tsconfig.app.json --noEmit"`: passed.
- `npx -p node@20 -c "node ./node_modules/@angular/cli/bin/ng test --watch=false --browsers=ChromeHeadless --include='src/app/app.spec.ts'"`: passed with `40 SUCCESS`.
- `scripts/recovery/check-vercel-function-count.sh`: passed at `10/12`.
- `npm run smoke:story-lab-ui`: initially failed because `app.css` exceeded the 15 kB hard budget, then passed in mock mode after CSS was trimmed under the budget.

## Validation and Acceptance

Accepted when:

- The Director's Room panel does not render before a chapter exists.
- The panel renders three deterministic notes for an existing selected chapter.
- Users can accept, dismiss, and use a note as the custom continuation brief.
- `Continue with notes` calls the existing continuation job flow and sends accepted note text in `continuationBrief`.
- No backend route, Vercel function, storage adapter, auth behavior, or durable workflow is changed.

## Idempotence and Recovery

- If tests fail because the seeded story lacks state details, adjust the test fixture data rather than loosening user-visible assertions.
- If the panel text becomes too specific and brittle, assert stable headings and continuation request content rather than full copy.
- If `npm run smoke:story-lab-ui` fails because selectors changed, preserve existing `data-testid` hooks and update only the new panel selectors.
- If review flags this as fake AI review, rename/copy-edit to "Director's notes" and keep the backend scope unchanged.

## Artifacts and Notes

- PR #110 merged immediately before this branch and added the visible batch queue.
- This branch is the next UI-only step from the platform plan's Director's Room concept.

## Interfaces and Dependencies

- Existing continuation dependency: `continueSaga(brief?: string)` creates a `StoryLabJob` with `kind: 'continuation'`.
- Existing story state dependency: `selectedChapter()`, `continuityPanel()`, `activeHeatContract()`, and `blueprint()` are enough for deterministic notes.
- No new package, external API, route, or environment variable is needed.
