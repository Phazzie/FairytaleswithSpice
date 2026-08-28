# Subagent Ticket Standard

Created: 2026-08-19 07:50 EDT

## Purpose

This standard exists to prevent coding subagents from receiving broad assignments, expanding scope, changing neighboring systems, or returning changes they cannot adequately verify.

A subagent ticket is not a roadmap, epic, phase, or general request for improvement. It is authorization to change exactly one observable contract within explicit boundaries.

The project coordinator owns decomposition, sequencing, integration, pull requests, and merge decisions. A subagent owns only the ticket assigned to it.

## Roles

### Scout

A scout investigates current code and returns evidence. It does not modify the repository.

Use a scout when the location of the behavior, prerequisites, safest file boundary, or existing test coverage is uncertain.

### Implementer

An implementer makes the smallest change that satisfies one READY ticket. It does not repair unrelated prerequisites or implement follow-up work.

### Adversarial reviewer

A reviewer checks the implementation against the ticket, not against a vague ideal version of the system. It normally does not modify files. Findings become new tickets unless the coordinator explicitly assigns a correction ticket.

### Coordinator

The coordinator validates tickets, assigns isolated branches or worktrees, reviews returned diffs, runs integration checks, opens or updates pull requests, and decides whether work is safe to merge.

No subagent may declare the repository or product production-ready.

## Ticket lifecycle

Allowed states:

- `DRAFT`: incomplete or not yet linted.
- `READY`: prerequisites and scope have been verified against the named base SHA.
- `IN_PROGRESS`: assigned to one subagent in one isolated branch or worktree.
- `BLOCKED`: cannot proceed because a named prerequisite or external requirement is unavailable.
- `NEEDS_SPLIT`: the correct change exceeds the ticket boundary.
- `REVIEW`: implementation finished and awaiting independent review.
- `DONE`: accepted by the coordinator with evidence recorded.
- `SUPERSEDED`: replaced by a newer ticket with an explicit link.

A ticket must not move to `READY` without a current base SHA, a write whitelist, measurable acceptance criteria, and exact validation commands.

## Mandatory ticket fields

Every implementation ticket must contain all of the following.

### Identity

- Ticket ID.
- Short title.
- Parent epic or capability.
- Ticket type.
- Risk level.
- Base branch.
- Exact base commit SHA or an explicit coordinator-supplied-at-assignment placeholder.
- Dependencies and blockers.

### One-sentence objective

The objective must describe one behavior or invariant.

Avoid multiple independent clauses joined by `and`, `plus`, `while also`, or similar wording. An objective with more than one independent behavioral verb usually needs splitting.

Good:

> Return HTTP 202 with a persisted genesis-job marker before story generation begins.

Bad:

> Make jobs durable, update the frontend, add retries, and improve error handling.

### Why the ticket exists

Name the concrete defect or missing contract and cite current evidence:

- file path,
- route, function, class, or setting,
- observed behavior or failing test,
- linked issue or review finding when applicable.

Do not include a general project history.

### Current contract

Describe what the system observably does before the change.

### Target contract

State one invariant that will be true afterward. A reviewer must be able to answer PASS or FAIL.

### Prerequisite verification

Before editing, the subagent must verify:

- the base SHA and named files still apply,
- required tickets are merged,
- the focused baseline command can run or its pre-existing failure is recorded,
- no active ticket owns the same writable files.

If a prerequisite is false, stop. Do not repair it unless the repair is explicitly in scope.

### In scope

List only changes that directly establish the target contract.

### Explicitly out of scope

List tempting neighboring work. This section is mandatory even when the ticket appears obvious.

Typical exclusions include:

- frontend changes,
- database schema changes,
- worker implementation,
- dependency upgrades,
- deployment changes,
- broad formatting,
- unrelated test repair,
- documentation cleanup,
- public API redesign outside the named contract.

### Write whitelist

A subagent may inspect the repository broadly but may write only to listed paths. Globs must be narrow and intentional.

Any additional writable file requires a stop with `NEEDS_SPLIT`, unless the ticket explicitly permits a coordinator-approved exception.

### Write blacklist

Name especially dangerous or tempting files and layers that must not change, including files owned by other active tickets.

### Change budget

Default implementation budget:

- one behavioral contract,
- at most three production source files,
- at most one focused test file,
- at most one new abstraction,
- at most 250 non-generated changed lines,
- no database-plus-API-plus-frontend change,
- no schema change combined with worker behavior,
- no dependency upgrade combined with feature work.

These are tripwires, not quality targets. If the correct implementation exceeds the budget, return `NEEDS_SPLIT`; do not continue simply because the work seems related.

Deletion-only and generated-file tickets may define a different line-count rule while preserving the single-contract rule.

### Acceptance criteria

Each criterion must be independently testable. Prefer Given/When/Then language or precise invariants.

Do not use vague criteria such as:

- improve reliability,
- make production-ready,
- handle every edge case,
- ensure everything works,
- all tests pass.

Passing a broad test suite is supporting evidence, not the behavioral definition of success.

### Focused regression or invariant check

Every behavior change requires a focused test when practical. Repository-hygiene and settings tickets require an exact invariant check when an automated test is inappropriate.

The ticket must name:

- test or command,
- pre-change failure or undesired result,
- post-change expected result.

### Validation commands

Commands must be listed in execution order:

1. focused validation,
2. affected-subsystem validation,
3. required broader validation,
4. `git diff --check`,
5. changed-file and status inspection.

A subagent may not silently substitute commands. Any unavailable command must be reported with the reason.

### Implementation constraints

Record requirements such as preserving public response shapes, dependency injection, data compatibility, logging privacy, or failure semantics.

### Stop conditions

A subagent must stop and return `BLOCKED` or `NEEDS_SPLIT` when:

- a prerequisite is missing,
- the target conflicts with newer merged code,
- a product or architecture decision is required,
- a forbidden layer must change,
- the write or change budget must be exceeded,
- an unrelated baseline failure prevents trustworthy validation,
- a migration or dependency change is unexpectedly required,
- unavailable credentials or external settings are required,
- the correct fix would broaden the public API beyond the ticket.

Stopping is correct behavior. Improvising around a stop condition is not.

## Forbidden subagent behavior

A subagent must not:

- merge its own branch or pull request,
- close issues or pull requests,
- rewrite or broaden its ticket,
- weaken tests to obtain green results,
- mark an external failure as PASS,
- silently skip validation,
- repair unrelated findings,
- change neighboring architecture because it noticed a better design,
- implement suggested follow-up tickets,
- claim a preview deployment proves production readiness,
- claim the overall project is complete.

## Ticket lint gate

The coordinator must reject or split a ticket before assignment when any of these are true:

- The objective contains multiple independent behaviors.
- The title says only `complete`, `secure`, `harden`, `finish`, `clean up`, or `refactor` without naming one exact contract.
- The task crosses database, API, and frontend layers.
- It says `update related files` or leaves writable files undefined.
- It leaves a product or architectural decision to the implementer.
- It has no write whitelist.
- It has no focused regression or invariant check.
- Acceptance criteria cannot be answered PASS or FAIL.
- It does not say what must remain untouched.
- It was written against an old SHA and not revalidated.
- Another active ticket owns an overlapping write path.

## Isolation and ownership

Each implementation ticket runs in its own branch or worktree. One subagent owns that ticket at a time.

Parallel tickets must have non-overlapping write whitelists unless the coordinator explicitly serializes them. Shared-file edits are integration work and belong to a dedicated ticket.

The subagent produces a focused commit or worktree result. The coordinator owns PR assembly and may combine only small, low-risk tickets that touch the same seam and share rollback behavior.

High-risk tickets involving authentication, authorization, money, provider usage, migrations, transactions, queues, workers, secrets, or deployment should normally receive:

1. a read-only scout,
2. a constrained implementer,
3. an independent adversarial review.

## Evidence standard

A completion report must include:

- ticket and base SHA,
- final commit SHA when committed,
- changed files,
- contract before and after,
- acceptance-criterion results,
- exact validation commands and outcomes,
- diff-budget accounting,
- unrelated changes, explicitly `None` when applicable,
- risks and follow-up ticket suggestions,
- whether the result is safe for coordinator review.

A Vercel `READY` state, reviewer praise, local assertion, or successful build by itself is not sufficient proof.

## Required completion report

```text
TASK:
BASE SHA:
FINAL SHA:
STATUS: PASS | BLOCKED | FAIL | NEEDS_SPLIT

CHANGED:
- ...

CONTRACT BEFORE:
...

CONTRACT AFTER:
...

ACCEPTANCE CRITERIA:
- AC1: PASS | FAIL
- AC2: PASS | FAIL

VALIDATION:
- `command` -> PASS | FAIL | NOT RUN

DIFF BUDGET:
- Production files:
- Test files:
- Non-generated changed lines:
- Budget exceeded: YES | NO

UNRELATED CHANGES:
- None

RISKS:
- ...

FOLLOW-UP TICKETS SUGGESTED:
- ...

SAFE FOR COORDINATOR REVIEW:
YES | NO
```

## Coordinator assignment wrapper

Prepend this instruction to every assigned ticket:

```text
You are a scoped implementation subagent, not the project coordinator.

Complete only the attached ticket. You may inspect the repository broadly, but
you may write only to the ticket's whitelist. Do not repair prerequisites,
redesign neighboring systems, or implement suggested follow-up work.

Before editing, verify the named prerequisite state and base SHA. If the ticket
cannot be completed within its file and change budget, stop and return
NEEDS_SPLIT. A smaller correct result is preferable to a broader speculative
result.

Do not merge your branch or close any PR or issue. Run the ticket's exact
validation commands and return the required completion report.
```

## Coordinator integration duty

Microtickets can pass independently while their combined system fails. After each small merge batch, the coordinator must assign a separate integration check for the affected seam.

Integration checks should normally be read-only. Discovered defects become new scoped tickets rather than unreviewed fixes inside the integration pass.
