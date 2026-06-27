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

## Future Entries (Reserved)

<!-- Phase 0 approval -->
<!-- Phase 1 Score Council -->
<!-- Phase 1 Executive Terminal complete -->
<!-- Phase 2 first production connector -->
<!-- Phase 3 problem-centric factory -->
<!-- Phase 4 execution plan E2E -->
<!-- Phase 5 first calibrated forecast -->

---

## Amendment Log

| Date | Change |
|---|---|
| 2026-06-23 | Initial Constitution build log created |
