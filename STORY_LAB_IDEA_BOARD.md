# Story Lab Idea Board

Last updated: 2026-06-08

## Purpose

This board is the parking lot and selection queue for product ideas, research leads, story-quality improvements, and bounded Weird Lab experiments. It exists so autonomous work can be creative without becoming random.

## Status Labels

- `Now`: should be picked up soon unless a newer user request supersedes it.
- `Soon`: valuable but not first in line.
- `Research`: needs web/source review before implementation.
- `Weird Lab`: small experiment, not guaranteed product work.
- `Parked`: useful but blocked or not timely.
- `Done`: implemented and verified.
- `Rejected`: considered and intentionally not taken.

## Current Priorities

### Now: Reconcile Storage Plan Status

The storage port code exists on `main`, but the storage-port plan still has progress language that may be stale. Update the plan so future agents do not think merged scaffolding is still unmerged work.

Acceptance:

- `STORY_LAB_STORAGE_PORT_EXEC_PLAN.md` accurately distinguishes completed storage-port scaffolding from unfinished cloud account sync.
- No production auth/storage claims are added.

Status:

- Done in overnight slice on 2026-06-08.

### Now: Auth, Profiles, And Cloud Library Plan

Turn auth/storage/profiles into a concrete implementation plan before touching provider code.

Acceptance:

- Provider decision points are explicit.
- User profile contract is sketched.
- Cloud project save/list/load/delete flow is scoped.
- Route/function budget impact is called out.
- Owner-isolation tests are listed.

Status:

- Plan created in `STORY_LAB_AUTH_PROFILE_CLOUD_LIBRARY_EXEC_PLAN.md` during overnight work on 2026-06-08.

Research notes from 2026-06-08:

- Supabase Auth models permanent and anonymous users, issues access tokens tied to users, and supports RLS-driven access. Its docs warn that user-editable metadata must not be used for security-sensitive authorization. Source: https://supabase.com/docs/guides/auth/users, accessed 2026-06-08.
- Vercel's current Postgres guidance says new projects should use Marketplace Postgres integrations rather than legacy Vercel Postgres. Source: https://vercel.com/docs/postgres, accessed 2026-06-08.
- Vercel's Workflow material now positions Workflow SDK as the path for long-running durable work with step isolation, retries, persistence, and observability. Sources: https://vercel.com/workflows and https://vercel.com/blog/a-new-programming-model-for-durable-execution, accessed 2026-06-08.

Product translation:

- Start profiles as private writing preferences, not social profiles.
- Profile fields should be deliberately boring first: display name, default heat contract, default tone/creature preferences, content boundaries, library sort preference, created/updated timestamps.
- Keep account identity separate from profile data. `AuthUser.userId` owns records; editable profile fields do not authorize anything.
- Keep Story Lab jobs non-durable until a Workflow/database decision exists.

### Done: Mock Word Budget Gap

The root tests pass while mock generation ignores requested story length. Decide whether mocks should scale with requested word count or whether tests should stop presenting mock length as quality evidence.

Acceptance:

- Either mock generation roughly scales with requested length, or the tests make the limitation explicit.
- The story-quality checks record length variance as a meaningful signal.

Status:

- Done in overnight slices on 2026-06-08.
- Classic single-story mock generation now scales to 700, 900, and 1200 word requests within the existing 30% tolerance.
- Multi-chapter mock genesis now scales by per-chapter target and fails if the total falls outside tolerance.
- Remaining caveat: continuation mock chapters still have no explicit word-budget contract and are treated as flow placeholders.

### Soon: Live Provider Proof

Run live-provider verification only when `XAI_API_KEY` is available. The proof must show provider telemetry and not merely "request did not crash."

Acceptance:

- Exact command documented.
- Missing-key behavior skips cleanly.
- Live run proves Grok/non-mock telemetry when credentials exist.

Triage note, 2026-06-08:

- `tests/grok-smoke.test.ts` remains untracked and should not be adopted as-is.
- The repo already has tracked live-provider smoke paths: `smoke:story-lab-live-provider`, `smoke:grok`, and `tests/grok-multi-agent-smoke.test.ts`.
- If a canonical low-level `StoryService` Grok smoke is still wanted later, revise the untracked file first, fix whitespace, add a deliberate package script, and document how it differs from the tracked live-provider smoke.

### Soon: Durable Job Storage

Replace or supplement `non_durable_memory` job state with an owner-scoped durable job table and runner plan.

Acceptance:

- Job snapshots/events survive process loss.
- User cannot access another user's jobs.
- UI recovery works from durable state, not only browser session markers.

### Research: Similar Product Mining

Run source-backed research on adjacent products before implementing inspiration-based features.

Research questions:

- How do AI writing tools represent project memory, style, and continuity?
- How do serialized fiction products create chapter momentum and return visits?
- How do interactive fiction tools present choices without making the story feel mechanical?
- How do drafting tools surface revision advice without overwhelming the writer?

Output:

- Source links and dates.
- Three patterns worth stealing in spirit, not copying.
- One small experiment per pattern.

Research pass, 2026-06-08:

Sources:

- Sudowrite docs list Story Bible, Characters, Worldbuilding, Outline, Scenes & Draft, Chapter Continuity, Visibility Settings, and Saliency Engine as writing-system concepts. Source: https://docs.sudowrite.com/using-sudowrite/1ow1qkGqof9rtcyGnrWUBS, accessed 2026-06-08.
- Novelcrafter's Codex stores story elements such as characters, locations, objects, and research notes as a central story reference. Source: https://www.novelcrafter.com/help/docs/codex/the-codex, accessed 2026-06-08.
- NovelAI Lorebook supports key-triggered context insertion and advanced placement settings. Source: https://docs.novelai.net/en/text/lorebook/, accessed 2026-06-08.
- LivingWriter Elements organize characters, settings, objects, tags, notes, and relationships. Source: https://guides.livingwriter.com/desktop-app-+-web-version/chapters-and-elements/elements-section, accessed 2026-06-08.

Patterns worth mining:

- Structured story memory beats raw prompt stuffing.
- Story elements need relationships and tags, not just freeform text.
- AI context should be selective: activate only the memory that matters to the current scene.
- Continuity tooling should be visible enough for trust but compressed enough not to feel like homework.

Experiments:

- `Story Memory Shelf`: extract characters, places, objects, promises, and pressure threads from saved projects, then let continuation use only the active shelf items.
- `Context Activation Rules`: give each memory item aliases and trigger phrases, then include the item only when current story text or continuation brief references it.
- `Relationship Web Lite`: start with simple typed links such as wants, owes, hides from, protects, betrays, and fears.
- `Continuity Preview`: before Continue Saga, show a compact "what the model will remember" list that can be accepted, edited, or hidden.

### Research: User Library And Profile Patterns

Research how creative apps present account identity, project libraries, saved drafts, and profile/taste preferences.

Output:

- Recommended profile fields for this app.
- What should stay local/private.
- What should sync.
- What should never be logged.

Research pass, 2026-06-08:

- User profiles should begin as private writing preferences and library controls.
- Cloud library should sync saved projects, chapter metadata, story state, accepted craft notes, and continuity summaries.
- Raw story text, prompts, heat boundaries, and generated artifacts need redaction and owner-scoped access before cloud sync.
- A future profile table should not trust user-editable metadata for authorization; authorization should stay tied to `AuthUser.userId` and owner columns.

## Untracked File Triage

Triage date: 2026-06-08

### Parked: `SPARK_TRIAL_TASKS.md`

Decision:

- Leave untracked for now.
- Treat as a historical Spark trial log, not active product guidance.
- Do not commit it into the product repo unless the user wants a permanent experiment-history folder.

Why:

- The checklist is already completed.
- Several items describe old branch and PR #87 context.
- The durable lessons are now better represented by `OVERNIGHT_MODE.md`, `STORY_LAB_APP_AUDIT.md`, and current execution plans.

### Adopt As Source Material: `STORY_QUALITY_EVALS_PLAN.md`

Decision:

- Keep as useful source material for story-quality work.
- Do not commit it unchanged yet.
- Fold the useful parts into a current story-quality or auth/profile/cloud-library plan when that implementation slice starts.

Why:

- The plan identifies useful eval dimensions: continuity, cliffhanger quality, trope freshness, emotional variety, character consistency, prose quality, and audio-readiness.
- The repo already has tracked `tests/story-quality-evals.test.ts`, so the untracked plan needs a current-state reconciliation before becoming durable docs.

### Park/Revise Before Adoption: `tests/grok-smoke.test.ts`

Decision:

- Leave untracked for now.
- Do not add a package script yet.
- Revisit only if a low-level `StoryService` smoke is needed in addition to the existing tracked live-provider smoke paths.

Why:

- It overlaps with tracked smoke scripts.
- It is gated correctly in spirit, but it needs cleanup and a clear reason to exist before becoming part of the suite.
- Live-provider work needs credentials and telemetry proof; this file alone would not prove deployed Story Lab behavior.

## Weird Lab Queue

### Done: Tension Thread Translator

Build a tiny deterministic translator that turns numeric/internal narrative state into prose anchors before generation.

Why it might matter:

- The user explicitly liked the idea that dials should become concrete prose instead of showing only numbers.
- It could improve story continuity without exposing mechanical labels to the model.

Experiment:

- Pick 3 to 5 threads.
- Map each to behavioral prose.
- Feed only prose anchors into continuation context.
- Compare before/after continuation samples.

Status:

- Covered by the narrative dials UI merge and verified again during the 2026-06-08 overnight pass.
- The app stores selected dial option IDs internally and appends only prose anchors to UI-driven continuation briefs.
- `STORY_LAB_NARRATIVE_DIALS_UI_EXEC_PLAN.md` records the original RED/GREEN proof, and `story-generator/src/app/app.spec.ts` covers every narrative dial option.
- Future numeric story-state translators can build on this pattern, but this idea is no longer an unstarted Weird Lab item.

### Done: Continuity Courtroom

Before a continuation runs, generate a compact list of contradictions, open promises, and unresolved emotional debts.

Why it might matter:

- It gives the model a clearer memory target.
- It could make continuations feel less generic.

Experiment:

- Start with deterministic extraction from current story state.
- Add one optional AI-assisted review later.
- Show the result as a hidden generation anchor or Director's Room note.

Status:

- Done in overnight slice on 2026-06-08.
- Real Story Lab continuations now append a hidden `Continuity Courtroom` anchor to the continuation request sent through `StoryService.continueChapter`.
- The anchor is deterministic and compact: it includes unresolved plot threads, unresolved lore artifacts, and continuity warnings from `StoryStateSnapshot`.
- Resolved threads and resolved artifacts are intentionally filtered out so already-paid debts do not keep polluting the next chapter.
- Verified by `tests/story-lab-real-engine.test.ts`, which captures the service input and proves the anchor reaches the real-engine seam.

### Done: Chapter Ending Stress Test

Generate or score three possible chapter-ending directions before selecting the final continuation brief.

Why it might matter:

- Current story quality depends heavily on endings and hooks.
- A cheap ending review could create more serialized momentum.

Experiment:

- Produce three ending intents: emotional reveal, danger escalation, secret exposed.
- Score for specificity, consequence, and next-chapter pull.
- Use the winning intent as continuation context.

Status:

- Done in overnight slice on 2026-06-08.
- Real Story Lab continuations now append a hidden `Chapter Ending Stress Test` anchor alongside the continuity courtroom anchor.
- The anchor lists the three ending candidates, chooses one deterministic ending pressure from current story state plus the continuation brief, and tells the model to answer one question while leaving a sharper one active.
- The first selector is intentionally simple and deterministic. It does not claim to evaluate generated prose quality.
- Verified by `tests/story-lab-real-engine.test.ts`, which captures the continuation service input and proves the ending-pressure anchor reaches the real-engine seam.

### Weird Lab: Cliche Alarm

Name the most obvious stale version of the next scene, then instruct the generator to avoid that path.

Why it might matter:

- Trope freshness is already a story-quality concern.
- A negative target can be simpler than a complex creativity prompt.

Experiment:

- Add a pre-generation "avoid this obvious beat" note.
- Compare output against existing trope-subversion checks.

### Weird Lab: Scene Pressure Mixer

Combine emotional, secret, deadline, social, and setting pressure into one compact continuation anchor.

Why it might matter:

- Villain pressure already works as a UI concept.
- A broader pressure mixer could make continuations more dynamic without adding many new controls.

Experiment:

- Use existing villain pressure UI as the first source.
- Add one random secondary pressure only when it does not contradict the story state.
- Keep the generated brief visible to the user.

## Idea Template

Use this template when adding new ideas:

```md
### Status: Idea Name

Origin:

Hypothesis:

User value:

Smallest experiment:

Guardrails:

Acceptance:
```
