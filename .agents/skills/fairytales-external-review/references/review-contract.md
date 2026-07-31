# External review execution checklist

The authoritative contract is `docs/EXTERNAL_REVIEW_POLICY.md`. This checklist is intentionally shorter and must not be used to override the policy.

## Before review

- [ ] Git-discovered Fairytales repository identity, worktree, base SHA, and head SHA verified without a machine-specific path.
- [ ] `git status --short --branch` and `npm run recovery:status` inspected.
- [ ] `AGENTS.md`, `.agent/PLANS.md`, and both current Story Lab plans read.
- [ ] Plan 2 review/readiness rejected while `PLAN_1_MERGE_SHA` or merged P1-06 activation is unresolved; Plan 1 review records that state as a Plan 2 non-claim.
- [ ] Candidate and packet body committed; exact packet bytes read with `git show`.
- [ ] Private attempt envelope records base/head SHA, packet path/blob SHA, SHA-256 digest, attempt ID, policy version, and reviewer.
- [ ] The packet body is not required to contain its own final commit SHA.
- [ ] Intent, scope, acceptance criteria, diff command, tests, and non-claims present.
- [ ] Packet, envelope, complete prompt, process/HTTP output, poll, and wall-clock limits match `story-lab-review-limits/v1`.
- [ ] No secrets, `.env` values, private stories, raw provider bodies, raw IPs, cookies, or customer data.
- [ ] Required cadence selected: Gemini always; Jules for the high-risk boundaries named by policy.

## Gemini

- [ ] Executable resolved through the portable policy precedence and verified as an executable regular file.
- [ ] Complete `PRE_SPAWN` claim was fsynced and no-replace linked before ownership; `SPAWN_MAY_HAVE_OCCURRED` was durably published before spawn; `RUNNING` durably recorded the child group; crash recovery was exact-attempt and refused ambiguous/live process state.
- [ ] Current `agy --help` and `agy models` inspected within the exact discovery limits.
- [ ] Required exact model and flags exist; no silent fallback.
- [ ] Fresh exact-SHA clone is clean and remotes are removed.
- [ ] Child environment is allowlisted and contains no unrelated provider credentials.
- [ ] Argument-array spawn, `shell: false`, ignored stdin, exact `story-lab-review-limits/v1`, sandboxed plan mode.
- [ ] No pipe, command substitution, conversation reuse, `--effort`, generic `pro`, or dangerous permission bypass.
- [ ] Whole process group is terminated and reaped within the exact deadline/grace contract on timeout or overflow.
- [ ] Clone is still clean after review.
- [ ] Exactly one JSON object validates and echoes all bindings.
- [ ] Reviewer receipt contains no stream self-hashes; complete raw stdout/stderr byte lengths and hashes exist only in private controller-owned `attempt-result.json`.

## Jules

- [ ] Skill and reviewer had no credential access; only the parent-owned Jules adapter used the fixed, bounded, no-shell `/usr/bin/security` broker and kept its stdout in parent memory, or the attempt stopped `REVIEW_UNAVAILABLE`.
- [ ] Exact connected repository and unique slash-free exact-SHA alias.
- [ ] Unique packet title/revision; `POSTING` saved before launch.
- [ ] `startingBranch`, `requirePlanApproval: true`; automation mode omitted.
- [ ] Ambiguous response reconciled by exact title; never blind-retried.
- [ ] Request, response, poll, pre-approval, post-approval, and overall limits match `story-lab-review-limits/v1`.
- [ ] Protected plan digest recorded; feedback invalidates the old digest.
- [ ] Parent approves only the exact current digest.
- [ ] Plan and terminal result contain no write/change-set/dependency/branch/PR/merge/deploy/migration/provision action.
- [ ] Terminal state, base, digest, schema, sections, and clean status validate.
- [ ] Private `attempt-result.json` hashes the deterministic manifest of every captured Jules response; the reviewer receipt contains no HTTP/transcript hash fields.

## Disposition and publication

- [ ] Raw outputs stored privately under `.git/story-lab-external-review/`.
- [ ] Findings normalized and deduplicated.
- [ ] P0/P1 resolved; every P2 has an allowed disposition.
- [ ] Tests were run independently; receipt did not substitute for them.
- [ ] No tracked commit followed review.
- [ ] Parent alone posts sanitized comments and publishes; a status is posted only by an approved trusted producer.
- [ ] Report says whether review is advisory, canary-proven, or mechanically required.
- [ ] `npm run recovery:finish` ran before session end; strict mode ran for any PR-ready, merge-ready, or final-completion claim.

## Bootstrap

- [ ] Candidate controller did not grade itself.
- [ ] Bootstrap waiver is explicit.
- [ ] Post-merge canary uses controller code from clean `origin/main`.
- [ ] All required negative cases fail before the local gate is used.
- [ ] Required GitHub enforcement remains disabled unless a separate trusted-producer design is approved.
- [ ] Until a merged controller passes its canary, resource/receipt checks are described as advisory and parent-inspected rather than mechanically enforced.
