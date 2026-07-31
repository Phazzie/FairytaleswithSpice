# Story Lab two-plan freeze review packet

Schema version: `story-lab-review-packet/v1`
Policy version: `story-lab-external-review/2026-07-31`
Packet ID: `story-lab-two-plan-freeze`
Revision: `2`
Repository: `Phazzie/FairytaleswithSpice`
Change type: ExecPlan, operating-policy, and repo-skill freeze

Revision 1 receipts bind the superseded commit
`890ea71029365b8dac1bdf81f2f775a0ef2bdeb1` and are stale for Revision 2. They
cannot be reused for this packet.

## Intent

Replace conflicting Story Lab completion guidance with one decision-complete two-plan sequence:

1. foundation and explicitly accepted Living Book UI; then
2. production completion after P1-06 records and proves the accepted P1-05
   merge commit, starting implementation from then-current `origin/main`.

Create a safe programmatic Gemini/Antigravity and Jules review contract that can later become mechanically enforced without trusting stale context, reviewer prose, or candidate code that grades itself.

## Acceptance criteria

- Current execution routes unambiguously through the two new plans.
- Plan 1 has six coherent PRs composed from smaller disjoint worker tickets;
  P1-06 is the docs-only activation/closeout after the accepted P1-05 merge.
- Plan 2 has a non-merge Queue Gate 0 followed by ten coherent PRs.
- Plan 2 cannot start until P1-06 records and verifies the exact accepted P1-05
  merge commit, merges to current `origin/main`, and a clean detached checkout
  of that fetched `origin/main` contains the non-placeholder marker and proves
  the recorded commit is its ancestor.
- Living Book has early and final user-acceptance holds.
- Anonymous create, continue, and browser-local save remain explicit Plan 1 invariants.
- Production auth, cloud, Queue, durability, and deployment remain Plan 2 work.
- The review policy separates a committed packet body from a private post-commit attempt envelope.
- Antigravity invocation forbids stdin piping, shell interpolation, permission bypass, stale conversations, and unvalidated prose.
- Jules remains read-only, reconciles ambiguous launch responses, and requires exact plan-digest approval.
- The initial controller cannot certify itself; the mechanical local gate waits for a post-merge negative canary.
- Required GitHub enforcement remains disabled unless a separate trusted-producer design is explicitly approved.
- `story-lab-review-limits/v1` defines exact byte, process, HTTP, poll, and
  wall-clock limits; the packet and policy values are identical.
- Antigravity binary resolution is portable and fail-closed.
- Reviewer-returned JSON contains no self-referential stream hashes; a future
  controller owns private post-capture artifact hashes.
- Reviewer skills have no credential access. A future parent-owned Jules
  adapter may retrieve the configured Keychain item only through the bounded,
  no-shell `/usr/bin/security` broker defined by policy.
- Queue Gate 0 uses an isolated disposable Vercel project and never the product production target.
- Persistent identity/quota enforcement follows Clerk and Neon rather than preceding them.
- Final closure restores last-40 current/outdated review-thread proof and classification of all local work.
- Existing dirty sibling worktrees and unrelated repo-local skills are preserved.

## In-scope files

- `AGENTS.md`
- `OVERNIGHT_MODE.md`
- `STORY_LAB_FOUNDATION_AND_LIVING_BOOK_EXEC_PLAN.md`
- `STORY_LAB_PRODUCTION_COMPLETION_EXEC_PLAN.md`
- `STORY_LAB_COMPLETION_HARDENING_EXEC_PLAN.md`
- `STORY_LAB_FINAL_MERGE_AUDIT_EXEC_PLAN.md`
- `STORY_LAB_FUTURE_WORK_CHECKLIST.md`
- `STORY_LAB_OPTIONAL_POST_DONE_ROADMAP.md`
- `STORY_LAB_CONCEPT_CHECKLIST.md`
- `docs/EXTERNAL_REVIEW_POLICY.md`
- `docs/external-review/packets/two-plan-freeze-v1.md`
- `.agents/skills/fairytales-external-review/SKILL.md`
- `.agents/skills/fairytales-external-review/agents/openai.yaml`
- `.agents/skills/fairytales-external-review/references/review-contract.md`
- `.agents/skills/fairytales-story-lab-slice/SKILL.md`
- `.agents/skills/fairytales-story-lab-slice/agents/openai.yaml`
- `PR70_RECOVERY_CHANGELOG.md`
- `SUBAGENT_LOG.md`

## Explicitly out of scope

- External-review controller implementation.
- GitHub Actions, required statuses, branch rules, or repository settings.
- Product, Angular, API, dependency, lockfile, Queue, Clerk, Neon, database, provider, deployment, or production changes.
- Cleaning, merging, rebasing, or deleting sibling worktrees.
- Publishing unrelated `.agents/` skills.
- Publishing the pre-existing Recommendation Risk Calibration hunk in `AGENTS.md`; it remains user-owned and unstaged.
- Closing or modifying PR #194.

## Normative resource limits

This packet mirrors canonical profile `story-lab-review-limits/v1` from
`docs/EXTERNAL_REVIEW_POLICY.md`. Byte counts use exact UTF-8 or raw-stream
bytes.

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

The complete prompt contains controller framing, this committed packet, and the
private envelope; it does not embed the full diff. Packet, envelope, or prompt
overflow is rejected before reviewer contact. Discovery or response overflow,
lock contention, process timeout, Jules request/phase/overall timeout, or poll
overflow yields an invalid attempt and no reviewer receipt. The private failure
record must name the exceeded limit and observed byte count or elapsed time.
Ambiguous Jules state is reconciled authoritatively and never blind-retried.

## Required diff

The attempt envelope supplies immutable base and head SHAs. Review:

    git diff --find-renames <base-sha>..<head-sha> -- \
      AGENTS.md \
      OVERNIGHT_MODE.md \
      PR70_RECOVERY_CHANGELOG.md \
      STORY_LAB_COMPLETION_HARDENING_EXEC_PLAN.md \
      STORY_LAB_CONCEPT_CHECKLIST.md \
      STORY_LAB_FINAL_MERGE_AUDIT_EXEC_PLAN.md \
      STORY_LAB_FOUNDATION_AND_LIVING_BOOK_EXEC_PLAN.md \
      STORY_LAB_FUTURE_WORK_CHECKLIST.md \
      STORY_LAB_OPTIONAL_POST_DONE_ROADMAP.md \
      STORY_LAB_PRODUCTION_COMPLETION_EXEC_PLAN.md \
      SUBAGENT_LOG.md \
      docs/EXTERNAL_REVIEW_POLICY.md \
      docs/external-review/packets/two-plan-freeze-v1.md \
      .agents/skills/fairytales-external-review \
      .agents/skills/fairytales-story-lab-slice

## Verification evidence

| Evidence ID | Command or check | Sanitized result | Exit code |
|---|---|---|---:|
| `E1` | `git diff --check` | PASS: no whitespace errors in the candidate diff. | `0` |
| `E2` | living-ExecPlan required-section check for both plans | PASS: both plans contain the required living-plan sections. | `0` |
| `E3` | local Markdown-link resolution check | PASS: every local Markdown link in the changed planning, policy, packet, and skill files resolves. | `0` |
| `E4` | skill-creator quick validation for `.agents/skills/fairytales-external-review` | PASS. | `0` |
| `E5` | skill-creator quick validation for `.agents/skills/fairytales-story-lab-slice` | PASS. | `0` |
| `E6` | parse both `agents/openai.yaml` files | PASS: both YAML files parse. | `0` |
| `E7` | `scripts/recovery/check-vercel-function-count.sh` | PASS: 11 of 12 Vercel function slots are in use; this change adds no route. | `0` |
| `E8` | `npm run recovery:status` | PASS: command completed in the helper worktree, reported the expected fourteen tracked planning/review modifications and no untracked files, and passed the route guard at 11/12. Its embedded GitHub lookup timed out, so it was not used as PR-state evidence. | `0` |
| `E9` | bounded `gh pr list`, `gh pr view 198`, and check inspection at original head `890ea71029365b8dac1bdf81f2f775a0ef2bdeb1` | BASELINE with external blocker, not corrected-head proof: open PRs are draft #198 and Dependabot #194. At the original head, #198 was mergeable; SonarCloud, Vercel, and CodeRabbit status passed, while both Recovery CI jobs had zero steps and a GitHub annotation stating that the account was locked due to a billing issue. Corrected-head CI belongs in post-commit GitHub evidence and must be refreshed without editing this packet. | `0` |
| `E10` | fresh-agent forward test for each repo skill | PASS: two independent read-only agents followed the external-review and Story Lab slice routing contracts without a corrective prompt. | N/A: agent evidence |
| `E11` | `npm run test:recovery-finish-check` | PASS: 4 tests passed. | `0` |
| `E12` | packet/policy limits, closed receipt-schema examples, semantic guard, and packet-size checks | PASS: all 21 canonical limit rows match exactly, both provider examples parse with distinct closed reviewer shapes and no stream self-hashes, prohibited machine-specific paths and stale route wording are absent from additions, and the packet is below its 131072-byte cap. | `0` |
| `E13` | read-only Completion Prosecutor over the integrated candidate | PASS after three corrective rounds: all seven P1/P2 findings were fixed, and the final rerun found no actionable P0/P1/P2 blocker. | N/A: agent evidence |

Product tests are not required for this docs/policy/skill-only change. The review must flag any file that actually changes runtime or package behavior and therefore invalidates that non-claim.

## Review lenses

1. Authority and sequencing: look for any older document that still competes with the two-plan route.
2. Executability: find missing decisions, impossible acceptance criteria, hidden self-reference, or unsafe publication ordering.
3. External-review security: attack exact-source binding, process isolation, credentials, timeouts, raw-output handling, Jules launch reconciliation, finding disposition, and self-certification.
4. Release architecture: attack Queue Gate 0, route-budget arithmetic, compatibility-route retirement, Clerk rotation, anonymous preservation, polling cutover, retention, limits, rollback, and proof-layer separation.
5. Subagent integration: find overlapping leases, microtickets too large or too small, and review/PR multiplication.
6. Claims: find any statement that overclaims implementation, validation, merge, enforcement, live provider proof, deployment, or production readiness.

## Required reviewer response

Return exactly one JSON object matching this closed schema, with no Markdown fence,
leading prose, trailing prose, or unknown fields. This is the Gemini form:

```json
{
  "schemaVersion": "story-lab-review-receipt/v1",
  "reviewer": {
    "system": "gemini",
    "model": "exact discovered model identifier"
  },
  "attemptId": "exact private-envelope attempt ID",
  "bindings": {
    "baseSha": "40 lowercase hexadecimal characters",
    "headSha": "40 lowercase hexadecimal characters",
    "packetPath": "docs/external-review/packets/two-plan-freeze-v1.md",
    "packetBlobSha": "40 lowercase hexadecimal characters",
    "packetDigest": "64 lowercase hexadecimal characters",
    "policyVersion": "story-lab-external-review/2026-07-31"
  },
  "verdict": "ADVISORY_CLEAR",
  "findings": [],
  "reviewedEvidenceIds": ["E1", "E2"],
  "limitations": []
}
```

For Jules, the top-level object and all non-reviewer fields are identical, but the
closed `reviewer` object is exactly:

```json
{
  "system": "jules",
  "apiVersion": "v1alpha",
  "sessionId": "exact reconciled Jules session ID",
  "planDigest": "64 lowercase hexadecimal characters",
  "terminalState": "COMPLETED"
}
```

Every shown property is required. All objects are closed; unknown fields invalidate
the response. The Gemini `reviewer` object contains exactly `system` and `model`;
`system` is `gemini` and `model` is the exact discovered non-empty model identifier.
The Jules `reviewer` object contains exactly the five fields shown in the Jules
form: `system` is `jules`; `apiVersion` is the literal `v1alpha`; `sessionId` is the
non-empty ID reconciled from the unique session title; `planDigest` is the exact
approved 64-character lowercase hexadecimal digest; and `terminalState` is the
literal `COMPLETED`. A Jules `FAILED` session is terminal but cannot yield a valid
receipt. A Jules object containing `model`, or a Gemini object containing Jules
session fields, is invalid.

`attemptId`, finding strings, evidence `detail`, and limitation strings are
non-empty strings. SHA and digest strings have the exact lowercase hexadecimal
lengths shown. `packetPath` and `policyVersion` must equal the literal values above.
`verdict` is exactly `ADVISORY_CLEAR` or `ADVISORY_FINDINGS`.
`reviewedEvidenceIds` contains only evidence IDs listed in this packet and has no
duplicates. `limitations` is an array of strings.

Each `findings` item is a closed object with exactly these required fields:

```json
{
  "id": "stable unique finding ID",
  "severity": "P1",
  "title": "concise title",
  "evidence": [
    {
      "path": "current in-scope file path or this packet path",
      "line": 1,
      "section": null,
      "detail": "specific current evidence"
    }
  ],
  "impact": "concrete impact",
  "recommendation": "bounded correction"
}
```

`severity` is exactly `P0`, `P1`, `P2`, or `P3`. `id` values are unique.
`evidence` is non-empty. Each evidence item is a closed object with all four fields:
`path` is a current in-scope file path or this packet path; `line` is either a
positive integer or `null`; `section` is either a non-empty packet section name or
`null`; exactly one of `line` and `section` is non-null; and `detail` is non-empty.
`ADVISORY_CLEAR` requires an empty findings array. `ADVISORY_FINDINGS` requires a
non-empty findings array.

Neither the Gemini nor Jules reviewer-returned object contains stdout, stderr,
HTTP-response, or transcript hash fields. Unknown hash fields invalidate the
closed reviewer schema. After complete capture, a future controller writes
provider-specific byte lengths and SHA-256 hashes to private
`attempt-result.json`: Gemini requires complete `stdout` and `stderr`; Jules
requires a deterministic manifest covering every create, reconciliation, plan,
approval, poll, terminal-session, and terminal-result response. That
controller-owned record is separate from the reviewer receipt and is not
returned to either reviewer. Overflowed or incomplete artifacts cannot produce
a valid attempt result.

Findings must cite current evidence, state impact, and recommend a bounded
correction. Reviewer conclusions are advisory; tests and parent dispositions
remain independent.
