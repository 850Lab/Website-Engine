# 13 — Folder Map

**Status:** Constitution · Repository layout  
**Related:** [Architecture Rules](./07-architecture-rules.md) · [API Boundaries](./15-api-boundaries.md) · [Project History](./20-project-history.md) · [World Model](./23-world-model.md)

**Package name:** `website-outreach-engine` (historical — rename is [Future Ideas](./19-future-ideas.md))

---

## Truth & Engine

| Path | Purpose | Owner | Dependencies | Future direction |
|---|---|---|---|---|
| **`src/engine/`** | Opportunity logic: radar, factory, scoring, mission, execution projections | Platform / OS team | `engine-data/`, `data/` reads | Problem factory Phase 3; sole business logic home |
| **`src/engine/capabilities/`** | Load + normalize capability registry (Phase 2.7) | Platform | `engine-data/capabilities/` | Matcher, offers join, factory |
| **`src/engine/score-council/`** | Independent score engines + CEO mode weighting | Platform | opportunity fields | Learning calibration Phase 5 |
| **`engine-data/`** | Config: offers, markets, campaigns (CEO/mission config) | Product / CEO | None | Add `ceo-modes/` when Phase 1 UI lands |
| **`engine-data/capabilities/`** | First-class capability registry JSON | Product / Platform | `engine-data/offers/` | Expand capabilities; link to problem taxonomy Phase 3 |
| **`runtime/`** | Live operational data: signals, facts, graph, situations, hypotheses, problems, capability-matches, offer-recommendations, opportunities, events, jobs, logs, cache (gitignored) | Platform | None | Default local runtime |
| **`src/engine/situations/`** | Runtime-backed situation store + lifecycle (Phase 2.5.5) | Platform | `runtime/situations/` | Required input for Problem Inference |
| **`src/engine/situation-builder/`** | Rules-only graph clustering into situations | Platform | `graph-store/`, `situations/` | No LLM; template summaries only |
| **`src/engine/hypotheses/`** | Runtime hypothesis store (Phase 2.6) | Platform | `runtime/hypotheses/` | Problem inference input |
| **`src/engine/hypothesis-generator/`** | Situation → hypothesis templates | Platform | `situations/` | Situations only |
| **`src/engine/evidence-engine/`** | Evidence collection + tiers | Platform | situations, facts, graph | By reference |
| **`src/engine/confidence-engine/`** | Traceable confidence propagation | Platform | evidence-engine | No invented confidence |
| **`src/engine/contradictions/`** | Competing hypothesis detection | Platform | hypotheses | Visible conflicts |
| **`src/engine/problems/`** | Runtime problem store (Phase 2.6) | Platform | `runtime/problems/` | Immutable conclusions |
| **`src/engine/problem-inference/`** | `inferProblems()` promotion pipeline | Platform | reasoning modules | Stops before capability matching |
| **`src/engine/capability-matcher/`** | Deterministic Problem → Capability fit (Phase 2.7) | Platform | `capabilities/`, `problems/` | Stops before Offer Intelligence |
| **`src/engine/capability-matches/`** | Runtime capability recommendation store (Phase 2.7) | Platform | `runtime/capability-matches/` | Append-only audit trail |
| **`src/engine/offer-intelligence/`** | Capability match → offer fit pipeline (Phase 2.8) | Platform | `capability-matches/`, `offers/` | Stops before Opportunity Factory |
| **`src/engine/offer-recommendations/`** | Runtime offer recommendation store (Phase 2.8) | Platform | `runtime/offer-recommendations/` | Append-only audit trail |
| **`src/engine/opportunity-factory/`** | Problem + match + offer → Opportunity assembly (Phase 2.9) | Platform | problems, capability-matches, offer-recommendations | Stops before Score Council |
| **`src/engine/opportunity-validator/`** | Opportunity completeness validation (Phase 2.9) | Platform | opportunity-factory output | Rejects incomplete assemblies |
| **`src/engine/opportunities/`** | Runtime opportunity store + legacy radar (`radar.js`) | Platform | `runtime/opportunities/` | Score Council next consumer |
| **`runtime/events/`** | Append-only operating-loop event log (Phase 3.1) | Platform | None | `events.jsonl` gitignored |
| **`runtime/jobs/`** | Operating-loop job queue store (Phase 3.1) | Platform | None | `jobs.json` gitignored |
| **`src/engine/events/`** | Event store API — append-only audit log (Phase 3.1) | Platform | `runtime/events/` | Job transition events |
| **`src/engine/jobs/`** | Job store API — lifecycle + idempotency (Phase 3.1) | Platform | `runtime/jobs/`, `engine/events/` | No scheduler in 3.1 |
| **`src/engine/runtime/`** | Runtime path helpers + atomic IO (`io.js`, Phase 2.9.5) | Platform | `runtime/` | Storage boundary for all runtime stores |
| **`src/engine/graph-store/`** | Persistent runtime graph store (Phase 2.5) | Platform | `runtime/graph/` | Graph DB later |
| **`src/engine/entity-resolution/`** | Rules-only entity normalization + aliases | Platform | `graph-store/` | No fuzzy merge in v0 |
| **`src/engine/relationship-builder/`** | Fact → relationship projection | Platform | `facts/`, `graph-store/`, `entity-resolution/` | No problem inference |
| **`src/engine/sensors/`** | Sensor Framework registry + lifecycle + health (Phase 2.3) | Signal / Platform | `src/engine/signals/`, `runtime/` | Production sensors in Phase 2.4+ |
| **`src/engine/facts/`** | Runtime-backed append-only fact store (Phase 2.4) | Signal / Platform | `runtime/facts/`, signals | Problem inference blocked |
| **`src/engine/fact-builder/`** | Rules-only fact extraction from signals | Signal / Platform | `facts/`, `signals/` | No LLM; conservative predicates |
| **`src/engine/knowledge-graph/`** | Graph projection bridge (nodes/edges) | Platform | `facts/` | Graph DB later; Phase 2.5 enrichment |
| **`src/engine/connectors/`** | **Deprecated** shim over sensors (Phase 2.2.5 regression) | Signal / Platform | `src/engine/sensors/` | Do not add new connectors |
| **`engine-data/signals/`** | Legacy/historical signal seed (read-compatible) | Signal / Platform | None | New writes go to `runtime/signals/` |
| **`src/schema/`** | Locked 8-entity persistence schema | Platform | `data/*.json` | Converge with Constitution ontology gradually |
| **`src/services/`** | Schema service layer, flags, id-bridge, dual-read, schema queue/outcomes | Platform | `schema/`, legacy stores | Shrink as graph writer replaces bridges |

---

## Experience (Projections)

| Path | Purpose | Owner | Dependencies | Future direction |
|---|---|---|---|---|
| **`src/pivotal-os/`** | Executive terminal UI (shell, pages, routes) | Product | `engine/` | Engine-backed only; stub pages → live |
| **`src/mission-control/`** | Legacy website sales mode UI + routes | Migration | legacy + services | Execution adapter; deprecate logic |
| **`src/pressure-washing/`** | Legacy PW operator UI + lead store | Migration | legacy JSON | Execution adapter |
| **`src/outreach-focus/`** | Focus config, metrics, queue sort overlay | Product | legacy + schema reads | Move focus config to `engine-data/` |
| **`src/operators/`** | Auth, sessions, lead assignment | Platform | legacy stores | Assignment → schema/graph |

---

## Discovery & Signals (Phase 2 seeds)

| Path | Purpose | Owner | Dependencies | Future direction |
|---|---|---|---|---|
| **`src/discovery-adapters/`** | Adapter registry and source schemas | Signal team | — | Converge to Sensor Framework (Phase 2.4+) |
| **`src/discovery/`** | Dedup, funnel, run-query | Signal team | `data/` | Merge into signal pipeline |
| **`src/pipeline/ingest-discovery.js`** | Discovery → identity → qualification → legacy/schema | Signal team | stage1, identity | Emit Signals/Facts instead of QB-only |
| **`src/opportunity-engine/`** | Distributed discovery jobs, worker, reports | Signal team | pg optional | Job orchestration for connectors |

---

## Legacy & Migration

| Path | Purpose | Owner | Dependencies | Future direction |
|---|---|---|---|---|
| **`data/`** | JSON persistence (businesses, contacts, legacy CRM files) | Platform | blob optional | Graph/event log migration |
| **`src/stage1/`** | Qualified business store, qualification, admin routes | Legacy | `data/` | Read-only adapter |
| **`src/angle-analysis/`** | Angle enrichment batch jobs | Legacy enrichment | `angle-analyses.json` | Capability/problem enrichment |
| **`src/sales-brief/`** | Copy templates and industry rules | Content | — | Move to capability playbooks |
| **`scripts/migration/`** | Legacy → schema migration | Platform | `data/` | Archive after cutover |

---

## Execution Adapters

| Path | Purpose | Owner | Dependencies | Future direction |
|---|---|---|---|---|
| **`src/twilio-voice/`** | Recorded calls, webhooks, call sessions | Execution | Twilio API | Task dispatcher adapter |
| **`src/enrichment/`** | Contact enrichment | Signal/Execution | external | Fact pipeline |

---

## Website Product Legacy (Not OS Core)

| Path | Purpose | Owner | Future direction |
|---|---|---|---|
| **`src/v7/`**, **`src/preview-v3.js`** | Customer preview sites, billing, funnel | Separate product line | Remain adapter or extract repo |
| **`src/design-system/`** | Preview theming | Design | Unchanged |
| **`previews-v3/`**, **`renders/`** | Static assets | Ops | Unchanged |

---

## Scripts & Reports

| Path | Purpose | Owner | Future direction |
|---|---|---|---|
| **`scripts/opportunity-engine/`** | CLI reports, validation, manual ingest | OS team | `validate-phase-3-1.js`, `validate-core.js`, `runtime-health.js`, `ingest-signal.js` |
| **`scripts/validate-*`**, **`verify-*`** | Migration and schema validation | Platform | Pattern for all phases |
| **`scripts/website-find-leads.js`**, **`pw-find-leads.js`** | Discovery CLIs | Signal | Connector harnesses |
| **`reports/`** | Generated markdown/JSON outputs (local; most gitignored) | OS team | `core-validation.*`, `runtime-health.*`, `performance-baseline.*`, autopilot reports |

---

## Docs

| Path | Purpose |
|---|---|
| **`docs/opportunity-os/`** | AI Constitution — supreme architecture |
| **`docs/opportunity-os/23-world-model.md`** | World Model chain and sensor rules |
| **`docs/opportunity-os/25-sensor-framework.md`** | Sensor interface, lifecycle, health, runtime integration |
| **`docs/opportunity-os/26-reasoning-engine.md`** | Reasoning pipeline, hypothesis/problem schemas, confidence, Phase 2.6 implementation |
| **`docs/opportunity-os/27-capability-intelligence.md`** | Capability Intelligence Constitution — matching pipeline, fit score, constraints, composition, CI1–CI15, Phase 2.7–2.9 roadmap |
| **`docs/opportunity-os/28-autonomous-operating-loop.md`** | Autonomous Operating Loop Constitution — Job/Event model, scheduler, system state, idempotency, AOL1–AOL15, Phase 3.1–3.5 roadmap |
| **`docs/*.md`** | Legacy product docs — do not override Constitution |

---

## Entry Points

| Path | Role |
|---|---|
| **`src/server.js`** | Express app registering all routes |
| **`package.json`** | Scripts for server, migration, validation |
| **`api/index.js`** | Serverless entry |

---

## Dependency Rule Summary

```
engine-data ──→ engine ──→ pivotal-os (UI)
                  ↑
data/schema ← services ← (migration adapters ← legacy modules)
```

New code: **downward** dependencies only. Engine must not import `mission-control` or `pressure-washing` logic.

See [Architecture Rules R7–R9](./07-architecture-rules.md).
