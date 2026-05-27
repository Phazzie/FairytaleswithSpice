# Two-Agent Execution Plan

Created: 2026-05-27 13:45 EDT

## Purpose

This plan is for the next large autonomous work chunk after the current review-fix branch is merged. Do not keep adding major feature work to the PR #87 recovery baseline or to a review-polish branch. Finish review fixes, validate them, merge them, then start this work from fresh branches or worktrees.

The goal is to move Story Lab from a Vercel-ready recovery baseline toward production usefulness without reintroducing duplicate story services, DigitalOcean assumptions, or active audio scope.

## Current Baseline Assumptions

- Deployment target is Vercel.
- Audio runtime remains deferred.
- Canonical backend shared code lives under `api/_lib/*`.
- Canonical live story generation is `api/_lib/services/storyService.ts`.
- Story Lab routes currently live under `api/story-lab/*`.
- Story Lab helper code lives under `api/_lib/story-lab/*`.
- API response envelopes are discriminated unions:
  - `{ success: true, data: T }`
  - `{ success: false, error: { code: string, message: string } }`
- The Vercel function count must stay at or under 12 unless the deployment plan changes intentionally.
- Do not create another active story service copy.

## Shared Rules

1. Start from updated `main` after the review-fix branch is merged.
2. Use separate worktrees or branches:
   - Agent A: `feature/story-lab-live-adapter`
   - Agent B: `feature/story-lab-persistence-quality`
3. Before editing, each agent runs:
   - `git status --short --branch`
   - `scripts/recovery/check-vercel-function-count.sh`
   - `scripts/recovery/preflight.sh --quick --skip-status`
4. Each agent keeps a local worklog:
   - Agent A writes `WORKLOG.agent-a.md`
   - Agent B writes `WORKLOG.agent-b.md`
5. Do not edit the other agent's worklog.
6. Do not touch `pocketfm-contest-forge/`.
7. Keep active audio out of scope.
8. Every new helper under `api/` must go under `api/_lib/*`.
9. After every meaningful implementation slice, run the smallest relevant validation and record the result.
10. After each validation failure, write a short self-review before continuing:
    - What assumption failed?
    - What file or contract exposed it?
    - Did the fix narrow the architecture or widen it?

## Agent A: Live Story Lab Adapter

### Objective

Replace Story Lab mock-only generation and continuation with an adapter that can use the canonical story service while preserving Story Lab's #70 workbench contracts.

### Files Owned

Agent A may edit:

- `api/story-lab/stories.ts`
- `api/story-lab/stories/[storyId]/continue.ts`
- `api/story-lab/stream/genesis.ts`
- `api/_lib/story-lab/contracts.ts`
- `api/_lib/story-lab/mockData.ts`
- new files under `api/_lib/story-lab/*`
- focused tests under `tests/` or `api/_lib/story-lab/*.spec.ts`
- `WORKLOG.agent-a.md`

Agent A should avoid:

- `api/_lib/story-lab/stateStore.ts` unless coordinating with Agent B
- `vercel.json`
- broad frontend UI changes

### Steps

1. Map both contract shapes:
   - #70 Story Lab input/output contracts in `story-generator/src/app/contracts.ts`
   - legacy/live generator contracts in `api/_lib/types/contracts.ts`
2. Create a new adapter under `api/_lib/story-lab/`, for example `liveStoryAdapter.ts`.
3. Convert a Story Lab genesis request into canonical story-generation input.
4. Convert canonical generated chapters into `StoryIterationPayload`.
5. Preserve Story Lab state shape:
   - `summary`
   - `batch`
   - `state`
   - `stateDelta`
   - `persistence`
   - `telemetry`
6. Keep mock generation as a deliberate fallback only when the live service cannot run locally without credentials.
7. Add tests that prove:
   - valid Story Lab genesis input returns a Story Lab payload,
   - invalid input returns a discriminated error envelope,
   - generated chapters preserve HTML content, summaries, word counts, and cliffhanger flags,
   - no new deployable Vercel functions are created.
8. Update `api/story-lab/stream/genesis.ts` only after non-streaming genesis works.
9. Run:
   - `scripts/recovery/check-vercel-function-count.sh`
   - direct Vercel API typecheck from `scripts/recovery/preflight.sh`
   - `scripts/recovery/preflight.sh --quick --skip-status`

### Agent A Stop Conditions

Stop and document before proceeding if:

- The adapter requires a second active story service.
- The Story Lab contract needs a breaking change that the Angular UI does not yet support.
- The Vercel function count would increase.
- Live generation cannot be represented without losing state/continuity data.

## Agent B: Persistence And Quality Path

### Objective

Make Story Lab state less misleading and prepare the quality/testing path without blocking Agent A's live adapter work.

### Files Owned

Agent B may edit:

- `api/_lib/story-lab/stateStore.ts`
- new files under `api/_lib/story-lab/persistence/*`
- `api/_lib/story-lab/contracts.ts` only after coordinating with Agent A
- `tests/`
- `docs/` if a new persistence decision note is needed
- `LESSONS_LEARNED.md`
- `WORKLOG.agent-b.md`

Agent B should avoid:

- `api/story-lab/stories.ts`
- `api/story-lab/stories/[storyId]/continue.ts`
- `api/story-lab/stream/genesis.ts`
- `story-generator/src/app/proving-grounds/*` until persistence tests are stable

### Steps

1. Audit current transient state behavior in `api/_lib/story-lab/stateStore.ts`.
2. Write down the exact persistence requirement:
   - what must survive a serverless cold start,
   - what can remain session-local,
   - what data is unsafe to expose to the browser,
   - what Vercel storage option should be selected later if not implemented now.
3. Create a storage-port shape under `api/_lib/story-lab/persistence/` if implementation begins.
4. Keep the current transient implementation honest:
   - names and response warnings must say transient,
   - tests must prove transient behavior does not pretend to be durable.
5. Add focused tests around:
   - persisting a genesis payload,
   - retrieving a continuation snapshot,
   - merging previous and new chapters without duplication,
   - preserving revision and chapter order.
6. After Agent A exposes the live adapter shape, add tests for live-adapter persistence integration.
7. Only after persistence tests are stable, consider Proving Grounds improvements:
   - AI evaluation timeout/error shaping,
   - saved comparison integrity,
   - quality-eval fixtures.
8. Run:
   - direct state/persistence tests,
   - direct Vercel API typecheck,
   - `scripts/recovery/preflight.sh --quick --skip-status`

### Agent B Stop Conditions

Stop and document before proceeding if:

- A persistence choice requires credentials or a paid service decision.
- The implementation would add deployable functions outside the current count.
- The storage shape requires Story Lab contract changes that Agent A has not coordinated.
- Tests are proving mock behavior rather than the persistence boundary.

## Integration Plan

1. Agent A opens or prepares a PR first because the live adapter defines the runtime shape.
2. Agent B rebases on Agent A after the adapter has passing API typechecks.
3. Merge order:
   - live adapter,
   - persistence/state tests,
   - Proving Grounds quality/eval polish,
   - full build and deployment verification.
4. Before combining, run:
   - `git diff --check`
   - `scripts/recovery/check-vercel-function-count.sh`
   - `scripts/recovery/preflight.sh --quick --skip-status`
5. Before final merge, run full validation:
   - `scripts/recovery/preflight.sh --skip-status`
   - Vercel preview deployment
   - protected-preview smoke for root and `/api/health`
   - one real or explicitly skipped Grok story-generation smoke with reason recorded

## Final Review Checklist

- No active DigitalOcean direction.
- No active audio runtime added.
- No duplicate story service.
- No helper files in deployable `api/*` paths outside `_lib`.
- Story generation path is contract-backed.
- Mock mode is clearly labeled.
- Persistence is either durable or honestly named transient.
- Changelog, lessons, and worklogs explain what changed and why.
- The final report names surprises, wrong assumptions, and deferred ideas.

