# 08 — Current Phase

**Status:** Living document · update when phase changes  
**Related:** [Roadmap](./01-roadmap.md) · [Build Log](./09-build-log.md) · [Autonomous Operating Loop](./28-autonomous-operating-loop.md) · [OpenClaw Constitution](./29-openclaw-constitution.md) · [OpenClaw Job Schema](./30-openclaw-job-schema.md)

---

## Current Phase

**Phase 3.1.6 — OpenClaw Job Schema** — **COMPLETE**

Design-only schema defining the contract between Owner, Job/Event Runtime, OpenClaw Worker, Validators, Reports, and Owner approval. OpenClaw Job lives in `genericJob.metadata.openclaw`.

Read: [30-openclaw-job-schema.md](./30-openclaw-job-schema.md)

**No production code** in Phase 3.1.6 — no OpenClaw Worker, schema validators, or runtime extensions.

**Architecture freeze:** R26–R30 — [07-architecture-rules.md](./07-architecture-rules.md)

---

## Phase 3.1.6 Objective

Define permanent OpenClaw Job schema so workers never act on vague, unscoped, or unapproved work.

---

## Phase 3.1.6 Checklist

- [x] Canonical OpenClaw Job object with field reference
- [x] Job types (`openclaw.build`, `openclaw.qa`, …) with phase gates
- [x] Agent roles with allowlists and forbidden actions
- [x] Owner approval artifact specification
- [x] `promptHash` and idempotency derivation
- [x] Scope, validation, commit, and report policies
- [x] Stop conditions and Event types
- [x] Four example jobs (Builder, QA, Docs, blocked Connector)
- [x] Mapping to Phase 3.1 generic Jobs
- [x] Permanent rules OCJ1–OCJ15

---

## Active Rules (Phase 3.1.6)

| Rule | Status |
|---|---|
| Design only — no OpenClaw Worker code | **Enforced** |
| No job without approval, phaseId, promptHash | **Defined (OCJ1–OCJ3)** |
| OpenClaw schema in `metadata.openclaw` only | **Defined** |
| Phase 3.1.7 blocked until owner approval | **Enforced** |

---

## Phase 3.1.7 (Blocked)

**OpenClaw CLI Worker** — blocked until owner approves explicit implementation prompt.

Do not implement `scripts/openclaw/` or Job schema validation code without owner authorization.

---

## Prior Phases — COMPLETE

### Phase 3.1.5 — OpenClaw Constitution

Read: [29-openclaw-constitution.md](./29-openclaw-constitution.md)

### Phase 3.1 — Job & Event Runtime

Run: `node scripts/opportunity-engine/validate-phase-3-1.js`

---

## Decision Log

| Date | Decision |
|---|---|
| 2026-06-23 | Phase 3.1.6: OpenClaw Job Schema — OCJ1–OCJ15; Phase 3.1.7 blocked |
| 2026-06-23 | Phase 3.1.5: OpenClaw Constitution |
| 2026-06-23 | Phase 3.1: Job & Event runtime kernel |

Add entries to [Build Log](./09-build-log.md).
