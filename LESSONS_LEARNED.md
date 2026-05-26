Created: 2026-05-26 00:12 EDT

# Lessons Learned

This file consolidates lessons that should shape the PR #70 recovery and future work. It intentionally corrects older repo guidance where the deployment target has changed.

## Current Recovery Corrections

1. Vercel is the active deployment target.
   - Older DigitalOcean docs are historical for this recovery.
   - Do not let `.do/*` or old handoff docs override `PR70_RECOVERY_PLAN.md`.

2. Path drift is one of the repo's main failure modes.
   - Current Vercel-oriented code uses `api/_lib/*`.
   - Older PRs may use `api/lib/*` or `story-generator/src/api/lib/*`.
   - Ported code must be normalized instead of creating another active copy.

3. Audio can contain story-generation value even when audio is deferred.
   - Mine emotion, speaker-tag, narrator-atmosphere, dialogue segmentation, and character-consistency ideas before closing audio PRs.
   - Do not restore active audio routes/services/tests unless explicitly requested.

4. PR #70 is a direction-setting baseline, not a license to discard working story generation.
   - Preserve current model, token, prompt, continuation, and streaming improvements unless #70 intentionally replaces them with something better.

## Lessons From Existing Repo Docs

1. Contracts define everything.
   - Update frontend and backend seams before implementation.
   - Test contract shape at boundaries, not only internal helper behavior.

2. Deduplication prevents drift.
   - Centralize Grok model names, token calculation, randomization helpers, author-style configuration, and story state models.
   - Duplicated story services caused repeated confusion and stale fixes.

3. Mock-first development helps, but mocks must not become product truth.
   - Keep mock paths useful for development.
   - Keep production story generation flowing through the real service seam.

4. Test infrastructure is part of feature work.
   - A migration is not healthy if tests are left for the end.
   - Fix or document test failures at the cluster where they are introduced.

5. AI model changes require full story-flow validation.
   - Check generation, continuation, streaming, and token budgeting together.
   - Model constants must not be hardcoded in several places.

6. Incremental refactoring works better than broad mixed rewrites.
   - After PR #70 lands as the deliberate baseline shift, every other capability should be a small, source-attributed port.

7. Documentation needs lifecycle control.
   - The repo has a history of many overlapping status docs.
   - Prefer one running changelog, one lessons file, one PR ledger, and one final report for this recovery.

8. Deployment configuration is product code.
   - Vercel config, build commands, API route layout, and helper-file placement can break the app as surely as TypeScript code can.

## New Lessons During This Recovery

### 2026-05-26

- Agent instructions must be corrected before long-running recovery work. Otherwise future agents will follow stale deployment assumptions and undo the user's Vercel direction.
- Angular 20 in this checkout should be verified with Node 20. Local Node v23.8.0 can abort during `ng build` without useful diagnostics, while the same branch builds under temporary Node v20.20.2.
- PR #70 showed a concrete Angular-template lesson: keep object spread, arrow functions, and complex state updates out of templates. Put that logic on the component class so Angular's template compiler and type checker can reason about it.
- AI generation configuration needs executable verification. `tests/verify-ai-fixes.test.ts` caught stale path assumptions and now checks model name, token budgeting, API parameters, and timeout shape against the canonical story service.
- A passing process exit is not enough evidence when a custom test harness is involved. The #67 pass found a test that printed a failure but exited 0 because it counted a non-existent `failed` property.
- Duplicate service deletion should happen before deeper feature ports. Keeping `story-generator/src/api/lib` alive made every story-generation fix twice as risky and encouraged stale-path imports.
- Port the idea, not the tone, when resurrecting old prompt features. PR #24's trope subversion concept was valuable, but several raw inversions needed adaptation so the app keeps a dark-romance voice instead of accidental parody.
- Do not add fake persistence to a Vercel-targeted app. PR #31's in-memory story arc service is useful as a model reference but would create false durability if exposed as an active serverless endpoint.
- Port breaking contract ideas additively when current callers still exist. PR #72's chapter arrays are useful, but replacing legacy story fields outright would break existing routes/tests before the #70 story-lab adapter is ready.
- Batch generation needs an explicit budget policy. PR #72 split the requested word count across chapters; the recovery branch preserves that behavior for live calls, but the product should decide whether users expect a total-batch or per-chapter budget.
- UI workflow ports should follow the current seam, not resurrect stale routes. PR #75's batch queue and suggested prompts were useful, but the old `/api/story/batch` path was not worth reviving beside #70's story-lab continuation API.
- Name non-durable state for what it is. PR #73's in-memory fallback is useful for local story-lab continuity, but on Vercel it must stay labeled as transient until a durable storage product is selected.
- Prefer explicit service validation over silent normalization. PR #71's invalid-count clamping is a possible UI behavior, but the service boundary should keep rejecting invalid caller input.
- Codify repeated validation as a script. The recovery process kept depending on a remembered checklist, so `scripts/recovery/preflight.sh` now makes the expected checks visible and repeatable.
- Keep provider credentials server-side, even in internal tools. PR #74's proving grounds needed Grok evaluation, but browser `localStorage` API keys do not fit a Vercel deployment path.
- Build verification should understand the framework output mode. Angular SSR routes can emit `browser/index.csr.html` instead of prerendered `browser/index.html`, so verifiers should check the actual supported output shapes.
- Browser and server bootstrap must be kept in lockstep after adding Angular routing. PR #74 initially bootstrapped `AppRoot` in `main.ts` but still bootstrapped `App` in `main.server.ts`, so the build passed while SSR served the wrong route body.
- Port UI infrastructure against current contracts, not old form names. PR #26's validation idea was useful, but the implementation had to be rebuilt around the #70 Story Lab blueprint seam.
- Record browser-test environment failures separately from code failures. The Angular spec bundle can build while Karma still fails because ChromeHeadless never captures; that needs environment follow-up, not silent treatment as a spec pass.
- CI should run the recovery's current truth, not a stale idealized repo shape. PR #41/#39 had useful workflow ideas, but their concrete jobs assumed old backend/API paths and would have undone Vercel `_lib` normalization.
- Dependency PRs need clean lockfile state and coherent framework versions. PR #84 was dependency-focused by intent, but its stale branch comparison and mixed Angular 20/21 package set make a fresh update safer than a merge.
- Open a replacement PR before closing superseded PRs. PR #87 gives the old source PRs a concrete review target and keeps closure comments understandable.
- Treat docs and research branches as code branches until proven otherwise. PR #77/#63/#56 looked like analysis work, but their branch bases also carried stale `api/lib` path regressions, Vercel file deletions, audio files, and package churn.
- Provider research must be translated before implementation. DigitalOcean storage/cache/deploy ideas from #54/#56/#63 are useful categories, but they should become Vercel-specific decisions before any code or docs are accepted.
- Documentation cleanup should not happen in the middle of recovery unless it reduces active confusion immediately. PR #53's archive pattern is useful, but broad cleanup belongs after the recovery branch lands.
- Visual experiments should be mined for workflow structure before styling. PR #40 had useful grouping/status ideas, but its full particle-heavy mystical shell conflicts with the current Story Lab direction and design constraints.
