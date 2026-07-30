# Story Lab two-plan freeze review packet

Schema version: `story-lab-review-packet/v1`
Policy version: `2026-07-30`
Packet ID: `story-lab-two-plan-freeze`
Revision: `1`
Repository: `Phazzie/FairytaleswithSpice`
Change type: ExecPlan, operating-policy, and repo-skill freeze

## Intent

Replace conflicting Story Lab completion guidance with one decision-complete two-plan sequence:

1. foundation and explicitly accepted Living Book UI; then
2. production completion starting from Plan 1's exact merged SHA.

Create a safe programmatic Gemini/Antigravity and Jules review contract that can later become mechanically enforced without trusting stale context, reviewer prose, or candidate code that grades itself.

## Acceptance criteria

- Current execution routes unambiguously through the two new plans.
- Plan 1 has five coherent PRs composed from smaller disjoint worker tickets.
- Plan 2 has a non-merge Queue Gate 0 followed by ten coherent PRs.
- Plan 2 cannot start until the exact Plan 1 merge SHA is recorded.
- Living Book has early and final user-acceptance holds.
- Anonymous create, continue, and browser-local save remain explicit Plan 1 invariants.
- Production auth, cloud, Queue, durability, and deployment remain Plan 2 work.
- The review policy separates a committed packet body from a private post-commit attempt envelope.
- Antigravity invocation forbids stdin piping, shell interpolation, permission bypass, stale conversations, and unvalidated prose.
- Jules remains read-only, reconciles ambiguous launch responses, and requires exact plan-digest approval.
- The initial controller cannot certify itself; the mechanical local gate waits for a post-merge negative canary.
- Required GitHub enforcement remains disabled unless a separate trusted-producer design is explicitly approved.
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
| `E8` | `npm run recovery:status` | PASS: command completed; it reported the expected dirty planning worktree and lack of an upstream for the local branch. | `0` |
| `E9` | `gh pr list --state open --limit 100` plus check inspection | PASS: PR #194 is the only open PR; its Recovery CI and Vercel checks are failing and this change does not alter or close it. | `0` |
| `E10` | fresh-agent forward test for each repo skill | PASS: two independent read-only agents followed the external-review and Story Lab slice routing contracts without a corrective prompt. | N/A: agent evidence |
| `E11` | `npm run test:recovery-finish-check` | PASS: 4 tests passed. | `0` |

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
    "policyVersion": "2026-07-30"
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

Findings must cite current evidence, state impact, and recommend a bounded
correction. Reviewer conclusions are advisory; tests and parent dispositions
remain independent.
