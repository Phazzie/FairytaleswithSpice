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
