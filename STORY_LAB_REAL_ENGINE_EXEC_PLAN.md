# Story Lab Real Engine Execution Plan

Created: 2026-05-28 02:20 UTC

## Objective

Make the Story Lab UI drive the real story-generation engine without losing advanced Story Lab intent and without creating a permanent lossy adapter layer.

The app currently has:

- a live Story Lab UI backed by `api/story-lab/*`,
- a working real story-generation engine behind `api/story/generate`,
- mock Story Lab response builders in `api/_lib/story-lab/mockData.ts`.

The target is one production generation engine that accepts the richer Story Lab blueprint as first-class input. Mock generation remains available only as development fallback when no provider key exists.

## Implementation Idea Passes

### Implementation Idea V1

Wire `api/story-lab/stories.ts` to call the existing `StoryService.generateStory()` and map the result back into `StoryIterationPayload`. Keep the current Story Lab UI and generated state panels.

### Hostile Senior Review 1

This sounds like the exact adapter debt the user objected to. If you stuff `logline`, protagonist, world details, and directives into `userInput`, you degrade the prompt and bless a translation layer that will become permanent. Also, continuation will drift because generated Story Lab state will not be meaningful enough for later chapters.

### Revised Idea V2

Extend the real generator contract so the engine receives Story Lab context explicitly:

- logline,
- tone,
- protagonist name,
- antagonist name,
- world details,
- narrative directives,
- full theme seed metadata,
- chapter batch size.

Then add a Story Lab orchestration method that calls the real engine with this richer canonical request and derives Story Lab output from real generated chapters. The mapper is limited to UI envelope shaping, not prompt meaning compression.

### Hostile Senior Review 2

Better, but now you may pollute the older `/api/story/generate` contract with Story Lab-only fields and make both routes harder to reason about. You also have to prove the generator prompt actually uses the fields, not just type-accepts them. If tests only check shapes, quality can still be lost.

### Revised Idea V3

Introduce `generationContext` as an additive field on the real generation input. Existing legacy callers remain valid, while Story Lab calls pass rich context. Update prompt construction to use those fields explicitly and visibly. Add contract/shape tests that assert Story Lab input reaches the real prompt contract and that Story Lab endpoints no longer call mock builders in production paths.

### Hostile Senior Review 3

Do not over-abstract provider switching yet. The real problem is mock-vs-real Story Lab. If you introduce OpenAI/Grok provider ports, model registries, visual redesign, and persistence in the same PR, you will make another monster branch. Also, do not delete mocks; they are useful when no API key exists.

### Final Implementation Idea

For this slice:

1. Add a canonical rich generation context to the real story engine input.
2. Make Story Lab genesis and continuation call the real `StoryService` in production-capable paths.
3. Keep `buildGenesisResponse()` / `buildContinuationResponse()` as explicit mock fallback only when the real engine is unavailable or intentionally in mock mode.
4. Convert real generated chapters into Story Lab chapter/state envelopes without discarding chapter HTML, raw content, cliffhanger flags, trope metadata, or story summary.
5. Leave OpenAI/provider abstraction and visual charm restoration as follow-up work.

## Autonomous Execution Plan Passes

### Exec Plan V1

1. Add a helper under `api/_lib/story-lab/`.
2. Update Story Lab routes to call it.
3. Add tests.
4. Validate.

### Hostile Senior Review 1

This is too vague. It does not say which helpers are canonical, which files are touched, how mocks are protected, or how you will avoid Vercel function-count drift. It also skips continuation, which means the first generation might work but the app workflow still breaks.

### Revised Exec Plan V2

1. Create `api/_lib/story-lab/realStoryEngine.ts` as the Story Lab orchestration layer.
2. Extend `api/_lib/types/contracts.ts` with additive `generationContext`.
3. Update `StoryService.buildUserPrompt()` and chapter prompt paths to read `generationContext`.
4. Update `api/story-lab/stories.ts` and continuation route to call the real orchestrator.
5. Keep mock fallback in the same route behind explicit fallback logic.
6. Add root TSX tests for mapping, fallback, and response shape.
7. Run quick preflight and Node 20 Angular build.

### Hostile Senior Review 2

Naming it `realStoryEngine` may hide that `StoryService` is still the actual engine. Also, route fallback can mask real production failures if you silently fall back from a configured provider failure to mock content. That would make a demo look successful while story quality is fake.

### Revised Exec Plan V3

1. Name the orchestration file `storyLabEngine.ts`.
2. In routes, mock fallback is allowed only when no provider key exists or an explicit mock env flag is set. If a provider key exists and real generation fails, return an error.
3. Add telemetry that reports `engine: 'grok'` for real StoryService calls and `engine: 'custom'` for mock fallback.
4. Add tests for "configured provider failure does not silently mock."
5. Update changelog with the fallback policy.

### Hostile Senior Review 3

Still too much if you try to solve continuation perfectly. You do not have durable state yet, and generated state is partly heuristic. Deliver the smallest honest production win: real genesis, real continuation using previous chapter content, and transparent state heuristics. Document what remains heuristic instead of pretending it is solved.

### Final Autonomous Exec Plan

#### Phase 1 - Real Story Lab Genesis

- Add `generationContext` to the real generation contract.
- Update prompt construction to consume Story Lab context explicitly.
- Add `api/_lib/story-lab/storyLabEngine.ts`.
- Update `api/story-lab/stories.ts` so genesis calls the real engine when `XAI_API_KEY` exists.
- Keep mock fallback only when no provider key exists.
- Add tests for real-engine mapping in mock mode and fallback policy.

#### Phase 2 - Real Story Lab Continuation

- Convert Story Lab continuation state and previous chapters into the real continuation request.
- Return real generated continuation chapters in the Story Lab envelope.
- Preserve prior Story Lab state and add heuristic deltas for new chapters.
- Keep transient persistence honest; do not claim durable storage.

#### Phase 3 - Validation And Review

- Run `git diff --check`.
- Run Story Lab engine tests.
- Run root story tests.
- Run `scripts/recovery/preflight.sh --quick --skip-status`.
- Run Node 20 Angular build.
- Update `PR70_RECOVERY_CHANGELOG.md` and `LESSONS_LEARNED.md`.
- Self-review the implementation against this document before opening a PR.

## Current Known Tradeoffs

- Story Lab state extraction from real prose will initially be heuristic. That is acceptable if documented and not represented as AI-analyzed durable continuity.
- Mocks remain useful for local/no-key development but must not mask production provider failures.
- Provider abstraction for OpenAI vs Grok is intentionally deferred until Story Lab is connected to the real engine.
- Visual charm restoration is product work and should follow this engine unification rather than mix into it.
