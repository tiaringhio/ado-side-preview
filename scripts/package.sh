#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUTPUT_ZIP="${ROOT_DIR}/azure-devops-side-preview.zip"

FILES=(
  "manifest.json"
  "content.js"
  "styles.css"
  "popup.html"
  "popup.js"
  "icons"
)

cd "$ROOT_DIR"

if [[ -f "$OUTPUT_ZIP" ]]; then
  rm -f "$OUTPUT_ZIP"
fi

zip -r "$OUTPUT_ZIP" "${FILES[@]}"

echo "Created: $OUTPUT_ZIP"
