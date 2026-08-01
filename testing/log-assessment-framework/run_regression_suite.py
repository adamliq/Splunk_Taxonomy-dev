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


def diff_v1_v2(r1, r2, fname):
    fields_to_compare = [
        "total_physical_lines", "total_logical_events", "continuation_lines",
        "distinct_fingerprints_excl_freetext", "free_text_events", "has_bom",
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
