# 08 — Current Phase

**Status:** Living document · update when phase changes  
**Related:** [Roadmap](./01-roadmap.md) · [Build Log](./09-build-log.md) · [World Model](./23-world-model.md) · [Reasoning Engine](./26-reasoning-engine.md) · [Capability Intelligence](./27-capability-intelligence.md) · [Autonomous Operating Loop](./28-autonomous-operating-loop.md) · [Runtime Data Boundaries](./24-runtime-data-boundaries.md)

---

## Current Phase

**Phase 3.0.5 — Autonomous Operating Loop Constitution** — **COMPLETE**

Design-only Constitution amendment: Job model, Event model, scheduler rules, system state, failure handling, idempotency, concurrency policy, and role boundaries for Autopilot, Mission Control, and OpenClaw.

**No production code** in Phase 3.0.5 — no runtime folders, validators, connectors, Mission Control changes, or OpenClaw.

**Commercial Intelligence pipeline complete** (Phases 2.7–2.9). The operating loop orchestrates existing stages into a continuous cycle.

**Architecture freeze:** Implement per Constitution; amend only on genuine deficiency — [R26–R30](./07-architecture-rules.md#architecture-freeze-owner-policy--phase-27).

---

## Phase 3.0.5 Objective

Define how Opportunity OS continuously observes, processes, reasons, creates opportunities, and prepares execution — before any loop runtime is built.

Read: [28-autonomous-operating-loop.md](./28-autonomous-operating-loop.md)

---

## Phase 3.0.5 Checklist

- [x] Canonical loop defined (Sensor Run → … → Learning)
- [x] Canonical Job object schema
- [x] Canonical Event object schema
- [x] Scheduler rules (cadence, queue, retry, dedupe)
- [x] System state model (idle → … → failed)
- [x] Failure handling (retry, backoff, dead-letter, partial failure, recovery)
- [x] Idempotency rules per stage
- [x] Concurrency policy (single-process first)
- [x] Autopilot, Mission Control, OpenClaw role boundaries
- [x] Phase 3.1–3.5 sub-roadmap
- [x] Permanent rules AOL1–AOL15

---

## Active Rules (Phase 3.0.5)

| Rule | Status |
|---|---|
| Design only — no production code | **Enforced** |
| No runtime folders for jobs/events | **Enforced** |
| No validators, connectors, Mission Control, OpenClaw | **Enforced** |
| Loop orchestrates existing modules — no intelligence redesign | **Enforced** |
| Autopilot supervises — does not bypass owner gates | **Enforced** |
| Phase 3.1 blocked until owner approval | **Enforced** |

---

## Canonical Operating Loop

```
Sensor Run → Observation → Signal Registry → Fact Builder
  → Graph/Relationships → Situations → Hypotheses → Problems
  → Capability Matches → Offer Recommendations → Opportunities
  → Score Council → Mission Control → Execution Queue
  → Outcomes → Learning → (repeat)
```

See [28-autonomous-operating-loop.md §2](./28-autonomous-operating-loop.md#2-canonical-loop).

---

## Phase 3.1 (Blocked)

**Job / Event runtime** — blocked until owner approves explicit implementation prompt.

Do not create `runtime/jobs/`, `runtime/events/`, loop engine modules, or Phase 3.1 validators without owner authorization.

---

## Prior Phases — COMPLETE

### Phase 2.9.5 — Core Stability

Run: `node scripts/opportunity-engine/validate-phase-2-9-5.js`

Full regression: `node scripts/opportunity-engine/validate-core.js`

### Phase 2.9 — Opportunity Factory

Run: `node scripts/opportunity-engine/validate-phase-2-9.js`

### Phase 2.8 — Offer Intelligence

Run: `node scripts/opportunity-engine/validate-phase-2-8.js`

### Phase 2.7 — Capability Matching Engine · **OWNER APPROVED**

Run: `node scripts/opportunity-engine/validate-phase-2-7.js`

---

## Decision Log

| Date | Decision |
|---|---|
| 2026-06-23 | Phase 3.0.5: Autonomous Operating Loop Constitution — design only; Phase 3.1 blocked |
| 2026-06-23 | Phase 2.9.5: Core stability — runtime IO hardening, validate-core orchestrator |
| 2026-06-28 | Phase 2.9: Opportunity Factory — Commercial Intelligence complete |
| 2026-06-27 | Phase 2.8: Offer Intelligence implemented |
| 2026-06-27 | **Owner approved Phase 2.7** + architecture freeze (R26–R30) |

Add entries to [Build Log](./09-build-log.md) for architectural milestones.
