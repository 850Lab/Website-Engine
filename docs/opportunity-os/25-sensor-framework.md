# 25 — Sensor Framework

**Status:** Phase 2.3 · Constitution amendment  
**Related:** [World Model](./23-world-model.md) · [Runtime Data Boundaries](./24-runtime-data-boundaries.md) · [Signal Pipeline](./22-signal-and-problem-pipeline.md) · [Architecture Rules](./07-architecture-rules.md)

---

## Purpose

Replace the transitional **Connector SDK** with a permanent **Sensor Framework**.

A **Sensor** is a reusable module that observes one part of reality and emits canonical **Observations**. Sensors do not reason, score, or sell — they observe.

> Connectors were Phase 2.2.5 scaffolding. **Sensors are the long-term model.**

---

## Sensor Interface

Every sensor must expose:

| Field / Method | Type | Role |
|---|---|---|
| `id` | string | Stable sensor identifier |
| `name` | string | Human-readable name |
| `description` | string | What part of reality this sensor observes |
| `domain` | string | Observation domain (`web`, `documents`, `crm`, …) |
| `sourceTypes` | string[] | Canonical source types emitted |
| `capabilities` | string[] | Observation capabilities (not delivery capabilities) |
| `collect(context)` | async function | Returns canonical Observation[] |
| `healthCheck(context)` | async function | Returns `{ ok, message }` |
| `validate(observation)` | function | Validates one observation |
| `mapToObservation(observation)` | function | Maps to signal ingest input |

Implementation: `src/engine/sensors/index.js`

---

## Sensor Manager

| API | Role |
|---|---|
| `registerSensor(sensor)` | Register a sensor |
| `unregisterSensor(id)` | Remove a sensor |
| `listSensors()` | List registered sensors + lifecycle |
| `getSensor(id)` | Get sensor definition |
| `runSensor(id, context, options)` | Collect → normalize → optionally publish |
| `runAllSensors(context, options)` | Run all enabled sensors |
| `healthReport()` | Aggregate health metrics |

---

## Sensor Lifecycle

| State | Meaning | Entry | Exit |
|---|---|---|---|
| **Idle** | Ready to run | Registration complete; successful run finished | `runSensor()` invoked |
| **Collecting** | Running `collect()` | `runSensor()` start | Observations returned |
| **Normalizing** | `validate()` + `mapToObservation()` | Observations collected | All observations normalized |
| **Publishing Observation** | Writing raw archive + signal registry | Normalization complete | Ingest finished or skipped |
| **Waiting** | Post-publish handoff | Publish complete | Health updated → Idle |
| **Retry** | Scheduled re-attempt (future scheduler) | Transient failure policy | Success or Error |
| **Disabled** | Operator or policy disabled | `setSensorEnabled(id, false)` | Re-enabled |
| **Error** | Last run failed | Exception in collect/normalize/publish | Manual reset → Idle |

**Rule:** Sensors never skip directly from Collecting to Mission Control. Publishing means Observation/Signal pipeline only.

---

## Sensor Health

Tracked per sensor in the Sensor Manager:

| Metric | Description |
|---|---|
| `lastRun` | ISO timestamp of last execution |
| `averageRuntimeMs` | Rolling average runtime |
| `failures` | Failed run count |
| `successes` | Successful run count |
| `observationsEmitted` | Total observations collected |
| `lastState` | Latest lifecycle state |
| `lastError` | Last error message (if any) |

Query via `healthReport()`.

---

## Runtime Integration

Sensors publish **only** through the Observation/Signal pipeline:

```
Sensor.collect()
  → validate() + mapToObservation()
  → ingestManualObservation()
  → runtime/signals/raw/ + runtime/signals/signals.json
  → STOP (classified)
```

### Forbidden

- Create Facts
- Create Problems
- Create Opportunities
- Update Mission Control
- Call external APIs in demo/validation sensors
- Write to `engine-data/` for new live signals

See [24-runtime-data-boundaries.md](./24-runtime-data-boundaries.md).

---

## Demo Sensors (Phase 2.3)

Static data only — no network:

| Sensor | Domain | File |
|---|---|---|
| Web Sensor | `web` | `src/engine/sensors/demo/web-sensor.js` |
| Document Sensor | `documents` | `src/engine/sensors/demo/document-sensor.js` |
| CRM Sensor | `crm` | `src/engine/sensors/demo/crm-sensor.js` |

Register via `registerDemoSensors()`.

---

## Live Sensors (Phase 3.5)

First production live connector — local file drop only:

| Sensor | Domain | File | Inbox |
|---|---|---|---|
| File Drop Sensor | `documents` | `src/engine/sensors/live/file-drop-sensor.js` | `runtime/inbox/observations/` |

**API:** `collectFileDropObservations()`, `runFileDropSensor()`, `registerFileDropSensor()`

**Formats:** `.json`, `.txt`, `.md` — deterministic parsing, no LLM, no network.

**Processed tracking:** `runtime/inbox/observations/processed/` markers + archive copies. Input files are never deleted.

**Pipeline:** File drop → Observation → `ingestManualObservation()` → Signal Registry → **STOP**.

**Validation:** `node scripts/opportunity-engine/validate-phase-3-5.js`

---

## Connector Migration

| Phase | Module | Status |
|---|---|---|
| 2.2.5 | `src/engine/connectors/` | **Deprecated** — kept for regression only |
| 2.3+ | `src/engine/sensors/` | **Canonical** |

New code must use Sensor Framework. Do not add production connectors.

---

## Validation

```bash
node scripts/opportunity-engine/validate-phase-2-3.js
```

---

## Amendment

Changes require [Build Log](./09-build-log.md) entry and owner approval.
