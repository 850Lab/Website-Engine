# 16 — Testing Strategy

**Status:** Constitution · Validation philosophy  
**Related:** [Architecture Rules](./07-architecture-rules.md) · [Roadmap](./01-roadmap.md) · [Performance](./18-performance.md)

---

## Philosophy

The OS makes **economic decisions**. Tests must prove:

1. **Correctness** — logic and state transitions  
2. **Reasoning quality** — opportunity factory and score council behave on fixtures  
3. **Regression** — migration parity and radar stability  
4. **Simulation** — end-to-end paths without production side effects  

Evidence chains must be testable: given signals X, expect problem Y and opportunity Z.

---

## Test Layers

### Unit
| Target | Examples |
|---|---|
| Scoring engines | Each Score Council engine in isolation |
| Matchers | Problem ↔ capability ↔ offer |
| Normalizers | Signal → canonical shape |
| State machines | Invalid transitions fail — [04](./04-state-machines.md) |
| Pure transforms | ID slugging, weight application for CEO modes |

**Location pattern:** `tests/unit/engine/` (to be created Phase 1)

---

### Integration
| Target | Examples |
|---|---|
| Engine + data | `buildOpportunityRadar()` against fixture `data/` snapshot |
| Services + schema | Outcome write → attempt + opportunity update |
| Id-bridge | Legacy ID resolution without id-map |
| Connectors | Adapter → normalized signal (mock HTTP) |

**Existing patterns:** `scripts/validate-*`, `scripts/verify-production-schema-effect.js` — promote to CI.

---

### Reasoning
| Target | Examples |
|---|---|
| Fan-out | One hospital signal → N opportunities |
| Evidence | Every opportunity has non-empty evidence chain |
| Problem-first | No new code paths ranking by industry tag alone |
| Golden fixtures | Frozen signal clusters with expected problem set |

**Location:** `tests/reasoning/fixtures/` + `tests/reasoning/*.test.js`

---

### Regression
| Target | Examples |
|---|---|
| Dual-read parity | Legacy vs schema queue counts — existing |
| Radar snapshot | Top 10 IDs stable given fixed data seed |
| Report generation | KTM report sections present |
| Migration | `validate-migration.js` suite |

**Rule:** Any change to `engine/intelligence` or score council requires radar snapshot update with justification.

---

### Simulation
| Target | Examples |
|---|---|
| End-to-end dry run | Signal ingest → radar → plan draft (no dispatch) |
| CEO mode switch | Rank order changes predictably with weights |
| Learning calibration | Synthetic outcomes shift probability engine |

**Location:** `scripts/simulate/` (Phase 3+)

---

## Validation Scripts (Current Repo — Preserve)

| Script | Purpose |
|---|---|
| `npm run validate:dual-read` | Queue parity |
| `npm run validate:schema-outcome-writes` | Outcome dual-write |
| `npm run validate:id-bridge-without-map` | Bridge resilience |
| `npm run verify:production-schema` | Production health |
| `node scripts/opportunity-engine/generate-ktm-report.js` | Report smoke |

Phase 1 must add: **radar snapshot**, **score vector completeness**.

---

## AI / LLM Testing

| Type | Approach |
|---|---|
| Extractors | Golden input/output pairs; regression on prompt version |
| Problemist | Fixture fact sets → expected problem categories (allow set overlap, not exact prose) |
| Scribe | Structural checks (has evidence citation, no fabricated facts) |
| Eval harness | Sampled human review queue — not blocking CI initially |

**Never:** snapshot test LLM prose verbatim.

---

## CI Expectations (By Phase)

| Phase | CI gate |
|---|---|
| 0 | Constitution links valid (manual) |
| 1 | Unit + radar regression + validate scripts |
| 2 | Connector contract tests + dedup metrics |
| 3 | Reasoning fixtures + fan-out tests |
| 4 | Plan state machine + dispatch mock |
| 5 | Calibration metrics threshold |

---

## Failure Response

1. Reproduce with fixture  
2. Log in [Build Log](./09-build-log.md) if architectural  
3. Fix engine — not UI workaround  
4. Add regression test before merge  

See [Design Principles](./11-design-principles.md).
