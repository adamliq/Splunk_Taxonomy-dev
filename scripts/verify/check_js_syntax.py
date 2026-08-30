#!/usr/bin/env python3
"""
JS syntax check.

index.html is a single-file app: all logic lives in one large inline
<script> block. This extracts that block (skipping any <script src=...>
or non-JS <script type="application/...json"> tags, in case those are ever
added) and runs `node --check` on it to catch syntax errors before they ship
— things a text-editor round-trip or a bad find/replace across ~38k lines
can silently introduce.

Usage:
    python3 scripts/verify/check_js_syntax.py [path/to/index.html]

Requires a `node` binary on PATH. In this project's sandbox, node lives at
a NODE_PATH-only location; scripts/verify/run_all.sh sets that up. Outside
the sandbox, a normal Node.js install is enough.

Exit code 0 on success, 1 on failure.
"""
import re
import subprocess
import sys
import tempfile
from pathlib import Path

SCRIPT_TAG_RE = re.compile(r"<script(?P<attrs>[^>]*)>(?P<body>.*?)</script>", re.DOTALL | re.IGNORECASE)


def find_inline_scripts(text: str):
    scripts = []
    for m in SCRIPT_TAG_RE.finditer(text):
        attrs = m.group("attrs") or ""
        if "src=" in attrs:
            continue  # external script, nothing to check locally
        type_match = re.search(r'type\s*=\s*["\']([^"\']+)["\']', attrs)
        if type_match and type_match.group(1).lower() not in ("text/javascript", "application/javascript", "module"):
            continue  # e.g. application/json data island, not JS
        scripts.append(m.group("body"))
    return scripts


def main() -> int:
    html_path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parents[2] / "index.html"
    if not html_path.exists():
        print(f"FAIL: {html_path} does not exist")
        return 1

    text = html_path.read_text(encoding="utf-8")
    scripts = find_inline_scripts(text)

    if not scripts:
        print("FAIL: no inline <script> blocks found")
        return 1

    biggest = max(scripts, key=len)
    print(f"Inline script blocks found: {len(scripts)}")
    print(f"Largest block size: {len(biggest):,} chars")

    with tempfile.NamedTemporaryFile(mode="w", suffix=".js", delete=False, encoding="utf-8") as tmp:
        tmp.write(biggest)
        tmp_path = tmp.name

    try:
        result = subprocess.run(
            ["node", "--check", tmp_path],
            capture_output=True,
            text=True,
        )
    except FileNotFoundError:
        print("FAIL: `node` not found on PATH. See scripts/verify/README.md for sandbox setup.")
        return 1
    finally:
        Path(tmp_path).unlink(missing_ok=True)

    if result.returncode != 0:
        print("FAIL: node --check reported a syntax error:")
        print(result.stderr.strip())
        return 1

    print("PASS: JS syntax check (node --check)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
