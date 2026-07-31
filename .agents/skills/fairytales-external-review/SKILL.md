---
name: fairytales-external-review
description: Use when planning, invoking, validating, or dispositioning Gemini Antigravity or Jules review in the FairytaleswithSpice repository, especially for ExecPlan freezes, final candidate heads, high-risk Story Lab PRs, review-receipt failures, or claims that external review passed.
---

# Fairytales External Review

## Rule

External reviewers provide exact-source advisory evidence. They do not replace parent judgment, tests, user acceptance, or deployment proof.

Read `docs/EXTERNAL_REVIEW_POLICY.md` completely before invoking or claiming Gemini or Jules review. Use [references/review-contract.md](references/review-contract.md) as the compact execution checklist. If they conflict, the repo policy wins.

Until the post-merge controller canary passes, describe this review as advisory and parent-inspected. Do not claim the GitHub disposition status is mechanically enforced.

## Choose the cadence

For every coherent PR, require local Scope Prosecutor, local Completion Prosecutor, independent tests, one Gemini review at the final committed head, and parent dispositions.

Add Jules at the final head for auth/ownership, cloud data, privacy/redaction/streaming, jobs/durability/queues, routes/deployment, major dependency changes, plan freezes, final Living Book, and final production closure.

Do not review every microticket. Any tracked commit after review invalidates the receipt.

## Prepare

1. Discover the repository root with Git. Confirm the Fairytales control files
   and, when a remote exists, the normalized `Phazzie/FairytaleswithSpice`
   identity. Do not require a workstation path.
2. Run `git status --short --branch` and `npm run recovery:status`.
3. Read `AGENTS.md`, `.agent/PLANS.md`, and both current plans:
   `STORY_LAB_FOUNDATION_AND_LIVING_BOOK_EXEC_PLAN.md` and
   `STORY_LAB_PRODUCTION_COMPLETION_EXEC_PLAN.md`.
4. Reject Plan 2 review/readiness work while `PLAN_1_MERGE_SHA` is empty,
   malformed, `TO_BE_RECORDED`, unresolved, non-ancestor, or not activated by
   merged P1-06. For Plan 1 review, record the unresolved value as an explicit
   Plan 2 non-claim rather than falsely treating Plan 2 as active.
5. Confirm the target base and head are immutable commits.
6. Build the committed packet body from `git show <head>:<path>`, not the working tree.
7. Build a private attempt envelope that binds attempt ID, schema/policy version, base/head SHA, packet path/blob SHA, and packet digest. Do not require the committed packet to contain its own head SHA.
8. Exclude secrets, private story content, raw provider payloads, and production customer data.
9. Record the exact tests and sanitized exit-code evidence. Do not convert an unrun check into a claim.

## Invoke safely

For Antigravity:

- resolve and verify the executable through the policy's portable precedence;
- atomically publish the policy's complete phased Gemini claim or stop
  `REVIEW_BUSY`; never spawn before `SPAWN_MAY_HAVE_OCCURRED` is durable, never
  auto-break a lock, and use only exact-attempt parent-owned recovery with
  authoritative process-absence proof;
- discover current help and models within `story-lab-review-limits/v1`;
- launch `agy` with an argument array, `shell: false`, and ignored stdin;
- pass the full bounded prompt as the `-p` argument;
- use a fresh exact-SHA clone with remotes removed and an allowlisted environment;
- use sandboxed plan mode and every exact prompt/output/process limit in
  `story-lab-review-limits/v1`;
- never use a pipe, shell substitution, reused conversation, `--effort`, generic `--model pro`, or `--dangerously-skip-permissions`.
- terminate and reap the complete process group on failure, recheck the clone is
  clean, then write private post-capture artifact hashes outside the reviewer
  receipt.

For Jules:

- give the skill and reviewer no credential access; only a future parent-owned
  Jules adapter may retrieve the configured Keychain item at request time
  through the policy's bounded, no-shell `/usr/bin/security` broker;
- stop `REVIEW_UNAVAILABLE` if that adapter is absent or retrieval fails; never
  improvise a credential command or ask for a pasted key;
- use the exact connected repo and unique slash-free exact-SHA alias;
- persist `POSTING` before launch and reconcile an ambiguous response by exact title;
- require plan approval, hash the protected plan, and approve only that exact digest;
- enforce every request, response, poll, phase, and overall deadline in
  `story-lab-review-limits/v1`;
- reject any write, dependency, branch, PR, merge, deploy, migration, provision, secret, or change-set proposal;
- harvest only a valid terminal advisory.

Never expose credential values or raw reviewer output.

## Validate and disposition

Reject malformed output, stale bindings, wrong model/session/base, timeout, overflow, auth/error prose, reviewer mutation, unknown schema/state, or dirty before/after state.

Normalize findings, deduplicate them, and record one allowed disposition for every material finding:

- `FIXED`
- `REJECTED_WITH_EVIDENCE`
- `DUPLICATE`
- `OUT_OF_SCOPE_LINKED`
- `DEFERRED_USER_AUTHORIZED`

Apply the severity/disposition matrix in the canonical policy. The parent alone posts comments. It posts `story-lab/external-review-disposition` only when a separately approved trusted producer exists.

## Bootstrap boundary

The controller PR cannot certify itself. Require deterministic tests, parent review, local Completion Prosecutor, directly inspected live advisories, and a recorded bootstrap waiver.

After it merges, run the harmless canary from the controller on `origin/main`. Wrong-head, stale-packet, invalid-JSON, ambiguous-POST, undispositioned-P1, self-success, and post-review-commit cases must all fail before the local gate is used. A required GitHub status additionally needs a separately approved producer/trust/signing/permissions/rollback design.

## Report

State separately:

- exact head reviewed;
- which reviewers produced valid bound receipts;
- which tests were independently run;
- findings and parent dispositions;
- whether enforcement is advisory, canary-proven, or required;
- limitations and unverified layers.

Before every repo-work session ends, run `npm run recovery:finish`. Use
`npm run recovery:finish -- --strict` instead for PR-ready, merge-ready, or
final-completion claims. A failed or unrun strict check means the package is not
PR-ready.

Never reduce that to “Gemini/Jules passed.”
