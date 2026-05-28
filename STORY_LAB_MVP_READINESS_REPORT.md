# Story Lab MVP Readiness Report

Created: 2026-05-28 05:40 UTC

## Status

Story Lab MVP is verified on production Vercel for the core user path: open the public app, generate a Grok-backed chapter from the UI, and continue the saga from the UI.

Merged PR:

```text
PR #92 - Add Story Lab MVP browser smoke
merge commit fb3549fa5b088475a67534ef94e0d3dfe93ee78c
```

Production URL: `https://fairytaleswith-spice.vercel.app`

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
- The production browser smoke completes the same Story Lab path against the deployed app with live Story Lab APIs enabled.

## Evidence

Passed:

```bash
git diff --check
node --check scripts/recovery/story-lab-browser-smoke.mjs
cd story-generator && ../node_modules/.bin/tsc -p tsconfig.app.json --noEmit
cd story-generator && ../node_modules/.bin/tsc -p tsconfig.spec.json --noEmit
npm run test:story-lab-real-engine
scripts/recovery/preflight.sh --quick --skip-status
npm run test:all
npm run smoke:story-lab-ui
STORY_LAB_SMOKE_URL=https://fairytaleswith-spice.vercel.app STORY_LAB_SMOKE_LIVE=1 npm run smoke:story-lab-ui
```

Build evidence:

- `npm run smoke:story-lab-ui` built the Angular app through Node `v20.20.2`, served the deployable browser output, and passed the mocked Story Lab browser flow.
- The smoke now uses stable `data-testid` selectors for the main controls and waits for selected chapter views rather than hard-coded generated story copy.

Production evidence:

- PR #92 merged to `main` as `fb3549fa5b088475a67534ef94e0d3dfe93ee78c`.
- Main Recovery CI passed for that merge commit.
- Vercel production deployment completed for that merge commit.
- Production root returned HTTP `200`.
- Production live browser smoke passed on 2026-05-28:
  - `STORY_LAB_SMOKE_URL=https://fairytaleswith-spice.vercel.app STORY_LAB_SMOKE_LIVE=1 npm run smoke:story-lab-ui`

Review-fix evidence:

- PR #92 review comments about debug-query reactivity, brittle smoke selectors, browser cleanup masking launch failures, `npx -c` portability, and the Sonar route regex hotspot were addressed in the branch.
- Follow-up review fixes hardened the local static server path handling, removed public error copy that referenced the hidden debug panel, and corrected the deployed-smoke command to require live mode.
- Local validation passed after those fixes.

## Caveats

- PR #92 branch preview returned HTTP `401` on 2026-05-28, so unauthenticated live browser smoke cannot prove the preview.
- The local browser smoke uses mocked API responses by default to avoid provider cost and keep UI mechanics deterministic.
- Continuity state remains heuristic and transient; this is acceptable for MVP continuation but not a durable-memory claim.
- Main-branch SonarCloud remains red on broader recovery-era criteria after the merge. That is a shipping-readiness blocker, not an MVP browser-flow blocker.

## Required Before Calling Shipping Complete

- Triage or fix main SonarCloud quality gate failure.
- Triage GitHub dependency/security alerts.
- Decide whether browser smoke should remain an explicit release check or become part of CI.
- Write `STORY_LAB_SHIPPING_READINESS_REPORT.md`.
