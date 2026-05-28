# Grok Multi-Agent Story Lab Polish ExecPlan

Created: 2026-05-28 16:49 EDT

## Purpose / Big Picture

Take the current Vercel-ready Story Lab from "working MVP" to a more polished product slice:

- keep xAI/Grok as the only live AI provider;
- migrate active story generation, continuation, and Story Lab evaluation to xAI's documented Grok multi-agent model family;
- make the front end feel snazzy, specific, charming, and user-friendly without turning the app into a marketing landing page;
- add local durable story workspace memory and AI-assisted continuity extraction;
- add story quality checks so prompt/model/frontend changes can be judged by evidence instead of vibes;
- keep the remaining dev/test audit, historical Sonar cleanup, audio, and DigitalOcean work explicitly bounded.

The desired observable outcome is that a normal user can open `https://fairytaleswith-spice.vercel.app`, see an attractive Story Lab workspace, start from a guided prompt or custom blueprint, generate with Grok multi-agent, continue the story with better continuity, return later in the same browser to see saved local story projects, and understand what happened if the provider fails.

This is not an OpenAI provider migration. OpenAI docs are used only as product/frontend design guidance. Do not add `OPENAI_API_KEY`, OpenAI SDKs, or OpenAI runtime calls in this plan.

## External Docs Checked

OpenAI official source:

- `https://developers.openai.com/blog/designing-delightful-frontends-with-gpt-5-4`
- Useful takeaway for this repo: the frontend should move past generic generated UI by embedding specific product intent, visual direction, interaction detail, responsive behavior, and design-system constraints into the implementation. For Story Lab, that means a real writing-workbench experience, not just prettier cards.

xAI official sources:

- `https://docs.x.ai/developers/model-capabilities/text/multi-agent`
- `https://docs.x.ai/docs/guides/reasoning`
- `https://docs.x.ai/docs/guides/chat/comparison`
- Useful takeaway for this repo: the documented model is `grok-4.20-multi-agent`, not `grok-4.2`. xAI calls it beta. Low/medium reasoning effort uses 4 agents; high/xhigh uses 16 agents. xAI's Responses API uses `/v1/responses` with `input`, while the older Chat Completions API uses `/v1/chat/completions` with `messages`.

## Progress

- [x] Confirmed current repo state after shipping: `main` is deployed, Recovery CI is green, production Story Lab smoke passed, and open PR list was empty.
- [x] Checked official OpenAI frontend guidance and official xAI Grok multi-agent docs.
- [x] Corrected user shorthand from "Grok 4.2 multiagent" to documented xAI model `grok-4.20-multi-agent`.
- [x] Created this self-contained ExecPlan.
- [x] Link this plan from `AGENTS.md`.
- [x] Create a new branch from updated `main`.
- [x] Implement Grok multi-agent model configuration and opt-in live model smoke.
- [x] Migrate StoryService calls to the xAI Responses API through one shared xAI client.
- [x] Update Story Lab evaluation route to the same model/config path.
- [x] Redesign the Story Lab front end with a polished, domain-specific workspace.
- [x] Add local saved story projects and restore-on-load behavior.
- [x] Add AI-assisted continuity extraction with explicit degraded-mode warnings.
- [x] Add story quality evals and visual/browser smoke coverage.
- [x] Merge PR #98 and confirm merged-main Recovery CI plus Vercel production root.
- [x] Run production live Story Lab smoke after merge.
- [x] Discover and document that the first post-merge live Story Lab smoke failed because `/api/story-lab/stories` returned Vercel HTTP 504.
- [x] Add a Grok-only Vercel timeout policy: try `grok-4.20-multi-agent` inside the live request window, fall back to `grok-4.3` for retryable timeout/server failures, use the fast path for extra batch chapters, and keep continuity/evaluation on the fast Grok path.
- [x] Verify the authenticated Vercel preview with live Story Lab browser smoke after the timeout/default follow-up.
- [x] Merge the timeout follow-up and rerun production live Story Lab smoke evidence.

## Surprises & Discoveries

- The model name the user gave is likely shorthand. Official xAI docs currently list `grok-4.20-multi-agent`; using `grok-4.2` would likely fail.
- The current active story engine still has hard-coded `grok-4-1-fast-reasoning` model strings in multiple places.
- The public Story Lab UI is functional but heavily purple/pink, panel-heavy, and more operational than charming. It needs a real visual asset, better interaction rhythm, clearer affordances, and less generic generated-app styling.
- The current continuity panel exists, but continuity extraction is mostly heuristic and transient. This is the right place to use Grok more deeply.
- xAI multi-agent can be expensive/slow depending on reasoning effort. The plan uses medium by default and reserves high/xhigh for explicit deep work rather than every button click.
- The OpenAI docs MCP was installed globally during planning with `codex mcp add openaiDeveloperDocs --url https://developers.openai.com/mcp`, but this current session still used official web docs because MCP tools are not exposed until a future tool refresh/restart.
- The Grok multi-agent live smoke path needed an async `main()` wrapper because this checkout's `tsx` path emits CJS for that file and rejected top-level `await`.
- The build-backed browser smoke caught the right acceptance shape for local persistence: mocked generation, continuation, reload, restored active story, desktop screenshot, and mobile screenshot.
- PR #98 passed branch checks and merged cleanly, but production live smoke exposed a real runtime failure: Grok multi-agent plus AI continuity extraction could exceed Vercel's synchronous function window and surface as a 504 before users saw a story.
- Protected Vercel preview URLs need browser-based auth handling. The Story Lab smoke harness's raw `fetch` readiness check cannot use `_vercel_share` cookies, so protected-preview smokes must skip that preflight and let Playwright load the shared URL.

## Decision Log

- Decision: Stay Grok-only for live AI.
  Rationale: The user explicitly chose Grok-only. OpenAI docs are design reference material only.

- Decision: Use `grok-4.20-multi-agent` as the default story model, not `grok-4.20-multi-agent-latest`.
  Rationale: A non-latest alias is easier to reason about in validation. Add an environment override for future model pinning without code churn.

- Decision: Add `XAI_STORY_MODEL` and `XAI_STORY_REASONING_EFFORT`.
  Rationale: Model and effort should not be scattered string literals. Default to `grok-4.20-multi-agent` and `medium`.

- Decision: Use xAI Responses API for the multi-agent story path.
  Rationale: xAI's multi-agent docs show `/v1/responses`. Do not keep bolting new model behavior onto duplicated Chat Completions payloads.

- Decision: Do not enable built-in web/search tools for story generation by default.
  Rationale: Story Lab is creative generation, not factual research. Built-in tools would add latency, cost, privacy questions, and unpredictable factual intrusions into fantasy prose. If research tools are ever used, put them behind an explicit Proving Grounds experiment.

- Decision: Create one internal xAI text client, not a broad provider abstraction.
  Rationale: The user rejected provider churn and wants Grok-only. A small xAI client removes duplication without pretending OpenAI/Anthropic/etc. are supported.

- Decision: Make the next UI an actual workspace, not a landing page.
  Rationale: The app should open directly into creation. The first screen should show blueprint controls, story output, saved projects, and continuity, with a stronger visual identity.

- Decision: Add a generated or curated bitmap visual asset.
  Rationale: Current UI relies on gradients. A narrative app needs an actual visual signal. Put the asset under `story-generator/public/` and keep it inspectable in the built app.

- Decision: Implement local-first durable memory before cloud persistence.
  Rationale: The app has no auth model. Browser-local saved projects are useful immediately and avoid pretending we have cross-device accounts. Label this clearly as "saved in this browser."

- Decision: AI continuity extraction should fail visibly, not silently.
  Rationale: If Grok extraction fails, keep the old heuristic continuity as a degraded fallback, attach a warning to the continuity panel, and record it in telemetry.

- Decision: Keep Grok multi-agent as the preferred generation model but add a Grok-only fast fallback.
  Rationale: The user asked to stay Grok-only and move to Grok multi-agent, but Vercel cannot hold a synchronous request open indefinitely. `grok-4.20-multi-agent` remains the first attempt; retryable timeout/server failures use `grok-4.3`, and the UI records `fallbackFromModel` instead of pretending the fallback was the primary model.

- Decision: In multi-chapter batches, only the first generated chapter attempts multi-agent.
  Rationale: The Story Lab default is a two-chapter batch. Retrying multi-agent independently for every chapter could still exceed Vercel's function window. Later chapters in the same batch use the fast Grok model to keep the full request inside one deployable budget.

- Decision: Default the first visible Story Lab batch to one chapter.
  Rationale: The user needs a demoable first path. Multi-chapter batching remains available, but the default should not start with extra live provider calls before the first story appears.

- Decision: Run AI continuity extraction on the fast Grok path with a short timeout.
  Rationale: Continuity extraction is useful, but it is secondary to returning the drafted chapter. If it cannot finish quickly, the existing heuristic/mixed receipt path is the right degraded mode.

## Outcomes & Retrospective

- What became better for normal users: Story Lab now opens as a polished writing workbench, uses a real atmospheric bitmap asset, keeps saved stories in the browser, restores the latest story on load, and shows visible continuity/model/save status.
- What became better for story quality: Story Lab blueprint fields still reach the canonical engine; continuation receives prior chapter context; continuity extraction is labeled as `ai`, `heuristic`, or `mixed`; deterministic story-quality evals now cover prompt preservation, cliffhanger metadata, and continuation context.
- What became safer architecturally: active story, continuation, evaluation, and smoke model calls share `XaiTextClient` and `xaiConfig` instead of scattering model strings and payload shapes.
- What a senior dev who hates this still objects to: `/api/story/stream` is still effectively a final-result SSE path rather than true Responses API token streaming, local storage is browser-only, and live Grok multi-agent behavior is only opt-in because credentials are not present locally.
- What surprised us: the visual polish was less risky than the storage seam; the storage seam needed explicit contracts and refresh-after-reload browser proof to stay honest.
- What we should have anticipated: `tsx` top-level-await behavior and xAI Responses output variants should have been accounted for immediately in the shared client/smoke harness.
- What remains deliberately deferred: production live smoke after merge, true streaming migration, cloud persistence, audio runtime, DigitalOcean work, and the remaining Karma/socket dev-audit findings.
- Post-merge correction: production live smoke did run and found a Vercel 504 in the real provider path. The correction is a bounded provider policy, not a provider switch or a return to mocks.
- Final post-merge evidence: PR #99 merged into `main`, Vercel production served the new deployment, and `STORY_LAB_SMOKE_URL=https://fairytaleswith-spice.vercel.app STORY_LAB_SMOKE_LIVE=1 npm run smoke:story-lab-ui` passed.

## Context and Orientation

Repository root: `/Users/hbpheonix/fairytaleswithspice`.

Current deployment target: Vercel only.

Do not reintroduce:

- DigitalOcean deployment path,
- active audio runtime,
- OpenAI provider/runtime,
- another active story service copy.

Current public app:

- Angular Story Lab app: `story-generator/src/app/app.ts`, `story-generator/src/app/app.html`, `story-generator/src/app/app.css`
- Angular frontend API client: `story-generator/src/app/story.service.ts`
- Frontend contracts: `story-generator/src/app/contracts.ts`
- Public Story Lab routes:
  - `api/story-lab/stories.ts`
  - `api/story-lab/stories/[storyId]/continue.ts`
  - `api/story-lab/evaluate.ts`
  - `api/story-lab/health.ts`
- Story Lab adapter/orchestrator: `api/_lib/story-lab/storyLabEngine.ts`
- Canonical story engine: `api/_lib/services/storyService.ts`
- Existing browser smoke: `scripts/recovery/story-lab-browser-smoke.mjs`

Current model literals that must be removed or centralized:

- `api/_lib/services/storyService.ts`: `grok-4-1-fast-reasoning`
- `api/story-lab/evaluate.ts`: `grok-4-fast-reasoning`
- `tests/verify-ai-fixes.test.ts`: expects `grok-4-1-fast-reasoning`
- `tests/verify-api-keys.ts`: uses `grok-4-1-fast-reasoning`

Current validation evidence before this plan:

- Main Recovery CI passed.
- Production Vercel deployment passed.
- Production live Story Lab browser smoke passed.
- Runtime dependency audits are clean.
- Full Story Generator dev/test audit still has four Karma/socket findings: `engine.io`, `socket.io-adapter`, `socket.io-parser`, and `ws`.

## Plan of Work

### Phase 1 - Branch, Model Config, and Live Probe

Create branch:

`git switch main && git pull --ff-only && git switch -c feature/grok-multiagent-story-lab-polish`

Add `api/_lib/config/xaiConfig.ts`:

- export `DEFAULT_XAI_STORY_MODEL = 'grok-4.20-multi-agent'`;
- export `DEFAULT_XAI_REASONING_EFFORT = 'medium'`;
- export `getXaiStoryModel()` from `process.env.XAI_STORY_MODEL || DEFAULT_XAI_STORY_MODEL`;
- export `getXaiReasoningEffort()` constrained to `low | medium | high | xhigh`, default `medium`;
- expose `isHighAgentEffort()` for logging when `high` or `xhigh` is chosen.

Add an opt-in live smoke script:

- file: `tests/grok-multi-agent-smoke.test.ts`;
- script: `npm run smoke:grok-multi-agent`;
- run only when `RUN_REAL_GROK_MULTI_AGENT_SMOKE=1` and `XAI_API_KEY` are both set;
- call `https://api.x.ai/v1/responses`;
- use `model: getXaiStoryModel()`;
- use `reasoning: { effort: getXaiReasoningEffort() }`;
- send a tiny creative prompt and assert non-empty text;
- print model, effort, request latency, and available usage fields;
- skip safely by default without failing CI.

Stop condition: if xAI returns 404/unsupported model for `grok-4.20-multi-agent`, stop and document the exact response before changing production code.

### Phase 2 - Single xAI Responses Client

Create `api/_lib/services/xaiTextClient.ts`.

The client owns:

- `XAI_API_KEY` lookup;
- xAI base URL;
- Responses API request shape;
- model and effort config;
- timeout handling;
- output text extraction;
- usage extraction;
- error shaping that preserves provider status/code without leaking secrets.

Required interface:

```ts
export interface XaiTextRequest {
  system: string;
  user: string;
  maxOutputTokens: number;
  temperature: number;
  topP: number;
  timeoutMs: number;
  context?: LogContext;
  operation: 'genesis' | 'continuation' | 'continuity_extraction' | 'evaluation' | 'smoke';
}

export interface XaiTextResponse {
  text: string;
  model: string;
  reasoningEffort: 'low' | 'medium' | 'high' | 'xhigh';
  latencyMs: number;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
}
```

Implementation rule: do not add an OpenAI-compatible provider layer. This is an xAI-only client.

Update `api/_lib/services/storyService.ts`:

- replace direct `axios.post(this.grokApiUrl, ...)` calls with `XaiTextClient.generateText()`;
- keep all prompt construction, token budgeting, trope subversion, cliffhanger analysis, and chapter parsing behavior;
- keep mock mode when `XAI_API_KEY` is absent;
- update logs to include model and reasoning effort from the client response;
- update metadata where possible so Story Lab telemetry can show Grok multi-agent.

Update streaming:

- first try Responses API streaming through the xAI client;
- keep SSE semantics at `/api/story/stream`;
- if streaming support is not compatible with existing parser, stop and split streaming migration into a separate PR while moving the public Story Lab non-streaming path first. Do not break `npm run smoke:story-lab-ui`.

Update `api/story-lab/evaluate.ts`:

- use the same xAI model/config path;
- avoid direct hard-coded model strings;
- keep evaluation fail-closed: if provider eval fails, return an explicit evaluation error or local fallback marker, not fake confidence.

### Phase 3 - AI Continuity Extraction

Create `api/_lib/story-lab/continuityExtractor.ts`.

The extractor takes:

- existing `StoryStateSnapshot | undefined`;
- new chapters;
- story summary;
- blueprint context;
- generated continuity warning list.

It returns:

- updated characters;
- active plot threads;
- unresolved artifacts;
- continuity warnings;
- suggested next moves;
- confidence/source metadata: `ai`, `heuristic`, or `mixed`.

Use `XaiTextClient` with `operation: 'continuity_extraction'` and strict JSON instructions. Validate the parsed object with local TypeScript guard functions. If parsing fails, use the existing heuristic path and add a visible warning: "Continuity used fallback extraction for this batch."

Update:

- `api/_lib/story-lab/storyLabEngine.ts`;
- `api/_lib/story-lab/contracts.ts`;
- `story-generator/src/app/contracts.ts`;
- `tests/story-lab-real-engine.test.ts`;
- `tests/story-lab-state.test.ts`.

Acceptance: continuation after a generated story carries AI-extracted character/plot/artifact state, and a failed extraction does not lose the generated chapter.

### Phase 4 - Snazzy Story Lab Front End

Use the OpenAI GPT-5.4 frontend article as design guidance, not runtime dependency. The implementation must be specific to this app:

- replace the current generic panel look with a "writer's workbench" layout;
- keep the first screen usable, not a landing page;
- use a real bitmap visual asset in `story-generator/public/story-lab-atmosphere.webp` or `.png`;
- add a visible saved-project rail or drawer;
- make the generation controls feel guided and fast to understand;
- keep Proving Grounds linked but secondary;
- keep debug panel hidden behind `?debug=1`;
- avoid a one-note purple palette. Use ink, candlelight, parchment, rose, moss/teal, and plum as restrained accents;
- keep cards/panes at 8px radius or less unless a component already requires otherwise;
- avoid nested cards;
- ensure text never overlaps or overflows on mobile;
- do not scale font sizes with viewport width;
- preserve existing `data-testid` selectors used by the browser smoke unless the script is updated in the same commit.

Recommended UI structure:

- top: compact brand/workspace header with status, saved-state indicator, and model badge "Grok multi-agent";
- left: Blueprint Studio with quick-start chips, core controls, and validation;
- center: Chapter Reader with generated output, chapter timeline, and continue actions;
- right: Continuity Weave with characters, unresolved threads, artifacts, warnings, and suggested next moves;
- lower/side drawer: Saved Stories in this browser.

Add icon support:

- use `lucide-angular` for icons if dependency installation is acceptable after checking Angular 20 compatibility;
- if not adding the dependency, keep text buttons clean and avoid manual SVG icon systems.

Add asset:

- generate or add one atmospheric bitmap asset showing a dark fairy-tale writing desk/storybook/workbench;
- put it in `story-generator/public/`;
- reference it in CSS with stable responsive sizing;
- do not use only gradients/orbs as the visual identity.

Update:

- `story-generator/src/app/app.html`;
- `story-generator/src/app/app.css`;
- `story-generator/src/app/app.ts`;
- `story-generator/src/app/app.spec.ts`;
- `story-generator/src/app/form-validation.service.ts` if the UI adds guided presets;
- `scripts/recovery/story-lab-browser-smoke.mjs` if selectors/layout assertions need updating.

### Phase 5 - Local Durable Story Workspace

Implement browser-local saved story projects.

Add `story-generator/src/app/story-workspace-storage.service.ts`.

Storage behavior:

- use localStorage first for simplicity and current repo pattern;
- key prefix: `fairytales_story_lab_projects_v1`;
- store compact project records with story id, title, blueprint, summary, chapters, story state, updated timestamp, and model telemetry;
- cap saved projects to a fixed count such as 12;
- expose save/load/delete/rename methods;
- catch quota and JSON errors and surface user-readable messages.

UI behavior:

- after successful generation or continuation, autosave current project;
- show "Saved in this browser" status;
- let users load prior stories;
- let users delete stories;
- never imply cloud sync or account storage.

Tests:

- service unit tests for save/load/delete/quota-error behavior;
- component tests for autosave and load path;
- browser smoke checks that a generated story survives refresh in mock mode.

### Phase 6 - Story Quality Evals

Add `tests/story-quality-evals.test.ts`.

Initial evals must be deterministic and cheap:

- prompt format preserves protagonist/antagonist/theme;
- continuation references previous chapter context;
- generated HTML is sanitized and readable;
- no empty/placeholder/mock text leaks when live mode is expected;
- cliffhanger metadata is present when chapter content warrants it;
- continuity extraction source is recorded as `ai`, `heuristic`, or `mixed`.

Add optional live eval:

- script: `npm run eval:story-quality-live`;
- gated by `RUN_REAL_GROK_EVALS=1` and `XAI_API_KEY`;
- use one short prompt and one continuation;
- assert structure and basic continuity, not exact prose.

### Phase 7 - Remaining Cleanup Gates

Do not let this feature branch sprawl into unrelated cleanup, but record the status:

- run `cd story-generator && npm audit --json`; if the four Karma/socket findings remain, keep them documented;
- do not block the UI/Grok work on full dev/test audit unless a runtime dependency becomes affected;
- query open PRs before final merge;
- check main Recovery CI and Vercel after merge;
- run production live Story Lab smoke after merge.

## Concrete Steps

1. Create branch from `main`.
2. Add `api/_lib/config/xaiConfig.ts`.
3. Add `api/_lib/services/xaiTextClient.ts` with unit tests.
4. Add opt-in `tests/grok-multi-agent-smoke.test.ts` and package script.
5. Update `api/_lib/services/storyService.ts` to use `XaiTextClient`.
6. Update `api/story-lab/evaluate.ts`.
7. Update model verification tests and API-key smoke scripts.
8. Run local non-live tests.
9. Run opt-in live Grok multi-agent smoke if `XAI_API_KEY` is present.
10. Add AI continuity extractor and tests.
11. Add local saved-story storage service and tests.
12. Redesign Story Lab UI and CSS.
13. Add or generate visual asset under `story-generator/public/`.
14. Extend browser smoke for desktop and mobile viewport coverage.
15. Run full validation.
16. Open PR with screenshots, model evidence, and smoke evidence.
17. Merge after checks pass.
18. Verify production deployment and live Story Lab smoke.
19. Update this plan's `Outcomes & Retrospective`.

## Validation and Acceptance

Required local validation:

- `git diff --check`
- `node --check scripts/recovery/story-lab-browser-smoke.mjs`
- `npm run test:story-lab-real-engine`
- `npm run test:story-lab-state`
- `npm run test:all`
- `cd story-generator && npx tsc -p tsconfig.app.json --noEmit`
- `cd story-generator && npx tsc -p tsconfig.spec.json --noEmit`
- `cd story-generator && npx -p node@20 -c "node -v && npm run build"`
- `npm run build:verify`
- `npm run smoke:story-lab-ui`

Required opt-in live validation when credentials are available:

- `RUN_REAL_GROK_MULTI_AGENT_SMOKE=1 XAI_API_KEY=... npm run smoke:grok-multi-agent`
- `STORY_LAB_SMOKE_URL=https://fairytaleswith-spice.vercel.app STORY_LAB_SMOKE_LIVE=1 npm run smoke:story-lab-ui` after merge/deploy

Required visual validation:

- desktop screenshot of Story Lab after mock generation;
- mobile screenshot of Story Lab after mock generation;
- confirm no text overlap, no blank asset, no inaccessible hidden primary controls, and no debug panel by default.

Acceptance criteria:

- active Story Lab generation and continuation use the centralized xAI model config;
- default model is `grok-4.20-multi-agent`;
- no OpenAI runtime dependency or API key is added;
- public UI is visibly more polished, domain-specific, and user-friendly;
- generated stories can be saved and reopened in the same browser;
- continuity panel uses AI extraction when available and visibly labels fallback extraction;
- local mocked browser smoke still passes;
- production live Story Lab smoke passes after merge;
- reports/docs state remaining audit/Sonar/audio/DigitalOcean caveats honestly.

## Idempotence and Recovery

- Re-running model config changes should not duplicate model constants.
- Re-running UI work should preserve existing test IDs unless the smoke script is updated together with markup.
- If xAI Responses API payloads fail, capture the exact status/body in the changelog and stop before changing user-facing code.
- If live model smoke fails because credentials are missing, skip and document that live validation is pending; do not fake it with mock output.
- If generated visual assets are too large, resize/compress before commit.
- If localStorage quota is exceeded, the app must keep the current in-memory story and show a user-readable warning.
- If PR checks fail on unrelated historical `node_modules` diffs, reuse the existing preflight exclusion approach rather than committing generated dependency churn.

## Artifacts and Notes

Files expected to change:

- `AGENTS.md`
- `GROK_MULTIAGENT_STORY_LAB_POLISH_EXEC_PLAN.md`
- `package.json`
- `api/_lib/config/xaiConfig.ts`
- `api/_lib/services/xaiTextClient.ts`
- `api/_lib/services/storyService.ts`
- `api/_lib/story-lab/storyLabEngine.ts`
- `api/_lib/story-lab/continuityExtractor.ts`
- `api/_lib/story-lab/contracts.ts`
- `api/story-lab/evaluate.ts`
- `story-generator/src/app/app.ts`
- `story-generator/src/app/app.html`
- `story-generator/src/app/app.css`
- `story-generator/src/app/app.spec.ts`
- `story-generator/src/app/contracts.ts`
- `story-generator/src/app/story-workspace-storage.service.ts`
- `story-generator/src/app/story.service.ts` only if contract shapes change
- `story-generator/public/story-lab-atmosphere.webp` or `.png`
- `scripts/recovery/story-lab-browser-smoke.mjs`
- `tests/grok-multi-agent-smoke.test.ts`
- `tests/story-quality-evals.test.ts`
- `tests/story-lab-real-engine.test.ts`
- `tests/story-lab-state.test.ts`
- `tests/verify-ai-fixes.test.ts`
- `tests/verify-api-keys.ts`
- `STORY_LAB_SHIPPING_READINESS_REPORT.md` or a successor report if shipping evidence changes
- `PR70_RECOVERY_CHANGELOG.md`
- `LESSONS_LEARNED.md` if new durable lessons appear

Files not to touch unless a later step proves it is necessary:

- DigitalOcean files or docs;
- active audio routes/services;
- unrelated `pocketfm-contest-forge/`;
- unrelated untracked `SPARK_TRIAL_TASKS.md`, `STORY_QUALITY_EVALS_PLAN.md`, and `tests/grok-smoke.test.ts`.

## Interfaces and Dependencies

Environment variables:

- `XAI_API_KEY`: required for live Grok generation.
- `XAI_STORY_MODEL`: optional override, default `grok-4.20-multi-agent`.
- `XAI_STORY_REASONING_EFFORT`: optional override, one of `low`, `medium`, `high`, `xhigh`, default `medium`.
- `STORY_LAB_FORCE_MOCK`: keep existing behavior for local/mock validation.

New dependency candidates:

- `lucide-angular` for icons in Angular UI. Add only after checking Angular 20 compatibility and bundle impact.

Do not add:

- OpenAI SDK;
- OpenAI API key env vars;
- server-side database dependency unless the plan is revised for cloud persistence;
- audio provider SDKs;
- DigitalOcean-specific packages.

## Hostile Review Built Into Execution

After each major phase, append a short self-review to `PR70_RECOVERY_CHANGELOG.md`:

- What did this phase make better?
- What got riskier?
- What would a senior dev who hates this object to?
- What did validation actually prove?
- What is only assumed?
- What should be fixed before the next phase?

Specific hostile objections to watch:

- "Multi-agent is slower and the UI does not tell users why generation takes longer."
- "The redesign looks fancy but lost the clean smoke-test path."
- "The model migration changed prompt behavior without story quality evidence."
- "The app says saved, but it is only local browser storage."
- "The continuity extractor is AI-powered, but failures are hidden."
- "OpenAI docs were used as a style excuse instead of building a coherent product."

Fix these immediately if they appear.
