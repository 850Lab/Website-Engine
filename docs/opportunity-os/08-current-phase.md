# 08 — Current Phase

**Status:** Living document · update when phase changes  
**Related:** [Roadmap](./01-roadmap.md) · [Build Log](./09-build-log.md) · [Autonomous Operating Loop](./28-autonomous-operating-loop.md) · [OpenClaw Constitution](./29-openclaw-constitution.md) · [OpenClaw Job Schema](./30-openclaw-job-schema.md)

---

## Current Phase

**Phase 4.2 — Engineering Director Backlog Execution (B1 + O-PW1 + O-KTM1 + C1)** — **COMPLETE**

Deterministic Engineering Director selector plus Founder-priority business operator templates and mission-aware file-drop intake. The selector reads the Master Engineering Backlog, identifies blocked and ready work, selects the next highest-value unblocked task, and creates Builder Plan packages without executing OpenClaw, jobs, pipeline work, or outreach. Business operator templates create validated draft missions for pressure washing and KTM. File-drop observations may now carry candidate mission IDs, mission hints, and source labels as metadata/provenance while the pipeline remains unchanged.

Run: `node scripts/opportunity-engine/validate-phase-4-2.js`  
Full suite: `node scripts/opportunity-engine/validate-core.js`

**Architecture freeze:** R26–R30 — [07-architecture-rules.md](./07-architecture-rules.md)

---

## Phase 4.2 Objective

Activate the **Engineering Director** execution model:

1. `src/engine/founder-intent/backlog-selector.js` — parse the Master Engineering Backlog into task objects
2. Evaluate dependencies and external blockers before task selection
3. Select the highest-value ready task using priority, business value, revenue impact, dependency leverage, validation confidence, effort, and risk
4. Generate Builder Plan objects with allowed files, forbidden files, reading, validation commands, expected outputs, and stop conditions
5. Register Phase 4.2 validation in the release graph

The Engineering Director selector **may not** execute jobs, call OpenClaw, modify runtime state, bypass validation, or launch outreach.

---

## Phase 4.2 Checklist

- [x] Master backlog parser
- [x] Task readiness and blocker evaluation
- [x] Scored next-task selector
- [x] Builder Plan generator
- [x] Focused validator: `validate-engineering-director.js`
- [x] Phase validator: `validate-phase-4-2.js`
- [x] Pressure washing business operator mission template (`O-PW1`)
- [x] KTM industrial maintenance mission template (`O-KTM1`)
- [x] Mission-aware file-drop observation metadata (`C1`)
- [x] `validate-phase-4-2.js` in release graph
- [x] Docs updated (08, 09, 13, 15, 33)

---

## Active Rules (Phase 4.2)

| Rule | Status |
|---|---|
| Backlog selection must be deterministic and explainable | **Enforced** |
| External credentials, legal approval, Founder approval, and business decisions block task readiness | **Enforced** |
| Builder Plans may describe work but may not execute OpenClaw or jobs | **Enforced** |
| Business operator templates create mission specs only; no opportunities, contacts, or outreach | **Enforced** |
| Mission hints on file-drop observations remain metadata/provenance only | **Enforced** |
| Outreach / contact discovery / CEO review UI not built by B1 | **Enforced** |
| OpenClaw, Scheduler, Processor, Orchestrator, Pipeline unchanged | **Enforced** |

---

## Phase 4.3+ (Blocked / Not Started)

**Source Connectors v1, Contact Discovery, Outreach, Campaign Execution** — blocked until prerequisites, credentials, legal/compliance decisions, and owner approvals are present.

Do not build autonomous outreach, reply processing, or Mission Control UI changes without authorization.

---

## Prior Phase — COMPLETE

**Phase 4.1 — Founder Intent Interpreter (Mission Chef)**

LLM-capable (optional) + rules-based layer that translates natural-language founder goals into validated, structured missions stored in `runtime/missions/`. Missions configure strategy and alignment for the existing Opportunity OS pipeline without modifying orchestrator, processor, or outreach paths.

Run: `node scripts/opportunity-engine/validate-phase-4-1.js`

---

## Prior Phase — COMPLETE

**Phase 4.0.6 — Engine-Data Read-Only Enforcement**

`engine-data/` is read-only seed/config/reference data. Runtime IO rejects writes under `engine-data/`; validators fail on tracked engine-data changes.

Run: `node scripts/opportunity-engine/validate-phase-4-0-6.js`

---

## Prior Phase — COMPLETE

**Phase 4.0 — Intelligence Calibration Layer**

Rules-only calibration: dedupe, semantic classification, situation routing, capability fit, commercial abstention.

Run: `node scripts/opportunity-engine/validate-phase-4-0.js`

---

## Decision Log

| Date | Decision |
|---|---|
| 2026-06-30 | Phase 4.2 C1: Mission-aware file-drop intake — candidate mission IDs, mission hints, and source labels preserved as metadata/provenance |
| 2026-06-30 | Phase 4.2 O-KTM1: KTM industrial maintenance mission template — Beaumont 500-mile industrial opportunity mission |
| 2026-06-30 | Phase 4.2 O-PW1: Pressure washing business operator mission template — Beaumont 500-mile commercial cash-flow mission |
| 2026-06-30 | Phase 4.2 B1: Engineering Director backlog selector — deterministic task selection + Builder Plan output |
| 2026-06-29 | Phase 4.1: Founder Intent Interpreter — mission chef above OS, no outreach |
| 2026-06-23 | Phase 4.0.6: Engine-data read-only enforcement |
| 2026-06-29 | Phase 4.0.5: Validation infrastructure — isolated runtime-validation, ValidationRunner |
| 2026-06-23 | Phase 4.0: Intelligence calibration — dedupe, classification, routing, abstention |
