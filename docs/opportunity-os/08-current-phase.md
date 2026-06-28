# 08 — Current Phase

**Status:** Living document · update when phase changes  
**Related:** [Roadmap](./01-roadmap.md) · [Build Log](./09-build-log.md) · [Autonomous Operating Loop](./28-autonomous-operating-loop.md) · [Runtime Data Boundaries](./24-runtime-data-boundaries.md)

---

## Current Phase

**Phase 3.1 — Job & Event Runtime** — **COMPLETE**

Operating-loop kernel: append-only event store, mutable job store, idempotency, dead-letter handling, job transition events. **No scheduler, no automatic processing.**

Run: `node scripts/opportunity-engine/validate-phase-3-1.js`

**Architecture freeze:** Implement per Constitution; amend only on genuine deficiency — [R26–R30](./07-architecture-rules.md#architecture-freeze-owner-policy--phase-27).

---

## Phase 3.1 Objective

Implement canonical Job and Event runtime stores exactly as [28-autonomous-operating-loop.md](./28-autonomous-operating-loop.md) defines — kernel only.

---

## Phase 3.1 Checklist

- [x] `runtime/events/events.jsonl` — append-only event store
- [x] `runtime/jobs/jobs.json` — mutable job store
- [x] `src/engine/events/` — event API
- [x] `src/engine/jobs/` — job API + idempotency
- [x] Job lifecycle events (`job.created`, `job.claimed`, `job.completed`, `job.failed`, `job.retry`, `job.dead_letter`, …)
- [x] Idempotency by `idempotencyKey` for active jobs
- [x] Dead-letter on `maxAttempts` exceeded — no automatic replay
- [x] Runtime IO helpers (atomic JSON + append JSONL)
- [x] `scripts/opportunity-engine/validate-phase-3-1.js`
- [x] No scheduler, timers, polling, connectors, Mission Control, Score Council, or OpenClaw changes

---

## Active Rules (Phase 3.1)

| Rule | Status |
|---|---|
| Kernel only — no scheduler | **Enforced** |
| Events append-only; jobs mutable | **Enforced** |
| Job transitions emit events | **Enforced** |
| Idempotency for active jobs | **Enforced** |
| Dead-letter manual replay only | **Enforced** |
| Phase 3.2 blocked until owner approval | **Enforced** |

---

## Operating Loop Kernel (Phase 3.1)

```
Module → Event → Event Store → Job Created → Job Claimed → Job Completed → Completion Event → STOP
```

No automatic execution. No background workers.

---

## Phase 3.2 (Blocked)

**Sensor scheduler** — blocked until owner approves explicit implementation prompt.

Do not implement scheduler tick loops, `sensor.run` scheduling, or continuous processing without owner authorization.

---

## Prior Phases — COMPLETE

### Phase 3.0.5 — Autonomous Operating Loop Constitution

Read: [28-autonomous-operating-loop.md](./28-autonomous-operating-loop.md)

### Phase 2.9.5 — Core Stability

Run: `node scripts/opportunity-engine/validate-phase-2-9-5.js`

---

## Decision Log

| Date | Decision |
|---|---|
| 2026-06-23 | Phase 3.1: Job & Event runtime kernel — no scheduler |
| 2026-06-23 | Phase 3.0.5: Autonomous Operating Loop Constitution |
| 2026-06-23 | Phase 2.9.5: Core stability — runtime IO hardening |

Add entries to [Build Log](./09-build-log.md) for architectural milestones.
