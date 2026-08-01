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
   v1/v2 agreement hold universally, not just on the hand-picked corpus. It
   also directly fuzzes the shape-naming primitives (below) with 500 random
   token strings.

5. **Shape naming** (Structural Fingerprinting → "Naming the derived shape").
   `shape_naming.py` is shared configuration both implementations import
   identically — the word lists and hashing scheme aren't the procedure
   under test, so sharing them is what makes a codename comparable between
   v1 and v2. What each script decides independently is *when* to invoke
   shape derivation (named vs. unnamed format) and *which* method applies:
   delimiter+arity (`pipe/5`) for a countable-delimiter unnamed format, or a
   masked digit/letter skeleton (`9999-99-99 99:99:99,AAAAA,...`) when there's
   no confident delimiter to count arity on. Corpus files 12 and 13 isolate
   each path; the regression suite and fuzz test both check codename format
   compliance (`FMT-adjective-noun-hash4`) and determinism (recomputing from
   a recorded shape_hash or shape_token always reproduces the same result).

6. **Coverage completeness.** Both implementations compute and expose every
   mechanism the spec actually requires, not just the ones convenient to
   test: the two counting units (line-level vs. event-level percentages,
   which must diverge exactly when folded multi-line records exist and be
   equal otherwise), the full byte/event/percentage three-way partition
   report per axis, the non-conformer list with attributed reasons, field
   count and timestamp offset/width tracking, and the degenerate-base-tuple
   `type_key` fingerprint extension. Corpus file 14 isolates the degenerate
   case (constant format + constant timestamp format, two genuinely
   distinct JSON schemas); file 15 isolates non-UTF-8 byte handling.

## Running it

```bash
python3 generate_test_log.py     # regenerates test_sample.log + ground_truth.json
python3 generate_corpus.py       # regenerates corpus/*.log + corpus/corpus_ground_truth.json
python3 run_regression_suite.py  # runs both implementations against the full corpus
python3 fuzz_test.py             # 40 randomized property-based trials + 500 naming-primitive trials
```

All four currently pass with 0 issues (792 checks in the regression suite, 2240
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

A third, pre-existing gap was found once shape-naming coverage was added:
neither implementation had ever derived a real shape for the "OTHER" bucket
(structured but unrecognised, no confident delimiter) — every such event
collapsed into one bare `OTHER` fingerprint regardless of its actual shape,
understating diversity exactly as the framework warns against. Both scripts
now fall back to the masked-token-skeleton derivation for that case.

One documentation-only inconsistency was noticed but not (yet) changed: the
reference article's worked example `2026-07-31T04:03Z → 9999-99-99T99:99A`
masks the trailing `Z` but leaves the `T` separator unmasked, which doesn't
follow the stated rule "letter runs → A" literally (both are single-letter
runs). `shape_naming.masked_skeleton()` implements the rule as literally
stated (masking both), which is the more internally-consistent reading — the
example itself may just be imprecise. Worth a small wording fix if picked
up later, but it doesn't affect correctness of the implemented behaviour.

A coverage audit ("does every spec mechanism actually have a test, not just
the ones that happen to be exercised already") found the library refactor
that made `run(path)` callable for the regression suite had silently
*dropped* several things the original one-off script computed: line-level
vs. event-level percentages were never computed at all (only event-level),
the full byte/event/percentage summary block was gone, the non-conformer
list was gone, and `ts_offset`/`ts_width`/field count were computed and then
immediately discarded without ever being stored or checked. The degenerate-
base-tuple `type_key` extension had never been implemented in either
implementation. All were restored/implemented and are now covered by both
the regression suite and the fuzz test.

Closing those gaps immediately surfaced three more real, pre-existing bugs
that no prior check had a way to catch:
- Corpus file 03's "fixed-width timestamp trap" ground truth claimed both
  patterns were 19 characters wide, but the minority pattern was actually
  21 — nothing had ever verified the claim itself. Replaced the contrived
  minority pattern with a realistic same-width one (dash- vs. slash-
  separated date), genuinely 19 characters in both cases.
- Corpus file 05 ("prefix before the timestamp") used an ISO 8601 timestamp
  *without* milliseconds, which matched none of the six timestamp patterns
  either implementation knew about -- every line in that file had `ts_format
  = None` the entire time, so the prefix/offset mechanism it was built to
  test was never actually exercised. Added an `iso8601_offset_no_ms`
  pattern to both.
- Corpus file 02's ("delimiter collision") rows used an ISO 8601 dash-format
  timestamp, which doesn't match the `csv_dated` classifier's slash-date
  requirement, so every row classified as `OTHER` rather than `csv_dated` --
  the new field-count tracking (keyed only to named formats) silently
  produced nothing for this file. Made field-count computation apply to any
  format with a countable delimiter, not just two hardcoded named buckets.

None of these three would have been caught by the differential (v1 vs v2)
check alone, since both implementations shared the same underlying
assumption. They only surfaced because the new checks asserted a *specific,
independently-stated* ground-truth fact (a width, a pattern, a bucket name)
rather than just "the two implementations agree."

## Regenerating after a spec change

If the Log Assessment Framework's wording changes again, rerun
`run_regression_suite.py` and `fuzz_test.py` against the existing corpus
first (don't regenerate the corpus) to check the change didn't silently
break something that used to pass. Only add new corpus files for genuinely
new pitfalls or edge cases.
