"""
Implementation 1, refactored into a callable run(path) function so it can
be driven against arbitrary files by the comparison harness. Logic is
otherwise identical to apply_framework.py (classify-then-group approach),
including the corrected record-start rule.
"""
import re
import json
import hashlib
import os
import sys
from collections import Counter, defaultdict

sys.path.insert(0, os.path.dirname(__file__))
import shape_naming

TS_PATTERNS = [
    ("iso8601_offset_ms", re.compile(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}[+-]\d{2}:\d{2}")),
    ("iso8601_offset_no_ms", re.compile(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}")),
    ("iso8601_space_hms", re.compile(r"\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}")),
    ("iso8601_naive", re.compile(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?![+\-.\d])")),
    ("syslog_no_year", re.compile(r"[A-Z][a-z]{2}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2}")),
    ("slash_date_hms", re.compile(r"\d{2}/\d{2}/\d{4}\s\d{2}:\d{2}:\d{2}")),
    ("iso8601_slash_hms", re.compile(r"\d{4}/\d{2}/\d{2}\s\d{2}:\d{2}:\d{2}")),
]


def detect_timestamp(text):
    for name, pat in TS_PATTERNS:
        mo = pat.search(text)
        if mo:
            return name, mo.start(), len(mo.group(0))
    return None, None, None


def classify_format(text):
    t = text.strip()
    if not t:
        return "EMPTY"
    if t.startswith("{"):
        try:
            json.loads(t)
            return "json"
        except Exception:
            return "json_like_malformed"
    if re.match(r"^<\d+>", t):
        return "syslog_priority"
    if "|" in t and t.count("|") >= 3:
        return "pipe_delimited"
    if "," in t and re.match(r"^\d{2}/\d{2}/\d{4}", t):
        return "csv_dated"
    return "OTHER"


def is_record_start(text):
    if text == "":
        return False
    if text[0] in ("\t", " "):
        return False
    fmt = classify_format(text)
    if fmt in ("json", "syslog_priority", "pipe_delimited", "csv_dated"):
        return True
    ts_name, offset, width = detect_timestamp(text)
    if ts_name and offset is not None and offset <= 5:
        return True
    return True  # corrected default: new record, not continuation


def read_raw_lines(path):
    raw = open(path, "rb").read()
    has_bom = raw.startswith(b"\xef\xbb\xbf")
    body = raw[3:] if has_bom else raw
    physical = []
    buf = bytearray()
    i = 0
    while i < len(body):
        b = body[i]
        if b == 0x0D and i + 1 < len(body) and body[i + 1] == 0x0A:
            physical.append((bytes(buf), "CRLF")); buf = bytearray(); i += 2
        elif b == 0x0A:
            physical.append((bytes(buf), "LF")); buf = bytearray(); i += 1
        else:
            buf.append(b); i += 1
    if buf:
        physical.append((bytes(buf), "NONE"))
    decoded = [(b.decode("utf-8", errors="replace"), ending) for b, ending in physical]
    return has_bom, len(raw), decoded


def shape_token(text, fmt):
    # Delimiter+arity is only for a format with NO name (per the framework: "If a
    # format has no name but has real structure ... derive a shape token instead").
    # csv_dated already has a name from classify_format(), so it fingerprints on
    # that name directly -- deriving arity from a naive delimiter count would
    # re-expose the exact delimiter-collision pitfall (a quoted comma) that named-
    # format fingerprinting is supposed to be immune to.
    if fmt == "pipe_delimited":
        return f"pipe/{text.count('|') + 1}"
    if fmt == "OTHER":
        # Structured but unnamed, and not confidently delimiter-countable --
        # do NOT dump it in a single OTHER bucket (understates diversity).
        # Fall back to a masked token skeleton per the framework.
        return shape_naming.masked_skeleton(text)
    return fmt


def field_count_of(text, fmt):
    """Naive, structure-UNAWARE field count -- deliberately naive so the
    delimiter-collision pitfall (a quoted comma) is reproducible and
    testable, not silently avoided by smarter parsing. Applies to any
    format with a countable delimiter, not just the two named buckets --
    field count is a per-line dimension in its own right (Assessment
    Dimensions table), independent of whether the format itself has a name."""
    if fmt == "json" or fmt == "FREE_TEXT":
        return None
    if "|" in text:
        return text.count("|") + 1
    if "," in text:
        return text.count(",") + 1
    return None


def run(path):
    has_bom, total_bytes, decoded = read_raw_lines(path)

    events = []
    current = None
    for lineno, (text, ending) in enumerate(decoded, start=1):
        if current is None or is_record_start(text):
            if current is not None:
                events.append(current)
            current = {"lines": [(text, ending, lineno)]}
        else:
            current["lines"].append((text, ending, lineno))
    if current is not None:
        events.append(current)

    for ev in events:
        head_text, head_ending, head_lineno = ev["lines"][0]
        fmt = classify_format(head_text)
        ts_name, ts_offset, ts_width = detect_timestamp(head_text)
        ev["format"] = fmt if fmt not in ("OTHER",) else ("FREE_TEXT" if not re.search(r"[|,{]", head_text) else "OTHER")
        ev["ts_format"] = ts_name
        ev["ts_offset"] = ts_offset
        ev["ts_width"] = ts_width
        ev["field_count"] = field_count_of(head_text, ev["format"])
        ev["first_char_class"] = (
            "digit" if head_text[:1].isdigit() else "alpha" if head_text[:1].isalpha() else
            "symbol" if head_text[:1] else "empty"
        )
        ev["structure"] = "single" if len(ev["lines"]) == 1 else "multi"
        ev["line_ending"] = head_ending
        ev["line_count"] = len(ev["lines"])
        ev["bytes"] = sum(len(t.encode("utf-8")) + (2 if e == "CRLF" else 1) for t, e, _ in ev["lines"])

    fmt_counter = Counter(ev["format"] for ev in events)
    ts_counter = Counter(ev["ts_format"] for ev in events if ev["ts_format"])
    struct_counter = Counter(ev["structure"] for ev in events)
    end_counter = Counter(ev["line_ending"] for ev in events)
    fc_counter = Counter(ev["first_char_class"] for ev in events)

    maj_fmt = fmt_counter.most_common(1)[0][0]
    maj_ts = ts_counter.most_common(1)[0][0] if ts_counter else None
    maj_struct = struct_counter.most_common(1)[0][0]
    maj_fc = fc_counter.most_common(1)[0][0]
    maj_end = end_counter.most_common(1)[0][0]

    def conforms_all(e):
        return (e["format"] == maj_fmt and e["ts_format"] == maj_ts and
                e["structure"] == maj_struct and e["first_char_class"] == maj_fc and e["line_ending"] == maj_end)

    all_conf_events = [e for e in events if conforms_all(e)]
    all_nonconf_events = [e for e in events if not conforms_all(e)]
    all_conf = len(all_conf_events)

    # ---- Two counting units (Core Concept): line-level vs event-level ----
    # A conforming event contributes ALL of its physical lines to the
    # line-level count, not just one -- so the two percentages diverge
    # exactly when multi-line (folded) records exist.
    total_lines = len(decoded)
    conforming_lines = sum(e["line_count"] for e in all_conf_events)
    line_level_pct = round(100 * conforming_lines / total_lines, 4) if total_lines else None
    event_level_pct = round(100 * all_conf / len(events), 4) if events else None

    # ---- Per-axis three-way partition report (bytes / events / percentage) ----
    total_bytes_all = sum(e["bytes"] for e in events)

    def partition(key_fn, majority_value, axis_name):
        conf = [e for e in events if key_fn(e) == majority_value]
        nonconf = [e for e in events if key_fn(e) != majority_value]
        conf_bytes = sum(e["bytes"] for e in conf)
        nonconf_bytes = sum(e["bytes"] for e in nonconf)
        return {
            "axis": axis_name, "baseline": majority_value,
            "conf_events": len(conf), "conf_bytes": conf_bytes,
            "conf_pct_events": round(100 * len(conf) / len(events), 2) if events else None,
            "conf_pct_bytes": round(100 * conf_bytes / total_bytes_all, 2) if total_bytes_all else None,
            "nonconf_events": len(nonconf), "nonconf_bytes": nonconf_bytes,
            "nonconf_pct_events": round(100 * len(nonconf) / len(events), 2) if events else None,
            "nonconf_pct_bytes": round(100 * nonconf_bytes / total_bytes_all, 2) if total_bytes_all else None,
        }

    summary_block = [
        partition(lambda e: e["format"], maj_fmt, "format"),
        partition(lambda e: e["ts_format"], maj_ts, "ts_format"),
        partition(lambda e: e["structure"], maj_struct, "structure"),
        partition(lambda e: e["first_char_class"], maj_fc, "first_char_class"),
        partition(lambda e: e["line_ending"], maj_end, "line_ending"),
    ]

    # ---- Non-conformer list with attributed reasons ----
    non_conformers = []
    for e in all_nonconf_events:
        reasons = []
        if e["format"] != maj_fmt:
            reasons.append(f"format={e['format']} (majority={maj_fmt})")
        if e["ts_format"] != maj_ts:
            reasons.append(f"ts_format={e['ts_format']} (majority={maj_ts})")
        if e["structure"] != maj_struct:
            reasons.append(f"structure={e['structure']} (majority={maj_struct})")
        if e["first_char_class"] != maj_fc:
            reasons.append(f"first_char_class={e['first_char_class']} (majority={maj_fc})")
        if e["line_ending"] != maj_end:
            reasons.append(f"line_ending={e['line_ending']} (majority={maj_end})")
        non_conformers.append({"line": e["lines"][0][2], "reasons": reasons})

    # ---- Structural fingerprinting, with degenerate-base-tuple extension ----
    # If format and ts_format are BOTH constant across every fingerprinted
    # event, the base (format|ts_format) tuple carries no distinguishing
    # signal at all -- extend it with a type_key (a schema hash, here: the
    # sorted set of "key=" style top-level JSON keys, or the field count
    # for delimited formats) so distinct record types don't collapse into
    # a false single fingerprint.
    fp_formats = {e["format"] for e in events if e["format"] != "FREE_TEXT"}
    fp_ts_formats = {e["ts_format"] for e in events if e["format"] != "FREE_TEXT"}
    base_tuple_degenerate = len(fp_formats) <= 1 and len(fp_ts_formats) <= 1

    def type_key_of(head_text, fmt):
        if fmt == "json":
            try:
                obj = json.loads(head_text)
                return ",".join(sorted(obj.keys()))
            except Exception:
                return None
        return None

    fingerprints = Counter()
    shape_names = {}  # fingerprint -> {shape_token, shape_hash, codename}
    UNNAMED_FORMATS = ("pipe_delimited", "OTHER")
    for ev in events:
        if ev["format"] == "FREE_TEXT":
            fingerprints["FREE_TEXT"] += 1
            continue
        shape = shape_token(ev["lines"][0][0], ev["format"])
        key = f"{shape}|{ev['ts_format']}"
        if base_tuple_degenerate:
            key = f"{key}|{type_key_of(ev['lines'][0][0], ev['format'])}"
        fp = hashlib.md5(key.encode()).hexdigest()[:8]
        fingerprints[fp] += 1
        if ev["format"] in UNNAMED_FORMATS and fp not in shape_names:
            shape_hash, codename = shape_naming.codename_for_token(shape)
            shape_names[fp] = {"shape_token": shape, "shape_hash": shape_hash, "codename": codename}

    ts_width_by_format = defaultdict(set)
    for e in events:
        if e["ts_format"]:
            ts_width_by_format[e["ts_format"]].add(e["ts_width"])
    ts_offset_by_format = defaultdict(set)
    for e in events:
        if e["ts_format"]:
            ts_offset_by_format[e["ts_format"]].add(e["ts_offset"])
    field_count_distribution = defaultdict(Counter)
    for e in events:
        if e["field_count"] is not None:
            field_count_distribution[e["format"]][e["field_count"]] += 1

    return {
        "file": path,
        "has_bom": has_bom,
        "total_physical_lines": len(decoded),
        "total_logical_events": len(events),
        "continuation_lines": len(decoded) - len(events),
        "majority": {"format": maj_fmt, "ts_format": maj_ts, "structure": maj_struct, "first_char_class": maj_fc, "line_ending": maj_end},
        "ts_width_by_format": {k: sorted(v) for k, v in ts_width_by_format.items()},
        "ts_offset_by_format": {k: sorted(v) for k, v in ts_offset_by_format.items()},
        "field_count_distribution": {k: dict(v) for k, v in field_count_distribution.items()},
        "format_breakdown": dict(fmt_counter),
        "ts_format_breakdown": dict(ts_counter),
        "line_ending_breakdown": dict(end_counter),
        "structure_breakdown": dict(struct_counter),
        "all_axes_conforming_events": all_conf,
        "all_axes_conforming_lines": conforming_lines,
        "line_level_pct": line_level_pct,
        "event_level_pct": event_level_pct,
        "summary_block": summary_block,
        "non_conformers": non_conformers,
        "base_tuple_degenerate": base_tuple_degenerate,
        "distinct_fingerprints_excl_freetext": len([k for k in fingerprints if k != "FREE_TEXT"]),
        "free_text_events": fingerprints.get("FREE_TEXT", 0),
        "shape_names": shape_names,
    }
