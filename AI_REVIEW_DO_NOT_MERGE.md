Created: 2026-06-21 08:01 EDT
Updated: 2026-06-21 21:23 UTC

# AI Review Reference Branch - Do Not Merge

This branch is intentionally not mergeable.

Branch: `ai-review/story-lab-unsliced-reference-do-not-merge`
Source stack: `feature/story-lab-auth-profile-contracts`
Source commit: `35a3d1bc6186031affacdeb196ff878277de3ef8`
Current production baseline for future real work: `origin/main` after PR #166 merged as `0a56f96ad723d5a96508bfc4cc9b0cb74631297f`

## Purpose

Use this branch only as a reference snapshot for another AI reviewer. It contains the raw unpublished Story Lab stack, including work that has already been extracted and merged through recovery PRs, plus remaining unsliced work that still needs reviewable recovery slices.

Do not open a merge PR from this branch. Do not merge this branch into `main`.

## Review Focus

The useful review target is the remaining unsliced work, not the already-merged recovery slices.

Remaining planned implementation slices / follow-ups:

- `quality-report-proving-grounds`
- `story-memory-cards`
- `css-lazy-loading`
- production auth/accounts live-provider wiring beyond the scaffolded profile/account/storage ports
- xAI timeout budget follow-up: #167
- typed API handler boundary cleanup: #168
- recovered metadata/markdown lint cleanup: #169
- expanded-creature trope coverage decision: #170

Review-thread cleanup status as of this update:

- PR #99, #98, #97, #92, #90, and #87 all have zero unresolved review threads by GraphQL audit.
- PR #166 merged the PR #90 response-handling follow-ups and was validated before merge.
- Issue #152 was closed after the old review-thread backlog was either resolved with evidence or converted to issues #167-#170.

Known durable-job follow-up issues already tracked from PR #124 review:

- #125: transaction-capable Postgres job mutations before durable rollout
- #126: route-backed job execution should handle engine exceptions
- #127: concurrent index migration strategy before live durable tables

## Important Caveats

- This branch includes stale docs and commits that were intentionally split into smaller PRs.
- This branch is not rebased onto the current production baseline. That is intentional: it is a raw reference snapshot for review, not a merge candidate.
- Current real implementation branches must be created from `origin/main`, not from this branch.
- Local untracked files in the main worktree were intentionally not added here:
  - `SPARK_TRIAL_TASKS.md`
  - `STORY_LAB_REVIEW_MISTAKES_2026-06-09.md`
  - `STORY_QUALITY_EVALS_PLAN.md`
  - `tests/grok-smoke.test.ts`
- Treat this branch as an audit aid only. Any accepted finding should become a focused slice, issue, or comment on the relevant PR.
