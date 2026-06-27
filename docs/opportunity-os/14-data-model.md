# 14 — Data Model

**Status:** Constitution · Canonical schemas (not implemented here)  
**Related:** [Ontology](./02-ontology.md) · [Knowledge Graph](./03-knowledge-graph.md) · [State Machines](./04-state-machines.md) · [Schema code](../../src/schema/index.js)

Defines **target shapes**. Current `src/schema/` implements a **subset** for migration.

---

## Storage Locations (Today → Target)

| Domain | Today | Target |
|---|---|---|
| Entities (business/contact) | `data/businesses.json`, `data/contacts.json` | Graph + OLTP |
| Offers / campaigns | `engine-data/` | `engine-data/` + capability links |
| Signals / facts | Discovery reports, ad hoc | Event log + fact store |
| Opportunities (runtime) | Engine in-memory + schema file | Graph + projection tables |
| Legacy CRM | `qualified-businesses.json`, `pressure-washing-leads.json` | Archived adapters |

---

## Signal (Target)

```json
{
  "id": "sig_abc123",
  "sourceId": "permits_harris_tx",
  "sourceType": "building_permit",
  "observedAt": "2026-06-23T12:00:00Z",
  "contentHash": "sha256:...",
  "rawRef": "s3://captures/2026/06/23/abc.html",
  "urgency": "high",
  "status": "linked",
  "geo": { "region": "US-TX", "city": "Houston" },
  "metadata": {}
}
```

**Validation:** required fields per [Ontology](./02-ontology.md#signal); `contentHash` unique per source.

---

## Fact (Target)

```json
{
  "id": "fact_xyz",
  "predicate": "project.approved",
  "object": { "type": "hospital_expansion", "beds": 120, "targetQuarter": "2027-Q3" },
  "confidence": 0.87,
  "signalIds": ["sig_abc123"],
  "extractorVersion": "extractor_v2.1",
  "observedAt": "2026-06-23T12:00:00Z",
  "status": "confirmed"
}
```

---

## Problem (Target)

```json
{
  "id": "prob_fire_watch_construction",
  "category": "need_fire_watch",
  "description": "Hot work compliance during hospital expansion",
  "severity": 0.8,
  "timeHorizon": "2027-Q2",
  "impactEstimate": { "low": 50000, "high": 500000, "currency": "USD" },
  "factIds": ["fact_xyz"],
  "status": "validated"
}
```

---

## Capability (Target)

```json
{
  "id": "cap_fire_watch",
  "name": "Fire Watch",
  "problemsSolved": ["need_fire_watch", "need_compliance_coverage"],
  "kpis": ["compliance_incidents", "coverage_hours"],
  "certsRequired": ["fire_watch_cert"],
  "marginProfile": { "typicalMarginPct": 0.35 },
  "status": "active"
}
```

See [05-capability-registry.md](./05-capability-registry.md) for full registry.

---

## Offer (Current + Target)

**Current:** `engine-data/offers/offers.json`

```json
{
  "id": "offer_ktm_manpower",
  "name": "KTM Manpower and Safety Support",
  "capabilityIds": ["cap_ktm_labor", "cap_fire_watch"],
  "pain": ["Labor shortages", "Safety coverage gaps"],
  "promise": "Reliable manpower and safety support when work needs to move.",
  "urgency": "...",
  "kpis": ["Jobs filled", "Time to fill"],
  "channels": ["Phone", "Email", "Visit"],
  "bestBuyers": ["Commercial Construction"]
}
```

**Phase 1 change:** add `capabilityIds[]`; deprecate `bestBuyers` as primary matcher.

---

## Opportunity (Target)

```json
{
  "id": "opp_4421",
  "problemId": "prob_labor_surge",
  "offerId": "offer_ktm_manpower",
  "buyerEntityId": "ent_company_998",
  "scoreVector": {
    "revenue": 82,
    "profit": 71,
    "execution": 88,
    "probability": 42
  },
  "composite": 76,
  "ceoMode": "cash_flow",
  "evidenceRef": "evidence_bundle_881",
  "recommendedNextAction": "Call 58 reachable roofing contractors...",
  "status": "scored",
  "estimatedRevenuePotential": { "low": 500000, "high": 7000000, "confidence": "directional" }
}
```

---

## Execution Plan (Target)

```json
{
  "id": "plan_881",
  "opportunityId": "opp_4421",
  "autonomyLevel": "draft",
  "status": "approved",
  "actions": [
    {
      "id": "task_1",
      "type": "call",
      "channel": "phone",
      "targetEntityId": "ent_person_441",
      "scheduledAt": "2026-06-24T14:00:00Z",
      "status": "approved"
    }
  ]
}
```

---

## Outcome (Target)

```json
{
  "id": "outcome_991",
  "opportunityId": "opp_4421",
  "result": "won",
  "revenue": 750000,
  "margin": 0.32,
  "cycleDays": 45,
  "objectionTags": ["price", "timing"],
  "at": "2026-08-07T00:00:00Z",
  "status": "verified"
}
```

---

## Schema Entity Mapping (Migration Bridge)

| Schema entity | Constitution object | Notes |
|---|---|---|
| `Business` | Entity (Company) | `legacyId` bridge |
| `Contact` | Entity (Person) | |
| `Offer` | Offer | schema + engine-data |
| `Campaign` | Mission context | Not full Mission object |
| `Opportunity` | Opportunity (partial) | Missing problemId, scoreVector |
| `QueueItem` | Execution projection | Not opportunity truth |
| `Attempt` | Outcome projection | Partial |
| `LearningReport` | Learning | Phase 5 |

**Validation expectations:**
- All schema writes via `src/services/`
- `validate.js` rules enforced on upsert
- New entities require Constitution amendment

See [API Boundaries](./15-api-boundaries.md).

---

## Relationships (Logical, Not SQL)

```
Signal ──supports──> Fact ──implies──> Problem ──solved_by──> Capability
                                                      │
Offer <──packaged── Capability                        │
  │                                                   │
  └──────────────> Opportunity <──targets── Entity
                         │
                         ├──has──> ExecutionPlan ──contains──> Task
                         └──produces──> Outcome ──feeds──> Learning
```

Full graph: [03-knowledge-graph.md](./03-knowledge-graph.md).
