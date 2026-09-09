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
| #341 | needs a human decision | In review | External-fork PR accepting a Clerk session as a fallback credential when `API_KEYS` is configured; cleanly mergeable, but CI has never run (blocked on maintainer approval for a first-time fork contributor) and Sourcery flagged the authorization-policy change as needing a human reviewer. Status comment posted 2026-09-09; see "Stale-PR triage cycle" below. |
| #322 | rebase-and-merge (maintainer call) | In review | 35-advisory lockfile-only remediation; #318 (the Dependabot PR it unblocks) closed unmerged, replacement #327 repeats the same major-bump-bundling mistake. Status comment posted 2026-09-06; see "Stale-PR triage cycle" below. |
| #316 | needs a human decision | In review | Bearer-token redaction rewrite; clean/green but its own description names two open decisions for the repo owner. Status comment posted 2026-09-06; see "Stale-PR triage cycle" below. |
| #198 | close-as-superseded (maintainer call) | In review | Superseded by `STORY_LAB_LIVING_BOOK_AND_DURABLE_JOBS_EXEC_PLAN.md`, which already directs this PR be closed; branch is stale against current `main` with two ordinary merge conflicts (`AGENTS.md`, `PR70_RECOVERY_CHANGELOG.md`), not unrelated history. Three comments posted 2026-09-06 (original status comment, a disposition-source correction, and a git-ancestry retraction); see "Stale-PR triage cycle" below. |
| #325 | close-as-superseded (maintainer call) | In review | Story Lab Cloud Account/Auth, superseded by #326/#328's shipped-and-hardened Clerk implementation; now has real merge conflicts against `main`, not just doc churn. Status comment posted 2026-09-06; see "Stale-PR triage cycle" below. |
| #327 | needs to be split (maintainer call) | In review | Dependabot 20-update group bundling an Angular 20→22 major jump with unrelated patch/minor bumps — third grouped PR to repeat this pattern after #194 and #318. Status comment posted 2026-09-06; see "Stale-PR triage cycle" below. |
| #347 | merge | merged | This routine's own prior-cycle output (status comments on #325/#327 recorded in the ledger); docs-only, CI green, merged 2026-09-08. |
| #343 | merge | merged | This routine's own prior-cycle output (status comments on #198/#322/#316 plus lessons-learned/exec-plan corrections); docs-only, branch updated against `main` (one-file union conflict in this ledger) to restart CI after a stale Vercel free-tier rate limit, merged 2026-09-08. |
| #95 | merge | merged | Lockfile-only Dependabot PR updated Story Generator `picomatch` and `qs`, reducing full dev/test audit findings from seven to four. |
| #88 | recreate/supersede | superseded; closed | Dependency-only Dependabot PR was superseded by fresher dependency updates in PR #94, then closed. |
| #86 | merge | merged; closed | Merged design system doc; normalized nonzero letter-spacing tokens; closed as superseded by #87. |
| #85 | merge | merged; closed | Merged `path-to-regexp` 8.4.0 lockfile update; closed as superseded by #87. |
| #84 | try merge or recreate | recreate later; closed | Stale grouped dependency update; not merged because it mixes Angular 20/21 and stale audio/path churn. |
| #77 | mine and close | mined and closed | Documentation analysis lessons mined; source docs not merged as root docs. |
| #76 | close | closed no material | PR contains planning/body material but no committed files. |
| #75 | port/cherry-pick | ported; closed | Ported batch queue, suggested prompts, grouped chapter timeline, and Vercel persistence wording into #70 story lab. |
| #74 | port later or mine/close | ported; closed | Ported Proving Grounds as a routed Story Lab prompt-testing page with server-side evaluation fallback. |
| #73 | recreate/port | ported; closed | Ported story-lab state deltas and transient persistence boundary; DigitalOcean Postgres and `pg` dependency not taken. |
| #72 | port/cherry-pick | ported; closed | Ported backward-compatible 1-3 chapter batch generation/continuation into canonical `api/_lib`; old UI/route rewrites not taken. |
| #71 | compare then close | ported; closed | Ported chapter-count response metadata; remaining batch/UI material superseded by #72/#75/#73. |
| #70 | merge baseline | merged; closed | Merged into `recovery-pr70-story-lab-vercel` as commit `118265c`; superseded by #87. |
| #67 | port/cherry-pick | ported; closed | Ported author-style extraction, duplicate-service deletion, path/test fixes, and validation bug fix. |
| #65 | port/cherry-pick | ported; closed | Verified canonical AI fixes; aligned duplicate compiled service timeouts and test path. |
| #64 | port/cherry-pick | ported; closed | Ported Fisher-Yates Chekhov element selection; stale tests/docs/node_modules not taken. |
| #63 | mine and close | mined and closed | Database/story persistence concepts mined for future Vercel storage decision. |
| #56 | mine and close | mined and closed | Cache/storage/monitoring/rate-limit concepts mined; DigitalOcean provider code not taken. |
| #55 | mine and close | mined and closed | Voice evolution, narrator atmosphere, 90+ emotion vocabulary, and audio-first prompt ideas mined; audio runtime not taken. |
| #54 | close | mined and closed | DigitalOcean deployment infra rejected for Vercel; generic deploy checklist ideas mined. |
| #53 | mine and close | mined and closed | Docs cleanup lifecycle ideas mined; node_modules churn not taken. |
| #50 | port/cherry-pick | mined and closed | Old progress simulator fix is superseded by #70 story-lab UI; lessons recorded in not-taken ledger. |
| #47 | mine and close | mined and closed | Audio investigation mined for speaker tags, emotion navigation, voice consistency, and sound-effect scene metadata ideas. |
| #45 | mine and close | mined and closed | Emotion mapping, character memory, fuzzy emotion suggestions, and consistency tracking mined. |
| #44 | mine and close | mined and closed | Character-driven narration, sound-effect trigger metadata, and emotion taxonomy mined. |
| #43 | mine and close | mined and closed | Personality profiles, emotion distribution analysis, and character-control concepts mined. |
| #42 | mine and close | mined and closed | Streaming audio job model, modern ElevenLabs notes, and emotion/tag prompt ideas mined; audio runtime not taken. |
| #41 | port/cherry-pick | ported; closed | Ported a lean Recovery CI workflow; stale API/backend rewrites not taken. |
| #40 | mine and close | mined and closed | Visual interaction/layout ideas mined; mystical app-shell rewrite not taken. |
| #39 | mine and close | mined/ported; closed | Mined CI concepts into the lean Recovery CI workflow; heavyweight suite not taken. |
| #31 | recreate/port | ported; closed | Ported cliffhanger analysis/prompt guidance; story-arc CRUD and audiobook compile mined for later. |
| #30 | mine and close | mined and closed | Dialogue parser, speaker tag contract, segment progress, and voice assignment ideas mined. |
| #29 | mine and close | mined and closed | MultiVoiceAudioService segment model, character voice mapping, and narrator-intimacy ideas mined. |
| #28 | mine and close | mined and closed | Modular parser/voice/stitching breakdown and prompt format updates mined. |
| #26 | port/cherry-pick | ported; closed | Ported notifications, Story Lab validation, inline accessibility/error feedback, and focused service specs. |
| #24 | recreate/port | ported; closed | Ported invisible trope subversion engine into canonical `api/_lib`; old backend/dist/demo files not taken. |
| #22 | mine and close | mined and closed | Early dialogue parsing, quote-based fallback extraction, and emotional context inference mined. |

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

## PR #71 - Support batch chapter generation across backend and frontend

- Source branch: `pr-71` / `codex/update-chapter-generation-logic-and-validations`
- Planned disposition: compare then close
- Actual disposition: ported small response-metadata improvement; otherwise superseded by #72/#75/#73
- Story-generation impact: Medium. #71 was the early batch-generation pass that introduced requested chapter counts, chapter arrays, partial failures, UI batch controls, and test helpers. Most of that has already landed in a newer form.
- Accepted material:
  - Added optional `chaptersRequested`, `chaptersGenerated`, and `partialFailures` fields to canonical `ApiResponse.metadata`.
  - Populated those metadata fields from `StoryService.generateStory()` and `StoryService.continueChapter()`.
  - Added assertions for batch metadata in `tests/story-service-improved.test.ts`.
- Not taking now:
  - Direct branch merge.
  - Old `api/lib/*` path changes.
  - Old `/api/story/generate` and `/api/story/continue` route edits as-is.
  - Old pre-#70 Angular app shell changes.
  - Old batch dropdown UI and warnings; #70/#75 now own that surface.
  - #71's clamping behavior for invalid requested chapter counts.
  - Old `story-generator/src/testing/data-factory.ts`.
  - Old `tests/story-service.test.mjs` rewrite that imports `api/lib/*`.
- Why not taking:
  - #72 is the more mature backend batch implementation and is already ported.
  - #75 is the more relevant #70-compatible UI workflow port and is already ported.
  - #73 now owns state-delta and persistence-boundary work.
  - Explicit validation is clearer than silently clamping invalid requested chapter counts at the service boundary.
  - The old test factory and `.mjs` tests target stale frontend/backend paths.
- Future mining value:
  - If the product wants forgiving batch controls, consider UI-level clamping with visible feedback rather than service-level silent clamping.
  - Recreate frontend test-data factories only if Angular specs become repetitive after #26/#74.
- Files inspected:
  - `api/lib/services/storyService.ts` from PR #71
  - `api/lib/types/contracts.ts` from PR #71
  - `api/story/generate.ts` and `api/story/continue.ts` from PR #71
  - `story-generator/src/app/app.*`, `contracts.ts`, `story.service.ts`, and specs from PR #71
  - `story-generator/src/testing/data-factory.ts` from PR #71
  - `tests/story-service.test.mjs` from PR #71
- Files changed in recovery branch:
  - `api/_lib/types/contracts.ts`
  - `api/_lib/services/storyService.ts`
  - `tests/story-service-improved.test.ts`
  - recovery docs
- Conflicts encountered:
  - GitHub reports PR #71 as conflicting.
  - Conflict shape is old `api/lib` paths, old app shell, stale test path, and overlap with already-ported #72/#75 batch features.
- Tests/checks run:
  - `npx tsx tests/story-service-improved.test.ts` passed with 14/14 tests.
  - `cd story-generator && npx tsc -p tsconfig.app.json --noEmit` passed.
  - `cd story-generator && npx tsc -p tsconfig.spec.json --noEmit` passed.
  - `git diff --check` passed.
  - `npm test` passed all configured suites.
  - `cd story-generator && npx -p node@20 -c "node -v && npm run build"` passed with the existing stale `baseline-browser-mapping` warning.
  - `npm run build:verify` passed from the repo root.
- Self-review notes:
  - The only unique code worth taking was observability metadata.
  - The decision to reject invalid requested chapter counts remains intentional; #71's service-level clamping is recorded for possible UI-level behavior later.
- GitHub PR closure note:
  - Close as ported/superseded after final recovery PR exists, pointing to this ledger and `NOT_TAKEN_FEATURE_LEDGER.md`.

## PR #74 - Add proving grounds page for prompt testing and generation logic inspection

- Source branch: `pr-74` / `copilot/add-proving-grounds-page`
- Planned disposition: port later or mine/close
- Actual disposition: ported selectively into the #70 Story Lab baseline
- Story-generation impact: High. Adds an internal prompt-test workbench for comparing prompt templates, previewing prompt text, inspecting generation logic ingredients, generating Story Lab samples, keeping local test history, comparing results, exporting JSON, and evaluating output quality.
- Accepted material:
  - Added routed `/proving-grounds` page.
  - Ported prompt templates for production, concise, emotional-depth, sensory, and dialogue-driven generation experiments.
  - Ported generation logic viewer data for author styles, beat structures, and Chekhov elements.
  - Ported local test history, comparison mode, JSON export, current-result view, and evaluation display.
  - Adapted generation to the current #70 `StoryService.beginStory()` / `/api/story-lab/stories` seam.
  - Added `api/story-lab/evaluate.ts` so Grok evaluation can happen server-side with `XAI_API_KEY`, with mock fallback when the key or provider is unavailable.
  - Added Angular router integration through `AppRoot`, `app.routes.ts`, `provideRouter`, and a Story Lab header link.
  - Updated `build:verify` to accept Angular SSR's `browser/index.csr.html` output.
- Not taking now:
  - Direct merge of PR #74.
  - Old pre-#70 app-shell changes as-is.
  - Old `StoryService.generateStory()` frontend method usage.
  - Browser `localStorage` storage of xAI API keys.
  - Deletion from `story-generator/src/testing/index.ts`.
  - Treating custom prompt templates as fully wired production prompt overrides; they are currently passed as `narrativeDirectives` through the Story Lab seam.
- Why not taking:
  - The #70 Story Lab shell is now canonical, so PR #74's old app root had to be adapted around it.
  - Provider API keys should stay server-side for Vercel deployment.
  - The current story-lab mock endpoint can accept prompt directives, but production prompt injection still needs a later adapter into canonical story generation.
- Future mining value:
  - Add structured experiment IDs and persistence if prompt testing becomes a team workflow.
  - Add a dedicated server-side prompt-evaluation contract/test suite once real generation replaces mock Story Lab responses.
  - Revisit CSS polish; the imported proving-grounds stylesheet builds but exceeds the Angular component CSS budget by 1.15 kB.
- Files inspected:
  - `story-generator/src/app/proving-grounds/*` from PR #74
  - `story-generator/src/app/app-root.ts` from PR #74
  - `story-generator/src/app/app.routes.ts` from PR #74
  - `story-generator/src/app/app.config.ts`, `main.ts`, and `app.routes.server.ts` from PR #74
  - Current #70 `story-generator/src/app/story.service.ts` and contracts
  - Current `api/story-lab/*` route family
- Files changed in recovery branch:
  - `api/story-lab/evaluate.ts`
  - `package.json`
  - `story-generator/src/app/app-root.ts`
  - `story-generator/src/app/app.routes.ts`
  - `story-generator/src/app/app.config.ts`
  - `story-generator/src/app/app.routes.server.ts`
  - `story-generator/src/app/app.ts`
  - `story-generator/src/app/app.html`
  - `story-generator/src/app/app.css`
  - `story-generator/src/main.server.ts`
  - `story-generator/src/app/proving-grounds/*`
  - recovery docs
- Conflicts encountered:
  - PR #74 is mergeable against `main`, but its old app shell conflicts conceptually with the #70 recovery baseline.
  - The build output changed from `index.html` to `index.csr.html` after server rendering was enabled for routed pages.
  - Initial SSR route verification exposed a split bootstrap bug: browser bootstrap used `AppRoot`, but `main.server.ts` still bootstrapped the Story Lab component directly.
- Tests/checks run:
  - `scripts/recovery/preflight.sh --quick --skip-status` passed.
  - `npm test` passed all configured root suites.
  - `cd story-generator && npx -p node@20 -c "node -v && npm run build"` passed with the existing stale `baseline-browser-mapping` warning and a new component CSS budget warning for proving grounds.
  - `npm run build:verify` passed after widening the expected browser index filename.
  - `PORT=4300 npm run start:prod` plus `curl` route checks confirmed `/` serves Story Lab content and `/proving-grounds` serves the proving-grounds container/test configuration.
- Self-review notes:
  - Good: The page is now a Story Lab route instead of an old-shell replacement.
  - Good: Evaluation no longer asks users to store provider keys in browser localStorage.
  - Problem found and fixed: `build:verify` assumed prerendered `index.html`; routed SSR produces `index.csr.html`.
  - Problem found and fixed: SSR was still bootstrapping `App`; `main.server.ts` now bootstraps `AppRoot` so server-rendered routes use the Angular router.
  - Watch item: The prompt directives reach the Story Lab seam but are not yet guaranteed to affect canonical production generation.
- GitHub PR closure note:
  - Close as ported after final recovery PR exists, pointing to this ledger and `NOT_TAKEN_FEATURE_LEDGER.md`.

## PR #26 - Implement comprehensive UI/UX polish and accessibility improvements

- Source branch: `pr-26` / `copilot/fix-8`
- Planned disposition: port/cherry-pick
- Actual disposition: ported selectively into the #70 Story Lab baseline
- Story-generation impact: Medium indirect. This does not change prompt generation, but it improves user-facing validation before generation and makes generation success/failure feedback more explicit.
- Accepted material:
  - Ported a signal-backed notification service, adapted to the current Angular 20 standalone app.
  - Ported an accessible notification/toast component with live-region behavior.
  - Recreated the form-validation service against current `StoryGenerationSeam['input']` contracts instead of the old pre-#70 `CreatureType`/`WordCount` model.
  - Added inline `aria-invalid`, `aria-describedby`, and field-level validation messages for Story Lab blueprint fields.
  - Added success/error/warning/info notifications for generation, continuation, reset, and invalid blueprint attempts.
  - Added narrow specs for `FormValidationService` and `NotificationService`.
  - Normalized Story Lab header letter spacing to `0` while touching the same stylesheet.
- Not taking now:
  - Direct merge of PR #26.
  - Old app-shell rewrite, radio/checkbox story form, and pre-#70 layout/CSS.
  - Old `StoryService.generateStory()`, `generateNextChapter()`, `convertToAudio()`, and `saveStory()` UI wiring.
  - Audio conversion progress UI and save/download buttons from the stale app shell.
  - Old validation imports from `VALIDATION_RULES`, `CreatureType`, `ThemeType`, and `WordCount`, which do not exist in the current contract file.
  - Emoji-heavy notification icons and old rounded toast styling as-is.
- Why not taking:
  - The #70 Story Lab route shell and `beginStory()`/`continueStory()` service seam are canonical now.
  - Audio remains deferred.
  - The old form model validates different fields than the current Story Lab blueprint.
- Future mining value:
  - Retry-button patterns from the old app may be useful later if failed batch jobs gain explicit retry semantics.
  - Save/export feedback could be reintroduced after the export flow is connected to the current Story Lab state.
- Files inspected:
  - `story-generator/src/app/notification.service.ts` from PR #26
  - `story-generator/src/app/form-validation.service.ts` from PR #26
  - `story-generator/src/app/notifications.component.ts` from PR #26
  - `story-generator/src/app/notifications.component.css` from PR #26
  - `story-generator/src/app/app.ts`, `app.html`, and `app.css` from PR #26
  - Current `story-generator/src/app/contracts.ts`, `app.ts`, `app.html`, and `app.css`
- Files changed in recovery branch:
  - `story-generator/src/app/notification.service.ts`
  - `story-generator/src/app/notification.service.spec.ts`
  - `story-generator/src/app/notifications.component.ts`
  - `story-generator/src/app/notifications.component.css`
  - `story-generator/src/app/form-validation.service.ts`
  - `story-generator/src/app/form-validation.service.spec.ts`
  - `story-generator/src/app/app.ts`
  - `story-generator/src/app/app.html`
  - `story-generator/src/app/app.css`
  - recovery docs
- Conflicts encountered:
  - PR #26 is draft and conflicting against `main`; it targets the pre-#70 app shell.
  - Its validation service imports old contract names that no longer exist.
  - Its UI changes include audio/save actions that are out of current scope.
- Tests/checks run:
  - `scripts/recovery/preflight.sh --quick --skip-status` passed.
  - `npm test` passed all configured root suites.
  - `cd story-generator && npx -p node@20 -c "node -v && npm run build"` passed with the existing stale `baseline-browser-mapping` warning and the known #74 proving-grounds CSS budget warning.
  - `PORT=4300 npm run start:prod` plus `curl` checks confirmed `/` serves Story Lab with validation text and `/proving-grounds` still serves the proving-grounds page.
  - `npm run build:verify` passed.
  - `cd story-generator && npm test -- --watch=false --browsers=ChromeHeadless` built the spec bundle but failed because ChromeHeadless did not capture.
  - `cd story-generator && CHROME_BIN="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" npx -p node@20 -c "node -v && npm test -- --watch=false --browsers=ChromeHeadless"` also built the spec bundle but failed because ChromeHeadless did not capture.
- Self-review notes:
  - Good: The useful #26 behavior is now attached to the current Story Lab workflow instead of resurrecting the stale UI.
  - Good: Validation now follows the current seam contracts and has service-level specs.
  - Watch item: Local Angular browser-test execution still needs a reliable ChromeHeadless launch setup.
- GitHub PR closure note:
  - Close as ported after final recovery PR exists, pointing to this ledger and `NOT_TAKEN_FEATURE_LEDGER.md`.

## PR #41 - Comprehensive test coverage and Vercel CI/CD

- Source branch: `pr-41` / `copilot/vscode1758409263971`
- Planned disposition: port/cherry-pick
- Actual disposition: ported lean CI material only
- Story-generation impact: Indirect. Adds CI coverage for the current recovery checks so story-generation and Story Lab regressions are caught before merge.
- Accepted material:
  - Added `.github/workflows/recovery-ci.yml`.
  - Uses Node 20.
  - Installs root and Angular dependencies.
  - Runs `scripts/recovery/preflight.sh --skip-status`, which covers whitespace, Angular app/spec typecheck, root story/trope/cliffhanger/story-lab tests, Node 20 Angular build, and build output verification.
  - Adds a small `vercel.json` sanity check for `buildCommand` and `outputDirectory`.
- Not taking now:
  - Direct PR #41 merge.
  - API/backend package split.
  - Jest API test harness from the stale branch.
  - Old `api/lib` path rewrites and deletions of current `api/_lib`.
  - Backend directory assumptions.
  - Security, monitoring, deployment, and dependency workflow suite files.
  - Vercel CLI deploy workflow requiring secrets.
- Why not taking:
  - The branch would undo current Vercel `_lib` path normalization and delete recovery tests.
  - The repo does not currently have the backend/API package layout assumed by the workflow suite.
  - Vercel Git integration can handle deployment; this recovery needs a reliable validation gate first.
- Future mining value:
  - API route tests may be useful after current serverless route contracts stabilize.
  - Vercel CLI preview deployment can be added later if project secrets are configured intentionally.
- Files inspected:
  - `.github/workflows/ci.yml` from PR #41
  - `.github/workflows/deploy.yml` from PR #41
  - `.github/workflows/security-quality.yml` from PR #41
  - PR #41 API/backend/test file list
- Files changed in recovery branch:
  - `.github/workflows/recovery-ci.yml`
  - recovery docs
- Conflicts encountered:
  - PR #41 contains stale code-path churn, including `api/_lib` deletion and `api/lib` reintroduction.
  - PR #41 assumes `backend`, `api/package.json`, and integration-test packages that are not part of the current recovery baseline.
- Tests/checks run:
  - `ruby -e 'require "yaml"; YAML.load_file(".github/workflows/recovery-ci.yml"); puts "workflow yaml ok"'` passed.
  - `node -e "const fs=require('fs'); const config=JSON.parse(fs.readFileSync('vercel.json','utf8')); if (!config.buildCommand || !config.outputDirectory) throw new Error('bad vercel config'); console.log('vercel config ok')"` passed.
  - `git diff --check` passed.
  - Reused prior current-branch validation from #26: quick preflight, root tests, Node 20 build, SSR curl checks, and build verification.
- Self-review notes:
  - Good: The CI now validates the recovery branch using the same script run locally.
  - Good: No DigitalOcean or stale backend assumptions were added.
  - Watch item: This does not deploy to Vercel; it validates that the repo is ready for Vercel/Git deployment.
- GitHub PR closure note:
  - Close as ported after final recovery PR exists, pointing to this ledger and `NOT_TAKEN_FEATURE_LEDGER.md`.

## PR #39 - Implement extensive CI system with 6 comprehensive workflows

- Source branch: `pr-39` / `copilot/fix-38`
- Planned disposition: mine and close
- Actual disposition: mined into `.github/workflows/recovery-ci.yml`; close later as superseded
- Story-generation impact: Indirect. Provides CI ideas only.
- Accepted material:
  - Contract/build validation concept.
  - Dependency caching concept.
  - Branch/path-trigger awareness.
  - Single status-gate idea, reduced to one lean workflow.
- Not taking now:
  - Direct PR #39 merge.
  - Six-workflow suite.
  - CI badge writer that modifies README/status files.
  - Lighthouse, visual regression, analytics dashboard, and broad dependency-management workflows.
  - Contract validation against old `backend/src/types/contracts.ts`.
  - Stale API endpoint smoke tests for old route names.
- Why not taking:
  - The suite is overbuilt for the current recovery branch and assumes old backend/API layout.
  - Badge/status writer workflows would create repo churn unrelated to making the app deployable.
  - Visual/performance workflows should wait until the Vercel deployment path and UI baseline are stable.
- Future mining value:
  - Add a separate accessibility/performance workflow after browser automation is reliable.
  - Add contract-diff checks once frontend and backend contract locations are finalized.
- Files inspected:
  - `.github/workflows/ci-status.yml`
  - `.github/workflows/contract-validation.yml`
  - PR #39 workflow file list
- Files changed in recovery branch:
  - `.github/workflows/recovery-ci.yml`
  - recovery docs
- Conflicts encountered:
  - Same stale path drift as #41: old `api/lib`, backend contract paths, and deleted current tests.
- Tests/checks run:
  - Same workflow YAML/config checks listed under #41.
- Self-review notes:
  - The useful part of #39 was workflow shape, not its concrete implementation.
  - Keep CI boring until the recovery branch is ready to become the mainline.
- GitHub PR closure note:
  - Close as mined/superseded after final recovery PR exists, pointing to this ledger and `NOT_TAKEN_FEATURE_LEDGER.md`.

## PR #84 - chore(deps): bump the npm_and_yarn group across 2 directories with 10 updates

- Source branch: `pr-84` / `dependabot/npm_and_yarn/npm_and_yarn-99e8bff974`
- Planned disposition: try merge or recreate
- Actual disposition: recreate later; do not merge this PR into the recovery branch
- Story-generation impact: Low direct impact, but high build risk. Dependency drift can break Story Lab validation and Vercel builds.
- Accepted material:
  - Dependency-maintenance intent only.
- Not taking now:
  - Direct PR #84 merge.
  - Root package script changes that reintroduce audio tests as required root tests.
  - Root and Angular lockfile churn.
  - Added old audio service/test files.
  - `AGENTS.md` changes from the stale branch base.
  - `story-generator/src/server.ts` changes from the stale branch base.
  - Mixed Angular dependency versions where `@angular/core` is `^21.1.5` while several Angular packages remain `^20.3.x`.
- Why not taking:
  - The current recovery branch has intentionally deferred audio.
  - The PR branch is based on stale repository state and includes material beyond dependency updates when compared to the current recovery baseline.
  - Angular should be upgraded coherently, either as a same-major patch update or as a deliberate Angular 21 migration.
  - The worktree still has unrelated dirty root lockfile/node_modules noise, so dependency work needs a clean lockfile pass.
- Future mining value:
  - Re-run Dependabot or `npm outdated` after the recovery branch is otherwise stable.
  - Apply `axios` and Angular patch updates in a fresh dependency branch with Node 20 build verification.
  - Treat Angular 21 as a separate migration, not a grouped patch bump.
- Files inspected:
  - `package.json`
  - `package-lock.json`
  - `story-generator/package.json`
  - `story-generator/package-lock.json`
  - Branch diff list against current recovery baseline
- Files changed in recovery branch:
  - Recovery docs only.
- Conflicts encountered:
  - #84 appears dependency-only by its head commit, but against the current recovery branch it pulls in stale audio, AGENTS, server, and test changes.
  - Existing dirty local root lockfiles must not be mixed into a dependency PR disposition.
- Tests/checks run:
  - `git diff main..pr-84 -- package.json story-generator/package.json` inspected dependency/script changes.
  - `git diff --shortstat main..pr-84 -- package-lock.json story-generator/package-lock.json` showed large lockfile churn.
- Self-review notes:
  - Correct action is to preserve the dependency-update need without importing stale branch state.
  - The next dependency attempt should start from the recovery branch with clean lockfiles.
- GitHub PR closure note:
  - Close as superseded/recreate after final recovery PR exists, pointing to this ledger and `NOT_TAKEN_FEATURE_LEDGER.md`.

## PR #77 - Add comprehensive documentation analysis and Seam-Driven Development lessons

- Source branch: `refs/remotes/pr/77` / `copilot/analyze-markdown-files`
- Planned disposition: mine and close
- Actual disposition: mined and closed; do not merge documents into the recovery root
- Story-generation impact: Indirect. The PR reinforces that contracts, mock-first development, service-layer preservation, and documentation lifecycle control are core to protecting story-generation work during platform changes.
- Accepted material:
  - Lessons folded into the recovery process: contracts define seams, direct API integration can be simpler than extra frameworks for single-step generation, mock mode is useful but must not become product truth, and documentation needs an index/lifecycle.
  - The "documentation overload" finding is now reflected in this recovery's preference for one ledger, one changelog, one not-taken ledger, one lessons file, and one final report.
- Not taking now:
  - `repodocs.md` as a 1,300-line root document.
  - `repodocsanalysis.md` as a second large root analysis document.
  - `DOCUMENTATION_ANALYSIS_SUMMARY.md` as another status document.
  - The branch's stale path drift that renames `api/_lib` back to `api/lib`.
  - Branch changes that delete `vercel.json` and `.vercelignore`.
  - Audio and package-script changes from the stale branch base.
- Why not taking:
  - The recovery already created narrower live tracking docs and should not add more root documentation sprawl.
  - The branch is not docs-only when compared to the current baseline; it carries stale Vercel/path/audio changes.
- Future mining value:
  - Re-run a documentation index after #87 is merged and stale PRs are closed, using a generated index rather than another large static analysis report.
  - Consider an `archive/` policy only after current recovery docs are consolidated.
- Files inspected:
  - PR body and file list from GitHub.
  - `DOCUMENTATION_ANALYSIS_SUMMARY.md`
  - `repodocsanalysis.md`
  - `repodocs.md` metadata from the summary.
  - Branch file list against `main`.
- Files changed in recovery branch:
  - `PR70_RECOVERY_LEDGER.md`
  - `NOT_TAKEN_FEATURE_LEDGER.md`
  - `PR70_RECOVERY_CHANGELOG.md`
  - `LESSONS_LEARNED.md`
- Conflicts encountered:
  - Direct branch material includes `api/_lib` to `api/lib` path regressions, deletion of Vercel files, audio files/tests, and root package changes.
- Tests/checks run:
  - Documentation-only mining; no build rerun for this ledger update before closure.
- Self-review notes:
  - The useful material was process guidance, not the generated document corpus.
  - This PR validates the current tracking strategy but should not be copied into the branch as another large historical artifact.
- GitHub PR closure note:
  - Closed as superseded by #87 after mining documentation/process lessons into the recovery ledgers.

## PR #76 - [WIP] Analyze and redesign Angular app for Seam Driven Development

- Source branch: `refs/remotes/pr/76` / `copilot/redesign-angular-app-sdd`
- Planned disposition: close
- Actual disposition: closed no material
- Story-generation impact: Indirect planned impact only. The PR body proposes a deep SDD redesign report, but no deliverable file was committed.
- Accepted material:
  - The PR body's checklist confirms useful review categories for the final report: current-state analysis, commit-history review, SDD drift, conventional/unconventional critique, devil's advocate section, and questions the team should have asked.
- Not taking now:
  - No code or document files, because the PR file list is empty.
  - The stale branch-base file changes visible in Git diff are not unique #76 material.
- Why not taking:
  - There is no committed `spicyfairytaleremix.md` or other deliverable to merge.
  - The final recovery report will cover the self-critique portions in a current, source-attributed way.
- Future mining value:
  - Use the PR body's critique prompts as a checklist when writing `PR70_RECOVERY_FINAL_REPORT.md`.
- Files inspected:
  - PR body and file list from GitHub.
  - Branch log and diff list.
- Files changed in recovery branch:
  - Recovery docs only.
- Conflicts encountered:
  - No direct material conflict because there are no committed files.
- Tests/checks run:
  - Not applicable.
- Self-review notes:
  - This is a good example of why PR bodies are not enough evidence for a merge; close no-material PRs after capturing useful intent.
- GitHub PR closure note:
  - Closed as no committed material; #87 will contain the current final report instead.

## PR #63 - Comprehensive Database Investigation: PostgreSQL, MongoDB, Redis Analysis for Digital Ocean Deployment

- Source branch: `refs/remotes/pr/63` / `copilot/investigate-database-options`
- Planned disposition: mine and close
- Actual disposition: mined and closed; recreate Vercel-specific storage decision later
- Story-generation impact: High future impact. Durable story libraries, multi-chapter state, story-state snapshots, analytics, sharing, and API usage tracking would materially improve story generation workflows and continuity.
- Accepted material:
  - Future storage capability inventory: story library/history, multi-chapter state persistence, user accounts/preferences, analytics, sharing, API usage/quotas, and search/filtering.
  - Schema ideas for stories, chapters, story_state, analytics_events, story_shares, api_usage, and user_quotas.
  - Migration lesson: add persistence behind seams with a silent-write/dual-read rollout instead of rewriting core generation paths.
- Not taking now:
  - DigitalOcean-specific pricing and provisioning recommendations.
  - The root `DATABASE_*.md` document set.
  - README edits from the stale branch.
  - Direct Postgres/Auth0 selection as an active recovery decision.
  - Branch path churn that renames `api/_lib` to `api/lib`, deletes security helpers/tests, and mutates many app/test files.
- Why not taking:
  - The app target is Vercel, so storage should be chosen from Vercel-compatible options such as Neon/Vercel Postgres, Upstash Redis, Blob, or another explicit Vercel path.
  - Current recovery already labels story-lab state as transient; adding docs that imply DigitalOcean persistence would confuse the deployment direction.
- Future mining value:
  - Use #63 as the main reference for a later Vercel storage RFC.
  - Prioritize story library plus multi-chapter state before social/sharing features because they directly support story generation continuity.
- Files inspected:
  - PR body and file list from GitHub.
  - `DATABASE_INVESTIGATION.md`
  - `DATABASE_ROI_ANALYSIS.md`
  - Branch file list against `main`.
- Files changed in recovery branch:
  - Recovery docs only.
- Conflicts encountered:
  - Direct branch includes broad stale code/test deletions, old `api/lib` paths, root lockfile churn, and DigitalOcean framing.
- Tests/checks run:
  - Documentation-only mining; no build rerun for this ledger update before closure.
- Self-review notes:
  - The capabilities are very relevant, but a provider-specific research doc should not silently become the product storage decision.
- GitHub PR closure note:
  - Closed as mined/superseded by #87; storage ideas remain in the not-taken ledger for a Vercel storage decision.

## PR #56 - Research and ROI Analysis: Digital Ocean Backend Services Integration Opportunities

- Source branch: `refs/remotes/pr/56` / `copilot/fix-d8e60909-345a-42f7-b452-59c45cd5b5e2`
- Planned disposition: mine and close
- Actual disposition: mined and closed; recreate only provider-neutral/Vercel-compatible pieces later
- Story-generation impact: Medium future impact. Caching, rate limiting, generated file storage, analytics, and persistence can reduce generation cost and improve continuity, but the concrete implementation is provider-shaped.
- Accepted material:
  - Cache-service idea: deterministic story-generation cache keys, audio URL caching, cache statistics, graceful fallback, and rate limiting.
  - Provider-neutral service categories to revisit for Vercel: object storage for exports/audio, Redis-style cache for expensive AI calls and quotas, observability, and database-backed story history.
- Not taking now:
  - DigitalOcean Spaces, Managed Redis, App Platform, Load Balancer, VPC, and DOKS recommendations as active deployment plan.
  - `api/lib/services/cacheService.ts` implementation as-is.
  - ROI claims and provider pricing as recovery docs.
  - Old `api/lib` path shape and stale app/API rewrites.
- Why not taking:
  - The user's direction is Vercel, not DigitalOcean.
  - A cache layer must be designed around current `api/_lib` contracts, Vercel storage/runtime constraints, and privacy expectations for generated content.
- Future mining value:
  - Recreate a small `api/_lib/services/cacheService.ts` only after choosing Upstash Redis, Vercel Runtime Cache, or another explicit Vercel-compatible cache.
  - Add rate limiting with clear behavior for mock mode and live Grok mode.
- Files inspected:
  - PR body and file list from GitHub.
  - `DIGITAL_OCEAN_SERVICES_ANALYSIS.md`
  - `DO_SERVICES_SUMMARY.md`
  - Branch file list against `main`.
- Files changed in recovery branch:
  - Recovery docs only.
- Conflicts encountered:
  - Direct branch deletes Vercel-oriented files, adds DigitalOcean service assumptions, renames/shared code paths, and includes package/lockfile churn.
- Tests/checks run:
  - Documentation-only mining; no build rerun for this ledger update before closure.
- Self-review notes:
  - The cache idea is useful enough to keep, but provider ROI docs are not a substitute for a Vercel architecture decision.
- GitHub PR closure note:
  - Closed as mined/superseded by #87; Vercel-compatible cache/storage ideas remain in the not-taken ledger.

## PR #54 - Digital Ocean Deployment Infrastructure - Complete Code Audit & Production Ready Setup

- Source branch: `refs/remotes/pr/54` / `copilot/fix-39f1b710-a1e8-490f-9997-425e777cc64e`
- Planned disposition: close
- Actual disposition: mined and closed; do not merge deployment infrastructure
- Story-generation impact: Low direct impact. It affects runtime/deployment reliability, not story prompt quality.
- Accepted material:
  - Generic deployment-readiness checklist ideas: Node 20 runtime, environment variable clarity, health checks, CORS/origin control, mock mode, structured logging, and resource monitoring.
  - Reminder that deployment docs should name the target platform explicitly.
- Not taking now:
  - `app.yaml`, DigitalOcean App Platform deployment docs, and `deploy.sh`.
  - Dockerfiles, Docker Compose, Docker healthcheck/start scripts, and `server.js` production server.
  - Express traditional-hosting API compatibility layer.
  - Audio/export routes and environment assumptions from the old shell.
  - `.env.example` as written because it includes audio/provider assumptions not in current scope.
- Why not taking:
  - The active target is Vercel, and the current repo already has serverless `api/` functions plus `vercel.json`.
  - Adding a second traditional-hosting runtime would split deployment truth and invite regressions.
- Future mining value:
  - Use the checklist shape when writing a Vercel deployment checklist: env vars, build command, output directory, health endpoint, mock/live mode, logging, and custom domain checks.
- Files inspected:
  - PR body and file list from GitHub.
  - `DEPLOYMENT_CHECKLIST.md`
  - `DEPLOY.md`
  - Branch file list against `main`.
- Files changed in recovery branch:
  - Recovery docs only.
- Conflicts encountered:
  - Direct branch adds DigitalOcean/Docker runtime files and old API route assumptions that conflict with Vercel-first recovery.
- Tests/checks run:
  - Documentation-only mining; no build rerun for this ledger update before closure.
- Self-review notes:
  - This PR is directly opposed to the user's Vercel direction. Mine checklist discipline, not deployment code.
- GitHub PR closure note:
  - Closed as superseded by #87; deployment infrastructure intentionally not taken.

## PR #53 - Complete documentation audit: Archive outdated docs, update architecture references, and enhance changelog

- Source branch: `refs/remotes/pr/53` / `copilot/fix-2036820c-39ee-4d4c-bcce-d85a9bcb1042`
- Planned disposition: mine and close
- Actual disposition: mined and closed; recreate docs cleanup later if needed
- Story-generation impact: Indirect. Cleaner docs reduce future story-generation mistakes by making current seams and paths obvious.
- Accepted material:
  - Documentation lifecycle pattern: archive historical feature docs behind a README, remove temporary completion docs, and keep active docs current.
  - Repository hygiene lesson: do not commit `node_modules`; use `.gitignore` and dependency install scripts.
  - Architecture-reference cleanup idea: serverless/API paths must be kept current in agent and contributor docs.
- Not taking now:
  - Direct archive/move/delete operations from the stale branch.
  - Changelog rewrite and agent-doc edits as-is.
  - Massive `node_modules` deletion/change set inside the PR.
  - Old references to `api/lib` instead of current `api/_lib`.
  - Audio-heavy README claims as active current documentation.
- Why not taking:
  - The current recovery docs already supersede older root-doc cleanup.
  - A docs cleanup should be done after PR closure, not while the recovery still needs visible ledgers and final report.
  - Merging a node_modules cleanup PR with unrelated architecture rewrites would create review noise.
- Future mining value:
  - After #87 is accepted, do a clean docs consolidation commit that archives recovery docs and updates README/AGENTS without touching dependencies or code paths.
- Files inspected:
  - PR body and file list from GitHub.
  - `archived/README.md`
  - `README.md`
  - `.github/copilot-instructions.md`
  - Branch file list against `main`.
- Files changed in recovery branch:
  - Recovery docs only.
- Conflicts encountered:
  - Direct branch includes hundreds of dependency-file changes plus stale serverless/path references.
- Tests/checks run:
  - Documentation-only mining; no build rerun for this ledger update before closure.
- Self-review notes:
  - The intent is good, but a docs lifecycle pass must be smaller and timed after recovery, or it becomes the same document sprawl it is trying to solve.
- GitHub PR closure note:
  - Closed as mined/superseded by #87; cleanup ideas remain for a post-recovery docs pass.

## PR #40 - Revolutionary UI: Complete mystical interface transformation with floating particles, 3D animations, and optimized layout arrangement

- Source branch: `refs/remotes/pr/40` / `copilot/fix-19edc1b5-252d-4e09-bb58-fd6c2fb5aea0`
- Planned disposition: mine and close
- Actual disposition: mined and closed; recreate selected visual/workflow ideas only if they fit #70 Story Lab
- Story-generation impact: Low direct impact. It changes the story creation experience and input affordances but not generation logic.
- Accepted material:
  - Interaction ideas: clearer grouping of creature selection, theme selection, inspiration text, intensity, word budget, and final generate action.
  - Status ideas: a central "ready/casting" state, selected-theme counter, and visible disabled/ready generate state.
  - Implementation caution: `trackBy`/stable iteration and hydration testing matter for dynamic Angular forms.
- Not taking now:
  - Full mystical app-shell rewrite in `app.html` and `app.css`.
  - Floating particle background, 3D card flips, spell-circle/orb controls, emoji-driven control labels, and heavy purple/gold gradient theme.
  - `ngSkipHydration` usage as a broad workaround.
  - Audio/save UI controls from the old app.
  - Current PR screenshots/assets as implementation target.
- Why not taking:
  - #70 already established the Story Lab/workbench direction, and `design.md` now provides a calmer design system.
  - The recovery frontend guidance avoids particle/orb decoration, one-note purple palettes, and text-heavy novelty controls.
  - Direct merge would replace the current Story Lab app shell and collide with #75/#26/#74 ports.
- Future mining value:
  - Recreate only the layout hierarchy and state-clarity ideas in the current Story Lab design language if screenshots show the existing UI needs simplification.
  - Consider a subdued "generation status core" after real generation/progress semantics are settled.
- Files inspected:
  - PR body and file list from GitHub.
  - `story-generator/src/app/app.html`
  - `story-generator/src/app/app.css`
  - `story-generator/src/app/app.ts`
  - Diff shortstat for app UI files.
- Files changed in recovery branch:
  - Recovery docs only.
- Conflicts encountered:
  - Direct branch overwrites the pre-#70 app shell and conflicts with the current #70 Story Lab structure, #75 workflow additions, and #26 validation/notification surface.
- Tests/checks run:
  - Documentation/UI mining only; no build rerun for this ledger update before closure.
- Self-review notes:
  - The branch is useful as a sketch of interaction grouping, but the visual treatment should not set the recovery direction.
- GitHub PR closure note:
  - Closed as mined/superseded by #87; selected UI ideas remain in the not-taken ledger.

## PR #55 - Enhance Multi-Voice Audio System with Voice Evolution and 90+ Emotion Support

- Source branch: `refs/remotes/pr/55` / `copilot/fix-c58defe9-72e1-4f67-afc8-235508002d70`
- Planned disposition: mine and close
- Actual disposition: mined and closed; audio runtime deferred
- Story-generation impact: High future impact. #55 contains the clearest prompt-level path for writing stories that preserve audio metadata without forcing JSON output.
- Accepted material:
  - Backlog idea: keep human-readable speaker tags as the primary story text format, not rigid JSON blocks.
  - Backlog idea: expand prompt vocabulary with curated emotion names and narrator atmosphere labels.
  - Backlog idea: voice evolution markers can double as character-development metadata for future continuity/state systems.
- Not taking now:
  - Enhanced audio service implementation.
  - 90+ emotion runtime mapping as active audio code.
  - Browser/audio service changes and lockfile churn.
  - "Audio-DNA" hidden/steganographic encoding idea.
  - Character consciousness/collaborative generation architecture as implementation.
- Why not taking:
  - Audio remains deferred and the branch uses stale `api/lib` paths.
  - The useful story-generation material can be recreated as prompt/metadata work after production Story Lab generation is wired.
  - Hidden Unicode/zero-width metadata would be fragile and hard to review.
- Future mining value:
  - Add explicit story-generation support for `[Character, emotion]`, `[Character, confident->vulnerable]`, and `[Narrator, tension|intimacy|danger]` once audio scope reopens.
  - Use voice-evolution hints as optional Story Lab state deltas, not as required user-visible formatting.
- Files inspected:
  - PR body and file list from GitHub.
  - `ENHANCED_AUDIO_EXAMPLES.md`
  - `IMPLEMENTATION_SUMMARY.md`
  - `MULTI_VOICE_AUDIO_SYSTEM_ANALYSIS.md`
  - `api/lib/services/storyService.ts`
- Files changed in recovery branch:
  - Recovery docs only.
- Conflicts encountered:
  - Stale `api/lib` path, audio runtime scope, and lockfile churn.
- Tests/checks run:
  - Mining-only docs update; no build rerun before closure.
- Self-review notes:
  - This PR is the most important audio branch for future story-generation prompts because it argues for preserving natural prose and enriching tags rather than replacing story text with machine-first JSON.
- GitHub PR closure note:
  - Closed as mined/superseded by #87; story-generation ideas are preserved in `NOT_TAKEN_FEATURE_LEDGER.md`.

## PR #47 - Comprehensive Audio Pipeline Investigation & Enhancement Research

- Source branch: `refs/remotes/pr/47` / `copilot/fix-46`
- Planned disposition: mine and close
- Actual disposition: mined and closed; audio runtime deferred
- Story-generation impact: Medium-high future impact. It inventories the end-to-end audio pipeline and identifies story-format requirements for later narration.
- Accepted material:
  - Backlog idea: speaker tags need a validation/test harness before audio is reintroduced.
  - Backlog idea: emotional moments can become navigation/bookmark metadata for generated stories.
  - Backlog idea: scene/sound-effect metadata can be generated as optional tags or state deltas rather than mixed into prose.
- Not taking now:
  - Investigation scripts and prototype audio services.
  - Advanced audio player implementation plans.
  - Web Audio mixing, SFX APIs, IndexedDB offline caching, and per-character timeline controls.
  - Voice consistency verification implementation.
- Why not taking:
  - Audio and sound effects are out of current scope.
  - The investigation is a roadmap, not a current Vercel Story Lab feature.
- Future mining value:
  - Reuse the roadmap sequence: tag validation, emotion mapping, consistency tests, then player/SFX work.
  - Use the "emotion navigation" idea when chapter/proving-ground metadata is persisted.
- Files inspected:
  - PR body and file list from GitHub.
  - `audio-pipeline-investigation.md`
  - `advanced-audio-player-investigation.ts`
  - `enhanced-audio-service.ts`
  - `enhanced-audio-service-practical.ts`
  - `sound-effects-investigation.ts`
- Files changed in recovery branch:
  - Recovery docs only.
- Conflicts encountered:
  - Branch is research/prototype-heavy and not aligned with the current Vercel `api/_lib` runtime.
- Tests/checks run:
  - Mining-only docs update; no build rerun before closure.
- Self-review notes:
  - Useful as a future audio roadmap, but most features should be rewritten from scratch after the story-generation seam stabilizes.
- GitHub PR closure note:
  - Closed as mined/superseded by #87.

## PR #45 - Enhance Audio Pipeline with Comprehensive Emotion Mapping and Character Consistency

- Source branch: `refs/remotes/pr/45` / `copilot/fix-51cdecd8-5fc8-4fd8-8f2c-a04288ce6583`
- Planned disposition: mine and close
- Actual disposition: mined and closed; audio runtime deferred
- Story-generation impact: High future impact. The emotion taxonomy, character memory, and fuzzy matching ideas can inform prompt metadata and validation.
- Accepted material:
  - Backlog idea: maintain a curated supernatural-romance emotion taxonomy grouped by romantic, dark, power-dynamic, creature-specific, and intensity labels.
  - Backlog idea: keep recent emotional history per character to avoid abrupt tonal resets across chapters.
  - Backlog idea: fuzzy emotion suggestions can help validate generated tags without failing generation.
- Not taking now:
  - API/backend audio service implementations.
  - Emotion testing endpoints.
  - Backend package/demo files and backend `node_modules`/lockfiles.
  - Audio-specific voice parameter memory as active runtime behavior.
- Why not taking:
  - Audio runtime is deferred and branch paths are stale.
  - Character emotional memory belongs in the Story Lab/state model after Vercel persistence is selected.
- Future mining value:
  - Build a small shared `emotionVocabulary` config for prompt generation and future tag validation.
  - Add generated-tag validation in Proving Grounds before making it production behavior.
- Files inspected:
  - PR body and file list from GitHub.
  - `AUDIO_PIPELINE_INVESTIGATION.md`
  - `EMOTION_MAPPING_DOCUMENTATION.md`
  - `api/lib/services/audioService.ts`
  - `backend/src/services/audioService.ts`
- Files changed in recovery branch:
  - Recovery docs only.
- Conflicts encountered:
  - Stale backend/API paths, backend dependencies, and audio runtime scope.
- Tests/checks run:
  - Mining-only docs update; no build rerun before closure.
- Self-review notes:
  - This is one of the best sources for a future emotion vocabulary, but its code should be recreated around current contracts.
- GitHub PR closure note:
  - Closed as mined/superseded by #87.

## PR #44 - Comprehensive Audio Pipeline Enhancement: World-Class Character-Driven Narration System

- Source branch: `refs/remotes/pr/44` / `copilot/fix-ce37da23-7471-40d3-b624-b1fcc1453f80`
- Planned disposition: mine and close
- Actual disposition: mined and closed; audio runtime deferred
- Story-generation impact: Medium future impact. The branch connects emotion tags, character controls, and sound-effect triggers to scene metadata.
- Accepted material:
  - Backlog idea: use creature-specific scene/effect trigger metadata as optional future output, not prose pollution.
  - Backlog idea: narrator and character metadata should include emotion distribution and character count for QA.
  - Backlog idea: model/provider notes can inform a later ElevenLabs update, outside this recovery.
- Not taking now:
  - Enhanced audio player component.
  - `api/soundeffects/info.ts`.
  - Sound-effect service/provider implementation.
  - ElevenLabs model migration.
  - Backend/dist audio files and old app-shell UI changes.
- Why not taking:
  - Audio and sound effects are explicitly deferred.
  - Sound effects introduce provider, licensing, attribution, storage, and mixing decisions that are separate from Vercel Story Lab recovery.
- Future mining value:
  - If audio resumes, start with story metadata for scene atmosphere/effect intent before adding any SFX provider.
  - Use Proving Grounds to inspect effect-trigger quality before exposing sound effects.
- Files inspected:
  - PR body and file list from GitHub.
  - `ELEVENLABS_MODELS_RESEARCH.md`
  - `RECENT_PRS_ANALYSIS.md`
  - `SOUND_EFFECTS_RESEARCH.md`
  - `api/lib/services/audioService.ts`
  - `api/soundeffects/info.ts`
- Files changed in recovery branch:
  - Recovery docs only.
- Conflicts encountered:
  - Stale backend/dist files, old API paths, audio player/app shell changes, and sound-effect scope.
- Tests/checks run:
  - Mining-only docs update; no build rerun before closure.
- Self-review notes:
  - Good SFX research, but implementing it now would be a product pivot away from Story Lab deployment.
- GitHub PR closure note:
  - Closed as mined/superseded by #87.

## PR #43 - Implement Advanced Audio Pipeline with Emotion-Aware Voice Processing and Enhanced Player Controls

- Source branch: `refs/remotes/pr/43` / `copilot/fix-1b94cd5d-767d-4a07-978e-79e55475019b`
- Planned disposition: mine and close
- Actual disposition: mined and closed; audio runtime deferred
- Story-generation impact: Medium future impact. Character personality profiles and emotion distribution analysis can become story-generation QA signals.
- Accepted material:
  - Backlog idea: character type/personality profiles can influence dialogue style and narrator description.
  - Backlog idea: analyze generated output for too many neutral tags, too little emotion variety, or too many speakers.
  - Backlog idea: expose character/emotion metadata in a future player only after audio is active.
- Not taking now:
  - `AudioEnhancementService` implementation.
  - Enhanced audio player component and per-character controls.
  - 90+ emotion runtime parameter mapping as active code.
  - Backend package files and stale app UI changes.
- Why not taking:
  - Audio remains deferred.
  - The current Story Lab already has a different UI contract and does not need audio player controls.
- Future mining value:
  - Recreate the output-analysis recommendations inside Proving Grounds or story QA tests.
  - Use character personality profiles as prompt inputs only after they are centralized with author/trope/beat configs.
- Files inspected:
  - PR body and file list from GitHub.
  - `AUDIO_PIPELINE_ENHANCEMENTS.md`
  - `backend/src/services/audioEnhancementService.ts`
  - `story-generator/src/app/enhanced-audio-player/*`
- Files changed in recovery branch:
  - Recovery docs only.
- Conflicts encountered:
  - Old backend path, audio player UI, and stale app-shell assumptions.
- Tests/checks run:
  - Mining-only docs update; no build rerun before closure.
- Self-review notes:
  - The QA/analyzer ideas are more reusable than the player implementation in the current phase.
- GitHub PR closure note:
  - Closed as mined/superseded by #87.

## PR #42 - Implement comprehensive emotion mapping, streaming audio generation, and modern ElevenLabs API integration

- Source branch: `refs/remotes/pr/42` / `copilot/vscode1758509975176`
- Planned disposition: mine and close
- Actual disposition: mined and closed; audio runtime deferred
- Story-generation impact: Medium future impact. It reinforces emotion tag requirements and suggests background-job semantics for future audio generation.
- Accepted material:
  - Backlog idea: story generation should keep `[Character, emotion]` tags valid enough for later audio.
  - Backlog idea: long-running audio should be a background job with progress events if audio returns.
  - Backlog idea: streaming/progress APIs need explicit cancel/status/result semantics, not ad hoc polling.
- Not taking now:
  - `api/audio/streaming.ts`.
  - `streamingAudioService.ts` and streaming tests.
  - ElevenLabs model/output-format modernization as current work.
  - App error-severity fix if already superseded elsewhere.
- Why not taking:
  - Audio is deferred and current Vercel recovery already protects story-generation streaming separately.
  - Background audio jobs need durable queue/storage decisions before implementation.
- Future mining value:
  - If audio resumes, evaluate Vercel Workflow/Queues or another durable job runner instead of in-memory job state.
  - Keep SSE progress semantics separate from story-generation SSE semantics.
- Files inspected:
  - PR body and file list from GitHub.
  - `AI_STORY_GENERATION_PROMPT.md`
  - `AUDIO_PIPELINE_INVESTIGATION_REPORT.md`
  - `ENHANCED_AUDIO_SYSTEM_DOCS.md`
  - `api/audio/streaming.ts`
  - `api/lib/services/streamingAudioService.ts`
- Files changed in recovery branch:
  - Recovery docs only.
- Conflicts encountered:
  - Stale `api/lib` paths, audio endpoints, and background job state outside current scope.
- Tests/checks run:
  - Mining-only docs update; no build rerun before closure.
- Self-review notes:
  - Useful job-model sketch, but implementing it now would require solving persistence/queues before the app is even merged.
- GitHub PR closure note:
  - Closed as mined/superseded by #87.

## PR #30 - Implement Complete Multi-Voice Audio Generation Pipeline with 11Labs v3 Integration

- Source branch: `refs/remotes/pr/30` / `copilot/fix-30ca5fa5-21c1-4743-a219-da303f73ddfa`
- Planned disposition: mine and close
- Actual disposition: mined and closed; audio runtime deferred
- Story-generation impact: Medium future impact. It establishes the base contract that story generation must produce clear speaker/narrator tags.
- Accepted material:
  - Backlog idea: prompt contracts should require all speech as `[Speaker]` or `[Speaker, emotion]` and all descriptions as `[Narrator]` if audio output is enabled.
  - Backlog idea: audio progress can track the current dialogue segment being generated.
  - Backlog idea: creature-specific voice assignment starts from story creature plus character naming clues.
- Not taking now:
  - Old backend `StoryService` prompt code.
  - `DialogueParser` and audio-service implementations.
  - Old Angular app UI controls and contract changes.
  - 11Labs v3 provider wiring.
- Why not taking:
  - Branch uses stale backend/API paths and old model/env names.
  - The #70 Story Lab baseline has different contracts and audio is deferred.
- Future mining value:
  - When audio resumes, introduce audio-mode prompt requirements as an optional generation mode rather than always forcing tags in all reading experiences.
- Files inspected:
  - PR body and file list from GitHub.
  - `backend/src/services/storyService.ts`
  - `backend/src/services/dialogueParser.ts`
  - `api/lib/types/contracts.ts`
  - `story-generator/src/app/contracts.ts`
- Files changed in recovery branch:
  - Recovery docs only.
- Conflicts encountered:
  - Old backend/dist files, stale story service, old app shell, and audio scope.
- Tests/checks run:
  - Mining-only docs update; no build rerun before closure.
- Self-review notes:
  - This is early source material; later PRs have richer emotion/evolution detail.
- GitHub PR closure note:
  - Closed as mined/superseded by #87.

## PR #29 - Implement Complete Multi-Voice Audio Generation Pipeline

- Source branch: `refs/remotes/pr/29` / `copilot/fix-f95f543c-a963-43a1-8626-ae2dfd9336ea`
- Planned disposition: mine and close
- Actual disposition: mined and closed; audio runtime deferred
- Story-generation impact: Medium future impact. It provides a structured segment/result model for multi-voice output.
- Accepted material:
  - Backlog idea: `SpeakerSegment`/`MultiVoiceAudioResult`-style models are useful for future audio metadata and progress display.
  - Backlog idea: narrator can have multiple modes, such as neutral versus intimate.
  - Backlog idea: character voice mapping should be extracted from audio output metadata for UI display.
- Not taking now:
  - `MultiVoiceAudioService` implementation.
  - Environment-variable voice ID mapping.
  - Segment audio generation/stitching pipeline.
  - Old UI contract and button changes.
- Why not taking:
  - Runtime audio is deferred.
  - The service should be recreated under current `api/_lib` contracts if audio resumes.
- Future mining value:
  - Use the segment/result model as a starting point for future audio contracts and Story Lab metadata display.
- Files inspected:
  - PR body and file list from GitHub.
  - `api/lib/services/multiVoiceAudioService.ts`
  - `api/lib/types/contracts.ts`
  - `story-generator/src/app/contracts.ts`
- Files changed in recovery branch:
  - Recovery docs only.
- Conflicts encountered:
  - Stale `api/lib` and backend/dist paths; old UI controls.
- Tests/checks run:
  - Mining-only docs update; no build rerun before closure.
- Self-review notes:
  - Cleaner than #30 for contract shape, but still not worth merging during audio deferral.
- GitHub PR closure note:
  - Closed as mined/superseded by #87.

## PR #28 - Implement Complete Multi-Voice Audio Generation Pipeline with 11Labs v3

- Source branch: `refs/remotes/pr/28` / `copilot/vscode1758314464060`
- Planned disposition: mine and close
- Actual disposition: mined and closed; audio runtime deferred
- Story-generation impact: Medium future impact. It decomposes dialogue parsing, character voice assignment, and audio stitching into separate modules.
- Accepted material:
  - Backlog idea: keep dialogue parsing, character voice assignment, and audio stitching as separate seams if audio is rebuilt.
  - Backlog idea: story prompts can be adjusted to emit explicit speaker tags for audio-mode stories.
  - Backlog idea: character names plus surrounding narration can infer creature/gender when tags are incomplete.
- Not taking now:
  - `DialogueParserService`, `CharacterVoiceService`, and `AudioStitchingService` implementations.
  - Backend/dist output files.
  - Old frontend app controls/debug/error changes.
- Why not taking:
  - Branch base is stale and audio is deferred.
  - Any future audio rebuild should start from current Story Lab contracts and Vercel constraints.
- Future mining value:
  - Use the modular service split as the likely future architecture if audio resumes.
- Files inspected:
  - PR body and file list from GitHub.
  - `backend/src/services/dialogueParserService.ts`
  - `backend/src/services/characterVoiceService.ts`
  - `backend/src/services/audioStitchingService.ts`
  - `backend/src/services/storyService.ts`
- Files changed in recovery branch:
  - Recovery docs only.
- Conflicts encountered:
  - Old backend and frontend app shell, plus non-main branch lineage.
- Tests/checks run:
  - Mining-only docs update; no build rerun before closure.
- Self-review notes:
  - This is more useful architecturally than as code; recreate the service boundaries later.
- GitHub PR closure note:
  - Closed as mined/superseded by #87.

## PR #22 - Implement Complete Multi-Voice Audio Generation Pipeline with ElevenLabs v3

- Source branch: `refs/remotes/pr/22` / `copilot/fix-20`
- Planned disposition: mine and close
- Actual disposition: mined and closed; audio runtime deferred
- Story-generation impact: Medium future impact. It contains early dialogue extraction and emotional-context inference ideas for stories without explicit tags.
- Accepted material:
  - Backlog idea: quote-based dialogue extraction can be a fallback if old/generated stories do not use speaker tags.
  - Backlog idea: emotional context can be inferred from nearby narration when explicit `[Character, emotion]` tags are missing.
  - Backlog idea: character extraction can use honorifics, speech verbs, and nearby paragraphs.
- Not taking now:
  - Early dialogue parsing service implementation.
  - Backend audio routes and service code.
  - Old frontend audio UI and contracts.
- Why not taking:
  - Later audio PRs provide stronger explicit-tag systems.
  - Fallback inference is useful but less reliable than prompting for tags in new generation.
  - Audio is deferred.
- Future mining value:
  - Use fallback parsing for imported legacy stories or old generated content, but prefer explicit tags for new audio-mode generation.
- Files inspected:
  - PR body and file list from GitHub.
  - `backend/src/services/dialogueParsingService.ts`
  - `backend/src/routes/audioRoutes.ts`
  - `backend/src/types/contracts.ts`
  - `story-generator/src/app/contracts.ts`
- Files changed in recovery branch:
  - Recovery docs only.
- Conflicts encountered:
  - Early backend/audio route structure, old app shell, and audio scope.
- Tests/checks run:
  - Mining-only docs update; no build rerun before closure.
- Self-review notes:
  - Keep #22 as legacy fallback reference, not a primary architecture source.
- GitHub PR closure note:
  - Closed as mined/superseded by #87.

## PR #88 - chore(deps): bump the npm_and_yarn group across 2 directories with 22 updates

- Source branch: `dependabot/npm_and_yarn/npm_and_yarn-8fd274c0be`
- Planned disposition: recreate/supersede
- Actual disposition: superseded by PR #94 and closed
- Story-generation impact: Indirect. Dependency/security hardening protects the deployed Story Lab runtime but does not change prompt semantics or generation behavior.
- Accepted material:
  - The dependency-update intent from PR #88.
  - Root axios/follow-redirects runtime security update, recreated as root `axios` `^1.16.1` and lockfile `follow-redirects` `1.16.0`.
  - Story Generator axios/follow-redirects runtime security update, recreated as `axios` `^1.16.1` and lockfile `follow-redirects` `1.16.0`.
  - Angular 20 patch-family security/runtime update, recreated at fresher current patch levels than PR #88: Angular runtime packages `20.3.22` and CLI/build/SSR packages `20.3.26`.
  - Build/type tooling moved from production dependencies to devDependencies in `story-generator/package.json`.
- Not taking now:
  - PR #88's exact older patch targets, including axios `1.15.2` and earlier Angular patch versions.
  - Any generated `node_modules` changes from local install/update commands.
- Why not taking:
  - PR #88 is now stale relative to current package registry state and this branch's fresher patch updates.
  - Generated `node_modules` churn is not a reviewable or deployable source artifact for this recovery branch.
- Future mining value:
  - None beyond using Dependabot as a signal source for future dependency windows.
- Files inspected:
  - `package.json`
  - `package-lock.json`
  - `story-generator/package.json`
  - `story-generator/package-lock.json`
  - PR #88 body and changed-file list from GitHub.
- Files changed in recovery branch:
  - `package.json`
  - `package-lock.json`
  - `story-generator/package.json`
  - `story-generator/package-lock.json`
  - `api/_lib/story-lab/storyLabEngine.ts`
  - `scripts/recovery/story-lab-browser-smoke.mjs`
  - `STORY_LAB_SHIPPING_READINESS_REPORT.md`
  - `MVP_TO_SHIPPING_EXEC_PLAN.md`
  - `PR70_RECOVERY_CHANGELOG.md`
  - `PR70_RECOVERY_LEDGER.md`
  - `LESSONS_LEARNED.md`
- Conflicts encountered:
  - No direct merge attempted; branch is intentionally recreated on current Story Lab baseline.
- Tests/checks run:
  - `node --check scripts/recovery/story-lab-browser-smoke.mjs` passed.
  - Root `npm audit --omit=dev --json` passed with zero vulnerabilities.
  - Story Generator `npm audit --omit=dev --json` passed with zero vulnerabilities.
  - Story Generator `npm audit --omit=dev --omit=optional --json` passed with zero vulnerabilities.
  - Full Story Generator `npm audit --json` still reports seven dev/test-toolchain findings through Karma/socket packages.
  - `git diff --check` passed.
  - `scripts/recovery/preflight.sh --quick --skip-status` passed.
  - `npm run test:story-lab-real-engine` passed.
  - `npm run test:all` passed with expected mock-mode warnings.
  - `npm run smoke:story-lab-ui` passed after building with Node `v20.20.2`.
  - `npm run build:verify` passed.
  - PR #94 checks passed on GitHub.
  - Main Recovery CI passed after PR #94 merged.
  - Main Dependabot Updates workflow passed after PR #94 merged.
  - Vercel production deployment succeeded after PR #94 merged.
  - Production live browser smoke passed against `https://fairytaleswith-spice.vercel.app`.
- Self-review notes:
  - Correct action is to supersede the dependency PR with a current, validated dependency branch rather than merge older patch targets.
  - Do not overstate the audit result: runtime is clean, full dev audit is still not clean.
- GitHub PR closure note:
  - Closed as superseded after PR #94 merged, pointing to the fresher dependency update and `STORY_LAB_SHIPPING_READINESS_REPORT.md`.

## PR #95 - chore(deps): bump the npm_and_yarn group across 1 directory with 2 updates

- Source branch: `dependabot/npm_and_yarn/story-generator/npm_and_yarn-3477c3f106`
- Planned disposition: merge
- Actual disposition: merged as `d1b7458b71d232b5e38e94755776c69c7c165381`
- Story-generation impact: None direct. This is dev/test dependency risk reduction only; Story Lab runtime generation behavior is unchanged.
- Accepted material:
  - `story-generator/package-lock.json` transitive `picomatch` update from `2.3.1` to `2.3.2`.
  - `story-generator/package-lock.json` transitive `qs` update from `6.13.0` to `6.15.2`.
  - Reduction of full Story Generator audit findings from seven to four.
- Not taking now:
  - No feature material omitted.
- Why not taking:
  - Not applicable.
- Future mining value:
  - Remaining full-audit cleanup should focus on the Karma/socket chain: `engine.io`, `socket.io-adapter`, `socket.io-parser`, and `ws`.
- Files inspected:
  - PR #95 body and changed-file list from GitHub.
  - `story-generator/package-lock.json`.
- Files changed in recovery branch:
  - `story-generator/package-lock.json`.
- Conflicts encountered:
  - None. The PR was lockfile-only and mergeable.
- Tests/checks run:
  - PR #95 Recovery CI passed.
  - PR #95 SonarCloud checks passed.
  - PR #95 Vercel preview passed.
  - Main Recovery CI passed after merge.
  - Vercel production deployment succeeded after merge.
  - `git diff --check` passed locally after merge.
  - `cd story-generator && npm audit --omit=dev --json` reported zero vulnerabilities.
  - `cd story-generator && npm audit --json` reported four remaining dev/test-toolchain findings.
  - Production live browser smoke passed against `https://fairytaleswith-spice.vercel.app`.
- Self-review notes:
  - This should not be described as production feature work.
  - It does materially improve the documented dev/test audit state, so the shipping report needed a final accuracy update.
- GitHub PR closure note:
  - Merged. No closure comment needed.

## Stale-PR triage cycle - 2026-09-06 04:52 UTC

Scope per the automated stale-PR recovery routine: open PRs with no activity in the last 3 days, excluding `claude/dreamy-bardeen-*` branches (owned by the separate hourly quick-wins routine). Six PRs were open at cycle start (#198, #322, #316, #325, #327, #341); only #198, #322 and #316 were stale (last activity before 2026-09-03T04:52Z). #325, #327 and #341 all had activity inside the 3-day window and were left untouched this cycle.

None qualified for the "small and mechanical" auto-merge bar (single same-major dependency bump / docs-only / single-purpose cleanup with green CI and no open design questions). All three landed in the "larger or riskier" bucket, so each got a status comment rather than a merge or close, per this routine's instructions. #316 got one; #322 got two (a status comment, then a correction to its mergeability claim); #198 got three (a status comment, then two corrections — one to its disposition source, one retracting a factually wrong git-ancestry claim). The corrections all came from a Codex review of the PR carrying this ledger entry (#343), not from independent findings against the source PRs — see the "Self-review addendum" below.

### PR #198 - Plan Story Lab foundation and production completion

- Status: `pending` (open, in review; three comments posted — original plus two corrections — not merged or closed)
- Disposition this cycle, corrected twice: `STORY_LAB_LIVING_BOOK_AND_DURABLE_JOBS_EXEC_PLAN.md` already supersedes this PR and is the authoritative source here (lines 8-10, 236, 280) — it records that PR #198's Plan 2 scope (Clerk-backed auth, rate limiting, per-user content boundaries, continuity tracking) already shipped via commit `cab9089` and related work, and it explicitly directs that PR #198 "should be closed with a comment pointing to this plan and noting which parts of its Plan 2 already shipped." My first pass here missed that plan and reasoned from the absence of PR #198's own filenames on `main` instead, which produced a correct disposition (close-as-superseded) for an incomplete reason.
- **Git-ancestry claim retracted.** My first two passes also reported that `git merge-tree origin/main` fails with "refusing to merge unrelated histories" and cited root commits `b75a9cd0...` (branch) vs `cab90894...` (`main`) as unrelated. That was a shallow-clone artifact: this working copy was shallow at the time (`git rev-parse --is-shallow-repository` → `true`), so `cab90894...` looked parentless locally when it actually has a parent (`e441bce5...`) outside the fetched depth — not a real history root. After `git fetch --unshallow`, `git merge-base origin/main origin/recovery/story-lab-boundary-pushing-guidance` correctly resolves to `c52d8b7d...`, matching this PR's own recorded base SHA, and `git merge-tree` produces an ordinary three-way merge with two real conflicts (`AGENTS.md`, `PR70_RECOVERY_CHANGELOG.md`) and no others — a ~5-month-stale doc PR's ordinary state, not an unmergeable one. The close-as-superseded recommendation is unaffected (it rests on the exec-plan rationale above, not on mergeability), but the "cannot be merged, manually or otherwise" framing was wrong on the facts, not just overstated, and has been retracted on the PR.
- Why not closed here: architecture/planning documents are explicitly out of this routine's merge-or-close authority for this cycle, even though the exec plan itself already calls for closure — that action is left to a maintainer or a future cycle.
- Recommendation posted to the PR (corrective follow-up comments): close per `STORY_LAB_LIVING_BOOK_AND_DURABLE_JOBS_EXEC_PLAN.md`'s own instruction, citing what already shipped, rather than re-proposing the material as a new PR.
- CI: `Validate Vercel recovery build` failed twice at the PR's last push (account billing lock, per the PR's own body); Vercel deploy and SonarCloud passed.

### PR #322 - 35 advisories cleared inside the ranges already declared (lockfile-only)

- Status: `pending` (open, in review; two comments posted — status comment plus a mergeability correction — not merged)
- Disposition this cycle: Confirmed the Dependabot PR this PR was written to unblock, #318, closed unmerged on 2026-09-03. Its Dependabot replacement, #327 (opened the same day), reintroduces the identical defect - bundling `@angular/*` 20.3.22 to 22.1.5 (a two-major jump) into the same group as unrelated patch/minor advisory fixes, the exact anti-pattern `AGENTS.md` line 218 warns against. So #322's narrower, manifest-untouched fix is still the live candidate for these advisories. CI (Recovery CI, SonarCloud, Vercel) is green.
- **Mergeability claim corrected.** The first pass here checked `git merge-tree` from a shallow local clone and found only a one-file conflict in `PR70_RECOVERY_CHANGELOG.md`. After `git fetch --unshallow` (see the #198 entry above for why that mattered), the same check against the correct merge-base (`d320b63c...`, matching the PR's own recorded base) shows a **second** conflict in `story-generator/package-lock.json` — main has moved that file since this PR branched. The changelog conflict is still the expected, trivial one; the lockfile conflict is real and means "rebase-and-merge" needs an actual lockfile regeneration on rebase, not just a changelog edit.
- Why not merged here: this is a multi-package dependency bundle (npm update touched ~95+ resolutions across two lockfiles, four of them crossing a major version internally) - outside this routine's "single same-major dependency bump" auto-merge bar, even though no `package.json` range changed.
- Recommendation posted to the PR: rebase-and-merge after a maintainer confirms, given #318's closure and #327 repeating its mistake — rebase will need `story-generator/package-lock.json` regenerated via `npm install`/`npm update`, not just a changelog conflict resolved.

### PR #316 - `redactBearerTokens` took the word after any standalone `bearer`

- Status: `pending` (open, in review; status comment posted, not merged)
- Disposition this cycle: Base auto-retargeted to `main` now that #315 merged, as the PR anticipated. `git merge-tree` against current `main` shows no conflicts; CI (SonarCloud, Vercel) is green.
- Why not merged here: 39 commits / 33 comments rewriting the credential-detection logic in `shared/sensitiveTextRedaction.ts`, with the PR's own description naming two explicit open decisions for the owner (the redaction residual's exact boundary; whether to require generated hex keys so the length-based rule can be dropped) plus a deliberately-unfixed known gap. Not small-and-mechanical and not this routine's call regardless of green CI.
- Recommendation posted to the PR: needs a human decision from the repo owner on the two named open questions before merge.

### Self-review addendum (Codex review on the ledger PR itself, #343)

Codex's review of the PR carrying this ledger entry caught a real gap in the #198 disposition above (this section was corrected in place rather than left as originally written): `STORY_LAB_LIVING_BOOK_AND_DURABLE_JOBS_EXEC_PLAN.md` already superseded PR #198 with a recorded closure instruction, which the first pass here missed. It also caught an overclaim about `git merge-tree`'s unrelated-histories failure proving the branch un-mergeable by any means (softened above), stale `pending`-only status labels (clarified in prose, then fixed in the index table's `Actual status` column to `In review` on a second pass), a stale `#194` reference in `STORY_LAB_COMPLETION_HARDENING_EXEC_PLAN.md`'s Dependabot-triage slice that still pointed at a PR closed on 2026-08-28 (fixed, then a second missed `#194` reference in the same file's issue-notes list fixed on a second pass), and the cycle summary's inaccurate claim that every PR got exactly one comment (corrected at the time: #198 got two — later revised to three once the third round below landed).

Two follow-on findings were not applied. Codex suggested duplicating this cycle's log into `PR70_RECOVERY_CHANGELOG.md`; not done, because the scheduling instructions for this specific routine direct it to log only here, to avoid merge conflicts with the separate hourly quick-wins routine that writes to the changelog every cycle. Codex also found that two other required-start documents this PR never touched — `STORY_LAB_FUTURE_WORK_CHECKLIST.md` and `STORY_LAB_FINAL_MERGE_AUDIT_EXEC_PLAN.md` — still carry their own extensive `#194`-as-current-dependency-queue references (both dated "as of 2026-07-11," with open checklist items built around triaging #194 specifically). That is a real, pre-existing staleness problem, but it predates this cycle by about six weeks and spans two large planning documents with a dozen-plus interlocking references each; fixing it thoroughly is a separate documentation pass, not a one-line follow-up to a stale-PR triage cycle. Replied on that thread recommending it be picked up as its own slice rather than folded into this PR.

**Third round: a root-cause finding, not a nit.** Codex then disproved the git-ancestry evidence behind the #198 "unrelated histories" claim outright: `git merge-base b75a9cd0 cab90894` resolves cleanly, and `cab90894` (reported as `main`'s root) actually has a parent outside what this session's working copy had fetched. Root cause: this working copy was a **shallow clone** (`git rev-parse --is-shallow-repository` → `true`) for the entire cycle, so `git rev-list --max-parents=0` returned the shallow boundary commit as if it were the true history root, and `git merge-tree` reported "unrelated histories" because it genuinely could not find the real merge-base within the fetched depth — not because one doesn't exist. After `git fetch --unshallow`, the real merge-base for #198 is `c52d8b7d...` (matching the PR's own recorded base), and the real merge-tree result is two ordinary conflicts (`AGENTS.md`, `PR70_RECOVERY_CHANGELOG.md`), not an unmergeable branch. The same shallow-clone gap also understated #322's conflict set: re-run after unshallowing, it shows a second real conflict in `story-generator/package-lock.json` that the shallow check missed. #316's clean-merge finding was re-verified and held up unchanged. Both #198 and #322 got a further retraction/correction comment on their own PR threads for this. **Lesson for future cycles: verify `git rev-parse --is-shallow-repository` before trusting any `git merge-tree`/`merge-base`/`rev-list --max-parents=0` result, or just `git fetch --unshallow` up front.**

## Stale-PR triage cycle - 2026-09-06 18:16 UTC

Scope per the automated stale-PR recovery routine: open PRs with no activity in the last 3 days, excluding `claude/dreamy-bardeen-*` branches (owned by the separate hourly quick-wins routine). Seven PRs were open at cycle start (#198, #322, #316, #325, #327, #341, and this routine's own prior-cycle PR #343); only #325 and #327 were stale (last activity before 2026-09-03T18:16:54Z — #325 at 16:55 UTC and #327 at 18:02 UTC that day). #198, #322 and #316 were touched by the previous run of this same routine earlier today (04:52 UTC, PR #343, still open/unmerged) and so had recent activity; #341 is a same-week external fork PR; #343 is this routine's own prior output. All were left untouched this cycle under the literal 3-day rule.

Neither #325 nor #327 qualified for the "small and mechanical" auto-merge bar (single same-major dependency bump / docs-only / single-purpose cleanup with green CI and no open design questions). Both landed in the "larger or riskier" bucket — #325 crosses the account/auth boundary explicitly, #327 bundles a major Angular version bump with an unrelated multi-package update — so each got exactly one status comment rather than a merge or close, per this routine's instructions.

### PR #325 - Story Lab Cloud Account/Auth ("a fully-built, tested auth system that no real user could ever reach")

- Status: `pending` (open, in review; one status comment posted, not merged or closed)
- Disposition this cycle: close-as-superseded. While this PR sat open (2026-09-03 through today), `main` independently merged the *same* Story Lab Cloud Account/Auth target via PR #326, then hardened it through 14+ rounds in #328 plus further follow-ups (#329, #336, issue #331). `api/_lib/story-lab/auth/clerkSessionVerifier.ts` now exists on `main` with different content than this PR's version of the same path — confirmed via `git ls-tree` and `git log --diff-filter=A` on that path.
- Mergeable: no longer clean. `git merge-tree` against current `main` shows real content conflicts (not just doc churn) in `PR70_RECOVERY_CHANGELOG.md`, `README.md`, `.env.example`, and multiple `api/_lib/story-lab/auth/*` and `story-generator/src/app/*` files main added independently through #326/#328.
- CI: last run (round 8, `4c31921`) green — CodeRabbit skipped (manual-review repo), Vercel deployment succeeded.
- Not-taken material worth flagging before an eventual close: this PR's frontend design avoids the `@clerk/clerk-js` SDK entirely (redirect to Clerk's hosted Account Portal instead), sidestepping the ~350 transitive packages (`@coinbase/wallet-sdk`, `@solana/wallet-adapter-react`, `@stripe/stripe-js`, etc.) that main's shipped `@clerk/clerk-js`-based implementation took on. Flagged on the PR and here so it reaches `NOT_TAKEN_FEATURE_LEDGER.md` whenever this is actually closed.
- Why not closed here: account/auth boundaries are explicitly out of this routine's merge-or-close authority for this cycle, and `AGENTS.md` requires not-taken material to be recorded before closing a PR — that mining and the actual close are left to a maintainer or a future cycle.
- Recommendation posted to the PR: close-as-superseded by #326/#328, after mining the SDK-avoidance design idea above.

### PR #327 - chore(deps): bump the npm_and_yarn group across 2 directories with 20 updates

- Status: `pending` (open, in review; one status comment posted, not merged)
- Disposition this cycle: needs to be split. Confirmed against current `main`: root `package.json` is still `axios@^1.16.1` and `story-generator/package.json` is still `@angular/core@^20.3.22`, so none of these 20 updates have landed elsewhere yet, and `git merge-tree` shows this PR's diff still applies with zero conflicts. The blocker is scope, not staleness: this group bundles a two-major-version Angular jump (`20.3.22` → `22.1.5`, skipping Angular 21, plus `@angular/build`/`@angular/compiler-cli`) together with unrelated patch/minor bumps (`axios` 1.16.1→1.18.0, `form-data`, `hasown`, ...) in one commit, which is exactly what `AGENTS.md` line 218 says not to do. Per `STORY_LAB_COMPLETION_HARDENING_EXEC_PLAN.md`, this is the third grouped Dependabot PR to repeat that pattern, after #194 and #318 (#318 closed unmerged for the same reason; its narrower lockfile-only replacement #322 is still open as the live alternative for the non-Angular advisories).
- Mergeable: GitHub reports `mergeable_state: unstable` — no conflicts, but the `Vercel` deployment check is failing (`dpl_2kXnwpKVqHc9im5nAqRWTS7C1kZx`); SonarCloud passed.
- Why not merged here: multi-package dependency bundle plus a major framework version bump — outside this routine's "single same-major dependency bump" auto-merge bar regardless of CI state.
- Recommendation posted to the PR: close and let Dependabot (or a maintainer) regenerate two PRs — the safe patch/minor bumps (likely overlapping #322), and a dedicated, separately-validated Angular 20→22 major-upgrade branch that can absorb and fix the current Vercel deployment failure with its own migration testing.

## Stale-PR triage cycle - 2026-09-08 22:16 UTC

Scope per the automated stale-PR recovery routine: open PRs with no activity in the last 3 days, excluding `claude/dreamy-bardeen-*` branches (owned by the separate hourly quick-wins routine). Working copy was shallow at cycle start; ran `git fetch --unshallow` before any mergeability check, per the lesson recorded above. Eight PRs were open at cycle start: #347, #343, #341, #327, #325, #322, #316, #198. Of these, #341 (2026-09-05T23:03:25Z, ~71.2h old) was inside the 3-day window and left untouched. The other seven were stale (last activity 2026-09-06 or earlier).

Two of the seven — #347 and #343 — were this routine's own prior-cycle output: docs-only ledger PRs on `claude/funny-bardeen-*` branches. Both qualified for this routine's mechanical auto-merge bar (docs-only, no unresolved human-reviewer design questions) and were merged this cycle:

- **#347** — `git merge-tree` against current `main` was a clean merge; CI was already green (CodeRabbit skipped, Vercel deployed). Squash-merged as-is.
- **#343** — `git merge-tree` showed one real conflict, entirely inside this ledger file (its own `## Stale-PR triage cycle - 2026-09-06 04:52 UTC` section landing next to #347's `18:16 UTC` section, both additive). Updated the PR's branch with a union merge of `origin/main` (kept both index-table row sets and both dated sections, in chronological order) and pushed. Its Vercel check had been failing since 2026-09-06 on a free-tier daily-deployment-quota error (`api-deployments-free-per-day`), already diagnosed in-thread as unrelated to the docs-only diff; the branch-update push triggered a fresh Vercel deployment two days later, which succeeded (CI green: CodeRabbit skipped, Vercel deployed). Squash-merged after CI turned green.

The remaining five — #325, #327, #322, #316, #198 — were all re-checked (fresh `git merge-tree` against current `main` post-unshallow, current CI status, and the full comment thread) and each already carries a status comment from the prior two cycles (2026-09-06) whose content still matches current reality:

- **#325** (Story Lab Cloud Account/Auth): still real conflicts against `main` (`git merge-tree` confirms `added in both`/`changed in both` across auth files, lockfiles, and app files); no relevant commits landed on `main` since the last comment. No re-comment — nothing material changed.
- **#327** (Dependabot 20-update npm/yarn group): `git merge-tree` is now a clean merge (root `package.json`/`story-generator/package.json` still untouched by anything else on `main`); CI still shows the same Vercel deployment failure from 2026-09-03. Still the same major-Angular-bump-bundling problem the existing comment already names. No re-comment.
- **#322** (35-advisory lockfile-only remediation): `git merge-tree` still shows the same two conflicts (changelog + `story-generator/package-lock.json`) already documented in-thread; #318 still closed, #327 still repeating its mistake. No re-comment.
- **#316** (bearer-token redaction rewrite): `git merge-tree` still clean, CI still green; the two owner-facing open decisions named in the PR description are still open. No re-comment.
- **#198** (Story Lab two-plan freeze, draft): `git merge-tree` still shows the same two ordinary conflicts (`AGENTS.md`, `PR70_RECOVERY_CHANGELOG.md`); `STORY_LAB_LIVING_BOOK_AND_DURABLE_JOBS_EXEC_PLAN.md` still supersedes it. No re-comment.

None of the five were merged or closed: #325 crosses the account/auth boundary, #327 and #322 are multi-package/major-version dependency bundles, #316 and #198 both carry open questions this routine defers to a human (#316 by the PR's own description, #198 as an architecture/planning document explicitly outside this routine's close authority even though the superseding exec plan already calls for its closure).

#341 (external fork PR, Clerk-session-as-fallback-credential) was 0.8 hours short of the 3-day threshold at cycle start and was left untouched under the literal rule.

## Stale-PR triage cycle - 2026-09-09 00:16 UTC

Scope per the automated stale-PR recovery routine: open PRs with no activity in the last 3 days, excluding `claude/dreamy-bardeen-*` branches (owned by the separate hourly quick-wins routine). Six PRs were open at cycle start: #341, #327, #325, #322, #316, #198. Computed staleness against the cycle-start timestamp (2026-09-09T00:16:35Z, cutoff 2026-09-06T00:16:35Z): only **#341** (last activity 2026-09-05T23:03:25Z) fell before the cutoff. The other five all had activity after the cutoff (#327 and #325 at 2026-09-06T18:21Z, #322 at 2026-09-06T05:21:52Z, #316 at 2026-09-06T04:56:25Z, #198 at 2026-09-06T05:21:48Z) — all inside the 3-day window this time, so they were left untouched under the literal rule with no re-check needed.

### PR #341 - fix(api): accept Clerk session as fallback credential when API_KEYS is configured

- Status: `pending` (open, in review; one status comment posted, not merged or closed)
- Disposition this cycle: left open with a status comment. `main` advanced by dozens of commits since this PR's base, but none touched the three files this PR modifies (`api/_lib/middleware/apiAccessControl.ts`, `api/_lib/story-lab/auth/clerkAuthPort.ts`, `tests/api-access-control.test.ts`); confirmed via `git log <base>..origin/main -- <those three paths>` returning empty.
- Mergeable: yes — `git merge --no-commit --no-ff` of the PR branch against current `main` completes automatically with no conflicts.
- CI: not actually run yet. The "Recovery CI" GitHub Actions workflow is stuck at `action_required` (first-time external-fork contributor pending maintainer approval); the Vercel check fails for the same reason ("Authorization required to deploy"); CodeRabbit's automated review is skipped (repo has fewer than 10 stars). No check has executed against this code on the merits.
- Human-review flag: Sourcery's automated review explicitly marked this "Needs a human reviewer" because it changes authorization policy (a verified Clerk session becomes an alternate credential to an API key on paid Story Lab routes), warning that overly permissive session extraction/verification could let unauthorized callers reach protected routes.
- Why not merged here: this PR modifies `enforceApiAccessControl`, the shared auth gate for paid Story Lab routes — inside the account/auth boundary risk area, outside this routine's merge/close authority regardless of CI state or mergeability.
- Recommendation posted to the PR: needs a human decision — (1) a maintainer must approve the pending "Recovery CI" run for this fork PR (currently blocked, not failing), and (2) given Sourcery's flag, a human should specifically review the Clerk-session-fallback trust boundary (`readClerkSessionToken`'s header/cookie parsing, the `CLERK_SECRET_KEY`-backed verifier's trust assumptions, using the Clerk `userId` as the rate-limit identity) before merge. The PR is cleanly mergeable against current `main` as-is, so rebase-and-merge is viable once CI runs green and a reviewer is satisfied with the auth-fallback semantics.
