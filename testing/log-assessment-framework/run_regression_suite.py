"""
Regression harness: runs both independent implementations against every
corpus file (+ the big combined stress file), checks:
  (a) v1 vs v2 agreement (differential testing -- disagreement = spec ambiguity)
  (b) agreement with recorded ground truth where available
  (c) structural invariants that must hold regardless of input
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
import apply_framework_v1_lib as v1
import apply_framework_v2 as v2
import shape_naming

BASE = os.path.dirname(__file__)
CORPUS_DIR = os.path.join(BASE, "corpus")

issues = []
oks = []


def check(cond, msg):
    (oks if cond else issues).append(msg)


def run_invariants(result, label):
    r = result
    # invariant: format breakdown sums to total events
    fmt_sum = sum(r["format_breakdown"].values())
    check(fmt_sum == r["total_logical_events"], f"[{label}] format_breakdown sums to total_logical_events ({fmt_sum} vs {r['total_logical_events']})")
    # invariant: continuation_lines + total_logical_events == total_physical_lines
    check(r["continuation_lines"] + r["total_logical_events"] == r["total_physical_lines"],
          f"[{label}] continuation_lines + events == physical_lines ({r['continuation_lines']}+{r['total_logical_events']}={r['continuation_lines']+r['total_logical_events']} vs {r['total_physical_lines']})")
    # invariant: distinct fingerprints <= total events
    check(r["distinct_fingerprints_excl_freetext"] <= r["total_logical_events"],
          f"[{label}] distinct_fingerprints ({r['distinct_fingerprints_excl_freetext']}) <= total_events ({r['total_logical_events']})")
    # invariant: all_axes_conforming_events <= total events
    check(r["all_axes_conforming_events"] <= r["total_logical_events"],
          f"[{label}] all_axes_conforming_events <= total_events")
    # invariant: free_text_events counted in format_breakdown too
    fb_freetext = r["format_breakdown"].get("FREE_TEXT", 0)
    check(fb_freetext == r["free_text_events"], f"[{label}] FREE_TEXT format_breakdown ({fb_freetext}) matches free_text_events ({r['free_text_events']})")

    # invariant: two counting units -- line-level conforming count >= event-level
    # conforming count (a conforming event always contributes >=1 line), and they
    # are EQUAL iff there are no continuation lines at all (no folded multi-line
    # records anywhere, conforming or not -- so every event is exactly one line).
    check(r["all_axes_conforming_lines"] >= r["all_axes_conforming_events"],
          f"[{label}] conforming_lines ({r['all_axes_conforming_lines']}) >= conforming_events ({r['all_axes_conforming_events']})")
    if r["continuation_lines"] == 0:
        check(r["line_level_pct"] == r["event_level_pct"],
              f"[{label}] no continuation lines -> line-level pct ({r['line_level_pct']}) == event-level pct ({r['event_level_pct']})")
    else:
        check(r["line_level_pct"] != r["event_level_pct"] or r["all_axes_conforming_events"] == 0,
              f"[{label}] continuation lines present ({r['continuation_lines']}) -> line-level pct ({r['line_level_pct']}) diverges from event-level pct ({r['event_level_pct']})")

    # invariant: per-axis summary_block partitions reconcile to the totals
    total_events = r["total_logical_events"]
    total_bytes = sum(row["conf_bytes"] + row["nonconf_bytes"] for row in r["summary_block"][:1]) if r["summary_block"] else 0
    for row in r["summary_block"]:
        check(row["conf_events"] + row["nonconf_events"] == total_events,
              f"[{label}] summary_block[{row['axis']}] conf+nonconf events == total ({row['conf_events']}+{row['nonconf_events']} vs {total_events})")
        if total_bytes:
            check(row["conf_bytes"] + row["nonconf_bytes"] == total_bytes,
                  f"[{label}] summary_block[{row['axis']}] conf+nonconf bytes == file total bytes")

    # invariant: non-conformer list matches all_axes accounting, and every
    # entry has at least one attributed reason (never a bare percentage).
    expected_nonconf = total_events - r["all_axes_conforming_events"]
    check(len(r["non_conformers"]) == expected_nonconf,
          f"[{label}] non_conformers count ({len(r['non_conformers'])}) matches total-conforming ({expected_nonconf})")
    check(all(nc["reasons"] for nc in r["non_conformers"]),
          f"[{label}] every non-conformer has at least one attributed reason")


def diff_v1_v2(r1, r2, fname):
    fields_to_compare = [
        "total_physical_lines", "total_logical_events", "continuation_lines",
        "distinct_fingerprints_excl_freetext", "free_text_events", "has_bom",
        "all_axes_conforming_events", "all_axes_conforming_lines",
        "line_level_pct", "event_level_pct", "base_tuple_degenerate",
    ]
    for f in fields_to_compare:
        if r1[f] != r2[f]:
            issues.append(f"[{fname}] DISAGREEMENT v1 vs v2 on {f}: v1={r1[f]!r} v2={r2[f]!r}")
    # majority format should agree
    if r1["majority"]["format"] != r2["majority"]["format"]:
        issues.append(f"[{fname}] DISAGREEMENT v1 vs v2 on majority format: v1={r1['majority']['format']!r} v2={r2['majority']['format']!r}")
    if r1["majority"]["ts_format"] != r2["majority"]["ts_format"]:
        issues.append(f"[{fname}] DISAGREEMENT v1 vs v2 on majority ts_format: v1={r1['majority']['ts_format']!r} v2={r2['majority']['ts_format']!r}")
    else:
        oks.append(f"[{fname}] v1/v2 agree on all core metrics")


def check_ground_truth(result, truth, fname):
    if "total_events" in truth:
        check(result["total_logical_events"] == truth["total_events"],
              f"[{fname}] total_events matches ground truth ({result['total_logical_events']} vs {truth['total_events']})")
    if "total_lines" in truth:
        check(result["total_physical_lines"] == truth["total_lines"],
              f"[{fname}] total_lines matches ground truth ({result['total_physical_lines']} vs {truth['total_lines']})")
    if "expected_distinct_fingerprints" in truth:
        check(result["distinct_fingerprints_excl_freetext"] == truth["expected_distinct_fingerprints"],
              f"[{fname}] distinct fingerprints matches ground truth ({result['distinct_fingerprints_excl_freetext']} vs {truth['expected_distinct_fingerprints']})")
    if "expected_all_axes_conforming_events" in truth:
        check(result["all_axes_conforming_events"] == truth["expected_all_axes_conforming_events"],
              f"[{fname}] all-axes conforming events matches ground truth ({result['all_axes_conforming_events']} vs {truth['expected_all_axes_conforming_events']})")
    if "has_bom" in truth:
        check(result["has_bom"] == truth["has_bom"], f"[{fname}] BOM detection matches ground truth")
    if "lf_lines" in truth and "crlf_lines" in truth:
        check(result["line_ending_breakdown"].get("LF", 0) == truth["lf_lines"] and
              result["line_ending_breakdown"].get("CRLF", 0) == truth["crlf_lines"],
              f"[{fname}] LF/CRLF breakdown matches ground truth (LF={result['line_ending_breakdown'].get('LF',0)}/{truth['lf_lines']}, CRLF={result['line_ending_breakdown'].get('CRLF',0)}/{truth['crlf_lines']})")
    if "standalone_freetext_lines" in truth:
        check(result["free_text_events"] == truth["standalone_freetext_lines"],
              f"[{fname}] FREE_TEXT event count matches ground truth ({result['free_text_events']} vs {truth['standalone_freetext_lines']})")
    if "multiline_records" in truth and "continuation_lines_per_record" in truth:
        expected_cont = truth["multiline_records"] * truth["continuation_lines_per_record"]
        check(result["continuation_lines"] == expected_cont,
              f"[{fname}] continuation-line count matches ground truth ({result['continuation_lines']} vs {expected_cont})")
    if "expected_offset_on_prefixed_lines" in truth:
        # A prefix (e.g. syslog priority <13>) pushes the timestamp off
        # offset 0 -- both offset 0 (unprefixed majority) and the prefixed
        # offset must actually be observed under the SAME ts_format, proving
        # search-based extraction found the timestamp regardless of the
        # prefix rather than missing it or misclassifying it as a different
        # pattern.
        offsets = result.get("ts_offset_by_format", {})
        maj_ts = result["majority"]["ts_format"]
        observed = offsets.get(maj_ts, [])
        check(0 in observed, f"[{fname}] offset 0 observed for unprefixed lines under {maj_ts} ({observed})")
        check(truth["expected_offset_on_prefixed_lines"] in observed,
              f"[{fname}] prefixed-line offset {truth['expected_offset_on_prefixed_lines']} observed under {maj_ts} ({observed})")
    if "expected_base_tuple_degenerate" in truth:
        check(result["base_tuple_degenerate"] == truth["expected_base_tuple_degenerate"],
              f"[{fname}] base_tuple_degenerate matches ground truth ({result['base_tuple_degenerate']} vs {truth['expected_base_tuple_degenerate']})")
    if "both_patterns_char_width" in truth:
        # The fixed-width trap: majority AND minority timestamp patterns must
        # both actually be observed at the SAME width, yet remain classified
        # as two DIFFERENT ts_formats (proving width alone can't distinguish
        # them -- pattern must be validated, not just length).
        widths = result.get("ts_width_by_format", {})
        check(len(widths) >= 2,
              f"[{fname}] at least two distinct ts_formats observed ({list(widths.keys())})")
        matching = [name for name, ws in widths.items() if truth["both_patterns_char_width"] in ws]
        check(len(matching) >= 2,
              f"[{fname}] >=2 ts_formats share width {truth['both_patterns_char_width']} (fixed-width trap reproduced): {matching}")
    if "naive_field_count_at_injected_line" in truth and "correct_field_count_at_injected_line" in truth:
        # Delimiter collision: the naive (structure-unaware) field counter
        # must actually overcount on the collision row while every other
        # csv_dated row reports the correct count -- proving the pitfall is
        # mechanically real, not just "the event total happens to match."
        maj_format = result["majority"]["format"]
        dist = result.get("field_count_distribution", {}).get(maj_format, {})
        correct, naive = truth["correct_field_count_at_injected_line"], truth["naive_field_count_at_injected_line"]
        check(dist.get(naive, 0) == 1,
              f"[{fname}] exactly one {maj_format} row shows the naive miscounted field_count {naive} ({dist})")
        check(dist.get(correct, 0) == truth["total_events"] - 1,
              f"[{fname}] all other {maj_format} rows show the correct field_count {correct} ({dist})")
    if "expected_shape_token" in truth:
        shape_entries = list(result.get("shape_names", {}).values())
        check(len(shape_entries) == 1,
              f"[{fname}] exactly one shape_names entry produced ({len(shape_entries)})")
        if shape_entries:
            entry = shape_entries[0]
            check(entry["shape_token"] == truth["expected_shape_token"],
                  f"[{fname}] shape_token matches ground truth ({entry['shape_token']!r} vs {truth['expected_shape_token']!r})")
            check(entry["shape_hash"] == truth["expected_shape_hash"],
                  f"[{fname}] shape_hash matches ground truth ({entry['shape_hash']} vs {truth['expected_shape_hash']})")
            check(entry["codename"] == truth["expected_codename"],
                  f"[{fname}] codename matches ground truth ({entry['codename']} vs {truth['expected_codename']})")


def check_shape_naming_properties(result, label):
    """Structural checks on every shape_names entry a run produced: correct
    FMT-adjective-noun-hash4 format, and determinism (recomputing codename_of
    on the recorded shape_hash reproduces the same recorded codename --
    proving it's a pure function, not a random draw that happened once)."""
    for fp, entry in result.get("shape_names", {}).items():
        check(bool(shape_naming.CODENAME_PATTERN.match(entry["codename"])),
              f"[{label}] codename {entry['codename']!r} matches FMT-adjective-noun-hash4 pattern")
        recomputed = shape_naming.codename_of(entry["shape_hash"])
        check(recomputed == entry["codename"],
              f"[{label}] codename is deterministic: recomputing from shape_hash {entry['shape_hash']} reproduces {entry['codename']!r} (got {recomputed!r})")
        # shape_hash itself must be reproducible from the recorded shape_token
        rehashed = shape_naming.shape_hash_of(entry["shape_token"])
        check(rehashed == entry["shape_hash"],
              f"[{label}] shape_hash is deterministic: rehashing token {entry['shape_token']!r} reproduces {entry['shape_hash']} (got {rehashed})")


def diff_shape_names(r1, r2, fname):
    """v1 and v2 must agree on shape_token/shape_hash/codename for every
    fingerprint they both produced -- since shape_naming.py is shared
    configuration, disagreement here means the two scripts derived a
    DIFFERENT shape (or decided differently when to apply shape derivation
    at all), which is a real signal about spec ambiguity, not a naming
    library mismatch."""
    common_fps = set(r1.get("shape_names", {})) & set(r2.get("shape_names", {}))
    for fp in common_fps:
        e1, e2 = r1["shape_names"][fp], r2["shape_names"][fp]
        if e1 != e2:
            issues.append(f"[{fname}] DISAGREEMENT v1 vs v2 on shape_names[{fp}]: v1={e1} v2={e2}")
        else:
            oks.append(f"[{fname}] v1/v2 agree on shape naming for fingerprint {fp}")
    only_v1 = set(r1.get("shape_names", {})) - set(r2.get("shape_names", {}))
    only_v2 = set(r2.get("shape_names", {})) - set(r1.get("shape_names", {}))
    if only_v1:
        issues.append(f"[{fname}] v1 produced shape_names for fingerprints v2 did not: {only_v1}")
    if only_v2:
        issues.append(f"[{fname}] v2 produced shape_names for fingerprints v1 did not: {only_v2}")


def main():
    truth_path = os.path.join(CORPUS_DIR, "corpus_ground_truth.json")
    truth = json.load(open(truth_path))

    for fname in sorted(os.listdir(CORPUS_DIR)):
        if not fname.endswith(".log"):
            continue
        path = os.path.join(CORPUS_DIR, fname)
        r1 = v1.run(path)
        r2 = v2.run(path)
        run_invariants(r1, f"{fname} v1")
        run_invariants(r2, f"{fname} v2")
        diff_v1_v2(r1, r2, fname)
        check_shape_naming_properties(r1, f"{fname} v1")
        check_shape_naming_properties(r2, f"{fname} v2")
        diff_shape_names(r1, r2, fname)
        if fname in truth:
            check_ground_truth(r1, truth[fname], fname + " (v1)")
            check_ground_truth(r2, truth[fname], fname + " (v2)")

    # also run against the big combined stress file
    combined_path = os.path.join(BASE, "test_sample.log")
    combined_truth = json.load(open(os.path.join(BASE, "ground_truth.json")))
    r1 = v1.run(combined_path)
    r2 = v2.run(combined_path)
    run_invariants(r1, "combined v1")
    run_invariants(r2, "combined v2")
    diff_v1_v2(r1, r2, "test_sample.log (combined)")
    check_shape_naming_properties(r1, "combined v1")
    check_shape_naming_properties(r2, "combined v2")
    diff_shape_names(r1, r2, "test_sample.log (combined)")
    check(r1["total_logical_events"] == combined_truth["total_logical_events"],
          f"[combined v1] total_events matches ground truth ({r1['total_logical_events']} vs {combined_truth['total_logical_events']})")
    check(r2["total_logical_events"] == combined_truth["total_logical_events"],
          f"[combined v2] total_events matches ground truth ({r2['total_logical_events']} vs {combined_truth['total_logical_events']})")
    check(r1["distinct_fingerprints_excl_freetext"] == combined_truth["expected_min_distinct_fingerprints"],
          f"[combined v1] distinct fingerprints matches ground truth ({r1['distinct_fingerprints_excl_freetext']} vs {combined_truth['expected_min_distinct_fingerprints']})")
    check(r2["distinct_fingerprints_excl_freetext"] == combined_truth["expected_min_distinct_fingerprints"],
          f"[combined v2] distinct fingerprints matches ground truth ({r2['distinct_fingerprints_excl_freetext']} vs {combined_truth['expected_min_distinct_fingerprints']})")

    print("=" * 70)
    print("LOG ASSESSMENT FRAMEWORK -- REGRESSION SUITE RESULTS")
    print("=" * 70)
    for o in oks:
        print("OK    " + o)
    print()
    for i in issues:
        print("ISSUE " + i)
    print()
    print(f"=== SUMMARY: {len(oks)} passed, {len(issues)} issue(s) found ===")
    return len(issues)


if __name__ == "__main__":
    sys.exit(main())
