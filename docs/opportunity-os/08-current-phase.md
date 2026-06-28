# 08 — Current Phase

**Status:** Living document · update when phase changes  
**Related:** [Roadmap](./01-roadmap.md) · [Build Log](./09-build-log.md) · [Autonomous Operating Loop](./28-autonomous-operating-loop.md) · [OpenClaw Constitution](./29-openclaw-constitution.md) · [OpenClaw Job Schema](./30-openclaw-job-schema.md)

---

## Current Phase

**Phase 3.5 — First Live Sensor Connector** — **COMPLETE**

File drop live sensor reads local observation files from `runtime/inbox/observations/`, produces canonical Observations, ingests through the existing Sensor → Signal path, creates Signals, marks processed files, and STOPs. No facts, graph, reasoning, or execution.

Run: `node scripts/opportunity-engine/validate-phase-3-5.js`

**Architecture freeze:** R26–R30 — [07-architecture-rules.md](./07-architecture-rules.md)

---

## Phase 3.5 Objective

Implement one safe live connector: local file drop → Observation → Signal Registry. Manual invocation only. No scheduler wiring, no downstream reasoning.

---

## Phase 3.5 Checklist

- [x] `runtime/inbox/observations/` drop directory (gitignored runtime)
- [x] `src/engine/sensors/live/file-drop-sensor.js` — `collectFileDropObservations()`, `runFileDropSensor()`
- [x] Supports `.json`, `.txt`, `.md` with deterministic parsing (no LLM)
- [x] Processed markers under `runtime/inbox/observations/processed/`
- [x] Content-hash dedupe — re-run does not duplicate signals
- [x] `validate-phase-3-5.js` + Phase 3.4 / 3.3 / 3.2 regressions

---

## Active Rules (Phase 3.5)

| Rule | Status |
|---|---|
| One live connector only — local file drop | **Enforced** |
| Signal Registry is the only output — no facts/graph/reasoning | **Enforced** |
| No network calls, Mission Control, Score Council, or OpenClaw Execution | **Enforced** |
| No scheduler, daemon, or automatic polling | **Enforced** |
| Phase 3.6+ blocked until owner approval | **Enforced** |

---

## Phase 3.6+ (Blocked)

**Additional Live Connectors** — blocked until owner approves each connector explicitly.

Do not implement additional live sensors, automatic scheduling, or downstream reasoning without owner authorization.

---

## Prior Phases — COMPLETE

### Phase 3.5 — First Live Sensor Connector

Run: `node scripts/opportunity-engine/validate-phase-3-5.js`

### Phase 3.4 — Execution Queue / Dispatcher

Run: `node scripts/opportunity-engine/validate-phase-3-4.js`

### Phase 3.3 — Continuous Processor

Run: `node scripts/opportunity-engine/validate-phase-3-3.js`

### Phase 3.2 — Operating Loop Scheduler

Run: `node scripts/opportunity-engine/validate-phase-3-2.js`

---

## Decision Log

| Date | Decision |
|---|---|
| 2026-06-23 | Phase 3.5: First live sensor — file drop → Signal Registry, STOP |
| 2026-06-23 | Phase 3.4: Execution Queue / Dispatcher — routing decisions only, STOP |
| 2026-06-23 | Phase 3.3: Continuous Processor — one job per invocation, STOP |
