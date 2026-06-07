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
- Audio branches can improve story generation even when audio is deferred. The reusable layer is the prompt/metadata vocabulary: speaker tags, emotion taxonomy, narrator atmosphere, voice evolution, character memory, and dialogue segmentation.
- Do not force story output into machine-first JSON just to support audio. PR #55's strongest lesson is to keep prose readable and add explicit, reviewable tags or metadata only where they serve the story.
- Repeated audio PRs should be treated as a design space, not as merge candidates. Early branches have cleaner parser/segment seams; later branches have richer emotion/personality concepts. A future audio rebuild should synthesize, not merge.
- In-memory audio jobs and voice memories are not durable product behavior on Vercel. If audio resumes, choose a queue/workflow and storage path before adding start/status/result/cancel APIs.
- Local recovery checks must compile Vercel API functions directly. Angular builds and root TSX tests do not catch plain Vercel function import drift, Next.js-only type imports, or function compiler target issues.
- Angular SSR/CSR output needs deployment-aware verification. This branch emits `index.csr.html`; Vercel fallback rewrites need an actual `index.html`, so the build now materializes and verifies it.
- Keep shared helpers out of deployable Vercel function paths. TypeScript files under ordinary `api/*` folders can be treated as functions; reusable Story Lab helpers belong under `api/_lib/*`.
- Count deployable Vercel functions before assuming a preview will deploy. Removing deferred audio routes and moving helper modules dropped the branch to 12 Node functions and unblocked deployment.
- Protected Vercel previews need an authenticated smoke-test path. A 401 from unauthenticated `curl` can mean deployment protection, not app failure; use Vercel share/access tooling or a bypass token for runtime checks.
- Deferred scope should be physically inactive, not merely deprioritized. Leaving audio endpoints and services in the active API tree made deployment harder even though audio was out of scope.
- Review-polish branches need a hard scope boundary. Fix review comments, validate, and merge; put the next large product move in a separate plan/branch so cleanup work does not become another oversized mixed PR.
- Prefer direct local tool binaries in recovery scripts when `npx` behavior is ambiguous. In this repo, `npx tsc -p ...` can hang under `npm exec`, while `node_modules/.bin/tsc` runs predictably.
- A function-count check is stronger when it names the expected functions. A raw count can pass while hiding accidental helper placement; an allow-list makes deployable API shape intentional.
- A Story Lab-to-engine bridge becomes technical debt if it compresses rich blueprint fields into a generic prompt string. Promote the rich fields into the real generation contract instead.
- Mock fallback must be explicit and honest. It is acceptable when no provider key exists or a mock flag is set; it should not hide configured provider failures.
- Heuristic continuity state should be labeled by behavior, not ambition. Until AI state extraction or durable persistence exists, real generated prose can seed Story Lab panels, but those panels are not proof of durable continuity intelligence.
- When a rich UI uses free-form labels but an older engine uses a closed union, preserve the rich data separately and canonicalize only the legacy field. Casting free-form IDs into closed contracts hides generation bugs.
- PR-level checks and main-branch quality gates are different evidence. A PR can pass its checks while the merged branch fails broader Sonar conditions; treat runtime deployment proof and repository-quality proof as separate shipping gates.
- Browser smoke should exercise the deployable artifact when dev-server startup is slow or runtime-sensitive. For this Angular/Vercel recovery, a build-backed static smoke is slower than `ng serve` but gives stronger MVP evidence and cleaner process cleanup.
- Browser smoke for AI-generated output should assert stable app state, not exact generated copy. Use test IDs and structural milestones such as selected chapter number so live-provider variation does not create false failures.
- Test-only static servers still need production-grade path boundaries. A smoke harness should not create a new file-serving risk just because it only runs locally.
- Production-only evidence needs its own follow-up artifact path. If a report cannot be completed until after merge, plan a small post-merge evidence update instead of leaving the report permanently half true.
- A stale Dependabot PR can be mergeable and still be the wrong dependency answer. Recreate the dependency intent on the current baseline when newer patch releases exist or the branch would obscure current product work.
- Dependency/security reports need runtime and dev/test categories. A clean `npm audit --omit=dev` can support a production-runtime claim, but a red full audit still needs an honest test-tooling follow-up.
- Do not commit generated `node_modules` churn just because old history tracks some dependency files. Package manifests and lockfiles are the reviewable source of truth for dependency updates.
- Small Sonar issues should be fixed during shipping hardening when the fix is local and low risk. Reporting them without fixing is useful only when the issue is broad, historical, or risky to change in the current branch.
- Recovery preflight checks must account for install-order effects. If CI runs `npm ci` before `git diff --check` while old history still tracks generated dependency files, exclude `node_modules` from whitespace checks or the guard will fail on vendor/package output instead of source changes.
- Browser-local persistence is useful only when the contract says exactly what it is. Saved Story Lab projects now restore the latest browser-local story and survive refresh, but the UI and docs must keep saying "in this browser" until a cloud persistence decision exists.
- Provider model migrations need a shared client and a provider-specific smoke path. Moving Grok story calls through one xAI Responses client made model/effort changes reviewable; the live smoke stays opt-in so missing credentials do not get mistaken for provider proof.
- Serverless AI workflows need an end-to-end request budget, not per-call optimism. Grok multi-agent generation plus AI continuity extraction can each look reasonable alone, but together they can exceed Vercel's synchronous function window unless primary, fallback, and enrichment calls are budgeted as one user request.
- Provider fallback is only honest when it is visible. Falling back from Grok multi-agent to a faster Grok model is acceptable for demo reliability only if telemetry records the fallback model and the UI does not imply the primary model completed.
- Protected preview smoke tests should use the same auth path as a browser. A raw HTTP readiness check can fail on Vercel preview protection even when Playwright could load a share URL and set the auth cookie.
- A beta or high-latency provider path should be treated as a probe in synchronous serverless UI. The reliable user path needs the largest part of the request budget, and the probe is only useful if failure still leaves enough time to recover.
- If the fallback is consistently the path that works, promote it to the default. Keeping the working model hidden behind recovery logic makes the product less reliable and makes status reporting harder to reason about.
- Browser smoke must evolve with the actual control shape, not just the visible workflow. When Story Lab moved from selects/ranges to card controls, the smoke had to click cards, open hidden details, verify progress, and test copy/download instead of reusing old selectors.
- Mock fallback policy needs environment-specific tests. A missing provider key can be acceptable in local/dev mock mode while still being a production failure; tests should prove both paths for generation and continuation.
- Internal tools that share domain contracts need alignment without becoming public scope. Proving Grounds can accept expanded creature unions for type safety while staying hidden from the normal Story Lab first screen.
- Dedicated creature expansion should include prompt-style evidence, not just union types. Adding `witch`, `dragon`, `demon`, `angel`, and `mermaid` to the UI is incomplete until the style-bank tests prove those creatures are not silently borrowing old vampire/werewolf/fairy prompt voices.
- Spice controls need a contract, not just a level label. Heat Contract v0 makes adult-only confirmation, tension mode, intimacy boundary, and no-go content visible to the user and first-class in generation context.
- Live-provider smoke should prove the intended provider, not merely "not mock." For Story Lab, opt-in live proof must assert Grok telemetry and a Grok model family while still skipping cleanly without credentials.
- Platform plans should be hostile-reviewed before infrastructure work starts. The hater pass caught storage-before-auth, fake job durability, function-count overflow, unsafe export reuse, and process-theater UI before those risks became code.
- When local Angular runners hang under Node v23, record the exact blocked commands and rerun under Node 20 or CI. Do not convert a silent build/Karma hang into a pass.
- Privacy gates can often be finished before provisioning. Centralized deny-by-default CORS, conservative export sanitization, retention/deletion rules, and opaque job-id contracts can all be made executable without adding storage, auth-provider adapters, or new Vercel route files.
- Database adapter scaffolds need no-op conflict tests before they are trusted. An owner-scoped upsert that returns zero rows is a privacy boundary signal, not a successful save; the adapter must surface a forbidden result without leaking story text.
