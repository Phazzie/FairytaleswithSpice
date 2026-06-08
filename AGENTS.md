# AGENTS.md - Fairytales with Spice

Last updated: 2026-06-08 09:45 EDT

This file is read automatically by AI coding agents. It is the repo-level operating guide for current Story Lab platform work, recovery work, and autonomous overnight sessions.

## Required Start Order

Before planning, editing, or claiming readiness:

1. Run `git status --short --branch` and treat the live worktree as authoritative.
2. Read `STORY_LAB_APP_AUDIT.md` before claiming app health, platform readiness, or auth/storage/profile status.
3. For long-running autonomous work, read `OVERNIGHT_MODE.md` before selecting the next task.
4. Keep `OVERNIGHT_HANDOFF.md` current after each coherent autonomous slice.
5. Use `STORY_LAB_IDEA_BOARD.md` for research-mined ideas, story-quality experiments, and Weird Lab candidates.
6. Read the execution plan named below that matches the files or behavior being changed.
7. Run `scripts/recovery/check-vercel-function-count.sh` before adding, retiring, consolidating, or documenting deployable Vercel route files.

## Current Operating Direction

The current app snapshot and priority queue are documented in `STORY_LAB_APP_AUDIT.md`.

The autonomous overnight operating guide is `OVERNIGHT_MODE.md`. Use it before long-running autonomous task selection, research mining, or Weird Lab work. Keep `STORY_LAB_IDEA_BOARD.md` and `OVERNIGHT_HANDOFF.md` current during those runs.

`PR70_RECOVERY_PLAN.md` remains the broad PR-recovery plan. Use it before broad PR reconciliation, old-PR mining, or PR ledger work. Do not treat it as the default next task when the user asks for platform, storage, auth, profile, story-quality, or overnight-mode work.

The next Story Lab real-engine execution plan is `STORY_LAB_REAL_ENGINE_EXEC_PLAN.md`. Use it before changing Story Lab generation semantics.

The current demo-shipping execution plan is `STORY_LAB_DEMO_SHIPPING_EXEC_PLAN.md`. Use it after PR #90 has landed and before making demo-readiness, deployed-smoke, or live-provider changes.

The active MVP-to-shipping execution plan is `MVP_TO_SHIPPING_EXEC_PLAN.md`. Use it before public UI readiness, browser-smoke, MVP-report, dependency/security-hardening, or shipping-readiness work.

The active next polish plan is `GROK_MULTIAGENT_STORY_LAB_POLISH_EXEC_PLAN.md`. Use it before changing Grok model behavior, Story Lab front-end design, durable local story memory, AI continuity extraction, or story-quality evals.

The active Charmed MVP execution plan is `STORY_LAB_CHARMED_MVP_EXEC_PLAN.md`. Use it before changing visual skins, user-facing Story Lab controls, spice-level behavior, production mock fallback policy, progress UI, continuation direction, or local share/export behavior.

The active Story Lab platform evolution plan is `STORY_LAB_PLATFORM_EVOLUTION_EXEC_PLAN.md`. Use it before changing Heat Contract behavior, dedicated creature style banks, Story Lab provider smoke, cloud accounts/sync, durable storage, job/workflow progress, audio, server export, or Director's Room-style creative tooling.

The active Story Lab Director's Room UI plan is `STORY_LAB_DIRECTOR_ROOM_UI_EXEC_PLAN.md`. Use it before changing the compact craft-notes UI, accepted/dismissed note behavior, or note-driven continuation briefs.

The active Story Lab Villain Pressure UI plan is `STORY_LAB_VILLAIN_PRESSURE_UI_EXEC_PLAN.md`. Use it before changing continuation pressure controls or pressure-driven continuation brief composition.

The active Story Lab privacy/streaming gate plan is `STORY_LAB_PRIVACY_STREAMING_GATES_EXEC_PLAN.md`. Use it before changing CORS policy, account-boundary headers, export sanitization, retention/deletion policy, or opaque job-id streaming contracts.

The active Story Lab storage-port plan is `STORY_LAB_STORAGE_PORT_EXEC_PLAN.md`. Use it before changing Story Lab storage ports, in-memory account-store scaffolding, Postgres adapter scaffolding, or account-sync persistence boundaries.

The active Story Lab route-budget plan is `STORY_LAB_ROUTE_BUDGET_EXEC_PLAN.md`. Use it before retiring, adding, consolidating, or documenting Vercel-facing route files for Story Lab capacity work.

The active Story Lab job-route scaffold plan is `STORY_LAB_JOB_ROUTES_EXEC_PLAN.md`. Use it before changing the non-durable Story Lab job routes, job store, job event stream, or Angular job client seam.

The previous parallel-agent execution plan is `plan.md`. Treat it as superseded for the immediate Story Lab real-engine work; do not use it as permission to broaden this branch.

For broad PR reconciliation work only, follow `PR70_RECOVERY_PLAN.md`. The recovery path is:

1. Create a new recovery branch from current `main`.
2. Merge PR #70 as the story-lab baseline.
3. Make the branch Vercel-first.
4. Port, cherry-pick, merge, or close every remaining open PR.
5. Record accepted material, rejected material, conflicts, tests, and self-review notes as work proceeds.

The companion inventory is `PR_USEFUL_MATERIAL_INVENTORY.md`.

Keep these files current during broad PR recovery:

- `PR70_RECOVERY_CHANGELOG.md` - chronological work log and decisions.
- `PR70_RECOVERY_LEDGER.md` - one row/section per PR disposition.
- `NOT_TAKEN_FEATURE_LEDGER.md` - useful material intentionally not taken, especially story-generation ideas.
- `LESSONS_LEARNED.md` - durable lessons and corrections discovered during the recovery.
- `PR70_RECOVERY_FINAL_REPORT.md` - final process report after all open PRs are resolved.

## Stack

| Layer | Technology |
|---|---|
| Frontend | Angular 20 with SSR (`@angular/ssr`) |
| API target | Vercel serverless functions under `api/` |
| Shared API code | `api/_lib/` |
| AI / Story Generation | xAI Grok API (`XAI_API_KEY`) |
| Language | TypeScript 5.9.x |
| Unit Tests | Karma + Jasmine inside `story-generator/` |
| Integration Tests | Custom `tsx` harness in root `tests/` |
| Deployment | Vercel |

Do not steer this work toward DigitalOcean. Existing DigitalOcean files/docs are historical unless the user explicitly asks to restore that path.

## Repository Layout

```text
fairytaleswithspice/
├── AGENTS.md
├── PR70_RECOVERY_PLAN.md
├── PR_USEFUL_MATERIAL_INVENTORY.md
├── package.json                         # root orchestration wrapper
├── vercel.json                          # Vercel deployment config
├── api/                                 # Vercel serverless functions
│   ├── story/
│   ├── export/
│   ├── image/
│   └── _lib/                            # canonical shared API services/types
├── tests/                               # root integration tests
└── story-generator/                     # Angular application
    ├── package.json
    ├── angular.json
    └── src/
        └── app/
            ├── contracts.ts             # frontend seam contracts
            ├── story.service.ts          # Angular API/SSE client
            └── ...
```

Important path note: older PRs may touch `api/lib/*` or `story-generator/src/api/lib/*`. For the Vercel app, normalize shared API code toward `api/_lib/*` unless a deliberate later architecture decision replaces it. Do not add another active story service copy.

## Architecture: Seam-Driven Development

This project uses Seam-Driven Development. Data boundaries between UI, API routes, services, and external providers are explicit TypeScript interfaces.

Rules:

1. Update contracts before implementation when a feature crosses a boundary.
2. Keep frontend and backend contract shapes aligned.
3. API responses use `ApiResponse<T>`:

```typescript
{ success: true, data: T }
{ success: false, error: { code: string, message: string } }
```

Current contract locations:

| File | Purpose |
|---|---|
| `story-generator/src/app/contracts.ts` | Angular/UI contracts |
| `api/_lib/types/contracts.ts` | Vercel API/service contracts |

When mining old PRs, treat contracts in old paths as source material, not automatically canonical.

## Story Generation Priorities

Protect story-generation quality during recovery, platform work, and experiments.

Preserve or deliberately replace:

- Grok model configuration.
- Token budgeting.
- Prompt quality parameters.
- Author-style and beat-structure variety.
- Randomization correctness.
- Chapter continuation behavior.
- Streaming story generation semantics.
- Story state, continuity, and trope-subversion ideas when they are ported.

For any PR that is closed or only partially ported, record story-generation material in `NOT_TAKEN_FEATURE_LEDGER.md` before closing the source PR.

## Vercel Rules

Vercel is the deployment target for this app.

1. Keep `vercel.json` coherent with root `api/` functions and the Angular build output.
2. Prefer `api/_lib` for shared API services and types so helper files do not become separate Vercel functions.
3. Do not add or restore `.do/app.yaml`, Docker deployment, or DigitalOcean-specific runtime assumptions as active deployment guidance.
4. If storage/state persistence is needed, make a new Vercel-compatible storage decision. Do not inherit DigitalOcean Postgres assumptions from stale PRs.
5. Keep Vercel-specific CI lean. Mine #39/#41 for useful checks, but do not blindly restore heavyweight workflow suites.

## API Routes

Current Vercel-facing route families include:

| Path | Purpose |
|---|---|
| `/api/health` | Health check |
| `/api/story/generate` | Generate story |
| `/api/story/stream` | Streaming story generation / SSE |
| `/api/story/continue` | Continue story |
| `/api/export/save` | Export/save |
| `/api/story-lab/jobs` | Create a non-durable Story Lab job scaffold |
| `/api/story-lab/jobs/:jobId` | Read a non-durable Story Lab job snapshot |
| `/api/story-lab/jobs/:jobId/events` | Replay non-durable Story Lab job snapshots as SSE |

SSE must remain SSE. Do not convert `/api/story/stream` to WebSocket or polling unless explicitly requested.

Image-generation service code may exist under `api/_lib` or the local development server, but there is no active Vercel `/api/image/generate` route after the route-budget consolidation.

Story Lab job routes are currently process-local and explicitly non-durable. They do not provide account ownership, Workflow durability, database persistence, audio jobs, export jobs, or reload-safe UI progress until later platform gates land.

## Audio Scope

Audio is deferred for this app.

Some legacy audio files/routes may still exist in the repo or old PRs. Do not expand, wire up, or prioritize audio unless explicitly asked. When closing audio PRs, mine story-generation-relevant ideas first:

- speaker tag formats
- emotion taxonomy
- narrator atmosphere
- character consistency
- voice-evolution metadata
- dialogue segmentation
- prose pacing for future narration

Record mined ideas in `NOT_TAKEN_FEATURE_LEDGER.md`.

## Environment Variables

| Variable | Required | Purpose |
|---|---|---|
| `XAI_API_KEY` | Required for real story generation | xAI/Grok API key |
| `FRONTEND_URL` or allowed-origin config | Production dependent | CORS origin control |
| `NODE_ENV` | Optional | Environment mode |

Mock mode is valuable. Services should be testable without external credentials where practical.

## Local Commands

```bash
npm run install:all
scripts/recovery/check-vercel-function-count.sh
scripts/recovery/preflight.sh --quick --skip-status
npm run test:all
npm run build
npm run test:story
cd story-generator && npm test
```

Some tests are historically stale or environment-dependent. If a check cannot run, document the exact command and failure reason in `OVERNIGHT_HANDOFF.md`, the active execution plan, the recovery changelog, or the PR ledger depending on the workstream.

## Working Rules For Agents

1. Start with live repo state, `STORY_LAB_APP_AUDIT.md`, and the matching execution plan for the behavior being changed.
2. For autonomous sessions, follow `OVERNIGHT_MODE.md` and update `OVERNIGHT_HANDOFF.md` after each coherent slice.
3. Use `STORY_LAB_IDEA_BOARD.md` for research-mined ideas and bounded experiments; do not leave useful product ideas only in chat.
4. Keep `LESSONS_LEARNED.md` current when a recurring failure mode or correction is discovered.
5. Resolve path drift intentionally: `api/_lib` is the current Vercel shared-code target.
6. Do not reintroduce DigitalOcean as the active deployment target.
7. Do not reintroduce active audio scope unless the user asks.
8. Do not claim auth, cloud save, user profiles, durable jobs, or live AI verification unless the current implementation and verification prove those claims.
9. Prefer small, attributed ports and test-backed slices instead of large mixed merges.
10. Run self-review before committing, before handoff, after every three PR dispositions, and after every story-generation port.

For broad PR recovery only:

- Start with `PR70_RECOVERY_PLAN.md`.
- Keep `PR70_RECOVERY_CHANGELOG.md` current as work proceeds.
- Do not close a PR until accepted and not-taken material is recorded.
- Do not silently discard story-generation ideas from stale or audio-heavy PRs.
