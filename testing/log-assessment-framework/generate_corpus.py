"""
Generates an isolated-pitfall test corpus for the Log Assessment Framework:
one small file per checklist pitfall (clean baseline + exactly one injected
defect type), plus a fully clean file for false-positive/specificity testing.
Each file gets its own ground-truth record in corpus_ground_truth.json.
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
import shape_naming

OUT_DIR = os.path.join(os.path.dirname(__file__), "corpus")
os.makedirs(OUT_DIR, exist_ok=True)

corpus_truth = {}

def clean_line(i):
    return f'{{"time":"2026-08-01T09:{i%60:02d}:{(i*7)%60:02d}.{(i*37)%1000:03d}+10:00","host":"app0{1+i%3}","user":"user{i%9}","event_type":"login","result":"success"}}'

def write_file(name, lines_with_endings, bom=False):
    path = os.path.join(OUT_DIR, name)
    with open(path, "wb") as f:
        if bom:
            f.write(b"\xef\xbb\xbf")
        for text, ending in lines_with_endings:
            f.write(text.encode("utf-8"))
            f.write(ending.encode("utf-8") if ending != "" else b"")
    return path

N = 100

# ---------- 1. Clean baseline (no defects) ----------
lines = [(clean_line(i), "\n") for i in range(N)]
write_file("01_clean_baseline.log", lines)
corpus_truth["01_clean_baseline.log"] = {
    "pitfall": None,
    "total_lines": N, "total_events": N,
    "expected_all_axes_conforming_events": N,
    "expected_distinct_fingerprints": 1,
    "purpose": "Specificity check: framework must NOT flag any non-conformers or false pitfalls on clean data.",
}

# ---------- 2. Delimiter collision ----------
lines = []
for i in range(N):
    if i == 50:
        text = f'2026-08-01T09:{i%60:02d}:00,user{i},"Login from City, Country",success'
    else:
        text = f'2026-08-01T09:{i%60:02d}:00,user{i},Login from City,success'
    lines.append((text, "\n"))
write_file("02_delimiter_collision.log", lines)
corpus_truth["02_delimiter_collision.log"] = {
    "pitfall": "Delimiter collision",
    "total_lines": N, "total_events": N,
    "injected_at_line": 51,
    "naive_field_count_at_injected_line": 5,
    "correct_field_count_at_injected_line": 4,
    "purpose": "Naive comma-split must overcount fields on line 51 (quoted comma) unless structure-aware parsing is used.",
}

# ---------- 3. Fixed-width timestamp trap ----------
# Two different timestamp *patterns*, same character width (19 chars):
# "2026-08-01 09:15:30" (dash-separated date) vs "2026/08/01 09:15:30"
# (slash-separated date) -- a realistic scenario (a source or config change
# swapping the date separator), same width, genuinely different pattern.
lines = []
for i in range(N):
    if i % 10 == 9:
        text = f"2026/08/01 09:{i%60:02d}:00|user{i}|login|success"
    else:
        text = f"2026-08-01 09:{i%60:02d}:00|user{i}|login|success"
    lines.append((text, "\n"))
write_file("03_fixed_width_timestamp_trap.log", lines)
corpus_truth["03_fixed_width_timestamp_trap.log"] = {
    "pitfall": "Fixed-width timestamp trap",
    "total_lines": N, "total_events": N,
    "majority_pattern_lines": 90, "minority_pattern_lines": 10,
    "both_patterns_char_width": 19,
    "purpose": "Both timestamp tokens are 19 characters wide but different patterns -- a width-only check would treat them as conformant when they are not.",
}

# ---------- 4. Mixed date ordering ----------
lines = []
for i in range(N):
    if i < 50:
        date = "03/04/2026"  # intended day-first: 3 Apr
    else:
        date = "04/03/2026"  # ambiguous: could be 4 Mar (day-first) or read as Apr 3 (month-first)
    text = f"{date} 09:{i%60:02d}:00,user{i},login,success"
    lines.append((text, "\n"))
write_file("04_mixed_date_ordering.log", lines)
corpus_truth["04_mixed_date_ordering.log"] = {
    "pitfall": "Mixed date ordering",
    "total_lines": N, "total_events": N,
    "day_first_intended_for_all": True,
    "ambiguous_lines": 50,
    "purpose": "All 100 rows are DD/MM/YYYY, but the 50 rows with day<=12 (04/03) are numerically ambiguous with MM/DD/YYYY -- framework should flag the ambiguity, not silently assume one reading.",
}

# ---------- 5. Prefix before the timestamp ----------
lines = []
for i in range(N):
    if i % 10 == 9:
        text = f"<13>2026-08-01T09:{i%60:02d}:00+10:00 host{i} process[{i}]: message text"
    else:
        text = f"2026-08-01T09:{i%60:02d}:00+10:00 host{i} process[{i}]: message text"
    lines.append((text, "\n"))
write_file("05_prefix_before_timestamp.log", lines)
corpus_truth["05_prefix_before_timestamp.log"] = {
    "pitfall": "Prefix before the timestamp",
    "total_lines": N, "total_events": N,
    "lines_with_prefix": 10,
    "prefix": "<13>",
    "expected_offset_on_prefixed_lines": 4,
    "purpose": "10 lines carry a 4-character <13> priority prefix before the timestamp -- fixed-slice extraction (offset 0) would break on these; offset-conformance axis should flag them.",
}

# ---------- 6. Multi-line records ----------
lines = []
eid = 0
for i in range(N):
    lines.append((clean_line(i), "\n"))
    eid += 1
    if i % 20 == 19:
        lines.append((f"\tat com.example.Handler.process(Handler.java:{100+i})", "\n"))
        lines.append((f"\tat com.example.Dispatcher.run(Dispatcher.java:{50+i})", "\n"))
write_file("06_multiline_records.log", lines)
corpus_truth["06_multiline_records.log"] = {
    "pitfall": "Multi-line records",
    "total_lines": len(lines), "total_events": N,
    "multiline_records": 5, "continuation_lines_per_record": 2,
    "total_continuation_lines": 10,
    "purpose": "5 records have 2 tab-indented continuation lines each (stack trace). A naive line-oriented parser would emit 10 bogus extra events instead of folding them.",
}

# ---------- 7. Line endings (mixed LF/CRLF) ----------
lines = []
for i in range(N):
    ending = "\r\n" if i % 10 == 9 else "\n"
    lines.append((clean_line(i), ending))
write_file("07_mixed_line_endings.log", lines)
corpus_truth["07_mixed_line_endings.log"] = {
    "pitfall": "Line endings",
    "total_lines": N, "total_events": N,
    "lf_lines": 90, "crlf_lines": 10,
    "purpose": "10 of 100 lines use CRLF against an LF majority -- an unhandled trailing \\r would corrupt the last field of those 10 records.",
}

# ---------- 8. Encoding (UTF-8 BOM) ----------
lines = [(clean_line(i), "\n") for i in range(N)]
write_file("08_utf8_bom.log", lines, bom=True)
corpus_truth["08_utf8_bom.log"] = {
    "pitfall": "Encoding",
    "total_lines": N, "total_events": N,
    "has_bom": True,
    "purpose": "File-level UTF-8 BOM attaches invisible bytes to the first field of line 1 unless detected and stripped before parsing.",
}

# ---------- 9. Timezone (naive vs offset-aware) ----------
lines = []
for i in range(N):
    if i % 10 == 9:
        text = f'{{"time":"2026-08-01T09:{i%60:02d}:00","host":"app01","user":"user{i}","result":"success"}}'  # naive, no offset
    else:
        text = clean_line(i)  # offset-aware
    lines.append((text, "\n"))
write_file("09_timezone_naive_vs_aware.log", lines)
corpus_truth["09_timezone_naive_vs_aware.log"] = {
    "pitfall": "Timezone",
    "total_lines": N, "total_events": N,
    "offset_aware_lines": 90, "naive_lines": 10,
    "purpose": "10 timestamps omit the UTC offset entirely -- cross-source correlation/ordering becomes unreliable for those events.",
}

# ---------- 10. Whitespace type (tabs vs spaces indentation) ----------
lines = []
for i in range(N):
    lines.append((clean_line(i), "\n"))
    if i % 20 == 19:
        indent = "\t" if i % 40 == 19 else "    "
        lines.append((f"{indent}continuation detail for event {i}", "\n"))
write_file("10_whitespace_type.log", lines)
corpus_truth["10_whitespace_type.log"] = {
    "pitfall": "Whitespace type",
    "total_lines": len(lines), "total_events": N,
    "tab_indented_continuations": 3, "space_indented_continuations": 2,
    "purpose": "Continuation lines mix tab and space indentation -- changes both first-character class and character count between otherwise-equivalent continuation lines.",
}

# ---------- 11. Ambiguous continuation default (the just-fixed gap) ----------
lines = []
for i in range(N):
    lines.append((clean_line(i), "\n"))
    if i in (24, 49, 74):
        lines.append(("---- shift boundary ----", "\n"))
write_file("11_ambiguous_continuation_default.log", lines)
corpus_truth["11_ambiguous_continuation_default.log"] = {
    "pitfall": "Ambiguous continuation default",
    "total_lines": len(lines), "total_events": N + 3,
    "standalone_freetext_lines": 3,
    "purpose": "3 unindented banner lines with no recognisable pattern must be recognised as their own (FREE_TEXT) events, not silently folded into the preceding JSON record.",
}

# ---------- 12. Shape naming: unnamed format via delimiter+arity ----------
# 60 lines, ALL an unnamed pipe-delimited format (5 fields), so the majority
# baseline IS the derived shape itself, not a minority pitfall.
PIPE_SHAPE_N = 60
lines = []
for i in range(PIPE_SHAPE_N):
    text = f"2026-08-01 09:{i%60:02d}:00|host1|WARN|disk_usage|92%"
    lines.append((text, "\n"))
write_file("12_shape_naming_delimiter_arity.log", lines)
expected_shape_token_12 = "pipe/5"
expected_shape_hash_12, expected_codename_12 = shape_naming.codename_for_token(expected_shape_token_12)
corpus_truth["12_shape_naming_delimiter_arity.log"] = {
    "pitfall": "Shape naming (unnamed format, delimiter+arity)",
    "total_lines": PIPE_SHAPE_N, "total_events": PIPE_SHAPE_N,
    "expected_distinct_fingerprints": 1,
    "expected_shape_token": expected_shape_token_12,
    "expected_shape_hash": expected_shape_hash_12,
    "expected_codename": expected_codename_12,
    "purpose": "Every line is the same unnamed pipe-delimited (5-field) format -- must derive shape token pipe/5 and a stable, deterministic FMT-adjective-noun-hash4 codename, not collapse into a bare OTHER bucket.",
}

# ---------- 13. Shape naming: unnamed format via masked token skeleton ----------
# 60 lines, ALL an unnamed comma-separated-but-not-csv_dated format (fails
# csv_dated's slash-date requirement, so it falls to OTHER and must use the
# masked-skeleton derivation instead of delimiter+arity).
SKEL_N = 60
lines = []
for i in range(SKEL_N):
    text = f"2026-08-01 09:{i%60:02d}:00,LOGIN,jsmith,app01"
    lines.append((text, "\n"))
write_file("13_shape_naming_masked_skeleton.log", lines)
expected_skeleton = shape_naming.masked_skeleton(f"2026-08-01 09:00:00,LOGIN,jsmith,app01")
expected_shape_hash_13, expected_codename_13 = shape_naming.codename_for_token(expected_skeleton)
corpus_truth["13_shape_naming_masked_skeleton.log"] = {
    "pitfall": "Shape naming (unnamed format, masked token skeleton)",
    "total_lines": SKEL_N, "total_events": SKEL_N,
    "expected_distinct_fingerprints": 1,
    "expected_shape_token": expected_skeleton,
    "expected_shape_hash": expected_shape_hash_13,
    "expected_codename": expected_codename_13,
    "purpose": "A comma-separated but non-csv_dated (no slash-date) unnamed format with no confident delimiter/arity signal -- must fall back to a masked digit/letter skeleton, not collapse into a bare OTHER bucket, and must still name it deterministically.",
}

# ---------- 14. Degenerate base tuple: same format + same timestamp format, two schemas ----------
# Every line is JSON with the identical timestamp pattern -- format and
# timestamp_format are BOTH constant, so fingerprint = md5(format|ts_format)
# alone would collapse everything to ONE bucket. There genuinely are two
# distinct record types here (different key sets), distinguishable only by
# extending the tuple with a type_key (sorted JSON key set).
DEGEN_N = 80
lines = []
for i in range(DEGEN_N):
    ts = f"2026-08-01T09:{i%60:02d}:{(i*7)%60:02d}.000+10:00"
    if i % 2 == 0:
        text = f'{{"time":"{ts}","user":"user{i%9}","result":"success"}}'
    else:
        text = f'{{"time":"{ts}","host":"app0{1+i%3}","metric":"cpu","value":{i%100}}}'
    lines.append((text, "\n"))
write_file("14_degenerate_base_tuple.log", lines)
corpus_truth["14_degenerate_base_tuple.log"] = {
    "pitfall": "Degenerate base tuple (type_key extension)",
    "total_lines": DEGEN_N, "total_events": DEGEN_N,
    "expected_base_tuple_degenerate": True,
    "expected_distinct_fingerprints": 2,
    "purpose": "Format (json) and timestamp_format are both constant across the whole file, so the base fingerprint tuple is degenerate. Two genuinely distinct JSON schemas (different key sets) exist and must be told apart via a type_key extension, not silently collapsed into one fingerprint.",
}

# ---------- 15. Encoding: non-UTF-8 bytes ----------
# One line contains a genuinely invalid UTF-8 byte sequence (a lone
# continuation byte, 0x80, with no leading byte). Ingest must not crash --
# "non-UTF-8 bytes crash or mojibake naive readers. Detect and normalise."
NONUTF8_N = 30
path15 = os.path.join(OUT_DIR, "15_non_utf8_bytes.log")
with open(path15, "wb") as f:
    for i in range(NONUTF8_N):
        if i == 15:
            # valid ASCII prefix/suffix around one deliberately invalid byte
            f.write(f'{{"time":"2026-08-01T09:{i%60:02d}:00.000+10:00","user":"user'.encode("utf-8"))
            f.write(b"\x80\x80")  # invalid: lone continuation bytes, no leading byte
            f.write(f'","result":"success"}}\n'.encode("utf-8"))
        else:
            f.write((clean_line(i) + "\n").encode("utf-8"))
corpus_truth["15_non_utf8_bytes.log"] = {
    "pitfall": "Encoding (non-UTF-8 bytes)",
    "total_lines": NONUTF8_N, "total_events": NONUTF8_N,
    "invalid_byte_line": 16,
    "purpose": "Line 16 contains two invalid lone UTF-8 continuation bytes (0x80 0x80) with no leading byte. Ingest must decode this without crashing (replacement-character fallback is acceptable) and must not lose or miscount the line.",
}

TRUTH_PATH = os.path.join(OUT_DIR, "corpus_ground_truth.json")
with open(TRUTH_PATH, "w") as f:
    json.dump(corpus_truth, f, indent=2)

print(f"Generated {len(corpus_truth)} corpus files in {OUT_DIR}")
for name in corpus_truth:
    print(" -", name)
print("Ground truth:", TRUTH_PATH)
