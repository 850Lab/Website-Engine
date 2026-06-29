# 08 — Current Phase

**Status:** Living document · update when phase changes  
**Related:** [Roadmap](./01-roadmap.md) · [Build Log](./09-build-log.md) · [Autonomous Operating Loop](./28-autonomous-operating-loop.md) · [OpenClaw Constitution](./29-openclaw-constitution.md) · [OpenClaw Job Schema](./30-openclaw-job-schema.md)

---

## Current Phase

**Phase 4.0.6 — Engine-Data Read-Only Enforcement** — **COMPLETE**

`engine-data/` is read-only seed/config/reference data. All runtime, validation, sensor, and pipeline writes go only to `runtime/` or `runtime-validation/run-*`. Runtime IO rejects writes under `engine-data/`; validators fail if git-tracked engine-data changes.

Run: `node scripts/opportunity-engine/validate-phase-4-0-6.js`  
Full suite: `node scripts/opportunity-engine/validate-core.js`

**Architecture freeze:** R26–R30 — [07-architecture-rules.md](./07-architecture-rules.md)

---

## Phase 4.0.6 Objective

Harden storage boundaries so validation and runtime operations cannot mutate tracked seed data:

1. `src/engine/runtime/engine-data-guard.js` — `assertNotEngineDataWritePath()`, `assertRuntimeWritePath()`, `isEngineDataPath()`
2. Guard wired into `src/engine/runtime/io.js` (atomic JSON + append writes)
3. Signal registry writes target active runtime store only — legacy `engine-data/signals/signals.json` is read/merge only
4. `scripts/opportunity-engine/assert-engine-data-clean.js` — fails on `git status --short engine-data`
5. All validators assert engine-data cleanliness via `finalizeValidator()`
6. Release graph includes Phase 4.0.6 after 4.0

---

## Phase 4.0.6 Checklist

- [x] Engine-data guard module
- [x] Runtime IO write choke point
- [x] Signal store test clear no longer writes legacy path
- [x] assert-engine-data-clean helper
- [x] validate-phase-4-0-6.js
- [x] Validator graph + finalizeValidator integration
- [x] Docs updated (08, 09, 13, 15, 24)

---

## Prior Phase — COMPLETE

**Phase 4.0.5 — Validation Infrastructure Hardening**

Deterministic, isolated validation framework: each validator runs in `runtime-validation/run-{uuid}/`, nested subprocess regressions replaced by dependency graph execution, fail-fast root-cause reporting, structured results.

Run single phase: `node scripts/opportunity-engine/validate-core.js --phases=3.1`  
Run legacy phase script (standalone isolated runtime): `node scripts/opportunity-engine/validate-phase-3-8.js`

---

## Prior Phase — COMPLETE

**Phase 4.0 — Intelligence Calibration Layer**

Rules-only calibration improves dedupe, semantic classification, situation routing, capability ranking, and commercial abstention before Opportunity creation.

Run: `node scripts/opportunity-engine/validate-phase-4-0.js`  
Analyze: `node scripts/opportunity-engine/analyze-real-observations.js`

---

## Active Rules (Phase 4.0.6)

| Rule | Status |
|---|---|
| `engine-data/` read-only during runtime and validation | **Enforced** |
| Mutable data only in `runtime/` or `runtime-validation/run-*` | **Enforced** |
| Runtime override must not target `engine-data/` | **Enforced** |
| Validators fail on engine-data git changes | **Enforced** |
| Phase 4.1 blocked until owner approval | **Enforced** |

---

## Phase 4.1 (Blocked)

**Autonomous Execution / Outreach** — blocked until owner approves explicit implementation prompt.

Do not build daemon mode, continuous polling, outreach automation, or Score Council / Mission Control changes without owner authorization.

---

## Prior Phases — COMPLETE

### Phase 3.8 — End-to-End Live Pipeline Run

Run: `node scripts/opportunity-engine/validate-phase-3-8.js`

### Phase 3.7 — Pipeline Stage Handlers

Run: `node scripts/opportunity-engine/validate-phase-3-7.js`

### Phase 3.6 — Event Pipeline Orchestrator

Run: `node scripts/opportunity-engine/validate-phase-3-6.js`

---

## Decision Log

| Date | Decision |
|---|---|
| 2026-06-23 | Phase 4.0.6: Engine-data read-only enforcement — guard, IO choke point, validator git assert |
| 2026-06-29 | Phase 4.0.5: Validation infrastructure — isolated runtime-validation, ValidationRunner |
| 2026-06-23 | Phase 4.0: Intelligence calibration — dedupe, classification, routing, capability fit, abstention gate |
| 2026-06-23 | Phase 3.8: End-to-end live pipeline run — file drop to opportunity, STOP |
| 2026-06-23 | Phase 3.7: Pipeline Stage Handlers — processor executes intelligence stages, STOP |
| 2026-06-23 | Phase 3.6: Event Pipeline Orchestrator — event-driven Job chaining, STOP |
