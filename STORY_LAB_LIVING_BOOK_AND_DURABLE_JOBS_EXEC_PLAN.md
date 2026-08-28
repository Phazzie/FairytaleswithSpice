# Story Lab Living Book And Durable Jobs ExecPlan

Created: 2026-08-28

## Purpose / Big Picture

This plan supersedes the still-open scope of stale draft PR #198 and gives it a fresh, current-`main`-grounded execution path. PR #198 proposed two plans: a "Living Book" reader-first UI redesign (creation-first empty state, reader-first active state, progressive advanced controls, a "Director Room," a "Moonlit Conservatory" theme) and a production-hardening pass for the backend (durable Postgres-backed jobs via a transactional outbox, Vercel Queue + Cron dispatch replacing in-memory/SSE job handling, idempotency, release/rollback).

PR #198 should not be reopened as-is. Most of its Plan 2 scope has already landed on `main` through unrelated work: Clerk-backed auth, rate limiting, per-user content boundaries, and continuity tracking are all shipped (see `STORY_LAB_AUTH_PROFILE_CLOUD_LIBRARY_EXEC_PLAN.md`, commit `cab9089` "Fold a signed-in reader's content boundaries into Story Lab generation"). Rebasing a stale multi-month-old diff onto that history would either silently reintroduce already-solved problems or conflict badly. This plan instead states current reality precisely and defines only the two pieces confirmed still missing: the reader-first UI, and durable/queued job execution.

This plan does not restate or duplicate the already-shipped visual-skin system, the already-shipped Director's Room craft-notes panel, or the already-scaffolded (but non-default, non-queued) Postgres job store. It builds on top of each.

## Progress

- [x] Verified this scope is not already owned by an existing open/authoritative plan (see Verification Findings below).
- [x] Drafted this ExecPlan.
- [ ] Phase A: Living Book UI implemented, tested, merged.
- [ ] Phase B: Durable Queue/Cron jobs implemented, tested, merged.
- [ ] Final validation and docs update.

## Verification Findings (Grounding For This Plan)

Every claim below is cited to a file read during scoping, not assumed.

**UI naming already in use — do not duplicate:**

- `story-generator/src/app/app.ts:497-501` already defines three cosmetic `skinOptions`, including `{ id: 'conservatory', label: 'Moonlit Conservatory', mood: 'Romantic, mysterious, gothic' }`. This shipped under `STORY_LAB_CHARMED_MVP_EXEC_PLAN.md` (fully checked off, all `[x]`). That plan's own Decision Log is explicit: "The three generated designs are visual skins only... Changing the visual skin should not secretly change the story." It is a CSS/copy skin selector, not a structural reader-first redesign. **This plan reuses the existing `conservatory` skin id rather than inventing a second, colliding "Moonlit Conservatory" concept.**
- `STORY_LAB_DIRECTOR_ROOM_UI_EXEC_PLAN.md` is fully checked off (`[x]` through Task 3) and shipped a "Director's Room" (with apostrophe) craft-notes panel in `story-generator/src/app/app.ts` / `app.html` — three deterministic notes (Desire Ledger, Continuity Keeper, Chapter Ending) that feed the existing continuation job flow. This is real and shipped, but it is a below-the-fold panel bolted onto the current developer-workbench layout, not the reader-first "Director Room" surface PR #198 sketched. **This plan's Phase A relocates/reframes this existing panel inside the new reader-first layout; it does not rebuild craft-note generation.**
- `STORY_LAB_BATCH_QUEUE_UI_EXEC_PLAN.md` is fully checked off and shipped a compact batch-queue visibility panel (`[data-testid="batch-queue-panel"]`) reusing existing `activeBatchQueue` state. It is unrelated to reader-first layout or backend job durability; it only makes already-existing client-side batch state visible.
- Repo-wide search for `"Living Book"`, `"creation-first"`, `"reader-first"` (docs, `.ts`, `.html`, `.css`) returned **zero matches**. No plan or code anywhere uses this framing.
- `story-generator/src/app/app.html:1-23` still opens on a `.story-layout` shell where the blueprint form and the `reader-panel` / `emptyReader` template sit side by side as co-equal regions — there is no creation-first empty state that gives way to a reader-first active state, and no progressive-disclosure gate for advanced controls. `STORY_LAB_FUTURE_WORK_CHECKLIST.md` Workstream 5 ("UI Polish And Product Clarity") only covers disabled-state labeling and a responsive/accessibility pass (5.1-5.4) — it does not propose a structural reader-first redesign.

**Job durability — real but partial, and not queued:**

- `api/_lib/story-lab/jobs/jobStorePort.ts:12` defines `StoryLabJobStorageMode = 'non_durable_memory' | 'postgres'`, confirming durability is a real, already-modeled axis.
- `api/_lib/story-lab/jobs/storyLabJobStoreConfig.ts:100,103` resolves the mode from `STORY_LAB_JOB_STORE`, defaulting to `'non_durable_memory'` whenever the env var is unset. **The production default is still non-durable in-memory.**
- `api/_lib/story-lab/jobs/jobStore.ts` (`NonDurableStoryLabJobStore`) is a process-local `Map` with LRU eviction (`DEFAULT_MAX_STORY_LAB_JOBS = 1000`). A cold start, redeploy, or instance recycle loses every job in it.
- `api/_lib/story-lab/jobs/postgresStoryLabJobStore.ts` **does exist** and is more than scaffolding: it has real `INSERT`/`UPDATE`/event-append SQL, owner-scoped reads, and a terminal-status list driven off `STORY_LAB_TERMINAL_JOB_STATUSES`. But it has two confirmed gaps:
  - `createJob()` (lines 162-200) does two separate, unwrapped queries — insert the job row, then `insertEvent()` — with no transaction around them. A crash between the two leaves a job with no snapshot event. There is no transactional outbox.
  - `idempotencyKey` is accepted and stored (`INSERT_JOB_SQL` column list) but never read back or checked against on create — nothing rejects or dedupes a retried create call. This matches the still-open ticket in `STORY_LAB_FUTURE_WORK_CHECKLIST.md` item 3.3/#135 ("idempotency-key retries in Postgres job creation").
- `api/_lib/story-lab/jobs/jobRouteHandlers.ts:539` (`runJobWork`) executes generation **synchronously inside the same POST request handler**, regardless of which store mode is active. There is no dispatcher, no queue, and no separate worker process. `vercel.json` has no `functions[...].schedule` (Cron) entries and no queue-related config; root `package.json` has no queue/cron/workflow dependency (`@neondatabase/serverless`, `axios`, `dotenv` are the only runtime deps). Repo-wide search for `"Vercel Queue"`, `"Vercel Cron"`, `"@vercel/queue"`, `"outbox"`, `"transactional"` (excluding unrelated hits in prompt/trope files) returned **no existing implementation**.
- `STORY_LAB_JOB_ROUTES_EXEC_PLAN.md` (the plan AGENTS.md names as authoritative for job routes) explicitly scoped durable Workflow/queue/database work **out**: "No Vercel Workflow, queue, auth provider, or database-backed job table is provisioned. The scaffold is useful only if it is honest about that limitation," and lists "durable Workflow execution" under its own pending Artifacts. It does not claim to solve this.
- `STORY_LAB_FUTURE_WORK_CHECKLIST.md` Workstream 3 ("Durable Jobs," items 3.1-3.5) is the closest existing plan-level treatment. It is still open (`[ ]` throughout) and itemizes schema/store/route-wiring/process-loss work at ticket granularity, but it never mentions Vercel Queue, Vercel Cron, or a transactional outbox, and it is a checklist entry inside a larger triage document, not a scoped, acceptance-criteria-bearing plan. **This ExecPlan is the first to name the outbox/Queue/Cron architecture explicitly; it should be read as the detailed execution plan for Workstream 3, not a duplicate of it.**

**Conclusion: no existing file owns this combined scope.** The Living Book reader-first UI has no prior plan or implementation anywhere in the repo. Durable, queued job dispatch has a real but partial start (Postgres store, no outbox, no idempotency enforcement, no queue/cron dispatcher, non-durable-by-default) and is tracked only as open checklist items, not a locked plan. This document is therefore net-new, not a duplicate.

## Decision Log

- Decision: Reuse the existing `conservatory` skin id and Director's Room panel rather than renaming or re-implementing them under Phase A.
  Rationale: They already ship and pass tests; PR #198's naming should map onto them, not fork a second copy.
- Decision: Treat Phase B as the detailed execution plan for `STORY_LAB_FUTURE_WORK_CHECKLIST.md` Workstream 3, and update that checklist's items to point here once Phase B lands, rather than leaving two documents claiming the same ground.
  Rationale: One authoritative durable-jobs plan avoids the exact sprawl this verification pass had to untangle.
- Decision: Do not claim "durable" for any job mode until transactional outbox + idempotency + process-loss proof all exist together.
  Rationale: `AGENTS.md` Working Rule 9: "Do not claim... durable jobs... unless the current implementation and verification prove those claims."

## Plan of Work

### Phase A: Living Book UI

Goal: replace the current side-by-side developer-workbench layout with a reader-first experience: a creation-first empty state when no story exists, a reader-first active state once a chapter exists, and advanced controls (creature/theme/spice granularity, Proving Grounds-adjacent knobs) progressively disclosed rather than shown up front.

Primary files: `story-generator/src/app/app.html`, `story-generator/src/app/app.ts`, `story-generator/src/app/app.css`, `story-generator/src/app/app.spec.ts`.

Tasks:

1. **Empty-state pass.** Before any story exists, show one focused creation surface (idea prompt, skin picker, minimal required inputs) instead of the current full-width form. Advanced fields (theme count, explicit spice sub-labels, continuation-direction presets) move behind a disclosed "Advanced" section, collapsed by default. Reuse `story-generator/src/app/form-validation.service.ts` validation as-is; this is layout/disclosure only, not new validation rules.
2. **Reader-first active state.** Once `workbench().story` exists, the reader (`reader-panel` / `data-testid="story-panel"`) becomes the visually dominant region; the blueprint form and Director's Room panel move to a secondary rail or below-the-fold position rather than competing columns. The existing Director's Room panel (`STORY_LAB_DIRECTOR_ROOM_UI_EXEC_PLAN.md`) and batch-queue panel (`STORY_LAB_BATCH_QUEUE_UI_EXEC_PLAN.md`) keep their current behavior and `data-testid` hooks; only their position/prominence changes.
3. **Skin continuity.** Keep all three existing skins (`bookshop`, `conservatory`, `writing-desk`) and their persistence (`skinStorageKey`, `restoreSkin()`); do not add a fourth skin or rename `conservatory`. If the reader-first layout needs skin-specific styling, extend the existing `skin-${activeSkin()}` CSS class hook already applied on `.app-shell` (`app.html:1`).
4. **Angular specs.** Add/extend `app.spec.ts` DOM specs proving: the empty state renders before a story exists; advanced controls are collapsed by default and expand on interaction; the reader panel is visually primary once a story exists; existing Director's Room and batch-queue `data-testid` selectors still resolve.
5. **Browser smoke.** Update `scripts/recovery/story-lab-browser-smoke.mjs` selectors only if this phase changes any existing `data-testid`; prefer preserving current ids per repo convention.

Expected validation:

```bash
git diff --check
npx -p node@20 -c "node ./node_modules/typescript/bin/tsc -p story-generator/tsconfig.spec.json --noEmit"
npx -p node@20 -c "node ./node_modules/typescript/bin/tsc -p story-generator/tsconfig.app.json --noEmit"
npx -p node@20 -c "node ./node_modules/@angular/cli/bin/ng test --watch=false --browsers=ChromeHeadless --include='src/app/app.spec.ts'"
scripts/recovery/check-vercel-function-count.sh
npm run smoke:story-lab-ui
```

### Phase B: Durable Queue/Cron Jobs

Goal: make job progress survive process loss by default, using Postgres for storage and a Vercel Queue + Cron dispatcher instead of synchronous in-request execution — without changing the public `/api/story-lab/jobs` contract (`api/_lib/story-lab/jobs/jobContracts.ts`, `StoryLabJobCreationResponse`).

Primary files: `api/_lib/story-lab/jobs/postgresStoryLabJobStore.ts`, `api/_lib/story-lab/jobs/jobStorePort.ts`, `api/_lib/story-lab/jobs/storyLabJobStoreConfig.ts`, `api/_lib/story-lab/jobs/jobRouteHandlers.ts`, `api/story-lab/jobs.ts`, `vercel.json`, new `api/_lib/story-lab/jobs/jobDispatcher.ts` (or similarly scoped dispatcher module), schema migration SQL.

Tasks:

1. **Transactional outbox schema.** Add an `story_lab_job_outbox` table (or extend `story_lab_job_events` with a `dispatched_at`/`dispatch_attempts` column set) so that `createJob()` and `updateJob()` write the job row, its event row, and an outbox row for "needs dispatch" in one database transaction. Fix the current gap in `postgresStoryLabJobStore.ts:162-200` where job-insert and event-insert are two unwrapped queries.
2. **Idempotency enforcement.** Add a unique constraint on `(owner_user_id, idempotency_key)` where `idempotency_key is not null`, and make `createJob()` return the existing job on a conflict instead of erroring or silently duplicating. This closes the gap noted in `STORY_LAB_FUTURE_WORK_CHECKLIST.md` item 3.3 / issue #135.
3. **Dispatcher.** Add a Vercel Cron-triggered route (respecting the existing 12-function budget tracked by `scripts/recovery/check-vercel-function-count.sh` — reuse an existing route file or `api/_lib` module rather than spending a new function slot where possible) that polls the outbox, claims due jobs (`FOR UPDATE SKIP LOCKED` or equivalent), and runs the same generation work `runJobWork()` (`jobRouteHandlers.ts:539`) currently runs inline. The `POST /api/story-lab/jobs` handler changes from "run synchronously, then return" to "create the job row + outbox row, return `queued` immediately."
4. **Route wiring.** Update `jobRouteHandlers.ts` so job creation no longer blocks on `runJobWork()` when the configured store is `postgres`; the non-durable in-memory mode may keep its current synchronous behavior unchanged (it already runs inline and is honestly labeled).
5. **Migration path for existing non-durable jobs.** In-flight jobs in the `non_durable_memory` store cannot be migrated (they were never durable by contract — `NON_DURABLE_STORY_LAB_JOB_DURABILITY` says so). Document that a mode switch (`STORY_LAB_JOB_STORE=postgres`) only affects jobs created after the switch; do not attempt to backfill or claim continuity for jobs created under the old mode.
6. **Process-loss proof.** Add a repeatable smoke script (naming pattern consistent with `STORY_LAB_FUTURE_WORK_CHECKLIST.md` item 3.5) that creates a job, kills/clears the in-process dispatcher state, and confirms the outbox-driven Cron path still completes and updates the job without re-running already-completed side effects.
7. **Default flip — separate, gated step.** Only after 1-6 pass with live database + Cron evidence, change the default in `storyLabJobStoreConfig.ts` (or the deployed `STORY_LAB_JOB_STORE` env var) from `non_durable_memory` to `postgres`, and update `STORY_LAB_JOB_ROUTES_EXEC_PLAN.md` / `AGENTS.md` wording that currently calls job routes non-durable.

Expected validation:

```bash
npm run test:story-lab-job-store-port
npm run test:story-lab-job-store-config
npm run test:story-lab-job-routes
scripts/recovery/check-vercel-function-count.sh
DATABASE_URL=... npx tsx scripts/recovery/apply-story-lab-cloud-schema.ts
npm run build
```

## Out Of Scope

- Release/rollback tooling (canarying job-store modes, feature-flag percentage rollout) — belongs to `STORY_LAB_OPTIONAL_POST_DONE_ROADMAP.md` Program 20 ("Safe Model And Strategy Rollouts") if promoted later.
- Story Bible, Continuity Court, Character Desire/Debt Engine, or any other `STORY_LAB_OPTIONAL_POST_DONE_ROADMAP.md` program.
- A durable, general-purpose workflow engine for multi-step AI generation (Vercel Workflow) — Program 18 in the optional roadmap covers that; this plan only queues job dispatch, it does not add step-level checkpointing inside a single job's generation call.
- Any change to auth, rate limiting, or content-boundary logic — already shipped and out of this plan's write scope.
- Audio, export/PDF jobs, or cover-art generation.
- Renaming or adding a fourth visual skin, or reworking Director's Room note-generation logic (only its position moves).
- Reopening or rebasing PR #198 itself; that PR should be closed with a pointer to this plan.

## Validation and Acceptance

Phase A accepted when:

- A user with no story sees a focused creation surface, not the current multi-column form.
- Advanced controls are collapsed by default and reachable via explicit disclosure.
- Once a story exists, the reader panel is the visually dominant region and existing Director's Room / batch-queue panels still function via their current `data-testid` hooks.
- All three existing skins still work and persist; no skin is renamed or duplicated.
- Angular typecheck, focused `app.spec.ts` run, and `npm run smoke:story-lab-ui` pass.

Phase B accepted when:

- `createJob()`/event-append happen inside one transaction (or an equivalent all-or-nothing outbox write).
- A retried create with the same idempotency key returns the original job, not a duplicate.
- A Cron-dispatched job completes without any code in the request path blocking on generation for the `postgres` store mode.
- A process-loss smoke test proves a claimed-but-uncompleted job resumes/completes via the outbox path without duplicating side effects.
- `non_durable_memory` mode remains available, honestly labeled, and unaffected for local/test use.
- Vercel function count stays within the tracked budget (`scripts/recovery/check-vercel-function-count.sh`).
- Wording in `STORY_LAB_JOB_ROUTES_EXEC_PLAN.md`, `AGENTS.md`, and `STORY_LAB_FUTURE_WORK_CHECKLIST.md` is updated to stop calling jobs non-durable only once the default has actually flipped and process-loss proof exists.

## Idempotence and Recovery

- Both phases are independently revertible; Phase B does not require Phase A and vice versa. Land them as separate branches/PRs per `AGENTS.md` slice-sizing rules (UI vs. durable-job/workflow claims are named as independent risk areas there).
- If Cron dispatch cannot be proven crash-safe within this plan's timebox, ship the outbox/transaction/idempotency work (tasks 1-2) and keep synchronous dispatch, rather than shipping an unproven queue path.
- If the Vercel function budget cannot absorb a new Cron route, reuse the existing `/api/story-lab/jobs` function with a Cron-only code path guarded by a shared-secret header, rather than spending a new slot.
- Do not flip the default store mode until task 7's gating evidence exists; a partially-implemented outbox with the default flipped is worse than the current honestly-labeled non-durable default.

## Artifacts and Notes

- Stale PR #198 (two-plan "Living Book" + backend-hardening proposal) should be closed with a comment pointing to this plan and noting which parts of its Plan 2 already shipped via `cab9089` and related auth/rate-limit/continuity work.
- This plan should be linked from `AGENTS.md`'s plan-routing section once work starts, per the Documentation Update Map convention, and from `STORY_LAB_FUTURE_WORK_CHECKLIST.md` Workstream 3 as its detailed execution plan.

## Interfaces and Dependencies

No new UI dependency is required for Phase A (existing Angular signals/components suffice).

Phase B likely needs one new dependency decision, made explicitly rather than assumed:

- A Vercel Cron config block in `vercel.json` (`crons: [...]`) — no package needed, this is platform config.
- Continued use of `@neondatabase/serverless` (already a root dependency) for the outbox/idempotency SQL; no new database driver.
- No `@vercel/queue`-style package exists in this repo today; evaluate whether Cron-polls-outbox (no extra dependency) is sufficient before adding a queue package, since the job volume here is per-user interactive generation, not high-throughput fan-out.
