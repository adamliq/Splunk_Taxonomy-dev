# Splunk Taxonomy App — Glossary

All 59 terms from the app's glossary (`frameworkConcepts` in `index.html`), in
glossary order, each with its category, definition and worked example. Composite
terms list the full breakdown of the named dimensions, components or categories
that make them up, each with **its own definition**. Most are pulled verbatim
from the app's reference articles; for three terms where the app itself only
names the category without further elaboration (Entity Coverage's 9 classes,
Event Type Coverage's 14 categories, Data Source Assurance's 15 controls), the
definitions are inferred from context and worked examples rather than quoted
from a reference article, and are marked as such inline. Terms with no further
breakdown say so explicitly. A closing section covers terms that appear in the
app's reference articles but are not in the 59-entry glossary array itself.

---

## 1. Logging Pattern
**Category:** Collection

An approved reusable reference architecture for collecting a class of data sources.

**Example:** Syslog via SC4S to Splunk Cloud.

*No sub-terms — single-value definition.*

## 2. Collection Topology
**Category:** Collection

The actual implemented end-to-end path for one data source, including every collection and processing hop.

**Example:** FortiGate → syslog server → Universal Forwarder → Splunk indexers.

*No sub-terms — single-value definition.*

## 3. Collection Hop
**Category:** Collection

A discrete transfer or processing stage within a collection topology.

**Example:** The Azure Function between a REST endpoint and HEC.

*No sub-terms — single-value definition.*

## 4. Collection Path Support Status
**Category:** Collection

The approved operational status of a collection path.

**Example:** Recommended, supported, legacy, lab-only or prohibited.

*No sub-terms — single-value definition.*

## 5. Source-side Logging Configuration
**Category:** Collection

Configuration applied on the source platform that determines which events are generated and sent.

**Example:** FortiGate policy logging, event filters and syslog destination settings.

*No sub-terms — single-value definition.*

## 6. Transport Reliability Requirement
**Category:** Collection

The minimum acceptable delivery assurance for a collection path.

**Example:** TCP/TLS required; UDP loss is not acceptable.

*No sub-terms — single-value definition.*

## 7. Pre-ingest Filtering Decision
**Category:** Collection

The governed decision to retain, suppress, sample or transform events before indexing.

**Example:** Drop repetitive heartbeat records but retain failures and state changes.

*No sub-terms — single-value definition.*

## 8. Datetime Format
**Category:** Data quality

The literal timestamp representation emitted by a source event, including its standard, precision, timezone expression and equivalent Splunk strptime pattern.

**Example:** 2026-07-21T08:00:11.902+10:00 mapped to %Y-%m-%dT%H:%M:%S.%3N%:z.

**Sub-terms / dimensions / components:**

Five required detail attributes:

1. **Raw timestamp example** — an exact timestamp copied from the source event.
2. **Format name** — ISO 8601, RFC 3339, RFC 2822, Unix epoch, Windows File Time, vendor-defined or another recognised representation.
3. **Precision** — seconds, milliseconds, microseconds, nanoseconds or another supported resolution.
4. **Timezone expression** — UTC marker, numeric offset, named zone, abbreviation or no timezone present.
5. **Splunk pattern** — the corresponding `strptime` pattern used in `TIME_FORMAT`.

## 9. Datetime Parse
**Category:** Data quality

The Splunk sourcetype timestamp definition describing how event time is located, interpreted and assigned using TIME_PREFIX, TIME_FORMAT, MAX_TIMESTAMP_LOOKAHEAD and TZ.

**Example:** TIME_PREFIX=^, TIME_FORMAT=%Y-%m-%d %H:%M:%S, MAX_TIMESTAMP_LOOKAHEAD=19, TZ=Australia/Sydney.

**Sub-terms / dimensions / components:**

Four Splunk settings:

1. **`TIME_PREFIX`** — a regular expression identifying text just before the timestamp; limits where Splunk searches for the date.
2. **`TIME_FORMAT`** — the pattern of the date using `strptime` syntax, e.g. `%Y-%m-%d %H:%M:%S`.
3. **`MAX_TIMESTAMP_LOOKAHEAD`** — the number of characters after `TIME_PREFIX` Splunk evaluates to find the date (default typically 128 bytes).
4. **`TZ`** — the time zone of the incoming logs, e.g. `Australia/Sydney`, when it differs from the indexer's local time or the raw timestamp carries no explicit zone.

## 10. Timestamp Quality
**Category:** Data quality

A measure of timestamp consistency, timezone clarity, precision, completeness, event-time reliability and parsing complexity.

**Example:** 21/24 — Good.

**Sub-terms / dimensions / components:**

Six scoring criteria (0–4 each, /24):

1. **Presence and completeness** — is event time present on every applicable event, with all required components (year, month, day, hour, minute, second)?
2. **Format and parseability** — is the format recognised, unambiguous and consistently parseable without brittle assumptions?
3. **Timezone clarity** — does the timestamp include `Z`, an explicit UTC offset, or a reliably documented source timezone?
4. **Precision and resolution** — is precision appropriate for the event rate and investigation requirement?
5. **Correctness and event-time reliability** — does the value plausibly represent when the activity occurred rather than when it was batched, received or processed?
6. **Consistency** — is one stable timestamp convention used across the representative dataset and across event types?

## 11. Log Format Quality
**Category:** Data quality

A measure of structural consistency, delimitation, schema clarity, event boundaries, integrity and parsing complexity.

**Example:** Stable JSON with one event per object and UTF-8 encoding.

**Sub-terms / dimensions / components:**

Six scoring criteria (0–4 each, /24):

1. **Structure and format identification** — can the format be identified confidently as valid JSON, XML, CSV, TSV, key-value, CEF, LEEF, syslog, fixed-width or another documented structure?
2. **Event boundary reliability** — can every event be separated without accidental merging or splitting?
3. **Delimiter, quoting and escaping integrity** — are delimiters, quotes, escape characters and embedded newlines handled consistently?
4. **Schema and field stability** — are field names, order, optionality, nesting and data types stable across representative events and versions?
5. **Encoding and content integrity** — are character encoding, Unicode, control characters, binary fragments and truncation handled without corrupting meaning?
6. **Parsing and normalisation complexity** — can fields be extracted and normalised with native structured parsing or stable, maintainable rules?

## 12. Parse Rate
**Category:** Data quality

The proportion of sampled events that can be parsed successfully using the approved configuration.

**Example:** 99.5% of 10,000 sampled events parsed without fallback rules.

*No sub-terms — single-value definition.*

## 13. Schema Stability
**Category:** Data quality

The degree to which field names, types and event structures remain consistent over time and versions.

**Example:** No breaking field changes across three monthly samples.

*No sub-terms — single-value definition.*

## 14. Marginal Novelty
**Category:** Cyber value

The proportion of useful information that cannot already be reconstructed from existing sources.

**Example:** 70% novelty means only 30% is reconstructible elsewhere.

**Sub-terms / dimensions / components:**

Six comparison lenses (evidence prompts, not separate scores to average):

1. **Comparison scope** — which existing sources and populations could reproduce the candidate evidence?
2. **Event and behaviour novelty** — does the candidate reveal security-relevant actions or state changes not otherwise observable?
3. **Field and context novelty** — which useful attributes does the candidate add to otherwise known activity?
4. **Entity and relationship novelty** — does the source expose new entities, relationships or pivots?
5. **Semantic and outcome novelty** — does the candidate explain meaning, result or significance that existing sources cannot?
6. **Operational utility novelty** — does the source improve detection, triage, correlation or response in a way existing telemetry cannot?

## 15. Investigative Context Density
**Category:** Cyber value

The breadth of distinct investigative context types present in an event, expressed as a count or as a percentage of an approved context catalogue.

**Example:** 9 distinct types from a 36-type catalogue gives an ICD of 25%.

**Sub-terms / dimensions / components:**

36-type catalogue grouped into six families of 6 types each:

1. **Identity context** — evidence identifying who acted: user/account name, stable user ID/SID, email/UPN, account type/service identity, role/group, target identity.
2. **Asset and location context** — evidence of where activity happened: hostname/device, asset/endpoint ID, source network address, destination network address, cloud resource/tenant, region/site/workload location.
3. **Activity and object context** — evidence of what happened and to what: event type/category, action/operation, process/image, command/parameters, file/configuration object, application/API/resource.
4. **Time and outcome context** — evidence of when and with what result: event time/timezone, start/end/duration, success/failure, status/return code, reason/error, authentication/policy decision.
5. **Impact and security context** — evidence of why it matters: severity/priority, risk/threat score, classification, confidence, policy/control, vulnerability/technique/indicator.
6. **Correlation and pivot context** — evidence that lets events be joined: session/logon ID, correlation/request/trace ID, process GUID/PID, parent process ID, hash/certificate identifier, URL/domain/object record ID.

## 16. Investigative Noise Percentage
**Category:** Cyber value

The percentage of valid classified events that fail an approved minimum investigative-value threshold.

**Example:** If 18,500 of 100,000 valid events are below the minimum, INP is 18.5%.

**Sub-terms / dimensions / components:**

`Noise Events ÷ Total Valid Events × 100`. Threshold rule against the seven context dimensions:

- **Useful** — at least 4 of 7 context dimensions (When, Who, Where, What, Outcome, Impact, Correlation) usable **and** What specifically present.
- **Noise** — everything below that threshold, regardless of severity.

## 17. Context Dimension Coverage
**Category:** Data quality

The proportion of the seven investigative context dimensions represented in an event or dataset: When, Who, Where, What, Outcome, Impact and Correlation.

**Example:** An event covering 6 of 7 dimensions has CDC of 85.7%.

**Sub-terms / dimensions / components:**

Reuses ECCS's same seven dimensions, but as dataset-wide **coverage percentage** (share of events with usable evidence) rather than ECCS's per-event 0–4 quality score:

1. **When** — event time, timezone/UTC offset, precision, duration.
2. **Who** — identity that performed, requested or owned the activity.
3. **Where** — where the activity originated, executed and terminated.
4. **What** — the activity, operation or state change, and its object.
5. **Outcome** — whether the activity succeeded, failed or partially completed, and why.
6. **Impact** — why the activity matters and how urgently it should be investigated.
7. **Correlation** — whether the event can be joined to related activity across time, systems and sources.

## 18. Event Context Completeness Score (ECCS)
**Category:** Data quality

A 0-100% measure of how completely representative events answer When, Who, Where, What, Outcome, Impact and Correlation, based on seven quality scores from 0-4.

**Example:** A total of 24 out of 28 gives an ECCS of 85.7% (Excellent).

**Sub-terms / dimensions / components:**

`(total score / 28) × 100` — seven equally weighted dimensions, 0–4 each:

1. **When** — when did the activity occur, and can its sequence and duration be reconstructed reliably?
2. **Who** — who or what identity performed, requested or owned the activity?
3. **Where** — where did the activity originate, execute and terminate?
4. **What** — what activity, operation or state change occurred, and to which object?
5. **Outcome** — did the activity succeed, fail or partially complete, and why?
6. **Impact** — why does the activity matter, and how urgently should it be investigated?
7. **Correlation** — can the event be joined to related activity across time, systems and data sources?

## 19. Pivot Density
**Category:** Cyber value

The percentage of events containing at least one useful investigation or correlation key.

**Example:** Username, IP address, hostname, asset ID or session ID.

**Sub-terms / dimensions / components:**

Shares its 6 pivot categories with Pivot Breadth — see that entry below for definitions.

## 20. Pivot Breadth
**Category:** Cyber value

The number of distinct pivot-key types that are present across a meaningful share of events.

**Example:** User, host, IP, process and session identifiers.

**Sub-terms / dimensions / components:**

Six pivot categories (fields grouped so aliases don't inflate breadth):

1. **Identity and host pivots** — user identity (username, user_id, email, SID, object_id) and host identity (hostname, device_name, asset_id, endpoint_id, serial_number).
2. **Network, URL and DNS pivots** — network identity (src_ip, dest_ip, MAC), URL/web (url, uri), DNS (domain, FQDN, dns_query).
3. **Session and transaction pivots** — session (session_id, logon_id, authentication_token_id) and transaction (trace_id, request_id, correlation_id, transaction_id) identifiers.
4. **Process and file pivots** — process (process_id, process_guid, parent_process_id), file (filename, file_path, MD5, SHA1, SHA256) and certificate (thumbprint, certificate_subject) identifiers.
5. **Cloud and workload pivots** — cloud resource (Azure resource ID, AWS ARN, GCP resource name, VM ID) and container (container_id, pod_id, Kubernetes pod) identifiers.
6. **Application-object pivots** — durable business/application object identifiers: object_id, record_id, group_id, API key ID, certificate subject.

## 21. Semantic Value
**Category:** Cyber value

The degree to which events clearly describe an action and its outcome.

**Example:** Account disabled — success — performed by admin01.

**Sub-terms / dimensions / components:**

`(Action Completeness % + Outcome Completeness %) / 2`:

1. **Action completeness** — does the event identify the specific action or operation that was performed?
2. **Outcome completeness** — does the event state the result of the action: success, failure, reason or enforcement decision?

## 22. Entity Coverage
**Category:** Cyber value

The proportion of the relevant environment population represented by the source.

**Example:** 8,400 of 10,000 managed endpoints observed.

**Sub-terms / dimensions / components:**

Nine entity classes, each scored 0–4. A class counts only when at least one value is populated *and* usable. The app itself names these categories without further elaboration; the definitions below are inferred from context and worked examples, not pulled verbatim from a reference article:

1. **Human and non-human identities** — people, service accounts, and non-human actors (bots, applications) that can perform or be attributed with activity.
2. **Hosts, endpoints and devices** — physical or virtual machines, workstations, servers and devices where activity occurs.
3. **Source and destination network entities** — network-layer identifiers (IP addresses, network zones) describing where traffic originates and terminates.
4. **Applications, services and workloads** — software applications, services or workloads that generate, receive or are acted upon by an event.
5. **Cloud resources, accounts, subscriptions, projects and tenants** — cloud-provider scoping entities and the resources within them.
6. **Processes, files, certificates and software objects** — executables, processes, files and certificates involved in an event.
7. **Data, business or protected objects** — business records, protected data objects or other application-level objects an event acts on.
8. **Sessions, requests, transactions and traces** — session, request, transaction or trace identifiers that scope related activity.
9. **Security controls, policies, roles and groups** — security policies, controls, roles or group memberships referenced by an event.

## 23. Cyber Value Density
**Category:** Cyber value

The cyber value score divided by expected daily ingestion volume, retained alongside the absolute value score.

**Example:** 25 value points ÷ 5 GB/day = 5 points per GB/day.

*No sub-terms — single-value definition.*

## 24. Assessment Gate
**Category:** Cyber value

A mandatory prerequisite that must pass before a log source receives a cyber value score or ingestion recommendation.

**Example:** Parse rate, timestamp/timezone and schema stability must all pass.

*No sub-terms — single-value definition.*

## 25. Minimum Parse Rate Gate
**Category:** Cyber value

The minimum proportion of sampled events that must parse successfully before value scoring is considered reliable.

**Example:** Pass when at least 95% of the representative sample parses correctly.

*No sub-terms — single-value definition.*

## 26. Timestamp & Timezone Gate
**Category:** Cyber value

A prerequisite confirming that event time is present, usable and associated with an explicit or reliably derived timezone.

**Example:** Pass when events contain a reliable timestamp and UTC offset or Z notation.

*No sub-terms — single-value definition.*

## 27. Schema Stability Gate
**Category:** Cyber value

A prerequisite confirming that the event structure is sufficiently consistent for dependable field extraction and scoring.

**Example:** Pass when field names and types remain stable across representative samples.

*No sub-terms — single-value definition.*

## 28. Overall Gate Result
**Category:** Cyber value

The combined pass or fail outcome of all mandatory value-assessment gates.

**Example:** Fail when any one of parse rate, timestamp/timezone or schema stability fails.

*No sub-terms — single-value definition.*

## 29. Reconstructible Percentage
**Category:** Cyber value

The estimated percentage of useful information in a candidate source that can already be recreated from existing telemetry.

**Example:** 40% reconstructible produces 60% marginal novelty.

*No sub-terms — single-value definition.*

## 30. Join Key
**Category:** Cyber value

A field that allows events to be correlated with other telemetry, entities, cases or investigations.

**Example:** User, hostname, IP address, asset ID, process ID or session ID.

*No sub-terms — single-value definition.*

## 31. Weighted Value Score
**Category:** Cyber value

The combined cyber value score produced by applying the approved weights to novelty, pivots, semantics and entity coverage.

**Example:** 26.5 out of 35 using rubric version LSV-1.0.

**Sub-terms / dimensions / components:**

Composed of Marginal Novelty, Pivot Density, Pivot Breadth, Semantic Value and Entity Coverage — see **Log Source Cyber Value** for the actual weights and each component's own definition.

## 32. Candidate Rank
**Category:** Cyber value

The relative position of a log source within the set of candidates assessed using the same rubric and review date.

**Example:** Rank 3 of 18 candidate sources.

*No sub-terms — single-value definition.*

## 33. Ingestion Decision
**Category:** Cyber value

The approved outcome produced from gate results, cyber value, volume, risk and mandatory requirements.

**Example:** Approved for full ingestion, approved with filtering, hold, remediate gates or reject.

*No sub-terms — single-value definition.*

## 34. Pre-ingest Filtering Recommendation
**Category:** Cyber value

A value-driven recommendation to suppress, sample or reduce low-value event classes before indexing.

**Example:** Retain state changes and failures; suppress repetitive success heartbeats.

*No sub-terms — single-value definition.*

## 35. Assessment Evidence
**Category:** Cyber value

The samples, searches, calculations, comparison sources and approvals that support a cyber value result.

**Example:** Ten-day sample, overlap SPL, field coverage report and approval record.

*No sub-terms — single-value definition.*

## 36. Rubric Version
**Category:** Cyber value

The controlled version of the weights, thresholds and decision rules used for a cyber value assessment.

**Example:** LSV-1.1 approved on 1 July 2026.

*No sub-terms — single-value definition.*

## 37. Sample Period
**Category:** Cyber value

The time window represented by the events used to calculate gates and value measures.

**Example:** Seven complete business days including a weekend and maintenance window.

*No sub-terms — single-value definition.*

## 38. Sample Size
**Category:** Cyber value

The number of events or records examined during the assessment.

**Example:** 50,000 representative events across all major event types.

*No sub-terms — single-value definition.*

## 39. Ninety-day Value Review
**Category:** Cyber value

A post-implementation review that compares predicted value with actual investigative and detection use after the source has operated in production.

**Example:** Review investigations, detections, alerts and true positives after 90 days.

*No sub-terms — single-value definition.*

## 40. Confirmed Use Rate
**Category:** Cyber value

The proportion of operational activity that demonstrates verified use of the source, calculated using a documented numerator and denominator.

**Example:** 12 confirmed investigation uses across 40 reviewed cases equals 30%.

*No sub-terms — single-value definition.*

## 41. Realized Value Rank
**Category:** Cyber value

The source ranking recalculated from observed production outcomes rather than predicted pre-ingest characteristics.

**Example:** The source moved from predicted rank 7 to realized rank 2.

*No sub-terms — single-value definition.*

## 42. Predicted vs Realized Rank Delta
**Category:** Cyber value

The difference between the original candidate rank and the rank observed after production use.

**Example:** Predicted rank 7 minus realized rank 2 gives a five-place improvement.

*No sub-terms — single-value definition.*

## 43. True Positive
**Category:** Cyber value

A detection or alert confirmed to represent genuine activity of interest rather than benign or incorrectly classified activity.

**Example:** A malware alert validated by an incident investigation.

*No sub-terms — single-value definition.*

## 44. Retain, Filter or Retire Decision
**Category:** Cyber value

The lifecycle decision made after realized value is reviewed in production.

**Example:** Retain fully, retain with additional filtering, or retire the source.

*No sub-terms — single-value definition.*

## 45. Shared Responsibility Matrix
**Category:** Governance

An approved allocation of responsibility across customer, vendor, cloud provider, SOC and other parties.

**Example:** RASCI assignments for log generation, collection, monitoring and incident response.

*No sub-terms — single-value definition.*

## 46. Data Source Assurance
**Category:** Assurance

Operational confidence that a source is healthy, complete, governed, supportable and fit for its intended use.

**Example:** Collection health, data quality, CIM coverage, ownership and evidence reviewed quarterly.

**Sub-terms / dimensions / components:**

`weighted achieved / weighted possible × 100` — 15 operational controls, scored 0–4 each, /60, equal weight by default (0 = absent, 4 = measured, automated, regularly assured). The app itself names these controls without further elaboration; the definitions below are inferred from context and worked examples, not pulled verbatim from a reference article:

1. **Source ownership & accountability** — a named, contactable owner is accountable for the source.
2. **Collection-path documentation** — the collection path (source to index) is documented.
3. **Authentication & secret management** — credentials and secrets used for collection are managed and rotated securely.
4. **Transport security** — data in transit is protected (e.g. TLS).
5. **Availability & freshness monitoring** — automated checks confirm the source is up and data is current.
6. **Volume/EPS baselines & anomaly detection** — expected volume/EPS is baselined and deviations are detected.
7. **Parsing & schema monitoring** — parsing success and schema conformance are actively monitored, not just implied by a one-off check.
8. **Completeness & gap detection** — missing or dropped events are detected.
9. **Retry, checkpoint & recovery behaviour** — the collection mechanism can resume cleanly after an interruption.
10. **Duplicate prevention** — mechanisms exist to prevent or detect duplicate event ingestion.
11. **Change management & version control** — changes to collection configuration are tracked and version-controlled.
12. **Access control & segregation of duties** — access to the source and its configuration is controlled and appropriately segregated.
13. **Retention & legal obligations** — retention meets defined operational and legal/compliance requirements.
14. **Operational runbooks, alerting & escalation** — documented runbooks and alerting exist for collection failures.
15. **Periodic validation & evidence retention** — the source is periodically re-validated and evidence of that validation is retained.

## 47. Response Readiness Index (RRI)
**Category:** Assurance

The weighted readiness of a source across runbooks, ownership, evidence availability, escalation and response/recovery capability -- gated on evidence availability.

**Example:** Runbook, owner and escalation path all current and linked, but retention unrecorded caps the rating at Not response-ready.

**Sub-terms / dimensions / components:**

`weighted achieved / weighted possible × 100` — five equally weighted dimensions, 0–4 each, /20:

1. **Runbook Readiness** — if this source fired a real alert tonight, is there an approved procedure telling a responder what to do with it?
2. **Ownership Readiness** — is there a specific, contactable person or team who can be pulled into an investigation involving this source?
3. **Evidence Availability** (hard gate) — when the investigation actually happens, will the evidence still exist and will it be usable?
4. **Escalation Readiness** — does a responder know exactly who to escalate to, at what severity, without guessing?
5. **Response & Recovery Capability** — once escalated, is there a defined action to take, and can the organisation recover if needed?

## 48. Operational Assurance Index (OAI)
**Category:** Assurance

The weighted reliability of a collection pipeline across availability, timeliness, health checks, supportability and maintenance -- gated on health checks actually existing.

**Example:** Two source-level checks pass, but manual, unmanaged configuration and no monitoring elsewhere caps the rating at Weak.

**Sub-terms / dimensions / components:**

Five equally weighted dimensions, 0–4 each, /20:

1. **Availability** — is the collection path actually up, and would it stay up if one component failed?
2. **Timeliness** — is data arriving within an acceptable and known latency, without silent backlog building up?
3. **Health Checks** (hard gate) — are the defined health tests for this source actually scheduled, running and passing, not just theoretically available in the catalogue?
4. **Supportability** — can this collection path be changed, patched or fixed safely without an engineer's tribal knowledge?
5. **Maintenance** — is this collection path being actively kept current, or is it running unattended until something breaks?

## 49. Threat Detection Index (TDI)
**Category:** Assurance

The weighted effectiveness of detections actually built against a source across technique coverage, rule coverage, validation, fidelity and latency -- gated on a rule actually existing.

**Example:** 95.5% assessed technique coverage, but no validation, fidelity or latency evidence caps the rating at Weak, not Strong.

**Sub-terms / dimensions / components:**

Five equally weighted dimensions, 0–4 each, /20:

1. **Technique Coverage** — does this source's data actually support the MITRE ATT&CK tactics and techniques it is supposed to?
2. **Rule Coverage** (hard gate) — for each mapped use case, does a real, active detection analytic exist, not just a documented intention to build one?
3. **Validation** — has the rule actually been proven to fire correctly against expected events, and how recently?
4. **Fidelity** — of the alerts this source's detections generate, what proportion are confirmed true positives rather than noise?
5. **Latency** — does the detection fire close enough to when the underlying activity actually happened to be operationally useful?

## 50. Business Impact Level (BIL)
**Category:** Governance

The assessed impact of a confidentiality, integrity or availability compromise -- the highest-rated dimension drives the classification recorded on the parent Data Classification record.

**Example:** Integrity compromise of an audit trail rated BIL 5, deriving a SECRET classification even though disclosure alone would rate lower.

**Sub-terms / dimensions / components:**

Overall rating = highest (worst-case) of three dimensions, not an average:

1. **Confidentiality** — what harm results if this data is disclosed to someone not authorised to see it (exposed credentials, privileged-account activity, personal information, commercially sensitive detail)?
2. **Integrity** — what harm results if this data is altered or fabricated without detection (falsified audit evidence, tampered financial records, a masked security event)?
3. **Availability** — what harm results if this data becomes inaccessible when needed (a blocked investigation, a missed compliance deadline, an unrecoverable incident timeline)?

## 51. Cyber Value Index (CVI)
**Category:** Cyber value

The weighted overall data-quality score for an already-onboarded source, combining Event Type Coverage (30%), Required Field Coverage (25%), ECCS (25%) and Data Quality Score (20%).

**Example:** ETC 70%, RFC 75%, ECCS 64%, DQS 65% combine to a CVI of 68.75% -- Adequate.

**Sub-terms / dimensions / components:**

`(ETC × 0.30) + (RFC × 0.25) + (ECCS × 0.25) + (DQS × 0.20)`

| Component | Weight | Definition |
|---|---|---|
| Event Type Coverage (ETC) | 30% | Required event types captured ÷ required event types |
| Required Field Coverage (RFC) | 25% | Required fields present, populated and usable ÷ required fields |
| Event Context Completeness (ECCS) | 25% | Seven-dimension score ÷ 28 |
| Data Quality Score (DQS) | 20% | Timestamp quality, parsing success, consistency, normalisation and completeness, each 0–4, ÷ 20 |

## 52. Log Source Cyber Value
**Category:** Cyber value

The 40-point pre-onboarding model scoring a candidate source's intrinsic value from Marginal Novelty, Pivot Density, Semantic Value, Pivot Breadth, Entity Coverage and Detection Value.

**Example:** 28 of 40 weighted points = 70% -- Adequate, onboard with targeted scope.

**Sub-terms / dimensions / components:**

40-point model, each component scored 0–5 independently:

| Component | Weight | Max points | Definition |
|---|---|---|---|
| Marginal Novelty | ×2.0 | 10 | Reconstructible percentage against existing sources |
| Pivot Density | ×1.5 | 7.5 | % of events with a usable pivot key |
| Semantic Value | ×1.5 | 7.5 | Action Completeness + Outcome Completeness |
| Pivot Breadth | ×1.0 | 5 | Distinct pivot-key types present |
| Entity Coverage | ×1.0 | 5 | Breadth and quality of represented entities |
| Detection Value | ×1.0 | 5 | Usefulness for correlation, alerting, hunting, triage |

**Detection Value** has its own 0–5 scoring rubric (0 = no evidenced detection use … 5 = exceptional, well-evidenced value across correlation, alerting, behavioural detection, hunting, control validation and triage) but no dedicated reference page or further sub-dimension breakdown — it's scored holistically from evidence. Supporting evidence for this model (not weighted components): Identity Diversity, Investigation Breadth.

## 53. Identity Diversity (IDS)
**Category:** Cyber value

The breadth, quality, population spread and investigative usefulness of the identities a source represents, without rewarding repeated activity from the same identity.

**Example:** A thousand events from one service account still score low identity diversity.

**Sub-terms / dimensions / components:**

`((Breadth×0.25)+(Population×0.20)+(Privileged Visibility×0.20)+(Quality×0.20)+(Balance×0.15)) ÷ 4 × 100`

| Dimension | Weight | Definition (0 → 4 anchor) |
|---|---|---|
| Identity-Type Breadth | 25% | No usable identity → five or more security-relevant identity types |
| Distinct Identity Population | 20% | All events from one identity → broad representative population, not artificially inflated |
| Privileged / High-Risk Visibility | 20% | Cannot distinguish privilege → strong visibility of privilege level, role and elevation |
| Identity Quality & Resolution | 20% | Anonymous or blank values → stable, normalised, correlation-ready identifiers |
| Distribution Balance | 15% | One account dominates almost everything → representative distribution |

## 54. Investigation Breadth (IBS)
**Category:** Cyber value

The range of investigative questions, entities, timelines and response paths a source can support across identity, asset, activity, timeline, outcome, impact and correlation.

**Example:** Strong network tracing but no identity or impact evidence caps a firewall traffic log at Limited.

**Sub-terms / dimensions / components:**

`((Identity×20)+(Asset×15)+(Activity×20)+(Timeline×15)+(Outcome×10)+(Impact×10)+(Correlation×10)) ÷ 4`

| Dimension | Weight | Investigative question |
|---|---|---|
| Identity Investigations | 20% | Can an actor be attributed and traced across events? |
| Asset & Location Investigations | 15% | Can a host, device, application, tenant or location be traced? |
| Activity & Behaviour Investigations | 20% | Can distinct security-relevant behaviours be investigated? |
| Timeline Reconstruction | 15% | Can sessions, sequences or related actions be reconstructed? |
| Outcome & Response Paths | 10% | Do outcomes support escalation, containment or validation decisions? |
| Impact & Affected-Object | 10% | Can scope or consequence be assessed? |
| Correlation & Pivot Routes | 10% | Do reliable pivot identifiers support cross-event investigation? |

## 55. Event Type Coverage (ETC)
**Category:** Cyber value

The percentage of required security-relevant event-type categories actually represented in a source, assessed against 14 categories or a governed source-family catalogue.

**Example:** 2 of 26 SRC-001 event types present for a traffic-only firewall feed = 8% -- Poor.

**Sub-terms / dimensions / components:**

14 required event-type categories (generic default; use a governed source-family catalogue, e.g. TAX-03.01.01.01, when one exists). The app itself names these categories without further elaboration; the definitions below are inferred from context, not pulled verbatim from a reference article:

1. **Authentication** — login, logout, MFA challenge and authentication-decision events.
2. **Identity & Account Management** — account creation, deletion, modification and lifecycle events.
3. **Authorization & Access** — access grants, denials, permission and entitlement changes.
4. **Configuration Changes** — changes to system, application or policy configuration.
5. **Administrative Activity** — privileged or administrative actions performed by operators.
6. **Process Execution** — process creation, execution and termination events.
7. **Network Activity** — network connections, traffic flows and network-layer events.
8. **Data Access** — access to, or modification of, data objects and records.
9. **Security Events** — security-specific alerts, detections or control events.
10. **System Events** — operating-system or platform-level events (startup, shutdown, service state).
11. **Availability** — health, uptime and service-availability events.
12. **Cloud Activity** — cloud-provider control-plane and management events.
13. **Detection Events** — events generated by detection or monitoring tooling.
14. **Technology-specific event types** — event types unique to a particular vendor/technology, not covered by the generic categories above.

## 56. Required Field Coverage (RFC)
**Category:** Cyber value

The percentage of mandatory investigative fields that are present, consistently populated, correctly formatted and usable -- not just present in the schema.

**Example:** 30 of 34 applicable fields consistently populated and well-formatted = 88% -- Good.

**Sub-terms / dimensions / components:**

Nine required field groups, each defined by its member fields:

1. **Time** — event time, creation time, received time.
2. **Identity** — user, account, service account, SID.
3. **Network** — source/dest IP, source/dest port.
4. **Host / Asset** — hostname, device, asset ID, cloud resource.
5. **Event Classification** — event type, category, action, object, resource.
6. **Outcome** — result, status, success/failure, status code, error reason.
7. **Severity** — severity, risk, priority, classification.
8. **Correlation** — session, transaction, trace, correlation, process ID.
9. **Additional Context** — message, vendor, product, sourcetype, tenant, region, command, file, URL.

## 57. Data Quality Score (DQS)
**Category:** Cyber value

The technical quality and reliability of logging data across timestamp quality, parsing success, consistency, normalisation and completeness.

**Example:** Broken parsing and inconsistent naming score 20% even when the right fields exist.

**Sub-terms / dimensions / components:**

Five weighted dimensions, each 0–4:

| Dimension | Weight | Definition (0 → 4 anchor) |
|---|---|---|
| Timestamp Quality | 30% | Missing/invalid timestamp → ISO 8601, UTC, millisecond precision, fully normalised |
| Parsing Success | 25% | Most fields unavailable → complete parsing, no observed issues |
| Consistency | 20% | Highly inconsistent naming/formats → completely consistent across events |
| Normalisation | 15% | No normalisation → fully normalised to CIM/ECS/taxonomy standards |
| Completeness | 10% | Large portions missing → complete with virtually no gaps |

## 58. Log Assessment Framework
**Category:** Data quality

A reusable, source-agnostic procedure for assessing the structure, format consistency and data quality of a raw log file at the physical-line and logical-event level, using a self-derived majority baseline rather than an external spec.

**Example:** A file where 9,850 of 10,000 lines match the dominant ISO 8601 timestamp pattern scores 98.5% timestamp-format conformance at line level.

**Sub-terms / dimensions / components:**

Generalised per-line/per-event feature set (not weighted/scored — extracted and rolled up):

| Dimension | What it captures |
|---|---|
| Line number | Physical position in the file |
| Record / Event ID | Which logical record the line belongs to |
| Serialization format | Delimiter / structure family (CSV, TSV, JSON, logfmt, syslog) |
| Format conformance | Line matches the dominant format |
| Timestamp presence | Line carries a timestamp |
| Timestamp format | The date/time pattern used |
| Timestamp conformance | Matches the dominant timestamp pattern |
| Timestamp offset (distance) | Characters before the timestamp |
| Timestamp width | Length of the timestamp token |
| Field count | Number of delimited fields |
| Line length | Character count of the line, excluding the trailing newline |
| Line size (bytes) | UTF-8 byte length of the line, plus 1 for LF or 2 for CRLF |
| First character & class | Leading character and its category (digit, alpha, whitespace, symbol) |
| First-char class conformance | Whether the leading-char class matches the dominant class |
| Structure | Single- vs multi-line event, from record grouping |
| Line ending | Newline convention (LF / CRLF / mixed) |
| Encoding | Byte encoding / BOM |

## 59. Structural Fingerprinting
**Category:** Data quality

A compact hash of a logical event's independent, varying properties -- serialization format and timestamp format -- used to count how many structurally distinct record types a raw log file actually contains. Computed per event after boundary folding, never per physical line.

**Example:** 17 of a possible 64 format x timestamp-format combinations observed means the file is a heterogeneous multi-source stream; 1 distinct fingerprint means it is structurally monolithic.

**Sub-terms / dimensions / components:**

Fingerprint key components:

1. **Serialization format** — the detected structural family (JSON, CSV, syslog, …).
2. **Timestamp format** — the detected date/time pattern.
3. **`type_key`** — a schema signature (e.g. sorted JSON top-level keys); only added when the format|timestamp-format base tuple is degenerate (constant across the whole file), so format+timestamp alone can't distinguish otherwise-identical-looking record types.
---

# Terms found in `index.html` but not in the 59-entry glossary

Reachable only from the "Reference" hub's method cards and the
"Assessments" calculator tab — a full pass over the whole file surfaced
these; the glossary array alone (`frameworkConcepts`) does not list them.

## Cyber Monitoring Effectiveness Index (CMEI)
**Category:** Assurance (roll-up, not in glossary)

Documented as rolling up CVI, TDI, RRI and OAI, but its own weights/formula are explicitly **not yet defined** — the taxonomy record (TAX-07.20) status is "Proposed" / "Reserved for the higher-level framework roll-up."

**Sub-terms / dimensions / components:**

1. **Cyber Value Index (CVI)** — is the data valuable and investigation-ready.
2. **Threat Detection Index (TDI)** — are threats detected effectively.
3. **Response Readiness Index (RRI)** — can responders act on it.
4. **Operational Assurance Index (OAI)** — is the pipeline reliable.

## Line Length Quality Score
**Category:** Splunk event sizing (not in glossary)

Evaluates whether valid logical events are sized safely for Splunk ingestion and whether `TRUNCATE` is evidence-based, bounded and operationally appropriate.

**Sub-terms / dimensions / components:**

Five weighted scoring dimensions, summing to a 0–100 score:

| Dimension | Weight (points) | Definition |
|---|---|---|
| Truncation Risk | 35 | Valid events exceeding configured/default `TRUNCATE` |
| Event Boundary Integrity | 25 | Whether oversized records are genuine or incorrectly merged |
| Size Consistency | 15 | P95-to-median byte-size variation |
| Maximum Event Suitability | 15 | Operational reasonableness of the largest valid event |
| Configuration Safety | 10 | Whether `TRUNCATE` is measured, justified and bounded |

## Log Format Detection & Parsing
**Category:** Splunk sourcetype definition (not in glossary)

Defines how Splunk interprets the structural format of an event and makes fields available after line breaking and timestamp parsing.

**Sub-terms / dimensions / components:**

Format matrix — 8 structural format categories, each with its typical Splunk extraction approach:

1. **CSV** — `INDEXED_EXTRACTIONS = CSV`; check delimiter, quotes, headers, embedded commas.
2. **TSV** — `INDEXED_EXTRACTIONS = TSV`; check tabs, empty columns, trailing fields.
3. **JSON** — indexed or search-time JSON extraction depending on collection path; check nested arrays, duplicate keys, HEC metadata, double extraction.
4. **XML** — `KV_MODE = xml` at search time; check namespaces, repeated nodes, multiline records.
5. **Structured (key-value)** — `KV_MODE = auto` or explicit search-time extraction; check quotes, escapes, duplicate keys.
6. **Semi-structured** — `REPORT-*` or `EXTRACT-*`; check schema drift, optional labels, inconsistent syntax.
7. **Unstructured** — targeted regex only; watch false positives and maintenance cost.
8. **Mixed** — separate sourcetypes or preprocess; check conflicting schemas and unsafe universal parsing.

## Line Break
**Category:** Splunk sourcetype definition (not in glossary)

Defines how Splunk separates the incoming data stream into individual logical events before timestamp recognition and field extraction.

**Sub-terms / dimensions / components:**

Two Splunk index-time settings:

1. **`SHOULD_LINEMERGE`** — controls whether Splunk attempts to merge multiple physical lines into a single logical event; `false` is preferred when event boundaries can be expressed explicitly with `LINE_BREAKER`.
2. **`LINE_BREAKER`** — a regular expression defining the separator between events; the text matched by the first capturing group is discarded at the split point.

## Log Onboarding Viability Assessment
**Category:** Lifecycle, Assurance & Dependency (TAX-06.01.02, not in glossary)

Phase 1 assessment that determines whether a platform or data source is valuable, technically feasible, supportable and viable to onboard before detailed design and build.

**Sub-terms / dimensions / components:**

Three question-based sub-scores feed the overall Viability Rating, alongside standalone risk modifiers and a final gate decision:

1. **Security Value Score** — 15 scored questions; business, compliance, detection and incident-response value of the proposed source.
2. **Technical Readiness Score** — 19 scored questions; readiness of documentation, schema, integration path, authentication, network, data format, samples, volume and collection prerequisites. Plus 4 complexity factors that roll into Engineering Complexity → Combined Implementation Complexity:
   - Transport & ingestion method complexity
   - Data formatting & parsing complexity
   - Log volume & EPS complexity
   - Analytics / use case & value mapping complexity
3. **Operational Assurance Score** — 15 scored questions; initial support, ownership, monitoring and operational acceptance readiness before build starts.

Standalone risk modifiers (not part of the three scores above, but can override the resulting Viability Rating):

4. **Custom Solution Dependency** — identifies whether the source requires a custom script, custom technology add-on, custom parser, custom routing or unsupported integration path.
5. **Reverse Engineering Requirement** — identifies where weak documentation and a custom or unsupported integration require manual discovery of API behaviour, schema, fields, timestamps or collection mechanics.
6. **Discovery Requirement** — tracks whether schema, field list, sample events, volume, authentication and collection mechanisms still need to be defined.

Combined Implementation Effort Rating (from Technical Readiness's complexity factors): Difficulty Rating, Complexity Rating, Time Rating → Effort Index → Duration Band.

Terminal output: **Viability Gate Decision** — Viable / Viable with Conditions / Further Investigation Required / Not Currently Viable / Not Justified.

---

## Roll-up chain (how the composites nest)

```
Log Assessment Framework  -- line-by-line/event-level procedure, self-calibrating majority baseline
├── Encoding (dimension 17 of 17: byte encoding / BOM)  -- DETECTED here, earliest point
│   └── feeds Log Format Quality's "Encoding and content integrity" criterion  -- SCORED there
├── feeds Timestamp Quality        -- underlies its per-line/per-event scoring
├── feeds Log Format Quality       -- underlies its per-line/per-event scoring
├── feeds Schema Stability Gate    -- supplies its all-axes conformance rate
└── Structural Fingerprinting      -- informs the sourcetype/parsing split decision
    (one sourcetype vs several, from distinct format/timestamp-format combinations)

Log Format Quality  -- 6 criteria, 0-4 each, /24
├── Structure and format identification
├── Event boundary reliability
├── Delimiter, quoting and escaping integrity
├── Schema and field stability
├── Encoding and content integrity          -- ⇐ Log Assessment Framework's Encoding dimension
└── Parsing and normalisation complexity

Cyber Monitoring Effectiveness Index (CMEI)  -- weights not yet defined (Proposed)
├── Cyber Value Index (CVI)              -- post-onboarding data quality
│   ├── Event Type Coverage (ETC)        ×30%
│   ├── Required Field Coverage (RFC)    ×25%
│   ├── ECCS                             ×25%
│   └── Data Quality Score (DQS)         ×20%
│       ├── Timestamp Quality ×30% (⇐ Log Assessment Framework), Parsing Success ×25%,
│       │   Consistency ×20%, Normalisation ×15%, Completeness ×10%
│       │   (Log Format Quality -- and so Encoding -- rolls into DQS conceptually via
│       │    Parsing Success/Consistency; it is not one of DQS's 5 named weighted criteria)
├── Response Readiness Index (RRI)       -- can we act on it
├── Operational Assurance Index (OAI)    -- is the pipeline healthy
└── Threat Detection Index (TDI)         -- are detections effective

Pre-ingest cyber-value gates (Assessment Gate)
├── Minimum Parse Rate Gate
├── Timestamp & Timezone Gate
└── Schema Stability Gate                -- ⇐ Log Assessment Framework's all-axes conformance rate

Log Source Cyber Value (separate, PRE-onboarding candidate model)
├── Marginal Novelty      ×2.0 (10 pts)
├── Pivot Density         ×1.5 (7.5 pts)
├── Semantic Value        ×1.5 (7.5 pts)
├── Pivot Breadth         ×1.0 (5 pts)
├── Entity Coverage       ×1.0 (5 pts)
└── Detection Value       ×1.0 (5 pts)
    (supporting evidence, not weighted components: Identity Diversity, Investigation Breadth)

Log Onboarding Viability Assessment (separate, Phase 1 pre-onboarding gate)
├── Security Value Score        -- 15 questions
├── Technical Readiness Score   -- 19 questions + 4 complexity factors
├── Operational Assurance Score -- 15 questions
└── modifiers: Custom Solution Dependency, Reverse Engineering Requirement,
    Discovery Requirement → Viability Gate Decision

Data Source Assurance (separate, post-onboarding operational-maturity score)
└── 15 controls, /60
```
