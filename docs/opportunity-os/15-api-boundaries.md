# 15 — API Boundaries

**Status:** Constitution · Module ownership  
**Related:** [Architecture Rules](./07-architecture-rules.md) · [Folder Map](./13-folder-map.md) · [Ontology](./02-ontology.md) · [World Model](./23-world-model.md) · [Capability Intelligence](./27-capability-intelligence.md) · [Autonomous Operating Loop](./28-autonomous-operating-loop.md)

Defines **who owns what** and **allowed import directions**.

See [World Model §5 — Sensor Rule](./23-world-model.md#5-sensor-rule): sensors write **Observations/Signals only**.  
See [World Model § Fact Builder Rule](./23-world-model.md#6-fact-builder-rule): fact builder writes **Facts only**.  
See [Reasoning Engine §11 — Permanent Rules](./26-reasoning-engine.md#11-permanent-architectural-rules): reasoning consumes **Situations**, not raw Facts.

---

## Ownership Matrix

| Domain | Owner module | Public API | Consumers |
|---|---|---|---|
| **Observations (raw)** | Ingest boundary + sensors + manual CLI | Write to `runtime/signals/raw/` only | Signal normalizer |
| **Runtime storage** | `engine/runtime` | Path helpers, `readJsonWithRetry()`, `writeJsonAtomic()`, `writeJsonAtomicWithRetry()`, `appendJsonLineWithRetry()`, `readJsonLinesWithRetry()` | All runtime stores including `events/`, `jobs/` |
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
| **Problem Engine** | `engine/problems` | `createProblem()`, `listProblems()`, `buildExplainability()` | Capability Intelligence |
| **Capability Intelligence** | `engine/capability-matcher` *(Phase 2.7)* | `matchCapabilities(problem)`, `matchCapabilitiesForProblems()` | Offer Intelligence |
| **Capability Match Store** | `engine/capability-matches` *(Phase 2.7)* | `saveCapabilityMatch()`, `listCapabilityMatches()`, `getCapabilityMatchesByProblemId()` | Offer Intelligence, Mission Control projection |
| **Offer Intelligence** | `engine/offer-intelligence` *(Phase 2.8)* | `recommendOffers(capabilityMatch)`, `recommendOffersForProblem()` | Opportunity Factory |
| **Offer Recommendation Store** | `engine/offer-recommendations` *(Phase 2.8)* | `saveOfferRecommendation()`, `listOfferRecommendations()` | Opportunity Factory, Mission Control projection |
| **Opportunity Factory** | `engine/opportunity-factory` *(Phase 2.9)* | `buildOpportunity()`, `buildOpportunityForProblem()` | Score Council — **next consumer** |
| **Opportunity Validator** | `engine/opportunity-validator` *(Phase 2.9)* | `validateOpportunity()` | Factory gate only |
| **Opportunity Store** | `engine/opportunities` *(Phase 2.9)* | `listOpportunities()`, `getOpportunityById()`, `saveOpportunity()` | Score Council, Mission Control projection |
| **Opportunities (legacy radar)** | `engine/opportunities/radar.js` | `generateOpportunities()` | Intelligence radar only — not factory path |
| **Knowledge Graph** | Future Graph Writer / Reader | `writeNode`, `writeEdge`, `querySubgraph` | All intelligence modules |
| **Capabilities** | `engine/capabilities` + `engine-data/capabilities` | `listCapabilities()`, `getCapabilityById()`, `getCapabilitiesByIds()`, `normalizeCapability()` | Matcher, offers join, factory, agents |
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
| **Operating Loop** *(Phase 3.1)* | `engine/jobs` + `engine/events` | Jobs: `createJob()`, `claimJob()`, `completeJob()`, `failJob()`, `retryJob()`, `cancelJob()`, `archiveJob()`, `listJobs()`, `getJob()` · Events: `appendEvent()`, `listEvents()`, `getEvent()`, `getEventsByType()`, `getEventsByCorrelationId()`, `getEventsBySubject()` | Future scheduler (3.2), processor (3.3) |
| **Scheduler** *(Phase 3.2)* | Future `engine/loop/scheduler` | `tick()`, `scheduleSensors()` | Sensor runs only — no reasoning |
| **Pipeline Processor** *(Phase 3.3)* | Future `engine/loop/processor` | Event-driven stage handlers wrapping existing modules | Canonical loop §2 in [28-autonomous-operating-loop.md](./28-autonomous-operating-loop.md) |
| **Execution Queue** *(Phase 3.4)* | Future `engine/execution` + loop | `enqueueExecution()`, `recordOutcome()` | OpenClaw (future), Mission Control (read) |
| **Autopilot** | `scripts/opportunity-engine/autopilot-*` | `collectAutopilotState()`, `writeAutopilotReports()` | Supervision only — **no loop execution** |
| **OpenClaw** *(future)* | Not implemented | Approved action dispatch only | **No observe, reason, or score** |

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

## Capability Intelligence Boundary (Phase 2.6.5 design · Phase 2.7 implementation — **COMPLETE**)

See [27-capability-intelligence.md §12 — Permanent Rules CI1–CI15](./27-capability-intelligence.md#12-permanent-rules).

| Allowed | Forbidden |
|---|---|
| `matchCapabilities(problem)` from Problems only | Direct Situation/Hypothesis/Fact input |
| Deterministic fit scoring with dimension breakdown | LLM-only or black-box ranking |
| Constraint evaluation — visible pass/fail/penalty | Silent constraint filtering |
| Multi-capability composition from registry IDs | Synthetic merged capabilities |
| Explainability bundle on every recommendation | Recommendations without audit trail |
| Runtime store: `runtime/capability-matches/` | Offer selection, Opportunity creation |
| Registry read from `engine-data/capabilities/` | Writes to `engine-data/` without amendment |

**STOP:** Recommended Capabilities — no Offer Intelligence in Phase 2.7.

---

## Offer Intelligence Boundary (Phase 2.8 — **COMPLETE**)

| Allowed | Forbidden |
|---|---|
| `recommendOffers(capabilityMatch)` — capability match input only | Direct Problem → Offer without capability match |
| Candidate offers, eligibility, commercial offer fit, ranking | Opportunity creation |
| Explainability on every offer recommendation | Capability fit recomputation (owned by matcher) |
| Runtime store: `runtime/offer-recommendations/` | Score Council invocation |
| Offer registry read from `engine-data/offers/` | Mission Control changes, LLM selection |

**STOP:** Recommended Offers — no Opportunity Factory in Phase 2.8.

---

## Opportunity Factory Boundary (Phase 2.9 — **COMPLETE**)

| Allowed | Forbidden |
|---|---|
| `buildOpportunity({ problem, capabilityMatch, offerRecommendation })` | Direct Signal/Fact/Situation/Hypothesis input |
| `buildOpportunityForProblem()` loading upstream runtime artifacts | Invented evidence |
| `validateOpportunity()` before persist | Score Council, rescoring, prioritization |
| Structured explainability on every opportunity | Execution, learning, forecasting |
| Runtime store: `runtime/opportunities/` | Mission Control changes, `engine-data/` writes |
| Status lifecycle: assembled → validated → … | Offer/capability matching inside factory |

**STOP:** Validated opportunities — Score Council is next consumer.

---

## Reasoning Engine Boundary (Phase 2.5.8 design · Phase 2.6 implementation)

| Module | Owns | Must not |
|---|---|---|
| **Reasoning Engine** | Hypotheses, evidence bundles, confidence propagation, contradictions | Facts, Situations, Opportunities |
| **Problem Engine** | Problems, explainability bundles | Raw fact inference, capability matching, opportunities |
| **Capability Intelligence** | Capability matches, fit scores, constraint results | Problems, offers, opportunities |
| **Offer Intelligence** | Offer candidates from capability matches | Opportunities, fit scoring |
| **Opportunity Factory** | Assembled + validated runtime opportunities | Score Council scoring, execution, learning |
| **Opportunity Validator** | Validation results | Persistence without valid assembly |

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

## Event Boundaries (Phase 3.0.5+)

Canonical Event schema and taxonomy: [28-autonomous-operating-loop.md §4](./28-autonomous-operating-loop.md#4-event-model).

| Rule | Detail |
|---|---|
| **Publisher** | Stage handler or job completion — via `appendEvent()` (Phase 3.1) |
| **Payload** | References by ID only — no full store snapshots |
| **Chaining** | Scheduler enqueues downstream jobs from events — not inline calls |
| **Audit** | Event log is append-only (AOL13) |

### Target event flow (canonical loop)

| Event | Typical publisher | Downstream job enqueued |
|---|---|---|
| `observation.archived` | ingest boundary | `signal.ingest` |
| `signal.ingested` | `engine/signals` | `fact.build` |
| `fact.created` | `engine/fact-builder` | `graph.project` |
| `situation.created` | `engine/situation-builder` | `hypothesis.generate` |
| `problem.promoted` | `engine/problem-inference` | `capability.match` |
| `capability.matched` | `engine/capability-matcher` | `offer.recommend` |
| `offer.recommended` | `engine/offer-intelligence` | `opportunity.build` |
| `opportunity.validated` | `engine/opportunity-factory` | `opportunity.score` |
| `opportunity.scored` | `engine/score-council` | `projection.refresh` |
| `execution.enqueued` | `engine/execution` | OpenClaw dispatch (future) |
| `job.dead_letter` | `engine/jobs` | Manual `retryJob()` (Phase 3.1+) |
| `job.completed` | `engine/jobs` | Future loop processor (3.3) |
| `outcome.recorded` | outcomes bridge | `learning.apply` |

Legacy ad-hoc events (pre-3.1):

| Event | Publisher | Subscribers |
|---|---|---|
| `signal.observed` | `engine/signals` (`createSignal`) | Future loop processor |
| `fact.extracted` | Extractor | Graph / situation builder |
| `opportunity.scored` | Score Council | UI projection, planner |

---

## Operating Loop Boundaries (Phase 3.0.5)

See [28-autonomous-operating-loop.md](./28-autonomous-operating-loop.md) for full rules AOL1–AOL15.

| Component | Allowed | Forbidden |
|---|---|---|
| **Scheduler** | Enqueue jobs, claim jobs, apply retry/backoff | Call Score Council from sensor handler |
| **Stage handlers** | Wrap existing module public APIs | Redesign intelligence pipelines |
| **Autopilot** | Report loop health, block on owner gates | Bypass phase approval; run production loop |
| **Mission Control** | Read projections refreshed by `projection.refresh` jobs | Enqueue jobs; write runtime spine |
| **OpenClaw** *(future)* | Execute approved queue tasks | Observe, reason, score, or enqueue loop jobs |

**Concurrency (Phase 3.1–3.4):** Single-process worker; no parallel runtime writes until lock strategy matures.

---

Each boundary must have contract tests — [Testing Strategy](./16-testing-strategy.md).

---

## Amendment

New domain owners require Constitution update and [Build Log](./09-build-log.md) entry.
