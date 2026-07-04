# Story Lab Future Work Checklist

Created: 2026-07-04 14:33 EDT
Last updated: 2026-07-04 14:33 EDT

This checklist breaks the unfinished Story Lab work into small tickets that a Codex subagent can execute or audit. It is not a promise that all tickets should run at once. The parent agent must choose the next workstream, keep write scopes disjoint, verify results, open/merge PRs, and keep docs current.

## Current Snapshot

- [x] **Repo hygiene:** `main` is current with `origin/main`.
- [x] **Open PRs:** zero open PRs after PR #186 merged.
- [x] **Old dependency investigation:** archived at `origin/archive/angular22-dependency-investigation-2026-07-04`; it is evidence only, not an active workstream or PR.
- [x] **Whole-concept status:** `STORY_LAB_CONCEPT_CHECKLIST.md` is merged.
- [x] **Public Story Lab loop:** create, continue, local save, copy, download, and progress UI exist.
- [ ] **Production durability:** signed-in cloud save/load/list/delete is not proven live.
- [ ] **Coverage proof:** root/API coverage tooling and repo-wide coverage evidence do not exist.
- [ ] **Durable jobs:** job state is still explicitly `non_durable_memory`.
- [ ] **Final completion report:** not ready until durability, coverage, and final audits are proven.

## How To Use This Checklist

Each ticket is intentionally narrow:

- **Role:** `Explorer` means read-only evidence gathering. `Worker` means code/docs changes are allowed inside the owned files.
- **Owned files:** Files the subagent may change. If this says `Read-only`, the parent must integrate any edits.
- **Stop condition:** When the subagent must stop instead of widening scope.
- **Output:** The durable artifact the parent can review.
- **Validation:** Commands the parent or worker must run before claiming completion.

Do not dispatch two workers that write the same file. Do not dispatch implementation until the parent has selected the workstream and resolved ordering.

## Workstream 0: Admin And Source-Of-Truth Cleanup

- [x] **0.1 Archive the old Angular dependency investigation**
  - Role: Parent-owned admin.
  - Outcome: pushed `origin/archive/angular22-dependency-investigation-2026-07-04`.
  - Non-claim: this archive is not a PR, not active work, and not a merge target.
  - Validation: archive branch exists on origin; temp worktree removed.

- [ ] **0.2 Stale worktree audit**
  - Role: Explorer.
  - Owned files: Read-only.
  - Read-only files/commands: `git worktree list`, `git status --short --branch` in each worktree.
  - Goal: classify each remaining non-main worktree as `active`, `archive`, `safe to remove`, or `needs user decision`.
  - Stop condition: do not delete or modify any worktree.
  - Output: table with path, branch, clean/dirty state, upstream state, recommendation.
  - Validation: parent reruns `git worktree list`.

- [ ] **0.3 Active-doc source map audit**
  - Role: Explorer.
  - Owned files: Read-only.
  - Read-only files: `AGENTS.md`, `STORY_LAB_CONCEPT_CHECKLIST.md`, `STORY_LAB_FUTURE_WORK_CHECKLIST.md`, `STORY_LAB_COMPLETION_HARDENING_EXEC_PLAN.md`, `STORY_LAB_FINAL_MERGE_AUDIT_EXEC_PLAN.md`.
  - Goal: find places where active docs point at historical docs as if they are current.
  - Stop condition: do not rewrite broad historical docs.
  - Output: checklist of exact stale lines and proposed replacement wording.
  - Validation: `rg -n "PR70_RECOVERY_PLAN|plan.md|OVERNIGHT_HANDOFF|Done means" AGENTS.md STORY_LAB_*.md`.

## Workstream 1: Test Map And Coverage Proof

- [ ] **1.1 Canonical test map inventory**
  - Role: Explorer.
  - Owned files: Read-only.
  - Read-only files: `package.json`, `tests/`, `story-generator/package.json`, `story-generator/src/app/*.spec.ts`.
  - Goal: list every runnable test file and whether it is included in `npm run test:all`, Angular test scripts, CI, smoke scripts, or nowhere.
  - Stop condition: do not modify package scripts.
  - Output: `TEST_COMMAND_COVERAGE_MAP.md` draft or table for parent integration.
  - Validation: `node -e "console.log(require('./package.json').scripts['test:all'])"` and `find tests -maxdepth 1 -type f | sort`.

- [ ] **1.2 Wire omitted privacy/security/job-contract tests into a focused command**
  - Role: Worker.
  - Owned files: `package.json`, possibly `tests/run-all.mjs` if the repo already uses it for command grouping.
  - Tests to include: `tests/cors-policy.test.ts`, `tests/export-sanitizer.test.ts`, `tests/log-redaction.test.ts`, `tests/story-lab-stream-parse.test.ts`, `tests/story-service-streaming-security.test.ts`, `tests/story-lab-job-contracts.test.ts`.
  - Goal: add a repeatable script such as `test:story-lab-privacy-contracts` and decide whether it belongs in `test:all`.
  - Stop condition: if any listed test is not self-running under `tsx`, report the exact failure and stop.
  - Output: package-script diff plus command evidence.
  - Validation: `npm run test:story-lab-privacy-contracts`; if added to the full gate, `npm run test:all`.

- [ ] **1.3 Root/API coverage tool decision**
  - Role: Explorer.
  - Owned files: Read-only.
  - Read-only files: `package.json`, `package-lock.json`, `tests/`, `api/`, `shared/`.
  - Goal: recommend `c8`, `nyc`, or another coverage tool for root `tsx` tests, with exclusions and first-pass thresholds.
  - Stop condition: do not install packages.
  - Output: short decision record with command proposal and risk notes.
  - Validation: parent reviews against `STORY_LAB_FINAL_MERGE_AUDIT_EXEC_PLAN.md`.

- [ ] **1.4 Add root/API coverage command**
  - Role: Worker.
  - Owned files: `package.json`, `package-lock.json`, coverage config file if needed.
  - Goal: add a root/API coverage command that runs the Story Lab API/storage/auth/job/security tests under coverage.
  - Stop condition: if dependency install changes Angular package files or unrelated lockfiles, stop.
  - Output: package diff, coverage output location, and first measured baseline.
  - Validation: `npm run test:coverage:root` or the final script name chosen in 1.3.

- [ ] **1.5 Make Angular coverage invocation explicit**
  - Role: Worker.
  - Owned files: `story-generator/package.json`, `story-generator/karma.conf.js` only.
  - Goal: add an explicit Angular coverage script without raising thresholds yet.
  - Stop condition: do not change Angular versions or unrelated config.
  - Output: script name, threshold behavior, artifact path.
  - Validation: `cd story-generator && npm run test:coverage -- --watch=false --browsers=ChromeHeadless` or final script equivalent.

- [ ] **1.6 Coverage threshold policy**
  - Role: Explorer.
  - Owned files: Read-only.
  - Goal: after 1.4 and 1.5 generate real baselines, recommend whether the next gate should be 80%, 85%, 90%, or separate thresholds by surface.
  - Stop condition: do not change thresholds.
  - Output: table of measured baselines and recommended gate.
  - Validation: cite current coverage artifacts, not historical claims.

## Workstream 2: Live Auth, Account, And Cloud Library

- [ ] **2.1 Auth provider environment audit**
  - Role: Explorer.
  - Owned files: Read-only.
  - Read-only files: `api/_lib/story-lab/auth/*`, Vercel/env docs, `STORY_LAB_AUTH_PROFILE_CLOUD_LIBRARY_EXEC_PLAN.md`.
  - Goal: identify required provider variables, local-test variables, and production variables for real signed-in proof.
  - Stop condition: do not print secrets; do not modify env files.
  - Output: env checklist with missing/present/unknown status.
  - Validation: parent verifies with safe env-name-only commands.

- [ ] **2.2 Account route live-readiness smoke**
  - Role: Worker.
  - Owned files: `scripts/recovery/*account*smoke*.mjs` if creating a new smoke, plus package script.
  - Goal: create a smoke command that can verify auth-required account routes without exposing secrets.
  - Stop condition: if real credentials are unavailable, command must skip cleanly and say which env names are missing.
  - Output: smoke script and npm command.
  - Validation: run once without credentials and confirm clean skip; run with credentials only when available.

- [ ] **2.3 Database provisioning and migration runbook**
  - Role: Worker.
  - Owned files: `STORY_LAB_AUTH_PROFILE_CLOUD_LIBRARY_EXEC_PLAN.md`, `STORY_LAB_STORAGE_PORT_EXEC_PLAN.md`, optional `docs`/runbook file if one exists.
  - Goal: document the exact database provisioning, migration, readiness, and rollback steps.
  - Stop condition: do not claim migration was executed unless command output proves it.
  - Output: runbook with commands and expected success/failure states.
  - Validation: `git diff --check`; command examples reviewed for secret redaction.

- [ ] **2.4 Signed-in browser proof plan**
  - Role: Explorer.
  - Owned files: Read-only.
  - Read-only files: `story-generator/src/app/app.ts`, `story-generator/src/app/app.html`, `story-generator/src/app/story.service.ts`, account route tests.
  - Goal: define the exact browser path to prove sign in, save, refresh, load, list, delete, sign out.
  - Stop condition: do not run credentialed browser flows.
  - Output: step-by-step smoke plan with selectors/test ids needed.
  - Validation: parent chooses Playwright/browser route after credentials exist.

- [ ] **2.5 Live cloud library proof**
  - Role: Worker, only after 2.1-2.4 are ready.
  - Owned files: smoke test files and docs evidence files only unless implementation gaps are found.
  - Goal: run and record signed-in durable save/load/list/delete proof against a provisioned database.
  - Stop condition: if implementation fails, record exact failure and open a narrower implementation ticket.
  - Output: evidence artifact and updated status docs.
  - Validation: signed-in smoke output, database readiness output, `npm run recovery:finish -- --strict`.

## Workstream 3: Durable Jobs

- [ ] **3.1 Current job durability boundary audit**
  - Role: Explorer.
  - Owned files: Read-only.
  - Read-only files: `api/_lib/story-lab/jobs/*`, `api/story-lab/jobs.ts`, `tests/story-lab-job-*.test.ts`, `STORY_LAB_JOB_ROUTES_EXEC_PLAN.md`.
  - Goal: map exactly where `non_durable_memory` is returned and what would need to change for durable mode.
  - Stop condition: do not modify job code.
  - Output: file/function checklist with proposed implementation order.
  - Validation: `rg -n "non_durable_memory|postgres|durable" api tests STORY_LAB_JOB_ROUTES_EXEC_PLAN.md`.

- [ ] **3.2 Durable job schema plan**
  - Role: Worker.
  - Owned files: job schema/migration docs only unless a migration file already exists for jobs.
  - Goal: define tables/columns/indexes for job snapshots, event history, owner id, status, timestamps, and idempotency.
  - Stop condition: do not apply migrations to a live database.
  - Output: schema draft and transaction notes.
  - Validation: schema reviewed against owner isolation and process-loss requirements.

- [ ] **3.3 Postgres job store implementation**
  - Role: Worker.
  - Owned files: `api/_lib/story-lab/jobs/postgres*`, `api/_lib/story-lab/jobs/*Store*`, focused tests.
  - Goal: implement durable create/read/update/event persistence behind existing job store interfaces.
  - Stop condition: do not change UI or route files in the same ticket.
  - Output: store implementation and tests.
  - Validation: `npm run test:story-lab-job-store-port`, `npm run test:story-lab-job-store-config`, and focused new job-store test.

- [ ] **3.4 Route durable-mode wiring**
  - Role: Worker.
  - Owned files: `api/_lib/story-lab/jobs/jobRouteHandlers.ts`, `api/story-lab/jobs.ts`, route tests.
  - Goal: make durable mode use the Postgres job store with owner enforcement and safe failures.
  - Stop condition: do not change Angular UI in this ticket.
  - Output: route diff and route-test evidence.
  - Validation: `npm run test:story-lab-job-routes`.

- [ ] **3.5 Process-loss proof**
  - Role: Worker.
  - Owned files: new recovery/job smoke script plus package script.
  - Goal: prove a job snapshot/event can be recovered after process-local state is cleared.
  - Stop condition: if true process restart is too heavy locally, simulate process loss by clearing in-memory store and re-reading durable store.
  - Output: repeatable smoke/test command.
  - Validation: new process-loss command and `npm run recovery:finish -- --strict`.

## Workstream 4: Streaming Privacy

- [ ] **4.1 Query-string payload inventory**
  - Role: Explorer.
  - Owned files: Read-only.
  - Read-only files: `api/story-lab/stream/genesis.ts`, `api/story/stream.ts`, `story-generator/src/app/story.service.ts`, streaming tests.
  - Goal: identify every path where story text or blueprint fields can appear in a URL.
  - Stop condition: do not change routes.
  - Output: table of route, field, risk, replacement path.
  - Validation: `rg -n "query|URLSearchParams|EventSource|stream" api story-generator/src/app tests`.

- [ ] **4.2 POST-to-job streaming replacement design**
  - Role: Explorer.
  - Owned files: Read-only.
  - Goal: propose how private payloads move to POST body/job state while EventSource uses opaque job ids only.
  - Stop condition: do not implement.
  - Output: contract sketch and migration sequence.
  - Validation: parent checks against route budget and existing job routes.

- [ ] **4.3 Backend streaming privacy patch**
  - Role: Worker.
  - Owned files: `api/story-lab/stream/genesis.ts`, `api/story/stream.ts`, relevant parser/tests.
  - Goal: reject or deprecate private query payloads after replacement path exists.
  - Stop condition: do not break existing UI until UI migration ticket is ready.
  - Output: route behavior change and tests.
  - Validation: `npm run test:story-lab-stream-parse`, `npm run test:story-service-streaming-security`.

- [ ] **4.4 UI streaming client migration**
  - Role: Worker.
  - Owned files: `story-generator/src/app/story.service.ts`, focused Angular service specs.
  - Goal: ensure UI streaming/event subscriptions use opaque job/event paths, not payload URLs.
  - Stop condition: no visual UI changes.
  - Output: service diff and spec evidence.
  - Validation: Angular service spec command selected by parent.

## Workstream 5: UI Polish And Product Clarity

- [ ] **5.1 Empty-state action audit**
  - Role: Explorer.
  - Owned files: Read-only.
  - Read-only files: `story-generator/src/app/app.html`, `story-generator/src/app/app.ts`, `story-generator/src/app/app.spec.ts`.
  - Goal: list buttons/actions that are handler-guarded but not visibly disabled or explained.
  - Stop condition: do not edit UI.
  - Output: table with selector, current behavior, recommended disabled/tooltip/copy state.
  - Validation: parent reviews against screenshot or DOM evidence.

- [ ] **5.2 Disable/label invalid actions**
  - Role: Worker.
  - Owned files: `story-generator/src/app/app.html`, `story-generator/src/app/app.ts`, `story-generator/src/app/app.spec.ts`, minimal CSS only if needed.
  - Goal: make no-story/no-selection actions visibly unavailable or clearly explained.
  - Stop condition: do not redesign layout.
  - Output: UI diff and focused specs.
  - Validation: Angular app spec command selected by parent; `git diff --check`.

- [ ] **5.3 Proving Grounds visibility decision**
  - Role: Explorer.
  - Owned files: Read-only.
  - Read-only files: `story-generator/src/app/app.routes.ts`, `story-generator/src/app/app.html`, `story-generator/src/app/proving-grounds/*`, docs mentioning Proving Grounds.
  - Goal: decide whether Proving Grounds is debug-only, admin-only, internal-only, or user-facing.
  - Stop condition: do not change route access.
  - Output: one recommendation with exact docs/UI changes needed.
  - Validation: parent decides product stance before implementation.

- [ ] **5.4 Responsive/accessibility pass**
  - Role: Worker.
  - Owned files: `story-generator/src/app/app.css`, `story-generator/src/app/app-reader-library.css`, focused specs if needed.
  - Goal: reduce fixed-height/dense-panel problems on short mobile viewports and verify keyboard/focus states.
  - Stop condition: do not restyle the whole app.
  - Output: CSS diff and before/after screenshots or notes.
  - Validation: Playwright/browser screenshot pass on mobile and desktop; Angular build if CSS budgets are touched.

## Workstream 6: Story Quality And Product Confidence

- [ ] **6.1 Story-quality test inventory**
  - Role: Explorer.
  - Owned files: Read-only.
  - Read-only files: `tests/story-quality-evals.test.ts`, `GROK_MULTIAGENT_STORY_LAB_POLISH_EXEC_PLAN.md`, `STORY_LAB_REAL_ENGINE_EXEC_PLAN.md`, prompt/service files.
  - Goal: list current story-quality checks and identify what they actually protect.
  - Stop condition: do not change prompts.
  - Output: table of quality risk, existing guard, missing guard.
  - Validation: `npm run test:story-quality`.

- [ ] **6.2 Continuity heuristic honesty pass**
  - Role: Worker.
  - Owned files: docs first; code only if parent selects implementation.
  - Goal: ensure UI/docs do not imply durable AI memory when continuity is heuristic/local.
  - Stop condition: no prompt rewrites in this ticket.
  - Output: wording diffs or issue list.
  - Validation: `rg -n "memory|durable|continuity|cloud" STORY_LAB_*.md story-generator/src/app`.

- [ ] **6.3 Live-provider story smoke evidence**
  - Role: Worker, credentials required.
  - Owned files: evidence docs and smoke scripts only unless smoke failure reveals a bug.
  - Goal: run live provider smoke and record model/provider telemetry without overclaiming quality.
  - Stop condition: if credentials are missing, skip cleanly and record missing env names only.
  - Output: smoke evidence artifact.
  - Validation: `npm run smoke:story-lab-live-provider` with required env.

## Workstream 7: Final Audit And Completion Report

- [ ] **7.1 Fresh open-PR and review-thread audit**
  - Role: Explorer.
  - Owned files: Read-only.
  - Goal: produce final counts for open PRs, last-40 unresolved threads, and wider historical backlog.
  - Stop condition: do not resolve threads.
  - Output: counts, commands, and links.
  - Validation: `gh pr list --state open --json number,title,url`; `npm run review:unresolved -- --state all --limit 40`; wider audit command selected by parent.

- [ ] **7.2 Final evidence index**
  - Role: Worker.
  - Owned files: `PR70_RECOVERY_FINAL_REPORT.md`, possibly `STORY_LAB_FINAL_MERGE_AUDIT_EXEC_PLAN.md`.
  - Goal: collect merged PRs, command outputs, coverage artifacts, smoke evidence, and explicit non-claims.
  - Stop condition: do not mark complete if coverage/durability proof is still missing.
  - Output: final report update with evidence links.
  - Validation: `git diff --check`, `npm run recovery:finish -- --strict`.

- [ ] **7.3 Completion hostile review**
  - Role: Explorer.
  - Owned files: Read-only.
  - Goal: try to disprove the final completion claim requirement by requirement.
  - Stop condition: no edits.
  - Output: blockers, weak evidence, and recommended fixes.
  - Validation: parent resolves or explicitly defers every finding before final claim.

## Recommended Execution Order

1. Workstream 1.1 and 1.2: get the test map honest before adding coverage.
2. Workstream 1.3 through 1.6: add coverage proof and choose a realistic threshold.
3. Workstream 2.1 through 2.5: prove signed-in durable cloud library behavior.
4. Workstream 3.1 through 3.5: prove durable jobs only after database/auth proof is ready.
5. Workstream 4: remove private payloads from streaming URLs.
6. Workstream 5: UI polish and Proving Grounds stance.
7. Workstream 7: final audit/report only after the proof gates above are done.

## What Not To Do

- [ ] Do not call the repo 90% covered until current commands generate current coverage artifacts.
- [ ] Do not call cloud library durable until a signed-in browser flow proves durable save/load/list/delete.
- [ ] Do not call jobs durable while responses still depend on `non_durable_memory`.
- [ ] Do not reopen old dependency investigation branches as active work. Use archive branches as evidence only.
- [ ] Do not dispatch broad "figure out the repo" subagents. Use one ticket, one owned scope, one artifact.
