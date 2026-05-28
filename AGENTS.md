# AGENTS.md - Fairytales with Spice

Last updated: 2026-05-26 00:12 EDT

This file is read automatically by AI coding agents. It is the repo-level operating guide for the current recovery effort.

## Current Recovery Direction

The active direction is documented in `PR70_RECOVERY_PLAN.md`.

The next Story Lab real-engine execution plan is `STORY_LAB_REAL_ENGINE_EXEC_PLAN.md`. Use it before changing Story Lab generation semantics.

The previous parallel-agent execution plan is `plan.md`. Treat it as superseded for the immediate Story Lab real-engine work; do not use it as permission to broaden this branch.

Follow that plan before doing broad PR reconciliation work. The intended recovery path is:

1. Create a new recovery branch from current `main`.
2. Merge PR #70 as the story-lab baseline.
3. Make the branch Vercel-first.
4. Port, cherry-pick, merge, or close every remaining open PR.
5. Record accepted material, rejected material, conflicts, tests, and self-review notes as work proceeds.

The companion inventory is `PR_USEFUL_MATERIAL_INVENTORY.md`.

Keep these files current during the recovery:

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

Do not steer this recovery toward DigitalOcean. Existing DigitalOcean files/docs are historical unless the user explicitly asks to restore that path.

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

Important path note: older PRs may touch `api/lib/*` or `story-generator/src/api/lib/*`. For the Vercel recovery, normalize shared API code toward `api/_lib/*` unless a deliberate later architecture decision replaces it. Do not add another active story service copy.

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

Contract locations during recovery:

| File | Purpose |
|---|---|
| `story-generator/src/app/contracts.ts` | Angular/UI contracts |
| `api/_lib/types/contracts.ts` | Vercel API/service contracts |

When mining old PRs, treat contracts in old paths as source material, not automatically canonical.

## Story Generation Priorities

Protect story-generation quality during the PR #70 recovery.

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

Vercel is the deployment target for this recovery.

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
| `/api/image/generate` | Image generation stub/service |

SSE must remain SSE. Do not convert `/api/story/stream` to WebSocket or polling unless explicitly requested.

## Audio Scope

Audio is deferred for this recovery.

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
npm run build
npm run test:story
cd story-generator && npm test
```

Some tests are historically stale or environment-dependent. If a check cannot run, document the exact command and failure reason in the recovery changelog or PR ledger.

## Working Rules For Agents

1. Start with `PR70_RECOVERY_PLAN.md` before broad PR work.
2. Keep `PR70_RECOVERY_CHANGELOG.md` current as work proceeds.
3. Keep `LESSONS_LEARNED.md` current when a recurring failure mode or correction is discovered.
4. Do not close a PR until accepted and not-taken material is recorded.
5. Do not silently discard story-generation ideas from stale or audio-heavy PRs.
6. Resolve path drift intentionally: `api/_lib` is the current Vercel recovery target.
7. Do not reintroduce DigitalOcean as the active deployment target.
8. Do not reintroduce active audio scope unless the user asks.
9. Prefer small, attributed ports after PR #70 instead of large mixed merges.
10. Run a self-review after #70, after every three PR dispositions, after every story-generation port, and before the final recovery PR.
