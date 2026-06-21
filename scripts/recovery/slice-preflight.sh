#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
EVIDENCE_DIR="${REPO_ROOT}/tmp/recovery"
ANGULAR_SPEC_TSC="npx -p node@20 node ./node_modules/typescript/bin/tsc -p story-generator/tsconfig.spec.json --noEmit"
ANGULAR_APP_TSC="npx -p node@20 node ./node_modules/typescript/bin/tsc -p story-generator/tsconfig.app.json --noEmit"
API_TSC="find api -name '*.ts' ! -name '*.spec.ts' ! -name '*.test.ts' -print0 | xargs -0 npx -p node@20 node ./node_modules/typescript/bin/tsc --noEmit --target es2020 --lib es2020,dom --module commonjs --moduleResolution node --esModuleInterop --skipLibCheck --types node"
BUILD_COMMAND="npm run build"

SLICE=""
DRY_RUN=0
QUICK=0

SLICES=(
  "cloud-library-ui"
  "durable-job-owner"
  "story-quality-guidance"
  "quality-report-proving-grounds"
  "story-memory-cards"
  "css-lazy-loading"
)

usage() {
  cat <<'USAGE'
Usage: scripts/recovery/slice-preflight.sh <slice-name> [--quick] [--dry-run]

Runs focused validation for one Story Lab recovery slice and writes a copyable
evidence block under tmp/recovery/.

Slice names:
USAGE
  for slice_name in "${SLICES[@]}"; do
    printf '  %s\n' "${slice_name}"
  done

  cat <<'USAGE'
Options:
  --quick      Skip slow build commands where the slice normally includes them.
  --dry-run    Print the selected commands without running them.
USAGE
}

add_angular_typecheck_commands() {
  SLICE_COMMANDS+=(
    "${ANGULAR_SPEC_TSC}"
    "${ANGULAR_APP_TSC}"
  )
}

add_api_typecheck_command() {
  SLICE_COMMANDS+=("${API_TSC}")
}

add_build_command_unless_quick() {
  if [[ "${QUICK}" -eq 0 ]]; then
    SLICE_COMMANDS+=("${BUILD_COMMAND}")
  fi
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --quick)
      QUICK=1
      ;;
    --dry-run)
      DRY_RUN=1
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      if [[ -n "${SLICE}" ]]; then
        echo "Unexpected argument: $1" >&2
        usage >&2
        exit 2
      fi
      SLICE="$1"
      ;;
  esac
  shift
done

if [[ -z "${SLICE}" ]]; then
  usage >&2
  exit 2
fi

COMMON_COMMANDS=(
  "if git rev-parse --verify --quiet origin/main >/dev/null; then git diff --check origin/main...HEAD -- . ':(exclude)node_modules/**' ':(exclude)story-generator/node_modules/**'; fi"
  "git diff --check -- . ':(exclude)node_modules/**' ':(exclude)story-generator/node_modules/**'"
  "scripts/recovery/check-vercel-function-count.sh"
)

SLICE_COMMANDS=()
case "${SLICE}" in
  cloud-library-ui)
    add_angular_typecheck_commands
    add_build_command_unless_quick
    ;;
  durable-job-owner)
    SLICE_COMMANDS=(
      "npx tsx tests/story-lab-job-contracts.test.ts"
      "npm run test:story-lab-job-store-config"
      "npm run test:story-lab-job-store-port"
      "npx tsx tests/story-lab-job-routes.test.ts"
      "npm run test:story-lab-cloud-schema"
      "npm run test:story-lab-cloud-db-readiness"
    )
    add_api_typecheck_command
    ;;
  story-quality-guidance)
    SLICE_COMMANDS=(
      "npm run test:story-lab-real-engine"
      "npm run test:story-quality"
      "npm run test:story"
    )
    add_api_typecheck_command
    ;;
  quality-report-proving-grounds)
    SLICE_COMMANDS=(
      "npm run test:story-quality"
    )
    add_api_typecheck_command
    add_angular_typecheck_commands
    add_build_command_unless_quick
    ;;
  story-memory-cards)
    SLICE_COMMANDS=(
      "npm run test:story-quality"
      "npm run test:story-lab-real-engine"
    )
    add_api_typecheck_command
    add_angular_typecheck_commands
    add_build_command_unless_quick
    ;;
  css-lazy-loading)
    SLICE_COMMANDS=(
      "npm run test:story-generator-route-splitting"
      "npm run test:story-generator-component-style-budget"
    )
    add_angular_typecheck_commands
    add_build_command_unless_quick
    ;;
  *)
    echo "Unknown slice: ${SLICE}" >&2
    usage >&2
    exit 2
    ;;
esac

ALL_COMMANDS=("${COMMON_COMMANDS[@]}" "${SLICE_COMMANDS[@]}")

cd "${REPO_ROOT}"

printf 'Selected slice: %s\n' "${SLICE}"
printf 'Mode: %s\n' "$([[ "${DRY_RUN}" -eq 1 ]] && echo dry-run || echo run)"
printf 'Commands:\n'
for command in "${ALL_COMMANDS[@]}"; do
  printf '  - %s\n' "${command}"
done

if [[ "${DRY_RUN}" -eq 1 ]]; then
  exit 0
fi

mkdir -p "${EVIDENCE_DIR}"
evidence_file="${EVIDENCE_DIR}/${SLICE}-evidence.md"

{
  printf '# Story Lab Slice Evidence: %s\n\n' "${SLICE}"
  printf -- '- Date UTC: %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
  printf -- '- Branch: %s\n' "$(git branch --show-current 2>/dev/null || echo 'detached HEAD')"
  printf -- '- HEAD: %s\n' "$(git rev-parse --short HEAD)"
  printf -- '- Mode: %s\n\n' "$([[ "${QUICK}" -eq 1 ]] && echo quick || echo full)"
  printf '## Commands\n\n'
} > "${evidence_file}"

for command in "${ALL_COMMANDS[@]}"; do
  printf '\n==> %s\n' "${command}"
  printf -- '- `%s`: ' "${command}" >> "${evidence_file}"
  if bash -c "${command}"; then
    printf 'passed\n' >> "${evidence_file}"
  else
    printf 'failed\n' >> "${evidence_file}"
    printf '\nEvidence written to %s\n' "${evidence_file}" >&2
    exit 1
  fi
done

{
  printf '\n## Non-Claims\n\n'
  printf -- '- This evidence does not prove live cloud sync unless a durable database and signed-in flow were explicitly exercised.\n'
  printf -- '- This evidence does not prove durable jobs unless process-loss recovery was explicitly exercised.\n'
} >> "${evidence_file}"

printf '\nEvidence written to %s\n' "${evidence_file}"
