Created: 2026-05-25 20:16 EDT

# PR #70 Recovery and Open PR Reconciliation Plan

This is a plan, not an execution log. The goal is to get from current `main` to a new branch that uses PR #70 as the story-lab baseline, makes the app Vercel-first, and leaves every currently open PR either merged into the recovery branch, ported/cherry-picked with its source PR closed, or closed after mining the useful material.

Current open PR list was checked with:

```bash
gh pr list --repo Phazzie/FairytaleswithSpice --state open --limit 100 --json number,title,headRefName,baseRefName,isDraft,mergeable,author,updatedAt
```

Open PRs at that check: #86, #85, #84, #77, #76, #75, #74, #73, #72, #71, #70, #67, #65, #64, #63, #56, #55, #54, #53, #50, #47, #45, #44, #43, #42, #41, #40, #39, #31, #30, #29, #28, #26, #24, #22.

## Pre-Mortem: What I Expect To Wish We Had Anticipated

These are the questions I would ask myself at the end if the work went badly, and the answers I want baked into the plan before starting.

| Question | Anticipated answer | Plan response |
|---|---|---|
| Did we underestimate the damage from old path conventions? | Yes. Several PRs use `api/lib`, others use `story-generator/src/api/lib`, and current Vercel-oriented work has `api/_lib`. | Make path normalization an explicit first-class step after #70. No story feature is accepted until it is located in the canonical Vercel path. |
| Did we let old deployment assumptions leak back in? | Likely. `AGENTS.md` currently says DigitalOcean only, while the product direction is now Vercel. | Update agent/docs early so future agents do not reintroduce DigitalOcean or reject Vercel config. |
| Did we close audio PRs too casually and lose story-generation ideas embedded inside them? | This is the biggest risk. Audio PRs often contain emotion taxonomies, speaker tags, voice-evolution prompts, narrator atmosphere, and character consistency logic that can improve story generation even if audio is deferred. | Before closing any audio PR, add story-affecting prompt metadata to the not-taken ledger and create a future-story-generation backlog entry. |
| Did "cherry-pick" become a euphemism for manually copying random code? | It can. Some branches are too stale for literal `git cherry-pick`. | Treat every port as source-attributed: record source PR, files inspected, commits if used, feature accepted, feature not taken, and verification result. |
| Did we merge #70 but fail to preserve the current working story-generation core? | Possible. #70 is a large UI/contract direction change and may overwrite current prompt quality work. | Before and after #70, diff story service and contracts. Keep current prompt/model/token improvements unless #70 has an intentional replacement. |
| Did we forget that direct GitHub mergeability is against `main`, not the new #70 baseline branch? | Very possible. A PR marked mergeable against `main` can still conflict after #70 lands locally. | Re-test each candidate against the recovery branch. The `gh pr list` mergeability value is only a starting signal. |
| Did we rely on tests that are already stale? | Yes, some old tests import missing `api/lib` compiled JS or need Chrome. | Create a recovery smoke suite that verifies build, TypeScript, story service, Vercel routing, and at least one Angular/browser check. Document skipped tests with exact reason. |
| Did we close PRs without enough context for future mining? | That would make this cleanup irreversible in practice. | Every closed or partial PR gets a ledger row with "not taking now" material and "future mining value." Do not close silently. |
| Did dependency PRs hide unrelated lockfile churn? | Likely. Current worktree already has dirty lockfiles from install work. | Resolve/stash/commit current lockfile state before branching. Merge dependency PRs only after baseline tests pass. |
| Did we overbuild CI again? | PR #39 and #41 both tend toward heavy workflow suites. | Port a lean Vercel-focused CI path first. Record heavyweight workflow ideas in the not-taken ledger. |
| Did we conflate story-lab mock APIs with production story generation? | Likely after #70. | Separate "mock/demo story-lab endpoint" from production `StoryService` behavior and make the distinction visible in contracts/tests. |
| Did we retarget or close PRs in a way that confused GitHub history? | Possible. | Prefer a new recovery branch and final PR. Close old PRs as superseded only after their material is either merged, ported, or logged. |

## Lessons Learned To Incorporate

Sources read before writing this plan:

- `IMPROVEMENT_PLAN.md`, especially "Lessons Learned (December 2025)"
- `CHANGELOG.md`
- PR #77 documentation analysis files: `DOCUMENTATION_ANALYSIS_SUMMARY.md`, `repodocsanalysis.md`, `repodocs.md`
- `AGENTS.md`
- `PR_USEFUL_MATERIAL_INVENTORY.md`

Lessons to make operational:

1. Contracts define everything.
   - Before porting a feature that crosses UI/API/service boundaries, update both frontend and backend contracts.
   - Add a contract diff review gate after each story-generation feature cluster.

2. Deduplication prevents drift.
   - Centralize model name, token calculation, author-style config, randomization helpers, and story state types.
   - Reject ports that reintroduce multiple active story services.

3. Mock-first development is valuable, but mocks cannot become product truth.
   - Keep #70 story-lab mocks if useful for UI, but production story generation must still flow through the real service seam.

4. Test infrastructure is part of the migration.
   - Do not postpone tests until after all PR work.
   - Run a small validation set after each cluster and fix failures as they appear.

5. Model version updates require system-wide validation.
   - Any story service change must check generation, continuation, streaming, and token budgeting.

6. Incremental refactoring beats big rewrites.
   - #70 is the baseline exception. After #70, every capability lands as a small, attributed port.

7. Documentation can become fragmented.
   - Add a dedicated `LESSONS_LEARNED.md` during execution.
   - Add a final report instead of creating many disconnected status docs.

8. Service layer preservation makes deployment switches easier.
   - Even though the target is Vercel, preserve a transport-agnostic story service.
   - Vercel routes should call the same service contract, not contain business logic.

9. Platform assumptions must be explicit.
   - Current docs conflict: some say Vercel, some say DigitalOcean, `AGENTS.md` says DigitalOcean only.
   - The recovery branch must update agent instructions, README, and deployment docs so Vercel is canonical.

## Tracking System

Create and maintain these visible files on the recovery branch:

| File | Purpose |
|---|---|
| `PR70_RECOVERY_PLAN.md` | This plan. Update only if the strategy changes. |
| `PR70_RECOVERY_CHANGELOG.md` | Chronological work log, decisions, validation results, and self-review notes. |
| `PR70_RECOVERY_LEDGER.md` | Running status for every PR: action, accepted material, not-taken material, conflicts, verification, closure status. |
| `NOT_TAKEN_FEATURE_LEDGER.md` | Extracted ideas from closed or partially ported PRs, especially story-generation ideas from audio branches. |
| `LESSONS_LEARNED.md` | Consolidated project lessons, with current Vercel-first corrections and links to old lesson docs. |
| `PR70_RECOVERY_FINAL_REPORT.md` | Final report after all PRs are merged, ported, or closed. |

The ledger schema:

```markdown
## PR #NN - Title

- Source branch:
- Planned disposition: merge | port/cherry-pick | close
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

## Branch Strategy

1. Preserve current local state.
   - Current dirty files before this plan: `package-lock.json`, `node_modules/.package-lock.json`, and untracked report/plan files.
   - Decide whether to commit docs first, stash lockfiles, or reset generated lockfile noise. Do not destroy unreviewed local changes.

2. Refresh remote data.
   - `git fetch origin`
   - `gh pr list ...` again immediately before execution.
   - Fetch PR heads as needed.

3. Create recovery branch from current `origin/main`.
   - Proposed branch: `recovery/pr70-story-lab-vercel`
   - Actual branch used in this checkout: `recovery-pr70-story-lab-vercel`
   - Tag the starting point locally: `pre-pr70-recovery-main-YYYYMMDD`

4. Merge PR #70 into the recovery branch.
   - Use a real merge commit, not squash, so the branch history clearly starts from #70.
   - Resolve conflicts with these priorities:
     - Vercel is canonical.
     - `api/_lib` is canonical for shared Vercel server code unless deliberate restructuring says otherwise.
     - Audio remains deferred.
     - Story-generation quality from current `main` is preserved unless #70 intentionally replaces it.

5. Create a baseline stabilization commit.
   - Fix build/test fallout from #70.
   - Align contracts.
   - Update `AGENTS.md` and deployment docs to remove DigitalOcean-only guidance.
   - Ensure the app has a coherent Vercel route structure.

6. Port or merge remaining PRs in clusters.
   - After each cluster, run validation and update the ledgers.
   - Close source PRs only after material is represented in the branch or logged as not taken.

7. Open one final recovery PR.
   - Base: `main`
   - Head: `recovery/pr70-story-lab-vercel`
   - Body links the ledger, not-taken feature ledger, lessons file, and final report.

## Self-Review Cadence

Run a self-review after:

- The #70 merge is resolved.
- Every 3 PR dispositions.
- Every story-generation feature port.
- Every dependency or CI change.
- Before closing any PR with story-generation relevance.
- Before opening the final recovery PR.

Self-review checklist:

1. Did I update `PR70_RECOVERY_LEDGER.md` and `NOT_TAKEN_FEATURE_LEDGER.md` before moving on?
2. Did I preserve or intentionally replace story-generation behavior?
3. Did I accidentally bring back DigitalOcean-only deployment assumptions?
4. Did I accidentally bring back audio routes or audio tests?
5. Are contracts updated in both frontend and backend locations?
6. Did a branch use old `api/lib` or `story-generator/src/api/lib` paths that need Vercel normalization?
7. Did I centralize model names, token math, randomization, and author-style config instead of duplicating them?
8. Did I run a targeted check that matches the changed surface?
9. If a check failed, did I fix it now or document a concrete reason and next step?
10. Would a later engineer understand what was not taken and why?

If the review finds a fixable problem, fix it immediately before proceeding. If it is not fixable in the current cluster, add it to the ledger and final report with exact file paths and reproduction notes.

## Execution Phases

### Phase 0 - Preflight and Baseline Evidence

Actions:

1. Record `git status --short`.
2. Save current PR inventory and open PR list to the ledger.
3. Resolve the dirty lockfile situation before branch work.
4. Confirm current build/test baseline from `main` if feasible.
5. Create `LESSONS_LEARNED.md` with a short consolidation of the existing lessons and a Vercel-first correction.

Self-review:

- Are local changes preserved?
- Are current open PRs recorded?
- Are current docs known to be contradictory?

### Phase 1 - PR #70 Baseline Merge

Actions:

1. Create `recovery/pr70-story-lab-vercel`.
2. Merge PR #70.
3. Resolve conflicts in `story-generator/src/app/*`, contracts, services, tests, and API endpoints.
4. Normalize to Vercel route and `_lib` conventions.
5. Run targeted build/test checks.
6. Update ledger for #70.

Acceptance:

- The branch builds or has a documented, narrow failure.
- The app direction is clearly story-lab/workbench.
- Vercel is the documented target.
- No old audio routes are resurrected.

### Phase 2 - Low-Risk Direct Merges

Candidate direct merges:

- #86 design system doc
- #85 path-to-regexp security bump
- #84 grouped dependency bump, only after baseline build is known

Rules:

- If #84 creates dependency churn or breaks Angular/Vercel, close it and recreate a fresh dependency update on the recovery branch.
- Dependency PRs must not be merged just to clear the queue.

### Phase 3 - Story Generation Correctness and Quality Ports

Port in this order:

1. #50 progress/hydration fix
2. #64 Fisher-Yates/randomization and selected tests
3. #65 model consistency, token calculation, quality parameters, verification tests
4. #67 author-style config extraction, duplicate service cleanup decisions, audit notes
5. #24 trope subversion engine, rebuilt into current story service
6. #31 story arc and cliffhanger logic, without audiobook coupling

Self-review after each PR:

- Does this change affect prompt quality, token budgeting, continuation, streaming, or story metadata?
- Did I port into the canonical service?
- Did I leave a not-taken list for everything skipped?

### Phase 4 - Story Lab Workflow Expansion

Port/mine in this order:

1. #72 multi-chapter backend contracts and behavior
2. #75 chapter batching UI and continuity panels
3. #73 story state snapshot concepts, without DigitalOcean Postgres as the required store
4. #71 only for comparison; close as superseded
5. #74 proving grounds prompt lab, preferably behind a dev/internal route

Goal:

- Preserve the #70 workbench direction while bringing in the best later chapter/state workflow ideas.

### Phase 5 - Vercel CI, Tests, and Docs

Port/mine:

1. #41 minimal Vercel deploy workflow and API tests
2. #39 useful CI ideas, not the full heavyweight workflow suite
3. #77 documentation-analysis lessons, not the generated bulk docs unless they still fit
4. #53 docs cleanup intent, not stale architecture or `node_modules`
5. #76 close as empty/no committed material

Goal:

- A lean CI/deploy setup that validates the recovery branch on Vercel without recreating the previous overbuilt workflow stack.

### Phase 6 - Deployment and Storage Cleanup

Close/mine:

1. #54 DigitalOcean deployment infrastructure
2. #56 DigitalOcean backend services research
3. #63 database investigation

Goal:

- Extract provider-neutral storage/cache lessons.
- Do not merge DigitalOcean infrastructure into the Vercel branch.
- If persistence is needed, create a new Vercel storage decision rather than inheriting DigitalOcean Postgres assumptions.

### Phase 7 - UI/UX and Visual Cleanup

Port/mine:

1. #26 notification service, form validation, accessibility, toast patterns
2. #40 visual ideas only if they fit #70 and design.md

Goal:

- Improve the app surface without replacing the story-lab direction twice.

### Phase 8 - Audio Cluster Mining and Closure

Close after mining story-generation material:

- #22, #28, #29, #30, #42, #43, #44, #45, #47, #55

Rules:

- Do not restore audio routes, audio services, ElevenLabs dependencies, or audio tests.
- Do mine story-generation-relevant material:
  - speaker tag formats
  - emotion taxonomy
  - character consistency concepts
  - narrator atmosphere tags
  - voice-evolution metadata
  - scene pacing for narration
  - dialogue segmentation rules that improve generated prose

### Phase 9 - Final Validation, PR Closure, and Report

Actions:

1. Run final validation:
   - root dependency sanity
   - Angular build
   - targeted story service tests
   - targeted contract tests
   - Vercel config inspection/build if credentials allow
   - browser smoke check if dev server can run
2. Update every ledger row with actual disposition.
3. Close all superseded PRs with comments or body updates that point to the recovery branch and ledger.
4. Open the final recovery PR.
5. Write `PR70_RECOVERY_FINAL_REPORT.md`.

## Initial PR Disposition Ledger

This table is the starting plan. During execution, the separate ledger should record actual outcomes.

| PR | Planned action | Material to take | Material not taking now / ledger seed |
|---:|---|---|---|
| #86 | Merge | `design.md` design tokens, visual identity, component guidance. | None expected. If #70 design conflicts, reconcile into one design source rather than keeping competing style rules. |
| #85 | Merge | Security bump for `path-to-regexp` in `story-generator`. | None expected beyond generated lockfile details. |
| #84 | Try merge; otherwise recreate and close | Dependency/security updates if compatible with #70 baseline. | If closed: stale grouped lockfile diff, dependency updates that are better regenerated fresh after #70. Do not take dependency churn that breaks Angular/Vercel. |
| #77 | Close after mining | Documentation-analysis lessons and recommendation to consolidate docs. | Do not take the generated bulk docs wholesale if they reflect outdated DigitalOcean/audio architecture. Do not add another giant docs dump without lifecycle rules. |
| #76 | Close | Nothing; no committed material. | Planned `spicyfairytaleremix.md` analysis was not present. No feature material to recover unless rerun from scratch. |
| #75 | Port/cherry-pick then close | Chapter batching UI, batch progress queue, continuity panels, collapsible long chapter groups, batch metadata. | Do not take wholesale UI/CSS if it conflicts with #70. Do not take stale README claims. Do not duplicate contract shapes already superseded by #70/#72. |
| #74 | Port later or close after mining | Proving grounds prompt lab, templates, generation-logic viewer, evaluation/history/export ideas. | Do not take full route/app shell if it destabilizes #70. Do not take Grok evaluation wiring until env/config is settled. Not core user flow. |
| #73 | Recreate/port then close | Story state snapshots, character arcs, plot threads, continuity deltas, in-memory fallback idea. | Do not take DigitalOcean Postgres as required storage. Do not add `pg` dependency until Vercel storage choice is made. Do not take old `api/lib` path implementation. |
| #72 | Port/cherry-pick then close | Multi-chapter generation contracts, chapter arrays, requested chapter counts, partial failure handling, streaming updates. | Do not take wholesale old Angular rewrite if #70 owns UI. Do not take tests that import missing old compiled paths without adapting them. |
| #71 | Close after comparison | Compare early helpers for chapter count normalization, sequencing titles, partial failures. | Do not take early implementation if #72/#75/#70 cover it. Do not keep duplicate batch semantics. |
| #70 | Merge into recovery branch, then close as superseded by recovery PR | Story-lab/workbench baseline, story-lab contracts, continuity/debug console, streaming genesis, major Angular UI direction. | Do not directly merge the old PR to `main` without Vercel and story-quality stabilization. If any #70 mock endpoint conflicts with production story generation, split mock/demo behavior from real service behavior. |
| #67 | Port/cherry-pick then close | Audit findings, deployment-readiness checklist, duplicate-service cleanup, author-style config extraction, test syntax cleanup. | Do not take stale broad refactor blindly. Do not take old path assumptions. Do not preserve duplicate service copies just because the PR touched them. |
| #65 | Port/cherry-pick then close | Grok model consistency, better token calculation, quality parameters, verification tests/docs. | Do not take duplicated story service copy. Do not take hardcoded model values if a constant/config can own them. Do not accept tests until adapted to canonical paths. |
| #64 | Port/cherry-pick then close | Fisher-Yates shuffle, biased randomization fix, selected Angular/test expectation fixes, useful Playwright scaffold if still appropriate. | Do not take tracked `node_modules` churn. Do not take broad test rewrites that mask current failures. Do not take old service path changes without normalization. |
| #63 | Close after mining | Storage decision tree, schema ideas, persistence requirements. | Do not take DigitalOcean-specific database docs as product direction. Do not add Postgres/Mongo/Redis dependency from this branch without a Vercel storage decision. |
| #56 | Close after mining | Cache/rate-limit concepts, storage/cost questions, provider-neutral backend-service ideas. | Do not take DigitalOcean Spaces/Redis/Postgres deployment instructions. Do not take `cacheService.ts` as-is if it assumes the wrong platform. |
| #55 | Close after mining | Voice-evolution prompt metadata, 90+ emotion taxonomy, narrator atmosphere cues, character consistency ideas that can improve story generation. | Do not take audio service implementation, ElevenLabs wiring, audio lockfile churn, or UI audio controls. |
| #54 | Close | Possibly a cautionary reference for non-Vercel deployment. | Do not take Dockerfiles, `server.js`, `.do/app.yaml`, DigitalOcean docs, or Vercel-to-DigitalOcean migration direction. |
| #53 | Close after mining | Docs cleanup/archive intent, serverless reference cleanup idea. | Do not take massive `node_modules` changes. Do not take stale architecture statements. Recreate doc cleanup cleanly. |
| #50 | Port/cherry-pick then close | Progress timeout ID fix, hydration/theme selection fix, useful diagnosis in `PROGRESS_METER_FIX.md`. | Do not take `app-no-progress.ts.alternative` as product direction unless progress is intentionally removed. Do not preserve old UI if #70 supersedes it. |
| #47 | Close after mining | Audio pipeline research, speaker parsing observations, story output formatting implications. | Do not take enhanced audio service prototypes, Web Audio player work, or audio route assumptions. |
| #45 | Close after mining | Emotion taxonomy, character memory ideas, fuzzy emotion matching concepts that may enrich story metadata. | Do not take audio service code, backend audio paths, demos/tests tied to ElevenLabs. |
| #44 | Close after mining | Character-driven narration concepts, emotion mapping, scene/sound-effect metadata ideas that may inform future story tags. | Do not take audio player, sound effects API, ElevenLabs implementation, or audio docs as active product scope. |
| #43 | Close after mining | Emotion-aware character/profile concepts and UI control ideas for future narration. | Do not take `AudioEnhancementService`, enhanced audio player, old backend structure, or audio contracts as active code. |
| #42 | Close after mining | Streaming architecture ideas and emotion mapping that may later help narration-aware story output. | Do not take `api/audio/streaming.ts`, streaming audio service, ElevenLabs API changes, or audio tests. |
| #41 | Port/cherry-pick then close | Minimal Vercel CI/deploy workflow, API Jest or integration test ideas, CodeQL/security checks if lean. | Do not take stale audio/backend changes. Do not take the full enterprise workflow suite if it slows recovery. Do not take Vercel config that conflicts with current #70 branch. |
| #40 | Close after mining | Visual motifs that fit design.md and #70: refined layout ideas, theme treatment, responsive polish. | Do not take wholesale mystical UI rewrite, particles/3D effects, or competing `app.html`/`app.css` replacement. No story-generation material expected. |
| #39 | Close after mining | CI concepts: contract validation, visual testing, Lighthouse, dependency checks. | Do not take six heavyweight workflows as-is. Do not take analytics/dashboard workflow unless it has a real consumer. |
| #31 | Recreate/port then close | Story arc service concepts, cliffhanger analysis, enhanced continuation, chapter/arc UI ideas. | Do not take audiobook compilation, audio coupling, old route shapes, or stale frontend rewrite. |
| #30 | Close after mining | Dialogue parser and speaker-tag prompt ideas that may improve generated story structure. | Do not take multi-voice audio service, ElevenLabs v3 implementation, stitching, or audio UI. |
| #29 | Close after mining | Speaker segment model, character voice type metadata, multi-voice contract ideas for future story metadata. | Do not take multi-voice audio service implementation, mock audio generation, or audio UI. |
| #28 | Close after mining | Modular decomposition ideas: dialogue parser, character voice service, stitching boundaries for future audio rebuild. | Do not take code directly because base branch is not `main` and audio is deferred. Do not take old branch-specific conflicts. |
| #26 | Port/cherry-pick then close | Notification service, form validation service, toast component, loading/error/retry states, ARIA/live-region accessibility. | Do not take wholesale old UI layout if #70 owns the app shell. Do not duplicate validation already present after #70. |
| #24 | Recreate/port then close | Trope database, trope subversion service, prompt enhancement, chapter consistency metadata, uniqueness tests. | Do not take old backend layout, demos as product code, or any service path that bypasses current story-generation seam. |
| #22 | Close after mining | Early dialogue parsing, speaker tag, voice mapping, emotional inflection ideas that may affect generated text. | Do not take complete audio pipeline, audio routes, or ElevenLabs dependency. |

## Story-Generation Mining Priorities

The highest-risk loss would be story-generation ideas hidden in stale or audio-heavy PRs. Mine these before closure:

1. #24: trope subversion, prompt enhancement, uniqueness metadata.
2. #31: story arcs, cliffhangers, continuation context.
3. #73: story state snapshots and continuity deltas.
4. #72/#75/#71: multi-chapter structures and partial failure semantics.
5. #65/#64/#67/#50: quality, randomization, config extraction, generation UX correctness.
6. #55/#45/#44/#43/#42/#30/#29/#28/#22: emotion, speaker tags, narrator atmosphere, character consistency.
7. #74: prompt evaluation and proving-ground loops.

## Final Report Template

`PR70_RECOVERY_FINAL_REPORT.md` should answer these questions:

1. What branch was created, and what commit did it start from?
2. How was #70 merged, and what conflicts appeared?
3. Which PRs were merged directly?
4. Which PRs were ported/cherry-picked?
5. Which PRs were closed without code, and why?
6. What useful material did we intentionally not take?
7. What story-generation ideas remain in the not-taken ledger?
8. What surprised me?
9. What did not surprise me?
10. What should I have anticipated but did not?
11. What did I anticipate that did not happen?
12. Where did the plan change, and why?
13. Which self-review findings caused immediate fixes?
14. Which self-review findings were documented but not fixed?
15. Did the repo become more Vercel-ready?
16. Did any DigitalOcean assumption remain?
17. Did any audio code accidentally return?
18. Did contracts remain coherent across frontend/backend/API?
19. Did story generation improve, regress, or stay functionally equivalent?
20. What tests were run, what failed, and what was skipped?
21. What would I do differently on the next recovery pass?

## Definition of Done

This recovery is done when:

1. `recovery-pr70-story-lab-vercel` exists and includes #70 as the baseline.
2. Every open PR from the inventory is either:
   - merged into the recovery branch,
   - ported/cherry-picked and then closed,
   - closed with not-taken material recorded.
3. Story-generation-relevant material from closed PRs is captured in `NOT_TAKEN_FEATURE_LEDGER.md`.
4. Vercel is the documented deployment target.
5. DigitalOcean-only docs/instructions are removed or clearly archived as historical.
6. Audio remains deferred and is not active in routes/tests.
7. A final validation pass has been run or skipped with exact reasons.
8. `PR70_RECOVERY_FINAL_REPORT.md` exists.
9. The final recovery PR links the plan, ledger, not-taken feature ledger, lessons file, and final report.
