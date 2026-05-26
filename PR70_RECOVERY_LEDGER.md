Created: 2026-05-26 00:12 EDT

# PR #70 Recovery Ledger

This ledger tracks the actual disposition of each currently open PR. It starts from the inventory in `PR70_RECOVERY_PLAN.md` and should be updated as each PR is merged, ported, cherry-picked, mined, or closed.

Status values:

- `pending`
- `merged`
- `ported`
- `cherry-picked`
- `mined and closed`
- `closed no material`
- `superseded`

## PR Status Index

| PR | Planned action | Actual status | Notes |
|---:|---|---|---|
| #86 | merge | merged | Merged design system doc; normalized nonzero letter-spacing tokens. |
| #85 | merge | merged | Merged `path-to-regexp` 8.4.0 lockfile update. |
| #84 | try merge or recreate | pending | Grouped dependency update. |
| #77 | mine and close | pending | Documentation analysis lessons. |
| #76 | close | pending | No committed material found. |
| #75 | port/cherry-pick | pending | Chapter batching and continuity panels. |
| #74 | port later or mine/close | pending | Proving grounds prompt lab. |
| #73 | recreate/port | pending | Persistent story state; avoid DigitalOcean Postgres assumption. |
| #72 | port/cherry-pick | pending | Multi-chapter backend/frontend contracts. |
| #71 | compare then close | pending | Early batch generation, mostly superseded by #72. |
| #70 | merge baseline | merged | Merged into `recovery-pr70-story-lab-vercel` as commit `118265c`; stabilization pending. |
| #67 | port/cherry-pick | pending | Audit, author-style extraction, duplicate cleanup. |
| #65 | port/cherry-pick | pending | AI model/token/story quality fixes. |
| #64 | port/cherry-pick | ported | Ported Fisher-Yates Chekhov element selection; stale tests/docs/node_modules not taken. |
| #63 | mine and close | pending | Storage/database research. |
| #56 | mine and close | pending | Backend service/cache research, DigitalOcean-shaped. |
| #55 | mine and close | pending | Voice evolution/emotion material; audio deferred. |
| #54 | close | pending | DigitalOcean deployment infra; not Vercel direction. |
| #53 | mine and close | pending | Docs cleanup intent; avoid node_modules churn. |
| #50 | port/cherry-pick | mined; close later | Old progress simulator fix is superseded by #70 story-lab UI; lessons recorded in not-taken ledger. |
| #47 | mine and close | pending | Audio pipeline research. |
| #45 | mine and close | pending | Emotion mapping and character consistency. |
| #44 | mine and close | pending | Character-driven narration material. |
| #43 | mine and close | pending | Audio player/emotion-aware voice processing. |
| #42 | mine and close | pending | Streaming audio/emotion mapping. |
| #41 | port/cherry-pick | pending | Minimal Vercel CI/API tests. |
| #40 | mine and close | pending | Visual ideas only. |
| #39 | mine and close | pending | CI concepts, not full suite. |
| #31 | recreate/port | pending | Story arc/cliffhanger; exclude audiobook. |
| #30 | mine and close | pending | Dialogue parser/speaker-tag ideas. |
| #29 | mine and close | pending | Speaker segment and voice metadata ideas. |
| #28 | mine and close | pending | Modular audio service breakdown; base not main. |
| #26 | port/cherry-pick | pending | Notifications, validation, accessibility. |
| #24 | recreate/port | pending | Trope subversion engine. |
| #22 | mine and close | pending | Early dialogue parsing/speaker tag material. |

## Disposition Template

Use this template for detailed entries as each PR is handled:

```markdown
## PR #NN - Title

- Source branch:
- Planned disposition:
- Actual disposition:
- Story-generation impact:
- Accepted material:
- Not taking now:
- Why not taking:
- Future mining value:
- Files inspected:
- Files changed in recovery branch:
- Conflicts encountered:
- Tests/checks run:
- Self-review notes:
- GitHub PR closure note:
```

## PR #70 - Rebuild story lab for multi-chapter storytelling

- Source branch: `pr-70` / `codex/revamp-story-design-system`
- Planned disposition: merge baseline
- Actual disposition: merged into `recovery-pr70-story-lab-vercel` with merge commit `118265c`
- Story-generation impact: High. Establishes the story-lab/workbench UI direction, story-lab API mocks, story-lab contracts, streaming genesis endpoint, and new frontend service/component expectations.
- Accepted material:
  - Story-lab API route family under `api/story-lab/*`.
  - Mock story-lab data and health/story/continue/genesis endpoints.
  - Major Angular story-lab UI rewrite in `story-generator/src/app/app.*`.
  - Updated frontend contracts and story service behavior for story-lab style workflows.
  - Streaming component changes aligned with story-lab semantics.
- Not taking now:
  - No separate PR #70 material has been rejected yet.
  - Stabilization may still split mock/demo endpoints from production story generation if checks show they conflict.
- Why not taking:
  - Pending stabilization review.
- Future mining value:
  - PR #70 is now baseline; later mining should compare #72/#75/#73 against this direction instead of against old `main`.
- Files inspected:
  - Merge output included `api/story-lab/*`, `story-generator/src/app/app.*`, `story-generator/src/app/contracts.ts`, `story-generator/src/app/story.service.ts`, streaming component/spec files, debug panel files, and app specs.
- Files changed in recovery branch:
  - Same as merge output from commit `118265c`.
- Conflicts encountered:
  - No textual conflicts. Merge completed with the `ort` strategy.
- Tests/checks run:
  - `cd story-generator && npx tsc -p tsconfig.app.json --noEmit` passed.
  - `cd story-generator && npx tsc -p tsconfig.spec.json --noEmit` passed.
  - `npm run build` under local Node v23.8.0 failed with `Abort trap: 6`.
  - `npx -p node@20 -c "node -v && npm run build"` passed with Node v20.20.2.
  - `npm run build:verify` passed.
- Self-review notes:
  - Immediate source-level build blockers from #70 are fixed.
  - Remaining risks are path drift, mock endpoints becoming product truth, and regression of current story-generation quality.
  - Use Node 20 for Angular build verification; local Node 23 aborts.
- GitHub PR closure note:
  - Do not close yet. Close or supersede only after the recovery branch has a final PR and #70 stabilization is documented.

## PR #86 - Add design.md: Visual identity and design system specification

- Source branch: `pr-86` / `claude/laughing-cori-CspQv`
- Planned disposition: merge
- Actual disposition: merged into `recovery-pr70-story-lab-vercel`
- Story-generation impact: Low direct impact. Provides UI/design guidance for story-lab presentation rather than generation logic.
- Accepted material:
  - `design.md` with visual identity, color tokens, typography, spacing, component guidance, and design do/don'ts.
- Not taking now:
  - Nonzero letter-spacing values from the original design token front matter were not preserved.
- Why not taking:
  - Recovery frontend guidance requires letter spacing to stay at 0 to avoid rendering and fit issues.
- Future mining value:
  - Use `design.md` when reconciling #40 visual ideas and #75/#26 UI work.
- Files inspected:
  - `design.md`
- Files changed in recovery branch:
  - `design.md`
- Conflicts encountered:
  - None.
- Tests/checks run:
  - Not rerun after docs-only merge. Previous Node 20 build passed after #70 stabilization.
- Self-review notes:
  - The design doc is useful but should not override app usability constraints or the Vercel recovery plan.
- GitHub PR closure note:
  - Can be closed as merged/superseded by the recovery branch once the final recovery PR is opened.

## PR #85 - chore(deps): bump path-to-regexp

- Source branch: `pr-85` / `dependabot/npm_and_yarn/story-generator/npm_and_yarn-7fa4943c34`
- Planned disposition: merge
- Actual disposition: merged into `recovery-pr70-story-lab-vercel`
- Story-generation impact: None direct. Security/dependency hygiene only.
- Accepted material:
  - `story-generator/package-lock.json` update from `path-to-regexp` 8.3.0 to 8.4.0.
- Not taking now:
  - No feature material omitted.
- Why not taking:
  - Not applicable.
- Future mining value:
  - None; this is a narrow dependency bump.
- Files inspected:
  - `story-generator/package-lock.json`
- Files changed in recovery branch:
  - `story-generator/package-lock.json`
- Conflicts encountered:
  - None.
- Tests/checks run:
  - Confirmed lockfile contains `node_modules/path-to-regexp` version 8.4.0.
  - Did not rerun build because this is lockfile-only and current installed `node_modules` may not reflect the lockfile until install.
- Self-review notes:
  - Safe dependency merge. Keep #84 deferred until baseline dependency state is cleaner.
- GitHub PR closure note:
  - Can be closed as merged/superseded by the recovery branch once the final recovery PR is opened.

## PR #50 - Fix progress meter hanging at 95% preventing story generation

- Source branch: `pr-50` / `copilot/fix-d1b24491-4fbc-41d5-99b4-a1277ebf809a`
- Planned disposition: port/cherry-pick
- Actual disposition: mined; do not merge old code into #70 baseline
- Story-generation impact: Indirect. The old bug blocked users from completing story generation, but the affected progress-simulator UI no longer exists in the #70 story-lab baseline.
- Accepted material:
  - Lesson: simulated progress timeout IDs must be stored immediately after each `setTimeout()` so in-flight progress can be cancelled when the real response completes.
  - Lesson: hydration bypasses like `ngSkipHydration` can break interactive form state and should not be added casually.
- Not taking now:
  - `story-generator/src/app/app.ts` progress simulator changes.
  - `story-generator/src/app/app.html` old layout/hydration changes.
  - `app-no-progress.ts.alternative`.
  - `PROGRESS_METER_FIX.md` as a root doc, because it describes the superseded UI.
- Why not taking:
  - #70 rewrote the story-lab UI and removed the old progress meter implementation.
  - Direct merge would reintroduce stale app shell/audio-era UI and conflict with the #70 baseline.
- Future mining value:
  - Use the timeout-cleanup pattern if a future generated-progress queue is added to #70 or #75-style batching.
- Files inspected:
  - `PROGRESS_METER_FIX.md`
  - `story-generator/src/app/app.ts`
  - `story-generator/src/app/app.html`
- Files changed in recovery branch:
  - None.
- Conflicts encountered:
  - Not attempted as a merge/cherry-pick because the branch diff is dominated by stale app/backend/audio-era structure.
- Tests/checks run:
  - Searched current #70 baseline for `progressTimeoutId`, `simulateGenerationProgress`, `generationProgress`, `generationStatus`, and `ngSkipHydration`; none of the old affected implementation exists.
- Self-review notes:
  - Correct action is to preserve the lesson, not the stale code.
- GitHub PR closure note:
  - Close as superseded after recovery branch/final PR exists, pointing to this ledger and `NOT_TAKEN_FEATURE_LEDGER.md`.

## PR #64 - Complete PR#61: Fix remaining biased randomization, update documentation, and fix all tests

- Source branch: `pr-64` / `copilot/finish-fixing-pr-61-issues`
- Planned disposition: port/cherry-pick
- Actual disposition: ported selected correctness fix
- Story-generation impact: Medium. Fixes biased Chekhov element selection in the story-generation prompt.
- Accepted material:
  - Replaced `elements.sort(() => 0.5 - Math.random())` with Fisher-Yates selection in `api/_lib/services/storyService.ts`.
  - Applied the same fix to `story-generator/src/api/lib/services/storyService.ts` because it is still included by the Angular tsconfig and should not retain known-bad prompt logic while duplicate cleanup remains pending.
- Not taking now:
  - Broad stale branch changes that rename `api/_lib` back to `api/lib`.
  - Playwright scaffold and E2E docs from the old branch.
  - Angular spec rewrites targeting the pre-#70 UI.
  - `node_modules` and package churn.
  - Documentation deletions from the stale branch base.
- Why not taking:
  - Direct merge would undo current Vercel `_lib` path decisions and reintroduce stale audio/backend/dependency artifacts.
  - #70 changed the app shell, so old UI specs are not trustworthy as-is.
- Future mining value:
  - E2E smoke-test ideas may be useful later after the #70 story-lab UI stabilizes.
- Files inspected:
  - `api/lib/services/storyService.ts` from PR #64
  - `story-generator/src/api/lib/services/storyService.ts` from PR #64
  - PR #64 file stats
- Files changed in recovery branch:
  - `api/_lib/services/storyService.ts`
  - `story-generator/src/api/lib/services/storyService.ts`
- Conflicts encountered:
  - Not merged directly due stale branch blast radius.
- Tests/checks run:
  - `rg` confirmed no remaining `sort(() => 0.5 - Math.random())` in the two story service copies.
  - `cd story-generator && npx tsc -p tsconfig.app.json --noEmit` passed.
- Self-review notes:
  - The duplicate `story-generator/src/api/lib/services/storyService.ts` still needs a later cleanup decision, likely from #67, but retaining a biased randomization bug there would be worse while it is compiled.
- GitHub PR closure note:
  - Close as ported/superseded after final recovery PR exists, pointing to this ledger and `NOT_TAKEN_FEATURE_LEDGER.md`.
