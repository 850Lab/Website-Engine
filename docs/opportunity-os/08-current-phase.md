# 08 — Current Phase

**Status:** Living document · update when phase changes  
**Related:** [Roadmap](./01-roadmap.md) · [Build Log](./09-build-log.md) · [Autonomous Operating Loop](./28-autonomous-operating-loop.md) · [OpenClaw Constitution](./29-openclaw-constitution.md) · [OpenClaw Job Schema](./30-openclaw-job-schema.md)

---

## Current Phase

**Phase 3.1.7.5 — OpenClaw Security Hardening** — **COMPLETE**

Hardens OpenClaw Builder before a second autonomous agent: verified prompt hashes, bound idempotency keys, command allowlist, forensic reports, and full event coverage on all exit paths.

Run: `node scripts/opportunity-engine/validate-phase-3-1-7-5.js`

**Architecture freeze:** R26–R30 — [07-architecture-rules.md](./07-architecture-rules.md)

---

## Phase 3.1.7.5 Objective

Close autonomy audit gaps in Builder v1 without redesign: prompt artifact verification, approval hardening, idempotency binding, command allowlist, report enrichment, event coverage.

---

## Phase 3.1.7.5 Checklist

- [x] Canonical prompt artifact + `hashCanonicalPromptText()` verification
- [x] `VALIDATION_DEMO` gated by `OPENCLAW_ALLOW_VALIDATION_DEMO=1` or explicit option
- [x] Idempotency formula `openclaw:{phaseId}:{jobType}:{promptHash}`
- [x] Command allowlist (node, npm run, safe git only)
- [x] Forensic reports (hash, correlationId, approval, event ids, stderr on failure)
- [x] Full event coverage including job-not-found and terminal failed/stopped
- [x] `validate-phase-3-1-7-5.js` + Phase 3.1.7 / 3.1 regressions

---

## Active Rules (Phase 3.1.7.5)

| Rule | Status |
|---|---|
| Prompt hash must match approved artifact | **Enforced** |
| Idempotency key must match formula | **Enforced** |
| VALIDATION_DEMO off by default in production CLI | **Enforced** |
| Commands allowlisted before execution | **Enforced** |
| Every terminal path emits failed + stopped + reported | **Enforced** |
| Phase 3.1.8 blocked until owner approval | **Enforced** |

---

## Phase 3.1.8 (Blocked)

**OpenClaw QA Worker** — blocked until owner approves explicit implementation prompt.

Do not implement QA automation, multi-job chains, or autopilot without owner authorization.

---

## Prior Phases — COMPLETE

### Phase 3.1.7 — OpenClaw Builder Worker v1

Run: `node scripts/opportunity-engine/validate-phase-3-1-7.js`

### Phase 3.1.6 — OpenClaw Job Schema

Read: [30-openclaw-job-schema.md](./30-openclaw-job-schema.md)

### Phase 3.1 — Job & Event Runtime

Run: `node scripts/opportunity-engine/validate-phase-3-1.js`

---

## Decision Log

| Date | Decision |
|---|---|
| 2026-06-23 | Phase 3.1.7.5: OpenClaw security hardening — prompt verification, allowlist, forensic reports |
| 2026-06-23 | Phase 3.1.7: OpenClaw Builder Worker v1 — bounded CLI, one Job, STOP |
| 2026-06-23 | Phase 3.1.6: OpenClaw Job Schema — OCJ1–OCJ15 |
| 2026-06-23 | Phase 3.1: Job & Event runtime kernel |
