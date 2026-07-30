# Story Lab External Review Policy

Last updated: 2026-07-30 05:43 EDT

This is the canonical contract for programmatic Gemini/Antigravity and Jules review of Story Lab work. `AGENTS.md`, ExecPlans, and skills link here instead of copying a second state machine.

External review is currently **advisory and parent-inspected**. After the controller is merged and passes the harmless post-merge canary, exact-source binding and disposition completeness become a mechanical local gate. A required `story-lab/external-review-disposition` GitHub status is a separate user-authorized security design; the canary alone does not create or authorize it.

If a trusted status is later implemented, it proves only that correctly bound review receipts exist and material findings have closing dispositions. It does not prove that a reviewer is correct, that tests passed, that code is secure, or that the product is accepted.

## Cadence

Every coherent Story Lab PR uses:

1. local read-only Scope Prosecutor before edits;
2. parent scope lock and tiny disjoint worker leases;
3. local read-only Completion Prosecutor after integration;
4. parent-run focused and aggregate tests;
5. Gemini once at the committed final candidate head; and
6. parent disposition of all material findings.

Jules additionally reviews the final candidate head when a PR changes:

- authentication, identity, ownership, or authorization;
- cloud/database persistence, migrations, retention, or deletion;
- privacy, CORS, streaming, redaction, or private exports;
- jobs, leases, retries, process-loss behavior, queues, or durability;
- deployable routes, Vercel function budget, deployment, or rollback;
- major dependencies or framework versions.

Both Gemini and Jules review:

- an ExecPlan or security/production contract freeze;
- the final Living Book candidate;
- a combined high-risk PR; and
- final production closure.

Microtickets do not each receive external review. They receive scoped tests and parent integration. A tracked commit after external review makes the receipt stale and requires a new review.

## Parent-owned responsibilities

The parent agent alone:

- chooses scope and reviewer cadence;
- supplies committed exact-source packets;
- judges whether feedback is correct;
- deduplicates findings;
- changes shared files;
- posts or resolves GitHub comments;
- approves a Jules plan;
- posts a disposition status only when a separately approved trusted producer exists;
- pushes, merges, deploys, migrates, provisions, changes repository rules, or changes runtime controls.

External reviewers and subagents are read-only unless a separate worker ticket explicitly grants a bounded repo-file lease. An external-review session never has a write lease.

## Packet and attempt-envelope contract

A review packet body is committed before review and is small enough to inspect. It contains:

- schema and policy version;
- packet ID and revision;
- repository identity;
- PR or plan identifier;
- intent and acceptance criteria;
- exact in-scope and explicit out-of-scope files/behavior;
- required diff commands;
- verification commands and sanitized exit-code evidence;
- security/privacy/durability non-claims;
- requested review lenses;
- required response schema.

The committed packet body does not contain its own final commit SHA; that would be self-referential and impossible to construct reliably. After the candidate is committed, the controller creates a private attempt envelope containing:

- unique attempt ID;
- immutable base and head commit SHAs;
- committed packet path and blob SHA;
- SHA-256 digest of the exact packet bytes;
- policy version and requested reviewer/model;
- creation time and bounded diff command.

Build packet bytes from `git show <head>:<packet-path>`, never from a dirty working tree. Build the diff from the immutable base and head. The reviewer prompt combines the committed packet body with the controller-generated envelope and requires the receipt to echo the envelope bindings. Reject a missing commit, non-ancestor base, uncommitted packet, changed head, oversized packet, or digest mismatch before contacting a reviewer.

Never include credentials, `.env` contents, private story prose, raw provider payloads, raw IP addresses, access tokens, cookies, or production customer data.

## Gemini through Antigravity

On the current workstation the installed binary resolves to `/Users/hbpheonix/.local/bin/agy`. The controller must accept an explicit `ANTIGRAVITY_BIN` override and otherwise resolve `.local/bin/agy` from the current user's home without shell expansion. Its interface must be discovered at runtime with `agy --help` and `agy models`; a remembered path or model alias is not authoritative.

At the 2026-07-30 contract freeze, the verified high-reasoning Gemini model name is `gemini-3.1-pro-high`. The generic combination `--model pro --effort high` is invalid on this installation. The automation must stop if the required model or flags are absent; it must not silently fall back to another model.

### Safe process contract

- Launch asynchronously with an argument array and `shell: false`.
- Pass the complete bounded prompt as one `-p`/`--prompt` argument.
- Close or ignore stdin.
- Use `--model gemini-3.1-pro-high`, `--mode plan`, `--sandbox`, and a bounded `--print-timeout` such as `180s` only after current help/model discovery confirms them.
- Never use `echo ... | agy`, prompt-over-stdin, shell command substitution, or a reused Antigravity conversation.
- Never use `--dangerously-skip-permissions`. Review runs are read-only and sandboxed.
- Use a fresh disposable clone at the exact head, remove its remotes, and prove it clean before and after review.
- Give the child only an allowlisted environment. Omit GitHub, Jules, OpenAI, Clerk, Neon, Vercel, xAI, database, deployment, and other provider credentials.
- Hold a single Gemini attempt lock.
- Enforce prompt, stdout, stderr, and wall-clock bounds.
- On timeout, terminate the complete detached process group, prove it exited, and only then release the lock.

Conceptual Node launch:

```js
spawn(
  agyPath,
  [
    "-p",
    completeBoundedPrompt,
    "--model",
    "gemini-3.1-pro-high",
    "--mode",
    "plan",
    "--sandbox",
    "--print-timeout",
    "180s",
  ],
  {
    shell: false,
    cwd: exactShaDisposableClone,
    env: allowlistedEnvironment,
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  },
);
```

This is an interface contract, not permission to copy an unbounded packet into a shell command.

### Gemini receipt

Stdout must be exactly one JSON object with:

- schema version;
- reviewer and model;
- attempt ID;
- base SHA, head SHA, packet blob SHA, and packet digest;
- verdict: `ADVISORY_CLEAR` or `ADVISORY_FINDINGS`;
- findings array;
- reviewed test-evidence identifiers;
- limitations.

Each finding has a stable ID, severity `P0` through `P3`, concise title, evidence with current file/line or packet section, impact, and recommended correction.

Reject the attempt for:

- empty output;
- prose or Markdown fences around JSON;
- invalid or unknown JSON;
- missing or wrong binding fields;
- stale head or packet;
- known auth, quota, model, tool, or permission error text, even with exit code zero;
- timeout or output overflow;
- a dirty clone before or after;
- a reviewer-created file or process that survives cleanup;
- a nonzero exit; or
- a model/flag different from the discovered and recorded invocation.

Raw stdout and stderr remain private. Hash them for the receipt; do not publish them automatically.

## Jules

Jules review is advisory and read-only. Credentials come from the macOS Keychain service `codex-jules-api`; no token appears in a prompt, file, log, state record, shell history, or chat.

Use the current Jules `v1alpha` API only after a live schema discovery confirms it. Bind the exact connected repository and create a unique slash-free branch alias at the reviewed SHA.

Launch requirements:

- use a unique packet ID, revision, and exact session title;
- send `startingBranch` and `requirePlanApproval: true`;
- omit `automationMode`;
- persist `POSTING` state before the launch request;
- on timeout or ambiguous response, reconcile by exact title and repository; never blind-retry;
- reject unknown API fields, states, or multiple matching sessions.

Plan requirements:

- hash the protected plan fields;
- parent feedback is supplied through a dedicated file/argument, never stdin;
- feedback invalidates the prior plan digest;
- parent approves only the exact current digest;
- reject any plan that proposes reading `.env` or secrets; writing code; installing dependencies; creating a change set, branch, commit, PR, or comment; merging; deploying; migrating; provisioning; or contacting an unrelated external service.

Harvest only a terminal session. Reject the result for a wrong base, changed plan digest, missing required sections, unsafe command, change set, dirty working state, unknown terminal state, or malformed control envelope. A valid result is labeled `FORMAT_VALID_ADVISORY`, never “approved.”

## Findings and dispositions

The parent deduplicates external and local findings before publication. Current-line findings may become focused review comments. Cross-cutting findings become one summary. Raw reviewer prose is not copied wholesale.

Allowed dispositions:

- `FIXED`: the final head contains the fix and its proof.
- `REJECTED_WITH_EVIDENCE`: the finding is incorrect or inapplicable, with concrete source/test evidence.
- `DUPLICATE`: another finding owns the same root cause.
- `OUT_OF_SCOPE_LINKED`: valid but outside the frozen PR, with a durable issue/plan link and risk explanation.
- `DEFERRED_USER_AUTHORIZED`: the user explicitly accepted the named risk.

Severity-by-disposition matrix:

| Severity | Dispositions that close the finding | Dispositions that remain blocking |
|---|---|---|
| P0 | `FIXED`; `REJECTED_WITH_EVIDENCE`; `DUPLICATE` only when the named canonical P0 is closed | `OUT_OF_SCOPE_LINKED`; `DEFERRED_USER_AUTHORIZED`; duplicate whose canonical finding is still open |
| P1 | `FIXED`; `REJECTED_WITH_EVIDENCE`; `DUPLICATE` only when the named canonical finding is closed; `DEFERRED_USER_AUTHORIZED` only when the user names the exact risk and the active ExecPlan permits that deferral | `OUT_OF_SCOPE_LINKED`; unauthorized deferral; duplicate whose canonical finding is still open |
| P2 | Any allowed disposition with its required evidence/link/authorization | Missing, malformed, or unsupported disposition |
| P3 | Recorded as non-blocking or given any allowed disposition | Any P3 that actually demonstrates an unmet acceptance criterion is reclassified to P2 or higher |

`REJECTED_WITH_EVIDENCE` means the finding is disproved, not waived. `DUPLICATE` names the canonical finding ID and inherits its state. A P0 can never be deferred. An out-of-scope P0/P1 remains a blocker for the current head even when a follow-up is linked.

The disposition digest binds:

- current head SHA;
- policy version;
- packet digest;
- Gemini and required Jules attempt hashes;
- normalized findings;
- parent dispositions and evidence links.

If a trusted GitHub producer is separately approved and implemented, its status must be absent or failing if any required binding is stale, a required attempt is invalid, a blocking finding is not closed under the matrix below, or a material finding lacks disposition.

## Bootstrap and anti-self-certification

The first controller PR cannot emit a successful `story-lab/external-review-disposition` for itself.

It must instead have:

- dependency-free deterministic fake-process and fake-HTTP tests;
- local Scope and Completion prosecution;
- direct parent inspection of live Gemini and Jules results;
- ordinary repository tests;
- one explicit bootstrap waiver recorded in the PR.

After merge, run the controller from a clean checkout of merged `origin/main` against a harmless canary PR. It must prove all of these fail:

- wrong head;
- stale packet;
- invalid Gemini JSON;
- ambiguous Jules POST without successful reconciliation;
- undispositioned P1;
- bootstrap mode attempting to post success; and
- any tracked commit after receipt creation.

Only after all negative cases and a valid path behave correctly may the local gate be used. Requiring a GitHub status additionally needs an approved design that fixes the producer identity, trusted default-branch code source, event/trigger, permissions, signing or credential boundary, candidate-code isolation, rule enablement, and rollback. Without that design, keep GitHub enforcement disabled.

Future controller-changing PRs are graded by the controller version already on `origin/main`, from a separate clean checkout. Candidate code never grades itself. If the old controller cannot understand a proposed schema, use another explicit bootstrap waiver and canary; never silently switch graders.

## Private state and logging

Store raw attempts under `.git/story-lab-external-review/`, outside tracked source:

    attempts/<attempt-id>/request.json
    attempts/<attempt-id>/stdout.bin
    attempts/<attempt-id>/stderr.bin
    attempts/<attempt-id>/receipt.json
    locks/gemini.lock
    jules/<packet-id>/state.json

Permissions should restrict the current user. Sanitize any durable evidence before committing it. Logs name secret variables only; they never print values.

## Failure behavior

An invalid, unavailable, or timed-out reviewer produces no passing receipt. Report the exact mechanical failure and keep the status absent/failing when the review is required.

Do not:

- reinterpret prose as valid JSON;
- treat exit code zero as sufficient;
- weaken a required review to optional after a failure;
- retry an ambiguous external POST blindly;
- ask a reviewer to mutate code to resolve its own finding;
- let external review replace tests or user acceptance; or
- claim both reviewers inspected a candidate unless exact-head receipts exist for both.

Reviewer conclusions are always advisory. Before the canary passes, receipt binding and disposition completeness are also parent-inspected rather than mechanically trusted; say so explicitly. The parent may continue only under the applicable plan's documented bootstrap rule.
