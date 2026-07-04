# PR #121 Contrarian Strategy Review

Date: 2026-07-03
Investigation scope: `PR #121` only (Angular dependency bump), no code edits beyond this report.

## Status

Workspace: `/tmp/fairytales-pr121-investigation`
Branch: `recovery/pr121-angular-investigation`
PR #121 state: `OPEN`
Current branch health: `git status --short --branch` shows only existing untracked files unrelated to this report.

## Commands run (read-only for repo; report write only)

- `git status --short --branch`
- `gh pr view 121 --json number,title,state,baseRefName,headRefName,url,changedFiles,statusCheckRollup,files`
- `gh pr checks 121 --json ...` (JSON shape probe failed)
- `gh pr checks 121`
- `gh run view 27851333522 --job 82430818835 --log-failed`
- `gh issue view 132 --json number,title,state,body,updatedAt,url`
- `gh pr view 120 --json number,title,state,changedFiles,statusCheckRollup`
- `git fetch origin pull/121/head:pr121-remote`
- `git show --stat --name-only --oneline pr121-remote`
- `git show pr121-remote -- story-generator/package.json`
- `cat package.json`
- `cat story-generator/package.json`
- `sed -n` slices of `AGENTS.md`, `STORY_LAB_COMPLETION_HARDENING_EXEC_PLAN.md`,
  `STORY_LAB_FINAL_MERGE_AUDIT_EXEC_PLAN.md`
- `rg` across guidance/changelog files for Angular 20/120/121/132 references.

## Evidence Snapshot

Implementation path in PR #121:
- Changed files: `story-generator/package.json`, `story-generator/package-lock.json`
- Angular 20 → 22 updates in `story-generator`:
  - `@angular/common`, `@angular/core`, `@angular/compiler`, `@angular/forms`,
    `@angular/platform-browser`, `@angular/platform-server`, `@angular/router`,
    `@angular/ssr`, `@angular/build`, `@angular/compiler-cli`
- No source code changes in app/runtime logic; this is dependency surface + lockfile only.

CI outcome:
- `Validate Vercel recovery build`: fail
- `Vercel`: fail
- `SonarCloud` and `SonarCloud Code Analysis`: pass
- Log failure is deterministic during `npm ci --no-audit --no-fund` in `story-generator` install step.
- Specific error: `@angular/build@22.0.3` requires peer `typescript@">=6.0 <6.1"` but repository resolves `typescript@5.9.3`.

Repo baseline constraints:
- `AGENTS.md` explicitly states current stack is `Angular 20 with SSR` and `TypeScript 5.9.x`.
- Existing completion-hardening plans already identify `#121` as an Angular 22 major-upgrade PR with constraints beyond current baseline and call for close/recreate behavior.

Unconventional-risk context:
- Existing recovery work in guidance emphasizes unfinished higher-value work (live auth/database proof, route/storage/job hardening) before broad upgrade churn.
- Previous PR #120 handling used split replacement for root-only dependency updates, reinforcing “separate major upgrade branch” behavior after failed mixed changes.
- No review signal in PR #121 that the dependency bump is functionally validated; only Vercel preview failures are present.

## Contrarian strategy scoring (1 = weak, 10 = strong confidence)

### A) Repair PR #121 in place
- Score: **3 / 10**
- Evidence strength: **High** conflict clarity, **low** path coherence.
- Why low: would require partial surgery on a dependabot-generated bump while preserving mixed assumptions from a failing major bump; still leaves `AGENTS.md` baseline mismatch unresolved.
- Estimated risk: high; would likely become a “third variant” of the same issue.

### B) Close PR #121 and open a clean Angular 22 branch
- Score: **8 / 10**
- Evidence strength: **High**
- Why high: directly matches explicit recovery guidance that PRs #120/#121 should be closed/recreated; avoids patching generated dependency diffs and allows a dedicated Angular-major migration plan (toolchain + TS 6 alignment + validation plan).
- Estimated effort: medium; requires coordinated, explicit migration branch and validation matrix.

### C) Do Angular 20 latest patch/minor hardening first
- Score: **6 / 10**
- Evidence strength: moderate.
- Why medium: it can deliver near-term reliability and aligns with keeping current stack stable, but it does not resolve the open “failed Angular 22” dependency debt in PR #121 and does not reduce its stale status by itself.
- Estimated risk: moderate-low for current stack, high for PR #121 closure delay.

### D) Defer Angular 22 behind higher-value work
- Score: **7 / 10**
- Evidence strength: **Moderate**
- Why medium-high: resource budget is currently constrained by recovery/hardening priorities, but unresolved PR triage remains open and slows completion posture if ignored.
- Estimated risk: medium; could improve product value faster but may leave dependency governance lagging.

## Recommendation

**Recommended move: B) close PR #121 and reopen Angular 22 as a clean, scoped migration branch.**

Primary reasoning:
1. The failure is a hard dependency contract mismatch, not an application regression; quick patching in place is noise.
2. Active repo guidance already mandates closing/recreating rather than in-place patching for these major-upgrade dependabot PRs.
3. A clean branch lets the Angular-major path include all required companion constraints (TypeScript/toolchain/Node/SSR validation) instead of pretending a partial dependency bump is self-contained.
4. This also preserves room to keep higher-value recovery hardening work visible and separately gated.

## Top risks (ranked)

1. **Toolchain mismatch risk**: TS 6 migration may expose implicit source/tool assumptions.
2. **Test coverage gap**: Angular SSR/runtime behavior has limited direct coverage today; major upgrade could pass installs but break hydration/routing paths.
3. **CI noise risk**: Vercel/node-deprecation and lockfile churn can mask real migration bugs if not normalized in a dedicated branch.
4. **Execution drift risk**: reopening Angular 22 without strict scope control can regress to another mixed dependency+app upgrade PR.
