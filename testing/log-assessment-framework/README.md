# Log Assessment Framework — regression suite

A rigorous test corpus and harness for the "Log Assessment Framework" reference
article and AI prompt in `index.html` (Reference → Log Assessment Framework;
Prompt Library → Log Assessment Framework). This exists to test the
**specification itself** — whether the documented procedure is unambiguous
enough that an independent implementation, built only from its wording,
produces correct and mutually-consistent results.

## Methodology

1. **Ground-truth generation.** `generate_test_log.py` and `generate_corpus.py`
   produce synthetic log files with deliberately injected, precisely recorded
   structural characteristics (multiple formats, multiple timestamp patterns,
   multi-line records, mixed line endings, a UTF-8 BOM, delimiter collisions,
   ambiguous date ordering, an unnamed proprietary format, free-text lines).
   The exact expected answer for each file is recorded in a companion
   `*ground_truth.json`, not derived from the assessor.

2. **Independent blind implementations.** `apply_framework_v1_lib.py` and
   `apply_framework_v2.py` each mechanically apply the framework's documented
   procedure (steps 1–10: ingest, split, format detection, record-start rule,
   feature extraction, majority baseline, conformance scoring, byte/event/
   percentage partition reporting, non-conformer attribution, structural
   fingerprinting) using deliberately different code architectures
   (classify-then-group vs. a streaming state machine), so that agreement
   between them is a real signal, not two copies of the same code agreeing
   with itself.

3. **Differential + ground-truth comparison.** `run_regression_suite.py` runs
   both implementations against every file in `corpus/` plus the larger
   combined stress file (`test_sample.log`), and checks:
   - both implementations agree with each other,
   - both agree with the recorded ground truth,
   - structural invariants hold (partition sums, fingerprint bounds, etc.).

4. **Property-based / fuzz testing.** `fuzz_test.py` generates 40 randomized
   files (random format mix, random minority rates, random line-ending and
   BOM combinations, 5–300 lines each) and checks the same invariants and
   v1/v2 agreement hold universally, not just on the hand-picked corpus.

## Running it

```bash
python3 generate_test_log.py     # regenerates test_sample.log + ground_truth.json
python3 generate_corpus.py       # regenerates corpus/*.log + corpus/corpus_ground_truth.json
python3 run_regression_suite.py  # runs both implementations against the full corpus
python3 fuzz_test.py             # 40 randomized property-based trials
```

All four currently pass with 0 issues (192 checks in the regression suite, 680
in the fuzz run).

## What this found

The first blind run (before the current fix) surfaced a real specification
gap: the record-start rule ("a new record begins only on a line with a
leading timestamp / leading digit / `{`") didn't say what to do with a
standalone line that has *no* leading whitespace and matches *no* known
pattern — e.g. a banner or separator line. A literal implementation defaulted
such lines to "continuation," silently folding them into the preceding
record instead of flagging them as their own (typically FREE_TEXT) events.
This was fixed in `index.html`'s Procedure step 4 and Common Pitfalls
checklist (both the reference article and the AI prompt): only leading
whitespace/tab or an established open-block context counts as evidence of
continuation; anything else defaults to starting a new record. The fix was
verified by rerunning the same blind test and confirming the previously
lost events were recovered exactly.

A second issue was caught by the differential (v1 vs v2) comparison itself,
in the test harness rather than the spec: an early v2 draft used
anchored-at-position-0 timestamp matching instead of search-based extraction
(the exact pitfall the framework's own "Timestamp offset" guidance warns
about), and both harnesses initially applied delimiter+arity shape-token
fingerprinting to a *named* format instead of reserving it for genuinely
unnamed ones — which re-exposed the delimiter-collision pitfall inside
fingerprinting. Both were harness bugs, not spec bugs, but finding them is
exactly what running two independent implementations is for.

## Regenerating after a spec change

If the Log Assessment Framework's wording changes again, rerun
`run_regression_suite.py` and `fuzz_test.py` against the existing corpus
first (don't regenerate the corpus) to check the change didn't silently
break something that used to pass. Only add new corpus files for genuinely
new pitfalls or edge cases.
