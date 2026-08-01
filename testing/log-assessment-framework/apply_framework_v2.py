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
import os
import hashlib
from collections import Counter

sys.path.insert(0, os.path.dirname(__file__))
import shape_naming

TS_LIB = [
    ("iso8601_offset_ms", re.compile(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}[+-]\d{2}:\d{2}")),
    ("iso8601_offset_no_ms", re.compile(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}")),
    ("iso8601_space_hms", re.compile(r"\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}")),
    ("iso8601_naive", re.compile(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?![+\-.\d])")),
    ("syslog_no_year", re.compile(r"[A-Z][a-z]{2}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2}")),
    ("slash_date_hms", re.compile(r"\d{2}/\d{2}/\d{4} \d{2}:\d{2}:\d{2}")),
    ("iso8601_slash_hms", re.compile(r"\d{4}/\d{2}/\d{2} \d{2}:\d{2}:\d{2}")),  # same width as iso8601_space_hms (dash vs slash date separator) -- the fixed-width-trap pattern
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


def naive_field_count(text, fmt):
    """Deliberately naive (structure-unaware) field counter -- applies to
    any format with a countable delimiter, not just named CSV/pipe
    buckets, since field count is its own dimension independent of
    whether the format has a recognised name. This is what makes the
    delimiter-collision pitfall (a quoted comma) reproducible."""
    if fmt in ("json", "FREE_TEXT"):
        return None
    if "|" in text:
        return text.count("|") + 1
    if "," in text:
        return text.count(",") + 1
    return None


def annotate(ev):
    head, head_ending, head_lineno = ev["raw_lines"][0]
    fmt = classify(head)
    ts_name, ts_off, ts_width = find_timestamp(head)
    if fmt is None:
        fmt = "FREE_TEXT" if not re.search(r"[{|,]", head) else "OTHER"
    ev["format"] = fmt
    ev["ts_format"] = ts_name
    ev["ts_offset"] = ts_off
    ev["ts_width"] = ts_width
    ev["field_count"] = naive_field_count(head, fmt)
    ev["first_char_class"] = (
        "digit" if head[:1].isdigit() else "alpha" if head[:1].isalpha() else
        "symbol" if head[:1] else "empty"
    )
    ev["structure"] = "multi" if len(ev["raw_lines"]) > 1 else "single"
    ev["line_ending"] = head_ending
    ev["line_count"] = len(ev["raw_lines"])
    ev["chars"] = sum(len(t) for t, _, _ in ev["raw_lines"])
    ev["bytes"] = sum(len(t.encode("utf-8")) + (2 if e == "CRLF" else 1 if e == "LF" else 0) for t, e, _ in ev["raw_lines"])
    return ev


def shape_of(head, fmt):
    # Only an unnamed format falls back to a derived shape; csv_dated already
    # has a name and must fingerprint on it directly (see
    # apply_framework_v1_lib.shape_token). "OTHER" has no confident delimiter
    # to count arity on, so it uses the masked-token-skeleton derivation
    # instead of collapsing every unrecognised shape into one OTHER bucket.
    if fmt == "pipe_delimited":
        return f"pipe/{head.count('|') + 1}"
    if fmt == "OTHER":
        return shape_naming.masked_skeleton(head)
    return fmt


UNNAMED_FORMATS = ("pipe_delimited", "OTHER")


def type_key_of(head, fmt):
    """Used only when the base (format|ts_format) tuple is degenerate --
    a schema signature that varies even when format/timestamp don't.
    For JSON, the sorted set of top-level keys; other formats have no
    cheap schema signature available here and return None."""
    if fmt != "json":
        return None
    try:
        obj = json.loads(head)
    except ValueError:
        return None
    return ",".join(sorted(obj.keys()))


def fingerprint(ev, head, extend_with_type_key):
    if ev["format"] == "FREE_TEXT":
        return "FREE_TEXT", None
    shape = shape_of(head, ev["format"])
    key = f"{shape}|{ev['ts_format']}"
    if extend_with_type_key:
        key = f"{key}|{type_key_of(head, ev['format'])}"
    fp = hashlib.md5(key.encode()).hexdigest()[:8]
    shape_name = None
    if ev["format"] in UNNAMED_FORMATS:
        shape_hash, codename = shape_naming.codename_for_token(shape)
        shape_name = {"shape_token": shape, "shape_hash": shape_hash, "codename": codename}
    return fp, shape_name


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

    def is_conforming(e):
        return (e["format"] == maj_fmt and e["ts_format"] == maj_ts and e["structure"] == maj_struct and
                e["first_char_class"] == maj_fc and e["line_ending"] == maj_end)

    conforming = [e for e in events if is_conforming(e)]
    nonconforming = [e for e in events if not is_conforming(e)]
    all_conf = len(conforming)

    # ---- Two counting units: line-level vs event-level ----
    # Diverges from the event-level rate exactly when folded multi-line
    # records exist, since each conforming event contributes its full line
    # count rather than a flat 1.
    conforming_lines = sum(e["line_count"] for e in conforming)
    total_lines = len(decoded)
    line_level_pct = round(100 * conforming_lines / total_lines, 4) if total_lines else None
    event_level_pct = round(100 * all_conf / len(events), 4) if events else None

    # ---- Per-axis three-way (bytes / events / percentage) partition report ----
    total_bytes_all = sum(e["bytes"] for e in events)

    def partition_axis(axis_name, key_fn, baseline):
        conf = [e for e in events if key_fn(e) == baseline]
        nonconf = [e for e in events if key_fn(e) != baseline]
        cbytes, nbytes = sum(e["bytes"] for e in conf), sum(e["bytes"] for e in nonconf)
        return {
            "axis": axis_name, "baseline": baseline,
            "conf_events": len(conf), "conf_bytes": cbytes,
            "conf_pct_events": round(100 * len(conf) / len(events), 2) if events else None,
            "conf_pct_bytes": round(100 * cbytes / total_bytes_all, 2) if total_bytes_all else None,
            "nonconf_events": len(nonconf), "nonconf_bytes": nbytes,
            "nonconf_pct_events": round(100 * len(nonconf) / len(events), 2) if events else None,
            "nonconf_pct_bytes": round(100 * nbytes / total_bytes_all, 2) if total_bytes_all else None,
        }

    axis_defs = [
        ("format", lambda e: e["format"], maj_fmt),
        ("ts_format", lambda e: e["ts_format"], maj_ts),
        ("structure", lambda e: e["structure"], maj_struct),
        ("first_char_class", lambda e: e["first_char_class"], maj_fc),
        ("line_ending", lambda e: e["line_ending"], maj_end),
    ]
    summary_block = [partition_axis(name, fn, base) for name, fn, base in axis_defs]

    # ---- Non-conformer list, attributed reasons ----
    non_conformers = []
    for e in nonconforming:
        reasons = [f"{name}={fn(e)} (majority={base})" for name, fn, base in axis_defs if fn(e) != base]
        non_conformers.append({"line": e["raw_lines"][0][2], "reasons": reasons})

    # ---- Fingerprinting, extended with a type_key when the base tuple is degenerate ----
    distinct_formats = {e["format"] for e in events if e["format"] != "FREE_TEXT"}
    distinct_ts_formats = {e["ts_format"] for e in events if e["format"] != "FREE_TEXT"}
    base_tuple_degenerate = len(distinct_formats) <= 1 and len(distinct_ts_formats) <= 1

    fps = Counter()
    shape_names = {}
    for e in events:
        fp, shape_name = fingerprint(e, e["raw_lines"][0][0], base_tuple_degenerate)
        fps[fp] += 1
        if shape_name is not None and fp not in shape_names:
            shape_names[fp] = shape_name

    ts_widths = {}
    for e in events:
        if e["ts_format"]:
            ts_widths.setdefault(e["ts_format"], set()).add(e["ts_width"])
    ts_offsets = {}
    for e in events:
        if e["ts_format"]:
            ts_offsets.setdefault(e["ts_format"], set()).add(e["ts_offset"])
    field_counts = {}
    for e in events:
        if e["field_count"] is not None:
            field_counts.setdefault(e["format"], Counter())[e["field_count"]] += 1

    return {
        "file": path,
        "has_bom": bom,
        "total_physical_lines": len(decoded),
        "total_logical_events": len(events),
        "continuation_lines": len(decoded) - len(events),
        "majority": {"format": maj_fmt, "ts_format": maj_ts, "structure": maj_struct, "first_char_class": maj_fc, "line_ending": maj_end},
        "ts_width_by_format": {k: sorted(v) for k, v in ts_widths.items()},
        "ts_offset_by_format": {k: sorted(v) for k, v in ts_offsets.items()},
        "field_count_distribution": {k: dict(v) for k, v in field_counts.items()},
        "format_breakdown": dict(fmt_ctr),
        "ts_format_breakdown": dict(ts_ctr),
        "line_ending_breakdown": dict(end_ctr),
        "structure_breakdown": dict(struct_ctr),
        "all_axes_conforming_events": all_conf,
        "all_axes_conforming_lines": conforming_lines,
        "line_level_pct": line_level_pct,
        "event_level_pct": event_level_pct,
        "summary_block": summary_block,
        "non_conformers": non_conformers,
        "base_tuple_degenerate": base_tuple_degenerate,
        "distinct_fingerprints_excl_freetext": len([k for k in fps if k != "FREE_TEXT"]),
        "free_text_events": fps.get("FREE_TEXT", 0),
        "shape_names": shape_names,
    }


if __name__ == "__main__":
    result = run(sys.argv[1])
    print(json.dumps(result, indent=2))
