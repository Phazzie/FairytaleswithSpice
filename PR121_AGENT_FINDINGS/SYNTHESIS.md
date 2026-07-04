# PR #121 Six-Agent Investigation Synthesis

Date: 2026-07-03 21:09 EDT
Parent branch: `recovery/pr121-angular-investigation`
PR investigated: `#121` (`Bump the npm_and_yarn group across 1 directory with 5 updates`)

## Short Answer

PR #121 is not a quick Dependabot cleanup PR. It is a partial Angular 20 to Angular 22 migration for `story-generator`, and it is currently blocked before build or tests because the dependency graph does not install.

Recommended action: close PR #121 as superseded and replace it with a clean Angular 22 migration branch that updates Node, TypeScript, Angular CLI/build/runtime packages, and validation gates together.

## Percentages

| Item | Percent | Meaning |
|---|---:|---|
| Investigation completion | 100% | Six out of six Spark agents returned written findings, and the parent agent read and synthesized them. |
| Confidence that PR #121 should not merge as-is | 95% | Independent reports found the same hard blockers: TypeScript mismatch, Node mismatch, and incomplete Angular toolchain alignment. |
| PR #121 merge readiness as-is | 5% | It changes only dependency files, but `npm ci` fails in CI before build/test runs. |
| Angular 22 migration plan readiness | 85% | We know the main blockers and the required validation shape. The remaining decisions are mostly execution choices. |
| Actual Angular 22 implementation completion | 0% | No migration fixes were made in this worktree; this branch is investigation only. |
| Test/coverage confidence for an Angular 22 upgrade today | 61% | Existing tests are useful, but SSR, hydration, Vercel fallback, browser-only API guards, and real UI/API flow coverage need stronger checks. |

## What The Agents Inspected

| Agent | Inspection Type | Result |
|---|---|---|
| Plato | Compatibility matrix | Found hard blockers: Angular 22 needs newer Node and TypeScript 6, while the repo is still set up around Node 20 and TypeScript 5.9. |
| Zeno | Code/config scan | Found runtime risks around Story Lab API routing, SSR/browser-only APIs, and Vercel fallback behavior. |
| Mendel | CI/Vercel forensics | Proved CI fails during `npm ci` because `@angular/build@22` requires TypeScript `>=6.0 <6.1`, but the PR keeps TypeScript 5.9. |
| Goodall | Test/coverage impact | Mapped the missing validation needed before a real Angular 22 upgrade is credible. |
| Volta | Security/runtime scan | Flagged sanitizer/SSR/rendering behavior changes and large lockfile churn as real migration risk. |
| Descartes | Contrarian strategy | Rated repairing PR #121 in place as weak and closing/replacing it with a clean migration branch as the best path. |

## Hard Blockers

1. Node is too old for Angular 22.
   - Repo CI, Dockerfiles, and recovery scripts are still built around Node 20.
   - Angular 22 package metadata expects Node 22.22.3+, Node 24.15+, or newer.

2. TypeScript is too old for Angular 22.
   - PR #121 keeps TypeScript at `~5.9.2`.
   - Angular 22 build/compiler packages require TypeScript `>=6.0 <6.1`.
   - This is the direct reason CI fails before build or tests run.

3. Angular tooling is not moved as one set.
   - Runtime/build packages move to Angular 22.
   - `@angular/cli` remains Angular 20.
   - That creates a mixed-toolchain migration instead of a clean one.

## Main Runtime Risks After Install Is Fixed

- SSR and hydration are not currently proven strongly enough for an Angular major upgrade.
- Story Lab browser code touches APIs such as storage, document, clipboard, and event streams; Angular SSR changes could expose unsafe assumptions.
- Vercel rewrite behavior is CSR-style, while the Angular app has SSR configuration.
- The app renders generated HTML, so Angular sanitizer/security changes need targeted regression tests.
- Root/API tests are broad, but they do not currently give a real repo-wide coverage number or prove Angular browser runtime behavior.

## Recommended Replacement Plan

1. Close PR #121 as superseded.
2. Open a clean Angular 22 migration branch from current `origin/main`.
3. Decide the Node target first, likely Node 22.22.3+ or Node 24.15+.
4. Add pre-upgrade validation for the risky surfaces while still on Angular 20.
5. Update Angular packages, `@angular/cli`, `@angular/build`, `@angular/compiler-cli`, and TypeScript together.
6. Regenerate only the `story-generator` lockfile from a clean install.
7. Fix compile/runtime issues.
8. Prove the migration with install, typecheck, unit tests, root tests, build, build verification, and targeted SSR/Vercel/browser smoke checks.

## Suggested Next Six-Agent Split

Use Spark workers only after the parent agent pins the exact migration strategy.

| Agent | Scope | Write Permission |
|---|---|---|
| 1 | Node/CI/Docker/preflight baseline update plan | docs or one config patch only |
| 2 | Angular package and lockfile migration trial | `story-generator/package*.json` only |
| 3 | SSR/browser-only API guard audit | report first, code only after parent approval |
| 4 | Vercel fallback/deep-link validation | test/script files only |
| 5 | Angular coverage/test gap patch | focused spec or smoke test only |
| 6 | Contrarian reviewer | read-only review of the proposed migration diff |

Parent agent should still own final package integration, GitHub comments, PR close/reopen actions, and completion claims.
