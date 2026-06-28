# 28 — Autonomous Operating Loop

**Status:** Phase 3.0.5 · Constitution amendment (design only)  
**Related:** [Master Vision](./00-master-vision.md) · [Architecture Rules](./07-architecture-rules.md) · [World Model](./23-world-model.md) · [Runtime Data Boundaries](./24-runtime-data-boundaries.md) · [Sensor Framework](./25-sensor-framework.md) · [Reasoning Engine](./26-reasoning-engine.md) · [Capability Intelligence](./27-capability-intelligence.md)

---

## Purpose

This document defines the **Autonomous Operating Loop** — how Opportunity OS runs **continuously** without manual validator invocations.

Phases 2.1–2.9.5 built the **pipeline stages** as callable modules with runtime stores. Phase 3.0.5 defines the **operating system around those stages**: jobs, events, scheduling, state, failure handling, idempotency, and role boundaries for Autopilot, Mission Control, and OpenClaw.

The loop answers:

> *How does the machine observe the world, reason, create opportunities, prepare execution, learn, and repeat — safely and audibly?*

**Design-only phase:** No production code, runtime folders, validators, connectors, Mission Control changes, or OpenClaw implementation in Phase 3.0.5.

**Rule:** The Autonomous Operating Loop **orchestrates** existing pipeline modules defined in [23-world-model.md](./23-world-model.md), [26-reasoning-engine.md](./26-reasoning-engine.md), and [27-capability-intelligence.md](./27-capability-intelligence.md). It does **not** redesign intelligence layers (R26–R30).

---

## 1. What Is the Operating Loop?

The **Operating Loop** is the always-on control plane that:

1. **Observes** reality through scheduled sensor runs
2. **Processes** observations through the canonical knowledge spine
3. **Reasons** over situations into problems, capabilities, offers, and opportunities
4. **Scores** opportunities via Score Council
5. **Projects** to Mission Control for human oversight
6. **Queues** approved execution work
7. **Records** outcomes and feeds learning

The loop is **not** a new intelligence layer. It is **job scheduling + event propagation + state management** over modules that already exist.

### What the loop IS

| Property | Description |
|---|---|
| **Continuous** | Runs on a schedule and in response to events — not only on CLI invocation |
| **Auditable** | Every transition emits canonical Events with correlation IDs |
| **Recoverable** | Jobs retry with backoff; dead-letter queue for permanent failures |
| **Idempotent** | Safe to rerun any stage without corrupting runtime data |
| **Owner-gated** | Autopilot supervises; owner approval gates remain for phase transitions |

### What the loop IS NOT

| Misclassification | Why wrong |
|---|---|
| **Mission Control** | MC reads projections — it does not run sensors or reasoning |
| **OpenClaw** | OpenClaw executes approved actions — it does not observe or reason |
| **Autopilot** | Autopilot reports and blocks — it does not bypass owner gates |
| **A replacement pipeline** | Stages remain owned by existing engine modules |

---

## 2. Canonical Loop

The full autonomous cycle from observation to learning:

```
Sensor Run
  → Observation
  → Signal Registry
  → Fact Builder
  → Graph / Relationships
  → Situations
  → Hypotheses
  → Problems
  → Capability Matches
  → Offer Recommendations
  → Opportunities
  → Score Council
  → Mission Control
  → Execution Queue
  → Outcomes
  → Learning
  → (repeat)
```

### Stage map

| Stage | Job type (future) | Owner module | Output artifact | STOP rule |
|---|---|---|---|---|
| **Sensor Run** | `sensor.run` | `engine/sensors` | Observations | No reasoning |
| **Observation** | `observation.archive` | ingest boundary | Raw archive + signal input | Immutable capture |
| **Signal Registry** | `signal.ingest` | `engine/signals` | Signal record | No facts |
| **Fact Builder** | `fact.build` | `engine/fact-builder` | Facts | No graph inference |
| **Graph / Relationships** | `graph.project` | `engine/graph-store`, `relationship-builder` | Nodes, edges, events | No situations |
| **Situations** | `situation.build` | `engine/situation-builder` | Situations | Reasoning firewall |
| **Hypotheses** | `hypothesis.generate` | `engine/hypothesis-generator` | Hypotheses | No problems |
| **Problems** | `problem.infer` | `engine/problem-inference` | Problems | No capabilities |
| **Capability Matches** | `capability.match` | `engine/capability-matcher` | Capability recommendations | No offers (CI14) |
| **Offer Recommendations** | `offer.recommend` | `engine/offer-intelligence` | Offer recommendations | No opportunities |
| **Opportunities** | `opportunity.build` | `engine/opportunity-factory` | Validated opportunities | No scoring in factory |
| **Score Council** | `opportunity.score` | `engine/score-council` | Score vector | No execution |
| **Mission Control** | `projection.refresh` | `engine/mission-control` | Read projection | No writes to runtime spine |
| **Execution Queue** | `execution.enqueue` | future `engine/execution` | Queue items / plans | Policy gate required |
| **Outcomes** | `outcome.record` | future learning bridge | Outcome records | No model mutation inline |
| **Learning** | `learning.apply` | future `engine/learning` | Weight/model updates | No autonomous dispatch |

### Event-driven chaining

Each stage completion emits a **domain event**. The scheduler enqueues downstream jobs **by reference** (`inputRefs`), never by copying upstream payloads.

Example chain:

```
sensor.run.completed
  → enqueue signal.ingest (inputRefs: [observationId])
signal.ingested
  → enqueue fact.build (inputRefs: [signalId])
fact.build.completed
  → enqueue graph.project (inputRefs: [factIds[]])
…
opportunity.validated
  → enqueue opportunity.score (inputRefs: [opportunityId])
opportunity.scored
  → enqueue projection.refresh (inputRefs: [opportunityId])
```

**Rule:** Downstream jobs must tolerate **missing optional stages** only through explicit adapter flags — never silent skips of required Constitution stages.

---

## 3. Job Model

The **Job** is the unit of work in the operating loop. All scheduled and reactive work is expressed as Jobs.

### Canonical Job object

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | string | yes | Stable job ID — `job_<uuid>` |
| `type` | string | yes | Canonical job type — e.g. `sensor.run`, `fact.build`, `opportunity.score` |
| `status` | enum | yes | See [§6 State model](#6-state-model) job statuses |
| `priority` | integer | yes | Lower number = higher priority (0 = critical, 100 = background) |
| `inputRefs` | string[] | yes | IDs of upstream artifacts — signals, facts, problems, etc. |
| `outputRefs` | string[] | no | IDs produced on success — populated at completion |
| `attempts` | integer | yes | Current attempt count — starts at 0 |
| `maxAttempts` | integer | yes | Maximum retries before dead-letter |
| `runAfter` | ISO8601 | yes | Earliest execution time — supports delayed retry |
| `startedAt` | ISO8601 \| null | yes | When processing began |
| `completedAt` | ISO8601 \| null | yes | When terminal state reached |
| `error` | object \| null | yes | `{ code, message, retryable, at }` on failure |
| `createdAt` | ISO8601 | yes | Job creation time |
| `updatedAt` | ISO8601 | yes | Last mutation time |
| `metadata` | object | yes | `{ correlationId, causationId, sensorId?, stage?, idempotencyKey?, owner? }` |

### Job statuses

| Status | Meaning |
|---|---|
| `pending` | Queued; waiting for claim or `runAfter` |
| `claimed` | Worker claimed; awaiting handler start |
| `running` | Handler executing (Phase 3.3+) |
| `completed` | Success; `outputRefs` populated |
| `failed` | Recorded failure (may transition to retry or dead-letter) |
| `retry_wait` | Retry scheduled; waiting for `runAfter` |
| `cancelled` | Operator or policy cancelled before completion |
| `dead_letter` | Retries exhausted — manual `retryJob()` only |
| `archived` | Terminal job archived |

### Job type registry (v1)

| Type | Trigger | Handler owner |
|---|---|---|
| `sensor.run` | Schedule / manual | `engine/sensors` |
| `observation.archive` | Sensor output | ingest boundary |
| `signal.ingest` | Observation archived | `engine/signals` |
| `fact.build` | Signal ingested | `engine/fact-builder` |
| `graph.project` | Facts created | `engine/knowledge-graph` |
| `situation.build` | Graph updated | `engine/situation-builder` |
| `hypothesis.generate` | Situation created/updated | `engine/hypothesis-generator` |
| `problem.infer` | Hypothesis batch ready | `engine/problem-inference` |
| `capability.match` | Problem promoted | `engine/capability-matcher` |
| `offer.recommend` | Capability match saved | `engine/offer-intelligence` |
| `opportunity.build` | Offer recommendation saved | `engine/opportunity-factory` |
| `opportunity.score` | Opportunity validated | `engine/score-council` |
| `projection.refresh` | Opportunity scored | `engine/mission-control` |
| `execution.enqueue` | Human/policy approval | `engine/execution` |
| `outcome.record` | Execution terminal | outcomes bridge |
| `learning.apply` | Outcome verified | future `engine/learning` |
| `system.health_check` | Schedule | `runtime-health` pattern |
| `system.reconcile` | Schedule / degraded recovery | loop supervisor |

**Future storage (Phase 3.1):** `runtime/jobs/jobs.json` + append-only job history — not created in Phase 3.0.5.

---

## 4. Event Model

The **Event** is the audit and chaining primitive. Events are append-only facts about what happened in the loop.

### Canonical Event object

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | string | yes | `evt_<uuid>` |
| `type` | string | yes | Domain event type — e.g. `signal.ingested`, `problem.promoted` |
| `subjectType` | string | yes | Entity kind — `signal`, `fact`, `problem`, `job`, `sensor`, … |
| `subjectId` | string | yes | ID of the subject artifact |
| `payload` | object | yes | Event-specific data — references only, no embedded store snapshots |
| `correlationId` | string | yes | Traces one observation → opportunity chain |
| `causationId` | string \| null | yes | Prior event ID that caused this event — null for root sensor runs |
| `createdAt` | ISO8601 | yes | Event timestamp |
| `metadata` | object | yes | `{ jobId?, sensorId?, stage?, severity?, loopVersion? }` |

### Event type taxonomy (v1)

| Category | Examples |
|---|---|
| **Sensor** | `sensor.run.started`, `sensor.run.completed`, `sensor.run.failed` |
| **Ingest** | `observation.archived`, `signal.ingested`, `signal.duplicate_skipped` |
| **Knowledge** | `fact.created`, `graph.updated`, `situation.created`, `situation.updated` |
| **Reasoning** | `hypothesis.generated`, `hypothesis.promoted`, `problem.inferred`, `problem.promoted` |
| **Commercial** | `capability.matched`, `offer.recommended`, `opportunity.assembled`, `opportunity.validated` |
| **Scoring** | `opportunity.scored`, `score.mode_applied` |
| **Projection** | `projection.refreshed`, `mission_control.snapshot_built` |
| **Execution** | `execution.enqueued`, `execution.dispatched`, `execution.completed`, `execution.failed` |
| **Learning** | `outcome.recorded`, `outcome.verified`, `learning.proposed`, `learning.applied` |
| **System** | `loop.state_changed`, `job.dead_lettered`, `system.degraded`, `system.recovered` |

### Event rules

| Rule | Detail |
|---|---|
| **E1** | Events are **append-only** — never edited or deleted |
| **E2** | Events reference artifacts by ID — payloads do not duplicate full store records |
| **E3** | Every job completion emits at least one event |
| **E4** | `correlationId` is assigned at first observation in a chain and propagated to all downstream jobs/events |
| **E5** | Events are the **source of truth for audit**; Mission Control displays projections of events + stores |

**Future storage (Phase 3.1):** `runtime/events/events.jsonl` (append-only log) — not created in Phase 3.0.5.

---

## 5. Scheduler Rules

The **Scheduler** decides when jobs run, in what order, and with what retry policy.

### Sensor scheduling

| Rule | Policy |
|---|---|
| **Default cadence** | Per-sensor `scheduleIntervalMs` in sensor metadata — minimum 5 minutes for demo sensors, configurable per production sensor |
| **Stagger** | Sensor runs offset by hash of `sensorId` to avoid thundering herd |
| **Health gate** | Sensors in `Error` state are not scheduled until manual reset or successful `healthCheck()` |
| **Disabled** | `Disabled` sensors never schedule |
| **Manual override** | Operator CLI may enqueue `sensor.run` with `priority: 0` |

### Job queue rules

| Rule | Policy |
|---|---|
| **Ordering** | Pending jobs sorted by `priority` ASC, then `runAfter` ASC, then `createdAt` ASC |
| **Claim** | Single worker claims one job at a time (Phase 3.1–3.4) |
| **Concurrency** | **One running job per process** — no parallel runtime writes until lock strategy matures (§9) |
| **Downstream enqueue** | Stage handler emits event → scheduler enqueues next job(s) — handler does not call downstream directly |
| **Batch coalescing** | Multiple `fact.build` jobs for same signal within 30s window collapse to one job (idempotency key) |

### Retry policy

| Error class | Retry | Backoff |
|---|---|---|
| `EBUSY`, `EPERM`, `EACCES`, `ENOENT` (IO) | yes | Exponential from 75ms base — aligns with [runtime IO](./24-runtime-data-boundaries.md#runtime-io-phase-295) |
| Transient sensor failure | yes | 1m → 5m → 15m → 1h |
| Validation failure (schema) | no | Dead-letter immediately |
| Upstream missing ref | yes | 2 attempts with 30s delay — then dead-letter |
| Score Council policy block | no | Event only — no retry until policy changes |

Default: `maxAttempts: 5` for pipeline jobs; `maxAttempts: 3` for `sensor.run`.

### Duplicate job avoidance

Every enqueue operation computes:

```
idempotencyKey = sha256(job.type + sorted(inputRefs) + subjectVersion?)
```

| Rule | Detail |
|---|---|
| **D1** | If a `pending` or `running` job exists with same `idempotencyKey`, skip enqueue |
| **D2** | If last `completed` job with same key finished within `dedupeWindowMs` (default 60s), skip unless `force: true` in metadata |
| **D3** | Completed jobs older than dedupe window may re-enqueue when upstream artifact version changes |
| **D4** | `signal.duplicate_skipped` events do not enqueue downstream fact jobs |

### Scheduler tick

| Mode | Interval | Role |
|---|---|---|
| **Active loop** | 1s | Claim due jobs, dispatch to handlers |
| **Idle** | 5s | Light poll when no pending work |
| **Degraded** | 30s | Reduced throughput during partial failure |
| **Failed** | stop | No automatic claims — Autopilot alert; manual intervention |

---

## 6. State Model

### System states

The loop supervisor tracks **one global system state** (not per-job):

| State | Meaning | Entry | Exit |
|---|---|---|---|
| **idle** | No pending work; sensors on schedule | Startup; all queues empty | Job enqueued or sensor due |
| **observing** | Sensor run in progress | `sensor.run` claimed | Sensor run terminal event |
| **processing** | Knowledge pipeline active (signal → situation) | `signal.ingest` through `situation.build` | Situation stage complete or failure |
| **reasoning** | Reasoning pipeline active (hypothesis → opportunity) | `hypothesis.generate` through `opportunity.build` | Opportunity validated or failure |
| **opportunity_ready** | Scored opportunities awaiting human/policy review | `opportunity.scored` | Execution enqueued or archived |
| **executing** | Approved execution work in flight | `execution.dispatched` | Outcome recorded |
| **degraded** | Partial failure — some stages unavailable | Retryable failures exceed threshold | `system.recovered` |
| **failed** | Loop halted — dead-letter threshold or unrecoverable error | Critical failure | Manual reset |

**Rule:** System state is **derived** from active jobs and recent events — not manually set except `failed` reset.

### State transition diagram

```
idle ←→ observing → processing → reasoning → opportunity_ready → executing → idle
  ↑         ↓            ↓            ↓              ↓               ↓
  └──────── degraded ←───┴────────────┴──────────────┴───────────────┘
                              ↓
                           failed (manual recovery)
```

### Job vs system state

| Concept | Scope |
|---|---|
| **Job status** | Individual unit of work |
| **System state** | Aggregate loop posture for Autopilot and Mission Control display |
| **Sensor lifecycle** | Per-sensor state in Sensor Framework — orthogonal to system state |

---

## 7. Failure Handling

### Retry and backoff

1. Handler throws or returns `{ retryable: true }` → increment `attempts`, set `runAfter = now + backoff(attempts)`, status → `pending`
2. Handler returns success → status → `completed`, emit event, enqueue downstream
3. `attempts >= maxAttempts` → status → `dead_letter`, emit `job.dead_lettered`

### Dead-letter jobs

| Property | Policy |
|---|---|
| **Storage** | `runtime/jobs/dead-letter.json` (Phase 3.1) |
| **Visibility** | Autopilot report section; Mission Control projection (read) |
| **Replay** | Operator enqueues new job with same `inputRefs` + `force: true` — never mutate dead-letter entry |
| **Retention** | 90 days default — archive to `runtime/logs/` |

### Partial failure

| Scenario | Behavior |
|---|---|
| Sensor emits 3 observations; 1 fails ingest | 2 proceed; failed observation dead-letters separately; sensor run event reports partial success |
| Graph projection fails mid-batch | Completed facts remain; job retries from failed fact IDs only (idempotent upsert) |
| Problem inference promotes 0 problems | Valid outcome — emit `problem.infer.completed` with empty `outputRefs`; no downstream commercial jobs |
| Score Council rejects opportunity | Event `opportunity.score.rejected`; no execution enqueue |

### Recovery

| Trigger | Action |
|---|---|
| `system.health_check` passes after degraded | Emit `system.recovered`; restore active tick interval |
| Runtime IO lock cleared | Replay pending jobs with `runAfter <= now` |
| Owner approves phase fix | Manual dead-letter replay — not automatic |

---

## 8. Idempotency

Every stage must be **safe to rerun** without corrupting runtime data.

### Idempotency strategies by stage

| Stage | Key | Strategy |
|---|---|---|
| **Observation archive** | `observationId` | Reject duplicate file path (existing behavior) |
| **Signal ingest** | `dedupKey` / signal hash | Return existing signal ID |
| **Fact build** | `signalId` + extractor version | Upsert facts by deterministic fact ID |
| **Graph project** | node/edge deterministic IDs | Upsert — no duplicate edges |
| **Situation build** | cluster fingerprint | Update existing situation or create |
| **Hypothesis generate** | `situationId` + generator version | Replace/regenerate hypothesis set atomically |
| **Problem infer** | `situationId` + inference version | Promote only new problems; idempotent status transitions |
| **Capability match** | `problemId` + matcher version | Append recommendation with stable ID or upsert |
| **Offer recommend** | `capabilityMatchId` + offer intelligence version | Same |
| **Opportunity build** | `problemId` + factory version | Upsert opportunity by deterministic assembly key |
| **Score Council** | `opportunityId` + mode + council version | Replace score vector on same inputs |
| **Projection refresh** | snapshot generation time | Read-only rebuild — no store mutation |

### Permanent idempotency rules

| Rule | Detail |
|---|---|
| **I1** | Handlers must be **pure relative to inputRefs** — same inputs + same module version → same outputs |
| **I2** | Runtime writes use **atomic IO** per [24-runtime-data-boundaries.md](./24-runtime-data-boundaries.md) |
| **I3** | Append-only stores (facts, history) use deterministic IDs — never blind append on rerun |
| **I4** | Job `outputRefs` on replay point to same artifact IDs when inputs unchanged |
| **I5** | Event log may contain duplicate `type + subjectId` on replay — consumers must dedupe by `event.id` |

---

## 9. Concurrency

### Phase 3 policy: single-process first

| Rule | Detail |
|---|---|
| **C1** | One scheduler worker process owns job claims |
| **C2** | No parallel runtime writes to the same store file |
| **C3** | Pipeline stages run sequentially within a correlation chain until Phase 3.4+ lock strategy |
| **C4** | `sensor.run` jobs may not overlap for the same `sensorId` |
| **C5** | Mission Control and Autopilot are read-only — no concurrent write risk |

### Future (post Phase 3.4)

| Capability | Prerequisite |
|---|---|
| Parallel sensor runs (different sensors) | Per-sensor write isolation + job claim locks |
| Parallel fact builds (different signals) | Fact store sharding or row-level lock strategy |
| Multi-worker job queue | Postgres or dedicated queue with lease/heartbeat — see distributed pattern in `src/opportunity-engine/` |

**Rule:** Do not enable parallel runtime writes until `runtime/jobs/` lock tests pass on Windows/OneDrive paths.

---

## 10. Autopilot Role

Autopilot **supervises and reports**. It does **not** run the operating loop or bypass owner gates.

| Autopilot DOES | Autopilot DOES NOT |
|---|---|
| Report current phase, git status, blockers | Enqueue production sensor jobs |
| Recommend `validate-core.js` before commits | Auto-approve Phase transitions |
| Treat gitignored reports as non-blocking | Disable owner approval checks |
| Surface dead-letter counts (future) | Replay dead-letter jobs without operator |
| Stop after one approved phase | Continuously implement next phase |

See [24-runtime-data-boundaries.md § Autopilot](./24-runtime-data-boundaries.md#autopilot).

**Loop relationship:** Autopilot reads loop health projections. It never replaces the scheduler.

---

## 11. Mission Control Role

Mission Control **reads projections**. It does **not** run the loop.

| Mission Control DOES | Mission Control DOES NOT |
|---|---|
| Display opportunities, scores, evidence chains | Invoke `runSensor()` on a schedule |
| Show operator queues and execution status | Write to runtime spine stores |
| Refresh when `projection.refreshed` events occur | Enqueue jobs directly from UI |
| Surface CEO modes and ranked views | Bypass Score Council or factory validation |

**Rule (R4, R5):** Mission Control remains a **projection** — [07-architecture-rules.md](./07-architecture-rules.md).

**Loop relationship:** `projection.refresh` jobs rebuild MC snapshots from runtime stores + events. UI routes call `buildMissionControl()` — never pipeline handlers.

---

## 12. OpenClaw Role

**OpenClaw** (future execution agent) **executes approved actions only**. It does **not** reason.

| OpenClaw DOES | OpenClaw DOES NOT |
|---|---|
| Dispatch approved execution plan tasks | Run sensors or ingest observations |
| Send emails, create CRM tasks, trigger calls | Infer problems or match capabilities |
| Report task completion → outcome events | Modify opportunity scores |
| Operate within autonomy policy gates | Enqueue loop jobs without approval |

**Rule (R16):** Reason before execution — OpenClaw is downstream of Execution Queue and policy approval.

**Phase 3.0.5:** OpenClaw is **not implemented**. This section defines permanent boundaries only.

**Loop relationship:** `execution.dispatched` → OpenClaw (future) → `outcome.recorded` → `learning.apply`.

---

## 13. Phase 3 Roadmap

### Phase 3.0.5 — Autonomous Operating Loop Constitution

**Status:** COMPLETE (this document)

**Delivered:** Job model, Event model, scheduler rules, state model, failure handling, idempotency, concurrency policy, role boundaries, Phase 3 sub-roadmap.

**Do not build:** Runtime folders, validators, connectors, Mission Control changes, OpenClaw.

---

### Phase 3.1 — Job / Event Runtime

**Status:** COMPLETE

**Delivered:**

| Deliverable | Location |
|---|---|
| Event store | `src/engine/events/` → `runtime/events/events.jsonl` |
| Job store | `src/engine/jobs/` → `runtime/jobs/jobs.json` |
| Idempotency | `src/engine/jobs/idempotency.js` — active-job dedupe by `idempotencyKey` |
| IO integration | `appendJsonLineWithRetry`, `writeJsonAtomicWithRetry` via `engine/runtime/io.js` |
| Validator | `scripts/opportunity-engine/validate-phase-3-1.js` |

**Job API:** `createJob`, `claimJob`, `completeJob`, `failJob`, `retryJob`, `cancelJob`, `archiveJob`, `listJobs`, `getJob`

**Event API:** `appendEvent`, `listEvents`, `getEvent`, `getEventsByType`, `getEventsByCorrelationId`, `getEventsBySubject`

**Job statuses:** `pending`, `claimed`, `running`, `completed`, `failed`, `retry_wait`, `dead_letter`, `cancelled`, `archived`

**Job transition events:** `job.created`, `job.claimed`, `job.completed`, `job.failed`, `job.retry`, `job.dead_letter`, `job.cancelled`, `job.archived`

**Idempotency policy:** `createJob()` with the same `idempotencyKey` while a job is `pending`, `claimed`, `running`, or `retry_wait` returns the existing job. Keys default to `sha256(type + sorted inputRefs)` when not explicit.

**Dead letter:** Jobs exceeding `maxAttempts` on retryable failure move to `dead_letter`. No automatic replay — `retryJob()` is manual operator action only.

**STOP:** Kernel only — no scheduler, timers, polling, or background workers.

---

### Phase 3.2 — Sensor Scheduler

**Status:** BLOCKED until owner approves explicit implementation prompt.

**Build:**

| Deliverable | Scope |
|---|---|
| Scheduler tick loop | Enqueue `sensor.run` per sensor cadence |
| Sensor stagger + health gates | Per §5 |
| `sensor.run` job handler | Wraps existing `runSensor()` |
| Autopilot loop health section | Pending sensor jobs, failure counts |

**Do not build:** Continuous pipeline processor, live production connectors.

**STOP:** Scheduled sensor runs → observations → signals — halt.

---

### Phase 3.3 — Continuous Pipeline Processor

**Status:** BLOCKED until Phase 3.2 complete.

**Build:**

| Deliverable | Scope |
|---|---|
| Event-driven job chaining | Full canonical loop §2 |
| Stage handlers | Thin wrappers over existing engine modules |
| System state supervisor | §6 state transitions |
| Partial failure + recovery | §7 |

**Do not build:** Execution queue dispatch, live connectors, OpenClaw.

**STOP:** Opportunity validated + scored + projection refreshed — halt.

---

### Phase 3.4 — Execution Queue

**Status:** BLOCKED until Phase 3.3 complete.

**Build:**

| Deliverable | Scope |
|---|---|
| `execution.enqueue` job handler | Policy gate + approval check |
| Execution queue store | Approved plans / tasks |
| Outcome recording bridge | `outcome.record` events |
| Mission Control execution projection | Read-only queue display |

**Do not build:** OpenClaw autonomous dispatch, learning calibration.

**STOP:** Enqueue approved execution — halt before autonomous dispatch.

---

### Phase 3.5 — Live Connectors

**Status:** BLOCKED until Phase 3.4 complete + owner approval for each connector.

**Build:**

| Deliverable | Scope |
|---|---|
| Production sensors (non-demo) | Per [25-sensor-framework.md](./25-sensor-framework.md) |
| Connector → sensor migration | Deprecate connector shim |
| Live ingest validation | No `engine-data/` writes; runtime only |
| Per-connector owner sign-off | Each connector is a separate approval |

**Do not build:** Parallel runtime writes without lock tests; Mission Control write paths.

**STOP:** Live observation ingest through existing loop — halt.

---

## 14. Permanent Architectural Rules

| ID | Rule |
|---|---|
| **AOL1** | The operating loop **orchestrates** — it does not replace pipeline module ownership |
| **AOL2** | Every stage transition emits a canonical **Event** with `correlationId` |
| **AOL3** | Every unit of work is a **Job** with explicit `inputRefs` and `outputRefs` |
| **AOL4** | Downstream work is **enqueued**, not called inline across module boundaries |
| **AOL5** | Scheduler defaults to **single-process, sequential** runtime writes |
| **AOL6** | All handlers must be **idempotent** — safe rerun without corruption |
| **AOL7** | Autopilot **supervises** — never bypasses owner approval gates |
| **AOL8** | Mission Control **reads projections** — never runs the loop |
| **AOL9** | OpenClaw **executes approved actions** — never observes or reasons |
| **AOL10** | Sensors observe only — loop does not embed reasoning in sensor handlers |
| **AOL11** | Score Council runs **after** opportunity validation — never inside factory |
| **AOL12** | Dead-letter jobs require **operator replay** — no silent auto-retry forever |
| **AOL13** | Events are **append-only** — audit trail is never mutated |
| **AOL14** | Loop implementation must respect **architecture freeze** R26–R30 |
| **AOL15** | Phase 3 sub-phases require **owner approval** before implementation |

---

## 15. Cross-References

| Document | Relationship |
|---|---|
| [23-world-model.md](./23-world-model.md) | Canonical object chain the loop orchestrates |
| [24-runtime-data-boundaries.md](./24-runtime-data-boundaries.md) | Runtime storage, atomic IO, gitignore policy |
| [25-sensor-framework.md](./25-sensor-framework.md) | Sensor lifecycle — first loop stage |
| [26-reasoning-engine.md](./26-reasoning-engine.md) | Reasoning stages — hypothesis through factory |
| [27-capability-intelligence.md](./27-capability-intelligence.md) | Commercial intelligence stages — capability through opportunity |
| [15-api-boundaries.md](./15-api-boundaries.md) | Module ownership — extended in Phase 3.1 |
| [08-current-phase.md](./08-current-phase.md) | Active phase gate |

---

## Amendment

Changes to the Autonomous Operating Loop require [Build Log](./09-build-log.md) entry and owner sign-off for sub-phase transitions.
