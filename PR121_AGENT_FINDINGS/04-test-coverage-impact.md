# PR #121 Test and Coverage Impact Map

## Status
- Scope: map validation required for an Angular 20 -> Angular 22 (Angular CLI/schema/runtime) upgrade in `story-generator`.
- Status: `investigation-complete`
- Estimated readiness: **61%**

## Commands and baseline evidence captured
- Workspace inspected: `/tmp/fairytales-pr121-investigation`.
- Commands executed were read-only or read+write only for this artifact creation.
- Read artifacts:
  - `story-generator/package.json`
  - `story-generator/karma.conf.js`
  - `story-generator/angular.json`
  - `story-generator/tsconfig.spec.json`
  - `package.json`
  - `scripts/recovery/preflight.sh`
  - `scripts/recovery/slice-preflight.sh`
  - `scripts/recovery/ensure-vercel-index.sh`
  - `scripts/recovery/check-vercel-function-count.sh`
  - `story-generator/src/**/*.spec.ts`
  - `tests/*story*.*` and root runtime-related test files

## Current Angular build/test/typecheck surface (explicit)
- Angular app scripts (`story-generator/package.json`)
  - `ng build`
  - `ng build --configuration production`
  - `ng test`
- Angular config (`angular.json`)
  - Build: `@angular/build:application`, `outputMode: "server"`, SSR routes from `app.routes.server.ts`
  - Test: `@angular/build:karma`
- Root scripts
  - `npm run build` → `cd story-generator && npm run build && npm run build:vercel-index`
  - `npm run build:verify` → `npm run build:vercel-index && test -f story-generator/dist/story-generator/browser/index.html`
  - `npm run build:full` → `npm run build && npm run build:verify`
  - `npm run test` → `npm run test:all` (large root TS suite only; includes many API/contract tests and route tests)
- Recovery checks
  - `scripts/recovery/preflight.sh`
    - app tsc `-p tsconfig.app.json --noEmit`
    - spec tsc `-p tsconfig.spec.json --noEmit`
    - `npm test` (root suite)
    - `npm run build` (Node 20 enforced in-script)
    - `npm run build:verify`
  - `scripts/recovery/slice-preflight.sh`
    - slice-specific command assembly; only includes Angular type checks + `npm run build` for some slices
    - includes `scripts/recovery/check-vercel-function-count.sh`

## Coverage thresholds currently in place
- Angular unit coverage is enforced through Karma config:
  - `story-generator/karma.conf.js` sets `coverageReporter.check.global` to:
    - statements: **85**
    - branches: **85**
    - functions: **85**
    - lines: **85**
- No explicit coverage threshold is defined for root API/contract tests.
- `npm run test` / `npm run test:all` do not explicitly configure or gate coverage output.

## Required validation for a credible Angular 22 upgrade
### Must-have (build/test/typecheck)
- `npm run preflight` equivalent checks (or full `npm run recovery:preflight`)
  - Angular app + spec typecheck should pass.
  - `npm run test` should pass, because it is the repo’s canonical full root regression surface.
  - `npm run build` and `npm run build:verify` should pass (index fallback + browser artifact presence).
- Standalone Angular checks
  - `cd story-generator && npm run test`
  - `cd story-generator && npm run build --configuration production` (or production-acceptance equivalent)
- Contract/interface checks
  - `npm run test:story-generator-route-splitting`
  - `npm run test:story-lab-route-status`
  - `npm run test:story-lab-storage-port`
  - `npm run test:story-lab-account-routes`
  - `npm run test:story-lab-profile-contracts`
  - `npm run test:story-generator-component-style-budget`
- Runtime/runtime smoke checks (existing script)
  - `npm run smoke:story-lab-ui` (Playwright smoke for built app flow)

## Current gap map (what could still pass while breaking Angular 22)

### 1) SSR/hydration and runtime rendering
- What exists:
  - `outputMode: "server"` and `serverRoutes: RenderMode.Server`
  - `preflight.sh` and normal smoke do not execute SSR rendering/transfer-state assertions.
- Gap:
  - No test currently validates SSR output rendering, hydration, or route-mode behavior under SSR.
- Risk:
  - Angular 22 renderer/runtime/API changes could break hydration or server rendering while still passing unit + build + root tests.
- Missing (recommended):
  - SSR smoke on `/` and `/proving-grounds` asserting:
    - HTML shell contains expected markers in server-rendered response.
    - client boot/hydration occurs without runtime script errors.
    - route-level render-mode behavior remains valid.

### 2) Vercel fallback index behavior
- What exists:
  - `ensure-vercel-index.sh` creates/falls back index if needed.
  - `preflight` checks build output contains index.
- Gap:
  - No automated test asserts Vercel rewrites (`"source": "/((?!api).*)"` → `"/index.html"`) against deployed routing + unknown paths.
  - No test for `index.csr.html` fallback path in runtime.
- Risk:
  - Deep links can still resolve to build artifacts in CI but 404/SPA break in production.
- Missing (recommended):
  - Runtime check against `/api/...` rewrite and non-api route fallback.
  - Route request against unknown path verifies index fallback response and JS boot.

### 3) Lazy Proving Grounds chunk behavior
- What exists:
  - `tests/story-generator-route-splitting.test.ts` statically asserts `loadComponent()` for `/proving-grounds`.
- Gap:
  - No runtime verification that the route is not part of the initial bundle or that the split chunk loads only on navigation.
- Risk:
  - Upgrade could alter bundling/chunking and still pass static AST assertions.
- Missing (recommended):
  - Build-output + runtime assertions that `/proving-grounds` is isolated into a separate JS chunk and loaded only on route visit.

### 4) Cloud/account UI contract continuity
- What exists:
  - Rich frontend unit tests in `app.spec.ts` around local cloud-state messaging.
  - Root tests for backend account routes and storage contracts.
- Gap:
  - No end-to-end contract drift test that executes browser UI + API together after route upgrade.
  - Existing API contract checks import frontend types but do not validate browser UI rendering flow under real SSR/builded artifact.
- Risk:
  - A seam change in frontend contract typing could pass unit tests but break actual cross-tier serialization/UI state transitions.
- Missing (recommended):
  - Browser-based API contract flow test:
    - `/api/story-lab/account/profile` + `/projects` + save/load/delete round-trip in real app shell.

### 5) Browser-only API assumptions (EventSource/localStorage/document/navigator)
- What exists:
  - `story.service.ts` uses `EventSource`, `document`, `navigator`, `localStorage`, `sessionStorage`.
  - `story-workspace-storage.service.ts`/`proving-grounds.ts` guard storage access via `typeof localStorage !== 'undefined'`.
  - Some tests mock these APIs.
- Gap:
  - No explicit server/SSR guard test for browser-only API access during bootstrap/route transitions.
  - Existing tests are mostly unit-mocked and do not validate server rendering or real browser runtime failure modes.
- Risk:
  - Angular 22 SSR changes can make previously safe browser API touchpoints fail during server render or hydration.
- Missing (recommended):
  - SSR-safe render test that exercises app bootstrap under server and browser contexts.
  - Browser test specifically asserting graceful handling for denied/unsupported clipboard, storage errors, and EventSource failure.

## Optional validation (high-value but not mandatory for minimum credible upgrade)
- Add `npm script`/CI step for Angular coverage export + report artifact retention.
- Add deterministic route-load assertions using Playwright for:
  - initial route,
  - `/proving-grounds`,
  - unknown route fallback.
- Add bundle assertions for lazy chunk count/size and initial payload constraints.
- Add regression tests specifically for any route path rewrites used by Vercel functions.

## Top risks to call out before merge
- Angular SSR runtime behavior is not currently covered by automated tests.
- `npm run test:all` is broad but not Angular-browser-realistic (`playwright`) coverage.
- Vercel rewrites/fallback paths are untested at runtime.
- Browser-only API access is only unit-mocked; hydration/SSR regression risk remains.
