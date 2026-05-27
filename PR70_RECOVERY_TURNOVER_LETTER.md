# PR #70 Recovery Turnover Letter

Created: 2026-05-27 05:23 EDT

Future agent,

Start here before doing more recovery work on this repo.

## Current State

- Repo: `Phazzie/FairytaleswithSpice`
- Local branch: `recovery-pr70-story-lab-vercel`
- Remote tracking branch: `origin/recovery-pr70-story-lab-vercel`
- Recovery PR: https://github.com/Phazzie/FairytaleswithSpice/pull/87
- Latest pushed commit at turnover: `2498087 docs: add recovery final report`
- Git status at turnover was clean except unrelated untracked `pocketfm-contest-forge/`; do not touch that folder.

PR #87 is the replacement PR for the old open PR stack. All previously open source PRs from the recovery inventory were either ported, mined, closed as superseded, or marked for fresh recreation. Only #87 remained open.

## Direction

The user wants PR #70 treated as the Story Lab baseline and wants the app deployed on Vercel, not DigitalOcean.

Audio runtime is deferred. Do not rebuild ElevenLabs/audio/player/SFX unless the user explicitly reopens that scope. The story-generation ideas from audio PRs were preserved in `NOT_TAKEN_FEATURE_LEDGER.md`.

Canonical backend path is `api/_lib/*`. Do not reintroduce `api/lib/*` or `story-generator/src/api/lib/*` service copies.

## Read First

Read these before editing:

1. `AGENTS.md`
2. `PR70_RECOVERY_PLAN.md`
3. `PR70_RECOVERY_FINAL_REPORT.md`
4. `PR70_RECOVERY_CHANGELOG.md` tail
5. `PR70_RECOVERY_LEDGER.md`
6. `NOT_TAKEN_FEATURE_LEDGER.md`
7. `LESSONS_LEARNED.md`

## What Was Accomplished

- PR #70 was merged as the Story Lab/workbench baseline.
- Story-generation work was selectively ported:
  - model/token/API parameter consistency,
  - unbiased randomization,
  - author-style config extraction,
  - trope subversion,
  - cliffhanger analysis,
  - multi-chapter generation and continuation,
  - Story Lab transient state and batch UI ideas,
  - validation notifications,
  - Proving Grounds.
- Duplicate story-service paths were removed; `api/_lib/services/storyService.ts` is canonical.
- Active audio routes/services were removed from the deployable API tree.
- Vercel deployment was fixed and verified.
- All old open PRs from the checked inventory were closed or superseded with ledger notes.

## Vercel Evidence

Latest branch-tip deployment:

- Deployment ID: `dpl_7ZU2AiaDpq4AbQRkEdS3QvwLQWkf`
- URL: `https://fairytaleswith-spice-krr00ndjp-phazzies-projects.vercel.app`
- Branch alias: `https://fairytaleswith-spice-git-recovery-pr70-e629d8-phazzies-projects.vercel.app`
- Status at turnover: `READY`
- Vercel reported `lambdaRuntimeStats: {"nodejs":12}`
- Root URL returned `200 OK` through Vercel connector.
- `/api/health` returned `200 OK` through a protected-preview share/access flow and reported `grok: configured`.

Normal unauthenticated curl can return Vercel Authentication because preview protection is enabled. Use Vercel access/share tooling or a bypass token for protected-preview smoke checks.

## Validation Evidence

`scripts/recovery/preflight.sh --skip-status` passed after the final report/docs update.

That covered:

- required tool check with `jq-1.8.1`,
- whitespace/conflict-marker check,
- Angular app typecheck,
- Angular spec typecheck,
- Vercel API function TypeScript compilation,
- root story/trope/cliffhanger/story-lab-state tests,
- Node 20 Angular production build,
- Vercel fallback `index.html` verification.

Known warnings:

- stale `baseline-browser-mapping`,
- `src/app/proving-grounds/proving-grounds.css` exceeds the component CSS budget by about 1.15 kB,
- local Karma/ChromeHeadless still does not capture reliably in this environment.

## Highest-Value Next Work

Recommended next path:

1. Review PR #87 in GitHub as the single recovery PR.
2. Fix Proving Grounds CSS budget warning or deliberately raise the budget.
3. Add a real Grok smoke test for `/api/story/generate` and continuation.
4. Build the Story Lab adapter from current mock/demo routes into the canonical story service.
5. Choose and implement minimal Vercel-compatible persistence for Story Lab sessions.
6. Recreate dependency PR #84 from this branch; do not merge old #84.
7. Add reliable browser/e2e verification.
8. Merge #87 after review and verify production deployment.

After the branch is stable, consider extracting a generation kernel so Story Lab, Proving Grounds, production routes, and future audio metadata all call the same story-generation brain.

## Watch Outs

- Do not mistake Story Lab mock/demo behavior for production generation.
- Do not add another active story service.
- Do not accept stale DigitalOcean docs as current instructions.
- Do not restore active audio runtime just because audio PRs had useful story-generation ideas.
- Do not treat local mock-mode tests as proof of real Grok behavior.
- Be suspicious of any change under `api/` that creates new deployable `.ts` files outside `_lib`; Vercel may count them as functions.

## Product Questions Still Open

- Should PR #87 merge before durable Story Lab persistence, or should persistence land first?
- Should Story Lab eventually replace the simple generator, or should both remain?
- Should audio-ready story metadata become an optional generation mode before audio runtime returns?
- Which Vercel storage product should own Story Lab state?
- Should Proving Grounds become an internal story-quality lab with AI evals?
- Should named author-style prompting be replaced with archetypal style profiles?

## Best Mental Model

This recovery succeeded because it picked one future and preserved the useful ideas from the futures it did not take.

Do not try to keep every old branch alive. Keep the ideas, keep the evidence, and make the active architecture boring enough to deploy.
