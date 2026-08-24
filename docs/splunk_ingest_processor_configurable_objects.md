# Splunk Ingest Processor — Configurable Objects

## 1. Ingest Processor Instance

The top-level processing service or deployment.

* Processor name
* Description
* Status
* Deployment/tenant
* Region
* Environment
* Capacity / sizing
* Assigned pipelines
* Assigned sources
* Assigned destinations
* Service configuration
* Operational state

---

## 2. Incoming Dataset

The merged internal dataset created from received data before pipeline processing.

* Received data
* Merged dataset
* Processed data
* Unprocessed data
* Dataset classification
* Processing status
* Source context
* Pipeline membership

The processing model is:

```
Received data
     │
     ▼
Merged internal dataset
     │
     ├── Matches pipeline partition
     │       │
     │       ▼
     │   Processed data
     │       │
     │       ├── Retained after SPL2 processing ──► configured destination
     │       │
     │       └── Filtered out ────────────────────► dropped
     │
     └── Matches no pipeline partition
             │
             ▼
        Unprocessed data
             │
             ▼
        Default splunk_indexer destination
```

---

## 3. Data Sources

Objects defining where incoming data originates.

**Source identity**

* Source name
* Source type
* Description
* Vendor
* Product
* Technology
* Environment

**Connection properties**

* Endpoint
* Protocol
* Port
* Authentication
* Credentials / secret reference
* TLS configuration
* Certificate configuration

**Data characteristics**

* Source format
* Encoding
* Compression
* Event framing
* Timestamp characteristics
* Expected volume

Typical source categories include:

* HTTP / HEC-style sources
* Cloud services
* AWS sources
* Azure sources
* SaaS sources
* Forwarded telemetry
* Streaming/event sources
* API-originated data

---

## 4. Pipelines

The primary configurable processing object.

A pipeline defines how events are processed after they match a partition and before they are sent to a destination.

Typical properties:

* Pipeline name
* Description
* Enabled / disabled state
* Source association
* Partition association
* Destination association
* Processing rules
* Rule ordering
* Default handling
* Error handling
* Metrics / monitoring

Conceptually:

```
Merged Dataset → Partition → Pipeline → SPL2 Processing → Destination
```

---

## 5. Pipeline Partitions

A partition is a subset of the Ingest Processor's merged incoming dataset selected for processing by a pipeline.

Each applied pipeline creates its own partition using defined conditions. Only events matching those partition conditions enter that pipeline.

Configurable elements include:

* Partition name
* Partition description
* Parent pipeline
* Partition condition
* Source criteria
* Event criteria
* Field criteria
* Matching behaviour
* Enabled / disabled state
* Matching dataset
* Processing status

Partition membership determines whether data is processed or remains unprocessed:

* Partition condition matches → event enters the pipeline and becomes processed data.
* Partition condition does not match → event remains unprocessed.
* Unprocessed data is sent to the default `splunk_indexer` destination.
* A downstream SPL2 filter that removes an event does not make it unprocessed; it drops the event.

---

## 6. Partition Conditions

Conditions determining which events enter a pipeline partition.

Examples of configurable criteria:

* Field exists
* Field does not exist
* Field equals value
* Field does not equal value
* Field contains value
* Regex match
* Numeric comparison
* Boolean comparison
* Multiple-condition AND
* Multiple-condition OR
* Nested conditions
* Source criteria
* Event metadata criteria
* Parsed event fields

Fields might include:

* host
* source
* sourcetype
* index
* Vendor fields
* Parsed JSON fields
* Event attributes
* Metadata

Partition conditions should be modeled separately from downstream processing filters because they determine pipeline membership and processed/unprocessed classification.

---

## 7. Pipeline Rules

Individual rules controlling how events are processed after partition selection.

Configurable elements can include:

* Rule name
* Rule description
* Rule order
* Match criteria
* Conditional expression
* Action
* Destination
* Enabled / disabled state
* Continue processing behaviour
* Termination behaviour

Rules commonly implement:

* Filtering
* Routing
* Field transformation
* Masking
* Dropping
* Sampling
* Enrichment
* Metadata assignment

---

## 8. Match / Conditional Expressions

Conditions determining which events a rule applies to after they enter a pipeline.

Examples of configurable criteria:

* Field exists
* Field does not exist
* Field equals value
* Field does not equal value
* Field contains value
* Regex match
* Numeric comparison
* Boolean comparison
* Multiple-condition AND
* Multiple-condition OR
* Nested conditions

These conditions are distinct from partition conditions when they are evaluated after pipeline membership has already been established.

---

## 9. SPL2 Processing

SPL2 processing logic applied to events within a selected pipeline partition.

Configurable processing can include:

* Filter
* Transform
* Mask
* Route
* Drop
* Extract
* Enrich
* Normalize
* Metadata assignment
* Event restructuring

Processing outcomes include:

* Retained processed event
* Routed processed event
* Dropped event
* Processing error

---

## 10. Processing Functions

Operations applied to events within a pipeline.

**Filtering**

* Keep event
* Drop event
* Conditional filtering

**Field manipulation**

* Add field
* Remove field
* Rename field
* Replace field
* Copy field
* Set field value
* Extract field
* Convert field type

**String operations**

* Replace text
* Regex substitution
* Concatenate
* Split
* Trim
* Case conversion

**Structured-data processing**

* JSON field access
* JSON modification
* Nested field manipulation
* Array manipulation

**Event transformation**

* Rewrite event
* Restructure event
* Normalize fields
* Flatten structured data

---

## 11. Data Masking / Redaction Rules

Objects or pipeline operations protecting sensitive information.

Configurable attributes can include:

* Rule name
* Match expression
* Field
* Pattern
* Replacement value
* Masking method
* Conditional application

Examples:

* Password masking
* API key masking
* Token masking
* Email-address masking
* IP-address masking
* Account-number masking
* PII redaction

Example concept:

```
user=john password=Secret123
```

becomes:

```
user=john password=********
```

---

## 12. Routing Rules

Rules controlling where matching processed data is delivered.

Configurable elements:

* Match criteria
* Destination
* Alternative destination
* Multiple destinations
* Drop
* Route to Splunk
* Route to external storage
* Conditional routing

Example:

```
security telemetry → Splunk index
low-value telemetry → Amazon S3
```

Routing applies to data that has entered a pipeline partition. Data that matches no partition is not routed by pipeline rules; it is sent to the default `splunk_indexer` destination.

---

## 13. Destinations

Objects defining where processed data is sent.

Common destination classes include:

**Default destination**

* `splunk_indexer`
* Not user configurable
* Receives unprocessed data
* Points to Splunk Cloud Platform

**Splunk destination**

* Splunk Cloud
* Index
* Sourcetype
* Source
* Host
* Metadata

**Amazon S3**

* Bucket
* AWS account
* Region
* Prefix/path
* Authentication
* IAM role
* Encryption
* Object configuration

**Other supported destinations**

Depending on release and entitlement:

* Cloud object storage
* Splunk platform
* External processing/service destinations

---

## 14. Default splunk_indexer Destination

The default destination receives data that does not match any pipeline partition.

Properties:

* Destination name: `splunk_indexer`
* Destination type: Splunk Cloud Platform
* User configurable: No
* Applies to: Unprocessed data
* Pipeline-specific override: No
* Storage partition configuration: Not applicable

The distinction is:

```
No partition match
    → unprocessed data
    → default splunk_indexer destination
```

This is different from:

```
Partition match
    → processed data
    → SPL2 processing
    → configured destination or drop
```

---

## 15. Amazon S3 Destination Configuration

Particularly relevant when using Ingest Processor for data tiering or Federated Search.

Possible configurable properties:

* Destination name
* AWS account
* S3 bucket
* AWS region
* Bucket prefix
* IAM role
* Role ARN
* External ID
* Authentication method
* Object naming
* Compression
* File format
* Encryption
* KMS key
* Delivery behaviour

A useful storage taxonomy is:

```
Destination
→ AWS
→ S3
→ Bucket
→ Prefix
→ Object
```

The S3 storage hierarchy should not be confused with an Ingest Processor pipeline partition. An S3 prefix or storage partition describes object organization, whereas an Ingest Processor partition selects incoming events for pipeline processing.

---

## 16. Splunk Destination Metadata

Event metadata applied before sending processed data to Splunk.

Configurable metadata can include:

* Index
* Sourcetype
* Source
* Host

For example:

```
index = windows
sourcetype = XmlWinEventLog:Security
source = WinEventLog:Security
host = dc01
```

These values can potentially be assigned dynamically from event content.

---

## 17. Index Routing

Rules determining the destination index.

Configuration can include:

* Static index
* Conditional index
* Index derived from fields
* Default index
* Fallback index

Example:

```
if source_type == "firewall"
    index = network
if source_type == "windows"
    index = windows
```

---

## 18. Sourcetype Assignment

Controls classification of incoming telemetry.

Configurable options can include:

* Static sourcetype
* Conditional sourcetype
* Sourcetype derived from event fields
* Source-specific sourcetype

Examples:

* `aws:cloudtrail`
* `XmlWinEventLog:Security`
* `linux:audit`
* `fortigate:traffic`

---

## 19. Host Assignment

Host metadata can be derived or overridden.

Possible configuration:

* Static hostname
* Field-derived hostname
* Original source hostname
* Cloud resource identifier
* Device identifier

---

## 20. Source Assignment

Controls the Splunk source metadata field.

Possible configurations:

* Static source
* Source derived from event
* Source derived from service
* Source derived from path
* Source derived from cloud resource

---

## 21. Field Extraction

Processing rules can derive fields from incoming events.

Methods can include:

* Structured field access
* JSON extraction
* Regex extraction
* String parsing
* Delimiter-based extraction

Configuration typically includes:

* Source field
* Extraction pattern
* Target field
* Data type
* Failure behaviour

---

## 22. Field Enrichment

Adds context to telemetry before delivery.

Examples:

* Environment
* Business unit
* Application
* System
* Asset class
* Security zone
* Cloud account
* Tenant
* Data owner
* Classification

Example:

```
environment = production
business_unit = finance
security_zone = protected
```

---

## 23. Event Filtering

Controls whether telemetry continues through the pipeline after partition selection.

Possible policies:

* Allow
* Drop
* Include
* Exclude
* Conditional retain

Typical filtering criteria:

* Event type
* Severity
* Source
* Host
* Message
* Field value
* Event ID

Example:

```
Windows EventCode 5156 → drop
```

while:

```
Windows EventCode 4624 → retain
```

A filtering decision after partition selection has a different result from a failed partition condition:

* Failed partition condition → unprocessed data → default `splunk_indexer`.
* Filtered after partition selection → dropped data.

---

## 24. Sampling Rules

Where supported, data can be reduced by sampling.

Configuration concepts:

* Sampling rate
* Matching criteria
* Event category
* Keep percentage
* Drop percentage

Useful for very high-volume, low-value telemetry.

---

## 25. Event Transformation Rules

Rules modifying the structure of events.

Possible operations:

* Reformat event
* Rename fields
* Normalize field names
* Create new fields
* Remove fields
* Restructure JSON
* Flatten JSON
* Convert value types
* Replace values

---

## 26. Metadata Transformation

Separate from `_raw`, metadata can be changed.

Important metadata objects include:

* index
* host
* source
* sourcetype
* Timestamp-related attributes

---

## 27. Timestamp Handling

Depending on source and pipeline capabilities:

* Timestamp field selection
* Timestamp normalization
* Timestamp conversion
* Epoch conversion
* Timezone normalization
* Timestamp preservation

Operationally important fields include:

* Event time
* Receive time
* Processing time
* Delivery time

---

## 28. Schema / Field Mapping

Configuration translating source-native schemas into normalized fields.

Example:

```
src_ip_address → src_ip
destinationAddress → dest_ip
username → user
deviceHostname → host
```

This can support:

* CIM alignment
* Common naming
* Cross-source normalization
* Detection engineering

---

## 29. Authentication Objects

Connections to external systems can require authentication configuration.

Possible objects:

* IAM role
* Access role
* Credential
* Secret
* Token
* Certificate
* Service identity

Avoid treating the credential value itself as a normal pipeline configuration property; preferably reference a protected secret object.

---

## 30. AWS IAM Configuration

For S3 integration this can include:

* AWS account ID
* IAM role ARN
* External ID
* Trust relationship
* S3 permissions
* KMS permissions
* Bucket permissions

---

## 31. TLS / Certificate Configuration

Where supported by the connection type:

* TLS enabled
* Certificate
* Certificate authority
* Certificate validation
* Mutual TLS
* Server name validation

---

## 32. Encryption Configuration

For destination storage or transport:

**In transit**

* TLS

**At rest**

* S3 server-side encryption
* AWS KMS
* KMS key

---

## 33. Pipeline Ordering

Pipeline evaluation behaviour is itself an important configurable property.

Consider:

* Partition evaluation order
* Rule priority
* Rule ordering
* First-match behaviour
* Multiple-match behaviour
* Continue processing
* Terminate processing
* Default action

This is important because two valid rules can produce very different results depending on execution order.

---

## 34. Default / Fallback Behaviour

Configuration should explicitly account for events that do not match a pipeline partition or downstream processing rule.

Possible behaviours include:

**No partition match**

* Classify as unprocessed
* Send to default `splunk_indexer` destination

**Partition match but no downstream rule match**

* Retain
* Send to configured pipeline destination
* Send to default pipeline destination
* Drop
* Quarantine/error destination

**Processing rule match**

* Continue processing
* Route
* Drop
* Terminate processing

---

## 35. Error Handling

Relevant configurable or operational behaviours include:

* Invalid event handling
* Transformation failure
* Destination failure
* Authentication failure
* Unsupported event
* Malformed JSON
* Missing field
* Oversized event
* Partition evaluation failure
* SPL2 processing failure
* Delivery retry behaviour
* Error destination

---

## 36. Pipeline Version

Pipelines should be treated as versioned configuration objects.

Useful attributes:

* Pipeline ID
* Version
* Created time
* Modified time
* Created by
* Modified by
* Active version
* Previous version

---

## 37. Pipeline Deployment / Publication State

A pipeline may have lifecycle states such as:

* Draft
* Validated
* Published
* Active
* Disabled
* Failed

This is useful to track separately from the pipeline definition itself.

---

## 38. Pipeline Associations

Relationship objects are important for configuration management.

Examples:

```
Source → Pipeline
Pipeline → Partition
Partition → Matching Dataset
Pipeline → Destination
Rule → Function
Rule → Destination
Destination → S3 bucket
Destination → Splunk index
Unprocessed Data → Default splunk_indexer
```

---

## Recommended Configuration Taxonomy

For a Splunk configuration catalogue, I would model Ingest Processor as:

```
Splunk Ingest Processor
│
├── Processor
│   ├── Instance
│   ├── Region
│   ├── Status
│   └── Capacity
│
├── Dataset
│   ├── Incoming Dataset
│   ├── Merged Dataset
│   ├── Processed Data
│   └── Unprocessed Data
│
├── Source
│   ├── Source Definition
│   ├── Connection
│   ├── Authentication
│   └── TLS
│
├── Pipeline
│   ├── Pipeline Definition
│   ├── Partition
│   │   ├── Partition Definition
│   │   ├── Partition Condition
│   │   └── Matching Dataset
│   ├── Pipeline Version
│   ├── Pipeline State
│   └── Pipeline Association
│
├── Rule
│   ├── Match Condition
│   ├── Priority
│   ├── Processing Function
│   └── Action
│
├── Processing
│   ├── SPL2
│   ├── Filter
│   ├── Drop
│   ├── Route
│   ├── Mask
│   ├── Extract
│   ├── Transform
│   ├── Enrich
│   └── Normalize
│
├── Metadata
│   ├── Index
│   ├── Sourcetype
│   ├── Source
│   ├── Host
│   └── Timestamp
│
├── Destination
│   ├── Default splunk_indexer
│   ├── Splunk
│   ├── Amazon S3
│   └── Other Supported Destination
│
├── AWS
│   ├── Account
│   ├── IAM Role
│   ├── S3 Bucket
│   ├── Prefix
│   ├── Region
│   └── KMS Key
│
├── Security
│   ├── Credential
│   ├── Secret
│   ├── Certificate
│   ├── TLS
│   ├── Encryption
│   └── IAM
│
└── Operations
    ├── Health
    ├── Throughput
    ├── Received Data
    ├── Processed Data
    ├── Unprocessed Data
    ├── Errors
    ├── Dropped Events
    ├── Routed Events
    ├── Processing Latency
    └── Destination Delivery
```

### Core Configuration Objects

For a CMDB/configuration register, I would treat these as the primary configurable objects:

| Object | Object Type |
|---|---|
| Ingest Processor | Service |
| Incoming Dataset | Data Classification |
| Processed Data | Data Classification |
| Unprocessed Data | Data Classification |
| Source | Input |
| Source Connection | Connection |
| Pipeline | Processing |
| Pipeline Partition | Processing Scope |
| Partition Condition | Conditional Logic |
| Pipeline Version | Configuration Version |
| Pipeline Rule | Processing Rule |
| Match Condition | Conditional Logic |
| Processing Function | Transformation |
| SPL2 Processing | Processing |
| Filter | Processing Rule |
| Drop Rule | Processing Rule |
| Routing Rule | Processing Rule |
| Masking Rule | Security / Transformation |
| Field Transformation | Transformation |
| Field Extraction | Transformation |
| Field Enrichment | Transformation |
| Metadata Assignment | Metadata |
| Index Assignment | Metadata |
| Sourcetype Assignment | Metadata |
| Source Assignment | Metadata |
| Host Assignment | Metadata |
| Destination | Output |
| Default splunk_indexer Destination | Output |
| Splunk Destination | Output |
| S3 Destination | Output |
| S3 Bucket | Storage |
| S3 Prefix | Storage |
| AWS IAM Role | Identity / Access |
| KMS Key | Encryption |
| Credential / Secret | Security |
| Certificate | Security |
| Pipeline Association | Relationship |
| Source-to-Pipeline Association | Relationship |
| Pipeline-to-Partition Association | Relationship |
| Partition-to-Dataset Association | Relationship |
| Pipeline-to-Destination Association | Relationship |
| Unprocessed-to-Default-Destination Association | Relationship |
