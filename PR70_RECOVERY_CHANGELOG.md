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

## 2026-05-26 00:53 EDT - PR #64 Fisher-Yates Fix Ported

Actions:

- Inspected PR #64 and confirmed direct merge would be too stale and broad.
- Ported the Fisher-Yates Chekhov element selection fix manually.
- Updated both `api/_lib/services/storyService.ts` and `story-generator/src/api/lib/services/storyService.ts`.

Reason:

- `api/_lib/services/storyService.ts` is the Vercel recovery target.
- `story-generator/src/api/lib/services/storyService.ts` is still included by `story-generator/tsconfig.app.json`, so it should not keep known-bad prompt logic while duplicate cleanup remains unresolved.

Validation:

- `rg` confirmed no remaining `sort(() => 0.5 - Math.random())` in the two story service copies.
- `cd story-generator && npx tsc -p tsconfig.app.json --noEmit` passed.

Self-review:

- Porting only the randomization fix avoided #64's path regression from `_lib` back to `lib`.
- Duplicate service cleanup remains a real issue for the #67 phase.

## 2026-05-26 00:54 EDT - Self-Review Checkpoint 1

Scope reviewed:

- #70 baseline merge and stabilization.
- #86 design doc merge.
- #85 dependency lockfile merge.
- #50 progress/hydration lesson mining.
- #64 Fisher-Yates randomization port.

Findings:

- Good: The recovery branch is now based on #70 and builds successfully under Node 20.
- Good: The running ledger changed the #50 decision from "port code" to "mine lesson" after inspection, which avoided stale UI regression.
- Good: #64 was narrowed to the one story-generation correctness fix instead of merging broad stale branch content.
- Problem: Current local Node v23.8.0 is not suitable for Angular build validation. Continue using Node 20 for build checks.
- Problem: `story-generator/src/api/lib/services/storyService.ts` remains as a duplicate compiled story service. It should be resolved during #67 cleanup, but until then it should not retain known bugs.
- Problem: Lockfile noise in root `package-lock.json` and `node_modules/.package-lock.json` remains uncommitted. Avoid dependency-heavy PRs until that is resolved.
- Problem: An unrelated untracked `pocketfm-contest-forge/` directory is present. Ignore it unless the user connects it to this work.

Immediate corrections made:

- None needed beyond already-committed #70/#64 fixes.

Next action:

- Inspect #65 for model/token/quality fixes and port only the parts not already present in the #70 recovery branch.

## 2026-05-26 00:55 EDT - PR #65 AI Fixes Verified And Ported

Actions:

- Inspected #65's model/token/API-parameter fixes against the #70 recovery branch.
- Confirmed the canonical Vercel service already had the intended model, dynamic token calculation, `top_p: 0.95`, and longer timeouts.
- Updated `tests/verify-ai-fixes.test.ts` from stale `api/lib/*` imports to current `api/_lib/*`.
- Aligned the duplicate compiled `story-generator/src/api/lib/services/storyService.ts` timeouts to 90 seconds for generation and 60 seconds for continuation.

Decision:

- Do not merge #65 directly.
- Treat #65 as ported because the useful current material is verifier/path correction plus duplicate-service timeout alignment.

Validation:

- `npx tsx tests/verify-ai-fixes.test.ts` passed under escalated execution. Missing `XAI_API_KEY` warnings were expected and did not indicate live API calls.
- `cd story-generator && npx tsc -p tsconfig.app.json --noEmit` passed.

Self-review:

- The canonical service is in better shape than the stale branch suggested, but the duplicate compiled story service is still a risk.
- #67 should either remove the duplicate service path or make it a thin wrapper around the canonical `api/_lib` implementation.

## 2026-05-26 01:50 EDT - PR #67 Audit Refactor Ported

Actions:

- Inspected #67's audit PR and confirmed it is conflicting against the #70/Vercel recovery branch.
- Ported the useful refactor into the Vercel `api/_lib` path:
  - Added `api/_lib/config/authorStyles.ts`.
  - Removed inline author-style tables from `api/_lib/services/storyService.ts`.
  - Deleted stale duplicate compiled files under `story-generator/src/api/lib/*`.
  - Updated tests away from stale `api/lib` and duplicate `story-generator/src/api/lib` imports.
- Fixed an uncovered test-harness bug: `tests/story-service-improved.test.ts` counted `r.failed`, which does not exist, so printed failures still exited 0.
- Fixed the actual story-generation validation bug exposed by that test: invalid spicy levels were accepted and generated mock stories.

Decision:

- Do not merge #67 directly.
- Do not take #67's DigitalOcean deployment readiness doc.
- Do not add #67's root audit report as another active status doc; mine its refactor recommendations into the recovery ledgers instead.

Validation:

- Non-doc code scan found no remaining `api/lib`, `story-generator/src/api`, or `src/api/lib` references in `tests`, `api`, or `story-generator`.
- `npx tsx tests/verify-ai-fixes.test.ts` passed.
- `npm test` passed with 12/12 tests.
- `cd story-generator && npx tsc -p tsconfig.app.json --noEmit` passed.
- `npx -p node@20 -c "node -v && npm run build"` passed with Node v20.20.2. Angular emitted only the stale `baseline-browser-mapping` warning.
- `npm run build:verify` passed.

Self-review:

- #67 justified its place in the merge order: duplicate service drift had already made #64/#65 riskier.
- The first test run found a false-green test harness and a validation bug; both were fixed immediately.
- The remaining risk is old documentation still mentioning `api/lib` paths. That is historical doc drift, not active code drift, and should be cleaned in a docs pass rather than mixed into story-generation feature ports.

## 2026-05-26 02:00 EDT - PR #24 Trope Subversion Ported

Actions:

- Inspected #24's old backend implementation of the invisible trope subversion engine.
- Recreated the useful material in the recovery architecture:
  - `api/_lib/data/tropeDatabase.ts`
  - `api/_lib/services/tropeSubversionService.ts`
  - `tropeMetadata` contract fields for generation and continuation.
  - Story service prompt enhancement for normal and streaming generation.
  - `tests/trope-subversion.test.ts`, now included in `npm test`.
- Adapted the trope wording so it supports dark-romance uniqueness without drifting into parody unless the user explicitly asks for comedy.

Decision:

- Do not merge #24 directly.
- Do not take `backend/src`, `backend/dist`, demo scripts, or stale story service changes.
- Keep the feature invisible in the user flow for now.

Validation:

- `npm test` passed: story suite 12/12 plus trope subversion test.
- `npx tsx tests/verify-ai-fixes.test.ts` passed.
- `cd story-generator && npx tsc -p tsconfig.app.json --noEmit` passed after adding one explicit type annotation in `tropeSubversionService`.
- `npx tsx tests/trope-subversion.test.ts` passed after the type fix.
- `npx -p node@20 -c "node -v && npm run build"` passed with Node v20.20.2. Angular emitted only the stale `baseline-browser-mapping` warning.
- `npm run build:verify` passed.

Self-review:

- This port improves story uniqueness but introduces metadata that the current #70 UI does not yet preserve through continuation. That is acceptable for generation now and should be reconciled with #72/#73 story state work.
- The old branch's story value was high, but its architecture was not reusable.

## 2026-05-26 02:11 EDT - PR #31 Cliffhanger Slice Ported

Actions:

- Inspected #31's story-arc, chapter continuation, and audiobook compilation branch.
- Ported the low-risk story-generation slice:
  - Added `api/_lib/services/cliffhangerService.ts`.
  - Added canonical cliffhanger types and analysis shape.
  - Attached `cliffhangerAnalysis` to continuation outputs.
  - Added cliffhanger variety targets to the continuation prompt.
  - Added `tests/cliffhanger-service.test.ts` to the root test suite.

Decision:

- Do not merge #31 directly.
- Do not take audiobook compilation or UI.
- Do not take the in-memory story-arc CRUD service as active Vercel code.
- Mine story-arc concepts for #72/#73 instead.

Validation:

- `npm test` passed: story suite 12/12 plus trope and cliffhanger service tests.
- `npx tsx tests/verify-ai-fixes.test.ts` passed.
- `cd story-generator && npx tsc -p tsconfig.app.json --noEmit` passed.
- `npx -p node@20 -c "node -v && npm run build"` passed with Node v20.20.2. Angular emitted only the stale `baseline-browser-mapping` warning.
- `npm run build:verify` passed.

Self-review:

- The direct story-generation value is the cliffhanger analysis and prompt guidance.
- The story-arc model should not be lost, but its persistence story belongs with #73 and the multi-chapter workflow belongs with #72/#75.

## 2026-05-26 02:12 EDT - Self-Review Checkpoint 2

Scope reviewed:

- #67 audit/duplicate cleanup.
- #24 trope subversion engine.
- #31 cliffhanger/continuation slice.

Findings:

- Good: Active story-generation services now live in `api/_lib`; the compiled duplicate `story-generator/src/api/lib` service copy is gone.
- Good: New prompt-affecting systems have focused tests and are included in `npm test`.
- Good: Old branches contributed ideas without reintroducing audio or DigitalOcean infrastructure.
- Problem: `tropeMetadata` is generated and can be accepted by continuation, but the #70 UI does not yet thread it through. This should be reconciled during #72/#73 work.
- Problem: The root docs still contain many historical `api/lib` and DigitalOcean references. This is documentation drift, not active code drift, but it must be addressed before final report/PR.
- Problem: Local dirty root lockfile and `node_modules/.package-lock.json` noise still exists and should keep #84 deferred.

Immediate corrections made:

- No code corrections needed at this checkpoint.

Next action:

- Move into Phase 4 with #72 multi-chapter workflow as the primary source, then compare #75/#73/#71 around it.

## 2026-05-26 06:24 EDT - PR #72 Batch Workflow Ported

Actions:

- Inspected PR #72's old backend, frontend, and test changes for multi-chapter story workflows.
- Ported the durable backend idea into the Vercel canonical service instead of merging the old branch:
  - Optional `requestedChapterCount` on generation, continuation, and streaming inputs.
  - Optional `chapters`, `totalWordCount`, `nextChapterHint`, `appendedToStory`, and `failedChapters` response metadata.
  - Backward-compatible single-story and single-continuation fields preserved.
  - Chapter-scoped Grok prompts and mock-mode batch generation.
  - Batch generation and batch continuation tests.
- Updated the PR ledger and not-taken ledger for #72.

Decision:

- Do not merge #72 directly.
- Do not take its old Angular app shell, old `/api/story/*` route rewrites as-is, or old `api/lib/*` path layout.
- Keep #70 story-lab contracts as the UI direction and use this port as the backend batch primitive for later story-lab production integration.

Validation:

- `npx tsx tests/story-service-improved.test.ts` passed with 14/14 tests.
- `npx tsx tests/verify-ai-fixes.test.ts` passed.
- `cd story-generator && npx tsc -p tsconfig.app.json --noEmit` passed.
- `cd story-generator && npx tsc -p tsconfig.spec.json --noEmit` passed.
- `npm test` passed.
- `npx -p node@20 -c "node -v && npm run build"` passed with Node v20.20.2. Angular emitted only the stale `baseline-browser-mapping` warning.
- `npm run build:verify` passed.

Self-review:

- Good: The useful #72 feature landed without replacing legacy response fields or reviving old paths.
- Good: Batch behavior has executable mock-mode coverage, so it does not require a live `XAI_API_KEY`.
- Problem: There are now two story contract layers: legacy canonical `api/_lib/types/contracts.ts` and #70 story-lab contracts in `story-generator/src/app/contracts.ts`. This is acceptable during recovery, but #75/#73 need a deliberate adapter boundary before production story-lab uses real generation.
- Problem: The batch port currently treats `wordCount` as a total batch budget when live generation is split across chapters. The UI/product decision may ultimately want per-chapter budgeting.

Running merge-order snapshot after #72:

1. #75 - next, because it likely contains the UI/continuity affordances that should consume #72's backend primitive.
2. #73 - next state model candidate, but avoid adopting DigitalOcean Postgres assumptions.
3. #71 - compare after #72/#75 to identify any earlier batch-generation material not already superseded.
4. #74 - mine prompt proving-ground ideas after the core workflow/state pieces are settled.
5. #41/#39 - then move into Vercel CI/test cleanup.

## 2026-05-26 06:38 EDT - PR #75 Batch UI Ported

Actions:

- Inspected PR #75's branch and treated it as stale against the PR #70 story-lab baseline.
- Ported the useful workflow layer into the current Angular app:
  - UI-local batch queue state for genesis and continuation requests.
  - Suggested next-move prompt buttons.
  - Grouped/collapsible chapter timeline behavior for longer stories.
  - Vercel-compatible persistence seam wording.
- Updated `PR70_RECOVERY_LEDGER.md` and `NOT_TAKEN_FEATURE_LEDGER.md`.

Decision:

- Do not merge #75 directly.
- Do not take the old `/api/story/batch` route/service seam because #70 already owns `beginStory()` and `continueStory()`.

Validation:

- `cd story-generator && npx tsc -p tsconfig.app.json --noEmit` passed.
- `cd story-generator && npx tsc -p tsconfig.spec.json --noEmit` passed.
- `npx -p node@20 -c "node -v && npm run build"` passed with Node v20.20.2 and only the stale `baseline-browser-mapping` warning.
- `npm run build:verify` passed.

Self-review:

- This was the right place to port UI affordances rather than backend behavior; #72 already established the backend primitive.
- The queue is intentionally local state for now. Durable or asynchronous queue semantics should wait for #73 persistence decisions.
- Visual additions were kept in the #70 story-lab shell instead of importing #75's broad CSS rewrite.

## 2026-05-26 06:47 EDT - PR #73 Story-State Delta Ported

Actions:

- Inspected PR #73's story-state contracts, `StoryStateService`, Postgres client/schema, story service changes, and tests.
- Ported the useful state concepts into the current #70 story-lab seam:
  - `StoryStateDelta` and `StoryPersistenceReceipt` contracts.
  - Optional `stateDelta` and `persistence` fields on `StoryIterationPayload`.
  - Transient `api/story-lab/stateStore.ts` boundary with an explicit non-durable warning.
  - Mock chapter deltas that introduce characters, escalate threads, foreshadow artifacts, add beats, and surface continuity warnings.
  - Continuation state application and same-process transient snapshot fallback.
  - `tests/story-lab-state.test.ts`, included in `npm test`.

Decision:

- Do not merge #73 directly.
- Do not take DigitalOcean Postgres provisioning, the `pg` dependency, or old `api/lib/*` implementation paths.
- Treat transient memory only as story-lab continuity scaffolding, not production persistence.

Validation:

- `npx tsx tests/story-lab-state.test.ts` passed.
- `cd story-generator && npx tsc -p tsconfig.app.json --noEmit` passed.
- `cd story-generator && npx tsc -p tsconfig.spec.json --noEmit` passed.
- `git diff --check` passed.
- `npm test` passed.
- `npx -p node@20 -c "node -v && npm run build"` passed with Node v20.20.2 and only the stale `baseline-browser-mapping` warning.
- `npm run build:verify` passed.

Self-review:

- Good: #73's story-generation value is now represented in the #70 story-lab contract rather than old legacy contracts.
- Good: The port makes non-durable state explicit instead of accidentally promising persistence.
- Problem: Production story-lab generation still needs an adapter from the canonical `api/_lib` story service into `StoryIterationPayload`.

Running merge-order snapshot after #73:

1. #71 - compare against #72/#75/#73 and close if fully superseded.
2. #74 - prompt proving grounds now that batch/state surfaces are clearer.
3. #41/#39 - Vercel CI and test pipeline.
4. #26 - frontend validation/accessibility services after core story-lab surfaces stabilize.

## 2026-05-26 06:56 EDT - PR #71 Batch Metadata Compared And Ported

Actions:

- Inspected PR #71's early backend/frontend batch-generation pass.
- Compared it against already-ported #72 backend batching, #75 story-lab UI affordances, and #73 state-delta work.
- Ported the one unique low-risk improvement:
  - `chaptersRequested`, `chaptersGenerated`, and `partialFailures` on `ApiResponse.metadata`.
  - Metadata population in canonical generation and continuation responses.
  - Metadata assertions in `tests/story-service-improved.test.ts`.

Decision:

- Do not merge #71 directly.
- Do not take old app-shell changes, stale `api/lib/*` paths, old `/api/story/*` frontend route assumptions, or old test-data factory.
- Do not take service-level clamping for invalid requested chapter counts; keep explicit validation.

Validation:

- `npx tsx tests/story-service-improved.test.ts` passed with 14/14 tests.
- `cd story-generator && npx tsc -p tsconfig.app.json --noEmit` passed.
- `cd story-generator && npx tsc -p tsconfig.spec.json --noEmit` passed.
- `git diff --check` passed.
- `npm test` passed all configured suites.
- `cd story-generator && npx -p node@20 -c "node -v && npm run build"` passed with the existing stale `baseline-browser-mapping` warning.
- `npm run build:verify` passed from the repo root.

Self-review:

- Good: #71 was compared after the newer batch/state ports, which made the remaining unique material easy to isolate.
- Good: Metadata improves observability without changing response data shape.
- Problem found and fixed: I initially ran `build:verify` from `story-generator`, where the script does not exist, then reran it from the repo root.

Running merge-order snapshot after #71:

1. #74 - prompt proving grounds, now that batch/state primitives are settled.
2. #41/#39 - Vercel CI/test workflow.
3. #26 - UI validation/accessibility services.
4. #84 - dependency group remains deferred until lockfile noise is resolved.

## 2026-05-26 12:05 EDT - Recovery Preflight Tooling Added

Actions:

- Attempted Homebrew installation of `jq` so GitHub PR JSON output can be summarized without noisy raw payloads.
- Added `scripts/recovery/preflight.sh`.
- The script codifies the repeated recovery validation sequence:
  - required tool checks,
  - `git diff --check`,
  - Angular app/spec type checks,
  - root `npm test`,
  - Angular production build through Node 20,
  - root `npm run build:verify`.
- Added options for `--quick`, `--skip-tests`, `--skip-build`, and `--skip-status`.

Validation:

- `bash -n scripts/recovery/preflight.sh` passed.
- `scripts/recovery/preflight.sh --help` printed the expected usage.
- `scripts/recovery/preflight.sh --quick --skip-status` passed.

Self-review:

- Good: Repeated validation is now executable instead of depending on memory after each PR port.
- Problem: `brew install jq` reached the `m4` dependency build on macOS 12 and stalled long enough to block recovery work, so I stopped it with `SIGTERM`.
- Follow-up: Retry `jq` later with a less blocking install path, or continue using `gh --json` plus Node/TypeScript parsing when needed.
