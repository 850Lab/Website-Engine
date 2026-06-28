# 08 — Current Phase

**Status:** Living document · update when phase changes  
**Related:** [Roadmap](./01-roadmap.md) · [Build Log](./09-build-log.md) · [Autonomous Operating Loop](./28-autonomous-operating-loop.md) · [OpenClaw Constitution](./29-openclaw-constitution.md) · [Runtime Data Boundaries](./24-runtime-data-boundaries.md)

---

## Current Phase

**Phase 3.1.5 — OpenClaw Constitution** — **COMPLETE**

Design-only Constitution amendment defining OpenClaw as the first bounded autonomous worker: approved Job execution, Event emission, validation/commit/failure protocols, multi-agent roadmap, and OC1–OC15 permanent rules.

**No production code** in Phase 3.1.5 — no OpenClaw CLI, Job schema extensions, agents, or execution logic.

Read: [29-openclaw-constitution.md](./29-openclaw-constitution.md)

**Architecture freeze:** Implement per Constitution; amend only on genuine deficiency — [R26–R30](./07-architecture-rules.md#architecture-freeze-owner-policy--phase-27).

---

## Phase 3.1.5 Objective

Define permanent rules for OpenClaw before any worker implementation.

---

## Phase 3.1.5 Checklist

- [x] Purpose and identity (bounded worker, not architect/owner/MC/Score Council)
- [x] Allowed responsibilities (Jobs, validators, docs, commits, reports, Events, stop)
- [x] Forbidden responsibilities (redesign, outreach, owner bypass, MC/Constitution changes)
- [x] Job/Event interaction model
- [x] Owner approval model
- [x] Validation, commit, and failure protocols
- [x] Multi-agent future roles (Builder, QA, Research, Documentation, Refactor, Connector, Execution)
- [x] Chain of command
- [x] Permanent rules OC1–OC15
- [x] Phase 3.1.6–3.1.8 + 3.2 roadmap

---

## Active Rules (Phase 3.1.5)

| Rule | Status |
|---|---|
| Design only — no OpenClaw code | **Enforced** |
| OpenClaw consumes Jobs, emits Events | **Defined** |
| Stop after one approved phase | **Enforced** |
| No outreach execution until OpenClaw Execution agent | **Enforced** |
| Phase 3.1.6 blocked until owner approval | **Enforced** |

---

## Chain of Command

```
Owner → Constitution → Job/Event Runtime → OpenClaw → Validators → Reports → Owner approval → STOP
```

---

## Phase 3.1.6 (Blocked)

**OpenClaw Job Schema** — blocked until owner approves explicit implementation prompt.

Do not define `openclaw.*` Job types in code or extend runtime schemas without owner authorization.

---

## Prior Phases — COMPLETE

### Phase 3.1 — Job & Event Runtime

Run: `node scripts/opportunity-engine/validate-phase-3-1.js`

### Phase 3.0.5 — Autonomous Operating Loop Constitution

Read: [28-autonomous-operating-loop.md](./28-autonomous-operating-loop.md)

### Phase 2.9.5 — Core Stability

Run: `node scripts/opportunity-engine/validate-phase-2-9-5.js`

---

## Decision Log

| Date | Decision |
|---|---|
| 2026-06-23 | Phase 3.1.5: OpenClaw Constitution — design only; Phase 3.1.6 blocked |
| 2026-06-23 | Phase 3.1: Job & Event runtime kernel |
| 2026-06-23 | Phase 3.0.5: Autonomous Operating Loop Constitution |

Add entries to [Build Log](./09-build-log.md) for architectural milestones.
