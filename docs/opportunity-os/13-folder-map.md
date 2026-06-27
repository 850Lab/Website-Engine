# 13 — Folder Map

**Status:** Constitution · Repository layout  
**Related:** [Architecture Rules](./07-architecture-rules.md) · [API Boundaries](./15-api-boundaries.md) · [Project History](./20-project-history.md)

**Package name:** `website-outreach-engine` (historical — rename is [Future Ideas](./19-future-ideas.md))

---

## Truth & Engine

| Path | Purpose | Owner | Dependencies | Future direction |
|---|---|---|---|---|
| **`src/engine/`** | Opportunity logic: radar, factory, scoring, mission, execution projections | Platform / OS team | `engine-data/`, `data/` reads | Problem factory Phase 3; sole business logic home |
| **`src/engine/capabilities/`** | Load capability registry | Platform | `engine-data/capabilities/` | Used by offers join + future factory |
| **`src/engine/score-council/`** | Independent score engines + CEO mode weighting | Platform | opportunity fields | Learning calibration Phase 5 |
| **`engine-data/`** | Config: offers, markets, campaigns (CEO/mission config) | Product / CEO | None | Add `ceo-modes/` when Phase 1 UI lands |
| **`engine-data/capabilities/`** | First-class capability registry JSON | Product / Platform | `engine-data/offers/` | Expand capabilities; link to problem taxonomy Phase 3 |
| **`engine-data/signals/`** | Canonical signal registry (Phase 2.1) | Signal / Platform | None | Connectors write here; append-only JSON until graph decision |
| **`src/engine/signals/`** | Signal registry API: create, normalize, lifecycle | Platform | `engine-data/signals/` | Dedup classifier, entity link, problem inference in later phases |
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
| **`src/discovery-adapters/`** | Adapter registry and source schemas | Signal team | — | Become connector registry core (Phase 2.3+) |
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
| **`scripts/opportunity-engine/`** | CLI reports + phase validation | OS team | `src/engine/` | `validate-phase-2-1.js`, future manual ingest |
| **`scripts/validate-*`**, **`verify-*`** | Migration and schema validation | Platform | Pattern for all phases |
| **`scripts/website-find-leads.js`**, **`pw-find-leads.js`** | Discovery CLIs | Signal | Connector harnesses |
| **`reports/`** | Generated markdown outputs | OS team | Executive report templates |

---

## Docs

| Path | Purpose |
|---|---|
| **`docs/opportunity-os/`** | **AI Constitution (this folder)** — supreme architecture |
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
