# Story Lab Whole-Concept Checklist

Created: 2026-07-04 07:16 EDT
Last updated: 2026-07-16 03:14 EDT

This is the plain-status checklist for the whole Story Lab concept. It includes what is already merged, what is partially built, and what is still not done. The percentages are evidence estimates from the six-check audit artifacts in `STORY_LAB_CHECKLIST_FINDINGS/` plus this PR's doc-fix pass.

For subagent-sized future work, use `STORY_LAB_FUTURE_WORK_CHECKLIST.md`.

## Plain Status

- Overall Story Lab maturity: **72%**
- Public create/continue demo path: **85%**
- Production durability/account path: **55%**
- Final audit, tests, coverage, and docs confidence: **65%**

In plain terms: the user-facing Story Lab is mostly real and usable for creating, continuing, saving locally, copying, downloading, and showing progress. The biggest unfinished work is making accounts/cloud saves/job progress truly durable, proving coverage honestly, and reducing stale-doc confusion.

## Source Audit Bands

| Area | Percent | Status | What it means |
|---|---:|---|---|
| Product concept and user promise | 75% | Mostly done | The core idea, demo stance, user loop, and non-claims are documented; durable platform pieces are still future work. |
| Angular UI surface | 88% | Strong | The route, controls, continuation, progress, library, and local export UI exist; polish remains around disabled states, Proving Grounds intent, and small-screen layout. |
| API, generation, and job routes | 83% | Strong scaffold | Direct generation, continuation, jobs, events, privacy gates, fail-closed AI, and route budget are covered; streaming privacy and durable job storage remain incomplete. |
| Auth, storage, and durability | 72% | Partial | Auth/store contracts, owner checks, and Neon dependency support exist, but live provider auth, provisioned database proof, migrations, and cloud sync proof are not done. |
| Tests, coverage, and CI | 43% | Weakest area | Many tests and preflight checks exist, but there is no canonical risk-to-test map or root/API coverage diagnostic, and critical live auth/database and process-loss boundaries remain unproven. |
| Docs and process | 75% | Improved | Guardrails, changelog, lessons, subagent log, current handoff guidance, and active-plan routing exist; stale-doc cleanup still matters where old docs create active confusion. |

## Product Checklist

- [x] **Define the product promise.** Story Lab is a public-facing story creation and continuation workspace, not just a developer console.
- [x] **Create a new story from the UI.** Users can open the app, set a blueprint, and generate a first chapter.
- [~] **Continue an existing story.** Continuation exists and is wired, but durable continuity is still heuristic/local rather than proven cloud memory.
- [~] **Give useful creative controls.** Creature, theme, spice, heat, direction, and craft controls exist; some advanced creative tooling remains follow-up work.
- [~] **Save and export work.** Local browser save, copy, download, and cloud-library scaffolding exist; signed-in durable cloud library is not proven live.
- [~] **Keep Proving Grounds out of the main product.** It exists behind debug intent, but the intended audience and access rule need clearer documentation.
- [x] **Keep demo/shipping claims honest.** Docs distinguish public/demo readiness from durable production guarantees.
- [x] **Say what is not done.** The repo repeatedly labels non-durable memory/jobs/cloud scaffolding instead of pretending they are complete.

## UI Checklist

- [x] **Visible Story Lab entry page.** The Angular route renders the Story Lab page as the first screen.
- [x] **Story creation controls.** Idea, creature, theme, spice, heat contract, tone, chapter count, word count, and detail controls are visible.
- [x] **Controls affect generation state.** The UI handlers wire those controls into the story blueprint.
- [x] **Continuation controls.** Users can continue with structured direction, custom direction, and Director's Room-style notes.
- [x] **Progress and job state.** Generation progress, job status, batch queue, errors, and fallback copy are visible.
- [x] **Save/copy/download/library actions.** The UI has local and cloud-oriented affordances.
- [~] **Button state polish.** Some handlers guard empty/no-story states, but the buttons are not always disabled or visually explained first.
- [~] **Responsive/a11y hardening.** Breakpoints and ARIA hooks exist; dense panels and fixed heights still need a focused mobile/accessibility pass.

## Backend Checklist

- [x] **Direct Story Lab generation endpoints.** Genesis and continuation routes are callable and tested.
- [~] **Streaming privacy.** Streaming works, but some paths still accept story input through query parameters, which can leak into logs/URLs.
- [x] **Job creation/read route.** `/api/story-lab/jobs` exists with typed responses and opaque job ids.
- [x] **Job status/events route.** Status and event URLs replay snapshots through the consolidated jobs function.
- [~] **Job storage mode.** The default is correctly labeled `non_durable_memory`; durable Postgres mode is guarded but not production-proven.
- [x] **Real engine fail-closed behavior.** Production missing-key behavior fails closed instead of silently returning fake prose.
- [x] **Privacy gates.** CORS, export sanitization, log redaction, and opaque ids have tests.
- [x] **Vercel route budget.** The route guard keeps the deployable API count under the configured limit.

## Account, Storage, And Durability Checklist

- [x] **Auth fails closed.** Missing/unknown auth providers do not accidentally authenticate users.
- [x] **Clerk adapter contract.** The adapter has token-verifier tests and does not trust raw headers by default.
- [x] **Owner checks.** Storage and account routes enforce owner-scoped access in contract tests.
- [~] **Project store adapters.** In-memory and Postgres modes exist, but durable execution is not proven against a real database.
- [~] **Profile store adapters.** Profile defaults and normalization exist, but live profile save/load proof is still missing.
- [~] **Account routes.** Route contracts and guarded responses exist, but full end-to-end signed-in execution against real provider auth and a provisioned database is not proven.
- [~] **Cloud database readiness.** Config, schema, readiness, migration helpers, and Neon dependency support exist; provisioning/executed migrations are not proven here.
- [ ] **Live durable cloud sync.** Provider-backed sign-in plus durable save/load/list/delete against a provisioned database is still not done.

## Tests, Coverage, And CI Checklist

- [x] **Known test command surface.** Root scripts expose many focused Story Lab and recovery tests.
- [~] **Canonical `test:all` map.** `test:all` covers a lot, but some old, special-purpose, privacy/security, and job-contract test files are not clearly wired.
- [~] **Angular test diagnostics.** Karma coverage is configured at 85%, but the browser runner is not reliable in every local environment and the percentage does not prove critical state/error behavior by itself.
- [ ] **Root/API test diagnostics.** There is no `c8`/`nyc`/Vitest/Jest-style diagnostic for root/API TypeScript tests yet, and the risk-to-test map is incomplete.
- [ ] **Coverage artifacts.** There is no current generated coverage artifact proving repo-wide numbers.
- [~] **CI/preflight.** Recovery CI and preflight are useful, but coverage is not part of CI yet.
- [~] **Live smoke.** Live provider/browser smoke checks exist but are credential/environment gated, so they are not universal CI gates.

## Docs And Process Checklist

- [x] **Agent operating map.** `AGENTS.md` defines start commands, publication discipline, docs to update, subagent rules, and finish checks.
- [x] **Subagent logging exists.** `SUBAGENT_LOG.md` records batches, scope, status, integration, and follow-ups.
- [x] **Lessons learned exist.** `LESSONS_LEARNED.md` captures recurring failures like stale local main, non-durable claims, and finish-check discipline.
- [~] **Plan hierarchy.** The current hierarchy is clearer after this pass, but old broad recovery docs still exist for historical context.
- [~] **Job-route plan status.** The job-route plan is now marked merged, but durable job work remains separate.
- [~] **Handoff source.** `OVERNIGHT_MODE.md` is the current autonomous guide; old `OVERNIGHT_HANDOFF.md` should not be reintroduced unless rewritten from current `main`.
- [~] **Stale docs control.** There are still many historical docs; future cleanup should mark or retire only files that cause active confusion.

## What Still Needs to Be Done

- [ ] **Add root/API coverage tooling.** This is the biggest proof gap because API/state/storage/auth/job logic is where many production risks live.
- [ ] **Build the risk-to-test map before tuning percentages.** First identify critical behaviors and plausible defects, wire meaningful proof, then use honest root/API and Angular coverage reports to find blind spots or choose regression thresholds.
- [ ] **Prove live auth and durable database behavior.** Wire provider auth, provision the database, run migrations, and prove signed-in save/load/list/delete in browser.
- [ ] **Prove job durability.** Jobs should not be called durable until progress survives process loss and owner-scoped durable writes are tested.
- [ ] **Move private streaming payloads out of query strings.** Prefer job ids/body-backed flow so story text does not leak through URLs.
- [ ] **Tighten UI polish.** Disable/label empty-state actions, clarify Proving Grounds intent, and run a focused responsive/accessibility pass.
- [ ] **Run final review-comment and PR audit again before claiming completion.** The last-40 recovery audit was clean in the prior audit, but final completion still needs a fresh command.
- [ ] **Keep docs current in the same PR as status changes.** The checklist, changelog, subagent log, and relevant execution plan should move together.

## Subagent Run Result

- Six initial Spark agents covered product, UI, backend, durability, tests/coverage, and docs/process.
- Five completed on the first pass. The first UI agent failed from context exhaustion.
- The failed UI ticket was replaced with a narrower Spark agent that completed successfully.
- Effective completion for this audit batch: **6 of 7 agent attempts returned usable artifacts, or 86% agent success**.
- Process lesson: ambitious parallel checks work better when each ticket has one band, one artifact, and no broad repo-history sweep.
