# 01 — Roadmap

**Status:** Constitution · Phase 0  
**Related:** [Master Vision](./00-master-vision.md) · [Current Phase](./08-current-phase.md) · [Build Log](./09-build-log.md) · [Architecture Rules](./07-architecture-rules.md)

---

## Phase Overview

| Phase | Name | Purpose (one line) |
|---|---|---|
| **0** | AI Constitution | Define permanent architecture |
| **1** | Executive OS | CEO-facing decision terminal + core engine |
| **2** | Live Signal Engine | Continuous world monitoring |
| **3** | Reasoning Engine | Signals → problems → opportunities |
| **4** | Execution Engine | Plans, assets, dispatch, closure |
| **5** | Learning + Forecasting | Calibrate, predict, compound |

**Do not add phases.** Scope changes amend this document.

---

## Phase 0 — AI Constitution

### Purpose
Permanently define ontology, graph, scoring, agents, boundaries, and rules before feature velocity destroys architecture.

### Goals
- Complete `docs/opportunity-os/` (this folder)
- Align terminology across engine, schema, and legacy
- Record current repo state honestly in [Folder Map](./13-folder-map.md) and [Project History](./20-project-history.md)
- Identify ambiguities before Phase 1

### Deliverables
- All Constitution documents (00–20)
- Cross-linked glossary and ontology
- Initialized [Build Log](./09-build-log.md) and [Current Phase](./08-current-phase.md)

### Exit Criteria
- Constitution reviewed and approved by project owner
- No open **P0 architectural decisions** (see Phase 0 close-out in implementation report)
- Phase 1 work explicitly authorized in [Current Phase](./08-current-phase.md)

### Dependencies
- None

---

## Phase 1 — Executive OS

### Purpose
Deliver the **Executive Terminal**: mission focus, opportunity radar, evidence drill-down, CEO modes — powered by `src/engine/` as source of truth.

### Goals
- Wire Pivotal OS pages to engine projections (home, opportunities, actions, campaigns)
- Implement **Score Council** (multi-engine, no single score) — [Decision Engine](./06-decision-engine.md)
- Capability registry v1 aligned with [05-capability-registry.md](./05-capability-registry.md)
- Evidence assembler: every ranked opportunity shows provenance
- Consolidate read path: engine → projections; legacy as adapter only where required

### Deliverables
- Executive dashboard backed by `buildOpportunityRadar()` and extensions
- CEO mode switching with weighted score vectors
- Capability and offer data in `engine-data/` aligned to registry
- Validation scripts for radar and scoring regression
- Updated [Build Log](./09-build-log.md)

### Exit Criteria
- Top opportunity, evidence, and recommended action visible without legacy JSON as primary read path for radar
- Score council produces independent subscores + mode-weighted composite
- Stub pages (`opportunities.js`, `actions.js`, `campaigns.js`) replaced with engine-backed views
- Schema dual-read flags documented; legacy writes not expanded

### Dependencies
- Phase 0 approved
- [Ontology](./02-ontology.md) v1 frozen for Phase 1 objects
- [API Boundaries](./15-api-boundaries.md) respected

---

## Phase 2 — Live Signal Engine

### Purpose
Continuously ingest, normalize, deduplicate, and store **Signals** from configured world sources.

### Goals
- Unified signal pipeline extending `discovery-adapters` patterns
- Tier-0 rules → Tier-1 embeddings → Tier-2 LLM extraction — [Performance](./18-performance.md)
- Signal state machine — [State Machines](./04-state-machines.md)
- Write signals and facts to canonical stores / event log
- Connector registry with legal class and refresh SLA

### Deliverables
- Signal normalizer schema — [Data Model](./14-data-model.md)
- Initial connector set (prioritized: permits, news, RFPs, press, hiring — not all 25 at once)
- Dedup engine (hash + embedding near-dup)
- Ingestion schedulers and observability
- Signal → Fact extraction with provenance

### Exit Criteria
- ≥5 production signal sources feeding graph/fact store
- Dedup rate and extraction quality metrics published
- No LLM-on-every-signal at default tier
- Signals link to entities in knowledge graph

### Dependencies
- Phase 1 event/store conventions
- [Knowledge Graph](./03-knowledge-graph.md) write path defined
- [Security](./17-security.md) connector credential model

---

## Phase 3 — Reasoning Engine

### Purpose
Convert signals and facts into **Problems**, match **Capabilities**, compose **Offers**, and create **Opportunity** candidates (multi-fan-out).

### Goals
- Problem inference (multi-hypothesis per signal cluster)
- Capability matcher (problem-centric, not industry-centric)
- Opportunity factory v2 replacing industry×offer as primary logic
- Evidence chains assembled for every opportunity
- Agent orchestration for reasoning tiers — [AI Agents](./12-ai-agents.md)

### Deliverables
- Problem taxonomy v1 linked to [Capability Registry](./05-capability-registry.md)
- Reasoning pipeline: Signal → Fact → Problem → Opportunity
- Multi-opportunity fan-out from single signal (test case: hospital expansion)
- Reasoning regression fixtures

### Exit Criteria
- One signal → N opportunities demonstrated with shared evidence root
- Problems are first-class objects, not industry tags
- Radar ranks problem-backed opportunities
- Human-readable evidence for every inference

### Dependencies
- Phase 2 signal and fact volume
- Phase 1 score council integration
- [Testing Strategy](./16-testing-strategy.md) reasoning fixtures

---

## Phase 4 — Execution Engine

### Purpose
For approved opportunities, produce **Execution Plans**: who, when, how, assets, sequence, autonomy gates, outcomes.

### Goals
- Execution plan graph (not CRM activity lists as truth)
- Channel and timing selection models
- Asset generation (draft tier) with evidence grounding
- Dispatch adapters: email, phone, visit, calendar — wrap existing Twilio/sales-mode as adapters
- Autonomy policy and human approval gates — [Security](./17-security.md)

### Deliverables
- Execution Plan + Task state machines — [State Machines](./04-state-machines.md)
- Sequence DSL or declarative playbook format
- Integration adapters for legacy execution UIs
- Outcome capture → graph

### Exit Criteria
- End-to-end: ranked opportunity → plan → human-approved action → outcome recorded
- No new business logic in CRM projection layers
- Autonomy levels enforced per action type

### Dependencies
- Phase 3 opportunities with scores and evidence
- Phase 1 CEO terminal for approval UX
- Operator auth from [Security](./17-security.md)

---

## Phase 5 — Learning + Forecasting

### Purpose
Calibrate scores, mine playbooks, predict problem emergence before competitors.

### Goals
- Outcome-driven calibration of Probability and Revenue engines
- Playbook learning from wins/losses/objections
- Precursor signal library
- Forecast objects with backtest metrics
- Learning loops — [Design Principles](./11-design-principles.md)

### Deliverables
- LearningReport pipeline (extends `schema/learning-report.js`)
- Forecast features and precursor registry
- Calibration dashboard (Brier scores, forecast vs actual)
- Weekly batch learning jobs

### Exit Criteria
- Score council weights updatable from outcomes
- ≥1 forecast type backtested on historical data
- Learning updates models, not just dashboards
- Documented forecast accuracy and limits

### Dependencies
- Phase 4 outcome volume
- Phase 2 signal history depth
- [Data Model](./14-data-model.md) Learning and Forecast objects

---

## Current Repo Position (Honest)

| Phase | Approximate progress |
|---|---|
| 0 | In progress (this Constitution) |
| 1 | ~25–30% (engine MVP, home radar, schema services, stub pages) |
| 2 | ~10% (discovery adapters, ingest scripts) |
| 3 | ~15% (basic opportunity factory, intelligence radar) |
| 4 | ~20% mechanics / ~5% OS vision (sales-mode, Twilio as legacy) |
| 5 | ~5% (learning-report schema entity only) |

See [Project History](./20-project-history.md) and [Build Log](./09-build-log.md).
