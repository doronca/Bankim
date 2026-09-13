#!/bin/bash
# Regenerates public/docs/user-guide.pdf from the app currently running on
# localhost:3000 (start it first with `npm run dev`). Captures a fresh
# screenshot of every main screen with headless Chrome — masking account
# numbers, IBANs, and card last-4 digits in the page before capturing — then
# renders the PDF.
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SHOTS="$DIR/.guide-shots"
TOOLS="$DIR/.guide-tools"

if ! curl -sf http://localhost:3000 > /dev/null; then
  echo "error: nothing responding on http://localhost:3000 — run 'npm run dev' first" >&2
  exit 1
fi

if [ ! -d "$TOOLS/node_modules/puppeteer-core" ]; then
  mkdir -p "$TOOLS"
  (cd "$TOOLS" && npm install puppeteer-core --no-audit --no-fund --silent)
fi

mkdir -p "$SHOTS"
NODE_PATH="$TOOLS/node_modules" node "$DIR/redact-screenshots.js" "$SHOTS"

GUIDE_SHOTS_DIR="$SHOTS" GUIDE_OUT="$DIR/../public/docs/user-guide.pdf" python3 "$DIR/build-user-guide.py"
echo "updated: public/docs/user-guide.pdf"
