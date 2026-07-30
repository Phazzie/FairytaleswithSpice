---
name: fairytales-external-review
description: Use when planning, invoking, validating, or dispositioning Gemini Antigravity or Jules review for /Users/hbpheonix/fairytaleswithspice, especially for ExecPlan freezes, final candidate heads, high-risk Story Lab PRs, review-receipt failures, or claims that external review passed.
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

1. Confirm the repo and run `git status --short --branch`.
2. Read the active ExecPlan and `AGENTS.md`.
3. Confirm the target base and head are immutable commits.
4. Build the committed packet body from `git show <head>:<path>`, not the working tree.
5. Build a private attempt envelope that binds attempt ID, schema/policy version, base/head SHA, packet path/blob SHA, and packet digest. Do not require the committed packet to contain its own head SHA.
6. Exclude secrets, private story content, raw provider payloads, and production customer data.
7. Record the exact tests and sanitized exit-code evidence. Do not convert an unrun check into a claim.

## Invoke safely

For Antigravity:

- discover current help and models;
- launch `agy` with an argument array, `shell: false`, and ignored stdin;
- pass the full bounded prompt as the `-p` argument;
- use a fresh exact-SHA clone with remotes removed and an allowlisted environment;
- use sandboxed plan mode and a bounded timeout;
- never use a pipe, shell substitution, reused conversation, `--effort`, generic `--model pro`, or `--dangerously-skip-permissions`.

For Jules:

- obtain the credential from the designated Keychain service;
- use the exact connected repo and unique slash-free exact-SHA alias;
- persist `POSTING` before launch and reconcile an ambiguous response by exact title;
- require plan approval, hash the protected plan, and approve only that exact digest;
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

Never reduce that to “Gemini/Jules passed.”
