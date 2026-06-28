# 08 — Current Phase

**Status:** Living document · update when phase changes  
**Related:** [Roadmap](./01-roadmap.md) · [Build Log](./09-build-log.md) · [Autonomous Operating Loop](./28-autonomous-operating-loop.md) · [OpenClaw Constitution](./29-openclaw-constitution.md) · [OpenClaw Job Schema](./30-openclaw-job-schema.md)

---

## Current Phase

**Phase 3.8 — End-to-End Live Pipeline Run** — **COMPLETE**

Reusable integration runner proves the full Opportunity Engine pipeline from file drop through opportunity assembly. Sensor → orchestrator → processor loop with no daemon, no timers, and STOP at opportunity.

Run: `node scripts/opportunity-engine/validate-phase-3-8.js`  
Run live: `node scripts/opportunity-engine/run-live-pipeline.js`

**Architecture freeze:** R26–R30 — [07-architecture-rules.md](./07-architecture-rules.md)

---

## Phase 3.8 Objective

Prove end-to-end execution: File Drop → Observation → Signal → Fact → Graph → Situation → Hypothesis → Problem → Capability Match → Offer Recommendation → Opportunity.

---

## Phase 3.8 Checklist

- [x] `scripts/opportunity-engine/run-live-pipeline.js` — deterministic demo drop, sensor, orchestrator enqueue, processor drain
- [x] Gitignored reports: `reports/live-pipeline.md`, `reports/live-pipeline.json`
- [x] correlationId / causationId preserved across chain
- [x] Idempotent job enqueue — no duplicate opportunities
- [x] Zero pending jobs at completion
- [x] `validate-phase-3-8.js` + Phase 3.7–3.1 regressions

---

## Active Rules (Phase 3.8)

| Rule | Status |
|---|---|
| Integration runner only — no daemon, no polling timers | **Enforced** |
| Orchestrator enqueues; processor executes; runner coordinates | **Enforced** |
| No new intelligence, sensors, or connectors | **Enforced** |
| Phase 4 blocked until owner approval | **Enforced** |

---

## Phase 4 (Blocked)

**Autonomous Execution / Outreach** — blocked until owner approves explicit implementation prompt.

Do not build daemon mode, continuous polling, outreach automation, or Score Council / Mission Control changes without owner authorization.

---

## Prior Phases — COMPLETE

### Phase 3.7 — Pipeline Stage Handlers

Run: `node scripts/opportunity-engine/validate-phase-3-7.js`

### Phase 3.6 — Event Pipeline Orchestrator

Run: `node scripts/opportunity-engine/validate-phase-3-6.js`

### Phase 3.5 — First Live Sensor Connector

Run: `node scripts/opportunity-engine/validate-phase-3-5.js`

---

## Decision Log

| Date | Decision |
|---|---|
| 2026-06-23 | Phase 3.8: End-to-end live pipeline run — file drop to opportunity, STOP |
| 2026-06-23 | Phase 3.7: Pipeline Stage Handlers — processor executes intelligence stages, STOP |
| 2026-06-23 | Phase 3.6: Event Pipeline Orchestrator — event-driven Job chaining, STOP |
