# PR #121 CI and Vercel Forensics

Date: 2026-07-03
Investigated repo: `/tmp/fairytales-pr121-investigation`
PR target: `dependabot/npm_and_yarn/story-generator/npm_and_yarn-43b9e74fae` against `main`

## Commands run
- `cd /tmp/fairytales-pr121-investigation && gh pr view 121 --repo Phazzie/FairytaleswithSpice --json ...`
- `cd /tmp/fairytales-pr121-investigation && gh pr checks 121 --repo Phazzie/FairytaleswithSpice --watch=false`
- `cd /tmp/fairytales-pr121-investigation && gh run view 27851333522 --repo Phazzie/FairytaleswithSpice --json ...`
- `cd /tmp/fairytales-pr121-investigation && gh run view 27851333522 --repo Phazzie/FairytaleswithSpice --log --job 82430818835`
- `cd /tmp/fairytales-pr121-investigation && gh api repos/Phazzie/FairytaleswithSpice/commits/face1051b4b452abf311537ae567200e27835f42/check-runs --paginate ...`
- `cd /tmp/fairytales-pr121-investigation && gh api repos/Phazzie/FairytaleswithSpice/commits/face1051b4b452abf311537ae567200e27835f42/statuses --paginate ...`
- `cd /tmp/fairytales-pr121-investigation && gh api repos/Phazzie/FairytaleswithSpice/pulls/121/files --paginate ...`
- `cd /tmp/fairytales-pr121-investigation && sed -n` on `.github/workflows/recovery-ci.yml` and `scripts/recovery/preflight.sh`.
- `cd /tmp/fairytales-pr121-investigation && git show origin/dependabot/npm_and_yarn/story-generator/npm_and_yarn-43b9e74fae -- story-generator/package*.json`

## Status snapshot
`gh pr view 121`:
- state: `OPEN`
- merge state: `UNSTABLE`
- mergeable: `MERGEABLE`
- changed files: `2`

`gh pr checks 121 --watch=false`:
- `Validate Vercel recovery build` — `fail`
- `SonarCloud` — `pass`
- `SonarCloud Code Analysis` — `pass`
- `Vercel` — `fail`
- `Vercel Preview Comments` — `pass`

## Failure evidence (dependency/install layer)
Recovery workflow run id: `27851333522` (`workflow: Recovery CI`)
Job id with failure: `82430818835` (`Validate Vercel recovery build`)

From job logs (`--log --job 82430818835`), failure is in:
- step: `Install Angular dependencies`
- command: `npm ci --no-audit --no-fund` (run inside `story-generator`)
- npm error: `ERESOLVE could not resolve`
- exact conflict:
  - `@angular/build@22.0.3` expects `peer typescript@">=6.0 <6.1"`
  - current lock/package resolves `typescript@5.9.3`
- exit code: `Process completed with exit code 1`

The step is earlier in the run than recovery preflight/build steps; in the same run:
- `Install root dependencies` succeeded
- `Install Angular dependencies` failed
- `Run recovery preflight` was skipped
- `Check Vercel configuration` was skipped

## Evidence of code changes driving the failure
PR file set:
- `story-generator/package.json` (modified)
- `story-generator/package-lock.json` (modified, large lockfile change)

Dependency deltas in `package.json`:
- `@angular/common` `^20.3.22` -> `^22.0.2`
- `@angular/core` `^20.3.22` -> `^22.0.2`
- `@angular/platform-server` `^20.3.22` -> `^22.0.2`
- `@angular/build` `^20.3.26` -> `^22.0.3`
- `@angular/compiler-cli` `^20.3.22` -> `^22.0.2`
- `@types/node` unchanged (`^20.19.41`)
- `typescript` in this PR remained `~5.9.2` (lockfile has `5.9.3`)

## Vercel check specifics
`gh api .../commits/face1051.../statuses` shows:
- `context: Vercel`
- `description: Deployment has failed — run this Vercel CLI command: npx vercel inspect dpl_3CZVRozSRPj2QUzJM8aiS2U4MLqR --logs`
- `state: failure`

This is consistent with the same broken dependency install on PR head and does not add a separate root-cause signal beyond failing deployment due bad dependency graph.

## Duplicate/stale check analysis
- `gh run list --workflow "Recovery CI" --branch dependabot/... --all --limit 20` returned only:
  - run `27851333522` (current head `face1051...`, status `completed`, conclusion `failure`)
- No duplicate Recovery CI jobs found for this PR branch in the listed history.
- Commit status history for Vercel showed pending then failure only; no older failing context for different checks was present in this evidence slice.

## CI environment / Node version
- Workflow uses `actions/setup-node` with `node-version: '20'`.
- Workflow log includes deprecation warning:
  - “Node 20 is being deprecated... running with Node 24 by default...”
This warning is present but not the failure mechanism. The hard failure is npm peer dependency resolution (`ERESOLVE`).

## Assessment
Primary failure type:
1. **Angular 22 dependency constraints mismatch** (peer dependency conflict) in `story-generator`.
2. Vercel check failure is a **downstream failure** triggered by the same unresolved dependency graph (deployment cannot proceed after code install/build issues).

No direct build/test/runtime output error was reached because install failed before build/test stages.

## Recommendation
Do not rebasing-only. Root fix needs dependency realignment in this PR:
- bump Angular toolchain peer set together (`@angular/cli`, `@angular/build`, `@angular/compiler`, compiler-cli, SSR/types packages as needed),
- and align TypeScript to the Angular 22 peer range (`>=6.0 <6.1`) or downgrade Angular bump to a compatible toolchain.
- Then re-run recovery install/build sequence to verify no new environment/runtime regressions.
