Created: 2026-05-26 00:12 EDT

# Not-Taken Feature Ledger

This file records useful material that is intentionally not merged or only partially ported during the PR #70 recovery. The purpose is to prevent old PR closures from losing future ideas.

## How To Use

For every closed or partially ported PR:

1. Add an entry before closing the GitHub PR.
2. Separate story-generation material from audio/deployment/UI-only material.
3. Include enough source detail for future mining.
4. State why the material was not taken now.

Template:

```markdown
## PR #NN - Title

- Disposition:
- Source branch:
- Story-generation ideas not taken:
- Other useful ideas not taken:
- Why not now:
- Future extraction notes:
- Source files/commits:
```

## Initial High-Priority Mining Buckets

### Story Generation

- #24: trope database, trope subversion service, prompt enhancement, uniqueness metadata.
- #31: story arc service, cliffhanger analysis, continuation context.
- #73: story state snapshots, character arcs, plot threads, continuity deltas.
- #72/#75/#71: multi-chapter structures, requested chapter counts, partial failure semantics.
- #65/#64/#67/#50: model/token/randomization/config/progress correctness.
- #74: prompt proving grounds and evaluation loops.

### Audio PRs With Story-Generation Spillover

- #55: voice evolution, emotion taxonomy, narrator atmosphere, character consistency.
- #45: fuzzy emotion matching and character memory.
- #44: character-driven narration and scene/sound metadata.
- #43: emotion-aware profiles and character control concepts.
- #42: streaming/emotion architecture ideas.
- #30/#29/#28/#22: dialogue parsing, speaker tags, segment models, voice metadata boundaries.

### Deployment And Storage

- #54: DigitalOcean deployment infrastructure. Not Vercel direction.
- #56: provider-specific backend services; mine cache/rate-limit ideas only.
- #63: database decision tree; use as reference for a new Vercel storage decision.

## PR #50 - Fix progress meter hanging at 95% preventing story generation

- Disposition: mined; close later as superseded by PR #70 baseline
- Source branch: `pr-50`
- Story-generation ideas not taken:
  - Old progress-simulator implementation that manually steps generation progress to 95%.
  - Timeout-protection UI around the old single-story generation form.
- Other useful ideas not taken:
  - `app-no-progress.ts.alternative`, which removed the progress simulator entirely.
  - `PROGRESS_METER_FIX.md` root documentation.
- Why not now:
  - PR #70 replaced the old app shell with the story-lab workbench, and the old `simulateGenerationProgress()`/`progressTimeoutId` code no longer exists.
  - Merging #50 directly would drag stale UI, audio-era controls, and old backend assumptions into the recovery branch.
- Future extraction notes:
  - If simulated progress is reintroduced for batch generation, store timeout IDs immediately after each `setTimeout()` and clear pending timeouts on success/error.
  - Avoid hydration bypasses that break form controls; test interactive form state after SSR/hydration changes.
- Source files/commits:
  - `PROGRESS_METER_FIX.md`
  - `story-generator/src/app/app.ts`
  - `story-generator/src/app/app.html`
  - `story-generator/src/app/app-no-progress.ts.alternative`

## PR #64 - Complete PR#61 randomization and test cleanup

- Disposition: selected port; close later as superseded
- Source branch: `pr-64`
- Story-generation ideas not taken:
  - No additional story-generation prompt logic beyond the Fisher-Yates Chekhov element fix was taken.
  - Old branch versions of story service files that rename or duplicate service paths.
- Other useful ideas not taken:
  - Playwright E2E scaffold and `e2e/story-generation.spec.ts`.
  - Test documentation and old Angular spec adjustments.
  - PR completion summary docs.
- Why not now:
  - The branch is stale against the Vercel `_lib` path and #70 UI baseline.
  - Direct merge would bring path regressions, dependency churn, and old UI/test assumptions.
- Future extraction notes:
  - Recreate E2E smoke coverage after the story-lab UI is stable, using #64 only as a reference.
  - Revisit test expectations after #72/#75 multi-chapter decisions are made.
- Source files/commits:
  - `api/lib/services/storyService.ts`
  - `story-generator/src/api/lib/services/storyService.ts`
  - `playwright.config.ts`
  - `e2e/story-generation.spec.ts`

## PR #65 - Fix AI story generation model and token issues

- Disposition: selected port; close later as superseded
- Source branch: `pr-65`
- Story-generation ideas not taken:
  - No additional prompt feature was omitted; the current canonical service already contains the main model, token, `top_p`, and timeout changes.
  - The branch's stale `api/lib/*` service path is not taken.
  - The duplicate story service structure is not accepted as permanent architecture.
- Other useful ideas not taken:
  - None beyond path/layout decisions.
- Why not now:
  - Direct merge is unnecessary and would reintroduce stale path assumptions.
  - Duplicate cleanup should be handled deliberately in #67 instead of being hidden inside the #65 port.
- Future extraction notes:
  - Keep the verifier focused on canonical service behavior and run it after any model or token-budget changes.
  - Centralize model name, token calculation, API parameters, and timeouts so future PRs cannot fix one service copy while leaving another stale.
- Source files/commits:
  - `api/lib/services/storyService.ts`
  - `story-generator/src/api/lib/services/storyService.ts`
  - `tests/verify-ai-fixes.test.ts`

## PR #67 - SOLID/KISS/DRY audit and duplicate cleanup

- Disposition: selected port; close later as superseded
- Source branch: `pr-67`
- Story-generation ideas not taken:
  - Full prompt-builder extraction.
  - Content formatter extraction.
  - Story analyzer extraction.
  - Beat-structure configuration extraction.
  - Chekhov element configuration extraction.
  - Mock data service extraction.
- Other useful ideas not taken:
  - `COMPREHENSIVE_AUDIT_REPORT.md` as a root report.
  - `DEPLOYMENT_READINESS.md`.
  - DigitalOcean deployment checklist and rollback process.
  - Old `api/lib/*` file layout.
- Why not now:
  - The extraction ideas are useful but larger than the safe #67 port and should happen after multi-chapter/story-state decisions settle.
  - The deployment doc conflicts with the Vercel direction.
  - The recovery already has active tracking docs; adding another root audit report would increase status-doc drift.
- Future extraction notes:
  - When the story service is next refactored, split prompt construction, content formatting, story analysis, beat structures, and Chekhov elements into canonical `api/_lib` modules.
  - Use the #67 audit as a checklist for future service decomposition, not as deploy guidance.
- Source files/commits:
  - `COMPREHENSIVE_AUDIT_REPORT.md`
  - `DEPLOYMENT_READINESS.md`
  - `api/lib/config/authorStyles.ts`
  - `story-generator/src/api/lib/*`
  - `tests/story-service-improved.test.ts`

## PR #24 - Invisible trope subversion engine

- Disposition: selected port; close later as superseded
- Source branch: `pr-24`
- Story-generation ideas not taken:
  - The old `backend/src/services/storyService.ts` implementation.
  - Generated `backend/dist/*` files.
  - Demo script and old standalone integration scripts.
  - Some raw comedic/parody trope inversions that could weaken dark-romance tone if injected directly.
  - Full continuation-state persistence for trope metadata; only optional metadata propagation is in place now.
- Other useful ideas not taken:
  - `TROPE_SUBVERSION_SUMMARY.md` as a root product doc.
  - Old backend contracts and frontend contract edits.
- Why not now:
  - The backend tree is stale and outside the current Vercel `api/_lib` architecture.
  - #70 owns the story-lab UI/contracts, and #72/#73 should decide the durable story-state model.
  - The recovery docs already track the feature; another root summary would add document drift.
- Future extraction notes:
  - Thread `tropeMetadata` through the #72/#75 continuation UI and #73 story-state snapshot if those ports land.
  - Add a developer-only debug/proving-ground view for selected trope directives if #74 is ported.
  - Consider deterministic selection for reproducible tests and user support.
- Source files/commits:
  - `backend/src/data/tropeDatabase.ts`
  - `backend/src/services/tropeSubversionService.ts`
  - `backend/src/services/storyService.ts`
  - `backend/src/tests/*`
  - `story-generator/src/app/contracts.ts`

## PR #31 - Chapter continuation, story arc, and audiobook system

- Disposition: selected port; close later as superseded
- Source branch: `pr-31`
- Story-generation ideas not taken:
  - In-memory story-arc CRUD service.
  - Story arc model with characters, world state, character growth, and chapter metadata.
  - Story arc endpoint.
  - Frontend story arc management UI.
  - Full enhanced continuation prompt from the old branch; only the cliffhanger variety slice was ported.
- Other useful ideas not taken:
  - Audiobook compilation service and endpoint.
  - Create-audiobook UI.
  - Old `vercel.json` routing changes.
- Why not now:
  - Audio is deferred.
  - In-memory story arcs are misleading on Vercel serverless because persistence is not durable.
  - #70 owns the story-lab UI and #72/#73 should decide the real multi-chapter/state contract.
- Future extraction notes:
  - Use #31's story arc model as a reference when porting #73 state snapshots.
  - Use #31's frontend story arc affordances only after #72/#75 settle the chapter batching workflow.
  - Reopen audiobook compilation only in a later audio phase.
- Source files/commits:
  - `api/lib/services/storyArcService.ts`
  - `api/story/arc.ts`
  - `api/lib/services/storyService.ts`
  - `api/lib/types/contracts.ts`
  - `api/audio/compile.ts`
  - `api/lib/services/audiobookService.ts`
  - `story-generator/src/app/*`

## PR #72 - Finalize multi-chapter story workflows

- Disposition: selected port; close later as superseded
- Source branch: `pr-72`
- Story-generation ideas not taken:
  - Full replacement of generation outputs with chapter-array-only responses.
  - Full replacement of continuation outputs with chapter-array-only responses.
  - Raw PR #72 failure semantics as the only response shape; the recovery branch kept old success/error fields and added optional `failedChapters`.
  - Old `tests/story-service.test.mjs` rewrite that still assumes compiled `api/lib/*.js` output.
  - Old frontend batch-merging code for the pre-#70 Angular app.
- Other useful ideas not taken:
  - Old chapter-batch dropdown implementation in `story-generator/src/app/app.html`.
  - Old `story-generator/src/app/story.service.ts` changes targeting `/api/story/*` instead of #70's `/api/story-lab/*`.
  - Old debug-panel and streaming component spec changes that are superseded by the #70 story-lab contracts.
- Why not now:
  - #70 already introduced a story-lab workbench, batch-size control, and separate story-lab contracts.
  - Directly taking #72's frontend would regress the app away from the #70 direction.
  - Directly taking #72's backend contract would break current legacy callers and tests by removing fields instead of adding batch metadata.
  - The branch uses stale `api/lib/*` paths.
- Future extraction notes:
  - When `api/story-lab/mockData.ts` is replaced with real generation, use the canonical `StoryService` batch fields created from this port.
  - Add UI display for partial chapter failures and next-chapter hints when #75 continuity panels are evaluated.
  - Decide and document whether a batch's word budget is total-batch or per-chapter before exposing production controls.
- Source files/commits:
  - `api/lib/services/storyService.ts`
  - `api/lib/types/contracts.ts`
  - `api/story/generate.ts`
  - `api/story/continue.ts`
  - `api/story/stream.ts`
  - `story-generator/src/app/contracts.ts`
  - `story-generator/src/app/story.service.ts`
  - `story-generator/src/app/app.ts`
  - `story-generator/src/app/app.html`
  - `tests/story-service-improved.test.ts`

## PR #75 - Add chapter batching workflow and continuity panels

- Disposition: selected port; close later as superseded
- Source branch: `pr-75`
- Story-generation ideas not taken:
  - PR #75's separate `ChapterBatchSeam` shape and `/api/story/batch` route.
  - The old frontend service changes targeting a standalone batch endpoint instead of the #70 `beginStory()` / `continueStory()` story-lab seam.
  - Durable/asynchronous queue semantics beyond UI-local progress state.
  - The old continuation-panel data assumptions where they conflicted with the current `StoryIterationPayload`.
- Other useful ideas not taken:
  - Direct pre-#70 Angular app shell rewrite.
  - Large old CSS redesign.
  - README workflow edits that describe the older app shape.
  - `story-generator/src/testing/test-data-factory.ts`; current #70 specs already use local story-lab fixtures.
- Why not now:
  - #75 is stale against the PR #70 story-lab baseline and overlaps heavily with #72's backend batching work.
  - The current app already has batch-size controls and continuity panels, so a direct merge would replace current working seams rather than enhance them.
  - Creating another batch route before #73 persistence decisions would increase API drift.
- Future extraction notes:
  - Revisit fuller queue semantics if story generation becomes backgrounded, resumable, or backed by durable Vercel storage/workflows.
  - Add partial-failure UI once the story-lab route returns canonical #72 `failedChapters` data.
  - Update README after #73 decides persistence/session recovery.
- Source files/commits:
  - `story-generator/src/app/contracts.ts`
  - `story-generator/src/app/story.service.ts`
  - `story-generator/src/app/app.ts`
  - `story-generator/src/app/app.html`
  - `story-generator/src/app/app.css`
  - `story-generator/src/app/app.spec.ts`
  - `story-generator/src/app/story.service.spec.ts`
  - `story-generator/src/testing/test-data-factory.ts`
  - `README.md`

## PR #73 - Add persistent story state tracking and schema

- Disposition: selected port; close later as superseded
- Source branch: `pr-73`
- Story-generation ideas not taken:
  - Legacy `StoryStateService` implementation under `api/lib/services/storyStateService.ts`.
  - Direct mutation of the old `api/lib/services/storyService.ts` generation flow.
  - PR #73's older `StoryState`, `StoryStateDelta`, `CharacterArc`, `PlotThread`, and `ContinuityDevice` contract shapes as replacements for #70's richer story-lab state snapshot contracts.
  - Database-backed chapter append semantics until the production story-lab adapter exists.
- Other useful ideas not taken:
  - DigitalOcean Postgres provisioning README.
  - DigitalOcean-shaped SQL schema as active project schema.
  - `pg` dependency and dynamic Postgres client.
  - Old `api/lib/db/*` layout.
  - Duplicate `story-generator/src/api/lib/types/contracts.ts` contract copy.
- Why not now:
  - The deployment target is Vercel, not DigitalOcean.
  - A durable storage product has not been selected.
  - In-memory persistence is not reliable on Vercel serverless, so the port keeps it explicitly transient and does not expose it as product durability.
  - #70 already has the state snapshot model the UI consumes; replacing it would add churn without improving the current app.
- Future extraction notes:
  - Revisit the SQL schema when choosing Vercel Postgres/Neon or another durable store.
  - Use the accepted `StoryStateDelta` and `StoryPersistenceReceipt` shapes as the adapter contract for real storage.
  - If durable storage lands, add read/update tests for story recovery, state divergence, and chapter append conflicts.
- Source files/commits:
  - `api/lib/db/README.md`
  - `api/lib/db/client.ts`
  - `api/lib/db/schema.sql`
  - `api/lib/services/storyStateService.ts`
  - `api/lib/services/storyService.ts`
  - `api/lib/types/contracts.ts`
  - `story-generator/src/app/contracts.ts`
  - `tests/story-service-improved.test.ts`

## PR #71 - Support batch chapter generation across backend and frontend

- Disposition: tiny selected port; close later as superseded
- Source branch: `pr-71`
- Story-generation ideas not taken:
  - Early batch-generation implementation after #72's more mature backend port.
  - Service-level clamping of invalid requested chapter counts.
  - Old partial-failure response shape where it conflicts with the current `failedChapters` data field.
  - Old `tests/story-service.test.mjs` rewrite that imports stale `api/lib/*`.
- Other useful ideas not taken:
  - Old Angular batch dropdown and warning UI.
  - Old `story-generator/src/testing/data-factory.ts`.
  - Old debug-panel and streaming component test changes.
  - Old frontend service changes targeting `/api/story/*` rather than #70's story-lab seam.
- Why not now:
  - #72 already supplied the backend batch primitive in canonical `api/_lib`.
  - #75 already supplied the current story-lab batch UI affordances.
  - #73 already supplied state-delta and persistence-boundary behavior.
  - Silent service-level clamping can hide bad callers; current behavior rejects invalid counts explicitly.
- Future extraction notes:
  - Consider UI-level clamping or disabled controls if users need forgiving batch selection.
  - Recreate a frontend test-data factory only if future Angular specs begin duplicating large fixtures.
- Source files/commits:
  - `api/lib/services/storyService.ts`
  - `api/lib/types/contracts.ts`
  - `api/story/generate.ts`
  - `api/story/continue.ts`
  - `story-generator/src/app/app.*`
  - `story-generator/src/app/contracts.ts`
  - `story-generator/src/app/story.service.ts`
  - `story-generator/src/testing/data-factory.ts`
  - `tests/story-service.test.mjs`

## PR #74 - Add proving grounds page for prompt testing and generation logic inspection

- Disposition: selected port; close later as ported
- Source branch: `pr-74`
- Story-generation ideas not taken:
  - Direct production prompt override wiring from the proving-grounds template editor.
  - Treating the generation logic viewer's random author/beat/Chekhov selections as guaranteed production generation inputs.
  - Client-side Grok/xAI evaluation with API keys stored in browser `localStorage`.
- Other useful ideas not taken:
  - Direct merge of old app-shell routing and header layout.
  - Deletion from `story-generator/src/testing/index.ts`.
  - Old `StoryService.generateStory()` method shape.
  - Full old CSS as product-ready design; it was carried as a functional first pass and still needs budget/polish follow-up.
- Why not now:
  - The current #70 Story Lab seam is canonical and does not expose direct prompt-template override semantics yet.
  - Vercel deployment should keep provider credentials server-side.
  - The old app shell would overwrite or confuse the Story Lab baseline.
- Future extraction notes:
  - Add a formal prompt-experiment API that records template, variables, model, response, score, and evaluator metadata.
  - Decide whether proving-grounds logic selections should become production generation controls or remain an inspection/testing aid.
  - Add persistent experiment storage only after the Vercel storage decision is made.
- Source files/commits:
  - `story-generator/src/app/proving-grounds/*`
  - `story-generator/src/app/app-root.ts`
  - `story-generator/src/app/app.routes.ts`
  - `story-generator/src/app/app.config.ts`
  - `story-generator/src/main.ts`
  - `story-generator/src/main.server.ts`
  - `story-generator/src/app/app.routes.server.ts`

## PR #26 - Implement comprehensive UI/UX polish and accessibility improvements

- Disposition: selected port; close later as ported
- Source branch: `pr-26`
- Story-generation ideas not taken:
  - Old retry buttons that simply rerun generation/chapter actions without a batch retry contract.
  - Old validation model based on pre-#70 fields such as `userInput`, `wordCount`, and `selectedThemes` string arrays.
- Other useful ideas not taken:
  - Direct old app-shell rewrite and radio/checkbox layout.
  - Old `generateStory()` and `generateNextChapter()` frontend service method usage.
  - Audio conversion progress UI.
  - Save/download action buttons from the old screen.
  - Old emoji-heavy notification rendering.
  - Broad CSS restyling from the stale UI.
- Why not now:
  - The current app uses the #70 Story Lab blueprint, batch queue, and `beginStory()`/`continueStory()` seam.
  - Audio remains deferred.
  - Save/export needs to be reconnected to current Story Lab state before UI controls are useful.
  - Retrying failed batches should be designed around explicit queue item state, not a blind replay.
- Future extraction notes:
  - Add per-batch retry once failed `BatchProgressState` items can keep enough request metadata to safely replay.
  - Reintroduce save/export notifications when the export flow is wired to current generated chapters.
  - Consider a small notification story/spec harness if toasts become more complex.
- Source files/commits:
  - `story-generator/src/app/notification.service.ts`
  - `story-generator/src/app/form-validation.service.ts`
  - `story-generator/src/app/notifications.component.ts`
  - `story-generator/src/app/notifications.component.css`
  - `story-generator/src/app/app.ts`
  - `story-generator/src/app/app.html`
  - `story-generator/src/app/app.css`

## PR #41 - Comprehensive test coverage and Vercel CI/CD

- Disposition: selected lean CI port; close later as ported
- Source branch: `pr-41`
- Story-generation ideas not taken:
  - None directly; PR #41 is mostly CI/deployment/testing infrastructure.
- Other useful ideas not taken:
  - Direct API/backend Jest package layout.
  - Old `api/lib` path rewrite and current `api/_lib` deletion.
  - Separate security, monitoring, deployment, dependency, and comprehensive CI workflows.
  - Vercel CLI deployment workflow requiring `VERCEL_TOKEN`, `VERCEL_ORG_ID`, and `VERCEL_PROJECT_ID`.
  - API route tests written against stale route/package assumptions.
- Why not now:
  - Current recovery branch should keep Vercel `_lib` helper layout.
  - The repo is not currently organized as the branch's backend/API package structure expects.
  - Deployment secrets and Vercel project linkage should be explicit, not smuggled in through an old workflow.
- Future extraction notes:
  - Rebuild API route tests once the Story Lab API surface is stable.
  - Add preview/prod Vercel deployment workflow only after secrets and project linkage are intentionally configured.
- Source files/commits:
  - `.github/workflows/ci.yml`
  - `.github/workflows/deploy.yml`
  - `.github/workflows/security-quality.yml`

## PR #39 - Implement extensive CI system with 6 comprehensive workflows

- Disposition: mined into lean CI; close later as superseded
- Source branch: `pr-39`
- Story-generation ideas not taken:
  - None directly; PR #39 is workflow infrastructure.
- Other useful ideas not taken:
  - Six-workflow CI suite.
  - README/status badge writer.
  - Lighthouse, visual regression, analytics dashboard, and dependency-management workflows.
  - Contract validation against old `backend/src/types/contracts.ts`.
  - API smoke tests for old endpoint names.
- Why not now:
  - The workflow suite is broader than the recovery branch needs and assumes stale paths.
  - Browser-based CI should wait until local ChromeHeadless capture is reliable or a different browser strategy is selected.
- Future extraction notes:
  - Revisit accessibility/performance workflows after Vercel deployment is stable.
  - Rebuild contract validation after current frontend/backend contract locations are final.
- Source files/commits:
  - `.github/workflows/ci-status.yml`
  - `.github/workflows/contract-validation.yml`
  - `.github/workflows/deployment-optimization.yml`
  - `.github/workflows/visual-testing.yml`
