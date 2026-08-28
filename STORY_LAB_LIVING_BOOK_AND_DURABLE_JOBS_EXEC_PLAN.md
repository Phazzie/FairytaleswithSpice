# Story Lab Living Book And Durable Jobs ExecPlan

Created: 2026-08-28
Revised: 2026-08-28 — addressed three hostile-review passes (see `## Hostile Review`).

## Purpose / Big Picture

This plan supersedes the still-open scope of stale draft PR #198 and gives it a fresh, current-`main`-grounded execution path. PR #198 proposed two plans: a "Living Book" reader-first UI redesign (creation-first empty state, reader-first active state, progressive advanced controls, a "Director Room," a "Moonlit Conservatory" theme) and a production-hardening pass for the backend (durable Postgres-backed jobs via a transactional outbox, Vercel Queue + Cron dispatch replacing in-memory/SSE job handling, idempotency, release/rollback).

PR #198 should not be reopened as-is. Most of its Plan 2 scope has already landed on `main` through unrelated work: Clerk-backed auth, rate limiting, per-user content boundaries, and continuity tracking are all shipped (see `STORY_LAB_AUTH_PROFILE_CLOUD_LIBRARY_EXEC_PLAN.md`, commit `cab9089` "Fold a signed-in reader's content boundaries into Story Lab generation"). Rebasing a stale multi-month-old diff onto that history would either silently reintroduce already-solved problems or conflict badly. This plan instead states current reality precisely and defines only the two pieces confirmed still missing: the reader-first UI, and durable/queued job execution.

This plan does not restate or duplicate the already-shipped visual-skin system, the already-shipped Director's Room craft-notes panel, or the already-scaffolded (but non-default, non-queued) Postgres job store. It builds on top of each.

## Progress

- [x] Verified this scope is not already owned by an existing open/authoritative plan (see Verification Findings below).
- [x] Drafted this ExecPlan.
- [x] Revised this ExecPlan against three hostile-review passes (Phase A sizing/testability, Phase B architecture/feasibility, citation/convention fact-check).
- [ ] Phase A1: Creation-first empty state + progressive disclosure implemented, tested, merged.
- [ ] Phase A2: Reader-dominant reflow (desktop + responsive) implemented, tested, merged.
- [ ] Phase A3: In-flight state + Director's Room/batch-queue relocation implemented, tested, merged.
- [ ] Phase B: Durable Queue/Cron jobs implemented, tested, merged.
- [ ] Final validation and docs update.

## Verification Findings (Grounding For This Plan)

Every claim below is cited to a file read during scoping, not assumed.

**UI naming already in use — do not duplicate:**

- `story-generator/src/app/app.ts:497-501` already defines three cosmetic `skinOptions`, including `{ id: 'conservatory', label: 'Moonlit Conservatory', mood: 'Romantic, mysterious, gothic' }`. This shipped under `STORY_LAB_CHARMED_MVP_EXEC_PLAN.md` (fully checked off, all `[x]`). That plan's own Decision Log is explicit: "The three generated designs are visual skins only... Changing the visual skin should not secretly change the story." It is a CSS/copy skin selector, not a structural reader-first redesign. **This plan reuses the existing `conservatory` skin id rather than inventing a second, colliding "Moonlit Conservatory" concept.**
- `STORY_LAB_DIRECTOR_ROOM_UI_EXEC_PLAN.md` is fully checked off (`[x]` through Task 3) and shipped a "Director's Room" (with apostrophe) craft-notes panel in `story-generator/src/app/app.ts` / `app.html` — three deterministic notes (Desire Ledger, Continuity Keeper, Chapter Ending) that feed the existing continuation job flow. This is real and shipped, but it is a below-the-fold panel bolted onto the current developer-workbench layout, not the reader-first "Director Room" surface PR #198 sketched. **This plan's Phase A3 relocates/reframes this existing panel inside the new reader-first layout; it does not rebuild craft-note generation.**
- `STORY_LAB_BATCH_QUEUE_UI_EXEC_PLAN.md` is fully checked off and shipped a compact batch-queue visibility panel (`[data-testid="batch-queue-panel"]`) reusing existing `activeBatchQueue` state. It is unrelated to reader-first layout or backend job durability; it only makes already-existing client-side batch state visible.
- Repo-wide search for `"Living Book"`, `"creation-first"`, `"reader-first"` (docs, `.ts`, `.html`, `.css`) returned **zero matches**. No plan or code anywhere uses this framing.
- `story-generator/src/app/app.html:1-23` still opens on a `.story-layout` shell where the blueprint form and the `reader-panel` / `emptyReader` template sit side by side as co-equal regions — there is no creation-first empty state that gives way to a reader-first active state, and no progressive-disclosure gate for advanced controls. `STORY_LAB_FUTURE_WORK_CHECKLIST.md` Workstream 5 ("UI Polish And Product Clarity") only covers disabled-state labeling and a responsive/accessibility pass (5.1-5.4) — it does not propose a structural reader-first redesign.
- `story-generator/src/app/app.css:159-169` defines the base (desktop) `.story-layout` grid: `grid-template-columns: minmax(330px, 430px) minmax(0, 1fr) minmax(260px, 320px)` with areas `"skins skins skins"` / `"create reader library"`. Two responsive breakpoints follow: `@media (max-width: 1180px)` (lines ~718-726) collapses to two columns (`minmax(0, 1fr) minmax(280px, 340px)`) with areas `"skins skins"` / `"create library"` / `"reader reader"` — the reader panel drops to its own full-width row under create/library. `@media (max-width: 820px)` (lines ~747-754) collapses further to a single column stacking `"skins"` / `"create"` / `"reader"` / `"library"`. Any plan describing this reflow that covers only desktop is incomplete; see Phase A2 below.
- `story-generator/src/app/app.html` lines 40/342-406 show `.creation-panel` (opened line 40) contains `generation-progress` (`data-testid="generation-progress"`, line 342), `job-status-panel` (`data-testid="job-status-panel"`, lines 352-373), and `batch-queue-panel` (`data-testid="batch-queue-panel"`, lines 375-405) — all nested inside `.creation-panel`, which closes at line 406. `director-room-panel` (`data-testid="director-room-panel"`, line 524) is nested inside `.reader-panel` (opened line 408, gated `*ngIf="workbench().story as story; else emptyReader"`) and is itself further gated by its own `*ngIf="directorRoomNotes().length"` — two stacked `*ngIf`s. Relocating either panel to a new rail/positioning region is therefore a structural DOM extraction out of its current parent region, not a CSS-only reposition; see Phase A3 below.

**Job durability — real but partial, and not queued:**

- `api/_lib/story-lab/jobs/jobStorePort.ts:12` defines `StoryLabJobStorageMode = 'non_durable_memory' | 'postgres'`, confirming durability is a real, already-modeled axis.
- `api/_lib/story-lab/jobs/storyLabJobStoreConfig.ts:100,103` resolves the mode from `STORY_LAB_JOB_STORE`, defaulting to `'non_durable_memory'` whenever the env var is unset. **The production default is still non-durable in-memory.**
- `api/_lib/story-lab/jobs/jobStore.ts` (`NonDurableStoryLabJobStore`) is a process-local `Map` with LRU eviction (`DEFAULT_MAX_STORY_LAB_JOBS = 1000`). A cold start, redeploy, or instance recycle loses every job in it.
- `api/_lib/story-lab/jobs/postgresStoryLabJobStore.ts` **does exist** and is more than scaffolding: it has real `INSERT`/`UPDATE`/event-append SQL, owner-scoped reads, and a terminal-status list driven off `STORY_LAB_TERMINAL_JOB_STATUSES`. But it has two confirmed gaps:
  - `createJob()` (lines 162-200) does two separate, unwrapped queries — insert the job row, then `insertEvent()` — with no transaction around them. A crash between the two leaves a job with no snapshot event. There is no transactional outbox.
  - `idempotencyKey` is accepted and stored (`INSERT_JOB_SQL` column list) but never read back or checked against on create — nothing rejects or dedupes a retried create call. This matches the still-open ticket in `STORY_LAB_COMPLETION_HARDENING_EXEC_PLAN.md:108,276` ("#135: idempotency-key retries in Postgres job creation"). (`STORY_LAB_FUTURE_WORK_CHECKLIST.md` item 3.3, "Postgres job store implementation," was checked directly and does **not** mention idempotency or #135 — an earlier draft of this plan cited it in error; corrected here.)
  - The Postgres path runs entirely through `@neondatabase/serverless`'s `neon()` HTTP one-shot query function (`api/_lib/story-lab/storage/neonStoryLabExecutor.ts:3,34` — `import { neon } ...`, `const sql = neon(databaseUrl)`), exposed to callers only as a single `StoryLabCloudQueryExecutor.query()` method (`api/_lib/story-lab/storage/storyLabCloudStorageConfig.ts:15`). There is no session handle and no `BEGIN`/`COMMIT`/`FOR UPDATE` primitive across calls: each `.query()` is an independent HTTP round trip with no guarantee of landing on the same backend connection. A naive multi-statement `BEGIN ... COMMIT` sequence issued as separate `.query()` calls gives **no real atomicity**, and `FOR UPDATE SKIP LOCKED` cannot hold a lock across separate round trips either. Any outbox/claim design must work as a single `.query()` call per operation; see Phase B tasks 1 and 3 below.
- `api/_lib/story-lab/jobs/jobRouteHandlers.ts:539` (`runJobWork`) executes generation **synchronously inside the same POST request handler**, regardless of which store mode is active. There is no dispatcher, no queue, and no separate worker process. `vercel.json` has no `functions[...].schedule` (Cron) entries and no queue-related config; its `functions` block sets `maxDuration: 60` for every `api/**/*.ts` function — the real ceiling any dispatcher/claim design must respect (see Phase B task on stuck-claim handling). Root `package.json` has no queue/cron/workflow dependency (`@neondatabase/serverless`, `axios`, `dotenv` are the only runtime deps). Repo-wide search for `"Vercel Queue"`, `"Vercel Cron"`, `"@vercel/queue"`, `"outbox"`, `"transactional"` (excluding unrelated hits in prompt/trope files) returned **no existing implementation**.
- `story-generator/src/app/app.ts:495` declares `private jobEventSubscription: Subscription | null = null;` and it is only ever read/closed (`app.ts:2226-2228`, inside a close helper) — grepping the whole file finds **no assignment** to it anywhere. `statusPath` (`app.ts:424`) exists as a contract field and is threaded through `jobStatusPanel()` display state (`app.ts:2314`) but is never fetched or polled. Confirmed: the client does not currently poll `statusPath` or open `eventsPath` at all. In `handleJobSnapshot()` (`app.ts:2126-2186`), the "still running" branch (`return false`, line 2185) is reachable in source but currently dead in practice, because `runJobWork()` today always completes generation before the POST response returns — so a snapshot handler is never invoked while a job is genuinely still running. If job creation becomes async-first (Phase B), that branch goes live for the first time with nothing upstream ever calling back into it. See Phase B's new client-wiring task below.
- `STORY_LAB_JOB_ROUTES_EXEC_PLAN.md` (the plan AGENTS.md names as authoritative for job routes) explicitly scoped durable Workflow/queue/database work **out**: "No Vercel Workflow, queue, auth provider, or database-backed job table is provisioned. The scaffold is useful only if it is honest about that limitation," and lists "durable Workflow execution" under its own pending Artifacts. It does not claim to solve this.
- `STORY_LAB_FUTURE_WORK_CHECKLIST.md` Workstream 3 ("Durable Jobs," items 3.1-3.5) is the closest existing plan-level treatment. It is still open (`[ ]` throughout) and itemizes schema/store/route-wiring/process-loss work at ticket granularity, but it never mentions Vercel Queue, Vercel Cron, or a transactional outbox, and it is a checklist entry inside a larger triage document, not a scoped, acceptance-criteria-bearing plan. **This ExecPlan is the first to name the outbox/Queue/Cron architecture explicitly; it should be read as the detailed execution plan for Workstream 3, not a duplicate of it.**
- No Vercel plan tier is stated anywhere in the repo. Cron alone adds a polling-interval floor of latency stacked on top of generation time for what this plan itself calls "per-user interactive generation" (see Interfaces and Dependencies). That is a real UX regression against today's synchronous request if Cron is the *only* dispatch path. See Phase B's dispatcher task and the new Decision Log entry below.

**Conclusion: no existing file owns this combined scope.** The Living Book reader-first UI has no prior plan or implementation anywhere in the repo. Durable, queued job dispatch has a real but partial start (Postgres store, no outbox, no idempotency enforcement, no queue/cron dispatcher, non-durable-by-default) and is tracked only as open checklist items, not a locked plan. This document is therefore net-new, not a duplicate.

## Surprises & Discoveries

- Scoping this plan repeatedly ran into near-miss names already shipped in the repo: an existing `conservatory` visual skin (`{ id: 'conservatory', label: 'Moonlit Conservatory', ... }`) that is *not* the reader-first redesign PR #198 called "Moonlit Conservatory," an existing "Director's Room" (with apostrophe) craft-notes panel that is *not* the reader-first "Director Room" surface PR #198 sketched, and an existing `batch-queue-panel` that is unrelated to reader-first layout work at all. All three read, on first pass, like they might already satisfy part of PR #198's scope — they don't, but the naming collision is close enough that a future reader skimming code or `git grep` for these terms should not assume "found it, already done" without reading the actual behavior each one implements. Recorded here so the same false-positive isn't rediscovered from scratch.
- The plan's original Phase A task list described `batch-queue-panel` and `director-room-panel` relocation as "only position/prominence changes... keep their current behavior." Reading the actual DOM nesting (`app.html:40-406`, `524`) showed this is wrong: both panels are structurally nested inside their current parent regions (`.creation-panel`, `.reader-panel`), one of them behind two stacked `*ngIf`s. This was caught by hostile review, not by the original scoping pass — worth noting because "position/prominence only" is an easy claim to make about UI without checking the markup tree it lives in.
- The Postgres job store's driver (`@neondatabase/serverless`'s `neon()` HTTP function) has no session/transaction primitive at all — a fact the original outbox task design (`BEGIN`/`COMMIT` across separate `.query()` calls) implicitly assumed away. This only surfaced by tracing `postgresStoryLabJobStore.ts` → `storyLabCloudStorageConfig.ts` → `neonStoryLabExecutor.ts` down to the actual `neon()` call site, not from reading the store file in isolation.

## Decision Log

- Decision: Reuse the existing `conservatory` skin id and Director's Room panel rather than renaming or re-implementing them under Phase A.
  Rationale: They already ship and pass tests; PR #198's naming should map onto them, not fork a second copy.
- Decision: Treat Phase B as the detailed execution plan for `STORY_LAB_FUTURE_WORK_CHECKLIST.md` Workstream 3, and update that checklist's items to point here once Phase B lands, rather than leaving two documents claiming the same ground.
  Rationale: One authoritative durable-jobs plan avoids the exact sprawl this verification pass had to untangle.
- Decision: Do not claim "durable" for any job mode until transactional outbox + idempotency + process-loss proof all exist together.
  Rationale: `AGENTS.md` Working Rule 9: "Do not claim... durable jobs... unless the current implementation and verification prove those claims."
- Decision: Split the original single "Phase A: Living Book UI" into three independently landable sub-phases (A1 empty state/disclosure, A2 responsive reflow, A3 in-flight state/panel relocation).
  Rationale: Every comparable shipped UI ExecPlan in this repo (Director Room ~196 lines/3 tasks, Batch Queue ~64 lines/3 tasks, Job Status ~85 lines/5 tasks) ships one narrow, additive change. The original Phase A bundled an empty-state rework, a full 3-breakpoint CSS grid rewrite, and structural panel relocation into one phase — too large to review or revert as a unit.
- Decision: Make Vercel Cron a reconciliation safety net (catches abandoned/stuck jobs), not the primary dispatch trigger. The job-creation request itself triggers dispatch immediately after the outbox write on the happy path.
  Rationale: No Vercel plan tier is stated in this repo, and Cron's polling-interval floor stacks latency on top of generation time for what this plan calls "per-user interactive generation." A healthy request should not wait on a Cron tick to start work; Cron exists to catch what the immediate-dispatch path misses (crashed request, dropped fire-and-forget call, claimed-but-never-completed job). Durability comes from the outbox + Cron reconciliation, not from making every request wait for Cron.
- Decision: Require a shared-secret/signature check on the Cron-triggered dispatch code path as a hard requirement of the Dispatcher task itself, not an optional fallback only considered if the function-count budget is tight.
  Rationale: An unauthenticated Cron-triggered code path that can claim and run jobs is a real security hole (anyone who finds the route can trigger arbitrary dispatch/generation work) regardless of which route file it lives on or how the function budget shakes out.

## Hostile Review

Three adversarial critique passes ran against the prior version of this plan. Each finding below was independently verified against the actual code before being addressed; nothing here was accepted on the critique's word alone.

**Pass 1 — Phase B architecture/feasibility:**

- Finding: "Contract unchanged" was claimed for the async-dispatch flip, but the Angular client never actually polls `statusPath` or opens `eventsPath` today (`jobEventSubscription` declared and closed, never assigned), so the "still running" branch of `handleJobSnapshot()` is dead code today and would go live with nothing consuming it once dispatch becomes async.
  Verified: yes — `app.ts:495` declaration, `app.ts:2226-2228` close-only usage, no assignment found anywhere in the file; `handleJobSnapshot()` return-false branch at `app.ts:2185`.
  Response: Phase B now has an explicit new task — wire real client-side job-status consumption (poll `statusPath` or open the `eventsPath` SSE stream) as a hard prerequisite for flipping to async dispatch, not an assumption. The "transparent to the client" framing is removed.
- Finding: the transactional-outbox and dispatcher-claim task designs assumed `BEGIN`/`COMMIT` and `FOR UPDATE SKIP LOCKED` work the way they would over a normal stateful Postgres connection, but the actual driver (`@neondatabase/serverless`'s `neon()` HTTP one-shot query function) exposes only `.query()`, with no session or lock guaranteed across separate calls.
  Verified: yes — traced `postgresStoryLabJobStore.ts` → `storyLabCloudStorageConfig.ts` → `neonStoryLabExecutor.ts:3,34`.
  Response: Phase B tasks 1 and 3 are rewritten to specify single-round-trip, driver-compatible SQL (a single `WITH ... INSERT ... RETURNING` CTE for the outbox write; a single `UPDATE ... WHERE id IN (SELECT ... FOR UPDATE SKIP LOCKED) RETURNING *` for claiming), with an explicit note that a design using separate `BEGIN`/multi-round-trip `.query()` calls does not satisfy the acceptance criterion.
- Finding: Cron-only dispatch adds interactive latency with no stated Vercel plan tier and no budget for it, and there is no stuck-claim/poison-job handling for a dispatch run that hits the stated `maxDuration` mid-generation.
  Verified: yes — no plan tier found anywhere in the repo; `vercel.json`'s `functions` block sets `maxDuration: 60`.
  Response: Cron is now scoped as a reconciliation safety net with immediate fire-and-forget dispatch on the happy path (see Decision Log), and a new explicit task covers max-retry count, backoff, and reclaim-after-timeout for jobs claimed by a dispatch run that dies mid-generation.

**Pass 2 — Phase A UX scoping:**

- Finding: Phase A bundled an empty-state rework, a full 3-breakpoint CSS grid rewrite, and structural panel relocation into a single phase, far larger than every comparable shipped UI ExecPlan in this repo, and its acceptance criteria used untestable language ("focused creation surface," "visually dominant region") that `app.spec.ts` cannot check given its actual capabilities (DOM/`data-testid` presence and click behavior only — no `getBoundingClientRect`/`getComputedStyle` usage anywhere in the file).
  Verified: yes — checked `app.spec.ts` for geometry-API usage (none found) and sized Director Room / Batch Queue / Job Status plans for comparison.
  Response: Phase A is split into A1/A2/A3 (see Decision Log), and every acceptance criterion below is rewritten as a concrete `data-testid`/class/attribute assertion `app.spec.ts` can run as-is, or an explicit viewport-resize + computed-layout check assigned to the existing Playwright-based `story-lab-browser-smoke.mjs` script (which already sets real viewports and can call `page.evaluate`/`getBoundingClientRect`, unlike Karma `app.spec.ts`).
- Finding: the plan claimed relocating `batch-queue-panel` and `director-room-panel` was "position/prominence only... keep their current behavior," but both are structurally nested inside their current parent regions in `app.html`, one of them behind two stacked `*ngIf`s.
  Verified: yes — `app.html:40,342-406` (`batch-queue-panel` inside `.creation-panel`), `app.html:408,524` (`director-room-panel` inside `.reader-panel`, gated by `workbench().story` and its own `directorRoomNotes().length` check).
  Response: Phase A3 rewrites this as a structural extraction task with its own explicit risk callout about preserving both gating conditions when the panel moves out of its current parent's `*ngIf` chain.
- Finding: the described responsive behavior implied desktop-only reflow, when the CSS actually defines three breakpoints with materially different layouts (3-col desktop, 2-col with reader dropping to its own row at ≤1180px, single-column stack at ≤820px).
  Verified: yes — `app.css:159-169`, `~718-726`, `~747-754`.
  Response: Phase A2 explicitly names and scopes all three breakpoints; no breakpoint's behavior is left undescribed.

**Pass 3 — citation/convention fact-check:**

- Finding: the idempotency-key gap was cited to `STORY_LAB_FUTURE_WORK_CHECKLIST.md` item 3.3/#135, but checklist item 3.3 is titled "Postgres job store implementation" and never mentions idempotency or #135.
  Verified: yes — read `STORY_LAB_FUTURE_WORK_CHECKLIST.md:254` directly; the correct source is `STORY_LAB_COMPLETION_HARDENING_EXEC_PLAN.md:108` ("#135: idempotency-key retries in Postgres job creation") and `:276` ("Complete #125, #126, #131, and #135 before claiming durable jobs").
  Response: citation corrected throughout (see Verification Findings above).
- Finding: this plan was missing `## Surprises & Discoveries`, `## Outcomes & Retrospective`, and `## Hostile Review` sections, which every comparable current-convention ExecPlan in this repo (Job Routes, Villain Pressure, Director Room, Privacy Streaming Gates, Storage Port) includes.
  Verified: yes — read `STORY_LAB_DIRECTOR_ROOM_UI_EXEC_PLAN.md` and `STORY_LAB_JOB_ROUTES_EXEC_PLAN.md` in full for section presence and tone.
  Response: all three sections added (this section is one of them).
- Finding: this plan promised to register itself in `AGENTS.md`'s plan-routing section "once work starts," while nearly every other active plan is already listed there.
  Verified: yes — `AGENTS.md`'s "Current Operating Direction" section lists `STORY_LAB_JOB_ROUTES_EXEC_PLAN.md` and similar plans directly.
  Response: an entry for this plan was added to `AGENTS.md` as part of this revision (see Fix 10 / Artifacts and Notes below); this plan no longer defers registration.

## Outcomes & Retrospective

Not yet applicable — Phase A and Phase B have not landed. This section is a stub per repo convention (see `STORY_LAB_DIRECTOR_ROOM_UI_EXEC_PLAN.md` / `STORY_LAB_JOB_ROUTES_EXEC_PLAN.md`) and will be filled in with real outcomes, validation evidence, and remaining risks once each phase actually merges. Do not backfill this section with predicted or assumed results before that work happens.

## Plan of Work

### Phase A: Living Book UI

Goal: replace the current side-by-side developer-workbench layout with a reader-first experience, delivered as three independently landable sub-phases rather than one large change.

Primary files (all sub-phases): `story-generator/src/app/app.html`, `story-generator/src/app/app.ts`, `story-generator/src/app/app.css`, `story-generator/src/app/app.spec.ts`.

#### Phase A1: Creation-first empty state + progressive disclosure

Goal: before any story exists, show one focused creation surface (idea prompt, skin picker, minimal required inputs) instead of the current full-width form, with advanced fields (theme count, explicit spice sub-labels, continuation-direction presets) moved behind a disclosed "Advanced" section, collapsed by default.

Tasks:

1. **Empty-state pass.** Reuse `story-generator/src/app/form-validation.service.ts` validation as-is; this is layout/disclosure only, not new validation rules. Add a `data-testid="creation-empty-state"` marker on the focused creation surface's container, and a `data-testid="advanced-controls"` / `data-testid="advanced-controls-toggle"` pair for the disclosure section.
2. **Angular specs.** Extend `app.spec.ts` with DOM specs proving: `[data-testid="advanced-controls"]` is present but carries `hidden` (or an equivalent collapsed marker such as `[attr.aria-expanded]="false"` on the toggle) before any interaction; clicking `[data-testid="advanced-controls-toggle"]` and calling `detectChanges()` removes `hidden` / flips `aria-expanded` to `"true"`; the existing required-field `data-testid`s (idea prompt, skin picker) still resolve and are not gated behind the disclosure; the existing `firstValidationError()` output (`[data-testid` selector already used in current specs) still fires identically before and after this change.
3. **Browser smoke.** Update `scripts/recovery/story-lab-browser-smoke.mjs` selectors only if this phase changes any existing `data-testid`; prefer preserving current ids per repo convention.

Acceptance:

- `[data-testid="creation-empty-state"]` is present in the DOM when `workbench().story` is falsy and absent once a story exists — asserted via `fixture.nativeElement.querySelector(...)` returning non-null/null respectively, matching the existing pattern already used for `story-panel`/`job-status-panel` in `app.spec.ts`.
- `[data-testid="advanced-controls"]` has `hidden === true` (or its toggle has `aria-expanded="false"`) on initial render and `hidden === false` (`aria-expanded="true"`) after a simulated click, asserted by direct DOM property/attribute checks — no new geometry APIs required.
- Angular typecheck and the focused `app.spec.ts` run (see Expected validation) pass.

#### Phase A2: Reader-dominant reflow (desktop + responsive)

Goal: once a story exists, the reader panel becomes the visually dominant region, correctly across all three existing breakpoints defined in `app.css` — not desktop-only.

Scope, per breakpoint (current values, to be revised so the reader panel gains more relative prominence at each):

- **Desktop / base** (`app.css:159-169`): `.story-layout` grid `grid-template-columns: minmax(330px, 430px) minmax(0, 1fr) minmax(260px, 320px)`, areas `"skins skins skins"` / `"create reader library"`. Revise column proportions and/or area assignment so the reader column is unambiguously the dominant one (e.g. widened `reader` track, narrower `create`/`library` tracks), not merely the flexible leftover column it is today.
- **≤1180px** (`app.css:~718-726`): two columns (`minmax(0, 1fr) minmax(280px, 340px)`), areas `"skins skins"` / `"create library"` / `"reader reader"` — the reader panel already drops to its own full-width row below create/library at this width; confirm this reflow is preserved and still reads as reader-dominant (full-width row, not squeezed).
- **≤820px** (`app.css:~747-754`): single column, areas `"skins"` / `"create"` / `"reader"` / `"library"` — full vertical stack; confirm the reader panel's stacking position (and any new dominance styling from the desktop/tablet rules) degrades cleanly to this stack rather than assuming desktop-only styling carries through.

Tasks:

1. **Reflow implementation.** Update all three rules above (not desktop alone) so the reader panel is dominant at each width per its own layout logic (widened column at desktop, full-width priority row at ≤1180px, natural stack position at ≤820px).
2. **DOM-order/class markers for testability.** Add a stable marker (e.g. a `reader-panel--active` class or `data-layout-state` attribute set once `workbench().story` exists) that `app.spec.ts` can assert without measuring geometry.
3. **Browser-smoke viewport checks.** Extend `scripts/recovery/story-lab-browser-smoke.mjs` (already sets `viewport: { width: 1440, height: 1200 }` and a mobile `setViewportSize({ width: 390, height: 920 })`) with a third viewport in the ≤1180px/>820px range, and use `page.evaluate`/`getBoundingClientRect` (a capability this Playwright-based script already has access to, unlike Karma `app.spec.ts`) to assert: at ≥1181px the reader panel's computed width exceeds the creation panel's; at 821-1180px the reader panel's bounding box sits below the create/library row; at ≤820px all four regions stack in `skins → create → reader → library` vertical order.

Acceptance:

- `app.spec.ts` asserts the `reader-panel--active` class (or equivalent marker) is absent before a story exists and present once `workbench().story` is set — a plain class-list/attribute check.
- The extended `story-lab-browser-smoke.mjs` run asserts the three breakpoint-specific layout behaviors above via real viewport resize + `getBoundingClientRect`, run as part of `npm run smoke:story-lab-ui`.
- No behavior described for only one breakpoint; all three (`app.css` base, `~1180px`, `~820px`) are explicitly covered by both the CSS change and its test.

#### Phase A3: In-flight state + Director's Room/batch-queue relocation

Goal: once a job is running, and once a story exists with Director's Room notes, correctly relocate `generation-progress`/`job-status-panel`/`batch-queue-panel` (currently all nested inside `.creation-panel`, `app.html:40-406`) and `director-room-panel` (currently nested inside `.reader-panel`, gated by two stacked `*ngIf`s: `workbench().story` at `app.html:408` and `directorRoomNotes().length` at `app.html:524`) into new rail/positioning regions that fit the reader-dominant layout from A2.

**This is a structural DOM extraction, not a CSS-only reposition.** The prior version of this plan claimed these panels "keep their current behavior... only position/prominence changes" — that claim was wrong and is corrected here.

Tasks:

1. **Extract `batch-queue-panel` (and `generation-progress`/`job-status-panel`) out of `.creation-panel`** into a new rail region. Preserve their existing `*ngIf` conditions (`generationProgress().active`, `jobStatusPanel().visible`, `activeBatchQueue().length`) and `data-testid` hooks exactly — only their template location and CSS positioning change, but the template edit itself is a structural move (removing them from inside `<section class="creation-panel">` and placing them in a new sibling/rail element), which risks losing surrounding layout/spacing context (`action-row`, `validation-summary`) that currently sits between them and the rest of `.creation-panel`. Verify nothing else in `.creation-panel` implicitly depended on their presence for spacing or DOM order.
2. **Extract `director-room-panel` out of `.reader-panel`.** Its current position benefits from two stacked gates (`workbench().story` from the parent `*ngIf`/`else emptyReader`, plus its own `directorRoomNotes().length`). Once moved to an independent rail region outside `.reader-panel`, it no longer inherits the parent's `workbench().story` gate automatically — the extracted template must combine both conditions explicitly (e.g. `*ngIf="workbench().story && directorRoomNotes().length"`), or the panel could render/attempt to render notes state while no story exists. This is the specific risk this task must test for.
3. **Angular specs.** Extend `app.spec.ts` to assert: `[data-testid="director-room-panel"]` still does not render when `workbench().story` is falsy, even with `directorRoomNotes()` populated in test state (the regression Task 2's risk callout describes); `[data-testid="batch-queue-panel"]`, `[data-testid="job-status-panel"]`, and `[data-testid="generation-progress"]` still resolve and toggle on/off per their existing conditions after the DOM move; all existing button/interaction specs referencing these panels (accept/dismiss director notes, clear finished batches) continue to pass unchanged.
4. **Browser smoke.** Update `scripts/recovery/story-lab-browser-smoke.mjs` selectors only if this phase changes any existing `data-testid`; prefer preserving current ids per repo convention.

Risk callout: the highest-risk regression in this sub-phase is `director-room-panel` rendering (or its `continue-with-director-notes` action becoming reachable) when no story exists, because the extraction drops the implicit `workbench().story` gate it inherited from its old parent `*ngIf`. Task 2 and Task 3 above exist specifically to close that gap; do not land this sub-phase without the corresponding spec.

Acceptance:

- `[data-testid="director-room-panel"]` is `null` via `querySelector` whenever `workbench().story` is falsy, regardless of `directorRoomNotes()` state — asserted directly, not inferred from A2's layout markers.
- `[data-testid="batch-queue-panel"]`, `[data-testid="job-status-panel"]`, `[data-testid="generation-progress"]` resolve/toggle identically to their pre-move behavior (same `*ngIf` conditions), confirmed by re-running the existing specs that already exercise these conditions (`app.spec.ts` lines around 418-433) against the new DOM location.
- All existing Director's Room and batch-queue interaction specs (accept/dismiss note, use-as-brief, clear finished batches) pass unchanged.

Expected validation (all of Phase A1-A3):

```bash
git diff --check
npx -p node@20 -c "node ./node_modules/typescript/bin/tsc -p story-generator/tsconfig.spec.json --noEmit"
npx -p node@20 -c "node ./node_modules/typescript/bin/tsc -p story-generator/tsconfig.app.json --noEmit"
npx -p node@20 -c "node ./node_modules/@angular/cli/bin/ng test --watch=false --browsers=ChromeHeadless --include='src/app/app.spec.ts'"
scripts/recovery/check-vercel-function-count.sh
npm run smoke:story-lab-ui
```

### Phase B: Durable Queue/Cron Jobs

Goal: make job progress survive process loss by default, using Postgres for storage and an immediate-dispatch-with-Cron-reconciliation model instead of synchronous in-request execution — and make the async `POST /api/story-lab/jobs` contract actually work end-to-end on the client, not merely on paper.

Primary files: `api/_lib/story-lab/jobs/postgresStoryLabJobStore.ts`, `api/_lib/story-lab/jobs/jobStorePort.ts`, `api/_lib/story-lab/jobs/storyLabJobStoreConfig.ts`, `api/_lib/story-lab/jobs/jobRouteHandlers.ts`, `api/story-lab/jobs.ts`, `vercel.json`, new `api/_lib/story-lab/jobs/jobDispatcher.ts` (or similarly scoped dispatcher module), schema migration SQL, `story-generator/src/app/app.ts` (client-side job-status consumption).

Tasks:

1. **Transactional outbox schema and write, driver-compatible.** Add a `story_lab_job_outbox` table (or extend `story_lab_job_events` with a `dispatched_at`/`dispatch_attempts` column set) so that `createJob()` writes the job row, its event row, and an outbox "needs dispatch" row atomically. Because the Postgres driver here (`@neondatabase/serverless`'s `neon()`, via `StoryLabCloudQueryExecutor.query()`) is an HTTP one-shot executor with no session/`BEGIN`/`COMMIT` across calls, this must be implemented as **a single multi-statement-safe query per operation** — e.g. one `WITH ... INSERT ... RETURNING` CTE query that chains the job-row insert, event-row insert, and outbox-row insert in one round trip. A design using separate `BEGIN`/multiple round-trip `.query()` calls does **not** satisfy this task's acceptance criterion, even if it appears to work in casual testing. Fix the current gap in `postgresStoryLabJobStore.ts:162-200` where job-insert and event-insert are two unwrapped queries.
2. **Idempotency enforcement.** Add a unique constraint on `(owner_user_id, idempotency_key)` where `idempotency_key is not null`, and make `createJob()` return the existing job on a conflict instead of erroring or silently duplicating (an `INSERT ... ON CONFLICT ... RETURNING` is itself a single query and is driver-compatible). This closes the gap correctly cited to `STORY_LAB_COMPLETION_HARDENING_EXEC_PLAN.md:108,276` (issue #135).
3. **Dispatcher — immediate fire-and-forget primary path, Cron as reconciliation safety net.** After the outbox write in `POST /api/story-lab/jobs` succeeds, trigger dispatch immediately as a fire-and-forget follow-up call to a worker code path (same function invoked without the client waiting on it, or a `waitUntil`-style pattern if the Vercel runtime configuration in use here supports one — **this needs explicit confirmation against `api/story-lab/jobs.ts`'s actual runtime config before relying on it; do not assume Edge/`waitUntil` availability**, since no `export const config`/runtime declaration was found in that file during scoping). A Vercel Cron-triggered route (respecting the existing 12-function budget tracked by `scripts/recovery/check-vercel-function-count.sh` — reuse an existing route file or `api/_lib` module rather than spending a new function slot where possible) separately polls the outbox on an interval and claims/dispatches only jobs that were never claimed within some timeout, or were claimed but never completed — i.e. Cron exists to catch what the immediate path misses, not to be the only way a job ever starts. Claiming due jobs must use a single driver-compatible query: `UPDATE story_lab_job_outbox SET claimed_at = now(), claimed_by = $1 WHERE id IN (SELECT id FROM story_lab_job_outbox WHERE claimed_at IS NULL ORDER BY created_at LIMIT $2 FOR UPDATE SKIP LOCKED) RETURNING *` issued as one query, for the same reason as task 1. The `POST /api/story-lab/jobs` handler changes from "run synchronously, then return" to "create the job row + outbox row, kick off immediate dispatch, return `queued` immediately." The Cron route (or the shared dispatch code path, whichever actually executes the claim) **must** verify a shared secret/signature on every invocation — this is a hard requirement of this task and its acceptance criteria below, not an optional fallback gated on function-count pressure.
4. **Stuck-claim / poison-job handling.** A dispatch run that claims a job and then itself hits `vercel.json`'s stated `maxDuration: 60` mid-generation, without completing or releasing its claim, must not leave that job claimed forever. Add: a max-retry count per job, backoff between retries, and a reclaim-after-timeout rule (Cron's reconciliation pass re-claims any job whose `claimed_at` is older than some timeout with no terminal status) so a dead dispatch run's claim eventually releases back to the pool rather than stranding the job.
5. **Wire real client-side job-status consumption.** `story-generator/src/app/app.ts` currently declares `jobEventSubscription` (`app.ts:495`) but never assigns it, and never polls `statusPath` or opens `eventsPath`; `handleJobSnapshot()`'s "still running" branch (`app.ts:2185`) is dead code today because generation currently completes synchronously before the POST response returns. Once job creation returns `queued` immediately (task 3), that branch goes live for real, and without this task the UI would show a loading state forever with nothing consuming job progress. Implement actual polling of `statusPath` or an actual SSE subscription to `eventsPath` after receiving a `queued` creation response, assigning `jobEventSubscription` for real and driving `handleJobSnapshot()` from live data. **This is a hard prerequisite for flipping any store to async dispatch** — do not treat the existing contract/types as proof the client already handles this; they do not.
6. **Route wiring.** Update `jobRouteHandlers.ts` so job creation no longer blocks on `runJobWork()` when the configured store is `postgres`; the non-durable in-memory mode may keep its current synchronous behavior unchanged (it already runs inline and is honestly labeled).
7. **Migration path for existing non-durable jobs.** In-flight jobs in the `non_durable_memory` store cannot be migrated (they were never durable by contract — `NON_DURABLE_STORY_LAB_JOB_DURABILITY` says so). Document that a mode switch (`STORY_LAB_JOB_STORE=postgres`) only affects jobs created after the switch; do not attempt to backfill or claim continuity for jobs created under the old mode.
8. **Process-loss proof.** Add a repeatable smoke script (naming pattern consistent with `STORY_LAB_FUTURE_WORK_CHECKLIST.md` item 3.5) that creates a job, kills/clears the in-process dispatcher state, and confirms the outbox-driven Cron reconciliation path still completes and updates the job without re-running already-completed side effects.
9. **Default flip — separate, gated step.** Only after tasks 1-8 pass with live database + Cron + client-consumption evidence, change the default in `storyLabJobStoreConfig.ts` (or the deployed `STORY_LAB_JOB_STORE` env var) from `non_durable_memory` to `postgres`, and update `STORY_LAB_JOB_ROUTES_EXEC_PLAN.md` / `AGENTS.md` wording that currently calls job routes non-durable.

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
- Renaming or adding a fourth visual skin, or reworking Director's Room note-generation logic (only its position and gating move, in Phase A3).
- Reopening or rebasing PR #198 itself; that PR should be closed with a pointer to this plan.

## Validation and Acceptance

Phase A1 accepted when:

- `[data-testid="creation-empty-state"]` presence/absence tracks `workbench().story` correctly (see Phase A1 acceptance above).
- `[data-testid="advanced-controls"]` is collapsed by default and expands via `[data-testid="advanced-controls-toggle"]`, verified by direct attribute checks.
- Angular typecheck and focused `app.spec.ts` run pass.

Phase A2 accepted when:

- The reader-dominance marker (class/attribute) toggles correctly with story existence, verified in `app.spec.ts`.
- All three breakpoints (base, ≤1180px, ≤820px) are individually verified by the extended `story-lab-browser-smoke.mjs` viewport checks — not desktop only.
- `npm run smoke:story-lab-ui` passes.

Phase A3 accepted when:

- `director-room-panel` never renders when `workbench().story` is falsy, even with notes present in test state — this is the specific regression this sub-phase risks and must prove it avoided.
- All relocated panels (`batch-queue-panel`, `job-status-panel`, `generation-progress`, `director-room-panel`) keep their existing `data-testid` hooks and `*ngIf` conditions, verified by re-running (not just reusing unchanged) the existing specs that exercise those conditions.
- All existing Director's Room and batch-queue interaction specs pass unchanged.

Phase B accepted when:

- `createJob()`/event-append/outbox-row writes happen inside one single-round-trip query (a CTE or equivalent) — a design using separate `BEGIN`/multiple `.query()` calls does not meet this criterion given the driver in use.
- A retried create with the same idempotency key returns the original job, not a duplicate.
- A healthy-path job dispatches immediately after creation without waiting for a Cron tick — verified by timing a create-to-dispatch-start interval against the Cron polling interval and confirming dispatch started well before the next tick.
- Cron-triggered dispatch requires a verified shared secret/signature on every invocation; an unauthenticated call to the Cron-triggered path is rejected.
- A job claimed by a dispatch run that dies mid-generation (simulated at or near the `maxDuration: 60` boundary) is reclaimed after its timeout, retried up to its max-retry count with backoff, and does not stay claimed forever.
- The Angular client actually polls `statusPath` or consumes `eventsPath` after a `queued` response and reaches a terminal UI state without manual intervention — proven by a real (not assumed) end-to-end test, since `handleJobSnapshot()`'s running-job branch was previously unreachable and unproven.
- A process-loss smoke test proves a claimed-but-uncompleted job resumes/completes via the outbox/Cron-reconciliation path without duplicating side effects.
- `non_durable_memory` mode remains available, honestly labeled, and unaffected for local/test use.
- Vercel function count stays within the tracked budget (`scripts/recovery/check-vercel-function-count.sh`).
- Wording in `STORY_LAB_JOB_ROUTES_EXEC_PLAN.md`, `AGENTS.md`, and `STORY_LAB_FUTURE_WORK_CHECKLIST.md` is updated to stop calling jobs non-durable only once the default has actually flipped and process-loss proof exists.

## Idempotence and Recovery

- Phases A1, A2, A3, and B are each independently revertible; none requires another to have landed first (Phase B does not require any Phase A sub-phase and vice versa). Land them as separate branches/PRs per `AGENTS.md` slice-sizing rules (UI vs. durable-job/workflow claims are named as independent risk areas there).
- If Cron reconciliation cannot be proven crash-safe within this plan's timebox, ship the outbox/transaction/idempotency work (Phase B tasks 1-2) and keep synchronous dispatch, rather than shipping an unproven queue path.
- If the Vercel function budget cannot absorb a new Cron route, reuse the existing `/api/story-lab/jobs` function with a Cron-only code path guarded by the same shared-secret header required by task 3 — the auth requirement applies either way, it is not conditional on this budget decision.
- Do not flip the default store mode until task 9's gating evidence exists; a partially-implemented outbox with the default flipped is worse than the current honestly-labeled non-durable default.

## Artifacts and Notes

- Stale PR #198 (two-plan "Living Book" + backend-hardening proposal) should be closed with a comment pointing to this plan and noting which parts of its Plan 2 already shipped via `cab9089` and related auth/rate-limit/continuity work.
- This plan is registered in `AGENTS.md`'s "Current Operating Direction" section as of this revision (see the entry following `STORY_LAB_JOB_ROUTES_EXEC_PLAN.md`'s), per the Documentation Update Map convention — it is not deferred to "once work starts." It is also referenced from `STORY_LAB_FUTURE_WORK_CHECKLIST.md` Workstream 3 as its detailed execution plan.

## Interfaces and Dependencies

No new UI dependency is required for Phase A (existing Angular signals/components suffice).

Phase B likely needs dependency and runtime decisions made explicitly rather than assumed:

- A Vercel Cron config block in `vercel.json` (`crons: [...]`) — no package needed, this is platform config.
- Continued use of `@neondatabase/serverless` (already a root dependency) for the outbox/idempotency SQL; no new database driver. Note its HTTP one-shot `.query()` model constrains all transaction/lock design to single-query operations (see Phase B tasks 1 and 3).
- No `@vercel/queue`-style package exists in this repo today; evaluate whether Cron-polls-outbox (no extra dependency) is sufficient before adding a queue package, since the job volume here is per-user interactive generation, not high-throughput fan-out.
- Whether a `waitUntil`-style fire-and-forget primitive is available for the immediate-dispatch path in `api/story-lab/jobs.ts` is **unconfirmed** — no runtime/`export const config` declaration was found in that file during scoping. This must be confirmed against actual Vercel runtime configuration before Phase B task 3 is implemented; if unavailable, the immediate-dispatch path needs a different mechanism (e.g. a same-request best-effort async call without blocking the response) rather than assuming Edge-style `waitUntil` semantics apply.
