# 03 — Knowledge Graph

**Status:** Constitution · Target graph design  
**Related:** [Ontology](./02-ontology.md) · [State Machines](./04-state-machines.md) · [Data Model](./14-data-model.md) · [API Boundaries](./15-api-boundaries.md)

---

## Why the Graph Exists

The Opportunity OS must connect **world events** to **economic bets** across hops:

```
Hospital expansion (Signal) → Construction surge (Problem) → Fire Watch need (Problem)
  → KTM capability → Opportunity → Execution → Revenue
```

Tabular CRM storage cannot express multi-hop reasoning, shared evidence, or one-signal→many-opportunities. The **knowledge graph** is the system’s memory of what the world is and why the machine believes what it believes.

**Rule:** UI and CRM are projections. The graph (eventually) is the fusion layer between signals and opportunities.

---

## Node Types

| Node | Description | Constitution ref |
|---|---|---|
| **Company** | Organization that buys or sells | Entity |
| **Person** | Decision maker, champion, blocker | Entity |
| **Facility** | Plant, hospital, restaurant, site | Entity |
| **Project** | Construction, turnaround, expansion | Entity |
| **Contract** | Awarded work, historical proof | Entity |
| **Signal** | Raw observation pointer | Signal |
| **Fact** | Structured claim | Fact |
| **Problem** | Expensive emerging need | Problem |
| **Capability** | What we can deliver | Capability |
| **Offer** | Commercial package | Offer |
| **Opportunity** | Actionable bet | Opportunity |
| **Execution** | Plan instance (Execution Plan root) | Execution Plan |
| **Outcome** | Win/loss/revenue record | Outcome |
| **Learning** | Model/playbook update | Learning |
| **Forecast** | Forward prediction | Forecast |
| **Market** | Region + demand context (attribute-rich node) | Optional geography layer |
| **Indicator** | Time-series point (commodity, weather) | Macro features |

**Industry** is a **tag**, not a primary node.

---

## Relationship Types

| Relationship | From → To | Meaning |
|---|---|---|
| `OWNS` | Company → Facility | Ownership / operation |
| `OPERATES` | Company → Facility | Operator role |
| `EMPLOYS` | Company → Person | Employment |
| `HAS_PROJECT` | Facility → Project | Project at site |
| `AWARDED` | Company → Contract | Contract win |
| `EMITS` | Project → Signal | Project-generated signal |
| `OBSERVED` | Signal → Fact | Extraction support |
| `IMPLIES` | Fact → Problem | Problem hypothesis |
| `AFFECTS` | Problem → Entity | Who has the problem |
| `SOLVED_BY` | Problem → Capability | Solution path |
| `PACKAGED_AS` | Capability → Offer | Commercial wrapper |
| `CANDIDATE` | Problem + Offer → Opportunity | Factory output |
| `TARGETS` | Opportunity → Company/Person | Buyer focus |
| `EVIDENCED_BY` | Opportunity → Signal/Fact | Explainability |
| `HAS_PLAN` | Opportunity → Execution | Execution linkage |
| `CONTAINS` | Execution → Task | Plan decomposition |
| `PRODUCES` | Task → Outcome | Result |
| `COMPETES` | Company ↔ Opportunity | Competitive context |
| `PRECEDES` | Signal → Signal | Temporal pattern |
| `PREDICTS` | Forecast → Problem | Forward look |
| `UPDATED_BY` | Score/Playbook → Learning | Learning loop |

Every edge carries: `confidence`, `provenance[]`, `validFrom`, `validTo`, `extractorVersion`.

---

## Example Subgraph

```
[Signal: Hospital CON filing]
    └── OBSERVED → [Fact: 120 bed expansion, Q3 2027]
            └── IMPLIES → [Problem: Temporary labor surge]
            │               └── SOLVED_BY → [Capability: KTM Labor]
            │                       └── PACKAGED_AS → [Offer: KTM Manpower]
            │                               └── CANDIDATE → [Opportunity: OPP-4421]
            └── IMPLIES → [Problem: Fire watch during construction]
            └── IMPLIES → [Problem: Exterior cleaning at opening]

[Company: Regional Hospital Authority]
    └── HAS_PROJECT → [Project: East Campus Expansion]
            └── AFFECTS ← [Problem: Temporary labor surge]

[Opportunity: OPP-4421]
    └── EVIDENCED_BY → [Signal, Fact...]
    └── HAS_PLAN → [Execution: PLAN-881]
    └── TARGETS → [Person: VP Facilities]
```

---

## Graph Operations (Required Services)

| Service | Responsibility |
|---|---|
| **Graph Writer** | Sole mutator of nodes/edges from events |
| **Graph Reader** | Queries for radar, evidence, planner |
| **Entity Resolver** | Merge/dedup companies and people |
| **Evidence Assembler** | Walk backward from Opportunity to Signals |

See [API Boundaries](./15-api-boundaries.md).

---

## Storage Evolution (Not Yet Decided — See Ambiguities)

| Stage | Approach |
|---|---|
| **Today** | JSON collections (`data/*.json`) + engine in-memory joins |
| **Phase 1–2** | Postgres tables with graph-like FKs OR Postgres + AGE |
| **Phase 3+** | Dedicated graph index for traversal-heavy reasoning |

Constitution requires **graph semantics** regardless of storage engine.

---

## Query Patterns the OS Must Support

1. **Radar:** Top opportunities for CEO mode with evidence subgraph
2. **Explain:** Why this opportunity exists (signal → fact → problem path)
3. **Fan-out:** All problems implied by signal cluster S
4. **Similar wins:** Past outcomes with similar problem+capability+buyer
5. **Forecast:** Precursors where pattern P historically led to problem Q

See [Decision Engine](./06-decision-engine.md) and [Performance](./18-performance.md).

---

## Prohibited Patterns

- Storing opportunities only as flat JSON rows without provenance edges
- Industry as the primary join key between signals and offers
- UI writing directly to graph truth (must go through Graph Writer)

See [Architecture Rules](./07-architecture-rules.md).
