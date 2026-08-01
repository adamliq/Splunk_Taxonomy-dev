# Assess-LogFile.ps1 — standalone PowerShell port

A self-contained PowerShell implementation of the Log Assessment Framework
procedure, for running the assessment on a disconnected/air-gapped machine
with no Python, no internet, and no AI access — typically a Windows host,
so it targets Windows PowerShell 5.1 (built into every supported Windows
release, no install required) as well as PowerShell 7+ (`pwsh`).

```powershell
.\Assess-LogFile.ps1 -Path C:\logs\app.log
.\Assess-LogFile.ps1 -Path .\sample.log -JsonOutput .\report.json -ShowNonConformers
```

Run `Get-Help .\Assess-LogFile.ps1 -Full` for parameter details.

## What it is, and isn't

This is a port of the *procedure* (`../apply_framework_v1_lib.py`), not of
the Python test suite. It implements every mechanism the spec requires:
raw ingest with BOM/encoding/line-ending detection, the corrected
record-start/continuation rule, per-event feature extraction, majority
baseline and byte/event/percentage conformance scoring (both counting
units — line-level and event-level), attributed non-conformer reporting,
and structural fingerprinting including the degenerate-base-tuple
`type_key` extension and "Naming the derived shape" codenames.

## Cross-tool determinism

The framework's spec states codenames must be identical "across every run,
file, and machine." The word lists (`$script:FmtAdjectives` /
`$script:FmtNouns`) and MD5-based hashing scheme here are copied verbatim
from `shape_naming.py`, so the same structural shape produces the same
`FMT-adjective-noun-hash4` codename whether it's assessed by this script or
the Python tool. Verified by `/tmp`-style differential runs (not checked
into the repo) that ran this script via `pwsh -NoProfile -File` against
every file in `../corpus/`, parsed its `-JsonOutput`, and compared every
field against `corpus_ground_truth.json` — the same ground truth the Python
regression suite (`../run_regression_suite.py`) checks against. All 15
corpus files and the combined stress file (`../test_sample.log`) match,
including exact codename agreement (e.g. `FMT-ember-heron-044f` for the
same pipe-delimited shape, produced independently by both tools).

## PowerShell-specific pitfalls this hit (and how they were fixed)

None of these are Python issues; each was found by isolated reproduction
before fixing:

- **`Set-StrictMode -Version Latest` + empty pipelines.** `Measure-Object`
  emits *no* output object for an empty pipeline (not one with `Sum = 0`),
  so a bare `(X | Measure-Object -Sum).Sum` throws "the property 'Sum'
  cannot be found on this object" once the pipeline is empty. Fixed with a
  `Get-SumSafe` helper that checks for empty input first.
- **`foreach` as an expression returns `$null`, not `@()`, for zero
  iterations.** `.Count` on that throws under strict mode. Fixed by
  wrapping every such assignment (`$nonConformers`, `$summaryBlock`,
  format/ts breakdowns) in `@(...)`.
- **`Format-Table -AutoSize` produces no output at all** when run
  non-interactively (`pwsh -NoProfile -File` from a redirected/piped
  context) — reproduced even for a single trivial object, attributed to
  console-width auto-detection failing headless. The summary block is
  hand-formatted with `-f` string alignment instead.
- **`ConvertTo-Json` can't serialize a `HashSet[T]`**, and requires all
  hashtable keys to be strings (an `int` key throws "Keys must be
  strings"). Timestamp width/offset sets are built as `HashSet[int]`
  internally for fast dedup, then converted to sorted arrays before being
  returned; field-count distribution keys are explicitly stringified.

## Performance

PowerShell's per-object and per-cmdlet-call overhead is real, and this
script is measurably slower than the Python reference at the same input
size — expected for an interpreted, dynamically-dispatched shell language
versus Python, and not something a disconnected-environment tool needs to
match exactly. Two fixes mattered most:

- Building each event as a single `[PSCustomObject]@{...}` hashtable
  literal instead of repeated `Add-Member` calls (`Add-Member`'s per-call
  overhead dominates at thousands of events).
- Classifying each line's format/timestamp **once**, during the Step 4
  grouping pass, and caching the result for reuse in Step 5 annotation,
  instead of classifying every head line twice.

Measured on a 50,000-line synthetic JSON log (single dominant format,
single dominant timestamp format — the "degenerate base tuple" case):
total run ~89s, of which structural fingerprinting alone is ~27s. That
stage re-parses every event's JSON individually (via `ConvertFrom-Json`)
to compute the `type_key` schema signature needed to tell distinct schemas
apart when format and timestamp format alone can't — the same
per-cmdlet-call overhead, paid once per event, is the dominant cost on
large homogeneous JSON logs.

The framework's own worked example reasons about a 10,000-line sample, not
a full production log, and this script is sized for that: representative
excerpts, not multi-million-line files. For a very large source, assess a
recent time window or a single rotated file rather than the whole stream.
