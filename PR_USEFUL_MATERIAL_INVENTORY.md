# Pull Request Useful Material Inventory

Date: 2026-05-25

This report inventories the PRs inspected during the Fairytales with Spice recovery pass. The working assumption is that anything upgrading current capability is useful. The judgement column separates:

- **Merge candidate**: reasonable to merge, after normal validation.
- **Port/cherry-pick**: useful material exists, but direct merge is risky.
- **Reference/recreate**: concepts or docs are useful, but implementation should be rebuilt cleanly.
- **Defer**: useful, but not part of the current Vercel/story-lab recovery sequence.
- **Already landed**: useful context, but no open PR action is needed.

The preferred deployment target is Vercel. Audio work is inventoried but considered deferred for now.

## Recommended Recovery Frame

Treat PR #70 as a plausible alternate product baseline for the "story lab" direction. Do not blindly merge the whole open queue into current `main`. A cleaner path is:

1. Create a clean branch from current `main`.
2. Bring in PR #70 as the exploratory baseline.
3. Make the branch Vercel-first: docs, `vercel.json`, API path conventions, and tests should all agree.
4. Port useful correctness and quality work: #50, #64, #65.
5. Port useful UX and workflow work: #26, #75, then selected #72/#73/#74 ideas.
6. Recreate larger engines cleanly: #24 trope subversion, #31 story arc/cliffhanger, and audio later.

## Open PR Inventory

| PR | Title / Area | Useful material and features | Key affected files | Judgement |
|---:|---|---|---|---|
| #86 | Design system spec | Adds a machine-readable `design.md` with brand colors, typography, spacing, component guidance, and visual identity. Useful as frontend/design guidance for the story-lab direction. | `design.md` | **Merge candidate**. Low risk, one doc file. |
| #85 | Dependabot path-to-regexp | Security update for `path-to-regexp` 8.3.0 to 8.4.0, addressing advisories in the Angular dependency tree. | `story-generator/package-lock.json` | **Merge candidate** after lockfile sanity check. |
| #84 | Dependabot grouped dependencies | Updates Axios, Angular packages, root TypeScript tooling, and lockfiles. Useful maintenance intent, but the branch is stale against the recovery baseline, reintroduces audio test/script material, and mixes Angular 20/21 package versions. | `package.json`, `package-lock.json`, `story-generator/package.json`, `story-generator/package-lock.json` | **Recreate later** from a clean recovery branch. Do not merge this stale grouped update. |
| #77 | Documentation analysis | Adds `repodocs.md`, `repodocsanalysis.md`, and a summary indexing the large documentation set and SDD lessons. Mined lessons on contracts, mock mode, service-layer preservation, and documentation lifecycle. | `repodocs.md`, `repodocsanalysis.md`, `DOCUMENTATION_ANALYSIS_SUMMARY.md` | **Mined and closed**. Do not merge the large docs or stale branch-base code/path changes. |
| #76 | SDD redesign analysis placeholder | PR body describes a planned `spicyfairytaleremix.md`, but changed files are zero. The body's critique checklist is useful for the final report. | None | **Closed no material**. Use the body as final-report prompt material only. |
| #75 | Chapter batching workflow and continuity panels | Adds batch size controls, batch progress queue, continuity summary panels, long chapter grouping/collapsing, and service/contract support for batched chapters. Ported the queue, suggested prompts, grouped timeline, specs, and Vercel persistence wording into the #70 story lab. | `story-generator/src/app/app.ts`, `app.html`, `app.css`, `contracts.ts`, `story.service.ts`, tests, `README.md` | **Ported selected UI/workflow material**. Direct merge remains stale because it overlaps heavily with #70/#72. |
| #74 | Proving grounds page | Adds a prompt testing lab with templates, generation logic viewer, Grok-based evaluation service, history/comparison, JSON export, and Angular routing. Ported as a lazy Story Lab route using current contracts and server-side evaluation fallback. | `story-generator/src/app/proving-grounds/*`, `api/story-lab/evaluate.ts`, `app.routes.ts`, `app-root.ts`, `main.ts`, `main.server.ts`, `app.config.ts` | **Ported selectively**. Old app shell and browser API-key storage not taken. |
| #73 | Persistent story state tracking | Adds structured story state snapshots, character/plot thread continuity, `StoryStateService`, Postgres schema/client, and in-memory fallback. Ported state deltas, transient persistence receipt, mock state application, and story-lab state tests into the #70 seam. | `api/lib/db/*`, `api/lib/services/storyStateService.ts`, `api/lib/services/storyService.ts`, contracts, tests | **Ported selected state material**. DigitalOcean Postgres, `pg`, and old `api/lib` implementation remain not taken. |
| #72 | Finalize multi-chapter story workflows | More mature backend/frontend multi-chapter implementation than #71. Adds chapter arrays, `requestedChapterCount`, partial failure reporting, streaming updates, tests, and API/service changes. | `api/lib/services/storyService.ts`, `api/story/generate.ts`, `api/story/continue.ts`, `api/story/stream.ts`, Angular contracts/services/tests | **Ported selected backend behavior**. Kept legacy fields additive; old UI/app shell remains not taken. |
| #71 | Batch chapter generation | Early pass at multi-chapter generation across backend and frontend. Adds chapter count normalization, chapter arrays, batch dropdown, partial failure handling, tests/data factory. Ported only response metadata for chapters requested/generated and partial failures. | Same hotspot files as #72: story service, API routes, Angular contracts/app/tests | **Tiny metadata port; otherwise superseded** by #72/#75/#73. |
| #70 | Story lab rewrite | Rebuilds the main app as a story lab/workbench. Adds `api/story-lab/*` mock Vercel endpoints, story-lab contracts, blueprint-like flow, continuity/debug concepts, streaming genesis, and a major Angular UI/service rewrite. | `api/story-lab/*`, `story-generator/src/app/app.*`, `contracts.ts`, `story.service.ts`, debug panel, streaming component/tests | **Baseline candidate**. Consider merging into an exploratory branch and treating it as the new direction. |
| #67 | SOLID/KISS/DRY audit and refactor | Contains a real audit report, deployment readiness checklist, duplicate service diagnosis, removal of stale `story-generator/src/api/*` duplicates, author-style config extraction, and test syntax cleanup. | `COMPREHENSIVE_AUDIT_REPORT.md`, `DEPLOYMENT_READINESS.md`, `api/lib/config/authorStyles.ts`, deleted duplicate service files, `tests/story-service-improved.test.ts` | **Port/cherry-pick selectively**. Audit and config extraction are useful; direct merge conflicts with current Vercel recovery and old paths. |
| #65 | AI story generation quality fixes | Fixes Grok model consistency, adds better token calculation, adds quality parameters, adds verification tests and docs. Some parts are already partly present on current `main`, but repetition/verification gaps remain. | `api/lib/services/storyService.ts`, `story-generator/src/api/lib/services/storyService.ts`, `tests/verify-ai-fixes.test.ts`, AI fix docs | **Port selectively**. High value; adapt to `api/_lib` and #70 baseline. |
| #64 | PR #61 completion: randomization and tests | Adds Fisher-Yates shuffle for remaining biased randomization, updates audit docs, fixes Angular spec timing/API endpoint expectations, adds Playwright E2E scaffold and docs. | `story-generator/src/api/lib/services/storyService.ts`, specs, `playwright.config.ts`, `e2e/*`, docs, package files | **Port selectively**. Fisher-Yates and tests are useful; avoid tracked `node_modules` churn. |
| #63 | Database investigation | Large documentation set comparing Postgres, Redis, MongoDB, MySQL, SQLite, schemas, ROI, decision tree, and implementation roadmap. Mined story library, multi-chapter state, analytics, sharing, and API usage tracking ideas for a future Vercel storage decision. | `DATABASE_*.md`, `README.md` | **Mined and closed**. Recreate as a Vercel storage RFC; do not merge DigitalOcean-oriented docs or stale branch churn. |
| #56 | DigitalOcean backend services research | Researches DO Spaces, Redis, Postgres, monitoring, cost/ROI; includes a `cacheService.ts` implementation for story/audio caching and rate limiting. Mined provider-neutral cache/storage/rate-limit/observability ideas. | `DIGITAL_OCEAN_*.md`, `DO_*.md`, `api/lib/services/cacheService.ts` | **Mined and closed**. Recreate against Vercel-compatible cache/storage products later. |
| #55 | Voice evolution and emotion support | Enhances story/audio prompts with 90+ emotions, voice evolution tags, narrator atmosphere cues, and intelligent voice parameter assignment. Mined the prompt-format and character-development metadata ideas. | `api/lib/services/storyService.ts`, `api/lib/services/audioService.ts`, audio docs, lockfiles | **Mined and closed**. Recreate later as optional audio-ready story mode; do not merge audio runtime. |
| #54 | DigitalOcean deployment infrastructure | Adds Dockerfiles, `server.js`, DO `app.yaml`, deploy scripts, env examples, and deployment docs. Mined generic deployment-checklist categories only. | Docker files, `server.js`, `app.yaml`, `deploy.sh`, docs, package files | **Mined and closed**. Do not merge for Vercel; recreate a Vercel checklist instead. |
| #53 | Documentation/serverless cleanup | Archives docs, updates serverless references, rewrites changelog/agent docs, and removes committed dependencies in concept. Mined archive/lifecycle ideas. | `AGENTS.md`, `CHANGELOG.md`, archived docs, many `node_modules/*` | **Mined and closed**. Recreate clean docs cleanup after recovery, without `node_modules` churn. |
| #50 | Progress meter hang fix | Fixes timeout ID storage causing progress to hang at 95%, fixes textarea hydration/theme selection issue, adds `PROGRESS_METER_FIX.md`, and includes an alternative no-progress component. | `story-generator/src/app/app.ts`, `app.html`, `app-no-progress.ts.alternative`, `PROGRESS_METER_FIX.md` | **Port/cherry-pick**. Small, concrete, valuable. |
| #47 | Audio pipeline investigation | Research/test artifacts for speaker tag parsing, voice assignment, emotion mapping, sound effects, Web Audio player, and practical enhanced audio service prototypes. Mined validation, emotion navigation, SFX metadata, and voice-consistency roadmap ideas. | `audio-pipeline-investigation.md`, `audio-pipeline-test.js`, `enhanced-audio-service*.ts`, `sound-effects-investigation.ts` | **Mined and closed**. Later audio rebuild should rewrite from current contracts. |
| #45 | Emotion mapping and character consistency | Implements 81-emotion audio parameter mapping, character memory, fuzzy emotion matching, enhanced speaker tags, docs, demo, and tests. Mined taxonomy, fuzzy validation, and character emotional memory. | `api/lib/services/audioService.ts`, `backend/src/services/audioService.ts`, emotion docs/tests/demo | **Mined and closed**. Recreate shared emotion vocabulary later. |
| #44 | Character-driven audio narration system | Broad audio enhancement: ElevenLabs model optimization, enhanced player, emotion mapping, voice consistency, sound effects framework, new docs, and `api/soundeffects/info.ts`. Mined scene/effect metadata and QA ideas. | `api/lib/services/audioService.ts`, `api/soundeffects/info.ts`, enhanced audio player files, docs | **Mined and closed**. SFX/player work remains deferred. |
| #43 | Advanced audio player and emotion-aware voice processing | Adds `AudioEnhancementService`, enhanced audio player component with waveform/character controls, emotion tags, personality profiles, analysis/recommendations. Mined personality profile and output-analysis ideas. | `backend/src/services/audioEnhancementService.ts`, `story-generator/src/app/enhanced-audio-player/*`, contracts/docs | **Mined and closed**. Recreate analyzer pieces in Proving Grounds/story QA later. |
| #42 | Streaming audio generation and modern ElevenLabs | Adds streaming audio service, audio streaming API, SSE progress, 90+ emotion mappings, ElevenLabs model research, enhanced tests/docs. Mined background job semantics and audio progress separation. | `api/audio/streaming.ts`, `api/lib/services/streamingAudioService.ts`, `emotionMapping.ts`, audio docs/tests | **Mined and closed**. Future audio should use durable Vercel-compatible workflow/queue. |
| #41 | Comprehensive test coverage and Vercel CI/CD | Adds API Jest tests, integration workflow tests, Vercel deploy workflow, CodeQL/security/dependency/monitoring workflows, documentation, and a Vercel config tweak. Also includes stale audio/backend changes. Mined into a lean `recovery-ci.yml` workflow that runs the current recovery preflight and Vercel config sanity check. | `.github/workflows/*`, `api/*.test.ts`, `tests/integration/*`, `api/jest.config.js`, `vercel.json`, CI docs | **Ported lean CI only**. Direct merge is too large/stale and reintroduces old API/backend paths. |
| #40 | Mystical UI rewrite | Replaces main HTML/CSS with a spell-crafting style UI: particle effects, 3D creature cards, rune theme selection, intensity crystal, responsive magical layout, hydration fixes. Mined layout grouping, selected-theme counter, and ready/casting status ideas. | `story-generator/src/app/app.html`, `app.css` | **Mined and closed**. Recreate only workflow/layout ideas that fit #70 and `design.md`; do not take the full visual shell. |
| #39 | Extensive CI/CD system | Adds six heavyweight workflows: comprehensive CI, dependency management, deployment optimization, contract validation, visual testing, analytics dashboard, Lighthouse config, and CI docs. Mined branch/path triggers, cache, status-gate, and contract/build validation ideas into the lean recovery workflow. | `.github/workflows/*`, `.github/lighthouse/lighthouse.json`, `.github/CI_SYSTEM.md`, minor spec fixes | **Mined/ported lean concept only**. Heavy suite remains overbuilt and stale. |
| #31 | Chapter continuation, story arc, audiobook | Adds story arc CRUD/service, cliffhanger analysis, enhanced continuation, story arc frontend UI, and audiobook compilation. Audio pieces are out of scope, but story arc/cliffhanger pieces are useful. | `api/lib/services/storyArcService.ts`, `api/story/arc.ts`, `api/story/continue.ts`, contracts, app files, `api/audio/compile.ts` | **Port story-arc/cliffhanger only**. Recreate without audiobook coupling. |
| #30 | Multi-voice audio pipeline | Adds dialogue parser, ElevenLabs v3, multi-voice UI controls, prompt updates for speaker tags, contracts. Mined explicit speaker/narrator tag prompt requirement and segment progress ideas. | `backend/src/services/dialogueParser.ts`, `audioService.ts`, story service, app files/contracts | **Mined and closed**. Early audio reference only. |
| #29 | Multi-voice audio service | Adds `multiVoiceAudioService`, speaker segments, character voice types, mock audio generation, docs, API contracts. Mined segment/result model and narrator mode ideas. | `api/lib/services/multiVoiceAudioService.ts`, `MULTI_VOICE_AUDIO.md`, audio service/contracts, app files | **Mined and closed**. Cleaner future audio-contract reference. |
| #28 | Multi-voice audio pipeline, 11Labs v3 | Adds dialogue parser, character voice service, audio stitching service, multi-voice UI, prompt format changes, debug/error updates. Base branch is not `main`. Mined modular parser/voice/stitching architecture. | `backend/src/services/dialogueParserService.ts`, `characterVoiceService.ts`, `audioStitchingService.ts`, app files | **Mined and closed**. Recreate service boundaries later. |
| #26 | UI/UX polish and accessibility | Adds notification service, form validation service, toast component, loading states, inline validation, ARIA/live regions, retry/error patterns. Ported notifications, Story Lab validation, inline error accessibility, and service specs into the current #70 app. | `notification.service.ts`, `form-validation.service.ts`, `notifications.component.*`, `app.*` | **Ported selectively**. Old app shell, stale story service methods, audio/save UI, and blind retry controls not taken. |
| #24 | Invisible trope subversion engine | Adds trope database, trope subversion service, prompt enhancement, metadata contracts for chapter consistency, integration/demo tests. | `backend/src/data/tropeDatabase.ts`, `tropeSubversionService.ts`, story service, contracts, tests/docs | **Recreate/port later**. Strong story-quality upgrade, but old backend. |
| #22 | Multi-voice audio pipeline | Adds dialogue parsing service, enhanced audio service, voice mapping, emotional inflection, frontend audio UI/progress. Mined quote-based fallback parsing and contextual emotion inference. | `backend/src/services/dialogueParsingService.ts`, `audioService.ts`, audio routes, app files/contracts | **Mined and closed**. Keep only as legacy fallback reference. |

## Merged PRs Inspected For Context

| PR | Material | Current action |
|---:|---|---|
| #83 | Changelog and December 2025 lessons learned updates. | Already landed. Use for context only. |
| #82 | Moved `api/lib` to `api/_lib` to reduce Vercel function count. | Already landed, but not fully propagated to tests/docs. Important baseline constraint. |
| #81 | Critical deployment fixes, missing imports, Vercel function-count reduction. | Already landed. Verify current Vercel configuration still reflects intent. |
| #80 | Centralized Grok model name. | Already landed in part, but current code still has hardcoded model names in places. |
| #79 | Grok model update and token test runner changes. | Already landed in part. Reconcile with #65. |
| #78 | Test syntax/build fixes. | Already landed in part. Current root tests still fail on old `api/lib` imports. |
| #48 | Enhanced Story Generation v2: author blending, beat structures, Chekhov elements, prompt improvements. | Already landed conceptually and forms the story-generation core. |

## High-Value Extraction Queue

These are the most useful non-#70 pieces, ranked by likely value and extraction feasibility.

| Rank | Source | Extract |
|---:|---|---|
| 1 | #50 | Progress timeout/hydration fix. |
| 2 | #64 | Fisher-Yates fix for Chekhov element selection; current code still has biased `sort(() => 0.5 - Math.random())` in places. |
| 3 | #65 | Remaining AI quality/model/token verification work, adapted to current `api/_lib`. |
| 4 | #41 | Minimal Vercel CI/deploy/API-test setup, not the whole workflow suite. |
| 5 | #26 | Notification/form validation/accessibility services. **Ported selected current-Story-Lab version.** |
| 6 | #75 | Batch/continuity UI layer after #70 baseline is stable. **Ported selected queue, suggested-prompt, and grouped-timeline UI.** |
| 7 | #72 | Multi-chapter backend contract/service behavior after #70 baseline is stable. **Ported selected backend primitive.** |
| 8 | #67 | Author-style config extraction and duplicate-code cleanup decisions. |
| 9 | #24 | Trope subversion engine, rebuilt into current story-generation service. |
| 10 | #31 | Story arc/cliffhanger logic, rebuilt without audiobook coupling. |
| 11 | #74 | Proving grounds prompt lab as a dev-only/internal tool. |
| 12 | #73 | Story state deltas and persistence boundary. **Ported selected #70-compatible state material; durable storage still undecided.** |

## What To Merge vs Recreate

### Try to merge or cherry-pick

- #86: merge as-is if checks permit.
- #85: merge after lockfile/build sanity.
- #50: cherry-pick/port the small fix.
- #64: cherry-pick/port Fisher-Yates and selected tests; do not bring `node_modules`.
- #65: port model/token/test pieces.
- #26: services/components and current Story Lab validation have been ported; retry/save/audio UI remains future mining material.

### Use as a baseline

- #70: use as an exploratory branch baseline if the goal is to recover the story-lab direction.

### Port selected features, do not merge whole

- #41: lean recovery CI has been ported; API route tests and Vercel deploy workflow remain future rebuild material.
- #67: use audit/config extraction/cleanup ideas.
- #75: selected batch queue, suggested-prompt, and grouped-timeline UI has been ported; keep fuller queue semantics as future reference.
- #72: selected multi-chapter backend behavior is ported; mine old UI pieces only if #75 leaves gaps.
- #74: use proving-grounds page after core app stabilizes.
- #73: selected state-delta and persistence-boundary behavior has been ported; durable storage must be recreated after a Vercel storage choice.
- #24: port trope engine later.
- #31: port story arc/cliffhanger later.

### Recreate cleanly

- #39: lean CI subset has been recreated in `.github/workflows/recovery-ci.yml`; broader workflow suite remains future material.
- #40: recreate only chosen visual elements on top of the final UI.
- #53: recreate docs cleanup without `node_modules`.
- #54/#56/#63: recreate provider-neutral or Vercel-specific storage/deploy docs if still needed.
- Audio cluster (#22, #28, #29, #30, #42, #43, #44, #45, #47, #55): recreate later from the best parts rather than merging stale branches.

## Conflict Hotspots

Most feature PRs collide in the same files:

- `story-generator/src/app/app.ts`
- `story-generator/src/app/app.html`
- `story-generator/src/app/app.css`
- `story-generator/src/app/contracts.ts`
- `story-generator/src/app/story.service.ts`
- `api/_lib/services/storyService.ts` versus older `api/lib/services/storyService.ts`
- `api/_lib/types/contracts.ts` versus older `api/lib/types/contracts.ts`
- `vercel.json`
- root and `story-generator` lockfiles

That is why the better recovery strategy is not "merge everything"; it is "pick a baseline, then port capabilities in layers."
