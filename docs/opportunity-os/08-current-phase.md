# 08 — Current Phase

**Status:** Living document · update when phase changes  
**Related:** [Roadmap](./01-roadmap.md) · [Build Log](./09-build-log.md) · [Architecture Rules](./07-architecture-rules.md) · [Ontology Convergence Plan](./21-ontology-convergence-plan.md) · [Signal & Problem Pipeline](./22-signal-and-problem-pipeline.md)

---

## Current Phase

**Phase 2.0 — Signal Object & Problem Inference Pipeline (Design)** — **ACTIVE**

Phase 1 (Mission Control) is **COMPLETE**. Phase 2 implementation is **NOT started**. Only the Phase 2.0 design blueprint is active.

---

## Phase 2.0 Objective

Design the canonical Signal object, Problem object, inference pipeline, fan-out rules, and AI cost tiers — without building connectors, crawlers, or autonomous agents.

**Primary artifact:** [22-signal-and-problem-pipeline.md](./22-signal-and-problem-pipeline.md)

---

## Phase 2.0 Checklist

- [x] Signal object schema defined (§1)
- [x] Canonical signal types enumerated (§2)
- [x] Signal lifecycle with entry/exit/failure modes (§3)
- [x] Problem object schema defined (§4)
- [x] Problem types enumerated (§5)
- [x] Inference pipeline designed (§6)
- [x] Multi-opportunity fan-out examples (§7)
- [x] Cost and AI tier rules (§8)
- [x] Phase 2 build plan — first 3 steps (§9)
- [ ] Owner review and approval of Phase 2.0 design
- [ ] Phase 2.1 implementation authorized

---

## Active Rules (Phase 2.0)

| Rule | Status |
|---|---|
| Documentation only — no implementation code | **Enforced** |
| Do NOT build connectors yet | **Enforced** |
| Do NOT build crawlers or autonomous agents | **Enforced** |
| Do NOT LLM-process every signal (design law) | **Documented in §8** |
| Engine remains truth; Mission Control remains projection | **Enforced** |
| Do NOT refactor legacy for convenience | **Enforced** |

---

## Phase 2.1 Implementation (Blocked)

Implementation begins only after:

1. Owner approves [22-signal-and-problem-pipeline.md](./22-signal-and-problem-pipeline.md)
2. [08-current-phase.md](./08-current-phase.md) updated to Phase 2.1 ACTIVE
3. Explicit implementation prompt issued

**First 3 steps (when authorized):**

1. Signal registry and data store
2. Manual signal ingestion script
3. First connector (owner-selected — not built in 2.0)

See [22-signal-and-problem-pipeline.md §9](./22-signal-and-problem-pipeline.md#9-phase-2-build-plan).

---

## Prior Phases — COMPLETE

### Phase 1 — Mission Control (Executive OS)

Run: `node scripts/opportunity-engine/validate-phase-1.js`

### Phase 0.5 — Alignment

Run: `node scripts/opportunity-engine/validate-phase-0-5.js`

### Phase 0 — AI Constitution

Constitution documents 00–22 in `docs/opportunity-os/`.

---

## Decision Log

| Date | Decision |
|---|---|
| 2026-06-23 | Constitution folder created; Phase 0 active |
| 2026-06-23 | Phase 0.5: `src/engine` remains truth spine; JSON OK; no graph DB; no legacy demolition |
| 2026-06-23 | Score Council introduced; `opportunityScore` = composite projection |
| 2026-06-23 | Phase 1: Mission Control is single executive API; evidence assembler; Pivotal OS projection-only |
| 2026-06-23 | Phase 1 validation passed; Phase 2 unlocked |
| 2026-06-23 | Phase 2.0: Signal and Problem pipeline blueprint — design active, implementation blocked |

Add entries to [Build Log](./09-build-log.md) for architectural milestones.
