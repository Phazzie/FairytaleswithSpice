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
