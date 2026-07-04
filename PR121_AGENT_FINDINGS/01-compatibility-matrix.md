# PR121 Angular 22 Compatibility Matrix

Task: Produce a compatibility check for Angular 22 migration in the `story-generator` app (PR #121) and flag environment/package traps without modifying package files.

## Source snapshot

- Repo/workspace: `/tmp/fairytales-pr121-investigation`
- Branch: `recovery/pr121-angular-investigation` tracking `origin/main`
- PR: #121 (open)
  Title: `Bump the npm_and_yarn group across 1 directory with 5 updates`
  File scope: `story-generator/package.json`, `story-generator/package-lock.json`

## Angular 22 migration matrix

| Component | Current repo value | PR121 target / observed in lock diff | Compatibility status |
|---|---|---|---|
| Node runtime (project engines) | `story-generator/package.json` `engines.node >=20.0.0` | Not updated by PR; Angular 22 package metadata expects `^22.22.3 || ^24.15.0 || >=26.0.0` for `@angular/core`, `@angular/build`, `@angular/compiler-cli`, `@angular/cli`, `@angular/ssr` | **Blocker**: Node 20 does not satisfy Angular 22 package constraints |
| Node runtime (CI / containers) | `.github/workflows/recovery-ci.yml` -> `node-version: '20'`; `Dockerfile` and `Dockerfile.production` -> `FROM node:20-alpine`; preflight scripts run Node 20 | No change in PR #121 | **High risk**: environment baseline conflicts with Angular 22 package engines |
| TypeScript | `typescript: ~5.9.2` (lock resolved `5.9.3`) | Angular 22 metadata (e.g., `@angular/build@22`, `@angular/compiler-cli@22`) requires `typescript >=6.0 <6.1` | **Blocker**: TS must be raised to 6.x for package constraints |
| `@angular/common` | `^20.3.22` | `^22.0.2` | Version family moved to 22.x |
| `@angular/compiler` | `^20.3.22` | `^22.0.2` | Version family moved to 22.x |
| `@angular/core` | `^20.3.22` | `^22.0.2` | Version family moved to 22.x |
| `@angular/forms` | `^20.3.22` | `^22.0.2` | Version family moved to 22.x |
| `@angular/platform-browser` | `^20.3.22` | `^22.0.2` | Version family moved to 22.x |
| `@angular/platform-server` | `^20.3.22` | `^22.0.2` | Version family moved to 22.x |
| `@angular/router` | `^20.3.22` | `^22.0.2` | Version family moved to 22.x |
| `@angular/ssr` | `^20.3.26` | `^22.0.3` | Version family moved to 22.x |
| `@angular/build` | `^20.3.26` | `^22.0.3` | Version family moved to 22.x |
| `@angular/compiler-cli` | `^20.3.22` | `^22.0.2` | Version family moved to 22.x |
| `@angular/cli` | `^20.3.26` | **unchanged at `^20.3.26`** | **Alignment mismatch**: CLI is outside 22.x family while core/build moved to 22.x |
| SSR config surface | `angular.json` build options include `"server": "src/main.server.ts"` and `ssr.entry: "src/server.ts"` | same | Structural SSR config is present both before/after PR |
| Test builder | `@angular/build:karma` in `angular.json` | not changed by PR | No known incompatibility from PR diff |
| Vite | indirect in lock: `node_modules/vite 7.3.2` | indirect in PR lock diff: `node_modules/vite 7.3.5` | Transitive Vite bump is present but not directly declared |
| Zone | `zone.js: ~0.15.0` (lock resolved `0.15.1`) | unchanged in package declarations | Aligns with Angular 22 peer range (`~0.15.0 || ~0.16.0` in Angular 22 core metadata) |
| RxJS | `rxjs: ~7.8.0` (lock resolved `7.8.2`) | unchanged in package declarations | Aligns with Angular 22 core peer requirement (`^6.5.3 || ^7.4.0`) |

## Metadata checks pulled from npm

- `@angular/core@22.0.5` metadata: engines `^22.22.3 || ^24.15.0 || >=26.0.0`; peer `rxjs ^6.5.3 || ^7.4.0`, `zone.js ~0.15.0 || ~0.16.0`
- `@angular/build@22.0.3` metadata: engines `^22.22.3 || ^24.15.0 || >=26.0.0`; peer `typescript >=6.0 <6.1`, `@angular/ssr ^22.0.3` and Angular 22 package peers
- `@angular/compiler-cli@22.0.2` metadata: engines `^22.22.3 || ^24.15.0 || >=26.0.0`; peer `typescript >=6.0 <6.1`, `@angular/compiler 22.0.2`
- `@angular/cli@20.3.26` metadata: engines `^20.19.0 || ^22.12.0 || >=24.0.0`
- `@angular/cli@22.0.5` metadata: engines `^22.22.3 || ^24.15.0 || >=26.0.0` (reference point for full 22.x alignment)
- `@angular/ssr@22.0.3` peer: core/common/router/platform-server `^22.0.0`
- `zone.js` and `rxjs` metadata queries returned no explicit `engines`/`peerDependencies` fields in direct `npm view` output for the queried versions

## Blocking findings

1. **Node engine mismatch (blocker):** PR updates major Angular runtime packages to 22.0.x while repo CI/Docker/preflight remains Node 20.x. Angular 22 metadata and npm peer/engines require Node 22+ minimum.
2. **TypeScript mismatch (blocker):** TS is pinned to `~5.9.2` but Angular 22 compiler/build require TypeScript `>=6.0 <6.1`.
3. **Angular package alignment drift (medium):** `@angular/cli` is not updated to 22.x while other Angular packages are, increasing risk of cross-package peer/CLI mismatch.

## Recommendation

- Treat PR #121 as a partial dependency floor only; migration cannot be made green as-is.
- Next step should be a follow-up PR that:
  1. Bumps environment baseline to Node 22.22+ (or adjusts CI/Docker to match supported Angular 22 engines),
  2. Updates `typescript` to `6.x`,
  3. Aligns `@angular/cli` to Angular 22.x,
  4. Re-runs lockfile refresh from a clean, consistent baseline.
