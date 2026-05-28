# Story Lab MVP Readiness Report

Created: 2026-05-28 05:40 UTC

## Status

MVP candidate branch is locally validated, but final MVP readiness is not complete until the same browser path is verified against a deployed Vercel URL after this branch is available in preview or merged to production.

Branch:

```text
mvp/story-lab-public-readiness
```

## What This Branch Proves

- The public Story Lab UI no longer shows the developer debug console by default.
- The debug console remains available with `?debug=1`.
- A repeatable browser smoke script exists:
  - local built-app mode with mocked Story Lab API responses,
  - explicit live URL mode for deployed real-provider checks.
- The local browser smoke completes a normal user flow:
  - open Story Lab,
  - fill a siren/dark-romance blueprint,
  - select a theme,
  - generate chapter 1,
  - continue the saga,
  - verify chapter 2 appears.

## Evidence

Passed:

```bash
git diff --check
npm run test:story-lab-real-engine
scripts/recovery/preflight.sh --quick --skip-status
npm run test:all
STORY_LAB_SMOKE_SKIP_BUILD=1 npm run smoke:story-lab-ui
```

Build evidence:

- `npm run smoke:story-lab-ui` built the Angular app through Node `v20.20.2` and served the deployable browser output.
- That first full smoke attempt reached generated UI, then failed on an over-broad smoke assertion.
- The assertion was fixed, and the smoke passed against the same built app with `STORY_LAB_SMOKE_SKIP_BUILD=1`.

## Caveats

- Live deployed browser smoke has not run for this branch yet.
- The local browser smoke uses mocked API responses by default to avoid provider cost and keep UI mechanics deterministic.
- Real Grok provider evidence still comes from the earlier production API smoke recorded in `STORY_LAB_DEMO_READINESS_REPORT.md` until this branch is deployed.
- Continuity state remains heuristic and transient; this is acceptable for MVP continuation but not a durable-memory claim.

## Required Before Calling MVP Complete

Run one deployed browser smoke after a Vercel preview is available or after merge:

```bash
STORY_LAB_SMOKE_URL=https://fairytaleswith-spice.vercel.app STORY_LAB_SMOKE_LIVE=1 npm run smoke:story-lab-ui
```

If branch preview is protected, use production after merge and record that limitation.
