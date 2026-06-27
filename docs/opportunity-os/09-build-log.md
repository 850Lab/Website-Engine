# 09 — Build Log

**Status:** Living document · chronological  
**Related:** [Roadmap](./01-roadmap.md) · [Current Phase](./08-current-phase.md) · [Project History](./20-project-history.md)

Record architectural milestones here. Implementation details belong in commit messages; this log captures **decisions and phase transitions**.

---

## Format

```
### YYYY-MM-DD — Title
**Phase:** N
**Type:** Decision | Milestone | Migration | Constitution
**Summary:** One paragraph
**Links:** PRs, docs, scripts
```

---

## Entries

### 2024–2025 — Website Outreach Engine founded
**Phase:** Pre-OS  
**Type:** Milestone  
**Summary:** Repository created as local business website opportunity scanner. Stage1 qualification, angle analysis, preview generation, outreach workflows established.  
**Links:** [Project History](./20-project-history.md)

---

### 2025 — Pressure Washing vertical added
**Phase:** Pre-OS  
**Type:** Milestone  
**Summary:** PW queue, lead store, mobile operator UI, and discovery scripts added as second product silo.  
**Links:** `src/pressure-washing/`, `docs/pressure-washing-build-plan.md`

---

### 2025–2026 — Locked Outreach OS schema (8 entities)
**Phase:** Migration (pre-Phase 1)  
**Type:** Milestone  
**Summary:** Canonical schema defined: Offer, Campaign, Business, Contact, Opportunity, QueueItem, Attempt, LearningReport. Migration scripts and id-bridge created.  
**Links:** `src/schema/`, `scripts/migration/`, [Data Model](./14-data-model.md)

---

### 2026-06 — Schema queue read cutover (Phase 0.77)
**Phase:** Migration  
**Type:** Milestone  
**Summary:** `USE_SCHEMA_QUEUE_READS` serves website and PW queues from schema entities with dual-read parity validation.  
**Links:** `src/services/schema-queue/`, `scripts/run-dual-read-validation.js`

---

### 2026-06 — Schema outcome dual-write (Phase 0.78)
**Phase:** Migration  
**Type:** Milestone  
**Summary:** `USE_SCHEMA_OUTCOME_WRITES` dual-writes outcomes/notes to Attempts + Opportunities while legacy remains UI write authority.  
**Links:** `src/services/schema-outcomes/record-write.js`

---

### 2026-06 — Opportunity Engine MVP (`src/engine/`)
**Phase:** Pre-Phase 1  
**Type:** Milestone  
**Summary:** Engine modules created: offers, markets, industry-discovery, opportunities, intelligence (`buildOpportunityRadar`), operating-picture, execution, scoring. Pivotal home wired to radar.  
**Links:** `src/engine/`, `engine-data/`

---

### 2026-06 — KTM opportunity report generator
**Phase:** Pre-Phase 1  
**Type:** Milestone  
**Summary:** `scripts/opportunity-engine/generate-ktm-report.js` produces filtered KTM meeting report from radar.  
**Links:** `reports/ktm-opportunity-report.md`

---

### 2026-06-23 — AI Constitution (Phase 0) initiated
**Phase:** 0  
**Type:** Constitution  
**Summary:** `docs/opportunity-os/` created. Feature implementation frozen until Constitution approved. Repository formally reframed as Opportunity Operating System.  
**Links:** [08-current-phase.md](./08-current-phase.md)

---

### 2026-06-23 — Phase 0.5 alignment (ontology, capabilities, score council)
**Phase:** 0.5  
**Type:** Milestone  
**Summary:** Phase 0.5 alignment introduced ontology convergence plan, first-class capability registry (`engine-data/capabilities/`), offer→capability linking, and Score Council with CEO modes. Radar now exposes `scoreVector` and `scoreCouncil` while preserving `opportunityScore` as composite projection.  
**Links:** [21-ontology-convergence-plan.md](./21-ontology-convergence-plan.md), `src/engine/score-council/`, `scripts/opportunity-engine/validate-phase-0-5.js`

---

### 2026-06-23 — Phase 1 Mission Control (Executive OS)
**Phase:** 1  
**Type:** Milestone  
**Summary:** Introduced `buildMissionControl()` as the single executive API projection. Added evidence assembler (`src/engine/evidence/`) for explainability from Score Council, database analysis, capabilities, offers, markets, and execution. Pivotal OS home now consumes Mission Control only (no UI scoring). Report generator produces `reports/mission-control.md`. Validation: `scripts/opportunity-engine/validate-phase-1.js`.  
**Links:** `src/engine/mission-control/`, `src/engine/evidence/`, `src/pivotal-os/pages/home.js`, `scripts/opportunity-engine/generate-mission-control-report.js`

---

### 2026-06-23 — Phase 2.0 Signal and Problem Inference Pipeline (design)
**Phase:** 2.0  
**Type:** Constitution  
**Summary:** Defined canonical Signal object (27 fields + lifecycle states), Problem object schema, 17 signal types, 15 problem types, full inference pipeline from capture through Score Council to Mission Control, multi-opportunity fan-out examples, and tiered AI cost rules (rules-first; LLM on <5% of signals). Recommended Phase 2.1 build sequence: signal store → manual ingest → first connector. No implementation authorized.  
**Links:** [22-signal-and-problem-pipeline.md](./22-signal-and-problem-pipeline.md), [08-current-phase.md](./08-current-phase.md)

---

### 2026-06-23 — Phase 2.1 Signal registry and lifecycle
**Phase:** 2.1  
**Type:** Milestone  
**Summary:** Implemented append-only signal registry at `engine-data/signals/signals.json` and `src/engine/signals/` with create, normalize, state transitions, lifecycle audit trail, and query helpers. Observation fields are immutable on state advance. Validated transitions per pipeline doc. No connectors or problem inference. Validation: `scripts/opportunity-engine/validate-phase-2-1.js`.  
**Links:** `src/engine/signals/`, `engine-data/signals/signals.json`, [22-signal-and-problem-pipeline.md](./22-signal-and-problem-pipeline.md)

---

## Future Entries (Reserved)

<!-- Phase 2.2 manual signal ingestion -->
<!-- Phase 2.3 first production connector -->
<!-- Phase 3 problem-centric factory -->
<!-- Phase 4 execution plan E2E -->
<!-- Phase 5 first calibrated forecast -->

---

## Amendment Log

| Date | Change |
|---|---|
| 2026-06-23 | Initial Constitution build log created |
