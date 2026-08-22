# Questions Extracted from the Logging Reference Architecture

> Every question-form sentence in `logging-reference-architecture.md`, grouped under the same heading hierarchy (H1/H2/H3) it appears under in the source document. Wording is verbatim from the source; only the leading numbering of the original document's own enumerated question-lists has been stripped where it wrapped onto the question text during extraction.

## 2. HOW TO USE THE LRA
- What security outcomes must the logging capability support?
- What data must my agency collect and retain to support those outcomes?
- How should that data move through the logging infrastructure from collection through analysis and storage?
- What controls must my agency put in place to protect the logging capability and govern access, retention, and authorized sharing?
- How will my agency validate that the logging capability is complete, usable, and aligns to policy?
## 3. SECURITY OUTCOMES
### 3.1 CONTINUOUS EVENT MONITORING
- Is suspicious or anomalous activity occurring across identity, endpoint, network, cloud, IoT, application/service, and administrative domains?
- Are security tool alerts generated with enough context and timeliness to support triage and follow-on investigation?
- Are known indicators of compromise (IOCs) present in current or recent telemetry?
### 3.2 THREAT HUNTING
- Can analysts search and correlate normalized and source-detailed data across identity, endpoint, network, cloud, IoT, and application/services sources?
- Are sufficiently detailed fields available for investigation, such as command-line arguments, parent- child process relationships, authentication context, and cloud application programming interface (API) request details?
- Do consistent identity and asset identifiers exist across sources to support pivot-based investigation?
### 3.3 INCIDENT RESPONSE
- Which systems, accounts, identities, and/or data are affected?
- Can analysts reconstruct user and process timelines from correlated logs?
- Are records integrity-protected and handled in a way that supports evidentiary use where required?
### 3.4 DIGITAL FORENSICS
- Can investigators reconstruct the sequence of events, including initial access, escalation, lateral movement, and data impact?
- Are designated datasets protected in ways that support evidentiary use, such as hashing, signing, or immutability where required?
- Are acquisition and handling procedures documented, and are duties appropriately separated where evidentiary handling is required?
### 3.5 MEASURING LOGGING CAPABILITY READINESS
- Are there mitigations in place, or other log sources that are already in place that make collection of that data less impactful?
- What is the degree of impact the system has on the agency’s mission?
- Are there alternative infrastructure or design choices that achieve mission and operational goals while decreasing cost or complexity for operability?
- Are required log sources across all environments represented?
- Does collected telemetry sufficiently depict network and host activity?
- Are evaluations conducted to identify logging gaps and overlap?
- Are events available quickly enough to support the intended outcome?
- Do event records contain the fields and context required for correlation, scoping, and reconstruction?
- Have logs or other data collected been altered or manipulated in any way outside of planned data engineering for log collection, ingestion, and normalization?
- Can analysts search and retrieve data within the expected windows?
- Are timestamps reliable, required fields populated, mappings stable, and parser failures visible?
- Can analysts perform expected pivots and investigations without excessive manual reconciliation?
- Are there attributes (such as timestamps) that are available that allow for correlation between events from the same and different log sources?
- Are designated datasets protected and handled appropriately for evidentiary use where needed?
- Does the agency actively test whether the capability is complete, usable, and resilient over time?
## 4. ARCHITECTURAL DECISIONS
### 4.1 TELEMETRY DECISIONS
- What telemetry categories are required to support baseline outcomes?
- What systems, services, and environments are expected to generate them?
- What event fidelity is required for the data to be operationally usable?
- What gaps exist today, and which are most urgent to close?
### 4.5 SEARCHABLE, RETRIEVABLE, AND IMMUTABLE HANDLING
- What datasets drive routine monitoring and hunting?
- How long must the datasets remain actively searchable?
- What datasets are eligible for earlier transition to lower-cost retrievable tiers?
- What datasets require immutable handling and for how long?
- How will retrieval, integrity, and auditability be validated?
### 4.7 LOGGING CAPABILITY OBSERVATION, VALIDATION, AND SAFE CHANGES
- How will the agency know that required datasets are present, timely, complete, and usable for the outcomes they are intended to support, and how will the agency detect and recover from degradation over time?
## 8. LOGGING INFRASTRUCTURE SECURITY, INTEGRITY, AND RESILIENCE
### 8.3 RESILIENCE AND FAILURE HANDLING
- How does the agency detect degradation, recover missed data, preserve trust during partial failure, and validate that required datasets remain complete and usable over time?
## 9. RISK-INFORMED LOGGING BEYOND THE BASELINE
### 9.3 METHOD FOR DETERMINING ABOVE-BASELINE LOGGING
- Can the agency reconstruct credential use across cloud and on-premises systems?
- Can it determine who changed a privileged role assignment and from where the change was made?
- Can it measure the scope and timing of data exfiltration?
- Can it verify integrity changes to critical files, services, or controller configurations?
## Appendix C: PRIORITY ARCHITECTURE AND DESIGN DECISION CHECKLIST
### C.2 OUTCOME ALIGNMENT
#### C.2.1 Required Security Outcomes
- Does the plan clearly explain how the logging capability supports continuous event monitoring?
- Does the plan clearly explain how the logging capability supports threat hunting?
- Does the plan clearly explain how the logging capability supports incident response?
- Does the plan clearly explain how the logging capability supports digital forensics?
#### C.2.2 Operational Questions
- Does the plan identify the operational questions the agency must be able to answer with its logging capability?
- Are those questions tied to concrete data, fidelity, searchability, and retention decisions?
- Are timeliness expectations defined where monitoring or response speed matters?
#### C.2.3 Enterprise Perspective
- Does the plan describe how enterprise-level visibility will be achieved?
- Does it account for cross-domain operations across identity, endpoint, network, cloud, and administrative planes?
- Does it avoid treating logging as a set of disconnected local tool implementations?
### C.3 SCOPE AND COVERAGE
#### C.3.1 Scope Definition
- Are the environments, systems, services, and organizational boundaries in scope clearly defined?
- Are out-of-scope or deferred environments explicitly identified?
- Is the reason for exclusion or delay documented?
#### C.3.2 Baseline Coverage
- Does the plan show how baseline logging requirements are satisfied?
- Does it identify the telemetry categories used to meet each baseline requirement?
- Does it address identity, network, endpoint, privileged/admin, cloud/SaaS admin, object/resource/data, and security-tool visibility as applicable?
#### C.3.3 Specialized and High-Value Environments
- Does the plan address HVAs and other mission-critical systems?
- Does it address specialized environments such as OT, IoT, segmented, remote, or constrained systems where applicable?
- Does it address relevant zero trust policy decisions?
- Does it explain how collection differs in those environments without lowering trustworthiness expectations?
### C.4 TELEMETRY FIDELITY AND USABILITY
#### C.4.1 Minimum Event Fidelity
- Does the plan define the minimum event fidelity required for each major telemetry category?
- Does it move beyond source presence to address field completeness, attribution, and usable context?
- Does it identify major fidelity gaps that would weaken investigation, scoping, or reconstruction?
#### C.4.2 Common Fields for Cross-Source Use
- Does the plan identify the common fields required for cross-source operations?
- Are timestamp, event type, identity or system context, affected resource, outcome, and provenance addressed?
- Are additional fields preserved in support of zero trust policy decisions, where applicable for privilege state, network/session context, request detail, or object-level analysis?
#### C.4.3 Operational Usability
- Does the plan explain how analysts will pivot across identity, endpoint, network, cloud, and administrative data?
- Does it preserve enough source-native detail for deeper investigation?
- Does it avoid relying solely on alerts or summarized outputs where underlying event context is still needed?
### C.5 COLLECTION AND PROVENANCE
#### C.5.1 Collection Model
- Does the plan explain where collection occurs for each major telemetry class?
- Does it identify which sources are treated as authoritative?
- Does it account for collection differences across enterprise, cloud, SaaS, and specialized environments?
#### C.5.2 Provenance Preservation
- Does the plan describe how provenance is preserved from source through downstream handling?
- Are source identity, event time, and collection path recorded or recoverable?
- Does the plan account for transformation history where it materially affects interpretation?
#### C.5.3 Delivery Assurance
- Does the plan address buffering, retry, restart persistence, or equivalent delivery safeguards?
- Does it describe how missed delivery or collection gaps are detected?
- Does it identify where silent loss could still occur?
### C.6 TRANSPORT AND DATAFLOW
#### C.6.1 Transport Patterns
- Does the plan specify how telemetry moves through the logging infrastructure?
- Does it distinguish between event-driven delivery, polling, buffering, store-and-forward, and other patterns?
- Are transport decisions tied to the needs of the source and the operational outcome?
#### C.6.2 Durability and Replay
- Does the plan identify where durable handoff occurs?
- Does it address replay, checkpointing, or backfill mechanisms where needed?
- Does it describe how the architecture behaves during partial failure?
#### C.6.3 Enterprise Dataflow
- Does the plan explain where collection ends and common downstream handling begins?
- Does it explain how data reaches enterprise analytical or monitoring functions?
- Does it describe how separate enclaves or environments converge into a usable enterprise view?
### C.7 NORMALIZATION, ENRICHMENT, AND SCHEMA GOVERNANCE
#### C.7.1 Normalized Event Representation
- Does the plan identify where normalized event records are produced?
- Does it explain what fields are normalized and why?
- Does it distinguish normalized event records from narrower workflow objects such as alerts or case payloads?
#### C.7.2 Recoverable Source-Native Context
- Does the plan specify what source-native detail remains recoverable?
- Does it explain where fuller context is preserved and how it is accessed?
- Does it avoid over-flattening records into operationally weak representations?
#### C.7.3 Enrichment
- Does the plan explain what authoritative enrichment sources are used, such as identity, asset, or configuration data?
- Does it describe how enrichment improves usability without obscuring original event meaning?
- Can analysts distinguish source-provided values from added context where necessary?
#### C.7.4 Schema Governance
- Does the plan define how new sources are onboarded?
- Does it define required fields and mapping expectations?
- Does it address parser failure, unmapped values, schema drift, and downstream dependency management?
### C.8 STORAGE, SEARCHABILITY, AND RETENTION
#### C.8.1 Searchable Operational Window
- Does the plan identify which datasets must remain operationally searchable?
- Does it define how long those datasets remain actively searchable?
- Does it state whether search performance is sufficient for monitoring, hunting, and routine investigation?
#### C.8.2 Retrievable Retention
- Does the plan identify which datasets may move into lower-cost retrievable storage?
- Does it define retrieval expectations and access paths?
- Does it ensure retrievability supports reconstruction, oversight, and longer-horizon review?
#### C.8.3 Immutable or Evidentiary Handling
- Does the plan identify which datasets require stronger integrity or immutable handling?
- Does it explain why those datasets are designated that way?
- Does it document access, auditability, and handling expectations for those datasets?
#### C.8.4 Storage Design Rationale
- Are storage and tiering decisions tied to operational outcomes rather than vendor defaults alone?
- Does the plan distinguish actively searchable retention from retrievable retention clearly?
- Does it identify major cost or scale constraints affecting storage design?
### C.9 SECURITY, ACCESS, MINIMIZATION, AND SHARING
#### C.9.1 Logging Infrastructure Protection
- Does the plan identify how the logging infrastructure is protected as a mission-critical capability?
- Are administrative access controls, least privilege, segmentation, and monitoring of privileged actions addressed?
- Does the plan cover more than just the analytics tier, including collection, transport, processing, and storage components?
#### C.9.2 Integrity and Provenance
- Does the plan explain what integrity protections apply and where?
- Are hashing, signing, immutability, or equivalent controls identified where needed?
- Does the plan describe how provenance is preserved for designated datasets?
#### C.9.3 Access Control
- Does the plan define who can access what types of log data?
- Are least privilege, separation of duties, and sensitive-data access restrictions addressed?
- Are access logging and auditability covered?
#### C.9.4 Minimization and Redaction
- Does the plan identify what data must be minimized, redacted, or segmented?
- Does it specify where those controls are applied?
- Does it avoid scattering policy logic inconsistently across multiple tools or paths?
#### C.9.5 Authorized Sharing
- Does the plan define what logging data may be shared externally and under what conditions?
- Does it explain how tagging, minimization, redaction, and routing are applied before sharing?
- Are sharing approvals, governance, and auditability addressed?
### C.10 VALIDATION, OBSERVABILITY, AND CHANGE CONTROL
#### C.10.1 Coverage Validation
- Does the plan explain how required sources and categories are validated for presence and completeness?
- Are coverage reviews periodic and repeatable?
- Are gaps tracked explicitly?
#### C.10.2 Timeliness and Quality Validation
- Does the plan define how timeliness is measured?
- Are timestamp quality, field completeness, parser health, and schema conformance checked?
- Are degraded conditions visible to the agency before they affect operations materially?
#### C.10.3 Operational Usability Validation
- Does the plan explain how the agency verifies that analysts can perform required pivots and investigations?
- Are synthetic tests, replay tests, exercises, or equivalent validation methods used?
- Does the plan validate searchability and retrieval in practice rather than assume they work?
#### C.10.4 Drift and Change Management
- Does the plan identify how source, parser, and schema changes are introduced?
- Are rollback or mitigation procedures defined?
- Does the plan describe how operational regressions will be detected after change?
### C.11 ABOVE-BASELINE LOGGING DECISIONS
#### C.11.1 Decision Basis
- Does the plan explain where the agency has chosen to go above baseline?
- Are those decisions justified by mission, threat, risk, or visibility considerations?
- Are they documented clearly enough that another team could understand the rationale?
#### C.11.2 Investigative Use Case Linkage
- Does the plan connect above-baseline telemetry to specific investigative or operational questions?
- Does it explain what those additional data sources or fidelity levels enable?
- Does it avoid treating above-baseline logging as ad hoc accumulation?
#### C.11.3 Integration Into the Architecture
- Does the plan show how above-baseline telemetry is collected, transported, normalized, stored, protected, and validated?
- Are retention and cost implications addressed?
- Is above-baseline telemetry available to the teams that need it?
### C.12 MATURITY AND IMPROVEMENT
#### C.12.1 Current State
- Does the plan state the agency’s current maturity stage or equivalent current-state view?
- Does it describe the evidence supporting that assessment?
- Does it identify the largest operational gaps honestly?
#### C.12.2 Improvement Priorities
- Does the plan identify the highest-priority improvements for the next planning cycle?
- Are those priorities tied to the largest risks to detection, threat hunting, incident response, or forensics?
- Are dependencies and constraints identified?
#### C.12.3 Governance and Review
- Does the plan identify ownership and review cadence?
- Does it define what events trigger plan updates?
- Does it treat the plan as a living decision record rather than a static artifact?
### C.13 REVIEWER SUMMARY
- Does the Agency Logging Plan clearly explain how the agency’s logging capability supports monitoring, threat hunting, incident response, and forensics?
- Does it make the key architectural, retention, integrity, access, and validation decisions explicit?
- Does it identify what is still incomplete and how those gaps will be addressed?
- Would an implementation team be able to use this plan to build, validate, or improve the capability without having to infer major design decisions?
## Appendix D: BASELINE LOGGING CATEGORIES AND MINIMUM FIDELITY QUICK REFERENCE
### D.1 HOW TO USE THIS APPENDIX
- Coverage Does the agency collect this category for the relevant systems, services, and environments?
- Minimum usable fidelity Do event records preserve the minimum fields and context needed for correlation, scoping, and reconstruction?
- Operational accessibility Is the data available in the right timeframes and storage tiers for monitoring, threat hunting, incident response, and forensics?
- Known weaknesses What failure modes still materially weaken the agency’s ability to use this category?
### D.10 COMMON FIELDS REQUIRED ACROSS CATEGORIES
#### D.10.2 Validation Prompts
- Are these fields present and usable across the major baseline categories?
- Are the field meanings stable enough for correlation across sources?
- Are timestamps reliable enough for cross-source sequence reconstruction?
- Is provenance preserved in a way that allows analysts to understand where the record came from and how it entered the logging infrastructure?
### D.11 QUICK GAP IDENTIFICATION PROMPTS
#### D.11.1 Coverage
- Which baseline categories are only partially covered today?
- Which environments are missing one or more baseline categories entirely?
- Are HVAs or mission-critical cloud services treated differently enough to reflect their risk?
#### D.11.2 Fidelity
- Which categories lack enough detail for real investigation or reconstruction?
- Where are key fields missing, unreliable, or inconsistently mapped?
- Which categories exist mainly as summaries or alerts rather than usable event records?
#### D.11.3 Searchability and Access
- Which categories are retained but not actively searchable?
- Which categories are present only in isolated tools or enclaves?
- Which categories are inaccessible to the enterprise SOC or central investigative function?
#### D.11.4 Correlation
- Which categories cannot be reliably correlated across identity, endpoint, network, cloud, and administrative sources?
- Where do entity identifiers or timestamps break enterprise pivots?
- Which categories most frequently require manual reconciliation?
## Appendix E: VALIDATION AND OPERATIONAL READINESS CHECKLIST
- Is data arriving in time to support monitoring and response?
- Is event fidelity sufficient for investigation and reconstruction?
- Are required telemetry sources present and producing usable records?
- Can analysts search, pivot, retrieve, and validate the data they need?
- Are integrity, provenance, and access protections working as intended?
- Can the agency detect when the logging capability has degraded?
- Can the agency safely change the capability without silently breaking it?
### E.2 SCOPE AND COVERAGE VALIDATION
#### E.2.1 In-Scope Environment Validation
- Has the agency validated that all in-scope environments identified in the Agency Logging Plan are represented in the logging capability?
- Are enterprise, cloud, SaaS, mission, and specialized environments covered as described in the plan?
- Are out-of-scope or deferred environments explicitly identified and tracked?
#### E.2.2 Baseline Category Coverage Validation
- Has the agency validated that each baseline logging category is covered for the appropriate systems and environments?
- Are identity, network, endpoint/system, privileged/admin, cloud/SaaS admin, object/resource/data, and security-tool categories present where expected?
- Has the agency identified any baseline categories that are only partially present or inconsistently available?
#### E.2.3 High-Value and Specialized Environment Validation
- Has the agency validated that HVAs, mission-critical systems, or specialized environments receive the intended level of logging coverage?
- Are constrained environments handled through validated alternate collection patterns rather than undocumented exceptions?
- Are key blind spots for those environments documented and prioritized?
### E.3 SOURCE PRESENCE AND COLLECTION VALIDATION
#### E.3.1 Source Onboarding Validation
- Has each required source or source class been validated as onboarded successfully?
- Are source owners and data dependencies known?
- Is the agency relying on authoritative sources where intended?
#### E.3.2 Collection Integrity Validation
- Has the agency validated that collection occurs where planned?
- Is source identity preserved through collection?
- Are collection paths documented and testable?
#### E.3.3 Gap Detection
- Can the agency detect when a required source stops sending data?
- Can it detect reduced event volume, missing event classes, or intermittent delivery from a source?
- Are collection failures visible to operators before they materially affect monitoring or response?
### E.4 TIMELINESS AND LATENCY VALIDATION
#### E.4.1 Event Arrival Timeliness
- Has the agency validated that events arrive within the timeframes required for their intended operational use?
- Are latency thresholds defined for major telemetry categories?
- Are those thresholds measured continuously or at regular intervals?
#### E.4.2 Delay and Backlog Detection
- Can the agency detect transport delay, processing backlog, indexing lag, or retrieval delay?
- Are queue depth, backlog age, or equivalent indicators monitored?
- Is there a documented response process when timeliness degrades?
#### E.4.3 Polling and Retrieval Validation
- For sources that use polling or scheduled retrieval, has the agency validated that the cadence is sufficient for the outcome being supported?
- Has the agency measured lag introduced by API-based or scheduled collection?
- Are missed windows, provider-side changes, or retrieval failures visible?
### E.5 EVENT FIDELITY AND DATA QUALITY VALIDATION
#### E.5.1 Minimum Field Validation
- Has the agency validated that required common fields are present across the major telemetry categories?
- Are timestamp, event type, identity/system context, affected resource, outcome, and provenance fields populated where expected?
- Are required category-specific fields validated as well?
#### E.5.2 Timestamp Validation
- Has the agency validated timestamp quality and consistency across major sources?
- Are timestamps reliable enough to support cross-source reconstruction?
- Are time-synchronization or time-zone issues documented?
#### E.5.3 Parsing and Mapping Validation
- Has the agency validated that fields are parsed and mapped correctly?
- Are unmapped values, parser failures, or malformed records visible?
- Is field meaning stable across updates?
#### E.5.4 Fidelity Sufficiency Validation
- Has the agency validated that records preserve enough detail to support triage, threat hunting, scoping, and reconstruction?
- Can analysts reach source-native context when normalized records are not enough?
- Are any categories present only as weak summaries or alerts without enough underlying event detail?
### E.6 SCHEMA, NORMALIZATION, AND CORRELATION VALIDATION
#### E.6.1 Normalized Event Validation
- Has the agency validated that normalized event records exist where intended?
- Are normalized records durable and operationally usable?
- Are normalized records sufficient for routine cross-source pivots?
#### E.6.2 Source-Native Context Validation
- Has the agency validated that richer source-native context remains recoverable where needed?
- Can analysts retrieve original or equivalent detailed event context during investigations?
- Are recovery paths documented and usable under pressure?
#### E.6.3 Entity Correlation Validation
- Can the agency correlate activity across identity, endpoint, network, cloud, and administrative datasets?
- Are shared identifiers usable in practice?
- Are there common situations where analysts still must manually reconcile core entities?
#### E.6.4 Drift Detection Validation
- Has the agency validated its ability to detect schema drift or changed field meaning?
- Are parser and mapping regressions surfaced operationally?
- Are downstream detections, dashboards, or workflows tested when source schemas change?
### E.7 SEARCHABILITY AND RETRIEVAL VALIDATION
#### E.7.1 Searchability Validation
- Has the agency validated actively searchable datasets remain available in the intended low- latency tiers?
- Can analysts perform expected search and pivot actions within operationally useful timeframes?
- Are query performance expectations documented and tested?
#### E.7.2 Retrieval Validation
- Has the agency validated retrievable datasets that can be retrieved within the expected timeframe?
- Are restored or retrieved datasets complete and usable?
- Are retrieval paths exercised periodically rather than assumed?
#### E.7.3 Searchability vs. Retrieval Distinction
- Has the agency validated that datasets intended only for retrieval, are not being mistakenly treated as actively searchable?
- Are operators clear on what is actively searchable versus what requires retrieval?
- Are expectations aligned with the Agency Logging Plan?
### E.8 OPERATIONAL USABILITY VALIDATION
#### E.8.1 Monitoring Use Case Validation
- Can the agency’s monitoring teams use the data to identify suspicious activity in operationally relevant timeframes?
- Do alerts include enough context to support triage?
- Can teams move from alert to supporting event data without excessive manual effort?
#### E.8.2 Threat Hunting Validation
- Can analysts search and pivot across the datasets needed for threat hunting?
- Are required hunt-ready fields and contexts available?
- Can analysts perform representative hunt workflows without depending on ad hoc data recovery?
#### E.8.3 Incident Response Validation
- Can responders reconstruct timelines and scope affected systems, identities, and data?
- Can the agency pivot from alerts into correlated supporting datasets quickly enough to support containment decisions?
- Are investigative workflows impeded by missing or inaccessible data?
#### E.8.4 Digital Forensics Validation
- Can investigators reconstruct key events with sufficient confidence using retained data?
- Are designated forensic or evidentiary datasets preserved as intended?
- Is supporting context, such as inventories or baseline information, accessible when needed?
### E.9 INTEGRITY, PROVENANCE, AND ACCESS VALIDATION
#### E.9.1 Integrity Control Validation
- Has the agency validated that required integrity protections are functioning as intended?
- Are hashing, signing, immutability, or equivalent protections applied where designated?
- Can the agency detect unauthorized modification or integrity loss where such controls are expected?
#### E.9.2 Provenance Validation
- Can the agency trace records back to their origin and handling path where needed?
- Are meaningful transformations documented or recoverable?
- Does the agency know when provenance is insufficient for trust-sensitive use cases?
#### E.9.3 Access Control Validation
- Has the agency validated that access restrictions work as intended?
- Are least privilege and separation-of-duties controls enforced for sensitive log data?
- Are privileged and sensitive-data access events logged and reviewable?
#### E.9.4 Minimization and Sharing Validation
- Has the agency validated that minimization, redaction, segmentation, and sharing controls are applied at the intended enforcement points?
- Are external or boundary-crossing data flows governed and auditable?
- Are policy-controlled views or subsets operating as intended?
### E.10 PIPELINE HEALTH AND RESILIENCE VALIDATION
#### E.10.1 Health Monitoring Validation
- Does the agency monitor the health of major pipeline stages such as collection, transport, processing, storage, and analytics?
- Are failures visible quickly enough for intervention?
- Are health indicators tied to operational escalation paths?
#### E.10.2 Partial Failure Validation
- Has the agency validated how the pipeline behaves under partial failure?
- Can the agency identify what data is delayed, degraded, or at risk during component failure?
- Are degraded-mode behaviors documented?
#### E.10.3 Buffering and Replay Validation
- Has the agency validated buffering, queueing, replay, or backfill mechanisms where they are required?
- Can missed or delayed data be recovered as intended?
- Are replay and backfill tested periodically?
#### E.10.4 Single-Point Fragility Validation
- Has the agency identified fragile chokepoints in the pipeline?
- Has it validated whether failure of a key component causes silent loss or enterprise-wide blindness?
- Are mitigation or recovery steps documented?
### E.11 CHANGE MANAGEMENT AND REGRESSION VALIDATION
#### E.11.1 Controlled Change Validation
- Are source onboarding, parser changes, field mapping changes, and storage/pipeline changes introduced through governed processes?
- Are changes reviewed for downstream impact before rollout?
- Are rollback paths defined?
#### E.11.2 Regression Testing
- Does the agency perform regression testing for major changes affecting schema, ingestion, or operational content?
- Are representative monitoring, threat hunting, incident response, and retrieval use cases re-tested after change?
- Are failures or regressions surfaced to the right owners?
#### E.11.3 Post-Change Review
- After changes are deployed, does the agency validate that expected data is still present, timely, and usable?
- Are dashboards, detections, workflows, and retrieval paths checked for breakage?
- Is drift overtime reviewed rather than assumed away?
### E.12 EXERCISES, SYNTHETIC TESTS, AND READINESS DEMONSTRATIONS
#### E.12.1 Synthetic Event Validation
- Does the agency inject or generate representative events to confirm collection, parsing, and downstream handling?
- Are synthetic tests tied to expected source categories and investigative workflows?
- Are failed synthetic tests tracked to remediation?
#### E.12.2 Tabletop and Exercise Support Validation
- Do exercises and incident-response drills use the actual logging capability as part of validation?
- Are lessons learned from those exercises fed back into logging design and validation?
- Are exercises used to validate cross-team access and coordination, not just technical presence?
#### E.12.3 Replay and Historical Validation
- Can the agency use historical or replayed data to validate pipeline behavior and investigative usability?
- Are restoration and replay paths exercised often enough to remain trustworthy?
- Is there evidence or documentation that the agency possesses capabilities necessary to reconstruct prior time windows when needed?
### E.13 GAP TRACKING AND IMPROVEMENT VALIDATION
#### E.13.1 Known Gap Visibility
- Are known gaps in source coverage, fidelity, access, correlation, or retention documented explicitly?
- Are those gaps visible to both technical and governance stakeholders?
- Are high-impact gaps prioritized?
#### E.13.2 Remediation Tracking
- Does each known material gap have an owner, remediation path, and review cadence?
- Are unresolved dependencies or funding constraints documented?
- Is improvement progress tied to measurable outcomes rather than generic status statements?
#### E.13.3 Maturity Progress Validation
- Has the agency identified what maturity stage best describes its current logging capability?
- Are validation results being used to refine the maturity assessment over time?
- Is there evidence of movement toward the next stage?
### E.14 HIGH-LEVEL READINESS QUESTIONS
- Are the required baseline telemetry categories present across the intended environments?
- Is the data timely enough, complete enough, and detailed enough to support monitoring, threat hunting, incident response, and digital forensics?
- Can analysts and responders search, pivot, retrieve, and reconstruct activity using the datasets the plan says they depend on?
- Are integrity, provenance, access, minimization, and sharing controls working as intended?
- Can the agency detect when the logging capability is degraded and recover from that degradation?
- Can the agency introduce change without silently breaking critical operational use cases?
