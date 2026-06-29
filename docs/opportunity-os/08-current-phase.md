# 08 — Current Phase

**Status:** Living document · update when phase changes  
**Related:** [Roadmap](./01-roadmap.md) · [Build Log](./09-build-log.md) · [Autonomous Operating Loop](./28-autonomous-operating-loop.md) · [OpenClaw Constitution](./29-openclaw-constitution.md) · [OpenClaw Job Schema](./30-openclaw-job-schema.md)

---

## Current Phase

**Phase 4.0.5 — Validation Infrastructure Hardening** — **COMPLETE**

Deterministic, isolated validation framework: each validator runs in `runtime-validation/run-{uuid}/`, nested subprocess regressions replaced by dependency graph execution, fail-fast root-cause reporting, structured results.

Run full suite: `node scripts/opportunity-engine/validate-core.js`  
Run single phase: `node scripts/opportunity-engine/validate-core.js --phases=3.1`  
Run legacy phase script (standalone isolated runtime): `node scripts/opportunity-engine/validate-phase-3-8.js`

**Architecture freeze:** R26–R30 — [07-architecture-rules.md](./07-architecture-rules.md)

---

## Phase 4.0.5 Objective

Make the validation framework deterministic, isolated, and trustworthy:

1. Isolated `runtime-validation/` workspace per validator run
2. Runtime override via `OPPORTUNITY_RUNTIME_DIR` (backward compatible with `OPPORTUNITY_OS_RUNTIME_DIR`)
3. `src/engine/validation/` — ValidationContext, ValidationRuntime, ValidationRunner
4. Dependency graph replaces nested validator subprocess chains
5. Fail-fast with root failure + blocked phase reporting
6. Structured validator results (no console scraping)
7. Release report: `reports/release-validation.md`

---

## Phase 4.0.5 Checklist

- [x] Validation framework (`src/engine/validation/`)
- [x] Isolated runtime under `runtime-validation/` (gitignored)
- [x] All phase validators wired through bootstrap/finalize hooks
- [x] Nested regressions skipped when `VALIDATION_FRAMEWORK_MANAGED=1`
- [x] `validate-core.js` → `ValidationRunner.runReleaseSuite()`
- [x] Runtime assertions — directories via `ensureRuntimeDirectories()`, not `.gitkeep`
- [x] Docs updated (08, 09, 13, 15, 24)

---

## Prior Phase — COMPLETE

**Phase 4.0 — Intelligence Calibration Layer**

Rules-only calibration improves dedupe, semantic classification, situation routing, capability ranking, and commercial abstention before Opportunity creation.

Run: `node scripts/opportunity-engine/validate-phase-4-0.js`  
Analyze: `node scripts/opportunity-engine/analyze-real-observations.js`

---

## Active Rules (Phase 4.0)

| Rule | Status |
|---|---|
| Rules-only calibration — no LLM, no external API | **Enforced** |
| No new infrastructure, connectors, or outreach | **Enforced** |
| OpenClaw and Mission Control unchanged | **Enforced** |
| Upstream artifacts preserved on abstention | **Enforced** |
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
| 2026-06-23 | Phase 4.0: Intelligence calibration — dedupe, classification, routing, capability fit, abstention gate |
| 2026-06-23 | Phase 3.8: End-to-end live pipeline run — file drop to opportunity, STOP |
| 2026-06-23 | Phase 3.7: Pipeline Stage Handlers — processor executes intelligence stages, STOP |
| 2026-06-23 | Phase 3.6: Event Pipeline Orchestrator — event-driven Job chaining, STOP |
