# 07 — Architecture Rules

**Status:** Constitution · Permanent engineering law  
**Related:** [Master Vision](./00-master-vision.md) · [Ontology](./02-ontology.md) · [API Boundaries](./15-api-boundaries.md) · [Folder Map](./13-folder-map.md)

Violations require Constitution amendment or explicit owner waiver documented in [Build Log](./09-build-log.md).

---

## Source of Truth

| Rule | Detail |
|---|---|
| **R1** | `src/engine/` is the source of truth for opportunity logic (radar, scoring, factory, mission projections) |
| **R2** | `src/schema/` is the locked persistence layer for operational entities during migration |
| **R3** | Constitution ontology is the target model; code must converge, not diverge |

---

## Projections, Not Truth

| Rule | Detail |
|---|---|
| **R4** | UI (`src/pivotal-os/`) is a **projection** — never the authority for business rules |
| **R5** | CRM patterns (`mission-control`, `pressure-washing`, legacy JSON stores) are **projections/adapters** during migration |
| **R6** | Reports (`reports/`, `scripts/opportunity-engine/`) are **outputs**, not truth |

---

## Logic Placement

| Rule | Detail |
|---|---|
| **R7** | Never duplicate business logic across engine, services, and legacy modules |
| **R8** | Routes call engine or services — not inline business rules |
| **R9** | `src/services/` is the schema access layer; routes should not import `src/schema/*` directly (existing rule in codebase) |

---

## Product Architecture

| Rule | Detail |
|---|---|
| **R10** | Never build product-specific silos (Website OS, PW OS as separate brains) |
| **R11** | Capabilities are reusable; offers are packaging — [Capability Registry](./05-capability-registry.md) |
| **R12** | Problems are universal; industries are tags |
| **R13** | Opportunities are **inferred**, not manually typed as primary workflow |
| **R14** | One signal may produce many opportunities |

---

## AI Usage

| Rule | Detail |
|---|---|
| **R15** | Evidence before AI — rules and facts first, LLM on tiered escalation — [Performance](./18-performance.md) |
| **R16** | Reason before execution — no autonomous dispatch without plan + policy gate |
| **R17** | Everything must learn — outcomes feed learning loops — [Phase 5](./01-roadmap.md#phase-5--learning--forecasting) |

---

## Migration Era (Temporary, Explicit)

| Rule | Detail |
|---|---|
| **R18** | Feature flags (`USE_SCHEMA_*`) are migration tools, not architecture |
| **R19** | Dual-read/dual-write exists to validate parity — goal is removal |
| **R20** | `id-bridge.js` is transitional; graph entity resolution replaces it |
| **R21** | Do not expand legacy JSON write paths while building engine truth |

---

## Long-Term Priority

| Rule | Detail |
|---|---|
| **R22** | Protect long-term architecture over short-term convenience |
| **R23** | New features must name their Constitution phase and exit criteria |
| **R24** | Ideas without phase go to [Future Ideas](./19-future-ideas.md), not code |
| **R25** | Amend Constitution before adding canonical ontology objects |

---

## Prohibited Without Amendment

- New locked schema entities (see `schema/index.js` comment)
- Single-score opportunity ranking in new code
- Industry-primary opportunity matching in new code
- LLM-on-every-signal default path
- UI writing directly to `data/*.json` legacy stores for new features

---

## Required Reading for AI Agents

Before any implementation prompt:

1. [Current Phase](./08-current-phase.md)
2. [Roadmap](./01-roadmap.md) for active phase only
3. [Ontology](./02-ontology.md) + [Architecture Rules](./07-architecture-rules.md)
4. Relevant specialized doc (graph, scoring, capabilities)

Prompt template:

> *"Read the AI Constitution and build the current phase."*
