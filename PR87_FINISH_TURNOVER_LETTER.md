# PR #87 Finish-And-Merge Turnover Letter

Created: 2026-05-27

Future agent,

Start here if context was compacted or cleared during PR #87 final polish.

## Current Objective

Finish polishing PR #87, merge it, and verify production. Do not add major new product scope to this already-large recovery PR.

Active plan:

- `PR87_NEXT_EXECUTION_PLAN.md`

## Repo State To Expect

- Repo: `/Users/hbpheonix/fairytaleswithspice`
- Branch: `recovery-pr70-story-lab-vercel`
- GitHub PR: `https://github.com/Phazzie/FairytaleswithSpice/pull/87`
- Deployment target: Vercel
- Canonical shared API path: `api/_lib/*`
- Canonical story service: `api/_lib/services/storyService.ts`
- Ignore unrelated local folder: `pocketfm-contest-forge/`

## User Direction

The user correctly challenged the previous larger execution plan. The current direction is:

1. Stop growing PR #87.
2. Polish only what is needed to merge it.
3. Merge #87.
4. Verify production.
5. Put Story Lab adapter, persistence, AI evals, dependency refresh, and Grok smoke into later smaller PRs.

## Current Spark Output Assessment

Spark completed the local checklist, but not all output should be accepted into #87.

Keep/review for #87:

- `scripts/recovery/check-vercel-function-count.sh`
- `scripts/recovery/preflight.sh` change that calls the function-count guard

Fix before keeping:

- `story-generator/src/app/proving-grounds/proving-grounds.css`
  - Spark made it one minified line.
  - It removed or risked removing hover/focus/spinner affordances.
  - Do not merge that patch as-is.
- `story-generator/angular.json`
  - It may be appropriate to raise the `anyComponentStyle` warning threshold slightly if readable Proving Grounds CSS is intentionally above 10 kB.
  - Prefer an explicit budget decision over a minified source file.

Do not include in #87 by default:

- `tests/grok-smoke.test.ts`
- `package.json` `test:grok-smoke` script
- `STORY_QUALITY_EVALS_PLAN.md`
- `SPARK_TRIAL_TASKS.md`

## Known PR Body Corrections Needed

PR #87 body currently has stale claims:

- It says `jq` is missing locally, but `jq-1.8.1` is installed.
- It says audio PRs still need final mining/closure, but that work is done.
- It says the Proving Grounds CSS is within budget after cleanup; only say this after the accepted CSS fix is committed.

## Validation Already Observed

Recent local checks observed before this turnover:

- `scripts/recovery/check-vercel-function-count.sh` reported `12/12`.
- `npm run test:grok-smoke` skipped safely without env vars.
- `npm test` passed.
- `scripts/recovery/preflight.sh --quick --skip-status` passed.
- `cd story-generator && npx -p node@20 -c "node -v && npm run build"` passed with only stale `baseline-browser-mapping` warning after Spark's minified CSS, but the CSS needs rewrite/review before trust.

## Next Steps

1. Add a finish-and-merge scope-freeze note to `PR70_RECOVERY_CHANGELOG.md`.
2. Review and keep the Vercel function-count guard if checks pass.
3. Rewrite or revert the Proving Grounds CSS patch; if rewritten readable CSS is still slightly above the old warning threshold, make a clear `angular.json` budget decision.
4. Defer Grok smoke and Story Quality Evals from #87.
5. Correct PR #87 body.
6. Run full validation.
7. Commit focused polish.
8. Push, verify Vercel preview, mark #87 ready, merge, and verify production.

## Stop Conditions

Stop before merge if:

- CSS cannot be made readable without reintroducing the budget warning and the user wants zero warning.
- Vercel preview cannot be authenticated/smoked.
- GitHub reports merge conflicts or failing required checks.
- Any step requires restoring active audio runtime or DigitalOcean deployment.
