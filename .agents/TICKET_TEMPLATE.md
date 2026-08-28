# Subagent Ticket Template

Created: 2026-08-19 08:45 EDT

Copy this file to `.agents/tickets/<capability>/<TICKET-ID>.md`. Delete instructional placeholder text before moving the ticket to `READY`.

The coordinator must validate the ticket against `.agents/SUBAGENT_TICKET_STANDARD.md` and the exact current base SHA before assignment.

---

# <TICKET-ID> — <One exact contract>

## Identity

- **Ticket ID:** `<TICKET-ID>`
- **Title:** `<One exact contract>`
- **Parent epic:** `<capability or merge train>`
- **Ticket type:** `DISCOVERY | CONTRACT | IMPLEMENTATION | TEST | DOCUMENTATION | SETTINGS | REVIEW | INTEGRATION`
- **Risk:** `LOW | MEDIUM | HIGH`
- **Base branch:** `main`
- **Base commit SHA:** `<exact 40-character SHA or COORDINATOR_SUPPLIES_AT_ASSIGNMENT>`
- **Dependencies:** `<ticket IDs or None>`
- **Blocked by:** `<ticket IDs, external requirement, or None>`
- **Status:** `DRAFT | READY | IN_PROGRESS | BLOCKED | NEEDS_SPLIT | REVIEW | DONE | SUPERSEDED`

## Coordinator assignment wrapper

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

## 1. One-sentence objective

> `<Change exactly one observable behavior or establish exactly one invariant.>`

## 2. Why this ticket exists

Describe the concrete defect or missing contract. Include current evidence:

- **Path:** `<file or settings location>`
- **Symbol or route:** `<function, class, route, job, or setting>`
- **Observed behavior:** `<what happens now>`
- **Issue/review evidence:** `<link or None>`

Do not include a general project history.

## 3. Current contract

`<State the observable pre-change behavior.>`

## 4. Target contract

`<State one invariant a reviewer can mark PASS or FAIL.>`

## 5. Prerequisite verification

Before editing, verify all of the following:

- [ ] The checked-out commit matches the named base SHA or the coordinator has supplied an approved replacement SHA.
- [ ] Every named file and symbol still exists or the ticket explicitly concerns its absence.
- [ ] Every dependency ticket is merged.
- [ ] No active ticket owns an overlapping write path.
- [ ] The focused baseline command runs, or its pre-existing failure is recorded.

If any prerequisite is false, stop with `BLOCKED`. Do not repair the prerequisite unless it is explicitly in scope.

## 6. In scope

- `<Permitted behavior change>`
- `<Focused regression or invariant evidence>`

Every item must directly establish the target contract.

## 7. Explicitly out of scope

- No `<neighboring layer or behavior>`.
- No dependency upgrades.
- No broad formatting or cleanup.
- No unrelated test repair.
- No pull-request merge, issue closure, or production-readiness claim.

Add ticket-specific exclusions. This section must not remain generic when the ticket moves to `READY`.

## 8. Write whitelist

The subagent may inspect the repository broadly but may write only to:

- `<exact path or narrow glob>`
- `<exact focused test path>`

Any additional writable path requires `NEEDS_SPLIT` unless the coordinator explicitly revises the ticket before work continues.

## 9. Write blacklist

The subagent must not edit:

- `<dangerous or tempting path>`
- dependency manifests or lockfiles unless this is explicitly a dependency ticket,
- deployment or migration files unless explicitly named,
- files owned by another active ticket.

## 10. Change budget

- **Behavioral contracts:** `1`
- **Production source files:** `<= 3`
- **Focused test files:** `<= 1`
- **New abstractions:** `<= 1`
- **Non-generated changed lines:** `<= 250`
- **Cross-layer changes permitted:** `<No, or exact narrow exception>`

When the correct implementation exceeds the budget, stop with `NEEDS_SPLIT`. Do not silently expand it.

## 11. Acceptance criteria

### AC1 — `<name>`

**Given** `<precondition>`  
**When** `<action>`  
**Then** `<precise observable result>`

### AC2 — `<name>`

`<Precise invariant or unchanged behavior.>`

### AC3 — No unrelated drift

Only write-whitelisted files change, and excluded contracts remain unchanged.

## 12. Required focused regression or invariant check

- **Test/command:** `<exact test name or command>`
- **Pre-change result:** `<failure or undesired state>`
- **Post-change result:** `<expected state>`

Create the failing regression first when practical.

## 13. Validation commands

Run in this order. Do not silently substitute commands.

### Focused validation

```bash
<exact focused command>
```

### Affected-subsystem validation

```bash
<exact subsystem command>
```

### Required broader validation

```bash
<exact broader command or explain why none is required>
```

### Diff and scope validation

```bash
git diff --check <BASE_SHA>...HEAD
git diff --name-status <BASE_SHA>...HEAD
git status --short
```

## 14. Expected evidence

The completion report must include:

- focused validation result,
- affected-subsystem result,
- required broader result,
- diff and changed-path review,
- final commit SHA when committed,
- explanation for every command not run.

## 15. Implementation constraints

- `<Preserve a public response shape, data rule, injection seam, or other constraint.>`
- Do not log prompts, story content, secrets, tokens, or authorization headers.
- Do not add unspecified fallback behavior.

Delete constraints that truly do not apply and add all ticket-specific ones.

## 16. Stop conditions

Stop with `BLOCKED` or `NEEDS_SPLIT` when:

- a required prerequisite is missing,
- a newer merged contract conflicts with this ticket,
- a product or architecture decision is required,
- the correct implementation requires a blacklisted layer,
- the write or change budget must be exceeded,
- an unrelated baseline failure prevents trustworthy validation,
- a migration, dependency change, secret, or external setting is unexpectedly required,
- the public API would need to broaden beyond the target contract.

## 17. Forbidden agent behavior

The subagent must not:

- merge its own branch or pull request,
- close issues or pull requests,
- rewrite or broaden this ticket,
- weaken tests to obtain green results,
- silently skip validation,
- repair unrelated findings,
- implement follow-up suggestions,
- claim preview success proves production readiness,
- declare the overall project complete.

## 18. Deliverable

Produce:

- one focused commit or isolated worktree result,
- focused regression or invariant evidence,
- the required completion report,
- suggested follow-up ticket titles only when needed.

Do not produce a new multi-phase roadmap.

## 19. Required completion report

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
