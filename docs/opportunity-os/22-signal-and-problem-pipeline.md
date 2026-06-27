# 22 — Signal Object and Problem Inference Pipeline

**Status:** Phase 2.0 · Design document (planning active)  
**Related:** [Ontology](./02-ontology.md) · [Knowledge Graph](./03-knowledge-graph.md) · [Decision Engine](./06-decision-engine.md) · [Architecture Rules](./07-architecture-rules.md) · [Ontology Convergence Plan](./21-ontology-convergence-plan.md) · [State Machines](./04-state-machines.md) · [Data Model](./14-data-model.md) · [Performance — AI Tiers](./18-performance.md)

---

## Purpose

Define the **canonical Signal object**, the **Problem object**, and the **pipeline** that turns world events into problems and opportunities — without violating the Constitution.

This document is the blueprint for Phase 2 implementation. **No connectors, crawlers, or autonomous agents are authorized by this document alone.** Implementation begins only after owner approval and Phase 2.0 design review.

---

## Constitutional Alignment

| Principle | How this document honors it |
|---|---|
| **R1 — Engine is truth** | Signals and problems are written by engine modules (`src/engine/signals/`, future `src/engine/problems/`). UI and reports are projections. |
| **R12 — Problems are universal** | Problem types are capability-aligned, not industry-siloed. |
| **R14 — One signal, many opportunities** | Pipeline explicitly fans out at Problem → Capability → Offer. |
| **R15 — Evidence before AI** | Tiered processing: rules first, AI only on filtered high-value signals. |
| **R25 — Amend before new objects** | This document amends operational detail for Signal and Problem; canonical objects already exist in [02-ontology.md](./02-ontology.md). |

### Field name convergence (02 / 14 ↔ 22)

| Constitution (02, 14) | Phase 2.0 canonical (this doc) | Notes |
|---|---|---|
| `sourceId` | `source` | Connector or manual ingest identifier |
| `contentHash` | `hash` | SHA-256 of normalized payload |
| `rawRef` | `rawTextRef` | Pointer to immutable raw capture |
| `status` (state machine) | `processingState` | Expanded lifecycle for pipeline observability |
| `category` (Problem) | `problemType` | Same semantic; `problemType` is pipeline-facing name |

Implementations must accept both during migration. Graph Writer normalizes to Phase 2.0 names.

---

## 1. Signal Object Schema

A **Signal** is an immutable observation that the world changed. Signals are append-only; corrections arrive as new signals with `provenance.supersedes`.

### Required fields

| Field | Type | Description |
|---|---|---|
| `id` | string | Stable ID: `sig_{ulid}` |
| `source` | string | Connector or ingest channel ID (e.g. `manual_csv`, `permits_harris_tx`, `crm_outcome_webhook`) |
| `sourceType` | enum | Trust/legal class — see [Connector registry](./17-security.md) (future) |
| `observedAt` | ISO8601 | When the event occurred in the world |
| `capturedAt` | ISO8601 | When the OS stored the signal |
| `location` | object | Human-readable place: `{ city, county, state, country, address?, facilityName? }` |
| `geo` | object | Machine geo: `{ lat?, lng?, region?, metro?, h3? }` |
| `entitiesMentioned` | array | Raw mentions before resolution: `[{ name, type?, role? }]` |
| `headline` | string | One-line human summary (may be rule-generated) |
| `summary` | string | Short normalized description (≤500 chars) |
| `rawTextRef` | string | URI/path to immutable raw payload (HTML, JSON, PDF, email) |
| `url` | string \| null | Canonical public URL if applicable |
| `evidence` | array | Structured evidence snippets: `[{ type, text, field?, confidence }]` |
| `confidence` | number | 0–1 overall signal quality after normalization |
| `freshness` | object | `{ ageHours, decayScore, staleAfter }` — feeds Timing engine |
| `signalType` | enum | Canonical type — see §2 |
| `urgency` | enum | `low` \| `medium` \| `high` \| `critical` |
| `affectedMarkets` | string[] | Market IDs from `engine-data/markets/` |
| `affectedCapabilities` | string[] | Capability IDs hypothesized (pre–problem inference) |
| `possibleProblems` | string[] | Problem type hypotheses (pre–full inference) |
| `possibleOpportunities` | string[] | Opportunity IDs if already materialized (usually empty until late pipeline) |
| `processingState` | enum | Pipeline state — see §3 |
| `provenance` | object | `{ connectorVersion, extractorVersion?, ingestJobId?, supersedes?, parentSignalId? }` |
| `hash` | string | `sha256:` content hash of normalized canonical payload |
| `dedupKey` | string | Business key for near-exact dedup (source + type + key fields) |
| `riskFlags` | string[] | Legal, PII, spam, retraction, low-trust source markers |

### Optional fields (recommended)

| Field | Type | Description |
|---|---|---|
| `language` | string | ISO 639-1 |
| `tags` | string[] | Non-primary labels (industry tags allowed here, not as join keys) |
| `relatedSignalIds` | string[] | Cluster / `PRECEDES` hints |
| `factIds` | string[] | Facts extracted from this signal (Phase 2+) |
| `entityIds` | string[] | Resolved entity IDs after linking |
| `problemIds` | string[] | Problems inferred from this signal |
| `metadata` | object | Connector-specific passthrough (never used for scoring without promotion to evidence) |

### Example (minimal valid)

```json
{
  "id": "sig_01JXYZ",
  "source": "permits_harris_tx",
  "sourceType": "government_feed",
  "observedAt": "2026-06-20T09:00:00Z",
  "capturedAt": "2026-06-23T14:22:00Z",
  "location": { "city": "Houston", "county": "Harris", "state": "TX", "country": "US" },
  "geo": { "region": "US-TX-GULF", "lat": 29.76, "lng": -95.36 },
  "entitiesMentioned": [{ "name": "Memorial Hermann", "type": "company" }],
  "headline": "Hospital expansion permit filed — 120 beds",
  "summary": "Certificate of need filing for 120-bed east campus expansion, construction start Q3 2027.",
  "rawTextRef": "engine-data/signals/raw/2026/06/23/sig_01JXYZ.json",
  "url": "https://example.gov/permits/88291",
  "evidence": [
    { "type": "field", "text": "beds: 120", "field": "capacity", "confidence": 0.95 },
    { "type": "field", "text": "project_type: hospital_expansion", "confidence": 0.9 }
  ],
  "confidence": 0.88,
  "freshness": { "ageHours": 78, "decayScore": 0.82, "staleAfter": "2026-09-01T00:00:00Z" },
  "signalType": "permit",
  "urgency": "medium",
  "affectedMarkets": ["healthcare-gulf-coast", "commercial-construction"],
  "affectedCapabilities": ["ktm_labor", "fire_watch"],
  "possibleProblems": ["construction_activity", "labor_shortage", "safety_coverage_gap"],
  "possibleOpportunities": [],
  "processingState": "classified",
  "provenance": { "connectorVersion": "permits_v0.1.0", "ingestJobId": "job_442" },
  "hash": "sha256:abc123...",
  "dedupKey": "permits_harris_tx|permit|88291",
  "riskFlags": []
}
```

### Validation rules

1. `id`, `source`, `sourceType`, `observedAt`, `capturedAt`, `headline`, `rawTextRef`, `hash`, `dedupKey`, `signalType`, `processingState` are required on write.
2. `hash` must be unique per `(source, normalized payload)` — duplicates transition to `deduped` / `rejected`, not overwrite.
3. `observedAt` ≤ `capturedAt` (clock skew tolerance: 5 minutes).
4. Signals are **never deleted** — only `archived` or `rejected` with reason in `riskFlags` or provenance.
5. `possibleOpportunities` populated only after `opportunity_generated` state.

**Storage (Phase 2.0 target):** `engine-data/signals/` (JSON event log + index) until Graph Writer / OLTP decision is made. See [21-ontology-convergence-plan.md](./21-ontology-convergence-plan.md).

---

## 2. Signal Types

Canonical `signalType` enum. Connectors map source-specific types to this list.

| signalType | Typical sources | Primary problem hints |
|---|---|---|
| `permit` | Building permits, CON filings, zoning | `construction_activity`, `facility_expansion`, `compliance_requirement` |
| `rfp` | Government RFP, procurement portals | `procurement_window`, `vendor_replacement`, `capital_project_support` |
| `bid_award` | Bid tabulations, award notices | `vendor_replacement`, `construction_activity` |
| `hiring_spike` | Job boards, LinkedIn aggregates | `labor_shortage`, `staffing_surge`, `operational_delay` |
| `expansion` | Press, earnings, real estate | `facility_expansion`, `construction_activity`, `cleaning_or_restoration_need` |
| `shutdown` | Plant shutdown notices, maintenance windows | `maintenance_demand`, `safety_coverage_gap`, `staffing_surge` |
| `turnaround` | Refinery/chemical turnaround calendars | `labor_shortage`, `safety_coverage_gap`, `maintenance_demand` |
| `funding` | Grants, bonds passed, capital raises | `capital_project_support`, `construction_activity`, `facility_expansion` |
| `acquisition` | M&A announcements | `vendor_replacement`, `operational_delay`, `marketing_visibility_gap` |
| `weather_event` | NWS, hurricane tracks, flood warnings | `emergency_response_need`, `cleaning_or_restoration_need`, `maintenance_demand` |
| `government_agenda` | Council agendas, commission meetings | `procurement_window`, `compliance_requirement`, `capital_project_support` |
| `public_budget` | Budget adoptions, bond programs | `capital_project_support`, `construction_activity`, `procurement_window` |
| `contract_award` | Awarded contracts, task orders | `vendor_replacement`, `maintenance_demand`, `recurring service implied` |
| `regulatory_change` | OSHA, EPA, licensing rule changes | `compliance_requirement`, `safety_coverage_gap` |
| `company_news` | Press releases, local news | `expansion`, `operational_delay`, `marketing_visibility_gap` |
| `social_signal` | Social mentions (low trust default) | Requires corroboration — rarely direct problem inference |
| `crm_event` | Outcome webhooks, meeting notes, loss reasons | `lead_generation_gap`, `vendor_replacement`, relationship signals |

**Rule:** `social_signal` defaults to `confidence` cap 0.5 until corroborated by a second signal type.

---

## 3. Signal Lifecycle

`processingState` drives observability and idempotent pipeline stages. Maps to [04-state-machines.md](./04-state-machines.md#signal) as:

| processingState (22) | State machine (04) |
|---|---|
| `captured` | Observed |
| `normalized`, `deduped`, `classified` | Validated → Normalized |
| `entity_linked` | Linked (partial) |
| `problem_inferred`, `opportunity_generated` | Linked (downstream) |
| `archived` | Archived |
| `rejected` | Archived (with rejection reason) |

### State definitions

#### `captured`

| | |
|---|---|
| **Entry** | Raw payload stored; minimal record created by connector or manual ingest |
| **Exit** | Schema validation passes; `hash` and `dedupKey` computed |
| **Owner** | Ingestion service / connector adapter |
| **Failure modes** | Missing raw capture; invalid timestamp; untrusted source; payload too large |

#### `normalized`

| | |
|---|---|
| **Entry** | Canonical fields mapped (`headline`, `summary`, `location`, `geo`, `observedAt`) |
| **Exit** | Required fields populated; encoding and PII flags applied |
| **Owner** | Signal normalizer (`src/engine/signals/normalize.js` — future) |
| **Failure modes** | Unparseable geo; empty headline; charset errors; PII in forbidden fields |

#### `deduped`

| | |
|---|---|
| **Entry** | Exact hash match OR `dedupKey` collision detected |
| **Exit** | Linked to canonical signal ID OR promoted if near-dup review passes |
| **Owner** | Dedup engine |
| **Failure modes** | False positive merge; missed near-duplicate flood; index corruption |

#### `classified`

| | |
|---|---|
| **Entry** | `signalType`, `urgency`, `affectedMarkets`, initial `possibleProblems` assigned |
| **Exit** | Classification confidence ≥ tier threshold OR escalated to human/LLM |
| **Owner** | Classifier (rules → embeddings → LLM tier) |
| **Failure modes** | Wrong type → bad problem fan-out; over-classification to `company_news` |

#### `entity_linked`

| | |
|---|---|
| **Entry** | `entitiesMentioned` resolved to Entity IDs (`data/businesses.json` / graph) |
| **Exit** | ≥1 entity linked OR explicitly marked unresolved with reason |
| **Owner** | Entity resolver |
| **Failure modes** | Wrong company merge; orphan entities; duplicate graph nodes |

#### `problem_inferred`

| | |
|---|---|
| **Entry** | One or more Problem objects created/updated from signal + facts |
| **Exit** | `problemIds[]` populated; problems reach `hypothesized` or `validated` |
| **Owner** | Problem inference engine (Phase 2.5 / 3 boundary) |
| **Failure modes** | Over-inference; missed fan-out; stale problems not closed |

#### `opportunity_generated`

| | |
|---|---|
| **Entry** | Opportunity factory consumes problems + capabilities + offers |
| **Exit** | `possibleOpportunities[]` populated; Score Council run |
| **Owner** | Opportunity factory + Score Council |
| **Failure modes** | Industry×offer fallback without problem link; duplicate opportunities |

#### `archived`

| | |
|---|---|
| **Entry** | TTL expired; superseded; legal retraction; pipeline complete and stale |
| **Exit** | Terminal (retained for audit and learning) |
| **Owner** | Archival job / human |
| **Failure modes** | Premature archive before opportunity linkage |

#### `rejected`

| | |
|---|---|
| **Entry** | Spam, duplicate, legal block, untrusted source, failed validation |
| **Exit** | Terminal; must not enter problem or opportunity pipeline |
| **Owner** | Ingestion policy / human review queue |
| **Failure modes** | False reject of high-value signal; silent drop without audit |

### Invalid transitions (bugs)

- `rejected` → any active state (except manual override with provenance)
- `opportunity_generated` → `captured` (must create new signal)
- Skip `deduped` check before `classified` for automated high-volume sources

---

## 4. Problem Object Schema

A **Problem** is an expensive emerging need — the primary unit of thinking. Problems are hypotheses until validated by facts and outcomes.

### Required fields

| Field | Type | Description |
|---|---|---|
| `id` | string | `prob_{ulid}` |
| `problemType` | enum | Canonical type — see §5 |
| `description` | string | Human-readable problem statement |
| `affectedEntityIds` | string[] | Companies, facilities, projects affected |
| `relatedSignalIds` | string[] | Signals that support this problem |
| `severity` | number | 0–1 economic/pain severity |
| `urgency` | enum | `low` \| `medium` \| `high` \| `critical` |
| `estimatedEconomicImpact` | object | `{ low, high, currency, basis }` — directional |
| `timeHorizon` | string | ISO date, quarter (`2027-Q3`), or window (`30d`, `6mo`) |
| `location` | object | Same shape as Signal.location |
| `confidence` | number | 0–1 evidence strength for this problem hypothesis |
| `evidence` | array | Citations: `[{ type: "signal"\|"fact"\|"database", ref, claim }]` |
| `assumptions` | string[] | Explicit directional claims |
| `capabilityMatches` | array | `[{ capabilityId, fitScore, reasons[] }]` |
| `opportunityPotential` | object | `{ estimatedCount, topOfferIds[], notes }` |
| `status` | enum | `hypothesized` \| `validated` \| `active` \| `resolved` \| `archived` |

### Optional fields

| Field | Type | Description |
|---|---|---|
| `factIds` | string[] | Structured facts (Phase 2+) |
| `tags` | string[] | Industry/facility tags — not primary keys |
| `resolvedAt` | ISO8601 | When problem no longer relevant |
| `supersedes` | string | Prior problem ID if refined |

### Example

```json
{
  "id": "prob_01JABC",
  "problemType": "safety_coverage_gap",
  "description": "Fire watch required during hospital expansion hot-work phase",
  "affectedEntityIds": ["biz_memorial_hermann_east"],
  "relatedSignalIds": ["sig_01JXYZ"],
  "severity": 0.75,
  "urgency": "high",
  "estimatedEconomicImpact": {
    "low": 50000,
    "high": 500000,
    "currency": "USD",
    "basis": "Comparable fire watch contracts on Gulf Coast healthcare construction"
  },
  "timeHorizon": "2027-Q2",
  "location": { "city": "Houston", "state": "TX", "country": "US" },
  "confidence": 0.72,
  "evidence": [
    { "type": "signal", "ref": "sig_01JXYZ", "claim": "Hospital expansion permit with construction start Q3 2027" }
  ],
  "assumptions": ["Hot work will require NFPA-compliant fire watch during construction"],
  "capabilityMatches": [
    { "capabilityId": "fire_watch", "fitScore": 0.9, "reasons": ["hot_work_compliance in registry"] },
    { "capabilityId": "ktm_labor", "fitScore": 0.7, "reasons": ["construction_activity co-occurring"] }
  ],
  "opportunityPotential": {
    "estimatedCount": 2,
    "topOfferIds": ["offer_fire_watch", "offer_ktm_manpower"],
    "notes": "Fan-out expected across safety and labor offers"
  },
  "status": "hypothesized"
}
```

**Storage (Phase 2.0 target):** `engine-data/problems/` (JSON) until graph store decision. Problems are **not** schema entities in Phase 2.0 — see [21-ontology-convergence-plan.md](./21-ontology-convergence-plan.md).

---

## 5. Problem Types

Canonical `problemType` enum. Maps to `problemsSolved[]` in `engine-data/capabilities/capabilities.json`.

| problemType | Meaning | Typical capability matches |
|---|---|---|
| `labor_shortage` | Cannot staff jobs or shifts | `ktm_labor`, `safety_support` |
| `safety_coverage_gap` | Missing fire watch, hole watch, HSE coverage | `fire_watch`, `hole_watch`, `safety_support` |
| `maintenance_demand` | Deferred maintenance, reliability risk | `maintenance_support`, `exterior_cleaning` |
| `compliance_requirement` | Regulatory, insurance, audit-driven need | `fire_watch`, `safety_support`, `exterior_cleaning` |
| `construction_activity` | Active or imminent construction | `ktm_labor`, `fire_watch`, `exterior_cleaning` |
| `facility_expansion` | New capacity, buildings, campuses | `ktm_labor`, `maintenance_support`, `website_growth` |
| `cleaning_or_restoration_need` | Appearance, post-event, pre-opening cleaning | `exterior_cleaning`, `maintenance_support` |
| `marketing_visibility_gap` | Weak digital presence, lost inbound | `website_growth`, `lead_generation` |
| `lead_generation_gap` | Empty or low-quality pipeline | `lead_generation`, `website_growth` |
| `emergency_response_need` | Weather, outage, incident response | `exterior_cleaning`, `ktm_labor`, `maintenance_support` |
| `staffing_surge` | Temporary workforce spike | `ktm_labor`, `safety_support` |
| `vendor_replacement` | Incumbent failure, contract end, dissatisfaction | `maintenance_support`, `exterior_cleaning`, `ktm_labor` |
| `procurement_window` | RFP, bid, budget cycle open | All offers — match by scope |
| `capital_project_support` | Bond, grant, major capex program | `ktm_labor`, `maintenance_support`, `ai_automation` |
| `operational_delay` | Schedule slip, downtime, backlog | `ktm_labor`, `maintenance_support`, `ai_automation` |

**Matching rule:** Capability match uses registry `problemsSolved[]` first (deterministic), then embedding similarity above threshold (Phase 2.5+), never LLM-only match.

---

## 6. Inference Pipeline

End-to-end flow from world event to Mission Control projection.

```
┌─────────┐    ┌───────────┐    ┌────────────┐    ┌───────────┐    ┌──────────────┐
│ Reality │───►│  Capture  │───►│ Normalize  │───►│ Deduplicate│───►│  Classify    │
└─────────┘    └───────────┘    └────────────┘    └───────────┘    └──────────────┘
                     │                                                    │
                     ▼                                                    ▼
              rawTextRef stored                              signalType, urgency,
              hash, dedupKey                                 affectedMarkets
                     │                                                    │
                     ▼                                                    ▼
              ┌──────────────┐    ┌────────────────┐    ┌─────────────────────┐
              │ Link Entities│───►│ Infer Problems │───►│ Match Capabilities  │
              └──────────────┘    └────────────────┘    └─────────────────────┘
                     │                    │                        │
                     ▼                    ▼                        ▼
              entityIds[]           problem objects          capabilityMatches[]
                     │                    │                        │
                     └────────────────────┼────────────────────────┘
                                          ▼
                              ┌───────────────────────┐
                              │ Generate Opportunities │
                              │ (problem + offer +     │
                              │  buyer entity)         │
                              └───────────────────────┘
                                          │
                                          ▼
                              ┌───────────────────────┐
                              │     Score Council      │
                              │  (12 engines + modes)  │
                              └───────────────────────┘
                                          │
                                          ▼
                              ┌───────────────────────┐
                              │   Mission Control      │
                              │  buildMissionControl() │
                              └───────────────────────┘
```

### Stage ownership

| Stage | Module (future) | Input | Output | Mutates |
|---|---|---|---|---|
| Capture | Connector / manual ingest | HTTP, file, webhook | Signal `captured` | Signal store append |
| Normalize | `src/engine/signals/normalize` | Raw payload | Signal `normalized` | Signal fields |
| Deduplicate | `src/engine/signals/dedup` | Normalized signal | `deduped` or continue | Dedup index |
| Classify | `src/engine/signals/classify` | Signal | `classified` | signalType, urgency, markets |
| Link Entities | `src/engine/entities/resolve` | Signal + DB | `entity_linked` | entityIds, graph edges |
| Infer Problems | `src/engine/problems/infer` | Signal + entities + facts | `problem_inferred` | Problem store |
| Match Capabilities | `src/engine/capabilities/match` | Problem | capabilityMatches | Problem update |
| Generate Opportunities | `src/engine/opportunities/` (evolve) | Problems + offers + entities | Opportunity candidates | Opportunity runtime |
| Score Council | `src/engine/score-council/` | Opportunity | scoreVector | Opportunity enrichment |
| Mission Control | `src/engine/mission-control/` | Radar + mission | Executive projection | None (read-only) |

### Event spine (target)

Publish events per [15-api-boundaries.md](./15-api-boundaries.md):

| Event | When |
|---|---|
| `signal.observed` | After capture |
| `signal.normalized` | After normalize |
| `signal.deduped` | Duplicate detected |
| `signal.classified` | Type assigned |
| `entity.linked` | Resolution complete |
| `problem.inferred` | Problem created/updated |
| `opportunity.detected` | Factory output |
| `opportunity.scored` | Score Council complete |

**Rule:** Mission Control never subscribes to raw connectors — only to scored opportunities and evidence bundles.

### Coexistence with transitional factory

Until Phase 3 completes problem-centric factory:

- **Database-sourced opportunities** (industry×offer) continue from `src/engine/opportunities/`.
- **Signal-sourced opportunities** attach `problemId` and `relatedSignalIds[]`.
- Radar merges both sources; evidence assembler cites source path (`database` vs `signal`).

---

## 7. Multi-Opportunity Fanout

One signal MUST be able to produce multiple problems, each mapping to multiple capabilities and offers. Examples use current capability registry IDs.

### Hospital expansion

```
Signal: permit (120-bed CON filing, Memorial Hermann East)
  │
  ├── Problem: construction_activity
  │     ├── Capability: ktm_labor → Offer: offer_ktm_manpower → Opportunity A
  │     └── Capability: fire_watch → Offer: offer_fire_watch → Opportunity B
  │
  ├── Problem: safety_coverage_gap
  │     └── Capability: fire_watch, hole_watch → Offer: offer_fire_watch → Opportunity C
  │
  └── Problem: cleaning_or_restoration_need
        └── Capability: exterior_cleaning → Offer: offer_pw_commercial → Opportunity D
```

### School bond

```
Signal: public_budget (Bond passed — $180M facilities package)
  │
  ├── Problem: capital_project_support
  │     └── Capability: ktm_labor, maintenance_support → multiple GC opportunities
  │
  ├── Problem: procurement_window
  │     └── Capability: maintenance_support → RFP-tracked opportunities
  │
  └── Problem: marketing_visibility_gap
        └── Capability: website_growth → Offer: offer_website_growth → Opportunity E
              (district wants public transparency / contractor prequal portal)
```

### Warehouse opening

```
Signal: expansion (500k sqft distribution center, Port of Houston)
  │
  ├── Problem: facility_expansion
  │     └── Capability: ktm_labor → staffing for ramp
  │
  ├── Problem: cleaning_or_restoration_need
  │     └── Capability: exterior_cleaning → pad / dock cleaning
  │
  └── Problem: lead_generation_gap
        └── Capability: lead_generation → internal meta (if operator is prospect)
```

### Hurricane forecast

```
Signal: weather_event (Cat 3 landfall forecast — SE Texas, 72h)
  │
  ├── Problem: emergency_response_need
  │     ├── Capability: exterior_cleaning → post-storm restoration
  │     └── Capability: ktm_labor → emergency staffing
  │
  ├── Problem: maintenance_demand
  │     └── Capability: maintenance_support → facility recovery
  │
  └── Problem: safety_coverage_gap
        └── Capability: fire_watch, safety_support → industrial restart coverage
```

### Refinery turnaround

```
Signal: turnaround (Q1 2027 TA — major Gulf Coast refinery)
  │
  ├── Problem: labor_shortage
  │     └── Capability: ktm_labor → Offer: offer_ktm_manpower
  │
  ├── Problem: safety_coverage_gap
  │     ├── Capability: fire_watch
  │     └── Capability: hole_watch
  │
  └── Problem: operational_delay
        └── Capability: ai_automation → planning/back-office acceleration (lower priority)
```

### City infrastructure project

```
Signal: rfp (Municipal water treatment plant upgrade — $40M)
  │
  ├── Problem: procurement_window
  │     └── Track bid timeline across prime + subs
  │
  ├── Problem: construction_activity
  │     └── Capability: ktm_labor, fire_watch
  │
  └── Problem: compliance_requirement
        └── Capability: safety_support → OSHA-heavy civil/industrial scope
```

**Fan-out guardrails:**

1. Cap automatic fan-out at **8 problems per signal** without human review.
2. Cap automatic opportunities at **12 per signal**; overflow → review queue.
3. Each opportunity must cite ≥1 `relatedSignalIds` entry in evidence.

---

## 8. Cost and AI Rules

Aligned with [18-performance.md](./18-performance.md) and **R15 — Evidence before AI**.

### Processing tier assignment

| Tier | Technology | Use for | Target share of ingest |
|---|---|---|---|
| **T0 — Rules** | Regex, calendars, source mappings, hash dedup, field parsers | Permits, budgets, structured feeds, CRM webhooks, dedup, classification of known shapes | **60–80%** |
| **T1 — Embeddings** | Local or API embeddings for near-dup and capability/problem similarity | Near-duplicate news clusters; capability match refinement; entity fuzzy match | **15–30%** |
| **T2 — Local models** | Small classifiers (signal type, urgency) on-prem or edge | High-volume unstructured headlines when rules fail | **5–10%** |
| **T3 — LLM** | Frontier model extraction / reasoning | Ambiguous multi-entity narratives; complex RFP scope extraction; **only after filter** | **<5% of all signals** |
| **T4 — Human review** | Operator queue | Legal flags, low confidence, high economic impact, merge conflicts | As needed |

### Hard rules

1. **Do not LLM-process every signal.** LLM is forbidden at capture and normalize stages.
2. **LLM eligibility gate** — all must pass:
   - `processingState` ≥ `classified`
   - Not `rejected` or duplicate
   - `estimatedEconomicImpact.high` ≥ threshold OR `urgency` ≥ `high` OR manual promotion
   - Daily LLM budget not exceeded
3. **LLM output is never truth** — must produce Facts or Problem hypotheses with citations to `rawTextRef` snippets.
4. **No LLM scoring** — Score Council engines consume structured inputs only ([06-decision-engine.md](./06-decision-engine.md)).
5. **Embeddings** may suggest capability match; final match above 0.85 similarity still requires rule confirmation or human approve for new problem types.
6. **CRM events** (`crm_event`) are T0 — structured mapping only.

### Cost controls

| Control | Implementation |
|---|---|
| Per-source daily cap | Connector config |
| LLM token budget | Engine config in `engine-data/pipeline/` |
| Batch vs realtime | High-volume sources batch classify nightly |
| Cache | Entity profiles cached until new signal affects entity |
| Reprocess | Re-run inference on signal delta, not full corpus |

---

## 9. Phase 2 Build Plan

Phase 2 is split into **2.0 Design** (this document) and **2.1+ Implementation**. Do not build connectors until Step 3 is explicitly authorized.

### Recommended first 3 implementation steps

#### Step 1 — Signal registry and data store

**Goal:** Append-only signal storage with schema validation and dedup index.

**Deliverables:**

- `engine-data/signals/` directory layout: `raw/`, `index.json`, `by-dedup-key.json`
- `src/engine/signals/` module: `validateSignal()`, `appendSignal()`, `getSignalById()`, `listSignals()`
- `engine-data/signals/schema.json` or Zod/Joi validator mirroring §1
- `scripts/opportunity-engine/validate-phase-2-signals.js` (schema + round-trip)

**Exit:** Manual JSON signal can be validated, stored, retrieved, deduped — no connectors.

**Not in scope:** Problem inference, opportunity factory changes, graph DB.

#### Step 2 — Manual signal ingestion script

**Goal:** Founder/operator can ingest signals without connectors.

**Deliverables:**

- `scripts/opportunity-engine/ingest-signal.js` — CLI: `--file`, `--source`, `--type`, optional fields
- Normalization pipeline stages T0 only (rules)
- Writes `processingState` through `classified` for manual sources
- Audit log entry per ingest

**Exit:** 10 manual signals ingested; dedup rejects duplicate; Mission Control unchanged (signals not yet in radar).

**Not in scope:** Automated schedules, LLM extraction, problem inference.

#### Step 3 — First connector (owner-selected)

**Goal:** One production connector proving end-to-end capture → normalize → dedup → classify.

**Recommended first connector candidates (pick one):**

| Connector | Why | Tier |
|---|---|---|
| **CRM outcome webhook** (`crm_event`) | Structured, low cost, ties to learning loop | T0 |
| **Manual CSV permit import** | Gulf Coast construction alignment | T0 |
| **Public budget / bond feed** | High fan-out, structured | T0–T1 |

**Deliverables:**

- Connector module: `src/engine/signals/connectors/{name}/`
- Connector registry entry in `engine-data/signals/connectors.json`
- Observability: ingest count, error rate, dedup rate
- Does **not** require LLM on day one

**Exit:** Connector runs on schedule; signals appear in store with provenance; validation script passes.

**Not in scope:** Second connector, autonomous agents, OpenClaw, live news firehose.

### Phase 2.x sequence (after Step 3)

| Sub-phase | Focus |
|---|---|
| **2.4** | Entity linking to `data/businesses.json` |
| **2.5** | Fact extraction (structured, T0/T1) |
| **2.6** | Problem inference engine (minimal rule set) |
| **2.7** | Wire signal-sourced opportunities into radar |
| **3.0** | Problem-centric factory replaces industry×offer primary matching |

---

## 10. Integration with Mission Control (Phase 1)

Mission Control already consumes `buildMissionControl()`. Phase 2 adds signal provenance without UI logic changes:

| Mission Control field | Phase 2 enhancement |
|---|---|
| `evidence.evidence[]` | Include `signal:{id}` citations |
| `evidence.missingData` | Flag opportunities without signal chain |
| `metrics` | Add `signalsIngested24h`, `problemsActive`, `signalSourcedOpportunities` |
| `alerts` | Stale connectors, dedup flood, LLM budget exceeded |
| `topOpportunity` | `relatedSignalIds[]`, `problemId` when present |

**Rule:** Pivotal OS continues to call only `buildMissionControl()`.

---

## 11. Open Decisions (Resolve Before 2.1)

| Decision | Options | Recommendation |
|---|---|---|
| Signal storage engine | JSON event log vs Postgres vs blob | JSON event log for 2.1; revisit at 10k signals/day |
| Fact object timing | Phase 2.5 vs Phase 3 | Introduce minimal Facts in 2.5 for corroboration |
| Problem inference boundary | Phase 2.6 vs Phase 3 | Start rule-based inference in 2.6; full factory in 3 |
| First connector | CRM vs permits vs budget | CRM webhook — lowest risk, structured |
| Graph Writer | Defer vs stub | Stub interface only; no graph DB in 2.1 |

---

## 12. Validation (Future)

Phase 2.0 design complete when this document is reviewed. Phase 2.1 implementation complete when:

```bash
node scripts/opportunity-engine/validate-phase-2-signals.js   # Step 1
node scripts/opportunity-engine/validate-phase-2-ingest.js    # Step 2
node scripts/opportunity-engine/validate-phase-2-connector.js # Step 3
```

(Scripts do not exist yet — created during implementation.)

---

## Amendment

Changes to Signal or Problem canonical fields require [Build Log](./09-build-log.md) entry and owner approval per [07-architecture-rules.md](./07-architecture-rules.md) **R25**.
