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
| #75 | port/cherry-pick | ported | Ported batch queue, suggested prompts, grouped chapter timeline, and Vercel persistence wording into #70 story lab. |
| #74 | port later or mine/close | pending | Proving grounds prompt lab. |
| #73 | recreate/port | ported | Ported story-lab state deltas and transient persistence boundary; DigitalOcean Postgres and `pg` dependency not taken. |
| #72 | port/cherry-pick | ported | Ported backward-compatible 1-3 chapter batch generation/continuation into canonical `api/_lib`; old UI/route rewrites not taken. |
| #71 | compare then close | pending | Early batch generation, mostly superseded by #72. |
| #70 | merge baseline | merged | Merged into `recovery-pr70-story-lab-vercel` as commit `118265c`; stabilization pending. |
| #67 | port/cherry-pick | ported | Ported author-style extraction, duplicate-service deletion, path/test fixes, and validation bug fix. |
| #65 | port/cherry-pick | ported | Verified canonical AI fixes; aligned duplicate compiled service timeouts and test path. |
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
| #31 | recreate/port | ported | Ported cliffhanger analysis/prompt guidance; story-arc CRUD and audiobook compile mined for later. |
| #30 | mine and close | pending | Dialogue parser/speaker-tag ideas. |
| #29 | mine and close | pending | Speaker segment and voice metadata ideas. |
| #28 | mine and close | pending | Modular audio service breakdown; base not main. |
| #26 | port/cherry-pick | pending | Notifications, validation, accessibility. |
| #24 | recreate/port | ported | Ported invisible trope subversion engine into canonical `api/_lib`; old backend/dist/demo files not taken. |
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

## PR #65 - Fix AI story generation: model name, token allocation, and API parameters

- Source branch: `pr-65` / `copilot/fix-5ac64344-68ed-4394-9706-a5dd2d4b168c`
- Planned disposition: port/cherry-pick
- Actual disposition: ported selected verification/path and timeout alignment
- Story-generation impact: High. Confirms the current story service uses the intended Grok model, dynamic token calculation, supported API parameters, and longer story/continuation timeouts.
- Accepted material:
  - Re-pointed `tests/verify-ai-fixes.test.ts` from stale `api/lib/services/storyService` to the current Vercel `api/_lib/services/storyService`.
  - Kept and verified `grok-4-1-fast-reasoning`, `calculateOptimalTokens()`, `top_p: 0.95`, and no unsupported `repetition_penalty` in both story service copies.
  - Aligned the compiled duplicate `story-generator/src/api/lib/services/storyService.ts` timeouts with the canonical service: 90 seconds for generation and 60 seconds for continuations.
- Not taking now:
  - Direct branch merge/cherry-pick from #65.
  - Any stale `api/lib/*` path layout.
  - Any duplicate-service structure as an endorsed long-term architecture.
- Why not taking:
  - The canonical `api/_lib/services/storyService.ts` already contained most of #65's AI improvements after #70 stabilization.
  - Direct merge risks path drift back to `api/lib`.
  - Duplicate service cleanup belongs in the #67 audit phase, but the duplicate should not keep lower timeouts while it still compiles.
- Future mining value:
  - Preserve `tests/verify-ai-fixes.test.ts` as a fast regression check for model/token/API timeout behavior.
  - Use #65 as evidence that model configuration should become centralized, not duplicated.
- Files inspected:
  - `api/_lib/services/storyService.ts`
  - `story-generator/src/api/lib/services/storyService.ts`
  - `tests/verify-ai-fixes.test.ts`
- Files changed in recovery branch:
  - `story-generator/src/api/lib/services/storyService.ts`
  - `tests/verify-ai-fixes.test.ts`
- Conflicts encountered:
  - No merge attempted; branch material was selectively ported because of stale path shape.
- Tests/checks run:
  - `npx tsx tests/verify-ai-fixes.test.ts` passed under escalated execution. Missing `XAI_API_KEY` warnings were expected because the verifier reads service modules without making real API calls.
  - `cd story-generator && npx tsc -p tsconfig.app.json --noEmit` passed.
- Self-review notes:
  - This reinforces the #67 priority: remove or quarantine duplicate story services after the audit so model/timeouts/randomization cannot drift again.
- GitHub PR closure note:
  - Close as ported/superseded after final recovery PR exists, pointing to this ledger and `NOT_TAKEN_FEATURE_LEDGER.md`.

## PR #67 - Comprehensive SOLID/KISS/DRY Audit: Fix deployment blockers and eliminate duplicate code

- Source branch: `pr-67` / `copilot/perform-code-audit-and-fixes`
- Planned disposition: port/cherry-pick
- Actual disposition: ported selected refactor/test material; do not merge directly
- Story-generation impact: High. Removes compiled duplicate story service drift, centralizes author-style configuration, fixes stale story-test imports, and adds missing validation for spicy level/word count inputs.
- Accepted material:
  - Added `api/_lib/config/authorStyles.ts`, adapted from #67's `api/lib/config/authorStyles.ts`.
  - Removed the large inline author-style tables from `api/_lib/services/storyService.ts`.
  - Deleted the stale compiled duplicate `story-generator/src/api/lib/*` service/type files.
  - Updated `tests/story-service-improved.test.ts` and `tests/verify-ai-fixes.test.ts` away from stale duplicate paths.
  - Fixed `tests/story-service-improved.test.ts` so failed tests are counted with `!r.passed`.
  - Fixed `StoryService.validateStoryInput()` to reject invalid spicy levels and invalid word counts before mock/live generation.
- Not taking now:
  - `DEPLOYMENT_READINESS.md` from #67 because it is DigitalOcean-specific.
  - `COMPREHENSIVE_AUDIT_REPORT.md` as a root doc because this recovery already has one active changelog, ledger, lessons file, and final-report target.
  - The old `api/lib/*` path shape.
  - PR #67's direct branch deletion/merge as-is.
- Why not taking:
  - Direct merge conflicts with the #70 baseline and current Vercel `api/_lib` path.
  - The deployment checklist points at DigitalOcean, which conflicts with the user's Vercel target.
  - Adding another root audit report would worsen the repo's existing status-doc sprawl.
- Future mining value:
  - The audit's future refactor ideas remain useful: prompt builder extraction, content formatter extraction, mock-data boundary, story analyzer extraction, beat-structure config, and Chekhov element config.
  - Reuse the duplicate-removal lesson for later story state and multi-chapter ports.
- Files inspected:
  - `COMPREHENSIVE_AUDIT_REPORT.md` from PR #67
  - `DEPLOYMENT_READINESS.md` from PR #67
  - `api/lib/config/authorStyles.ts` from PR #67
  - Deleted `story-generator/src/api/lib/*` files from PR #67
  - `tests/story-service-improved.test.ts`
- Files changed in recovery branch:
  - `api/_lib/config/authorStyles.ts`
  - `api/_lib/services/storyService.ts`
  - `story-generator/src/api/lib/services/exportService.ts`
  - `story-generator/src/api/lib/services/imageService.ts`
  - `story-generator/src/api/lib/services/storyService.ts`
  - `story-generator/src/api/lib/types/contracts.ts`
  - `tests/story-service-improved.test.ts`
  - `tests/story-service.test.mjs`
  - `tests/verify-ai-fixes.test.ts`
- Conflicts encountered:
  - PR #67 is GitHub-mergeable as conflicting and was not merged directly.
  - Conflict shape is path drift (`api/lib` vs `api/_lib`), duplicate service deletion, and obsolete DigitalOcean deployment docs.
- Tests/checks run:
  - Non-doc code scan found no remaining `api/lib`, `story-generator/src/api`, or `src/api/lib` references in `tests`, `api`, or `story-generator`.
  - `npx tsx tests/verify-ai-fixes.test.ts` passed.
  - `npm test` passed with 12/12 tests after validation and harness fixes.
  - `cd story-generator && npx tsc -p tsconfig.app.json --noEmit` passed.
  - `npx -p node@20 -c "node -v && npm run build"` passed with Node v20.20.2.
  - `npm run build:verify` passed.
- Self-review notes:
  - The first `npm test` run revealed the harness was falsely exiting 0 even after a printed failed assertion. That is exactly the kind of audit failure #67 was supposed to flush out, so it was fixed immediately instead of merely documented.
  - Removing the duplicate service means later ports must target `api/_lib` or app-layer contracts, not revive `story-generator/src/api/lib`.
- GitHub PR closure note:
  - Close as ported/superseded after final recovery PR exists, pointing to this ledger and `NOT_TAKEN_FEATURE_LEDGER.md`.

## PR #24 - Implement Invisible Trope Subversion Engine for Enhanced Story Uniqueness

- Source branch: `pr-24` / `copilot/fix-21`
- Planned disposition: recreate/port
- Actual disposition: ported selected story-generation engine into canonical Vercel path
- Story-generation impact: High. Adds an invisible uniqueness layer that selects supernatural-romance trope inversions and injects them into generation prompts without exposing controls in the UI.
- Accepted material:
  - Added `api/_lib/data/tropeDatabase.ts` with vampire, werewolf, and fairy trope definitions adapted from #24.
  - Added `api/_lib/services/tropeSubversionService.ts` for weighted trope selection, hidden prompt directives, serialization, deserialization, continuation prompt enhancement, and stats.
  - Integrated trope selection into `StoryService.generateStory()`, `callGrokAI()`, mock generation, and streaming generation prompts.
  - Added optional `tropeMetadata` to story generation and chapter continuation contracts so later continuation/state work can preserve subversions.
  - Added `tests/trope-subversion.test.ts` and included it in the root `npm test` flow.
- Not taking now:
  - Old `backend/src/*` and `backend/dist/*` tree.
  - PR #24's demo scripts and standalone integration scripts.
  - Direct old story service implementation with stale model name, stale env var, and older prompt shape.
  - Some raw comedic/parody subversion wording from #24; the port rewrites instructions to preserve dark-romance tone unless comedy is explicitly requested.
  - Frontend UI changes, because the engine is intentionally invisible and #70 owns the story-lab surface.
- Why not taking:
  - The old backend tree is not the Vercel recovery architecture.
  - Direct merge conflicts with #70 and #67 service cleanup.
  - The original PR's examples were useful but sometimes too comic for the current product tone.
- Future mining value:
  - Combine `tropeMetadata` with #73 story-state snapshots and #72/#75 multi-chapter flows.
  - Consider analytics/debug display for selected tropes only in a developer/proving-ground surface, not the user flow.
  - Add deterministic random seeding if reproducibility becomes important.
- Files inspected:
  - `backend/src/data/tropeDatabase.ts`
  - `backend/src/services/tropeSubversionService.ts`
  - `backend/src/services/storyService.ts`
  - `backend/src/tests/*`
  - `story-generator/src/app/contracts.ts` from PR #24
- Files changed in recovery branch:
  - `api/_lib/data/tropeDatabase.ts`
  - `api/_lib/services/tropeSubversionService.ts`
  - `api/_lib/services/storyService.ts`
  - `api/_lib/types/contracts.ts`
  - `package.json`
  - `tests/story-service-improved.test.ts`
  - `tests/trope-subversion.test.ts`
- Conflicts encountered:
  - PR #24 is GitHub-mergeable as conflicting.
  - Conflict shape is old `backend/*` architecture, generated `backend/dist/*`, stale model/env choices, and contract drift with #70.
- Tests/checks run:
  - `npm test` passed: story service suite 12/12 plus trope subversion service test.
  - `npx tsx tests/verify-ai-fixes.test.ts` passed.
  - `cd story-generator && npx tsc -p tsconfig.app.json --noEmit` passed after tightening a trope-service type.
  - `npx tsx tests/trope-subversion.test.ts` passed after the type fix.
  - `npx -p node@20 -c "node -v && npm run build"` passed with Node v20.20.2. Angular emitted only the stale `baseline-browser-mapping` warning.
  - `npm run build:verify` passed.
- Self-review notes:
  - The useful part of #24 was the story-generation concept, not the old file layout.
  - I deliberately adapted the trope text to avoid turning dark romance into parody by accident.
  - The continuation metadata is now present but not fully consumed by the #70 UI; #72/#73 should decide how story state carries it.
- GitHub PR closure note:
  - Close as ported/superseded after final recovery PR exists, pointing to this ledger and `NOT_TAKEN_FEATURE_LEDGER.md`.

## PR #31 - Implement Chapter Continuation & Audiobook System with Enhanced Story Arc Management

- Source branch: `pr-31` / `copilot/fix-27`
- Planned disposition: recreate/port
- Actual disposition: ported selected cliffhanger/continuation material; mined story-arc and audiobook ideas
- Story-generation impact: High. Improves continuation outputs with structured cliffhanger analysis, continuation suggestions, and prompt guidance for varied chapter endings.
- Accepted material:
  - Added `api/_lib/services/cliffhangerService.ts`, recreated from #31's cliffhanger engine.
  - Added `CliffhangerType` and `CliffhangerAnalysis` to canonical contracts.
  - Updated `StoryService.continueChapter()` to attach `cliffhangerAnalysis` and use analysis for `cliffhangerEnding`.
  - Updated continuation prompt guidance with six cliffhanger variety targets.
  - Added `tests/cliffhanger-service.test.ts` and included it in `npm test`.
- Not taking now:
  - `api/audio/compile.ts`.
  - `api/lib/services/audiobookService.ts`.
  - `api/lib/services/storyArcService.ts` as active code.
  - `api/story/arc.ts` endpoint.
  - Old frontend story-arc/audiobook UI changes.
  - Old `vercel.json` route changes from the branch.
- Why not taking:
  - Audio remains deferred.
  - #31's story-arc service is an in-memory `Map`, which is not durable enough for Vercel serverless behavior.
  - #70 owns the current story-lab UI, and #72/#73 should decide durable multi-chapter/story-state contracts.
- Future mining value:
  - Story arc structure, character development tracking, world state, plot threads, and chapter metadata are still useful.
  - Revisit the story-arc service when porting #73 and #72.
  - Revisit audiobook compilation only when the audio phase is reopened.
- Files inspected:
  - `api/lib/services/storyArcService.ts`
  - `api/story/arc.ts`
  - `api/lib/services/storyService.ts` diff from PR #31
  - `api/lib/types/contracts.ts` diff from PR #31
  - PR #31 file list and body
- Files changed in recovery branch:
  - `api/_lib/services/cliffhangerService.ts`
  - `api/_lib/services/storyService.ts`
  - `api/_lib/types/contracts.ts`
  - `package.json`
  - `tests/story-service-improved.test.ts`
  - `tests/cliffhanger-service.test.ts`
- Conflicts encountered:
  - PR #31 is GitHub-mergeable as conflicting.
  - Conflict shape is old `api/lib` paths, old frontend app shell, audiobook scope, and stale Vercel routing edits.
- Tests/checks run:
  - `npm test` passed: story service suite 12/12 plus trope and cliffhanger service tests.
  - `npx tsx tests/verify-ai-fixes.test.ts` passed.
  - `cd story-generator && npx tsc -p tsconfig.app.json --noEmit` passed.
  - `npx -p node@20 -c "node -v && npm run build"` passed with Node v20.20.2. Angular emitted only the stale `baseline-browser-mapping` warning.
  - `npm run build:verify` passed.
- Self-review notes:
  - This is a partial port by design. The cliffhanger engine is low-risk and immediately useful; the in-memory story arc store would create false persistence expectations on Vercel.
  - #73/#72 should own durable story-state and multi-chapter contract decisions.
- GitHub PR closure note:
  - Close as ported/superseded after final recovery PR exists, pointing to this ledger and `NOT_TAKEN_FEATURE_LEDGER.md`.

## PR #72 - Finalize multi-chapter story workflows

- Source branch: `pr-72` / `codex/update-story-generation-and-continuation-handlers`
- Planned disposition: port/cherry-pick
- Actual disposition: ported selected backend contract and service behavior; do not merge directly
- Story-generation impact: High. Adds the useful PR #72 primitive of requesting 1-3 generated chapters per request, returning chapter arrays, total word counts, continuation hints, and per-chapter failure metadata.
- Accepted material:
  - Added optional `requestedChapterCount` to canonical story generation, continuation, and streaming inputs.
  - Added `ChapterFailure`, optional chapter-level cliffhanger/hint fields, and optional batch metadata to canonical contracts.
  - Updated `StoryService.generateStory()` to generate 1-3 chapters, aggregate display/raw content, preserve old single-story fields, and expose `chapters`, `totalWordCount`, `appendedToStory`, `nextChapterHint`, and `failedChapters`.
  - Updated `StoryService.continueChapter()` to generate 1-3 continuation chapters, append them to existing content, keep cliffhanger analysis on the latest chapter, and preserve old single-chapter fields for callers that still expect them.
  - Added chapter-scoped Grok prompts, previous-chapter excerpts for batch continuity, and mock-mode batch chapters.
  - Updated `/api/story/stream` query parsing/logging so streaming accepts `requestedChapterCount`.
  - Added mock-mode tests for batch generation and batch continuation to `tests/story-service-improved.test.ts`.
- Not taking now:
  - Direct branch merge from #72.
  - Destructive replacement of legacy `content`, `rawContent`, `actualWordCount`, `chapterId`, `chapterNumber`, `title`, `content`, and `wordCount` response fields.
  - Old `api/lib/*` path layout.
  - Old `api/story/generate.ts`, `api/story/continue.ts`, and `api/story/stream.ts` rewrites as-is.
  - Old Angular app shell changes in `story-generator/src/app/app.*`.
  - Old frontend contracts/service changes from the pre-#70 UI.
  - Replacement of the #70 story-lab contracts, which already model batches with `StoryIterationPayload`.
- Why not taking:
  - #72 is based on the pre-#70 app and conflicts with the story-lab/workbench baseline.
  - Its raw contract removes fields that current tests, legacy API callers, and some recovery code still use.
  - The frontend changes target the old single-form Angular app, while #70 already has batch controls and story-lab contracts.
  - Old `api/lib/*` paths would undo the #67 duplicate-service cleanup.
- Future mining value:
  - Use this backend batch primitive when replacing `api/story-lab/mockData.ts` with real generation.
  - Consider porting per-chapter partial failure display into #75-style UI panels.
  - Revisit whether `wordCount` should mean total batch budget or per-chapter target when the story-lab production adapter is built.
- Files inspected:
  - `api/lib/services/storyService.ts` from PR #72
  - `api/lib/types/contracts.ts` from PR #72
  - `api/story/generate.ts`, `api/story/continue.ts`, and `api/story/stream.ts` from PR #72
  - `story-generator/src/app/contracts.ts`, `story-generator/src/app/story.service.ts`, `story-generator/src/app/app.ts`, and `story-generator/src/app/app.html` from PR #72
  - `tests/story-service-improved.test.ts` and `tests/story-service.test.mjs` from PR #72
- Files changed in recovery branch:
  - `api/_lib/services/storyService.ts`
  - `api/_lib/types/contracts.ts`
  - `api/story/stream.ts`
  - `tests/story-service-improved.test.ts`
- Conflicts encountered:
  - PR #72 is GitHub-mergeable as conflicting.
  - Conflict shape is old `api/lib` paths, old app shell/frontend contracts, direct output-shape replacement, and overlap with #70 story-lab batch concepts.
- Tests/checks run:
  - `npx tsx tests/story-service-improved.test.ts` passed with 14/14 tests.
  - `npx tsx tests/verify-ai-fixes.test.ts` passed.
  - `cd story-generator && npx tsc -p tsconfig.app.json --noEmit` passed.
  - `cd story-generator && npx tsc -p tsconfig.spec.json --noEmit` passed.
  - `npm test` passed.
  - `npx -p node@20 -c "node -v && npm run build"` passed with Node v20.20.2. Angular emitted only the stale `baseline-browser-mapping` warning.
  - `npm run build:verify` passed.
- Self-review notes:
  - The important #72 idea is the batch primitive, not the old UI rewrite.
  - The port is intentionally additive so current single-story consumers continue to work while later story-lab work can adopt the richer chapter arrays.
  - The next risk is contract duplication between legacy `api/_lib/types/contracts.ts` and #70's `story-generator/src/app/contracts.ts`; #75/#73 should decide the adapter boundary instead of forcing one type system prematurely.
- GitHub PR closure note:
  - Close as ported/superseded after final recovery PR exists, pointing to this ledger and `NOT_TAKEN_FEATURE_LEDGER.md`.

## PR #75 - Add chapter batching workflow and continuity panels

- Source branch: `pr-75` / `codex/add-reactive-fields-and-ui-enhancements`
- Planned disposition: port/cherry-pick
- Actual disposition: ported selected current-story-lab UI behavior; do not merge directly
- Story-generation impact: Medium-high. Improves the #70 story-lab workflow around batch visibility, continuation prompt selection, and long chapter navigation without changing backend generation logic.
- Accepted material:
  - Added `BatchProgressState` and `BatchProgressStatus` to the #70 frontend story-lab contracts.
  - Added `lastSuggestedPrompts` and `batchQueue` to `StoryWorkbenchSession`.
  - Corrected `StoryPersistenceSeam` wording from DigitalOcean database to a Vercel-compatible persistence layer.
  - Added visible batch queue state for genesis and continuation requests in `App`.
  - Added completed/failed queue clearing.
  - Added suggested next-move prompt buttons that call `continueSaga(prompt)`.
  - Added grouped/collapsible chapter timeline behavior for longer chapter histories.
  - Updated app specs to assert completed queue state and suggested prompts.
- Not taking now:
  - Direct branch merge.
  - PR #75's old `ChapterBatchSeam` and `/api/story/batch` frontend service route.
  - Old pre-#70 Angular app shell rewrite in `app.ts`, `app.html`, and `app.css`.
  - Large old CSS redesign.
  - README workflow updates that describe the old app rather than the #70 story lab.
  - `story-generator/src/testing/test-data-factory.ts`, because current #70 specs already use local story-lab factories.
- Why not taking:
  - #75 is built on the pre-#70 app and conflicts with the current `beginStory()` / `continueStory()` story-lab service.
  - #70 already has continuity panels and batch-size controls, so the remaining useful pieces are workflow affordances rather than a full UI replacement.
  - Adding `/api/story/batch` would create another route seam while #70 already uses `/api/story-lab/stories/:storyId/continue`.
- Future mining value:
  - Use #75's fuller queue semantics if generation becomes asynchronous or durable.
  - Revisit README wording after #73 decides the real persistence story.
  - Revisit long-list timeline ergonomics with browser screenshots after the final story-lab layout stabilizes.
- Files inspected:
  - `story-generator/src/app/contracts.ts` from PR #75
  - `story-generator/src/app/story.service.ts` from PR #75
  - `story-generator/src/app/app.ts`, `app.html`, `app.css`, and `app.spec.ts` from PR #75
  - `story-generator/src/app/story.service.spec.ts` from PR #75
  - `story-generator/src/testing/test-data-factory.ts` from PR #75
  - `README.md` from PR #75
- Files changed in recovery branch:
  - `story-generator/src/app/contracts.ts`
  - `story-generator/src/app/app.ts`
  - `story-generator/src/app/app.html`
  - `story-generator/src/app/app.css`
  - `story-generator/src/app/app.spec.ts`
- Conflicts encountered:
  - PR #75 is GitHub-mergeable against `main` but stale against the recovery branch's #70 story-lab baseline.
  - Conflict shape is old app shell vs #70 story lab, old route/service shape vs `/api/story-lab`, and a large CSS rewrite that does not match the current component structure.
- Tests/checks run:
  - `cd story-generator && npx tsc -p tsconfig.app.json --noEmit` passed.
  - `cd story-generator && npx tsc -p tsconfig.spec.json --noEmit` passed.
  - `npx -p node@20 -c "node -v && npm run build"` passed with Node v20.20.2. Angular emitted only the stale `baseline-browser-mapping` warning.
  - `npm run build:verify` passed.
- Self-review notes:
  - The port deliberately uses the existing #70 `continueStory()` path instead of creating #75's separate batch endpoint.
  - The queue is currently UI-local because story-lab generation is still mock/synchronous. Durable queue semantics should wait for real persistence/workflow decisions.
  - The current visual design remains the #70 dark story-lab shell; #75's broad visual rewrite was not ported.
- GitHub PR closure note:
  - Close as ported/superseded after final recovery PR exists, pointing to this ledger and `NOT_TAKEN_FEATURE_LEDGER.md`.

## PR #73 - Add persistent story state tracking and schema

- Source branch: `pr-73` / `codex/implement-story-state-management-system`
- Planned disposition: recreate/port
- Actual disposition: ported selected story-state concepts into the #70 story-lab mock seam; do not merge directly
- Story-generation impact: High. Adds explicit state deltas and a persistence boundary to the story-lab workflow so character, plot-thread, artifact, beat, and continuity changes are represented per batch.
- Accepted material:
  - Added `StoryStateDelta` to the #70 story-lab contracts.
  - Added `StoryPersistenceReceipt` to mark whether a story snapshot was client-carried, transient-memory, or durable.
  - Extended `StoryIterationPayload` with optional `stateDelta` and `persistence` fields.
  - Added `api/story-lab/stateStore.ts` as a clearly marked transient-memory persistence boundary for story-lab continuity.
  - Updated story-lab mock generation so chapter deltas introduce characters, escalate threads, foreshadow artifacts, add beats, and produce continuity warnings.
  - Updated story-lab continuation so it applies chapter deltas to the incoming state snapshot and can fall back to a same-process transient snapshot if present.
  - Added `tests/story-lab-state.test.ts` and included it in `npm test`.
- Not taking now:
  - Direct branch merge.
  - DigitalOcean Postgres schema and provisioning docs.
  - `pg` dependency.
  - Old `api/lib/db/*` path layout.
  - Old `api/lib/services/storyStateService.ts` implementation as active production code.
  - Old legacy `api/lib/services/storyService.ts` state mutation changes.
  - Old duplicate `story-generator/src/api/lib/types/contracts.ts` contract copy.
- Why not taking:
  - The app target is Vercel, and no durable Vercel storage product has been selected yet.
  - Adding `pg` and DigitalOcean provisioning would contradict the current deployment direction.
  - #70 already owns richer story-lab state contracts than PR #73's older legacy contracts, so the useful port is state-delta and persistence-boundary behavior rather than wholesale type replacement.
  - In-memory state is not durable on Vercel; the recovery branch labels it as transient to avoid false persistence claims.
- Future mining value:
  - Use PR #73's SQL schema as a conceptual reference when choosing Vercel Postgres/Neon, Vercel KV/Upstash, Blob, or another durable store.
  - Promote `api/story-lab/stateStore.ts` from transient to durable only after storage selection and migration planning.
  - Use the state-delta shape when replacing story-lab mocks with the canonical `api/_lib/services/storyService.ts`.
- Files inspected:
  - `api/lib/db/README.md`, `api/lib/db/client.ts`, and `api/lib/db/schema.sql` from PR #73
  - `api/lib/services/storyStateService.ts` from PR #73
  - `api/lib/services/storyService.ts` from PR #73
  - `api/lib/types/contracts.ts` from PR #73
  - `story-generator/src/app/contracts.ts` from PR #73
  - `tests/story-service-improved.test.ts` from PR #73
- Files changed in recovery branch:
  - `story-generator/src/app/contracts.ts`
  - `api/story-lab/contracts.ts`
  - `api/story-lab/mockData.ts`
  - `api/story-lab/stateStore.ts`
  - `api/story-lab/stories/[storyId]/continue.ts`
  - `tests/story-lab-state.test.ts`
  - `package.json`
- Conflicts encountered:
  - GitHub reports PR #73 as conflicting against `main`; it is also stale against the recovery branch.
  - Conflict shape is old `api/lib` paths, DigitalOcean Postgres provisioning, old legacy service mutation, and overlap with #70's newer story-lab state contracts.
- Tests/checks run:
  - `npx tsx tests/story-lab-state.test.ts` passed.
  - `cd story-generator && npx tsc -p tsconfig.app.json --noEmit` passed.
  - `cd story-generator && npx tsc -p tsconfig.spec.json --noEmit` passed.
  - `git diff --check` passed.
  - `npm test` passed, including story, trope, cliffhanger, and story-lab state tests.
  - `npx -p node@20 -c "node -v && npm run build"` passed with Node v20.20.2. Angular emitted only the stale `baseline-browser-mapping` warning.
  - `npm run build:verify` passed.
- Self-review notes:
  - The port keeps the current story-lab contract as the UI/API boundary and avoids creating another legacy contract layer.
  - The new store is intentionally not marketed as durable persistence. Its warning text should remain until a real Vercel storage choice is implemented.
  - The #73 port resolves the immediate state-delta gap before #71/#74 review, but production story generation still needs an adapter from canonical `StoryService` into `StoryIterationPayload`.
- GitHub PR closure note:
  - Close as ported/superseded after final recovery PR exists, pointing to this ledger and `NOT_TAKEN_FEATURE_LEDGER.md`.
