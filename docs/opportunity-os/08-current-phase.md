# 08 — Current Phase

**Status:** Living document · update when phase changes  
**Related:** [Roadmap](./01-roadmap.md) · [Build Log](./09-build-log.md) · [World Model](./23-world-model.md) · [Reasoning Engine](./26-reasoning-engine.md) · [Capability Intelligence](./27-capability-intelligence.md)

---

## Current Phase

**Phase 2.8 — Offer Intelligence** — **COMPLETE**

Phase 2.9 is **blocked** until owner approves and issues an explicit implementation prompt.

**Architecture freeze:** Implement per Constitution; amend only on genuine deficiency — [R26–R30](./07-architecture-rules.md#architecture-freeze-owner-policy--phase-27).

---

## Phase 2.8 Objective

Implement commercial offer selection: Capability Match → Candidate Offers → Offer Eligibility → Offer Fit Analysis → Offer Ranking → Recommended Offers → STOP.

Run: `node scripts/opportunity-engine/validate-phase-2-8.js`

---

## Phase 2.8 Checklist

- [x] `src/engine/offer-intelligence/` — `recommendOffers(capabilityMatch)` pipeline
- [x] `src/engine/offer-recommendations/` — runtime recommendation store
- [x] Candidate offers from capability match overlap
- [x] Offer eligibility (capability link, fit floor, composition coverage)
- [x] Offer fit score with dimensional breakdown (distinct from capability fit and opportunity score)
- [x] Offer ranking and explainability bundle
- [x] `runtime/offer-recommendations/` append-only store
- [x] `scripts/opportunity-engine/validate-phase-2-8.js`
- [x] Validation passed; Phase 2.7 regression passes

---

## Active Rules (Phase 2.8)

| Rule | Status |
|---|---|
| Offers consume capability matches only — not Problems directly (CI2) | **Enforced** |
| Offer fit ≠ capability fit ≠ opportunity score | **Enforced** |
| Explainability on every offer recommendation | **Enforced** |
| STOP before Opportunity Factory | **Enforced** |
| No opportunities, Score Council, LLM, or Mission Control changes | **Enforced** |
| Architecture frozen — amend only on genuine deficiency (R26–R30) | **Owner policy** |
| Phase 2.9 blocked until owner approval | **Enforced** |

---

## Phase 2.9 (Blocked)

**Opportunity Factory** — not started.

Requires owner approval and explicit implementation prompt.

---

## Prior Phases — COMPLETE

### Phase 2.7 — Capability Matching Engine · **OWNER APPROVED**

Run: `node scripts/opportunity-engine/validate-phase-2-7.js`

### Phase 2.6.5 — Capability Intelligence Constitution (design only)

Read: [27-capability-intelligence.md](./27-capability-intelligence.md)

---

## Decision Log

| Date | Decision |
|---|---|
| 2026-06-27 | Phase 2.8: Offer Intelligence implemented — capability match → recommended offers |
| 2026-06-27 | **Owner approved Phase 2.7** + architecture freeze (R26–R30) |
| 2026-06-27 | Phase 2.9 reserved for Opportunity Factory |

Add entries to [Build Log](./09-build-log.md) for architectural milestones.
