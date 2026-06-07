# Story Lab Villain Pressure UI ExecPlan

Created: 2026-06-07 10:24 EDT

## Purpose / Big Picture

Add the next small continuation UI control from the platform plan: a Villain Pressure Dial. Once a story exists, users should choose what kind of pressure drives the next chapter: antagonist, environment, secret, deadline, or inner desire. The selected pressure becomes part of the existing continuation job request.

This is UI-only. It does not add backend routes, storage, auth, providers, or durable workflow behavior.

## Progress

- [x] Created `feature/story-lab-villain-pressure-ui` from `main` after PR #111 merged.
- [x] Chose the smallest implementation: a selected pressure signal plus visible buttons in the existing continuation panel.
- [x] Hostile review constrained the slice to continuation-brief composition only.
- [x] Add failing Angular specs for pressure dial rendering and continuation request wiring.
- [x] Implement pressure options, selection, brief composition, template, and minimal styles.
- [ ] Update docs, run verification, commit, push PR, address comments/checks, and merge if clean.

## Surprises & Discoveries

- The existing continuation directions and Director's Room notes already create continuation briefs, so pressure should compose with those paths rather than replacing them.

## Decision Log

- Decision: Compose pressure text into continuation briefs at the UI level.
  Rationale: This keeps the feature observable and testable without adding backend scope.
- Decision: Default pressure is `secret`.
  Rationale: It fits the existing dark-romance story tone without forcing overt violence or external combat.

## Outcomes & Retrospective

- What became better for users: Continuation now has a visible pressure dial, so users can choose whether the next chapter is pushed by the antagonist, environment, a secret, a deadline, or inner desire.
- What became better technically: Pressure is composed through existing UI continuation handlers and existing continuation jobs; direct `continueSaga()` remains unchanged.
- What was intentionally deferred: AI villain planning, durable pressure history, account sync, and backend pressure contracts.
- What hostile review still objected to: The dial is a brief-shaping control, not a true villain engine.
- What validation proved: RED/GREEN app specs proved the dial renders after a story exists and selected pressure is included in both normal continuation and Director's Room continuation requests.

## Hostile Review

Critical risks:

- The dial could silently change direct low-level `continueSaga()` calls in tests or internals.
  Fix: compose pressure only through public UI handlers (`continueWithDirection`, `continueWithCustomDirection`, and `continueWithDirectorRoomNotes`), not inside `continueSaga()` itself.
- The dial could become a fake antagonist engine.
  Fix: copy says pressure, and the output is only a brief string sent to existing continuation jobs.

Important risks:

- Selected pressure could disappear from the request when users use Director's Room notes.
  Fix: tests must prove the selected pressure is included in continuation request text.
- Extra CSS could break the tight app.css budget again.
  Fix: reuse `.direction-grid` and `.prompt-chip`; add little or no CSS.

## Plan of Work

### Task 1: RED Specs

Files:

- Modify `story-generator/src/app/app.spec.ts`.

Steps:

- [x] Add a spec proving the pressure dial renders after a story exists.
- [x] Add a spec proving selecting `Deadline` and clicking `Continue Story` sends deadline pressure through `createStoryLabJob`.
- [x] Add a spec proving Director's Room accepted notes include the selected pressure when continued.
- [x] Run focused app spec and confirm the new tests fail before implementation.

### Task 2: UI Implementation

Files:

- Modify `story-generator/src/app/app.ts`.
- Modify `story-generator/src/app/app.html`.
- Modify `story-generator/src/app/app.css` only if existing classes cannot handle the dial.

Steps:

- [x] Add `VillainPressureOption` type and five options.
- [x] Add selected pressure signal and helper methods.
- [x] Compose selected pressure into UI-generated continuation briefs.
- [x] Render the dial inside the existing continuation panel.
- [x] Keep CSS minimal by reusing existing grid/chip styles.

### Task 3: Docs And Verification

Files:

- Modify `AGENTS.md`.
- Modify `PR70_RECOVERY_CHANGELOG.md`.
- Modify `STORY_LAB_PLATFORM_EVOLUTION_EXEC_PLAN.md`.
- Modify this plan.

Steps:

- [x] Link this plan from `AGENTS.md`.
- [x] Record the slice and validation evidence.
- [x] Run:

```bash
git diff --check
npx -p node@20 -c "node ./node_modules/typescript/bin/tsc -p story-generator/tsconfig.spec.json --noEmit"
npx -p node@20 -c "node ./node_modules/typescript/bin/tsc -p story-generator/tsconfig.app.json --noEmit"
npx -p node@20 -c "node ./node_modules/@angular/cli/bin/ng test --watch=false --browsers=ChromeHeadless --include='src/app/app.spec.ts'"
scripts/recovery/check-vercel-function-count.sh
npm run smoke:story-lab-ui
```

Expected: all commands pass; function count remains `10/12`; `app.css` stays under the hard production budget.

Actual validation:

- RED: focused Angular app spec failed with 3 expected pressure-dial failures before implementation because the dial and pressure text were missing.
- `git diff --check`: passed.
- `npx -p node@20 -c "node ./node_modules/typescript/bin/tsc -p story-generator/tsconfig.spec.json --noEmit"`: passed.
- `npx -p node@20 -c "node ./node_modules/typescript/bin/tsc -p story-generator/tsconfig.app.json --noEmit"`: passed.
- `npx -p node@20 -c "node ./node_modules/@angular/cli/bin/ng test --watch=false --browsers=ChromeHeadless --include='src/app/app.spec.ts'"`: passed with `43 SUCCESS`.
- `scripts/recovery/check-vercel-function-count.sh`: passed at `10/12`.
- `npm run smoke:story-lab-ui`: passed in mock mode; production build still has warning-level initial bundle and CSS budget warnings, but `app.css` remains under the 15 kB hard limit.

## Validation and Acceptance

Accepted when:

- The pressure dial appears only when continuation controls are visible.
- The selected pressure visibly changes.
- UI-generated continuation requests include the selected pressure text.
- Existing direct `continueSaga(brief)` behavior remains unchanged.
- No backend or route count changes happen.

## Idempotence and Recovery

- If tests show pressure composition duplicates text, centralize it in one helper.
- If CSS budget fails, remove custom CSS and rely on existing chip/grid classes.
- If review says the dial overpromises villain intelligence, rename text toward "pressure" and keep backend scope unchanged.

## Interfaces and Dependencies

- Existing continuation methods: `continueWithDirection`, `continueWithCustomDirection`, `continueWithDirectorRoomNotes`, and `continueSaga`.
- Existing job seam: `StoryService.createStoryLabJob({ kind: 'continuation', continuation: { continuationBrief } })`.
