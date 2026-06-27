# 08 — Current Phase

**Status:** Living document · update when phase changes  
**Related:** [Roadmap](./01-roadmap.md) · [Build Log](./09-build-log.md) · [World Model](./23-world-model.md) · [Sensor Framework](./25-sensor-framework.md)

---

## Current Phase

**Phase 2.5 — Relationship Builder + Graph Enrichment** — **COMPLETE**

Phase 2.6 is **blocked** until owner approves and issues an explicit implementation prompt.

---

## Phase 2.5 Objective

Turn facts into **structure**: entity resolution, typed relationships, and a **persistent runtime graph** — without problem inference or opportunities.

Run: `node scripts/opportunity-engine/validate-phase-2-5.js`

---

## Phase 2.5 Checklist

- [x] `runtime/graph/` — persistent graph store
- [x] `src/engine/graph-store/` — runtime-backed nodes, edges, aliases, events
- [x] `src/engine/entity-resolution/` — rules-only label normalization + aliases
- [x] `src/engine/relationship-builder/` — fact → relationship projection
- [x] `src/engine/knowledge-graph/` — persistent reads + neighborhood queries
- [x] `scripts/opportunity-engine/validate-phase-2-5.js`
- [x] Validation passed
- [x] Phase 2.4 regression passes
- [x] No problems, opportunities, LLM, or Mission Control changes

---

## Active Rules (Phase 2.5)

| Rule | Status |
|---|---|
| Facts are evidence; relationships are structure | **Enforced** |
| Problems are interpretation — still blocked | **Enforced** |
| Graph writes in `runtime/graph/graph.json` only | **Enforced** |
| Relationship events append-only audit trail | **Enforced** |
| Every edge references ≥1 `factId` | **Enforced** |
| Phase 2.6 blocked until owner approval | **Enforced** |

---

## Phase 2.6 (Blocked)

**Problem Inference** — not started.

Requires owner approval and explicit implementation prompt.

---

## Prior Phases — COMPLETE

### Phase 2.4 — Fact Builder + Knowledge Graph Bridge

Run: `node scripts/opportunity-engine/validate-phase-2-4.js`

### Phase 2.3 — Sensor Framework

Run: `node scripts/opportunity-engine/validate-phase-2-3.js`

---

## Decision Log

| Date | Decision |
|---|---|
| 2026-06-27 | Phase 2.4: Fact Builder + Knowledge Graph Bridge; problems remain blocked |
| 2026-06-27 | Phase 2.5: Relationship Builder + persistent runtime graph; no problem inference |
| 2026-06-27 | Phase 2.6 reserved for Problem Inference |

Add entries to [Build Log](./09-build-log.md) for architectural milestones.
