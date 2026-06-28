# 08 — Current Phase

**Status:** Living document · update when phase changes  
**Related:** [Roadmap](./01-roadmap.md) · [Build Log](./09-build-log.md) · [Autonomous Operating Loop](./28-autonomous-operating-loop.md) · [OpenClaw Constitution](./29-openclaw-constitution.md) · [OpenClaw Job Schema](./30-openclaw-job-schema.md)

---

## Current Phase

**Phase 3.7 — Pipeline Stage Handlers** — **COMPLETE**

Production pipeline handlers registered with the Continuous Processor. Each handler executes one intelligence stage, persists outputs, emits domain completion Events and `pipeline.*` Events, and STOPs. Orchestrator (3.6) remains responsible for enqueueing downstream Jobs.

Run: `node scripts/opportunity-engine/validate-phase-3-7.js`

**Architecture freeze:** R26–R30 — [07-architecture-rules.md](./07-architecture-rules.md)

---

## Phase 3.7 Objective

Replace the demonstration handler with production pipeline handlers that bind existing engine modules to the Processor registry. One Job type → one stage handler → domain completion Event.

---

## Phase 3.7 Checklist

- [x] `src/engine/pipeline-handlers/` — eight stage handlers + events/utils/index
- [x] Processor registers production handlers (`fact.build` … `opportunity.build`)
- [x] `demo.echo` removed from default registration — available via `registerBuiltInHandlers()` for tests
- [x] Pipeline Events: `pipeline.started`, `stage_completed`, `failed`, `completed`
- [x] Domain completion Events for orchestrator chaining (`facts.completed` … `opportunity.completed`)
- [x] Idempotent handler replay — no duplicate downstream artifacts
- [x] `validate-phase-3-7.js` + Phase 3.6–3.1 regressions

---

## Active Rules (Phase 3.7)

| Rule | Status |
|---|---|
| Handlers execute one stage only — no downstream inline calls | **Enforced** |
| Handlers emit Events — orchestrator enqueues next Job | **Enforced** |
| No scheduler, orchestrator, or OpenClaw changes | **Enforced** |
| No new intelligence or reasoning modules | **Enforced** |
| Phase 3.8 blocked until owner approval | **Enforced** |

---

## Phase 3.8 (Blocked)

**Continuous Loop / Worker Automation** — blocked until owner approves explicit implementation prompt.

Do not build background workers, daemon mode, continuous polling, or additional sensors without owner authorization.

---

## Prior Phases — COMPLETE

### Phase 3.6 — Event Pipeline Orchestrator

Run: `node scripts/opportunity-engine/validate-phase-3-6.js`

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
| 2026-06-23 | Phase 3.7: Pipeline Stage Handlers — processor executes intelligence stages, STOP |
| 2026-06-23 | Phase 3.6: Event Pipeline Orchestrator — event-driven Job chaining, STOP |
| 2026-06-23 | Phase 3.5: First live sensor — file drop → Signal Registry, STOP |
| 2026-06-23 | Phase 3.4: Execution Queue — routing decisions only, STOP |
