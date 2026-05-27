#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
STORY_GENERATOR_DIR="${REPO_ROOT}/story-generator"
ROOT_TSC="${REPO_ROOT}/node_modules/.bin/tsc"
STORY_GENERATOR_TSC="${STORY_GENERATOR_DIR}/node_modules/.bin/tsc"

RUN_TESTS=1
RUN_TYPECHECK=1
RUN_BUILD=1
RUN_STATUS=1

usage() {
  cat <<'USAGE'
Usage: scripts/recovery/preflight.sh [options]

Runs the PR #70 recovery branch validation checks.

Options:
  --quick          Run git diff checks and type checks only.
  --skip-status   Do not print git status at the end.
  --skip-tests    Skip npm test.
  --skip-build    Skip Angular production build and build output verification.
  --help          Show this help text.

Default checks:
  1. Required tool availability.
  2. git diff --check.
  3. Angular app/spec and Vercel API type checks.
  4. Root npm test suite.
  5. Angular production build through Node 20.
  6. Root build output verification.
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --quick)
      RUN_TESTS=0
      RUN_BUILD=0
      ;;
    --skip-status)
      RUN_STATUS=0
      ;;
    --skip-tests)
      RUN_TESTS=0
      ;;
    --skip-build)
      RUN_BUILD=0
      ;;
    --help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
  shift
done

step() {
  local message="$1"
  printf '\n==> %s\n' "${message}"
}

require_command() {
  local command_name="$1"
  if ! command -v "${command_name}" >/dev/null 2>&1; then
    echo "Missing required command: ${command_name}" >&2
    exit 127
  fi
}

cd "${REPO_ROOT}"

step "Checking required tools"
require_command git
require_command npm
require_command npx
require_command node

if command -v jq >/dev/null 2>&1; then
  jq --version
else
  echo "jq is not installed; PR JSON summaries will be less convenient, but preflight can continue."
fi

step "Checking whitespace/conflict markers"
git diff --check

step "Checking deployable Vercel function count"
"${SCRIPT_DIR}/check-vercel-function-count.sh"

if [[ ${RUN_TYPECHECK} -eq 1 ]]; then
  step "Type checking Angular app"
  cd "${STORY_GENERATOR_DIR}"
  "${STORY_GENERATOR_TSC}" -p tsconfig.app.json --noEmit

  step "Type checking Angular specs"
  "${STORY_GENERATOR_TSC}" -p tsconfig.spec.json --noEmit
  cd "${REPO_ROOT}"

  step "Type checking Vercel API functions"
  find api -name '*.ts' ! -name '*.spec.ts' ! -name '*.test.ts' -print0 \
    | xargs -0 "${ROOT_TSC}" --noEmit --target es2020 --lib es2020,dom --module commonjs \
        --moduleResolution node --esModuleInterop --skipLibCheck --types node
fi

if [[ ${RUN_TESTS} -eq 1 ]]; then
  step "Running root test suite"
  npm test
fi

if [[ ${RUN_BUILD} -eq 1 ]]; then
  step "Building Angular app with Node 20"
  cd "${STORY_GENERATOR_DIR}"
  npx -p node@20 -c "node -v && npm run build"
  cd "${REPO_ROOT}"

  step "Verifying build output"
  npm run build:verify
fi

if [[ ${RUN_STATUS} -eq 1 ]]; then
  step "Current git status"
  git status --short
fi

step "Preflight completed"
