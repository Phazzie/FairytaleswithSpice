# Story Lab Narrative Dials UI ExecPlan

## Goal

Give Story Lab one shared continuation-dial system and ship the next three compact controls: Chapter Payload, Pacing, and Ending Bet. Keep Villain Pressure as the first dial in that system.

## Plan v1

- Generalize the existing Villain Pressure option data into a shared narrative-dial model.
- Render Villain Pressure, Chapter Payload, Pacing, and Ending Bet in the existing continuation panel.
- Store clean internal option IDs while sending only prose anchors into the continuation brief.
- Append selected dial anchors to UI-driven continuation requests:
  - continuation direction buttons;
  - custom continuation brief;
  - Director's Room accepted notes.
- Preserve the lower-level `continueSaga(brief)` seam so direct service callers are not forced through UI-generated dial text.
- Add focused Angular tests before production code.
- Run focused specs, TypeScript checks, function-count guard, whitespace check, and mocked Story Lab UI smoke.

## Hostile Critique

- Four visible dials can turn the continuation panel into a cockpit instead of a story-steering surface.
- A generic model can become over-abstracted if it only saves a few lines of code.
- Prompt anchors can become noisy if every dial emits long instructions.
- Replacing Villain Pressure markup can break reviewed selectors and existing smoke assumptions.
- Any CSS growth is risky because the app has a hard smoke budget for `app.css`.

## Revised Plan

- Keep the shared model local to `app.ts` for now. Do not create new contracts, routes, or persistence.
- Use compact, deterministic data:
  - `NarrativeDial`
  - `NarrativeDialOption`
  - selected option IDs in one signal map.
- Render all dials with the already-budgeted `heat-option-grid` and `heat-option` classes.
- Keep one-sentence prose anchors. The AI receives story behavior, not numeric levels.
- Preserve compatibility test IDs for Villain Pressure and add generic test IDs for all dials.
- Prove:
  - all four dials render after a story exists;
  - selecting Chapter Payload, Pacing, and Ending Bet changes the active selections;
  - UI-driven continuation requests include the selected prose anchors;
  - `continueSaga(brief)` remains unchanged and does not append UI-only dial anchors.

## Validation Checklist

- [x] RED focused Angular spec fails for missing narrative dials.
- [x] GREEN focused Angular spec passes.
- [x] `git diff --check`
- [x] `npx -p node@20 -c "node story-generator/node_modules/typescript/bin/tsc -p story-generator/tsconfig.app.json --noEmit"`
- [x] `npx -p node@20 -c "node story-generator/node_modules/typescript/bin/tsc -p story-generator/tsconfig.spec.json --noEmit"`
- [x] Focused Angular app spec run.
- [x] Isolated error logging spec run.
- [x] Remaining Angular spec shard run.
- [x] Full Angular suite attempted; one-piece run hit Chrome capture/ping timeout after bundle generation, so specs were verified in shards.
- [x] `scripts/recovery/check-vercel-function-count.sh`
- [x] `npm run smoke:story-lab-ui`

## Validation Evidence

- RED focused app spec: `3 FAILED, 43 SUCCESS`; failures were missing narrative dials and missing dial prose anchors.
- GREEN focused app spec after CodeRabbit option-coverage expansion: `47 SUCCESS`.
- Gemini/CodeRabbit circular `Error.cause` review fix: RED isolated error logging spec `1 FAILED, 7 SUCCESS`, then GREEN `8 SUCCESS`.
- Remaining Angular spec shard: `30 SUCCESS` across debug panel, streaming story, workspace storage, story service, form validation, error display, and notification specs.
- Full Angular suite one-piece retry: build completed, but Chrome disconnected with a ping timeout before completing specs. The app, error logging, and remaining shards covered the same spec files with `85 SUCCESS` total.
- `git diff --check`: clean.
- App TypeScript compile: clean.
- Spec TypeScript compile: clean.
- Vercel function count: `10/12`.
- Story Lab browser smoke: passed in mock mode. Build warnings remained the known initial bundle budget warning and `app.css` at `14.95 kB`.
- Sonar duplication follow-up: repeated dial option object literals were compacted behind `defineNarrativeDialOptions`.

## Stop Conditions

- Stop and revise if the continuation panel needs substantial new layout or CSS.
- Stop and split scope if this needs backend contract changes.
- Stop and report if validation repeatedly fails outside this slice.
