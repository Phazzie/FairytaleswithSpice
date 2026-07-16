# AGENTS.md - Fairytales with Spice

Last updated: 2026-07-16 03:52 EDT

This file is read automatically by AI coding agents. It is the repo-level operating guide for current Story Lab platform work, recovery work, and autonomous sessions.

## User Communication Preference

Prefer fewer, larger progress updates over many small command-by-command updates. Group related status into meaningful checkpoints: current truth, what changed, what is blocked, what is next, and what is already pushed or merged.

When the user asks for a checklist, status report, or other concrete artifact, show the requested artifact or full checklist directly. Concrete artifacts include checklists, status tables, PR lists, subagent tickets, command-output summaries the user asked to see, named doc contents, and explicit done/not-done matrices. Do not replace them with a short summary unless the user explicitly asks for a summary.

## Context Turnover Preference

Compress context sooner during long or high-friction sessions, but preserve the state needed to resume without rediscovery. Create a compact turnover packet after PR open/merge events, before and after subagent batches, before risky branch switches, when the user steps away, or when the thread is getting crowded.

Turnover packets must include: objective, branch/commit/upstream state, working-tree state, open PR/review-thread state, changed docs/files, commands run and results, decisions made, subagent tickets/results, local-only or unmerged work, known unknowns, parked topics not to revive, next exact action, and recommended stop point.

Prefer durable turnover in `SUBAGENT_LOG.md`, `PR70_RECOVERY_CHANGELOG.md`, PR bodies, or a named handoff doc over relying on chat-only memory.

## Required Start Order

Before planning, editing, or claiming readiness:

1. Run `git status --short --branch` and treat the live worktree as authoritative.
2. Read the current active Story Lab control docs first: `STORY_LAB_COMPLETION_HARDENING_EXEC_PLAN.md`, `STORY_LAB_FINAL_MERGE_AUDIT_EXEC_PLAN.md`, `STORY_LAB_FUTURE_WORK_CHECKLIST.md`, and `STORY_LAB_EXPLORATION_FINDINGS.md` when it exists. Treat `STORY_LAB_UNPUBLISHED_BRANCH_SPLIT_PLAN.md` as historical publication evidence unless a task explicitly asks to recover that old stack.
3. For long-running autonomous work, read `OVERNIGHT_MODE.md` before selecting the next task.
4. Use `STORY_LAB_IDEA_BOARD.md` for research-mined ideas, story-quality experiments, and Weird Lab candidates.
5. Read the execution plan that matches the files or behavior being changed.
6. Run `scripts/recovery/check-vercel-function-count.sh` before adding, retiring, consolidating, or documenting deployable Vercel route files.

## Publication Discipline

Treat "merged to `main`" as the only meaning of `Done`. Work that exists only on a local branch, backup branch, or open PR must be labeled `Local-only`, `PR-ready`, `In review`, or `Parked`.

Local `main` is a maintained surface, not a scratch branch. At the start and end of repo work, `main` should be clean and match `origin/main` unless a named backup branch and changelog entry explain the divergence. If local `main` is ahead, behind, or dirty, stop feature work and either park the changes on a named branch or update `main` from `origin/main` before choosing the next slice.

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

Before ending a repo-work session, run:

```bash
npm run recovery:finish
```

Use its stop signs and doc checklist as the final publication gate. If it reports dirty files, a stale local `main`, unpushed commits, or missing doc updates, either fix them or explicitly report why they remain. For PR-ready claims, use `npm run recovery:finish -- --strict` and treat failures as blockers.

After opening or merging a PR, audit active unresolved review threads:

```bash
npm run review:unresolved -- --prs <pr-number>
```

For last-40 or backlog sweeps, include outdated unresolved threads as a separate queue:

```bash
npm run review:unresolved -- --state all --limit 40 --outdated-only
```

Review comments must not be ignored. Reply on the original thread with one of: the fixing PR/commit and resolve it; a linked follow-up issue/PR if it remains valid but is out of scope; or an obsolete/superseded reason before resolving. For broader recovery sweeps, use issues #152 and #153 as the tracking backlogs.

## Documentation Update Map

Do not leave status only in chat. Update the narrowest durable document that matches the change:

| Document | Update when |
|---|---|
| `AGENTS.md` | Agent operating rules, required commands, active-plan routing, stack assumptions, subagent policy, or this documentation map changes. Always update the timestamp. |
| `PR70_RECOVERY_CHANGELOG.md` | Any recovery slice changes behavior, docs, dependency strategy, validation evidence, PR status, review follow-up, local-only parking, or process/tooling. This is the default running log. |
| `SUBAGENT_LOG.md` | A subagent batch affects repo decisions, code, docs, dependency handling, validation strategy, or review cleanup. Include ticket scope, result, integration status, and follow-ups. |
| `LESSONS_LEARNED.md` | A recurring failure mode, process correction, durable technical lesson, tooling rule, or verification lesson should shape future agents. |
| `PR70_RECOVERY_LEDGER.md` | A PR is merged, closed, superseded, split, replaced, or mined for useful material. |
| `NOT_TAKEN_FEATURE_LEDGER.md` | Useful source-PR material is intentionally not ported, especially story-generation, prompt, audio, or UX ideas. |
| `PR70_RECOVERY_FINAL_REPORT.md` | Overall recovery status changes near finalization, especially what is merged, deferred, or still risky. |
| `STORY_LAB_COMPLETION_HARDENING_EXEC_PLAN.md` | Completion-hardening work changes auth/database proof, dependency follow-ups, review backlog status, or done/not-done claims. |
| `STORY_LAB_FINAL_MERGE_AUDIT_EXEC_PLAN.md` | Final audit evidence changes: last-40 PR audit, wider PR debt, unresolved review comments, coverage proof, or "all work merged" claims. |
| `STORY_LAB_FUTURE_WORK_CHECKLIST.md` | Granular future-work tickets, subagent-ready scopes, execution ordering, admin cleanup status, or next-work prioritization changes. |
| `STORY_LAB_OPTIONAL_POST_DONE_ROADMAP.md` | Optional post-Done programs, portfolio order, program promotion, ambitious future product scope, or optional-wave evidence changes. |
| `STORY_LAB_EXPLORATION_TICKETS.md` | Exploration ticket scope, standard exploration report fields, context-turnover packet shape, exploration wave planning, or explore-to-worker conversion strategy changes. |
| `STORY_LAB_EXPLORATION_FINDINGS.md` | Exploration batches complete, findings need durable synthesis, first worker wave changes, context-turnover packets are produced, or exploratory tickets are converted to implementation batches. |
| `STORY_LAB_AUTH_PROFILE_CLOUD_LIBRARY_EXEC_PLAN.md` | Auth, profile, cloud library APIs/UI, signed-in save/load/list/delete behavior, or provider-backed claims change. |
| `STORY_LAB_STORAGE_PORT_EXEC_PLAN.md` | Storage ports, in-memory/Postgres adapters, schema, durability wording, owner-scoped behavior, or cloud-vs-local status changes. |
| `STORY_LAB_JOB_ROUTES_EXEC_PLAN.md` | Job routes, job store, SSE events, progress/reload behavior, Workflow claims, or non-durable job wording changes. |
| `STORY_LAB_ROUTE_BUDGET_EXEC_PLAN.md` | Vercel-facing route files are added, retired, consolidated, renamed, or documented. |
| `STORY_LAB_PRIVACY_STREAMING_GATES_EXEC_PLAN.md` | CORS, account-boundary headers, export sanitization, retention/deletion policy, opaque job ids, or streaming privacy changes. |
| `STORY_LAB_REAL_ENGINE_EXEC_PLAN.md` | Story generation semantics, real-engine bridging, prompt contracts, continuation behavior, or model request shape changes. |
| `GROK_MULTIAGENT_STORY_LAB_POLISH_EXEC_PLAN.md` | Grok model behavior, AI continuity extraction, durable local story memory, story-quality evals, or provider fallback behavior changes. |
| `MVP_TO_SHIPPING_EXEC_PLAN.md`, `STORY_LAB_DEMO_SHIPPING_EXEC_PLAN.md`, and readiness reports | Public/demo shipping status, deployed smoke evidence, live-provider proof, dependency/security hardening, or MVP readiness changes. |
| `OVERNIGHT_MODE.md` | A long autonomous run pauses, completes a coherent workstream, parks local-only work, or leaves blocked commands for the next session. Do not reintroduce old `OVERNIGHT_HANDOFF.md` without rewriting it from current `main`. |
| `STORY_LAB_IDEA_BOARD.md` | Research-mined ideas, Weird Lab candidates, story-quality experiments, or backlog statuses change. Use `Local-only` unless merged. |
| `README.md` or deployment docs | User-facing setup, install, environment, deploy, or smoke-test instructions change. Do not revive historical DigitalOcean guidance as active. |
| `package.json` scripts | A repeatable command is added, renamed, or expected by agents/CI/docs. |

Documentation cleanup should be scoped. Do not start broad archive/rewrite work in the middle of recovery unless it directly reduces active confusion.

## Review Tooling Policy

CodeRabbit configuration lives in `.coderabbit.yaml`. The repository intentionally disables the blanket docstring-coverage pre-merge check. Do not mass-add JSDoc/docstrings to satisfy a generic percentage threshold.

Add focused documentation when it clarifies public contracts, exported ports/adapters, security/privacy invariants, cross-process storage behavior, or non-obvious story-generation constraints. If a bot asks for broad docstring coverage, treat that as review-tooling drift: tune the tool or open a follow-up issue instead of adding low-value comments.

## Test Quality Policy

Optimize for defects prevented and important behavior proved, not an arbitrary coverage percentage. Coverage reports are diagnostic maps for finding untested code; they are not completion evidence by themselves and must not be raised by adding trivial assertions, getter tests, brittle snapshots, or tests that only repeat the implementation.

Every implementation slice must identify its test obligations during scoping, not after coding. For each important behavior, name the defect or false claim the test is meant to kill. Prefer the smallest mix that proves the real risk:

- acceptance tests for the user-visible or API outcome;
- contract and invariant tests across UI/API/service/provider seams;
- negative tests for authorization, cross-owner access, privacy, redaction, invalid input, retries, no-op writes, and fail-closed behavior;
- persistence and restart tests for anything described as saved, cloud-backed, or durable;
- focused unit tests for branching domain logic;
- integration tests for database, route, migration, and adapter boundaries;
- browser or deployed smoke proof for critical signed-in flows;
- live-provider proof only when credentials are available and the claim depends on the real provider.

Mocks and fakes are useful for deterministic logic and failure injection, but they do not replace proof at the boundary they imitate. A mocked database test cannot prove a migration or real owner isolation; a mocked auth token cannot prove provider configuration; a component spec cannot prove a deployed signed-in flow.

For high-risk security and durability behavior, run a semantic counterfactual when practical: deliberately weaken or invert the owner check, error handling, persistence result, or restart assumption and confirm the relevant test fails. Revert the deliberate defect immediately. Record the mutation and result in the PR or changelog; do not commit the mutation.

Before calling a slice complete, the parent agent must review whether the tests would still pass with the most plausible bug reintroduced. Missing high-value proof is a blocker or an explicit non-claim, even when line coverage is high.

## Subagent Operating Rules

This section is the canonical definition of the Story Lab subagent lifecycle, roles, ticket fields, and review gates. Execution plans and checklists may summarize it for local context, but they must link back here instead of redefining conflicting meanings.

Use subagents as bounded execution help, not as a substitute for parent-agent judgment. The parent agent owns strategy, final integration, GitHub actions, and completion claims.

When the user asks to use subagents, the default sequence is parent discovery, scope prosecution, scope lock, worker execution, completion prosecution, and parent validation. Do not begin by fanning out explorer agents. The parent must inspect the current repo, control docs, relevant code, tests, dependencies, and live state first, then write the proposed split.

Do not make subagent planning overly conservative by defaulting most tickets to read-only exploration. Maintain precision and accuracy, but bias toward larger, useful worker chunks once the parent agent has chosen the strategy. Over-conservative plans are unsafe because they create process drag, reduce attention, and leave real work undone.

Use `Explorer` tickets only when parent-led discovery still leaves one named unknown that is genuinely risky, credential-dependent, or decision-heavy. An explorer ticket must investigate that unknown only; it must not be a generic repo survey. Use `Worker` tickets when the parent has enough information to bound files, tests, stop conditions, and expected output. Prefer one well-scoped worker that produces a reviewable change over separate scout-and-worker tickets when the risk is local and reversible.

For exploration batches, use `STORY_LAB_EXPLORATION_TICKETS.md`. Exploration tickets are read-only by design, but they must return worker-ready decisions, files touched, validation commands, and shared-file conflicts. Do not let exploration become another status report.

Before dispatching implementation subagents:

1. Analyze the target locally first and write down the chosen strategy, dependency order, proposed proof units, exact file leases, shared-file conflicts, test obligations, and stop conditions.
2. Size each proof unit with the Goldilocks check: it produces one valuable outcome, failures localize to one risk area, the diff is reviewable, and the unit can be reverted without unwinding unrelated behavior. Split scopes that cross independent risks; combine scopes that would otherwise produce partial behavior with no useful proof.
3. Dispatch one highly critical read-only `Scope Prosecutor` to attack the proposed scope artifact. It must look for hidden dependencies, overlapping writes, missing tests, unprovable acceptance criteria, oversized or undersized tickets, unsafe parallelism, vague stop conditions, and claims that exceed available credentials or infrastructure.
4. The parent must adjudicate every material critique as `Accept`, `Partial`, or `Reject`, with a reason; revise the scope when warranted; then mark the strategy `Scope locked`. If revisions materially change boundaries, allow one narrow re-review. Do not create an endless planning loop.
5. Confirm each implementation task is independent, has a disjoint write scope, or is explicitly serialized. Treat shared package files, lockfiles, routes, components, changelog sections, and generated artifacts as file leases owned by one worker at a time.
6. Keep at most six subagents active at once.
7. Prefer Spark-style fast agents only for narrow tickets with complete context and easy-to-check outputs.
8. Do not ask a subagent to "figure out the repo", "fix coverage", "add tests", or "handle Dependabot" without a bounded outcome and proof contract.

Every subagent ticket must include:

- **Parent analysis:** what is already known and what strategy has already been chosen.
- **Strategy status:** `Proposed`, `Scope prosecuted`, or `Scope locked`; workers require `Scope locked`.
- **Proof unit:** the one valuable outcome this ticket must make true.
- **Role:** read-only explorer, bounded worker, reviewer, or drafting assistant.
- **Owned files:** exact paths the agent may edit, or `Read-only`.
- **Files touched:** exact create/modify/test/docs paths expected for the task, plus any shared files that must be serialized instead of edited in parallel.
- **Dependencies and conflicts:** predecessor tickets, shared-file leases, and tasks that cannot run concurrently.
- **Test obligations:** behaviors, invariants, failure paths, and the plausible defect each required test should catch.
- **Forbidden actions:** no PR merges, no branch deletion, no review-thread resolution, no broad refactors, and no reverting unrelated work.
- **Commands:** exact checks to run, including whether failures are expected evidence.
- **Stop condition:** when to stop instead of broadening scope.
- **Output contract:** status, files changed, commands run, percent ready, blockers, concerns, and recommendation.
- **Artifact requirement:** command log, patch summary, checklist, or draft text that the parent can inspect without rereading the whole workspace.

Use this minimum ticket shape:

```text
Task name:
Parent analysis:
Strategy status:
Goal:
Proof unit:
Role:
Model / reason:
Owned files:
Files touched:
Read-only files:
Dependencies and conflicts:
Test obligations / defects killed:
Forbidden actions:
Exact steps:
Commands to run:
Expected pass/fail meaning:
Stop condition:
Output contract:
Artifact requirement:
```

For coding subagents, use disjoint write ownership. Do not let two workers edit the same package file, lockfile, route, component, or changelog section in parallel. If the work needs shared files, either serialize those edits or keep the subagents read-only and integrate in the parent session.

Dependency PRs need extra care. Do not split one dependency PR into multiple package-lock writers unless each lockfile is in a different package root. Root `package-lock.json` and `story-generator/package-lock.json` can be separate workers; two workers must not both edit the same lockfile. Major framework upgrades should be separate from patch/minor tooling updates.

After subagents return:

1. Review every result before integrating it.
2. Run a read-only `Completion Prosecutor` against the locked scope, diff, tests, and worker evidence. This is separate from the pre-work Scope Prosecutor and must try to disprove completion, test usefulness, and non-claims.
3. Adjudicate the completion critique, revise when warranted, and run the relevant local checks yourself.
4. Push and merge only from the parent session.
5. Record timeouts or stale-workspace failures as failures, not partial success.
6. Update `SUBAGENT_LOG.md` and the active changelog or execution plan in the same PR when subagent work materially affects repo decisions.

For one normal implementation PR, apply the policy in this order:

1. Parent discovery: inspect live state, code, tests, dependencies, and the matching plan.
2. Proposed scope: write the proof unit, exact file lease, dependencies, test defects, commands, stop condition, and non-claims.
3. Scope prosecution: obtain one critical read-only review and record parent dispositions.
4. Scope lock: revise once when warranted and explicitly mark the worker ticket `Scope locked`.
5. Implementation: write the behavior and meaningful tests without broadening the lease.
6. Completion prosecution: attack the diff, tests, evidence, and claims separately from the scope review.
7. Parent validation: adjudicate findings, run focused and aggregate checks, and inspect the final diff.
8. Publication: push, open the PR, address checks and original review threads, merge, audit late threads, and update durable records.

## Current Operating Direction

The unpublished `feature/story-lab-auth-profile-contracts` stack has been split and merged through PR #151. The current recovery task is completion hardening: address or track review comments, resolve dependency follow-ups, prove live auth/database behavior before cloud claims, and keep durable-job claims gated on process-loss proof.

The active Story Lab completion-hardening plan is `STORY_LAB_COMPLETION_HARDENING_EXEC_PLAN.md`. Use it before claiming the recovery is done, integrating live auth/database behavior, claiming durable jobs, closing the review-comment backlog, or merging dependency follow-ups.

The stricter final merge, test-quality, and PR-review audit plan is `STORY_LAB_FINAL_MERGE_AUDIT_EXEC_PLAN.md`. Use it before claiming all local work is merged, the last 40 PRs have been audited, review comments are handled, critical behavior has meaningful test proof, or the overall Story Lab recovery goal is complete.

The autonomous operating guide is `OVERNIGHT_MODE.md`. Use it before long-running task selection, research mining, or Weird Lab work.

The idea/backlog board is `STORY_LAB_IDEA_BOARD.md`. Keep it honest: `Done` means merged to `main`; use `Local-only` for unpublished branch material.

The ambitious optional roadmap is `STORY_LAB_OPTIONAL_POST_DONE_ROADMAP.md`. It does not block the required Definition of Done. Use it after required completion to select, prosecute, and execute larger Story Lab product programs; update the required boundary first if the user explicitly promotes an optional program.

The active Story Lab auth/profile/cloud-library plan is `STORY_LAB_AUTH_PROFILE_CLOUD_LIBRARY_EXEC_PLAN.md`. Use it before adding provider-backed auth, private user profiles, cloud project library APIs, account route rewrites, or signed-in save/load/list/delete behavior.

The whole-concept status checklist is `STORY_LAB_CONCEPT_CHECKLIST.md`. Use it for plain-language percentages, done/not-done status, and next-work prioritization before giving a broad Story Lab status update.

The granular future-work checklist is `STORY_LAB_FUTURE_WORK_CHECKLIST.md`. Use it before dispatching subagents for unfinished Story Lab work; each unfinished item is broken into owned scope, stop condition, output, and validation.

The exploration-ticket packet is `STORY_LAB_EXPLORATION_TICKETS.md`. Use it before running the next exploration batch; it defines the standard exploration report, context-turnover packet, and the exploration tickets that should convert the future-work checklist into larger worker chunks.

The latest completed exploration synthesis is `STORY_LAB_EXPLORATION_FINDINGS.md`. Use it before rerunning any EXP ticket. If the finding is still current, dispatch workers from that synthesis instead of repeating read-only exploration.

## Historical Recovery Context

`PR70_RECOVERY_PLAN.md` and `plan.md` are historical recovery context, not the active source of truth for current Story Lab completion work. Use them only when explicitly mining old PR-recovery history.

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

For broad PR-recovery archaeology only, the old recovery path was:

1. Create a new recovery branch from current `main`.
2. Merge PR #70 as the story-lab baseline.
3. Make the branch Vercel-first.
4. Port, cherry-pick, merge, or close every remaining open PR.
5. Record accepted material, rejected material, conflicts, tests, and self-review notes as work proceeds.

The companion inventory is `PR_USEFUL_MATERIAL_INVENTORY.md`.

Keep these files current during the recovery:

- `PR70_RECOVERY_CHANGELOG.md` - chronological work log and decisions.
- `SUBAGENT_LOG.md` - subagent batches, tickets, results, integration decisions, and follow-ups.
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

1. Start with the current operating direction and the execution plan matching the files being changed; use `PR70_RECOVERY_PLAN.md` only for historical broad PR-recovery archaeology.
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
