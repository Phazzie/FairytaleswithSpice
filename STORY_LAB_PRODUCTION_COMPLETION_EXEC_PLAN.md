# Story Lab Production Completion ExecPlan

Last updated: 2026-07-31 01:57 EDT

This is Plan 2 of the current two-plan Story Lab completion sequence. It is a
living ExecPlan governed by `.agent/PLANS.md`. It begins only after P1-01
through P1-06 in `STORY_LAB_FOUNDATION_AND_LIVING_BOOK_EXEC_PLAN.md` are merged
and P1-06 has recorded the exact accepted P1-05 merge commit below.

    PLAN_1_MERGE_SHA: TO_BE_RECORDED

The Plan 2 entry gate is **closed** while the value committed on fetched
`origin/main` is empty, malformed, `TO_BE_RECORDED`, unresolved as a commit, not
an ancestor of that exact `origin/main`, or not yet merged through P1-06. A
working-tree or open-branch replacement never satisfies this gate. Every Plan 2
entrypoint must reject those states before Queue Gate 0, a branch, or
implementation work.

Do not replace the placeholder from memory or a local feature branch. P1-06
records the full GitHub merge commit for the accepted P1-05 Living Book
candidate, fetches it from `origin/main`, and proves a clean detached worktree
starts at that exact commit. Plan 2 then branches from current `origin/main`,
which includes the later P1-06 activation merge; it does not branch from the
older recorded P1-05 commit.

This plan owns production completion after the accepted Living Book: a non-merge Queue feasibility gate, then ten coherent PRs covering test-truth repair, provider budgets, Clerk authentication, Neon persistence, recoverable jobs, Vercel Queue and Cron integration, browser recovery, legacy-route retirement, staged production release, and the final evidence report.

## Purpose and user-visible result

When this plan is complete:

- a visitor can still create and continue a story without signing in, within explicit abuse and provider-cost limits;
- a signed-in user can save private projects, submit one recoverable generation job, reload or close the browser, and later see the committed result;
- one user cannot read, mutate, retry, or delete another user's projects or jobs;
- job delivery can repeat without committing duplicate results;
- stalled publication can recover automatically without relying on a browser tab;
- private tokens, story bodies, provider payloads, and raw IP addresses do not appear in browser URLs, browser persistence, public logs, queue messages, or public review artifacts;
- exactly the two old streaming routes, `api/story-lab/stream/genesis.ts` and
  `api/story/stream.ts`, are removed only after their replacements pass
  exact-preview failure testing;
- `api/story/generate.ts` and `api/story/continue.ts` remain as deprecated,
  measured POST compatibility routes during this plan;
- production is enabled in stages with an exercised rollback; and
- the final report distinguishes deterministic tests, provider previews, real-browser proof, production proof, and remaining non-claims.

## Context and orientation

- Before any Plan 2 work, verify that P1-01 through P1-06 are merged, the user
  accepted the P1-05 candidate, and P1-06 recorded and proved its exact merge
  commit above.
- Start every PR from current `origin/main`, never from a Plan 1 candidate worktree.
- Re-run all platform/version/plan assumptions at the PR that consumes them. Queue and Cron behavior is temporally unstable.
- Keep the accepted Living Book visual structure unless a production-state defect requires a narrow change.
- Do not add a second queue or workflow provider preemptively. Queue Gate 0 either proves the chosen Vercel design or stops for a user-visible architecture decision.
- At-least-once delivery does not mean exactly-once execution. The promised invariant is at-most-one committed result per execution token and idempotent recovery.
- Vercel Queue messages contain identifiers and protocol version only, never prompts, story bodies, auth tokens, or provider responses.
- Vercel Cron wakes the outbox dispatcher. It does not run story generation.
- Do not call an in-memory or single-process store durable.
- Do not call a mock, fake, emulator, local PostgreSQL, preview-only test, or provider health endpoint production proof.
- Do not increase the Vercel function budget without an explicit route consolidation decision.

## Locked product and operating decisions

These defaults make the plan executable. They may be changed only by updating this Decision Log before the affected PR starts.

### Identity and guest use

- Anonymous create and continue remain supported through the existing request-inline path.
- Anonymous requests do not create cloud projects or durable background jobs.
- The anonymous quota key is an HMAC of normalized client IP plus an opaque browser-install identifier. Raw IP is never stored.
- Anonymous default limit: one active generation request and three generation attempts per rolling 24 hours per quota key.
- Signed-in default limit: one queued/running job and twenty generation attempts per rolling 24 hours per Clerk subject.
- A limit can be lowered through reviewed runtime configuration. Raising it requires a policy change with cost evidence.

### Provider budget

- Anonymous request-inline work has one absolute 60-second deadline covering primary generation, fallback generation, chapter shaping, and continuity work. Reserve its final 8 seconds for response normalization and a controlled error.
- A durable queue consumer may use a 300-second function only if Queue Gate 0 proves it on the actual Vercel project. Its one absolute provider budget is 240 seconds, with the remaining time reserved for persistence, acknowledgement, and a controlled error.
- No stage or fallback resets either absolute deadline.
- Maximum request is three chapters.
- Default global provider-output ceiling is 500,000 tokens per rolling UTC day.
- Default monetary reservation ceiling is USD $25 per month and $0.25 per durable job; the lower token or monetary ceiling wins.
- Default global queued cap is 50 and database-authoritative running-lease cap is two.
- Maximum accepted body is 256 KiB, maximum provider attempts are three, and maximum provider calls per durable job are four.
- Every attempt records owner or anonymous quota key, stage, model/provider, input/output token counts when available, estimated cost, outcome, and redacted error class.
- `jobs_accepting` and `queue_processing` are independent global kill switches and default false during release.
- `STORY_LAB_JOBS_ENABLED=0` remains an environment-level hard stop above database controls.
- Limit failures return `429` with a bounded `Retry-After`; provider-budget exhaustion fails closed without launching a call.

### Persistence and retention

- User-saved projects persist until the user deletes them or deletes the account.
- Successful terminal jobs scrub stored request bodies immediately after the durable project/result commit.
- Successful job results remain recoverable for seven days, then the job result copy is purged; the user-saved project remains.
- Failed or cancelled job request bodies remain at most 24 hours for a controlled retry, then are scrubbed.
- Job events contain progress metadata and redacted error classes only, never story prose or prompts.
- Outbox rows retain delivery metadata for seven days after acknowledgement, then are purged.
- Terminal job metadata remains for 30 days; redacted usage/cost rows remain for 90 days.
- Account deletion cascades projects, jobs, job events, quota/usage ownership links, and pending outbox work.
- A worker completing after owner deletion discards its result and cannot recreate the owner or job.
- Provider requests set `store: false` when supported.

### Browser transport and secrets

- The final signed-in job transport is authenticated adaptive polling, not browser SSE.
- Poll at approximately 2, 4, 8, then 15 seconds with jitter; pause while the document is hidden; poll immediately on visibility return.
- Before submitting a job, the browser stores only an opaque pending-attempt marker. The response replaces it with an opaque job ID.
- Bearer tokens are attached only to protected account, project, and job requests. They never appear in URLs or persistent browser storage.
- Clerk production verification uses `authenticateRequest` with `CLERK_SECRET_KEY`, rotating JWKS, `acceptsToken: "session_token"`, authorized parties, and `sub` as the owner identity. A static JWT key is allowed only for explicitly scoped local/offline tests.

### Platform topology

- Queue package candidate: exact `@vercel/queue@0.4.0`, which was the registry `latest` on 2026-07-30. Re-check before install.
- Queue topic: `story-lab-generation-v1`.
- Queue region: `iad1`; place the production database in a compatible east-US region unless Gate 0 records a better current topology.
- Private queue consumer candidate: `api/story-lab/job-consumer.ts`, using the currently documented `new QueueClient().handleNodeCallback` interface for plain Vercel Node functions.
- Cron calls a protected dispatcher operation consolidated inside the existing `api/story-lab/jobs.ts` function. Do not spend another function slot on a standalone dispatcher route.
- Queue job-message schema: `{ "version": 1, "type": "job", "jobId": "<opaque id>", "generation": 1 }`. `generation` prevents a stale redelivery from superseding a later database requeue generation.
- Database is the source of truth. Queue delivery is a wake-up signal.
- Vercel Queues currently provides at-least-once delivery and no built-in dead-letter queue. Poison state, attempt limits, and operator visibility therefore live in the database.

Official assumptions to re-check at execution:

- Vercel Queues overview: https://vercel.com/docs/queues
- Vercel Queues API: https://vercel.com/docs/queues/api
- Vercel Cron management and security: https://vercel.com/docs/cron-jobs/manage-cron-jobs
- Clerk request authentication: https://clerk.com/docs/reference/backend/authenticate-request

## Progress

- [x] (2026-07-30) Split production completion from the foundation/Living Book acceptance plan.
- [x] (2026-07-30) Chose the default identity, quota, deadline, retention, polling, queue, and release contracts.
- [x] (2026-07-31) Corrected the inter-plan activation lifecycle: P1-06 records
  the accepted P1-05 merge commit, and Plan 2 starts only after that docs-only
  activation is merged.
- [ ] Record and verify `PLAN_1_MERGE_SHA`.
- [ ] Queue Gate 0: prove the actual Queue/Cron project contract on a disposable preview branch without merging it.
- [ ] P2-01: repair test/CI/privacy baseline truth and freeze durable-job contracts.
- [ ] P2-02: land the exact Gate-0-proven Queue adapter with feature flags off.
- [ ] P2-03: implement provider deadlines and static abuse boundaries without pretending persistent identity/quotas exist.
- [ ] P2-04: integrate Clerk authentication.
- [ ] P2-05: implement Neon schema, owner-scoped CRUD, migrations, and retention.
- [ ] P2-06: implement atomic job/outbox/idempotency semantics.
- [ ] P2-07: connect Queue processing and automatic outbox reconciliation.
- [ ] P2-08: integrate browser job recovery and cut over transport.
- [ ] P2-09: retire legacy routes and pass exact-preview failure testing.
- [ ] P2-10: stage production release, exercise rollback, and publish the final report.

## Surprises and discoveries

- The current checkout has eleven Vercel route files against a budget of twelve. The queue consumer temporarily reaches twelve. Reusing the jobs function for Cron and later deleting only the two obsolete streaming routes should reach ten; the guard script—not arithmetic in this plan—is authoritative.
- Vercel Queues is currently public beta, uses at-least-once delivery, partitions consumption by deployment, and has no built-in dead-letter queue. Those are design inputs and release risks, not marketing claims.
- Vercel Cron does not retry failed invocations and can overlap or duplicate them. Hobby plans currently support only daily schedules; the intended minute-scale production sweeper requires current plan verification.
- A queue publish after a database commit can be lost; a publish before commit can race uncommitted state. A transactional outbox plus automatic sweeper is required.
- A browser can close after sending a POST but before receiving its job ID. An opaque pre-submit marker and owner-scoped recovery endpoint are necessary to avoid duplicate paid work.
- The accepted P1-05 PR cannot contain its own future GitHub merge commit.
  Activation therefore requires the separate docs-only P1-06 transaction before
  Queue Gate 0.

## Decision log

- Decision: prove raw Vercel Queue and Cron behavior in an isolated disposable Vercel project before designing database jobs around it.
  Rationale: a provider abstraction cannot compensate for a platform trigger, concurrency, plan, or deployment model that does not meet the product contract.
  Date: 2026-07-30.

- Decision: define `PLAN_1_MERGE_SHA` as the full GitHub merge commit for the
  user-accepted P1-05 Living Book candidate and record it in P1-06.
  Rationale: P1-05 cannot contain its own future merge commit. P1-06 can verify
  the known commit while preserving current `origin/main` as the branch point
  for every Plan 2 PR.
  Date: 2026-07-31.

- Decision: make Queue Gate 0 a disposable, non-merge preview gate before the ten-PR train.
  Rationale: feasibility probes and temporary trigger code should not become production history before the platform contract is known.
  Date: 2026-07-30.

- Decision: keep anonymous generation inline and make only signed-in jobs durable.
  Rationale: this preserves the current low-friction product while avoiding anonymous cloud ownership and recovery ambiguity.
  Date: 2026-07-30.

- Decision: use Clerk `authenticateRequest`, rotating JWKS, session-token restriction, and authorized-party validation in production.
  Rationale: a static long-lived key risks silent rotation failure and cross-origin token acceptance.
  Date: 2026-07-30.

- Decision: use transactionally created jobs, initial events, and outbox rows, with execution-token compare-and-swap.
  Rationale: database truth must survive lost publish responses, redelivery, concurrent consumers, and process death.
  Date: 2026-07-30.

- Decision: use adaptive polling for the final authenticated job UI and remove old streams after cutover.
  Rationale: recovery after reload is more important than retaining multiple transport stacks, and polling avoids auth-in-URL failure modes.
  Date: 2026-07-30.

- Decision: retain and deprecate the safe POST compatibility routes until a separately approved 30-day zero-use window proves deletion is safe.
  Rationale: they do not leak request bodies through URLs and removing them during the transport cutover creates avoidable compatibility risk.
  Date: 2026-07-30.

- Decision: model poison handling in the database instead of claiming a dead-letter queue.
  Rationale: the selected queue currently has no built-in DLQ.
  Date: 2026-07-30.

- Decision: stage release with both kill switches off, then enable processing before acceptance.
  Rationale: migrations, auth, workers, and recovery can be verified before new paid work is admitted.
  Date: 2026-07-30.

## Interfaces and dependencies

The production path depends on Clerk session authentication, Neon Postgres, xAI generation, Vercel Queues, Vercel Cron, the accepted Angular Living Book, and the existing consolidated API route families. Gate 0 must refresh every platform-specific assumption before package, schema, or runtime code depends on it.

### Target data model

Exact SQL names may change during P2-05, but all responsibilities must remain explicit:

- `story_lab_schema_migrations`: version, checksum, applied timestamp, and actor/build.
- `story_lab_profiles`: Clerk subject, display preferences, created/updated timestamps.
- `story_lab_projects`: owner, current blueprint/story data, version, created/updated timestamps.
- `story_lab_jobs`: owner, opaque client attempt, request fingerprint, idempotency key, state, lease owner/expiry, execution token, attempt count, deadline, terminal metadata, scrub timestamps, and result/project reference.
- `story_lab_job_events`: monotonically ordered metadata-only progress events.
- `story_lab_job_outbox`: job, generation, topic, payload version, publish state, attempt count, next-attempt time, lease, acknowledgement, and poison reason, unique on job plus generation.
- `story_lab_generation_attempts`: owner or anonymous quota digest, provider/model, token/cost counters, stage, redacted outcome, and rolling-window timestamp.
- `story_lab_runtime_controls`: `jobs_accepting`, `queue_processing`, provider ceiling, and emergency-lowered quotas with audited update metadata.

Schema rules:

- owner-scoped unique constraints and foreign keys are part of the security boundary;
- request fingerprints bind normalized semantic input, not raw transport formatting;
- the same idempotency key plus same fingerprint returns the existing job;
- the same key plus different fingerprint is a conflict;
- another owner can never probe whether a key or job exists;
- migrations are versioned, checksummed, transactional where supported, and safe to rerun;
- application readiness fails on unknown or partially applied schema.

## Review and publication protocol

Use `docs/EXTERNAL_REVIEW_POLICY.md`. Every PR receives local Scope and Completion prosecution plus independent tests. Gemini reviews each final candidate head. Jules also reviews every Plan 2 PR because each touches a mechanically high-risk production boundary.

External review happens after the candidate is committed. A tracked change invalidates every old receipt. The parent alone adjudicates findings, posts GitHub comments, updates shared docs, pushes, merges, deploys, and changes runtime controls.

Workers use smaller tickets than the PR boundary. They may work in parallel only with disjoint leases. Shared contracts, migrations, lockfiles, route entrypoints, `package.json`, `AGENTS.md`, and changelogs have one parent-designated owner and serialized integration.

## Plan of work: non-merge gate and PR train

### Queue Gate 0 — Non-merge isolated production-contract probe

Outcome: current evidence proves or rejects the chosen Vercel Queue/Cron topology before the ten-PR train begins. Use a disposable Vercel project in the same team and plan tier as the product, with no product domain, data, secrets, or traffic. The probe branch may be promoted only to that disposable project's production environment because Vercel Cron does not run on preview deployments. Do not merge the probe or touch the real product production target.

Microtickets:

| Ticket | Owned result | Proof |
|---|---|---|
| G0-A | Verify the merged P1-06 activation, recorded P1-05 merge SHA, route count, Node/runtime, Vercel plan, region, and current queue package/API. | Placeholder/malformed/non-commit/non-ancestor cases fail; exact command outputs and versions are recorded. |
| G0-B | Freeze public, protected, private-trigger, and cron route contracts. | One request/response/auth table with explicit non-public routes. |
| G0-C | Build a disposable preview-only `handleNodeCallback` consumer that receives IDs-only probes. | The platform invokes it; direct public HTTP cannot; no story data enters the message. |
| G0-D | Prove accepted publish including `messageId: null`, retry/redelivery, 300-second maximum duration/visibility, and deployment partition behavior. | Attempt IDs show repeat delivery and the intended deployment boundary. |
| G0-E | Prove finite maximum concurrency of two or record that the platform cannot enforce it. | Timed overlap fixture; no claim based only on configuration prose. |
| G0-F | In the disposable project only, prove production Cron authentication, overlap-safe locking design, at-least-minute schedule availability, and rollback behavior. | `CRON_SECRET`, duplicate invocation, same-team plan-tier, and production-only evidence recorded without product resources. |
| G0-G | Decide Gate 0 and tear down or retain the disposable project exactly as pre-authorized. | The scope packet names authority, maximum cost, target project/team, teardown, and stop conditions. PASS freezes topology; FAIL stops the PR train and requests an architecture decision. |

Gate 0 must not leave billable or production resources enabled without explicit authority. Teardown or retain resources exactly as the approved ticket states.

### P2-01 — Test, CI, privacy baseline, and durable-job contracts

Outcome: every later claim has a named test layer, and existing test scripts no longer hide missing API, browser, or process-loss proof.

Microtickets:

| Ticket | Owned result | Proof |
|---|---|---|
| P2-01A | Inventory root, API, Angular, in-memory integration, real database, browser, preview, and production test layers. | Risk-to-test matrix; no layer substitutes for another. |
| P2-01B | Enforce Node `>=20.9` and current package-manager behavior in local and CI entrypoints. | Wrong runtime fails early; supported clean install passes. |
| P2-01C | Make root/API coverage and Angular coverage separately visible. | Commands emit distinct reports and thresholds justified by risk. |
| P2-01D | Freeze versioned queue/job states, error codes, public events, idempotency, and durability non-claims while runtime remains unchanged. | Contract tests reject unknown versions/states and false durability wording. |
| P2-01E | Add raw-secret canaries across URL, history, storage, DOM, logs, errors, and docs. | Seeded canary never appears in scanned surfaces. |
| P2-01F | Add real-browser Chromium and WebKit paths for critical signed-out behavior. | Both engines exercise create/continue/local recovery. |
| P2-01G | Wire aggregate CI without calling preview/live tests ordinary unit tests. | CI names each layer and its credentials/skip contract. |

Do not raise coverage with trivial tests. Add tests for plausible defects in ownership, timeout, retry, redaction, and state recovery.

### P2-02 — Queue adapter foundation

Outcome: the exact Gate-0-proven Queue client, private consumer wrapper, versioned ID-only protocol, trigger configuration, and deterministic fakes are merged with all production job publication disabled.

Microtickets:

| Ticket | Owned result | Proof |
|---|---|---|
| P2-02A | Pin the Gate-0-proven package/API and isolate `QueueClient` construction. | Clean install and type/runtime checks; no transitive or floating version. |
| P2-02B | Define the versioned job/probe message parser. | Unknown type/version, oversized IDs, and extra private fields fail. |
| P2-02C | Add the private `handleNodeCallback` consumer wrapper. | Direct HTTP denial and fake delivery/redelivery tests. |
| P2-02D | Add the send adapter and treat an accepted `messageId: null` as accepted, not failed. | Exception stays failed/pending; accepted null follows the documented path. |
| P2-02E | Add trigger/runtime configuration and route-budget proof. | Feature defaults off; function guard reports the expected count. |
| P2-02F | Repeat the disposable preview probe from the merged adapter candidate. | Exact candidate SHA and deployment receipt match Gate 0 behavior. |

### P2-03 — Provider deadlines and static abuse boundaries

Outcome: provider execution cannot silently exceed time, body, chapter, call, attempt, or output bounds before identity and persistence exist. Persistent owner, rolling-window, global reservation, and database kill-switch enforcement waits for Clerk and Neon and lands atomically in P2-06.

Microtickets:

| Ticket | Owned result | Proof |
|---|---|---|
| P2-03A | Implement injected absolute deadline and remaining-budget helpers for inline and queue execution. | Fake-clock tests prove no stage resets 60/240 seconds and the reserved completion windows remain. |
| P2-03B | Enforce chapter-count and 256-KiB body bounds before provider work. | Boundary fixtures reject oversize input without a provider call. |
| P2-03C | Enforce per-execution attempt, call, and output-token ceilings in the provider orchestration seam. | Primary/fallback fixtures cannot exceed three attempts, four calls, or configured output bounds. |
| P2-03D | Implement stable limit/error contracts and bounded `Retry-After` for static rejections. | API fixtures prove stable codes without identity or database claims. |
| P2-03E | Enforce the environment hard stop before any provider work. | `STORY_LAB_JOBS_ENABLED=0` and the anonymous equivalent produce zero provider calls. |
| P2-03F | Prove the pure budget helpers under concurrency and fallback sequencing. | Deterministic tests kill deadline resets, negative remaining time, and fallback overrun. |

### P2-04 — Clerk authentication

Outcome: production tokens are verified with rotating keys, protected routes use the Clerk subject as owner, and signed-out local creation remains usable.

Microtickets:

| Ticket | Owned result | Proof |
|---|---|---|
| P2-04A | Define public configuration fields and reject secret fields. | Public route exposes only provider ID/publishable key and safe feature flags. |
| P2-04B | Implement server `authenticateRequest` adapter with secret-backed JWKS, session-token restriction, and authorized parties. | Valid, expired, wrong issuer/audience/party, rotated-key, and network-failure tests. |
| P2-04C | Replace demo/header identity on protected routes with `sub`. | Spoofed owner headers have no effect. |
| P2-04D | Add Angular session state and protected-request interceptor. | Bearer token appears only on the protected allowlist. |
| P2-04E | Prove signed-out local and signed-in cloud mode transitions. | Browser tests cover sign-out during request, expiry, refresh, and reload. |
| P2-04F | Prove two-user denial in API and real-browser preview. | User B receives non-enumerating denial for User A resources. |

The P2-04 release evidence includes an overlapping-key rotation rehearsal: create a separately named replacement key while the old key remains valid, redeploy the target environment, run signed-in smoke, confirm replacement use, and remove the old key only after the observation window. Never rotate preview and production in the same change.

### P2-05 — Neon persistence, CRUD, migrations, and retention

Outcome: production data is owner-scoped, migratable, deletable, and honest about retention.

Microtickets:

| Ticket | Owned result | Proof |
|---|---|---|
| P2-05A | Implement a transaction-capable database executor and failure taxonomy. | Commit/rollback, timeout, disconnect, and redacted-error tests. |
| P2-05B | Implement checksummed migration ledger and initial schema. | Fresh, repeated, drifted-checksum, partial-failure, and concurrent-start tests. |
| P2-05C | Implement profile CRUD. | Owner-only read/update/delete and validation tests. |
| P2-05D | Implement project list/get/create/update/delete with optimistic versioning. | Two-user denial, stale-version conflict, and pagination/order tests. |
| P2-05E | Implement retention scrub/purge queries and metadata-only events. | Time-controlled success/failure/account-delete fixtures. |
| P2-05F | Add live Neon preview migration and two-user evidence. | Exact preview SHA, region, migration checksum, and teardown/retention recorded. |

Never run a production migration from a worker or external reviewer. The parent owns authorized migration execution.

### P2-06 — Atomic jobs, outbox, idempotency, and durable admission

Outcome: request acceptance is recoverable and redelivery cannot commit more than one result.

Microtickets:

| Ticket | Owned result | Proof |
|---|---|---|
| P2-06A | Freeze job state machine and legal transitions. | Table-driven tests reject unknown/backward/terminal transitions. |
| P2-06B | Atomically insert job, initial event, and outbox row. | Injected failure at each statement leaves all-or-none state. |
| P2-06C | Implement owner-scoped idempotency and request fingerprint. | Same/same replays; same/different conflicts; cross-owner does not enumerate. |
| P2-06D | Implement lease and execution-token compare-and-swap. | Two workers and expired lease cannot both commit. |
| P2-06E | Commit result, project update, terminal event, and body scrub atomically. | Process-loss injection around each boundary recovers safely. |
| P2-06F | Implement pending-attempt recovery and controlled retry endpoints. | Lost POST response recovers one job; retry follows retention and quota rules. |
| P2-06G | Atomically enforce signed-in/anonymous rolling limits, active-job limit, global queue/running caps, and database kill switches using the P2-05 tables. | Same-owner, anonymous HMAC, global-boundary, concurrent-admission, and raw-IP non-persistence tests. |
| P2-06H | Reserve and settle token/cost usage against daily and monthly ceilings in the job transaction. | Rejection launches no provider work; success/failure settles once; expired reservations recover without double-spend. |

The claim is “at-least-once compute with at-most-one committed result,” not exactly-once execution.

### P2-07 — Queue runtime and automatic reconciler

Outcome: queue redelivery and lost publication are handled automatically, within finite concurrency and without story content in transport.

Microtickets:

| Ticket | Owned result | Proof |
|---|---|---|
| P2-07A | Publish only version, type, job ID, and generation from leased outbox rows with idempotency key `story-lab:<jobId>:g<generation>`. | Captured message contains no story/auth/provider data; accepted null message ID counts as published. |
| P2-07B | Implement private consumer validation, lease acquisition, and finite processing. | Invalid schema/auth fail; concurrency and redelivery fixtures pass. |
| P2-07C | Implement retry schedule, maximum attempts, poison state, and operator metadata. | Deterministic clock fixtures; no false DLQ claim. |
| P2-07D | Implement the `CRON_SECRET`-protected dispatcher operation inside the existing jobs function with a database advisory/lease lock. | Duplicate/overlapping invocations are idempotent and route count does not grow. |
| P2-07E | Add runtime-control checks to publisher and consumer. | Disabled switches launch neither publish nor provider work. |
| P2-07F | Run preview crash/redelivery/lost-publish tests from the exact candidate SHA. | Automatic recovery occurs without an open browser. |

Cron failure has no immediate platform retry. The next tick and idempotent dispatcher are the recovery mechanism.

### P2-08 — Browser recovery and transport cutover

Outcome: signed-in job state survives lost responses, reloads, hidden tabs, token refresh, and terminal failures without private URL or storage data.

Microtickets:

| Ticket | Owned result | Proof |
|---|---|---|
| P2-08A | Implement opaque pre-submit marker and owner-scoped recovery. | Close-after-POST fixture recovers one job. |
| P2-08B | Implement adaptive polling state machine with jitter and visibility handling. | Fake-clock and browser visibility tests. |
| P2-08C | Map queued, running, retrying, completed, failed, cancelled, and expired states into the accepted Living Book. | State fixtures and accessible announcements. |
| P2-08D | Implement token expiry/refresh and sign-out cancellation behavior. | No infinite 401 loop; no cross-user state remains. |
| P2-08E | Remove client reliance on old stream endpoints after parity. | Network trace shows only the protected polling contract. |
| P2-08F | Run Chromium/WebKit reload, offline-return, hidden-tab, and two-user browser journeys. | Exact candidate logs and privacy canary scan pass. |

### P2-09 — Legacy retirement and exact preview

Outcome: the two obsolete streaming surfaces are deleted after replacement
proof, the retained POST compatibility routes remain available and measured,
and the exact candidate survives realistic failure injection in preview.

Candidate retirements, verified before deletion:

- `api/story-lab/stream/genesis.ts`
- `api/story/stream.ts`
- their now-unused client/server seams and tests

Keep `api/story/generate.ts` and `api/story/continue.ts` as deprecated POST compatibility routes in this train. Instrument aggregate, privacy-safe route use. Delete them only in a separately approved follow-up after a 30-day zero-use window; they do not put private input in query strings and are not needed to recover route capacity.

Microtickets:

| Ticket | Owned result | Proof |
|---|---|---|
| P2-09A | Inventory every caller, doc, test, deployment reference, and aggregate hit count for legacy routes. | Zero unknown callers for the two stream routes; compatibility POST use is measured without private data. |
| P2-09B | Delete the two streaming server routes and their dead shared seams in one route-owned ticket. | Retired routes return 404; route guard and import/reference scan pass. |
| P2-09C | Delete client streaming compatibility paths and shims; deprecate but retain the two safe POST routes. | Browser network trace never calls retired paths; POST routes still pass contract tests. |
| P2-09D | Verify Vercel function count mechanically. | Guard output recorded; planning estimate is not used as proof. |
| P2-09E | Add exact-preview failure seams for provider timeout, redelivery, lost publish, DB disconnect, and token rotation. | Same deployed SHA is exercised; no debug bypass in production. |
| P2-09F | Run live Clerk, Neon, Queue, Cron, xAI, two-user, reload, crash, privacy, and rollback rehearsal. | Sanitized evidence binds the candidate deployment and Git SHA. |

No streaming compatibility shim remains after the cutover PR. The two explicitly retained POST routes are compatibility entrypoints, not shims for the new durable transport. Rollback uses the prior deployment and kill switches, not duplicate streaming stacks.

### P2-10 — Production release and final report

Outcome: production is enabled in controlled stages, rollback is exercised, and completion claims bind the served SHA and evidence.

Microtickets:

| Ticket | Owned result | Proof |
|---|---|---|
| P2-10A | Freeze release manifest: commit, migrations, env names, regions, limits, retention, routes, and rollback target. | Parent and external reviews bind the exact manifest. |
| P2-10B | Deploy with `jobs_accepting=false` and `queue_processing=false`. | Health/readiness, schema, auth, and secret-redaction checks pass. |
| P2-10C | Enable processing and run one operator-owned recovery canary. | Queue, DB, provider, polling, scrub, and usage evidence pass. |
| P2-10D | Enable acceptance and run anonymous plus two-user signed-in journeys. | Ownership, quota, reload, delete, and privacy evidence pass. |
| P2-10E | Exercise kill switches and rollback to the named deployment, then restore only after proof. | Served SHA and route behavior match the rollback record. |
| P2-10F | Audit checks, external dispositions, migrations, and runtime controls. | No required check or blocking finding remains. |
| P2-10G | Run the final last-40 review audit for current-line and outdated unresolved threads. | Exact commands/results are recorded; every thread is fixed, evidence-rejected, or linked under the disposition policy. |
| P2-10H | Classify every local commit, branch, worktree, and untracked artifact. | Each item is merged, intentionally parked with owner/reason, historical reference, or explicitly dispositioned; nothing is silently abandoned. |
| P2-10I | Publish final recovery report and reconcile active/historical docs. | Implemented, tested, previewed, deployed, and non-claimed states are separate. |

## Concrete steps

Before Queue Gate 0 or any Plan 2 branch, fetch once, freeze that exact
`origin/main` commit as the Plan 2 base, and read the activation marker from
that commit rather than from the working tree. These commands are illustrative
and must exit zero:

    git fetch origin --prune
    plan_2_file="STORY_LAB_PRODUCTION_COMPLETION_EXEC_PLAN.md"
    plan_2_base_sha="$(git rev-parse --verify 'origin/main^{commit}')"
    plan_1_merge_sha="$(git show "${plan_2_base_sha}:${plan_2_file}" | awk '/^[[:space:]]*PLAN_1_MERGE_SHA:/ { count += 1; sub(/^[[:space:]]*PLAN_1_MERGE_SHA:[[:space:]]*/, ""); value = $0 } END { if (count != 1) exit 1; print value }')"
    test -n "$plan_1_merge_sha"
    test "$plan_1_merge_sha" != "TO_BE_RECORDED"
    case "$plan_1_merge_sha" in (*[!0-9a-f]*|"") exit 1;; esac
    test "${#plan_1_merge_sha}" -eq 40
    git cat-file -e "${plan_1_merge_sha}^{commit}"
    test "$(git rev-parse --verify "${plan_1_merge_sha}^{commit}")" = "$plan_1_merge_sha"
    git merge-base --is-ancestor "$plan_1_merge_sha" "$plan_2_base_sha"

Create a fresh detached proof worktree at the frozen `origin/main` commit. Prove
that the fetched activation content, not an open P1-06 branch, contains the same
marker; prove that checkout exact and clean; then remove only that dedicated
proof worktree. If any step fails, leave Plan 2 closed:

    plan_2_proof_parent="$(mktemp -d "${TMPDIR:-/tmp}/story-lab-plan2-proof.XXXXXX")"
    plan_2_proof_worktree="${plan_2_proof_parent}/origin-main"
    git worktree add --detach "$plan_2_proof_worktree" "$plan_2_base_sha"
    test "$(git -C "$plan_2_proof_worktree" rev-parse HEAD)" = "$plan_2_base_sha"
    test -z "$(git -C "$plan_2_proof_worktree" status --porcelain)"
    proof_marker="$(awk '/^[[:space:]]*PLAN_1_MERGE_SHA:/ { count += 1; sub(/^[[:space:]]*PLAN_1_MERGE_SHA:[[:space:]]*/, ""); value = $0 } END { if (count != 1) exit 1; print value }' "${plan_2_proof_worktree}/${plan_2_file}")"
    test "$proof_marker" = "$plan_1_merge_sha"
    git -C "$plan_2_proof_worktree" merge-base --is-ancestor "$plan_1_merge_sha" HEAD
    git worktree remove "$plan_2_proof_worktree"
    rmdir "$plan_2_proof_parent"

Create Queue Gate 0 or the next Plan 2 PR from the same
`plan_2_base_sha`. If `origin/main` changes before branch creation, restart this
proof rather than mixing a marker from one base with code from another. Repeat
the complete fetch/freeze/proof sequence for every later Plan 2 PR after the
previous PR merges.

Immediately after the proof, without a second fetch:

    test "$(git rev-parse --verify 'origin/main^{commit}')" = "$plan_2_base_sha"
    git worktree add <new-safe-path> -b recovery/story-lab-<bounded-slice> "$plan_2_base_sha"
    cd <new-safe-path>
    test "$(git rev-parse HEAD)" = "$plan_2_base_sha"
    git status --short --branch
    npm run recovery:status
    scripts/recovery/check-vercel-function-count.sh

Write and prosecute the four-field scope packet before edits. Split worker leases more finely than seems necessary, but publish only the coherent PR outcome. Run focused tests after each integration, then aggregate checks. Commit the final candidate, generate the exact-source external packet, and do not mutate tracked files afterward without invalidating and repeating review.

Before any live provider, preview, database, migration, GitHub rule, or production change, record:

- exact target project/account/environment;
- approved authority and expected cost;
- secret names without values;
- teardown or rollback;
- sanitized evidence location;
- stop condition.

## Validation and acceptance

Every PR:

    git diff --check
    npm run test:all
    npm run build:full
    npm run recovery:status
    npm run recovery:finish -- --strict
    scripts/recovery/check-vercel-function-count.sh

Additional proof is cumulative but never interchangeable:

- deterministic unit tests cover state machines, deadlines, fingerprints, redaction, retention, and adapters;
- in-memory integration tests cover contracts, not cross-process durability;
- real Neon tests cover transactions, migrations, owner isolation, and retention;
- fake Queue tests cover deterministic error branches;
- live Queue/Cron preview covers provider trigger, redelivery, concurrency, overlap, and deployment behavior;
- Chromium/WebKit tests cover browser recovery and privacy surfaces;
- production smoke covers only the exact served deployment and does not replace lower layers;
- process-loss tests kill the worker at named transaction/publish/provider boundaries and prove automatic recovery.

Plan 2 is complete only when:

- the P1-06 activation PR is merged, the recorded P1-05 merge SHA passes the
  exact commit/ancestor/detached-worktree proof, and current work branches from
  then-current `origin/main`;
- P2-01 through P2-10 are merged to `main`;
- all active required checks and original review threads are resolved with evidence;
- every local commit, branch, worktree, and untracked artifact is classified as merged, intentionally parked with owner/reason, historical reference, or explicitly dispositioned;
- the final last-40 PR audit covers both current-line and outdated unresolved review threads and records exact commands/results;
- production serves the exact expected SHA;
- anonymous and two signed-in users complete the defined journeys;
- a browser closure, worker crash, repeated delivery, lost publish response, token rotation, and database interruption have bounded recovery evidence;
- retention and account deletion have live evidence without exposing private data;
- the two obsolete streaming routes and their shims are absent, while retained POST compatibility routes are explicitly deprecated and measured;
- kill switches and rollback were exercised;
- `main` is clean and equals `origin/main`;
- the final report clearly records remaining beta/platform/provider risks.

## Idempotence, recovery, and rollback

- Migrations use checksums and refuse drift; reruns are safe.
- Idempotency keys and fingerprints make acceptance replay-safe.
- Outbox leases, queue redelivery, and execution tokens make processing retryable.
- Every external POST with an ambiguous response reconciles state before retry.
- Cron and consumers use database leases and may overlap without duplicate commit.
- Runtime switches stop new acceptance independently from processing already accepted jobs.
- Failed releases keep both switches false.
- Rollback targets a named prior deployment and checks migration compatibility first.
- Destructive account/retention tests use dedicated fixtures and explicitly authorized environments.
- Never delete production data, disable a deployment, change a required status, or provision billable infrastructure from a subagent or reviewer.

## Artifacts and notes

Keep raw external-review output and attempt state private under `.git/story-lab-external-review/`. Store credentialed preview and production logs only in an approved private evidence location. Commit sanitized evidence indexes containing exact Git SHA, deployment ID, migration checksum, test command, exit code, timestamp, reviewer-attempt digest, and redacted result.

Update `SUBAGENT_LOG.md` for every material worker/reviewer batch and `PR70_RECOVERY_CHANGELOG.md` for every PR, validation change, provider/platform decision, live proof, release action, rollback, or non-claim. Update `PR70_RECOVERY_FINAL_REPORT.md` only with evidence that can be traced to the exact source and environment.

## Outcomes and retrospective

After each PR, record the actual behavior, verification layers, provider/platform deviations, cost/latency evidence, findings and dispositions, rollbacks attempted, and changes required in later tickets. If Queue Gate 0 fails, write the result here and stop the dependent PRs; do not quietly substitute a new provider or weaken durability language.
