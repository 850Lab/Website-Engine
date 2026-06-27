# 00 — Master Vision

**Status:** Constitution · Phase 0  
**Related:** [Roadmap](./01-roadmap.md) · [Ontology](./02-ontology.md) · [Architecture Rules](./07-architecture-rules.md) · [Project History](./20-project-history.md)

---

## Mission

The **Opportunity Operating System** exists to answer one question better than any software built before:

> **What is the highest ROI opportunity available to this company right now, and exactly how do we win it?**

The system continuously **detects**, **reasons about**, **prioritizes**, **executes**, and **learns from** business opportunities across every industry. It thinks in **problems** and **capabilities**, not product silos.

---

## What This Is NOT

| Misclassification | Why it is wrong |
|---|---|
| **CRM** | CRM records activities. This machine **infers economic opportunities** and **plans wins**. CRM views are projections only. |
| **Lead generation software** | Lists of businesses are inputs, not the product. The product is **opportunity intelligence**. |
| **Website agency software** | Website Growth is one **capability**, not the architecture. |
| **Pressure washing software** | Exterior cleaning is one **capability**, not the architecture. |
| **KTM-only tooling** | KTM Labor is one **capability** among many. |

Legacy modules (`mission-control`, `pressure-washing`, `v7` previews) exist as **migration-era projections**. They are not the long-term core.

---

## What This IS

An **AI Operating System** that operates on the world in this order:

```
Reality → Signals → Facts → Entities → Relationships → Problems
  → Capabilities → Offers → Opportunities → Execution Plans
  → Outcomes → Learning → Forecasting
```

Everything else — queues, calls, emails, dashboards, reports — is a **capability surface** or **projection** of this spine.

---

## North-Star Questions

The OS must answer:

| Question | System output |
|---|---|
| What expensive problem is emerging? | **Problem** hypothesis + evidence |
| Who has that problem? | **Entity** graph (buyers, facilities, projects) |
| What capabilities solve it? | **Capability** match path |
| What revenue can it generate? | **Score vector** (Revenue, Profit, Cash, etc.) |
| What are the chances we win? | **Probability** + barrier/competition engines |
| What should happen next? | **Execution Plan** |

NOT: *"Who should I call?"* or *"What businesses exist?"* as primary outputs.

---

## One Signal, Many Opportunities

A single world event (hospital expansion, turnaround, permit cluster) may spawn multiple **Opportunity** nodes through different **Problem** paths. The architecture must never assume one signal → one lead.

See [Knowledge Graph](./03-knowledge-graph.md) and [Reasoning phase](./01-roadmap.md#phase-3--reasoning-engine).

---

## Authority

| Layer | Role |
|---|---|
| **Constitution** (`docs/opportunity-os/`) | Permanent rules, ontology, phases |
| **`src/engine/`** | Runtime source of truth for opportunity logic |
| **`src/schema/`** | Locked persistence entities (migration bridge) |
| **UI / legacy modules** | Projections and adapters during transition |

Future engineers and AI agents begin with:

> *"Read the AI Constitution and build the current phase."*

See [Current Phase](./08-current-phase.md).

---

## Success Criteria (System-Level)

1. CEO can switch **CEO Modes** and see re-ranked opportunities with evidence — [Decision Engine](./06-decision-engine.md).
2. Every displayed claim has an **evidence chain** to signals or facts.
3. Capabilities are registered once and reused — [Capability Registry](./05-capability-registry.md).
4. Learning updates **models and weights**, not just records — [Phase 5](./01-roadmap.md#phase-5--learning--forecasting).
5. Forecasting predicts **problem emergence**, not phone lists.

---

## Non-Goals (Constitution Scope)

- Implementing Phase 1 features inside Phase 0
- Replacing legacy systems before exit criteria are met
- Adding ontology objects without Constitution amendment

Parking lot ideas live in [Future Ideas](./19-future-ideas.md).
