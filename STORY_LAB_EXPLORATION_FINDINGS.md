# Story Lab Exploration Findings

Created: 2026-07-05 02:25 EDT
Last updated: 2026-07-05 02:27 EDT

This is the durable synthesis of the EXP-01 through EXP-13 subagent exploration batch. It converts the read-only exploration pass into implementation-ready worker batches and a context turnover packet.

Use this file before rerunning any EXP ticket. If these facts are still current, dispatch workers from this synthesis instead of spending another turn on broad scouting.

## Live Repo Truth

- Branch at synthesis time: `recovery/story-lab-exploration-findings`.
- Base commit: `95c10d3 Add aggressive subagent exploration planning (#189)`.
- Open PRs: none, verified with `gh pr list --state open --json number,title --limit 20`.
- Main state before branch: `main...origin/main`, clean.
- Remaining non-main worktree: `/Users/hbpheonix/fairytaleswithspice-ai-review-unsliced` on `ai-review/story-lab-unsliced-reference-do-not-merge`; treat as parked reference work, not the active line.

## Exploration Status

| Ticket | Status | Confidence | Main finding |
|---|---:|---:|---|
| EXP-01 Communication guardrails | Partial | 84% | Add WHY-vs-WHAT response discipline and artifact-first acceptance checks. |
| EXP-02 Checklist aggression | Complete | 91% | Current checklist is still too conservative; many Explorer items should become Worker work. |
| EXP-03 Files-touched mapping | Complete | 95% | Shared-file conflicts are clear; root `package.json`, Angular app files, job route files, and changelog edits must be serialized. |
| EXP-04 PR/merge speed | Complete | 92% | Fast PR lane is viable: core CI plus unresolved-thread audit should drive merge timing, not advisory bot noise. |
| EXP-05 Context turnover | Complete | 95% | Turnover packets should be written after subagent batches, PR events, risky branch switches, and crowded threads. |
| EXP-06 Test/coverage readiness | Partial | 92% | No root/API coverage gate exists; Angular coverage exists at 85%; several runnable tests are outside `test:all`. |
| EXP-07 Auth/cloud durability | Partial | 88% | Auth/storage are scaffolded and fail closed, but signed-in Clerk plus Postgres save/load/list/delete is not live-proven. |
| EXP-08 Durable jobs | Partial | 88% | Interfaces, schema, Postgres store, and route wiring exist; default behavior is still process-local memory and process-loss proof is missing. |
| EXP-09 Streaming privacy | Complete | 95% | Private blueprint/user-input fields still travel through streaming URLs; backend and UI transport must change. |
| EXP-10 UI worker opportunity | Complete | 92% | Main app and Proving Grounds have direct worker-ready UI/test slices; Proving Grounds visibility remains parent-owned. |
| EXP-11 Docs source-of-truth | Complete | 95% | Historical control docs were still over-prominent; parent verified live PR truth before applying any wording. |
| EXP-12 Parallelization boundary | Complete | 86% | First implementation waves should be grouped by write scope, not theme. |
| EXP-13 Process red-team | Complete | 90% | The exploration plan itself was too process-heavy; future passes should consolidate or skip low-unlock scouts. |

## Plain-Language Findings

### Tests And Coverage

Estimated readiness: 45%.

Tests exist, but the gate is not honest enough yet. Root/API tests do not emit coverage, and some important privacy/security/job tests are runnable but not part of `test:all`. Angular has real coverage tooling, but the threshold is 85% and the coverage command is not explicit enough for a repo-wide claim.

Worker-ready next steps:

- Add a focused privacy/security/job-contract test command.
- Decide whether that command joins `test:all`.
- Add root/API coverage with a real coverage tool.
- Add explicit Angular coverage invocation before any 90% threshold decision.

### Auth, Account, And Cloud Durability

Estimated readiness: 65% scaffolded, 0% live-proven.

The code has auth ports, owner-scoped storage ports, Postgres storage code, readiness checks, schema helpers, and fail-closed behavior. What is missing is the signed-in proof: real auth token, durable database, save/list/load/delete, and owner-isolation evidence.

Worker-ready next steps:

- Make DB/schema readiness scripts first-class commands.
- Document a credential-safe runbook.
- Add a signed-in account smoke script that skips cleanly when credentials are missing.
- Run real provider proof only when credentials and database are available.

### Durable Jobs

Estimated readiness: 60% scaffolded, 0% process-loss-proven.

The job architecture is coherent: contracts, store interface, in-memory store, Postgres store, schema, route wiring, and path safety exist. The default path remains `non_durable_memory`, and no proof shows job snapshots/events survive process loss.

Worker-ready next steps:

- Lock schema/readiness evidence.
- Harden Postgres job store/config tests.
- Wire durable mode through routes with owner enforcement.
- Add process-loss proof, either true restart in staging or local simulated loss backed by durable store.

### Streaming Privacy

Estimated readiness: 55%.

The current flow works, but private Story Lab blueprint fields and classic story user input can still appear in query strings. That is the highest privacy risk found in the batch.

Worker-ready next steps:

- Change backend streaming contracts so private payloads are accepted through body/job state, not URLs.
- Change UI streaming code so EventSource or job-event URLs use opaque ids only.
- Update stale streaming tests/docs that still describe query-string story payloads.

### UI Polish

Estimated readiness: 80%.

Core UI actions are mostly guarded. The weaker spots are visible disabled/action-state proof, Proving Grounds interaction coverage, and the product decision about whether Proving Grounds stays behind `debug=1`.

Worker-ready next steps:

- Add main app action-state polish and DOM assertions.
- Add Proving Grounds interaction/button-state coverage.
- Keep Proving Grounds discoverability as a parent decision before changing nav exposure.

### Docs And Process

Estimated readiness: 85%.

The docs are much better than before, but there was still stale routing toward historical docs. The bigger process lesson is that future scout work should be consolidated and should stop as soon as worker tickets are clear.

Worker-ready next steps:

- Keep `STORY_LAB_EXPLORATION_FINDINGS.md` as the latest synthesis.
- Use `STORY_LAB_FUTURE_WORK_CHECKLIST.md` for dispatch, but follow the post-exploration wave plan instead of rerunning completed scouts.
- Treat `STORY_LAB_UNPUBLISHED_BRANCH_SPLIT_PLAN.md` as historical unless explicitly needed.

## First Implementation Wave

These six workers can run together if they keep write scopes disjoint:

| Worker | Goal | Write scope | Validation |
|---|---|---|---|
| W1 Test-surface truth pass | Add missing privacy/security/job-contract test command and document command map. | `package.json`, `tests/README.md`, optional `tests/run-all.mjs` | `npm run test:story-lab-privacy-contracts`; `npm run test:all` if included |
| W2 Angular coverage command | Add explicit Angular coverage script without raising thresholds yet. | `story-generator/package.json`, `story-generator/karma.conf.js`, `story-generator/angular.json` | `cd story-generator && npm run test:coverage -- --watch=false --browsers=ChromeHeadless` |
| W3 Cloud durability runbook | Document schema/readiness/live-proof steps without claiming proof. | `STORY_LAB_AUTH_PROFILE_CLOUD_LIBRARY_EXEC_PLAN.md`, `STORY_LAB_STORAGE_PORT_EXEC_PLAN.md` | `git diff --check`; secret-name-only review |
| W4 Durable-job schema/readiness | Lock job-related schema/readiness proof before route work. | `api/_lib/story-lab/storage/storyLabCloudSchema.sql`, readiness tests/docs only | `npx tsx tests/story-lab-cloud-schema-migration.test.ts`; `npx tsx tests/story-lab-cloud-db-readiness.test.ts` |
| W5 Main app action-state polish | Add visible action-state/DOM assertions for story and cloud controls. | `story-generator/src/app/app.html`, `story-generator/src/app/app.css`, `story-generator/src/app/app.spec.ts` | focused `app.spec.ts` run |
| W6 Proving Grounds interaction coverage | Add button/action/history state tests and focused polish. | `story-generator/src/app/proving-grounds/*` | focused `proving-grounds.spec.ts` run |

Parent should integrate and push each worker result from one controlling session. `package.json` must not be edited by two workers at once.

## Second Implementation Wave

Run after the first wave lands or after the parent confirms the shared files are free:

- Root/API coverage bootstrap: `package.json`, `package-lock.json`, `scripts/recovery/run-root-self-tests.mjs`.
- Account signed-in smoke: `scripts/recovery/story-lab-account-smoke.ts`, `package.json`.
- Durable job store/config hardening: `api/_lib/story-lab/jobs/*Store*`, `api/_lib/story-lab/jobs/storyLabJobStoreConfig.ts`, focused job tests.
- Streaming privacy backend patch: `api/story-lab/stream/genesis.ts`, `api/story/stream.ts`, parser/job route tests.
- Streaming privacy UI migration: `story-generator/src/app/story.service.ts`, streaming specs.
- Source-of-truth cleanup/final audit: active Story Lab docs only.

## Parent Decisions Needed

- Whether Proving Grounds stays behind `debug=1` or becomes visible in standard navigation.
- Whether old streaming GET query compatibility must remain for any external client.
- Whether job route query fallback for job ids should be removed now or treated as low-risk follow-up.
- Which coverage threshold should be enforced after real root/API and Angular coverage artifacts exist.
- When credentials/database access are available for live signed-in proof.

## Context Turnover Packet

Objective: complete the EXP-01 through EXP-13 exploration batch, synthesize findings, and leave a clean restart point.

Current branch and commit: `recovery/story-lab-exploration-findings` from `95c10d3 Add aggressive subagent exploration planning (#189)`.

Upstream state: `main` was current with `origin/main` before this branch; no open PRs at synthesis time.

Working tree state: docs-only synthesis committed on this branch; no tracked or untracked changes after commit/push verification.

Open PRs and review-thread state: open PR list is empty. Review-thread audit was not rerun in this synthesis branch because no PR exists yet.

What changed this run: all exploration reports were collected; stale open-PR wording was rejected after live GitHub verification; this findings doc, the subagent log, the future-work checklist, and operating docs were updated.

Docs updated: `STORY_LAB_EXPLORATION_FINDINGS.md`, `STORY_LAB_FUTURE_WORK_CHECKLIST.md`, `SUBAGENT_LOG.md`, `PR70_RECOVERY_CHANGELOG.md`, `AGENTS.md`, `OVERNIGHT_MODE.md`.

Commands run and results: `git status --short --branch` showed clean/current main before branching; `gh pr list --state open --json number,title --limit 20` returned `[]`; `git worktree list` showed the parked unsliced reference worktree.

Decisions made: do not rerun the whole exploration batch by default; move to worker dispatch by write scope; keep parent control over PR actions, shared-file integration, source-of-truth docs, and product decisions.

Subagent tickets dispatched and results: EXP-01 through EXP-13 all returned; statuses and findings are summarized above.

Unmerged or local-only work: docs-only synthesis is pushed on `recovery/story-lab-exploration-findings`; it remains unmerged until the PR lands.

Known unknowns: live credentialed auth/database proof, process-loss durable job proof, final coverage baselines, Proving Grounds exposure stance, old streaming GET compatibility stance.

Parked topics not to revive: archived dependency investigation branches and the unsliced AI-review reference worktree are not active implementation lines.

Next exact action: open PR, wait for required checks, audit unresolved review threads, and merge if clean.

Recommended stop point: after this docs synthesis is merged to `main`, start the first implementation wave from this file.
