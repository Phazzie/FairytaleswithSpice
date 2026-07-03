# AGENTS.md - Fairytales with Spice

Last updated: 2026-07-03 08:30 EDT

This file is read automatically by AI coding agents. It is the repo-level operating guide for current Story Lab platform work, recovery work, and autonomous sessions.

## Required Start Order

Before planning, editing, or claiming readiness:

1. Run `git status --short --branch` and treat the live worktree as authoritative.
2. Read `STORY_LAB_UNPUBLISHED_BRANCH_SPLIT_PLAN.md` when recovering the local Story Lab stack.
3. For long-running autonomous work, read `OVERNIGHT_MODE.md` before selecting the next task.
4. Use `STORY_LAB_IDEA_BOARD.md` for research-mined ideas, story-quality experiments, and Weird Lab candidates.
5. Read the execution plan that matches the files or behavior being changed.
6. Run `scripts/recovery/check-vercel-function-count.sh` before adding, retiring, consolidating, or documenting deployable Vercel route files.

## Publication Discipline

Treat "merged to `main`" as the only meaning of `Done`. Work that exists only on a local branch, backup branch, or open PR must be labeled `Local-only`, `PR-ready`, `In review`, or `Parked`.

Before starting or resuming a Story Lab slice, run:

```bash
npm run recovery:status
```

Use the output as a stop sign when it reports a missing/gone upstream, a dirty tree, unrelated untracked files, or a branch that is already far ahead of `origin/main`.

Story Lab slices should be sized by review boundary, not by how much code an agent can keep in context. A slice may be moderately sized if all changes prove one coherent behavior, but it must split when it crosses independent risk areas such as:

- account/auth/profile/storage boundaries;
- deployable route or Vercel function-budget changes;
- Angular user-facing UI;
- durable job/workflow claims;
- story-quality generation behavior;
- Proving Grounds/reporting visibility;
- CSS/lazy-loading cleanup.

Default loop for unpublished Story Lab work:

1. Start from updated `main`.
2. Create one `recovery/story-lab-*` branch for one slice.
3. Extract only the commits/hunks named by the matching plan.
4. Run focused validation with `npm run recovery:preflight -- <slice-name>`.
5. Open the PR with scope, validation commands, non-claims, and next-slice notes.
6. Stop after the PR is opened or merged; do not begin the next feature on the same branch.

If a branch contains more than one planned slice, stop and split before adding more code. If a branch's upstream is gone, first check whether it was merged into `origin/main`; do not keep working on stale branch tips.

After opening or merging a PR, audit active unresolved review threads:

```bash
npm run review:unresolved -- --prs <pr-number>
```

For last-40 or backlog sweeps, include outdated unresolved threads as a separate queue:

```bash
npm run review:unresolved -- --state all --limit 40 --outdated-only
```

Review comments must not be ignored. Reply on the original thread with one of: the fixing PR/commit and resolve it; a linked follow-up issue/PR if it remains valid but is out of scope; or an obsolete/superseded reason before resolving. For broader recovery sweeps, use issues #152 and #153 as the tracking backlogs.

## Review Tooling Policy

CodeRabbit configuration lives in `.coderabbit.yaml`. The repository intentionally disables the blanket docstring-coverage pre-merge check. Do not mass-add JSDoc/docstrings to satisfy a generic percentage threshold.

Add focused documentation when it clarifies public contracts, exported ports/adapters, security/privacy invariants, cross-process storage behavior, or non-obvious story-generation constraints. If a bot asks for broad docstring coverage, treat that as review-tooling drift: tune the tool or open a follow-up issue instead of adding low-value comments.

## Current Operating Direction

The unpublished `feature/story-lab-auth-profile-contracts` stack has been split and merged through PR #151. The current recovery task is completion hardening: address or track review comments, resolve dependency follow-ups, prove live auth/database behavior before cloud claims, and keep durable-job claims gated on process-loss proof.

The active Story Lab completion-hardening plan is `STORY_LAB_COMPLETION_HARDENING_EXEC_PLAN.md`. Use it before claiming the recovery is done, integrating live auth/database behavior, claiming durable jobs, closing the review-comment backlog, or merging dependency follow-ups.

The stricter final merge, coverage, and PR-review audit plan is `STORY_LAB_FINAL_MERGE_AUDIT_EXEC_PLAN.md`. Use it before claiming all local work is merged, the last 40 PRs have been audited, review comments are handled, 90% coverage is proven, or the overall Story Lab recovery goal is complete.

The autonomous operating guide is `OVERNIGHT_MODE.md`. Use it before long-running task selection, research mining, or Weird Lab work.

The idea/backlog board is `STORY_LAB_IDEA_BOARD.md`. Keep it honest: `Done` means merged to `main`; use `Local-only` for unpublished branch material.

The active Story Lab auth/profile/cloud-library plan is `STORY_LAB_AUTH_PROFILE_CLOUD_LIBRARY_EXEC_PLAN.md`. Use it before adding provider-backed auth, private user profiles, cloud project library APIs, account route rewrites, or signed-in save/load/list/delete behavior.

## Current Recovery Direction

The active direction is documented in `PR70_RECOVERY_PLAN.md`.

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

The active Story Lab auth/profile/cloud-library checklist is `STORY_LAB_AUTH_PROFILE_CLOUD_LIBRARY_EXEC_PLAN.md`. Use it before changing provider-backed auth, private user profiles, cloud project library APIs, account route rewrites, or signed-in save/load/list/delete behavior.

The active Story Lab route-budget plan is `STORY_LAB_ROUTE_BUDGET_EXEC_PLAN.md`. Use it before retiring, adding, consolidating, or documenting Vercel-facing route files for Story Lab capacity work.

The active Story Lab job-route scaffold plan is `STORY_LAB_JOB_ROUTES_EXEC_PLAN.md`. Use it before changing the non-durable Story Lab job routes, job store, job event stream, or Angular job client seam.

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
| `/api/story-lab/jobs` | Create a non-durable Story Lab job scaffold |
| `/api/story-lab/jobs/:jobId` | Read a non-durable Story Lab job snapshot |
| `/api/story-lab/jobs/:jobId/events` | Replay non-durable Story Lab job snapshots as SSE |

SSE must remain SSE. Do not convert `/api/story/stream` to WebSocket or polling unless explicitly requested.

Image-generation service code may exist under `api/_lib` or the local development server, but there is no active Vercel `/api/image/generate` route after the route-budget consolidation.

Story Lab job routes are currently process-local and explicitly non-durable. They do not provide account ownership, Workflow durability, database persistence, audio jobs, export jobs, or reload-safe UI progress until later platform gates land.

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
9. Do not claim auth, cloud save, user profiles, durable jobs, or live AI verification unless the current implementation and verification prove those claims.
10. Prefer small, attributed ports and test-backed slices instead of large mixed merges.
11. Run self-review before committing, before handoff, after every three PR dispositions, and after every story-generation port.
12. After a coherent slice validates and is committed, do not start another feature slice until the work is pushed, a PR exists, checks/review comments are addressed, and the PR is merged, unless the user explicitly asks for a local-only spike.
13. If the current branch has unpublished commits but no upstream or PR, stop feature selection. Record the state, push a backup or split branch, open the next reviewable PR, address checks/comments, and merge before adding more product work.
14. For `AGENTS.md` edits, update the timestamp, run `git diff --check`, and record the audit/change in the active changelog or execution plan that is part of the same PR.

For broad PR recovery only:

- Start with `PR70_RECOVERY_PLAN.md`.
- Keep `PR70_RECOVERY_CHANGELOG.md` current as work proceeds.
- Do not close a PR until accepted and not-taken material is recorded.
- Do not silently discard story-generation ideas from stale or audio-heavy PRs.
