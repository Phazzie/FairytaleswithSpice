# Story Lab Demo Shipping ExecPlan

Created: 2026-05-28 03:12 UTC

## Purpose / Big Picture

Ship the current Story Lab direction far enough that the app can be shown to a non-technical viewer without apologizing for obvious breakage. The target is not the full long-term product. The target is:

- PR #90 merged into `main`;
- Vercel deployment green;
- real Story Lab genesis and continuation verified against the deployed app with `XAI_API_KEY` configured;
- only demo-blocking issues fixed;
- continuity extraction, OpenAI/provider abstraction, audio, and broad visual redesign deferred to later branches.

The user-visible success condition is: a person can open the deployed app, create a Story Lab story, continue it once, and see coherent chapter output without hitting mock-only behavior, deployment errors, or confusing failure states.

## Progress

- [x] Re-check PR #90 status. PR #90 was green, mergeable, and open before merge.
- [x] Merge PR #90 without adding unrelated files to it. Merged as `0af83b397396ecca9707d5151252df18a1247a4b`.
- [x] Sync local `main` after merge.
- [x] Create a fresh shipping-readiness branch from updated `main`: `demo/story-lab-shipping-readiness`.
- [x] Commit this ExecPlan and link it from `AGENTS.md`: `bdbeb1e`.
- [x] Identify the deployed Vercel URL to test: `https://fairytaleswith-spice.vercel.app`.
- [x] Verify `/api/health`. It returned `success: true`, `data.environment: "production"`, and `data.services.grok: "configured"`.
- [x] Verify Story Lab genesis returns `success: true` and `telemetry.engine: "grok"` on deployed Vercel. Example run generated `Reefbound Vow` as `story_ea1bcf73-cee6-444a-ae0b-22187557c6be`.
- [x] Verify Story Lab continuation returns appended chapters on deployed Vercel. Example run appended chapter `2`, `The Claimed Voice`, with `telemetry.engine: "grok"`.
- [x] Fix only demo-blocking issues found by the deployed smoke tests. No runtime demo blockers were found.
- [x] Run local and remote validation after documentation/report updates. `git diff --check`, `npm run test:story-lab-real-engine`, `scripts/recovery/preflight.sh --quick --skip-status`, `npm run test:all`, and `npx -p node@20 -c "node -v && cd story-generator && npm run build"` passed.
- [x] Update `PR70_RECOVERY_CHANGELOG.md` and `LESSONS_LEARNED.md`.
- [x] Produce a concise demo-readiness report: `STORY_LAB_DEMO_READINESS_REPORT.md`.

## Surprises & Discoveries

Record surprises here as they happen. Examples to capture:

- Vercel deployment protection blocks unauthenticated smoke tests.
- Production lacks `XAI_API_KEY`, so Story Lab falls back to `custom` mock telemetry.
- The current Grok model name is rejected by xAI.
- Generation succeeds locally but times out or fails on Vercel.
- Continuation loses story state or returns a partial batch.

Actual discoveries:

- `STORY_LAB_DEMO_READINESS_REPORT.md` is the canonical final evidence artifact for demo readiness. This ExecPlan and the recovery changelog intentionally summarize that evidence to avoid future drift.
- Production `https://fairytaleswith-spice.vercel.app` is public and reachable, while branch preview URLs such as `fairytaleswith-spice-git-main-phazzies-projects.vercel.app` and the PR preview are protected by Vercel authentication.
- Production health confirms `XAI_API_KEY` is configured server-side.
- Real production Story Lab genesis and continuation both returned `telemetry.engine: "grok"`, proving they did not use mock fallback.
- The frontend shell returns HTTP 200 and serves the Angular app root and bundles from production.
- SonarCloud's main-branch quality gate is red after PR #90 merged due to broader recovery-era hotspots and duplicated new-code density. The PR #90 checks passed, Recovery CI passed, and Vercel deployed. This is not a runtime demo blocker, but it should become a hardening branch before calling the repository clean.

## Decision Log

- Decision: Merge PR #90 before starting new demo-readiness changes.
  Rationale: PR #90 is already green, mergeable, and scoped to wiring Story Lab to the real engine. Adding more work to it repeats the oversized-PR failure mode.

- Decision: Keep this work Vercel-first.
  Rationale: Vercel is the active deployment target in `AGENTS.md`; DigitalOcean remains historical.

- Decision: Use the existing Grok provider for the immediate demo.
  Rationale: The current service is already built around `XAI_API_KEY`. OpenAI support is valuable, but adding provider abstraction before the demo adds scope and test surface.

- Decision: Treat `telemetry.engine: "grok"` as deployed real-engine evidence and `telemetry.engine: "custom"` as mock fallback evidence.
  Rationale: PR #90 made that distinction explicit.

- Decision: Do not implement AI continuity extraction in this branch.
  Rationale: The current branch should prove real generation and continuation first. Hybrid AI continuity extraction is the next serious architecture branch.

- Decision: Do not fix the main-branch Sonar quality gate inside this demo-readiness branch unless it blocks deployment.
  Rationale: The deployed app works and the Sonar failure spans many files and categories, including old Docker files, tests, author style data, trope data, and recovery-era duplication. Folding that into demo readiness would turn this branch into another broad cleanup branch.

## Outcomes & Retrospective

Fill this in at completion:

- What shipped: PR #90 landed on `main`; production Vercel serves the app; production Story Lab genesis and continuation use the Grok path.
- What did not ship: OpenAI/provider abstraction, AI continuity extraction, audio, durable story storage, broad Sonar hardening, and visual redesign.
- What was surprising: Main's production deployment is public and smoke-testable while branch previews are protected. Sonar's PR checks passed, but the main branch quality gate still failed on broader new-code criteria.
- What should have been anticipated: Main quality gates can behave differently from PR checks; deployed runtime proof and repository hygiene proof are separate outcomes.
- Whether the app is girlfriend-demo ready: API and production runtime are demo-ready for a simple Story Lab generation/continuation flow. A manual browser click-through is still recommended immediately before showing it.
- Remaining risks: Story quality is live-model dependent; UI was checked by HTTP shell load rather than automated browser interaction; continuity state is still heuristic; main Sonar quality gate is red.

## Context and Orientation

Important repository facts:

- Frontend app: `story-generator/`, Angular 20 with SSR.
- Vercel functions: `api/`.
- Canonical shared API code: `api/_lib/`.
- Frontend seam contracts: `story-generator/src/app/contracts.ts`.
- Backend story contracts: `api/_lib/types/contracts.ts`.
- Current AI provider: xAI/Grok through `XAI_API_KEY`.
- Story Lab real-engine orchestration from PR #90: `api/_lib/story-lab/storyLabEngine.ts`.
- Recovery validation script: `scripts/recovery/preflight.sh`.
- Node 20 should be used for Angular production builds.

Known local noise to ignore unless the user explicitly includes it:

- `SPARK_TRIAL_TASKS.md`
- `STORY_QUALITY_EVALS_PLAN.md`
- `pocketfm-contest-forge/`
- `tests/grok-smoke.test.ts`

## Hostile Review and Revisions

### Initial Plan

Merge PR #90, test the Vercel deployment, fix anything that blocks a demo, and report readiness.

### Hostile Senior Review

This plan is too hand-wavy. "Test Vercel" could mean clicking around until optimism wins. It does not define what real generation evidence looks like, how to avoid spending a lot of provider tokens, what to do if Vercel is protected, how to prevent this from becoming an OpenAI migration, or how to keep the already-green PR #90 from absorbing unrelated work. It also ignores continuity extraction by name, which creates room for someone to accidentally start it here.

### Revised Plan After Critique

1. Do not add shipping-readiness work to PR #90. Merge #90 first, then create a new branch.
2. Use one low-spice, one-chapter deployed genesis smoke test and one continuation smoke test.
3. Treat `telemetry.engine: "grok"` as the proof of real provider path. Treat `custom` as proof that the deployed app is still in mock fallback.
4. If Vercel blocks unauthenticated curl, use a Vercel share/bypass mechanism or document that authenticated smoke is blocked. Do not mark the app demo-ready from a protected 401.
5. Fix only these demo blockers in this branch:
   - missing/incorrect Vercel env var behavior,
   - invalid provider model name,
   - deployed API route failure,
   - Story Lab genesis failure,
   - Story Lab continuation failure,
   - frontend display/interaction issue that prevents a simple demo.
6. Explicitly defer:
   - OpenAI/provider abstraction,
   - hybrid AI continuity extraction,
   - audio,
   - export polish,
   - broad visual redesign.

### Accepted Critiques

- "Real generation" must be evidenced by deployed API output, not local tests.
- Provider-cost exposure must stay small: one 600-word genesis and one 1-chapter continuation.
- A protected deployment is not a failed app, but it is not a completed smoke test either.
- Continuity extraction is a future architecture step, not demo-readiness scope.

## Plan of Work

### Phase 1 - Land the Real-Engine Baseline

1. Confirm PR #90 is green:
   - `gh pr checks 90`
   - `gh pr view 90 --json mergeable,state,headRefOid,url`
2. Merge PR #90:
   - `gh pr merge 90 --merge`
3. Sync local main:
   - `git checkout main`
   - `git pull --ff-only origin main`
4. Create the follow-up branch:
   - `git switch -c demo/story-lab-shipping-readiness`

Acceptance:

- PR #90 is merged.
- Local `main` includes the PR #90 commit.
- The new branch starts from updated `main`.

### Phase 2 - Commit the Shipping Plan

1. Add `.agent/PLANS.md` if missing.
2. Add this plan as `STORY_LAB_DEMO_SHIPPING_EXEC_PLAN.md`.
3. Update `AGENTS.md` to point future agents at this plan for demo-readiness work.
4. Commit only plan/guidance files.

Acceptance:

- A future agent can read `AGENTS.md` and find this plan.
- The plan commit is not part of PR #90.

### Phase 3 - Deployed Smoke Tests

Use the active Vercel deployment URL from PR #90 checks or the production deployment after `main` deploys.

Health:

```bash
curl -fsS "$APP_URL/api/health" \
  | jq '{success, environment: .data.environment, grok: .data.services.grok}'
```

Genesis smoke:

```bash
curl -fsS "$APP_URL/api/story-lab/stories" \
  -H 'content-type: application/json' \
  --data-binary @- <<'JSON' | tee /tmp/story-lab-genesis.json | jq '{success, engine: .data.telemetry.engine, storyId: .data.summary.storyId, chapters: (.data.batch.chapters | length), title: .data.summary.title, error}'
{
  "creature": "siren",
  "themes": [
    {
      "id": "forbidden_love",
      "label": "Forbidden Love",
      "description": "A relationship that breaks supernatural law."
    }
  ],
  "logline": "A siren diplomat risks exile to save the forbidden lover whose testimony could end a cruel reef court.",
  "spicyLevel": 1,
  "tone": "dark_romance",
  "desiredWordBudget": 600,
  "chapterBatchSize": 1,
  "protagonistName": "Mira",
  "antagonistName": "Lord Brine",
  "worldDetails": "A moonlit reef court where vow-binding songs carry the force of law.",
  "narrativeDirectives": "Keep the story romantic, tense, and safe for a quick public demo."
}
JSON
```

Continuation smoke:

Build the continuation request from `/tmp/story-lab-genesis.json`, then POST it to the matching story route:

```bash
story_id="$(jq -r '.data.summary.storyId' /tmp/story-lab-genesis.json)"

jq '{
  storyId: .data.summary.storyId,
  chapterBatchSize: 1,
  storyState: .data.state,
  previouslyGeneratedChapters: .data.batch.chapters,
  existingSummary: .data.summary,
  continuationBrief: "Continue the immediate romantic and political stakes from the last chapter."
}' /tmp/story-lab-genesis.json > /tmp/story-lab-continuation-request.json

curl -fsS "$APP_URL/api/story-lab/stories/$story_id/continue" \
  -H 'content-type: application/json' \
  --data-binary @/tmp/story-lab-continuation-request.json \
  | tee /tmp/story-lab-continuation.json \
  | jq '{success, engine: .data.telemetry.engine, appendedChapterNumbers: .data.appendedChapterNumbers, chapters: (.data.batch.chapters | length), title: .data.summary.title, error}'
```

The continuation response must have:

- `success: true`;
- at least one chapter;
- `appendedChapterNumbers` including the next chapter number;
- `telemetry.engine: "grok"`.

Acceptance:

- Health passes.
- Genesis passes against Vercel with `engine: "grok"`.
- Continuation passes against Vercel with `engine: "grok"`.
- If `engine: "custom"`, stop and fix or document the missing provider configuration; do not call the app demo-ready.

### Phase 4 - Fix Only Demo Blockers

Allowed fixes:

- Vercel env/config fix needed for `XAI_API_KEY` usage.
- Current Grok model name update if live provider rejects it.
- Route/CORS/API response bug exposed by deployed smoke.
- Continuation request/response shape bug.
- Frontend bug that prevents visible generation/continuation.
- Clear user-facing error handling if provider failure is unavoidable.

Disallowed in this branch:

- OpenAI provider abstraction.
- AI continuity extraction.
- Audio.
- Full visual redesign.
- New persistence system.
- Broad old-PR mining.

### Phase 5 - Validation and Report

Run:

```bash
git diff --check
npm run test:all
scripts/recovery/preflight.sh --quick --skip-status
cd story-generator && npx -p node@20 -c "node -v && npm run build"
```

Update:

- `PR70_RECOVERY_CHANGELOG.md`
- `LESSONS_LEARNED.md` if a durable lesson appears
- this ExecPlan `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective`

Open a PR from `demo/story-lab-shipping-readiness` if code/docs changed after #90.

## Concrete Steps

1. Re-check PR #90.
2. Merge PR #90.
3. Sync `main`.
4. Create `demo/story-lab-shipping-readiness`.
5. Commit `.agent/PLANS.md`, this plan, and the `AGENTS.md` pointer.
6. Identify deployed Vercel URL.
7. Run health, genesis, and continuation smoke tests.
8. If smoke passes, update docs/report and stop.
9. If smoke fails because of a scoped demo blocker, fix it and rerun validation.
10. If smoke fails because credentials or protected deployment access are unavailable, record the exact blocker and stop.

## Validation and Acceptance

Minimum acceptance before telling the user the app is demo-ready:

- PR #90 merged.
- Vercel deployment green.
- Deployed health endpoint passes.
- Deployed Story Lab genesis returns real provider telemetry.
- Deployed Story Lab continuation returns real provider telemetry.
- Local validation passes after any fixes.
- Demo-readiness report names any remaining caveats.

## Idempotence and Recovery

- If PR #90 is already merged, skip merge and continue from updated `main`.
- If branch `demo/story-lab-shipping-readiness` exists, inspect it with `git status --short --branch` before reusing it.
- If Vercel deploy is still pending, wait for completion before smoke tests.
- If Vercel is protected, do not treat a `401` as app failure. Obtain an authenticated share/bypass path or stop with a precise blocker.
- If provider generation takes too long, test with one 600-word chapter only; do not increase scope.
- If live provider returns model-not-found, update the model constant in one canonical place if the correct current model can be verified from official provider docs or current project config.

## Artifacts and Notes

Expected artifacts:

- `.agent/PLANS.md`
- `STORY_LAB_DEMO_SHIPPING_EXEC_PLAN.md`
- `AGENTS.md` pointer update
- `PR70_RECOVERY_CHANGELOG.md` entry
- `/tmp/story-lab-genesis.json` during smoke testing only
- final PR or report comment with deployed smoke results

## Interfaces and Dependencies

- `XAI_API_KEY` must be present in Vercel for real generation.
- `FRONTEND_URL` or CORS policy must allow the deployed frontend origin.
- xAI/Grok model name in `api/_lib/services/storyService.ts` must be valid.
- Vercel function count must stay within the project limit.
- Story Lab routes:
  - `POST /api/story-lab/stories`
  - `POST /api/story-lab/stories/{storyId}/continue`
  - `GET /api/story-lab/stream/genesis`

## Spark Subagent Tooling Note

A programmatic Spark subagent skill would be useful if constrained to bounded, read-mostly or low-risk tasks:

- independently inspect a PR for contradictions;
- run a smoke-test checklist and return raw evidence;
- compare docs against implementation;
- mine review comments into a checklist;
- produce a second-opinion risk report.

Do not give Spark direct authority to merge, force-push, edit secrets, or close PRs until it has a stronger track record. The ideal interface is: parent agent provides a strict task file, Spark writes an evidence file, parent agent reviews and decides.
