# BOOTSTRAP-SCOUT-001 — Map tracked dependency directories

Created: 2026-08-19 08:47 EDT

## Identity

- **Ticket ID:** `BOOTSTRAP-SCOUT-001`
- **Parent epic:** Bootstrap subagent controls
- **Ticket type:** `DISCOVERY`
- **Risk:** `LOW`
- **Base branch:** `main`
- **Base commit SHA:** `c52d8b7da1441e5308d253299de49742e2298a48`
- **Dependencies:** None
- **Blocked by:** None
- **Status:** `DONE`

## 1. One-sentence objective

> Identify the complete tracked `node_modules` boundary and return the exact removal and verification scope without modifying the repository.

## 2. Why this ticket exists

The base repository tracks installed dependency material even though dependency directories should be reproduced from manifests and lockfiles.

Current evidence:

- **Main tree:** `e78beca405bb5bb16da0a8ff97339d8fd2003f08`
- **Observed top-level path:** `node_modules/`
- **Existing ignore rule:** root `.gitignore` contains `node_modules/`
- **Related launch concern:** deterministic repository state and elimination of vendored installed dependencies

## 3. Current contract

The Git tree for the named base SHA includes a tracked root `node_modules/` subtree.

## 4. Target discovery contract

The scout identifies every tracked dependency-directory boundary, confirms the manifest and lockfile locations, and gives an implementation whitelist that requires no application or dependency-version changes.

## 5. Prerequisite verification

- [x] The named base SHA is the current `main` SHA at the time of the scout.
- [x] Root `.gitignore`, manifests, and lockfiles exist.
- [x] The root and `story-generator` Git trees are inspectable.
- [x] No repository writes are required.

## 6. In scope

- Inspect the base repository tree.
- Identify tracked paths at or beneath any `node_modules` directory.
- Confirm whether root and `story-generator` manifests and lockfiles exist.
- Confirm the current ignore rule.
- Recommend the narrowest deletion-only implementation boundary and validation checks.

## 7. Explicitly out of scope

- No repository writes.
- No deletion commit.
- No `.gitignore` change.
- No dependency installation or upgrade.
- No CI, deployment, source, test, or documentation change.
- No merge or PR closure.

## 8. Write whitelist

None. This ticket is read-only.

## 9. Write blacklist

All repository paths.

## 10. Change budget

- **Repository writes:** `0`
- **Commits:** `0`

Any write would fail this ticket.

## 11. Acceptance criteria

### AC1 — Complete tracked boundary

The scout identifies the exact Git subtree containing all tracked installed dependencies.

### AC2 — Nested application check

The scout determines whether `story-generator/node_modules/` is tracked independently.

### AC3 — Reproducibility inputs

The scout confirms the presence of root and `story-generator` manifests and lockfiles.

### AC4 — Narrow implementation scope

The scout proposes a deletion-only whitelist and does not recommend dependency or source changes.

## 12. Required invariant checks

- Inspect the recursive `main` tree.
- Inspect the root `node_modules` tree.
- Inspect the top-level `story-generator` tree.
- Inspect `.gitignore`.

## 13. Validation commands for a local runner

```bash
git rev-parse HEAD
git ls-files | grep -E '(^|/)node_modules/'
git check-ignore -v node_modules/.package-lock.json
git check-ignore -v story-generator/node_modules/.sentinel
test -f package.json
test -f package-lock.json
test -f story-generator/package.json
test -f story-generator/package-lock.json
```

Equivalent Git tree and file inspection is acceptable when a local clone is unavailable, but the completion report must say which method was used.

## 14. Stop conditions

Stop with `BLOCKED` if:

- the base SHA changes before inspection and the coordinator does not supply a replacement,
- the tree cannot be inspected,
- a product or dependency-version decision is unexpectedly required.

Do not repair anything.

## 15. Scout outcome

```text
TASK: BOOTSTRAP-SCOUT-001
BASE SHA: c52d8b7da1441e5308d253299de49742e2298a48
FINAL SHA: N/A
STATUS: PASS

CHANGED:
- None

CONTRACT BEFORE:
The base Git tree contains installed dependency material at a tracked root node_modules path.

CONTRACT AFTER:
No repository contract changed. The complete deletion boundary and validation scope are known.

ACCEPTANCE CRITERIA:
- AC1: PASS — all tracked dependency material is contained beneath the root node_modules tree at SHA 5de7fa9eb4ab1b79411e32001f9411cb9e9c795d.
- AC2: PASS — the story-generator tree has no tracked node_modules entry.
- AC3: PASS — both package.json files and both package-lock.json files exist.
- AC4: PASS — the implementer needs deletion permission only for node_modules/**.

VALIDATION:
- Recursive main-tree inspection -> PASS
- Root node_modules-tree inspection -> PASS
- story-generator top-level tree inspection -> PASS
- Root .gitignore inspection -> PASS; node_modules/ is already ignored

DIFF BUDGET:
- Production files: 0
- Test files: 0
- Non-generated changed lines: 0
- Budget exceeded: NO

UNRELATED CHANGES:
- None

RISKS:
- A base-to-head diff must still be reviewed after implementation to prove no path outside node_modules/ changed.

FOLLOW-UP TICKETS SUGGESTED:
- BOOTSTRAP-IMPLEMENT-001
- BOOTSTRAP-REVIEW-001

SAFE FOR COORDINATOR REVIEW:
YES
```
