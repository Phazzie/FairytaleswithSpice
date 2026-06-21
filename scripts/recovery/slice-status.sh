#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
cd "${REPO_ROOT}"

warn() {
  local message="$1"
  printf 'WARNING: %s\n' "${message}" >&2
}

current_branch="$(git branch --show-current 2>/dev/null || true)"
head_sha="$(git rev-parse --short HEAD)"
branch_ref="$(git symbolic-ref -q HEAD || true)"
upstream=""
if [[ -n "${branch_ref}" ]]; then
  upstream="$(git for-each-ref --format='%(upstream:short)' "${branch_ref}" 2>/dev/null || true)"
fi

printf 'Story Lab slice status\n'
printf '======================\n'
printf 'Branch: %s\n' "${current_branch:-detached HEAD}"
printf 'HEAD: %s\n' "${head_sha}"

if [[ -n "${upstream}" ]]; then
  printf 'Upstream: %s\n' "${upstream}"
  upstream_remote="${upstream%%/*}"
  upstream_branch="${upstream#*/}"
  if git rev-parse --verify --quiet "${upstream}" >/dev/null \
    && git ls-remote --exit-code --heads "${upstream_remote}" "${upstream_branch}" >/dev/null 2>&1; then
    read -r upstream_behind upstream_ahead < <(git rev-list --left-right --count "${upstream}...HEAD")
    printf 'Delta vs upstream: ahead %s, behind %s\n' "${upstream_ahead}" "${upstream_behind}"
  else
    warn "Configured upstream ${upstream} is missing or gone."
  fi
else
  warn "No upstream is configured for this branch."
fi

if git rev-parse --verify --quiet origin/main >/dev/null; then
  read -r main_behind main_ahead < <(git rev-list --left-right --count origin/main...HEAD)
  printf 'Delta vs origin/main: ahead %s, behind %s\n' "${main_ahead}" "${main_behind}"

  if git merge-base --is-ancestor HEAD origin/main; then
    printf 'Merge status: HEAD is already contained in origin/main.\n'
  fi

  if [[ "${main_ahead}" -gt 12 ]]; then
    warn "Branch is ${main_ahead} commits ahead of origin/main; check whether this already spans multiple slices."
  fi
else
  warn "origin/main is not available locally; fetch before publication decisions."
fi

status_output="$(git status --porcelain=v1)"
tracked_count="$(printf '%s\n' "${status_output}" | sed '/^$/d; /^??/d' | wc -l | tr -d ' ')"
untracked_count="$(printf '%s\n' "${status_output}" | sed -n '/^??/p' | wc -l | tr -d ' ')"

printf 'Tracked changes: %s\n' "${tracked_count}"
printf 'Untracked files: %s\n' "${untracked_count}"

if [[ "${tracked_count}" -gt 0 || "${untracked_count}" -gt 0 ]]; then
  printf '\nWorking tree detail:\n'
  git status --short
fi

printf '\nRecent commits:\n'
git log --oneline --decorate -n 8

printf '\nVercel route budget:\n'
if ! "${SCRIPT_DIR}/check-vercel-function-count.sh"; then
  warn "Vercel function-count check failed; fix route budget before route work or PR merge."
fi

printf '\nRecommended next check:\n'
printf '  npm run recovery:preflight -- <slice-name> --dry-run\n'
