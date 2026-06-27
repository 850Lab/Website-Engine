# 02 — Ontology

**Status:** Constitution · Canonical object definitions  
**Related:** [Knowledge Graph](./03-knowledge-graph.md) · [State Machines](./04-state-machines.md) · [Data Model](./14-data-model.md) · [Glossary](./10-glossary.md) · [Capability Registry](./05-capability-registry.md)

This document is the **single source of truth** for object definitions. Implementation in `src/schema/` and `src/engine/` must converge here over time.

---

## Ontology Stack

```
Reality (external world)
  └── Signal → Fact → Entity ↔ Relationship
        └── Problem → Capability → Offer → Opportunity
              └── Execution Plan → Task → Outcome
                    └── Learning → Forecast
```

---

## Object Reference

### Reality

| Attribute | Value |
|---|---|
| **Purpose** | External world state; not stored as a single object — referenced by signals |
| **Required fields** | N/A (conceptual root) |
| **Relationships** | Source of all **Signals** |
| **Lifecycle** | Continuous |
| **Storage** | Not persisted as object |
| **Owner** | N/A |
| **AI agents may modify** | None |

---

### Signal

| Attribute | Value |
|---|---|
| **Purpose** | Immutable observation that the world changed (news, permit, RFP, hire, etc.) |
| **Required fields** | `id`, `sourceId`, `sourceType`, `observedAt`, `contentHash`, `rawRef`, `urgency` |
| **Relationships** | `SUPPORTS` → Fact; `EMITTED_BY` → source; `LINKS_TO` → Entity (after resolution) |
| **Lifecycle** | See [Signal states](./04-state-machines.md#signal) |
| **Storage** | Phase 2+: event log + object store; today: adapter outputs / discovery reports |
| **Owner** | Signal Engine (`Phase 2`) |
| **AI agents may modify** | Extractor, Classifier (create); none may delete (archive only) |

---

### Fact

| Attribute | Value |
|---|---|
| **Purpose** | Structured, testable claim extracted from one or more signals |
| **Required fields** | `id`, `predicate`, `object`, `confidence`, `signalIds[]`, `extractorVersion`, `observedAt` |
| **Relationships** | `IMPLIES` → Problem; `ABOUT` → Entity |
| **Lifecycle** | Created → validated → linked → superseded |
| **Storage** | Graph / fact store (Phase 2+) |
| **Owner** | Signal Engine + Reasoning Engine |
| **AI agents may modify** | Extractor (create); Problemist (read); Auditor (flag) |

---

### Entity

| Attribute | Value |
|---|---|
| **Purpose** | Canonical thing in the world: company, person, facility, project, contract |
| **Required fields** | `id`, `type`, `name`, `dedupKey`, `provenance[]` |
| **Relationships** | Graph edges per [03-knowledge-graph.md](./03-knowledge-graph.md) |
| **Lifecycle** | Discovered → resolved → merged → active → archived |
| **Storage** | Today: `data/businesses.json`, `data/contacts.json` via `src/schema/`; future: graph |
| **Owner** | Entity Resolution service |
| **AI agents may modify** | Resolver (merge suggestions); human approval for merges |

**Note:** Current `Business` and `Contact` schema entities are **Entity projections** during migration.

---

### Relationship

| Attribute | Value |
|---|---|
| **Purpose** | Typed edge between entities or entity↔object with confidence and provenance |
| **Required fields** | `id`, `type`, `fromId`, `toId`, `confidence`, `validFrom`, `provenance[]` |
| **Relationships** | First-class graph edge |
| **Lifecycle** | Created → confirmed → expired |
| **Storage** | Graph store |
| **Owner** | Graph Writer |
| **AI agents may modify** | Resolver, Problemist (suggest); human for high-stakes edges |

---

### Problem

| Attribute | Value |
|---|---|
| **Purpose** | Expensive emerging need — **primary unit of thinking** (not industry) |
| **Required fields** | `id`, `category`, `description`, `severity`, `timeHorizon`, `impactEstimate`, `factIds[]`, `status` |
| **Relationships** | `SOLVED_BY` → Capability; `AFFECTS` → Entity; `SPAWNS` → Opportunity |
| **Lifecycle** | Hypothesized → validated → active → resolved → archived |
| **Storage** | Phase 3+ graph; not yet first-class in code |
| **Owner** | Reasoning Engine |
| **AI agents may modify** | Problemist (create/update hypotheses); Strategist (read) |

**Examples:** Need manpower, need fire watch, need cleaning, need compliance, need automation.

---

### Capability

| Attribute | Value |
|---|---|
| **Purpose** | What the company can deliver; internal truth independent of packaging |
| **Required fields** | `id`, `name`, `problemsSolved[]`, `kpis[]`, `certsRequired[]`, `marginProfile`, `executionProcess` |
| **Relationships** | `PACKAGED_AS` → Offer; `SOLVES` → Problem |
| **Lifecycle** | Registered → active → deprecated |
| **Storage** | Constitution [05-capability-registry.md](./05-capability-registry.md) → `engine-data/capabilities/` (future) |
| **Owner** | Platform / CEO |
| **AI agents may modify** | None autonomously; Learning AI suggests updates for human approval |

---

### Offer

| Attribute | Value |
|---|---|
| **Purpose** | Commercial packaging of one or more capabilities for a market conversation |
| **Required fields** | `id`, `name`, `capabilityIds[]`, `promise`, `pain[]`, `urgency`, `kpis[]`, `channels[]`, `bestBuyers[]` |
| **Relationships** | `TARGETS` → Problem/Buyer; `GENERATES` → Opportunity candidates |
| **Lifecycle** | Draft → active → retired |
| **Storage** | `engine-data/offers/offers.json` |
| **Owner** | Revenue / product leadership |
| **AI agents may modify** | None autonomously |

**Note:** Today `bestBuyers[]` is migration-era matching; Phase 3 moves matching to **Problem** fit.

---

### Opportunity

| Attribute | Value |
|---|---|
| **Purpose** | Actionable economic bet: problem + buyer + offer + score vector + evidence |
| **Required fields** | `id`, `problemId`, `offerId`, `buyerEntityId`, `scoreVector`, `evidenceRef`, `status`, `recommendedAction` |
| **Relationships** | `HAS_PLAN` → Execution Plan; `TARGETS` → Entity; `DERIVED_FROM` → Signal/Fact |
| **Lifecycle** | See [Opportunity states](./04-state-machines.md#opportunity) |
| **Storage** | Engine runtime + `data/opportunities.json` (schema); radar projection |
| **Owner** | Reasoning Engine + Decision Engine |
| **AI agents may modify** | Opportunity Factory, Score Council (create/score); Execution (status advance) |

**Note:** Current `src/engine/opportunities/` uses industry×offer — **transitional**, not constitutional end state.

---

### Execution Plan

| Attribute | Value |
|---|---|
| **Purpose** | How to win a specific opportunity: contacts, channels, sequence, timing, assets |
| **Required fields** | `id`, `opportunityId`, `actions[]`, `autonomyLevel`, `status`, `createdAt` |
| **Relationships** | `CONTAINS` → Task; `FOR` → Opportunity |
| **Lifecycle** | Draft → approved → executing → completed / cancelled |
| **Storage** | Phase 4+; today: `src/engine/execution/` (mission-scoped, transitional) |
| **Owner** | Execution Engine |
| **AI agents may modify** | Planner (draft); human approval required before dispatch |

---

### Task

| Attribute | Value |
|---|---|
| **Purpose** | Atomic executable unit within a plan (call, email, visit, proposal send) |
| **Required fields** | `id`, `planId`, `type`, `channel`, `targetEntityId`, `scheduledAt`, `status`, `payloadRef` |
| **Relationships** | `PART_OF` → Execution Plan; `PRODUCES` → Outcome |
| **Lifecycle** | Pending → approved → dispatched → completed / failed / skipped |
| **Storage** | Execution store; legacy Attempt/queue items are projections |
| **Owner** | Execution Engine |
| **AI agents may modify** | Dispatcher (with policy gate); Sales AI (draft content only) |

---

### Outcome

| Attribute | Value |
|---|---|
| **Purpose** | Recorded result of execution or deal closure for learning |
| **Required fields** | `id`, `opportunityId`, `result`, `revenue`, `margin`, `cycleDays`, `objectionTags[]`, `at` |
| **Relationships** | `CLOSES` → Opportunity; `FEEDS` → Learning |
| **Lifecycle** | Recorded → verified → learned |
| **Storage** | Schema `Attempt` + future Outcome entity; legacy CRM writes transitional |
| **Owner** | Execution Engine + Learning Engine |
| **AI agents may modify** | Chronicler (summarize); human verifies revenue |

---

### Learning

| Attribute | Value |
|---|---|
| **Purpose** | Model update artifact: calibration, playbook, weight change, extractor fix |
| **Required fields** | `id`, `type`, `targetEngine`, `before`, `after`, `evidenceOutcomeIds[]`, `appliedAt` |
| **Relationships** | `UPDATES` → Score engine / Capability / Playbook |
| **Lifecycle** | Proposed → validated → applied → rolled back |
| **Storage** | `schema/learning-report.js` entity; model registry (Phase 5) |
| **Owner** | Learning Engine |
| **AI agents may modify** | Calibrator (propose); human approves apply |

---

### Forecast

| Attribute | Value |
|---|---|
| **Purpose** | Forward prediction of problem or opportunity emergence |
| **Required fields** | `id`, `problemCategory`, `region`, `predictedWindow`, `confidence`, `precursorSignalIds[]`, `modelVersion` |
| **Relationships** | `PREDICTS` → Problem; `USES` → Indicator |
| **Lifecycle** | Generated → monitoring → confirmed / missed → calibrated |
| **Storage** | Forecast store (Phase 5) |
| **Owner** | Forecasting Engine |
| **AI agents may modify** | Forecaster (create); Calibrator (adjust weights) |

---

## Mapping: Constitution ↔ Current Code

| Constitution object | Current implementation | Gap |
|---|---|---|
| Entity (Company) | `schema/business.js`, `data/businesses.json` | Partial |
| Entity (Person) | `schema/contact.js` | Partial |
| Offer | `engine-data/offers/offers.json` | Missing `capabilityIds` link |
| Opportunity | `engine/opportunities/`, `schema/opportunity.js` | Problem-centric model missing |
| Outcome | `schema/attempt.js` | Full Outcome entity incomplete |
| Signal, Fact, Problem | Not first-class | Phase 2–3 |
| Capability | Constitution only | Not in `engine-data` yet |

See [Architecture Rules](./07-architecture-rules.md) for convergence policy.

---

## Amendment Process

1. Propose change in [Build Log](./09-build-log.md)
2. Update this document and affected Constitution files
3. Owner approval required for new canonical objects or lifecycle changes
