# PR #121 Security and Runtime Scan

## Status
- Scope: investigation only (read-only on codebase and PR artifacts).
- PR: `#121` (`Bump the npm_and_yarn group across 1 directory with 5 updates`) is currently **OPEN**.
- Files diffed/considered: `story-generator/package.json`, `story-generator/package-lock.json`, Angular SSR/runtime app files, Vercel/recovery build scripts.

## Commands run
- `gh pr view 121 --json ...` and `gh pr diff 121 --patch`
- `gh api repos/Phazzie/FairytaleswithSpice/pulls/121/files`
- `git diff origin/main...origin/dependabot/... -- story-generator/package.json`
- `git diff origin/main...origin/dependabot/... -- story-generator/package-lock.json`
- `git show origin/dependabot/...:story-generator/package.json`
- `git show origin/dependabot/...:story-generator/package-lock.json`
- `npm view @angular/build@22.0.3 ...`
- `npm view @angular/cli@20.3.26 peerDependencies`
- `rg/sed` scans across `story-generator/src`, `api`, `.github/workflows`, `scripts/recovery`, `story-generator/angular.json`

## Verified dependency/security signal

- **Dependency set changed (direct):**
  - `@angular/common` `20.3.22 -> 22.0.2`
  - `@angular/compiler` `20.3.22 -> 22.0.2`
  - `@angular/core` `20.3.22 -> 22.0.2`
  - `@angular/forms` `20.3.22 -> 22.0.2`
  - `@angular/platform-browser` `20.3.22 -> 22.0.2`
  - `@angular/platform-server` `20.3.22 -> 22.0.2`
  - `@angular/router` `20.3.22 -> 22.0.2`
  - `@angular/ssr` `20.3.26 -> 22.0.3`
  - `@angular/build` `20.3.26 -> 22.0.3`
  - `@angular/compiler-cli` `20.3.22 -> 22.0.2`
  - `@angular/cli` stays `20.3.26`

- **Lockfile signal:**
  - `package-lock.json` changed by **+3536 / -3396** lines.
  - `@angular/build@22.0.3` pulls Angular build-chain updates (`@angular-devkit/* 0.2200.3`, newer `vite`, `rollup`, `sass`, `magic-string`, etc.).
  - Vite entry is pinned to `7.3.5` in the PR branch.

- **Known security-typed changes in PR body metadata (Angular 22.0.2/22.0.3 notes):**
  - transfer-cache hardening around HTTP credentialing and cache keys
  - sanitizer hardening (`escape overlapping comment delimiters`, MathML link sanitize, two-way properties)
  - DOM/security behavior changes around credentialless iframe handling
  - SSR-related hardening (suspicious/protocol-relative URL blocks; SSRF-oriented SSR fixes)
  - JSONP deprecation notes in core/common/changelog snippets

## Runtime behavior implications

- **High-confidence toolchain break risk:** Angular 22 packages in lockfile declare `engines.node ^22.22.3 || ^24.15.0 || >=26.0.0` (for `@angular/common`, `@angular/core`, `@angular/compiler`, etc.), while project/build scripts currently run **Node 20** in CI and recovery preflight (`scripts/recovery/preflight.sh` and `.github/workflows/recovery-ci.yml`).
  - This is a direct runtime/build compatibility mismatch and likely blocks normal local/CI execution unless Node toolchain is raised.

- **Potential dependency graph split-brain:**
  - `@angular/build@22.0.3` peer-dep requires `typescript >=6.0 <6.1`; repo still uses `typescript ~5.9.2`.
  - `@angular/cli` remains `20.3.26` (Angular dev tooling major lag), while most Angular runtime packages moved to `22.x`.
  - This looks like a partial framework migration with likely subtle compile/tooling breakage even before runtime semantics are exercised.

- **Security behavior may become stricter in Angular runtime templating/sanitization paths:**
  - This app already renders AI/HTML content via `getSafeHtml(...)`, `sanitize(SecurityContext.HTML, ...)` and `[innerHTML]`.
  - PR body indicates security fixes in Angular sanitizer and SSR; therefore output escaping behavior can change (XSS impact is directionally improved, but rendering output may differ or reject previously tolerated strings).

- **Streaming/SSR boundary sensitivity:**
  - `story-generator/src/server.ts` and `angular.json` run SSR (`@angular/ssr`, `outputMode: server`).
  - `api/story-lab/stream/genesis.ts` and `story-generator/src/app/streaming-story` pass HTML fragments (`partialHtml`/`chapter.htmlContent`) into client rendering flow.
  - Any sanitizer/transfer-cache shifts in Angular 22 can surface as differences in streamed rendering, cache behavior, or blocked payload shapes.

- **Vite builder behavior changes are indirect but real risk:**
  - `@angular/build` in PR now uses Vite `7.3.5`.
  - Build pipeline uses Angular builder (`@angular/build:application`, `@angular/build:dev-server`), so dev-server/prod-build toolchain behavior is likely to shift even if app-level source code is unchanged.

## Unverified / inference-only items
- Whether the security hardening claims in PR body are fully realized in this exact app without running tests is **unverified** from repo-local data; current conclusion is based on release-note claims and package metadata.
- Whether smaller patch-line changes in Angular 20.x could deliver all listed fixes is unverified from PR data alone (requires Angular release-range investigation).
- Exact runtime impact on business-logic outputs (including whether any user-visible content rendering differs) is unverified without executing Angular build/e2e/runtime tests.

## Safer sequencing / smaller patch options
- Current PR is a large jump (mostly major runtime + build-tooling move). A lower-risk security-first sequence would be:
  1. Verify Angular 20.x patch/minor path for specific security fixes listed (if available) and land separately; or
  2. Align Angular tooling as a full stack (`@angular/build`, `@angular/cli`, `@angular/compiler-cli`, and `typescript`) and Node baseline in one step before enabling app runtime rollout.
- This sequencing reduces the chance of “build compiles with mixed majors” failure and isolates security verification from lockfile churn.

## Top risks (ranked)
1. **Build/toolchain incompatibility (highest):** Node 20 vs Angular 22 package engine requirements.
2. **Angular major skew (high):** `@angular/build` + runtime packages at 22.x while `@angular/cli` remains 20.x and `typescript ~5.9.2`.
3. **Behavioral shift risk in HTML rendering/security boundaries (medium):** stricter sanitize/SSR behavior may change rendered output and stream formatting.
4. **Lockfile supply-chain churn (medium):** large transitive update means larger blast radius for regressions.

## Recommendation
- Treat PR #121 as **risk-priority** for dependency consistency before merge.
- Require a two-stage validation if security work is intended: (a) toolchain alignment and full build/test on compliant Node, (b) targeted runtime regression tests for HTML-rendering and SSR stream endpoints.
