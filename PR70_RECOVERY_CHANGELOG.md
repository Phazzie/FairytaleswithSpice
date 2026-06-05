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

## 2026-05-26 12:28 EDT - PR #74 Proving Grounds Ported

Actions:

- Ported PR #74 selectively instead of merging the old app shell.
- Added Angular routing around the #70 Story Lab baseline:
  - `AppRoot` wrapper,
  - `app.routes.ts`,
  - `provideRouter(routes)`,
  - `/proving-grounds` lazy route,
  - Story Lab header link.
- Adapted the proving-grounds page to current Story Lab contracts:
  - uses `StoryService.beginStory()` instead of stale `generateStory()`,
  - passes prompt experiments as `narrativeDirectives`,
  - stores local test history safely only in the browser,
  - keeps comparison mode and JSON export.
- Added server-side `api/story-lab/evaluate.ts` for Grok evaluation with `XAI_API_KEY`, falling back to mock scoring if unavailable.
- Updated root `build:verify` to accept Angular SSR's `browser/index.csr.html` output.

Decision:

- Do not merge #74 directly.
- Do not take browser-local xAI key storage.
- Do not take old pre-#70 app-shell changes as-is.
- Keep the proving grounds as an internal prompt-testing tool, not yet as production prompt-control infrastructure.

Validation:

- `scripts/recovery/preflight.sh --quick --skip-status` passed.
- `npm test` passed all configured root suites.
- `cd story-generator && npx -p node@20 -c "node -v && npm run build"` passed with the existing stale `baseline-browser-mapping` warning and a new proving-grounds CSS budget warning.
- `npm run build:verify` passed after widening the expected browser index filename.

Self-review:

- Good: The feature now follows the #70 Story Lab seam and is lazy-loaded instead of replacing the app shell.
- Good: Provider credentials stay server-side for Vercel.
- Problem found and fixed: The verifier assumed prerender output `index.html`, but server-rendered routed Angular builds produce `index.csr.html`.
- Watch item: Prompt templates are visible and passed as directives, but production story generation still needs a real adapter before proving-ground template choices can be treated as authoritative generation controls.

Running merge-order snapshot after #74:

1. #26 - validation, notifications, accessibility services.
2. #41/#39 - lean Vercel CI/test workflow material.
3. #84 - dependency update once lockfile state is intentional.
4. Docs/research/audio mining after merge/adapt candidates are out of the way.

## 2026-05-26 12:50 EDT - PR #74 SSR Route Verification Fixed

Actions:

- Investigated a route verification problem where `/proving-grounds` returned Story Lab body content under the built SSR server.
- Fixed `story-generator/src/main.server.ts` so server bootstrap uses `AppRoot`, matching browser bootstrap and allowing the router to select `/` versus `/proving-grounds`.
- Stopped the local SSR server after verification.

Validation:

- `cd story-generator && npx -p node@20 -c "node -v && npm run build"` passed.
- `PORT=4300 npm run start:prod` served the production SSR bundle on `http://localhost:4300`.
- `curl http://localhost:4300/` found `Story Blueprint` and the `Proving Grounds` link.
- `curl http://localhost:4300/proving-grounds` found `proving-grounds-container` and `Test Configuration`.
- `npm run build:verify` passed from the repo root.
- `git diff --check` passed.
- `scripts/recovery/preflight.sh --quick --skip-status` passed.

Self-review:

- Good: The feature is now verified as a real route, not only a successful TypeScript/build port.
- Problem found and fixed: SSR and browser bootstrap can drift after introducing a router shell; both must point at the same root component.
- Watch item: The proving-grounds component CSS still exceeds the Angular component budget by 1.15 kB.

Running merge-order snapshot after #74 verification:

1. #26 - validation, notifications, accessibility services.
2. #41/#39 - lean Vercel CI/test workflow material.
3. #84 - dependency update once lockfile state is intentional.
4. Docs/research/audio mining after merge/adapt candidates are out of the way.

## 2026-05-26 13:15 EDT - PR #26 Validation and Notifications Ported

Actions:

- Ported PR #26 selectively instead of merging the old pre-#70 app shell.
- Added a signal-backed `NotificationService` and accessible `NotificationsComponent`.
- Recreated `FormValidationService` around current Story Lab blueprint contracts:
  - creature,
  - tone,
  - themes,
  - logline,
  - spicy level,
  - word budget,
  - chapter batch size,
  - world details,
  - narrative directives.
- Wired Story Lab validation into the current #70 app:
  - inline field errors,
  - `aria-invalid`,
  - `aria-describedby`,
  - disabled invalid generate action,
  - invalid-blueprint notification,
  - success/error notifications for generation and continuation.
- Added focused specs for notification and validation services.

Decision:

- Do not merge #26 directly.
- Do not take the old app form layout, stale story service methods, save/download controls, or audio conversion progress UI.
- Keep the retry-button idea as future mining material for explicit batch retry semantics.

Validation:

- `scripts/recovery/preflight.sh --quick --skip-status` passed.
- `npm test` passed all configured root suites.
- `cd story-generator && npx -p node@20 -c "node -v && npm run build"` passed with the existing stale `baseline-browser-mapping` warning and known #74 proving-grounds CSS budget warning.
- `PORT=4300 npm run start:prod` plus `curl` confirmed `/` contains Story Lab content and the new validation summary, and `/proving-grounds` still resolves correctly.
- `npm run build:verify` passed.
- Angular Karma browser tests did not complete:
  - `cd story-generator && npm test -- --watch=false --browsers=ChromeHeadless` built the spec bundle but ChromeHeadless never captured.
  - Repeating with `CHROME_BIN="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"` and Node 20 produced the same ChromeHeadless capture timeout.

Self-review:

- Good: #26's useful capability is now integrated into the current Story Lab rather than copied over as a stale UI branch.
- Good: Validation follows the active seam and has direct specs.
- Problem documented: local ChromeHeadless capture is not reliable in this environment, so Angular browser-spec execution remains unverified even though spec typecheck and bundle build passed.
- Watch item: Retry UI should wait until batch retry semantics are designed instead of merely replaying the last action.

Running merge-order snapshot after #26:

1. #41/#39 - lean Vercel CI/test workflow material.
2. #84 - dependency update once lockfile state is intentional.
3. Docs/research/audio mining after merge/adapt candidates are out of the way.

## 2026-05-26 13:25 EDT - PR #41/#39 Lean Recovery CI Ported

Actions:

- Refreshed local PR heads for #41 and #39 with `git fetch origin pull/41/head:pr-41 pull/39/head:pr-39`.
- Inspected the CI workflow suites from both branches.
- Added one lean workflow: `.github/workflows/recovery-ci.yml`.
- The workflow:
  - uses Node 20,
  - installs root and Angular dependencies,
  - runs `scripts/recovery/preflight.sh --skip-status`,
  - checks that `vercel.json` defines `buildCommand` and `outputDirectory`,
  - runs on PRs to `main`, pushes to `main` and recovery branches, and manual dispatch.

Decision:

- Do not merge #41 directly.
- Do not merge #39 directly.
- Do not take workflows that assume stale `backend`, `api/package.json`, old `api/lib`, old backend contract paths, or old API route names.
- Do not add Vercel CLI deployment workflow yet; Vercel Git deployment can be configured separately once branch validation is stable and secrets are intentionally provisioned.

Validation:

- `ruby -e 'require "yaml"; YAML.load_file(".github/workflows/recovery-ci.yml"); puts "workflow yaml ok"'` passed.
- `node -e "const fs=require('fs'); const config=JSON.parse(fs.readFileSync('vercel.json','utf8')); if (!config.buildCommand || !config.outputDirectory) throw new Error('bad vercel config'); console.log('vercel config ok')"` passed.
- `git diff --check` passed.

Self-review:

- Good: CI now runs the same recovery preflight script used locally, which reduces checklist drift.
- Good: This avoids the old API/backend path rewrites that would undo #70 recovery work.
- Watch item: This is a validation workflow, not a deployment workflow; the Vercel project/link/secrets still need a later deployment pass.

Running merge-order snapshot after #41/#39:

1. #84 - dependency update once lockfile state is intentional.
2. Docs/research/audio mining after merge/adapt candidates are out of the way.

## 2026-05-26 13:34 EDT - PR #84 Dependency Update Deferred For Fresh Recreate

Actions:

- Fetched PR #84 as `pr-84`.
- Inspected package and lockfile changes.
- Compared the branch against the current recovery baseline.

Decision:

- Do not merge #84 into this recovery branch.
- Recreate the dependency update later from the recovery branch after lockfile state is clean.
- Treat Angular 21 as a separate deliberate migration, not part of a grouped patch update.

Findings:

- The PR head commit is dependency-focused, but the branch is stale against the recovery baseline.
- Against the current recovery branch, #84 also brings in old audio service/test files, `AGENTS.md` changes, and `story-generator/src/server.ts` churn.
- Root scripts in #84 add audio tests back into required root test commands, which conflicts with the current audio-deferred scope.
- `story-generator/package.json` mixes `@angular/core` `^21.1.5` with multiple Angular `^20.3.x` packages.
- Lockfile churn is large enough that it should not be mixed with the existing unrelated dirty root lockfile/node_modules state.

Validation:

- Inspected `git diff main..pr-84 -- package.json story-generator/package.json`.
- Inspected `git diff --shortstat main..pr-84 -- package-lock.json story-generator/package-lock.json`.

Self-review:

- Good: #84 is no longer sitting in the merge/adapt queue as if it were a clean merge candidate.
- Watch item: A fresh dependency branch is still needed after recovery stabilization.

Running merge-order snapshot after #84:

1. Docs/research/audio mining and closure work.
2. Fresh dependency update from the recovery branch after lockfile state is clean.

## 2026-05-26 14:16 EDT - Recovery PR Opened and Docs/Deployment/Visual Mining Recorded

Actions:

- Ran full recovery preflight with `scripts/recovery/preflight.sh --skip-status`.
- Pushed `recovery-pr70-story-lab-vercel` to GitHub.
- Opened draft recovery PR #87: `https://github.com/Phazzie/FairytaleswithSpice/pull/87`.
- Closed the already handled PRs with comments pointing to #87 and the recovery ledgers:
  - #86, #85, #84, #75, #74, #73, #72, #71, #70, #67, #65, #64, #50, #41, #39, #31, #26, #24.
- Refreshed the open PR list after the first closure batch; remaining source PRs are #77, #76, #63, #56, #55, #54, #53, #47, #45, #44, #43, #42, #40, #30, #29, #28, and #22 plus #87.
- Fetched docs/storage/deployment/visual PR heads into temporary refs:
  - #77, #76, #63, #56, #54, #53, #40.
- Mined and recorded the useful material from:
  - #77 documentation/SDD analysis,
  - #76 WIP SDD redesign body/no-file state,
  - #63 database/story persistence research,
  - #56 cache/storage/monitoring/rate-limit research,
  - #54 deployment-readiness checklist ideas,
  - #53 documentation lifecycle/archive cleanup,
  - #40 UI layout/state clarity ideas.

Validation:

- `scripts/recovery/preflight.sh --skip-status` passed before pushing #87.
- Covered checks: required tool precheck with `jq` warning, `git diff --check`, Angular app typecheck, Angular spec typecheck, root story/trope/cliffhanger/story-lab-state tests, Node 20 Angular production build, and build-output verification.
- Known warnings remain:
  - `jq` is not installed locally.
  - Angular build reports stale `baseline-browser-mapping`.
  - `src/app/proving-grounds/proving-grounds.css` exceeds the component CSS budget by about 1.15 kB.

Self-review:

- Good: #87 now gives every old PR closure a concrete replacement branch instead of an abstract plan.
- Good: The docs/storage/deployment/visual mining happened before those PRs are closed, preserving the material the user asked us not to lose.
- Problem found: Several "docs" or "research" branches are not clean docs branches when compared to the recovery baseline; they carry stale `api/lib` rewrites, Vercel file deletions, audio scope, node_modules churn, or DigitalOcean runtime assumptions.
- Decision: Close those branches after recording their useful ideas, and recreate any future storage/deploy/docs/UI work from #87 rather than trying to merge stale branch contents.
- Watch item: The remaining audio PRs are likely to contain story-generation spillover, so they need the same evidence-first mining pass before closure.

## 2026-05-26 14:47 EDT - Audio PR Story-Generation Spillover Mined

Actions:

- Fetched audio PR heads into temporary refs:
  - #55, #47, #45, #44, #43, #42, #30, #29, #28, #22.
- Inspected PR bodies, file lists, prompt snippets, audio research docs, and representative parser/service code.
- Recorded PR-by-PR dispositions in `PR70_RECOVERY_LEDGER.md`, `NOT_TAKEN_FEATURE_LEDGER.md`, and `PR_USEFUL_MATERIAL_INVENTORY.md`.

Mined story-generation material:

- #55: audio-first prompt mode, 90+ emotion vocabulary, narrator atmosphere tags, character voice evolution as character-development metadata, and the warning against replacing prose with machine-first JSON.
- #47: tag validation, voice consistency testing, emotion navigation/bookmarks, and optional scene/effect metadata.
- #45: emotion taxonomy, character emotional memory, fuzzy emotion suggestions, and consistency across emotional changes.
- #44: scene/effect trigger metadata, emotion distribution and character-count QA signals, and SFX-provider caution.
- #43: character personality profiles and output analysis for neutral-tag overuse, low emotion variety, and oversized casts.
- #42: audio background-job semantics with start/status/result/cancel/progress and separation from story-generation streaming.
- #30/#29/#28/#22: explicit speaker/narrator tags, segment/result models, modular parser/voice/stitching seams, and quote-based fallback parsing.

Decision:

- Do not port active audio runtime, UI, provider, SFX, or player code now.
- Preserve the material as a future "audio-ready story generation" backlog.
- If audio returns, rebuild from #87 using current `api/_lib`, Story Lab contracts, Vercel-compatible storage/queue choices, and an explicit prompt/metadata seam.

Self-review:

- Good: The highest-risk knowledge loss from stale audio PRs is now recorded before closure.
- Good: The branch still avoids audio runtime scope and DigitalOcean/provider drift.
- Problem found: Several audio PRs solve the same problem in slightly incompatible ways. The later PRs are richer conceptually, but the earlier PRs are cleaner for modular parser/segment contract ideas.
- Follow-up: Close the audio PRs with comments that name both what was mined and what was not taken.

Closure result:

- Closed #55, #47, #45, #44, #43, #42, #30, #29, #28, and #22 with ledger-backed comments.
- Refreshed GitHub open PR list after closure; only #87 remains open.

## 2026-05-26 15:32 EDT - Vercel Deployment Stabilized

Actions:

- Installed `jq` locally for the recovery preflight script.
- Investigated the first Vercel preview failures after the audio/docs mining pass.
- Added `scripts/recovery/ensure-vercel-index.sh` so Angular's `index.csr.html` output is materialized as `index.html` for Vercel's static fallback.
- Updated root build scripts so `npm run build` and `npm run build:verify` both enforce that Vercel fallback file.
- Added Vercel API function TypeScript compilation to `scripts/recovery/preflight.sh`.
- Fixed stale Vercel function imports:
  - removed Next.js request/response type imports from plain Vercel functions,
  - corrected `api/export/save.ts` from `../lib/*` to `../_lib/*`,
  - corrected `api/story-lab/stream/genesis.ts` imports,
  - replaced API-side `.at(-1)` calls with compiler-compatible indexed reads,
  - removed stale `api/story/stream.ts.backup`.
- Reduced the deployed Vercel function count by removing deferred active audio endpoints/services and moving Story Lab helper modules under `api/_lib/story-lab/*`.
- Updated API docs and env checks so XAI/Grok remains active and ElevenLabs/audio runtime is not required for this recovery branch.

Deployment result:

- Deployment `dpl_9rTrwwQqQfqpHziJX91pcFjShrKA` for commit `0e96ef2` failed in Vercel TypeScript compilation.
- Deployment `dpl_EG7eEreP8fW9uax2XNi2AWnSJEdT` for commit `cfc4be1` built successfully but ended `ERROR` after output deployment, consistent with excess deployable API functions.
- Deployment `dpl_CopbfUAYcFL8BhwSJ82BumMGLeo5` for commit `528233f` is `READY`.
- Vercel reports `lambdaRuntimeStats: {"nodejs":12}` for the ready deployment.
- Preview URL: `https://fairytaleswith-spice-dapa55dm3-phazzies-projects.vercel.app`
- Branch alias: `https://fairytaleswith-spice-git-recovery-pr70-e629d8-phazzies-projects.vercel.app`
- A normal unauthenticated `curl` hit Vercel Authentication for protected preview URLs.
- Vercel connector verification:
  - root URL returned `200 OK` and served the Angular shell,
  - `/api/health` returned `200 OK` through a temporary Vercel share/access flow,
  - `/api/health` reported production environment and `grok: configured`.

Validation:

- `jq --version` returns `jq-1.8.1`.
- `scripts/recovery/preflight.sh --quick --skip-status` passed after the Vercel function-count reduction.
- `scripts/recovery/preflight.sh --skip-status` passed after the final report and docs updates.
- Manual Vercel API typecheck passed:
  - `find api -name '*.ts' ! -name '*.spec.ts' ! -name '*.test.ts' -print0 | xargs -0 npx tsc --noEmit --target es2020 --lib es2020,dom --module commonjs --moduleResolution node --esModuleInterop --skipLibCheck --types node`
- `npm run build:verify` passed after the Angular fallback index fix.
- `git diff --check` passed before the Vercel fix commits.

Self-review:

- Good: The branch now has a concrete ready Vercel deployment, not just local build confidence.
- Good: The preflight script now catches the API function compilation class that Vercel caught remotely.
- Problem found: Helper TypeScript files under non-underscore `api/story-lab/*` counted as deployable Vercel functions. Moving helpers under `api/_lib/story-lab/*` was necessary.
- Problem found: Deferred audio code was still active enough to affect Vercel deployment shape. Removing active audio routes/services better matches the user's audio-deferred direction.
- Problem found: Protected preview deployments need an authenticated or share-token smoke path; unauthenticated curl alone is not a useful runtime signal.
- Should have anticipated sooner: Vercel deployment should have been run before closing the last source PRs, because local Angular/root checks did not exercise Vercel's per-function compiler or function-count constraints.

## 2026-05-27 12:51 EDT - PR #87 Finish-And-Merge Scope Freeze

Actions:

- Replaced the broad next-phase execution plan with `PR87_NEXT_EXECUTION_PLAN.md`, a narrower finish-and-merge plan for PR #87.
- Added `PR87_FINISH_TURNOVER_LETTER.md` so a compacted or future context can resume without rediscovering the current direction.
- Reviewed Spark's completed checklist output and accepted only the pieces that reduce merge/deploy risk.
- Kept the Vercel function-count guard path:
  - `scripts/recovery/check-vercel-function-count.sh`
  - `scripts/recovery/preflight.sh`
- Reworked Spark's Proving Grounds CSS output:
  - rejected the one-line minified stylesheet as not merge-ready,
  - restored readable formatting and hover/focus/spinner affordances,
  - raised the Angular `anyComponentStyle` warning threshold from `10kB` to `12kB` so source readability is not traded away for a warning-only budget.
- Reverted the root `package.json` `test:grok-smoke` script addition from the current PR scope; the untracked Grok smoke test idea remains deferred follow-up material.
- Fixed two SonarCloud security findings that appeared after the branch push:
  - replaced dynamic chapter-title `RegExp` construction in `api/_lib/services/storyService.ts`,
  - removed Angular `bypassSecurityTrustHtml` usage from `story-generator/src/app/streaming-story/streaming-story.component.ts` and let Angular's `[innerHTML]` sanitizer handle streamed HTML.

Decision:

- PR #87 is now in polish/merge mode. Do not add Story Lab adapter, persistence, AI evals, dependency refresh, or audio runtime work before merging this recovery baseline.

Validation:

- `scripts/recovery/check-vercel-function-count.sh` passed and reported `12/12`.
- `git diff --check` passed.
- `cd story-generator && npx -p node@20 -c "node -v && npm run build"` passed with Node v20.20.2. The Proving Grounds CSS budget warning is gone; the stale `baseline-browser-mapping` warning remains.
- `scripts/recovery/preflight.sh --skip-status` passed after the SonarCloud fixes.

Self-review:

- Spark was useful for fast bounded work, but its CSS fix proved why final merge polish needs a senior review gate.
- The better release decision is to merge #87 as a clean baseline and move valuable but nonessential validation/planning ideas into smaller follow-up PRs.

## 2026-05-27 13:45 EDT - Review Follow-Up And Two-Agent Plan

Actions:

- Addressed the still-relevant review findings after PR #87 merged:
  - aligned frontend/backend API envelopes as discriminated `ApiResponse<T>` unions,
  - added Story Lab empty-body guards,
  - allowed the frontend creature set through API validation without crashing trope subversion,
  - preserved author-style selection for `siren` and `djinn` through the fairy style profile,
  - hardened Proving Grounds accessibility, comparison state updates, and random ID generation,
  - replaced remaining `Math.random` ID/security-hotspot usage in active app/API code,
  - pinned recovery CI actions and disabled checkout credential persistence,
  - tightened the Vercel function-count guard with an explicit allow-list,
  - kept `typescript` pinned to a patch range in the root package files.
- Completed a second review-comment sweep for remaining concrete, low-risk findings:
  - fixed creation header format on trope/cliffhanger helper files,
  - removed cliffhanger type skew from question-mark-only endings,
  - replaced `Date.now()`-only Story Lab mock IDs with UUIDs,
  - added Story Lab stream enum/range validation before contract casts,
  - rejected invalid `requestedChapterCount` values in the legacy story stream route,
  - added theme-chip `aria-pressed`,
  - tightened debug/app CSS contrast and wrapping rules.
- Updated `scripts/recovery/preflight.sh` to call local TypeScript binaries directly because `npx tsc` can hang under npm exec parsing on this machine.
- Added `plan.md`, a self-contained two-agent execution plan for the next major Story Lab productionization chunk.
- Pointed `AGENTS.md` at `plan.md` with the instruction that the plan starts only after the current polish branch is merged.
- Addressed PR #89 Gemini follow-up comments:
  - rejected non-array `themes` in `api/story/stream.ts`,
  - corrected the Proving Grounds template selector to use `role="radio"` with `aria-checked`,
  - added a non-`Math.random` preview-selection fallback for environments without Web Crypto.
- Addressed PR #89 Codex/Copilot follow-up comments:
  - updated the debug panel to read the enveloped Story Lab health response,
  - mapped `siren` and `djinn` in backend creature display text,
  - made live upstream stream errors reject instead of emitting successful completion,
  - removed flow-content headings from interactive Proving Grounds buttons,
  - added explicit numeric validation for legacy stream `spicyLevel` and `wordCount`.

Validation:

- `git diff --check` passed.
- `scripts/recovery/check-vercel-function-count.sh` passed and reported `12/12`.
- Direct Vercel API typecheck passed:
  - `find api -name '*.ts' ! -name '*.spec.ts' ! -name '*.test.ts' -print0 | xargs -0 node_modules/.bin/tsc --noEmit --target es2020 --lib es2020,dom --module commonjs --moduleResolution node --esModuleInterop --skipLibCheck --types node`
- `scripts/recovery/preflight.sh --quick --skip-status` passed.
- `scripts/recovery/preflight.sh --skip-status` passed after docs/plan updates.
- After the second review sweep, `scripts/recovery/preflight.sh --quick --skip-status` passed again.
- After the second review sweep, `cd story-generator && npx -p node@20 -c "node -v && npm run build"` passed.
- After PR #89 Gemini follow-ups, `git diff --check`, `scripts/recovery/check-vercel-function-count.sh`, direct Vercel API typecheck, `scripts/recovery/preflight.sh --quick --skip-status`, and the Node 20 Angular build passed again.
- After PR #89 Codex/Copilot follow-ups, `git diff --check`, `scripts/recovery/check-vercel-function-count.sh`, direct Vercel API typecheck, `scripts/recovery/preflight.sh --quick --skip-status`, and the Node 20 Angular build passed again.
- `npm run build:verify` passed after the final Angular build.
- Known warning remains: `baseline-browser-mapping` reports stale browser data during the Angular build.
- Existing mock-mode root tests still print word-count variance warnings, but the suite exits passing.

Self-review:

- Good: The review fixes stayed mostly in hardening/contract territory instead of adding new product scope.
- Good: The new `plan.md` separates the next large work from the review-polish branch.
- Problem found: Running `npx tsc -p ...` inside preflight hung as `npm exec`; direct local `tsc` binaries are more predictable for this repo.
- Problem found: A stricter discriminated API response type immediately exposed an evaluation-route variable collision.
- Should have anticipated sooner: Review comments that look cosmetic can expose real boundaries, especially API envelope shape and Vercel function counting.

## 2026-05-27 21:05 EDT - Story Lab Real Engine Work Started

Actions:

- Created `STORY_LAB_REAL_ENGINE_EXEC_PLAN.md` with three implementation critique/revision passes and three autonomous execution-plan critique/revision passes.
- Updated `AGENTS.md` so future Story Lab generation work starts from the new real-engine plan.
- Added first-class Story Lab generation context to the real story engine contract:
  - logline,
  - tone,
  - protagonist and antagonist names,
  - world details,
  - narrative directives,
  - full theme seed metadata.
- Updated the real `StoryService` prompt builder so Story Lab blueprint fields are explicit prompt constraints rather than flattened into a generic user-input blob.
- Added `api/_lib/story-lab/storyLabEngine.ts` to orchestrate Story Lab genesis and continuation through the real `StoryService` when `XAI_API_KEY` is configured.
- Kept mock Story Lab generation only for missing provider key or explicit `STORY_LAB_FORCE_MOCK`.
- Wired Story Lab genesis, continuation, and streaming genesis routes to the new Story Lab engine orchestration.
- Marked mock Story Lab telemetry as `custom` instead of `gpt`.
- Added `tests/story-lab-real-engine.test.ts` and a root `test:story-lab-real-engine` script.
- Added an explicit test proving configured provider failure returns the provider error instead of silently falling back to mock Story Lab output.

Validation:

- `git diff --check` passed.
- Direct Vercel API typecheck passed after replacing an `.at(-1)` use that the ES2020 Vercel typecheck target rejected.
- `npm run test:story-lab-real-engine` passed.
- `npm run test:story-lab-state` passed.
- `npm run test:all` passed.
- `scripts/recovery/check-vercel-function-count.sh` passed and reported `12/12`.
- `scripts/recovery/preflight.sh --quick --skip-status` passed.
- Node 20 Angular build passed with `npx -p node@20 -c "node -v && npm run build"`.

Self-review:

- Good: Story Lab no longer needs a permanent lossy adapter to reach the real engine; the rich blueprint now enters the real prompt contract as structured context.
- Good: Configured provider failures should not silently fall back to fake Story Lab content.
- Problem found: Story Lab continuity state derived from real prose is still heuristic. That is acceptable for this slice only because it is not represented as durable storage or AI-grade story analysis.
- Should have anticipated: the Vercel API typecheck target still rejects `.at()`, so new recovery code should use index access consistently.

## 2026-05-27 22:52 EDT - PR90 Automated Review Fixes

Actions:

- Addressed automated review feedback on PR #90:
  - canonicalized Story Lab theme IDs before passing them to the classic engine instead of casting free-form IDs to `ThemeType`,
  - preserved full Story Lab theme seeds in `generationContext`,
  - carried trope metadata through `StorySummary` so continuations can reuse the original trope-subversion state,
  - changed continuation content assembly to fall back from empty `rawContent` to `htmlContent`,
  - sent SSE headers and the initial `connected` event before awaiting real generation,
  - forwarded `protagonistName`, `antagonistName`, and `worldDetails` through the streaming genesis path,
  - converted partial real-engine batch failures into explicit Story Lab errors instead of silently returning a shorter completed batch,
  - mapped real `StoryService` processing time into Story Lab telemetry latency,
  - replaced regex-based HTML/speaker-tag stripping with linear scans to satisfy SonarCloud hotspot checks,
  - fixed timestamp headers on new files and updated word-count pacing guidance for 600 and 1500 words.

Validation:

- `git diff --check` passed before the first review-fix amend.
- `npm run test:story-lab-real-engine` passed after review fixes.
- Direct Vercel API typecheck passed after review fixes.
- Angular TypeScript check passed with `cd story-generator && npx tsc --noEmit --project tsconfig.json`.

Self-review:

- Good: The review comments improved the architecture instead of just polishing style. Theme canonicalization and trope metadata preservation directly protect story-generation quality.
- Problem found: The first implementation made the streaming endpoint production-capable in name but still delayed the first event until after generation. The fix makes the endpoint at least connection-honest, though true token/chapter streaming remains future work.
- Should have anticipated: Story Lab's free-form theme IDs and the classic engine's closed `ThemeType` union were a contract mismatch. The rich `generationContext` made this survivable, but the classic field still needed canonicalization.

## 2026-05-28 00:27 EDT - PR90 Merged and Production Smoke Tested

Actions:

- Merged PR #90 into `main` as merge commit `0af83b397396ecca9707d5151252df18a1247a4b`.
- Created `demo/story-lab-shipping-readiness` from updated `main`.
- Added `.agent/PLANS.md` and `STORY_LAB_DEMO_SHIPPING_EXEC_PLAN.md`, then linked the demo-shipping plan from `AGENTS.md`.
- Smoke-tested production Vercel at `https://fairytaleswith-spice.vercel.app`.
- Added `STORY_LAB_DEMO_READINESS_REPORT.md`.

Validation and evidence:

- PR #90 checks were green immediately before merge.
- Main Recovery CI passed after merge.
- Vercel deployment completed after merge.
- Production `/api/health` returned `success: true`, `data.environment: "production"`, and `data.services.grok: "configured"`.
- Production Story Lab genesis returned `success: true` and `telemetry.engine: "grok"`. Example run evidence: story id `story_ea1bcf73-cee6-444a-ae0b-22187557c6be`, title `Reefbound Vow`.
- Production Story Lab continuation returned `success: true` and `telemetry.engine: "grok"`. Example run evidence: appended chapter number `2`.
- Production frontend root returned HTTP 200 and served the Angular app shell.

Self-review:

- Good: The app now has deployed proof that Story Lab reaches the real Grok-backed engine and can continue a story.
- Good: The follow-up plan was kept out of PR #90 and committed on a fresh post-merge branch.
- Problem found: Main-branch SonarCloud quality gate is red after the merge due to broader recovery-era hotspots and duplicated new-code density. It does not block the deployed demo, but it should be handled in a dedicated hardening branch.
- Should have anticipated: PR-level Sonar success and main-branch quality-gate success are different evidence. The PR passed; main still evaluates broader branch conditions.

## 2026-05-28 01:40 EDT - MVP Browser Smoke Work Started

Actions:

- Created `mvp/story-lab-public-readiness` from updated `main`.
- Added `MVP_TO_SHIPPING_EXEC_PLAN.md` and linked it from `AGENTS.md`.
- Added a Playwright-backed browser smoke script at `scripts/recovery/story-lab-browser-smoke.mjs`.
- Added root script `npm run smoke:story-lab-ui`.
- Gated the public debug panel behind `?debug=1` instead of rendering it for every public user.
- Added `STORY_LAB_MVP_READINESS_REPORT.md` as a candidate report.

Validation:

- `git diff --check` passed.
- `npm run test:story-lab-real-engine` passed.
- `scripts/recovery/preflight.sh --quick --skip-status` passed.
- `npm run test:all` passed.
- `STORY_LAB_SMOKE_SKIP_BUILD=1 npm run smoke:story-lab-ui` passed after the full smoke build exposed an over-broad heading assertion.

Self-review:

- Good: The first MVP work attacks the weakest previous evidence: browser-level Story Lab use, not just API curl proof.
- Good: The debug panel is preserved for recovery but removed from the default public surface.
- Problem found: `ng serve` was too slow and process-fragile for an autonomous smoke gate in this checkout. The smoke now builds with Node 20 and serves the built output directly.
- Should have anticipated: Browser smoke selectors must be exact enough to distinguish app title, story title, and chapter headings.

## 2026-05-28 01:56 EDT - PR92 Review Fixes

Actions:

- Addressed automated review feedback on PR #92:
  - changed debug-panel visibility from a one-time `window.location.search` read to Angular `ActivatedRoute.queryParamMap`,
  - added stable `data-testid` hooks for the Story Lab smoke path,
  - updated the Playwright smoke to use those hooks and avoid hard-coded generated story copy,
  - hardened static-file path resolution in the smoke server so requests cannot escape the built output directory,
  - guarded browser cleanup so Chromium launch errors are not masked,
  - made the smoke build use the current Node when it is already Node 20 and only fall back to `npx node@20` when needed,
  - removed the regex route matcher that Sonar flagged as a security hotspot,
  - replaced public error guidance that pointed normal users to the hidden debug panel,
  - corrected the deployed-smoke command in the ExecPlan so real-provider evidence requires `STORY_LAB_SMOKE_LIVE=1`.

Validation:

- `git diff --check` passed.
- `node --check scripts/recovery/story-lab-browser-smoke.mjs` passed.
- `cd story-generator && ../node_modules/.bin/tsc -p tsconfig.app.json --noEmit` passed.
- `cd story-generator && ../node_modules/.bin/tsc -p tsconfig.spec.json --noEmit` passed.
- `npm run test:story-lab-real-engine` passed.
- `scripts/recovery/preflight.sh --quick --skip-status` passed.
- `npm run smoke:story-lab-ui` passed after rebuilding with Node `v20.20.2` and driving the built app through mocked genesis and continuation.
- `npm run test:all` passed with the existing mock-mode key/word-count warnings.

Self-review:

- Good: The review fixes improved the smoke harness instead of just quieting bots. Live mode no longer depends on a specific generated title.
- Good: The debug panel remains recoverable through `?debug=1` while following Angular route state.
- Problem found: Stable smoke selectors are now part of the UI contract; future markup edits must preserve or deliberately update them.
- Should have anticipated: Any live AI browser smoke must avoid asserting exact generated prose or titles, because model output is intentionally variable.

## 2026-05-28 02:10 EDT - PR92 Preview Smoke Blocked by Vercel Auth

Actions:

- Confirmed PR #92 checks were green on commit `473fa9f`.
- Tried live browser smoke against the Vercel preview URL:
  - `STORY_LAB_SMOKE_URL=https://fairytaleswith-spice-git-mvp-story-lab-d390c3-phazzies-projects.vercel.app STORY_LAB_SMOKE_LIVE=1 npm run smoke:story-lab-ui`
- Confirmed the preview root returns HTTP `401`, so unauthenticated live browser smoke cannot prove the branch preview.
- Stopped the smoke attempt instead of waiting for its full timeout.

Decision:

- Merge PR #92 after checks are green, then run live browser smoke against production Vercel for MVP evidence.

## 2026-05-28 02:15 EDT - PR92 Merged and Production Browser Smoke Passed

Actions:

- Merged PR #92 into `main` as commit `fb3549fa5b088475a67534ef94e0d3dfe93ee78c`.
- Confirmed local checkout is on updated `main`.
- Confirmed main Recovery CI passed for the merge commit.
- Confirmed Vercel production deployment completed for the merge commit.
- Confirmed production root returned HTTP `200`.
- Ran production live browser smoke:
  - `STORY_LAB_SMOKE_URL=https://fairytaleswith-spice.vercel.app STORY_LAB_SMOKE_LIVE=1 npm run smoke:story-lab-ui`
  - Result: passed.
- Updated `STORY_LAB_MVP_READINESS_REPORT.md` with production evidence.

Self-review:

- Good: MVP evidence now covers both deterministic local UI mechanics and real deployed Grok-backed browser usage.
- Good: The debug panel is hidden from normal users while still recoverable with `?debug=1`.
- Problem found: Main SonarCloud remains red on broader recovery-era criteria after the merge. This belongs in Tier 2 shipping hardening, not in the already-merged MVP proof.
- Should have anticipated: The MVP report needed a post-merge evidence update branch because production proof necessarily happens after the MVP PR lands.

## 2026-05-28 02:43 EDT - Shipping Hardening Started

Actions:

- Continued on `shipping/story-lab-hardening` after PR #93 had recorded production MVP smoke evidence.
- Inspected the only remaining open PR, #88, and treated it as dependency-security input rather than a direct merge candidate.
- Updated dependency manifests and lockfiles beyond PR #88's patch levels:
  - root `axios` now targets `^1.16.1`,
  - Story Generator `axios` now targets `^1.16.1`,
  - Angular runtime packages now target `20.3.22`,
  - Angular CLI/build/SSR packages now target `20.3.26`,
  - Angular build/type tooling is now in `devDependencies` instead of production dependencies.
- Cleaned generated root `node_modules` churn from the worktree instead of committing generated dependency files.
- Queried main SonarCloud issue state and found 120 open issues on `main`.
- Fixed the two top source issues from the Sonar query:
  - flattened the static smoke server fallback path in `scripts/recovery/story-lab-browser-smoke.mjs`,
  - rewrote Story Lab speaker-tag stripping in `api/_lib/story-lab/storyLabEngine.ts` to avoid assigning to a `for` loop counter.
- Created `STORY_LAB_SHIPPING_READINESS_REPORT.md`.
- Updated `MVP_TO_SHIPPING_EXEC_PLAN.md`, `PR70_RECOVERY_LEDGER.md`, and `LESSONS_LEARNED.md` with the shipping-hardening disposition and risk classification.

Dependency/security evidence gathered:

- `npm audit --omit=dev --json` at the root reported zero vulnerabilities.
- `cd story-generator && npm audit --omit=dev --json` reported zero vulnerabilities.
- `cd story-generator && npm audit --omit=dev --omit=optional --json` reported zero vulnerabilities.
- `cd story-generator && npm audit --json` still reported seven dev/test-toolchain findings through Karma/socket dependencies.

Validation:

- `git diff --check` passed after generated `node_modules` churn was restored.
- `node --check scripts/recovery/story-lab-browser-smoke.mjs` passed.
- `scripts/recovery/preflight.sh --quick --skip-status` passed, including function count, Angular app/spec typechecks, and direct Vercel API typecheck.
- `npm run test:story-lab-real-engine` passed.
- `npm run test:all` passed with expected mock-mode `XAI_API_KEY` and word-count warnings.
- `npm run smoke:story-lab-ui` passed in mocked mode after building with Node `v20.20.2`; Angular reported the known `baseline-browser-mapping` stale-data warning and completed in 345.796 seconds.
- `npm run build:verify` passed.

Decision:

- Supersede PR #88 after this shipping-hardening branch is merged. PR #88 is dependency-only, but this branch updates to fresher dependency versions and does so on the current Story Lab baseline.

Self-review:

- Good: Runtime dependency risk is materially reduced instead of merely documented.
- Good: The branch fixes small high-signal Sonar issues immediately instead of using the report as an excuse.
- Problem found: Full dev audit is still red because Karma's dependency chain has vulnerable transitive packages.
- Problem found: The repo has tracked root `node_modules` files from old history; generated changes to those files should not be included in this branch.
- Should have anticipated: A stale Dependabot branch can be mergeable but still not be the right dependency answer once newer patch releases exist.

## 2026-05-28 03:07 EDT - PR94 CI Whitespace Fix

Problem:

- PR #94 Recovery CI failed during `git diff --check` after `npm ci` because the repository still tracks historical root `node_modules` files.
- Installing dependencies on GitHub mutated those generated files, and `git diff --check` reported whitespace inside the generated axios package diff.

Fix:

- Updated `scripts/recovery/preflight.sh` so the whitespace/conflict-marker check excludes `node_modules/**` and `story-generator/node_modules/**`.

Self-review:

- Good: This preserves the rule that generated dependency churn should not be committed.
- Problem found: Local validation passed because local `node_modules` churn had been restored before preflight; CI exposed the install-order variant.
- Should have anticipated: Any workflow that runs `npm ci` before `git diff --check` must exclude tracked generated dependency paths until the old tracked `node_modules` history is removed.

## 2026-05-28 03:11 EDT - PR94 Review Fix

Problem:

- Gemini review correctly noted that the smoke server's SPA fallback should not serve `index.html` for missing static assets such as JavaScript, CSS, or images.

Fix:

- Updated `scripts/recovery/story-lab-browser-smoke.mjs` so only extensionless paths use the SPA fallback candidates.
- Static asset paths now return `404` when the requested file is absent instead of receiving HTML with the wrong MIME/type expectations.

Validation:

- `node --check scripts/recovery/story-lab-browser-smoke.mjs` passed.
- `STORY_LAB_SMOKE_SKIP_BUILD=1 npm run smoke:story-lab-ui` passed.

## 2026-05-28 03:18 EDT - PR94 Merged and Shipping Evidence Recorded

Actions:

- Merged PR #94, `Harden Story Lab shipping readiness`, into `main` as merge commit `a71aef4dec43c8720096b4db5b21dc051a6a3c06`.
- Closed Dependabot PR #88 as superseded by PR #94's fresher dependency update.
- Confirmed the open PR list is empty after the closure.
- Confirmed main Recovery CI passed for `a71aef4`.
- Confirmed main Dependabot Updates workflow passed for `a71aef4`.
- Confirmed Vercel production deployment succeeded for `a71aef4`.
- Confirmed production root `https://fairytaleswith-spice.vercel.app` returned HTTP `200`.
- Ran production live browser smoke:
  - `STORY_LAB_SMOKE_URL=https://fairytaleswith-spice.vercel.app STORY_LAB_SMOKE_LIVE=1 npm run smoke:story-lab-ui`
  - Result: passed.
- Updated `STORY_LAB_SHIPPING_READINESS_REPORT.md` with the post-merge evidence.

Self-review:

- Good: Shipping readiness is now based on merged-main evidence, not branch-local optimism.
- Good: PR #88 was closed only after the replacement dependency work landed and production checks passed.
- Problem found: The final evidence update itself needed a small follow-up branch because the report could only be fully accurate after merge.
- Should have anticipated: Any report that promises post-merge production status should reserve a final docs-only pass to record the exact merge commit and production smoke result.

## 2026-05-28 03:28 EDT - PR95 Dev/Test Audit Cleanup Merged

Actions:

- Found new Dependabot PR #95 after the shipping evidence pass.
- Inspected #95 and confirmed it was lockfile-only for `story-generator/package-lock.json`.
- Merged PR #95 as `d1b7458b71d232b5e38e94755776c69c7c165381`.
- Confirmed open PR list is empty after the merge.
- Confirmed main Recovery CI passed for `d1b7458`.
- Confirmed Vercel production deployment succeeded for `d1b7458`.
- Confirmed production root `https://fairytaleswith-spice.vercel.app` returned HTTP `200`.
- Ran production live browser smoke:
  - `STORY_LAB_SMOKE_URL=https://fairytaleswith-spice.vercel.app STORY_LAB_SMOKE_LIVE=1 npm run smoke:story-lab-ui`
  - Result: passed.

Dependency/security evidence:

- `cd story-generator && npm audit --omit=dev --json` still reports zero vulnerabilities.
- `cd story-generator && npm audit --json` now reports four dev/test-toolchain findings, down from seven.
- Remaining full-audit findings are `engine.io`, `socket.io-adapter`, `socket.io-parser`, and `ws`.

Self-review:

- Good: The follow-up PR was small, green, and improved a documented risk, so merging it was better than leaving it open.
- Problem found: The final report had already become stale because the queue changed immediately after the docs-only evidence PR.
- Should have anticipated: Dependabot can open a cleanup PR immediately after a dependency branch lands; final reports should be checked against the PR queue one last time before calling the queue closed.

## 2026-05-28 18:00 EDT - Grok Multi-Agent Story Lab Polish Implemented

Actions:

- Created and continued `feature/grok-multiagent-story-lab-polish` from the Grok multi-agent polish plan.
- Added centralized xAI story configuration in `api/_lib/config/xaiConfig.ts` with default model `grok-4.20-multi-agent` and default reasoning effort `medium`.
- Added `api/_lib/services/xaiTextClient.ts` so active story generation, continuation, evaluation, continuity extraction, API-key verification, and the opt-in live smoke use one xAI Responses API path.
- Migrated Story Lab evaluation away from a hard-coded model string and direct chat-completions payload.
- Added AI-assisted continuity extraction with explicit `ai`, `heuristic`, or `mixed` receipts and visible fallback warnings.
- Added browser-local saved story projects in `story-generator/src/app/story-workspace-storage.service.ts`; Story Lab now autosaves generated/continued stories, restores the latest saved story on load, and lets users load/delete saved browser-local projects.
- Reworked the Story Lab UI into a writer's workbench with saved-story rail, blueprint studio, chapter reader, continuity weave, Grok model badge, and a generated bitmap atmosphere asset at `story-generator/public/story-lab-atmosphere.png`.
- Added deterministic story-quality evals in `tests/story-quality-evals.test.ts` and included them in `npm run test:all`.
- Extended the Story Lab browser smoke to verify restore-on-refresh in mock mode and capture desktop and mobile screenshots.

Validation:

- `npm run smoke:grok-multi-agent` passed the no-credential skip path.
- `npm run test:story-quality` passed.
- `npm run test:story-lab-state` passed.
- `npm run test:story-lab-real-engine` passed.
- `node_modules/.bin/tsc -p story-generator/tsconfig.app.json --noEmit` passed.
- `node_modules/.bin/tsc -p story-generator/tsconfig.spec.json --noEmit` passed.
- `npm run test:all` passed.
- `git diff --check` passed.
- `scripts/recovery/preflight.sh --quick --skip-status` passed, including function count, Angular app/spec typechecks, and Vercel API typecheck.
- `npm run smoke:story-lab-ui` passed in mocked mode after a Node 20 build; screenshots were written to `tmp/story-lab-smoke/mock-success.png` and `tmp/story-lab-smoke/mock-mobile-success.png`.
- `node_modules/.bin/tsx tests/verify-ai-fixes.test.ts` passed.
- `node_modules/.bin/tsx tests/verify-api-keys.ts` was not a usable pass/fail signal locally because `XAI_API_KEY` is absent; it failed closed with "XAI_API_KEY not found in environment."
- `npm audit --omit=dev --json` at the root reported zero vulnerabilities.
- `cd story-generator && npm audit --omit=dev --json` reported zero vulnerabilities.
- `cd story-generator && npm audit --json` still reported the known four dev/test-toolchain findings: `engine.io`, `socket.io-adapter`, `socket.io-parser`, and `ws`.

Self-review:

- Good: The model migration is centralized and Grok-only; no OpenAI runtime dependency or provider abstraction was added.
- Good: The UI is now visibly product-specific without replacing the first screen with a landing page.
- Good: Persistence is labeled and implemented as browser-local instead of pretending the app has accounts or cloud storage.
- Problem found: The xAI Responses smoke initially used top-level `await`, which this repo's CJS-oriented `tsx` path rejected.
- Problem found: True token streaming was not completed in this pass; the existing SSE route remains a final-result path over the migrated Responses call.
- Assumption still pending: Live Grok multi-agent behavior needs `RUN_REAL_GROK_MULTI_AGENT_SMOKE=1` and `XAI_API_KEY` to verify provider acceptance of the payload in this environment.
- What should be fixed before merge: open the branch as a focused PR, run CI, and run production live Story Lab smoke after deployment.

## 2026-05-28 18:13 EDT - PR98 Review and Sonar Fixes

Problem:

- PR #98 Recovery CI passed and Vercel preview deployed, but SonarCloud failed the quality gate on log-injection hotspots in live-key helper scripts.
- Gemini review flagged malformed LLM/provider response shapes that could crash `continuityExtractor.ts` and `xaiTextClient.ts`.

Fix:

- Removed provider-returned model/text/usage logging from `tests/grok-multi-agent-smoke.test.ts` and `tests/verify-api-keys.ts`; the scripts now log configured model/effort plus output length only.
- Hardened xAI response text extraction against null response entries.
- Hardened continuity JSON parsing against valid-but-non-object JSON and skipped null/non-object entries in AI-provided characters, threads, and artifacts.
- Replaced continuity extractor regex-based Markdown fence stripping and HTML-to-text conversion with deterministic scanners to clear Sonar regex backtracking hotspots.

Validation:

- `npm run smoke:grok-multi-agent` passed the no-credential skip path.
- `npm run test:story-quality` passed.
- `node_modules/.bin/tsc -p story-generator/tsconfig.app.json --noEmit` passed.
- `node_modules/.bin/tsc -p story-generator/tsconfig.spec.json --noEmit` passed.
- `scripts/recovery/preflight.sh --quick --skip-status` passed.
- `node_modules/.bin/tsx tests/verify-ai-fixes.test.ts` passed.
- `npm run test:story-quality` and `scripts/recovery/preflight.sh --quick --skip-status` passed again after the regex-hotspot fix.
- `git diff --check` passed.

Self-review:

- Good: The review comments were correct and cheap to fix; the branch is safer for malformed AI output.
- Problem found: Test/helper logging can still fail a production quality gate when it logs provider-controlled strings.
- Should have anticipated: New live smoke scripts should default to non-content telemetry from the start.

## 2026-05-28 18:42 EDT - Post-Merge Production 504 Follow-Up

Problem:

- PR #98 merged and the production root returned HTTP 200, but the production live Story Lab browser smoke failed.
- Browser console evidence showed `POST /api/story-lab/stories` returning HTTP 504 before `[data-testid="story-panel"]` appeared.
- The likely cause was not a provider mismatch; it was a synchronous Vercel request waiting on Grok multi-agent generation and then a second AI continuity extraction call.

Fix in progress:

- Kept the app Grok-only and left `grok-4.20-multi-agent` as the primary Story Lab generation model.
- Added a bounded Grok fallback path in the shared xAI Responses client: retryable timeout/server failures fall back to `grok-4.3`.
- Budgeted multi-chapter batches so only the first generated chapter attempts multi-agent; later chapters in the same batch use the fast Grok path.
- Added config helpers for primary and fast request timeouts so production is not tied to 60-90 second local development assumptions.
- Moved continuity extraction and Story Lab evaluation to the fast Grok path with shorter timeouts.
- Added `fallbackFromModel` telemetry so the UI can say when a fast Grok fallback was used instead of pretending multi-agent completed.
- Updated the browser smoke harness so Vercel `_vercel_share` preview URLs skip the raw Node `fetch` preflight and let Playwright handle the auth flow.
- Changed the initial Story Lab default to one chapter per batch so the first demo path does not begin with avoidable multi-call latency.

Validation:

- `node_modules/.bin/tsx tests/verify-ai-fixes.test.ts` passed.
- `node --check scripts/recovery/story-lab-browser-smoke.mjs` passed.
- `npm run smoke:grok-multi-agent` passed the no-credential skip path.
- `npm run test:story-quality` passed.
- `npm run test:story-lab-real-engine` passed.
- `scripts/recovery/preflight.sh --quick --skip-status` passed.
- `npm run test:all` passed.
- `git diff --check` passed.
- `npm run smoke:story-lab-ui` passed in mock mode after a fresh Node 20 Angular build.
- Authenticated Vercel preview live smoke passed after the timeout/default follow-up:
  - `STORY_LAB_SMOKE_URL='https://fairytaleswith-spice-git-fix-grok-mult-7c8417-phazzies-projects.vercel.app/?_vercel_share=zDsTJzlsbLjfLIP4sF7m1Chmvy8rpwX6' STORY_LAB_SMOKE_LIVE=1 npm run smoke:story-lab-ui`

Self-review:

- Good: The correction stayed inside the xAI client and canonical story service instead of adding another provider adapter or reintroducing mocks.
- Good: The UI telemetry now exposes fallback behavior rather than hiding it.
- Problem found: The original multi-agent plan anticipated higher latency, but did not turn that anticipation into a Vercel request-budget policy before merge.
- Problem found during self-review: Story Lab defaults to a two-chapter batch, so a primary-plus-fallback retry per chapter was still too much worst-case latency. The fix now lets only the first chapter attempt multi-agent and uses fast Grok for later chapters in the same batch.
- Problem found during preview smoke: the protected Vercel preview failed the smoke harness before browser auth because the harness used Node `fetch`; after bypassing that preflight, the app reached the UI but live generation still failed with the 9s fast fallback timeout, so the first-attempt fast fallback budget was raised while extra batch chapters stay capped.
- Should have anticipated: If generation and continuity both call live AI in one serverless request, their worst-case timeouts must be budgeted together, not judged one call at a time.

## 2026-05-28 19:11 EDT - PR99 Merged and Production Live Smoke Restored

Actions:

- Merged PR #99, `Bound Grok multi-agent Story Lab latency`, into `main` as merge commit `e859bb825656ed7a08c8a361079bde4e86c76503`.
- Confirmed main Recovery CI passed for `e859bb8`.
- Confirmed Vercel production deployment completed for `e859bb8`.
- Confirmed production root `https://fairytaleswith-spice.vercel.app` returned HTTP 200 with `last-modified: Thu, 28 May 2026 23:10:29 GMT`.
- Ran production live Story Lab browser smoke:
  - `STORY_LAB_SMOKE_URL=https://fairytaleswith-spice.vercel.app STORY_LAB_SMOKE_LIVE=1 npm run smoke:story-lab-ui`
  - Result: passed.

Self-review:

- Good: The failure that Vercel exposed is now represented as executable behavior and durable documentation, not just a chat observation.
- Good: The final proof used production, not only a protected preview.
- Remaining risk: Very slow Grok provider responses can still fail closed, especially if a user deliberately asks for larger multi-chapter batches. The default demo path is now one chapter and has passed live production smoke.

## 2026-05-28 19:19 EDT - Provider Variability Follow-Up

Problem:

- A second production live smoke against the docs-only deployment reached the app but failed closed with "AI service temporarily unavailable."
- The previous production smoke had passed with the same Story Lab code, so the issue is provider latency variance rather than a deterministic route/build failure.

Fix in progress:

- Reduced the primary multi-agent probe timeout from 18s to 8s.
- Raised the fast Grok fallback budget from 20s to 30s.
- Kept extra batch chapters capped at 9s so non-default multi-chapter batches do not consume the full Vercel function window.

Self-review:

- Good: This keeps the app Grok-only and still attempts multi-agent first.
- Problem found: A fallback that succeeds once but fails on a second smoke is still too fragile for "show it to someone" readiness.
- Should have anticipated: In a synchronous serverless UI flow, the experimental multi-agent call should be treated as a short probe, not as the main latency budget.

## 2026-05-28 19:26 EDT - Final Grok-Only Production Smoke Passed

Actions:

- Confirmed `main` is at commit `4fb64b6`, `Prioritize fast Grok fallback budget`.
- Confirmed Recovery CI passed for `4fb64b6`.
- Confirmed Vercel reported deployment success for `4fb64b6`.
- Confirmed production root `https://fairytaleswith-spice.vercel.app` returned HTTP 200 with `last-modified: Thu, 28 May 2026 23:24:41 GMT`.
- Ran production live Story Lab browser smoke:
  - `STORY_LAB_SMOKE_URL=https://fairytaleswith-spice.vercel.app STORY_LAB_SMOKE_LIVE=1 npm run smoke:story-lab-ui`
  - Result: passed.

Self-review:

- Good: The final proof used the public production URL after the provider-variability fix, not only the earlier successful deployment.
- Good: The app remains Grok-only: `grok-4.20-multi-agent` is the short primary probe and `grok-4.3` is the visible fast fallback for retryable timeout/server failures.
- Remaining risk: This is still a synchronous live-provider workflow. It is demoable now, but larger chapter batches, provider incidents, or very slow responses can still fail closed.
- What should be next: if production reliability has to survive repeated public usage, move long-running generation to a job/streaming architecture or make fast Grok the default button path with multi-agent as an explicit deep mode.

## 2026-05-29 02:06 EDT - Grok 4.3 Promoted To Default

Actions:

- Checked production health and confirmed `services.grok: "configured"`.
- Called production `/api/story-lab/stories` directly with the Story Lab smoke blueprint.
- Confirmed real story generation returned HTTP 200 with a generated story titled `Debt of the Singing Reef`.
- Observed telemetry showed `model: "grok-4.3"` and `fallbackFromModel: "grok-4.20-multi-agent"`, proving the working path was the fallback model.
- Changed the default story model from `grok-4.20-multi-agent` to `grok-4.3`.
- Kept `XAI_STORY_MODEL` as an override so multi-agent can be tested intentionally later.

Self-review:

- Good: This makes the default app path match the model that actually returned production stories.
- Good: The change removes hidden dependency on fallback behavior for normal generation.
- Risk: The browser smoke still needs repair because one run timed out on `page.goto()` before testing generation, even though HTTP root and direct API calls succeeded.
- What should be next: improve the smoke harness, then redesign the UI on a separate branch.

## 2026-05-29 02:41 EDT - Grok 4.3 Default Deployed and Verified

Actions:

- Pushed commit `ab4de1a`, `Default Story Lab to Grok 4.3`, to `main`.
- Confirmed Recovery CI passed for `ab4de1a`.
- Confirmed Vercel reported deployment success for `ab4de1a`.
- Confirmed production root returned HTTP 200 with `last-modified: Fri, 29 May 2026 06:40:59 GMT`.
- Called production `/api/story-lab/stories` after deployment with the Story Lab smoke blueprint.
- Confirmed the response returned `success: true`, title `Reefbound Vows`, `model: "grok-4.3"`, `fallbackFromModel: null`, and `latencyMs: 11106`.

Self-review:

- Good: The normal generation path no longer burns time on a multi-agent probe before reaching the model that actually works.
- Good: The status matrix now separates working generation from degraded continuity extraction and weak UI quality.
- Remaining risk: Continuity extraction still returned `source: "mixed"` with a warning, so story generation is working better than the AI enrichment layer.
- What should be next: add a direct production API smoke script for this exact proof, then fix the browser smoke navigation timeout before UI redesign work.

## 2026-06-03 04:16 EDT - Charmed Story Lab MVP Validated Locally

Actions:

- Updated the active Charmed MVP plan in `STORY_LAB_CHARMED_MVP_EXEC_PLAN.md` and linked it from `AGENTS.md`.
- Ran a hostile review pass against the plan and current diff. The review found stale browser-smoke selectors, missing Angular coverage, missing production continuation fail-closed proof, style-routing drift from the plan, undocumented Proving Grounds contract alignment, and unrelated untracked files.
- Updated `story-generator/src/app/app.spec.ts` to cover skin persistence, expanded creature/spice options, friendly `AI_UNAVAILABLE` messaging, direction-chip continuation wiring, clipboard copy, and local HTML download.
- Updated `scripts/recovery/story-lab-browser-smoke.mjs` for the new card-based UI and added mocked smoke coverage for skin selection, expanded creature selection, visible progress, direction continuation, copy, and HTML download.
- Updated `tests/story-lab-real-engine.test.ts` to prove production missing-key fail-closed behavior for both genesis and continuation, while preserving development/mock behavior.
- Documented intentional creature style routing: `witch`, `angel`, and `mermaid` use fairy-adjacent styles; `dragon` uses werewolf-adjacent styles; `demon` uses vampire-adjacent styles until dedicated banks exist.
- Kept Proving Grounds edits limited to shared creature-contract alignment; the normal public first screen still hides Proving Grounds unless debug mode is requested.
- Trimmed `story-generator/src/app/app.css` until the fresh build no longer emitted the component CSS budget warning.

Validation:

- `git diff --check`: passed.
- `cd story-generator && ../node_modules/.bin/tsc -p tsconfig.app.json --noEmit`: passed.
- `cd story-generator && ../node_modules/.bin/tsc -p tsconfig.spec.json --noEmit`: passed.
- `npm run test:story-lab-real-engine`: passed.
- `npm run smoke:story-lab-ui`: passed in mocked mode after a fresh Angular build.
- `scripts/recovery/preflight.sh --quick --skip-status`: passed.

Self-review:

- Good: The Charmed MVP is now validated against the card-based UI instead of the old workbench controls.
- Good: Production fail-closed behavior is executable evidence for both Story Lab genesis and continuation.
- Good: The public UI path gained local share/export without adding accounts, server PDF, email, or cloud state.
- Remaining risk: The branch has not run a live production/provider smoke. That should happen after merge or preview deployment with real `XAI_API_KEY`.
- Not part of this MVP: unrelated untracked `SPARK_TRIAL_TASKS.md`, `STORY_QUALITY_EVALS_PLAN.md`, and `tests/grok-smoke.test.ts` remain untouched for a separate cleanup/commit decision.

## 2026-06-03 05:28 EDT - Platform Evolution Plan and Heat Contract v0

Actions:

- Created `STORY_LAB_PLATFORM_EVOLUTION_EXEC_PLAN.md` as the self-contained post-Charmed platform plan.
- Ran three adversarial review passes against the plan: product/UX, architecture/deployment, and testing/security.
- Incorporated hater findings into the plan:
  - no storage/jobs/auth/audio/server export on this branch;
  - auth/privacy/retention/deletion before cloud persistence;
  - function-count checks before and after API route changes;
  - Vercel Workflow as the only durable-generation target, with non-Workflow polling labeled non-durable;
  - Director's Room reframed as concrete draft-improvement notes instead of process theater.
- Added dedicated style banks for `witch`, `dragon`, `demon`, `angel`, and `mermaid`, with semantic coverage tests.
- Expanded Story Lab stream genesis parsing to accept the full Charmed creature set and preserve Heat Contract data.
- Added `scripts/recovery/story-lab-live-provider-smoke.mjs` and `npm run smoke:story-lab-live-provider`; the script skips without credentials by default and requires Grok telemetry when enabled.
- Added Heat Contract v0:
  - frontend contract type and UI controls;
  - adult-only/consensual fantasy validation;
  - tension mode and intimacy boundary controls;
  - no-go content field;
  - browser-local blueprint persistence through the existing save path;
  - reader-side Heat Contract summary;
  - Story Lab engine mapping into `generationContext`;
  - backend refusal if a submitted Heat Contract is explicitly unconfirmed.
- Linked the platform plan from `AGENTS.md`.

Validation:

- `git diff --check`: passed.
- `cd story-generator && ../node_modules/.bin/tsc -p tsconfig.app.json --noEmit`: passed.
- `cd story-generator && ../node_modules/.bin/tsc -p tsconfig.spec.json --noEmit`: passed.
- `npm run test:story-lab-real-engine`: passed.
- `npm exec -- tsx tests/story-lab-stream-parse.test.ts`: passed.
- `npm run smoke:story-lab-live-provider`: passed in default skip mode.
- `scripts/recovery/check-vercel-function-count.sh`: passed at `12/12`.
- `scripts/recovery/preflight.sh --quick --skip-status`: passed, including Angular app/spec typechecks and Vercel API function typechecks.

Blocked local validation:

- `cd story-generator && npm test -- --watch=false --include=src/app/app.spec.ts --include=src/app/form-validation.service.spec.ts`: started but hung locally under Node `v23.8.0` after Chrome/Karma startup.
- `cd story-generator && npm run build`: started but hung locally under Node `v23.8.0` in Angular/esbuild after the baseline-browser-mapping warning.

Self-review:

- Good: The work improved user-facing safety/story control without adding cloud state, new API routes, or audio/export scope.
- Good: The live-provider smoke can no longer pass on arbitrary non-mock telemetry; enabled proof must be Grok.
- Good: The future plan now treats current function-count, auth, privacy, CORS, export, and logging concerns as gates rather than polish.
- Remaining risk: Angular build/browser-spec validation still needs a Node 20 or CI run before this slice should be called fully browser-verified.
- What should be next: run the Angular build/spec checks under Node 20, then do an opt-in live-provider smoke against a Vercel preview or production URL with real `XAI_API_KEY`.

## 2026-06-05 00:33 EDT - Platform Plan Checklist and Phase B1 Gate

Actions:

- Rewrote `STORY_LAB_PLATFORM_EVOLUTION_EXEC_PLAN.md` so the future work is a checklist instead of a broad phase list.
- Counted completed Phase A work in the plan progress and outcomes.
- Split the old Phase B into smaller gates:
  - Phase B1: shared parser, auth port, owner authorization, and redaction;
  - Phase B2: CORS and account boundary policy;
  - Phase B3: retention, deletion, and export-sanitizer policy;
  - Phase B4: opaque job-id streaming design.
- Completed Phase B1 locally:
  - POST and stream Story Lab genesis now normalize through one shared server blueprint parser;
  - Story Lab account auth now has a deny-by-default `AuthPort`;
  - `authorizeProjectAccess` denies non-owner project access without leaking project ids in the user-facing message;
  - server and client error logging redact story text, prompts, auth headers, API keys, emails, and artifact URLs.
- Kept storage, job routes, audio, server export, auth-provider selection, and cloud writes out of this gate.

Validation:

- `npm exec -- tsx tests/story-lab-blueprint-parser.test.ts`: passed.
- `npm exec -- tsx tests/story-lab-auth.test.ts`: passed.
- `npm exec -- tsx tests/log-redaction.test.ts`: passed.
- `npm exec -- tsx tests/story-lab-stream-parse.test.ts`: passed.
- `npm run test:story-lab-state`: passed.
- `npm run test:story-lab-real-engine`: passed.
- `npx -p node@20 node ./node_modules/typescript/bin/tsc -p story-generator/tsconfig.spec.json --noEmit`: passed.
- `npx -p node@20 node ./node_modules/typescript/bin/tsc --allowJs false --skipLibCheck --module commonjs --target es2022 --moduleResolution node --types node --noEmit tests/story-lab-blueprint-parser.test.ts tests/story-lab-auth.test.ts tests/log-redaction.test.ts tests/story-lab-stream-parse.test.ts`: passed.

Blocked local validation:

- `npx -p node@20 node ./node_modules/@angular/cli/bin/ng.js test --watch=false --include src/app/error-logging.spec.ts`: built the targeted spec bundle, then Chrome failed to capture within 60 seconds in this runner.

Self-review:

- Good: Completed work is now counted in the plan rather than hidden in chat history.
- Good: The next phases are explicit gates, so CORS/privacy/export/job decisions do not get bundled into parser/auth/redaction work.
- Remaining risk: Browser-run error-logging coverage still needs CI or a local Chrome environment that can capture under Karma.
- What should be next: publish this finished work in a PR, address review comments, then start Phase B2 only after the PR is clean.
