# 08 — Current Phase

**Status:** Living document · update when phase changes  
**Related:** [Roadmap](./01-roadmap.md) · [Build Log](./09-build-log.md) · [World Model](./23-world-model.md) · [Sensor Framework](./25-sensor-framework.md)

---

## Current Phase

**Phase 2.4 — Fact Builder + Knowledge Graph Bridge** — **COMPLETE**

Phase 2.5 is **blocked** until owner approves and issues an explicit implementation prompt.

---

## Phase 2.4 Objective

Extract deterministic **Facts** from classified **Signals** and project them into a lightweight **Knowledge Graph Bridge** (nodes + edges in memory/runtime JSON). No problem inference. No opportunities.

Run: `node scripts/opportunity-engine/validate-phase-2-4.js`

---

## Phase 2.4 Checklist

- [x] `runtime/facts/` — runtime-backed fact store
- [x] `src/engine/facts/` — append-only fact registry
- [x] `src/engine/fact-builder/` — rules-only `buildFactsFromSignal()`
- [x] `src/engine/fact-builder/pipeline.js` — `processSignalIntoFacts()`
- [x] `src/engine/knowledge-graph/` — graph projection bridge
- [x] `scripts/opportunity-engine/validate-phase-2-4.js`
- [x] Validation passed
- [x] No LLM, external APIs, problems, opportunities, or Mission Control changes

---

## Active Rules (Phase 2.4)

| Rule | Status |
|---|---|
| Facts are evidence; problems are interpretation | **Enforced** |
| Facts derived from signals only (`signalIds` required) | **Enforced** |
| Append-only facts in `runtime/facts/facts.json` | **Enforced** |
| Graph bridge projects nodes/edges only | **Enforced** |
| Stop at fact creation — no `problem_inferred` transition | **Enforced** |
| Phase 2.5 blocked until owner approval | **Enforced** |

---

## Phase 2.5 (Blocked)

**Relationship Builder / Graph enrichment** — not Problem Inference.

Requires owner approval and explicit implementation prompt.

---

## Prior Phases — COMPLETE

### Phase 2.3 — Sensor Framework

Run: `node scripts/opportunity-engine/validate-phase-2-3.js`

### Phase 2.2.5 — Connector SDK & Runtime

Run: `node scripts/opportunity-engine/validate-phase-2-2-5.js`

### Phase 2.2 — Manual Observation Ingestion

Run: `node scripts/opportunity-engine/validate-phase-2-2.js`

---

## Decision Log

| Date | Decision |
|---|---|
| 2026-06-27 | Phase 2.3: Sensor Framework replaces Connectors as canonical observation model |
| 2026-06-27 | Phase 2.4: Fact Builder + Knowledge Graph Bridge; problems remain blocked |
| 2026-06-27 | Phase 2.5 reserved for Relationship Builder / graph enrichment — not Problem Inference |

Add entries to [Build Log](./09-build-log.md) for architectural milestones.
