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

### Now: Auth, Profiles, And Cloud Library Plan

Turn auth/storage/profiles into a concrete implementation plan before touching provider code.

Acceptance:

- Provider decision points are explicit.
- User profile contract is sketched.
- Cloud project save/list/load/delete flow is scoped.
- Route/function budget impact is called out.
- Owner-isolation tests are listed.

### Now: Mock Word Budget Gap

The root tests pass while mock generation ignores requested story length. Decide whether mocks should scale with requested word count or whether tests should stop presenting mock length as quality evidence.

Acceptance:

- Either mock generation roughly scales with requested length, or the tests make the limitation explicit.
- The story-quality checks record length variance as a meaningful signal.

### Soon: Live Provider Proof

Run live-provider verification only when `XAI_API_KEY` is available. The proof must show provider telemetry and not merely "request did not crash."

Acceptance:

- Exact command documented.
- Missing-key behavior skips cleanly.
- Live run proves Grok/non-mock telemetry when credentials exist.

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

### Research: User Library And Profile Patterns

Research how creative apps present account identity, project libraries, saved drafts, and profile/taste preferences.

Output:

- Recommended profile fields for this app.
- What should stay local/private.
- What should sync.
- What should never be logged.

## Weird Lab Queue

### Weird Lab: Tension Thread Translator

Build a tiny deterministic translator that turns numeric/internal narrative state into prose anchors before generation.

Why it might matter:

- The user explicitly liked the idea that dials should become concrete prose instead of showing only numbers.
- It could improve story continuity without exposing mechanical labels to the model.

Experiment:

- Pick 3 to 5 threads.
- Map each to behavioral prose.
- Feed only prose anchors into continuation context.
- Compare before/after continuation samples.

### Weird Lab: Continuity Courtroom

Before a continuation runs, generate a compact list of contradictions, open promises, and unresolved emotional debts.

Why it might matter:

- It gives the model a clearer memory target.
- It could make continuations feel less generic.

Experiment:

- Start with deterministic extraction from current story state.
- Add one optional AI-assisted review later.
- Show the result as a hidden generation anchor or Director's Room note.

### Weird Lab: Chapter Ending Stress Test

Generate or score three possible chapter-ending directions before selecting the final continuation brief.

Why it might matter:

- Current story quality depends heavily on endings and hooks.
- A cheap ending review could create more serialized momentum.

Experiment:

- Produce three ending intents: emotional reveal, danger escalation, secret exposed.
- Score for specificity, consequence, and next-chapter pull.
- Use the winning intent as continuation context.

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
