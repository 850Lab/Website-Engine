# 24 — Runtime Data Boundaries

**Status:** Phase 2.2.5 · Architecture document  
**Related:** [Architecture Rules](./07-architecture-rules.md) · [World Model](./23-world-model.md) · [Folder Map](./13-folder-map.md) · [Signal Pipeline](./22-signal-and-problem-pipeline.md)

---

## Purpose

Separate **git-tracked code and seed config** from **live operational data** so Autopilot, connectors, and validation can run without dirtying the repository.

---

## Storage Layers

| Layer | Path | Role | Git |
|---|---|---|---|
| **Application logic** | `src/` | Engine modules, connectors, UI projections | Tracked |
| **Seed / reference config** | `engine-data/` | Offers, capabilities, markets, campaigns, legacy signal seed — **read-only at runtime** | Tracked |
| **Live operational data** | `runtime/` | Signal store, raw observations, logs, cache, **missions**, **engineering tasks** — **mutable production runtime** | **Ignored** (`.gitkeep` only) |
| **Validation runtime** | `runtime-validation/run-*` | Isolated validator workspaces — **mutable validation runtime** | **Ignored** |
| **Generated reports** | `reports/` | Autopilot, core validation, runtime health, backlog progress dashboard, performance baseline | **Ignored** when listed in `.gitignore` |
| **Schema / entity data** | `data/` | Businesses, contacts, migration entities | Partially tracked |

---

## engine-data/ vs runtime/

### `engine-data/` (read-only — Phase 4.0.6)

- Reference and seed configuration the OS ships with
- Examples: `offers/offers.json`, `capabilities/capabilities.json`, `campaigns/active.json`
- Legacy signal registry at `engine-data/signals/signals.json` is **read/merge only**
- **Must not** be written during runtime, validation, sensors, pipeline runs, or tests
- Guard: `src/engine/runtime/engine-data-guard.js` + IO choke point in `io.js`
- Validators fail when `git status --short engine-data` shows changes (`assert-engine-data-clean.js`)

### `runtime/` (mutable production runtime)

- Default root: `runtime/` (override: `OPPORTUNITY_RUNTIME_DIR` or legacy `OPPORTUNITY_OS_RUNTIME_DIR`)
- Override **must not** point into `engine-data/`
- Live signal registry: `runtime/signals/signals.json`
- Sacred raw observations: `runtime/signals/raw/YYYY/MM/DD/obs_<uuid>.json`
- Connector logs: `runtime/logs/`
- Dedup/cache working files: `runtime/cache/`
- Founder missions: `runtime/missions/missions.json` *(Phase 4.1)*
- Engineering task registry: `runtime/engineering-tasks/engineering-tasks.json` *(Phase 4.2 B2)*

### `runtime-validation/` (mutable validation runtime — Phase 4.0.5)

- **Validation-only** isolated workspaces: `runtime-validation/run-{uuid}/`
- Created automatically by `ValidationRunner` or standalone validator bootstrap
- Contains full runtime layout (events, jobs, signals, facts, graph, …) plus `reports/`
- **Never** used by production pipeline, OpenClaw, or Mission Control
- Fully gitignored — validators must not write to repo `runtime/` during managed runs

---

## Migration Path (Historical Signals)

Phase 2.2 wrote observations to `engine-data/signals/raw/` and signals to `engine-data/signals/signals.json`.

**Phase 2.2.5 policy:**

1. **Read:** Engine merges legacy + runtime stores (runtime wins on ID collision)
2. **Write:** New signals and raw observations go to `runtime/` only — enforced by engine-data guard (Phase 4.0.6)
3. **No automatic deletion** of legacy files (safe, auditable)
4. **Optional future step:** Archive legacy signal JSON to `runtime/migrations/` and mark legacy store read-only

Do not bulk-move historical files in Phase 2.2.5 unless a dedicated migration script is approved.

---

## Engine-Data Guard (Phase 4.0.6)

| Function | Purpose |
|---|---|
| `isEngineDataPath(path)` | Detect paths under `engine-data/` |
| `assertNotEngineDataWritePath(path)` | Throw before any write to tracked seed data |
| `assertRuntimeWritePath(path)` | Require writes under active runtime or `runtime-validation/` |
| `assertRuntimeOverrideSafe(path)` | Reject runtime dir overrides targeting `engine-data/` |

All `writeJsonAtomic()`, `writeJsonAtomicWithRetry()`, `appendJsonLineWithRetry()`, and guarded `ensureDirectory()` calls in `io.js` invoke the guard.

Validator integration: `finalizeValidator()` calls `assertEngineDataClean()` — fails if `git status --short engine-data` is non-empty.

Script: `node scripts/opportunity-engine/assert-engine-data-clean.js`  
Phase validator: `node scripts/opportunity-engine/validate-phase-4-0-6.js`

---

## Connector Boundary

Connectors write **observations** only. Ingestion flows through:

```
Connector → observation → runtime raw archive → Signal Registry (runtime) → STOP
```

See [World Model §5 — Connector Rule](./23-world-model.md#5-connector-rule).

---

## Autopilot

Run `npm run autopilot:status` and `npm run autopilot:check` after operational work.

Live writes under `runtime/` must **not** appear in `git status` when `.gitignore` is configured correctly.

---

## Runtime IO (Phase 2.9.5)

All runtime-backed stores use shared helpers in `src/engine/runtime/io.js`:

| Helper | Purpose |
|---|---|
| `readJsonWithRetry()` | Read JSON with retry on Windows file-lock errors |
| `writeJsonAtomic()` | Temp file + rename for atomic persistence |
| `writeJsonAtomicWithRetry()` | Atomic write with backoff retry |
| `safeFileExists()` | Non-throwing existence check |
| `ensureDirectory()` | Recursive directory creation |

Retry codes: `EBUSY`, `EPERM`, `EACCES`, `ENOENT` (rename/read races).

Stores using these helpers: signals, facts, graph-store, situations, hypotheses, problems, capability-matches, offer-recommendations, opportunities, **missions** *(Phase 4.1)*, **engineering tasks** *(Phase 4.2 B2)*.

---

## Founder Intent / Mission Registry (Phase 4.1)

| Path | Role |
|---|---|
| `runtime/missions/missions.json` | Mutable founder mission registry — multiple ACTIVE missions |
| `src/engine/founder-intent/` | Interpret → clarify → validate → save — **no pipeline execution** |

Flow:

```
Founder natural language
  → interpretFounderIntent() / completeMissionFromClarification()
  → validateMission()
  → saveMission() → runtime/missions/
  → generateMissionStrategy()
  → (future) configure sensors/pipeline filters
  → alignOpportunityToMission() ranks opportunities by mission fit
```

LLM optional: `MISSION_INTERPRETER_LLM=1` + `OPENAI_API_KEY`. Default rules interpreter used in validators.

Hard rule: `approvalPolicy.requireFounderApprovalBeforeOutreach` must remain `true` in Phase 4.1.

---

## Engineering Task Registry (Phase 4.2 B2)

| Path | Role |
|---|---|
| `runtime/engineering-tasks/engineering-tasks.json` | Mutable Engineering Director task lifecycle store |
| `src/engine/founder-intent/engineering-task-registry.js` | Persist, list, approve, activate, block, complete, and summarize engineering tasks |

The registry stores operating memory only. It does not mutate `docs/opportunity-os/33-master-engineering-backlog.md`, execute OpenClaw, dispatch jobs, save missions, or launch outreach.

---

## Generated Report Policy (Phase 2.9.5)

These files are **local generated artifacts** — gitignored, non-blocking for autopilot:

| Report | Script |
|---|---|
| `reports/autopilot-status.md` | `npm run autopilot:status` |
| `reports/autopilot-log.json` | `npm run autopilot:status` |
| `reports/core-validation.md` / `.json` | `node scripts/opportunity-engine/validate-core.js` (legacy alias) |
| `reports/release-validation.md` / `.json` | `node scripts/opportunity-engine/validate-core.js` (Phase 4.0.5 release suite) |
| `reports/runtime-health.md` / `.json` | `node scripts/opportunity-engine/runtime-health.js` |
| `reports/backlog-progress-dashboard.md` / `.json` | `node scripts/opportunity-engine/backlog-progress-dashboard.js` |
| `reports/performance-baseline.md` / `.json` | `node scripts/opportunity-engine/performance-baseline.js` |

Autopilot still blocks on real source/docs changes and owner-approval gates.

`runtime-health.js` emits generated report data only: schema version, runtime root, check results, runtime store counts, and generated-report gitignore policy. It must not add a dashboard, daemon, live monitor, execution worker, outreach behavior, or OpenClaw permissions.

`backlog-progress-dashboard.js` emits generated report data only from the Master Engineering Backlog and execution status: completion percentages, current task, blocked task IDs, and remaining task/commit/hour estimates. It must not add a UI, daemon, live monitor, execution loop, outreach behavior, or OpenClaw permissions.

Full phase regression: `node scripts/opportunity-engine/validate-core.js` (dependency graph, isolated runtime per validator, fail-fast root-cause reporting).

---

## Validation Infrastructure (Phase 4.0.5)

| Component | Path | Role |
|---|---|---|
| **ValidationRunner** | `src/engine/validation/runner.js` | Executes dependency graph once; no nested subprocess regressions |
| **ValidationRuntime** | `src/engine/validation/runtime.js` | Creates `runtime-validation/run-{uuid}/` layout |
| **ValidationContext** | `src/engine/validation/context.js` | Per-validator pass/fail, assertions, structured result |
| **Dependency graph** | `src/engine/validation/graph.js` | Phase ordering (4.0 → 3.8 → … → 0.5) |

Environment variables during managed runs:

| Variable | Purpose |
|---|---|
| `OPPORTUNITY_RUNTIME_DIR` | Primary runtime override (production: unset → `runtime/`) |
| `OPPORTUNITY_OS_RUNTIME_DIR` | Legacy alias — still honored |
| `VALIDATION_FRAMEWORK_MANAGED=1` | Set by runner; skips nested regressions |
| `VALIDATION_SKIP_NESTED=1` | Explicit nested regression skip |
| `VALIDATION_RESULT_PATH` | Structured JSON result file per validator |

Validators assert **runtime behavior** (directory exists, store IO, atomic writes) — never `.gitkeep` placeholder files. Validators **must fail** when tracked `engine-data/` files change (Phase 4.0.6).

---

## Amendment

Changes to runtime boundaries require [Build Log](./09-build-log.md) entry.
