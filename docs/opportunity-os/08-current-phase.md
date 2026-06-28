# 08 — Current Phase

**Status:** Living document · update when phase changes  
**Related:** [Roadmap](./01-roadmap.md) · [Build Log](./09-build-log.md) · [Autonomous Operating Loop](./28-autonomous-operating-loop.md) · [OpenClaw Constitution](./29-openclaw-constitution.md) · [OpenClaw Job Schema](./30-openclaw-job-schema.md)

---

## Current Phase

**Phase 3.6 — Event Pipeline Orchestrator** — **COMPLETE**

Event pipeline orchestrator listens to domain Events, resolves downstream Job routes, enqueues Jobs with correlation/causation/idempotency, emits `orchestrator.*` Events, and STOPs. No job execution, no direct intelligence calls.

Run: `node scripts/opportunity-engine/validate-phase-3-6.js`

**Architecture freeze:** R26–R30 — [07-architecture-rules.md](./07-architecture-rules.md)

---

## Phase 3.6 Objective

Transform the pipeline into event-driven Job chaining: Signal → Fact → Graph → Situation → Hypothesis → Problem → Capability → Offer → Opportunity via orchestrated Job enqueue only.

---

## Phase 3.6 Checklist

- [x] `runtime/orchestrator/orchestrator.json` append-only history (gitignored)
- [x] `src/engine/orchestrator/` — registry, routing, enqueue, handlers, events
- [x] Deterministic event routing for full knowledge spine
- [x] Idempotent Job enqueue via existing Phase 3.1 infrastructure
- [x] Orchestrator Events: `orchestrator.started`, `route_found`, `job_enqueued`, `no_route`, `completed`, `failed`
- [x] `validate-phase-3-6.js` + Phase 3.5–3.1 regressions

---

## Active Rules (Phase 3.6)

| Rule | Status |
|---|---|
| Orchestrator enqueues Jobs only — never claims or executes | **Enforced** |
| No direct calls into intelligence modules | **Enforced** |
| correlationId and causationId preserved on enqueued Jobs | **Enforced** |
| Unknown events ignored — no crash | **Enforced** |
| Phase 3.7 blocked until owner approval | **Enforced** |

---

## Phase 3.7 (Blocked)

**Pipeline Stage Handlers / Worker Bindings** — blocked until owner approves explicit implementation prompt.

Do not implement stage execution handlers, worker automation, or continuous loop daemons without owner authorization.

---

## Prior Phases — COMPLETE

### Phase 3.5 — First Live Sensor Connector

Run: `node scripts/opportunity-engine/validate-phase-3-5.js`

### Phase 3.4 — Execution Queue / Dispatcher

Run: `node scripts/opportunity-engine/validate-phase-3-4.js`

### Phase 3.3 — Continuous Processor

Run: `node scripts/opportunity-engine/validate-phase-3-3.js`

---

## Decision Log

| Date | Decision |
|---|---|
| 2026-06-23 | Phase 3.6: Event Pipeline Orchestrator — event-driven Job chaining, STOP |
| 2026-06-23 | Phase 3.5: First live sensor — file drop → Signal Registry, STOP |
| 2026-06-23 | Phase 3.4: Execution Queue — routing decisions only, STOP |
