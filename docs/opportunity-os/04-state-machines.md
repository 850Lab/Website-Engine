# 04 — State Machines

**Status:** Constitution · Lifecycle definitions  
**Related:** [Ontology](./02-ontology.md) · [Knowledge Graph](./03-knowledge-graph.md) · [Data Model](./14-data-model.md)

Every canonical object has a defined lifecycle. Invalid transitions are bugs.

---

## Signal

| State | Meaning |
|---|---|
| **Observed** | Raw capture stored |
| **Validated** | Passed schema and source trust checks |
| **Normalized** | Mapped to canonical signal type |
| **Linked** | Resolved to entities / facts |
| **Archived** | Superseded or expired; retained for audit |

| Transition | Entry | Exit | Allowed |
|---|---|---|---|
| Observed → Validated | Ingest complete | Schema valid | Auto |
| Validated → Normalized | Type classified | Canonical fields set | Auto |
| Normalized → Linked | Entity resolution done | Facts written | Auto |
| Linked → Archived | TTL or superseding signal | — | Auto or manual |
| Any → Archived | Legal hold / retraction | — | Manual only |

**Owner:** Signal Engine · See [Phase 2](./01-roadmap.md#phase-2--live-signal-engine)

---

## Fact

| State | Meaning |
|---|---|
| **Extracted** | Parser output |
| **Confirmed** | Cross-signal corroboration or human confirm |
| **Linked** | Attached to entities/problems |
| **Superseded** | Replaced by newer fact |

---

## Entity (Company / Person / Facility / Project)

| State | Meaning |
|---|---|
| **Discovered** | First seen |
| **Resolved** | Deduped to canonical ID |
| **Active** | In use |
| **Merged** | Absorbed into another ID |
| **Archived** | Inactive record |

Merge transitions require human approval when confidence < threshold.

---

## Problem

| State | Meaning |
|---|---|
| **Hypothesized** | Inferred, low commitment |
| **Validated** | Evidence threshold met |
| **Active** | Drives opportunity ranking |
| **Resolved** | Problem no longer relevant |
| **Archived** | Historical |

| Transition | Entry | Exit |
|---|---|---|
| Hypothesized → Validated | ≥N facts or 1 high-trust fact | Confidence ≥ threshold |
| Validated → Active | Opportunity factory run | Ranked or approved |
| Active → Resolved | Outcome or signal closure | — |

---

## Opportunity

| State | Meaning |
|---|---|
| **Detected** | Created by factory |
| **Scored** | Score council complete |
| **Approved** | Human or policy auto-approve |
| **Executing** | Active plan |
| **Won** | Revenue outcome |
| **Lost** | Closed negative |
| **Learned** | Fed into learning loop |
| **Archived** | No longer active |

| Transition | Entry | Exit | Allowed |
|---|---|---|---|
| Detected → Scored | Factory output | `scoreVector` populated | Auto |
| Scored → Approved | CEO review or autopolicy | Plan authorized | Human / policy |
| Approved → Executing | Plan dispatched | First task started | Auto |
| Executing → Won | Outcome revenue | — | Human verify |
| Executing → Lost | Outcome loss | — | Human |
| Won/Lost → Learned | Learning job processed | Models updated | Auto |
| Any → Archived | Stale / duplicate | — | Auto |

**Legacy mapping:** `outreachStatus` on schema Opportunity is a **projection**, not this lifecycle.

---

## Execution Plan

| State | Meaning |
|---|---|
| **Draft** | Planner output |
| **Approved** | Human/policy OK |
| **Executing** | Tasks in flight |
| **Completed** | All tasks terminal |
| **Cancelled** | Aborted |

---

## Task

| State | Meaning |
|---|---|
| **Pending** | Created |
| **Approved** | Passed autonomy gate |
| **Dispatched** | Sent to channel |
| **Completed** | Success |
| **Failed** | Error |
| **Skipped** | Intentionally not run |

---

## Outcome

| State | Meaning |
|---|---|
| **Recorded** | Initial capture |
| **Verified** | Revenue/margin confirmed |
| **Learned** | Consumed by learning engine |

---

## Learning

| State | Meaning |
|---|---|
| **Proposed** | Calibrator suggestion |
| **Validated** | Backtest or sample check |
| **Applied** | Live weights updated |
| **RolledBack** | Reverted |

Human approval required for **Applied** on Probability and Revenue engines.

---

## Forecast

| State | Meaning |
|---|---|
| **Generated** | Model output |
| **Monitoring** | Waiting for real world |
| **Confirmed** | Problem emerged |
| **Missed** | Did not materialize |
| **Calibrated** | Weights adjusted |

---

## Cross-Object Rules

1. Opportunity cannot reach **Executing** without **Approved** plan.
2. Signal cannot be deleted; only **Archived**.
3. **Learned** is terminal for opportunity learning path but object remains queryable.
4. State transitions emit events to the event log (Phase 2+).

See [Testing Strategy](./16-testing-strategy.md) for state transition tests.
