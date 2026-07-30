# Story Lab Foundation and Living Book ExecPlan

Last updated: 2026-07-30 05:43 EDT

This is Plan 1 of the current two-plan Story Lab completion sequence. It is a living ExecPlan and must be maintained under `.agent/PLANS.md`. It owns the work from the current merged recovery baseline through an explicitly accepted Living Book interface. `STORY_LAB_PRODUCTION_COMPLETION_EXEC_PLAN.md` starts only from Plan 1's exact merge SHA.

This plan supersedes the unfinished execution order in `STORY_LAB_COMPLETION_HARDENING_EXEC_PLAN.md`, `STORY_LAB_FINAL_MERGE_AUDIT_EXEC_PLAN.md`, and `STORY_LAB_FUTURE_WORK_CHECKLIST.md`. Those documents remain evidence of completed recovery work, earlier findings, and Definition-of-Done history.

## Purpose and user-visible result

When this plan is complete, a user can open Story Lab, create a story from a calm creation-first screen, read and continue it in a reader-first Living Book, return to a useful local library, and use the experience at desktop, tablet, and phone widths. The user will have approved both the foundational direction and the final exact candidate.

The plan also removes two sources of later regret before the UI is accepted:

1. external review becomes a reproducible, exact-source advisory with a mechanically checked disposition record rather than an unverifiable chat ritual; and
2. the known dependency repair is rebuilt from current evidence rather than merging a stale Dependabot PR or blindly copying a dirty lockfile.

Plan 1 does **not** claim production accounts, cloud durability, durable background generation, queue processing, or production deployment readiness. Anonymous create, continue, and browser-local save behavior must continue to work.

## Context and orientation

- Current Git state and `origin/main` outrank this prose when they disagree. Record and resolve the disagreement before editing.
- The larger worktree at `/Users/hbpheonix/fairytaleswithspice-ui-redesign-exploration` is the preferred source to mine for Living Book architecture.
- `/Users/hbpheonix/fairytaleswithspice-moonlit-living-book-ui` is visual reference only.
- `/Users/hbpheonix/fairytaleswithspice-process-guardrails` is a dependency/test candidate to audit, not a source to copy wholesale.
- Never merge or cherry-pick one of those dirty worktrees as a unit. Inventory it, select named files or hunks, and port them onto a fresh branch from current `origin/main`.
- Preserve `story-generator/src/app/app.ts` as the orchestration and business-state owner unless a focused contract test proves a deliberate change.
- Do not add cloud or durable-job behavior in this plan.
- Do not increase the existing component-style or production bundle budgets to make the redesign pass.
- Proving Grounds remains a debug/evaluation surface; it must not dominate the ordinary reader experience.

## Progress

- [x] (2026-07-30) Reconstructed current repo, branch, route-budget, plan, and dirty-worktree truth.
- [x] (2026-07-30) Chose a two-plan sequence and a five-PR Plan 1 train.
- [x] (2026-07-30) Defined exact-source Gemini/Jules review boundaries and the bootstrap anti-self-certification rule.
- [ ] PR P1-01: build and bootstrap the external-review controller.
- [ ] PR P1-02: run the harmless canary, enable the mechanical local gate only if it passes, and record that GitHub enforcement remains a separate approval.
- [ ] PR P1-03: replace the stale dependency PR from a current audit.
- [ ] PR P1-04: establish the Living Book shell and obtain early user acceptance.
- [ ] PR P1-05: finish the Living Book and obtain final user acceptance.
- [ ] Record Plan 1's final merge SHA as Plan 2's immutable starting point.

## Surprises and discoveries

- The installed Antigravity CLI did not reliably consume a piped plan when `-p` also supplied a prompt. It reviewed stale, unrelated “Web HUD” context while appearing to run successfully. Automated use must therefore pass the complete bounded packet as an argument array, close stdin, use a fresh exact-SHA checkout, and validate echoed bindings.
- The local `agy` model catalog currently advertises `gemini-3.1-pro-high`; the generic `--model pro --effort high` combination is not valid because `--effort` is not supported for that model. Runtime discovery must precede invocation.
- There are three dirty sibling worktrees with useful but overlapping work. Their existence is an asset only if they are mined selectively; treating any one as authoritative would overwrite later fixes.
- The initial external-review controller cannot honestly emit a passing required check for the PR that creates it. Bootstrap and canary must be separate.
- A committed review packet cannot contain the SHA of the commit that contains it. The committed packet body and private post-commit attempt envelope must be separate artifacts.
- Small subagent tickets improve isolation, but making every ticket its own PR would increase integration and review debt. The unit of worker ownership is intentionally smaller than the unit of publication.

## Decision log

- Decision: publish Plan 1 as five coherent PRs, with much smaller worker tickets inside each PR.
  Rationale: this preserves aggressive parallel execution while keeping review, rollback, and acceptance boundaries understandable.
  Date: 2026-07-30.

- Decision: use local Scope Prosecutor and Completion Prosecutor reviews on every coherent PR; use Gemini once at the final candidate head; add Jules only for mechanically high-risk boundaries.
  Rationale: repeated reviews of every microticket create noise and stale receipts without improving final-head assurance.
  Date: 2026-07-30.

- Decision: call the status `story-lab/external-review-disposition`.
  Rationale: if a separately approved trusted producer is later implemented, this name proves bound receipts and disposition completeness, not that an AI reviewer was correct. The default P1 outcome is a mechanical local gate, not a required GitHub status.
  Date: 2026-07-30.

- Decision: the controller PR uses a one-time recorded bootstrap waiver, then a harmless canary proves fail-closed local behavior. Required GitHub enforcement is a separate, user-authorized security design.
  Rationale: candidate code must never grade or certify itself.
  Date: 2026-07-30.

- Decision: publish only `.agents/skills/fairytales-external-review/` and `.agents/skills/fairytales-story-lab-slice/` from the previously local `.agents/` tree.
  Rationale: the user explicitly requested a repo skill and AGENTS routing for this workflow. `fairytales-pr-recovery` and every `pocketfm-*` skill remain unrelated, unstaged, and local-only. The pre-existing Recommendation Risk Calibration hunk in `AGENTS.md` also remains unstaged unless separately authorized.
  Date: 2026-07-30.

- Decision: the larger UI exploration is the source candidate, the smaller Moonlit worktree is reference only, and neither is merged wholesale.
  Rationale: the larger exploration has the more complete component model; selective porting keeps current `main` fixes.
  Date: 2026-07-30.

- Decision: require early direction approval after the shell, hierarchy, and responsive frames, before finishing secondary panels.
  Rationale: late-only acceptance is the most expensive point to discover that the product feels wrong.
  Date: 2026-07-30.

## Review protocol used by every PR

The canonical operational contract is `docs/EXTERNAL_REVIEW_POLICY.md`. In plain terms:

1. The parent freezes intent, exact file scope, mechanics, and verification.
2. A read-only Scope Prosecutor attacks that scope before edits.
3. Workers receive tiny, disjoint file leases. The parent owns shared files, decisions, integration, GitHub comments, and publication.
4. A read-only Completion Prosecutor attacks the integrated diff, tests, and claims.
5. The parent runs tests independently and records every material finding as fixed, rejected with evidence, duplicate, linked out of scope, or explicitly user-authorized deferral.
6. Gemini reviews one committed exact-head packet at the final candidate head. Any tracked commit invalidates the receipt.
7. Jules is additionally required for auth/ownership, cloud storage, privacy/streaming/CORS/redaction, job durability/restart behavior, deployable routes, major dependency/framework changes, the final Living Book candidate, and final production closure.
8. Raw external output remains private. The parent posts only deduplicated findings and evidence-backed dispositions.

The Plan 1 and Plan 2 freezes themselves receive both Gemini and Jules review. External advice is evidence, not authority: a reviewer can fail, hallucinate, or disagree, and the parent must adjudicate it.

## Interfaces and dependencies

- Review automation is a dependency-free Node controller with process and HTTP adapters. It may use Git, the installed `agy` binary, Jules `v1alpha`, and GitHub checks, but candidate code cannot grade itself.
- The Living Book is an Angular presentation architecture over existing `app.ts` orchestration, Story Lab service calls, story state, browser-local library behavior, Director Room, and debug-only Proving Grounds.
- Presentational components exchange typed inputs/outputs and never own provider calls, auth, storage, or cross-component orchestration.
- The current component-style, bundle, Vercel route, anonymous behavior, and fail-closed provider contracts remain constraints.
- Sibling worktrees are source evidence only and remain untouched.

## Plan of work: PR train and microtickets

### P1-01 — External-review bootstrap

Outcome: a dependency-free local controller can build exact-source packets, validate Gemini and Jules receipts, track parent dispositions, and refuse to certify its own PR. It is not yet a required GitHub check.

Prospective implementation surfaces:

- `docs/EXTERNAL_REVIEW_POLICY.md`
- `scripts/recovery/story-lab-external-review-core.mjs`
- `scripts/recovery/story-lab-external-review.mjs`
- `tests/story-lab-external-review.test.mjs`
- `.agents/skills/fairytales-external-review/`
- `package.json`
- `AGENTS.md`

Microtickets, deliberately smaller than the publication unit:

| Ticket | Owned result | Expected files | Proof |
|---|---|---|---|
| P1-01A | Inventory current `agy`, Jules, Git, and GitHub interfaces without mutation. | Evidence note only | Exact versions/models/endpoints recorded; no credentials printed. |
| P1-01B | Define versioned committed-packet, private attempt-envelope, receipt, finding, and disposition schemas. | controller core + focused tests | Valid fixtures pass; self-referential head fields, unknown fields/states, and missing bindings fail. |
| P1-01C | Implement SHA/digest and exact-head binding helpers. | controller core + focused tests | Wrong head, changed packet, and changed policy fail. |
| P1-01D | Implement private attempt state and lock lifecycle. | controller core + focused tests | Duplicate attempt, stale lock, timeout, and output overflow are deterministic. |
| P1-01E | Implement the Gemini process adapter with argument arrays and closed stdin. | controller CLI + fake `agy` tests | Stale context, prose, invalid JSON, mutation, timeout, and exit-zero auth text fail. |
| P1-01F | Implement the Jules REST state machine and ambiguous-POST reconciliation. | controller CLI + fake HTTP tests | Blind retry is impossible; wrong plan digest and unsafe plans fail. |
| P1-01G | Implement finding normalization and disposition completeness. | controller core + tests | P0/P1 block; P2 requires an allowed disposition. |
| P1-01H | Implement self-test and bootstrap refusal commands. | controller CLI + tests | Candidate controller cannot post success for itself. |
| P1-01I | Add package commands and concise repo guidance. | `package.json`, `AGENTS.md`, skill | Commands resolve; skill validation passes. |
| P1-01J | Independently prosecute completion and inspect live reviewer results. | no worker writes | Parent records findings and a single bootstrap waiver. |

Integration order is B, C, D, E/F in parallel, G, H, I, J. Only the parent edits `package.json`, `AGENTS.md`, shared policy prose, and changelogs.

Minimum validation:

    node --check scripts/recovery/story-lab-external-review-core.mjs
    node --check scripts/recovery/story-lab-external-review.mjs
    node --test tests/story-lab-external-review.test.mjs
    npm run test:external-review
    npm run review:external -- self-test
    git diff --check
    npm run test:all

The PR may merge only with the documented bootstrap waiver and direct parent inspection. It must not create a required workflow or success status.

### P1-02 — Harmless external-review canary and enforcement decision

Outcome: the controller version merged on `origin/main`, never the candidate version, proves the exact integration and fail-closed cases. A passing canary makes the local disposition gate usable. It does not by itself authorize or create a required GitHub status.

Microtickets:

| Ticket | Owned result | Proof |
|---|---|---|
| P1-02A | Create a harmless, committed canary packet and exact-SHA branch. | Packet digest and source SHA are reproducible from a clean clone. |
| P1-02B | Exercise the Gemini live adapter in a disposable remote-free clone. | Valid JSON receipt binds the expected attempt, packet, base, and head. |
| P1-02C | Exercise Jules launch, plan inspection, exact-digest approval, and terminal harvest. | No write/change-set/branch/PR action occurs. |
| P1-02D | Run negative fixtures: wrong head, stale packet, invalid Gemini JSON, ambiguous Jules POST, undispositioned P1, and bootstrap self-success. | Every case fails for the expected reason. |
| P1-02E | Prove any new tracked commit invalidates the receipt. | Gate fails after a harmless head change and passes only after new review. |
| P1-02F | Record the enforcement decision. Default to local/advisory; propose GitHub enforcement only as a separately approved design. | Any proposal names producer identity, trusted default-branch code source, trigger, permissions, credential/signing boundary, candidate-code isolation, rule enablement, and rollback. No required status is enabled without explicit approval. |

If either live adapter or any negative case cannot meet the contract, P1-02 fails and Plan 1 cannot complete. Record the exact failure and fix the adapter in a new bootstrap-scoped PR. Do not simulate a pass or weaken the gate to continue.

### P1-03 — Current dependency replacement

Outcome: current audit evidence replaces stale PR #194 without broad framework migration.

Scope:

- re-audit current `origin/main`, registry advisories, supported Angular 20 versions, CI, and the candidate worktree;
- repair root `form-data` if still vulnerable;
- align only the Angular 20 patch/minor set proven compatible by the current toolchain;
- keep Angular 22 as a separate post-completion decision;
- close or supersede PR #194 only after its replacement merges.

Microtickets:

| Ticket | Owned result | Proof |
|---|---|---|
| P1-03A | Snapshot PR #194 and current audit/CI state. | Exact head/base, changed files, checks, advisories, and replacement reason recorded. |
| P1-03B | Diff the process-guardrails candidate against current `origin/main`. | A hunk-level accept/reject inventory exists; no file has been copied. |
| P1-03C | Reproduce the root advisory and smallest repair. | Root install/audit proves the before/after finding. |
| P1-03D | Prove the Angular 20 candidate against current peer/toolchain constraints. | Clean install, build, unit tests, and browser smoke succeed without Angular 22. |
| P1-03E | Regenerate lockfiles from manifests in one owned worktree. | Lockfiles are reproducible; unrelated dependency churn is rejected. |
| P1-03F | Prosecute the final dependency diff and supersede #194 after merge. | Gemini and Jules exact-head receipts; parent disposition; old PR linked to replacement. |

Stop if the current registry or Angular support evidence no longer matches the candidate. Re-plan from current evidence instead of forcing old versions.

### P1-04 — Living Book foundation and early acceptance

Outcome: the full-page information architecture, visual language, and responsive shell are implemented with existing behavior preserved, and the user explicitly approves the direction before deeper panel work.

Locked product shape:

- signed-out or empty state is creation-first;
- a project with chapters is reader-first;
- Moonlit Conservatory is the default/reset atmosphere;
- library and project navigation remain immediately recoverable;
- Director Room appears after a chapter exists;
- Proving Grounds is debug-only;
- controls reveal complexity progressively instead of presenting every advanced option at once.

Microtickets:

| Ticket | Owned result | Expected files/proof |
|---|---|---|
| P1-04A | Inventory all three dirty candidate worktrees and map every hunk to accept, reference, or reject. | Durable inventory; no writes to candidate worktrees. |
| P1-04B | Freeze behavior and state-preservation contract from current tests and `app.ts`. | Focused contract/spec; anonymous create/continue/local save listed explicitly. |
| P1-04C | Freeze UI model boundaries and component inputs/outputs. | UI model/types only; no visual implementation. |
| P1-04D | Port the shell hierarchy and route-neutral layout. | App shell files; orchestration remains in `app.ts`. |
| P1-04E | Port Moonlit theme tokens and reset behavior. | Theme/style files; style budget checked. |
| P1-04F | Implement creation-first empty framing. | Empty shell only; existing generation call path unchanged. |
| P1-04G | Implement reader-first active framing. | Active shell only; chapter/continue state unchanged. |
| P1-04H | Capture 1440px, 1024px, and 390px evidence plus keyboard/focus checks. | Screenshots and browser-smoke log from the exact candidate head. |
| P1-04I | Hold for explicit user direction acceptance. | User disposition records approve, revise, or reject; no secondary-panel work starts first. |

The parent serializes edits to `app.ts`, `app.html`, global styles, and shared models. Workers may build isolated presentational files in separate worktrees after the contract is locked.

### P1-05 — Living Book completion and final acceptance

Outcome: the accepted shell becomes a complete, accessible, tested Living Book without changing production architecture.

Microtickets:

| Ticket | Owned result | Proof |
|---|---|---|
| P1-05A | Build presentational creation controls against frozen inputs/outputs. | Component tests and no provider/network logic in the component. |
| P1-05B | Build chapter reader and continuation controls. | Existing continue behavior and error/retry states remain covered. |
| P1-05C | Build local library/project navigation. | Browser-local save/load/delete behavior remains explicit and tested. |
| P1-05D | Build progressive advanced-controls rail. | Keyboard, label, and collapsed-state tests. |
| P1-05E | Place Director Room only after a chapter exists. | Empty-state absence and active-state presence tests. |
| P1-05F | Keep Proving Grounds behind the existing debug boundary. | Production build cannot surface it accidentally. |
| P1-05G | Integrate components into the parent-owned shell. | State/orchestration diff is reviewed line by line. |
| P1-05H | Run responsive, accessibility, style-budget, bundle-budget, unit, and real-browser checks. | Exact commands and exit codes recorded. |
| P1-05I | Run final exact-head Gemini and Jules reviews and disposition every finding. | Receipts bind the unchanged candidate head. |
| P1-05J | Obtain explicit user acceptance and merge. | Accepted screenshots point to the exact merged candidate SHA. |

## Concrete steps

At the start of every PR:

    git fetch origin --prune
    git status --short --branch
    npm run recovery:status
    scripts/recovery/check-vercel-function-count.sh

Create a fresh branch/worktree from current `origin/main`. Record the base SHA. Do not alter or clean the three candidate worktrees.

Before implementation, write a four-field scope packet:

    INTENT: the one observable outcome
    SCOPE: exact owned and shared files
    LOGIC: mechanical changes and explicit non-changes
    VERIFICATION: commands, fixtures, browser sizes, and stop conditions

Run the local Scope Prosecutor. For plan freezes and final candidates, submit the committed packet through the external-review contract. Revise until material findings are either incorporated or dispositioned with evidence; do not wait for a magic word from a reviewer.

After integration, run focused tests first, then applicable aggregate checks. Run the Completion Prosecutor against the integrated diff. External review occurs only after the candidate is committed and no further tracked change is expected.

## Validation and acceptance

Every PR must pass:

    git diff --check
    npm run recovery:status
    npm run recovery:finish -- --strict

P1-01 and P1-02 additionally pass all controller self-tests and negative canaries.

P1-03 additionally passes clean installs, root audit, Angular tests/build, Story Lab browser smoke, and the full repository suite.

P1-04 and P1-05 additionally pass:

    npm run test:all
    npm run build:full
    npm run test:story-generator-component-style-budget
    npm run smoke:story-lab-ui

The browser evidence must exercise creation, generation success/error, reading, continuation, local save/load/delete, responsive navigation, keyboard traversal, focus visibility, reduced motion, and debug-surface isolation. A build alone is not UI acceptance.

Plan 1 is complete only when:

- P1-01 through P1-05 are merged to `main`;
- the review controller has passed its post-merge local canary; external conclusions remain advisory, but exact-source binding and disposition checks are mechanical;
- dependency repairs are current and the stale PR is dispositioned;
- the user has approved the final Living Book exact candidate;
- `main` is clean and matches `origin/main`;
- the exact merge SHA is written into Plan 2;
- no production auth, cloud, durability, or deployment claim has been made.

## Idempotence, recovery, and rollback

- Inventory and validation commands are read-only and safe to rerun.
- Review attempts use unique IDs and exact digests. Never overwrite a prior attempt.
- Gemini runs in a disposable exact-SHA clone with remotes removed. A dirty result invalidates the attempt.
- Jules launch persists `POSTING` before the request and reconciles an exact unique title after ambiguous responses. Never blind-retry.
- Lockfiles have one owner and are regenerated from manifests; never merge two lockfile versions.
- UI ports are hunk-selected and committed by bounded outcome. Revert the owning PR rather than copying back an entire worktree.
- If user acceptance rejects the shell, revert or revise P1-04 before starting P1-05.
- If any tracked commit follows an external review, discard the old receipt and review the new head.

## Artifacts and notes

Keep raw external-review stdout, API bodies, and attempt state under `.git/story-lab-external-review/`; they are private local evidence and must not be committed. Commit only sanitized packets, digests, dispositions, and commands/results that contain no secret or private story content.

Record every subagent ticket and integration disposition in `SUBAGENT_LOG.md`. Record PR, validation, dependency, acceptance, and process changes in `PR70_RECOVERY_CHANGELOG.md`.

## Outcomes and retrospective

This section is completed after each PR. Record what shipped, what evidence failed, whether the microticket split helped, what was removed from scope, and what Plan 2 must know. Do not convert an unchecked item to complete based on local-only code or an external-review opinion.
