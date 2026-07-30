# External review execution checklist

The authoritative contract is `docs/EXTERNAL_REVIEW_POLICY.md`. This checklist is intentionally shorter and must not be used to override the policy.

## Before review

- [ ] Worktree, active ExecPlan, base SHA, and head SHA verified.
- [ ] Candidate and packet body committed; exact packet bytes read with `git show`.
- [ ] Private attempt envelope records base/head SHA, packet path/blob SHA, SHA-256 digest, attempt ID, policy version, and reviewer.
- [ ] The packet body is not required to contain its own final commit SHA.
- [ ] Intent, scope, acceptance criteria, diff command, tests, and non-claims present.
- [ ] No secrets, `.env` values, private stories, raw provider bodies, raw IPs, cookies, or customer data.
- [ ] Required cadence selected: Gemini always; Jules for the high-risk boundaries named by policy.

## Gemini

- [ ] Current `agy --help` and `agy models` inspected.
- [ ] Required exact model and flags exist; no silent fallback.
- [ ] Fresh exact-SHA clone is clean and remotes are removed.
- [ ] Child environment is allowlisted and contains no unrelated provider credentials.
- [ ] Argument-array spawn, `shell: false`, ignored stdin, bounded prompt/output/time, sandboxed plan mode.
- [ ] No pipe, command substitution, conversation reuse, `--effort`, generic `pro`, or dangerous permission bypass.
- [ ] Whole process group is terminated and reaped on timeout.
- [ ] Clone is still clean after review.
- [ ] Exactly one JSON object validates and echoes all bindings.

## Jules

- [ ] Credential stays in Keychain and out of prompts/logs/state/chat.
- [ ] Exact connected repository and unique slash-free exact-SHA alias.
- [ ] Unique packet title/revision; `POSTING` saved before launch.
- [ ] `startingBranch`, `requirePlanApproval: true`; automation mode omitted.
- [ ] Ambiguous response reconciled by exact title; never blind-retried.
- [ ] Protected plan digest recorded; feedback invalidates the old digest.
- [ ] Parent approves only the exact current digest.
- [ ] Plan and terminal result contain no write/change-set/dependency/branch/PR/merge/deploy/migration/provision action.
- [ ] Terminal state, base, digest, schema, sections, and clean status validate.

## Disposition and publication

- [ ] Raw outputs stored privately under `.git/story-lab-external-review/`.
- [ ] Findings normalized and deduplicated.
- [ ] P0/P1 resolved; every P2 has an allowed disposition.
- [ ] Tests were run independently; receipt did not substitute for them.
- [ ] No tracked commit followed review.
- [ ] Parent alone posts sanitized comments and publishes; a status is posted only by an approved trusted producer.
- [ ] Report says whether review is advisory, canary-proven, or mechanically required.

## Bootstrap

- [ ] Candidate controller did not grade itself.
- [ ] Bootstrap waiver is explicit.
- [ ] Post-merge canary uses controller code from clean `origin/main`.
- [ ] All required negative cases fail before the local gate is used.
- [ ] Required GitHub enforcement remains disabled unless a separate trusted-producer design is approved.
