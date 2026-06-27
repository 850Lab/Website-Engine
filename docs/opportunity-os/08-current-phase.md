# 08 — Current Phase

**Status:** Living document · update when phase changes  
**Related:** [Roadmap](./01-roadmap.md) · [Build Log](./09-build-log.md) · [World Model](./23-world-model.md) · [Sensor Framework](./25-sensor-framework.md)

---

## Current Phase

**Phase 2.3 — Sensor Framework** — **COMPLETE**

Phase 2.4 is **blocked** until owner approves and issues an explicit implementation prompt.

---

## Phase 2.3 Objective

Replace transitional Connectors with a permanent **Sensor Framework** — reusable modules that observe reality and emit canonical Observations only.

Run: `node scripts/opportunity-engine/validate-phase-2-3.js`

---

## Phase 2.3 Checklist

- [x] `src/engine/sensors/` — Sensor interface + manager
- [x] Demo sensors: Web, Document, CRM (static data only)
- [x] Sensor lifecycle + health tracking
- [x] Runtime integration via Observation/Signal pipeline
- [x] [25-sensor-framework.md](./25-sensor-framework.md)
- [x] `scripts/opportunity-engine/validate-phase-2-3.js`
- [x] Validation passed
- [x] No production sensors, facts, problems, opportunities
- [x] Mission Control unchanged

---

## Active Rules (Phase 2.3)

| Rule | Status |
|---|---|
| Sensors observe; they do not reason | **Enforced** |
| Publish only through Observation/Signal pipeline | **Enforced** |
| Live data in `runtime/` (gitignored) | **Enforced** |
| No external API calls in demo sensors | **Enforced** |
| Connectors deprecated — use Sensors | **Enforced** |
| Phase 2.4 blocked until owner approval | **Enforced** |

---

## Phase 2.4 (Blocked)

**First production sensor or Fact Builder prep** — not started.

Requires owner approval and explicit implementation prompt.

---

## Prior Phases — COMPLETE

### Phase 2.2.5 — Connector SDK & Runtime

Run: `node scripts/opportunity-engine/validate-phase-2-2-5.js` (connectors shim over sensors)

### Phase 2.2 — Manual Observation Ingestion

Run: `node scripts/opportunity-engine/validate-phase-2-2.js`

---

## Decision Log

| Date | Decision |
|---|---|
| 2026-06-27 | Phase 2.3: Sensor Framework replaces Connectors as canonical observation model |
| 2026-06-27 | Phase 2.3 validation passed; Phase 2.4 unlocked (blocked until approval) |

Add entries to [Build Log](./09-build-log.md) for architectural milestones.
