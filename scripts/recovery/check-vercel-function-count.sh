#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${REPO_ROOT}"

EXPECTED_FUNCTIONS=(
  "api/export/save.ts"
  "api/health.ts"
  "api/story-lab/evaluate.ts"
  "api/story-lab/jobs.ts"
  "api/story-lab/jobs/[jobId].ts"
  "api/story-lab/jobs/[jobId]/events.ts"
  "api/story-lab/stories.ts"
  "api/story-lab/stories/[storyId]/continue.ts"
  "api/story-lab/stream/genesis.ts"
  "api/story/continue.ts"
  "api/story/generate.ts"
  "api/story/stream.ts"
)

DISCOVERED_FUNCTIONS=()
while IFS= read -r function_path; do
  DISCOVERED_FUNCTIONS+=("${function_path}")
done < <(find api -path '*/_*' -prune -o \( -name '*.ts' ! -name '*.spec.ts' ! -name '*.test.ts' -print \) | sort)

FUNCTION_COUNT="${#DISCOVERED_FUNCTIONS[@]}"
MAX_FUNCTION_COUNT=12

echo "Vercel function count check: ${FUNCTION_COUNT}/${MAX_FUNCTION_COUNT}"

if [[ "${FUNCTION_COUNT}" -gt "${MAX_FUNCTION_COUNT}" ]]; then
  echo "Exceeded recoverable function limit (${MAX_FUNCTION_COUNT})."
  exit 1
fi

for expected_function in "${EXPECTED_FUNCTIONS[@]}"; do
  if [[ ! -f "${expected_function}" ]]; then
    echo "Expected Vercel function is missing: ${expected_function}"
    exit 1
  fi
done

for discovered_function in "${DISCOVERED_FUNCTIONS[@]}"; do
  matched=0
  for expected_function in "${EXPECTED_FUNCTIONS[@]}"; do
    if [[ "${discovered_function}" == "${expected_function}" ]]; then
      matched=1
      break
    fi
  done

  if [[ "${matched}" -eq 0 ]]; then
    echo "Unexpected Vercel function path: ${discovered_function}"
    echo "Move helpers under api/_lib or update this allow-list intentionally."
    exit 1
  fi
done

echo "Function count within limit."
