# Story Lab Completion Hardening ExecPlan

Created: 2026-06-21 15:04 EDT
Last updated: 2026-07-11 00:27 EDT

This ExecPlan is the authoritative plan for finishing the Story Lab recovery after PR #151. It reconciles the merged unpublished-branch recovery slices, the still-open review-comment backlog, Dependabot triage, live auth/database integration, durable-job honesty, and the final completion audit.

This plan does not reopen audio, DigitalOcean, or broad legacy product work. Vercel remains the deployment target.

## Purpose / Big Picture

The goal is to turn the recovered Story Lab work from "merged scaffolding and guarded UI" into a fully verified, honestly described production path.

The desired end state is:

- all recovery work that is merged to `main` is accurately documented as merged, scaffolded, non-durable, or live;
- every unresolved PR review thread is either addressed with code, resolved with evidence that `main` already fixed it, or converted into a focused tracked issue;
- the current Dependabot queue is merged, closed, or replaced with narrower PRs using validation evidence;
- signed-in Story Lab account flows work against the configured auth provider and durable database before any cloud-sync claim is made;
- durable jobs are not claimed until job progress survives process loss and owner-scoped database writes are proven;
- the final report contains command evidence, PR links, review-comment disposition, and self-critique.

## Progress

- [x] Verified `origin/main` includes PR #151 on 2026-06-21.
- [x] Confirmed open product/recovery PRs are clear; at the 2026-06-21 baseline only Dependabot PRs #120 and #121 remained open.
- [x] Refreshed live dependency/PR truth on 2026-07-11: current `main` is clean/current and the only open PR is Dependabot #194, not the old #120/#121 queue.
- [x] Confirmed recent recovery PRs #147, #148, #149, #150, and #151 have zero active unresolved review threads after the late PR #149 comment was fixed by PR #151.
- [x] Created review-backlog issue #152 for current Story Lab recovery PRs: 21 PRs and 125 active unresolved review threads at the baseline audit.
- [x] Created review-backlog issue #153 for legacy/superseded PRs: 35 PRs and 168 active unresolved review threads at the baseline audit.
- [x] Added `npm run review:unresolved` to make review-thread audits repeatable from the repo.
- [x] Merge this completion-hardening plan slice.
- [x] Merge review-thread cleanup PRs #174, #175, #176, #177, #178, and #179.
- [ ] Triage #152 until every Story Lab recovery review thread is replied to and either resolved or explicitly tracked.
- [ ] Triage #153 until every legacy review thread is replied to and either resolved, tracked, or closed as obsolete/superseded.
- [ ] Resolve current Dependabot follow-up by triaging PR #194 with evidence, then closing/recreating or splitting it as needed.
- [ ] Complete the auth/database live integration gate.
- [ ] Complete the durable job correctness gate.
- [ ] Complete the preflight/tooling drift gate.
- [ ] Complete story-quality heuristic follow-up #138.
- [ ] Produce the final recovery report and completion audit.

## Surprises & Discoveries

- PR #117 was closed, not merged. The later recovery path continued through PR #118, PR #119, and the subsequent account/cloud/job/UI slices.
- The original unpublished-branch split plan is historically useful but no longer the live completion plan. PRs #114 through #151 have absorbed that stack; this file tracks what remains.
- CodeRabbit review-tool behavior was controlled by organization-level UI configuration until `.coderabbit.yaml` landed in PR #150.
- A late bot review comment can arrive after an API merge. PR #151 fixed a PR #149 comment that appeared after the first merge-time audit, so every future PR needs one more post-merge review-thread sweep.
- The same late-bot pattern repeated on PR #178: it was clean at merge time, then CodeRabbit added two active trivial maintainability comments afterward. PR #179 fixed and resolved those comments.
- Auth/profile/cloud-library and durable-job scaffolding are merged, but live provider auth, executed database migrations, signed-in browser proof, and process-loss job proof are still not done.
- As of 2026-07-03 12:54 EDT, the last-40 PR audit reports zero active or outdated unresolved review threads, but a wider `--state all --limit 200` audit still finds older historical backlog: 168 active unresolved threads across 35 PRs and 56 outdated unresolved threads across 14 PRs.
- As of 2026-07-03 12:54 EDT, only Dependabot PRs #120 and #121 remained open, and both still had failing Recovery CI/Vercel checks.
- As of 2026-07-11 00:27 EDT, #120/#121 are no longer the active queue. The current open PR is Dependabot #194, which mixes root lockfile work with Angular 22 package/lockfile changes and is failing Recovery CI/Vercel.
- The current dependency stance remains split-first: close/recreate or replace mixed Angular-major PRs rather than patching them in place beside unrelated coverage or product work.

## Decision Log

- Use "merged to `main`" as the only meaning of `Done`.
- Keep cloud/account wording honest: `non_durable_memory` is not cloud sync, durable storage, or production account persistence.
- Keep one consolidated Story Lab account route. Do not add separate account/profile/project route files unless the Vercel function budget is intentionally revisited.
- Keep `api/_lib` as the canonical shared API implementation path.
- Do not add broad docstrings for CodeRabbit coverage. Tune review tooling or open a focused issue instead.
- Use #152 and #153 as the durable backlog for review comments that are not handled immediately.
- Do not claim durable jobs until owner-scoped database writes, transaction semantics, and process-loss recovery are proven.

## Outcomes & Retrospective

Current outcome:

- The unpublished auth/profile/cloud-library/durable-owner stack has been split, reviewed, followed up, and merged through PR #151.
- Later review-cleanup work has been merged through PR #179.
- The repo has clear scaffolds for auth provider selection, profile/project stores, cloud schema/readiness, account routes, Angular cloud library UI, and owner-scoped job storage.
- The repo does not yet have a production signed-in Story Lab flow, a live durable database migration, durable cloud sync proof, or crash-safe job proof.
- The repo does not yet have a current 90% coverage gate.

Self-critique so far:

- Too much work was allowed to accumulate before merging. The recovery succeeded, but it made review comments harder to track and made PR #117 confusing.
- The review-comment loop was not strict enough on the first pass. The late PR #149 comment showed that "merged" still needs a final thread audit.
- The process needed a repo command for review-thread counts, not only copied GraphQL snippets in issues.
- Future slices should be larger only when they prove one coherent behavior. Auth, database, UI, and durable jobs must remain separate gates because their failure modes are independent.

## Context and Orientation

Start every session from the repository root and run:

```bash
git status --short --branch
npm run recovery:status
```

Relevant plans and ledgers:

- `AGENTS.md`
- `STORY_LAB_UNPUBLISHED_BRANCH_SPLIT_PLAN.md`
- `STORY_LAB_AUTH_PROFILE_CLOUD_LIBRARY_EXEC_PLAN.md`
- `STORY_LAB_STORAGE_PORT_EXEC_PLAN.md`
- `STORY_LAB_JOB_ROUTES_EXEC_PLAN.md`
- `STORY_LAB_ROUTE_BUDGET_EXEC_PLAN.md`
- `PR70_RECOVERY_CHANGELOG.md`
- `PR70_RECOVERY_FINAL_REPORT.md`

Relevant issues:

- #152: unresolved Story Lab recovery review threads.
- #153: unresolved legacy PR review threads.
- #138: quality heuristics refactor.
- #135: idempotency-key retries in Postgres job creation.
- #132: historical Dependabot #120/#121 Vercel preview triage; current dependency follow-up is #194.
- #131: job store config memoization.
- #130: recovery preflight network-dependent Node 20 wrappers.
- #129: stable UI-slice validation hooks.
- #128: recovery docs guidance drift/tool fallback notes.
- #127: concurrent index migration strategy before live durable tables.
- #126: engine exceptions during route-backed jobs.
- #125: transaction-capable Postgres job mutations.

## Plan of Work

### Slice 1: Completion Plan And Review-Audit Tooling

Status: in progress in `recovery/story-lab-completion-exec-plan`.

Scope:

- add this ExecPlan;
- add the `npm run review:unresolved` audit command;
- update `AGENTS.md` so future agents find this plan before claiming completion;
- update `PR70_RECOVERY_CHANGELOG.md`.

Acceptance:

- [x] `npm run review:unresolved -- --prs 149,150,151` reports no active unresolved review threads.
- [x] `npm run review:unresolved -- --prs 116 --json` returns the expected #152 backlog shape with three active PR #116 threads.
- [x] `git diff --check` passes.
- [x] `npm run recovery:status` passes.
- [x] `scripts/recovery/check-vercel-function-count.sh` passes.
- [ ] PR opens, checks/review comments are handled, and the PR merges.

Self-test:

- Run the audit command before opening the PR and again after merge for the new PR number.
- If a review comment appears, address it or open/link an issue before resolving the thread.

Validation on 2026-06-21:

- `node --check scripts/recovery/list-unresolved-review-threads.mjs`: passed.
- `npm run review:unresolved -- --help`: passed.
- `npm run review:unresolved -- --prs 149,150,151`: passed, no active unresolved review threads found.
- `npm run review:unresolved -- --prs 116 --json`: passed, returning the expected three active PR #116 threads from #152.
- `npm run review:unresolved -- --repo Phazzie/FairytaleswithSpice --prs 154 --json`: passed, proving explicit repo override still works for focused PR audits.
- `git diff --check`: passed.
- `npm run recovery:status`: passed with expected tracked/untracked files for this slice; function count stayed `11/12`.
- `scripts/recovery/check-vercel-function-count.sh`: passed at `11/12`.

### Slice 2: Story Lab Recovery Review Comment Triage

Scope:

- Work issue #152 from highest-risk PRs first: auth/account/storage/job routes, then story-generation behavior, then UI/docs.
- For each active thread, inspect current `main`, not only the old diff.
- Reply on the original review thread with the outcome.

Sub-checklist:

- [ ] Re-run `npm run review:unresolved -- --state all --limit 200` and update #152 baseline if counts changed.
- [ ] For every #152 row, export or inspect thread details with `npm run review:unresolved -- --prs <number> --json`.
- [ ] If fixed on `main`, reply with the fixing PR/commit and resolve.
- [ ] If still valid and small, fix in a focused PR.
- [ ] If still valid and not small, open a focused issue and link it from the thread.
- [ ] If obsolete/superseded, reply with the reason and resolve.
- [ ] Update #152 with final counts and links.

Acceptance:

- #152 has zero active unhandled review comments.
- Any remaining open threads have linked issues and an explicit reason they cannot be resolved yet.

### Slice 3: Legacy Review Comment Triage

Scope:

- Work issue #153 without pulling DigitalOcean, audio, or closed legacy app paths back into active Story Lab scope.
- Treat older comments as evidence to inspect, not as automatic implementation scope.

Sub-checklist:

- [ ] Re-run `npm run review:unresolved -- --state all --limit 200` and update #153 baseline if counts changed.
- [ ] Inspect each #153 PR thread in current-code context.
- [ ] Fix only comments that still apply to current `main` and are in active scope.
- [ ] Open issues for still-valid but larger defects.
- [ ] Reply/resolve obsolete, superseded, or intentionally not-taken comments.
- [ ] Update #153 with final counts and links.

Acceptance:

- #153 has zero active unhandled review comments.
- Active Story Lab scope is not expanded to DigitalOcean/audio unless the user explicitly reopens those areas.

### Slice 4: Dependabot And Preview Triage

Scope:

- Resolve the current Dependabot queue. As of 2026-07-11, this is PR #194.
- Treat PR #194 as a split/close-recreate candidate because it mixes a root lockfile update with Angular 22 package/lockfile changes and is failing Recovery CI plus Vercel.
- Keep dependency changes separate from auth/database and durable-job work.

Sub-checklist:

- [ ] Inspect dependency deltas in #194.
- [ ] Run `npm install` only where lockfile refresh is needed.
- [ ] Run focused root and Angular validations.
- [ ] Confirm Vercel preview behavior or document blocker.
- [ ] Merge or close each PR with evidence.

Expected validation:

```bash
npm run test:all
npm run build
scripts/recovery/check-vercel-function-count.sh
```

Acceptance:

- PR #194 is merged, closed, or replaced by narrower PRs with evidence.
- Dependabot tracking is updated with the chosen disposition.

### Slice 5: Auth And Database Live Integration

Scope:

- Turn current auth/database scaffolding into a proven signed-in cloud-library path.
- This is the first slice allowed to claim live cloud sync, and only after proof.

Sub-checklist:

- [ ] Configure the production auth provider verifier without accepting unsigned or locally forged identities.
- [ ] Confirm auth provider environment variables are present only in the right deployment environments.
- [ ] Provision the durable database and set `DATABASE_URL` in the target environment.
- [ ] Run schema migration against the target database.
- [ ] Run database readiness smoke against the target database.
- [ ] Prove signed-in profile read/write in browser.
- [ ] Prove signed-in project save/list/load/delete in browser.
- [ ] Prove cross-owner access denial.
- [ ] Prove anonymous browser-local save still works.
- [ ] Add deployment/secret/redaction notes to the final report.

Expected local and live validation:

```bash
npm run test:story-lab-configured-auth
npm run test:story-lab-clerk-auth
npm run test:story-lab-profile-store
npm run test:story-lab-account-routes
npm run test:story-lab-cloud-storage-config
npm run test:story-lab-cloud-schema
npm run test:story-lab-cloud-schema-migration
npm run test:story-lab-cloud-db-readiness
DATABASE_URL=... npx tsx scripts/recovery/apply-story-lab-cloud-schema.ts
DATABASE_URL=... npx tsx scripts/recovery/story-lab-cloud-db-smoke.ts
npm run recovery:preflight -- cloud-library-ui
npm run build
```

Acceptance:

- Cloud sync is proven by signed-in save/list/load/delete against durable storage.
- No logs expose tokens, emails, story text, SQL params, or raw provider payloads.
- The UI still distinguishes local-only, cloud-unavailable, and cloud-synced states.

### Slice 6: Durable Job Correctness

Scope:

- Complete #125, #126, #131, and #135 before claiming durable jobs.
- Keep active UI labels honest until process-loss proof exists.

Sub-checklist:

- [ ] Add transaction-capable Postgres job mutations where multi-row or state-transition safety requires it.
- [ ] Add idempotency-key retry behavior for job creation.
- [ ] Memoize job-store config only when it cannot freeze stale env/test state.
- [ ] Handle engine exceptions during route-backed jobs with durable failure records.
- [ ] Prove owner-scoped reads and writes after live database configuration.
- [ ] Prove job progress survives process loss or explicitly keep `non_durable_memory` wording.

Expected validation:

```bash
npm run test:story-lab-job-store-config
npm run test:story-lab-job-store-port
npm run test:story-lab-job-routes
npm run recovery:preflight -- durable-job-owner
npm run build
```

Acceptance:

- Durable job claims are backed by database/process-loss evidence.
- Failure states are visible and do not leak another user's job state.

### Slice 7: Migration And Index Safety

Scope:

- Complete #127 before live durable tables are treated as production-ready.

Sub-checklist:

- [ ] Review indexes in `storyLabCloudSchema.sql`.
- [ ] Decide whether concurrent indexes are required for the live rollout.
- [ ] If required, split table creation and index creation so deployment does not lock live tables unnecessarily.
- [ ] Document rollback and re-run behavior.

Acceptance:

- Live migration path is idempotent and safe for the expected database size and traffic.

### Slice 8: Preflight And Tooling Reliability

Scope:

- Complete #128, #129, and #130 so recovery validation is stable and documented.

Sub-checklist:

- [ ] Add or document stable UI-slice validation hooks.
- [ ] Reduce reliance on network-dependent Node 20 wrappers where a local path is available.
- [ ] Update recovery docs where tool fallback notes drifted from reality.
- [ ] Keep `npm run review:unresolved` documented as the review-comment audit command.

Acceptance:

- A future agent can run focused preflights without rediscovering environment/tooling workarounds.

### Slice 9: Story Quality Heuristic Refactor

Scope:

- Complete #138 after the current story-quality follow-ups are stable.

Sub-checklist:

- [ ] Keep behavioral tests from PR #149/#151 intact.
- [ ] Refactor heuristics without changing accepted output semantics unless tests/specs explicitly require it.
- [ ] Run quality and story-engine tests.

Expected validation:

```bash
npm run test:story-quality
npm run test:story-lab-real-engine
npm run test:story
npm run recovery:preflight -- story-quality-guidance
```

Acceptance:

- Heuristic code is easier to maintain and current regressions stay covered.

### Slice 10: Final Completion Audit

Scope:

- Produce the final report only after slices 2 through 9 are complete or explicitly closed as not needed.

Sub-checklist:

- [ ] Run `git status --short --branch`.
- [ ] Run `npm run recovery:status`.
- [ ] Run `npm run review:unresolved -- --state all --limit 200`.
- [ ] Confirm open PRs are intentional and documented.
- [ ] Confirm open issues are either out of scope or linked from final report.
- [ ] Run final validation commands.
- [ ] Update `PR70_RECOVERY_FINAL_REPORT.md` with PR links, issue links, command evidence, review-comment disposition, and self-critique.

Expected validation:

```bash
npm run test:all
npm run build
scripts/recovery/check-vercel-function-count.sh
npm run recovery:preflight -- cloud-library-ui
npm run recovery:preflight -- durable-job-owner
npm run recovery:preflight -- story-quality-guidance
npm run recovery:preflight -- story-memory-cards
npm run recovery:preflight -- css-lazy-loading --quick
```

Acceptance:

- The final report can answer what is done, what remains, what was intentionally not done, and how each review comment was handled.

## Concrete Steps

For every slice:

1. Start from updated `main`.
2. Run `git status --short --branch` and `npm run recovery:status`.
3. Create one branch named `recovery/story-lab-*`.
4. Make only the changes needed for that slice.
5. Run focused tests before broad tests.
6. Run `git diff --check`.
7. Open a PR with scope, validation, non-claims, and issue links.
8. Address PR comments directly.
9. If a comment is valid but out of slice, open/link an issue before resolving.
10. Merge only after checks and active comments are clean or explicitly tracked.
11. After merge, re-run `npm run review:unresolved -- --prs <merged-pr-number>` to catch late bot comments.
12. Update `PR70_RECOVERY_CHANGELOG.md` and relevant issues.

## Validation and Acceptance

Completion requires:

- all planned slices merged or intentionally closed with reasons;
- #152 and #153 updated with final comment-disposition counts;
- the current dependency PR queue merged, closed, or replaced with evidence;
- auth/database claims backed by live signed-in proof;
- durable-job claims backed by process-loss proof;
- final command evidence recorded in `PR70_RECOVERY_FINAL_REPORT.md`;
- Vercel function count within limit.

Minimum command set before final completion:

```bash
git status --short --branch
npm run recovery:status
npm run review:unresolved -- --state all --limit 200
npm run test:all
npm run build
scripts/recovery/check-vercel-function-count.sh
```

## Idempotence and Recovery

- All branches should be restartable from `origin/main`.
- Migration scripts must refuse missing `DATABASE_URL` and be safe to re-run.
- Review-comment triage is idempotent: re-running `npm run review:unresolved` should show the remaining active threads after replies/resolutions.
- If a PR is API-merged, fetch and audit its review threads again because late comments can arrive after merge.
- If a local worktree reports an upstream as `[gone]`, first check whether the branch was merged and deleted before treating it as lost.
- Do not delete backup branches or stale local worktrees until the final report identifies them as safe to remove.

## Artifacts and Notes

- Review backlog issues: #152 and #153.
- Dependency triage issue: #132.
- Route budget remains constrained; latest known count is `11/12`.
- The active account/cloud plan remains `STORY_LAB_AUTH_PROFILE_CLOUD_LIBRARY_EXEC_PLAN.md`.
- The new review audit command is:

```bash
npm run review:unresolved -- --state all --limit 200
```

For a focused PR audit:

```bash
npm run review:unresolved -- --prs 149,150,151
npm run review:unresolved -- --prs 149,150,151 --json
```

## Interfaces and Dependencies

- Auth boundary: `api/_lib/story-lab/auth/*`.
- Account route: `api/story-lab/account.ts` and `api/_lib/story-lab/account/accountRouteHandlers.ts`.
- Profile/project storage: `api/_lib/story-lab/profile/*` and `api/_lib/story-lab/storage/*`.
- Job storage: `api/_lib/story-lab/jobs/*`.
- UI account/cloud state: `story-generator/src/app/story.service.ts`, `story-generator/src/app/app.ts`, `story-generator/src/app/app.html`, and `story-generator/src/app/app.css`.
- GitHub review audit: `scripts/recovery/list-unresolved-review-threads.mjs`.
- GitHub CLI authentication is required for review-thread audits.
