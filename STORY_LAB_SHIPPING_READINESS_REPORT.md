# Story Lab Shipping Readiness Report

Created: 2026-05-28 02:43 EDT

## Status

Status: shipping readiness achieved for the current Vercel Story Lab scope.

Tier 1 MVP is already proven by `STORY_LAB_MVP_READINESS_REPORT.md`: production Vercel can open Story Lab, generate a Grok-backed chapter from the browser UI, and continue the saga from the browser UI.

Tier 2 shipping hardening merged through PR #94:

- PR: `https://github.com/Phazzie/FairytaleswithSpice/pull/94`
- Merge commit: `a71aef4dec43c8720096b4db5b21dc051a6a3c06`
- Main Recovery CI: passed for `a71aef4`.
- Main Dependabot Updates workflow: passed for `a71aef4`.
- Vercel production deployment: successful for `a71aef4`.
- Production live browser smoke: passed against `https://fairytaleswith-spice.vercel.app`.

Follow-up dev/test dependency cleanup merged through PR #95:

- PR: `https://github.com/Phazzie/FairytaleswithSpice/pull/95`
- Merge commit: `d1b7458b71d232b5e38e94755776c69c7c165381`
- Main Recovery CI: passed for `d1b7458`.
- Vercel production deployment: successful for `d1b7458`.
- Production live browser smoke: passed against `https://fairytaleswith-spice.vercel.app`.
- Full Story Generator audit risk dropped from seven findings to four dev/test-toolchain findings.

Dependabot PR #88 is closed as superseded by PR #94. Follow-up Dependabot PR #95 is merged. There are no open PRs at the time of this report update.

## What Is Safe To Promise

- The deployment target is Vercel.
- Story Lab is the public user surface for the recovered app.
- The MVP path has production browser evidence with real Grok-backed generation and continuation.
- The local browser smoke is repeatable through `npm run smoke:story-lab-ui`.
- Debug/recovery UI is hidden from normal users by default and remains reachable with `?debug=1`.
- Runtime dependency audit is clean after this branch's dependency update:
  - root `npm audit --omit=dev --json`: zero vulnerabilities,
  - `story-generator` `npm audit --omit=dev --json`: zero vulnerabilities,
  - `story-generator` `npm audit --omit=dev --omit=optional --json`: zero vulnerabilities.

## What Is Not Safe To Promise Yet

- Do not promise durable long-term story memory. Current Story Lab continuity/state is client-carried and heuristic.
- Do not promise audio. Audio remains deferred and inactive for this recovery.
- Do not promise DigitalOcean deployment. Docker/DigitalOcean files are historical unless deliberately revived later.
- Do not promise a totally clean full dev audit. Full `story-generator npm audit --json` still reports four dev/test-toolchain findings under Karma/socket tooling:
  - `engine.io` via `ws`,
  - `socket.io-adapter` via `ws`,
  - `socket.io-parser`,
  - `ws`.
- Do not promise that all legacy Sonar issues are fixed. Main currently reports many historical smells/hotspots; this branch targets the new high-signal blockers and records the rest.

## Dependency And Security Triage

PR #88 was inspected as the only open PR:

- PR: `https://github.com/Phazzie/FairytaleswithSpice/pull/88`
- Title: `chore(deps): bump the npm_and_yarn group across 2 directories with 22 updates`
- Files: `package.json`, `package-lock.json`, `story-generator/package.json`, `story-generator/package-lock.json`
- Disposition: superseded by PR #94 and closed.

Why not merge #88 directly:

- It updates the same package files but to older patch versions than this branch.
- This branch updates root axios to `^1.16.1` and Story Generator axios to `^1.16.1`.
- This branch updates Angular runtime packages to `20.3.22` and Angular CLI/build/SSR packages to `20.3.26`.
- This branch also moves Angular build/type tooling out of production dependencies and into devDependencies.

PR #95 appeared after PR #94 and was merged directly:

- PR: `https://github.com/Phazzie/FairytaleswithSpice/pull/95`
- Title: `chore(deps): bump the npm_and_yarn group across 1 directory with 2 updates`
- Files: `story-generator/package-lock.json`
- Disposition: merged.
- Effect: updated transitive dev/test packages `picomatch` `2.3.1 -> 2.3.2` and `qs` `6.13.0 -> 6.15.2`, reducing full Story Generator audit findings from seven to four.

Runtime dependency result:

```bash
npm audit --omit=dev --json
cd story-generator && npm audit --omit=dev --json
cd story-generator && npm audit --omit=dev --omit=optional --json
```

All three commands reported zero vulnerabilities during branch triage.

Remaining full-audit result:

```bash
cd story-generator && npm audit --json
```

After PR #95, this still reported four findings, all in dev/test tooling reachable through Karma/socket packages. These should be treated as follow-up test-infrastructure risk, not production runtime risk.

## Sonar Triage

Main SonarCloud was queried during this branch and reported 120 open issues on `main`, including 8 critical code smells, 10 vulnerabilities, and 3 bugs.

PR #94 directly fixed the two top source issues returned by the query:

- `scripts/recovery/story-lab-browser-smoke.mjs`: refactored the static smoke server so missing-file fallback is a flat async file-selection path instead of nested callbacks.
- `api/_lib/story-lab/storyLabEngine.ts`: refactored speaker-tag stripping so it no longer mutates a `for` loop counter.

Residual Sonar work is not zero. Known remaining categories include:

- Proving Grounds accessibility markup findings.
- Older root test assertion/code-smell findings.
- Historical hotspot findings in Docker/DigitalOcean-era files.
- Regex/security-hotspot review items in older tests/services.

Shipping interpretation: the obvious new blockers were removed and PR #94's Sonar quality gate passed. The project still needs a later Sonar cleanup pass if the desired standard is a fully clean main branch rather than an understood and triaged one.

## Production Environment And Config

Required production variable:

- `XAI_API_KEY`: required for real Grok-backed Story Lab generation and continuation.

Important optional/config-dependent variables:

- `FRONTEND_URL` or equivalent allowed-origin configuration if CORS is tightened later.
- `STORY_LAB_FORCE_MOCK`: should not be enabled for production demos unless deliberately showing mock mode.

Vercel config:

- `vercel.json` uses `npm run install:all` for install.
- `vercel.json` uses `npm run build` for build.
- Output directory is `story-generator/dist/story-generator/browser`.
- API functions are TypeScript files under `api/**/*.ts`, with shared helpers expected under `api/_lib/*`.
- `scripts/recovery/check-vercel-function-count.sh` keeps deployable API function count intentional.

Runtime/build note:

- Angular build verification in this checkout should use Node 20. Local Node v23.8.0 has previously produced unreliable Angular build failures.

## Browser Smoke Cadence

Keep the smoke as an explicit release check for now:

```bash
npm run smoke:story-lab-ui
```

This builds the deployable Angular browser output and drives the Story Lab UI with mocked API responses.

For production/live verification, run intentionally:

```bash
STORY_LAB_SMOKE_URL=https://fairytaleswith-spice.vercel.app STORY_LAB_SMOKE_LIVE=1 npm run smoke:story-lab-ui
```

Do not put live mode into default CI because it consumes provider quota and depends on production credentials/network behavior.

## Deferred Work

- Durable story persistence and AI-grade continuity extraction.
- OpenAI provider migration or provider abstraction.
- Audio generation/runtime.
- Full Proving Grounds accessibility cleanup.
- Full Sonar hotspot cleanup, especially historical Docker/DigitalOcean artifacts.
- Dev/test audit cleanup for Karma/socket tooling.
- CI decision on whether local mocked browser smoke should become a required pull-request job.

## Hostile Self-Review

What a senior dev who hates this would object to:

- The dependency update is still large because Angular patch updates move a lot of lockfile entries.
- The full `story-generator npm audit` is not clean even after PR #95; calling the whole repo "secure" would be overstated.
- Sonar is triaged, not fully burned down.
- The repo still tracks some root `node_modules` files from old history. This branch intentionally does not commit generated `node_modules` churn, but that means a local checkout can need `npm install` before `npm ls` reflects the new root axios range.

What was fixed now instead of documented:

- Runtime dependency audit findings for root and Story Generator production dependencies.
- Transitive dev/test `picomatch` and `qs` findings through PR #95.
- The top Sonar nested-callback issue in the browser smoke harness.
- The top Sonar loop-counter mutation issue in Story Lab continuation cleanup.

What remains acceptable only because it is explicitly documented:

- Dev/test audit findings in Karma/socket tooling.
- Historical Sonar issues not touched by this focused branch.
- Heuristic, transient continuity state.

## Validation

Local validation passed on 2026-05-28:

- [x] `git diff --check`
- [x] `node --check scripts/recovery/story-lab-browser-smoke.mjs`
- [x] `npm audit --omit=dev --json`
- [x] `cd story-generator && npm audit --omit=dev --json`
- [x] `cd story-generator && npm audit --omit=dev --omit=optional --json`
- [x] `scripts/recovery/preflight.sh --quick --skip-status`
- [x] `npm run test:story-lab-real-engine`
- [x] `npm run test:all`
- [x] `npm run smoke:story-lab-ui`
- [x] `npm run build:verify`
- [x] PR #94 checks on GitHub
- [x] Main Recovery CI after merge
- [x] Main Dependabot Updates workflow after merge
- [x] Vercel production deployment after merge
- [x] Production live browser smoke after merge
- [x] PR #95 checks on GitHub
- [x] Main Recovery CI after PR #95
- [x] Vercel production deployment after PR #95
- [x] Production live browser smoke after PR #95

Validation notes:

- `npm run smoke:story-lab-ui` built with Node `v20.20.2`; Angular build completed in 345.796 seconds and the mocked browser smoke passed.
- The build still prints the known `baseline-browser-mapping` stale-data warning.
- `npm run test:all` still prints expected mock-mode warnings about missing `XAI_API_KEY` and mock word-count variance, but the suite exits passing.
- A temporary root `npm install` confirmed local root `axios@1.16.1` and `follow-redirects@1.16.0`; generated `node_modules` changes were restored before commit.
- PR #94 initially exposed a CI-only install-order issue: `npm ci` mutates historical tracked root `node_modules` files before preflight. `scripts/recovery/preflight.sh` now excludes `node_modules` from its whitespace diff check so generated dependency files do not block source validation.
- PR #94 review also tightened the smoke server: SPA fallback is now limited to extensionless routes so missing `.js`, `.css`, or image assets return `404` instead of receiving HTML.
- Post-merge production live smoke command passed:
  `STORY_LAB_SMOKE_URL=https://fairytaleswith-spice.vercel.app STORY_LAB_SMOKE_LIVE=1 npm run smoke:story-lab-ui`
- PR #95 reduced full Story Generator audit findings from seven to four. The remaining findings are `engine.io`, `socket.io-adapter`, `socket.io-parser`, and `ws` in dev/test tooling.
- Post-PR #95 production live smoke command passed:
  `STORY_LAB_SMOKE_URL=https://fairytaleswith-spice.vercel.app STORY_LAB_SMOKE_LIVE=1 npm run smoke:story-lab-ui`
