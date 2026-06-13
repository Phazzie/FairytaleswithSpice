# Overnight Mode

Last updated: 2026-06-13

## Purpose

Overnight Mode is the operating guide for long autonomous coding sessions on Fairytales with Spice. It lets an agent keep working after one coherent task is done without drifting into random unsafe changes.

## Core Rule

Do not stop just because one task is done. Finish a coherent slice, validate it, push it, open a PR, address checks and review comments, and merge it before selecting another feature slice.

Continuing after a slice means continuing through publication. If a committed slice is not pushed, PR'd, reviewed, and merged, the next autonomous task is publishing or recovery, not another feature.

Stopping is appropriate when:

- a destructive or credential-sensitive action would be required;
- the same blocker has repeated and there is no meaningful local progress left;
- tests reveal a serious regression that needs user direction before riskier repair;
- the user explicitly says to stop or pause;
- external services, secrets, billing, or account-provider setup are required and cannot be safely inferred.

## Start Of Run Checklist

Run or inspect these before making changes:

1. `git status --short --branch`
2. `gh pr list --state open --json number,title,headRefName,baseRefName,url,reviewDecision`
3. `scripts/recovery/check-vercel-function-count.sh`
4. `scripts/recovery/preflight.sh --quick --skip-status`
5. `npm run test:all` when the change risk justifies the time
6. Read or skim:
   - `AGENTS.md`
   - `STORY_LAB_UNPUBLISHED_BRANCH_SPLIT_PLAN.md`
   - `STORY_LAB_IDEA_BOARD.md`
   - the execution plan matching the files being changed

If checks are already failing before edits, record the baseline failure in the active changelog or execution plan and prioritize repair before feature work.

## Task Selection Order

Use this order when the user has not given a newer explicit task:

1. User's newest explicit request.
2. Open PR review comments or failing CI.
3. Failing local checks from the start-of-run checklist.
4. The next unchecked publishing step in `STORY_LAB_UNPUBLISHED_BRANCH_SPLIT_PLAN.md`.
5. The next unchecked gate in the active execution plan.
6. Source-backed research ideas from `STORY_LAB_IDEA_BOARD.md`.
7. One bounded Weird Lab experiment from `STORY_LAB_IDEA_BOARD.md`.
8. Documentation cleanup that improves future autonomous runs.

## Lane Weights

When nothing is urgent and several tasks are valid, use this rough mix:

- 40 percent repair, tests, review comments, and cleanup that removes real risk.
- 25 percent planned product or platform progress.
- 20 percent story-quality improvement or competitor/research mining.
- 15 percent Weird Lab experiment.

If a required check fails, ignore the weights and repair the failure first.

## GitHub Issues

The user does not need to create issues for every task. Issues are useful when work needs durable tracking outside the current branch.

Create or recommend a GitHub issue for:

- user-visible features that will take more than one PR;
- bugs likely to recur;
- research tasks with source links and follow-up experiments;
- provider decisions such as auth, storage, email, Blob, or Workflow;
- work that is blocked on credentials, billing, project setup, or user preference.

Do not require an issue for:

- small docs updates;
- one-file test fixes;
- local cleanup with obvious acceptance criteria;
- immediate PR review comments;
- short experiments that will be reverted or parked if they do not work.

If no issue exists, log the task in the active execution plan, recovery changelog, or idea board.

## Research Mining Rules

Research is allowed when it is source-backed and transformed into this app's language.

For each research pass:

1. Search current web sources. Do not rely on memory for product features, pricing, platform rules, or provider capabilities.
2. Capture links and access dates in `STORY_LAB_IDEA_BOARD.md` or a dedicated research note.
3. Write what the competing or adjacent product does in plain words.
4. Translate the idea into a Fairytales with Spice experiment.
5. Do not copy protected text, UI, branding, or exact product structure.
6. Prefer small prototypeable insights over broad market summaries.

Good research targets:

- AI novel-writing assistants.
- Serialized fiction reading apps.
- Interactive fiction tools.
- Writing critique and revision tools.
- Roleplay/chat story apps.
- Creator workflow tools that handle drafts, versions, notes, and memory.

## Weird Lab Rules

Weird Lab work is for small creative experiments that might make story output more distinctive.

Rules:

- Timebox the experiment to 30, 60, or 90 minutes.
- Put it behind a clear seam, local flag, or isolated branch.
- Add a tiny acceptance test or a before/after sample.
- Never merge a weird experiment unless it proves value and passes normal gates.
- If the experiment fails, record why and park it instead of hiding it.

Examples:

- A "tension thread" translator that turns internal state into prose anchors.
- A "continuity courtroom" that lists contradictions before a continuation runs.
- A "chapter ending stress test" that generates three possible final lines and scores which one pulls hardest.
- A "cliche detector" that intentionally names the most obvious trope so the writer can dodge it.
- A "scene pressure mixer" that combines emotional, deadline, secret, and setting pressures into one continuation brief.

## Commit Cadence

Commit after coherent, reviewable slices. Do not commit every tiny edit just to show activity.

Before committing:

- run `git diff --check`;
- run the focused tests for files touched;
- run the function-count check when route files or `vercel.json` change;
- update docs if the work changes plan state;
- inspect `git diff --stat` so unrelated untracked or user files are not accidentally included.

Useful commit scopes:

- one doc package;
- one test-backed bug fix;
- one UI slice;
- one provider/storage/auth seam;
- one research note plus idea-board update.

## Safety Gates

Do not cross these without explicit user approval or a written provider decision:

- Adding production auth provider dependencies.
- Creating, deleting, or migrating real databases.
- Adding paid provider usage.
- Storing user story text in a new external service.
- Adding deployable Vercel route files when function count would reach or exceed the limit.
- Changing secrets, billing, domains, DNS, or production deployment settings.
- Reintroducing DigitalOcean as the active deployment target.
- Reopening audio runtime work.

Never claim:

- "cloud save" unless signed-in save/load/list/delete works against durable storage;
- "durable jobs" unless progress survives process loss;
- "live AI verified" unless provider telemetry proves it was not mock mode;
- "review comments addressed" unless current PR review comments were inspected.

## End Of Run Handoff

Before the session ends, update the active execution plan or recovery changelog with:

- branch and commit;
- what changed in normal people words;
- files touched;
- checks run and exact result;
- known failures or skipped checks;
- whether anything was committed or left uncommitted;
- the next best task.

If work continues after the handoff, keep that record fresh after each coherent slice.
