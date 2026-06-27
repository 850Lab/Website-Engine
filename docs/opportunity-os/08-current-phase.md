# 08 — Current Phase

**Status:** Living document · update when phase changes  
**Related:** [Roadmap](./01-roadmap.md) · [Build Log](./09-build-log.md) · [World Model](./23-world-model.md) · [Runtime Data Boundaries](./24-runtime-data-boundaries.md)

---

## Current Phase

**Phase 2.2.5 — Connector SDK & Runtime Architecture** — **COMPLETE**

Phase 2.3 (first production connector) is **blocked** until owner approves and issues an explicit implementation prompt.

---

## Phase 2.2.5 Objective

1. Connector SDK foundation (observations only — no production connectors)
2. Separate runtime operational data from git-tracked code/config

Run: `node scripts/opportunity-engine/validate-phase-2-2-5.js`

---

## Phase 2.2.5 Checklist

- [x] `runtime/` directory architecture + `.gitignore`
- [x] [24-runtime-data-boundaries.md](./24-runtime-data-boundaries.md)
- [x] `src/engine/runtime/index.js`
- [x] Signal store runtime adapter (legacy read + runtime write)
- [x] Raw observations write to `runtime/signals/raw/`
- [x] `src/engine/connectors/index.js` — Connector SDK
- [x] `src/engine/connectors/demo/manual-demo-connector.js` — demo only
- [x] `scripts/opportunity-engine/validate-phase-2-2-5.js`
- [x] Validation passed
- [x] No real connectors, facts, problems, opportunities
- [x] Mission Control unchanged

---

## Active Rules (Phase 2.2.5)

| Rule | Status |
|---|---|
| Live data in `runtime/` (gitignored) | **Enforced** |
| `engine-data/` = seed/config only for new signal writes | **Enforced** |
| Connectors collect observations only | **Enforced** |
| No external API calls in SDK validation | **Enforced** |
| No Fact/Problem/Opportunity inference | **Enforced** |
| Phase 2.3 blocked until owner approval | **Enforced** |

---

## Phase 2.3 (Blocked)

**First production connector** — not started.

Requires owner approval. Must use Connector SDK and end at Signal Registry per [World Model §5](./23-world-model.md#5-connector-rule).

Recommended first connector: **CRM outcome webhook** (`crm_event`, structured T0).

---

## Prior Phases — COMPLETE

### Phase 2.2 — Manual Observation Ingestion

Run: `node scripts/opportunity-engine/validate-phase-2-2.js`

### Phase 2.1.5 — World Model

[23-world-model.md](./23-world-model.md)

---

## Decision Log

| Date | Decision |
|---|---|
| 2026-06-27 | Phase 2.2.5: runtime/ for live data; Connector SDK; legacy signal store read-only for writes |
| 2026-06-27 | Phase 2.2.5 validation passed; Phase 2.3 unlocked (blocked until approval) |

Add entries to [Build Log](./09-build-log.md) for architectural milestones.
