# 08 — Current Phase

**Status:** Living document · update when phase changes  
**Related:** [Roadmap](./01-roadmap.md) · [Build Log](./09-build-log.md) · [World Model](./23-world-model.md) · [Reasoning Engine](./26-reasoning-engine.md) · [Capability Intelligence](./27-capability-intelligence.md)

---

## Current Phase

**Phase 2.9 — Opportunity Factory** — **COMPLETE**

**Commercial Intelligence pipeline complete:** Problem → Capability Match → Offer Recommendation → Opportunity → STOP.

Score Council remains the **next consumer** — blocked until owner approves Phase 3+ work.

**Architecture freeze:** Implement per Constitution; amend only on genuine deficiency — [R26–R30](./07-architecture-rules.md#architecture-freeze-owner-policy--phase-27).

---

## Phase 2.9 Objective

Assemble validated opportunities from Problem + Capability Match + Offer Recommendation only.

Run: `node scripts/opportunity-engine/validate-phase-2-9.js`

---

## Phase 2.9 Checklist

- [x] `runtime/opportunities/` — opportunity store
- [x] `src/engine/opportunities/index.js` — runtime store API (`listOpportunities`, `getOpportunityById`)
- [x] `src/engine/opportunity-factory/` — `buildOpportunity()`, `buildOpportunityForProblem()`
- [x] `src/engine/opportunity-validator/` — `validateOpportunity()`
- [x] Structured explainability bundle on every opportunity
- [x] Lifecycle: assembled → validated → ready → executing → won → lost → archived
- [x] Legacy radar preserved in `opportunities/radar.js` (`generateOpportunities`)
- [x] `scripts/opportunity-engine/validate-phase-2-9.js`
- [x] Validation passed; Phase 2.8 / 2.7 / 2.6 / 2.5.5 regressions pass

---

## Active Rules (Phase 2.9)

| Rule | Status |
|---|---|
| Factory consumes Problem + Capability Match + Offer Recommendation only | **Enforced** |
| Never bypass upstream layers; never invent evidence | **Enforced** |
| No rescoring, prioritizing, execution, learning, or forecasting in factory | **Enforced** |
| Score Council unchanged — next consumer | **Enforced** |
| Mission Control unchanged | **Enforced** |
| Runtime-only writes (`runtime/opportunities/`) | **Enforced** |
| Architecture frozen (R26–R30) | **Owner policy** |

---

## Commercial Intelligence — COMPLETE

```
Situation → Hypothesis → Problem
  ↓
Capability Match
  ↓
Offer Recommendation
  ↓
Opportunity Assembly + Validation
  ↓
STOP (Score Council next)
```

---

## Prior Phases — COMPLETE

### Phase 2.8 — Offer Intelligence

Run: `node scripts/opportunity-engine/validate-phase-2-8.js`

### Phase 2.7 — Capability Matching Engine · **OWNER APPROVED**

Run: `node scripts/opportunity-engine/validate-phase-2-7.js`

---

## Decision Log

| Date | Decision |
|---|---|
| 2026-06-28 | Phase 2.9: Opportunity Factory implemented — Commercial Intelligence complete |
| 2026-06-27 | Phase 2.8: Offer Intelligence implemented |
| 2026-06-27 | **Owner approved Phase 2.7** + architecture freeze (R26–R30) |
| 2026-06-27 | Score Council reserved as next consumer after Opportunity Factory |

Add entries to [Build Log](./09-build-log.md) for architectural milestones.
