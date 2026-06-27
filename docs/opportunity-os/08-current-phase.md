# 08 — Current Phase

**Status:** Living document · update when phase changes  
**Related:** [Roadmap](./01-roadmap.md) · [Build Log](./09-build-log.md) · [Architecture Rules](./07-architecture-rules.md) · [Ontology Convergence Plan](./21-ontology-convergence-plan.md)

---

## Current Phase

**Phase 0.5 — Alignment (Constitution → Engine)**

Phase 0 (AI Constitution documentation) is complete. Phase 0.5 aligns the repository with the Constitution before Phase 1 Executive OS work begins.

---

## Current Objective

Validate and maintain Phase 0.5 deliverables:

1. [Ontology Convergence Plan](./21-ontology-convergence-plan.md)
2. Capability registry (`engine-data/capabilities/`, `src/engine/capabilities/`)
3. Score Council (`src/engine/score-council/`)

Run: `node scripts/opportunity-engine/validate-phase-0-5.js`

---

## Active Rules (Phase 0.5)

| Rule | Status |
|---|---|
| Do NOT build Phase 1 executive UI pages | **Enforced** |
| Do NOT refactor legacy systems for convenience | **Enforced** |
| Do NOT delete legacy modules or JSON stores | **Enforced** |
| Do NOT change app behavior except validation-safe engine projections | **Enforced** |
| Phase 1 implementation | **Blocked until Phase 0.5 validated + owner approves Phase 1** |

---

## Phase 0 Checklist

- [x] Study existing repository
- [x] Create Constitution documents 00–20
- [ ] Owner review and approval of Constitution
- [x] Phase 0.5 ontology convergence plan
- [x] Phase 0.5 capability registry
- [x] Phase 0.5 score council
- [x] Phase 0.5 validation script

---

## Phase 0.5 Checklist

- [x] `docs/opportunity-os/21-ontology-convergence-plan.md`
- [x] `engine-data/capabilities/capabilities.json`
- [x] `src/engine/capabilities/index.js`
- [x] Offers linked via `capabilityIds`
- [x] `src/engine/score-council/index.js`
- [x] Radar exposes `scoreVector`, `scoreCouncil`, compatible `opportunityScore`
- [x] `scripts/opportunity-engine/validate-phase-0-5.js`

---

## Next Phase (Not Started)

**Phase 1 — Executive OS**

First implementation prompt after Phase 0.5 validation + owner approval:

> *"Read the AI Constitution and build Phase 1 exit criteria only. Start with evidence assembler and engine-backed Pivotal OS pages."*

See [Roadmap — Phase 1](./01-roadmap.md#phase-1--executive-os).

---

## Decision Log

| Date | Decision |
|---|---|
| 2026-06-23 | Constitution folder created; Phase 0 active |
| 2026-06-23 | Phase 0.5: `src/engine` remains truth spine; JSON OK; no graph DB; no legacy demolition |
| 2026-06-23 | Score Council introduced; `opportunityScore` = composite projection |

Add entries to [Build Log](./09-build-log.md) for architectural milestones.
