# 08 — Current Phase

**Status:** Living document · update when phase changes  
**Related:** [Roadmap](./01-roadmap.md) · [Build Log](./09-build-log.md) · [Autonomous Operating Loop](./28-autonomous-operating-loop.md) · [OpenClaw Constitution](./29-openclaw-constitution.md) · [OpenClaw Job Schema](./30-openclaw-job-schema.md)

---

## Current Phase

**Phase 4.2 — Engineering Director Backlog Execution (B1 + B2 + B3 + B4 + B5 + O-PW1 + O-KTM1 + C1 + O-APT1 + O-WEB1 + S1)** — **COMPLETE**

Deterministic Engineering Director selector, runtime engineering task registry, bounded OpenClaw handoff package generator, regression-aware planning, backlog progress dashboard generation, Founder-priority business operator templates, mission-aware file-drop intake, and runtime health observability. The selector reads the Master Engineering Backlog, identifies blocked and ready work, selects the next highest-value unblocked task, and creates Builder Plan packages without executing OpenClaw, jobs, pipeline work, or outreach. Every Builder Plan and Engineering Director task recommendation now includes an explicit validation plan before implementation begins: focused validator, phase validator, regression validators, core validation, affected modules, and failure/repair policy. The backlog progress dashboard reads the Master Engineering Backlog and execution status to emit deterministic JSON/Markdown reports with completion by operating category, current task selection, blocked tasks, and remaining task/commit/hour estimates. The registry persists engineering task lifecycle state under `runtime/engineering-tasks/`. The handoff generator converts approved, OpenClaw-eligible engineering tasks into schema-valid handoff drafts only; it does not dispatch or run jobs. Runtime health emits deterministic JSON/Markdown reports with store counts and report policy; it does not add a dashboard, daemon, or live monitoring service. Business operator templates create validated draft missions for pressure washing, KTM, apartment financial workshops, and website agency growth. File-drop observations may carry candidate mission IDs, mission hints, and source labels as metadata/provenance while the pipeline remains unchanged.

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
- [x] Runtime engineering task registry (`B2`)
- [x] Bounded OpenClaw handoff package generator (`B3`)
- [x] Regression-aware validation plans for task recommendations (`B4`)
- [x] Backlog progress dashboard generator (`B5`)
- [x] Focused validator: `validate-engineering-director.js`
- [x] Focused validator: `validate-engineering-task-registry.js`
- [x] Focused validator: `validate-openclaw-handoff.js`
- [x] Focused validator: `validate-backlog-progress-dashboard.js`
- [x] Phase validator: `validate-phase-4-2.js`
- [x] Pressure washing business operator mission template (`O-PW1`)
- [x] KTM industrial maintenance mission template (`O-KTM1`)
- [x] Mission-aware file-drop observation metadata (`C1`)
- [x] Apartment financial workshop mission template (`O-APT1`)
- [x] Website agency mission template (`O-WEB1`)
- [x] Runtime health observability report data (`S1`)
- [x] `validate-phase-4-2.js` in release graph
- [x] Docs updated (08, 09, 13, 15, 24, 33)

---

## Active Rules (Phase 4.2)

| Rule | Status |
|---|---|
| Backlog selection must be deterministic and explainable | **Enforced** |
| Backlog progress reports are generated from the Master Engineering Backlog and execution status | **Enforced** |
| Engineering task lifecycle writes only to runtime engineering-task store | **Enforced** |
| OpenClaw handoff packages are drafts only and may not dispatch or run jobs | **Enforced** |
| Every Engineering Director task recommendation includes validation and repair policy before implementation | **Enforced** |
| External credentials, legal approval, Founder approval, and business decisions block task readiness | **Enforced** |
| Builder Plans may describe work but may not execute OpenClaw or jobs | **Enforced** |
| Business operator templates create mission specs only; no opportunities, contacts, or outreach | **Enforced** |
| Mission hints on file-drop observations remain metadata/provenance only | **Enforced** |
| Runtime health remains generated reporting only; no dashboard, daemon, or monitor service | **Enforced** |
| Backlog progress dashboard remains generated reporting only; no UI, daemon, execution loop, or outreach | **Enforced** |
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
| 2026-06-30 | Phase 4.2 B5: Backlog progress dashboard — deterministic backlog-derived progress, current task, blocker, and estimate reports |
| 2026-06-30 | Phase 4.2 B4: Regression-aware planning — task recommendations include focused, phase, regression, and core validation plans |
| 2026-06-30 | Phase 4.2 S1: Runtime health dashboard data — deterministic JSON/Markdown health report data with store counts and report policy |
| 2026-06-30 | Phase 4.2 B3: OpenClaw handoff package — approved engineering tasks become schema-valid handoff drafts only |
| 2026-06-30 | Phase 4.2 O-WEB1: Website agency mission template — local service business website growth mission |
| 2026-06-30 | Phase 4.2 B2: Engineering task registry — runtime lifecycle store for proposed, approved, active, blocked, and completed tasks |
| 2026-06-30 | Phase 4.2 O-APT1: Apartment financial workshop mission template — apartment community and sponsor acquisition mission |
| 2026-06-30 | Phase 4.2 C1: Mission-aware file-drop intake — candidate mission IDs, mission hints, and source labels preserved as metadata/provenance |
| 2026-06-30 | Phase 4.2 O-KTM1: KTM industrial maintenance mission template — Beaumont 500-mile industrial opportunity mission |
| 2026-06-30 | Phase 4.2 O-PW1: Pressure washing business operator mission template — Beaumont 500-mile commercial cash-flow mission |
| 2026-06-30 | Phase 4.2 B1: Engineering Director backlog selector — deterministic task selection + Builder Plan output |
| 2026-06-29 | Phase 4.1: Founder Intent Interpreter — mission chef above OS, no outreach |
| 2026-06-23 | Phase 4.0.6: Engine-data read-only enforcement |
| 2026-06-29 | Phase 4.0.5: Validation infrastructure — isolated runtime-validation, ValidationRunner |
| 2026-06-23 | Phase 4.0: Intelligence calibration — dedupe, classification, routing, abstention |
