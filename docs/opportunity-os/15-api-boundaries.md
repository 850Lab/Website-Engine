# 15 — API Boundaries

**Status:** Constitution · Module ownership  
**Related:** [Architecture Rules](./07-architecture-rules.md) · [Folder Map](./13-folder-map.md) · [Ontology](./02-ontology.md) · [World Model](./23-world-model.md)

Defines **who owns what** and **allowed import directions**.

See [World Model §5 — Connector Rule](./23-world-model.md#5-connector-rule): connectors write **Signals only**.

---

## Ownership Matrix

| Domain | Owner module | Public API | Consumers |
|---|---|---|---|
| **Observations (raw)** | Ingest boundary (connectors, Phase 2.2 CLI) | Write to `engine-data/signals/raw/` only | Signal normalizer |
| **Signals** | `engine/signals` (Phase 2.1) | `listSignals()`, `createSignal()`, `updateSignalState()`, `getSignalRegistrySummary()` | Connectors (via registry only), fact extractor (future), Mission Control metrics (read) |
| **Facts** | Future `engine/facts` | `createFact()`, `getFactsBySignal()` | Problem inference, graph writer, Score Council Confidence |
| **Relationships** | Future Graph Writer | `writeEdge()`, `querySubgraph()` | Problem inference, factory, evidence assembler |
| **Problems** | Future `engine/problems` | `inferProblems()`, `getProblemById()` | Capability matcher, opportunity factory |
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

## Connector Boundary (Phase 2.1.5)

| Allowed | Forbidden |
|---|---|
| Write Observation (`engine-data/signals/raw/`) | Write Opportunity |
| Call `createSignal()` on Signal Registry | Call `buildMissionControl()` or UI routes |
| Advance signal lifecycle through engine API | Parallel signal stores |
| | Direct fact/problem/opportunity creation |

Facts, Problems, and Opportunities are **separate engine owners** — see [23-world-model.md §3](./23-world-model.md#3-object-definitions).

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
