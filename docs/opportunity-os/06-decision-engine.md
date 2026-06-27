# 06 — Decision Engine

**Status:** Constitution · Score Council design  
**Related:** [Ontology — Opportunity](./02-ontology.md#opportunity) · [Capability Registry](./05-capability-registry.md) · [AI Agents](./12-ai-agents.md) · [Design Principles](./11-design-principles.md)

---

## Core Rule

**There must NOT be one score.**

Every opportunity carries a **score vector**. CEO **Modes** apply dynamic weights to produce a **composite rank** for sorting only. All subscores remain visible (Bloomberg-style).

Implementation today (`opportunityScore` in `src/engine/intelligence/`) is **transitional single-score** — Phase 1 replaces with Score Council.

---

## Independent Scoring Engines

| Engine | Measures | Primary inputs |
|---|---|---|
| **Revenue** | Total contract / ACV potential | Problem severity, project budget proxies, capability TCV history |
| **Profit** | Expected margin dollars | Capability margin profile, scope fit, delivery cost |
| **Execution** | Can we deliver now? | Certs, crew capacity, geo, backlog |
| **Risk** | Downside exposure | Safety, legal, reputational, buyer credit |
| **Relationship** | Warm path strength | Past wins, contacts, referrals, incumbency |
| **Competition** | Competitive intensity (inverse) | Known vendors on similar problems |
| **Timing** | Urgency / window | Signal recency, deadlines, seasonality |
| **Confidence** | Evidence strength | Signal quality, fact corroboration, database depth |
| **Recurring Revenue** | Repeat / contract potential | Facility type, service nature |
| **Strategic Value** | Portfolio importance | New market entry, reference logo, capability proof |
| **Probability** | P(win) calibrated | Learning engine, similar outcomes |
| **Cash Flow** | Time-to-cash | Payment terms, buyer type, cycle stage |

---

## Per-Engine Specification Template

Each engine must document:

| Attribute | Description |
|---|---|
| **Inputs** | Graph facts, registry fields, historical outcomes |
| **Outputs** | Subscore 0–100 + structured reasons[] |
| **Evidence** | Citations to signals, facts, past outcomes |
| **Confidence** | Meta-confidence in the subscore itself |
| **Assumptions** | Explicit directional estimates flagged for validation |

---

## Engine Summaries

### Revenue Engine
- **Inputs:** Market estimates, matched entity count, capability typical TCV, problem impact estimate
- **Outputs:** `revenueScore`, `estimatedRevenuePotential` range
- **Evidence:** Budget signals, comparable contracts, registry defaults
- **Assumptions:** Directional until validated by sales outcomes

### Profit Engine
- **Inputs:** Delivery cost model, scope complexity, capability margin profile
- **Outputs:** `profitScore`, expected margin $
- **Evidence:** Historical margin on similar outcomes

### Execution Engine
- **Inputs:** Cert matrix, crew availability, distance, current load
- **Outputs:** `executionScore`, blockers[]
- **Evidence:** Operations data, capability registry requirements

### Risk Engine
- **Inputs:** Buyer type, problem category, regulatory exposure
- **Outputs:** `riskScore` (higher = more risk)
- **Evidence:** Compliance rules, incident history

### Relationship Engine
- **Inputs:** Contact graph, past outcomes, shared connections
- **Outputs:** `relationshipScore`
- **Evidence:** CRM projection of graph edges (not source of truth)

### Competition Engine
- **Inputs:** Known incumbents, RFP bidder lists, loss reasons
- **Outputs:** `competitionScore` (higher = less competition)
- **Evidence:** Bid awards, sales notes

### Timing Engine
- **Inputs:** Signal timestamps, RFP deadlines, seasonality tables
- **Outputs:** `timingScore`, `actBy` date
- **Evidence:** Signal metadata, calendar rules

### Confidence Engine
- **Inputs:** businessesFound, contactCoverage, source trust tier
- **Outputs:** `confidenceScore`, `databaseConfidence` label
- **Evidence:** [market-analysis](../../src/engine/market-analysis/index.js) patterns today

### Recurring Revenue Engine
- **Inputs:** Facility count, service cadence, contract history
- **Outputs:** `recurringScore`, estimated MRR/ARR

### Strategic Value Engine
- **Inputs:** CEO strategic goals, market entry targets
- **Outputs:** `strategicScore`, strategicReasons[]

### Probability Engine
- **Inputs:** Learning-calibrated features, relationship, competition, timing
- **Outputs:** `probabilityScore`, `pWin` 0–1
- **Evidence:** Backtest metrics from Phase 5

### Cash Flow Engine
- **Inputs:** Expected close date, invoice terms, mobilization cost timing
- **Outputs:** `cashScore`, `expectedCashDate`

---

## CEO Modes (Weight Presets)

Modes adjust weights — they do **not** hide subscores.

| Mode | Weight emphasis |
|---|---|
| **Cash Flow** | Cash Flow ↑, Timing ↑, Execution ↑, Revenue moderate |
| **Enterprise** | Revenue ↑, Strategic ↑, Relationship ↑, Risk balanced |
| **Recurring** | Recurring ↑, Relationship ↑, Profit moderate |
| **Fastest Win** | Probability ↑, Execution ↑, Timing ↑, Competition ↑ |
| **$5M Opportunity** | Revenue ↑, Strategic ↑, Forecast ↑, Risk strict |

**Storage:** `engine-data/ceo-modes/` (future) or config in engine  
**Owner:** CEO / platform  
**Implementation:** Phase 1 Executive OS

---

## Composite Rank (Sorting Only)

```
composite = Σ (weight[mode][engine] × subscore[engine])
```

- Weights must sum to 1.0 per mode
- Tie-break: Revenue → Probability → Timing
- Composite is **never** shown without subscore breakdown

---

## Evidence Package (Required)

Every scored opportunity exports:

```json
{
  "opportunityId": "...",
  "scoreVector": { "revenue": 82, "profit": 71, ... },
  "composite": 78,
  "mode": "cash_flow",
  "evidence": [
    { "engine": "revenue", "claim": "...", "citations": ["signal:...", "fact:..."] }
  ],
  "assumptions": ["Revenue range directional — not validated"],
  "recommendedNextAction": "..."
}
```

---

## What Must Never Happen

- Single opaque score without breakdown
- Industry tag as primary ranking input
- LLM-generated score without structured engines beneath
- Ranking without evidence citations

See [Testing Strategy](./16-testing-strategy.md) · [Performance](./18-performance.md)
