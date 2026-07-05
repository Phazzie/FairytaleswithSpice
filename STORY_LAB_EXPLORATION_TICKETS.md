# Story Lab Exploration Tickets

Created: 2026-07-05 01:54 EDT
Last updated: 2026-07-05 01:54 EDT

This is the exploration packet for the next Story Lab subagent pass. These are not implementation tickets. They are bounded read-only investigations that must turn uncertainty into worker-ready tasks, file ownership, and parallelization rules.

The purpose is speed with accuracy: explore only what must be known before assigning larger worker chunks. Any exploration that cannot unlock a worker ticket, parent decision, or explicit stop condition should be removed.

## Standard Exploration Report

Every exploration subagent must return this exact shape:

```text
Ticket:
Status: COMPLETE | PARTIAL | BLOCKED
Confidence: 0-100%

What I explored:
Why it mattered:
Files and commands inspected:
Facts found:
Unknowns still remaining:
Risks or traps:
Recommended role changes: Explorer -> Worker | Parent | Final audit | Remove
Worker tickets unlocked:
Files touched for each worker ticket:
Shared-file conflicts:
Validation commands for each worker ticket:
Fast path recommendation:
Hater critique:
Final recommendation:
```

Rules for exploration reports:

- Facts must point to exact files, commands, or PR/check evidence.
- Do not edit code or docs during exploration unless the ticket explicitly says `Worker`.
- Do not resolve GitHub review threads, merge PRs, delete branches, or remove worktrees.
- Do not return a broad essay. Return worker-ready decisions.
- Every report must name what can be done next because of the exploration.

## Context Turnover Packet

For long sessions, major branch changes, PR open/merge events, subagent batches, or before context gets crowded, write or include a compact turnover packet with:

```text
Objective:
Current branch and commit:
Upstream state:
Working tree state:
Open PRs and review-thread state:
What changed this run:
Docs updated:
Commands run and results:
Decisions made:
Subagent tickets dispatched and results:
Unmerged or local-only work:
Known unknowns:
Parked topics not to revive:
Next exact action:
Recommended stop point:
```

Use this packet in `SUBAGENT_LOG.md`, `PR70_RECOVERY_CHANGELOG.md`, PR bodies, or final answers when it prevents context loss. Keep it compact enough to read quickly.

## Parallel Waves

Run at most six exploration subagents at once.

Recommended Wave 1:

- EXP-01 Conversation Failure And Communication Guardrail Audit
- EXP-02 Checklist Aggression Audit
- EXP-03 Files-Touched Mapping Audit
- EXP-04 PR And Merge Speed Audit
- EXP-05 Context Turnover Protocol Audit
- EXP-12 Parallelization Boundary Audit

Recommended Wave 2:

- EXP-06 Test And Coverage Readiness Audit
- EXP-07 Auth And Cloud Durability Readiness Audit
- EXP-08 Durable Jobs Boundary Audit
- EXP-09 Streaming Privacy Boundary Audit
- EXP-10 UI Worker Opportunity Audit
- EXP-11 Docs Source-Of-Truth Audit

Optional critique pass:

- EXP-13 Process Critique And Red-Team Audit

## EXP-01 Conversation Failure And Communication Guardrail Audit

Parent analysis:

- The user repeatedly asked for concrete artifacts and causal explanations.
- The agent repeatedly substituted process status, summaries, links, and "what happened" explanations.
- `AGENTS.md` now has communication preference rules, but the rules should be checked against the actual failure patterns.

Exploration objective:

- Identify the recurring failure modes in this conversation and map each to a durable mitigation.

Why explore:

- This prevents the next planning and implementation turns from repeating the same artifact-substitution and over-process behavior.

Read-only inputs:

- This conversation context.
- `AGENTS.md`
- `PR70_RECOVERY_CHANGELOG.md`
- `LESSONS_LEARNED.md`

Commands allowed:

- `rg -n "Communication|artifact|checklist|conservative|subagent|context|turnover" AGENTS.md PR70_RECOVERY_CHANGELOG.md LESSONS_LEARNED.md`

Specific questions:

- Where did the user ask for an artifact and receive a summary/status instead?
- Where did the user ask why and receive what happened instead?
- Which current `AGENTS.md` rules address this, and which gaps remain?
- Which mitigations should be conventional rules, and which should be hater-pass checks?

Must report in addition to the standard report:

- A ranked list of failure patterns.
- A ranked list of mitigation rules.
- Any exact wording that should be added to `AGENTS.md` or `LESSONS_LEARNED.md`.

Unlocks:

- A small worker ticket to refine `AGENTS.md` and/or `LESSONS_LEARNED.md`.
- A final-answer acceptance checklist.

Stop condition:

- Do not rewrite docs. Report exact proposed edits only.

Parallel notes:

- Can run with all other Wave 1 tickets.

## EXP-02 Checklist Aggression Audit

Parent analysis:

- `STORY_LAB_FUTURE_WORK_CHECKLIST.md` is too conservative.
- Too many tickets are read-only scouts when the parent agent can choose strategy and create worker chunks.
- The target is a more aggressive plan that maintains precision and file ownership.

Exploration objective:

- Reclassify every future-work checklist item as `Worker now`, `Explorer only if blocked`, `Parent decision`, `Final audit`, or `Remove`.

Why explore:

- This turns the checklist from a slow research queue into an execution plan.

Read-only inputs:

- `STORY_LAB_FUTURE_WORK_CHECKLIST.md`
- `AGENTS.md`
- Relevant active plans listed by each workstream.

Commands allowed:

- `rg -n "Role: Explorer|Role: Worker|Owned files|Read-only|Stop condition" STORY_LAB_FUTURE_WORK_CHECKLIST.md`

Specific questions:

- Which Explorer tickets can become Worker tickets immediately?
- Which Explorer tickets should be merged into adjacent Worker tickets?
- Which tickets are truly risky or decision-heavy enough to remain Explorer?
- What Worker/Explorer/Parent percentage should the revised checklist target?

Must report in addition to the standard report:

- A table with every ticket id, current role, recommended role, reason, and confidence.
- A proposed execution order for the first two implementation batches.

Unlocks:

- A worker ticket to rewrite `STORY_LAB_FUTURE_WORK_CHECKLIST.md` with more aggressive roles.

Stop condition:

- Do not edit the checklist during exploration.

Parallel notes:

- Shares read inputs with EXP-03 and EXP-12 but has no write conflict because all are read-only.

## EXP-03 Files-Touched Mapping Audit

Parent analysis:

- Future tickets need exact files touched so subagents can work in parallel without colliding.
- `AGENTS.md` now requires a `Files touched` field.

Exploration objective:

- Add expected create/modify/test/docs paths for each future-work ticket.

Why explore:

- File ownership is the difference between safe parallel work and accidental conflicts.

Read-only inputs:

- `STORY_LAB_FUTURE_WORK_CHECKLIST.md`
- `package.json`
- `story-generator/package.json`
- `tests/`
- `api/`
- `story-generator/src/app/`

Commands allowed:

- `find tests -maxdepth 1 -type f | sort`
- `find api -maxdepth 4 -type f | sort`
- `find story-generator/src/app -maxdepth 3 -type f | sort`
- `node -e "const p=require('./package.json'); console.log(Object.keys(p.scripts || {}).sort().join('\\n'))"`
- `node -e "const p=require('./story-generator/package.json'); console.log(Object.keys(p.scripts || {}).sort().join('\\n'))"`

Specific questions:

- Which files should each ticket read?
- Which files should each Worker ticket modify?
- Which shared files must be serialized (`package.json`, lockfiles, changelog, docs)?
- Which tickets can safely run in parallel because file ownership is disjoint?

Must report in addition to the standard report:

- A `Files touched` table for every future-work ticket.
- A `Shared files requiring parent integration` list.

Unlocks:

- A worker ticket to update the checklist with `Files touched`.
- Parallel batch planning.

Stop condition:

- Do not modify package files or docs.

Parallel notes:

- Can run with EXP-02 and EXP-12; parent must reconcile their recommendations.

## EXP-04 PR And Merge Speed Audit

Parent analysis:

- PR creation, checks, bot reviews, thread inspection, and merge are consuming too much wall time.
- Some waiting is real safety; some may be optional bot limbo.

Exploration objective:

- Separate required merge gates from optional/noisy review states and recommend a faster PR lane.

Why explore:

- Faster PR handling reduces attention loss without skipping safety.

Read-only inputs:

- `.github/workflows/`
- branch protection evidence available through `gh`
- recent PRs #187 and #188
- `AGENTS.md`
- `scripts/recovery/finish-check.mjs`

Commands allowed:

- `gh pr view 187 --json number,state,mergedAt,reviewDecision,statusCheckRollup`
- `gh pr view 188 --json number,state,mergedAt,reviewDecision,statusCheckRollup`
- `gh pr checks 188`
- `find .github/workflows -maxdepth 2 -type f | sort`
- `rg -n "branch protection|required|CodeRabbit|Sourcery|Sonar|Vercel|review" .github AGENTS.md scripts/recovery`

Specific questions:

- Which checks are required to merge?
- Which bot statuses can stick pending without actionable review threads?
- What is the fastest safe sequence for docs-only PRs?
- When should the parent inspect review threads and proceed instead of waiting?

Must report in addition to the standard report:

- A proposed `Fast PR Lane` checklist.
- A proposed `When to wait vs when to inspect and merge` rule.

Unlocks:

- A worker ticket to update `AGENTS.md` and possibly recovery tooling.

Stop condition:

- Do not merge, close, or modify PRs.

Parallel notes:

- Independent from technical workstream audits.

## EXP-05 Context Turnover Protocol Audit

Parent analysis:

- The user wants context compressed sooner and more often, but with important information preserved.
- The repo already has changelog, subagent log, overnight mode, and finish checks.

Exploration objective:

- Design a compact turnover protocol for long sessions and subagent batches.

Why explore:

- Better turnover reduces context loss and prevents stale topics from reappearing.

Read-only inputs:

- `AGENTS.md`
- `OVERNIGHT_MODE.md`
- `SUBAGENT_LOG.md`
- `PR70_RECOVERY_CHANGELOG.md`
- recent PR bodies if needed.

Commands allowed:

- `rg -n "turnover|handoff|context|overnight|subagent|finish|local-only|parked" AGENTS.md OVERNIGHT_MODE.md SUBAGENT_LOG.md PR70_RECOVERY_CHANGELOG.md`

Specific questions:

- When should a turnover packet be written?
- Which fields are mandatory?
- Which durable doc should receive the packet for each kind of work?
- How short can it be while still preserving the important state?

Must report in addition to the standard report:

- A proposed turnover packet template.
- A proposed trigger list: time, context use, PR events, subagent batch events, user stepping away.

Unlocks:

- A worker ticket to update `AGENTS.md`, `OVERNIGHT_MODE.md`, and/or `SUBAGENT_LOG.md`.

Stop condition:

- Do not rewrite the existing handoff docs during exploration.

Parallel notes:

- Can run with EXP-01 because both are process-facing; parent should deduplicate.

## EXP-06 Test And Coverage Readiness Audit

Parent analysis:

- Coverage proof is a real gap.
- The target is not blindly 90%; first prove what tests run and what coverage can measure.

Exploration objective:

- Map current root/API and Angular test commands, missing test inclusion, and coverage-tooling needs.

Why explore:

- This is likely the first high-value implementation batch.

Read-only inputs:

- `package.json`
- `package-lock.json`
- `tests/`
- `story-generator/package.json`
- `story-generator/karma.conf.js`
- `story-generator/src/app/*.spec.ts`
- `STORY_LAB_FINAL_MERGE_AUDIT_EXEC_PLAN.md`

Commands allowed:

- `node -e "const p=require('./package.json'); console.log(JSON.stringify(p.scripts,null,2))"`
- `node -e "const p=require('./story-generator/package.json'); console.log(JSON.stringify(p.scripts,null,2))"`
- `find tests -maxdepth 1 -type f | sort`
- `find story-generator/src/app -maxdepth 2 -name "*.spec.ts" | sort`
- `rg -n "coverage|karma|tsx|node --test|test:all|story-lab" package.json story-generator/package.json story-generator/karma.conf.js tests`

Specific questions:

- Which tests are runnable but not in `test:all`?
- Which tests should form the first privacy/security/job-contract command?
- Which coverage tool is least disruptive for root/API `tsx` tests?
- Which files would a root coverage worker touch?
- Which files would an Angular coverage-script worker touch?

Must report in addition to the standard report:

- A test-command map.
- A recommended first implementation batch with files touched.
- A baseline plan that avoids fake coverage claims.

Unlocks:

- Worker tickets for test map doc, missing-test command, root coverage command, Angular coverage script.

Stop condition:

- Do not install packages or edit scripts.

Parallel notes:

- Do not run concurrently with a Worker editing `package.json` or lockfiles.

## EXP-07 Auth And Cloud Durability Readiness Audit

Parent analysis:

- Production durability is not proven.
- Signed-in cloud save/load/list/delete needs real auth and durable storage proof.

Exploration objective:

- Identify the shortest credible path to signed-in cloud library proof.

Why explore:

- This is a major completion blocker and should become concrete worker tickets.

Read-only inputs:

- `STORY_LAB_AUTH_PROFILE_CLOUD_LIBRARY_EXEC_PLAN.md`
- `STORY_LAB_STORAGE_PORT_EXEC_PLAN.md`
- `api/_lib/story-lab/auth/`
- `api/_lib/story-lab/storage/`
- account route files and tests
- `story-generator/src/app/`

Commands allowed:

- `find api/_lib/story-lab -maxdepth 4 -type f | sort`
- `rg -n "auth|profile|account|owner|cloud|library|postgres|non_durable|durable|DATABASE|VERCEL|env" api story-generator/src/app STORY_LAB_AUTH_PROFILE_CLOUD_LIBRARY_EXEC_PLAN.md STORY_LAB_STORAGE_PORT_EXEC_PLAN.md`

Specific questions:

- Which auth/env names are required for proof?
- Which account/cloud routes already exist?
- Which storage adapter behavior is scaffolded vs durable?
- What smoke script is missing?
- What can be proven without credentials, and what needs credentials?

Must report in addition to the standard report:

- A credential-safe env checklist with names only.
- A signed-in proof sequence.
- Worker tickets for smoke/runbook/implementation gaps.

Unlocks:

- Worker tickets for account smoke, database runbook, live proof, or missing implementation fixes.

Stop condition:

- Do not print secrets, modify env files, or run credentialed flows.

Parallel notes:

- Can run with EXP-08 only if both remain read-only.

## EXP-08 Durable Jobs Boundary Audit

Parent analysis:

- Job routes currently make explicit `non_durable_memory` claims.
- Durable jobs need storage, owner isolation, route wiring, and process-loss proof.

Exploration objective:

- Map the durable-job implementation boundary and convert it into worker tickets.

Why explore:

- This prevents fake durability claims and gives a concrete implementation path.

Read-only inputs:

- `STORY_LAB_JOB_ROUTES_EXEC_PLAN.md`
- `api/_lib/story-lab/jobs/`
- `api/story-lab/jobs.ts`
- `tests/story-lab-job-*.test.ts`

Commands allowed:

- `find api/_lib/story-lab/jobs -maxdepth 4 -type f | sort`
- `rg -n "non_durable_memory|durable|postgres|job|event|owner|process" api tests STORY_LAB_JOB_ROUTES_EXEC_PLAN.md`

Specific questions:

- Where exactly does non-durable state live?
- What interfaces already support a durable adapter?
- What schema is needed?
- What tests already exist and what tests are missing?
- What process-loss proof can be automated?

Must report in addition to the standard report:

- A file/function boundary map.
- A recommended sequence: schema, store, route wiring, proof.
- Files touched for each worker ticket.

Unlocks:

- Worker tickets for schema plan, Postgres job store, route wiring, process-loss proof.

Stop condition:

- Do not implement job storage or change route behavior.

Parallel notes:

- Can run with EXP-07 as read-only; implementation later must serialize shared auth/storage files.

## EXP-09 Streaming Privacy Boundary Audit

Parent analysis:

- Private story payloads must not travel through URLs.
- Streaming changes may touch both API routes and Angular client code.

Exploration objective:

- Identify every URL/query/EventSource path carrying private data and design worker tickets to move private payloads out of URLs.

Why explore:

- This is a privacy/security boundary and needs exact file ownership.

Read-only inputs:

- `STORY_LAB_PRIVACY_STREAMING_GATES_EXEC_PLAN.md`
- `api/story-lab/stream/genesis.ts`
- `api/story/stream.ts`
- `api/story-lab/jobs.ts`
- `api/_lib/story-lab/jobs/jobStore.ts`
- `story-generator/src/app/story.service.ts`
- streaming tests

Commands allowed:

- `rg -n "query|URLSearchParams|EventSource|stream|blueprint|storyText|prompt|encodeURIComponent|searchParams" api story-generator/src/app tests STORY_LAB_PRIVACY_STREAMING_GATES_EXEC_PLAN.md`

Specific questions:

- Which exact fields can appear in URLs?
- Which route/client pairs must change together?
- Can backend and UI migration be split safely?
- Which tests should fail before the privacy patch?

Must report in addition to the standard report:

- A route/client risk table.
- Backend worker ticket.
- UI worker ticket.
- Test additions or updates needed.

Unlocks:

- Worker tickets for backend streaming privacy patch and UI streaming migration.

Stop condition:

- Do not change streaming contracts during exploration.

Parallel notes:

- Later implementation likely conflicts with durable job route work if both touch job routes.

## EXP-10 UI Worker Opportunity Audit

Parent analysis:

- UI polish items are concrete and should not all start as read-only audits.
- The goal is to identify bigger UI worker chunks that are still safe.

Exploration objective:

- Find UI polish tasks that can become direct Worker tickets with tests/screenshots.

Why explore:

- UI work is visible progress and can be batched if files and tests are clear.

Read-only inputs:

- `story-generator/src/app/app.html`
- `story-generator/src/app/app.ts`
- `story-generator/src/app/app.css`
- `story-generator/src/app/app.spec.ts`
- `story-generator/src/app/app.routes.ts`
- `story-generator/src/app/proving-grounds/`

Commands allowed:

- `rg -n "disabled|button|click|continue|save|download|copy|proving|route|aria|tabindex|empty|selected" story-generator/src/app`
- `find story-generator/src/app -maxdepth 3 -type f | sort`

Specific questions:

- Which empty-state actions can be patched directly?
- Which actions need product decision first?
- What specs already cover these states?
- Which CSS/responsive issues can be batched without redesigning?

Must report in addition to the standard report:

- A UI worker batch proposal with exact files touched.
- Any product decision that must stay parent-owned.
- Screenshot/browser verification recommendations.

Unlocks:

- Worker tickets for invalid-action UI, Proving Grounds visibility, responsive/accessibility pass.

Stop condition:

- Do not edit UI files or run broad redesign.

Parallel notes:

- UI implementation should not run in parallel with another worker editing `app.ts`, `app.html`, or `app.css`.

## EXP-11 Docs Source-Of-Truth Audit

Parent analysis:

- Stale docs have caused parked topics to reappear as active topics.
- Active docs should point to current source-of-truth files and label historical docs clearly.

Exploration objective:

- Find active-doc references that make historical docs look current or create status confusion.

Why explore:

- Better doc routing reduces repeated frustration and bad task selection.

Read-only inputs:

- `AGENTS.md`
- `STORY_LAB_CONCEPT_CHECKLIST.md`
- `STORY_LAB_FUTURE_WORK_CHECKLIST.md`
- `STORY_LAB_COMPLETION_HARDENING_EXEC_PLAN.md`
- `STORY_LAB_FINAL_MERGE_AUDIT_EXEC_PLAN.md`
- `OVERNIGHT_MODE.md`
- `PR70_RECOVERY_CHANGELOG.md`

Commands allowed:

- `rg -n "PR70_RECOVERY_PLAN|plan.md|OVERNIGHT_HANDOFF|current|active|historical|Done means|main|origin/main|dependency investigation|old Angular" AGENTS.md STORY_LAB_*.md OVERNIGHT_MODE.md PR70_RECOVERY_CHANGELOG.md`

Specific questions:

- Which active docs point to stale docs as current?
- Which parked/archive topics need stronger labels?
- Which docs should be updated in one cleanup worker ticket?

Must report in addition to the standard report:

- Exact stale line references.
- Proposed replacement wording.
- A docs cleanup worker ticket with files touched.

Unlocks:

- Worker ticket for source-of-truth doc cleanup.

Stop condition:

- Do not rewrite docs during exploration.

Parallel notes:

- Potential overlap with EXP-01 and EXP-05; parent should deduplicate changes.

## EXP-12 Parallelization Boundary Audit

Parent analysis:

- We can use up to six subagents, but only if write scopes do not collide.
- Future tickets need batch grouping by file ownership, not by theme alone.

Exploration objective:

- Build safe concurrent batches from the revised future-work tickets.

Why explore:

- This converts the checklist into an execution schedule.

Read-only inputs:

- `STORY_LAB_FUTURE_WORK_CHECKLIST.md`
- EXP-02 and EXP-03 reports when available, or the current checklist if run in Wave 1.
- `AGENTS.md`

Commands allowed:

- `rg -n "Owned files|Files touched|Read-only files|Role:|Validation:" STORY_LAB_FUTURE_WORK_CHECKLIST.md AGENTS.md`

Specific questions:

- Which worker tickets can run together?
- Which shared files force serialization?
- What is the most aggressive safe first implementation batch?
- Which ticket should the parent do directly?

Must report in addition to the standard report:

- Batch table with up to six concurrent agents per wave.
- Shared-file conflict list.
- Recommended first implementation wave.

Unlocks:

- Next-turn dispatch plan.

Stop condition:

- Do not dispatch agents or edit docs.

Parallel notes:

- In Wave 1, this may rely on partial information. Mark confidence honestly.

## EXP-13 Process Critique And Red-Team Audit

Parent analysis:

- The user wants more ambitious execution without losing precision.
- The process itself needs a critic that catches slow, vague, or too-safe plans before work starts.

Exploration objective:

- Attack the proposed exploration and implementation process as if trying to find why it will fail.

Why explore:

- A hostile review can prevent another slow process loop.

Read-only inputs:

- `AGENTS.md`
- `STORY_LAB_EXPLORATION_TICKETS.md`
- `STORY_LAB_FUTURE_WORK_CHECKLIST.md`
- recent changelog entries.

Commands allowed:

- `rg -n "Explorer|Worker|Files touched|context|turnover|artifact|conservative|aggressive|validation|Stop condition" AGENTS.md STORY_LAB_EXPLORATION_TICKETS.md STORY_LAB_FUTURE_WORK_CHECKLIST.md PR70_RECOVERY_CHANGELOG.md`

Specific questions:

- Which exploration tickets are unnecessary or duplicative?
- Which tickets are still too vague?
- Which tickets are too conservative?
- Where could the process waste another full turn?
- What should be cut or merged before dispatch?

Must report in addition to the standard report:

- Top five process risks.
- Top five recommended cuts/merges.
- A go/no-go recommendation for the exploration batch.

Unlocks:

- A leaner exploration dispatch plan.

Stop condition:

- Do not rewrite tickets during exploration.

Parallel notes:

- Best run after Wave 1 tickets exist, or as a short parent-agent review before dispatch.

## Approval Gate For Next Turn

Before dispatching exploration agents, the parent agent should present:

- Which wave will run first.
- Which tickets are included.
- Which tickets are omitted and why.
- Expected elapsed time.
- Expected artifacts.
- Which files remain untouched.

After exploration returns, the parent agent should immediately convert findings into:

- revised roles in `STORY_LAB_FUTURE_WORK_CHECKLIST.md`;
- `Files touched` entries;
- a first implementation batch with up to six subagents;
- a context turnover packet.
