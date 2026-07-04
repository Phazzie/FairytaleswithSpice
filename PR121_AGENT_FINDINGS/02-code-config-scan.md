## PR121 Code and Config Scan

### Scan Status
- **Status**: Complete (read-only inspection only)
- **Percent ready**: 100% for investigation pass
- **Files written**: `PR121_AGENT_FINDINGS/02-code-config-scan.md`

### Commands Run
- `cd /tmp/fairytales-pr121-investigation && rg --files | rg 'story-generator/(angular.json|tsconfig.*json|package.json|src/main.ts|src/main.server.ts|src/app/app.config.ts|src/app/app.config.server.ts|src/app/app.routes.ts|src/app/app.routes.server.ts|src/server.ts|vercel.json|scripts/recovery/ensure-vercel-index.sh|src/app/.*\\.(ts|html|spec\\.ts)$)'`
- `cd /tmp/fairytales-pr121-investigation && rg --files`
- `cd /tmp/fairytales-pr121-investigation && for f in story-generator/angular.json story-generator/tsconfig.json story-generator/tsconfig.app.json story-generator/tsconfig.spec.json story-generator/karma.conf.js story-generator/package.json story-generator/src/main.ts story-generator/src/main.server.ts story-generator/src/app/app.config.ts story-generator/src/app/app.config.server.ts story-generator/src/app/app.routes.ts story-generator/src/app/app.routes.server.ts story-generator/src/server.ts; do echo "$f $( [ -f $f ] && echo OK || echo MISSING)"; done`
- `cd /tmp/fairytales-pr121-investigation && nl -ba story-generator/angular.json | sed -n '1,220p'`
- `cd /tmp/fairytales-pr121-investigation && nl -ba story-generator/tsconfig.json | sed -n '1,240p'`
- `cd /tmp/fairytales-pr121-investigation && nl -ba story-generator/tsconfig.app.json | sed -n '1,260p'`
- `cd /tmp/fairytales-pr121-investigation && nl -ba story-generator/tsconfig.spec.json | sed -n '1,240p'`
- `cd /tmp/fairytales-pr121-investigation && nl -ba story-generator/package.json | sed -n '1,240p'`
- `cd /tmp/fairytales-pr121-investigation && nl -ba story-generator/src/main.ts | sed -n '1,220p'`
- `cd /tmp/fairytales-pr121-investigation && nl -ba story-generator/src/main.server.ts | sed -n '1,220p'`
- `cd /tmp/fairytales-pr121-investigation && nl -ba story-generator/src/app/app.config.ts | sed -n '1,260p'`
- `cd /tmp/fairytales-pr121-investigation && nl -ba story-generator/src/app/app.config.server.ts | sed -n '1,220p'`
- `cd /tmp/fairytales-pr121-investigation && nl -ba story-generator/src/app/app.routes.ts | sed -n '1,260p'`
- `cd /tmp/fairytales-pr121-investigation && nl -ba story-generator/src/app/app.routes.server.ts | sed -n '1,260p'`
- `cd /tmp/fairytales-pr121-investigation && nl -ba story-generator/src/app/story-workspace-storage.service.ts | sed -n '1,240p'`
- `cd /tmp/fairytales-pr121-investigation && nl -ba story-generator/src/app/app.ts | sed -n '900,1080p'`
- `cd /tmp/fairytales-pr121-investigation && nl -ba story-generator/src/app/app.ts | sed -n '1300,1445p'`
- `cd /tmp/fairytales-pr121-investigation && nl -ba story-generator/src/app/app.ts | sed -n '1924,2045p'`
- `cd /tmp/fairytales-pr121-investigation && nl -ba story-generator/src/app/app.ts | sed -n '2343,2438p'`
- `cd /tmp/fairytales-pr121-investigation && nl -ba story-generator/src/app/story.service.ts | sed -n '1,380p'`
- `cd /tmp/fairytales-pr121-investigation && nl -ba story-generator/src/app/proving-grounds/prompt-evaluation.service.ts | sed -n '1,280p'`
- `cd /tmp/fairytales-pr121-investigation && nl -ba story-generator/src/app/proving-grounds/proving-grounds.ts | sed -n '1,500p'`
- `cd /tmp/fairytales-pr121-investigation && nl -ba story-generator/src/server.ts | sed -n '1,320p'`
- `cd /tmp/fairytales-pr121-investigation && nl -ba story-generator/karma.conf.js | sed -n '1,260p'`
- `cd /tmp/fairytales-pr121-investigation && nl -ba vercel.json | sed -n '1,260p'`
- `cd /tmp/fairytales-pr121-investigation && nl -ba scripts/recovery/ensure-vercel-index.sh | sed -n '1,240p'`
- `cd /tmp/fairytales-pr121-investigation && nl -ba story-generator/proxy.conf.json | sed -n '1,220p'`
- `cd /tmp/fairytales-pr121-investigation && rg -n "/api/story/|/api/story-lab/" story-generator/src story-generator`
- `cd /tmp/fairytales-pr121-investigation && rg -n "window\\.|document\\.|localStorage|sessionStorage|EventSource|navigator\\.clipboard|createObjectURL|index\\.csr|outputMode|@angular\\/build:application|server\\.ts|ssr|renderMode" story-generator/src story-generator/angular.json story-generator/tsconfig*.json story-generator/package.json story-generator/karma.conf.js`
- `cd /tmp/fairytales-pr121-investigation && rg -n "story-lab|/api/story" api -g'*.ts'`

### Missing Required Files
- All required scan files were present for this workspace:
  - `story-generator/angular.json`
  - `story-generator/tsconfig.json`
  - `story-generator/tsconfig.app.json`
  - `story-generator/tsconfig.spec.json`
  - `story-generator/karma.conf.js`
  - `story-generator/src/main.ts`
  - `story-generator/src/main.server.ts`
  - `story-generator/src/app/app.config.ts`/`src/app/app.config.server.ts`
  - `story-generator/src/app/app.routes.ts`/`src/app/app.routes.server.ts`
  - `story-generator/src/server.ts`
  - `story-generator/src/**/*.ts` and Angular specs

### Top Risks (High to Low)

1. **API contract mismatch between Story Lab client calls and server entrypoint (`HIGH`)**
   - The Story Lab Angular client targets `/api/story-lab/*` endpoints (`story-generator/src/app/story.service.ts:34`, `202-203`, `276`, and `story-generator/src/app/proving-grounds/prompt-evaluation.service.ts:16`).
   - The local SSR server handler in `story-generator/src/server.ts` only wires `/api/story/*` routes (`67`, `99`, `173`) and does not expose `/api/story-lab` routes.
   - Result: running `story-generator` in standalone SSR mode can produce runtime 404/connection failures for generation/evaluation flows unless API requests are routed externally through separate Vercel/serverless handlers.

2. **Browser-only APIs executed at app init or in client flows with limited SSR guarding (`HIGH`)**
   - `story-generator/src/app/app.ts:926-928` calls restore methods during construction.
   - Restore/storage paths use direct Web storage APIs (`app.ts:970`, `2429`, `2135`), which are wrapped in some guards in deeper methods but still represent SSR-sensitive assumptions.
   - Client actions rely on browser-only APIs (`app.ts:1350-1352`, `1390-1396`) and event streaming in service layer (`story-generator/src/app/story.service.ts:196-203`, `244-277`) that cannot execute in non-browser runtime.
   - `proving-grounds.ts` has direct `document` usage in exports and storage calls (`287`, `402-415`) and `globalThis.alert` (`166`) with only partial browser checks.

3. **Vercel fallback index + route assumptions (`MEDIUM`)**
   - Top-level `vercel.json` rewrites all non-API paths to `/index.html` (`29-31`), which assumes CSR-style SPA fallback.
   - The app/server side is configured for SSR route handling (`story-generator/src/app/app.routes.server.ts:3-7`) and Angular server static serving (`story-generator/src/server.ts:284-290`).
   - `scripts/recovery/ensure-vercel-index.sh` expects `index.csr.html` → `index.html` fallback (`8-17`), reinforcing that deployment path assumptions are separate from Angular SSR route rendering.

4. **Angular 20 runtime/dependency state not yet aligned with PR121 target (`MEDIUM`)**
   - `story-generator/package.json` still references Angular 20-era packages (`@angular/common` `^20.3.22`, `@angular/ssr` `^20.3.26`, etc.) (`30-38`).
   - If this workspace is used as the migration destination for Angular 22, lockstep package + config + API migration is still pending.

5. **Test harness compatibility check (`LOW`)**
   - Test setup appears Angular CLI/Karma compatible (`angular.json:75-83`, `karma.conf.js:1-61`), and service/EventSource tests include browser API mocks (`story-generator/src/app/story.service.spec.ts`).
   - However, the heavy browser/mock reliance in specs means runtime SSR-path tests are not currently covered.

### Recommendation
- Before Angular 22 cutover, prioritize:
  1. Resolve `/api/story-lab` endpoint wiring from `story-generator` SSR runtime or ensure all runtime environments route those calls to the Story Lab API handlers.
  2. Harden browser API usage with explicit SSR guards (`isPlatformBrowser`/`PLATFORM_ID`) around construction-time side effects and storage-dependent methods.
  3. Reconcile Vercel rewrite strategy with SSR route handling and confirm static fallback vs server rendering behavior.
  4. Complete package/version migration in lockstep with these code changes and rerun SSR + build/test validation.
