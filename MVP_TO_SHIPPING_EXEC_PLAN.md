# MVP to Shipping ExecPlan

Created: 2026-05-28 05:05 UTC

## Purpose / Big Picture

Take Fairytales with Spice from the current PR #90/#91 Story Lab baseline to a real MVP, then to shipping readiness.

MVP means the public Vercel app is usable by a normal person without agent help. A user can open the app, create a Story Lab story from the UI, continue it once, understand errors if generation fails, and avoid exposed internal/debug affordances. The app already has deployed API evidence for real Grok-backed genesis and continuation; the missing evidence is a repeatable browser-level UI path and the fixes that path exposes.

Shipping means the MVP is hardened enough for broader release. Main branch CI, Vercel deployment, Sonar/security signals, dependency risk, production configuration, and deferred-scope promises are all either green or honestly documented with a concrete follow-up. Shipping does not mean audio, DigitalOcean, OpenAI migration, durable long-term storage, or full AI continuity extraction.

## Progress

- [x] Confirm current branch and repo state: branch `mvp/story-lab-public-readiness`; unrelated untracked files remain outside this plan.
- [x] Read `AGENTS.md`, `.agent/PLANS.md`, recovery changelog, ledger, and lessons before editing.
- [x] Draft this self-contained MVP-to-shipping plan.
- [x] Run hostile review pass on the plan before implementation.
- [x] Link this plan from `AGENTS.md`.
- [x] Add repeatable browser smoke coverage for Story Lab genesis and continuation.
- [x] Hide or gate public debug/developer UI.
- [x] Run browser smoke against local built UI in mocked mode: `STORY_LAB_SMOKE_SKIP_BUILD=1 npm run smoke:story-lab-ui` passed after a build-backed smoke iteration exposed and fixed harness issues.
- [x] Fix any UI blockers found by browser smoke. Debug panel is gated behind `?debug=1`; smoke selector false-positive was fixed.
- [x] Run local validation. `git diff --check`, `npm run test:story-lab-real-engine`, `scripts/recovery/preflight.sh --quick --skip-status`, `npm run test:all`, and mocked browser smoke passed.
- [x] Address PR #92 automated review comments. Debug-panel visibility is now derived from Angular query params, the smoke script uses stable test IDs, browser cleanup preserves launch errors, the Node 20 build invocation no longer depends on `npx -c`, and the Sonar-flagged route regex was removed.
- [x] Re-run review-fix validation. `git diff --check`, `node --check scripts/recovery/story-lab-browser-smoke.mjs`, Angular app/spec typechecks, `npm run test:story-lab-real-engine`, `scripts/recovery/preflight.sh --quick --skip-status`, `npm run smoke:story-lab-ui`, and `npm run test:all` passed.
- [x] Try deployed preview live smoke. PR #92 preview returned HTTP `401`, so use production after merge for unauthenticated real-provider browser evidence.
- [x] Open and merge a focused MVP PR. PR #92 merged to `main` as `fb3549fa5b088475a67534ef94e0d3dfe93ee78c`.
- [x] Verify production after merge and write `STORY_LAB_MVP_READINESS_REPORT.md`. Main Recovery CI passed, Vercel production deployed, production root returned HTTP `200`, and production live browser smoke passed.
- [x] Start shipping-hardening branch after MVP is proven: `shipping/story-lab-hardening`.
- [x] Triage main Sonar/security/dependency signals and document or fix blockers in progress. Runtime audits are clean after dependency updates; full Story Generator audit still has dev/test-toolchain findings.
- [x] Create draft shipping-readiness report: `STORY_LAB_SHIPPING_READINESS_REPORT.md`.
- [x] Run final local branch validation after dependency/Sonar fixes. `git diff --check`, `node --check`, runtime audits, quick preflight, story-lab real-engine tests, root test suite, browser smoke, and build verification passed.
- [x] Open shipping-hardening PR and verify GitHub checks. PR #94 passed Recovery CI, Vercel, SonarCloud, and automated review gates.
- [x] Merge shipping-hardening PR, supersede PR #88, and verify production status. PR #94 merged as `a71aef4dec43c8720096b4db5b21dc051a6a3c06`; PR #88 was closed as superseded; main Recovery CI, main Dependabot Updates, Vercel production, and production live browser smoke passed.
- [x] Merge follow-up Dependabot PR #95. Lockfile-only `picomatch`/`qs` update reduced full Story Generator audit findings from seven to four; main Recovery CI, Vercel production, and production live browser smoke passed after merge.

## Surprises & Discoveries

- Current `main` after PR #91 has only one open PR: Dependabot PR #88. Treat it as shipping-hardening input, not an MVP blocker unless it patches an actively exploitable runtime dependency.
- Production API smoke already proved `telemetry.engine: "grok"` for genesis and continuation, but that is not the same as a browser click-through.
- The public Angular app always renders `<app-debug-panel>`. That is useful for recovery, but hostile review says it is not normal-user MVP behavior.
- First local browser-smoke attempt timed out because `ng serve` started under local Node v23.8.0. The smoke script now starts Angular through `npx -p node@20`, matching the known-good build path.
- Second local browser-smoke attempt showed the startup timeout also covered Node 20 bootstrap time, and killing `npx` did not stop nested Angular processes. The script now allows 180 seconds and terminates the spawned process group.
- `ng serve` is too slow and hard to bound for this autonomous smoke gate. The smoke script now builds the app under Node 20 and serves the built browser output through a tiny local static server, so the browser test exercises the deployable artifact.
- First static-browser smoke reached generated UI but failed on a broad heading selector that matched the app title, story title, and chapter title. The selector now targets the story title as a level-2 heading.
- PR #92 review found the next brittleness layer: a one-time debug query read, label/text-based smoke selectors, an unguarded browser cleanup path, an `npx -c` portability risk, and a Sonar regex hotspot in the mocked continuation route.
- PR #88 is the only remaining open PR, but its dependency versions are already behind the fresher updates on `shipping/story-lab-hardening`; the safer disposition is to supersede it after the replacement PR lands.
- Runtime dependency audit can be clean while full dev audit is still red. In this branch, `story-generator npm audit --json` still reports Karma/socket dev-toolchain findings even though `--omit=dev` reports zero vulnerabilities.
- The repo still tracks some root `node_modules` files from old history. This branch should not commit generated `node_modules` churn; use package manifests and lockfiles as the source of truth.
- Main Sonar's top returned source findings were in the browser smoke harness and Story Lab engine. Both were small enough to fix inside the shipping branch instead of leaving as report-only triage.
- PR #94 passed its checks and merged cleanly. PR #88 was closed as superseded after the fresher dependency update landed, leaving no open PRs at the time of the final shipping evidence update.
- A follow-up Dependabot PR #95 appeared immediately after #94/#96. It was worth merging because it was lockfile-only, checks were green, and it cut the remaining dev/test audit findings from seven to four.

## Decision Log

- Decision: Split the work into a first MVP PR and later shipping-hardening PRs.
  Rationale: The app has enough runtime proof to focus the first branch on public usability and repeatable browser evidence. Folding Sonar, dependencies, and security hardening into the same PR would recreate an oversized mixed branch.

- Decision: Treat browser click-through as the primary missing MVP evidence.
  Rationale: API curl smoke proved backend reality. MVP asks whether a person can use the app.

- Decision: Gate developer/debug UI before calling MVP ready.
  Rationale: A public debug console confuses normal users and exposes internal testing controls. It can remain available through an explicit debug mode, but it should not appear by default.

- Decision: Keep continuity extraction heuristic for MVP, but label it.
  Rationale: Current Story Lab continuation works. AI-grade continuity extraction is valuable but belongs after MVP proof.

- Decision: Do not move provider work to OpenAI during MVP.
  Rationale: The current production provider is Grok via `XAI_API_KEY`. A provider abstraction belongs after UI/browser proof, not before it.

- Decision: Supersede PR #88 instead of merging it directly.
  Rationale: PR #88 is dependency-only but now updates to older patch levels than this branch. Recreating the dependency intent on top of current `main` avoids stale branch behavior and keeps the security update current.

- Decision: Treat `npm audit --omit=dev` as the production runtime gate and full `npm audit` as a dev/test-tooling risk report.
  Rationale: Story Generator's remaining full-audit findings are under Karma/socket tooling, not production Story Lab runtime packages.

## Outcomes & Retrospective

Fill this in as work proceeds:

- What became MVP-ready:
- Public UI default no longer shows the developer debug panel; local built-artifact browser smoke proves genesis and continuation mechanics with mocked responses; production live browser smoke proves the deployed Story Lab can generate and continue through the UI.
- What became shipping-hardened locally and on main:
- Runtime dependency audits are clean; stale PR #88 was superseded and closed; top Sonar findings from the current main query were fixed; PR #94 passed GitHub checks and merged; PR #95 reduced dev/test audit findings; main Recovery CI, Vercel production deployment, and production live browser smoke passed.
- What remained below shipping quality:
- Current Story Lab MVP/shipping scope is complete. Runtime audits are clean, while full dev audit and historical Sonar cleanup remain documented risks.
- What hostile review found:
- Browser evidence had to be built-artifact evidence, not an unreliable `ng serve` check. Debug UI needed gating rather than deletion.
- What was fixed immediately:
- Debug panel gating, browser smoke process model, exact story-title assertion.
- PR #92 review fixes: route-derived debug-panel state, stable `data-testid` smoke selectors, guarded Playwright cleanup, portable Node 20 build command, and regex-free mocked continuation route.
- What was documented instead:
- Live provider smoke stays explicit rather than default CI; branch-preview smoke can be blocked by Vercel auth, so post-merge production checks are the reliable unauthenticated path.
- What surprised us:
- A stale Dependabot PR was still mergeable but no longer the best dependency answer because fresher patch releases existed by the time shipping hardening started.
- Story Generator's production audit could be clean while full audit remained red because Karma's dev/test dependency chain still pulls vulnerable socket/glob packages.
- What should have been anticipated:
- Dependency work should distinguish runtime dependency risk from dev/test tooling risk before deciding whether a red audit blocks shipping.
- Main Sonar issue lists should be queried early enough to catch small fix-now issues before they become review-cycle noise.

## Context and Orientation

Repository root: `/Users/hbpheonix/fairytaleswithspice`.

Current deployment target: Vercel. Do not reintroduce DigitalOcean.

Current active user experience:

- Angular frontend: `story-generator/`
- Public Story Lab component: `story-generator/src/app/app.ts`, `story-generator/src/app/app.html`, `story-generator/src/app/app.css`
- Public Story Lab service: `story-generator/src/app/story.service.ts`
- Frontend contracts: `story-generator/src/app/contracts.ts`
- Vercel Story Lab API routes:
  - `api/story-lab/stories.ts`
  - `api/story-lab/stories/[storyId]/continue.ts`
  - `api/story-lab/stream/genesis.ts`
  - `api/story-lab/health.ts`
- Story Lab real-engine orchestrator: `api/_lib/story-lab/storyLabEngine.ts`
- Canonical story engine: `api/_lib/services/storyService.ts`

Known current evidence:

- PR #90 merged the Story Lab real-engine wiring.
- PR #91 merged `STORY_LAB_DEMO_READINESS_REPORT.md`.
- Production `https://fairytaleswith-spice.vercel.app` returned real Grok telemetry for API genesis and continuation.
- `scripts/recovery/preflight.sh --quick --skip-status`, `npm run test:all`, and a Node 20 Angular build passed during demo-readiness work.

Known caveats:

- Browser UI click-through has not yet been proven repeatably.
- Continuity state is heuristic and transient.
- Main-branch Sonar was previously red after PR #90 on broad recovery-era criteria, though PR #91 itself passed Sonar.
- Branch preview deployments can be protected by Vercel authentication, so production may be the only unauthenticated deployed smoke target.
- Unrelated local files may be present: `SPARK_TRIAL_TASKS.md`, `STORY_QUALITY_EVALS_PLAN.md`, `pocketfm-contest-forge/`, and `tests/grok-smoke.test.ts`. Do not include them unless the user explicitly asks.

## Hostile Review and Revisions

### Initial Plan

Add a browser smoke test, hide the debug panel, validate, merge, then handle shipping hardening.

### Hostile Senior Review Pass 1

This is still too vague. "Browser smoke" can become a screenshot that proves nothing. The plan must say exactly what the browser does, what selectors or visible text prove success, and how to avoid burning provider tokens in every CI run. It also needs to explain whether the smoke should run against local mock mode, production Grok, or both.

Revision:

- Add two smoke modes:
  - local/dev smoke that can run in mock mode and proves UI mechanics without provider cost;
  - deployed smoke that is manual/explicit and proves real Grok only when intentionally run.
- The MVP branch must at least add the local repeatable browser smoke. A production browser run is required before marking the MVP report complete.

### Hostile Senior Review Pass 2

Hiding the debug panel can accidentally remove a useful recovery tool. Do not delete it unless there is a clear replacement. Also, any new browser tool must not make the repo slower or brittle by default.

Revision:

- Gate the debug panel behind an explicit `?debug=1` query parameter or equivalent local-only condition.
- Do not make browser smoke part of every default recovery preflight until it has proven stable.
- Add a dedicated script first, then decide later whether to wire it into CI.

### Hostile Senior Review Pass 3

The plan still risks calling MVP ready based on local mock UI smoke. A local mock click-through proves mechanics, not the public MVP. MVP requires production or preview evidence with the real provider.

Revision:

- MVP readiness report must include both:
  - repeatable local browser smoke evidence; and
  - deployed browser or deployed API-plus-human-click evidence against real Grok.
- If authenticated preview access blocks automation, record that and use production for the real-provider check.

## Plan of Work

### Phase 1 - MVP Browser Evidence

Add a browser smoke script that can:

1. Start or use an existing app URL.
2. Open the Story Lab page.
3. Fill a short public-demo blueprint:
   - creature: siren,
   - tone: dark romance,
   - spicy level: 1,
   - word budget: 600,
   - batch size: 1,
   - logline: a short reef-court forbidden-love hook,
   - protagonist: Mira,
   - antagonist: Lord Brine,
   - one thematic seed.
4. Click "Generate Chapters".
5. Wait for visible chapter output.
6. Click "Continue Saga".
7. Wait for a second chapter or visible appended chapter evidence.
8. Fail with screenshots and console logs if any step fails.

Use Playwright for the browser driver. If Playwright is not installed, add it as a root dev dependency with an explicit script. Keep it separate from the default `npm run test:all` until stable.

### Phase 2 - Public UI Cleanup

Hide developer-only UI from normal users:

- Gate `<app-debug-panel>` behind an explicit debug signal.
- Preserve the debug panel for recovery when the URL contains `?debug=1`.
- Add or update Angular component tests for the debug gate.

Also inspect the first viewport and generation controls for obvious blockers:

- validation messages must be visible;
- disabled generate button must explain itself through validation summary;
- generation and continuation errors must be user-readable;
- generated chapter content must not be hidden behind the fixed debug panel.

### Phase 3 - MVP Validation and Report

Run:

```bash
git diff --check
npm run test:story-lab-real-engine
npm run test:all
scripts/recovery/preflight.sh --quick --skip-status
cd story-generator && npx -p node@20 -c "node -v && npm run build"
```

Run browser smoke:

```bash
npm run smoke:story-lab-ui
```

By default this command builds the Angular app, serves `story-generator/dist/story-generator/browser`, and mocks Story Lab API responses in the browser. To reuse an existing build, set `STORY_LAB_SMOKE_SKIP_BUILD=1`.

If the smoke supports deployed mode, run it explicitly with the production URL after merge:

```bash
STORY_LAB_SMOKE_URL=https://fairytaleswith-spice.vercel.app STORY_LAB_SMOKE_LIVE=1 npm run smoke:story-lab-ui
```

Write `STORY_LAB_MVP_READINESS_REPORT.md` with:

- production URL tested,
- local browser smoke result,
- deployed real-provider evidence,
- caveats,
- what is safe to show a normal user,
- what must not be promised yet.

### Phase 4 - Shipping Hardening

After MVP is merged and production-verified:

1. Re-check main Recovery CI, Vercel, SonarCloud, and GitHub dependency/security signals.
2. Inspect open PR #88 and decide whether to merge, recreate, or defer the dependency bump.
3. Audit `vercel.json`, `.github/workflows/recovery-ci.yml`, and `scripts/recovery/*` for stable shipping gates.
4. Decide whether browser smoke belongs in CI or remains an explicit release check.
5. Document production environment variables and setup:
   - `XAI_API_KEY`,
   - `FRONTEND_URL` or allowed origin behavior,
   - any Vercel deployment protection caveats.
6. Write `STORY_LAB_SHIPPING_READINESS_REPORT.md`.

## Concrete Steps

1. Commit this plan and the `AGENTS.md` pointer.
2. Add the browser smoke script and npm script.
3. Gate the debug panel.
4. Run Angular specs or targeted component tests for the debug gate.
5. Run local browser smoke.
6. Fix any blockers found.
7. Run validation.
8. Open an MVP PR.
9. Address automated review comments.
10. Merge MVP PR when checks are green.
11. Verify production browser/API behavior.
12. Write MVP report.
13. Begin shipping hardening in a separate branch.

## Validation and Acceptance

Tier 1 MVP is accepted only when:

- public UI no longer shows developer debug controls by default;
- debug controls are still reachable with `?debug=1`;
- local browser smoke completes genesis and continuation;
- deployed real-provider evidence still shows `telemetry.engine: "grok"`;
- Story Lab errors are visible to the user;
- `STORY_LAB_MVP_READINESS_REPORT.md` exists;
- local validation commands pass or exact failures are documented with scope and next step.

Tier 2 shipping is accepted only when:

- main branch CI and Vercel are green after MVP merge;
- Sonar/security/dependency signals are either green or triaged with explicit severity and owner;
- production env/config is documented;
- browser smoke is repeatable and its intended cadence is documented;
- deferred work is explicit;
- `STORY_LAB_SHIPPING_READINESS_REPORT.md` exists.

## Idempotence and Recovery

- If branch `mvp/story-lab-public-readiness` already exists, inspect it before reusing it.
- If Playwright browsers are missing, install them only for the active environment and document the command.
- If Vercel preview is protected, do not mark the deployed browser smoke failed solely because of `401`; use production or record the blocker.
- If provider generation is slow or costly, use one 600-word chapter and one continuation only.
- If browser smoke finds a real Story Lab bug, fix that bug before expanding shipping hardening.
- If local hooks run unrelated `pocketfm-contest-forge` tests and fail, rerun the relevant test in isolation and document any `--no-verify` use.

## Artifacts and Notes

Planned artifacts:

- `MVP_TO_SHIPPING_EXEC_PLAN.md`
- `STORY_LAB_MVP_READINESS_REPORT.md`
- `STORY_LAB_SHIPPING_READINESS_REPORT.md`
- browser smoke script under `scripts/recovery/`
- screenshots/traces under an ignored temporary output directory if smoke fails

## Interfaces and Dependencies

- Browser smoke depends on Playwright or an equivalent installed browser driver.
- Story Lab UI depends on `StoryService.beginStory()` and `StoryService.continueStory()`.
- Story Lab real provider depends on server-side `XAI_API_KEY`.
- Production deployment depends on Vercel config in `vercel.json`.
- Angular builds must use Node 20 for reliable verification in this checkout.
