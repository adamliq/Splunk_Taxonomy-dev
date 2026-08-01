"""
Generates an isolated-pitfall test corpus for the Log Assessment Framework:
one small file per checklist pitfall (clean baseline + exactly one injected
defect type), plus a fully clean file for false-positive/specificity testing.
Each file gets its own ground-truth record in corpus_ground_truth.json.
"""
import json
import os

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
# "2026-08-01 09:15:30" (YYYY-MM-DD HH:MM:SS) vs "30-08-01 09:15:2026" (fake DD-MM-YY HH:MM:YYYY) -- contrived but same width, different pattern.
lines = []
for i in range(N):
    if i % 10 == 9:
        # same width (19 chars), transposed pattern: DD-MM-YY HH:MM:SSYY (deliberately different meaning, same length)
        text = f"01-08-26 09:{i%60:02d}:005026|user{i}|login|success"
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

TRUTH_PATH = os.path.join(OUT_DIR, "corpus_ground_truth.json")
with open(TRUTH_PATH, "w") as f:
    json.dump(corpus_truth, f, indent=2)

print(f"Generated {len(corpus_truth)} corpus files in {OUT_DIR}")
for name in corpus_truth:
    print(" -", name)
print("Ground truth:", TRUTH_PATH)
