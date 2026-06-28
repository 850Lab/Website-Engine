# 23 — World Model

**Status:** Phase 2.1.5 · Design document (Constitution amendment)  
**Related:** [Master Vision](./00-master-vision.md) · [Ontology](./02-ontology.md) · [Knowledge Graph](./03-knowledge-graph.md) · [Architecture Rules](./07-architecture-rules.md) · [Ontology Convergence Plan](./21-ontology-convergence-plan.md) · [Signal & Problem Pipeline](./22-signal-and-problem-pipeline.md)

---

## 1. Purpose

The **World Model** is the single reasoning spine of the Opportunity Operating System.

It defines how **observations about reality** become **structured business opportunities** — and how those opportunities are won, measured, and learned from. Every connector, signal, fact, problem, and opportunity must follow this model. No module may invent a parallel pipeline.

The World Model answers:

> *What happened in the world, what does it mean, who is affected, what can we deliver, and is it worth pursuing?*

Mission Control, CRM queues, and legacy JSON stores are **projections** of this model — not substitutes for it.

See [Architecture Rules R1, R4, R12–R14](./07-architecture-rules.md).

---

## 2. Core Chain

The canonical flow from external reality to forward prediction:

```
Reality
  → Observation
  → Signal
  → Fact
  → Relationship
  → Problem
  → Capability Match
  → Offer
  → Opportunity
  → Execution Plan
  → Outcome
  → Learning
  → Forecast
```

| Hop | Role |
|---|---|
| **Reality** | External world state — never stored as one object |
| **Observation** | Raw captured evidence that something changed |
| **Signal** | Normalized, deduped, classified observation in the registry |
| **Fact** | Structured, testable claim extracted from signal(s) |
| **Relationship** | Typed edge linking entities, facts, problems, capabilities |
| **Problem** | Expensive emerging need inferred from facts |
| **Capability Match** | Deterministic mapping from problem to what the company can deliver |
| **Offer** | Commercial packaging of capability(ies) for a market conversation |
| **Opportunity** | Actionable economic bet: problem + buyer + offer + evidence + scores |
| **Execution Plan** | How to win a specific opportunity |
| **Outcome** | Recorded win/loss/revenue for learning |
| **Learning** | Model and weight updates from outcomes |
| **Forecast** | Forward prediction of problem or opportunity emergence |

**Rule:** Data may skip stages only through explicit transitional adapters (e.g. database-only opportunities today). New code must converge toward the full chain.

---

## 3. Object Definitions

### Reality

| Attribute | Value |
|---|---|
| **What it is** | The external world: companies, projects, markets, weather, regulation — not a persisted object |
| **What creates it** | N/A (conceptual root) |
| **What consumes it** | Connectors observe it; humans reference it |
| **Immutable** | N/A — continuous change |
| **Lives today** | Not stored |
| **Lives long-term** | Not stored — referenced by signals and facts |
| **Example** | A refinery scheduling a Q1 2027 turnaround |

---

### Observation

| Attribute | Value |
|---|---|
| **What it is** | Raw captured evidence at ingest boundary: HTML, JSON, PDF, webhook payload, CSV row, operator note |
| **What creates it** | Connectors, manual ingest CLI, CRM webhooks |
| **What consumes it** | Signal normalizer (reads `rawTextRef`) |
| **Immutable** | **Yes** — append-only capture; never edited |
| **Lives today** | Ad hoc files, discovery reports, legacy discovery output |
| **Lives long-term** | `engine-data/signals/raw/` + object store pointer |
| **Example** | Permit PDF saved as `engine-data/signals/raw/2026/06/23/sig_abc.json` |

---

### Signal

| Attribute | Value |
|---|---|
| **What it is** | Normalized observation registered in the canonical signal store with lifecycle state |
| **What creates it** | `createSignal()` via connector or manual ingest — [22-signal-and-problem-pipeline.md](./22-signal-and-problem-pipeline.md) |
| **What consumes it** | Dedup, classifier, fact extractor, entity linker, Mission Control metrics (read) |
| **Immutable** | **Observation fields yes** — state and pipeline enrichment mutate via `lifecycle[]` |
| **Lives today** | `engine-data/signals/signals.json`, `src/engine/signals/` |
| **Lives long-term** | Event log + signal index; graph `Signal` nodes |
| **Example** | `signalType: permit`, headline: "Hospital expansion permit filed — 120 beds" |

---

### Fact

| Attribute | Value |
|---|---|
| **What it is** | Structured, testable claim: subject + predicate + object/value with confidence and provenance |
| **What creates it** | Fact extractor (rules → small model → LLM tier) from one or more signals |
| **What consumes it** | Entity linker, problem inference, evidence assembler, Score Council Confidence engine |
| **Immutable** | **Append-only** — superseded by newer fact with `supersedes`, not deleted |
| **Lives today** | `runtime/facts/facts.json` via `src/engine/facts/` (Phase 2.4) |
| **Lives long-term** | Runtime fact store + graph `Fact` nodes |
| **Example** | `predicate: project.approved`, `object: { type: hospital_expansion, beds: 120 }` |

---

### Relationship

| Attribute | Value |
|---|---|
| **What it is** | Typed edge between entities or ontology objects with confidence and provenance |
| **What creates it** | Entity resolver, graph writer, problem/capability matcher |
| **What consumes it** | Problem inference, opportunity factory, execution planner, evidence walks |
| **Immutable** | Edges expire (`validTo`); history retained |
| **Lives today** | Implicit in `data/businesses.json` links; `runtime/graph/graph.json` (Phase 2.5) |
| **Lives long-term** | Knowledge graph — [03-knowledge-graph.md](./03-knowledge-graph.md) |
| **Example** | `Company:Regional Hospital —HAS_PROJECT→ Project:East Campus Expansion` |

---

### Problem

| Attribute | Value |
|---|---|
| **What it is** | Expensive emerging need — **primary unit of thinking** (not industry) |
| **What creates it** | Problem inference engine from fact clusters |
| **What consumes it** | Capability matcher, opportunity factory, forecasts, Mission Control evidence |
| **Immutable** | Hypothesis evolves; status transitions — not deleted |
| **Lives today** | Not first-class; hinted in signal `possibleProblems[]` |
| **Lives long-term** | `engine-data/problems/`; graph `Problem` nodes |
| **Example** | `problemType: safety_coverage_gap` during hospital construction hot-work |

---

### Capability Match

| Attribute | Value |
|---|---|
| **What it is** | Deterministic (or embedding-assisted) link from problem to registered capability with fit score and reasons |
| **What creates it** | `engine/capabilities` matcher against `problemsSolved[]` registry |
| **What consumes it** | Offer selector, opportunity factory, Score Council Execution/Revenue engines |
| **Immutable** | Recomputed on problem or registry update; prior matches archived |
| **Lives today** | Implicit via offer `capabilityIds` + transitional industry×offer factory |
| **Lives long-term** | Stored on Problem as `capabilityMatches[]`; graph `SOLVED_BY` edges |
| **Example** | `fire_watch` fitScore 0.9 for `safety_coverage_gap` |

---

### Offer

| Attribute | Value |
|---|---|
| **What it is** | Commercial packaging of one or more capabilities for a sales conversation |
| **What creates it** | Product/revenue leadership; registered in `engine-data/offers/` |
| **What consumes it** | Opportunity factory, radar, Mission Control, execution adapters |
| **Immutable** | Registry entries versioned; active/retired lifecycle |
| **Lives today** | `engine-data/offers/offers.json`, `src/engine/offers/` |
| **Lives long-term** | Same registry + graph `PACKAGED_AS` edges |
| **Example** | `offer_ktm_manpower` packages `ktm_labor` |

---

### Opportunity

| Attribute | Value |
|---|---|
| **What it is** | Actionable economic bet: problem + buyer entity + offer + score vector + evidence |
| **What creates it** | Opportunity factory (problem-centric); Score Council enriches |
| **What consumes it** | Radar, Mission Control, execution planner, CRM projections |
| **Immutable** | Core evidence chain fixed at creation; scores and status update |
| **Lives today** | `src/engine/opportunities/` (transitional industry×offer), schema `Opportunity` |
| **Lives long-term** | Graph `Opportunity` nodes with full provenance |
| **Example** | Fire watch opportunity targeting hospital facilities director, score 78/100 |

---

### Execution Plan

| Attribute | Value |
|---|---|
| **What it is** | Sequence of actions, channels, timing, and autonomy level to win one opportunity |
| **What creates it** | Execution engine / planner after human or policy approval |
| **What consumes it** | Task dispatcher, CRM adapters, operator UI |
| **Immutable** | Plan versioned; tasks mutate independently |
| **Lives today** | `src/engine/execution/` (mission-scoped seed) |
| **Lives long-term** | Per-opportunity plan graph |
| **Example** | Call facilities director → send capability brief → schedule site walk |

---

### Outcome

| Attribute | Value |
|---|---|
| **What it is** | Recorded result: win, loss, revenue, margin, cycle time, objections |
| **What creates it** | Execution closure, operator verification, CRM dual-write |
| **What consumes it** | Learning engine, Probability engine, forecasts |
| **Immutable** | **Yes** after verification — corrections via superseding outcome |
| **Lives today** | Schema `Attempt`, partial outcome fields |
| **Lives long-term** | Full Outcome entity + graph |
| **Example** | Won fire watch contract, $180k, 45-day cycle |

---

### Learning

| Attribute | Value |
|---|---|
| **What it is** | Proposed or applied model update: weights, playbooks, extractor fixes |
| **What creates it** | Learning engine / Calibrator agent from outcome batches |
| **What consumes it** | Score Council weights, capability registry suggestions, extractors |
| **Immutable** | Applied learning versioned; rollback supported |
| **Lives today** | Schema `LearningReport` (not wired to Score Council) |
| **Lives long-term** | Model registry Phase 5 |
| **Example** | Raise Timing weight for `turnaround` signals in Gulf Coast |

---

### Forecast

| Attribute | Value |
|---|---|
| **What it is** | Forward prediction: problem or opportunity emergence in region/window |
| **What consumes it** | Radar, Mission Control alerts, CEO planning |
| **What creates it** | Forecasting engine from precursor signal patterns |
| **Immutable** | Predictions versioned; confirmed/missed tracked |
| **Lives today** | Not implemented |
| **Lives long-term** | Forecast store + graph `PREDICTS` edges |
| **Example** | 70% chance of labor shortage problem in SE Texas industrial corridor Q1 2027 |

---

## 4. Key Distinctions

| Distinction | Meaning |
|---|---|
| **Reality is not stored directly** | The OS stores observations and inferences about reality — never a snapshot of "the world." |
| **Observations are captured evidence** | Raw bytes at the ingest boundary. Immutable. Referenced by `rawTextRef`. |
| **Signals are normalized observations** | Canonical registry records with type, geo, lifecycle, and dedup keys. Still about *what was observed*, not yet *what we believe*. |
| **Facts are structured claims extracted from signals** | Testable predicates with confidence. Multiple facts may support one problem. |
| **Problems are inferred from facts** | Not from industry tags or offer lists. Problems drive the factory. |
| **Opportunities are commercial responses to problems** | An opportunity without a problem (eventually) is a migration-era exception. |
| **CRM is not the world model** | Queues, calls, and legacy JSON are execution projections and operator tools. |
| **UI is not the world model** | Pivotal OS and legacy pages render engine projections only — [R4](./07-architecture-rules.md). |

---

## 5. Sensor Rule

Every **Sensor** (formerly "connector") is an **Observation capture module**. It must obey:

| Rule | Detail |
|---|---|
| **S1** | Every sensor **ends** by publishing canonical **Observations** through the Signal Registry pipeline |
| **S2** | **No sensor may bypass** the Signal Registry |
| **S3** | **No sensor may directly create Opportunities** |
| **S4** | **No sensor may write to Mission Control** |
| **S5** | **No sensor may invent its own storage pipeline** |
| **S6** | Sensors may write **Observations** (`runtime/signals/raw/`) and **Signals** only |
| **S7** | Fact extraction, problem inference, and opportunity creation are **downstream** — not sensor responsibilities |

Implementation: [25-sensor-framework.md](./25-sensor-framework.md) · `src/engine/sensors/`

### Connector Rule (Deprecated)

Phase 2.2.5 **Connectors** are deprecated. The rules above supersede the former Connector Rule. `src/engine/connectors/` remains a regression shim only.

**Allowed connector output:**

```
External source → Observation (raw) → Signal (registry) → [engine pipeline]
```

**Forbidden:**

```
External source → Opportunity / CRM queue / Mission Control  ❌
```

Legacy discovery scripts must converge to this rule — not expand parallel paths.

### Sensor Framework (Phase 2.3)

See [25-sensor-framework.md](./25-sensor-framework.md). Demo sensors only in Phase 2.3.

---

## 6. Fact Layer

Facts bridge **signals** (observations) and **problems** (meaning).

> **Facts are evidence. Problems are interpretation.** Phase 2.4 creates evidence only.

### Fact Builder Rule (Phase 2.4)

| Rule | Detail |
|---|---|
| **F1** | Facts are **derived from Signals** — every fact must reference ≥1 `signalId` |
| **F2** | Facts are **append-only** in `runtime/facts/facts.json` — no overwrites |
| **F3** | Fact Builder is **rules-only** (`fact_builder_v0`) — no LLM, no external APIs |
| **F4** | Pipeline stops after fact creation — **no** `problem_inferred` transition |
| **F5** | Knowledge Graph Bridge **projects** nodes/edges — does not infer problems or opportunities |
| **F6** | Do **not** write facts to `engine-data/` |

Implementation: `src/engine/facts/`, `src/engine/fact-builder/`, `src/engine/knowledge-graph/`

Flow:

```
classified Signal → buildFactsFromSignal() → createFact() → runtime/facts/
  → buildGraphProjectionFromFacts() → STOP
```

Phase 2.5 is **Relationship Builder / persistent graph enrichment** — not Problem Inference.

Phase 2.6 is **Problem Inference** — must consume **Situations only**.

### Situation Builder Rule (Phase 2.5.5)

| Rule | Detail |
|---|---|
| **Sit1** | Situations are evidence-backed snapshots of **what is happening** |
| **Sit2** | Situations cluster connected graph evidence (entity, location, market, timeline) |
| **Sit3** | Situations stored append-only in `runtime/situations/situations.json` |
| **Sit4** | Summaries use **templates only** — no LLM narrative |
| **Sit5** | Graph nodes reference situations; situations reference graph nodes |
| **Sit6** | Do **not** infer problems, match capabilities, or create opportunities |

**Permanent rule (unless Constitution amended):** Problem Inference is forbidden from reasoning over individual facts or raw graph nodes. It must consume **Situations only**. Situations are the semantic boundary between knowledge and reasoning.

Implementation: `src/engine/situations/`, `src/engine/situation-builder/`

Flow:

```
Graph (nodes/edges) → buildSituationsFromGraph() → runtime/situations/ → STOP
```

Reasoning begins at Situations. See [26-reasoning-engine.md](./26-reasoning-engine.md).

**Phase 2.6 implemented:**

```
Situation → inferProblems() → runtime/hypotheses/ + runtime/problems/ → STOP
```

Modules: `hypothesis-generator/`, `evidence-engine/`, `confidence-engine/`, `contradictions/`, `problem-inference/`, `problems/`, `hypotheses/`.

### Relationship Builder Rule (Phase 2.5)

| Rule | Detail |
|---|---|
| **R1** | Relationships are **structure** derived from facts — not interpretation |
| **R2** | Every relationship edge must reference ≥1 `factId` |
| **R3** | Entity resolution is **rules-only** — no LLM, no fuzzy over-merge |
| **R4** | Persistent graph lives in `runtime/graph/graph.json` only |
| **R5** | Relationship events are **append-only** audit trail |
| **R6** | Do **not** infer problems, match capabilities, or create opportunities |
| **R7** | Do **not** write graph data to `engine-data/` |

Implementation: `src/engine/graph-store/`, `src/engine/entity-resolution/`, `src/engine/relationship-builder/`

Flow:

```
Facts → resolveEntity() → buildRelationshipsFromFact() → runtime/graph/
  → getKnowledgeGraphSummary() → STOP
```

### Canonical Fact schema

| Field | Type | Description |
|---|---|---|
| `id` | string | `fact_{ulid}` |
| `signalIds` | string[] | Supporting signals (≥1) |
| `subjectEntityId` | string \| null | Canonical entity the fact is about |
| `predicate` | string | Canonical predicate (dot notation) |
| `object` | object | Structured object type and attributes |
| `value` | number \| string \| boolean \| null | Scalar value when applicable |
| `unit` | string \| null | USD, beds, FTE, sqft, days, etc. |
| `timeRange` | object | `{ start, end, label? }` — when the fact applies |
| `location` | object | Same shape as Signal.location |
| `confidence` | number | 0–1 |
| `evidence` | array | `[{ type, ref, text, span? }]` — citations to signal snippets |
| `extractor` | object | `{ name, version, tier: rules\|model\|llm }` |
| `createdAt` | ISO8601 | |
| `updatedAt` | ISO8601 | Status/supersession only |

### Predicate namespace (initial)

| Predicate | Meaning |
|---|---|
| `project.approved` | Capital project approved or permitted |
| `project.budget_set` | Budget amount assigned |
| `permit.filed` | Regulatory permit submitted |
| `hiring.spike_detected` | Abnormal hiring velocity |
| `facility.expansion_announced` | Physical expansion planned |
| `procurement.rfp_published` | RFP issued |
| `procurement.deadline_approaching` | Bid deadline within window |
| `contract.awarded` | Contract awarded to party |
| `weather.event_forecast` | Weather event predicted |
| `operations.turnaround_scheduled` | Turnaround/shutdown window set |

### Examples

**Project budget approved**

```json
{
  "id": "fact_budget_001",
  "signalIds": ["sig_bond_442"],
  "subjectEntityId": "entity_school_district_12",
  "predicate": "project.budget_set",
  "object": { "type": "school_facilities_bond", "program": "facilities_2027" },
  "value": 180000000,
  "unit": "USD",
  "timeRange": { "start": "2027-01-01", "end": "2032-12-31", "label": "bond_program" },
  "location": { "city": "Beaumont", "state": "TX", "country": "US" },
  "confidence": 0.92,
  "evidence": [{ "type": "signal", "ref": "sig_bond_442", "text": "Voters approved $180M bond" }],
  "extractor": { "name": "public_budget_rules", "version": "1.0.0", "tier": "rules" }
}
```

**Permit filed**

```json
{
  "predicate": "permit.filed",
  "object": { "type": "hospital_expansion", "beds": 120 },
  "value": 120,
  "unit": "beds",
  "confidence": 0.88
}
```

**Hiring spike detected**

```json
{
  "predicate": "hiring.spike_detected",
  "object": { "type": "warehouse_staffing", "roles": ["forklift", "picker"] },
  "value": 2.4,
  "unit": "x_baseline_postings",
  "confidence": 0.74
}
```

**Facility expansion announced**

```json
{
  "predicate": "facility.expansion_announced",
  "object": { "type": "distribution_center", "sqft": 500000 },
  "value": 500000,
  "unit": "sqft",
  "confidence": 0.85
}
```

**RFP deadline approaching**

```json
{
  "predicate": "procurement.deadline_approaching",
  "object": { "type": "municipal_water_upgrade" },
  "timeRange": { "start": null, "end": "2026-08-15", "label": "bid_deadline" },
  "confidence": 0.95
}
```

**Storage (future):** `engine-data/facts/facts.json` or OLTP table — not implemented in Phase 2.1/2.2.

---

## 7. Relationship Layer

Facts and entity resolution produce **Relationships** — first-class graph edges.

### Canonical relationship types (World Model subset)

| Relationship | From → To | Created when |
|---|---|---|
| `OWNS` | Company → Facility | Entity resolution + ownership fact |
| `OPERATES` | Company → Facility | Operator role confirmed |
| `HAS_PROJECT` | Facility → Project | `project.approved` / `permit.filed` facts |
| `REQUIRES` | Project → Capability | Scope fact implies capability need (via problem path) |
| `IMPLIES` | Fact → Problem | Problem inference |
| `AFFECTS` | Problem → Entity | Who bears the problem |
| `SOLVED_BY` | Problem → Capability | Capability match |
| `PACKAGED_AS` | Capability → Offer | Registry join (static) |
| `TARGETS` | Opportunity → Company/Person | Factory output |
| `EVIDENCED_BY` | Opportunity → Signal/Fact | Explainability requirement |

Every edge carries: `confidence`, `provenance[]`, `validFrom`, `validTo`, `extractorVersion`.

### Fact → Relationship examples

| Fact | Relationships created |
|---|---|
| `permit.filed` on hospital project | `Company —HAS_PROJECT→ Project`, `Project —REQUIRES→ fire_watch` (via problem) |
| `project.budget_set` on school bond | `Company —HAS_PROJECT→ Bond Program`, `Problem —AFFECTS→ School District` |
| `hiring.spike_detected` | `Company —OPERATES→ Facility`, `Problem —AFFECTS→ Company` |

**Owner (future):** Graph Writer — sole mutator of relationship edges.

---

## 8. Problem Inference Layer

Problems are **inferred** from fact clusters — not copied from signal headlines.

### Inference modes

| Mode | Description | Confidence |
|---|---|---|
| **Single-signal problems** | One high-trust structured signal yields facts sufficient alone (e.g. permit with typed fields) | Medium–high if source trust tier ≥ government_feed |
| **Multi-signal problems** | Corroborating signals within time/entity window (e.g. expansion press + hiring spike + permit) | Stacks via independent fact confidence |
| **Weak signals** | Single `company_news` or `social_signal` | Hypothesis only; capped confidence; no auto-opportunity |
| **Confidence stacking** | `P(problem) = f(fact confidences, independence, source diversity)` — not simple average | Documented in inference engine |
| **Evidence chains** | Every problem lists `relatedSignalIds[]` + fact IDs + reasoning trace | Required for Mission Control |

### Inference rules (initial)

1. **Minimum fact count:** ≥1 fact for structured sources; ≥2 independent facts for `company_news` / `social_signal`.
2. **Entity anchor:** Problem should attach to ≥1 `affectedEntityId` when resolvable.
3. **Fan-out:** One fact cluster may yield multiple problems (see [22 §7](./22-signal-and-problem-pipeline.md)).
4. **Decay:** Problems without reinforcing signals within `timeHorizon` → `resolved` or `archived`.
5. **No problem without fact path** (except transitional database-only opportunities marked `source: database_legacy`).

### Problem status flow

```
hypothesized → validated → active → resolved → archived
```

**Phase boundary:** Problem inference engine is **Phase 2.6 / 3** — not Phase 2.2.

---

## 9. Capability Matching

**Capabilities are permanent.** They describe what the company can deliver internally.

**Offers are packaging.** They describe how capabilities are sold.

### Matching order

```
Problem.problemType
  → registry problemsSolved[] (deterministic T0)
  → embedding similarity (T1, optional)
  → human review queue (new problem types)
```

### Output: Capability Match object

```json
{
  "capabilityId": "fire_watch",
  "fitScore": 0.9,
  "reasons": ["hot_work_compliance in problemsSolved", "fact: permit.filed hospital_expansion"],
  "matcher": { "tier": "rules", "version": "1.0.0" }
}
```

Stored on Problem as `capabilityMatches[]`. Multiple capabilities per problem allowed.

**Rule:** Offers are selected **after** capability match — `offer.capabilityIds[]` must intersect matched capabilities.

---

## 10. Opportunity Creation Rules

An **Opportunity** may be created only when:

| # | Gate | Detail |
|---|---|---|
| 1 | **Problem exists** | `problemId` linked (or explicit `exploratory: true` flag for CEO review) |
| 2 | **Capability match** | ≥1 capability with `fitScore` ≥ threshold (default 0.6) |
| 3 | **Affected buyer/entity** | `buyerEntityId` or resolvable contact path |
| 4 | **Evidence attached** | `evidenceRef` or bundle citing signals and/or facts |
| 5 | **Confidence gate** | Problem confidence ≥ minimum (default 0.55) **OR** flagged `exploratory: true` |

### Exploratory opportunities

When confidence is below threshold but economic impact is high:

- Factory may create with `exploratory: true`
- Mission Control surfaces with "validate before outreach" alert
- Score Council Confidence engine reflects low evidence

### Forbidden

- Opportunity from connector directly (C3)
- Opportunity from industry tag alone (R12)
- Opportunity without score vector (Phase 1+ Score Council)

### Transitional exception (today)

`src/engine/opportunities/` industry×offer factory continues until Phase 3 demotes it. New signal-sourced opportunities must follow gates above.

---

## 11. World Model Examples

Each example traces: **Observation → Signal → Fact → Problem → Capability Match → Opportunity**

### Refinery turnaround

| Stage | Artifact |
|---|---|
| Observation | Turnaround calendar PDF from operator site |
| Signal | `signalType: turnaround`, urgency `high`, Gulf Coast refinery |
| Fact | `operations.turnaround_scheduled`, Q1 2027, 6-week window |
| Problem | `labor_shortage` + `safety_coverage_gap` |
| Capability Match | `ktm_labor` (0.85), `fire_watch` (0.9), `hole_watch` (0.8) |
| Opportunity | KTM manpower + fire watch opportunities targeting refinery ops contact |

### Hospital expansion

| Stage | Artifact |
|---|---|
| Observation | CON filing HTML from state health portal |
| Signal | `signalType: permit`, 120-bed expansion |
| Fact | `permit.filed`, `project.approved`, beds=120 |
| Problem | `construction_activity`, `safety_coverage_gap`, `staffing_surge` |
| Capability Match | `ktm_labor`, `fire_watch`, `exterior_cleaning` |
| Opportunity | Fire watch during construction; KTM labor for surge |

### School bond

| Stage | Artifact |
|---|---|
| Observation | Election results JSON + board minutes PDF |
| Signal | `signalType: public_budget`, $180M facilities bond passed |
| Fact | `project.budget_set`, $180M, 5-year program |
| Problem | `capital_project_support`, `procurement_window`, `construction_activity` |
| Capability Match | `ktm_labor`, `maintenance_support`, `website_growth` |
| Opportunity | GC/sub staffing track; district web transparency offer (lower priority) |

### Warehouse opening

| Stage | Artifact |
|---|---|
| Observation | Press release + commercial real estate listing |
| Signal | `signalType: expansion`, 500k sqft distribution center |
| Fact | `facility.expansion_announced`, hiring.spike_detected (2.3× postings) |
| Problem | `facility_expansion`, `staffing_surge`, `cleaning_or_restoration_need` |
| Capability Match | `ktm_labor`, `exterior_cleaning` |
| Opportunity | Ramp staffing; pad/dock cleaning contract |

### Hurricane forecast

| Stage | Artifact |
|---|---|
| Observation | NWS advisory JSON |
| Signal | `signalType: weather_event`, Cat 3 landfall SE Texas 72h |
| Fact | `weather.event_forecast`, wind, surge zone |
| Problem | `emergency_response_need`, `cleaning_or_restoration_need`, `maintenance_demand` |
| Capability Match | `exterior_cleaning`, `ktm_labor`, `maintenance_support` |
| Opportunity | Post-storm restoration bundle; temporary industrial staffing |

---

## 12. Cost / AI Rules

Aligned with [18-performance.md](./18-performance.md) and [22 §8](./22-signal-and-problem-pipeline.md).

| Stage | AI allowed? | Method |
|---|---|---|
| **Capture** | **No** | Store raw observation only |
| **Normalize** | **No** | Rules, field maps, charset cleanup |
| **Dedupe** | **No LLM** | Hash + rules; embeddings optional for near-dup |
| **Classify** | **Rules first** | Local model fallback; LLM rare |
| **Fact extraction** | **Rules / small model first** | LLM only on filtered high-value signals |
| **Problem inference** | **AI only for high-value signals** | Rules for structured facts; LLM for ambiguous clusters above economic threshold |
| **Opportunity scoring** | **Deterministic Score Council** | No LLM-generated scores |
| **Executive narrative** | **AI allowed as projection only** | Mission Control text summaries; must cite evidence IDs — never truth |

**Budget rule:** LLM spend < 5% of total signal volume.

**Truth rule:** LLM output never writes directly to Opportunity or Mission Control truth — only to Fact hypotheses and UI narrative projections pending evidence linkage.

---

## 13. Phase 2.2 Readiness

Phase 2.2 may proceed **only after**:

1. [23-world-model.md](./23-world-model.md) reviewed and approved by owner
2. [08-current-phase.md](./08-current-phase.md) updated to authorize Phase 2.2
3. Explicit implementation prompt issued

### Phase 2.2 scope (unchanged)

| In scope | Out of scope |
|---|---|
| Manual signal ingestion CLI | Connectors |
| Raw capture writer (`engine-data/signals/raw/`) | News APIs, RFP ingestion |
| Normalization/classification through registry | Fact store implementation |
| `createSignal()` + lifecycle transitions | Problem inference |
| Validation script `validate-phase-2-2.js` | Opportunity factory changes |
| | Mission Control UI changes |

Phase 2.2 implements **Observation → Signal** only — the first two hops of the World Model chain.

### Suggested authorization prompt

> *"Implement Phase 2.2 — manual signal ingestion CLI. Write Observations and Signals per World Model doc 23. No facts, problems, or connectors."*

---

## Amendment

Changes to the World Model chain or connector rules require [Build Log](./09-build-log.md) entry and owner approval per [R25](./07-architecture-rules.md).

**Related documents to keep synchronized:**

- [02-ontology.md](./02-ontology.md) — object definitions
- [03-knowledge-graph.md](./03-knowledge-graph.md) — relationship types
- [22-signal-and-problem-pipeline.md](./22-signal-and-problem-pipeline.md) — signal/problem operational detail
