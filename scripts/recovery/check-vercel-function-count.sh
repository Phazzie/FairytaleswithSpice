#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${REPO_ROOT}"

FUNCTION_COUNT=$(find api -path '*/_*' -prune -o \( -name '*.ts' ! -name '*.spec.ts' ! -name '*.test.ts' -print \) | wc -l | tr -d ' ')
MAX_FUNCTION_COUNT=12

echo "Vercel function count check: ${FUNCTION_COUNT}/${MAX_FUNCTION_COUNT}"

if [[ "${FUNCTION_COUNT}" -gt "${MAX_FUNCTION_COUNT}" ]]; then
  echo "Exceeded recoverable function limit (${MAX_FUNCTION_COUNT})."
  exit 1
fi

echo "Function count within limit."
