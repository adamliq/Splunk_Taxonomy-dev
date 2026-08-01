"""
Generates a synthetic multi-source log file with deliberately injected
structural characteristics, plus a ground-truth JSON recording exactly
what was injected -- for blind-testing the Log Assessment Framework.
"""
import json
import random
import os

random.seed(42)

OUT_LOG = os.path.join(os.path.dirname(__file__), "test_sample.log")
OUT_TRUTH = os.path.join(os.path.dirname(__file__), "ground_truth.json")

users = ["jsmith", "adaley", "rpatel", "mchen", "svc-backup", "kwilliams", "tng"]
hosts = ["app01", "app02", "app03", "web01", "db01"]
event_types = ["login", "logout", "file_access", "config_change", "api_call"]

lines = []          # each item: dict(text=str, line_ending="\n"/"\r\n", event_id=int or None (None=continuation))
ground = {
    "total_physical_lines": None,
    "total_logical_events": None,
    "format_majority": "app_json",
    "timestamp_format_majority": "iso8601_offset_ms",
    "formats": {},           # name -> {lines, events, bytes}
    "timestamp_formats": {}, # name -> {lines, events}
    "line_endings": {"LF": 0, "CRLF": 0},
    "has_bom": True,
    "multiline_records": 0,
    "free_text_lines": 0,
    "pitfalls_injected": [],
    "expected_min_distinct_fingerprints": None,
    "fingerprint_notes": [],
}

event_counter = 0

def new_event_line(text, fmt, ts_fmt, ending="\n"):
    global event_counter
    event_counter += 1
    lines.append({"text": text, "ending": ending, "event_id": event_counter, "format": fmt, "ts_format": ts_fmt})
    return event_counter

def continuation_line(text, ending="\n"):
    lines.append({"text": text, "ending": ending, "event_id": None, "format": None, "ts_format": None})

# ---------------- 1. Majority format: app_json, ISO8601+offset+ms ----------------
MAJ_N = 800
crlf_indices = set(random.sample(range(MAJ_N), 12))  # 12 lines get CRLF instead of LF
multiline_positions = sorted(random.sample(range(50, MAJ_N - 50), 15))  # 15 stack-trace groups
multiline_set = set(multiline_positions)

i = 0
maj_count = 0
while maj_count < MAJ_N:
    ts = f"2026-08-01T{9 + (i // 200):02d}:{(i * 3) % 60:02d}:{(i * 7) % 60:02d}.{(i * 37) % 1000:03d}+10:00"
    user = random.choice(users)
    host = random.choice(hosts)
    et = random.choice(event_types)
    result = "success" if i % 5 else "failure"
    text = json.dumps({"time": ts, "host": host, "event_type": et, "user": user, "result": result}, separators=(",", ":"))
    ending = "\r\n" if i in crlf_indices else "\n"
    eid = new_event_line(text, "app_json", "iso8601_offset_ms", ending)
    maj_count += 1

    if i in multiline_set:
        # error event with a stack-trace continuation (tests record folding + whitespace type)
        err_ts = f"2026-08-01T{9 + (i // 200):02d}:{(i * 3) % 60:02d}:{(i * 7) % 60:02d}.{(i * 37) % 1000:03d}+10:00"
        err_text = json.dumps({"time": err_ts, "host": host, "event_type": "error", "user": user, "level": "ERROR", "message": "Unhandled exception in request pipeline"}, separators=(",", ":"))
        new_event_line(err_text, "app_json", "iso8601_offset_ms", "\n")
        maj_count += 1
        n_cont = random.choice([2, 3, 4])
        indent = "\t" if i % 2 == 0 else "    "  # alternate tabs vs spaces
        for frame in range(n_cont):
            continuation_line(f"{indent}at com.example.Handler.process(Handler.java:{100 + frame})")
        ground["multiline_records"] += 1

    i += 1

# maj_count already includes both the normal event lines and the 15 error-header lines
# (both call new_event_line and increment maj_count); it does NOT include the raw
# continuation lines (those call continuation_line, which never touches maj_count).
ground["formats"]["app_json"] = {"lines": maj_count, "events": maj_count}
ground["timestamp_formats"]["iso8601_offset_ms"] = {"events": maj_count}
ground["line_endings"]["CRLF"] = len(crlf_indices)

# ---------------- 2. Minority format: legacy_syslog with priority prefix ----------------
SYSLOG_N = 40
for i in range(SYSLOG_N):
    day = random.randint(1, 28)
    hh, mm, ss = random.randint(0, 23), random.randint(0, 59), random.randint(0, 59)
    host = random.choice(hosts)
    proc = random.choice(["sshd", "cron", "systemd", "sudo"])
    msg = random.choice(["Accepted password for user", "session opened", "session closed", "authentication failure"])
    text = f"<13>Aug {day:2d} {hh:02d}:{mm:02d}:{ss:02d} {host} {proc}[{1000+i}]: {msg}"
    new_event_line(text, "legacy_syslog", "syslog_no_year", "\n")
ground["formats"]["legacy_syslog"] = {"lines": SYSLOG_N, "events": SYSLOG_N}
ground["timestamp_formats"]["syslog_no_year"] = {"events": SYSLOG_N}
ground["pitfalls_injected"].append({
    "pitfall": "Prefix before the timestamp",
    "detail": f"{SYSLOG_N} legacy_syslog lines carry a <13> priority prefix before the timestamp, pushing it off offset 0.",
})

# ---------------- 3. Minority format: proprietary pipe-delimited (unnamed) ----------------
PIPE_N = 8
for i in range(PIPE_N):
    ts = f"2026-08-0{1 + i % 3} {9+i:02d}:{(i*11)%60:02d}:{(i*13)%60:02d}"
    metric = random.choice(["disk_usage", "cpu_load", "mem_free", "queue_depth"])
    val = f"{random.randint(10,99)}%"
    text = f"{ts}|{random.choice(hosts)}|WARN|{metric}|{val}"
    new_event_line(text, "proprietary_pipe_unnamed", "yyyy_mm_dd_space_hms", "\n")
ground["formats"]["proprietary_pipe_unnamed"] = {"lines": PIPE_N, "events": PIPE_N}
ground["timestamp_formats"]["yyyy_mm_dd_space_hms"] = {"events": PIPE_N}
ground["pitfalls_injected"].append({
    "pitfall": "Unnamed structured format",
    "detail": f"{PIPE_N} lines are a proprietary pipe-delimited format with no standard name; expected shape token = pipe/5 (5 fields).",
})

# ---------------- 4. Minority format: CSV audit export, WITH delimiter collision + mixed date ordering ----------------
CSV_N = 12
mixed_date_rows = []
for i in range(CSV_N):
    if i < 6:
        date_str = f"03/04/2026"   # ambiguous: day-first (3 Apr) intended
    else:
        date_str = f"04/03/2026"   # ambiguous: could be read as (4 Mar) or (3 Apr) depending on convention
        mixed_date_rows.append(i)
    ts = f"{date_str} {9+i:02d}:{(i*5)%60:02d}:11"
    user = random.choice(users)
    if i == 3:
        # delimiter collision: comma embedded inside a quoted field
        text = f'{ts},{user},"Login from Sydney, AU",success'
    else:
        text = f"{ts},{user},Login from AU,success"
    new_event_line(text, "csv_audit", "ambiguous_slash_date", "\n")
ground["formats"]["csv_audit"] = {"lines": CSV_N, "events": CSV_N}
ground["timestamp_formats"]["ambiguous_slash_date"] = {"events": CSV_N}
ground["pitfalls_injected"].append({
    "pitfall": "Mixed date ordering",
    "detail": f"csv_audit rows use DD/MM/YYYY throughout, but 6 of {CSV_N} rows (day=04, month=03) are ambiguous with MM/DD/YYYY since day<=12.",
})
ground["pitfalls_injected"].append({
    "pitfall": "Delimiter collision",
    "detail": "One csv_audit row has a quoted field containing an embedded comma ('Login from Sydney, AU'), which naive comma-splitting would miscount as 5 fields instead of 4.",
})

# ---------------- 5. Genuinely unstructured free text ----------------
free_text_lines = [
    "==== END OF SHIFT REPORT ====",
    "-- maintenance window starts --",
    "TODO: rotate credentials before Friday",
]
for t in free_text_lines:
    new_event_line(t, "FREE_TEXT", None, "\n")
ground["free_text_lines"] = len(free_text_lines)
ground["formats"]["FREE_TEXT"] = {"lines": len(free_text_lines), "events": len(free_text_lines)}

# Blocks are kept in deterministic sequential order (majority block, then each minority
# block in turn) -- this mirrors a realistic batched multi-source ingestion pattern and
# keeps the ground truth simple to state and verify.

# ---------------- Write file ----------------
total_lines = len(lines)
total_events = sum(1 for l in lines if l["event_id"] is not None)
ground["total_physical_lines"] = total_lines
ground["total_logical_events"] = total_events
ground["line_endings"]["LF"] = sum(1 for l in lines if l["ending"] == "\n")
ground["line_endings"]["CRLF"] = sum(1 for l in lines if l["ending"] == "\r\n")

# distinct fingerprints: (format, ts_format) pairs across events, excluding FREE_TEXT (no format/ts) and continuation lines
fp_pairs = set()
for l in lines:
    if l["event_id"] is None:
        continue
    if l["format"] == "FREE_TEXT":
        continue
    fp_pairs.add((l["format"], l["ts_format"]))
ground["expected_min_distinct_fingerprints"] = len(fp_pairs)
ground["fingerprint_notes"].append(f"Distinct (format, timestamp_format) pairs excluding FREE_TEXT: {sorted(fp_pairs)}")
ground["fingerprint_notes"].append("FREE_TEXT lines should bucket separately and not inflate the structural fingerprint count.")

with open(OUT_LOG, "wb") as f:
    f.write(b"\xef\xbb\xbf")  # UTF-8 BOM
    for l in lines:
        f.write(l["text"].encode("utf-8"))
        f.write(l["ending"].encode("utf-8"))

with open(OUT_TRUTH, "w") as f:
    json.dump(ground, f, indent=2, default=str)

print("Generated:", OUT_LOG)
print("Total physical lines:", total_lines)
print("Total logical events:", total_events)
print("Line endings:", ground["line_endings"])
print("Formats:", {k: v["lines"] for k, v in ground["formats"].items()})
print("Expected min distinct fingerprints:", ground["expected_min_distinct_fingerprints"])
print("Ground truth written:", OUT_TRUTH)
