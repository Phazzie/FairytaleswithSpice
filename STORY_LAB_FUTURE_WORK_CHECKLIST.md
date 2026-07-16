# Story Lab Future Work Checklist

Created: 2026-07-04 14:33 EDT
Last updated: 2026-07-16 03:14 EDT

This checklist breaks unfinished Story Lab work into coherent proof units that a subagent can execute or audit. It is not a promise that all tickets should run at once. The parent agent must explore first, choose the strategy, keep write scopes disjoint, verify test quality and results, open/merge PRs, and keep docs current.

Before running a broad exploration batch, use `STORY_LAB_EXPLORATION_TICKETS.md`. That file defines the standard exploration report, context-turnover packet, and the explore-to-worker tickets needed to revise this checklist into larger worker chunks with `Files touched` fields.

The 2026-07-05 exploration batch has already run. Use `STORY_LAB_EXPLORATION_FINDINGS.md` before rerunning any Explorer ticket; most scout work is now worker-ready and should not be repeated unless parent-led discovery identifies one specific stale or unresolved unknown.

## Subagent Deployment Gate

When the user asks for subagents, do not start with a generic exploration wave. The parent agent first inspects the live repo and writes a proposed batch with strategy, proof units, dependency order, exact file leases, test obligations, commands, non-claims, and stop conditions.

Before any worker starts:

1. Run the Goldilocks check on every proof unit: one useful outcome, one localized risk area, a reviewable diff, and an independent rollback boundary.
2. Send the proposed scope to one highly critical read-only Scope Prosecutor.
3. Record each material critique and the parent's `Accept`, `Partial`, or `Reject` disposition.
4. Revise once when warranted, then mark the batch `Scope locked`.
5. Dispatch workers only from the locked scope. Serialize shared files and package/lockfile changes.
6. After workers return, use a separate Completion Prosecutor to attack the diff, tests, evidence, and claims before parent validation.

Coverage percentage is not the target. Each proof unit must state the behavior, invariant, failure path, or real boundary it proves and the plausible defect its tests should catch. Coverage artifacts may expose blind spots, but shallow tests added only to raise a number do not satisfy this checklist.

## Completion Boundary

The authoritative required gates and evidence are in `STORY_LAB_FINAL_MERGE_AUDIT_EXEC_PLAN.md` under `Updated Definition Of Done`. In this checklist:

- **Required before Done:** live signed-in cloud save/list/load/update/delete; cross-owner denial; security/privacy closure; the risk-to-test matrix and meaningful critical-path tests; build/deployment/route checks; last-40 and current-PR review closure; final hostile review; final report merged to `origin/main`.
- **Conditional before Done:** durable-job implementation and process-loss proof only if the shipped product claims durable jobs. Otherwise verified process-local/`non_durable_memory` wording and a linked optional follow-up satisfy the honesty gate.
- **Administrative disposition required:** Dependabot #194 and any other open PR must be merged, replaced, closed with reason, or linked as optional follow-up; an unrelated major upgrade does not automatically block product completion.
- **Optional after Done:** execute the ambitious portfolio in `STORY_LAB_OPTIONAL_POST_DONE_ROADMAP.md`, including story intelligence, versioning/branches, editorial tools, Proving Grounds experiments, private publishing/media, collaboration, reusable worlds, durable creative workflows, safe model rollouts, and bounded Weird Lab work. Numeric threshold tuning, wider historical cleanup, Angular major upgrades, and nonblocking polish remain optional maintenance lanes.

Optional items must stay off completion branches. To promote one, update the Definition of Done and this boundary before implementation so scope cannot expand silently.

## Current Snapshot

- [x] **Repo hygiene:** `main` is current with `origin/main`.
- [ ] **Open PRs:** `gh pr list --state open --json number,title,url,headRefName,baseRefName` returned #194 and this publication PR #195 on 2026-07-11 00:37 EDT. After #195 lands, the remaining active work queue is Dependabot #194, which is mergeable by GitHub but failing Recovery CI and Vercel.
- [x] **Old dependency investigation:** archived at `origin/archive/angular22-dependency-investigation-2026-07-04`; it is evidence only, not an active workstream or PR.
- [x] **Whole-concept status:** `STORY_LAB_CONCEPT_CHECKLIST.md` is merged.
- [x] **Public Story Lab loop:** create, continue, local save, copy, download, and progress UI exist.
- [ ] **Production durability:** signed-in cloud save/load/list/delete is not proven live.
- [ ] **Test-quality proof:** root/API coverage instrumentation does not exist, several test surfaces still need a canonical map, and critical live auth/database and process-loss boundaries remain unproven. Angular coverage invocation exists, but certain local development environments currently cannot run ChromeHeadless reliably.
- [ ] **Job durability disposition:** job state is still explicitly `non_durable_memory`; either prove process-loss durability or keep that honest wording and move durable infrastructure to the optional queue.
- [ ] **Final completion report:** not ready until live auth/cloud proof, job-durability disposition, risk-based test proof, and final audits are complete.
- [x] **Exploration batch:** EXP-01 through EXP-13 completed and synthesized in `STORY_LAB_EXPLORATION_FINDINGS.md`.
- [x] **First implementation wave:** completed on `recovery/story-lab-first-worker-wave`; this improves test command truth, Angular coverage invocation, durability proof docs, durable-job schema/readiness proof, and focused UI/spec coverage. It does not complete live cloud proof, root/API coverage instrumentation, or durable process-loss job proof.

## Immediate Scope Map

Use this section as the parent-agent split before dispatching Spark workers. Percentages here mean **scope readiness**, not completion.

| Scope | Scope readiness | Why it matters | What it entails | Owned files / safe write area | Not in scope | Parallel notes |
|---|---:|---|---|---|---|---|
| Admin/status refresh | 100% | Keeps us from working from stale docs. | Update current PR truth, browser-runner caveat, next scope order, and changelog evidence. | Active docs only: `STORY_LAB_FUTURE_WORK_CHECKLIST.md`, `STORY_LAB_EXPLORATION_FINDINGS.md`, `STORY_LAB_COMPLETION_HARDENING_EXEC_PLAN.md`, `STORY_LAB_FINAL_MERGE_AUDIT_EXEC_PLAN.md`, `PR70_RECOVERY_CHANGELOG.md`, `LESSONS_LEARNED.md` if a durable lesson is added. | No code, no lockfiles, no UI branch files. | Parent-owned; do before worker dispatch. |
| Dependabot #194 triage | 80% | It is the only open PR and it is failing required checks. | Split root `form-data` lockfile change from Angular 22 major-upgrade changes; decide close/recreate vs focused replacement PR. | Read-only first; likely replacement worker owns either root `package-lock.json` or `story-generator/package.json` plus `story-generator/package-lock.json`, never both in parallel unless explicitly split by package root. | Do not merge Angular 22 while Recovery CI/Vercel fail; do not combine with coverage tooling. | Can run beside read-only audits, but not beside root coverage if both touch `package.json` or root lockfile. |
| Root/API test-map and coverage diagnostics | 85% | Account, storage, job, privacy, and route logic need meaningful behavioral proof and a map of blind spots. | Map risks to tests, wire omitted root/API tests, add coverage diagnostics if useful, and record missing high-value behavior or failure paths. | `package.json`, `package-lock.json`, optional coverage config, possible `scripts/recovery/run-root-self-tests.mjs`. | Do not add shallow tests or raise thresholds merely to improve a number; do not touch Angular packages. | Serialize with Dependabot/root package work. |
| Angular coverage runner health | 75% | Angular has coverage tooling, but some local development environments cannot prove it right now. | Add a fail-fast health check or require CI/supported-machine proof before treating local Karma output as evidence. | Optional script under `scripts/recovery/*headless*` or docs only; avoid Angular UI files. | Do not debug UI behavior here; do not upgrade Angular. | Can run beside root/API coverage if it avoids `package.json`; otherwise serialize package scripts. |
| Live auth and cloud library proof | 70% scoped, 0% live-proven | Cloud save/load/list/delete is not production-real until signed-in provider plus database proof exists. | Audit env names, create credential-safe account smoke, provision/migrate DB, prove signed-in save/list/load/delete and owner denial. | `scripts/recovery/*account*smoke*.mjs`, auth/storage exec plans, evidence docs. | Do not print secrets; do not claim durability without live proof. | Can run beside coverage if no package-script collision; credentialed proof waits on env/database access. |
| Durable jobs | 75% scoped, 0% process-loss-proven | Job routes still honestly report `non_durable_memory`; durability requires recovery after process loss. | Harden Postgres job store/config, wire durable mode safely, add process-loss proof. | `api/_lib/story-lab/jobs/*`, `api/story-lab/jobs.ts`, focused job tests, optional smoke script. | No Angular UI; no "durable" wording unless process-loss proof passes. | Can run beside streaming backend only if route/test files do not overlap. |
| Streaming privacy | 80% | Story text and blueprint data should not travel through browser-visible URLs. | Move private payloads to POST body/job state; keep EventSource URLs opaque; update backend and UI service tests. | Backend: `api/story-lab/stream/genesis.ts`, `api/story/stream.ts`, parser/security tests. UI service migration: `story-generator/src/app/story.service.ts` and focused specs. | No visual UI redesign. Preserve compatibility only if parent explicitly decides it is required. | Backend and UI can be split, but coordinate contract order. |
| UI polish branch coordination | 60% scoped here | Another session is working on UI; this repo session should not collide. | Keep UI branch out of this branch; only update docs about UI scope if needed. | Read-only for `story-generator/src/app/*` unless user explicitly moves UI back here. | No app HTML/CSS/component edits in this branch. | UI work should stay in the separate `-art` branch/session. |
| Final audit/report | 65% | Completion claims need fresh proof, not old chat memory. | Open PR audit, unresolved review-thread audit, test-quality evidence, durability proof evidence, final report. | `PR70_RECOVERY_FINAL_REPORT.md`, final audit plan, active checklist docs. | Do not run until critical test/durability gates have evidence or explicit non-claims. | Last step after the proof scopes above. |

## Post-Exploration Execution Batches

Do not rerun the full EXP batch by default. The next productive move is worker dispatch from the synthesis.

### First Implementation Wave

These six tasks were run in parallel on `recovery/story-lab-first-worker-wave` with parent integration and verification:

| Worker | Status | Result | Write scope |
|---|---|---|---|
| Test-surface truth pass | Done | Added `test:story-lab-privacy-contracts`, wired it into `test:all`, removed stale audio-test README/runner claims, and clarified root/API coverage is not instrumented yet. | `package.json`, `tests/README.md`, `tests/run-all.mjs` |
| Angular coverage command | Done with browser caveat | Added explicit `test:coverage` command with a named no-sandbox Karma launcher without changing the existing 85% Karma thresholds. Local ChromeHeadless execution still times out during browser capture. | `story-generator/package.json`, `story-generator/karma.conf.js` |
| Auth/cloud proof runbook | Done | Added credential-safe signed-in durability proof steps and kept cloud/durable non-claims explicit. | `STORY_LAB_AUTH_PROFILE_CLOUD_LIBRARY_EXEC_PLAN.md`, `STORY_LAB_STORAGE_PORT_EXEC_PLAN.md` |
| Durable-job schema/readiness proof | Done | Strengthened schema/readiness assertions for job tables, indexes, and event-to-job foreign-key shape. | `tests/story-lab-cloud-schema-migration.test.ts`, `tests/story-lab-cloud-db-readiness.test.ts`, `STORY_LAB_JOB_ROUTES_EXEC_PLAN.md` |
| Main app action-state polish | Done with browser caveat | Added action test hooks/ARIA labels and specs for story action visibility plus disabled cloud save. | `story-generator/src/app/app.html`, `story-generator/src/app/app.spec.ts` |
| Proving Grounds interaction coverage | Done with browser caveat | Added focused specs for export/generate disabled states, comparison selection limits, evaluated-state button, and delete-current behavior. | `story-generator/src/app/proving-grounds/proving-grounds.spec.ts` |

### Second Implementation Wave

Run after root `package.json` is free and the first wave has evidence:

| Worker | Why second | Write scope |
|---|---|---|
| Root/API coverage bootstrap | Needs root dependency/script edits and should not collide with the test-surface pass. | `package.json`, `package-lock.json`, new `scripts/recovery/run-root-self-tests.mjs` |
| Account signed-in smoke | Needs package/script edits and possibly credential-safe skip behavior. | new `scripts/recovery/story-lab-account-smoke.mjs`, `package.json` |
| Durable job store/config hardening | Deeper job persistence work after schema/readiness is locked. | `api/_lib/story-lab/jobs/*Store*`, `api/_lib/story-lab/jobs/storyLabJobStoreConfig.ts`, focused tests |
| Streaming privacy backend patch | Private payloads are in URLs; backend transport needs body/job-based replacement. | `api/story-lab/stream/genesis.ts`, `api/story/stream.ts`, parser/job route tests |
| Streaming privacy UI migration | Must follow or pair with backend transport; removes private payloads from browser-visible URLs. | `story-generator/src/app/story.service.ts`, streaming specs |
| Final source-of-truth cleanup | Keep only live docs as current and route historical docs as historical. | `AGENTS.md`, `OVERNIGHT_MODE.md`, active Story Lab plan docs |

## How To Use This Checklist

Each ticket is intentionally narrow:

- **Role:** `Explorer` means read-only evidence gathering. `Worker` means code/docs changes are allowed inside the owned files.
- **Owned files:** Files the subagent may change. If this says `Read-only`, the parent must integrate any edits.
- **Stop condition:** When the subagent must stop instead of widening scope.
- **Output:** The durable artifact the parent can review.
- **Validation:** Commands the parent or worker must run before claiming completion.

Do not dispatch two workers that write the same file. Do not dispatch implementation until the parent has completed discovery, resolved ordering, adjudicated the Scope Prosecutor critique, and marked the strategy `Scope locked`.

## Workstream 0: Admin And Source-Of-Truth Cleanup

- [x] **0.1 Archive the old Angular dependency investigation**
  - Role: Parent-owned admin.
  - Outcome: pushed `origin/archive/angular22-dependency-investigation-2026-07-04`.
  - Non-claim: this archive is not a PR, not active work, and not a merge target.
  - Validation: archive branch exists on origin; temp worktree removed.

- [ ] **0.2 Stale worktree audit**
  - Role: Parent-led discovery; dispatch a read-only explorer only for one named unresolved unknown.
  - Owned files: Read-only.
  - Read-only files/commands: `git worktree list`, `git status --short --branch` in each worktree.
  - Goal: classify each remaining non-main worktree as `active`, `archive`, `safe to remove`, or `needs user decision`.
  - Stop condition: do not delete or modify any worktree.
  - Output: table with path, branch, clean/dirty state, upstream state, recommendation.
  - Validation: parent reruns `git worktree list`.

- [ ] **0.3 Active-doc source map audit**
  - Role: Parent-led discovery; dispatch a read-only explorer only for one named unresolved unknown.
  - Owned files: Read-only.
  - Read-only files: `AGENTS.md`, `STORY_LAB_CONCEPT_CHECKLIST.md`, `STORY_LAB_FUTURE_WORK_CHECKLIST.md`, `STORY_LAB_COMPLETION_HARDENING_EXEC_PLAN.md`, `STORY_LAB_FINAL_MERGE_AUDIT_EXEC_PLAN.md`.
  - Goal: find places where active docs point at historical docs as if they are current.
  - Stop condition: do not rewrite broad historical docs.
  - Output: checklist of exact stale lines and proposed replacement wording.
  - Validation: `rg -n "PR70_RECOVERY_PLAN|plan.md|OVERNIGHT_HANDOFF|Done means" AGENTS.md STORY_LAB_*.md`.

## Workstream 1: Test Map And Coverage Proof

- [ ] **1.1 Canonical test map inventory**
  - Role: Parent-led discovery; dispatch a read-only explorer only for one named unresolved unknown.
  - Owned files: Read-only.
  - Read-only files: `package.json`, `tests/`, `story-generator/package.json`, `story-generator/src/app/*.spec.ts`.
  - Goal: list every runnable test file and whether it is included in `npm run test:all`, Angular test scripts, CI, smoke scripts, or nowhere.
  - Stop condition: do not modify package scripts.
  - Output: `TEST_COMMAND_COVERAGE_MAP.md` draft or table for parent integration.
  - Validation: `node -e "console.log(require('./package.json').scripts['test:all'])"` and `find tests -maxdepth 1 -type f | sort`.

- [x] **1.2 Wire omitted privacy/security/job-contract tests into a focused command**
  - Role: Worker.
  - Owned files: `package.json`, possibly `tests/run-all.mjs` if the repo already uses it for command grouping.
  - Tests to include: `tests/cors-policy.test.ts`, `tests/export-sanitizer.test.ts`, `tests/log-redaction.test.ts`, `tests/story-lab-stream-parse.test.ts`, `tests/story-service-streaming-security.test.ts`, `tests/story-lab-job-contracts.test.ts`.
  - Goal: add a repeatable script such as `test:story-lab-privacy-contracts` and decide whether it belongs in `test:all`.
  - Status: completed in the first implementation wave; the focused command exists and is wired into `test:all`.
  - Stop condition: if any listed test is not self-running under `tsx`, report the exact failure and stop.
  - Output: package-script diff plus command evidence.
  - Validation: after the worker creates the script, `npm run test:story-lab-privacy-contracts`; if added to the full gate, `npm run test:all`.

- [ ] **1.3 Root/API coverage tool decision**
  - Role: Parent-led discovery; dispatch a read-only explorer only for one named unresolved unknown.
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

- [x] **1.5 Make Angular coverage invocation explicit**
  - Role: Worker.
  - Owned files: `story-generator/package.json`, `story-generator/karma.conf.js` only.
  - Goal: add an explicit Angular coverage script without raising thresholds yet.
  - Status: completed in the first implementation wave; `test:coverage` exists and uses the no-sandbox Karma launcher. Local ChromeHeadless still times out in certain local development environments, so CI or a supported browser environment is required for coverage evidence.
  - Stop condition: do not change Angular versions or unrelated config.
  - Output: script name, threshold behavior, artifact path.
  - Validation: `cd story-generator && npm run test:coverage` or final script equivalent. Do not override the script's `ChromeHeadlessNoSandbox` launcher unless the runner-health scope intentionally changes it.

- [ ] **1.6 Risk-based test-quality audit**
  - Role: Parent-led audit; use a read-only reviewer only after the parent maps the risks.
  - Owned files: Read-only.
  - Goal: after 1.4 and 1.5 produce honest baselines, map critical behaviors and plausible defects to existing tests, then identify missing acceptance, invariant, failure-path, integration, restart, browser, or live-boundary proof.
  - Stop condition: do not change thresholds or propose tests whose only value is raising a percentage.
  - Output: risk-to-test matrix with current proof, missing proof, defect each proposed test should kill, and recommended worker scopes.
  - Validation: cite current test commands and artifacts; for high-risk owner/privacy/durability checks, name a semantic counterfactual that should make the test fail.

## Workstream 2: Live Auth, Account, And Cloud Library

- [ ] **2.1 Auth provider environment audit**
  - Role: Parent-led discovery; dispatch a read-only explorer only for one named unresolved unknown.
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
  - Role: Parent-led discovery; dispatch a read-only explorer only for one named unresolved unknown.
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
  - Role: Parent-led discovery; dispatch a read-only explorer only for one named unresolved unknown.
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
  - Role: Parent-led discovery; dispatch a read-only explorer only for one named unresolved unknown.
  - Owned files: Read-only.
  - Read-only files: `api/story-lab/stream/genesis.ts`, `api/story/stream.ts`, `story-generator/src/app/story.service.ts`, streaming tests.
  - Goal: identify every path where story text or blueprint fields can appear in a URL.
  - Stop condition: do not change routes.
  - Output: table of route, field, risk, replacement path.
  - Validation: `rg -n "query|URLSearchParams|EventSource|stream" api story-generator/src/app tests`.

- [ ] **4.2 POST-to-job streaming replacement design**
  - Role: Parent-led discovery; dispatch a read-only explorer only for one named unresolved unknown.
  - Owned files: Read-only.
  - Read-only files: `api/story-lab/stream/genesis.ts`, `api/story/stream.ts`, `api/story-lab/jobs.ts`, `api/_lib/story-lab/jobs/jobStore.ts`.
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
  - Role: Parent-led discovery; dispatch a read-only explorer only for one named unresolved unknown.
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
  - Role: Parent-led discovery; dispatch a read-only explorer only for one named unresolved unknown.
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
  - Role: Parent-led discovery; dispatch a read-only explorer only for one named unresolved unknown.
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
  - Role: Parent-led discovery; dispatch a read-only explorer only for one named unresolved unknown.
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
  - Role: Parent-led discovery; dispatch a read-only explorer only for one named unresolved unknown.
  - Owned files: Read-only.
  - Read-only files: `STORY_LAB_CONCEPT_CHECKLIST.md`, `STORY_LAB_FUTURE_WORK_CHECKLIST.md`, `STORY_LAB_COMPLETION_HARDENING_EXEC_PLAN.md`, `STORY_LAB_FINAL_MERGE_AUDIT_EXEC_PLAN.md`, `PR70_RECOVERY_FINAL_REPORT.md`.
  - Goal: try to disprove the final completion claim requirement by requirement.
  - Stop condition: no edits.
  - Output: blockers, weak evidence, and recommended fixes.
  - Validation: parent resolves or explicitly defers every finding before final claim.

## Workstream 8: Dependency PRs

- [ ] **8.1 Dependabot #194 triage**
  - Role: Parent-led dependency audit, then parent-owned disposition; use a read-only explorer only for one unresolved package-specific question.
  - Owned files: Read-only for triage.
  - Read-only files: `package-lock.json`, `story-generator/package.json`, `story-generator/package-lock.json`, PR #194 checks and Vercel status.
  - Goal: decide whether #194 should be closed/recreated, split into root-only plus Angular-major PRs, or fixed in place.
  - Stop condition: do not install packages or edit lockfiles during triage.
  - Output: disposition note with exact failing checks, dependency groups, and proposed replacement PR scopes.
  - Validation: `gh pr view 194 --json number,title,files,statusCheckRollup,url`.

- [ ] **8.2 Root dependency replacement, if selected**
  - Role: Worker.
  - Owned files: root `package-lock.json` only unless `package.json` needs a direct dependency update.
  - Goal: take safe non-Angular lockfile updates such as root `form-data` without dragging in Angular 22.
  - Stop condition: if npm wants to rewrite `story-generator/package-lock.json`, stop and report.
  - Output: focused root dependency PR.
  - Validation: `npm ci`, `npm audit --omit=dev`, focused root Story Lab tests selected by parent.

- [ ] **8.3 Angular major-upgrade plan, if still wanted**
  - Role: Separate plan, not a quick Dependabot merge.
  - Owned files: `story-generator/package.json`, `story-generator/package-lock.json`, Angular config/spec files only after a written upgrade plan exists.
  - Goal: evaluate Angular 22 upgrade cost, required Node/browser support, CI/Vercel failures, and migration steps.
  - Stop condition: do not start while another session owns UI work unless the user explicitly coordinates branches.
  - Output: upgrade plan or close/recreate note.
  - Validation: Recovery CI, Vercel preview, Angular build/test commands on a supported runner.

## Recommended Execution Order

1. Workstream 0: keep source-of-truth docs current before dispatching workers.
2. Workstream 8.1: triage Dependabot #194 so package-file work does not collide with coverage work.
3. Workstream 1.1: refresh the canonical test map before coverage tooling, unless a current test-map artifact is already committed.
4. Workstream 1.3, 1.4, and 1.6: map critical risks to tests, wire missing root/API proof, and use coverage diagnostics to find blind spots.
5. Angular runner health: add fail-fast local browser evidence or use CI/supported runner before relying on Angular coverage diagnostics.
6. Workstream 2.1 through 2.5: prove signed-in durable cloud library behavior.
7. Workstream 3.1 through 3.5: prove durable jobs only after database/auth proof is ready.
8. Workstream 4: remove private payloads from streaming URLs.
9. Workstream 5: UI polish and Proving Grounds stance, coordinated with the separate UI branch/session.
10. Workstream 7: final audit/report only after the proof gates above are done.

## What Not To Do

- [ ] Do not treat a coverage percentage as proof that important behavior is tested; require risk-to-test evidence and meaningful failure-path checks.
- [ ] Do not call cloud library durable until a signed-in browser flow proves durable save/load/list/delete.
- [ ] Do not call jobs durable while responses still depend on `non_durable_memory`.
- [ ] Do not reopen old dependency investigation branches as active work. Use archive branches as evidence only.
- [ ] Do not dispatch broad "figure out the repo" subagents. Parent discovery comes first; workers require a prosecuted and locked scope with one proof unit, one file lease, and one inspectable artifact.
