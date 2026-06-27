# 15 — API Boundaries

**Status:** Constitution · Module ownership  
**Related:** [Architecture Rules](./07-architecture-rules.md) · [Folder Map](./13-folder-map.md) · [Ontology](./02-ontology.md) · [World Model](./23-world-model.md)

Defines **who owns what** and **allowed import directions**.

See [World Model §5 — Sensor Rule](./23-world-model.md#5-sensor-rule): sensors write **Observations/Signals only**.  
See [World Model § Fact Builder Rule](./23-world-model.md#6-fact-builder-rule): fact builder writes **Facts only** — no problems or opportunities.

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
| **Relationships** | Future Graph Writer | `writeEdge()`, `querySubgraph()` | Phase 2.6+ problem inference prep |
| **Problems** | Future `engine/problems` | `inferProblems()`, `getProblemById()` | **Blocked** until Phase 2.6 |
| **Capability Match** | `engine/capabilities` + future matcher | `matchCapabilities(problem)` | Offer selector, factory |
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
