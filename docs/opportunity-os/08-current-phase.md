# 08 — Current Phase

**Status:** Living document · update when phase changes  
**Related:** [Roadmap](./01-roadmap.md) · [Build Log](./09-build-log.md) · [World Model](./23-world-model.md) · [Reasoning Engine](./26-reasoning-engine.md)

---

## Current Phase

**Phase 2.6 — Problem Inference Engine** — **COMPLETE**

Phase 2.7 is **blocked** until owner approves and issues an explicit implementation prompt.

---

## Phase 2.6 Objective

Implement the first reasoning pipeline: Situation → Hypothesis → Evidence → Confidence → Contradiction → Problem. No capability matching, offers, or opportunities.

Run: `node scripts/opportunity-engine/validate-phase-2-6.js`

---

## Phase 2.6 Checklist

- [x] `runtime/hypotheses/` — hypothesis store
- [x] `runtime/problems/` — problem store
- [x] `src/engine/hypothesis-generator/` — rules-only hypothesis generation
- [x] `src/engine/evidence-engine/` — evidence collection + tiers
- [x] `src/engine/confidence-engine/` — traceable confidence propagation
- [x] `src/engine/contradictions/` — competing hypothesis detection
- [x] `src/engine/problem-inference/` — `inferProblems()` promotion pipeline
- [x] Explainability bundle on every Problem
- [x] `scripts/opportunity-engine/validate-phase-2-6.js`
- [x] Validation passed; Phase 2.5.5 / 2.5 / 2.4 regressions pass

---

## Active Rules (Phase 2.6)

| Rule | Status |
|---|---|
| Situations are the only legal input to Hypothesis Generator | **Enforced** |
| Problems require promoted Hypotheses — no direct Situation → Problem | **Enforced** |
| Confidence traceable via `confidenceBreakdown` | **Enforced** |
| Contradictions visible — negative hypotheses rejected before promotion | **Enforced** |
| No capability matching, offers, opportunities, LLM, or Mission Control changes | **Enforced** |
| Phase 2.7 blocked until owner approval | **Enforced** |

---

## Phase 2.7 (Blocked)

**Capability Matching** — not started.

Requires owner approval and explicit implementation prompt.

---

## Prior Phases — COMPLETE

### Phase 2.5.8 — Reasoning Engine Constitution (design only)

Read: [26-reasoning-engine.md](./26-reasoning-engine.md)

### Phase 2.5.5 — Situation Builder

Run: `node scripts/opportunity-engine/validate-phase-2-5-5.js`

---

## Decision Log

| Date | Decision |
|---|---|
| 2026-06-27 | Phase 2.6: Problem Inference implemented per Reasoning Engine Constitution |
| 2026-06-27 | Promotion threshold 0.6; negative competing hypotheses rejected |
| 2026-06-27 | Phase 2.7 reserved for Capability Matching |

Add entries to [Build Log](./09-build-log.md) for architectural milestones.
