# Verification pipeline

`index.html` is a single-file app (no build step, by design). These scripts
are the standing checks that should pass before any commit touching
`index.html`: they catch a broken taxonomy blob, a JS syntax error buried in
~38k lines, a sidebar tab that throws on open, or a layout that overflows
horizontally on mobile.

## Run everything

```bash
scripts/verify/run_all.sh
```

Optionally pass a different path to check: `scripts/verify/run_all.sh path/to/index.html`.

## What each check does

| Script | What it verifies |
|---|---|
| `tax_integrity.py` | Extracts the `const nodes = [...]` array (string-aware bracket-depth scan, so bracket characters inside node text don't break extraction) and confirms it's valid JSON with no duplicate `code` values. |
| `check_js_syntax.py` | Extracts the largest inline `<script>` block and runs `node --check` on it. |
| `nav_sweep.js` | Playwright: clicks every `.app-sidebar .page-tab` (opening its group first if collapsed) and asserts zero `pageerror`/console-error events across the whole sweep. |
| `overflow_sweep.js` | Playwright: same tab-walking pattern, but at both a mobile (393×852) and desktop (1440×900) viewport, checking `document.documentElement.scrollWidth - window.innerWidth` stays within a 5px tolerance on every tab. |

Each script can also be run standalone, and each exits non-zero on failure
so it's CI-friendly:

```bash
python3 scripts/verify/tax_integrity.py
python3 scripts/verify/check_js_syntax.py
node scripts/verify/nav_sweep.js
node scripts/verify/overflow_sweep.js
```

## Prerequisites

- **Python 3** (no third-party packages — both `.py` checks use only the
  standard library).
- **Node.js** with the **`playwright`** package (and a Chromium build)
  available to `require('playwright')`, for the two `.js` sweeps.
  - In a normal checkout: `npm install playwright && npx playwright install chromium`
    (there's no `package.json` in this repo by design — install playwright
    globally, or `npm init -y && npm install playwright` in a scratch
    directory and point `NODE_PATH` at its `node_modules`).
  - In this project's sandboxed dev environment, Playwright and a Chromium
    build are already provisioned outside any local `node_modules`;
    `run_all.sh` defaults `NODE_PATH` and `PLAYWRIGHT_EXECUTABLE_PATH` to
    that environment's locations automatically (`/opt/node22/lib/node_modules`
    and `/opt/pw-browsers/chromium`) when they exist and aren't already set,
    without hard-requiring them elsewhere. Running `nav_sweep.js` or
    `overflow_sweep.js` directly (not via `run_all.sh`) in that same sandbox
    needs `NODE_PATH=/opt/node22/lib/node_modules node scripts/verify/nav_sweep.js`
    and, if Chromium isn't found automatically,
    `PLAYWRIGHT_EXECUTABLE_PATH=/opt/pw-browsers/chromium`.

## Adding to this pipeline

If a future bug class turns out to need its own recurring check (as the
mobile/desktop overflow sweep did), add a script here following the same
pattern — exit 0/1, print a clear PASS/FAIL line, accept an optional
`index.html` path argument — and wire it into `run_all.sh`.
