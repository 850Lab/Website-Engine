# 08 — Current Phase

**Status:** Living document · update when phase changes  
**Related:** [Roadmap](./01-roadmap.md) · [Build Log](./09-build-log.md) · [Autonomous Operating Loop](./28-autonomous-operating-loop.md) · [OpenClaw Constitution](./29-openclaw-constitution.md) · [OpenClaw Job Schema](./30-openclaw-job-schema.md)

---

## Current Phase

**Phase 4.1 — Founder Intent Interpreter (Mission Chef)** — **COMPLETE**

LLM-capable (optional) + rules-based layer that translates natural-language founder goals into validated, structured missions stored in `runtime/missions/`. Missions configure strategy and alignment for the existing Opportunity OS pipeline without modifying orchestrator, processor, or outreach paths.

Run: `node scripts/opportunity-engine/validate-phase-4-1.js`  
Full suite: `node scripts/opportunity-engine/validate-core.js`

**Architecture freeze:** R26–R30 — [07-architecture-rules.md](./07-architecture-rules.md)

---

## Phase 4.1 Objective

Add the **Mission Chef** above the intelligence engine:

1. `src/engine/founder-intent/` — Chief-of-Staff planner, intent engine, clarification, mission planner, validator, registry, strategy, alignment, engineering task drafts, Founder briefing
2. Founder speaks in natural language → clarification → deterministic mission specification
3. Multiple simultaneous **ACTIVE** missions in `runtime/missions/missions.json`
4. Mission validation against supported offers/capabilities in `engine-data/`
5. Mission alignment scoring for downstream opportunities (rank by mission fit)
6. LLM optional via `MISSION_INTERPRETER_LLM=1` + `OPENAI_API_KEY`; rules interpreter default for validation

The LLM **may not** create opportunities, execute jobs, modify engine stores directly, bypass validation, call OpenClaw, or launch outreach.

---

## Phase 4.1 Checklist

- [x] Intent object extraction
- [x] Mission schema + validator
- [x] Clarification engine (no guessing critical constraints)
- [x] Rules-based mission interpreter + optional LLM adapter
- [x] Runtime mission registry (`runtime/missions/`)
- [x] Mission strategy generation
- [x] Mission alignment scoring
- [x] Engineering Director task drafts
- [x] AI Chief-of-Staff planning API
- [x] Read-only Founder briefing report
- [x] `validate-phase-4-1.js` in release graph
- [x] Docs updated (08, 09, 13, 15, 24)

---

## Active Rules (Phase 4.1)

| Rule | Status |
|---|---|
| Founder intent → validated mission only (no direct pipeline writes) | **Enforced** |
| `approvalPolicy.requireFounderApprovalBeforeOutreach` must remain true | **Enforced** |
| Multiple ACTIVE missions supported | **Enforced** |
| Outreach / contact discovery / CEO review UI not built | **Enforced** |
| OpenClaw, Scheduler, Processor, Orchestrator, Pipeline unchanged | **Enforced** |

---

## Phase 4.2+ (Blocked / Not Started)

**Source Connectors v1, Contact Discovery, Outreach, Campaign Execution** — blocked until owner approves explicit implementation prompts.

Do not build autonomous outreach, reply processing, or Mission Control UI changes without authorization.

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
| 2026-06-29 | Phase 4.1: Founder Intent Interpreter — mission chef above OS, no outreach |
| 2026-06-23 | Phase 4.0.6: Engine-data read-only enforcement |
| 2026-06-29 | Phase 4.0.5: Validation infrastructure — isolated runtime-validation, ValidationRunner |
| 2026-06-23 | Phase 4.0: Intelligence calibration — dedupe, classification, routing, abstention |
