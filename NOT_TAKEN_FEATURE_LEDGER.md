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
