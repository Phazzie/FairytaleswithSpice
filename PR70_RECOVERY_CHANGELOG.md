Created: 2026-05-26 00:12 EDT

# PR #70 Recovery Changelog

This is the chronological work log for the PR #70 recovery. It should capture commands, decisions, self-review notes, validation results, and anything that changes the plan.

## 2026-05-26 00:12 EDT - Recovery Tracking Started

Actions:

- Rewrote `AGENTS.md` as the first execution step after the user asked for it.
- Corrected the agent guidance from DigitalOcean-only to Vercel-first.
- Added an explicit pointer from `AGENTS.md` to `PR70_RECOVERY_PLAN.md`.
- Added instructions for keeping this changelog, `LESSONS_LEARNED.md`, `PR70_RECOVERY_LEDGER.md`, and `NOT_TAKEN_FEATURE_LEDGER.md` current.

Observations:

- The repo still contains conflicting architecture signals:
  - `vercel.json` and `api/_lib/*` support Vercel.
  - `.do/app.yaml`, `.do/app.yaml.buildpack`, and several docs still point at DigitalOcean.
  - Older PRs use `api/lib/*` or `story-generator/src/api/lib/*`.
- Audio is still present in some current files and many stale PRs, but the current recovery scope keeps audio deferred.

Self-review:

- The first requested action was completed before branch or merge work.
- The next required safety step is to preserve local state before creating the recovery branch.
- Current dirty state still includes lockfile changes from earlier install work and untracked recovery docs.

## 2026-05-26 00:12 EDT - Recovery Branch Created

Actions:

- Refreshed `origin` with `git fetch origin`.
- Tried to create the planned branch name `recovery/pr70-story-lab-vercel`; Git could not create the nested ref path in this checkout.
- Created the flat branch `recovery-pr70-story-lab-vercel` instead.

Decision:

- Use `recovery-pr70-story-lab-vercel` as the actual recovery branch name.
- Keep the plan's intent unchanged: this is the branch where PR #70 becomes the baseline and other open PRs are merged, ported, mined, or closed.

Open issue:

- `git stash push` for the lockfile noise returned exit code 1 without output. The lockfile changes remain uncommitted and visible.

## 2026-05-26 00:12 EDT - PR #70 Merged As Baseline

Actions:

- Merged local branch `pr-70` into `recovery-pr70-story-lab-vercel` with a real merge commit.
- Merge commit: `118265c Merge PR #70 story lab baseline`.
- Updated `PR70_RECOVERY_LEDGER.md` with the #70 disposition.

Result:

- Merge completed cleanly with no textual conflicts.
- PR #70 added the `api/story-lab/*` route family and rewrote the Angular story-lab surface.
- Dirty lockfile changes are still present and unrelated to the merge.

Self-review:

- #70 is now the branch baseline, but not yet stabilized.
- Before other PRs are merged or ported, validate build/tests and inspect whether #70's mock story-lab behavior conflicts with production story generation.

## 2026-05-26 00:49 EDT - PR #70 Stabilization Build Fixes

Problem:

- Initial `npm run build` under local Node v23.8.0 failed with `Abort trap: 6` and no build output.
- Verbose Angular build exposed real #70 source issues before the local Node abort:
  - Angular templates used object spread expressions in event bindings, which Angular template parsing does not support.
  - Angular template used an inline arrow function in a class binding.
  - `SecurityContext` was imported from `@angular/platform-browser` instead of `@angular/core`.
  - `DebugPanel` template called getter properties like signals.
  - `story-generator/src/server.ts` imported removed `api/lib/*` paths instead of current `api/_lib/*` paths.

Fixes:

- Added `updateBlueprint()` and `isThemeSelected()` methods in `story-generator/src/app/app.ts`.
- Replaced unsupported template expressions in `story-generator/src/app/app.html`.
- Fixed `SecurityContext` imports in `app.ts` and `streaming-story.component.ts`.
- Fixed `DebugPanel` template/getter usage and added a `lastChapters` getter.
- Updated SSR server imports to `api/_lib/*`.
- Typed the SSR streaming callback to match the actual `StoryService.generateStoryStreaming()` chunk shape.

Validation:

- `cd story-generator && npx tsc -p tsconfig.app.json --noEmit` passed.
- `cd story-generator && npx tsc -p tsconfig.spec.json --noEmit` passed.
- `npm run build` under local Node v23.8.0 still failed with `Abort trap: 6`.
- `npx -p node@20 -c "node -v && npm run build"` passed with Node v20.20.2.
- `npm run build:verify` passed.

Self-review:

- The source-level #70 build blockers are fixed.
- Local Node v23 is not a valid Angular verification runtime; use Node 20 for build validation.
- The branch still needs contract/path review before later story-generation PRs are ported.

## 2026-05-26 00:50 EDT - PR #86 Merged

Actions:

- Fetched PR #86 as `pr-86`.
- Merged it into `recovery-pr70-story-lab-vercel`.
- Added `design.md`.
- Normalized `letterSpacing` values in `design.md` to `0`.

Decision:

- Keep the design system as useful UI guidance.
- Do not preserve nonzero letter-spacing tokens because recovery frontend rules require letter spacing to remain 0.

Validation:

- No code validation rerun; #86 is docs-only.

Self-review:

- #86 is safe to mark merged in the ledger.
- The design doc should guide later UI ports, especially #40, #75, and #26, but should not override layout/accessibility constraints.

## 2026-05-26 00:51 EDT - PR #85 Merged

Actions:

- Fetched PR #85 as `pr-85`.
- Verified the PR's unique commit only updates `story-generator/package-lock.json`.
- Merged it into `recovery-pr70-story-lab-vercel`.

Accepted material:

- `path-to-regexp` updated to 8.4.0 in `story-generator/package-lock.json`.

Validation:

- Confirmed `story-generator/package-lock.json` now records `node_modules/path-to-regexp` version 8.4.0.
- Did not rerun build because this is lockfile-only and installed modules are not guaranteed to reflect lockfile-only dependency changes until install.

Self-review:

- #85 is safe to mark merged.
- #84 should remain deferred until the baseline dependency state is clean because it has a larger dependency blast radius.

## 2026-05-26 00:52 EDT - PR #50 Mined And Superseded

Actions:

- Inspected PR #50 commits and `PROGRESS_METER_FIX.md`.
- Searched the current #70 baseline for the affected old symbols: `progressTimeoutId`, `simulateGenerationProgress`, `generationProgress`, `generationStatus`, and `ngSkipHydration`.
- Updated `PR70_RECOVERY_LEDGER.md` and `NOT_TAKEN_FEATURE_LEDGER.md`.

Decision:

- Do not merge or cherry-pick #50 code into the #70 baseline.
- Preserve the timeout-cleanup and hydration lessons for future batch/progress work.

Reason:

- The old progress meter implementation no longer exists after #70.
- Direct merge would reintroduce stale app shell and audio-era UI code.

Self-review:

- This is the first PR where the planned "port/cherry-pick" action changed after baseline inspection.
- The plan's running-ledger approach caught the reason: useful lesson, stale implementation.
