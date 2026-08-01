"""
Property-based / fuzz testing: generate many randomized log files with
randomized structure, and check that invariants hold universally (not just
on the fixed corpus), and that v1/v2 keep agreeing. A failure here finds
bug classes fixed examples wouldn't stumble into.
"""
import os
import sys
import json
import random
import tempfile

sys.path.insert(0, os.path.dirname(__file__))
import apply_framework_v1_lib as v1
import apply_framework_v2 as v2
import shape_naming

random.seed(1234)

FMT_GENERATORS = [
    lambda i: '{"time":"2026-08-0%dT%02d:%02d:%02d.%03d+10:00","user":"u%d","result":"ok"}' % (1 + i % 3, i % 24, i % 60, i % 60, i % 1000, i % 20),
    lambda i: "<%d>Aug %2d %02d:%02d:%02d host%d proc[%d]: message" % (10 + i % 5, 1 + i % 28, i % 24, i % 60, i % 60, i % 5, i),
    lambda i: "2026-08-0%d %02d:%02d:%02d|host%d|WARN|metric|%d%%" % (1 + i % 3, i % 24, i % 60, i % 60, i % 5, i % 100),
    lambda i: "%02d/%02d/2026 %02d:%02d:%02d,user%d,note,ok" % (1 + i % 12, 1 + i % 12, i % 24, i % 60, i % 60, i % 20),
]

N_FILES = 40
issues = []
oks = 0

for trial in range(N_FILES):
    n_lines = random.randint(5, 300)
    majority_gen = random.choice(FMT_GENERATORS)
    minority_gen = random.choice(FMT_GENERATORS)
    minority_rate = random.choice([0, 0.02, 0.05, 0.15, 0.3])
    crlf_rate = random.choice([0, 0.05, 0.2])
    freetext_rate = random.choice([0, 0.01, 0.05])
    bom = random.choice([True, False])

    lines = []
    for i in range(n_lines):
        r = random.random()
        if r < freetext_rate:
            text = random.choice(["-- banner --", "TODO fixme", "====END===="])
        elif r < freetext_rate + minority_rate:
            text = minority_gen(i)
        else:
            text = majority_gen(i)
        ending = "\r\n" if random.random() < crlf_rate else "\n"
        lines.append((text, ending))

    fd, path = tempfile.mkstemp(suffix=".log")
    os.close(fd)
    with open(path, "wb") as f:
        if bom:
            f.write(b"\xef\xbb\xbf")
        for text, ending in lines:
            f.write(text.encode("utf-8"))
            f.write(ending.encode("utf-8"))

    try:
        r1 = v1.run(path)
        r2 = v2.run(path)

        # Invariant 1: format breakdown sums to total events (both implementations)
        for label, r in (("v1", r1), ("v2", r2)):
            s = sum(r["format_breakdown"].values())
            if s != r["total_logical_events"]:
                issues.append(f"trial {trial} [{label}]: format_breakdown sum {s} != total_logical_events {r['total_logical_events']} (n_lines={n_lines})")
            else:
                oks += 1
            # Invariant 2: continuation_lines + events == physical_lines
            if r["continuation_lines"] + r["total_logical_events"] != r["total_physical_lines"]:
                issues.append(f"trial {trial} [{label}]: continuation+events != physical_lines (n_lines={n_lines})")
            else:
                oks += 1
            # Invariant 3: distinct fingerprints <= total events
            if r["distinct_fingerprints_excl_freetext"] > r["total_logical_events"]:
                issues.append(f"trial {trial} [{label}]: distinct_fingerprints > total_events (n_lines={n_lines})")
            else:
                oks += 1
            # Invariant 4: all_axes_conforming_events <= total events
            if r["all_axes_conforming_events"] > r["total_logical_events"]:
                issues.append(f"trial {trial} [{label}]: all_axes_conforming_events > total_events")
            else:
                oks += 1
            # Invariant 5: total_physical_lines == n_lines generated
            if r["total_physical_lines"] != n_lines:
                issues.append(f"trial {trial} [{label}]: total_physical_lines {r['total_physical_lines']} != generated {n_lines}")
            else:
                oks += 1
            # Invariant 6: has_bom detection matches what was written
            if r["has_bom"] != bom:
                issues.append(f"trial {trial} [{label}]: has_bom {r['has_bom']} != actual {bom}")
            else:
                oks += 1

        # Differential: v1 vs v2 event/line counts must agree
        for field in ("total_physical_lines", "total_logical_events", "continuation_lines", "distinct_fingerprints_excl_freetext", "free_text_events"):
            if r1[field] != r2[field]:
                issues.append(f"trial {trial}: v1/v2 DISAGREE on {field}: v1={r1[field]} v2={r2[field]} (n_lines={n_lines}, minority_rate={minority_rate}, crlf_rate={crlf_rate}, freetext_rate={freetext_rate}, bom={bom})")
            else:
                oks += 1

        # Shape naming: every shape_names entry either implementation produced
        # must be well-formed and deterministic; where both produced an entry
        # for the same fingerprint, they must agree exactly.
        for label, r in (("v1", r1), ("v2", r2)):
            for fp, entry in r.get("shape_names", {}).items():
                if not shape_naming.CODENAME_PATTERN.match(entry["codename"]):
                    issues.append(f"trial {trial} [{label}]: codename {entry['codename']!r} does not match FMT-adjective-noun-hash4 pattern")
                else:
                    oks += 1
                if shape_naming.codename_of(entry["shape_hash"]) != entry["codename"]:
                    issues.append(f"trial {trial} [{label}]: codename not reproducible from shape_hash {entry['shape_hash']}")
                else:
                    oks += 1
                if shape_naming.shape_hash_of(entry["shape_token"]) != entry["shape_hash"]:
                    issues.append(f"trial {trial} [{label}]: shape_hash not reproducible from shape_token {entry['shape_token']!r}")
                else:
                    oks += 1
        common_fps = set(r1.get("shape_names", {})) & set(r2.get("shape_names", {}))
        for fp in common_fps:
            if r1["shape_names"][fp] != r2["shape_names"][fp]:
                issues.append(f"trial {trial}: v1/v2 DISAGREE on shape_names[{fp}]: v1={r1['shape_names'][fp]} v2={r2['shape_names'][fp]}")
            else:
                oks += 1
    finally:
        os.remove(path)

# Direct property fuzz of the naming primitives themselves, independent of
# any log file: random shape-token strings must always produce a
# well-formed, deterministic codename, and re-hashing/re-naming a value
# already seen must reproduce the identical result (a real pure-function
# check, not just "didn't crash").
random_tokens = ["".join(random.choices("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/|,-: ", k=random.randint(1, 40))) for _ in range(500)]
seen = {}
naming_issues = 0
for tok in random_tokens:
    h1, c1 = shape_naming.codename_for_token(tok)
    h2, c2 = shape_naming.codename_for_token(tok)  # recompute independently
    if h1 != h2 or c1 != c2:
        issues.append(f"naming fuzz: token {tok!r} non-deterministic across calls: ({h1},{c1}) vs ({h2},{c2})")
        naming_issues += 1
        continue
    if not shape_naming.CODENAME_PATTERN.match(c1):
        issues.append(f"naming fuzz: token {tok!r} produced malformed codename {c1!r}")
        naming_issues += 1
        continue
    if tok in seen and seen[tok] != (h1, c1):
        issues.append(f"naming fuzz: token {tok!r} produced different results on repeat: {seen[tok]} vs {(h1, c1)}")
        naming_issues += 1
    seen[tok] = (h1, c1)
    oks += 1
print(f"Naming primitive fuzz: {len(random_tokens)} random tokens, {naming_issues} issue(s)")

print(f"Ran {N_FILES} randomized trials.")
print(f"Checks passed: {oks}")
print(f"Issues found: {len(issues)}")
for i in issues[:40]:
    print("ISSUE:", i)
