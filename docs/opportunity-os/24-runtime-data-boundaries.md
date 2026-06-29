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
| **Seed / reference config** | `engine-data/` | Offers, capabilities, markets, campaigns, legacy signal seed | Tracked |
| **Live operational data** | `runtime/` | Signal store, raw observations, logs, cache | **Ignored** (`.gitkeep` only) |
| **Generated reports** | `reports/` | Autopilot, core validation, runtime health, performance baseline | **Ignored** when listed in `.gitignore` |
| **Schema / entity data** | `data/` | Businesses, contacts, migration entities | Partially tracked |

---

## engine-data/ vs runtime/

### `engine-data/`

- Reference and seed configuration the OS ships with
- Examples: `offers/offers.json`, `capabilities/capabilities.json`, `campaigns/active.json`
- Legacy signal registry at `engine-data/signals/signals.json` remains **read-compatible** for historical data
- **Do not** append new live signals here after Phase 2.2.5

### `runtime/`

- Default root: `runtime/` (override: `OPPORTUNITY_RUNTIME_DIR` or legacy `OPPORTUNITY_OS_RUNTIME_DIR`)
- Live signal registry: `runtime/signals/signals.json`
- Sacred raw observations: `runtime/signals/raw/YYYY/MM/DD/obs_<uuid>.json`
- Connector logs: `runtime/logs/`
- Dedup/cache working files: `runtime/cache/`

### `runtime-validation/` (Phase 4.0.5)

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
2. **Write:** New signals and raw observations go to `runtime/` only
3. **No automatic deletion** of legacy files (safe, auditable)
4. **Optional future step:** Archive legacy signal JSON to `runtime/migrations/` and mark legacy store read-only

Do not bulk-move historical files in Phase 2.2.5 unless a dedicated migration script is approved.

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

Stores using these helpers: signals, facts, graph-store, situations, hypotheses, problems, capability-matches, offer-recommendations, opportunities.

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
| `reports/performance-baseline.md` / `.json` | `node scripts/opportunity-engine/performance-baseline.js` |

Autopilot still blocks on real source/docs changes and owner-approval gates.

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

Validators assert **runtime behavior** (directory exists, store IO, atomic writes) — never `.gitkeep` placeholder files.

---

## Amendment

Changes to runtime boundaries require [Build Log](./09-build-log.md) entry.
