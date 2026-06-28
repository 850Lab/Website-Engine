# 26 — Reasoning Engine

**Status:** Phase 2.5.8 · Constitution amendment (design only)  
**Related:** [Master Vision](./00-master-vision.md) · [Ontology](./02-ontology.md) · [Knowledge Graph](./03-knowledge-graph.md) · [Decision Engine](./06-decision-engine.md) · [Architecture Rules](./07-architecture-rules.md) · [World Model](./23-world-model.md) · [Signal & Problem Pipeline](./22-signal-and-problem-pipeline.md)

---

## Purpose

This document defines the **permanent reasoning architecture** for Opportunity OS — everything that happens **after Situations**.

The knowledge pipeline (Phases 2.1–2.5.5) answers:

> *What happened, and what is going on?*

The reasoning pipeline (Phases 2.6+) answers:

> *What does it mean for us, what can we deliver, and is it worth pursuing?*

**Rule:** Reasoning extends the Constitution. It does not replace the World Model, create parallel stores, or bypass Situations.

---

## 1. What Is Reasoning?

In Opportunity OS, **reasoning** is the deterministic (and optionally LLM-assisted **explanation** layer) process of:

1. Interpreting **Situations** as candidate meanings
2. Evaluating **evidence** and **confidence** under explicit rules
3. Inferring **Problems** — expensive emerging needs
4. Matching **Capabilities** and **Offers**
5. Creating **Opportunities** — actionable economic bets
6. Scoring and projecting to **Mission Control**
7. Learning from **Outcomes** to improve **Forecasts**

Reasoning **never** observes reality directly. Sensors and the signal pipeline own observation. Reasoning **consumes** structured knowledge objects produced upstream.

### Layer definitions (non-overlapping)

| Layer | Question it answers | What it is | What it is NOT |
|---|---|---|---|
| **Observation** | What was captured? | Raw immutable capture at ingest boundary | A conclusion |
| **Fact** | What testable claim does evidence support? | Subject–predicate–object evidence with provenance | Interpretation of business need |
| **Relationship** | How are knowledge objects connected? | Typed graph edge with fact provenance | A story or summary |
| **Situation** | What is happening in the world right now? | Evidence-backed cluster snapshot (entity, place, time, markets) | A problem statement or sales pitch |
| **Hypothesis** | What might this situation mean? | Competing interpretive candidates before commitment | A confirmed problem |
| **Problem** | What expensive need is emerging? | Evidence-backed business obstacle for a buyer/market | A label, tag, or opportunity |
| **Opportunity** | Is this worth pursuing commercially? | Problem + offer + buyer + scores + evidence | A CRM lead or queue row |
| **Forecast** | What is likely to happen next? | Learned probability over future problems/events | Guessing without outcomes |

### Boundary rule (permanent)

```
Knowledge:  Observation → Signal → Fact → Graph → Relationship → Situation
Reasoning:  Situation → Hypothesis → Problem → Capability → Offer → Opportunity → Score → Mission Control
Learning:   Outcome → Learning → Forecast
```

**Situation** is the semantic firewall between knowledge and reasoning.

---

## 2. The Reasoning Pipeline

```
Situation
  ↓
Hypothesis Generator
  ↓
Evidence Collector
  ↓
Evidence Evaluator
  ↓
Confidence Engine
  ↓
Contradiction Detector
  ↓
Problem Inference
  ↓
Capability Matching
  ↓
Offer Selection
  ↓
Opportunity Factory
  ↓
Score Council
  ↓
Mission Control (projection)
  ↓
STOP (execution is downstream)
```

### Layer explanations

| Layer | Owner (future) | Input | Output | Role |
|---|---|---|---|---|
| **Situation** | `engine/situations` | Graph clusters | Situation objects | Canonical reasoning entry point |
| **Hypothesis Generator** | `engine/reasoning/hypothesis` | Situation(s) | Hypothesis[] | Propose competing meanings — no commitment |
| **Evidence Collector** | `engine/reasoning/evidence` | Situation + Hypothesis | Evidence bundle | Gather supporting facts, relationships, signals **by reference** |
| **Evidence Evaluator** | `engine/reasoning/evidence` | Evidence bundle | Weighted evidence + gaps | Apply trust tiers; flag missing evidence |
| **Confidence Engine** | `engine/reasoning/confidence` | Weighted evidence | Propagated confidence scores | Roll up confidence with audit trail |
| **Contradiction Detector** | `engine/reasoning/contradiction` | Hypotheses + evidence | Conflicts, reductions, unresolved flags | Prevent silent disagreement |
| **Problem Inference** | `engine/problems` | Validated hypotheses | Problem objects | Commit to business obstacle — Situations only |
| **Capability Matching** | `engine/capability-matcher` | Problem | Capability match[] | Deterministic fit — registry rules first |
| **Offer Selection** | `engine/offers` + selector | Problem + matches | Offer candidate(s) | Commercial packaging |
| **Opportunity Factory** | `engine/opportunity-factory` | Problem + offer + buyer | Opportunity | Actionable bet with evidence refs |
| **Score Council** | `engine/score-council` | Opportunity | Score vector | Independent engines — no invented evidence |
| **Mission Control** | `engine/mission-control` | Engine projections | UI DTO | Read-only executive surface |

Each layer must be ** independently testable**, **append-audited**, and **reproducible** from inputs.

---

## 3. Hypothesis Object

A **Hypothesis** is a provisional interpretation of one or more Situations. Multiple hypotheses may coexist until evidence and contradiction resolution promote one to a Problem.

### Canonical schema

| Field | Type | Description |
|---|---|---|
| `id` | string | `hyp_{uuid}` |
| `title` | string | Short interpretive statement |
| `description` | string | Template-based explanation of the hypothesized meaning |
| `originatingSituationIds` | string[] | Situations that triggered this hypothesis (≥1) |
| `supportingFactIds` | string[] | Facts cited **by reference** (via situation or evidence collector) |
| `supportingRelationshipIds` | string[] | Graph edge IDs supporting the hypothesis |
| `supportingSignalIds` | string[] | Signals in the evidence chain |
| `confidence` | number | 0–1 after propagation — never invented |
| `competingHypothesisIds` | string[] | Mutually exclusive alternatives |
| `assumptions` | string[] | Explicit assumptions required for this reading |
| `missingEvidence` | object[] | `{ type, description, priority }` — gaps blocking promotion |
| `status` | enum | Lifecycle state (below) |
| `problemTypeCandidate` | string | Ontology problem type if promoted |
| `createdAt` | ISO8601 | |
| `updatedAt` | ISO8601 | |
| `metadata` | object | Extractor version, rules matched, audit refs |

### Hypothesis lifecycle

```
proposed → evidence_gathering → evaluated → competing → promoted | rejected | unresolved
```

| State | Meaning |
|---|---|
| **proposed** | Generated from situation — not yet fully evaluated |
| **evidence_gathering** | Evidence Collector assembling bundle |
| **evaluated** | Evidence Evaluator + Confidence Engine complete |
| **competing** | Contradiction Detector found active alternatives |
| **promoted** | Became a Problem — terminal for this hypothesis |
| **rejected** | Insufficient evidence or lost to competitor |
| **unresolved** | Conflicting evidence — needs more observation |

**Rule:** Only **promoted** hypotheses become Problems. Promotion requires passing confidence floor and contradiction checks.

---

## 4. Confidence Propagation

Confidence is **traceable upward**. No layer may assign confidence without citing upstream inputs.

### Propagation chain

```
Signal confidence
  ↓ (fact builder rules, source tier caps)
Fact confidence
  ↓ (edge merge, multi-fact support)
Relationship confidence
  ↓ (cluster aggregation)
Situation confidence
  ↓ (hypothesis evidence bundle)
Hypothesis confidence
  ↓ (promotion threshold)
Problem confidence
  ↓ (match quality + evidence depth)
Opportunity confidence (Confidence engine subscore)
  ↓ (Score Council — visible, not hidden)
```

### Principles

| Rule | Detail |
|---|---|
| **CP1** | Every confidence value stores `provenance`: which IDs and weights produced it |
| **CP2** | Upstream decay applies — stale signals reduce downstream caps |
| **CP3** | Multi-source corroboration increases confidence only when sources are **independent** |
| **CP4** | Contradiction reduces confidence — never ignored |
| **CP5** | LLM output may **not** set confidence — only rules engines and calibrated learning |
| **CP6** | Score Council **reads** opportunity confidence — does not originate evidence confidence |

### Example propagation narrative

A permit signal at 0.85 confidence yields facts at ≤0.85. Three corroborating facts on the same relationship edge merge to 0.82 edge confidence. The situation aggregates to 0.78. Hypothesis " hospital expansion labor surge" inherits 0.78 base, gains +0.05 for independent government source, −0.10 for single-buyer assumption → 0.73. Problem promotion requires ≥0.65 → promoted at 0.73.

---

## 5. Evidence Weighting

Deterministic **trust tiers** govern how much each evidence type may contribute. No numeric implementation in this phase — principles only.

### Trust hierarchy (highest to lowest)

| Tier | Examples | Principle |
|---|---|---|
| **T1 — Primary official** | Government filing, signed contract, recorded permit, regulatory docket | Highest weight; may corroborate alone for promotion |
| **T2 — Verified institutional** | Buyer press release, audited financial disclosure, official RFP | High weight; requires entity match |
| **T3 — Reputable secondary** | Established trade press, industry association bulletin | Moderate weight; needs T1/T2 or multi-source |
| **T4 — Local credible** | Local news with named sources, executive interview (recorded) | Moderate-low; geography-sensitive |
| **T5 — Industry commentary** | Industry blog, analyst note without primary cite | Low; hypothesis support only |
| **T6 — Weak signal** | Rumor, anonymous post, social mention | Minimal; never sole basis for Problem promotion |

### Weighting principles

| Principle | Detail |
|---|---|
| **EW1** | Weight applies to **source type**, not headline sentiment |
| **EW2** | Same fact from two copies of one article counts as **one** source |
| **EW3** | Government + trade press + buyer statement = independent corroboration |
| **EW4** | Social signals capped below T4 regardless of classifier confidence |
| **EW5** | Missing tier metadata defaults to T5 — conservative |

---

## 6. Contradictions

When hypotheses disagree, the system must **surface conflict** — not pick a silent winner.

### Example: plant expansion vs plant closure

| Hypothesis A | Hypothesis B |
|---|---|
| "Regional refinery expanding unit capacity" | "Regional refinery closing aging unit" |

**Contradiction Detector actions:**

1. Link A and B as `competingHypothesisIds`
2. Move both to **competing** status
3. Reduce confidence on both by conflict penalty
4. Set situation flag `unresolvedConflict: true`
5. Emit `missingEvidence`: need official capex filing OR closure notice
6. **Block Problem promotion** until resolved or one hypothesis is **rejected** with cited evidence

### Resolution paths

| Path | Outcome |
|---|---|
| New T1 evidence favors A | Reject B; promote A if threshold met |
| New T1 evidence favors B | Reject A; promote B |
| No new evidence | Remain **unresolved** — no Problem |
| Both partially true | Split into non-competing hypotheses (different units/time horizons) — requires explicit scope disambiguation |

---

## 7. Problem Object

A **Problem** is an evidence-backed **expensive emerging need** — not a label.

### Canonical schema

| Field | Type | Description |
|---|---|---|
| `id` | string | `prob_{uuid}` |
| `title` | string | Buyer-facing need statement |
| `description` | string | Template-based scope of the need |
| `problemType` | string | Ontology problem type |
| `affectedEntityIds` | string[] | Who has the problem |
| `affectedMarketIds` | string[] | Markets impacted |
| `affectedCapabilityIds` | string[] | Capabilities relevant (pre-match hints) |
| `severity` | enum | `low` \| `medium` \| `high` \| `critical` |
| `urgency` | enum | `low` \| `medium` \| `high` \| `critical` |
| `confidence` | number | Propagated from hypothesis — traceable |
| `supportingHypothesisIds` | string[] | Promoted-from hypotheses |
| `supportingSituationIds` | string[] | Situations in chain (≥1) |
| `supportingEvidence` | object[] | `{ type, refId, tier, weight, excerpt? }` |
| `contradictions` | object[] | Active or resolved conflicts |
| `resolutionState` | enum | `open` \| `monitoring` \| `addresed` \| `expired` |
| `createdAt` | ISO8601 | |
| `updatedAt` | ISO8601 | |
| `metadata` | object | Inference version, rules, audit |

### Problem vs Situation

| Situation | Problem |
|---|---|
| "ABC Manufacturing expansion in Beaumont" | "Temporary labor surge during plant expansion" |
| Describes **what is happening** | Describes **need worth solving** |
| Evidence snapshot | Interpreted business obstacle |

---

## 8. Explainability

Every inferred Problem **must** expose an explainability bundle for Mission Control.

### Required answers

| Question | Source |
|---|---|
| **Why?** | Promoted hypothesis title + problem type rationale |
| **Which evidence?** | `supportingEvidence[]` with tier and refs |
| **Which situations?** | `supportingSituationIds` + situation summaries |
| **Which facts?** | Fact IDs in evidence chain (via situation — not direct inference input) |
| **Which signals?** | Signal IDs in provenance chain |
| **What contradicts it?** | `contradictions[]` with competing hypothesis IDs |
| **What would increase confidence?** | `missingEvidence[]` + tier guidance |
| **What would decrease confidence?** | Competing hypotheses + contradiction flags |

### Explainability object (projection)

```json
{
  "problemId": "prob_…",
  "headline": "…",
  "why": "…",
  "situations": [{ "id", "title", "confidence" }],
  "evidenceChain": [{ "signalId", "factId", "tier", "relationshipId" }],
  "contradictions": [{ "hypothesisId", "summary", "status" }],
  "confidenceFactors": { "base", "corroboration", "penalties", "final" },
  "confidenceLevers": { "increase": [], "decrease": [] }
}
```

**Rule:** Mission Control displays explainability — it does not compute it. Reasoning Engine owns the bundle.

---

## 9. Learning (Design Only)

Learning **modifies calibration** — not the Constitution chain order.

### What outcomes may update

| Target | Learning action |
|---|---|
| **Confidence weights** | Adjust tier weights when T3 sources predict wins better than T1 in niche |
| **Timing weights** | Adjust urgency decay by market and problem type |
| **Problem templates** | Refine which hypotheses promote for which situation categories |
| **Capability match thresholds** | Tune fit scores from win/loss patterns |
| **Forecast accuracy** | Update emergence priors by region and vertical |

### Architecture constraints

| Rule | Detail |
|---|---|
| **L1** | Learning writes to `engine/learning` + calibration store — not live inference code paths silently |
| **L2** | Every calibration change is versioned and auditable |
| **L3** | Learning never deletes evidence — adjusts weights only |
| **L4** | Human approval gate for Constitution-tier rule changes |
| **L5** | No ML algorithm mandate — architecture supports rules-first; models optional later |

---

## 10. Forecasting

Forecast is **learned probability** — not prediction from nowhere.

```
Problem
  ↓
Execution Plan
  ↓
Outcome (win / loss / revenue / timing)
  ↓
Learning (calibration update)
  ↓
Forecast (forward probability of problem/opportunity emergence)
```

| Concept | Definition |
|---|---|
| **Forecast** | Probability distribution over future problem types in a market/region |
| **Input** | Historical outcomes, situation patterns, seasonal priors |
| **Output** | Ranked emergence candidates with confidence intervals |
| **Constraint** | Forecast cites learning version + historical sample — never orphan predictions |

Forecast feeds **Opportunity Radar** and **Mission Control** forward views — not the core inference pipeline in reverse.

---

## 11. Permanent Architectural Rules

| ID | Rule |
|---|---|
| **RE1** | Problems **never** consume raw Facts directly — only Situations (and hypothesis evidence **by reference**) |
| **RE2** | Problem Inference **never** consumes raw graph nodes — only Situations |
| **RE3** | Opportunities **consume** Problems — not Situations or Signals directly |
| **RE4** | Hypotheses are **mandatory** before Problem promotion — no skip |
| **RE5** | Score Council **never** invents evidence — scores only what exists |
| **RE6** | LLMs may **explain** reasoning — may **not** fabricate evidence or confidence |
| **RE7** | Confidence must be **traceable** to upstream IDs and weights |
| **RE8** | Every inference produces an **audit trail** — append-only |
| **RE9** | Every inference must be **reproducible** from stored inputs + rule version |
| **RE10** | Contradictions must be **visible** — silent resolution forbidden |
| **RE11** | Mission Control is a **projection** — reasoning writes engine truth, not UI |
| **RE12** | Capability Matching is **deterministic first** — embeddings optional, never sole path |
| **RE13** | No reasoning module calls **external APIs** during inference (observation is upstream) |
| **RE14** | Learning changes **weights** — not historical evidence |
| **RE15** | Situations remain the **semantic boundary** between knowledge and reasoning unless Constitution is amended |

---

## 12. Examples

Each example walks: **Situation → Hypothesis → Problem → Capability → Opportunity**

---

### Example 1 — Refinery turnaround

**Situation:** "Gulf Coast Refining — Turnaround in Texas City" (category: Turnaround; confidence: 0.81)

**Hypothesis:** "Major turnaround will create temporary safety staffing and industrial cleaning surge Q2–Q3"

**Problem:** `problemType: turnaround_labor_surge` — severity high, urgency high, confidence 0.74

**Capability:** KTM Labor + Industrial Cleaning (registry match)

**Opportunity:** Turnaround support package for Gulf Coast Refining — Score Council ranks on Timing + Execution + Revenue

*Transition notes:* Situation clusters turnaround signals + contractor mentions. Hypothesis Generator maps category Turnaround → labor surge template. Evidence Collector pulls permit filings (T1) and hiring signals (T4). Promoted after contradiction check passes.

---

### Example 2 — Hospital expansion

**Situation:** "Regional Hospital Authority — Expansion in East County" (category: Capital Project)

**Hypothesis:** "120-bed expansion will require fire watch and temporary facilities staffing during construction"

**Problem:** `construction_safety_coverage_gap` — severity high, confidence 0.71

**Capability:** Fire Watch + Temporary Labor

**Opportunity:** Hospital expansion safety and staffing bundle — Confidence engine weighted by T1 permit facts

*Transition notes:* Competing hypothesis "expansion cancelled" rejected when bond approval fact (T1) arrives.

---

### Example 3 — School bond

**Situation:** "Independent School District 12 — Government Funding in Beaumont" (category: Government Funding)

**Hypothesis:** "Approved $180M facilities bond implies multi-year construction services demand"

**Problem:** `facilities_construction_surge` — severity medium, urgency medium, confidence 0.77

**Capability:** Site Services + Project Labor

**Opportunity:** Bond program facilities support — Revenue engine uses budget proxy from bond value fact

---

### Example 4 — Hurricane response

**Situation:** "Coastal County — Emergency in Gulf Region" (category: Emergency)

**Hypothesis:** "Category storm track creates emergency exterior cleaning and temporary power/security needs"

**Problem:** `storm_response_services_gap` — severity critical, urgency critical, confidence 0.68

**Capability:** Emergency Cleaning + Rapid Deployment Labor

**Opportunity:** Storm response package — Timing score dominant; contradiction monitor for downgraded storm track

*Transition notes:* Confidence capped until NWS/government T1 source confirms track — missing evidence documented.

---

### Example 5 — Distribution center

**Situation:** "National Retail Co — Expansion in Dallas metro" (category: Expansion)

**Hypothesis:** "New 1M sqft DC will need launch cleaning, ongoing facility maintenance, and security/fire watch during buildout"

**Problem:** `distribution_center_launch_services` — severity medium, urgency high, confidence 0.72

**Capability:** Pressure Washing + Facility Maintenance + Fire Watch

**Opportunity:** DC launch services bundle — multiple capabilities → offer join

---

### Example 6 — City infrastructure

**Situation:** "City Public Works — Infrastructure in Metro Area" (category: Infrastructure)

**Hypothesis:** "Water main replacement program creates street-level restoration and site safety needs"

**Problem:** `infrastructure_restoration_demand` — severity medium, urgency medium, confidence 0.69

**Capability:** Site Services + Traffic/safety support

**Opportunity:** Municipal infrastructure support — Relationship engine low until buyer contact linked

*Transition notes:* Competing "project delayed" hypothesis remains monitoring until bid award signal (T2).

---

## 13. Phase Roadmap

### Phase 2.6 — Problem Inference

**Implement:**

| Deliverable | Scope |
|---|---|
| `engine/reasoning/hypothesis` | Hypothesis Generator from Situations — rules only |
| `engine/reasoning/evidence` | Evidence Collector + Evaluator (by reference) |
| `engine/reasoning/confidence` | Confidence propagation with provenance |
| `engine/reasoning/contradiction` | Contradiction Detector |
| `engine/problems` | Problem Inference — **Situations only** |
| `runtime/problems/` | Append-only problem store |
| Explainability bundle | Required on every Problem |
| Validation | No capabilities, offers, opportunities, LLM |

**Do not implement:** Capability Matching, Opportunity Factory, Score Council changes

---

### Phase 2.7 — Capability Matching

**Implement:**

| Deliverable | Scope |
|---|---|
| `engine/capability-matcher` | Deterministic Problem → Capability fit |
| Match reasons[] | Explainable fit scores |
| Registry integration | `engine/capabilities` + taxonomy |
| Problem → capability edges | Graph projection optional |
| Validation | No opportunities yet |

**Do not implement:** Offer selection, Opportunity Factory

---

### Phase 2.8 — Opportunity Factory

**Implement:**

| Deliverable | Scope |
|---|---|
| `engine/opportunity-factory` | Problem + capability match + offer → Opportunity |
| Buyer targeting | Entity/contact linkage from graph |
| Score Council integration | Full score vector on new opportunities |
| `runtime/opportunities/` or schema convergence | Per data model decision |
| Mission Control projection | Read new opportunities + explainability |
| Validation | End-to-end Situation → Opportunity path |

**Do not implement:** Learning calibration, Forecast engine (later phases)

---

## Amendment

Changes to reasoning rules require [Build Log](./09-build-log.md) entry and owner approval. RE1–RE15 are Constitution-tier unless explicitly amended.

**Architecture freeze (Phase 2.7+):** Do not amend this document for redesign. Amend only on **genuine deficiency** proven during implementation — see [R26–R30](./07-architecture-rules.md#architecture-freeze-owner-policy--phase-27).

**Phase 2.5.8:** Design complete. No code until Phase 2.6 prompt.

**Phase 2.6:** **COMPLETE** — Problem Inference implemented. Modules: `hypotheses/`, `hypothesis-generator/`, `evidence-engine/`, `confidence-engine/`, `contradictions/`, `problems/`, `problem-inference/`. Validation: `scripts/opportunity-engine/validate-phase-2-6.js`. Capability Matching remains **blocked** until Phase 2.7.
