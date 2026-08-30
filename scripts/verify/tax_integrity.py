#!/usr/bin/env python3
"""
TAX integrity check.

Extracts the `const nodes = [...]` array literal that backs the taxonomy
(Onboard Taxonomy / Schema Explorer / coverage pages) out of index.html and
verifies:
  1. The array literal is well-formed JSON (catches truncated edits, stray
     commas, unescaped quotes introduced by hand-editing the blob).
  2. Every node's `code` value is unique (a duplicate silently breaks
     lookups, parent/child linking, and drawer navigation).

The array is extracted with a string-aware bracket-depth scan rather than a
regex, because a naive regex for "innermost matching ]" breaks the moment
any node's text fields contain literal `[` or `]` characters (which they do,
e.g. in bracketed abbreviations).

Usage:
    python3 scripts/verify/tax_integrity.py [path/to/index.html]

Exit code 0 on success, 1 on failure. Prints a summary either way.
"""
import json
import sys
from pathlib import Path

MARKER = "const nodes = ["


def extract_nodes_array(text: str) -> str:
    idx = text.find(MARKER)
    if idx == -1:
        raise ValueError(f"Could not find marker {MARKER!r} in file")
    start = idx + len(MARKER) - 1  # position of the opening '['

    i = start
    depth = 0
    in_str = False
    quote = ""
    escape = False
    n = len(text)
    while i < n:
        c = text[i]
        if in_str:
            if escape:
                escape = False
            elif c == "\\":
                escape = True
            elif c == quote:
                in_str = False
        else:
            if c == '"' or c == "'":
                in_str = True
                quote = c
            elif c in "[{":
                depth += 1
            elif c in "]}":
                depth -= 1
                if depth == 0:
                    i += 1
                    break
        i += 1
    else:
        raise ValueError("Reached end of file before bracket depth returned to 0")

    return text[start:i]


def main() -> int:
    html_path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parents[2] / "index.html"
    if not html_path.exists():
        print(f"FAIL: {html_path} does not exist")
        return 1

    text = html_path.read_text(encoding="utf-8")

    try:
        arr_text = extract_nodes_array(text)
    except ValueError as e:
        print(f"FAIL: could not extract nodes array: {e}")
        return 1

    try:
        nodes = json.loads(arr_text)
    except json.JSONDecodeError as e:
        print(f"FAIL: nodes array is not valid JSON: {e}")
        return 1

    if not isinstance(nodes, list) or not nodes:
        print("FAIL: parsed nodes value is not a non-empty list")
        return 1

    codes = [n.get("code") for n in nodes]
    counts: dict = {}
    for c in codes:
        counts[c] = counts.get(c, 0) + 1
    dupes = {c: n for c, n in counts.items() if n > 1}

    print(f"Nodes parsed: {len(nodes)}")
    print(f"Duplicate codes: {len(dupes)}")

    if dupes:
        print("FAIL: duplicate node codes found:")
        for code, count in list(dupes.items())[:20]:
            print(f"  {code!r}: {count} occurrences")
        if len(dupes) > 20:
            print(f"  ... and {len(dupes) - 20} more")
        return 1

    print("PASS: TAX integrity check")
    return 0


if __name__ == "__main__":
    sys.exit(main())
