# Story Lab App Audit

Last updated: 2026-06-08

## Purpose

This audit is the current working snapshot for Story Lab after the large PR merge and the narrative dials UI merge. It is written for coding agents and for the user. It separates what is actually working from what is only scaffolded, planned, or still needs external provisioning.

## Fresh Evidence

Commands run from `/Users/hbpheonix/fairytaleswithspice` on 2026-06-08:

- `git status --short --branch`
  - Result: `main` tracks `origin/main`.
  - Untracked files present: `SPARK_TRIAL_TASKS.md`, `STORY_QUALITY_EVALS_PLAN.md`, `tests/grok-smoke.test.ts`.
- `gh pr list --state open --json number,title,headRefName,baseRefName,url`
  - Result: no open PRs returned.
- `git log --oneline --decorate -8`
  - Latest commit: `4834914` / PR #113, `feature/story-lab-narrative-dials-ui`, merged into `main`.
- `scripts/recovery/check-vercel-function-count.sh`
  - Result: `10/12`, within limit.
- `scripts/recovery/preflight.sh --quick --skip-status`
  - Result: passed required tools, whitespace/conflict markers, Vercel function count, Angular app typecheck, Angular spec typecheck, and Vercel API function typecheck.
- `npm run test:all`
  - Result: passed root story, trope, cliffhanger, Story Lab state, Story Lab real-engine, and story-quality eval tests.
  - Caveat: ran in mock mode because `XAI_API_KEY` was not present.

Files inspected during this audit:

- `AGENTS.md`
- `STORY_LAB_PLATFORM_EVOLUTION_EXEC_PLAN.md`
- `STORY_LAB_STORAGE_PORT_EXEC_PLAN.md`
- `api/_lib/story-lab/auth/authPort.ts`
- `api/_lib/story-lab/auth/authorizeProjectAccess.ts`
- `api/_lib/story-lab/storage/storyProjectStore.ts`
- `story-generator/src/app/story-workspace-storage.service.ts`

## Current Health

The app is mechanically healthier than it was before the repo cleanup.

- The active branch is `main`, and local `main` is aligned with `origin/main`.
- There are no currently open PRs to address.
- The Vercel function budget is not exhausted: `10/12`.
- Quick preflight passes.
- Root integration/unit checks pass.
- Story Lab UI work has landed through narrative dials, villain pressure, Director's Room notes, job status, batch queue, and job-backed genesis/continuation flows.
- The codebase has explicit seams for future account auth and owner-scoped project storage.
- Server/client logging and privacy scaffolding have already received meaningful work in prior phases.

## Current Product Reality

For a normal user, the app is still mostly an anonymous, local-browser Story Lab.

What users can meaningfully experience now:

- Build a Story Lab idea with richer story controls.
- Generate and continue stories through the job-backed UI path.
- See job progress/status while the current process is alive.
- Use local browser save/load behavior for recent projects.
- Use narrative controls such as heat contract, Director's Room notes, villain pressure, and narrative dials.

What users cannot honestly rely on yet:

- Signing in.
- Having a profile.
- Saving stories to a cloud account.
- Opening their story library across devices.
- Resuming background generation after a server process dies.
- Getting durable long-running Workflow-backed progress.
- Proving live Grok output in this environment without configuring `XAI_API_KEY`.

## Issue List

### P0: Account Auth Is Not Implemented

There is an `AuthPort` and `authorizeProjectAccess`, but the active auth port is deny-by-default. That is good architecture scaffolding. It is not a login system.

Required before this becomes a user feature:

- Pick an auth provider.
- Define session/cookie behavior for Vercel.
- Add login/logout/profile UI.
- Wire authenticated route calls through `AuthPort`.
- Prove forbidden cross-user access with tests.

### P0: Cloud Project Storage Is Not User-Visible

The storage port exists and models owner-scoped saved projects. The browser still uses `StoryWorkspaceStorageService` and local storage for visible saving.

Required before this becomes a user feature:

- Provision or configure a durable database.
- Add API routes or consolidate into existing Story Lab route capacity.
- Save, load, list, and delete projects by authenticated owner.
- Make local browser storage a fallback/cache instead of the canonical signed-in source.
- Add UI for "my stories" or a project library.

### P0: Job Progress Is Not Durable

The Story Lab job route scaffold is useful, but the store is process-local and labelled `non_durable_memory`. It should not be described as crash-safe progress.

Required before this becomes durable:

- Add a database-backed job table.
- Add owner-scoped job authorization.
- Add a Workflow or equivalent durable runner decision.
- Persist job events/snapshots outside the current process.
- Add recovery tests that simulate missing in-memory state.

### P0: Live Provider Proof Is Missing In This Environment

The root tests pass without `XAI_API_KEY`, which is good for local development. It does not prove live Grok output.

Required before live-story claims:

- Run the live-provider smoke with credentials configured.
- Prove telemetry says Grok/live provider, not mock.
- Record the exact command, env requirements, and pass/fail result in a handoff or deployment proof doc.

### P0: Mock Story Length Tests Are Too Weak

`npm run test:all` passes, but mock generation repeatedly produces around 211 words for 700, 900, and 1200 word targets. The test logs warnings instead of failing.

This matters because green tests can hide a broken expectation: requested length should either be honored or the test should explicitly say mock length is intentionally fixed and not quality evidence.

Possible fixes:

- Make mock generation scale roughly with requested word count.
- Or split tests into "contract smoke" and "quality/length" checks so the length mismatch is not ignored.
- Add a story-quality eval that records length variance as a first-class score.

### P1: Vercel Function Budget Is Tight

The current count is `10/12`. There is room, but not enough to add auth, storage, profile, export, and job routes casually.

Rule:

- Before adding deployable route files, run `scripts/recovery/check-vercel-function-count.sh`.
- If the count reaches `12/12`, consolidate or retire routes before adding more.

### P1: Storage Plan Status Needs Reconciliation

The storage port files exist on `main`, but `STORY_LAB_STORAGE_PORT_EXEC_PLAN.md` still contains progress language that can read like PR/push/merge work remains. Treat the code and current git state as authoritative, then reconcile the plan doc in a small docs cleanup.

### P1: Full Browser/Angular Validation Remains Environment-Sensitive

Quick preflight completed here, but historical notes show local Angular/Karma/browser checks can hang in this environment. Overnight work should use shardable checks, direct TypeScript proof, and browser smoke only when the environment is stable.

### P1: Untracked Files Need Triage

The following files are untracked:

- `SPARK_TRIAL_TASKS.md`
- `STORY_QUALITY_EVALS_PLAN.md`
- `tests/grok-smoke.test.ts`

Do not delete or absorb them without a specific decision. They may be useful for the overnight idea board, story-quality evals, or live-provider smoke work.

### P2: Competitor/Research Mining Has No Durable Workflow Yet

The user wants autonomous research, idea mining, and occasional weird experiments. Before this doc pass, there was no durable place to store research leads, experiment hypotheses, source links, or rejected ideas.

This is now addressed by `STORY_LAB_IDEA_BOARD.md`, but the board still needs to be populated by actual research passes.

## Auth, Storage, And Profiles Recommendation

Do not start by bolting login UI onto the current app. Start with a provider decision and a storage/profile contract.

Recommended order:

1. Provider decision: choose auth provider and database/storage provider for Vercel.
2. Profile contract: define what a user profile contains, what is private, and what is optional.
3. Storage migration: connect signed-in users to cloud project save/list/load/delete.
4. Library UI: expose a user-facing story shelf.
5. Durable jobs: persist job state and require owner access.
6. Deployment proof: run live provider, auth, storage, and route-budget checks.

## Suggested Next Autonomous Work

Use this order unless a newer user request or failing PR check supersedes it:

1. Reconcile stale storage-port plan progress language.
2. Turn auth/storage/profile into a concrete implementation plan with provider decision gates.
3. Triage the three untracked files and either adopt, revise, or park them.
4. Run one research-mining pass and populate the idea board with source-backed ideas.
5. Pick one small story-quality improvement from the idea board and implement it behind tests.
