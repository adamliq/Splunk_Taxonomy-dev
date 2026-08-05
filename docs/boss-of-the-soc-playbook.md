# Splunk Boss of the SOC (BOTS) Playbook

A practical, step-by-step approach to working a Splunk **Boss of the SOC (BOTS)**
exercise (or any similarly-shaped "here's a Splunk instance full of unfamiliar
data, go find the incident" CTF/exercise), with ready-to-adapt SPL for each
stage. BOTS gives you a fully populated Splunk environment and a set of
scored questions built around one or more simulated security incidents —
the challenge is less "know SPL" and more "efficiently discover what data
exists, then pivot through it fast."

Placeholders below use `<angle-bracket>` notation — substitute the real
index/sourcetype/field/value for your environment before running.

---

## 1. Orientation — before you touch a single question

Don't start answering questions cold. Spend the first 10–15 minutes building
a mental map of the environment: what's here, how much of it, and over what
time range. This investment pays back immediately once you start pivoting.

### 1.1 What indexes exist, and how big are they?

```spl
| eventcount summarize=false index=* report_size=true
| table index count size
| sort -count
```

`eventcount` is index-metadata-only (no time range, no field extraction) —
the cheapest possible way to see the full index list and roughly how much is
in each one.

### 1.2 What sourcetypes exist, per index, with first/last event time?

```spl
| metadata type=sourcetypes index=*
| eval firstTime=strftime(firstTime,"%F %T"), lastTime=strftime(lastTime,"%F %T"), recentTime=strftime(recentTime,"%F %T")
| table index sourcetype totalCount firstTime lastTime recentTime
| sort index -totalCount
```

`firstTime`/`lastTime` tell you the true data time range — critical in BOTS,
since the scenario's "incident window" is rarely the full dataset and the
default search time picker is easy to get wrong against unfamiliar data.

### 1.3 Also check hosts and sources

```spl
| metadata type=hosts index=* | sort -totalCount
| metadata type=sources index=* | sort -totalCount
```

Host and source naming conventions (e.g. `WIN-*`, `*.frothly.local`,
`ip-10-0-*` for cloud assets) are often your first clue about which systems
matter to the scenario.

### 1.4 Fast volume overview (index/sourcetype × time)

```spl
| tstats count where index=* by index sourcetype _time span=1d
| timechart span=1d sum(count) by sourcetype limit=20
```

`tstats` reads only indexed (`.tsidx`) fields, so it's dramatically faster
than a raw `search` for this kind of orientation query — use it whenever
you're counting/grouping, not reading `_raw` content.

### 1.5 Field discovery on a specific sourcetype

Once a sourcetype looks relevant, see what fields it actually extracts and
how populated/varied they are:

```spl
index=<index> sourcetype=<sourcetype>
| head 20000
| fieldsummary
| table field count distinct_count numeric_count values
| sort -count
```

`distinct_count` near `count` flags an identifier/high-cardinality field
(good pivot candidate); `distinct_count` of 2–20 flags an enum (status,
action, severity — good for `stats`/`chart` grouping).

### 1.6 Check for CIM data models already accelerated

BOTS datasets are frequently CIM-compliant (Authentication, Network Traffic,
Web, Malware, Endpoint, etc.), which means the fast `tstats ... from
datamodel=` path works and saves you from re-deriving field names per vendor:

```spl
| datamodel
```

```spl
| tstats summariesonly=false count from datamodel=Authentication by index, sourcetype
```

If a model returns real counts, prefer searching through it (`action`,
`src`, `dest`, `user`, etc.) over guessing vendor-specific raw field names.
The same check works for any other model — swap the name for a fast look at
web and network-traffic coverage:

```spl
| tstats summariesonly=false count from datamodel=Web by sourcetype
| append [| tstats summariesonly=false count from datamodel=Network_Traffic by sourcetype]
```

### 1.7 Inventory saved knowledge objects (macros, lookups, eventtypes)

Competition environments sometimes ship pre-built macros/lookups that are
meant to be used (or that hint at what matters):

```spl
| rest /servicesNS/-/-/admin/macros | table title definition
```

```spl
| rest /services/data/lookup-table-files | table title filename
```

```spl
| rest /servicesNS/-/-/saved/eventtypes | table title search
```

---

## 2. General question-solving workflow

Most BOTS questions reduce to one of a handful of shapes. Recognise the
shape first, then reach for the matching technique:

| Question shape | Technique |
|---|---|
| "What is the &lt;IP/hostname/user/hash/domain&gt; of X?" | Pivot from a known entity to an unknown one (§4) |
| "How many times did X happen?" | `stats count` / `dc()` over the right filter and time range |
| "What was the first/last occurrence of X?" | `earliest(_time)`/`latest(_time)`, or sort + `head 1` |
| "What technique/CVE/MITRE ID is this?" | Correlate signature/detection-name fields, or search the raw payload for known IOC strings |
| "What is contained in file/attachment/registry key X?" | Search the specific sourcetype that would log it (EDR, proxy, email gateway) directly |
| "What tool did the attacker use?" | Look at process command lines (`Sysmon` EventCode=1, EDR process-create events), user-agent strings, or file names/hashes |

**Workflow for an unfamiliar question:**

1. Identify the entity type the question is about (IP, host, user, hash,
   domain, process, port, filename).
2. Find which sourcetype(s) would plausibly log that entity (§3).
3. Narrow with `fieldsummary`/`table ... | head 20` to learn the real field
   names for that sourcetype before writing a precise search.
4. Search broad first (`index=* "<known value>"`), then narrow by index/
   sourcetype once you see where it hits.
5. Once you find the fact, re-verify it with a second, independently-phrased
   search — BOTS answers are graded on exact string match, and it's easy to
   answer with a truncated/reformatted value.

**A structural fact worth knowing up front:** BOTS questions are numbered in
series (100s, 200s, 300s...), and within a series, question *N*'s answer is
almost always question *N+1*'s search filter — the src IP found in an early
question becomes the filter that finds the uploaded file, which becomes the
filter that finds its hash, and so on. Series numbers roughly track
kill-chain phase within one scenario (recon → delivery/initial access →
execution/lateral movement → impact/persistence). If you're stuck on a
question, the fix is very often to re-read the *previous* question's answer
rather than to search harder on the current one.

---

## 3. Sourcetype cheat sheet (typical BOTS data sources)

Adjust index/sourcetype names to what `metadata` actually returned in §1 —
this table is a starting-point map, not a guarantee of exact naming.

| Category | Typical sourcetype(s) | What it tells you |
|---|---|---|
| Windows Security/System logs | `WinEventLog:Security`, `WinEventLog:System`, `XmlWinEventLog:*` | Logons (4624/4625), process creation (4688), account/group changes (4720 + `Group_Name` — a recurring backdoor-account/persistence signature, §5.11), service installs |
| Sysmon | `XmlWinEventLog:Microsoft-Windows-Sysmon/Operational` | Process create (EventCode=1) with full command line + hashes, network connections (EventCode=3), file creation, registry changes |
| PowerShell logging | `WinEventLog:Microsoft-Windows-PowerShell/Operational` | Script-block logging — often the only place a C2 URL or an obfuscated payload shows up in cleartext |
| DNS | `stream:dns`, `suricata` (dns event_type) | Domain resolution — a primary pivot for C2/beaconing and exfil |
| Web proxy / HTTP | `stream:http`, `access_combined`, vendor proxy sourcetypes | URLs, user-agents, referrers, upload/download sizes |
| Email / file transfer | `stream:smtp`, `stream:ftp`, `stream:smb`, vendor mail-gateway sourcetypes | Sender/recipient, subject, attachment name/hash; SMB for lateral file movement; FTP for exfil |
| Firewall / network flow | `pan:traffic`, `cisco:asa`, `stream:tcp` | Allow/deny decisions, bytes transferred, src/dest port and IP |
| IDS/IPS | `suricata`, `snort` | Signature name, category, severity — good for jumping straight to "what happened" |
| Endpoint state / inventory | `osquery:results`, `winhostmon`, `Perfmon:Process` | Point-in-time host facts (users, open ports, running processes, OS version) and resource-usage anomalies — the way to catch things with no dedicated log line (e.g. a cryptominer pegging CPU) |
| Endpoint/EDR & AV alerts | vendor-specific (`symantec:ep:security:file`, `carbonblack`, `crowdstrike`, etc.) | Signature-based detections with a ready-made severity/threat-name field — often the fastest path to "what is this called" |
| Cloud/AWS | `aws:cloudtrail`, `aws:s3:accesslogs`, `aws:vpcflow` | API calls, IAM identity, source IP, bucket access |
| O365 / Azure AD | `o365:management:activity`, `ms:o365:management`, `azure:aad` | Sign-ins, mailbox rules, admin actions, file upload/share events |
| Splunk internal | `_internal`, `_audit` | Search activity, ingestion health — occasionally the scenario itself is "who searched what" |

---

## 4. Entity pivoting (the core BOTS skill)

The scenario usually hands you one starting entity (an alert, a suspicious
IP, a flagged filename) and every subsequent question is a pivot away from
it. These patterns cover the vast majority of pivots.

### 4.1 "Where else does this value appear?" (name-agnostic search)

When you don't know or trust field names for a value:

```spl
index=* "<known_value>"
| stats count by index, sourcetype
| sort -count
```

For a fast, indexed-only version across the whole environment:

```spl
| tstats count where index=* TERM(<known_value>) by index sourcetype
| sort -count
```

`TERM()` is fast (reads the lexicon, not raw text) but needs the value to be
a single indexed token — works well for IPs, hostnames, hashes, GUIDs; not
for values containing spaces.

### 4.2 "Which field holds this value?" (when extraction is unclear)

```spl
index=<index> sourcetype=<sourcetype> "<known_value>"
| head 1000
| foreach * [eval holders=if('<<FIELD>>'=="<known_value>", mvappend(holders,"<<FIELD>>"), holders)]
| stats count by holders
```

### 4.3 User → host → IP → process correlation

```spl
index=<index> sourcetype=<sourcetype>
| stats count dc(<host_field>) as host_count dc(<ip_field>) as ip_count
    values(<host_field>) as hosts values(<ip_field>) as ips by <user_field>
| sort -count
```

Swap the `by` field to pivot the other direction (host→user, IP→user, etc.).

### 4.4 Timeline reconstruction around a known event

Once you have one timestamp of interest, build the surrounding timeline
rather than searching in isolation:

```spl
index=* (host=<host> OR src=<ip> OR dest=<ip> OR user=<user>)
earliest=<known_time>-15m latest=<known_time>+2h
| sort 0 _time
| table _time index sourcetype host user src dest action
```

### 4.5 Cross-sourcetype join-key discovery (when nothing shares a field name)

Automatically find which field in one sourcetype shares values with which
field in another — invaluable when a proxy log calls it `c_ip` and a
firewall log calls it `src_ip`:

```spl
index=* (sourcetype=<sourcetype_a> OR sourcetype=<sourcetype_b>)
| head 20000
| foreach * [eval fv=mvappend(fv, "<<FIELD>>=" . mvjoin(mvdedup('<<FIELD>>'),"|"))]
| fields sourcetype fv
| mvexpand fv
| rex field=fv "^(?<f>[^=]+)=(?<v>.+)$"
| where len(v)>=4
| eval loc=sourcetype . "::" . f
| stats values(loc) as locations dc(sourcetype) as st_count by v
| where st_count>1
| stats count as shared_values by locations
| sort -shared_values
```

### 4.6 External enrichment (when SPL alone won't finish the answer)

Not every answer lives in the data. A meaningful share of BOTS questions ask
for a *fact about* an IOC that SPL can only get you the IOC for — first-seen
date, related infrastructure, attribution, or a name/description assigned by
a scanner. Once a search produces a hash, domain or IP that looks like the
*input* to the answer rather than the answer itself, pivot out:

- **Hash reputation / first-seen / related domains** — paste the MD5/SHA256
  into VirusTotal (or whatever local TI tool the exercise provides).
- **Leaked credentials/keys** — search GitHub (or the provided sandbox) for
  the exact string; leaked AWS keys and similar secrets are a recurring
  theme.
- **Domain/IP attribution** — WHOIS and passive-DNS lookups.

Treat "find the IOC in Splunk, then enrich outside Splunk" as a normal
two-step pattern, not a sign you've gone off track.

---

## 5. Data-discovery SPL, by common BOTS question type

### 5.1 "How many events / distinct X are there?"

```spl
index=<index> sourcetype=<sourcetype> <filter>
| stats count, dc(<entity_field>) as distinct_entities
```

### 5.2 Beaconing / C2 detection via DNS or connection regularity

```spl
index=* sourcetype=stream:dns
| stats count, values(query) as queries by src, dest
| where count > 50
```

```spl
index=* (sourcetype=stream:dns OR sourcetype=suricata)
| bin _time span=1m
| stats count by query, _time
| stats count as intervals, avg(count) as avg_per_min by query
| sort -intervals
```

Regular, evenly-spaced low-volume connections to the same rare domain are
the classic beacon signature.

### 5.3 Rare / long-tail events (first sighting of something odd)

```spl
index=<index> sourcetype=<sourcetype>
| stats count by <field>
| where count <= 5
| sort count
```

```spl
index=<index> sourcetype=<sourcetype>
| rare limit=25 <field>
```

### 5.4 Malicious process / command-line discovery (Sysmon or EDR)

```spl
index=* sourcetype="XmlWinEventLog:Microsoft-Windows-Sysmon/Operational" EventCode=1
| table _time, host, User, Image, CommandLine, ParentImage, ParentCommandLine, Hashes
| sort 0 _time
```

Search for common attacker tooling / living-off-the-land indicators:

```spl
index=* sourcetype="XmlWinEventLog:Microsoft-Windows-Sysmon/Operational" EventCode=1
    (CommandLine="*powershell*-enc*" OR CommandLine="*-EncodedCommand*"
     OR CommandLine="*IEX*" OR CommandLine="*DownloadString*"
     OR CommandLine="*mimikatz*" OR CommandLine="*psexec*"
     OR CommandLine="*whoami*" OR CommandLine="*net user*")
| table _time, host, User, CommandLine
```

### 5.5 Failed/successful authentication patterns

```spl
index=* sourcetype="WinEventLog:Security" (EventCode=4624 OR EventCode=4625)
| eval result=if(EventCode=4625,"failure","success")
| stats count by user, src, result
| sort -count
```

Brute-force pattern (many failures, short window, few successes):

```spl
index=* sourcetype="WinEventLog:Security" EventCode=4625
| bin _time span=5m
| stats count by user, src, _time
| where count > 10
```

### 5.6 File/hash IOC lookups

```spl
index=* ("<known_hash>" OR "<known_filename>")
| table _time, index, sourcetype, host, user, *
```

### 5.7 Web/proxy — suspicious user-agents, upload anomalies, rare domains

```spl
index=* sourcetype=stream:http
| stats count by http_user_agent
| sort count
| head 20
```

```spl
index=* sourcetype=stream:http
| where len(uri) > 500 OR bytes_out > 5000000
| table _time, src_ip, dest_ip, uri, http_user_agent, bytes_out
```

### 5.8 AWS CloudTrail — unusual API activity / privilege changes

```spl
index=* sourcetype=aws:cloudtrail
| stats count by eventName, userIdentity.arn
| sort -count
```

```spl
index=* sourcetype=aws:cloudtrail
    (eventName="ConsoleLogin" OR eventName="AssumeRole" OR eventName="CreateAccessKey"
     OR eventName="AttachUserPolicy" OR eventName="PutUserPolicy")
| table _time, eventName, userIdentity.arn, sourceIPAddress, requestParameters.*
```

### 5.9 Extracting a value buried in a composite field

Form data, cookies and command lines often arrive as one long string rather
than a pre-extracted field — `rex` pulls the specific piece out:

```spl
index=* sourcetype=stream:http http_method=POST
| rex field=form_data "passwd=(?<submitted_password>[^&]+)"
| stats count by submitted_password
| sort -count
```

The same pattern works on `cookie`, `CommandLine`, `Message`, or any other
single-string field, once you know the delimiter around the value you need.

### 5.10 Anomaly by distinct-count ("which X has the most distinct Y")

A recurring BOTS shape: find the one entity behaving unusually broadly (an
access key generating unusually many distinct errors, a host contacted by
unusually many distinct sources):

```spl
index=* sourcetype=<sourcetype>
| stats dc(<outcome_field>) as distinct_outcomes by <entity_field>
| sort -distinct_outcomes
```

### 5.11 Backdoor account creation (persistence)

```spl
index=* source="WinEventLog:Security" EventCode=4720
| table _time, host, user, Account_Name
| sort 0 _time
```

Once a suspicious account is found, check what it was added to — the group
membership is usually the actual point of the question:

```spl
index=* source="WinEventLog:Security" <suspicious_account>
| table _time, EventCode, Group_Name, Account_Name
```

### 5.12 Scheduled-task creation (another persistence technique)

Alongside new-account creation (§5.11), attacker-created scheduled tasks are
a recurring second persistence mechanism:

```spl
index=* source="WinEventLog:Security" EventCode=4698
| table _time, host, Subject_Account_Name, Task_Name, Command
| sort 0 _time
```

`schtasks.exe`/`at.exe` invocations from a process-creation log (Sysmon
EventCode=1) catch the same technique from the execution side rather than
the audit-log side:

```spl
index=* sourcetype="XmlWinEventLog:Microsoft-Windows-Sysmon/Operational" EventCode=1
    (Image="*schtasks.exe" OR Image="*at.exe")
| table _time, host, User, CommandLine
```

### 5.13 Decoding Base64/obfuscated payloads

PowerShell's `-enc`/`-EncodedCommand` flag, and email/web payloads
generally, are frequently Base64-encoded — decode inline rather than
copy-pasting into an external tool for every hit:

```spl
index=* sourcetype="WinEventLog:Microsoft-Windows-PowerShell/Operational"
    (Message="*-enc*" OR Message="*-EncodedCommand*")
| rex field=Message "(?i)-enc(?:odedcommand)?\s+(?<b64>[A-Za-z0-9+/=]{20,})"
| eval decoded=base64decode(b64)
| table _time, host, decoded
```

`base64decode()`/`base64encode()` are native `eval` functions from Splunk
9.0 onward; on older versions, decode the extracted `b64` field externally
(e.g. `echo '<value>' | base64 -d`) once you've isolated it with `rex`.

### 5.14 Geolocating an IP address

A recurring BOTS question shape ("what country did this traffic originate
from?") is a one-line lookup once you have the IP:

```spl
index=* sourcetype=<sourcetype> <ip_field>=<known_ip>
| iplocation <ip_field>
| table _time, <ip_field>, City, Country, Region
```

### 5.15 Finding tools/processes unique to one host (baseline deviation)

Attacker tooling frequently shows up on exactly one host, while legitimate
software runs fleet-wide — a cheap way to surface it without knowing the
tool's name in advance:

```spl
index=* sourcetype="XmlWinEventLog:Microsoft-Windows-Sysmon/Operational" EventCode=1
| stats count by Image, host
| eventstats dc(host) as host_count by Image
| where host_count=1
| sort count
```

### 5.16 Sweeping raw text for embedded IOCs

When a sourcetype's field extractions don't cover what you need (or none
exist at all), pull IP addresses, domains, hashes and email addresses
straight out of `_raw`:

```spl
index=<index> sourcetype=<sourcetype>
| rex max_match=0 field=_raw "(?<ioc_ip>\b(?:\d{1,3}\.){3}\d{1,3}\b)"
| rex max_match=0 field=_raw "(?<ioc_hash>\b[a-fA-F0-9]{32,64}\b)"
| rex max_match=0 field=_raw "(?<ioc_domain>\b[a-zA-Z0-9][a-zA-Z0-9-]{0,62}\.[a-zA-Z]{2,}\b)"
| stats values(ioc_ip) as ips, values(ioc_hash) as hashes, values(ioc_domain) as domains by sourcetype
```

Run each `rex` separately (rather than one combined pattern) so a miss on
one IOC type doesn't suppress the others — see the Exploratory Data
Analysis & Field Correlation Playbook's Entity Discovery phase for the full
version of this technique, including per-entity-type regex for processes,
files, MACs and asset tags.

---

## 6. Efficiency tips specific to BOTS

- **Set the time range deliberately.** Don't leave it on "Last 24 hours" —
  BOTS datasets are usually static and dated; use "All time" while
  orienting, then narrow once you know the real window (§1.2).
- **Prefer `tstats`/`| datamodel` over raw `search` for counting/pivoting.**
  BOTS indexes can be large; a raw `search` across `index=*` with a broad
  time range is often needlessly slow.
- **Put `fields` early, `table` late.** Drop unneeded fields immediately
  after any `search`/`tstats` to cut the working set before heavier
  commands (`stats`, `join`, `transaction`).
- **Read the question literally before searching.** BOTS answers are
  graded on exact string match — "IP address" vs "IP address and port,"
  singular vs plural, hex-with-`0x`-prefix vs without, are common traps.
  Re-read the question after you find a candidate answer.
- **Use `eval` to normalise before comparing.** `lower()`, `trim()`, and
  explicit type casts (`tonumber()`) avoid case/whitespace mismatches when
  correlating across sourcetypes from different vendors.
- **Bookmark/pin useful searches as you go.** Many BOTS questions build on
  the answer to a previous one — keep a scratch note of every entity
  (IP, host, user, hash, domain, timestamp) you've confirmed, so later
  pivots don't require re-deriving them.
- **When stuck, go back to §1.** A surprising number of "impossible"
  questions are answered by data you haven't looked at yet — re-run the
  sourcetype/field inventory scoped to the specific host or time window in
  question rather than assuming you've seen everything relevant.
- **Watch the timezone on timestamp answers.** `_time` is stored as a UTC
  epoch, but every rendering of it (`strftime`, the results table, the
  timeline) displays in *your account's* configured timezone — which is
  frequently not the timezone the question wants. Check your Splunk
  account's Time Zone setting before answering any question with a
  timestamp in it, and if in doubt, set it to UTC and note that explicitly
  in your answer. `| eval tz_offset=strftime(_time,"%z")` on a result will
  at least show you the offset currently being applied, so a wrong-timezone
  answer doesn't look plausible and get submitted unnoticed.

---

## 7. Quick reference — commands used above

| Command | Use |
|---|---|
| `eventcount` | Cheapest index inventory (no time range) |
| `\| metadata` | Sourcetype/host/source inventory with first/last seen |
| `tstats` | Fast counting/grouping over indexed fields, or against a CIM data model |
| `fieldsummary` | Field names, fill rate, distinct count, sample values for a sourcetype |
| `foreach *` | Field-name-agnostic search across every field on an event |
| `TERM()` | Fast indexed-token search (used with `tstats`) |
| `rex field=X "pattern"` | Extract a value buried in a composite field (form data, cookies, command lines) |
| `stats dc(X) by Y` | Anomaly-by-distinct-count — which Y has an unusually broad/narrow spread of X |
| `rare` / `stats count \| where count<=N` | Long-tail/rare-value discovery |
| `bin`/`timechart`/`streamstats` | Time-bucketed volume and beacon/regularity analysis |
| `eventstats dc(host) by X` | Baseline-deviation hunting — flag values seen on only one host |
| `iplocation` | Geolocate an IP (City/Country/Region) |
| `base64decode()` / `base64encode()` | Decode/encode Base64 payloads inline (`eval` function, Splunk 9.0+) |
| `\| rest` | Inventory saved macros, lookups, eventtypes via the REST API |

---

*This playbook assumes a general familiarity with SPL syntax. It is written
for defensive/blue-team training use (Splunk's official BOTS exercises and
similar practice environments) — adapt field and sourcetype names to the
specific dataset you're working with, since exact naming varies release to
release.*
