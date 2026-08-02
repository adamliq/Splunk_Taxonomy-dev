#!/usr/bin/env bash
# Runs the full webapp regression suite: fast structural checks first (no
# browser needed), then the slower Playwright browser suite. Exits non-zero
# if anything fails, so it's safe to use as a CI gate.
#
# Usage:
#   ./run-all.sh              # everything
#   ./run-all.sh --structural # skip the browser suite (no playwright needed)
#   ./run-all.sh --browser    # only the browser suite

set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

MODE="${1:-all}"

run_structural() {
  echo "=== Structural tests (index.html parsed statically, no browser) ==="
  node --test structural/*.test.js
}

run_browser() {
  echo
  echo "=== Browser tests (Playwright, headless Chromium) ==="
  echo "This takes a few minutes -- reference-navigation.spec.js clicks"
  echo "every anchor-nav link in every reference article."
  node --test browser/*.spec.js
}

case "$MODE" in
  --structural) run_structural ;;
  --browser) run_browser ;;
  all|"") run_structural; run_browser ;;
  *) echo "Unknown option: $MODE (expected --structural, --browser, or nothing)"; exit 2 ;;
esac
