#!/usr/bin/env bash
# Runs the full verification pipeline against index.html:
#   1. TAX integrity check (nodes array parses, no duplicate codes)
#   2. JS syntax check (node --check on the largest inline <script>)
#   3. Nav sweep (every sidebar tab opens with zero console/page errors)
#   4. Overflow sweep (no horizontal overflow at mobile or desktop width)
#
# Usage:
#   scripts/verify/run_all.sh [path/to/index.html]
#
# Exits non-zero on the first failing check; prints a PASS/FAIL summary
# line per check either way.
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
HTML_PATH="${1:-$REPO_ROOT/index.html}"

# This sandbox's playwright/node live outside a local node_modules; default
# NODE_PATH there without forcing it elsewhere (a normal `npm install
# playwright` checkout should leave this unset and just work).
if [ -d /opt/node22/lib/node_modules ] && [ -z "${NODE_PATH:-}" ]; then
  export NODE_PATH=/opt/node22/lib/node_modules
fi
if [ -x /opt/pw-browsers/chromium ] && [ -z "${PLAYWRIGHT_EXECUTABLE_PATH:-}" ]; then
  export PLAYWRIGHT_EXECUTABLE_PATH=/opt/pw-browsers/chromium
fi

PY="${PYTHON:-python3}"
NODE="${NODE_BIN:-node}"

overall=0

run_check() {
  local name="$1"; shift
  echo ""
  echo "── $name ──"
  if "$@"; then
    echo "✔ $name"
  else
    echo "✘ $name FAILED"
    overall=1
  fi
}

run_check "TAX integrity check" "$PY" "$REPO_ROOT/scripts/verify/tax_integrity.py" "$HTML_PATH"
run_check "JS syntax check" "$PY" "$REPO_ROOT/scripts/verify/check_js_syntax.py" "$HTML_PATH"
run_check "Nav sweep" "$NODE" "$REPO_ROOT/scripts/verify/nav_sweep.js" "$HTML_PATH"
run_check "Overflow sweep" "$NODE" "$REPO_ROOT/scripts/verify/overflow_sweep.js" "$HTML_PATH"

echo ""
if [ "$overall" -eq 0 ]; then
  echo "=== ALL CHECKS PASSED ==="
else
  echo "=== ONE OR MORE CHECKS FAILED ==="
fi
exit $overall
