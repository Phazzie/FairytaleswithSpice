# Charmed Story Lab MVP ExecPlan

Created: 2026-05-29 08:28 EDT

## Purpose / Big Picture

Build the next MVP slice of Fairytales with Spice: a normal user should open the Vercel app, pick a beautiful visual skin, choose friendly story ingredients, set an explicit spice level, generate a Grok-backed first chapter, see useful progress while waiting, continue the story with a chosen direction, save locally, and copy/download the result. Production must not silently replace failed AI with fake prose. If the AI cannot write, the app must say why in user-readable language.

The goal is not accounts, cloud sync, audio, provider switching, DigitalOcean, or exposing Proving Grounds to normal users. Proving Grounds remains a tool for us.

## Progress

- [x] User approved the revised product target: surprisingly good spicy first chapter, selectable generated UI styles, more user configuration without developer knobs, honest AI errors, progress meter, and directional continuation.
- [x] Created feature branch `feature/charmed-mvp-story-lab`.
- [x] Read `AGENTS.md`, `.agent/PLANS.md`, recovery changelog, lessons, and relevant Story Lab files.
- [x] Created this ExecPlan.
- [x] Link this plan from `AGENTS.md`.
- [x] Add domain options and contracts for more creatures/story ingredients.
- [x] Strengthen spice-level prompt rules.
- [x] Make production missing-key behavior fail closed instead of mock prose.
- [x] Add user-readable AI error classification.
- [x] Add three selectable visual skins based on the generated board.
- [x] Redesign Story Lab copy/layout around a user journey, not a developer workbench.
- [x] Add an honest progress meter.
- [x] Add directional continuation controls.
- [x] Add copy and simple HTML download export.
- [x] Run hostile review against this plan and current diff before final execution.
- [x] Update Angular unit and browser smoke coverage for the Charmed MVP behavior.
- [x] Run validation and fix any failures.
- [x] Update this plan, `PR70_RECOVERY_CHANGELOG.md`, and `LESSONS_LEARNED.md` with final evidence.
- [x] Report what remains after this branch is validated.

## Surprises & Discoveries

- The current UI already has local story saving and suggested continuation prompts, but the language and layout still feel like internal tooling.
- `StoryService.streamStoryGeneration()` exists, but this MVP will use an honest staged progress meter around the existing reliable request path instead of converting the generation flow to streaming in the same branch.
- Current frontend/backend creature contracts allow only `vampire`, `werewolf`, `fairy`, `siren`, and `djinn`. Expanding creatures requires updating both contract layers and validation.
- The backend prompt already has spice levels, but the labels are too terse for product trust. This plan will make those rules more explicit.
- Resumed state on 2026-06-03: implementation edits exist for the Charmed MVP surface, but `app.spec.ts` and `scripts/recovery/story-lab-browser-smoke.mjs` still need to prove the new controls and export paths. Treat validation as unproven until the commands in this plan pass.
- Hostile review on 2026-06-03 found stale smoke selectors, missing unit coverage, missing production continuation fail-closed proof, style-routing drift, and undocumented Proving Grounds alignment. The first three were addressed in tests/smoke; style routing and Proving Grounds were documented as intentional.

## Decision Log

- Decision: The three generated designs are visual skins only.
  Rationale: Changing the visual skin should not secretly change the story. Story choices remain separate and explicit.
- Decision: Do not add accounts in this MVP.
  Rationale: Accounts add auth, database, privacy, recovery, and deployment scope. Keep local story records clean enough to sync later.
- Decision: Add Copy Story and Download HTML now; defer server email and true PDF generation.
  Rationale: Email and PDF generation require extra backend/storage/security decisions. Copy/download gives immediate share value without cloud state.
- Decision: Hide Proving Grounds from the normal first screen.
  Rationale: It is useful for us, but it makes the public app feel like a developer console.
- Decision: Keep low-level knobs out of the UI.
  Rationale: Model name, reasoning effort, temperature, top-p, fallback model, provider settings, and raw telemetry are developer controls.
- Decision: Progress must be honest.
  Rationale: Without true streaming milestones, use staged status and elapsed time rather than fake exact percentages.
- Decision: Use closer existing style banks for `dragon` and `demon` instead of routing every new creature through fairy.
  Rationale: Until dedicated style banks exist, `dragon` fits the primal/protective werewolf bank better and `demon` fits the dangerous vampire bank better. `witch`, `angel`, and `mermaid` still use fairy-adjacent styles.
- Decision: Keep Proving Grounds aligned with the expanded creature contract without promoting it into the public MVP surface.
  Rationale: Contract drift would break internal prompt tooling and type safety, but the normal first screen still hides Proving Grounds unless debug mode is requested.

## Outcomes & Retrospective

Fill this in as work proceeds:

- What became better for the user: Story Lab now opens as a public story-making experience with visual skins, readable creature/theme/spice controls, honest progress, friendly AI errors, directed continuation, and local copy/download.
- What became better technically: frontend/backend creature contracts are aligned; production Story Lab generation and continuation fail closed when `XAI_API_KEY` is missing; smoke now covers the deployed artifact flow instead of stale form controls.
- What was deferred: accounts, cloud sync, durable server persistence, true streaming/job progress, audio, server PDF/email export, dedicated style banks for every new creature, and production live-provider smoke for this branch.
- What hostile review would still object to: only non-blocking future work remains. The reviewer noted simple HTML export loses paragraph structure and object URLs are revoked immediately after click; mocked browser smoke now proves the current browser path works.
- What validation proved: `git diff --check`, Angular app/spec typechecks, `npm run test:story-lab-real-engine`, mocked build-backed `npm run smoke:story-lab-ui`, and `scripts/recovery/preflight.sh --quick --skip-status` all passed on 2026-06-03.

## Context and Orientation

Repository root: this repository checkout.

Current branch for this work: `feature/charmed-mvp-story-lab`.

Deployment target: Vercel. Do not reintroduce DigitalOcean.

Main frontend files:

- `story-generator/src/app/app.ts`: Story Lab component state and actions.
- `story-generator/src/app/app.html`: public Story Lab template.
- `story-generator/src/app/app.css`: public Story Lab styling.
- `story-generator/src/app/contracts.ts`: frontend Story Lab contracts.
- `story-generator/src/app/form-validation.service.ts`: frontend blueprint validation.
- `story-generator/src/app/story.service.ts`: Angular API client.
- `story-generator/src/app/story-workspace-storage.service.ts`: browser-local story persistence.

Main backend files:

- `api/_lib/types/contracts.ts`: canonical story-generation service contracts.
- `api/_lib/story-lab/contracts.ts`: Story Lab API contracts.
- `api/_lib/story-lab/storyLabEngine.ts`: Story Lab orchestration over `StoryService`.
- `api/_lib/services/storyService.ts`: canonical Grok prose engine.
- `api/_lib/config/authorStyles.ts`: creature style banks.
- `api/story-lab/stories.ts`: Story Lab genesis route.
- `api/story-lab/stories/[storyId]/continue.ts`: Story Lab continuation route.

Known state:

- Production generation currently defaults to `grok-4.3`.
- Local browser smoke uses mock API responses by default.
- Continuity extraction can degrade to heuristic/mixed and must stay visible, not overclaimed.
- `STORY_LAB_CHARMED_MVP_EXEC_PLAN.md` is part of this branch. Existing unrelated untracked files remain untouched unless explicitly included later: `SPARK_TRIAL_TASKS.md`, `STORY_QUALITY_EVALS_PLAN.md`, and `tests/grok-smoke.test.ts`.

## Plan of Work

### Phase 1 - Contracts and Story Options

Expand user-friendly story controls without exposing developer knobs.

Add:

- more creature choices in frontend and backend contracts;
- more theme/story element choices in the UI;
- a small continuation-direction model in the UI;
- explicit spice labels and descriptions.

The first expanded creature set is:

- `vampire`
- `werewolf`
- `fairy`
- `siren`
- `djinn`
- `witch`
- `dragon`
- `demon`
- `angel`
- `mermaid`

For backend author styles, route the new creatures through the closest existing style bank until dedicated style banks are created:

- `witch`, `angel`, and `mermaid` use the fairy-adjacent bank.
- `dragon` uses the werewolf-adjacent bank.
- `demon` uses the vampire-adjacent bank.

For Proving Grounds, update creature option/display/style helpers only so the internal tool stays type-safe with the shared creature union. Do not make Proving Grounds a public landing route.

### Phase 2 - Grok-Only Production Failure Policy

Preserve test/mock helpers, but stop production-capable routes from silently returning mock prose when `XAI_API_KEY` is missing.

Expected behavior:

- When `NODE_ENV === 'production'` and `XAI_API_KEY` is missing, Story Lab genesis/continuation return `{ success: false, error: { code: 'AI_UNAVAILABLE', message: ... } }`.
- When Grok times out or errors, the UI shows a user-readable reason.
- Tests/local smoke can still mock through the smoke harness or explicit `STORY_LAB_FORCE_MOCK`.

### Phase 3 - Charmed User Interface

Replace developer-facing copy and four-column workbench feel with a user-first Story Lab:

- top visual skin selector with three choices:
  - Enchanted Bookshop
  - Moonlit Conservatory
  - Cozy Witchy Writing Desk
- friendly first-step card: "Tell us your story idea";
- story ingredients as readable chips/cards;
- spice picker with labels;
- progress panel while generation is running;
- story reader as the center of the page;
- saved stories and behind-the-scenes continuity moved lower or visually softened.

The skin choice is saved in browser local storage separately from story content.

### Phase 4 - Continuation Direction

After a story exists, "Continue Story" should ask what kind of next chapter the user wants:

- Deepen the romance
- Raise the danger
- Reveal a secret
- Add a twist
- Slow down and linger
- Custom direction

Clicking a direction calls the existing continuation endpoint with a friendly `continuationBrief`.

### Phase 5 - Export / Share

Add simple local sharing:

- Copy Story copies title and selected chapter text to the clipboard.
- Download Story saves a simple `.html` file built in the browser.

Do not add server email, server PDF generation, or auth in this branch.

### Phase 6 - Validation and Docs

Update tests/smoke expectations for:

- skin selector;
- expanded creatures/themes;
- progress UI appears during generation;
- continuation direction is usable;
- production missing-key behavior does not silently mock.

Run focused validation before broader build validation.

### Phase 7 - Hostile Review and Finish Pass

Before declaring this branch ready, send a reviewer the plan, the current `git diff --stat`, and the acceptance criteria. Ask the reviewer to assume the implementation is wrong until proven otherwise and to identify missing tests, hidden production fallback risks, broken user flows, stale plan claims, and any scope that was broadened past this MVP.

Act on Critical and Important findings before running the final validation suite. If a finding is wrong, record why in this plan with the current evidence. Minor polish can remain only if it does not block the acceptance criteria.

## Concrete Steps

1. Update `AGENTS.md` to point to this plan as the active Charmed MVP plan.
2. Update `story-generator/src/app/contracts.ts` and `api/_lib/types/contracts.ts` creature unions.
3. Update `api/_lib/config/authorStyles.ts` mapping for new creatures.
4. Update `api/_lib/services/storyService.ts` validation, display names, and spice prompt wording.
5. Update `api/_lib/story-lab/storyLabEngine.ts` so production missing-key returns `AI_UNAVAILABLE` instead of mock data.
6. Update `story-generator/src/app/form-validation.service.ts` valid creature set and max theme count if needed.
7. Update `story-generator/src/app/app.ts` with:
   - skin model and persistence,
   - expanded creature/theme option arrays,
   - spice labels,
   - progress state,
   - continuation directions,
   - copy/download methods,
   - user-readable error formatter.
8. Rewrite `story-generator/src/app/app.html` around the user journey and existing test IDs.
9. Rewrite `story-generator/src/app/app.css` to implement the three skins and responsive modern layout.
10. Update `story-generator/src/app/app.spec.ts` and focused service tests.
11. Update `scripts/recovery/story-lab-browser-smoke.mjs` only if selectors/copy change break smoke.
12. Update `PR70_RECOVERY_CHANGELOG.md` and `LESSONS_LEARNED.md`.
13. Run hostile review:
    - provide `STORY_LAB_CHARMED_MVP_EXEC_PLAN.md`;
    - provide `git status --short --branch`;
    - provide `git diff --stat`;
    - ask for Critical, Important, and Minor issues.
14. Apply any Critical and Important review findings.
15. Run validation:
    - `git diff --check`
    - `cd story-generator && ../node_modules/.bin/tsc -p tsconfig.app.json --noEmit`
    - `cd story-generator && ../node_modules/.bin/tsc -p tsconfig.spec.json --noEmit`
    - `npm run test:story-lab-real-engine`
    - `npm run smoke:story-lab-ui`
    - `scripts/recovery/preflight.sh --quick --skip-status`
16. Final state:
    - leave only intentional Charmed MVP changes in `git status`;
    - leave no unknown validation failures undocumented;
    - summarize what remains after this branch, separating MVP blockers from future product work.

## Validation and Acceptance

Acceptance criteria:

- A user can select each of the three visual skins without changing story inputs.
- A user can choose from expanded creature and story element options.
- Spice level shows clear explicitness labels.
- Generate shows a visible progress state before the response returns.
- If generation fails, the UI gives a specific, friendly AI reason when available.
- Production missing-key behavior does not produce mock prose.
- Continuation can be guided by a direction chip or custom text.
- A generated story can be copied and downloaded locally.
- Existing Story Lab generate/continue smoke still passes.
- Charmed-specific browser smoke verifies skin selection, expanded creature selection, progress visibility, continuation direction, copy, and local HTML download in mocked mode.
- Angular unit coverage verifies skin persistence, friendly AI error formatting, continuation direction request wiring, and export helpers.

Expected command outcomes:

- `git diff --check`: no output, exit 0.
- Angular app/spec typechecks: exit 0.
- `npm run test:story-lab-real-engine`: exit 0 with real-engine assertions passing.
- `npm run smoke:story-lab-ui`: exit 0 in local mocked smoke.
- `scripts/recovery/preflight.sh --quick --skip-status`: exit 0.

Validation evidence from 2026-06-03:

- `git diff --check`: passed.
- `cd story-generator && ../node_modules/.bin/tsc -p tsconfig.app.json --noEmit`: passed.
- `cd story-generator && ../node_modules/.bin/tsc -p tsconfig.spec.json --noEmit`: passed.
- `npm run test:story-lab-real-engine`: passed, including production fail-closed genesis and continuation assertions.
- `npm run smoke:story-lab-ui`: passed in mocked mode after a fresh Angular build; app component CSS budget warning was eliminated. The only remaining build warning was the existing stale `baseline-browser-mapping` freshness notice.
- `scripts/recovery/preflight.sh --quick --skip-status`: passed.

## Idempotence and Recovery

This plan is safe to resume:

- If template/CSS work is partial, run Angular typecheck first to identify broken bindings.
- If backend contract work is partial, run `npm run test:story-lab-real-engine` before UI work.
- If smoke selectors fail, prefer preserving existing `data-testid` values over changing the smoke harness.
- If validation fails because of local browser/Karma environment, record the exact failure in the changelog and run the remaining non-browser checks.
- Do not remove mock data files; restrict production routing behavior instead.
- Do not commit unrelated untracked files.

Stop and ask the user only if:

- account/cloud persistence becomes required for MVP;
- true PDF/email becomes required in this branch;
- Grok live API behavior requires a provider migration;
- the UI redesign cannot pass Angular typecheck without a broader component split.

## Artifacts and Notes

Generated design board copied locally to:

- `fairytales-ui-design-board.png` on the implementer's desktop.

Original generated image remains in the implementer's Codex generated image cache:

- `019e6126-bf1f-72e3-84a2-baec7579b999/ig_06c1111e7c485efe016a197f8722688193adff6110601edc74.png`

## Interfaces and Dependencies

No new npm dependency is planned.

The work depends on:

- Angular standalone components and signals.
- Browser `localStorage` for skin/story persistence.
- Browser Clipboard API for copy.
- Browser Blob/object URL for simple HTML download.
- Existing Vercel Story Lab API routes.
- Existing xAI/Grok `XAI_API_KEY` server-side environment variable.
