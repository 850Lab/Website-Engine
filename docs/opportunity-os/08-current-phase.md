# 08 — Current Phase

**Status:** Living document · update when phase changes  
**Related:** [Roadmap](./01-roadmap.md) · [Build Log](./09-build-log.md) · [Autonomous Operating Loop](./28-autonomous-operating-loop.md) · [OpenClaw Constitution](./29-openclaw-constitution.md) · [OpenClaw Job Schema](./30-openclaw-job-schema.md)

---

## Current Phase

**Phase 3.1.8 — OpenClaw QA Worker** — **COMPLETE**

Bounded read-only QA CLI worker executes one approved `openclaw.qa` Job and stops. No source edits, no commits, no fixes.

Run: `node scripts/opportunity-engine/validate-phase-3-1-8.js`

**Architecture freeze:** R26–R30 — [07-architecture-rules.md](./07-architecture-rules.md)

---

## Phase 3.1.8 Objective

Implement manual OpenClaw QA Worker: validate QA job schema, verify approval/prompt/idempotency, run read-only validation commands, evaluate expected outputs, write QA report, emit Events, complete/fail Job, STOP.

---

## Phase 3.1.8 Checklist

- [x] `src/engine/openclaw/qa-worker.js`, `qa-report.js`, `qa-assertions.js`, `qa-schema.js`
- [x] `scripts/openclaw/run-qa-job.js` — one QA Job per invocation
- [x] `scripts/openclaw/create-demo-qa-job.js` — safe demo QA Job
- [x] QA command allowlist (read-only)
- [x] Expected output evaluation
- [x] QA Events (`openclaw.qa.*`)
- [x] `validate-phase-3-1-8.js` + Phase 3.1.7.5 / 3.1 regressions

---

## Active Rules (Phase 3.1.8)

| Rule | Status |
|---|---|
| QA agent read-only — no commits or source edits | **Enforced** |
| One approved QA Job per worker invocation | **Enforced** |
| QA command allowlist stricter than Builder | **Enforced** |
| Expected outputs must pass for QA verdict | **Enforced** |
| Phase 3.2 blocked until owner approval | **Enforced** |

---

## Phase 3.2 (Blocked)

**Operating Loop Scheduler** — blocked until owner approves explicit implementation prompt.

Do not implement scheduler, continuous loop, or live connectors without owner authorization.

---

## Prior Phases — COMPLETE

### Phase 3.1.7.5 — OpenClaw Security Hardening

Run: `node scripts/opportunity-engine/validate-phase-3-1-7-5.js`

### Phase 3.1.7 — OpenClaw Builder Worker v1

Run: `node scripts/opportunity-engine/validate-phase-3-1-7.js`

### Phase 3.1 — Job & Event Runtime

Run: `node scripts/opportunity-engine/validate-phase-3-1.js`

---

## Decision Log

| Date | Decision |
|---|---|
| 2026-06-23 | Phase 3.1.8: OpenClaw QA Worker — read-only, one Job, STOP |
| 2026-06-23 | Phase 3.1.7.5: OpenClaw security hardening |
| 2026-06-23 | Phase 3.1.7: OpenClaw Builder Worker v1 |
