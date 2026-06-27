# 08 — Current Phase

**Status:** Living document · update when phase changes  
**Related:** [Roadmap](./01-roadmap.md) · [Build Log](./09-build-log.md) · [Architecture Rules](./07-architecture-rules.md) · [Ontology Convergence Plan](./21-ontology-convergence-plan.md) · [Signal & Problem Pipeline](./22-signal-and-problem-pipeline.md)

---

## Current Phase

**Phase 2.1 — Signal Registry & Lifecycle** — **COMPLETE**

Phase 2.2 (manual ingest) is **blocked** until owner approves and issues an explicit implementation prompt.

---

## Phase 2.1 Objective

Build the canonical append-only signal registry that future connectors will write into. No connectors, no problem inference, no Mission Control UI changes.

**Primary modules:** `src/engine/signals/`, `engine-data/signals/signals.json`

Run: `node scripts/opportunity-engine/validate-phase-2-1.js`

---

## Phase 2.1 Checklist

- [x] `engine-data/signals/signals.json` — empty store with metadata
- [x] `src/engine/signals/index.js` — registry API
- [x] Lifecycle states and validated transitions per [22-signal-and-problem-pipeline.md](./22-signal-and-problem-pipeline.md)
- [x] Observation fields immutable on state advance; `lifecycle[]` audit trail
- [x] `scripts/opportunity-engine/validate-phase-2-1.js`
- [x] Validation passed
- [x] No connector code created

---

## Active Rules (Phase 2.1)

| Rule | Status |
|---|---|
| Do NOT build connectors | **Enforced** |
| Do NOT call news APIs or RFP ingestion | **Enforced** |
| Do NOT build problem inference yet | **Enforced** |
| Do NOT modify Mission Control UI (except validation-safe reads) | **Enforced** |
| Engine remains truth; signals append-only | **Enforced** |
| Do NOT begin Phase 2.2 without approval | **Enforced** |

---

## Phase 2.2 (Blocked)

**Manual signal ingestion script** — not started.

First implementation prompt after owner approves Phase 2.2:

> *"Implement Phase 2.2 — manual signal ingestion CLI only. Write to signal registry via createSignal(). No connectors."*

See [22-signal-and-problem-pipeline.md §9 Step 2](./22-signal-and-problem-pipeline.md#9-phase-2-build-plan).

---

## Prior Phases — COMPLETE

### Phase 2.0 — Signal & Problem Pipeline (Design)

Blueprint: [22-signal-and-problem-pipeline.md](./22-signal-and-problem-pipeline.md)

### Phase 1 — Mission Control (Executive OS)

Run: `node scripts/opportunity-engine/validate-phase-1.js`

### Phase 0.5 — Alignment

Run: `node scripts/opportunity-engine/validate-phase-0-5.js`

---

## Decision Log

| Date | Decision |
|---|---|
| 2026-06-23 | Constitution folder created; Phase 0 active |
| 2026-06-23 | Phase 0.5: `src/engine` remains truth spine; JSON OK; no graph DB |
| 2026-06-23 | Phase 1: Mission Control single executive API |
| 2026-06-23 | Phase 2.0: Signal/Problem pipeline blueprint |
| 2026-06-23 | Phase 2.1: JSON signal registry + lifecycle engine in `src/engine/signals/` |

Add entries to [Build Log](./09-build-log.md) for architectural milestones.
