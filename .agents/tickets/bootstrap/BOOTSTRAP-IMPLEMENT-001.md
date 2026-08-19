# BOOTSTRAP-IMPLEMENT-001 — Remove tracked root dependency directory

Created: 2026-08-19 08:48 EDT

## Identity

- **Ticket ID:** `BOOTSTRAP-IMPLEMENT-001`
- **Parent epic:** Bootstrap subagent controls
- **Ticket type:** `IMPLEMENTATION`
- **Risk:** `LOW`
- **Base branch:** `main`
- **Base commit SHA:** `c52d8b7da1441e5308d253299de49742e2298a48`
- **Dependencies:** `BOOTSTRAP-SCOUT-001`
- **Blocked by:** None
- **Status:** `DONE`
- **Implementation branch:** `bootstrap/remove-tracked-node-modules`
- **Implementation commit:** `58f9db72a39a4ebac8b3246fcd33508cbbac4a9e`
- **Pull request:** `#199`

## Coordinator assignment wrapper

```text
You are a scoped implementation subagent, not the project coordinator.

Complete only the attached ticket. You may inspect the repository broadly, but
you may write only to the ticket's whitelist. Do not repair prerequisites,
redesign neighboring systems, or implement suggested follow-up work.

Before editing, verify the named prerequisite state and base SHA. If the ticket
cannot be completed within its file and change budget, stop and return
NEEDS_SPLIT. A smaller correct result is preferable to a broader speculative
result.

Do not merge your branch or close any PR or issue. Run the ticket's exact
validation commands and return the required completion report.
```

## 1. One-sentence objective

> Remove every tracked file beneath the root `node_modules/` tree without changing manifests, lockfiles, application code, dependency versions, or ignore rules.

## 2. Why this ticket exists

The base Git tree tracks an installed dependency directory at `node_modules/`, even though the root `.gitignore` already excludes that directory and the dependency graph is represented by `package.json` and `package-lock.json`.

## 3. Current contract

The base commit includes the root `node_modules/` Git tree at SHA `5de7fa9eb4ab1b79411e32001f9411cb9e9c795d`.

## 4. Target contract

The proposed head tree has no root `node_modules/` entry, and every path outside that subtree is byte-for-byte inherited from the base tree.

## 5. Prerequisite verification

- [x] `BOOTSTRAP-SCOUT-001` completed.
- [x] Base SHA and main-tree SHA were verified before implementation.
- [x] Root `.gitignore` already ignores `node_modules/`.
- [x] No nested `story-generator/node_modules/` tree is tracked.
- [x] No active ticket owns the deletion path.

## 6. In scope

- Delete the complete tracked root `node_modules/` subtree from the proposed Git tree.
- Produce base-to-head changed-path evidence.

## 7. Explicitly out of scope

- No `.gitignore` edit.
- No `package.json` or lockfile edit.
- No dependency install or upgrade.
- No application, test, CI, deployment, migration, or documentation edit.
- No cleanup of other generated files.
- No merge, issue closure, or production-readiness claim.

## 8. Write whitelist

- `node_modules/**` — deletion only

## 9. Write blacklist

- `.gitignore`
- `package.json`
- `package-lock.json`
- `story-generator/package.json`
- `story-generator/package-lock.json`
- `.github/**`
- `api/**`
- `story-generator/src/**`
- `tests/**`
- `vercel.json`
- all documentation paths

## 10. Change budget

- **Behavioral contracts:** `1`
- **Added production lines:** `0`
- **Modified non-dependency files:** `0`
- **Deleted dependency files:** complete tracked root subtree permitted
- **New abstractions:** `0`

Any addition or modification outside `node_modules/**` requires `NEEDS_SPLIT`.

## 11. Acceptance criteria

### AC1 — Dependency tree absent

The proposed head tree contains no root `node_modules` entry.

### AC2 — Reproducibility inputs unchanged

Root and `story-generator` manifests and lockfiles do not change.

### AC3 — No source or configuration drift

No path outside `node_modules/` appears in the base-to-head comparison.

### AC4 — Ignore rule preserved

`.gitignore` is unchanged and continues to ignore `node_modules/`.

## 12. Required invariant check

- **Pre-change result:** base tree includes `node_modules/`.
- **Post-change result:** head tree omits `node_modules/`.
- **Scope result:** every changed path is removed and begins with `node_modules/`.

## 13. Validation commands for a local runner

```bash
BASE_SHA=c52d8b7da1441e5308d253299de49742e2298a48

test -z "$(git ls-files | grep -E '(^|/)node_modules/' || true)"
git diff --exit-code "$BASE_SHA"...HEAD -- \
  .gitignore \
  package.json package-lock.json \
  story-generator/package.json story-generator/package-lock.json

test -z "$(git diff --name-only "$BASE_SHA"...HEAD | grep -Ev '^node_modules/' || true)"
test -z "$(git diff --diff-filter=ACMRTUXB --name-only "$BASE_SHA"...HEAD || true)"
git diff --check "$BASE_SHA"...HEAD
git status --short
```

Equivalent Git tree comparison is permitted when no local clone is available. Report the substitution explicitly.

## 14. Implementation constraints

- Preserve all non-`node_modules` tree entries exactly.
- Do not regenerate lockfiles.
- Do not run a dependency updater.
- Do not add an empty placeholder directory.

## 15. Stop conditions

Stop with `BLOCKED` or `NEEDS_SPLIT` if:

- the base SHA changes before implementation,
- `.gitignore` no longer excludes the path,
- a nested dependency directory outside the scoped root tree is discovered,
- any correct implementation requires a manifest, lockfile, CI, or source change.

## 16. Completion report

```text
TASK: BOOTSTRAP-IMPLEMENT-001
BASE SHA: c52d8b7da1441e5308d253299de49742e2298a48
FINAL SHA: 58f9db72a39a4ebac8b3246fcd33508cbbac4a9e
STATUS: PASS

CHANGED:
- node_modules/** — deletion only

CONTRACT BEFORE:
The repository tracked an installed root dependency tree despite the existing node_modules ignore rule.

CONTRACT AFTER:
The proposed Git tree contains no root node_modules entry. Dependency manifests, lockfiles, source code, CI, deployment configuration, documentation, and ignore rules are unchanged.

ACCEPTANCE CRITERIA:
- AC1: PASS — the head tree removes the complete root node_modules subtree.
- AC2: PASS — neither root nor story-generator manifests or lockfiles appear in the diff.
- AC3: PASS — base-to-head comparison contains only removed node_modules paths.
- AC4: PASS — .gitignore is unchanged and already ignores node_modules/.

VALIDATION:
- Git tree comparison base..head -> PASS; one commit ahead and zero behind.
- Changed-path/status review -> PASS.
- PR #199 stats -> PASS; 503 removed files, 0 additions, 107958 deletions.
- Local shell commands -> NOT RUN; connector Git-tree comparison was used because a full local clone was unavailable.

DIFF BUDGET:
- Production files: 0
- Test files: 0
- Added non-generated lines: 0
- Budget exceeded: NO

UNRELATED CHANGES:
- None

RISKS:
- Repository CI availability is a separate account/billing blocker and is not addressed here.

FOLLOW-UP TICKETS SUGGESTED:
- BOOTSTRAP-REVIEW-001

SAFE FOR COORDINATOR REVIEW:
YES
```
