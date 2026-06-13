# Story Lab Idea Board

Last updated: 2026-06-13

## Purpose

This board is the parking lot and selection queue for product ideas, research leads, story-quality improvements, and bounded Weird Lab experiments. It exists so autonomous work can be creative without becoming random.

## Status Labels

- `Now`: should be picked up soon unless a newer user request supersedes it.
- `Soon`: valuable but not first in line.
- `Research`: needs current source review before implementation.
- `Weird Lab`: small experiment, not guaranteed product work.
- `Parked`: useful but blocked or not timely.
- `Done`: implemented, reviewed, and merged.
- `Local-only`: implemented or drafted on an unpublished local branch and not yet available on `main`.
- `Rejected`: considered and intentionally not taken.

## Current Priorities

### Done: Publication Discipline

PR #114 merged on 2026-06-13 and added hard guardrails for publishing validated slices before starting more feature work.

Acceptance evidence:

- PR #114 checks passed.
- PR #114 review comments were answered.
- The PR was merged into `main`.

### Now: Split The Unpublished Story Lab Stack

The local `feature/story-lab-auth-profile-contracts` branch contains a large stack of useful work that must be recovered as reviewable PRs rather than landed all at once.

Acceptance:

- Each slice starts from current `origin/main`.
- Each slice has focused validation evidence.
- Each slice is pushed, reviewed, fixed, and merged before the next feature slice.
- The backup branch remains only a safety anchor.

Tracking:

- `STORY_LAB_UNPUBLISHED_BRANCH_SPLIT_PLAN.md`

### Now: Auth, Profiles, And Cloud Library Plan Baseline

The app has route-free storage and auth seams, but signed-in cloud library behavior is not live. The next plan baseline must keep provider, database, profile, route, and UI work split into reviewable PRs.

Acceptance:

- Provider decision points are explicit.
- User profile contract is sketched.
- Cloud project save/list/load/delete flow is scoped.
- Route/function budget impact is called out.
- Owner-isolation tests are listed.
- The plan does not claim cloud sync is live.

Tracking:

- `STORY_LAB_AUTH_PROFILE_CLOUD_LIBRARY_EXEC_PLAN.md`

### Now: Storage Plan Reconciliation

The storage port plan should continue to distinguish the merged route-free Phase C scaffold from unfinished account/cloud sync work.

Acceptance:

- `STORY_LAB_STORAGE_PORT_EXEC_PLAN.md` records PR #102 as merged.
- Current route count wording reflects the post-route-budget baseline.
- Remaining work points to auth/profile/cloud-library planning instead of treating storage-port scaffolding as unfinished.

### Soon: Auth And Profile Contracts

Add the account/profile domain seam without live provider or database claims.

Candidate source commits from the local stack:

- `75b485f Add Story Lab auth profile contract slice`
- `6459454 Add Story Lab profile store slice`
- `b99ad12 Add Clerk auth adapter scaffold`
- `99317f1 Add env-gated Story Lab Clerk auth config`
- `448d0c3 Harden Story Lab profile preferences`

Acceptance:

- Missing auth provider config fails closed.
- The Clerk-shaped adapter does not turn raw tokens into users without an injected verifier.
- Profile preferences are normalized as runtime data.
- Tests prove profile contracts, configured auth, Clerk adapter behavior, and profile store behavior.
- PR language says "contracts/store seams/scaffold," not "cloud library shipped."

### Soon: Cloud Storage And Database Scaffold

Add schema, migration, readiness, and storage-config seams while staying guarded when no real `DATABASE_URL` exists.

Acceptance:

- Schema and readiness tests are deterministic.
- Real database scripts refuse to run without explicit `DATABASE_URL`.
- No live cloud persistence is claimed without executed migration and live smoke evidence.

### Soon: Consolidated Account Route

Add one deployable account route for profile and project cloud library operations without spending multiple Vercel function slots.

Acceptance:

- Function count stays within the Vercel limit.
- Route tests prove fail-closed auth, credentialed CORS, profile read/write, project save/list/load/delete, cross-owner denial, and missing-storage failures.
- The route remains one consolidated function target.

### Soon: Angular Cloud Library UI

Expose local-vs-cloud library state honestly in the Angular app while preserving anonymous browser-local saves.

Acceptance:

- Local browser saves remain visible and usable.
- Cloud controls do not call account routes while account/cloud sync is unavailable.
- Non-durable account storage is not displayed as cloud-available.
- Angular specs cover unavailable, refresh, save, load, delete, and error states.

## Research Notes

Source-backed notes from 2026-06-08, kept as planning context only:

- Supabase Auth models permanent and anonymous users, issues access tokens tied to users, and supports RLS-driven access. Its docs warn that user-editable metadata must not be used for security-sensitive authorization. Source: https://supabase.com/docs/guides/auth/users, accessed 2026-06-08.
- Vercel's Postgres guidance says new projects should use Marketplace Postgres integrations rather than legacy Vercel Postgres. Source: https://vercel.com/docs/postgres, accessed 2026-06-08.
- Vercel's Workflow material positions Workflow SDK as the path for long-running durable work with step isolation, retries, persistence, and observability. Sources: https://vercel.com/workflows and https://vercel.com/blog/a-new-programming-model-for-durable-execution, accessed 2026-06-08.
- Clerk backend docs describe bearer session tokens for cross-origin requests and the `__session` cookie for same-origin requests. Any Clerk adapter must verify tokens through an explicit verifier and fail closed without one. Sources: https://clerk.com/docs/request-authentication/backend and https://clerk.com/docs/backend-requests/manual-jwt, accessed 2026-06-08.

## Parked Local Artifacts

These files were observed as local untracked workspace artifacts and must not be committed automatically:

- `SPARK_TRIAL_TASKS.md`
- `STORY_LAB_REVIEW_MISTAKES_2026-06-09.md`
- `STORY_QUALITY_EVALS_PLAN.md`
- `tests/grok-smoke.test.ts`

Adopt any material from them only through a separate cleanup decision with focused review.

## Weird Lab Candidates

These remain candidates until implemented and merged:

- Continuity courtroom: visible contradiction or unresolved-debt preview before continuation.
- Chapter ending stress test: generate and compare candidate ending pressures.
- Cliche alarm: name the obvious stale path so a continuation can dodge it.
- Scene pressure mixer: combine emotional, deadline, secret, and setting pressures into one continuation brief.
- Memory-card trigger shelf: let users pin durable story facts before continuation.
