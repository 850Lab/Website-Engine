# 08 — Current Phase

**Status:** Living document · update when phase changes  
**Related:** [Roadmap](./01-roadmap.md) · [Build Log](./09-build-log.md) · [Autonomous Operating Loop](./28-autonomous-operating-loop.md) · [OpenClaw Constitution](./29-openclaw-constitution.md) · [OpenClaw Job Schema](./30-openclaw-job-schema.md)

---

## Current Phase

**Phase 3.4 — Execution Queue / Dispatcher** — **COMPLETE**

Execution queue loads eligible pending jobs, ranks by priority, resolves worker routes, creates a dispatch decision, emits `execution_queue.*` Events, and STOPs. No job claiming, execution, or worker invocation.

Run: `node scripts/opportunity-engine/validate-phase-3-4.js`

**Architecture freeze:** R26–R30 — [07-architecture-rules.md](./07-architecture-rules.md)

---

## Phase 3.4 Objective

Implement routing and dispatch decisions only: pending jobs → eligibility / priority / routing → dispatch decision persisted to `runtime/dispatch/dispatch.json` → STOP.

---

## Phase 3.4 Checklist

- [x] `runtime/dispatch/` + `dispatch.json` store (gitignored)
- [x] `src/engine/execution-queue/` — queue, routing, priority, dispatch, events
- [x] Queue API: `listEligibleJobs`, `rankEligibleJobs`, `resolveWorkerTarget`, `createDispatchDecision`, `dispatchNextJob`, `listWorkerRoutes`
- [x] Routes: `demo.echo` → `processor`, `openclaw.build` → `openclaw.builder`, `openclaw.qa` → `openclaw.qa`
- [x] Blocked types skipped: `sensor.poll`, `connector.run`, `execution.outreach`, `research.run`
- [x] `validate-phase-3-4.js` + Phase 3.3 / 3.2 / 3.1.8 regressions

---

## Active Rules (Phase 3.4)

| Rule | Status |
|---|---|
| Dispatcher creates routing decisions only — never claims or executes | **Enforced** |
| No sensors, connectors, OpenClaw Execution, Mission Control, or Score Council | **Enforced** |
| No timers, polling loops, daemons, or background workers | **Enforced** |
| Phase 3.5 blocked until owner approval | **Enforced** |

---

## Phase 3.5 (Blocked)

**Live Connectors** — blocked until owner approves explicit implementation prompt.

Do not implement production sensors, connector migration, or live ingest without owner authorization.

---

## Prior Phases — COMPLETE

### Phase 3.3 — Continuous Processor

Run: `node scripts/opportunity-engine/validate-phase-3-3.js`

### Phase 3.2 — Operating Loop Scheduler

Run: `node scripts/opportunity-engine/validate-phase-3-2.js`

### Phase 3.1.8 — OpenClaw QA Worker

Run: `node scripts/opportunity-engine/validate-phase-3-1-8.js`

---

## Decision Log

| Date | Decision |
|---|---|
| 2026-06-23 | Phase 3.4: Execution Queue / Dispatcher — routing decisions only, STOP |
| 2026-06-23 | Phase 3.3: Continuous Processor — one job per invocation, STOP |
| 2026-06-23 | Phase 3.2: Operating Loop Scheduler — enqueue pending jobs only, STOP |
