"""
Mechanically applies the Log Assessment Framework's documented procedure
(steps 1-10 as written in the reference article / AI prompt) to a raw log
sample, WITHOUT reference to how the sample was generated. This is a blind
application of the method, built only from what the framework specifies:
  1. Ingest raw -- encoding/BOM/line-ending detection
  2. Split into physical lines, number them
  3. Detect dominant serialization format
  4. Record-start rule + fold continuation lines into events
  5. Extract per-line features
  6. Compute majority baseline per axis
  7. Score conformance per line
  8. Aggregate percentages + three-way (%/bytes/events) partition reporting
  9. Flag and explain non-conformers
  10. Structural fingerprinting
"""
import re
import json
import hashlib
from collections import Counter, defaultdict

import os
PATH = os.path.join(os.path.dirname(__file__), "test_sample.log")

# ---------- Step 1: Ingest raw ----------
raw = open(PATH, "rb").read()
has_bom = raw.startswith(b"\xef\xbb\xbf")
body = raw[3:] if has_bom else raw

# ---------- Step 2: split into physical lines, preserving line-ending info ----------
# Split on \r\n or \n, recording which was used, without decoding-normalisation first.
physical = []
buf = bytearray()
i = 0
while i < len(body):
    b = body[i]
    if b == 0x0D and i + 1 < len(body) and body[i + 1] == 0x0A:  # CRLF
        physical.append((bytes(buf), "CRLF"))
        buf = bytearray()
        i += 2
    elif b == 0x0A:  # LF
        physical.append((bytes(buf), "LF"))
        buf = bytearray()
        i += 1
    else:
        buf.append(b)
        i += 1
if buf:
    physical.append((bytes(buf), "NONE"))

decoded = [(b.decode("utf-8", errors="replace"), ending) for b, ending in physical]

# ---------- Timestamp pattern library (Step 5/6: known patterns to match against) ----------
TS_PATTERNS = [
    ("iso8601_offset_ms", re.compile(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}[+-]\d{2}:\d{2}")),
    ("iso8601_space_hms", re.compile(r"\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}")),
    ("syslog_no_year", re.compile(r"[A-Z][a-z]{2}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2}")),
    ("slash_date_hms", re.compile(r"\d{2}/\d{2}/\d{4}\s\d{2}:\d{2}:\d{2}")),
]

def detect_timestamp(text):
    for name, pat in TS_PATTERNS:
        mo = pat.search(text)
        if mo:
            return name, mo.start(), len(mo.group(0))
    return None, None, None

# ---------- Format classifier (Step 3/5) ----------
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
    # tab/space leading continuation-style line: treat format as CONTINUATION candidate
    if t[0].isdigit() or t[0] in "{[":
        return "OTHER"
    return "OTHER"

# ---------- Step 4: record-start rule (CORRECTED per the reference article fix) ----------
# Continuation status must be earned, not defaulted: the ONLY evidence of
# continuation is leading whitespace/tab (or an open-block context, not
# needed for this corpus). A line with no leading whitespace that matches
# no known record-start pattern is NOT a continuation by default -- it
# starts its own record and is left to fail conformance / bucket as
# FREE_TEXT on its own merits.

def is_record_start(text):
    if text == "":
        return False  # ambiguous; handled by caller via previous-state
    if text[0] in ("\t", " "):
        return False  # only actual evidence of continuation
    fmt = classify_format(text)
    if fmt in ("json", "syslog_priority", "pipe_delimited", "csv_dated"):
        return True
    ts_name, offset, width = detect_timestamp(text)
    if ts_name and offset is not None and offset <= 5:
        return True
    return True  # no leading whitespace and no pattern match -> new record by default, not a continuation

events = []  # each: {event_id, lines: [(text, ending, phys_line_no)], }
current = None
for lineno, (text, ending) in enumerate(decoded, start=1):
    if is_record_start(text) or current is None:
        if current is not None:
            events.append(current)
        current = {"lines": [(text, ending, lineno)]}
    else:
        current["lines"].append((text, ending, lineno))
if current is not None:
    events.append(current)
for idx, ev in enumerate(events, start=1):
    ev["event_id"] = idx

# ---------- Step 5: extract per-line / per-event features (computed on the record-start line) ----------
for ev in events:
    head_text, head_ending, head_lineno = ev["lines"][0]
    fmt = classify_format(head_text)
    ts_name, ts_offset, ts_width = detect_timestamp(head_text)
    ev["format"] = fmt if fmt not in ("OTHER",) else ("FREE_TEXT" if not re.search(r"[|,{]", head_text) else "OTHER")
    ev["ts_format"] = ts_name
    ev["ts_offset"] = ts_offset
    ev["ts_width"] = ts_width
    ev["first_char"] = head_text[0] if head_text else ""
    ev["first_char_class"] = (
        "digit" if ev["first_char"].isdigit() else
        "alpha" if ev["first_char"].isalpha() else
        "symbol" if ev["first_char"] else "empty"
    )
    ev["structure"] = "single" if len(ev["lines"]) == 1 else "multi"
    ev["line_ending"] = head_ending
    total_chars = sum(len(t) for t, _, _ in ev["lines"])
    total_bytes = sum(len(t.encode("utf-8")) + (2 if e == "CRLF" else 1) for t, e, _ in ev["lines"])
    ev["chars"] = total_chars
    ev["bytes"] = total_bytes
    ev["field_count"] = head_text.count(",") + 1 if fmt == "csv_dated" else (head_text.count("|") + 1 if fmt == "pipe_delimited" else None)

# ---------- Step 6: majority baseline per axis ----------
fmt_counter = Counter(ev["format"] for ev in events)
ts_counter = Counter(ev["ts_format"] for ev in events if ev["ts_format"])
struct_counter = Counter(ev["structure"] for ev in events)
firstchar_counter = Counter(ev["first_char_class"] for ev in events)
ending_counter = Counter(ev["line_ending"] for ev in events)

majority_format = fmt_counter.most_common(1)[0][0]
majority_ts = ts_counter.most_common(1)[0][0] if ts_counter else None
majority_struct = struct_counter.most_common(1)[0][0]
majority_firstchar = firstchar_counter.most_common(1)[0][0]
majority_ending = ending_counter.most_common(1)[0][0]

# ---------- Step 7/8: conformance scoring, 3-way (percentage / bytes / events) ----------
def partition_report(key_fn, majority_value, axis_name):
    conf_events = [ev for ev in events if key_fn(ev) == majority_value]
    nonconf_events = [ev for ev in events if key_fn(ev) != majority_value]
    total_events = len(events)
    total_bytes = sum(ev["bytes"] for ev in events)
    conf_bytes = sum(ev["bytes"] for ev in conf_events)
    nonconf_bytes = sum(ev["bytes"] for ev in nonconf_events)
    return {
        "axis": axis_name,
        "baseline": majority_value,
        "conf_pct_events": round(100 * len(conf_events) / total_events, 2),
        "conf_events": len(conf_events),
        "conf_pct_bytes": round(100 * conf_bytes / total_bytes, 2),
        "conf_bytes": conf_bytes,
        "nonconf_pct_events": round(100 * len(nonconf_events) / total_events, 2),
        "nonconf_events": len(nonconf_events),
        "nonconf_pct_bytes": round(100 * nonconf_bytes / total_bytes, 2),
        "nonconf_bytes": nonconf_bytes,
    }

summary_block = [
    partition_report(lambda e: e["format"], majority_format, "Serialization format"),
    partition_report(lambda e: e["ts_format"], majority_ts, "Timestamp format"),
    partition_report(lambda e: e["structure"], majority_struct, "Structure (single-line)"),
    partition_report(lambda e: e["first_char_class"], majority_firstchar, "First-char class"),
    partition_report(lambda e: e["line_ending"], majority_ending, "Line ending"),
]

def all_axes_conform(ev):
    return (ev["format"] == majority_format and ev["ts_format"] == majority_ts and
            ev["structure"] == majority_struct and ev["first_char_class"] == majority_firstchar and
            ev["line_ending"] == majority_ending)

all_conf = [ev for ev in events if all_axes_conform(ev)]
all_nonconf = [ev for ev in events if not all_axes_conform(ev)]
total_bytes_all = sum(ev["bytes"] for ev in events)
all_axes_row = {
    "axis": "All axes combined",
    "conf_pct_events": round(100 * len(all_conf) / len(events), 2),
    "conf_events": len(all_conf),
    "conf_pct_bytes": round(100 * sum(e["bytes"] for e in all_conf) / total_bytes_all, 2),
    "conf_bytes": sum(e["bytes"] for e in all_conf),
    "nonconf_pct_events": round(100 * len(all_nonconf) / len(events), 2),
    "nonconf_events": len(all_nonconf),
    "nonconf_pct_bytes": round(100 * sum(e["bytes"] for e in all_nonconf) / total_bytes_all, 2),
    "nonconf_bytes": sum(e["bytes"] for e in all_nonconf),
}

# ---------- Step 9: non-conformer list with attributed reasons ----------
non_conformers = []
for ev in events:
    reasons = []
    if ev["format"] != majority_format:
        reasons.append(f"format={ev['format']} (majority={majority_format})")
    if ev["ts_format"] != majority_ts:
        reasons.append(f"timestamp_format={ev['ts_format']} (majority={majority_ts})")
    if ev["structure"] != majority_struct:
        reasons.append(f"structure={ev['structure']} (majority={majority_struct})")
    if ev["line_ending"] != majority_ending:
        reasons.append(f"line_ending={ev['line_ending']} (majority={majority_ending})")
    if reasons:
        non_conformers.append({"event_id": ev["event_id"], "line": ev["lines"][0][2], "reasons": reasons, "text": ev["lines"][0][0][:80]})

# ---------- Step 10: structural fingerprinting ----------
def shape_token(text, fmt):
    # Arity-based shape tokens are only for an UNNAMED format; csv_dated already
    # has a name and must fingerprint on it directly, or a delimiter-collision row
    # (a quoted comma) silently mints a spurious extra fingerprint bucket.
    if fmt == "pipe_delimited":
        return f"pipe/{text.count('|') + 1}"
    return fmt

fingerprints = {}
fp_examples = defaultdict(list)
for ev in events:
    if ev["format"] == "FREE_TEXT":
        fp = "FREE_TEXT"
    else:
        shape = shape_token(ev["lines"][0][0], ev["format"]) if ev["format"] in ("pipe_delimited", "OTHER") else ev["format"]
        key = f"{shape}|{ev['ts_format']}"
        fp = hashlib.md5(key.encode()).hexdigest()[:8]
        fingerprints.setdefault(fp, {"shape": shape, "ts_format": ev["ts_format"], "count": 0, "bytes": 0})
        fingerprints[fp]["count"] += 1
        fingerprints[fp]["bytes"] += ev["bytes"]
    fp_examples[fp].append(ev["event_id"])

distinct_structural = len(fingerprints)  # excludes FREE_TEXT bucket by construction

# ---------- Report ----------
report = {
    "step1_ingest": {"has_bom": has_bom, "total_bytes": len(raw)},
    "step2_lines": {"total_physical_lines": len(decoded)},
    "step4_events": {"total_logical_events": len(events), "continuation_lines": len(decoded) - len(events)},
    "step6_majority_baseline": {
        "format": majority_format, "timestamp_format": majority_ts,
        "structure": majority_struct, "first_char_class": majority_firstchar, "line_ending": majority_ending,
    },
    "step8_summary_block": summary_block + [all_axes_row],
    "step9_non_conformers_count": len(non_conformers),
    "step9_non_conformers_sample": non_conformers[:15],
    "step10_fingerprint": {
        "distinct_structural_types": distinct_structural,
        "types": [{"fingerprint": k, **v, "example_event_ids": fp_examples[k][:3]} for k, v in fingerprints.items()],
        "free_text_events": len(fp_examples.get("FREE_TEXT", [])),
    },
    "format_breakdown": dict(fmt_counter),
    "timestamp_format_breakdown": dict(ts_counter),
}

OUT = os.path.join(os.path.dirname(__file__), "framework_output.json")
with open(OUT, "w") as f:
    json.dump(report, f, indent=2, default=str)

print(json.dumps(report, indent=2, default=str))
