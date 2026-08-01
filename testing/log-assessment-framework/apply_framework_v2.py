"""
INDEPENDENT second implementation of the Log Assessment Framework's
documented procedure. Deliberately different architecture from
apply_framework.py (a streaming state machine instead of classify-then-
group) so that agreement between the two is real cross-validation of the
spec's clarity, not two copies of the same code accidentally agreeing.

Usage: python3 apply_framework_v2.py <path-to-log-file>
Prints a JSON report to stdout.
"""
import re
import sys
import json
import hashlib
from collections import Counter

TS_LIB = [
    ("iso8601_offset_ms", re.compile(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}[+-]\d{2}:\d{2}")),
    ("iso8601_space_hms", re.compile(r"\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}")),
    ("iso8601_naive", re.compile(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?![+\-.\d])")),
    ("syslog_no_year", re.compile(r"[A-Z][a-z]{2}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2}")),
    ("slash_date_hms", re.compile(r"\d{2}/\d{2}/\d{4} \d{2}:\d{2}:\d{2}")),
    ("dash_date_hms_fixedwidth", re.compile(r"\d{2}-\d{2}-\d{2} \d{2}:\d{2}:\d{6}")),  # deliberately matches the contrived fixed-width-trap minority pattern
]


def find_timestamp(s):
    """Search anywhere in the line (per the framework: 'use search-based extraction' --
    a fixed-slice/anchored match breaks whenever a prefix pushes the timestamp off offset 0,
    e.g. a JSON wrapper or a syslog priority tag)."""
    for name, pat in TS_LIB:
        mo = pat.search(s)
        if mo:
            return name, mo.start(), len(mo.group(0))
    return None, None, None


def classify(s):
    if s.startswith("{"):
        try:
            json.loads(s)
            return "json"
        except ValueError:
            pass
    if re.match(r"^<\d+>", s):
        return "syslog_priority"
    if s.count("|") >= 2 and not s.startswith("{"):
        return "pipe_delimited"
    if re.match(r"^\d{2}/\d{2}/\d{4}", s) and "," in s:
        return "csv_dated"
    return None  # unclassified structurally


def read_raw_lines(path):
    """Byte-level split preserving BOM / CRLF / LF distinctly, decode after splitting."""
    raw = open(path, "rb").read()
    bom = raw[:3] == b"\xef\xbb\xbf"
    body = raw[3:] if bom else raw
    recs = []
    start = 0
    n = len(body)
    idx = 0
    while idx < n:
        if body[idx] == 0x0A:
            chunk = body[start:idx]
            if chunk.endswith(b"\r"):
                recs.append((chunk[:-1], "CRLF"))
            else:
                recs.append((chunk, "LF"))
            start = idx + 1
        idx += 1
    if start < n:
        recs.append((body[start:], "NONE"))
    decoded = [(b.decode("utf-8", errors="replace"), end) for b, end in recs]
    return bom, len(raw), decoded


def is_continuation(text):
    """Only rule for continuation: leading whitespace/tab. (Corrected spec.)"""
    return len(text) > 0 and text[0] in (" ", "\t")


def group_events(decoded):
    """State-machine grouping: walk lines, start a new event unless is_continuation()."""
    events = []
    cur = None
    for lineno, (text, ending) in enumerate(decoded, 1):
        if cur is not None and is_continuation(text):
            cur["raw_lines"].append((text, ending, lineno))
            continue
        if cur is not None:
            events.append(cur)
        cur = {"raw_lines": [(text, ending, lineno)]}
    if cur is not None:
        events.append(cur)
    return events


def annotate(ev):
    head, head_ending, head_lineno = ev["raw_lines"][0]
    fmt = classify(head)
    ts_name, ts_off, ts_width = find_timestamp(head)
    if fmt is None:
        fmt = "FREE_TEXT" if not re.search(r"[{|,]", head) else "OTHER"
    ev["format"] = fmt
    ev["ts_format"] = ts_name
    ev["ts_offset"] = ts_off
    ev["first_char_class"] = (
        "digit" if head[:1].isdigit() else "alpha" if head[:1].isalpha() else
        "symbol" if head[:1] else "empty"
    )
    ev["structure"] = "multi" if len(ev["raw_lines"]) > 1 else "single"
    ev["line_ending"] = head_ending
    ev["chars"] = sum(len(t) for t, _, _ in ev["raw_lines"])
    ev["bytes"] = sum(len(t.encode("utf-8")) + (2 if e == "CRLF" else 1 if e == "LF" else 0) for t, e, _ in ev["raw_lines"])
    return ev


def shape_of(head, fmt):
    # Only an unnamed format falls back to arity; csv_dated already has a name
    # and must fingerprint on it directly (see apply_framework_v1_lib.shape_token).
    if fmt == "pipe_delimited":
        return f"pipe/{head.count('|') + 1}"
    return fmt


def fingerprint(ev, head):
    if ev["format"] == "FREE_TEXT":
        return "FREE_TEXT"
    shape = shape_of(head, ev["format"])
    key = f"{shape}|{ev['ts_format']}"
    return hashlib.md5(key.encode()).hexdigest()[:8]


def run(path):
    bom, total_bytes, decoded = read_raw_lines(path)
    events = group_events(decoded)
    for ev in events:
        annotate(ev)

    fmt_ctr = Counter(e["format"] for e in events)
    ts_ctr = Counter(e["ts_format"] for e in events if e["ts_format"])
    struct_ctr = Counter(e["structure"] for e in events)
    fc_ctr = Counter(e["first_char_class"] for e in events)
    end_ctr = Counter(e["line_ending"] for e in events)

    maj_fmt = fmt_ctr.most_common(1)[0][0]
    maj_ts = ts_ctr.most_common(1)[0][0] if ts_ctr else None
    maj_struct = struct_ctr.most_common(1)[0][0]
    maj_fc = fc_ctr.most_common(1)[0][0]
    maj_end = end_ctr.most_common(1)[0][0]

    all_conf = sum(1 for e in events if e["format"] == maj_fmt and e["ts_format"] == maj_ts and
                   e["structure"] == maj_struct and e["first_char_class"] == maj_fc and e["line_ending"] == maj_end)

    fps = Counter()
    for e in events:
        fps[fingerprint(e, e["raw_lines"][0][0])] += 1

    return {
        "file": path,
        "has_bom": bom,
        "total_physical_lines": len(decoded),
        "total_logical_events": len(events),
        "continuation_lines": len(decoded) - len(events),
        "majority": {"format": maj_fmt, "ts_format": maj_ts, "structure": maj_struct, "first_char_class": maj_fc, "line_ending": maj_end},
        "format_breakdown": dict(fmt_ctr),
        "ts_format_breakdown": dict(ts_ctr),
        "line_ending_breakdown": dict(end_ctr),
        "structure_breakdown": dict(struct_ctr),
        "all_axes_conforming_events": all_conf,
        "distinct_fingerprints_excl_freetext": len([k for k in fps if k != "FREE_TEXT"]),
        "free_text_events": fps.get("FREE_TEXT", 0),
    }


if __name__ == "__main__":
    result = run(sys.argv[1])
    print(json.dumps(result, indent=2))
