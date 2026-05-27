#!/usr/bin/env bash
set -euo pipefail

OUTPUT_DIR="${1:-story-generator/dist/story-generator/browser}"
INDEX_HTML="${OUTPUT_DIR}/index.html"
CSR_INDEX="${OUTPUT_DIR}/index.csr.html"

if [[ -f "${INDEX_HTML}" ]]; then
  echo "Vercel index present: ${INDEX_HTML}"
  exit 0
fi

if [[ -f "${CSR_INDEX}" ]]; then
  cp "${CSR_INDEX}" "${INDEX_HTML}"
  echo "Created Vercel fallback index: ${INDEX_HTML}"
  exit 0
fi

echo "Missing Angular browser index in ${OUTPUT_DIR}" >&2
exit 1
