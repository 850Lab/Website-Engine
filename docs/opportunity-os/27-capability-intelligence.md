# 27 — Capability Intelligence

**Status:** Phase 2.6.5 · Constitution amendment (design only)  
**Related:** [Capability Registry](./05-capability-registry.md) · [Reasoning Engine](./26-reasoning-engine.md) · [Ontology](./02-ontology.md) · [Decision Engine](./06-decision-engine.md) · [Architecture Rules](./07-architecture-rules.md) · [World Model](./23-world-model.md)

---

## Purpose

This document defines the **permanent Capability Intelligence layer** for Opportunity OS — everything that happens **after Problems** and **before Offers**.

The Problem Inference pipeline (Phase 2.6) answers:

> *What expensive need is emerging, and what evidence supports it?*

The Capability Intelligence pipeline (Phases 2.7+) answers:

> *What can we deliver, who can deliver it, and how well does each capability fit this problem?*

**Rule:** Capability Intelligence **extends** [05-capability-registry.md](./05-capability-registry.md). It does not replace registry entries, offer definitions, or the Reasoning Engine boundary rules in [26-reasoning-engine.md](./26-reasoning-engine.md).

**Design-only phase:** No production code, runtime folders, validators, engine modules, APIs, or UI changes in Phase 2.6.5.

---

## Pipeline Position

```
Reality
  ↓
Signals → Facts → Graph → Situations
  ↓
Hypotheses → Evidence → Confidence → Contradictions
  ↓
Problems
  ↓
Capability Intelligence   ← THIS DOCUMENT
  ↓
STOP (Offer Intelligence begins in Phase 2.8)
```

---

## 1. What Is a Capability?

A **Capability** is a **repeatable delivery competence** — the ability to solve a class of business problems through a defined process, with known requirements, constraints, and performance history.

### Independent definition

A Capability is defined **without reference to**:

| Concept | Why excluded |
|---|---|
| **Offer** | Offers are commercial packaging; one capability may appear in many offers |
| **Business / Company** | Capabilities exist in the registry before any buyer or seller is identified |
| **Person** | People execute capabilities; they are not the capability itself |
| **Product** | Products may enable delivery but do not define the competence |
| **Service** | "Service" is a delivery mode; Capability is the underlying solve pattern |

### What a Capability IS

| Property | Description |
|---|---|
| **Competence pattern** | Named ability to address problem categories (e.g., hot-work safety coverage, exterior cleaning, skilled industrial labor) |
| **Requirement profile** | Certifications, equipment, skills, geography, and regulatory constraints needed to execute |
| **Performance record** | Historical outcomes, capacity, and maturity — updated by learning, never invented |
| **Registry object** | Stable ID, taxonomy placement, parent/child relationships |

### Why one Capability supports many Offers

An **Offer** is a **commercial wrapper**: pricing, contract terms, buyer persona, campaign angle, and bundled deliverables. Multiple offers may reference the same capability because:

1. **Same competence, different markets** — `cap_exterior_cleaning` may appear in `offer_pressure_washing` (restaurants) and a future `offer_facility_appearance` (healthcare campuses).
2. **Same competence, different packaging** — Fire Watch as standalone vs. bundled with KTM Labor turnaround packages.
3. **Same competence, different channels** — Website Growth as project vs. retainer vs. white-label partner program.

**Constitution rule:** Opportunities match **Problems → Capabilities first**, **Offers second**. Never invert this order.

See [05-capability-registry.md § Capability ↔ Offer Rules](./05-capability-registry.md#capability--offer-rules).

---

## 2. Capability Taxonomy

Capabilities are classified by **canonical category** — a stable vocabulary for matching, reporting, and expansion. Categories describe **what kind of work** the capability performs, not **who buys it**.

### Canonical categories (v1)

| Category ID | Label | Scope |
|---|---|---|
| `cat_construction` | Construction | Building, civil, structural trades |
| `cat_industrial_maintenance` | Industrial Maintenance | Plant reliability, turnaround support, asset upkeep |
| `cat_safety` | Safety | Fire watch, hole watch, HSE staffing, compliance coverage |
| `cat_inspection` | Inspection | Quality, regulatory, asset condition assessments |
| `cat_cleaning` | Cleaning | Exterior, interior, industrial, specialty cleaning |
| `cat_digital` | Digital | Web, software, content, online presence |
| `cat_marketing` | Marketing | Lead gen, campaigns, brand, demand creation |
| `cat_automation` | Automation | Workflow, integration, AI-assisted operations |
| `cat_manufacturing` | Manufacturing | Production, fabrication, OEM support |
| `cat_transportation` | Transportation | Fleet, logistics movement, site mobility |
| `cat_healthcare` | Healthcare | Clinical-adjacent facility and support services |
| `cat_government` | Government | Public-sector compliant delivery patterns |
| `cat_energy` | Energy | Oil & gas, power, renewables site services |
| `cat_professional_services` | Professional Services | Consulting, advisory, managed professional work |
| `cat_it` | IT | Infrastructure, support, enterprise systems |
| `cat_ai` | AI | Model-assisted analysis, agents, intelligent automation |
| `cat_education` | Education | Training, certification programs, workforce development |
| `cat_finance` | Finance | Financial operations, compliance-adjacent services |
| `cat_logistics` | Logistics | Warehousing, staging, material coordination |
| `cat_security` | Security | Physical and operational security services |
| `cat_labor` | Labor & Staffing | Skilled and general workforce deployment |

### Taxonomy rules

1. Every capability has **exactly one primary category** (`category`).
2. Capabilities may have **secondary tags** in `metadata.tags[]` for cross-cutting themes (e.g., `turnaround`, `emergency`, `recurring`).
3. **Parent/child hierarchy** (`parentCapability`, `childCapabilities`) may cross categories — e.g., `cap_industrial_turnaround` (composite) → `cap_fire_watch` (Safety).
4. **Future expansion:** New categories require Constitution amendment, registry entry, and [Build Log](./09-build-log.md) record. Subcategories use `metadata.subcategory` until promoted to top-level.

### Mapping existing registry capabilities

| Registry ID | Primary category |
|---|---|
| `cap_website_growth` | Digital |
| `cap_exterior_cleaning` | Cleaning |
| `cap_ktm_labor` | Labor & Staffing |
| `cap_fire_watch` | Safety |
| `cap_hole_watch` | Safety |
| `cap_safety_support` | Safety |
| `cap_maintenance` | Industrial Maintenance |
| `cap_lead_generation` | Marketing |
| `cap_ai_automation` | Automation |

---

## 3. Capability Object

The canonical schema **extends** the registry format in [05-capability-registry.md](./05-capability-registry.md). Existing fields (`problemsSolved`, `kpisImproved`, `typicalBuyers`, etc.) are retained. New fields support matching, constraints, and explainability.

### Canonical schema

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | string | ✓ | Stable slug (`cap_fire_watch`) |
| `name` | string | ✓ | Human-readable name |
| `description` | string | ✓ | What this capability delivers and does not deliver |
| `category` | string | ✓ | Primary taxonomy category ID |
| `parentCapability` | string \| null | | Parent capability ID for hierarchy (null = root) |
| `childCapabilities` | string[] | | Direct child capability IDs |
| `problemsSolved` | string[] | ✓ | Problem category slugs this capability addresses (from registry) |
| `kpisImproved` | string[] | | Measurable outcomes (registry) |
| `typicalBuyers` | string[] | | Entity types — directional, not exhaustive |
| `decisionMakers` | string[] | | Roles (registry) |
| `requiredCertifications` | CertificationRequirement[] | | Certs/licenses needed to execute |
| `requiredEquipment` | EquipmentRequirement[] | | Tools, vehicles, PPE, specialty gear |
| `requiredSkills` | SkillRequirement[] | | Trade skills, experience levels |
| `geographicConstraints` | GeographicConstraint | | Where capability can be delivered |
| `industryConstraints` | IndustryConstraint | | Industries served or excluded |
| `regulatoryConstraints` | RegulatoryConstraint[] | | OSHA, EPA, state/local rules |
| `maturity` | enum | ✓ | `experimental` \| `proven` \| `scaled` \| `legacy` |
| `scalability` | ScalabilityProfile | | How capacity expands under demand |
| `estimatedCapacity` | CapacityProfile | | Current deployable capacity (units TBD per capability) |
| `historicalPerformance` | PerformanceRecord | | Win rate, SLA adherence, incident rate — from outcomes |
| `associatedOffers` | string[] | | Offer IDs referencing this capability (read-only join) |
| `supportingProblems` | string[] | | Problem IDs matched in runtime (append-only audit) |
| `metadata` | object | | Tags, subcategory, owner, version, amendment history |

### Nested type definitions

```typescript
// Design reference only — not production code

interface CertificationRequirement {
  id: string;           // e.g., "osha_30", "fire_watch_cert"
  label: string;
  mandatory: boolean;
  renewalDays?: number;
}

interface EquipmentRequirement {
  id: string;           // e.g., "aerial_lift", "soft_wash_rig"
  label: string;
  quantityMin?: number;
  alternativeIds?: string[];
}

interface SkillRequirement {
  id: string;           // e.g., "pipefitter_journeyman"
  label: string;
  minExperienceYears?: number;
  tradeCode?: string;
}

interface GeographicConstraint {
  servedRegions: string[];      // ISO region, state, metro, or custom zone IDs
  excludedRegions?: string[];
  travelRadiusMiles?: number;
  remoteEligible?: boolean;     // Digital / AI capabilities
}

interface IndustryConstraint {
  servedIndustries: string[];
  excludedIndustries?: string[];
  requiresPriorSiteExperience?: boolean;
}

interface RegulatoryConstraint {
  id: string;
  jurisdiction: string;         // e.g., "US-TX", "EPA", "OSHA-1926"
  summary: string;
  blocksExecutionIfUnmet: boolean;
}

interface ScalabilityProfile {
  model: "fixed_crew" | "elastic_pool" | "partner_network" | "digital_unlimited";
  surgeMultiplier?: number;       // Max capacity vs baseline
  leadTimeDays?: number;        // Time to scale up
}

interface CapacityProfile {
  unit: string;                   // e.g., "watchers", "crews", "projects", "hours_per_week"
  available: number;
  committed: number;
  asOf: string;                   // ISO timestamp
  confidence: number;             // 0–1 — how current the estimate is
}

interface PerformanceRecord {
  engagementsTotal: number;
  winRate?: number;
  onTimeRate?: number;
  incidentRate?: number;
  avgFitScoreAchieved?: number;
  lastUpdated: string;
  source: "manual" | "outcome_learning" | "import";
}
```

### Storage

| Store | Path | Owner |
|---|---|---|
| **Canonical registry** | `engine-data/capabilities/capabilities.json` | Capability registry (Phase 1 convergence) |
| **Runtime match audit** | `runtime/capability-matches/` *(Phase 2.7)* | Capability Matching Engine |
| **Graph projection** | `runtime/graph/` *(optional)* | Problem → Capability edges |

Registry fields from [05](./05-capability-registry.md) (`execution process`, `competitive advantages`, `future expansion`) map to `metadata.executionProcess`, `metadata.competitiveAdvantages`, `metadata.futureExpansion` during Phase 2.7 schema migration.

---

## 4. Capability Matching Pipeline

The Capability Matching Pipeline transforms a **Problem** into **Recommended Capabilities**. It does not create offers, opportunities, or new problems.

```
Problem
  ↓
Candidate Capabilities
  ↓
Fit Analysis
  ↓
Constraint Filtering
  ↓
Ranking
  ↓
Recommended Capabilities
  ↓
STOP
```

### Stage 1 — Problem (input)

**Input:** A promoted Problem object from Phase 2.6 with:

- `problemCategory` / type
- `situationIds`, `hypothesisIds`, `evidenceRefs`
- `entityContext` (industry, location, scale hints from Situation)
- `urgency`, `confidence`
- `explainability` bundle

**Rule:** Capability Intelligence consumes **Problems only** — never Situations, Hypotheses, or raw Facts directly. Problem fields may **reference** upstream objects; the matcher reads Problem as its sole entry point.

### Stage 2 — Candidate Capabilities

**Purpose:** Narrow the full registry to a workable candidate set.

**Mechanisms (deterministic first):**

1. **Problem category map** — `problemCategory` → `capability.problemsSolved[]` intersection
2. **Pre-match hints** — `Problem.affectedCapabilityIds` if set during inference
3. **Taxonomy filter** — industry/location from Problem context → category relevance
4. **Composite expansion** — if problem type implies bundle (turnaround), include parent + child capabilities

**Output:** `CandidateCapability[]` with `selectionReason` per candidate.

### Stage 3 — Fit Analysis

**Purpose:** Score how well each candidate addresses this specific Problem instance.

**Inputs per candidate:**

- Problem type, industry, location, scale, timing
- Capability requirements vs. available evidence
- Historical performance for similar problem profiles
- Problem confidence and urgency

**Output:** `FitAnalysis` with dimensional sub-scores and evidence refs (see §5).

### Stage 4 — Constraint Filtering

**Purpose:** Remove or penalize candidates that **cannot** execute under current constraints.

**Mechanisms:**

- Hard filter: unmet mandatory certification, geography, regulatory block
- Soft penalty: capacity shortfall, weather window, budget mismatch

**Output:** `ConstraintResult[]` — visible pass/fail/penalty per constraint type (see §6).

Candidates failing all mandatory constraints are **rejected**, not silently dropped.

### Stage 5 — Ranking

**Purpose:** Order surviving candidates by composite **fit score** with tie-breakers.

**Tie-breakers (in order):**

1. Higher fit score
2. Higher historical win rate for this problem profile
3. Higher maturity (`scaled` > `proven` > `experimental`)
4. Lower execution risk
5. Stable sort by `capability.id`

### Stage 6 — Recommended Capabilities (output)

**Output object:** `CapabilityRecommendation`

| Field | Description |
|---|---|
| `problemId` | Source problem |
| `recommendedCapabilities` | Ordered list with fit scores |
| `rejectedCapabilities` | Candidates filtered out with reasons |
| `compositionPlan` | Optional multi-capability bundle (see §7) |
| `explainability` | Full audit bundle (see §9) |
| `generatedAt` | ISO timestamp |
| `matcherVersion` | Reproducibility hash |

**STOP:** No Offer selection, no Opportunity creation, no Score Council invocation in Phase 2.7.

---

## 5. Fit Score

The **fit score** (0.0–1.0) measures **delivery alignment**: how well a capability can solve **this Problem** under **current constraints**.

Fit score is **not** opportunity score. They answer different questions.

| Score | Question | When computed |
|---|---|---|
| **Fit score** | Can we deliver the right solution well? | Capability Matching (Phase 2.7) |
| **Opportunity score** | Is this worth pursuing commercially? | Score Council (Phase 2.9+) |

### Fit score dimensions

| Dimension | Weight (default) | Considers |
|---|---|---|
| **Problem type alignment** | 0.20 | `problemsSolved` overlap, problem category specificity |
| **Industry fit** | 0.10 | `industryConstraints` vs Problem entity industry |
| **Location fit** | 0.15 | `geographicConstraints` vs Problem location |
| **Scale fit** | 0.10 | Crew size, project magnitude, capacity unit |
| **Timing fit** | 0.10 | Lead time, urgency, availability window |
| **Equipment match** | 0.05 | Required equipment available or obtainable |
| **Certification match** | 0.10 | Required certs held or certifiable in window |
| **Historical success** | 0.10 | Win rate / SLA for similar problems (bounded influence) |
| **Capacity** | 0.05 | `estimatedCapacity` vs Problem scale |
| **Risk inverse** | 0.03 | Execution difficulty, incident history |
| **Urgency alignment** | 0.01 | Can mobilize within Problem urgency window |
| **Confidence propagation** | 0.01 | Problem confidence scales fit ceiling — low-confidence problems cap fit |

Weights are **configurable per category** in Phase 2.7+ but must remain **documented and auditable**.

### Fit score formula (design)

```
fitScore = Σ (dimensionScore × weight) × problemConfidenceCap
```

Where each `dimensionScore` ∈ [0, 1] and constraint hard-fails set dimension to 0.

### Why fit score ≠ opportunity score

| Aspect | Fit score | Opportunity score |
|---|---|---|
| **Purpose** | Delivery correctness | Commercial pursuit decision |
| **Includes margin?** | No | Yes (margin, strategic priority) |
| **Includes buyer intent?** | No | Yes (relationship, timing to buy) |
| **Includes competition?** | Partial (differentiation evidence) | Yes (win probability vs alternatives) |
| **Includes CEO mode weighting?** | No | Yes (Score Council modes) |
| **Overrides evidence?** | Never | Never — but adds commercial dimensions |

A capability may **fit perfectly** (fit 0.92) while the **opportunity score is low** (buyer has no budget, wrong strategic mission). Conversely, a high-opportunity lead may **fit poorly** (wrong geography, missing certs) — Capability Intelligence must surface that before Offer Intelligence proceeds.

---

## 6. Constraints

Constraints are **explicit execution boundaries**. They reduce fit score or eliminate candidates. Every constraint evaluation must appear in explainability.

### Constraint types

| Type | ID | Description | Effect |
|---|---|---|---|
| **Geography** | `geo` | Region, travel radius, site access | Hard fail if outside `servedRegions` |
| **Licensing** | `license` | Trade licenses, business licenses | Hard fail if mandatory license unmet |
| **Equipment** | `equipment` | Specialty gear, fleet, tools | Hard fail or penalty if unavailable |
| **Crew size** | `crew_size` | Min/max headcount for problem scale | Penalty if under-scaled; fail if below minimum |
| **Budget** | `budget` | Problem budget hints vs typical contract size | Penalty — never hard fail unless explicit ceiling |
| **Regulatory** | `regulatory` | OSHA, EPA, state permits | Hard fail if `blocksExecutionIfUnmet` |
| **Availability** | `availability` | Calendar, capacity, lead time | Penalty or fail based on urgency |
| **Weather** | `weather` | Outdoor work windows, seasonality | Penalty for cleaning, construction, exterior |
| **Insurance** | `insurance` | COI limits, additional insured requirements | Hard fail for industrial/government sites |
| **Union requirements** | `union` | Union shop, prevailing wage | Hard fail if capability not union-compliant |
| **Safety** | `safety` | Site safety level, hot work, confined space | Hard fail if safety capability missing |

### How constraints reduce fit

```
For each candidate capability:
  1. Evaluate all applicable constraint types
  2. Hard fail → candidate moves to rejectedCapabilities[] with constraint ID + evidence
  3. Soft penalty → dimensionScore × penaltyFactor (e.g., 0.7)
  4. Aggregate into constraintSummary on recommendation
```

**Rule:** Constraints must be **visible** in Mission Control. Hidden constraint filtering is forbidden (CI6).

### Constraint evidence sources

| Source | Examples |
|---|---|
| Problem object | Location, industry, scale, urgency |
| Situation chain (via Problem refs) | Permit type, facility class |
| Capability registry | `geographicConstraints`, `requiredCertifications` |
| Runtime capacity | `estimatedCapacity.asOf` |
| External feeds (future) | Weather API, license registry — sensor-derived only |

---

## 7. Multi-Capability Composition

Complex Problems rarely map to a single capability. **Composition** defines how multiple capabilities combine into a coherent delivery plan without merging them into one registry entry.

### Composition model

```
Problem: Industrial Turnaround
  ↓
Composite capability (logical): cap_industrial_turnaround
  ↓
Required child capabilities:
  ├── cap_scaffolding          (Construction)
  ├── cap_fire_watch           (Safety)
  ├── cap_hole_watch           (Safety)
  ├── cap_mechanical_trades    (Industrial Maintenance)
  ├── cap_electrical_trades    (Industrial Maintenance)
  ├── cap_safety_support       (Safety)
  ├── cap_logistics_staging    (Logistics)
  └── cap_project_management   (Professional Services)
```

### Composition rules

| Rule | Description |
|---|---|
| **One Problem, many Capabilities** | A single Problem may recommend 1–N capabilities |
| **Parent is organizational** | Parent capabilities (`cap_industrial_turnaround`) group children; they are not substitutes |
| **Each child scored independently** | Fit score computed per child, then roll up |
| **Weakest-link visibility** | Composition fit = min(mandatory child fits) × average(optional child fits) |
| **No synthetic capabilities** | Composition plans reference **existing registry IDs** only |
| **Offer bundles come later** | Offer Intelligence (Phase 2.8) packages capabilities into commercial offers |

### Composition output

```typescript
interface CompositionPlan {
  compositionId: string;
  parentCapabilityId?: string;
  requiredCapabilities: ComposedCapabilityRef[];  // mandatory
  optionalCapabilities: ComposedCapabilityRef[];
  criticalPath: string[];                       // capability IDs on gating path
  estimatedMobilizationDays: number;
}

interface ComposedCapabilityRef {
  capabilityId: string;
  role: string;           // e.g., "safety_gate", "primary_delivery", "support"
  fitScore: number;
  constraintSummary: ConstraintResult[];
}
```

---

## 8. Competitive Differentiation

When multiple capabilities (or capability providers) could address the same Problem, Opportunity OS must explain **why one is stronger** — without black-box rankings.

### Comparison framework

For each pair or set of candidates, produce a **Differentiation Record**:

| Question | Required answer |
|---|---|
| Why is Capability A stronger? | Specific dimension advantages with evidence refs |
| What evidence supports that? | Historical performance, cert roster, turnaround count, SLA data |
| When is Capability B preferable? | Explicit conditions (geography, scale, urgency, budget) |
| What is unknown? | Gaps flagged — never filled with invented data |

### Differentiation dimensions

| Dimension | Example evidence |
|---|---|
| **Experience depth** | 47 turnaround engagements vs 3 |
| **Certification coverage** | 100% certified roster vs partial |
| **Mobilization speed** | 24h deploy vs 5-day lead |
| **Safety record** | 0 recordables vs industry baseline |
| **Regional density** | Crews within 50 miles vs fly-in |
| **Bundle coherence** | Integrated fire + hole + labor vs single-service vendor |

### Anti-black-box rules

1. Every ranking position must cite **≥1 explicit reason** from fit dimensions or constraints.
2. **No ML-only scores** — learned weights may adjust dimension weights but must remain inspectable (see §11).
3. **Tie transparency** — when scores are within epsilon (0.02), report as tied with shared reasons.
4. **Provider neutrality** — comparing internal vs partner capabilities uses **same dimensions** (see §10).

---

## 9. Capability Explainability

Every capability recommendation must answer the Mission Control display questions:

| Question | Explainability field |
|---|---|
| **Why selected?** | `selectionReasons[]` — dimension scores + top factors |
| **Which Problem?** | `problemId`, `problemSummary` |
| **Which Situation?** | `situationIds[]` via Problem chain |
| **Which evidence?** | `evidenceRefs[]` — facts, signals, graph nodes by reference |
| **Which constraints?** | `constraintResults[]` — pass/fail/penalty per type |
| **Which capabilities were rejected?** | `rejectedCapabilities[]` |
| **Why rejected?** | `rejectionReason` per rejected candidate |

### Explainability bundle schema

```typescript
interface CapabilityExplainability {
  problemId: string;
  situationIds: string[];
  hypothesisIds: string[];
  matcherVersion: string;
  inputHash: string;              // Reproducibility
  selected: ExplainedCapability[];
  rejected: RejectedCapability[];
  compositionPlan?: CompositionPlan;
  constraintSummary: ConstraintSummary;
  generatedAt: string;
}

interface ExplainedCapability {
  capabilityId: string;
  rank: number;
  fitScore: number;
  dimensionBreakdown: Record<string, number>;
  selectionReasons: string[];
  evidenceRefs: string[];
  constraintResults: ConstraintResult[];
}

interface RejectedCapability {
  capabilityId: string;
  fitScore?: number;
  rejectionReason: string;
  failedConstraints: string[];
  dimensionBreakdown?: Record<string, number>;
}
```

### Mission Control display requirements

Mission Control (future Phase 2.9 projection) must render:

1. **Problem header** — title, confidence, urgency
2. **Recommended capabilities** — ranked list with fit scores
3. **Dimension breakdown** — bar or table per selected capability
4. **Constraint panel** — pass/fail/penalty with icons
5. **Rejected list** — expandable with reasons
6. **Composition graph** — for multi-capability problems
7. **Reproducibility footer** — `matcherVersion`, `inputHash`

**Rule:** If explainability cannot be built, the recommendation must not be emitted (CI5).

---

## 10. Future Partner Ecosystem

Capability **ownership** may vary. Opportunity OS remains **vendor-neutral** — it matches Problems to capabilities, not Problems to preferred vendors.

### Capability owner types

| Owner type | Description | Registry representation |
|---|---|---|
| **Internal company** | Owned and executed by operator org | `metadata.ownerType: "internal"` |
| **Partner company** | Contracted partner delivers | `metadata.ownerType: "partner"`, `metadata.partnerId` |
| **Marketplace** | Third-party marketplace listing | `metadata.ownerType: "marketplace"`, `metadata.listingId` |
| **Independent contractor** | Individual or small crew network | `metadata.ownerType: "contractor"`, `metadata.networkId` |
| **Future acquisition** | Target company capability pipeline | `metadata.ownerType: "pipeline"`, `metadata.targetId` |

### Vendor neutrality rules

1. **Capability ID is vendor-agnostic** — `cap_fire_watch` is the competence; owner is metadata.
2. **Same fit dimensions for all owners** — partner capabilities scored identically to internal.
3. **No default vendor boost** — strategic preference requires explicit `metadata.strategicWeight` with audit trail and CEO-mode override in Score Council (not in fit score).
4. **Partner data is sensor-derived or attested** — cert rosters, capacity claims require provenance.
5. **Offer Intelligence selects packaging** — Phase 2.8 may prefer internal offers when fit is tied; must document reason.

### Future marketplace flow (design only)

```
Partner registers capability profile
  ↓
Attestation + sensor verification (certs, insurance)
  ↓
Registry or federated catalog entry
  ↓
Capability Matching treats as candidate
  ↓
Offer Intelligence may create partner-branded offer
  ↓
Opportunity Factory creates pursuit record
```

No marketplace implementation in Phases 2.7–2.9 — architecture reservation only.

---

## 11. Learning

Execution **Outcomes** (post-Opportunity, post-delivery) feed back into Capability Intelligence calibration. This section describes **architecture only** — no ML algorithms.

### Calibrated fields

| Field | Learning input | Effect |
|---|---|---|
| **Fit dimension weights** | Win/loss vs predicted fit | Adjust category-specific weights within bounds |
| **Timing** | Actual mobilization vs estimated | Refine `leadTimeDays`, urgency alignment |
| **Constraints** | Which constraints predicted failure correctly | Promote/demote hard vs soft classification |
| **Capacity** | Actual crew deployment vs estimate | Update `estimatedCapacity` |
| **Historical success** | Engagement outcomes | Update `historicalPerformance` |

### Learning boundaries

| Allowed | Forbidden |
|---|---|
| Propose weight adjustments via Learning agent | Auto-apply without audit |
| Update `historicalPerformance` from outcomes | Fabricate performance data |
| Flag miscalibrated constraints | Override mandatory constraint hard-fails |
| Decay stale capacity data | Let historical success override current evidence |

### Feedback loop (architecture)

```
Outcome recorded
  ↓
Learning agent proposes calibration delta
  ↓
Human or policy approval (Phase 5+)
  ↓
Capability registry metadata update
  ↓
Next match uses updated profile
  ↓
Explainability cites profile version
```

**Rule:** Historical performance **influences** fit but **never overrides** current evidence or mandatory constraints (CI7, CI8).

---

## 12. Permanent Rules

These rules are **Constitution-tier** alongside RE1–RE15 in [26-reasoning-engine.md](./26-reasoning-engine.md). Amendments require [Build Log](./09-build-log.md) entry and owner approval.

| ID | Rule |
|---|---|
| **CI1** | Capabilities consume **Problems only** — never Situations, Hypotheses, Facts, or Signals directly |
| **CI2** | Offers consume **Capabilities** (via matching output) — never Problems directly |
| **CI3** | Capability matching **never invents Problems** |
| **CI4** | Capability matching **never invents Capabilities** — registry IDs only |
| **CI5** | Capability fit must be **explainable** — no recommendation without explainability bundle |
| **CI6** | Constraints must be **visible** — no silent filtering |
| **CI7** | Historical performance **influences** fit but **never overrides** current evidence |
| **CI8** | Mandatory constraint failures **cannot** be overridden by historical success |
| **CI9** | Capability recommendations must be **reproducible** — same Problem + registry version + matcher version → same output |
| **CI10** | Capability Matching is **deterministic first** — embeddings optional, never sole path (extends RE12) |
| **CI11** | Fit score and opportunity score are **separate** — Score Council does not compute fit |
| **CI12** | Multi-capability composition references **existing registry entries** — no synthetic merge |
| **CI13** | Partner and internal capabilities use **identical fit dimensions** |
| **CI14** | Phase 2.7 **STOP** before Offer Intelligence — no offer selection in matcher |
| **CI15** | Registry amendments require **owner sign-off** per [05-capability-registry.md § Amendment](./05-capability-registry.md#amendment) |

---

## 13. Examples

Each example walks: **Problem → Candidates → Constraints → Fit → Recommendation**.

---

### Example 1 — Refinery Turnaround

**Problem:** `prob_turnaround_staffing_gap` — Major refinery turnaround in Beaumont, TX requires surge skilled labor and safety coverage; schedule slip risk high. Confidence 0.81. Urgency: high.

**Candidate Capabilities:**

| ID | Selection reason |
|---|---|
| `cap_ktm_labor` | `labor_shortage`, `surge_staffing` |
| `cap_fire_watch` | Hot work during turnaround |
| `cap_hole_watch` | Confined space openings |
| `cap_safety_support` | General HSE coverage |
| `cap_exterior_cleaning` | Rejected at candidate stage — wrong problem category |

**Constraints:**

| Capability | Constraint | Result |
|---|---|---|
| `cap_ktm_labor` | geo: Beaumont in served region | Pass |
| `cap_ktm_labor` | crew_size: 200+ workers needed | Penalty — surge lead time 3 days |
| `cap_fire_watch` | license: fire watch cert roster | Pass |
| `cap_hole_watch` | safety: confined space | Pass |

**Fit scores:** KTM Labor 0.87, Fire Watch 0.91, Hole Watch 0.89, Safety Support 0.78

**Recommendation:** Composition plan — Fire Watch + Hole Watch + KTM Labor (primary) + Safety Support (optional). Critical path: Fire Watch → Hole Watch → Labor mobilization.

---

### Example 2 — Hospital Expansion

**Problem:** `prob_facility_expansion_cleaning` — New wing opening; deferred opening cleaning and floor maintenance backlog. Confidence 0.72. Location: Houston, TX.

**Candidates:** `cap_maintenance`, `cap_exterior_cleaning`, `cap_ktm_labor` (limited — no primary problem match)

**Constraints:**

| Capability | Constraint | Result |
|---|---|---|
| `cap_maintenance` | regulatory: healthcare facility protocols | Pass — healthcare experience flagged |
| `cap_exterior_cleaning` | geo | Pass |
| `cap_ktm_labor` | problem type | Soft — not primary; excluded in ranking |

**Fit:** Maintenance 0.84, Exterior Cleaning 0.71

**Recommendation:** `cap_maintenance` primary; `cap_exterior_cleaning` secondary for entrance/loading dock. Rejected: `cap_ktm_labor` — problem type mismatch.

---

### Example 3 — Roof Replacement

**Problem:** `prob_commercial_roof_failure` — Active leak; insurance claim filed; 45,000 sq ft commercial roof. Confidence 0.68. Urgency: critical.

**Candidates:** `cap_construction_roofing` *(future registry)*, `cap_scaffolding` *(future)*, `cap_safety_support`

**Constraints:**

| Capability | Constraint | Result |
|---|---|---|
| Roofing | weather: 48h dry window needed | Penalty |
| Roofing | insurance: COI $2M | Pass |
| Scaffolding | equipment | Pass |

**Fit:** Roofing 0.79, Scaffolding 0.85, Safety 0.72

**Recommendation:** Composition — Scaffolding + Roofing (primary) + Safety Support. Weather penalty documented in explainability.

---

### Example 4 — City Sidewalk Replacement

**Problem:** `prob_municipal_sidewalk_program` — City RFP for 12-block sidewalk replacement; prevailing wage; union shop required. Confidence 0.90.

**Candidates:** `cap_construction_civil` *(future)*, `cap_traffic_control` *(future)*, `cap_exterior_cleaning`

**Constraints:**

| Capability | Constraint | Result |
|---|---|---|
| Civil | union: prevailing wage | Hard fail — not union-certified |
| Civil (partner alt) | union | Pass — partner capability variant |
| Exterior cleaning | problem type | Rejected |

**Fit:** Partner civil capability 0.88, Traffic control 0.82

**Recommendation:** Partner-owned civil construction + traffic control. Internal `cap_exterior_cleaning` rejected — wrong problem category. Union constraint drives partner preference — documented in differentiation record.

---

### Example 5 — Restaurant Cleaning

**Problem:** `prob_restaurant_grease_accumulation` — Health inspection follow-up; hood, pad, and entrance pressure wash required within 7 days. Confidence 0.85. Urgency: high.

**Candidates:** `cap_exterior_cleaning`, `cap_maintenance`, `cap_lead_generation`

**Constraints:**

| Capability | Constraint | Result |
|---|---|---|
| Exterior cleaning | availability: 7-day window | Pass |
| Exterior cleaning | geo: route density | Pass — crew in market |
| Lead generation | problem type | Rejected at candidate stage |

**Fit:** Exterior Cleaning 0.93

**Recommendation:** Single capability — `cap_exterior_cleaning`. Rank 1. Rejected: `cap_maintenance` (over-scoped), `cap_lead_generation` (meta-capability, wrong problem).

---

### Example 6 — Enterprise Website Rebuild

**Problem:** `prob_enterprise_web_credibility` — Legacy site; mobile failure; lost inbound leads; rebrand launch in 90 days. Confidence 0.77. Remote eligible.

**Candidates:** `cap_website_growth`, `cap_ai_automation`, `cap_lead_generation`

**Constraints:**

| Capability | Constraint | Result |
|---|---|---|
| Website growth | geo: remote eligible | Pass |
| Website growth | timing: 90-day launch | Pass |
| AI automation | scale: enterprise CMS integration | Penalty — needs partner |
| Lead generation | problem type | Secondary only |

**Fit:** Website Growth 0.89, AI Automation 0.62, Lead Generation 0.45

**Recommendation:** Primary — `cap_website_growth`. Optional follow-on — `cap_lead_generation` after launch. `cap_ai_automation` rejected as primary — penalty on enterprise integration; suggested as Phase 2 upsell in composition notes.

---

## 14. Phase Roadmap

### Phase 2.7 — Capability Matching Engine

**Status:** BLOCKED until owner approves explicit implementation prompt.

**Build:**

| Deliverable | Scope |
|---|---|
| `src/engine/capability-matcher/` | `matchCapabilities(problem)` — full pipeline §4 |
| `src/engine/capabilities/` | Extend registry reader; schema migration for §3 fields |
| `engine-data/capabilities/` | Enriched capability JSON aligned to canonical schema |
| `runtime/capability-matches/` | Append-only recommendation audit store |
| Fit score engine | Dimensional scoring per §5 — deterministic |
| Constraint evaluator | All types §6 — hard/soft classification |
| Composition planner | Multi-capability bundles §7 |
| Explainability builder | Full bundle §9 on every recommendation |
| `scripts/opportunity-engine/validate-phase-2-7.js` | Contract tests; no offers/opportunities |
| Constitution updates | Mark 2.7 complete in `08`, `09`, `15` |

**Do not build:** Offer selection, Opportunity Factory, Score Council changes, Mission Control UI, LLM matching.

**STOP:** Recommended Capabilities → halt.

---

### Phase 2.8 — Offer Intelligence

**Status:** BLOCKED until Phase 2.7 complete.

**Build:**

| Deliverable | Scope |
|---|---|
| `src/engine/offer-intelligence/` | Map capability recommendations → offer candidates |
| Offer-capability join | Enforce ≥1 capability per offer; multi-offer per capability |
| Commercial fit | Pricing band, contract shape, buyer persona alignment |
| Bundle optimizer | Turn composition plans into offer bundles |
| Differentiation vs alternatives | Internal offer vs partner offer comparison |
| Explainability extension | Why this offer packages these capabilities |
| Validation | Problem → Capability → Offer candidate path; no opportunities |

**Do not build:** Opportunity Factory, Score Council, learning calibration.

**STOP:** Offer candidates → halt.

---

### Phase 2.9 — Opportunity Factory

**Status:** BLOCKED until Phase 2.8 complete.

**Build:**

| Deliverable | Scope |
|---|---|
| `src/engine/opportunity-factory/` | Problem + capability match + offer → Opportunity |
| Buyer targeting | Entity/contact linkage from graph |
| Score Council integration | Full opportunity score vector (distinct from fit) |
| `runtime/opportunities/` or schema convergence | Per [14-data-model.md](./14-data-model.md) decision |
| Mission Control projection | Read opportunities + capability explainability |
| End-to-end validation | Situation → Opportunity path |
| `scripts/opportunity-engine/validate-phase-2-9.js` | Full reasoning chain regression |

**Do not build:** Learning calibration, Forecast engine (later phases).

---

## Cross-References

| Document | Relationship |
|---|---|
| [05-capability-registry.md](./05-capability-registry.md) | Source registry entries — extended, not replaced |
| [26-reasoning-engine.md](./26-reasoning-engine.md) | Upstream Problem Inference; downstream Offer/Opportunity |
| [06-decision-engine.md](./06-decision-engine.md) | Score Council owns opportunity score, not fit |
| [07-architecture-rules.md](./07-architecture-rules.md) | Module boundaries and import rules |
| [15-api-boundaries.md](./15-api-boundaries.md) | Ownership matrix for Capability/Offer/Factory modules |

---

## Amendment

Changes to Capability Intelligence rules require [Build Log](./09-build-log.md) entry and owner approval. CI1–CI15 are Constitution-tier unless explicitly amended.

**Architecture freeze (Phase 2.7+):** Do not amend this document for redesign. Amend only on **genuine deficiency** proven during implementation — see [R26–R30](./07-architecture-rules.md#architecture-freeze-owner-policy--phase-27).

**Phase 2.6.5:** Design complete.

**Phase 2.7:** **COMPLETE** — Capability Matching implemented. Validation: `scripts/opportunity-engine/validate-phase-2-7.js`.

**Phase 2.8:** **COMPLETE** — Offer Intelligence implemented. Validation: `scripts/opportunity-engine/validate-phase-2-8.js`.

**Phase 2.9:** **COMPLETE** — Opportunity Factory implemented. Commercial Intelligence pipeline complete. Validation: `scripts/opportunity-engine/validate-phase-2-9.js`. **Score Council remains next consumer.**

**Phase 4.0:** **COMPLETE** — Capability ranking calibration (`capability-matcher/calibration.js`):

| Problem category | Calibration behavior |
|---|---|
| `expansion_contractor_demand` | Boost `ktm_labor`; penalize generic `maintenance_support` and digital/cleaning |
| `turnaround_labor_surge` | Boost `fire_watch`, `hole_watch`, `safety_support`, `ktm_labor` |
| `maintenance_window_demand` | Boost `maintenance_support` |
| Industrial categories | Cap digital/cleaning capabilities at low fit |

Explainability preserved via existing dimension breakdown + selection reasons. Validation: `scripts/opportunity-engine/validate-phase-4-0.js`.

**Phase 4.1:** **BLOCKED** — outreach / autonomous execution until owner approval.
