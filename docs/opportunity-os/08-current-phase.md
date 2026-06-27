# 08 — Current Phase

**Status:** Living document · update when phase changes  
**Related:** [Roadmap](./01-roadmap.md) · [Build Log](./09-build-log.md) · [World Model](./23-world-model.md) · [Signal & Problem Pipeline](./22-signal-and-problem-pipeline.md)

---

## Current Phase

**Phase 2.2 — Manual Observation Ingestion** — **COMPLETE**

Phase 2.3 (first connector) is **blocked** until owner approves and issues an explicit implementation prompt.

---

## Phase 2.2 Objective

Prove the World Model can faithfully capture observations:

Observation → Raw Archive → Signal Registry → Normalization → Classification → **Stop**

Run: `node scripts/opportunity-engine/validate-phase-2-2.js`

---

## Phase 2.2 Checklist

- [x] `engine-data/signals/raw/` — immutable observation archive
- [x] `scripts/opportunity-engine/ingest-signal.js` — manual CLI
- [x] `src/engine/signals/observations.js` — raw writer + normalization (no AI)
- [x] `src/engine/signals/classify.js` — rules-only classification
- [x] `src/engine/signals/ingest-manual.js` — full ingest workflow
- [x] Extended `getSignalRegistrySummary()`
- [x] `scripts/opportunity-engine/validate-phase-2-2.js`
- [x] Validation passed
- [x] No connectors, facts, problems, or opportunities built
- [x] Mission Control unchanged

---

## Active Rules (Phase 2.2)

| Rule | Status |
|---|---|
| Raw observations never overwritten or deleted | **Enforced** |
| Connectors write Signals only (not built yet) | **Enforced** |
| No Fact inference | **Enforced** |
| No Problem inference | **Enforced** |
| No Opportunity generation | **Enforced** |
| No Mission Control UI changes | **Enforced** |
| No AI in capture/normalize/classify | **Enforced** |

---

## Phase 2.3 (Blocked)

**First production connector** — not started.

Requires owner approval and explicit prompt. Connector must end at Signal Registry per [World Model §5](./23-world-model.md#5-connector-rule).

---

## Prior Phases — COMPLETE

### Phase 2.1.5 — World Model

[23-world-model.md](./23-world-model.md)

### Phase 2.1 — Signal Registry

Run: `node scripts/opportunity-engine/validate-phase-2-1.js`

### Phase 1 — Mission Control

Run: `node scripts/opportunity-engine/validate-phase-1.js`

---

## Decision Log

| Date | Decision |
|---|---|
| 2026-06-23 | Phase 2.2: Manual observation ingest; raw archive sacred; rules-only classify |
| 2026-06-23 | Phase 2.2 validation passed; Phase 2.3 unlocked (blocked until approval) |

Add entries to [Build Log](./09-build-log.md) for architectural milestones.
