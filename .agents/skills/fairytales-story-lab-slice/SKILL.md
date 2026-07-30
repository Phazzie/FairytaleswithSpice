---
name: fairytales-story-lab-slice
description: Use when working in /Users/hbpheonix/fairytaleswithspice on the current two-plan Story Lab completion sequence, selecting a bounded implementation or review slice, dispatching Story Lab subagents, preparing validation evidence, opening or merging a Story Lab PR, or preventing local-only/stale-plan drift.
---

# Fairytales Story Lab Slice

## Rule

Current repo state plus current Story Lab control docs are the source of truth. "Done" means merged to `main`; local-only, open-PR, backup-branch, or parked work is not done.

Pressure test: if the user asks what is next, what is left, whether to dispatch agents, or whether Story Lab is done, do not route to the old unpublished-branch split plan, old slice names, PR #120/#121, or PR #70 recovery by default.

## Start

1. Confirm the repo is `/Users/hbpheonix/fairytaleswithspice`.
2. Run `git status --short --branch`.
3. Run `npm run recovery:status`.
4. Read `AGENTS.md`.
5. Read the active control docs that match the question:
   - broad status: `STORY_LAB_CONCEPT_CHECKLIST.md`;
   - foundation through accepted Living Book: `STORY_LAB_FOUNDATION_AND_LIVING_BOOK_EXEC_PLAN.md`;
   - production work after accepted UI: `STORY_LAB_PRODUCTION_COMPLETION_EXEC_PLAN.md`;
   - next work/subagents: the active plan's PR train and microtickets, then `STORY_LAB_FUTURE_WORK_CHECKLIST.md` for supporting detail;
   - historical recovery/audit evidence: `STORY_LAB_COMPLETION_HARDENING_EXEC_PLAN.md` and `STORY_LAB_FINAL_MERGE_AUDIT_EXEC_PLAN.md`.
6. Read the execution plan for the files or behavior being changed.
7. Treat `STORY_LAB_UNPUBLISHED_BRANCH_SPLIT_PLAN.md` as historical unless the user explicitly asks to recover that old unpublished stack.
8. If Gemini/Antigravity or Jules review is required or claimed, use `$fairytales-external-review` and read `docs/EXTERNAL_REVIEW_POLICY.md`.

## Slice Sizing

Pick one reviewable outcome from the current checklist. A slice may be large when it proves one coherent behavior, but split immediately when it crosses independent risk areas:

- dependency/lockfile updates;
- root/API test or coverage tooling;
- Angular browser/coverage runner work;
- auth/profile/storage/cloud-library behavior;
- durable job or Workflow claims;
- deployable route/Vercel function-budget changes;
- Angular user-facing UI;
- story-generation quality behavior;
- Proving Grounds/reporting visibility;
- privacy, export, CORS, streaming, or retention gates.

## Subagent Split

Use subagents after the parent agent has selected the strategy. Worker tickets must name exact owned files, expected touched files, commands, stop condition, and output contract. Split implementation into deliberately tiny, disjoint tickets, but group those tickets into the coherent PR boundary named by the active plan. A microticket is an ownership and proof unit, not automatically a PR.

Never let two workers edit the same lockfile, package file, route, component, changelog section, or checklist section in parallel.

The parent alone edits shared contracts, lockfiles, `package.json`, `AGENTS.md`, active ExecPlans, and changelog integration sections unless it explicitly serializes a lease. The parent also owns user acceptance boundaries, reviewer dispositions, GitHub comments, publication, and deployment.

## Execution Workflow

1. Update local `main` from `origin/main` before feature work.
2. Create one `recovery/story-lab-*` branch from `main`.
3. Implement one current active-plan PR outcome from its much smaller worker tickets.
4. Update the narrowest durable docs named by `AGENTS.md`.
5. Run focused validation for the changed surface.
6. Run local Scope and Completion prosecution and independently adjudicate their findings.
7. Use the external-review cadence in `docs/EXTERNAL_REVIEW_POLICY.md` at the final committed candidate head. Before the controller canary passes, label it advisory and parent-inspected.
8. Run `npm run recovery:finish -- --strict` before PR-ready or final-status claims.
9. Open/update the PR with exact scope, validation evidence, non-claims, review dispositions, and remaining work.
10. Audit unresolved review threads after opening or merging.
11. Stop after the PR is open or merged. Do not start the next PR outcome on the same branch.

## Stop Signs

Stop and report instead of coding when:

- `main` is dirty, ahead, behind, or not matching `origin/main`;
- `npm run recovery:status` reports stale branch state, missing open-PR truth, or route-budget failure;
- the active docs and live GitHub state disagree;
- the branch already contains multiple independent checklist items;
- validation would require nonexistent commands;
- the work touches dependency updates and coverage tooling at the same time;
- Plan 2 is requested before the exact merged Plan 1 SHA is recorded;
- a required external-review receipt is stale, malformed, or attached to a different head;
- the controller canary has not passed but a task asks to treat its status as mechanically required;
- the user asks for status/checklist rather than implementation.

## Historical Scope

Old PR-recovery files and old slice names are useful archaeology, not the active work queue. Only use them when explicitly mining historical PR material or recovering the old unpublished stack.
