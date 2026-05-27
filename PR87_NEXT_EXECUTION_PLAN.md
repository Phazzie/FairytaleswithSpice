# PR #87 Finish-And-Merge Execution Plan

Created: 2026-05-27

Executor: Codex.

This plan is intentionally narrow. The goal is to finish polishing PR #87, get it reviewed, merge it, and verify production. It does not continue building major new features on top of an already large recovery PR.

## One-Sentence Goal

Merge PR #87 as the clean recovery baseline for PR #70 Story Lab plus Vercel deployment, without adding new product scope before merge.

## Why This Plan Replaces The Earlier Plan

The earlier plan included good next-phase work: Story Lab production adapter, durable persistence, Proving Grounds quality lab, AI evals, dependency refresh, and more. Those are legitimate follow-up projects, but PR #87 is already large enough. Continuing to add feature work would make review harder and increase merge risk.

The correct sequence now is:

1. Stop adding scope to PR #87.
2. Polish and correct the current branch.
3. Run review and validation.
4. Merge PR #87.
5. Verify production.
6. Start follow-up work in smaller PRs.

## Current Known State

- Repository: `/Users/hbpheonix/fairytaleswithspice`
- Branch: `recovery-pr70-story-lab-vercel`
- Remote tracking branch: `origin/recovery-pr70-story-lab-vercel`
- GitHub PR: #87, `https://github.com/Phazzie/FairytaleswithSpice/pull/87`
- PR title: `Recover PR #70 Story Lab and Vercel path`
- PR state at last check: open draft
- Deployment target: Vercel
- Canonical API service path: `api/_lib/*`
- Canonical story service: `api/_lib/services/storyService.ts`
- Angular app path: `story-generator/`
- Recovery validation script: `scripts/recovery/preflight.sh`
- Unrelated local folder: `pocketfm-contest-forge/`; do not touch it.

## Product Direction To Preserve

- PR #70 is the Story Lab baseline.
- Vercel is the deployment target.
- Audio runtime is deferred.
- Story-generation ideas from audio PRs have already been mined into the recovery ledgers.
- Old DigitalOcean guidance is historical, not active.
- Old PRs have been ported, mined, closed, or superseded by #87.
- The story-generation engine must remain centralized; do not create another active story service.

## Non-Goals Before Merge

Do not do these before #87 merges:

- Do not build the Story Lab production adapter.
- Do not add durable Story Lab persistence.
- Do not turn Proving Grounds into the full story-quality lab.
- Do not implement AI story evals.
- Do not recreate dependency PR #84.
- Do not restore audio runtime.
- Do not add new storage products.
- Do not do broad UI redesign.
- Do not add new Copilot/Spark trial artifacts to the recovery PR unless they directly reduce merge risk.

These are follow-up PRs after #87 lands.

## Current Uncommitted Items To Decide

At the time this plan was written, the worktree had:

- `package.json`: Spark added `test:grok-smoke`.
- `scripts/recovery/preflight.sh`: Spark added function-count check.
- `story-generator/src/app/proving-grounds/proving-grounds.css`: Spark minified/reduced CSS.
- `story-generator/angular.json`: may be touched if the accepted CSS fix preserves readable source and needs an explicit component-style warning threshold.
- `scripts/recovery/check-vercel-function-count.sh`: Spark added Vercel function-count guard.
- `tests/grok-smoke.test.ts`: Spark added gated real Grok smoke test.
- `STORY_QUALITY_EVALS_PLAN.md`: Spark added future evals plan.
- `SPARK_TRIAL_TASKS.md`: local Spark trial checklist/note.
- `PR87_NEXT_EXECUTION_PLAN.md`: this plan.
- `pocketfm-contest-forge/`: unrelated; ignore.

Disposition for #87:

| Item | Keep In #87? | Action |
|---|---:|---|
| `scripts/recovery/check-vercel-function-count.sh` | Yes | Keep if review passes; it directly protects Vercel deploy shape. |
| `scripts/recovery/preflight.sh` function-count call | Yes | Keep if the check is correct and quick. |
| `story-generator/src/app/proving-grounds/proving-grounds.css` | Maybe | Do not keep Spark's one-line minified version. Rewrite maintainably or revert and document the existing warning. |
| `story-generator/angular.json` | Maybe | Keep only if used to document a deliberate component-style warning budget instead of source minification. |
| `tests/grok-smoke.test.ts` | No by default | Move to post-merge follow-up unless the user explicitly chooses to include it. It is useful, but not required to merge #87. |
| `package.json` `test:grok-smoke` script | No by default | Revert with the smoke test unless explicitly included. |
| `STORY_QUALITY_EVALS_PLAN.md` | No by default | Move to post-merge follow-up. Useful planning, but new scope. |
| `SPARK_TRIAL_TASKS.md` | No | Keep local if desired, but do not include in PR #87. |
| `PR87_NEXT_EXECUTION_PLAN.md` | Maybe | Keep only if the user wants the plan committed. Otherwise use it as local execution guidance. |

## Critical Issues Already Found

1. Spark's CSS change is not merge-ready.
   - It changed the Proving Grounds stylesheet into one minified line.
   - It removed interaction affordances such as hover/focus states and spinner animation.
   - Even though the Angular build warning is gone, the patch is a maintainability and possible UX regression.

2. PR #87 body contains stale language.
   - It still says `jq` is missing locally, but `jq-1.8.1` is installed.
   - It still says audio PRs need final mining/closure, but audio PRs were already mined and closed.
   - It says Proving Grounds CSS is within budget after cleanup, but that should not be claimed until the final accepted CSS fix is in place.

3. The current branch should not absorb more future-work docs before merge.
   - `STORY_QUALITY_EVALS_PLAN.md` is useful, but it belongs after #87 unless deliberately included.
   - The same applies to the Grok smoke test if the immediate goal is merge.

## Execution Rules For Codex

1. Before edits, run `git status --short --branch`.
2. Do not touch `pocketfm-contest-forge/`.
3. Do not commit Spark trial notes unless explicitly asked.
4. Do not keep one-line minified source files.
5. Do not add new product behavior before merge.
6. Use `apply_patch` for manual file edits.
7. Keep commits small and named by purpose.
8. After each meaningful edit, run `git diff --check`.
9. If validation fails, fix the failure before moving on or document the exact blocker.
10. If a step requires credentials, tokens, paid infrastructure, or Vercel settings not available locally, stop and report the exact need.

## Phase 0 - Freeze Scope

Purpose: prevent PR #87 from growing while polishing it.

Steps:

1. Confirm current branch:

```bash
git status --short --branch
```

Expected:

- Branch should be `recovery-pr70-story-lab-vercel`.
- It should track `origin/recovery-pr70-story-lab-vercel`.
- Ignore untracked `pocketfm-contest-forge/`.

2. State the scope freeze in the changelog.

Edit `PR70_RECOVERY_CHANGELOG.md` and add a short entry:

- PR #87 is now in finish-and-merge mode.
- No new product scope before merge.
- Follow-up work will happen in smaller post-merge PRs.

3. Do not edit adapter/persistence/eval/dependency files during this plan.

Validation:

```bash
git diff --check
```

## Phase 1 - Reconcile Spark Output

Purpose: keep only the Spark work that directly lowers merge/deploy risk.

### 1.1 Review Function-Count Guard

Files:

- `scripts/recovery/check-vercel-function-count.sh`
- `scripts/recovery/preflight.sh`

Acceptance criteria:

- Script is executable.
- Script counts deployable `.ts` files under `api/`.
- Script excludes `_lib` and test/spec files.
- Current count is exactly `12`.
- Preflight calls it after `git diff --check`.
- Output is short and understandable.

Commands:

```bash
ls -l scripts/recovery/check-vercel-function-count.sh
scripts/recovery/check-vercel-function-count.sh
scripts/recovery/preflight.sh --quick --skip-status
git diff --check
```

Decision:

- Keep this in #87 if all checks pass.
- If the count is not `12`, stop and investigate before any other work.

### 1.2 Fix Or Revert Proving Grounds CSS

File:

- `story-generator/src/app/proving-grounds/proving-grounds.css`

Do not keep Spark's one-line minified stylesheet.

Preferred path:

1. Restore readable multi-line formatting.
2. Preserve meaningful interaction states:
   - hover states,
   - focus states,
   - disabled states,
   - spinner animation,
   - responsive media queries.
3. Reduce size only through maintainable cleanup:
   - remove truly unused selectors after checking the component template,
   - consolidate repeated declarations when it stays readable,
   - simplify color notation only where obvious,
   - remove comments that are not useful.
4. Run the Angular build with Node 20.
5. Confirm the CSS budget warning is gone.

Fallback path:

- If the warning cannot be fixed cleanly within the component file, restore the original readable CSS and leave the warning documented.
- A CSS budget warning is less harmful than a hard-to-review UI behavior regression.

Commands:

```bash
git diff -- story-generator/src/app/proving-grounds/proving-grounds.css
cd story-generator && npx -p node@20 -c "node -v && npm run build"
git diff --check
```

Acceptance criteria:

- File is readable.
- File has final newline.
- Hover/focus/spinner behavior is preserved unless proven unused.
- Angular build passes.
- Budget warning is either gone or explicitly documented as intentionally deferred.

### 1.3 Remove Or Defer Grok Smoke Test From #87

Files:

- `tests/grok-smoke.test.ts`
- root `package.json`

Default decision:

- Do not include this in #87.
- It is useful, but it is new validation scope and can be a small follow-up PR after #87 merges.

Action:

- Revert the `package.json` script addition.
- Leave `tests/grok-smoke.test.ts` untracked or move the idea into post-merge notes if the user wants it preserved.

If the user explicitly chooses to include it:

- Add a timeout.
- Add clearer network error handling.
- Keep it skipped unless both `RUN_REAL_GROK_SMOKE=1` and `XAI_API_KEY` are set.
- Do not add it to default `npm test` or preflight.

Validation if included:

```bash
npm run test:grok-smoke
npm test
git diff --check
```

Expected skip output when credentials are absent:

```text
SKIP: Set RUN_REAL_GROK_SMOKE=1 and XAI_API_KEY to run the real Grok smoke test.
```

### 1.4 Defer Story Quality Evals Plan

File:

- `STORY_QUALITY_EVALS_PLAN.md`

Default decision:

- Do not include this in #87.
- Create it in a follow-up PR after the recovery baseline lands.

Reason:

- It is planning for a future feature area, not necessary to merge the recovery PR.

### 1.5 Do Not Commit Spark Trial Notes

File:

- `SPARK_TRIAL_TASKS.md`

Decision:

- Do not commit to #87.
- It is a local evaluation artifact, not product or recovery documentation.

## Phase 2 - Correct PR #87 Body

Purpose: make the GitHub PR description accurate for reviewers.

Current stale claims to remove or correct:

- Remove `jq is still missing locally`; it is installed as `jq-1.8.1`.
- Remove `Audio PRs still need final mining/closure`; that is complete.
- Do not claim CSS warning is fixed until the accepted CSS solution is committed.
- Update validation section after final checks run.

Required PR body sections:

- Summary
- Included material
- Reviewer map
- Validation
- Known remaining issues
- Follow-up work after merge

Suggested follow-up section:

```markdown
## Follow-up after merge

- Recreate dependency update work from the merged baseline.
- Add gated real Grok smoke testing in a small validation PR.
- Decide and implement durable Vercel-compatible Story Lab persistence.
- Connect Story Lab workflows more directly to the canonical story service where mock/demo paths remain.
- Build story-quality/AI eval work from a smaller dedicated PR.
- Revisit audio-ready story metadata later; active audio runtime remains deferred.
```

Command to edit body:

```bash
gh pr edit 87 --repo Phazzie/FairytaleswithSpice --body-file /tmp/pr87-body.md
```

Validation:

```bash
gh pr view 87 --repo Phazzie/FairytaleswithSpice --json body,url,isDraft,state
```

Acceptance criteria:

- No stale statements.
- Reviewers can tell what is in #87.
- Reviewers can tell what is intentionally not in #87.
- Follow-up work is listed without making it part of this PR.

## Phase 3 - Run Focused Code Review

Purpose: find blockers before merge.

Use a review stance. Prioritize bugs, regressions, stale docs, missing validation, and merge blockers.

Review surfaces:

1. Vercel shape:
   - `vercel.json`
   - `api/`
   - `api/_lib/`
   - `scripts/recovery/preflight.sh`
   - `scripts/recovery/check-vercel-function-count.sh`

2. Story generation:
   - `api/_lib/services/storyService.ts`
   - `api/_lib/config/authorStyles.ts`
   - `api/_lib/services/tropeSubversionService.ts`
   - `api/_lib/services/cliffhangerService.ts`
   - `api/_lib/types/contracts.ts`

3. Story Lab and Angular shell:
   - `story-generator/src/app/`
   - `story-generator/src/app/contracts.ts`
   - `story-generator/src/app/proving-grounds/`

4. Recovery docs:
   - `PR70_RECOVERY_FINAL_REPORT.md`
   - `PR70_RECOVERY_TURNOVER_LETTER.md`
   - `PR70_RECOVERY_CHANGELOG.md`
   - `LESSONS_LEARNED.md`
   - `NOT_TAKEN_FEATURE_LEDGER.md`
   - `PR70_RECOVERY_LEDGER.md`

Review questions:

- Does the branch still deploy on Vercel?
- Did any helper file move back outside `api/_lib`?
- Did audio runtime reappear in active API routes?
- Did any duplicate story service reappear?
- Does Story Lab still have mock/demo paths that should be documented as follow-up?
- Are docs accurate about what remains?
- Did Spark's CSS change create a UI regression?
- Are all old PRs represented in ledger/final report?

Artifact:

- If findings are non-trivial, create `PR87_REVIEW_NOTES.md`.
- If findings are small, record them in `PR70_RECOVERY_CHANGELOG.md`.

Acceptance criteria:

- No known merge blockers remain.
- Known follow-up items are documented as follow-up, not hidden risk.

## Phase 4 - Final Local Validation

Purpose: prove the branch is locally healthy before merging.

Run:

```bash
git diff --check
scripts/recovery/preflight.sh --skip-status
cd story-generator && npx -p node@20 -c "node -v && npm run build"
npm test
npm run build:verify
```

Expected:

- `git diff --check` passes.
- Preflight passes.
- Angular build passes under Node 20.
- Root tests pass.
- Vercel fallback `index.html` verification passes.

Known acceptable warning:

- `baseline-browser-mapping` may still warn that data is over two months old.

Known historical local issue:

- Karma/ChromeHeadless browser capture may still be unreliable locally. Do not treat that as passing browser coverage. Document it if still true.

If validation fails:

1. Fix the failure if it is inside #87's scope.
2. If it is outside scope or environment-only, document exact command and output.
3. Do not merge with unexplained failures.

## Phase 5 - Commit Final Polish

Purpose: create a small, reviewable final commit or commits.

Recommended commit slices:

1. Vercel function-count guard:

```bash
git add scripts/recovery/check-vercel-function-count.sh scripts/recovery/preflight.sh
git commit -m "chore: guard Vercel function count in recovery preflight"
```

2. Proving Grounds CSS polish if accepted:

```bash
git add story-generator/src/app/proving-grounds/proving-grounds.css
git commit -m "style: keep proving grounds CSS within budget"
```

3. Recovery docs/PR finish notes if changed:

```bash
git add PR70_RECOVERY_CHANGELOG.md LESSONS_LEARNED.md PR87_NEXT_EXECUTION_PLAN.md
git commit -m "docs: document PR87 finish plan"
```

Do not include by default:

```text
SPARK_TRIAL_TASKS.md
STORY_QUALITY_EVALS_PLAN.md
tests/grok-smoke.test.ts
pocketfm-contest-forge/
```

Before each commit:

```bash
git status --short
git diff --cached --check
```

After commits:

```bash
git status --short --branch
git log --oneline -5
```

## Phase 6 - Push And Verify Preview

Purpose: make GitHub/Vercel validate the exact branch reviewers will merge.

Run:

```bash
git push origin recovery-pr70-story-lab-vercel
```

Then verify:

1. GitHub PR #87 shows the latest commit.
2. Vercel creates a deployment for the pushed commit.
3. Deployment reaches `READY`.
4. Root URL returns `200`.
5. `/api/health` returns `200` through the protected-preview access path.
6. Vercel reports expected function count, currently `12` Node functions.

Important:

- Normal unauthenticated `curl` can return Vercel Authentication because preview protection is enabled.
- Use Vercel connector/share/access tooling or a configured bypass token for protected-preview smoke checks.

Acceptance criteria:

- Latest branch-tip preview is `READY`.
- Root smoke passes.
- `/api/health` smoke passes.
- No new function-count issue appears.

## Phase 7 - Move PR Out Of Draft

Purpose: make #87 ready for final review.

Before marking ready:

- PR body is accurate.
- Final local validation passed.
- Vercel preview is ready.
- Known remaining issues are documented as follow-up.

Command:

```bash
gh pr ready 87 --repo Phazzie/FairytaleswithSpice
```

Then:

```bash
gh pr view 87 --repo Phazzie/FairytaleswithSpice --json isDraft,state,mergeStateStatus,reviewDecision,url
```

Acceptance criteria:

- `isDraft` is `false`.
- Merge state is not blocked by stale checks or conflicts.

## Phase 8 - Merge PR #87

Purpose: land the recovery baseline.

Before merge:

```bash
gh pr checks 87 --repo Phazzie/FairytaleswithSpice
gh pr view 87 --repo Phazzie/FairytaleswithSpice --json mergeStateStatus,reviewDecision,isDraft,state
```

If checks are green and review requirements are satisfied, merge using the repo's preferred merge method. If no preference is known, use GitHub's default for the repository.

Command options:

```bash
gh pr merge 87 --repo Phazzie/FairytaleswithSpice
```

or, if the repo expects merge commits:

```bash
gh pr merge 87 --repo Phazzie/FairytaleswithSpice --merge
```

Acceptance criteria:

- PR #87 is merged.
- Source branch can remain until production verification completes.

## Phase 9 - Verify Production After Merge

Purpose: prove the merged branch works after GitHub/Vercel production flow.

Steps:

1. Fetch latest `main`.

```bash
git fetch origin
git switch main
git pull --ff-only origin main
```

2. Confirm #87 merge commit is present.

```bash
git log --oneline -10
```

3. Verify Vercel production deployment for `main`.

Check:

- deployment state is `READY`,
- root URL returns `200`,
- `/api/health` returns `200`,
- `grok` reports configured if production env is configured,
- function count remains expected.

4. Run a local smoke if desired:

```bash
scripts/recovery/preflight.sh --quick --skip-status
```

Acceptance criteria:

- Production is live and healthy.
- No deployment regression from merging.

## Phase 10 - Create Post-Merge Backlog

Purpose: preserve important next work without bloating #87.

Create issues or a follow-up planning doc for:

1. Gated real Grok smoke test.
2. Story Quality AI Evals plan.
3. Story Lab production adapter to canonical `StoryService`.
4. Vercel-compatible Story Lab persistence decision.
5. Proving Grounds story-quality lab.
6. Fresh dependency refresh replacing old PR #84.
7. Browser/e2e verification strategy.
8. Audio-ready metadata mode without active audio runtime.

Each follow-up should be a small PR with its own validation.

## Final Report To User

After completion, report:

- what was changed before merge,
- what was deliberately not included,
- validation commands and results,
- Vercel preview and production evidence,
- whether PR #87 merged,
- remaining follow-up list,
- any surprises or mistakes found.

## Stop Conditions

Stop and ask the user before proceeding if:

- The user wants to include Grok smoke or AI evals in #87 despite the scope freeze.
- CSS cannot be fixed cleanly without a design or budget decision.
- Vercel deployment requires paid storage, new secrets, or account changes.
- PR #87 has merge conflicts after push.
- GitHub checks fail for reasons unrelated to the final polish.
- Any command would touch `pocketfm-contest-forge/`.
- Any step would restore audio runtime or DigitalOcean as active deployment.

## Definition Of Done

This plan is done when:

- #87 contains only recovery/polish needed to merge the baseline.
- Spark's unsafe CSS patch is fixed or reverted.
- Function-count guard is either accepted and committed or intentionally left out.
- PR body is accurate.
- Local validation passes or failures are documented with exact reasons.
- Vercel branch preview is verified.
- PR #87 is marked ready and merged.
- Production deployment after merge is verified.
- Follow-up work is listed outside #87.
