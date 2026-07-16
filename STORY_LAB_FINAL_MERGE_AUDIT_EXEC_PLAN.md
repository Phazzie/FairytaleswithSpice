# Story Lab Final Merge And Audit ExecPlan

Created: 2026-07-03 08:04 EDT
Last updated: 2026-07-16 03:14 EDT

This ExecPlan extends the current `origin/main` completion-hardening plan with the user's stronger final goal: all local work must be reconciled through pull requests, review comments must be handled, the last 40 PRs must be audited for unresolved review comments, and critical Story Lab behavior must have meaningful risk-based test proof before the work is called done.

## Purpose / Big Picture

The goal is to finish the Story Lab recovery in a way that can survive a fresh audit. "Done" means the remaining local and remote Story Lab work is merged into `main` through reviewable PRs, review comments are addressed or explicitly tracked, production claims are backed by evidence, and tests prove the important acceptance behavior, invariants, failure paths, and real external boundaries. Coverage measurements help locate blind spots but are not completion evidence by themselves.

The desired end state is:

- local-only work is no longer stranded in this checkout;
- the current remote completion-hardening plan is merged, updated, and superseded only where this stronger plan is stricter;
- every remaining implementation slice is PR'd, reviewed, and merged into `main`;
- review comments on the last 40 PRs are audited with repeatable GitHub evidence;
- unresolved review comments are either fixed, resolved as obsolete with a reply, or linked to a focused follow-up issue before being resolved;
- Story Lab auth/cloud/durable-job claims remain honest until live auth, durable storage, and process-loss proof exist;
- root and Angular test tooling produces repeatable behavioral proof and honest coverage diagnostics for blind-spot discovery;
- final validation and self-critique are recorded in `PR70_RECOVERY_FINAL_REPORT.md`.

## Updated Definition Of Done

This plan uses a stricter, claim-based definition than the older recovery docs. A checked box is not enough: every required row needs current evidence in the final report. If an intended MVP claim cannot be proved, it must be removed from product wording or explicitly deferred with the user's approval; silently relabeling missing work as optional is not allowed.

| Required gate | Definition of done | Required evidence |
|---|---|---|
| Source and publication truth | `origin/main` contains every retained change. Local commits, untracked files, backup branches, and open PRs are classified as merged, intentionally discarded with reason, or linked follow-up work. | Clean/current `main`, branch/commit inventory, merged PR links, `npm run recovery:finish -- --strict`. |
| Critical user journey | The supported create, continue, local save/restore, copy, download, account, and cloud-library journeys behave as documented on the deployable app. Error and loading states do not imply success. | Focused unit/contract tests, Angular/browser evidence, build, and deployed smoke where deployment behavior matters. |
| Live auth and cloud persistence | A real signed-in account can save, list, load, update, and delete a project against the provisioned database. A second owner cannot read, overwrite, list, or delete it. Refresh/new-session checks prove persistence. | Credential-safe env audit, applied migration/readiness output, account smoke, browser or route evidence, cross-owner denial, deletion proof, redacted logs. |
| Security and privacy boundaries | Auth failures fail closed; owner isolation, CORS, redaction, invalid input, private payload transport, and storage-conflict behavior are tested. No secret or story text appears in logs or evidence. | Negative contract/integration tests, semantic counterfactual evidence for critical guards, privacy preflight, evidence review. |
| Job/durability honesty | Any behavior called durable survives process loss and reload with owner-scoped persisted state. Otherwise the app and docs consistently say process-local or `non_durable_memory`, and durable jobs are explicitly deferred rather than half-claimed. | Process-loss/restart proof for a durability claim, or verified non-claim wording plus a linked optional follow-up. |
| Test quality | A current risk-to-test matrix covers critical acceptance behavior, invariants, failure paths, retries, persistence, restart, and external boundaries. Each important test names the plausible defect it should catch. Coverage diagnostics identify blind spots but no percentage substitutes for this proof. | Passing focused and aggregate commands, matrix in final report, diagnostic artifacts when useful, counterfactual results for high-risk tests. |
| Build, deployment, and route budget | Required builds and preflights pass; deployable route count stays within budget; required live smoke passes in the target environment or the related production claim remains blocked. | `npm run build`, `npm run test:all`, relevant preflights, route-count output, deployment/check results. |
| Review closure | The last-40-PR audit has zero untriaged current/outdated unresolved threads. Valid wider historical debt is linked and explicitly outside the completion window. Every new completion PR has its own late-thread audit. | GitHub audit artifact, thread replies/dispositions, issue links, `npm run review:unresolved` output. |
| Documentation and evidence | User-facing wording, setup/migration instructions, active plans, checklists, changelog, lessons, and final report match actual behavior and state what is not proved. | Reviewed docs diff and `PR70_RECOVERY_FINAL_REPORT.md` evidence index. |
| Final hostile review | A Completion Prosecutor tries to disprove every row above. The parent adjudicates every material finding and reruns affected checks before the completion claim. | Critique, parent dispositions, fixes/non-claims, final command receipts. |

`Done` means every required row is satisfied and the closing evidence is merged to `origin/main`. It never means local-only, PR-ready, in review, “tests mostly pass,” or “coverage looks high.”

## Optional Work After Done

These are valuable follow-ups, but they do not block the definition above unless the user explicitly promotes one into the supported MVP promise. `STORY_LAB_OPTIONAL_POST_DONE_ROADMAP.md` is the executable portfolio with program order, prerequisites, proof, and stop conditions; keep selection status in `STORY_LAB_FUTURE_WORK_CHECKLIST.md` or `STORY_LAB_IDEA_BOARD.md`.

- raise or tune coverage thresholds after stable baselines show that a threshold protects useful tests;
- broader-than-last-40 historical review-thread cleanup;
- Angular major-version upgrades and noncritical dependency modernization;
- audio generation, narration, speaker tooling, and voice evolution;
- new Proving Grounds reports, scoring views, or research dashboards;
- additional Story Lab visual polish, skins, animations, and accessibility enhancements beyond blocking defects;
- experimental story-quality systems, Weird Lab ideas, additional providers, or model comparisons;
- performance/cost optimization beyond the measured shipping budget;
- durable background Workflow/queue infrastructure if the shipped product intentionally keeps jobs process-local and says so clearly;
- extra export formats, collaboration/sharing, email, payments, CMS, analytics, and admin tooling.

Optional work must not weaken required tests, spend the final Vercel route slot casually, reintroduce deferred DigitalOcean/audio scope as active, or share a branch with completion-gate work. Promote an optional item to required only by updating this definition and the active checklist before implementation.

## Progress

- [x] Verified current local checkout is `main`.
- [x] Verified current local checkout is divergent: `origin/main...HEAD` is 94 behind and 5 ahead.
- [x] Verified local tracked changes are clean and local untracked files are present: `SPARK_TRIAL_TASKS.md`, `STORY_LAB_REVIEW_MISTAKES_2026-06-09.md`, `STORY_QUALITY_EVALS_PLAN.md`, and `tests/grok-smoke.test.ts`.
- [x] Verified local-only commits are the five docs/planning commits ending at `75b4099 Plan Story Lab auth profile cloud library`.
- [x] Verified local Vercel route count is `10/12`; `origin/main` route count is expected to be `11/12` after the account route.
- [x] Read local `.agent/PLANS.md`, `AGENTS.md`, and the ExecPlan standard.
- [x] Read the current remote `origin/main:STORY_LAB_COMPLETION_HARDENING_EXEC_PLAN.md`.
- [x] Dispatched four current-session subagents for independent audits: PR review-thread audit, coverage/test audit, git/local-work audit, and remaining-scope audit.
- [x] Incorporated returned PR-audit, coverage-audit, and product-scope audit findings into this plan.
- [x] Incorporated the git/local-work auditor result.
- [x] Recreated this plan on fresh branch `recovery/story-lab-final-merge-audit-plan` from `origin/main` at `0a56f96`.
- [x] Updated `AGENTS.md` to point future agents to this stricter final merge, coverage, and PR-review audit plan.
- [x] PR and merge this plan update through PR #171.
- [x] Merged review-audit follow-up PRs #174, #175, #176, #177, and #178 from fresh `origin/main` branches.
- [x] Verified the current checked-out review-follow-up commit is contained in `origin/main`; no tracked implementation work is stranded locally.
- [x] Refreshed live repo state on 2026-07-11: current checkout is clean `main`, ahead `0`, behind `0`, route count `11/12`, and no untracked files.
- [x] Refreshed live open-PR state on 2026-07-11: the only open PR is Dependabot #194, which is mergeable by GitHub but failing Recovery CI and Vercel.
- [ ] Complete the local-work reconciliation gate.
- [x] Drive the last-40-PR review-thread audit to zero active/outdated unresolved threads.
- [ ] Commit the final last-40-PR audit artifact or final report evidence.
- [ ] Complete the risk-based test-quality and coverage-diagnostics gate.
- [ ] Complete the remaining remote completion-hardening slices or close them with evidence.
- [ ] Produce the final completion report.

## Surprises & Discoveries

- The local checkout is stale. Local `STORY_LAB_AUTH_PROFILE_CLOUD_LIBRARY_EXEC_PLAN.md` says implementation has not landed, but `origin/main` shows auth/profile/cloud-library scaffolding, account routes, Angular cloud-library UI, and durable-job owner scaffolding already merged through later PRs.
- `origin/main` has `STORY_LAB_COMPLETION_HARDENING_EXEC_PLAN.md`; this local checkout does not. This plan must therefore be rebased or recreated from `origin/main` before PR.
- `origin/main` no longer has `OVERNIGHT_HANDOFF.md`; local `main` still does. Do not assume local docs should be reintroduced unchanged.
- The current root scripts on local `main` are stale. `origin/main:package.json` includes `recovery:status`, `recovery:preflight`, and `review:unresolved`.
- Current local tooling has Karma coverage dependencies, but root/API code lacks current instrumentation and a canonical risk-to-test map.
- The initial last-40-PR review-thread audit found real blockers: 40 PRs checked, 157 review threads total, and 35 unresolved threads. PRs #174 through #179 cleared that recovery-window backlog.
- `gh` can hang when `GH_PAGER` is set. The successful review-thread audit used `env -u GH_PAGER GH_NO_UPDATE_NOTIFIER=1 ...`.
- Angular already has `karma-coverage` with 85% global thresholds; the important unresolved question is whether critical UI behavior and failure states are actually exercised on a reliable runner.
- Root/API tests are self-running `tsx` scripts and are not currently run under a coverage tool. There is no root `c8`, `nyc`, Jest, Vitest, or equivalent coverage dependency in the stale local checkout.
- Some root specs are unwired or Jest-style while Jest is not installed. The test-quality gate must first define which tests are self-running, wire or convert the valuable ones, and retire or document misleading dead tests.
- The product-scope subagent was reading this stale local checkout, so its implementation roadmap is useful as risk inventory but is superseded where `origin/main` already merged auth/profile/cloud-library, account route, Angular UI, and durable-job owner scaffolding.
- The git/local-work auditor confirmed live `origin/main` is `0a56f96ad723d5a96508bfc4cc9b0cb74631297f`, local `HEAD` is `75b4099745557d2abc7ea3d38fa32a8119eef94c`, and the merge base is `4834914effd8bfd564ff15a9b487a05e63481d70`.
- The same audit confirmed a direct PR from local `main` would be unsafe because it would delete many files that already landed on `origin/main`.
- `backup/local-main-docs-stack-2026-06-13` points at the same commit as local `main`; treat it as preservation only.
- `feature/story-lab-auth-profile-contracts` points at `35a3d1b`, has remote backup `origin/backup/story-lab-auth-profile-contracts-2026-06-13`, and is 94 behind / 90 ahead of `origin/main`; do not PR it whole.
- Extra worktrees exist for `ai-review/story-lab-unsliced-reference-do-not-merge`, `recovery/story-lab-pr90-response-followups`, and `recovery/story-lab-memory-cards`. The two recovery worktrees are already merged into `origin/main`.
- This plan now lives on branch `recovery/story-lab-final-merge-audit-plan`, which started from `origin/main` at `0a56f96`; before the plan diff, `git rev-list --left-right --count origin/main...HEAD` returned `0 0`.
- On the plan branch, `scripts/recovery/check-vercel-function-count.sh` reports `11/12`.
- A late CodeRabbit pass can still add threads after a PR is merged. PR #178 was clean at merge time, then later received two active trivial maintainability comments. PR #179 fixed and resolved those late comments, and future completion claims still need a post-bot, post-merge audit window.
- As of 2026-07-03 12:54 EDT, the last-40 PR audit commands report `0` active unresolved, `0` outdated unresolved, and `0` include-outdated unresolved threads.
- As of 2026-07-03 12:54 EDT, a wider `--state all --limit 200` audit still finds older historical backlog outside the last-40 recovery window: 168 active unresolved threads across 35 PRs, 56 outdated unresolved threads across 14 PRs, and 224 combined unresolved threads across 45 PRs.
- As of 2026-07-03 12:54 EDT, the only open PRs were Dependabot PR #120 and PR #121. Both were old and had failing Recovery CI/Vercel checks.
- As of 2026-07-11 00:37 EDT, `gh pr list --state open --json number,title,url,headRefName,baseRefName` returned Dependabot #194 and this publication PR #195. After #195 lands, #194 is the remaining dependency queue; it is mergeable by GitHub and is failing Recovery CI plus Vercel.
- Mixed Angular-major dependency PRs are not quick merge candidates. Split root dependency work from Angular-major-upgrade work, and do not combine dependency resolution with coverage tooling.
- At the 2026-07-03 audit, the parent checkout still had four parked untracked artifacts that were intentionally local-only: `SPARK_TRIAL_TASKS.md`, `STORY_LAB_REVIEW_MISTAKES_2026-06-09.md`, `STORY_QUALITY_EVALS_PLAN.md`, and `tests/grok-smoke.test.ts`.
- 2026-07-11 refresh: current `main` and this scope-refresh branch have no tracked or untracked local artifacts, so the stale local-artifact queue should not be treated as current work.

## Decision Log

- Decision: Treat `origin/main` as authoritative for current product state.
  Rationale: The local checkout is 94 commits behind and predates merged completion-hardening work.
- Decision: Do not implement new product work on stale local `main`.
  Rationale: Any implementation on this branch would likely duplicate or conflict with landed remote work.
- Decision: Never open a PR from the current checked-out local `main`.
  Rationale: It is 94 commits behind and would delete current remote account/profile/cloud/job/test scaffolds.
- Decision: This file is an umbrella completion plan, not a replacement for `STORY_LAB_COMPLETION_HARDENING_EXEC_PLAN.md`.
  Rationale: The remote plan already tracks review backlog issues, Dependabot, auth/database, durable jobs, tooling, and story-quality follow-up. This plan adds the user's stricter local-merge, test-quality, last-40-PR audit, and disciplined subagent-deployment requirements.
- Decision: Define coverage over active first-party source only.
  Rationale: Docs, tests, generated build output, historical stale paths, `node_modules`, and old deployment artifacts would distort the metric.
- Decision: Coverage reports are current diagnostics, not a proxy for test quality or a completion claim.
  Rationale: The repo contains older percentage claims that do not prove critical behavior, failure paths, owner isolation, migrations, restarts, or live provider boundaries.
- Decision: Review-thread cleanup must be source-backed through GitHub API/CLI artifacts.
  Rationale: Chat summaries and memory are not enough for the last-40-PR audit.
- Decision: The last-40-PR review audit is no longer merely a future discovery task; it has a known backlog baseline.
  Rationale: The PR-audit subagent found 35 unresolved threads across the last 40 PRs, including 12 current unresolved threads on PRs #166 and #161.
- Decision: Root/API and Angular test evidence should remain separately inspectable because they use different runners and prove different risks.
  Rationale: A combined percentage would obscure whether server-side ownership/persistence logic and browser-visible state transitions are independently tested.
- Decision: Live Grok, database, auth, and browser smoke tests stay outside deterministic unit coverage but inside the proof matrix when the product claim depends on them.
  Rationale: Live smoke proves provider, deployment, migration, session, and durability behavior that offline instrumentation cannot prove.

## Outcomes & Retrospective

Current outcome:

- The stricter final plan is merged to `main`.
- The original last-40 review-comment cleanup drove PRs #174 through #178, and PR #179 handled the late PR #178 CodeRabbit nits. A fresh last-40 audit now reports zero active or outdated unresolved review threads.
- A wider 200-PR audit still shows older historical unresolved review-thread backlog outside the last-40 recovery gate.
- Subagents were deployed for the original four independent audit areas and the historical #120/#121 dependency investigation. As of the 2026-07-11 refresh, the active dependency queue after this publication PR lands is #194.
- The repo still lacks a current root/API coverage diagnostic and canonical risk-to-test map. The 2026-07-11 refresh found no tracked or untracked local artifacts in the current checkout.

Self-critique so far:

- The previous recovery succeeded in merging many slices, but the local checkout drift makes it easy for a future agent to re-plan from stale files and duplicate landed work.
- The older plans were strong on slice discipline but did not require a last-40-PR audit or explicit risk-to-test proof.
- Coverage has been discussed in docs, but the repo needs executable diagnostics plus tests selected for the defects they prevent.
- The final audit must treat `non_durable_memory` wording as a correctness requirement, not just documentation polish.
- The current plan-writing pass already surfaced a process flaw: stale local docs can make future agents replan already-merged work. The first real execution gate must be branch hygiene, not product implementation.
- Raising a threshold without improving the behavior and failure paths under test would be a false compliance move.

## Context and Orientation

Repository root:

```bash
cd "$(git rev-parse --show-toplevel)"
```

Run this from any path inside the checkout. Do not hard-code a user-specific home directory in reusable commands.

Current local evidence gathered on 2026-07-03:

```bash
git rev-parse --abbrev-ref HEAD
# main

git rev-list --left-right --count origin/main...HEAD
# 94  5

git -c advice.statusHints=false status --porcelain=v1 --untracked-files=all
# ?? SPARK_TRIAL_TASKS.md
# ?? STORY_LAB_REVIEW_MISTAKES_2026-06-09.md
# ?? STORY_QUALITY_EVALS_PLAN.md
# ?? tests/grok-smoke.test.ts

git log --oneline origin/main..main
# 75b4099 Plan Story Lab auth profile cloud library
# d85d5b8 Add Story Lab research mining notes
# 36a7ea3 Triage overnight source files
# d40a7e3 Reconcile Story Lab storage plan status
# 087456a Add Story Lab audit and overnight mode docs

scripts/recovery/check-vercel-function-count.sh
# Vercel function count check: 10/12
# Function count within limit.
```

Remote `origin/main` context that must be preserved:

- `STORY_LAB_COMPLETION_HARDENING_EXEC_PLAN.md` is the current remote completion plan.
- `STORY_LAB_UNPUBLISHED_BRANCH_SPLIT_PLAN.md` says the unpublished stack was split and merged through PR #151.
- `AGENTS.md` on `origin/main` points future agents to the completion-hardening plan.
- `package.json` on `origin/main` includes `recovery:status`, `recovery:preflight`, and `review:unresolved`.
- `STORY_LAB_AUTH_PROFILE_CLOUD_LIBRARY_EXEC_PLAN.md` on `origin/main` says auth/profile/cloud-library scaffolding, account route, Angular cloud-library UI, and durable-job owner scaffolding are merged, but live provider auth, signed-in flow, database provisioning, executed migrations, durable cloud sync proof, and process-loss durable jobs remain incomplete.

## Subagent Deployment Strategy

The user explicitly requested creative and liberal subagent deployment. Use subagents as audit and review multipliers, while keeping branch creation, PRs, merges, and final decisions in the parent session.

Already deployed in this run:

- `Huygens`: PR review-thread auditor for the last-40 / unresolved-thread audit.
- `Sagan`: historical coverage and test-tooling auditor.
- `Kant`: git/local-work auditor for local commits, untracked files, divergence, and PR sequence.
- `Einstein`: product-scope mapper for remaining auth/cloud/durable-job/story-quality/route-budget work.

Additional subagents deployed on 2026-07-03 after the Dependabot question:

- `Halley`: PR #120 Dependabot investigator.
- `Ohm`: PR #121 Dependabot investigator.

Returned findings incorporated so far:

- `Huygens`: last-40 PR audit baseline is 40 PRs, 157 review threads, 35 unresolved threads. Current unresolved blockers are PR #166 and PR #161. Outdated unresolved manual queue is PRs #156, #155, #154, #116, #114, #112, #109, #105, #104, and #103.
- `Sagan`: Angular coverage exists but root/API coverage does not. Add diagnostic instrumentation, convert or wire valuable self-running root tests, and keep live smoke as separate boundary proof rather than pretending coverage can replace it.
- `Einstein`: local-checkout roadmap is stale relative to `origin/main`, but the enduring risks are wildcard API CORS before credentialed account routes, route budget, process-local job state, unproven auth/database/Workflow provisioning, live-provider proof, and story-quality eval hardening.
- `Kant`: local `main` is unsafe to PR; future work must start from `origin/main`. Old local/backup/feature branches are preservation refs only. Local docs must be manually rewritten against current `origin/main`, not cherry-picked.

Future subagent roles and deployment points:

| Point | Subagent | Role | Output Required |
|---|---|---|---|
| Before local-work PR | Continuity Prosecutor | Compare local docs commits and untracked files against `origin/main` so stale docs are not reintroduced. | Keep/drop/rewrite table with file paths and reasons. |
| Before test implementation | Scope Prosecutor | Attack the parent-written strategy, proof units, file leases, test obligations, and stop conditions before workers start. | Findings plus parent dispositions and revised locked scope. |
| Before test-quality implementation | Risk-to-Test Cartographer | Map critical behaviors and plausible defects to existing tests; use coverage only to reveal blind spots. | Risk-to-test matrix, missing proof, and worker-ready scopes. |
| During test-tooling PR | Test Harness Mechanic | Add or review test commands and coverage diagnostics in disjoint files only. | Changed files, command evidence, defect each test is intended to catch. |
| During last-40 audit | PR Thread Clerk | Inspect PR review threads and prepare disposition rows. | PR table with unresolved threads, reply needed, issue needed, or resolved. |
| During last-40 audit | Obsolescence Judge | Re-check legacy comments against current `main` to prevent reviving dead DigitalOcean/audio paths. | Valid/obsolete/out-of-scope decisions. |
| Before live auth/cloud PR | Auth Boundary Adversary | Attack auth assumptions, token verification, owner isolation, and logging redaction. | Findings with exact file refs and required tests. |
| Before durable jobs PR | Process-Loss Saboteur | Design and review proof that job progress survives process death. | Process-loss test plan and failure modes. |
| Before UI PRs | User Confusion Simulator | Drive local/cloud/account UI states as a confused user. | Confusing states, misleading labels, screenshot paths if available. |
| Before final report | Receipts Agent | Collect final command outputs, PR links, test/coverage artifacts, deployment proof, and unresolved-thread counts. | Evidence index for `PR70_RECOVERY_FINAL_REPORT.md`. |
| Before merge-to-main claim | Final Hostile Reviewer | Try to disprove the completion claim requirement by requirement. | Blockers, weak evidence, and required fixes. |

Subagent safety rules:

- Explorers do not edit files.
- Parent discovery and scope prosecution happen before implementation workers; broad explorer fanout is not the default.
- Workers get disjoint file ownership.
- No worker merges PRs, rewrites history, deletes local work, or resolves GitHub review threads without parent approval.
- Parent agent integrates results and runs the final commands.

## Plan of Work

### Gate 0: Rebase The Plan Onto Current Remote Main

Purpose: avoid adding new plan debt to stale local `main`.

Hard stop:

- Do not push or open a PR from the current checked-out local `main`.
- Stop immediately if a proposed PR preview shows deletions of current `origin/main` files such as account/profile/cloud/job/test scaffolds.
- Stop immediately if a proposed PR includes the old 90-commit `feature/story-lab-auth-profile-contracts` branch wholesale or spans auth, cloud storage, UI, jobs, story quality, and CSS together.

Steps:

1. Fetch and verify remote:

```bash
git fetch origin --prune
git rev-list --left-right --count origin/main...HEAD
```

Expected local stale checkout result before cleanup: `94 5`.

2. Create a new branch from `origin/main`:

```bash
git switch -c recovery/story-lab-final-merge-audit-plan origin/main
```

3. Copy this plan into the branch and reconcile it with existing remote plans:

```bash
git status --short
git diff -- STORY_LAB_FINAL_MERGE_AUDIT_EXEC_PLAN.md AGENTS.md
```

4. Update `AGENTS.md` on the new branch to point to this plan as the stricter final umbrella only if the diff is small and does not remove existing completion-hardening guidance.

Acceptance:

- The plan branch is based on `origin/main`.
- The plan does not reintroduce stale local `OVERNIGHT_HANDOFF.md`.
- `AGENTS.md` still points to `STORY_LAB_COMPLETION_HARDENING_EXEC_PLAN.md`.
- The proposed PR does not delete current `origin/main` account/profile/cloud/job/test scaffolds.

Subagents:

- Dispatch Continuity Prosecutor after the branch is created to check the plan does not conflict with `origin/main` docs.

### Gate 1: Local-Work Reconciliation

Purpose: eliminate stranded local work without blindly replaying stale docs.

Inventory:

- Local commits:
  - `087456a Add Story Lab audit and overnight mode docs`
  - `d40a7e3 Reconcile Story Lab storage plan status`
  - `36a7ea3 Triage overnight source files`
  - `d85d5b8 Add Story Lab research mining notes`
  - `75b4099 Plan Story Lab auth profile cloud library`
- Untracked files:
  - `SPARK_TRIAL_TASKS.md`
  - `STORY_LAB_REVIEW_MISTAKES_2026-06-09.md`
  - `STORY_QUALITY_EVALS_PLAN.md`
  - `tests/grok-smoke.test.ts`

Captured untracked-file summaries from 2026-07-03, so a fresh `origin/main` checkout has enough evidence to classify their contents:

| File | Lines | Summary |
|---|---:|---|
| `SPARK_TRIAL_TASKS.md` | 183 | Codex Spark trial checklist and prompts for Vercel function-count checks, Proving Grounds CSS budget cleanup, gated Grok smoke skeleton, story-quality eval planning, and PR #87 handoff updates. |
| `STORY_LAB_REVIEW_MISTAKES_2026-06-09.md` | 87 | Static review findings for account project payload validation, durable job events, SQL schema splitting, auth-provider config timing, non-durable UI copy, job event transactionality, idempotency, stuck running jobs, continuation payload validation, state-store lifecycle, and malformed request logging. |
| `STORY_QUALITY_EVALS_PLAN.md` | 75 | Practical AI-assisted story-quality eval roadmap covering heuristic areas, advisory model-scored dimensions, first implementation path, risks, and cost controls. |
| `tests/grok-smoke.test.ts` | 48 | Gated real Grok smoke script that skips unless `RUN_REAL_GROK_SMOKE=1` and `XAI_API_KEY` are present, then asserts story generation success, content, `storyId`, and positive `actualWordCount`. |

Before deleting or moving any of these files, copy exact content into `PR70_RECOVERY_FINAL_REPORT.md`, land the file through a focused PR, or create a tracked evidence file. A name-only inventory is not enough to classify them later.

Captured stat evidence from 2026-07-03, so a future agent is not forced to rely on private local commit objects:

```text
087456a Add Story Lab audit and overnight mode docs
 AGENTS.md               |  72 ++++++++++++------
 OVERNIGHT_HANDOFF.md    |  96 ++++++++++++++++++++++++
 OVERNIGHT_MODE.md       | 187 ++++++++++++++++++++++++++++++++++++++++++++++
 STORY_LAB_APP_AUDIT.md  | 187 ++++++++++++++++++++++++++++++++++++++++++++++
 STORY_LAB_IDEA_BOARD.md | 194 ++++++++++++++++++++++++++++++++++++++++++++++++
 5 files changed, 713 insertions(+), 23 deletions(-)

d40a7e3 Reconcile Story Lab storage plan status
 OVERNIGHT_HANDOFF.md                | 49 +++++++++++++++++++++++++++++++++++++
 STORY_LAB_STORAGE_PORT_EXEC_PLAN.md | 36 +++++++++++++++++++++------
 2 files changed, 77 insertions(+), 8 deletions(-)

36a7ea3 Triage overnight source files
 OVERNIGHT_HANDOFF.md    | 51 ++++++++++++++++++++++++++++++++++++++++++++-----
 STORY_LAB_APP_AUDIT.md  |  7 +++----
 STORY_LAB_IDEA_BOARD.md | 51 +++++++++++++++++++++++++++++++++++++++++++++++++
 3 files changed, 100 insertions(+), 9 deletions(-)

d85d5b8 Add Story Lab research mining notes
 OVERNIGHT_HANDOFF.md    | 43 +++++++++++++++++++++++++++++++++++++++++++
 STORY_LAB_IDEA_BOARD.md | 47 +++++++++++++++++++++++++++++++++++++++++++++++
 2 files changed, 90 insertions(+)

75b4099 Plan Story Lab auth profile cloud library
 AGENTS.md                                         |   2 +
 OVERNIGHT_HANDOFF.md                              |  46 +++
 STORY_LAB_AUTH_PROFILE_CLOUD_LIBRARY_EXEC_PLAN.md | 323 ++++++++++++++++++++++
 STORY_LAB_IDEA_BOARD.md                           |   4 +
 4 files changed, 375 insertions(+)
```

Steps:

1. Preserve local-only commit evidence before any branch cleanup, if the local objects are available:

```bash
mkdir -p tmp/recovery
git format-patch --stdout 4834914effd8bfd564ff15a9b487a05e63481d70..75b4099745557d2abc7ea3d38fa32a8119eef94c > tmp/recovery/stranded-local-main.patch
git show --stat --oneline 087456a d40a7e3 36a7ea3 d85d5b8 75b4099 > tmp/recovery/stranded-local-main-stats.txt
```

If those objects are missing in a fresh clone, use the captured stat evidence above and the four parked untracked files as the minimum inventory. Do not require future agents to inspect private-only SHAs before they can classify the work.

2. Compare each available local-only commit against `origin/main`:

```bash
git show --stat 087456a
git show --stat d40a7e3
git show --stat 36a7ea3
git show --stat d85d5b8
git show --stat 75b4099
```

3. For each changed file, decide one disposition:

- `Already merged remotely`: no action.
- `Rewrite against current main`: create a small PR.
- `Park as historical note`: move only if the repo has an accepted historical docs location.
- `Discard local stale copy`: leave out of PR and record reason.

Specific local-doc rule:

- Do not land old `STORY_LAB_APP_AUDIT.md` or `OVERNIGHT_HANDOFF.md` as-is. `origin/main:STORY_LAB_UNPUBLISHED_BRANCH_SPLIT_PLAN.md` explicitly says they must be rewritten against landed `main` first.

4. Run this command on the plan branch after applying any retained local docs:

```bash
git diff --check
npm run recovery:status
```

5. Copy the final disposition summary into `PR70_RECOVERY_FINAL_REPORT.md`. The ignored scratch patch under `tmp/recovery` is allowed as local evidence, but the tracked final report must contain enough file-level disposition detail for review.

6. Open one local-work reconciliation PR only if retained docs are still useful.

Acceptance:

- No local-only commit remains unclassified.
- No untracked file remains unclassified.
- Stale local docs are not reintroduced as current product truth.
- Any retained local material is merged through a PR or documented as intentionally parked.

Subagents:

- Continuity Prosecutor classifies stale-vs-current docs.
- Deletion Advocate argues for what to drop rather than preserve.

### Gate 2: Last-40-PR Review-Comment Audit

Purpose: satisfy the user's explicit audit requirement and prevent unresolved comments from hiding behind merge status.

Known baseline from the first subagent audit:

- 40 PRs checked.
- 37 merged, 2 open, 1 closed unmerged.
- 157 review threads total.
- 35 unresolved threads remain.
- 12 current unresolved threads are on PR #166 and PR #161.
- 23 outdated unresolved threads need manual recheck/resolution on older PRs.

Current blocker queue:

| Queue | PRs | Required disposition |
|---|---|---|
| Current unresolved | #166, #161 | Fix or explicitly track every active unresolved route/error/no-go prompt/Grok fast-path comment before review backlog can be called clean. |
| Outdated unresolved manual queue | #156, #155, #154, #116, #114, #112, #109, #105, #104, #103 | Recheck against current `main`; resolve with fixing PR/commit link, obsolete reason, or linked issue. |
| Open dependency PRs | #194 after this publication PR lands | Triage as split/close-recreate before package-file or coverage workers touch `package.json` or lockfiles. |
| Closed unmerged PR | #117 | Record as closed Dependabot/no review-thread follow-up; no implementation action unless dependency state says otherwise. |

Steps:

1. Create the scratch artifact directory:

```bash
mkdir -p tmp/recovery
```

2. Generate the exact last-40 PR list by PR number, not by `gh pr list`'s default ordering. Do not use a contiguous numeric range: GitHub PR numbers share the issue number space, so some numbers are issues rather than PRs.

```bash
env -u GH_PAGER GH_NO_UPDATE_NOTIFIER=1 gh api 'repos/Phazzie/FairytaleswithSpice/pulls?state=all&sort=created&direction=desc&per_page=40' \
  > tmp/recovery/last-40-prs-raw.json
jq -r '.[].number' tmp/recovery/last-40-prs-raw.json > tmp/recovery/last-40-pr-numbers.txt
test "$(wc -l < tmp/recovery/last-40-pr-numbers.txt | tr -d ' ')" = "40"
pr_list=$(paste -sd, tmp/recovery/last-40-pr-numbers.txt)
jq '[.[] | {number, title, state, mergedAt: .merged_at, closedAt: .closed_at, updatedAt: .updated_at, url: .html_url}]' tmp/recovery/last-40-prs-raw.json > tmp/recovery/last-40-prs.json
```

3. Audit active non-outdated review threads for those PRs using the remote script:

```bash
env -u GH_PAGER GH_NO_UPDATE_NOTIFIER=1 npm run review:unresolved -- --repo Phazzie/FairytaleswithSpice --prs "$pr_list" --json > tmp/recovery/last-40-pr-review-threads.json
env -u GH_PAGER GH_NO_UPDATE_NOTIFIER=1 npm run review:unresolved -- --repo Phazzie/FairytaleswithSpice --prs "$pr_list" > tmp/recovery/last-40-pr-review-threads.md
```

4. Audit outdated-but-unresolved threads separately. The default `review:unresolved` mode intentionally reports only active non-outdated threads, so it must not be the only final proof. Use the dedicated outdated modes for the manual queue:

```bash
env -u GH_PAGER GH_NO_UPDATE_NOTIFIER=1 npm run review:unresolved -- --repo Phazzie/FairytaleswithSpice --prs "$pr_list" --include-outdated --json > tmp/recovery/last-40-pr-review-threads-with-outdated.json
env -u GH_PAGER GH_NO_UPDATE_NOTIFIER=1 npm run review:unresolved -- --repo Phazzie/FairytaleswithSpice --prs "$pr_list" --outdated-only --json > tmp/recovery/last-40-pr-review-threads-outdated.json
```

5. Create `tmp/recovery/last-40-pr-review-audit.md` with one row per PR:

```text
| PR | Title | State | Matching unresolved threads | Action | Evidence |
|---|---|---|---|---|---|
```

6. For every active unresolved or outdated-unresolved thread:

- inspect the current `origin/main` code;
- fix it in a focused PR if valid and in scope;
- open or link an issue if valid but larger than the slice;
- reply on the original thread with fixed/obsolete/out-of-scope evidence;
- resolve only after the reply exists.

7. Repeat the audit until the last-40 artifact shows no unhandled actionable comments.

8. Copy the final audit table and counts into `PR70_RECOVERY_FINAL_REPORT.md`. The `tmp/recovery` files are ignored scratch receipts; completion requires tracked evidence in the final report.

Acceptance:

- `tmp/recovery/last-40-pr-review-audit.md` exists locally and covers exactly 40 PRs.
- PR #166 and PR #161 have zero current unresolved review threads.
- The outdated unresolved queue has zero untriaged entries.
- All actionable comments in the last 40 PRs are fixed or linked to issues.
- Final proof shows `0 current unresolved` and `0 untriaged outdated unresolved`.
- `PR70_RECOVERY_FINAL_REPORT.md` embeds or links tracked audit evidence and summarizes counts.

Subagents:

- PR Thread Clerk prepares the first audit table.
- Obsolescence Judge checks stale comments against current `origin/main`.
- Receipts Agent verifies the final counts and links.

### Gate 3: Risk-Based Test Quality And Coverage Diagnostics

Purpose: prove the important behavior and failure modes, while using coverage reports to find blind spots rather than to manufacture a score.

Proof definition:

- Map critical behavior across active first-party TypeScript under `api/_lib`, deployable handlers, runtime-critical recovery scripts, and `story-generator/src/app` to the tests that exercise it.
- Prioritize auth and owner isolation, privacy/redaction, invalid input, database conflicts and migrations, retries, provider failure, persistence/restart behavior, signed-in save/list/load/delete, and process-loss recovery.
- Require live database, auth, browser, deployed, or provider proof when a deterministic fake cannot establish the product claim.
- Keep coverage output for root/API and Angular separately inspectable. Exclude tests, dependencies, generated output, historical/deprecated paths, and temporary files, and document why each exclusion is defensible.
- Do not add trivial assertions, implementation-mirroring tests, broad snapshots, or over-mocked tests merely to raise a percentage.

Current baseline from the audit:

- Root tests are custom self-running `tsx` scripts. `npm test` maps to `npm run test:all`, and some valuable or stale test files may not be wired into it.
- The first worker wave added `test:story-lab-privacy-contracts` and wired it into `test:all`; root/API tests still lack instrumentation that could expose unexecuted branches.
- Angular has `karma-coverage`, outputs HTML/text-summary/LCOV/Clover, and has a current global threshold of 85%. The first worker wave added an explicit Angular `test:coverage` script and a no-sandbox Karma launcher.
- Local Angular browser coverage is not reliable in certain local development environments because ChromeHeadless/headless browser startup times out before Karma captures the browser.
- Recovery CI runs preflight and root tests, but not coverage diagnostics.
- Historical README/test-doc percentages are stale and do not prove current behavior.

Steps:

1. Parent-led discovery creates a risk-to-test matrix. Each critical row names the claim, plausible defect, current test, test level, whether it uses a fake, required real-boundary proof, and remaining gap.

2. Send the proposed matrix and worker split to a read-only Scope Prosecutor. Record parent dispositions, revise, and mark the strategy `Scope locked` before worker dispatch.

3. Wire valuable existing root/API tests and explicitly retire or document stale/unrunnable files. The root command must either run every in-scope deterministic test or list exclusions with reasons.

4. Add root/API coverage diagnostics in a focused PR if they help expose blind spots. Prefer `c8` for `tsx` tests unless a repo constraint makes another tool cleaner. Do not introduce a new threshold until the report is stable and the threshold protects an already-valuable suite rather than driving test selection.

5. Run Angular specs and coverage on CI or a supported browser runner. Treat the existing threshold as a regression alarm, not evidence that the most important UI states are covered.

6. For high-risk owner, privacy, failure, or durability checks, run a temporary semantic counterfactual when practical: weaken the guard or invert the result and confirm the intended test fails. Revert immediately and record the result without committing the mutation.

7. Add live proof for claims that mocks cannot establish. Credential absence may defer the live step, but then the product wording and final report must retain the corresponding non-claim.

Acceptance:

- The final report contains a current risk-to-test matrix for critical Story Lab behavior.
- Each high-risk row has meaningful automated proof or an explicit blocker/non-claim; no row is considered satisfied by a percentage alone.
- Root/API deterministic tests are wired into a repeatable command, with exclusions documented.
- Angular evidence comes from a runner that actually captures and completes the browser suite.
- Coverage artifacts, when produced, are linked as diagnostics with defensible exclusions.
- High-risk auth/ownership/privacy/durability tests include semantic counterfactual evidence where practical.
- Signed-in cloud and durable-job claims include real-boundary and restart/process-loss proof respectively, or remain explicitly unproven.

Subagents:

- Scope Prosecutor attacks the parent-written matrix, proof units, file leases, and acceptance criteria before work begins.
- Risk-to-Test Cartographer reviews the locked matrix for critical blind spots without changing files.
- Test Harness Mechanic implements the bounded deterministic test/diagnostic changes.
- Completion Prosecutor tries to reintroduce plausible defects conceptually and challenges whether the tests would catch them.
- UI Spec Auditor reviews Angular behavior coverage and browser-run reliability.

### Gate 4: Remote Completion-Hardening Slices

Purpose: finish what the current remote plan already names.

Work from `origin/main:STORY_LAB_COMPLETION_HARDENING_EXEC_PLAN.md`.

Required slices:

1. Story Lab recovery review-comment triage for issue #152.
2. Legacy review-comment triage for issue #153.
3. Dependabot and preview triage for the current queue, now PR #194 as of 2026-07-11. Treat #194 as a split/close-recreate candidate because it mixes root lockfile and Angular 22 changes while Recovery CI and Vercel fail.
4. Auth and database live integration.
5. Durable job correctness.
6. Migration and index safety.
7. Preflight and tooling reliability.
8. Story quality heuristic refactor for issue #138.
9. Final completion audit.

Acceptance:

- Every slice is merged or intentionally closed with evidence.
- Live auth/cloud sync is claimed only after signed-in browser save/list/load/delete works against durable storage.
- Durable jobs are claimed only after process-loss recovery proof exists.
- Function count remains within the Vercel limit.

Subagents:

- Auth Boundary Adversary before auth/cloud PR.
- Process-Loss Saboteur before durable-job PR.
- Migration Skeptic before schema/index PR.
- Story Quality Reviewer before heuristic PR.

### Gate 5: Final Report And Merge Closure

Purpose: produce the evidence bundle that allows the parent goal to be marked complete.

Steps:

1. Update `PR70_RECOVERY_FINAL_REPORT.md` with:

- local-work disposition;
- PR links for every slice;
- last-40-PR review audit counts;
- risk-to-test matrix plus test and coverage-diagnostic command summaries, copied from ignored generated reports into the tracked final report when applicable;
- dependency/security audit state;
- Vercel function count;
- live signed-in auth/cloud save/list/load/update/delete and cross-owner denial proof;
- durable-job proof or explicit `non_durable_memory` non-claim;
- subagent findings and which ones changed the plan;
- hostile self-review.

2. Run final local checks:

```bash
git status --short --branch
npm run recovery:status
npm run review:unresolved -- --repo Phazzie/FairytaleswithSpice --state all --limit 40
npm run test:all
npm run build
scripts/recovery/check-vercel-function-count.sh
# Run configured root/API and Angular coverage diagnostics separately when available.
```

3. Run required slice preflights:

```bash
npm run recovery:preflight -- cloud-library-ui
npm run recovery:preflight -- durable-job-owner
npm run recovery:preflight -- story-quality-guidance
npm run recovery:preflight -- story-memory-cards
npm run recovery:preflight -- css-lazy-loading --quick
```

4. Run live checks only when credentials and deployment are configured:

```bash
DATABASE_URL=... npx tsx scripts/recovery/story-lab-cloud-db-smoke.ts
STORY_LAB_SMOKE_URL=https://fairytaleswith-spice.vercel.app STORY_LAB_SMOKE_LIVE=1 npm run smoke:story-lab-ui
```

Acceptance:

- Hard local gates must pass: the deterministic commands named by the risk-to-test matrix, `npm run test:all`, `npm run build`, `scripts/recovery/check-vercel-function-count.sh`, `npm run recovery:status`, required slice preflights, and the final review-thread audit. Configured coverage diagnostics must complete on their supported runners but no arbitrary percentage substitutes for missing behavioral proof.
- Missing credentials or external access may defer a live command, but live auth/cloud persistence is a required completion gate and remains a blocker until proved. Only checks for explicitly optional or non-claimed behavior may be skipped with a documented nonblocking reason.
- The final report can answer what is done, what remains, what was intentionally not done, and why the done claim is honest.
- The working branch is merged into `main`.
- `origin/main` contains the final report with risk-to-test, diagnostic, live-boundary, and review-audit evidence.

Subagents:

- Receipts Agent collects command output and PR links.
- Final Hostile Reviewer tries to disprove completion before the parent agent claims success.

## Concrete Steps

Use this execution order:

1. Wait for the four already-running audit subagents and append any material findings to `Surprises & Discoveries`.
2. Recreate this plan on a branch from `origin/main`.
3. Open and merge the plan PR.
4. Run Gate 1 local-work reconciliation.
5. Run Gate 2 last-40-PR review audit.
6. Run Gate 3 test-quality PRs until the risk-to-test matrix, deterministic suites, coverage diagnostics, counterfactual checks, and required live-boundary proof satisfy the gate.
7. Run Gate 4 remote completion-hardening slices in the order listed.
8. Run Gate 5 final report and merge closure.
9. Only then evaluate whether the user objective is complete.

## Validation and Acceptance

Completion requires current evidence for every item below:

- `git status --short --branch` is clean on the final branch before merge.
- `origin/main` contains all retained local work.
- Last-40-PR audit artifact covers exactly 40 PRs.
- All actionable review comments found in the last-40 audit are addressed or linked to issues.
- Required deterministic test commands pass; coverage diagnostics are current where configured and reveal no unexplained critical blind spot.
- `npm run test:all` passes.
- `npm run build` passes.
- `scripts/recovery/check-vercel-function-count.sh` passes.
- `npm run recovery:status` passes.
- `PR70_RECOVERY_FINAL_REPORT.md` contains final evidence and self-critique.
- Auth/cloud and durable-job claims match proof. If proof is missing, wording remains scaffolded or `non_durable_memory`.

## Periodic Self-Critique And Testing Audits

Run these audits on a cadence, not just at the end:

- After every PR is opened: run `git diff --check`, focused tests, route count if routes changed, and a self-review against the PR scope.
- After every PR is merged: run `npm run review:unresolved -- --prs <pr-number>` to catch late comments.
- After every three PRs: run a mini completion audit against this plan's `Progress` section and update it.
- After any auth/storage/job change: run redaction/logging tests and owner-isolation tests.
- After any UI state change: run or document Angular spec, browser smoke, and local/cloud/non-durable wording checks.
- After any test-tooling change: run the affected suite and confirm a temporary plausible defect or semantic counterfactual makes the intended high-risk test fail when practical.
- Before final report: dispatch Final Hostile Reviewer and fix or document every finding.

Self-critique prompts:

- Are we accidentally using stale local docs instead of `origin/main`?
- Did we call scaffolded behavior "done" or "durable"?
- Did any PR contain more than one review boundary?
- Did we reply to original review threads, or only fix code silently?
- Did we prove important behavior and failure paths, or merely produce reassuring coverage numbers?
- Did we leave any untracked or local-only file unclassified?

## Idempotence and Recovery

- This plan can be restarted from `origin/main`.
- If the current checkout remains stale, create a fresh branch or worktree from `origin/main` before edits.
- Review audits are idempotent: rerun `npm run review:unresolved` and work only remaining active threads.
- Test diagnostics are idempotent: rerun the configured root/API and Angular commands and inspect current reports without changing thresholds to manufacture a pass.
- Cloud schema scripts must refuse missing `DATABASE_URL` and be safe to rerun.
- Do not delete backup branches, stale worktrees, or parked untracked files until `PR70_RECOVERY_FINAL_REPORT.md` records their disposition.

## Artifacts and Notes

Expected tracked artifacts:

- `STORY_LAB_FINAL_MERGE_AUDIT_EXEC_PLAN.md`
- `PR70_RECOVERY_FINAL_REPORT.md`

Expected scratch artifacts, copied or summarized into the tracked final report before completion:

- `tmp/recovery/last-40-prs.json`
- `tmp/recovery/last-40-pr-review-threads.json`
- `tmp/recovery/last-40-pr-review-threads.md`
- `tmp/recovery/last-40-pr-review-threads-with-outdated.json`
- `tmp/recovery/last-40-pr-review-threads-outdated.json`
- `tmp/recovery/last-40-pr-review-audit.md`
- `tmp/recovery/stranded-local-main.patch`
- `tmp/recovery/stranded-local-main-stats.txt`
- coverage reports under root/API and `story-generator/coverage`

Issues and PRs to verify from `origin/main`:

- #152 review backlog for current Story Lab recovery PRs.
- #153 review backlog for legacy/superseded PRs.
- #132 historical Dependabot #120/#121 triage; current dependency PR to verify is #194.
- #138 story-quality heuristic follow-up.
- #125, #126, #127, #130, #131, #135 durable job, migration, and tooling follow-ups.

## Interfaces and Dependencies

Relevant current remote files:

- `AGENTS.md`
- `STORY_LAB_COMPLETION_HARDENING_EXEC_PLAN.md`
- `STORY_LAB_AUTH_PROFILE_CLOUD_LIBRARY_EXEC_PLAN.md`
- `STORY_LAB_UNPUBLISHED_BRANCH_SPLIT_PLAN.md`
- `PR70_RECOVERY_FINAL_REPORT.md`
- `scripts/recovery/list-unresolved-review-threads.mjs`
- `scripts/recovery/slice-status.sh`
- `scripts/recovery/slice-preflight.sh`
- `package.json`
- `story-generator/angular.json`
- `story-generator/package.json`

External tools:

- `gh` authenticated for GitHub review-thread audits.
- Node 20 for Angular build/typecheck reliability.
- Chrome/ChromeHeadless or CI browser environment for Angular/browser coverage.
- Vercel deployment access for live smoke proof.
- `DATABASE_URL` only for the live database readiness and migration gates.
- Auth provider secrets only for the live signed-in cloud-library gate.
