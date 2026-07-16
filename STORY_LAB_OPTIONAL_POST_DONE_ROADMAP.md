# Story Lab Optional Post-Done Roadmap

Created: 2026-07-16 03:41 EDT
Last updated: 2026-07-16 03:52 EDT

## Purpose / Big Picture

This ExecPlan defines the ambitious work that begins only after the required Story Lab Definition of Done in `STORY_LAB_FINAL_MERGE_AUDIT_EXEC_PLAN.md` is satisfied and merged to `origin/main`. It turns scattered deferred ideas into an executable product roadmap rather than a parking lot.

The intended outcome is larger than "polish the current generator." Story Lab should grow into a creator operating system that can remember a fictional world, diagnose story pressure, compare alternate directions, coordinate editorial passes, publish private artifacts, produce serial and narrated editions, and eventually support trusted collaborators. The app should become more valuable as a project grows instead of losing context and forcing the writer to start over.

Nothing in this file blocks the required Definition of Done unless the user explicitly promotes it. Optional does not mean vague or unserious. Each program below has prerequisites, observable behavior, likely code surfaces, test obligations, stop conditions, and a promotion rule.

## Progress

- [x] Consolidated optional ideas from `STORY_LAB_IDEA_BOARD.md`, `STORY_LAB_PLATFORM_EVOLUTION_EXEC_PLAN.md`, `GROK_MULTIAGENT_STORY_LAB_POLISH_EXEC_PLAN.md`, `STORY_LAB_REAL_ENGINE_EXEC_PLAN.md`, and the active completion plans.
- [x] Verified the current route budget is `11/12`; optional API work must consolidate behind existing routes or first recover route capacity.
- [x] Verified current code already contains Director's Room notes, continuity extraction, memory cards, Proving Grounds, owner-scoped account/storage seams, job contracts, and export sanitization that later programs can extend.
- [x] Refreshed a small set of current platform assumptions from primary sources on 2026-07-16.
- [ ] Finish and merge the required Definition of Done before promoting an optional program.
- [ ] Run the portfolio selection gate and select the first optional wave.
- [ ] Create a separate scope file for the selected wave, run Scope Prosecutor review, revise, and lock it.
- [ ] Implement, validate, review, and merge one proof unit at a time.
- [ ] Re-score the roadmap after every three optional PRs or any material provider/cost change.

## Surprises & Discoveries

- Much of the creative foundation is already real. Director's Room, continuity facts, memory cards, Heat Contract, villain pressure, deterministic quality evals, and Proving Grounds should be evolved rather than recreated.
- The most valuable optional work is not a pile of isolated UI buttons. A shared story-intelligence model can power continuity review, character pressure, branching, editorial notes, export metadata, and narration planning.
- Versioning is a leverage point. Once chapters, blueprints, notes, and story state have addressable revisions, Story Lab can support alternate branches, comparisons, rollback, collaboration, and reproducible evals without separate bespoke systems.
- Media and collaboration have stricter trust boundaries than creative suggestions. Private artifact storage, role-scoped access, deletion, consent, cost caps, and durable jobs must precede flashy export/audio/share UI.
- The `11/12` Vercel function budget makes route proliferation the wrong architecture. Prefer sub-actions on existing account, job, evaluate, and export functions, with shared modules under `api/_lib`.
- Current xAI structured outputs can support schema-constrained extraction, which is useful for story facts, editorial notes, and narration metadata. It still needs semantic validation because valid JSON can contain bad story reasoning.
- Current Vercel Private Blob is suitable for authenticated user artifacts, but access, cache behavior, deletion, and cost still need app-level tests and policy.

## Decision Log

- Decision: Treat this as a portfolio of product programs, not a single mega-feature branch.
  Rationale: The programs share foundations but cross independent review boundaries such as story semantics, storage, durable execution, media, and collaboration.
- Decision: Build a shared versioned story-intelligence core before adding many specialized AI panels.
  Rationale: Facts, character desires, promises, unresolved debts, relationship changes, and provenance should have one canonical shape rather than drift across Continuity Court, Director's Room, branching, and export.
- Decision: Make every AI recommendation inspectable, rejectable, and attributable.
  Rationale: Writers need control. Store source revision, evidence span, confidence, model/provider telemetry, and user disposition for each suggestion.
- Decision: Prefer local deterministic value first, then provider-backed enrichment.
  Rationale: The app should remain useful and testable without paid calls. Provider-backed passes must add visible value rather than replace basic app behavior.
- Decision: Treat story versions as immutable revisions connected by parent links.
  Rationale: Immutable revisions make rollback, alternate branches, comparison, collaboration conflicts, and eval reproduction safer than in-place mutation.
- Decision: Use existing deployable route families before adding endpoints.
  Rationale: The repo has one Vercel function slot left. New shared code belongs under `api/_lib`; route additions require the route-budget plan and explicit capacity recovery.
- Decision: Store private exports, covers, and audio as owner-scoped immutable artifacts, not public URLs or large database rows.
  Rationale: Media needs deletion, retention, access control, and versioning separate from relational project metadata.
- Decision: Audio begins with narration structure and consent metadata, not provider calls.
  Rationale: Segmentation, speaker identity, emotion, pacing, pronunciation, and intimate-scene boundaries determine whether generated audio will be coherent and safe.
- Decision: Collaboration begins with review roles and comments, not simultaneous multiplayer editing.
  Rationale: Review links, anchored comments, approvals, and version conflicts provide most early value with less data-loss risk than real-time co-editing.
- Decision: No numeric coverage target promotes a program.
  Rationale: Each program must name the user outcome, plausible defects, important failure paths, and real-boundary proof.

## Outcomes & Retrospective

This section is intentionally prospective until optional work begins.

Expected outcome if the full roadmap succeeds:

- a writer can grow one story across many chapters without losing facts, motivations, promises, boundaries, or alternate ideas;
- the app can explain why it raised a continuity or craft concern and the writer can accept, reject, pin, rewrite, or ignore it;
- story branches, comparisons, and rollbacks are safe and reproducible;
- exports, covers, and audio are private, versioned, deletable, and generated outside the text request path;
- collaborators can review a specific revision without gaining unintended access to the whole account;
- Proving Grounds can compare prompts, models, strategies, and story outcomes using both deterministic checks and human preference;
- operational telemetry can improve quality and cost without storing private prose unnecessarily.

At every stopping point, replace these expectations with what actually shipped, what failed, what was rejected, and what should move in the roadmap.

## Context and Orientation

Repository root: the current Fairytales with Spice Git checkout (`<repo-root>` in command examples).

Current relevant foundations:

- frontend contracts and workbench: `story-generator/src/app/contracts.ts`, `story-generator/src/app/app.ts`, `story-generator/src/app/app.html`;
- local workspace persistence: `story-generator/src/app/story-workspace-storage.service.ts`;
- cloud/account client seam: `story-generator/src/app/story.service.ts`;
- current Director's Room, memory-card, continuity, and pressure UI: `story-generator/src/app/app.ts` and `story-generator/src/app/app.html`;
- Proving Grounds: `story-generator/src/app/proving-grounds/`;
- shared Story Lab contracts: `api/_lib/story-lab/contracts.ts` and `api/_lib/types/contracts.ts`;
- continuity extraction and budget: `api/_lib/story-lab/continuityExtractor.ts` and `api/_lib/story-lab/continuityBudget.ts`;
- story state: `api/_lib/story-lab/stateStore.ts`;
- story generation: `api/_lib/story-lab/storyLabEngine.ts` and `api/_lib/services/storyService.ts`;
- owner-scoped account/storage: `api/_lib/story-lab/account/`, `api/_lib/story-lab/auth/`, and `api/_lib/story-lab/storage/`;
- job seam: `api/_lib/story-lab/jobs/` and `api/story-lab/jobs.ts`;
- evaluation seam: `api/_lib/story-lab/evaluation/` and `api/story-lab/evaluate.ts`;
- export seam: `api/_lib/services/exportService.ts`, `api/_lib/services/exportSanitizer.ts`, and `api/export/save.ts`;
- current browser/live proof: `scripts/recovery/story-lab-browser-smoke.mjs` and `scripts/recovery/story-lab-live-provider-smoke.mjs`.

Terms used in this plan:

- A **story revision** is an immutable snapshot of the project blueprint, chapters, story intelligence, and accepted creative decisions at one point in time.
- A **story branch** is a chain of revisions with a named divergence point from another chain.
- **Story intelligence** is structured information extracted or accepted from prose: facts, characters, desires, fears, promises, secrets, relationships, unresolved debts, locations, objects, boundaries, and provenance.
- A **craft note** is a targeted suggestion backed by evidence from a specific revision. It is never silently applied.
- An **artifact** is a generated file such as EPUB, PDF, cover art, audio, or a serial-publishing bundle.
- A **proof unit** is one reviewable outcome with localized failure, bounded files, meaningful tests, and independent rollback.

This roadmap uses the canonical subagent lifecycle and role definitions in `AGENTS.md`; summaries here add program context but do not redefine those roles.

### Hard-Boundary Map

`Existing route` means extend the named consolidated entrypoint rather than adding a Vercel function. Every program still runs the route-count guard. `Approval` means explicit user/provider authority is required before provisioning, billing, external messaging, or storing new classes of private data.

| Program | Schema/data migration | Route boundary | Provider/dependency boundary | Approval before external change |
|---|---|---|---|---|
| 1. Versioned Story Bible | Yes: revisions and intelligence snapshots | Existing account/story actions | Existing xAI enrichment is optional | Database migration only |
| 2. Continuity Court | Yes: findings and dispositions | Existing evaluate/account actions | Existing xAI structured output plus deterministic checks | Database migration only |
| 3. Desire And Debt Engine | Yes: revisioned ledgers | Existing account/evaluate actions | No new provider required | Database migration only |
| 4. Director's Room 2.0 | Yes: notes and dispositions | Existing evaluate/account actions | Existing xAI | Database migration only |
| 5. Story Time Machine | Yes: revisions, branches, heads | Existing account action | No new provider required | Migration and conflict policy |
| 6. Chapter Ending Lab | Optional: saved bets/selection | Existing evaluate/story action | Existing xAI | Paid-call budget policy |
| 7. Proving Grounds Ledger | Yes: experiments and preferences | Existing evaluate action | Existing xAI; optional analytics later | Private-output retention policy |
| 8. Reader Room Simulator | Optional: reactions/dispositions | Existing evaluate action | Existing xAI | Paid-call and labeling policy |
| 9. Story DNA Recipes | Yes: versioned recipes | Existing account action | No new provider required | Database migration only |
| 10. Private Export Studio | Yes: artifact records | Existing export/jobs actions | Private Blob plus EPUB/PDF tooling | Blob provisioning, billing, retention |
| 11. Cover And Visual Kit | Yes: visual artifacts/briefs | Existing jobs/export actions | Private Blob; image provider only in later stage | Image provider, billing, safety/rights |
| 12. Serial Publishing Pack | Yes: package metadata/artifacts | Existing export/jobs actions | Existing xAI and Private Blob | Blob/billing; no external publishing yet |
| 13. Narration Studio | Yes: narration/audio artifacts | Existing jobs/export actions | Private Blob and later audio provider | Provider, billing, voice rights/consent |
| 14. Review Links And Comments | Yes: invitations, roles, threads | Existing account action | Auth/email choice may expand later | Sharing, email, retention policy |
| 15. Editorial Checkpoints | Yes: checkpoints/approvals | Existing jobs/account actions | Durable workflow candidate | Workflow provisioning and billing |
| 16. Offline/Cross-Device | Yes: revision/conflict metadata | Existing account action | Offline/sync library only after contract lock | Storage/conflict policy |
| 17. Shared Worlds | Yes: canon packs/memberships | Existing account action | No new provider for private packs | Team/public-sharing policy |
| 18. Resumable Workflow | Yes: durable run/step state | Existing jobs action | Durable workflow package/platform | Workflow provisioning and billing |
| 19. Quality/Cost Cockpit | Yes: redacted telemetry/events | Existing evaluate/jobs actions | Observability provider is optional | Telemetry retention/privacy/billing |
| 20. Safe Strategy Rollouts | Optional: manifests/assignments | Existing config/evaluate paths | Feature-flag/config provider optional | Provider provisioning and experiment policy |

## Portfolio Selection Gate

After required Done, score candidate programs from 0 to 5 on user value, leverage for later programs, evidence that the problem is real, readiness of dependencies, and reversibility. Subtract 0 to 5 for privacy/security risk, provider/cost uncertainty, and route/shared-file pressure. Do not let the score make the decision automatically; use it to expose why an exciting idea is early or late.

Promote a program only when:

1. its user-visible outcome is described in one sentence;
2. current code and dependencies were inspected by the parent;
3. the first proof unit can be delivered without pretending later phases exist;
4. test obligations name plausible defects;
5. external provider, billing, retention, and deletion prerequisites are explicit;
6. the Scope Prosecutor has reviewed the proposed split;
7. the parent has adjudicated findings and marked the scope `Scope locked`.

## Plan of Work

### Horizon 1: Story Intelligence Foundation

#### Program 1 - Versioned Story Bible

User outcome: the writer can inspect and correct the current canon, with every fact tied to the revision and prose evidence that produced it.

Work:

- add `StoryIntelligenceSnapshot`, `StoryFact`, `CharacterIntent`, `RelationshipState`, `StoryPromise`, and provenance contracts;
- distinguish `model_suggested`, `user_accepted`, `user_corrected`, `user_pinned`, and `superseded` facts;
- keep immutable snapshots with parent revision ids and a small diff summary;
- expose a compact Story Bible panel with filter, accept, correct, pin, and supersede actions;
- pass only accepted/high-confidence relevant facts into continuation within an explicit context budget.

Likely surfaces: `api/_lib/story-lab/contracts.ts`, `api/_lib/story-lab/continuityExtractor.ts`, `api/_lib/story-lab/continuityBudget.ts`, `api/_lib/story-lab/stateStore.ts`, `story-generator/src/app/contracts.ts`, `story-generator/src/app/app.ts`, focused API and Angular tests.

Proof: correcting a false extracted fact changes later continuation context without rewriting the source chapter; cross-revision provenance remains visible; corrupt snapshots fail closed.

#### Program 2 - Continuity Court

User outcome: before continuing, the writer sees contradictions, dangling promises, forgotten objects, timeline conflicts, and character-behavior breaks with evidence and a proposed disposition.

Work:

- add deterministic checks for duplicate identities, impossible ordering, dead/absent character use, setting/object drift, broken Heat Contract boundaries, and unresolved setup age;
- add schema-constrained AI review for semantic contradictions that deterministic checks cannot catch;
- show evidence spans from both conflicting revisions;
- support `fix_next_chapter`, `accept_retcon`, `mark_intentional`, and `dismiss` dispositions;
- turn accepted findings into bounded continuation instructions.

Proof: seeded contradiction fixtures trigger the intended finding, clean fixtures remain quiet, deliberate removal of an owner/revision guard makes the test fail, and no private prose appears in logs.

#### Program 3 - Character Desire And Debt Engine

User outcome: every chapter can visibly advance or complicate what characters want, fear, hide, owe, and refuse to admit.

Work:

- evolve the existing desire/debt concepts into revisioned ledgers;
- track pressure, movement, contradiction, and payoff state per chapter;
- let writers pin one or two ledger movements as continuation goals;
- flag stagnant arcs and unearned reversals without forcing formulaic prose;
- include antagonistic, relational, internal, environmental, and deadline pressure sources.

Proof: a continuation brief can cite exactly which ledger item it advances; tests reject nonexistent characters, stale revision writes, and silent overwrites.

#### Program 4 - Director's Room 2.0

User outcome: the writer receives a small editorial council rather than one generic critique box.

Work:

- evolve existing Director's Room notes into named lenses: continuity editor, tension editor, character editor, prose editor, romance/Heat Contract editor, and serial-cliffhanger editor;
- cap the visible output at the highest-leverage notes and explain why each note won priority;
- allow accept, reject, rewrite, combine, defer, and apply-to-next-chapter actions;
- record which notes helped so later evaluations can compare strategies;
- never let a lens rewrite prose without explicit approval.

Proof: each note has evidence, lens, source revision, confidence, and disposition; rejected notes do not leak into later prompts; accepted notes do.

### Horizon 2: Narrative Versioning And Experimentation

#### Program 5 - Story Time Machine And Branch Graph

User outcome: a writer can fork at any chapter, try a radically different direction, compare branches, and return without losing either version.

Work:

- add immutable project revisions and named branch heads;
- support fork, rename, archive, compare, promote-to-mainline, and restore-as-new-revision;
- make destructive-looking restore operations append-only;
- display chapter, intelligence, note, and Heat Contract differences;
- define conflict behavior for local-to-cloud sync and later collaboration.

Likely surfaces: storage contracts and schema, account route sub-actions, local workspace storage, app library UI, branch graph component, version/owner tests.

Proof: two branches can diverge and survive refresh/new session; promoting one never deletes the other; cross-owner branch ids return not-found/forbidden without leaking titles.

#### Program 6 - Chapter Ending Lab

User outcome: before the final section is written, the writer can compare several ending pressures such as revelation, danger, betrayal, impossible choice, identity crisis, arrival, or deadline.

Work:

- generate compact ending bets from current chapter state rather than full duplicate chapters;
- score each bet for continuity, freshness, emotional consequence, serial pull, and Heat Contract fit;
- let the writer choose, hybridize, or reject all bets;
- record the chosen bet as an explicit generation constraint;
- add the existing chapter-ending stress-test idea as a deterministic/live eval pair.

Proof: every bet is distinct in mechanism, not just wording; selected bets influence only the intended revision; provider failure leaves the current draft untouched.

#### Program 7 - Proving Grounds Experiment Ledger

User outcome: model, prompt, style, and story-strategy changes can be compared using reproducible experiments instead of vibes.

Work:

- give every experiment a frozen input fixture, strategy/model configuration, output ids, deterministic checks, optional human ranking, cost/latency telemetry, and conclusion;
- support blind pairwise comparison and "neither is good";
- separate quality dimensions: continuity, tension, voice, freshness, boundary adherence, readability, and cliffhanger pull;
- store only redacted metrics by default; private prose remains owner-scoped and deletable;
- promote a strategy only after it wins on target dimensions without unacceptable regressions.

Proof: rerunning the same deterministic fixture reproduces the comparison setup; live output variance does not invalidate structural checks; a strategy cannot be marked winner without evidence.

#### Program 8 - Reader Room Simulator

User outcome: the writer can ask how several explicitly fictional reader lenses might react without mistaking the result for real market research.

Work:

- define bounded lenses such as binge reader, romance-first reader, lore reader, tension reader, sensitivity/boundary reader, and confused new reader;
- require each reaction to cite a passage and distinguish observation from speculation;
- compare reactions across revisions;
- never label simulated reactions as user analytics or audience truth;
- connect accepted concerns to Director's Room without auto-editing.

Proof: UI and exports say `simulated`; prompts prohibit demographic stereotyping; reactions without evidence spans are rejected.

#### Program 9 - Story DNA Recipes

User outcome: writers can save and remix successful combinations of mood, creature, heat, pacing, tropes, pressure, voice, and ending behavior.

Work:

- version recipe contracts independently from projects;
- support personal recipes, built-in recipes, import/export, duplicate-and-edit, and compatibility migration;
- show which recipe fields affect generation;
- later allow team recipes without exposing private story text;
- connect recipe experiments to Proving Grounds evidence.

Proof: applying a recipe changes only declared fields, old recipes migrate or fail with an actionable message, and recipes never bypass adult/boundary validation.

### Horizon 3: Publishing And Media Studio

#### Program 10 - Private Export Studio

User outcome: a writer can create polished HTML, PDF, and standards-compliant EPUB editions tied to a specific revision, then download or delete them securely.

Work:

- replace mock file URLs with owner-scoped artifact records and private immutable Blob objects;
- add export templates for chapter headings, front matter, table of contents, author notes, accessibility metadata, and cover references;
- validate EPUB packages against the current W3C EPUB 3.3 family and an automated checker;
- generate artifacts as jobs so export never blocks story generation;
- add expiration, deletion cascade, retry, idempotency, and version provenance;
- serve private artifacts only through authenticated delivery or time-bounded signed access.

Likely surfaces: existing export service/route, job store/workflow, new artifact port under `api/_lib/story-lab/exports/`, schema migration, account library UI, export tests and smoke.

Proof: an owner can generate/download/delete an artifact; another owner cannot; deleting the project removes metadata and Blob objects; sanitization and EPUB validation fail closed.

#### Program 11 - Cover And Visual Story Kit

User outcome: a writer can create a coherent cover, character cards, location cards, and a shareable series visual kit from accepted story metadata.

Work:

- start with editable visual briefs and deterministic layout templates;
- add image-provider generation only behind a provider/cost/safety decision;
- preserve prompt, seed/provider metadata, source revision, consent flags, and user edits;
- store generated assets privately until explicitly exported or shared;
- add crop/aspect variants without regenerating the core image when possible;
- prevent story text, private notes, or disallowed intimate content from entering image prompts.

Proof: assets are revisioned, deletable, owner-scoped, and clearly labeled generated; provider failure cannot break story creation.

#### Program 12 - Serial Publishing Pack

User outcome: one click produces an episode-ready package with title options, teaser, spoiler-safe recap, content notes, chapter metadata, and platform-length variants.

Work:

- add serial metadata contracts and templates;
- generate recap/teaser from the selected revision with spoiler boundaries;
- add pacing and cliffhanger diagnostics for serialized release;
- export plain text, HTML, EPUB chapter, and structured metadata bundles;
- add a release checklist and manual approval step; do not auto-publish externally in the first version.

Proof: packages are reproducible from a revision, spoiler fixtures stay within the selected cutoff, and no external post occurs without a later explicit integration plan.

#### Program 13 - Narration Studio

User outcome: the writer can direct how a chapter should sound before paying to generate audio.

Work in stages:

1. narration metadata: speaker segmentation, narrator/character labels, pronunciation, emotion, intensity, pacing, atmosphere, and consent/safety tags;
2. preview script: inspect and correct segmentation and casting;
3. provider spike: compare quality, latency, rights, consent, cost, and supported controls;
4. durable audio jobs: generate segments, retry idempotently, assemble chapters, and store private artifacts;
5. audio library: playback, download, delete, regenerate selected segment, and preserve text/audio revision links.

Proof: speaker segmentation fixtures are deterministic; intimate-scene boundaries propagate; failed segments can resume without repaying for completed work when the provider supports idempotency; audio never blocks text generation.

### Horizon 4: Collaboration And Creator Workflow

#### Program 14 - Review Links And Anchored Comments

User outcome: a writer can invite a reviewer to one specific revision, receive anchored comments, and revoke access without exposing unrelated projects.

Work:

- add project/revision-scoped invitations with `viewer`, `commenter`, and later `editor` roles;
- anchor comments to stable chapter/block ids with quoted fallback context;
- support threads, resolve/reopen, reactions, and author decisions;
- use expiring/revocable tokens or authenticated membership according to the provider decision;
- add notification preferences without emailing story text.

Proof: revocation is immediate, links cannot enumerate other projects, comments retain context across a new revision, and deleted accounts/projects cascade safely.

#### Program 15 - Editorial Checkpoints And Approval Workflow

User outcome: a project can pause at blueprint, outline, draft, continuity review, final text, and export checkpoints with an explicit approver.

Work:

- model checkpoints as durable, owner-scoped state transitions;
- require approval only for selected projects/steps;
- attach Director's Room notes, Continuity Court findings, and artifacts to the checkpoint;
- allow reject-with-reason and revision resubmission;
- ensure durable execution can suspend and resume across deploys before claiming long-lived approval.

Proof: process-loss test survives an approval pause; unauthorized users cannot approve; retry never duplicates a chapter or artifact.

#### Program 16 - Conflict-Safe Offline And Cross-Device Workspace

User outcome: writers can continue during a temporary network loss and reconcile changes safely when cloud access returns.

Work:

- add local operation/revision queue and explicit sync status;
- use immutable revision ancestry to detect conflicts;
- auto-merge only disjoint metadata edits; require user choice for prose/blueprint conflicts;
- preserve both sides before conflict resolution;
- add quota, eviction, encryption-at-rest feasibility, and recovery UX.

Proof: simulated offline edits survive reload, reconnect produces no silent overwrite, and conflicting prose creates two recoverable revisions.

#### Program 17 - Shared Worlds And Reusable Canon Packs

User outcome: writers can reuse a world bible, lore rules, locations, species, and style constraints across multiple stories without copying private chapters.

Work:

- separate world/canon packs from story projects;
- define explicit project attachment and version pinning;
- allow personal and team-scoped packs first;
- add import/export with schema version and provenance;
- consider a public template gallery only after moderation, rights, abuse, and attribution policies exist.

Proof: updating a world pack does not silently rewrite existing projects; a project can preview and accept an upgrade; owner/team isolation is enforced.

### Horizon 5: Durable Creative Operations

#### Program 18 - Resumable Story Production Workflow

User outcome: long creative runs survive function death, deployment, refresh, provider timeout, and human approval pauses.

Work:

- run a provider spike against the current durable-workflow option before choosing packages;
- break generation into deterministic orchestration and retryable side-effect steps;
- persist step inputs/outputs, attempt counts, cost, status, and sanitized errors;
- support cancellation, retry-from-safe-step, deadline, budget ceiling, and user approval;
- prove process-loss recovery locally and in staging before replacing `non_durable_memory` wording.

Proof: kill the process after at least two distinct steps, restart, and finish without duplicating completed provider calls or writes.

#### Program 19 - Quality, Cost, And Latency Cockpit

User outcome: the operator can see which strategy produces better stories at what cost and latency without reading private prose.

Work:

- emit operation, model, strategy version, latency, token/cost estimate, fallback, retry, structural-quality, and user-preference events;
- keep prose and private notes out of default telemetry;
- connect Proving Grounds experiment ids to production strategy versions;
- add per-operation budgets and alerts;
- provide deletion/export policy for any user-linked telemetry.

Proof: telemetry redaction tests seed tokens, emails, story text, prompts, SQL, and Blob URLs and confirm none escape; totals reconcile with mocked provider receipts.

#### Program 20 - Safe Model And Strategy Rollouts

User outcome: new prompts/models can be canaried, compared, and rolled back without a redeploy or silent quality regression.

Work:

- version prompt and strategy manifests;
- add server-side feature flags for percentages and allowlists only after a provider/config decision;
- pin each job/revision to the chosen manifest;
- define automatic rollback signals for error, latency, cost, boundary, and structural-quality regressions;
- keep user-facing provider wording truthful during fallback.

Proof: the same job never switches strategy mid-run, rollback affects new jobs only, and experiment allocation never bypasses owner/privacy rules.

### Horizon 6: Weird Lab Portfolio

These are deliberately strange, bounded experiments. Each gets a timebox, fixture set, comparison, and explicit keep/kill decision. A successful experiment graduates into its own prosecuted scope; a failed experiment leaves a short result in `STORY_LAB_IDEA_BOARD.md`.

- **Continuity Crime Scene:** reconstruct the five prose clues that caused a contradiction and let the writer decide which clue is unreliable.
- **Narrative Seismograph:** graph pressure, intimacy, uncertainty, and agency across a chapter and flag suspiciously flat stretches.
- **Chekhov Debt Auction:** rank unresolved objects/promises by payoff potential, then let competing ending bets bid on them.
- **Villain Alibi Generator:** make the antagonist's plan seem defensible from inside their worldview, then test whether the protagonist pressure becomes sharper.
- **Trope Mutagen:** preserve the emotional promise of a trope while changing its expected mechanism, cost, or beneficiary.
- **Scene Counterfeit Detector:** identify passages that sound generically dramatic but do not change knowledge, desire, risk, or relationship state.
- **Romance Consent Choreographer:** map invitation, hesitation, confirmation, boundary, reversal, and aftercare beats without turning prose into a checklist.
- **Future Reader Postcards:** produce three spoiler-bounded reactions from hypothetical later chapters to test whether current setups are legible.
- **One Bad Choice Engine:** offer the smallest plausible decision that would make the next three chapters harder in productive ways.
- **Voice Fingerprint Drift Test:** compare sentence rhythm, sensory preference, metaphor family, and dialogue habits across chapters without imitating a living author.

## Recommended Wave Order

Do not execute all programs serially. Build shared foundations, then run disjoint lanes in parallel where file leases allow.

### Wave A - Highest-Leverage Local Intelligence

1. Versioned Story Bible.
2. Character Desire And Debt Engine.
3. Continuity Court deterministic core.
4. Proving Grounds Experiment Ledger.
5. Story DNA Recipes.

Why first: these produce creator value without new paid media providers and create the data model used by most later programs.

### Wave B - Branching And Editorial Power

1. Story Time Machine And Branch Graph.
2. Director's Room 2.0.
3. Chapter Ending Lab.
4. Reader Room Simulator as a clearly labeled experiment.
5. First three Weird Lab trials selected by evidence and write-scope independence.

Why second: immutable revisions and story intelligence make editorial experiments safe, comparable, and reversible.

### Wave C - Publishing Foundation

1. Private artifact port and deletion policy.
2. Standards-valid HTML/PDF/EPUB export jobs.
3. Serial Publishing Pack.
4. Visual brief and template-based cover kit.
5. Narration metadata and editable preview scripts.

Why third: it turns finished stories into useful deliverables while deferring expensive provider work until metadata and privacy are proven.

### Wave D - Collaboration

1. Revision-scoped review links.
2. Anchored comments and author dispositions.
3. Editorial checkpoints.
4. Conflict-safe offline/cross-device revisions.
5. Shared Worlds and Canon Packs.

Why fourth: live auth/cloud and immutable revision ancestry must already be trustworthy.

### Wave E - Durable Media And Operations

1. Resumable Story Production Workflow.
2. Quality/Cost/Latency Cockpit.
3. Safe strategy rollouts.
4. Image-provider cover generation after cost/safety review.
5. Audio-provider generation and chapter assembly after rights/consent/cost review.

Why fifth: durable orchestration and operational evidence should precede high-cost, long-running media generation.

## Concrete Steps

For the first optional wave after Done:

1. Refresh `origin/main`, open PRs, route count, active providers, schema, and current tests.
2. Parent-map Wave A contracts and file ownership; do not dispatch broad explorers.
3. Create a wave scope artifact containing dependency graph, proof units, exact files, test defects, file leases, commands, and non-claims.
4. Dispatch one read-only Scope Prosecutor.
5. Record `Accept`, `Partial`, or `Reject` for each material critique; revise and mark `Scope locked`.
6. Create one branch per proof unit from updated `main`.
7. Update backend/UI contracts before implementations that cross a seam.
8. Write acceptance and invariant tests with or before the code where practical.
9. Run semantic counterfactuals for revision ownership, cross-owner access, corrupt snapshots, no-op writes, and stale revision conflicts.
10. Dispatch a Completion Prosecutor after each worker batch.
11. Parent-run focused tests, aggregate tests, build, route count, privacy/redaction checks, and browser smoke proportional to the change.
12. Publish, review, address threads, and merge before the next proof unit uses the result.
13. Update this plan's living sections and re-score the remaining portfolio.

## Validation and Acceptance

Every optional program must pass these common gates:

- its user outcome is observable without reading code;
- accepted data and generated suggestions retain revision and owner provenance;
- private prose, auth data, prompts, artifact URLs, and provider errors remain redacted;
- provider-free deterministic behavior is tested where the feature can degrade gracefully;
- live-provider proof exists for any claim that depends on the provider;
- owner isolation and delete/export behavior are tested for stored data and artifacts;
- long-running work proves restart/retry/cancel behavior before using durable wording;
- the most plausible defect is named and, for high-risk behavior, a semantic counterfactual demonstrates the relevant test would catch it;
- route count remains within budget;
- accessibility, loading, error, empty, and reduced-motion states are tested for user-facing UI;
- product wording distinguishes generated advice, simulated readers, real analytics, local data, cloud data, and durable execution;
- all work is merged to `origin/main`; local-only or open-PR work is not marked Done.

Portfolio success is not "all twenty programs shipped." Success means the programs that survive evidence and user value checks form a coherent product, while weak experiments are killed cleanly without destabilizing the required app.

## Idempotence and Recovery

- Revisions and branches are append-only; retries create or reuse idempotency keys rather than overwrite unknown state.
- Artifact generation records intent before side effects and stores provider ids so retries can reconcile rather than duplicate.
- Workflow steps must be deterministic at orchestration boundaries and isolate external calls in retryable steps.
- Provider features remain disabled without explicit configuration and must not silently fall back to fake success.
- Failed migrations record exact state and remain safe to rerun; destructive schema changes require backup/restore proof and user approval.
- Route-budget failure stops the slice before a new entrypoint is committed.
- If a program grows across two independent risk boundaries, split it and publish the first useful proof unit.
- If a provider changes materially, pause that program, refresh primary documentation, and update the Decision Log before code continues.
- If an optional branch stalls, record its commit, upstream, validation, unresolved concerns, and keep/park recommendation in a turnover packet.

## Artifacts and Notes

Primary sources refreshed on 2026-07-16:

- [Vercel Private Blob](https://vercel.com/docs/vercel-blob/private-storage): authenticated private artifact storage and delivery behavior.
- [Vercel Workflow introduction](https://vercel.com/blog/introducing-workflow): durable TypeScript workflows that can resume after crashes/deployments; adoption still requires a repo-specific provider spike and process-loss proof.
- [xAI Structured Outputs](https://docs.x.ai/developers/model-capabilities/text/structured-outputs): schema-constrained output suitable for extraction and report shapes, with application-level semantic validation still required.
- [W3C EPUB 3.3](https://www.w3.org/publishing/epub3/): the publication format and associated accessibility/security guidance for the Export Studio target.

Expected future tracked artifacts:

- wave-specific scope files and Scope Prosecutor dispositions;
- schema migrations and readiness evidence;
- risk-to-test matrices;
- ignored local coverage/eval reports with concise tracked summaries;
- provider decision records with cost, rights, privacy, retention, and deletion analysis;
- browser/deployed smoke receipts;
- experiment keep/kill decisions in `STORY_LAB_IDEA_BOARD.md`;
- PR and review-thread links in `PR70_RECOVERY_CHANGELOG.md` or its successor.

## Interfaces and Dependencies

Likely new interfaces, introduced only in the program that owns them:

```typescript
export interface StoryRevision {
  id: string;
  projectId: string;
  ownerUserId: string;
  parentRevisionId?: string;
  branchId: string;
  revisionNumber: number;
  createdAt: string;
  summary: string;
}

export interface StoryIntelligenceSnapshot {
  revisionId: string;
  facts: StoryFact[];
  characterIntents: CharacterIntent[];
  promises: StoryPromise[];
  relationships: RelationshipState[];
}

export interface EvidenceSpan {
  revisionId: string;
  chapterId: string;
  blockId: string;
  startOffset: number;
  endOffset: number;
  excerptHash: string;
}

export interface StoryFact {
  id: string;
  statement: string;
  status: 'model_suggested' | 'user_accepted' | 'user_corrected' | 'user_pinned' | 'superseded';
  confidence?: number;
  evidence: EvidenceSpan[];
}

export interface CharacterIntent {
  characterId: string;
  desire: string;
  fear?: string;
  hiddenTruth?: string;
  cost?: string;
  evidence: EvidenceSpan[];
}

export interface StoryPromise {
  id: string;
  setup: string;
  state: 'open' | 'complicated' | 'paid_off' | 'intentionally_abandoned';
  evidence: EvidenceSpan[];
}

export interface RelationshipState {
  leftCharacterId: string;
  rightCharacterId: string;
  state: string;
  evidence: EvidenceSpan[];
}

export interface CraftNote {
  id: string;
  revisionId: string;
  lens: 'continuity' | 'tension' | 'character' | 'prose' | 'heat_contract' | 'serial_cliffhanger';
  evidence: EvidenceSpan[];
  recommendation: string;
  status: 'proposed' | 'accepted' | 'rejected' | 'deferred' | 'applied';
}

export interface StoryArtifact {
  id: string;
  projectId: string;
  revisionId: string;
  ownerUserId: string;
  kind: 'html' | 'pdf' | 'epub' | 'cover' | 'audio' | 'serial_pack';
  storageKey: string;
  status: 'queued' | 'running' | 'ready' | 'failed' | 'deleted';
}
```

Potential dependencies, never added speculatively:

- a current durable-workflow package only after the workflow spike;
- `@vercel/blob` only when private artifact storage is provisioned;
- an EPUB packaging/checking library selected against EPUB 3.3 validation fixtures;
- PDF tooling selected for Vercel runtime compatibility and deterministic tests;
- image/audio provider SDKs only after provider, rights, consent, cost cap, retry, and deletion decisions;
- collaboration or offline-sync libraries only after revision/conflict contracts are locked.

No optional program may introduce a second active story engine, revive DigitalOcean as the deployment target, spend route capacity without the route-budget plan, or bypass the current auth/storage/privacy seams.
