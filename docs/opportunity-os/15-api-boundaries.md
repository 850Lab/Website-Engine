# 15 — API Boundaries

**Status:** Constitution · Module ownership  
**Related:** [Architecture Rules](./07-architecture-rules.md) · [Folder Map](./13-folder-map.md) · [Ontology](./02-ontology.md) · [World Model](./23-world-model.md)

Defines **who owns what** and **allowed import directions**.

See [World Model §5 — Sensor Rule](./23-world-model.md#5-sensor-rule): sensors write **Observations/Signals only**.  
See [World Model § Fact Builder Rule](./23-world-model.md#6-fact-builder-rule): fact builder writes **Facts only**.  
See [Reasoning Engine §11 — Permanent Rules](./26-reasoning-engine.md#11-permanent-architectural-rules): reasoning consumes **Situations**, not raw Facts.

---

## Ownership Matrix

| Domain | Owner module | Public API | Consumers |
|---|---|---|---|
| **Observations (raw)** | Ingest boundary + sensors + manual CLI | Write to `runtime/signals/raw/` only | Signal normalizer |
| **Runtime storage** | `engine/runtime` | `getRuntimeRoot()`, `ensureRuntimeDirectories()`, `getRuntimeSignalStorePath()`, `getRuntimeFactStorePath()` | Signals, sensors, facts, ingest |
| **Sensors** | `engine/sensors` (Phase 2.3) | `registerSensor()`, `runSensor()`, `runAllSensors()`, `healthReport()`, `ingestSensorResult()` | Observation pipeline only |
| **Connectors (deprecated)** | `engine/connectors` shim | `registerConnector()`, `runConnector()` | Regression only — use sensors |
| **Signals** | `engine/signals` | `listSignals()`, `createSignal()`, `linkFactsToSignal()`, `initializeRuntimeSignalStore()` | Sensors, fact builder, CLI, Mission Control metrics (read) |
| **Facts** | `engine/facts` (Phase 2.4) | `createFact()`, `listFacts()`, `getFactsBySignalId()`, `getFactSummary()` | Graph bridge, future problem inference |
| **Fact Builder** | `engine/fact-builder` | `buildFactsFromSignal()`, `processSignalIntoFacts()` | Signal → fact pipeline only |
| **Knowledge Graph Bridge** | `engine/knowledge-graph` | `buildGraphProjectionFromFacts()`, `buildGraphFromFactsAndPersist()`, `findRelatedNodes()` | Graph enrichment, future evidence |
| **Graph Store** | `engine/graph-store` (Phase 2.5) | `readGraphStore()`, `upsertGraphNode()`, `upsertGraphEdge()`, `recordRelationshipEvent()` | Persistent runtime graph |
| **Entity Resolution** | `engine/entity-resolution` | `resolveEntity()`, `mergeEntityAliases()`, `normalizeEntityLabel()` | Relationship builder |
| **Relationship Builder** | `engine/relationship-builder` | `buildRelationshipsFromFact()`, `processFactsIntoRelationships()` | Fact → graph structure only |
| **Situations** | `engine/situations` (Phase 2.5.5) | `createSituation()`, `listSituations()`, `getSituationSummary()` | **Required** input for Problem Inference |
| **Situation Builder** | `engine/situation-builder` | `buildSituationsFromGraph()`, `processGraphIntoSituations()` | Graph cluster → situation only |
| **Hypotheses** | `engine/hypotheses` (Phase 2.6) | `createHypothesis()`, `listHypotheses()`, `updateHypothesis()` | Problem inference |
| **Hypothesis Generator** | `engine/hypothesis-generator` | `generateHypothesesFromSituation()` | **Situations only** |
| **Evidence Engine** | `engine/evidence-engine` | `collectEvidenceForHypothesis()` | Evidence bundles by reference |
| **Confidence Engine** | `engine/confidence-engine` | `calculateHypothesisConfidence()` | Traceable propagation |
| **Contradictions** | `engine/contradictions` | `findContradictions()`, `detectCompetingHypotheses()` | Visible conflicts |
| **Reasoning Engine** | `engine/problem-inference` + modules above | `inferProblems()` | Full Situation → Problem pipeline |
| **Problem Engine** | `engine/problems` | `createProblem()`, `listProblems()`, `buildExplainability()` | Capability matcher — **blocked 2.7** |
| **Capability Matcher** | `engine/capability-matcher` *(Phase 2.7)* | `matchCapabilities(problem)` | **Blocked** |
| **Opportunity Factory** | `engine/opportunity-factory` *(Phase 2.8)* | `createOpportunityFromProblem()` | **Blocked** |
| **Knowledge Graph** | Future Graph Writer / Reader | `writeNode`, `writeEdge`, `querySubgraph` | All intelligence modules |
| **Capabilities** | `engine/capabilities` + `engine-data/capabilities` | `listCapabilities()`, `getCapabilityById()` | Offers join, factory, scoring, agents |
| **Offers** | `engine/offers` | `listOffers()`, `getOfferById()`, `getOfferWithCapabilities()`, `listOffersWithCapabilities()` | Factory, radar, reports |
| **Opportunities** | `engine/opportunities` → future problem-centric factory | `generateOpportunities()` | Intelligence, reports — **not created by connectors** |
| **Score Council** | `engine/score-council` | `scoreOpportunity(opportunity, mode)` | **Owns score vectors and CEO mode weighting** |
| **Opportunity Radar** | `engine/intelligence` | `buildOpportunityRadar({ mode })` | **Projection consumer** of factory + Score Council; UI, reports |
| **Mission Control** | `engine/mission-control` | `buildMissionControl()` | Pivotal OS, reports — **read projection only; connectors forbidden** |
| **Mission** | `engine/campaigns` + `engine/operating-picture` | `getActiveMission()`, `buildOperatingPicture()` | UI, execution |
| **Execution** | `engine/execution` → future Execution Engine | `buildExecutionPlan()` | Dispatch adapters, UI |
| **CRM projection** | `mission-control`, `pressure-washing`, `services/schema-outcomes` | Route handlers only | Operators |
| **UI** | `pivotal-os`, legacy pages | HTTP routes | Humans |
| **Learning** | Future `engine/learning` | `proposeLearning()`, `applyLearning()` | Calibrator agent |
| **Forecasting** | Future `engine/forecasting` | `generateForecasts()` | Radar, reports |

---

## Import Rules

```
✅ pivotal-os  → engine
✅ engine      → engine-data, services (read schema data)
✅ services    → schema
✅ routes      → engine | services
✅ legacy UI   → services (transitional writes)

❌ engine      → mission-control | pressure-washing | pivotal-os
❌ schema      → engine (no upward logic)
❌ routes      → schema (direct)
❌ UI          → legacy stores (direct file access)
❌ connectors  → opportunities | mission-control | CRM JSON (Signals only — see World Model §5)
```

---

## Sensor Boundary (Phase 2.3)

| Allowed | Forbidden |
|---|---|
| `runSensor()` → `ingestSensorResult()` → runtime raw + registry | Write Opportunity |
| Register sensor in `engine/sensors` | Call `buildMissionControl()` or UI routes |
| Advance signal lifecycle through engine API | Direct fact/problem/opportunity creation |
| Static demo sensors without network | Parallel storage outside runtime adapter |

## Fact Builder Boundary (Phase 2.4)

| Allowed | Forbidden |
|---|---|
| `processSignalIntoFacts()` → `createFact()` → `runtime/facts/` | Infer problems |
| `buildGraphProjectionFromFacts()` (in-memory / runtime JSON) | Create opportunities |
| `linkFactsToSignal()` metadata on classified+ signals | Transition signal to `problem_inferred` |
| Rules-only extraction (`fact_builder_v0`) | LLM or external API calls |
| Append-only facts with `signalIds` | Write facts to `engine-data/` |

Facts, Problems, and Opportunities are **separate engine owners** — see [23-world-model.md §3](./23-world-model.md#3-object-definitions).

---

## Relationship Builder Boundary (Phase 2.5)

| Allowed | Forbidden |
|---|---|
| `processFactsIntoRelationships()` → `runtime/graph/graph.json` | Infer problems |
| `resolveEntity()` + alias merge (exact normalized match only) | Create opportunities |
| `recordRelationshipEvent()` append-only audit trail | Match capabilities to problems |
| `findRelatedNodes()` / `findEntityNeighborhood()` read queries | LLM or external API calls |
| Edges must reference ≥1 `factId` | Write graph to `engine-data/` |

---

## Situation Builder Boundary (Phase 2.5.5)

| Allowed | Forbidden |
|---|---|
| `processGraphIntoSituations()` → `runtime/situations/` | Infer problems |
| Template title/description/summary only | LLM summarization |
| Link situations ↔ graph nodes via metadata | Capability matching |
| Situation lifecycle transitions (deterministic) | Create opportunities |
| `getSituationEvidence()` read queries | Problem Inference over raw facts/graph |

**Permanent rule:** Problem Inference must consume **Situations only** — never individual facts or raw graph nodes directly. See [26-reasoning-engine.md RE1–RE2](./26-reasoning-engine.md#11-permanent-architectural-rules).

---

## Problem Inference Boundary (Phase 2.6)

| Allowed | Forbidden |
|---|---|
| `inferProblems()` from Situations | Direct Situation → Problem |
| `generateHypothesesFromSituation()` | Raw Fact or graph node as inference input |
| Evidence collection **by reference** | LLM confidence or fabricated evidence |
| `buildExplainability()` on every Problem | Capability matching, offers, opportunities |
| Runtime stores: `hypotheses/`, `problems/` | Writes to `engine-data/` |
| Contradiction records remain visible | Silent contradiction resolution |

---

## Reasoning Engine Boundary (Phase 2.5.8 design · Phase 2.6 implementation)

| Module | Owns | Must not |
|---|---|---|
| **Reasoning Engine** | Hypotheses, evidence bundles, confidence propagation, contradictions | Facts, Situations, Opportunities |
| **Problem Engine** | Problems, explainability bundles | Raw fact inference, capability matching, opportunities |
| **Opportunity Factory** | Opportunities from Problems + offers | Situation-only bets, invented evidence |

| Allowed | Forbidden |
|---|---|
| Situation → Hypothesis → Problem chain | Problem from raw Fact or graph node |
| Evidence **by reference** via Situation chain | LLM-set confidence or fabricated evidence |
| Explainability on every Problem | Score Council inventing evidence |
| Deterministic rules-first inference | External API calls during inference |
| Opportunity from Problem + match + offer | Opportunity from Signal or Situation alone |

---

## HTTP Route Ownership

| Route prefix | Owner | Type |
|---|---|---|
| `/` (Pivotal home) | `pivotal-os` | Projection |
| `/api/mission-control/sales/*` | `mission-control` | Legacy execution adapter |
| `/api/pressure-washing/*` | `pressure-washing` | Legacy execution adapter |
| `/api/outreach/focus*` | `outreach-focus` | Config projection |
| `/api/calls/*` | `twilio-voice` | Execution adapter |
| `/api/health` | `server.js` + diagnostics | Ops |

**New OS APIs** should live under `/api/os/` or `/api/engine/` (decision deferred — see ambiguities).

---

## Service Boundaries (Current)

| Service | Responsibility |
|---|---|
| `services/businesses.js` | Business CRUD read |
| `services/opportunities.js` | Schema opportunity read/write |
| `services/schema-queue/*` | Queue projection reads |
| `services/schema-outcomes/*` | Outcome dual-write |
| `services/id-bridge.js` | Legacy ID mapping (transitional) |
| `services/dual-read/*` | Parity validation (transitional) |

---

## Event Boundaries (Target, Phase 2+)

| Event | Publisher | Subscribers |
|---|---|---|
| `signal.observed` | `engine/signals` (`createSignal`) | Dedup (future), normalizer (future), registry summary |
| `fact.extracted` | Extractor | Problemist, graph writer |
| `problem.hypothesized` | Problemist | Opportunity factory |
| `opportunity.scored` | Score Council | UI projection, planner |
| `plan.approved` | Human/policy | Dispatcher |
| `outcome.recorded` | Execution | Learning |

---

## Cross-Boundary Testing

Each boundary must have contract tests — [Testing Strategy](./16-testing-strategy.md).

---

## Amendment

New domain owners require Constitution update and [Build Log](./09-build-log.md) entry.
