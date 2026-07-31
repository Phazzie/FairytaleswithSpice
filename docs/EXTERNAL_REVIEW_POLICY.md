# Story Lab External Review Policy

Last updated: 2026-07-31 01:57 EDT

Policy version: `story-lab-external-review/2026-07-31`

This is the canonical contract for programmatic Gemini/Antigravity and Jules review of Story Lab work. `AGENTS.md`, ExecPlans, and skills link here instead of copying a second state machine.

External review is currently **advisory and parent-inspected**. After the controller is merged and passes the harmless post-merge canary, exact-source binding and disposition completeness become a mechanical local gate. A required `story-lab/external-review-disposition` GitHub status is a separate user-authorized security design; the canary alone does not create or authorize it.

PR #198 freezes this policy but does not implement the controller, adapters,
canary, local enforcement, or GitHub status.

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

## Normative resource limits

The canonical limits profile is `story-lab-review-limits/v1`. All byte limits
measure exact UTF-8 or raw-stream bytes, not JavaScript character counts. The
committed review packet mirrors these values; a mismatch is a pre-contact
failure. These are controller acceptance requirements, not a claim that PR #198
implements them.

| Resource or phase | Exact limit |
|---|---:|
| Committed packet body | `131072` bytes |
| Private attempt envelope | `16384` bytes |
| Complete reviewer prompt/request | `196608` bytes |
| Each `agy --help` or `agy models` discovery command | `30000` ms |
| Each discovery stdout or stderr stream | `65536` bytes |
| Gemini review stdout | `262144` bytes |
| Gemini review stderr | `131072` bytes |
| Gemini `--print-timeout` | `180000` ms (`180s`) |
| Gemini controller deadline before termination | `210000` ms |
| Gemini `SIGTERM` grace | `5000` ms |
| Gemini `SIGKILL` and reap grace | `5000` ms |
| Gemini hard wall-clock maximum | `220000` ms |
| Keychain broker deadline | `30000` ms |
| Keychain broker stdout | `16384` bytes |
| Keychain broker stderr | `65536` bytes |
| Each Jules HTTP response body | `1048576` bytes |
| Each Jules HTTP request | `30000` ms |
| Jules poll interval | `10000` ms |
| Jules pre-approval create/reconcile/plan phase | `1200000` ms and at most `120` polls |
| Jules post-approval terminal phase | `1200000` ms and at most `120` polls |
| Jules overall session hard deadline | `2400000` ms |

The complete prompt includes controller instructions, packet, and private
envelope. It does not embed the full diff; the reviewer reads the immutable diff
inside the exact-SHA clone. Enforce Jules phase and overall limits with absolute
monotonic deadlines, so a slow `30000` ms HTTP request cannot extend a phase or
increase its poll allowance.

Reject an oversized packet, envelope, or complete prompt before contacting a
reviewer. Discovery overflow or timeout fails discovery. Gemini output overflow
terminates and reaps the process group and yields no receipt. A Jules response
overflow, request timeout, phase timeout, poll overflow, or overall timeout
invalidates the attempt and never authorizes a blind retry.

## Gemini through Antigravity

Resolve the Antigravity binary without a machine-specific path. Precedence is:

1. an absolute executable regular file supplied by `ANTIGRAVITY_BIN`;
2. an executable `agy` found by searching only absolute, non-empty entries from
   the controller-startup `PATH`; then
3. `path.join(os.homedir(), ".local", "bin", "agy")`.

Fail closed if none resolves. Resolve symlinks, require an executable regular
file, and record the resolved path only in private attempt state. Do not use a
shell, `which`, shell expansion, the current directory, an empty/relative
`PATH` entry, or a remembered workstation path. Discover the interface at
runtime with bounded `agy --help` and `agy models` commands; a remembered model
alias is not authoritative.

At the 2026-07-30 contract freeze, the verified high-reasoning Gemini model name is `gemini-3.1-pro-high`. The generic combination `--model pro --effort high` is invalid on this installation. The automation must stop if the required model or flags are absent; it must not silently fall back to another model.

### Safe process contract

- Launch asynchronously with an argument array and `shell: false`.
- Pass the complete bounded prompt as one `-p`/`--prompt` argument.
- Close or ignore stdin.
- Use `--model gemini-3.1-pro-high`, `--mode plan`, `--sandbox`, and
  `--print-timeout 180s` only after bounded current help/model discovery
  confirms them.
- Never use `echo ... | agy`, prompt-over-stdin, shell command substitution, or a reused Antigravity conversation.
- Never use `--dangerously-skip-permissions`. Review runs are read-only and sandboxed.
- Use a fresh disposable clone at the exact head, remove its remotes, and prove it clean before and after review.
- Give the child only an allowlisted environment. Omit GitHub, Jules, OpenAI, Clerk, Neon, Vercel, xAI, database, deployment, and other provider credentials.
- In the user-private state directory, stage a complete bounded `PRE_SPAWN`
  record in a same-filesystem `0600` claim file. It contains the attempt ID,
  unguessable claim nonce, controller PID, null child process-group ID, creation
  time, and phase. Fsync the file, atomically hard-link it to the fixed
  `gemini.lock` path without replacement, and fsync the lock directory. A
  pre-existing destination returns `REVIEW_BUSY`; a crash before the link leaves
  no active lock. Never wait, overwrite, auto-delete, or break a lock based on
  age or a PID-only guess.
- No child may spawn until the owner has atomically replaced and fsynced the
  complete lock record as `SPAWN_MAY_HAVE_OCCURRED`. After detached spawn
  returns, atomically replace and fsync a complete `RUNNING` record with the
  child process-group ID. Every transition uses a staged same-filesystem file,
  full-record validation, atomic rename, and directory fsync; readers therefore
  see an old or new complete record, never a torn update. The owner removes the
  lock only after the complete child group is reaped and private results are
  durable.
- A crash-left lock is handled only by an explicit parent-owned
  `recover-gemini-lock` command with the exact attempt ID and claim nonce. It
  refuses while the controller PID exists. `PRE_SPAWN` may be atomically renamed
  into that attempt's private quarantine because spawn is forbidden before the
  next phase is durable. `SPAWN_MAY_HAVE_OCCURRED`, malformed, or unknown state
  remains fail-closed as `REVIEW_RECOVERY_REQUIRED`; it cannot be quarantined
  until a separately recorded host restart or another authoritative procedure
  proves all candidate reviewer processes absent. `RUNNING` additionally
  requires an authoritative absent process-group probe; any live, permission
  denied, ambiguous, or reused ID remains busy. Recovery renames rather than
  deletes evidence and fsyncs both directories.
- Enforce every value in `story-lab-review-limits/v1`.
- At the `210000` ms controller deadline, send `SIGTERM` to the complete
  detached process group, allow `5000` ms, then send `SIGKILL` if needed and
  require reaping within another `5000` ms. The hard maximum is `220000` ms.
  Prove the group exited before releasing the lock.

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

The reviewer-returned closed receipt contains no stdout or stderr hash fields.
It cannot contain a hash of the stdout bytes that contain that same object.
After the child is fully reaped, the controller hashes the exact raw bytes
captured on each complete stream, including final newlines and before decoding
or whitespace handling. It writes the byte lengths and SHA-256 hashes to the
private controller-owned `attempt-result.json`, distinct from
`reviewer-receipt.json`. Raw streams, hashes, and attempt results are never
published automatically. An overflowed stream cannot produce a valid receipt or
be mislabeled as a complete-stream hash.

## Jules

Jules review is a review-only advisory: any write or change-set evidence
invalidates it. This skill and every reviewer session have no credential access.
Only a future parent-owned Jules adapter may retrieve the `codex-jules-api`
item from macOS Keychain at request time. Its sole credential broker is the
absolute system binary `/usr/bin/security`, launched with an argument array
equivalent to `find-generic-password -w -s codex-jules-api`, `shell: false`,
ignored stdin, an allowlisted environment, and the exact broker deadline and
stream limits in `story-lab-review-limits/v1`. No shell, PATH lookup, account
enumeration, fallback command, or caller-supplied service name is allowed.

The broker's bounded stdout pipe is the one permitted child-process boundary
for the credential. The parent adapter captures it only in memory, removes
exactly one terminal line ending, rejects empty, multiline, NUL-containing,
overflowed, timed-out, signaled, or nonzero-exit output, and uses the result
solely as the in-process `x-goog-api-key` header. Raw stdout and stderr are never
logged, hashed, persisted, or returned to the skill/reviewer; the parent
zero-fills owned buffers after the HTTP request completes. The value never
enters argv, environment, stdin, a prompt, repository or temporary files,
adapter state, logs, reviewer clone, shell history, or chat. If the fixed broker
is absent, not an executable regular file, or retrieval fails, stop with
`REVIEW_UNAVAILABLE`; do not improvise a credential command or request a pasted
key. The service name is configuration metadata, not a credential value or file
path.

Use the current Jules `v1alpha` API only after a live schema discovery confirms it. Bind the exact connected repository and create a unique slash-free branch alias at the reviewed SHA.

Launch requirements:

- use a unique packet ID, revision, and exact session title;
- send `startingBranch` and `requirePlanApproval: true`;
- omit `automationMode`;
- persist `POSTING` state before the launch request;
- on timeout or ambiguous response, reconcile by exact title and repository; never blind-retry;
- reject unknown API fields, states, or multiple matching sessions.
- enforce the `30000` ms request, `10000` ms poll, `1048576` byte response,
  `1200000` ms pre-approval, `120` pre-approval poll, and `2400000` ms overall
  limits from `story-lab-review-limits/v1`;

Plan requirements:

- hash the protected plan fields;
- parent feedback is supplied through a dedicated file/argument, never stdin;
- feedback invalidates the prior plan digest;
- parent approves only the exact current digest;
- reject any plan that proposes reading `.env` or secrets; writing code; installing dependencies; creating a change set, branch, commit, PR, or comment; merging; deploying; migrating; provisioning; or contacting an unrelated external service.

After exact-digest approval, enforce the separate `1200000` ms and `120` poll
terminal limits without extending the `2400000` ms overall deadline. Harvest
only a terminal session. Reject the result for a wrong base, changed plan
digest, missing required sections, unsafe command, change set, dirty working
state, unknown terminal state, malformed control envelope, phase deadline,
overall deadline, response overflow, or poll overflow. A valid result is labeled
`FORMAT_VALID_ADVISORY`, never “approved.” A timed-out or ambiguous attempt is
reconciled authoritatively before any later attempt; it is never blind-retried.

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
- controller-owned Gemini and required Jules attempt-result hashes plus the
  reviewer-receipt hashes;
- normalized findings;
- parent dispositions and evidence links.

If a trusted GitHub producer is separately approved and implemented, its status must be absent or failing if any required binding is stale, a required attempt is invalid, a blocking finding is not closed under the matrix above, or a material finding lacks disposition.

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
    attempts/<attempt-id>/reviewer-receipt.json
    attempts/<attempt-id>/attempt-result.json
    attempts/<attempt-id>/quarantine/gemini-lock.json
    locks/claims/<attempt-id>-<claim-nonce>.json
    locks/gemini.lock
    jules/<packet-id>/state.json

Permissions should restrict the current user. Sanitize any durable evidence before committing it. Logs name secret variables only; they never print values.

For Gemini, a valid private attempt result requires complete `stdout` and
`stderr` artifacts with exact byte lengths and hashes, exit code/signal,
timeout/overflow flags, limits profile, reviewer-receipt hash, and validation
outcome. For Jules, it requires a deterministic manifest of every captured
create, reconciliation, plan, approval, poll, terminal-session, and
terminal-result response, with exact byte lengths and hashes, plus the approved
plan digest and terminal state. A missing captured artifact, incomplete stream,
overflow, or unknown state makes the advisory invalid. These controller-owned
records are not fields in either reviewer-returned JSON schema.

## Failure behavior

An invalid, unavailable, locked, oversized, overflowed, poll-exhausted, or
timed-out reviewer produces no passing receipt. Report the exact mechanical
failure and keep the status absent/failing when the review is required.

Do not:

- reinterpret prose as valid JSON;
- treat exit code zero as sufficient;
- weaken a required review to optional after a failure;
- retry an ambiguous external POST blindly;
- ask a reviewer to mutate code to resolve its own finding;
- let external review replace tests or user acceptance; or
- claim both reviewers inspected a candidate unless exact-head receipts exist for both.

Reviewer conclusions are always advisory. Before the canary passes, receipt binding and disposition completeness are also parent-inspected rather than mechanically trusted; say so explicitly. The parent may continue only under the applicable plan's documented bootstrap rule.
