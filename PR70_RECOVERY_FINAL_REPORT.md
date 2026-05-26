# PR #70 Recovery Final Report

Created: 2026-05-26 15:32 EDT

## Outcome

The recovery branch is `recovery-pr70-story-lab-vercel`.

Draft recovery PR: https://github.com/Phazzie/FairytaleswithSpice/pull/87

The branch starts from PR #70's Story Lab direction, ports or recreates the useful post-#70 work, mines and records useful material from stale branches, defers audio runtime, and makes Vercel the active deployment target.

All previously open source PRs inspected during this recovery have been merged, ported, mined and closed, or closed as superseded. The only open PR left from the checked inventory is #87.

## Deployment Result

Vercel project: `fairytaleswith-spice`

Ready deployment:

- Deployment ID: `dpl_CopbfUAYcFL8BhwSJ82BumMGLeo5`
- Commit: `528233f`
- Preview URL: `https://fairytaleswith-spice-dapa55dm3-phazzies-projects.vercel.app`
- Branch alias: `https://fairytaleswith-spice-git-recovery-pr70-e629d8-phazzies-projects.vercel.app`
- State: `READY`
- Vercel function count: 12 Node functions

Smoke checks:

- Root URL returned `200 OK` through the Vercel connector and served the Angular shell.
- `/api/health` returned `200 OK` through a temporary protected-preview access flow.
- `/api/health` reported production environment and `grok: configured`.
- Normal unauthenticated curl hits Vercel Authentication because preview deployment protection is enabled.
- `scripts/recovery/preflight.sh --skip-status` passed after this report and the final doc updates.

Remaining deployment warnings:

- Angular reports a stale `baseline-browser-mapping` warning.
- `src/app/proving-grounds/proving-grounds.css` exceeds the component CSS budget by about 1.15 kB.
- Local Karma/ChromeHeadless still does not capture reliably in this environment.

## What Was Merged Or Ported

Accepted into the recovery branch:

- PR #70: Story Lab baseline and workbench direction.
- PR #50: progress and hydration safety.
- PR #64: unbiased Fisher-Yates randomization and related checks.
- PR #65: model consistency, token budgeting, prompt quality parameters, and verification tests.
- PR #67: author-style config extraction and duplicate service diagnosis.
- PR #24: trope subversion rebuilt into the current story service.
- PR #31: cliffhanger/story arc logic without exposing fake durable persistence.
- PR #72: multi-chapter contracts and generation behavior.
- PR #75: chapter batching UI and continuity controls.
- PR #73: transient Story Lab state snapshots without DigitalOcean persistence.
- PR #74: Proving Grounds prompt/evaluation route using server-side Grok access.
- PR #26: validation notification concept rebuilt around the current Story Lab seam.
- PR #39/#41: lean recovery CI based on `scripts/recovery/preflight.sh`.
- PR #85/#86: low-risk security/design-system material where compatible.

Recreated or deferred instead of merged:

- PR #84: dependency update should be recreated from the recovery branch. The old branch mixed stale code, audio test requirements, and incoherent Angular 20/21 package state.
- PR #71: superseded by later Story Lab direction; useful only as comparison material.
- PR #76: no-file/WIP design direction; mined only.
- PR #77, #63, #56, #54, #53, #40: mined for docs, storage, deployment, and UI ideas; not merged because branch contents carried stale paths, DigitalOcean assumptions, audio scope, or unrelated churn.
- PR #55, #47, #45, #44, #43, #42, #30, #29, #28, #22: audio branches mined for story-generation ideas and closed; active audio runtime is deferred.

## Material Not Taken Now

The not-taken material is preserved in `NOT_TAKEN_FEATURE_LEDGER.md`. The most important future story-generation ideas are:

- speaker and narrator tag formats,
- emotion taxonomy and validation,
- narrator atmosphere tags,
- character voice or personality evolution as story metadata,
- dialogue segmentation and fallback parsing,
- scene/effect intent metadata,
- story QA signals for low emotional variety, too many speakers, or overuse of neutral tags.

The main non-story material not taken:

- active ElevenLabs/audio runtime,
- audio player UI,
- SFX provider work,
- in-memory audio background jobs,
- DigitalOcean storage/deploy paths,
- stale `api/lib` and `story-generator/src/api/lib` service copies,
- broad dependency churn from stale branches,
- heavy CI suites that assumed old backend paths.

## What Surprised Me

PR #70 was not just a UI rewrite. It changed the intended product direction toward a Story Lab/workbench, so treating it as the baseline made later PRs read differently.

Several documentation and research PRs were not clean documentation branches. They also carried stale code, deleted or changed deployment files, restored old path conventions, or reintroduced audio scope.

The audio PRs contained more story-generation value than expected. The runtime work is out of scope, but the prompt metadata, emotion vocabulary, speaker conventions, and QA ideas are worth preserving.

Local validation missed Vercel-specific failures. Vercel caught plain-function TypeScript issues, helper files accidentally counted as functions, and deployment shape problems that local Angular/root tests did not exercise.

Angular's build output needed explicit Vercel fallback handling. The branch emitted `index.csr.html`; Vercel fallback rewrites needed `index.html`.

## What Did Not Surprise Me

Old path drift was widespread. The same concepts appeared under `api/lib`, `api/_lib`, `backend/src`, and `story-generator/src/api/lib`.

DigitalOcean assumptions showed up in old branches. That matched the historical docs and needed active correction for this Vercel-first recovery.

Dependency PR #84 was not safe to merge late in the recovery. Mixed framework versions and lockfile churn are common in stale dependency branches.

The local browser test issue remained environmental. Typecheck and bundle build can pass while Karma never captures ChromeHeadless locally.

## What I Should Have Anticipated Earlier

Vercel should have been deployed before closing the final source PRs. The branch was locally healthy, but deployment readiness is a separate class of evidence.

The preflight script should have included API function compilation from the start. That would have caught Next.js type imports and stale relative imports before the first failed preview.

I should have counted Vercel functions earlier. Helper files under non-underscore `api/story-lab/*` were easy to mistake for harmless modules.

Deferred audio should have been physically removed from the active API tree earlier. Leaving routes/services in place contradicted the recovery scope and made deployment harder.

Protected preview smoke testing should have been planned as a first-class step. Normal `curl` is not enough when Vercel Authentication is enabled.

## Things I Anticipated That Mostly Did Not Happen

PR #70 did not force abandoning the stronger story-generation core. The useful model, prompt, token, continuation, randomization, and trope/cliffhanger work could be ported into the new baseline.

The later Story Lab PRs did not need broad merges. Selective ports were enough and avoided stale deployment/storage choices.

The docs and audio mining did not require keeping old branches open. Once material was recorded in the ledgers, the source PRs could be closed cleanly with #87 as the replacement review target.

The final branch did not need DigitalOcean compatibility work. The Vercel path was simpler once old deployment assumptions were treated as historical.

## Self-Review

What went well:

- The branch now has one visible recovery PR instead of many stale PRs.
- Story-generation material was preserved before stale/audio PRs were closed.
- Vercel is represented in code, docs, validation, and a real ready deployment.
- The preflight script now covers more of the actual deployment risk.

Problems found and fixed:

- API function import drift was fixed.
- Angular fallback output was fixed.
- Active audio endpoints/services were removed from the deployable API tree.
- Story Lab helpers were moved under `api/_lib/story-lab/*`.

Problems still open:

- A fresh dependency-update PR should be created from this branch after review.
- A durable Vercel storage choice is still needed for real persisted Story Lab history.
- Preview deployment protection requires authenticated smoke tooling or a bypass token for unauthenticated automation.
- The CSS budget warning in Proving Grounds should be tightened or explicitly raised.
- Karma/ChromeHeadless needs an environment fix or a different browser-test strategy.

## Questions For The Next Phase

Should PR #87 stay draft until the dependency refresh is recreated, or should dependencies be a separate follow-up?

Should the ready preview be promoted after review, or should the branch merge to `main` and let Git deployment produce the canonical production build?

Should Vercel preview protection stay enabled, and if so, what smoke-test bypass/token process should be used in CI?

Which Vercel-compatible persistence path should own Story Lab state: Postgres, KV/Redis, Blob plus metadata, or another store?

Should story generation get an optional audio-ready mode now, limited to prompt metadata only, or should that wait until audio runtime is explicitly resumed?

Should Proving Grounds become the home for emotion/tag/story-quality analyzers mined from the audio branches?

Should the app keep both production story routes and Story Lab mock/demo routes long term, or should Story Lab eventually call the production generation seam directly?

Should the CSS budget warning be fixed by shrinking the component stylesheet, moving shared styles, or changing the budget?

Should CI run a Vercel build/deploy preview check, or is Vercel Git integration plus local preflight enough for this repo?

Should the older DigitalOcean docs be archived after #87 lands so future agents do not treat them as active instructions?

## Evidence Files

- `PR70_RECOVERY_PLAN.md`
- `PR70_RECOVERY_CHANGELOG.md`
- `PR70_RECOVERY_LEDGER.md`
- `NOT_TAKEN_FEATURE_LEDGER.md`
- `PR_USEFUL_MATERIAL_INVENTORY.md`
- `LESSONS_LEARNED.md`
- `.github/workflows/recovery-ci.yml`
- `scripts/recovery/preflight.sh`
- `scripts/recovery/ensure-vercel-index.sh`
