# 09 — Build Log

**Status:** Living document · chronological  
**Related:** [Roadmap](./01-roadmap.md) · [Current Phase](./08-current-phase.md) · [Project History](./20-project-history.md)

Record architectural milestones here. Implementation details belong in commit messages; this log captures **decisions and phase transitions**.

---

## Format

```
### YYYY-MM-DD — Title
**Phase:** N
**Type:** Decision | Milestone | Migration | Constitution
**Summary:** One paragraph
**Links:** PRs, docs, scripts
```

---

## Entries

### 2024–2025 — Website Outreach Engine founded
**Phase:** Pre-OS  
**Type:** Milestone  
**Summary:** Repository created as local business website opportunity scanner. Stage1 qualification, angle analysis, preview generation, outreach workflows established.  
**Links:** [Project History](./20-project-history.md)

---

### 2025 — Pressure Washing vertical added
**Phase:** Pre-OS  
**Type:** Milestone  
**Summary:** PW queue, lead store, mobile operator UI, and discovery scripts added as second product silo.  
**Links:** `src/pressure-washing/`, `docs/pressure-washing-build-plan.md`

---

### 2025–2026 — Locked Outreach OS schema (8 entities)
**Phase:** Migration (pre-Phase 1)  
**Type:** Milestone  
**Summary:** Canonical schema defined: Offer, Campaign, Business, Contact, Opportunity, QueueItem, Attempt, LearningReport. Migration scripts and id-bridge created.  
**Links:** `src/schema/`, `scripts/migration/`, [Data Model](./14-data-model.md)

---

### 2026-06 — Schema queue read cutover (Phase 0.77)
**Phase:** Migration  
**Type:** Milestone  
**Summary:** `USE_SCHEMA_QUEUE_READS` serves website and PW queues from schema entities with dual-read parity validation.  
**Links:** `src/services/schema-queue/`, `scripts/run-dual-read-validation.js`

---

### 2026-06 — Schema outcome dual-write (Phase 0.78)
**Phase:** Migration  
**Type:** Milestone  
**Summary:** `USE_SCHEMA_OUTCOME_WRITES` dual-writes outcomes/notes to Attempts + Opportunities while legacy remains UI write authority.  
**Links:** `src/services/schema-outcomes/record-write.js`

---

### 2026-06 — Opportunity Engine MVP (`src/engine/`)
**Phase:** Pre-Phase 1  
**Type:** Milestone  
**Summary:** Engine modules created: offers, markets, industry-discovery, opportunities, intelligence (`buildOpportunityRadar`), operating-picture, execution, scoring. Pivotal home wired to radar.  
**Links:** `src/engine/`, `engine-data/`

---

### 2026-06 — KTM opportunity report generator
**Phase:** Pre-Phase 1  
**Type:** Milestone  
**Summary:** `scripts/opportunity-engine/generate-ktm-report.js` produces filtered KTM meeting report from radar.  
**Links:** `reports/ktm-opportunity-report.md`

---

### 2026-06-23 — AI Constitution (Phase 0) initiated
**Phase:** 0  
**Type:** Constitution  
**Summary:** `docs/opportunity-os/` created. Feature implementation frozen until Constitution approved. Repository formally reframed as Opportunity Operating System.  
**Links:** [08-current-phase.md](./08-current-phase.md)

---

### 2026-06-23 — Phase 0.5 alignment (ontology, capabilities, score council)
**Phase:** 0.5  
**Type:** Milestone  
**Summary:** Phase 0.5 alignment introduced ontology convergence plan, first-class capability registry (`engine-data/capabilities/`), offer→capability linking, and Score Council with CEO modes. Radar now exposes `scoreVector` and `scoreCouncil` while preserving `opportunityScore` as composite projection.  
**Links:** [21-ontology-convergence-plan.md](./21-ontology-convergence-plan.md), `src/engine/score-council/`, `scripts/opportunity-engine/validate-phase-0-5.js`

---

### 2026-06-23 — Phase 1 Mission Control (Executive OS)
**Phase:** 1  
**Type:** Milestone  
**Summary:** Introduced `buildMissionControl()` as the single executive API projection. Added evidence assembler (`src/engine/evidence/`) for explainability from Score Council, database analysis, capabilities, offers, markets, and execution. Pivotal OS home now consumes Mission Control only (no UI scoring). Report generator produces `reports/mission-control.md`. Validation: `scripts/opportunity-engine/validate-phase-1.js`.  
**Links:** `src/engine/mission-control/`, `src/engine/evidence/`, `src/pivotal-os/pages/home.js`, `scripts/opportunity-engine/generate-mission-control-report.js`

---

### 2026-06-23 — Phase 2.0 Signal and Problem Inference Pipeline (design)
**Phase:** 2.0  
**Type:** Constitution  
**Summary:** Defined canonical Signal object (27 fields + lifecycle states), Problem object schema, 17 signal types, 15 problem types, full inference pipeline from capture through Score Council to Mission Control, multi-opportunity fan-out examples, and tiered AI cost rules (rules-first; LLM on <5% of signals). Recommended Phase 2.1 build sequence: signal store → manual ingest → first connector. No implementation authorized.  
**Links:** [22-signal-and-problem-pipeline.md](./22-signal-and-problem-pipeline.md), [08-current-phase.md](./08-current-phase.md)

---

### 2026-06-23 — Phase 2.1 Signal registry and lifecycle
**Phase:** 2.1  
**Type:** Milestone  
**Summary:** Implemented append-only signal registry at `engine-data/signals/signals.json` and `src/engine/signals/` with create, normalize, state transitions, lifecycle audit trail, and query helpers. Observation fields are immutable on state advance. Validated transitions per pipeline doc. No connectors or problem inference. Validation: `scripts/opportunity-engine/validate-phase-2-1.js`.  
**Links:** `src/engine/signals/`, `engine-data/signals/signals.json`, [22-signal-and-problem-pipeline.md](./22-signal-and-problem-pipeline.md)

---

### 2026-06-23 — Phase 2.1.5 World Model (design)
**Phase:** 2.1.5  
**Type:** Constitution  
**Summary:** Defined the World Model reasoning spine: Reality → Observation → Signal → Fact → Relationship → Problem → Capability Match → Offer → Opportunity → Execution → Outcome → Learning → Forecast. Established connector rules (Signals only), canonical Fact schema, relationship types, problem inference modes, opportunity creation gates, five walkthrough examples, and tiered AI rules. Phase 2.2 blocked until owner approves.  
**Links:** [23-world-model.md](./23-world-model.md), [08-current-phase.md](./08-current-phase.md)

---

### 2026-06-23 — Phase 2.2 Manual observation ingestion
**Phase:** 2.2  
**Type:** Milestone  
**Summary:** Implemented sacred raw observation archive (`engine-data/signals/raw/`), manual CLI ingest script, rules-only normalization and classification, and full workflow through `classified` state without facts, problems, or opportunities. Extended registry summary metrics. Validation: `scripts/opportunity-engine/validate-phase-2-2.js`.  
**Links:** `scripts/opportunity-engine/ingest-signal.js`, `src/engine/signals/observations.js`, `src/engine/signals/classify.js`, `src/engine/signals/ingest-manual.js`

---

### 2026-06-27 — Autopilot controller (status + preflight check)
**Phase:** Tooling  
**Type:** Milestone  
**Summary:** Added autopilot status/check scripts that read current phase docs, git state, and validation script presence; emit `reports/autopilot-status.md` and `reports/autopilot-log.json`. Preflight fails on dirty git, blocked next subphase, or missing validators. npm scripts: `autopilot:status`, `autopilot:check`.  
**Links:** `scripts/opportunity-engine/autopilot-status.js`, `scripts/opportunity-engine/autopilot-check.js`

---

### 2026-06-27 — Phase 2.2.5 Connector SDK and runtime architecture
**Phase:** 2.2.5  
**Type:** Milestone  
**Summary:** Introduced `runtime/` gitignored operational data layer, runtime path module, signal store adapter (legacy read + runtime write), transitional Connector SDK with demo connector only, and validation ensuring live ingest does not dirty git. Superseded by Sensor Framework in Phase 2.3.  
**Links:** [24-runtime-data-boundaries.md](./24-runtime-data-boundaries.md), `src/engine/runtime/`, `src/engine/connectors/`

---

### 2026-06-27 — Phase 2.3 Sensor Framework
**Phase:** 2.3  
**Type:** Milestone  
**Summary:** Replaced Connectors with permanent Sensor Framework (`src/engine/sensors/`). Added sensor manager, lifecycle states, health metrics, and three static demo sensors (Web, Document, CRM). Sensors publish only through Observation/Signal pipeline to runtime storage. Connectors module deprecated as shim.  
**Links:** [25-sensor-framework.md](./25-sensor-framework.md), `scripts/opportunity-engine/validate-phase-2-3.js`

---

### 2026-06-27 — Phase 2.4 Fact Builder + Knowledge Graph Bridge
**Phase:** 2.4  
**Type:** Milestone  
**Summary:** Added runtime-backed fact store (`runtime/facts/facts.json`), rules-only Fact Builder (`buildFactsFromSignal`, `processSignalIntoFacts`), and Knowledge Graph Bridge projection layer (nodes/edges, no graph DB). Facts are append-only evidence derived from classified signals. Problems and opportunities remain blocked.  
**Links:** `src/engine/facts/`, `src/engine/fact-builder/`, `src/engine/knowledge-graph/`, `scripts/opportunity-engine/validate-phase-2-4.js`

---

### 2026-06-27 — Phase 2.5 Relationship Builder + Graph Enrichment
**Phase:** 2.5  
**Type:** Milestone  
**Summary:** Added persistent runtime graph store (`runtime/graph/graph.json`), rules-only entity resolution with aliases, Relationship Builder from facts to typed edges, and knowledge-graph enrichment queries. Relationship events append-only. Problems remain blocked until Phase 2.6.  
**Links:** `src/engine/graph-store/`, `src/engine/entity-resolution/`, `src/engine/relationship-builder/`, `scripts/opportunity-engine/validate-phase-2-5.js`

---

### 2026-06-27 — Phase 2.5.5 Situation Builder
**Phase:** 2.5.5  
**Type:** Milestone  
**Summary:** Added runtime situation store (`runtime/situations/situations.json`), rules-only Situation Builder clustering connected graph evidence, situation lifecycle states, template summaries, and knowledge-graph situation integration. Situations are the required semantic boundary before Problem Inference.  
**Links:** `src/engine/situations/`, `src/engine/situation-builder/`, `scripts/opportunity-engine/validate-phase-2-5-5.js`

---

### 2026-06-27 — Phase 2.5.8 Reasoning Engine Constitution
**Phase:** 2.5.8  
**Type:** Design · Constitution amendment  
**Summary:** Authored permanent reasoning architecture in `26-reasoning-engine.md`. Design only — no code.  
**Links:** [26-reasoning-engine.md](./26-reasoning-engine.md)

---

### 2026-06-27 — Phase 2.6 Problem Inference Engine
**Phase:** 2.6  
**Type:** Milestone  
**Summary:** Implemented reasoning pipeline: hypothesis store, generator, evidence engine, confidence engine, contradiction detector, problem store, and `inferProblems()` promotion with explainability bundles. Rules-only — no LLM. Capability matching remains blocked.  
**Links:** `src/engine/problem-inference/`, `scripts/opportunity-engine/validate-phase-2-6.js`

---

### 2026-06-27 — Phase 2.6.5 Capability Intelligence Constitution
**Phase:** 2.6.5  
**Type:** Design · Constitution amendment  
**Summary:** Authored permanent Capability Intelligence architecture in `27-capability-intelligence.md`. Defines capability taxonomy, extended schema, matching pipeline (Problem → Recommended Capabilities → STOP), fit score vs opportunity score, constraints, multi-capability composition, explainability, partner ecosystem, learning calibration, and rules CI1–CI15. Extends [05-capability-registry.md](./05-capability-registry.md). Design only — no code.  
**Links:** [27-capability-intelligence.md](./27-capability-intelligence.md)

---

### 2026-06-27 — Phase 2.7 Capability Matching Engine
**Phase:** 2.7  
**Type:** Milestone  
**Summary:** Implemented deterministic capability matching: `matchCapabilities(problem)` with candidate discovery, dimensional fit scoring, constraint filtering, composition planning, and explainability bundles. Enriched `engine-data/capabilities/capabilities.json` with constraint and performance fields. Runtime store at `runtime/capability-matches/`. Problem inference now copies `entityContext` (location) onto promoted Problems. Offer Intelligence remains blocked.  
**Links:** `src/engine/capability-matcher/`, `src/engine/capability-matches/`, `scripts/opportunity-engine/validate-phase-2-7.js`

---

### 2026-06-27 — Owner approval: Phase 2.7 + Architecture Freeze
**Phase:** 2.7  
**Type:** Decision · Owner policy  
**Summary:** Owner approved Phase 2.7 (Capability Matching Engine). Architecture frozen from this point: Phases 2.8+ implement existing Constitution ([26-reasoning-engine.md](./26-reasoning-engine.md), [27-capability-intelligence.md](./27-capability-intelligence.md)) without redesign. Constitution amendments permitted only when implementation reveals a **genuine deficiency** — documented in Build Log with owner sign-off. See [07-architecture-rules.md R26–R30](./07-architecture-rules.md#architecture-freeze-owner-policy--phase-27).  
**Links:** [08-current-phase.md](./08-current-phase.md)

---

### 2026-06-27 — Phase 2.8 Offer Intelligence
**Phase:** 2.8  
**Type:** Milestone  
**Summary:** Implemented offer selection pipeline: `recommendOffers(capabilityMatch)` with candidate offers, eligibility checks, commercial offer fit scoring, ranking, and explainability. Consumes capability matches only — not Problems directly. Runtime store at `runtime/offer-recommendations/`.  
**Links:** `src/engine/offer-intelligence/`, `src/engine/offer-recommendations/`, `scripts/opportunity-engine/validate-phase-2-8.js`

---

### 2026-06-23 — Phase 3.1 Job & Event Runtime
**Phase:** 3.1  
**Type:** Milestone  
**Summary:** Implemented operating-loop kernel: append-only `runtime/events/events.jsonl`, mutable `runtime/jobs/jobs.json`, `src/engine/events/` and `src/engine/jobs/` with full job lifecycle API, idempotency dedupe, dead-letter on maxAttempts, job transition events, and atomic runtime IO. No scheduler, timers, or background processing.  
**Links:** `src/engine/events/`, `src/engine/jobs/`, `scripts/opportunity-engine/validate-phase-3-1.js`, [28-autonomous-operating-loop.md](./28-autonomous-operating-loop.md)

---

### 2026-06-23 — Phase 3.0.5 Autonomous Operating Loop Constitution
**Phase:** 3.0.5  
**Type:** Constitution  
**Summary:** Defined the Autonomous Operating Loop: canonical cycle from Sensor Run through Learning; Job and Event schemas; scheduler rules (cadence, queue, retry, dedupe); system states; failure handling and idempotency; single-process concurrency policy; Autopilot/Mission Control/OpenClaw role boundaries; Phase 3.1–3.5 sub-roadmap. Design only — no production code, runtime folders, validators, connectors, or UI changes.  
**Links:** [28-autonomous-operating-loop.md](./28-autonomous-operating-loop.md)

---

### 2026-06-23 — Phase 2.9.5 Core Stability
**Phase:** 2.9.5  
**Type:** Milestone  
**Summary:** Hardened runtime IO with atomic writes and Windows/OneDrive retry behavior (`src/engine/runtime/io.js`). Updated all runtime-backed stores to use shared helpers. Added `validate-core.js` orchestrator, `runtime-health.js`, `performance-baseline.js`, and Phase 2.9.5 validator. Generated monitoring reports (`core-validation`, `runtime-health`, `performance-baseline`, autopilot) are gitignored; autopilot blocks only on real source/docs changes and owner-approval gates. Phase 3 remains blocked.  
**Links:** `src/engine/runtime/io.js`, `scripts/opportunity-engine/validate-core.js`, `scripts/opportunity-engine/runtime-health.js`, `scripts/opportunity-engine/performance-baseline.js`, `scripts/opportunity-engine/validate-phase-2-9-5.js`

---

### 2026-06-28 — Phase 2.9 Opportunity Factory
**Phase:** 2.9  
**Type:** Milestone  
**Summary:** Implemented Opportunity Factory: `buildOpportunity()` assembles Problem + Capability Match + Offer Recommendation into validated runtime opportunities. Added `opportunity-validator`, structured explainability, lifecycle states, and `runtime/opportunities/` store. Commercial Intelligence pipeline complete. Score Council unchanged — next consumer. Legacy radar generation preserved in `opportunities/radar.js`.  
**Links:** `src/engine/opportunity-factory/`, `src/engine/opportunity-validator/`, `scripts/opportunity-engine/validate-phase-2-9.js`

---

## Future Entries (Reserved)

<!-- Phase 3 Score Council integration / Mission Control projection -->
<!-- Phase 2.3 first production connector -->
<!-- Phase 3 problem-centric factory -->
<!-- Phase 4 execution plan E2E -->
<!-- Phase 5 first calibrated forecast -->

---

## Amendment Log

| Date | Change |
|---|---|
| 2026-06-23 | Phase 3.1 Job & Event Runtime — loop kernel, idempotency, dead-letter |
| 2026-06-23 | Phase 3.0.5 Autonomous Operating Loop Constitution — Job/Event model, scheduler, AOL1–AOL15 |
| 2026-06-23 | Phase 2.9.5 Core Stability — runtime IO hardening, validate-core, generated report policy |
| 2026-06-28 | Phase 2.9 Opportunity Factory — Commercial Intelligence complete |
| 2026-06-27 | Phase 2.8 Offer Intelligence milestone |
| 2026-06-27 | Architecture freeze policy (R26–R30) — owner approved Phase 2.7 |
| 2026-06-23 | Initial Constitution build log created |
