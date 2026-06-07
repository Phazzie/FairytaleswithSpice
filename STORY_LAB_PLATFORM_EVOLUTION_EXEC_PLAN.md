# Story Lab Platform Evolution ExecPlan

Created: 2026-06-03 04:24 EDT

## Purpose / Big Picture

Turn the validated Charmed Story Lab MVP into a durable Vercel-first creative-writing platform without losing the qualities that now work: a user-facing story journey, Grok-backed generation, honest failure messages, local copy/download, and Vercel deployability.

This plan covers the future work left after `STORY_LAB_CHARMED_MVP_EXEC_PLAN.md`:

- dedicated style banks for `witch`, `dragon`, `demon`, `angel`, and `mermaid` (completed in Phase A);
- Heat Contract v0 for adult-only confirmation, tension mode, boundary, and no-go content (completed in Phase A);
- live production/provider smoke after deploy;
- cloud accounts and sync;
- durable story/session storage;
- true long-running progress through jobs/workflows instead of staged local progress;
- audio and narration metadata;
- server-side PDF/email export;
- broader polish and unconventional creative tools.

The key product goal is not "more features." The key product goal is a story studio that helps a normal reader generate a better serialized spicy supernatural story than a generic prompt box, while making every background process honest, resumable, and inspectable.

## Progress

- [x] Confirmed current branch is `feature/charmed-mvp-story-lab` and current worktree already contains validated Charmed MVP edits.
- [x] Read `AGENTS.md`, `.agent/PLANS.md`, `STORY_LAB_CHARMED_MVP_EXEC_PLAN.md`, `PR70_RECOVERY_CHANGELOG.md`, and current Story Lab implementation files.
- [x] Checked current Vercel storage/workflow/functions guidance. As of the docs checked on 2026-06-03, Vercel Workflow is beta; Vercel Storage recommends Blob for files, Edge Config for global low-latency config, and Marketplace providers such as Neon/Upstash/Supabase for databases.
- [x] Wrote this self-contained future-platform plan.
- [x] Ran adversarial review by three "haters": product/UX, architecture/deployment, and testing/security.
- [x] Integrated hater findings into this plan:
  - storage/auth/workflow/audio/server export moved behind explicit gates;
  - Director's Room reframed from process theater into a compact revision loop;
  - function-count, privacy, auth, CORS, export-sanitization, and provider-telemetry gates made explicit.
- [x] Executed the immediate safe slice:
  - [x] added dedicated style-bank scaffolding and semantic tests;
  - [x] aligned Story Lab streaming genesis validation with expanded creatures;
  - [x] added live-provider smoke script skeleton without requiring credentials by default;
  - [x] added Heat Contract v0 through UI validation, local blueprint persistence, stream parsing, and Grok prompt context;
  - [x] updated docs and lessons.
- [x] Re-ran focused validation that completed in this environment.
- [x] Converted the future phase list into a checklist so completed work and remaining gates are visible without chat context.
- [x] Executed Phase B1, the shared validation/auth/redaction gate:
  - [x] POST and stream genesis share one server blueprint parser;
  - [x] `AuthPort` and `authorizeProjectAccess` exist without selecting an auth provider;
  - [x] API keys and bearer provider keys are not treated as account auth;
  - [x] server and client logging redact story text, prompts, auth headers, API keys, emails, and artifact URLs.
- [x] Re-ran focused Phase B1 validation that completed locally.
- [ ] Run a complete Angular build/browser-spec pass in a stable browser environment; local Node v23 hung before useful diagnostics, and Node 20 built the targeted spec bundle but Chrome did not capture within 60 seconds.
- [x] Push the completed checklist work and open PR #100.
- [x] Address actionable PR review comments before starting the next implementation gate.
- [x] Executed Phase B2-B4 safety gates on `feature/story-lab-privacy-streaming-gates`:
  - [x] centralized credentialed CORS and disallowed-origin rejection;
  - [x] documented retention/deletion/export policy and implemented the server export sanitizer;
  - [x] added opaque job-id streaming contracts without adding deployable job routes.
- [x] Executed route-budget consolidation on `feature/story-lab-route-budget`:
  - [x] retired duplicate/demo/unused Vercel routes for Story Lab health, stream demo, and image generation;
  - [x] redirected the debug panel and browser smoke mock to root `/api/health`;
  - [x] reduced the expected Vercel function count from `12/12` to `9/12`.
- [ ] Leave final handoff describing what remains and what requires external provisioning.

## Surprises & Discoveries

- Before Phase A, `api/story-lab/stream/genesis.ts` still accepted only `vampire`, `werewolf`, `fairy`, `siren`, and `djinn`. Phase A aligned it with the full Charmed creature set.
- The current app already has a Story Lab streaming route, but it is not true token/job progress. It waits for generation to finish and then emits chapter chunks with short local timers. That is acceptable as a demo bridge, but it must not be called durable progress.
- The current server-side `/api/export/save` route exists, but Charmed MVP intentionally uses browser-local HTML download. Future server export should reuse/replace this route deliberately rather than creating another export path.
- Dedicated style banks can be implemented safely before cloud/workflow work because they are deterministic prompt-quality improvements with local tests. This is now done for all five new creatures.
- Heat Contract v0 gave the first useful "spice safety" primitive without adding accounts, database rows, audio providers, or server export.
- A broad account/storage/workflow/audio/export implementation would be a risky mixed rewrite. It needs phased migration with compatibility adapters and explicit provisioning gates.
- The repo was at the Vercel function-count guard limit (`12/12`). Route-budget consolidation retired three duplicate/demo/unused route entrypoints so the expected current guard result is `9/12`.
- Phase B was too broad as one executable block. It mixed shared parser extraction, account auth seams, privacy/redaction, CORS, retention/deletion policy, export-sanitizer planning, and the future opaque job-id stream. It is now split into smaller checklist gates.
- Phase B1 can be completed without adding routes, dependencies, storage writes, or an auth provider.
- Phase B2-B4 was completed route-free: shared CORS, sanitizer, retention policy, and job-id contracts all live under `api/_lib` plus tests, so that gate kept the Vercel function-count guard at `12/12` before later route-budget consolidation.
- Local Angular/Karma remains environment-sensitive: Node 20 could build the targeted error-logging spec bundle, but Chrome did not capture within 60 seconds in this runner.

## Decision Log

- Decision: Build in five releases, not one large PR, and keep Release 1 focused on the Better Story Contract.
  Rationale: Accounts, storage, workflows, audio, and server export each change a different ownership boundary. Separate releases keep validation meaningful.
- Decision: Use Neon Postgres as the primary durable story/session store only after auth, privacy, retention, and deletion behavior are designed.
  Rationale: Story projects, chapters, story state, export records, and job records are relational and need transactional updates. Vercel Marketplace Neon integrates cleanly with Vercel projects.
- Decision: Use Vercel Blob for generated export artifacts and future audio files only after private URL, owner-scope, retention, and deletion rules exist.
  Rationale: PDF, HTML, EPUB, audio, and cover assets are file-like objects. They should not live in Postgres rows.
- Decision: Use Edge Config only for feature flags, style-bank experiment weights, maintenance flags, and model rollout toggles.
  Rationale: Edge Config is optimized for global reads, not user data or frequently written session state.
- Decision: Treat Vercel Workflow as the target durable-generation architecture; treat any non-Workflow fallback as non-durable polling only.
  Rationale: Workflow is beta. If it is enabled for the project, it can support resumable generation, but AI side effects must be recorded idempotently. A normal Vercel function plus a job row cannot honestly claim crash-safe background generation.
- Decision: Keep local browser storage as a fallback, not a second source of truth.
  Rationale: Users should not lose stories without accounts, but once signed in, cloud records must own canonical persistence and local storage should cache only recent projects.
- Decision: Do not resurrect audio runtime as "text-to-speech button" first.
  Rationale: Audio should start as narration metadata and scene/voice planning, then add actual audio generation only after story segmentation and consent/safety metadata are reliable.
- Decision: The first unconventional product primitive is Heat Contract v0, not accounts or audio.
  Rationale: It improves story quality and safety immediately by letting users specify adult-only confirmation, tension mode, intimacy boundary, and no-go content; it also creates a durable shape for later privacy/safety review.
- Decision: "Genius idea" for the platform: Director's Room as a compact draft-improvement loop, not a visible workflow dashboard.
  Rationale: Users should see concrete craft interventions they can accept or reject: Desire Ledger, Continuity Keeper, Chapter Ending, Anti-Cliche pass, Spice Safety Editor, and Audio Director notes. The workflow can exist internally later, but product copy should focus on draft improvement.
- Decision: Split the old Phase B into four gates: Phase B1 shared validation/auth/redaction scaffolding, Phase B2 CORS/account boundary policy, Phase B3 retention/deletion/export-sanitizer policy, and Phase B4 opaque job-id streaming design.
  Rationale: Parser/auth/redaction are code-safe without provisioning; CORS, retention, export sanitizer, and job-id streaming require separate review because they change privacy, deployment, and route-count risk.
- Decision: Count Phase B1 as completed only for parser/auth/redaction behavior, not for account sync readiness as a whole.
  Rationale: The code now prevents obvious drift and log leakage, but CORS, retention/deletion, export sanitizer replacement, and job-id streaming still remain gates before accounts or cloud storage.
- Decision: Count Phase B2-B4 as completed for policy/contracts/safety helpers only, not for account sync, durable storage, or durable job execution.
  Rationale: Disallowed origins now fail before private route work, server export interpolation is sanitized, and future EventSource paths have an opaque job-id contract, but no auth provider, database, Blob store, Workflow runner, or job route has been provisioned.

## Outcomes & Retrospective

- What became better for users:
  - New Charmed creatures now have dedicated creative style banks instead of borrowing from older creature voices.
  - Heat Contract v0 gives users visible adult-only/spice-boundary controls and carries those boundaries into generation.
  - The generated-story reader shows the active Heat Contract summary beside the story metadata.
- What became better technically:
  - Story Lab stream parsing accepts the same expanded creature set as the Charmed UI.
  - Heat Contract data is typed in frontend contracts, mapped through the Story Lab engine, and preserved in the classic generation context.
  - The live-provider smoke is opt-in and now requires Grok telemetry instead of merely rejecting mock/custom telemetry.
  - POST and stream Story Lab genesis now normalize through one shared server blueprint parser.
  - Story Lab account auth has a deny-by-default port and owner-scope authorization helper without pretending API keys are user accounts.
  - Server and client error logging now redact private story/prompt/user/artifact data before storing or printing logs.
  - Credentialed CORS now uses one `api/_lib/http/corsPolicy.ts` helper and rejects disallowed browser origins before route work.
  - Server export now sanitizes story HTML through a tiny allow-list, strips dangerous containers, escapes title/metadata/PDF strings, and avoids logging raw export errors.
  - Future Story Lab job streaming now has an opaque `job_<uuid>` contract and path builder that keeps blueprint/story/private fields out of status and events URLs.
- What was intentionally deferred:
  - Accounts, cloud storage, durable job routes, Workflow execution, Blob export, email, and audio runtime.
  - Route consolidation before any `/api/story-lab/jobs*` implementation.
- What hostile review still objected to:
  - The current staged progress UI is not real durable progress.
  - Streaming still places sensitive blueprint fields in an EventSource URL until a POST-created job route replaces it with the new opaque job-id contract.
  - Existing `/api/export/save` is safer for mock server export, but it is still not a durable Blob/email export path.
  - Full Angular build and Karma browser spec validation must be rerun under a stable local/CI environment because Node v23 Angular build/Karma runners hung here.
- What validation proved:
  - `git diff --check`, direct app/spec `tsc`, `npm run test:story-lab-real-engine`, `npm exec -- tsx tests/story-lab-stream-parse.test.ts`, `npm run smoke:story-lab-live-provider` default skip, `scripts/recovery/check-vercel-function-count.sh`, and `scripts/recovery/preflight.sh --quick --skip-status` all completed successfully.
  - Phase B1 focused tests passed: `npm exec -- tsx tests/story-lab-blueprint-parser.test.ts`, `npm exec -- tsx tests/story-lab-auth.test.ts`, `npm exec -- tsx tests/log-redaction.test.ts`, `npm exec -- tsx tests/story-lab-stream-parse.test.ts`, `npm run test:story-lab-state`, and `npm run test:story-lab-real-engine`.
  - Phase B2-B4 focused tests passed: `npx tsx tests/cors-policy.test.ts`, `npx tsx tests/export-sanitizer.test.ts`, `npx tsx tests/story-lab-job-contracts.test.ts`, `npx tsx tests/log-redaction.test.ts`, `npx tsx tests/story-lab-blueprint-parser.test.ts`, `npx tsx tests/story-lab-auth.test.ts`, `npx tsx tests/story-lab-stream-parse.test.ts`, `npx tsx tests/story-lab-real-engine.test.ts`, `npx -p node@20 node ./node_modules/typescript/bin/tsc -p story-generator/tsconfig.spec.json --noEmit`, `scripts/recovery/check-vercel-function-count.sh`, and `scripts/recovery/preflight.sh --quick --skip-status`.
  - Route-budget consolidation focused checks passed: `git diff --check`, `scripts/recovery/check-vercel-function-count.sh` at `9/12`, `npx -p node@20 node ./node_modules/typescript/bin/tsc -p story-generator/tsconfig.spec.json --noEmit`, and `scripts/recovery/preflight.sh --quick --skip-status`.

## Context and Orientation

Repository root: this repository checkout.

Current branch: `feature/charmed-mvp-story-lab`.

Current deploy target: Vercel. Do not reintroduce DigitalOcean deployment assumptions.

Current Story Lab files:

- `story-generator/src/app/app.ts`: Story Lab UI state/actions.
- `story-generator/src/app/app.html`: Story Lab template.
- `story-generator/src/app/app.css`: Story Lab styles.
- `story-generator/src/app/story.service.ts`: Angular API client.
- `story-generator/src/app/story-workspace-storage.service.ts`: browser-local persistence.
- `story-generator/src/app/contracts.ts`: frontend contracts.
- `story-generator/src/app/form-validation.service.ts`: frontend validation.
- `api/_lib/types/contracts.ts`: canonical classic story-service contracts.
- `api/_lib/story-lab/contracts.ts`: Story Lab contracts.
- `api/_lib/story-lab/storyLabEngine.ts`: Story Lab engine over the canonical story service.
- `api/_lib/services/storyService.ts`: Grok prose generation and continuation.
- `api/_lib/config/authorStyles.ts`: current creature style banks.
- `api/story-lab/stories.ts`: Story Lab genesis route.
- `api/story-lab/stories/[storyId]/continue.ts`: Story Lab continuation route.
- `api/story-lab/stream/genesis.ts`: current SSE-style Story Lab genesis route.
- `api/export/save.ts` and `api/_lib/services/exportService.ts`: existing server export path.
- `scripts/recovery/story-lab-browser-smoke.mjs`: build-backed mocked browser smoke.

Existing untracked files that are not automatically in this plan:

- `SPARK_TRIAL_TASKS.md`
- `STORY_QUALITY_EVALS_PLAN.md`
- `tests/grok-smoke.test.ts`

Do not delete or absorb these without an explicit cleanup decision.

## Architecture Summary

### Release 1: Better Story Contract

Add prompt-quality, validation, and spice-boundary improvements without new external services.

Observable result:

- New creatures have their own named style banks or explicit archetype banks rather than borrowing silently from vampire/werewolf/fairy.
- Story Lab streaming validation accepts the same creature set as the main Story Lab flow.
- A live-provider smoke script exists, skips safely without credentials, and documents the exact env needed for real proof.
- Heat Contract v0 is visible in the UI, required by current UI validation, persisted in browser-local blueprints, and passed through to generation context.
- The next "Director's Room" step is a small revision-card loop, not a process dashboard.

### Release 2: Privacy, Auth, and Storage Readiness

Do not add cloud writes yet. First define privacy and authorization behavior:

- `AuthPort` with `getCurrentUser(req)` and `requireUser(req)`.
- `authorizeProjectAccess(user, projectId)` used by every project/chapter/job/export route.
- Deny-by-default production auth for account sync; do not rely on `API_KEYS` for user accounts.
- Retention, deletion, and export rules for raw chapter text, story state snapshots, spice metadata, narration metadata, emails, and Blob URLs.
- Central CORS policy with exact origins before cookies or account sync.
- Logging redaction tests for story text, prompts, auth headers, API keys, emails, and artifact URLs.
- Export sanitizer replacement plan before any server PDF/email claim.

Only after that, add a storage port with two adapters:

- `browserLocal` adapter remains the anonymous fallback.
- `cloudPostgres` adapter becomes the signed-in canonical source when `DATABASE_URL` and user auth are configured.

Use a relational schema:

```sql
create table story_projects (
  id text primary key,
  owner_user_id text not null,
  title text not null,
  synopsis text not null,
  tone text not null,
  spicy_level integer not null check (spicy_level between 1 and 5),
  creature text not null,
  active_skin text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table story_chapters (
  id text primary key,
  project_id text not null references story_projects(id) on delete cascade,
  chapter_number integer not null,
  title text not null,
  html_content text not null,
  raw_content text not null,
  summary text not null,
  word_count integer not null,
  has_cliffhanger boolean not null default false,
  created_at timestamptz not null default now(),
  unique(project_id, chapter_number)
);

create table story_state_snapshots (
  id text primary key,
  project_id text not null references story_projects(id) on delete cascade,
  revision integer not null,
  snapshot_json jsonb not null,
  extraction_source text not null,
  confidence numeric,
  created_at timestamptz not null default now(),
  unique(project_id, revision)
);

create table generation_jobs (
  id text primary key,
  project_id text references story_projects(id) on delete cascade,
  owner_user_id text not null,
  kind text not null check (kind in ('genesis', 'continuation', 'export', 'audio')),
  status text not null check (status in ('queued', 'running', 'waiting_for_review', 'completed', 'failed', 'cancelled')),
  current_step text not null,
  progress_percent integer not null default 0,
  request_json jsonb not null,
  result_json jsonb,
  error_json jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table export_artifacts (
  id text primary key,
  project_id text not null references story_projects(id) on delete cascade,
  owner_user_id text not null,
  format text not null check (format in ('html', 'pdf', 'epub', 'audio_zip')),
  blob_url text not null,
  byte_size integer not null,
  created_at timestamptz not null default now()
);
```

Do not create this schema until a database has been provisioned, a local migration path exists, auth is selected, and authorization tests exist. The first code step is a storage/auth port and tests, not a blind database dependency.

### Release 3: Durable Generation Jobs and True Progress

Preferred path with Vercel Workflow:

- `api/story-lab/jobs.ts` creates a job and invokes `runStoryGenerationWorkflow`.
- `api/story-lab/jobs/[jobId].ts` returns job state.
- `api/story-lab/jobs/[jobId]/events.ts` streams job events as SSE.
- These routes require the three slots freed by `STORY_LAB_ROUTE_BUDGET_EXEC_PLAN.md`; rerun the function-count guard before and after adding them.
- Workflow steps:
  1. validate request;
  2. load project/state;
  3. run Director's Room planning passes and record step outputs before side effects;
  4. generate draft with Grok;
  5. run anti-cliche and continuity checks;
  6. optionally pause for user approval if confidence is low;
  7. persist chapters/state;
  8. publish completion event.

Fallback path without Workflow:

- `generation_jobs` row stores job state.
- A normal Vercel function processes one request synchronously up to the existing function budget.
- Long generation can return `202 Accepted` with a job id only if a real worker/workflow owns the generation. Without Workflow/queue/worker, fallback status is non-durable request polling only. Do not pretend it is crash-safe.

### Release 4: Account and Sync

Auth choice:

- Prefer a Vercel Marketplace auth integration if the project already has one selected.
- If no auth product is selected, add an auth adapter interface first:
  - `getCurrentUser(req): Promise<{ userId: string; email?: string } | null>`
  - `requireUser(req): Promise<AuthUser>`

Anonymous-to-account merge:

- Browser projects get a local `anonymousClientId`.
- After sign-in, the UI offers "Move stories into your account."
- Server receives selected local project payloads and imports them through the same storage validation path.
- Conflict rule: cloud project id wins; imported local duplicates receive new project ids and preserve original timestamps in metadata.
- Import requires owner-scoped records and user-visible deletion/export controls.

### Release 5: Audio, Export, and Polished Creative Tools

Audio comes in two steps:

1. Narration metadata:
   - speaker segments;
   - narrator/character voice labels;
   - emotion and intensity tags;
   - pacing notes;
   - consent/safety tags for intimate scenes.
2. Actual audio generation:
   - gated behind explicit provider/env choice;
   - job-based only;
   - outputs stored in Vercel Blob;
   - never blocks text generation.

Server export:

- HTML: sanitize and preserve paragraphs; do not reuse the current whitespace-only export sanitizer.
- PDF: generate from sanitized HTML in a server-side job.
- EPUB: later, after chapter metadata is stable.
- Email: send private, owner-scoped signed artifact links after email ownership verification; never send public artifact URLs.

Unconventional creative tools:

- Anti-Cliche pass: scores a draft against repeated phrases, trope laziness, and weak cliffhangers; must cite the exact line and suggest a sharper alternative.
- Desire Ledger: tracks what each main character wants, fears, refuses to admit, and will pay for; generation must advance at least one ledger item per chapter.
- Chapter Ending: offers three ending bets before writing the last 15 percent of a chapter; user can pick revelation, danger, betrayal, impossible choice, identity crisis, lost control, arrival, or deadline.
- Heat Contract: lets users specify what spice level means for this story, including boundaries and preferred tension modes, without exposing model knobs.
- Story DNA Swatches: users can save a mix of mood, creature, spice, pacing, and favorite tropes as a reusable recipe.
- Villain Pressure Dial: continuation can request pressure from an antagonist, environment, secret, time limit, or internal desire.
- Genius idea, Director's Room: a compact improvement panel where the app shows 2-3 targeted craft notes on a draft and lets the user accept, reject, or rewrite before final prose.

## Concrete Implementation Plan

### Phase A: Current-State Reconciliation and Heat Contract v0

Files:

- Modify `api/_lib/config/authorStyles.ts`.
- Modify `api/_lib/types/contracts.ts`.
- Modify `api/_lib/services/storyService.ts`.
- Modify `api/_lib/story-lab/storyLabEngine.ts`.
- Modify `api/story-lab/stream/genesis.ts`.
- Modify `story-generator/src/app/contracts.ts`.
- Modify `story-generator/src/app/app.ts`.
- Modify `story-generator/src/app/app.html`.
- Modify `story-generator/src/app/app.css`.
- Modify `story-generator/src/app/form-validation.service.ts`.
- Modify `story-generator/src/app/app.spec.ts`.
- Modify `story-generator/src/app/form-validation.service.spec.ts`.
- Modify `story-generator/src/app/story.service.ts`.
- Modify `tests/story-lab-real-engine.test.ts`.
- Create `tests/story-lab-stream-parse.test.ts`.
- Create `scripts/recovery/story-lab-live-provider-smoke.mjs`.
- Modify `package.json`.
- Modify `PR70_RECOVERY_CHANGELOG.md`.
- Modify `LESSONS_LEARNED.md`.

Completed steps:

1. Added dedicated exported style arrays:
   - `WITCH_STYLES`
   - `DRAGON_STYLES`
   - `DEMON_STYLES`
   - `ANGEL_STYLES`
   - `MERMAID_STYLES`
2. Mapped each new creature to its own array in `AUTHOR_STYLE_MAP`.
3. Kept secondary fallback mixes explicit.
4. Added tests that call `getAuthorStylesForCreature()` for every creature and assert:
   - array length is at least 3;
   - at least one style includes creature-specific language;
   - each new creature carries at least two creature-specific cues;
   - the returned array is not the same object as another creature's array for the five new creatures.
5. Expanded `api/story-lab/stream/genesis.ts` creature validation to include the full Story Lab creature set and updated its validation message.
6. Added a stream parser test that proves `witch`, `dragon`, `demon`, `angel`, and `mermaid` parse as valid query input and preserve Heat Contract data.
7. Added `scripts/recovery/story-lab-live-provider-smoke.mjs` that:
   - skips with exit 0 unless `RUN_REAL_GROK_SMOKE=1` and `XAI_API_KEY` or `STORY_LAB_SMOKE_URL` is available;
   - can hit a provided URL or local route;
   - verifies `success: true`, title, at least one chapter, `telemetry.engine === 'grok'`, Grok model family, and no mock model;
   - never prints secrets.
8. Added root npm script `smoke:story-lab-live-provider`.
9. Added Heat Contract v0:
   - frontend contract type and app state;
   - adult-only/consensual fantasy confirmation;
   - tension mode buttons;
   - intimacy boundary buttons;
   - no-go content field;
   - browser-local blueprint persistence through the existing saved-project path;
   - reader metadata summary;
   - frontend validation;
   - backend mapping into `generationContext`;
   - backend refusal if a submitted Heat Contract is explicitly unconfirmed.
10. Ran:
   - `git diff --check`
   - `cd story-generator && ../node_modules/.bin/tsc -p tsconfig.app.json --noEmit`
   - `cd story-generator && ../node_modules/.bin/tsc -p tsconfig.spec.json --noEmit`
   - `npm run test:story-lab-real-engine`
   - `npm exec -- tsx tests/story-lab-stream-parse.test.ts`
   - `npm run smoke:story-lab-live-provider` without env and confirm it skips
   - `scripts/recovery/check-vercel-function-count.sh`
   - `scripts/recovery/preflight.sh --quick --skip-status`

Validation still required outside this local runner:

- `cd story-generator && npm test -- --watch=false --include=src/app/app.spec.ts --include=src/app/form-validation.service.spec.ts`
- `cd story-generator && npm run build`
- Prefer Node 20 or CI. In this execution, local Node v23.8.0 Angular build/Karma runners hung without diagnostics after startup; direct `tsc` completed successfully.

### Phase B Checklist: Auth, Privacy, and Shared Validation

Phase B is not one implementation block anymore. Execute each gate separately, run its validation, and stop before the next gate unless the plan and review comments are clean.

#### Phase B1: Shared Parser, Auth Port, and Redaction Gate

Status: complete locally, pending PR review.

Completed files:

- [x] Created `api/_lib/story-lab/auth/authPort.ts`.
- [x] Created `api/_lib/story-lab/auth/authorizeProjectAccess.ts`.
- [x] Created `api/_lib/story-lab/validation/blueprintParser.ts`.
- [x] Modified `api/story-lab/stories.ts`.
- [x] Modified `api/story-lab/stream/genesis.ts`.
- [x] Modified `api/_lib/story-lab/contracts.ts`.
- [x] Modified `api/_lib/utils/logger.ts`.
- [x] Modified `story-generator/src/app/error-logging.ts`.
- [x] Created `tests/story-lab-blueprint-parser.test.ts`.
- [x] Created `tests/story-lab-auth.test.ts`.
- [x] Created `tests/log-redaction.test.ts`.
- [x] Updated `tests/story-lab-stream-parse.test.ts`.
- [x] Updated `story-generator/src/app/error-logging.spec.ts`.

Completed rules:

- [x] POST and stream genesis share one server parser.
- [x] Production account routes have a provider-neutral `AuthPort` seam with `getCurrentUser(req)` and `requireUser(req)`.
- [x] API keys and provider bearer tokens are not account auth.
- [x] Owner access is represented by `authorizeProjectAccess(user, project)`.
- [x] Logs redact story text, prompts, auth headers, API keys, emails, and artifact URLs.
- [x] No cloud storage writes, routes, auth provider, or new dependencies were added in this gate.

Validation evidence:

- [x] `npm exec -- tsx tests/story-lab-blueprint-parser.test.ts`: passed.
- [x] `npm exec -- tsx tests/story-lab-auth.test.ts`: passed.
- [x] `npm exec -- tsx tests/log-redaction.test.ts`: passed.
- [x] `npm exec -- tsx tests/story-lab-stream-parse.test.ts`: passed.
- [x] `npm run test:story-lab-state`: passed.
- [x] `npm run test:story-lab-real-engine`: passed.
- [x] `npx -p node@20 node ./node_modules/typescript/bin/tsc -p story-generator/tsconfig.spec.json --noEmit`: passed.
- [x] `npx -p node@20 node ./node_modules/typescript/bin/tsc --allowJs false --skipLibCheck --module commonjs --target es2022 --moduleResolution node --types node --noEmit tests/story-lab-blueprint-parser.test.ts tests/story-lab-auth.test.ts tests/log-redaction.test.ts tests/story-lab-stream-parse.test.ts`: passed.
- [ ] `npx -p node@20 node ./node_modules/@angular/cli/bin/ng.js test --watch=false --include src/app/error-logging.spec.ts`: bundle built, but Chrome did not capture within 60 seconds in this runner. Re-run in CI or a local browser environment before treating browser logging coverage as complete.

#### Phase B2: CORS and Account Boundary Gate

Status: complete locally on `feature/story-lab-privacy-streaming-gates`.

Files:

- [x] Created `api/_lib/http/corsPolicy.ts`.
- [x] Modified account-capable/private-content routes to use exact allowed origins from env:
  - `api/story/generate.ts`
  - `api/story/continue.ts`
  - `api/story/stream.ts`
  - `api/story/stream-demo.ts`
  - `api/export/save.ts`
  - `api/image/generate.ts`
  - `api/story-lab/stories.ts`
  - `api/story-lab/stories/[storyId]/continue.ts`
  - `api/story-lab/evaluate.ts`
  - `api/story-lab/stream/genesis.ts`
  - `api/story-lab/health.ts`
- [x] Added `tests/cors-policy.test.ts`.

Later route-budget consolidation retired `api/story/stream-demo.ts`, `api/image/generate.ts`, and `api/story-lab/health.ts`; the CORS helper remains on active private routes.

Rules:

- [x] No wildcard CORS for routes that can carry account cookies, auth headers, story text, artifact URLs, or project ids.
- [x] CORS config is centralized before any account sync route is added.
- [x] `STORY_LAB_ALLOWED_ORIGINS`, `ALLOWED_ORIGINS`, and `FRONTEND_URL` are parsed as exact URL origins; `*` is ignored and never echoed.
- [x] Disallowed browser origins receive `403` before private route work runs.
- [x] SSE `writeHead` calls now use helper-built CORS headers instead of route-local strings.

Validation:

- [x] `npx tsx tests/cors-policy.test.ts`: passed.
- [x] Wildcard CORS scan under `api/`: no remaining wildcard allow-origin literal.
- [x] `scripts/recovery/check-vercel-function-count.sh`: passed at `12/12`.
- [x] `scripts/recovery/preflight.sh --quick --skip-status`: passed.

#### Phase B3: Retention, Deletion, and Export-Sanitizer Policy Gate

Status: policy and sanitizer complete locally; durable Blob/email export still blocked.

Files:

- [x] Updated this plan/changelog/lessons with retention, deletion, and export-sanitizer behavior.
- [x] Created `api/_lib/services/exportSanitizer.ts`.
- [x] Updated `api/_lib/services/exportService.ts`.
- [x] Updated `api/export/save.ts` so raw export error objects are not logged.
- [x] Added `tests/export-sanitizer.test.ts`.

Rules:

- [x] Do not store raw story text in cloud storage until retention, deletion, owner-scope, and export behavior are enforced by the storage adapter.
- [x] Retention policy for future cloud storage:
  - story projects, chapters, story state snapshots, spice metadata, and narration metadata are owner-scoped records;
  - account deletion must cascade through project/chapter/state/export/job records;
  - generated artifact URLs must be private, expiring, owner-scoped, and deleted when the source project/export is deleted;
  - email export must not store recipient emails beyond the delivery/audit window selected in a later provider-specific plan.
- [x] Server export now sanitizes HTML content through a tiny allow-list, strips all attributes, removes dangerous container content, escapes HTML titles/metadata, escapes PDF string syntax, and uses plain text for text/PDF mock output.
- [x] Do not add Blob URLs until private URL and deletion rules are implemented against the selected Blob/storage provider.

Validation:

- [x] Privacy/retention review recorded in this plan.
- [x] `npx tsx tests/export-sanitizer.test.ts`: passed.
- [x] `npx tsx tests/log-redaction.test.ts`: passed.

#### Phase B4: Opaque Job-Id Streaming Design Gate

Status: design/contracts complete locally; route implementation blocked by function-count and workflow/provider decisions.

Files:

- [x] Updated this plan with the route consolidation needed before adding job routes.
- [x] Created `api/_lib/story-lab/jobs/jobContracts.ts`.
- [x] Added `tests/story-lab-job-contracts.test.ts`.
- [x] Defined how POST job creation should replace sensitive EventSource query strings: future creation returns `job_<uuid>`, and status/events URLs carry only that opaque id.
- [x] Defined anonymous local generation behavior before account storage exists: keep current direct generation as a non-durable local path until a job route plus real worker/workflow is available.

Rules:

- [x] Streaming should be replaced by POST job creation plus opaque job-id events before sensitive account data enters the URL path.
- [x] Do not add job routes while the function-count guard is still `12/12`; this gate added contracts/tests only.
- [x] Without Vercel Workflow or a real queue/worker, status must be labeled non-durable.

Validation:

- [x] Function-count consolidation remains required before route implementation.
- [x] `npx tsx tests/story-lab-job-contracts.test.ts`: passed.
- [x] `scripts/recovery/check-vercel-function-count.sh`: passed at `12/12`.

### Phase C: Storage Port Without Cloud Deployment

Files:

- Created `api/_lib/story-lab/storage/storyProjectStore.ts`.
- Created `api/_lib/story-lab/storage/inMemoryStoryProjectStore.ts`.
- Created `api/_lib/story-lab/storage/postgresStoryProjectStore.ts`.
- Created `tests/story-lab-storage-port.test.ts`.

Rules:

- The Postgres adapter must lazy-read `DATABASE_URL`; importing the module without env must not throw.
- The in-memory adapter is for tests/local only and must be named non-durable.
- Cloud adapter writes require the Phase B1 auth/authorization tests and the Phase B2/B3 privacy gates.
- The route layer must continue to work without `DATABASE_URL`.
- Postgres saves must be based on returned database rows. A zero-row owner-scoped upsert means the caller did not own the conflicting project id and must return `STORY_LAB_PROJECT_FORBIDDEN`, not optimistic success.
- Postgres load/delete stay owner-scoped and may avoid revealing whether another owner's project id exists.
- Missing derived metadata should use safe display/storage fallbacks, while corrupt stored Postgres JSON should fail closed with `STORY_LAB_STORAGE_ERROR` rather than fabricating an empty saved project.

Validation:

- [x] `npx tsx tests/story-lab-storage-port.test.ts`: passed with owner isolation, clone safety, safe metadata fallbacks, fail-closed readiness, malformed-row failure, fake-executor SQL shape, and zero-row Postgres owner-conflict coverage.
- [x] `npm run test:story-lab-state`: passed.
- [x] `scripts/recovery/check-vercel-function-count.sh`: passed at `12/12`.
- [x] `scripts/recovery/preflight.sh --quick --skip-status`: passed.

### Phase D: Job Contract and Progress UI

Files:

- Create `api/_lib/story-lab/jobs/contracts.ts`.
- Create `api/_lib/story-lab/jobs/jobStore.ts`.
- Create `api/story-lab/jobs.ts`.
- Create `api/story-lab/jobs/[jobId].ts`.
- Create `api/story-lab/jobs/[jobId]/events.ts`.
- Modify `story-generator/src/app/story.service.ts`.
- Modify `story-generator/src/app/app.ts`.
- Modify `story-generator/src/app/app.html`.
- Modify `scripts/recovery/story-lab-browser-smoke.mjs`.

Contracts:

```ts
export type StoryLabJobKind = 'genesis' | 'continuation' | 'export' | 'audio';
export type StoryLabJobStatus = 'queued' | 'running' | 'waiting_for_review' | 'completed' | 'failed' | 'cancelled';

export interface StoryLabJob {
  jobId: string;
  kind: StoryLabJobKind;
  status: StoryLabJobStatus;
  currentStep: string;
  progressPercent: number;
  createdAt: string;
  updatedAt: string;
  result?: StoryIterationPayload;
  error?: { code: string; message: string; details?: unknown };
}
```

Acceptance:

- UI can start a job and survive reload by polling job id.
- Mocked browser smoke sees queued -> running -> completed.
- Production missing key creates a failed job with `AI_UNAVAILABLE`, not mock prose.
- Function count stays within the repo's allow-list before and after any API route change.
- Non-Workflow fallback is labeled non-durable.

### Phase E: Account Sync

Stop condition:

- Do not implement until auth provider is selected.

Plan:

- Add `AuthPort`.
- Add anonymous import endpoint.
- Add merge UI.
- Add tests for duplicate/import behavior.

### Phase F: Audio and Export

Stop condition:

- Do not implement live audio until provider, cost cap, and storage are selected.

Plan:

- Add `NarrationSegment` metadata to generated chapters.
- Add an export job that writes HTML/PDF artifacts to Blob.
- Add audio job that consumes narration metadata.
- Add smoke that proves audio/export jobs are nonblocking and resumable.

## Hostile Review Checklist

Ask reviewers to attack:

- fake durability;
- hidden provider fallback;
- scope creep into auth/audio without provisioning;
- Vercel function-count growth;
- auth after storage instead of before storage;
- wildcard CORS before accounts/sync;
- raw story text retention without deletion/export policy;
- stale smoke selectors;
- unsafe export sanitization;
- public or unauthenticated artifact URLs;
- privacy risk in story persistence;
- UI promises that are not backed by runtime behavior;
- model/provider claims not proven by telemetry.

## Validation and Acceptance

Immediate safe slice is accepted only when:

- dedicated style-bank tests pass;
- Story Lab stream parsing accepts all Charmed creatures;
- Heat Contract v0 validates adult-only confirmation, persists in browser-local blueprints, and reaches generation context;
- live-provider smoke skips safely without credentials;
- live-provider smoke proves Grok telemetry when enabled;
- Phase B1 shared parser, auth-port, owner-denial, and log-redaction tests pass;
- existing Charmed MVP checks still pass;
- docs record what was implemented and what still requires provisioning.

Full platform is accepted only when:

- signed-in users can save, reload, continue, export, and sync stories across browsers;
- anonymous users still have local fallback;
- long-running generation has a real job id and can survive reload;
- live provider failures become visible job errors;
- cloud records are owner-scoped, deletable, and covered by authorization tests;
- server export sanitizes HTML/title/metadata and uses private artifact URLs;
- exports/audio never block text generation;
- Vercel deployment has production smoke evidence.

## Idempotence and Recovery

- If a dependency install is needed, update both root and app lockfiles intentionally and run `npm run install:all` before validation.
- If Vercel Marketplace provisioning is missing, stop before implementing provider-specific database code beyond lazy adapter scaffolding.
- If Workflow is unavailable, document fallback behavior as non-durable and do not claim crash safety.
- Run `scripts/recovery/check-vercel-function-count.sh` before and after every API route change; after route-budget consolidation the expected guard result is `9/12`.
- If function count would exceed 12, consolidate or retire routes before adding new deployable functions. Future Phase D job routes may spend the three freed slots only if the guard still passes.
- If browser smoke fails because of selectors, prefer preserving explicit `data-testid` hooks in the template.
- If live provider smoke fails for missing credentials, it must skip in normal CI and print the exact env needed without exposing secrets.
- If `STORY_LAB_SMOKE_URL` points at a protected Vercel preview, add an explicit bypass/auth mechanism before treating that smoke as production proof.

## Periodic Self-Review Schedule

- After plan creation: check that every future scope has a phase and a stop condition.
- After hater review: fix Critical/Important findings before code.
- After Phase A tests: re-read the diff for accidental scope expansion.
- After any storage/job/auth code: run function-count check, auth-denial tests, CORS review, privacy/retention review, and logging-redaction tests. If only Phase B1 auth scaffolding changed, CORS and retention may remain explicit pending gates, but that must be recorded in this plan.
- After any export/audio code: run sanitizer tests, private artifact URL tests, owner-scope tests, and nonblocking job tests.
- Before final handoff: separate "done now" from "requires provisioning" and "future product work."

## Artifacts and Notes

Current external-source checks used for this plan on 2026-06-03:

- Vercel Workflow docs checked 2026-06-03: `https://vercel.com/docs/workflow`.
- Vercel Storage docs checked 2026-06-03: `https://vercel.com/docs/storage`.
- Vercel Functions guidance checked 2026-06-03: `https://vercel.com/docs/functions`.
- Vercel platform/functions limits checked 2026-06-03: `https://vercel.com/docs/platform/limits` and `https://vercel.com/docs/functions/limitations`.

## Interfaces and Dependencies

Likely future dependencies, added only in the phase that needs them:

- `@neondatabase/serverless` or an ORM wrapper for Neon Postgres.
- `@vercel/blob` for export/audio artifacts.
- `@vercel/edge-config` for feature flags and experiment weights.
- `workflow` for durable generation if Vercel Workflow is enabled.
- An auth provider package only after the project chooses the auth product.

No new dependency is required for Phase A or Phase B1.
