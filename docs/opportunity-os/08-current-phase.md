# 08 — Current Phase

**Status:** Living document · update when phase changes  
**Related:** [Roadmap](./01-roadmap.md) · [Build Log](./09-build-log.md) · [Autonomous Operating Loop](./28-autonomous-operating-loop.md) · [OpenClaw Constitution](./29-openclaw-constitution.md) · [OpenClaw Job Schema](./30-openclaw-job-schema.md)

---

## Current Phase

**Phase 3.1.7 — OpenClaw Builder Worker v1** — **COMPLETE**

Bounded CLI worker executes one approved `openclaw.build` Job and stops. No scheduler, no loop, no autonomous planning.

Run: `node scripts/opportunity-engine/validate-phase-3-1-7.js`

**Architecture freeze:** R26–R30 — [07-architecture-rules.md](./07-architecture-rules.md)

---

## Phase 3.1.7 Objective

Implement manual OpenClaw Builder Worker: schema validation, owner approval, claim Job, run approved commands, enforce file scope, optional commit, write report, emit Events, complete/fail Job, STOP.

---

## Phase 3.1.7 Checklist

- [x] `src/engine/openclaw/` module (schema, approval, file-scope, command-runner, report, worker)
- [x] `scripts/openclaw/run-builder-job.js` — one Job per invocation
- [x] `scripts/openclaw/create-demo-builder-job.js` — safe demo Job (commit disabled)
- [x] OpenClaw Events (`openclaw.job.*`)
- [x] Reports under `reports/openclaw/` (gitignored)
- [x] `validate-phase-3-1-7.js` acceptance + Phase 3.1 regression

---

## Active Rules (Phase 3.1.7)

| Rule | Status |
|---|---|
| One approved Job per worker invocation | **Enforced** |
| No scheduler, loop, or live connectors | **Enforced** |
| No Mission Control / Score Council changes unless Job allows | **Enforced** |
| Commit only when `commitPolicy.enabled === true` | **Enforced** |
| Phase 3.1.8 blocked until owner approval | **Enforced** |

---

## Phase 3.1.8 (Blocked)

**OpenClaw QA Worker** — blocked until owner approves explicit implementation prompt.

Do not implement QA automation, multi-job chains, or autopilot without owner authorization.

---

## Prior Phases — COMPLETE

### Phase 3.1.6 — OpenClaw Job Schema

Read: [30-openclaw-job-schema.md](./30-openclaw-job-schema.md)

### Phase 3.1.5 — OpenClaw Constitution

Read: [29-openclaw-constitution.md](./29-openclaw-constitution.md)

### Phase 3.1 — Job & Event Runtime

Run: `node scripts/opportunity-engine/validate-phase-3-1.js`

---

## Decision Log

| Date | Decision |
|---|---|
| 2026-06-23 | Phase 3.1.7: OpenClaw Builder Worker v1 — bounded CLI, one Job, STOP |
| 2026-06-23 | Phase 3.1.6: OpenClaw Job Schema — OCJ1–OCJ15 |
| 2026-06-23 | Phase 3.1.5: OpenClaw Constitution |
| 2026-06-23 | Phase 3.1: Job & Event runtime kernel |
