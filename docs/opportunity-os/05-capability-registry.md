# 05 — Capability Registry

**Status:** Constitution · Canonical capabilities  
**Related:** [Ontology](./02-ontology.md) · [Decision Engine](./06-decision-engine.md) · [Master Vision](./00-master-vision.md) · [Offers in engine-data](../../engine-data/offers/offers.json)

The company thinks in **capabilities**, not industries. Offers package capabilities for commercial conversation.

---

## Registry Format (Each Capability)

| Field | Description |
|---|---|
| **ID** | Stable slug (`cap_website_growth`) |
| **Name** | Human name |
| **Problems solved** | Problem categories addressed |
| **KPIs improved** | Measurable outcomes |
| **Typical buyers** | Entity types (not exhaustive industry list) |
| **Decision makers** | Roles |
| **Typical contract size** | Range (directional) |
| **Execution process** | How delivery works |
| **Competitive advantages** | Why we win |
| **Future expansion** | Planned extensions |

**Storage (target):** `engine-data/capabilities/capabilities.json`  
**Today:** Capabilities implied by [offers.json](../../engine-data/offers/offers.json) — convergence required in Phase 1.

---

## Website Growth

| Field | Value |
|---|---|
| **ID** | `cap_website_growth` |
| **Problems solved** | Low conversion, weak credibility, lost inbound leads, poor mobile presence, no proof of work |
| **KPIs** | Estimate requests, form submissions, calls, conversion rate, time on site |
| **Typical buyers** | Trade contractors, local service businesses, B2C service providers with high search intent |
| **Decision makers** | Owner, GM, office manager, marketing coordinator |
| **Typical contract size** | $3K–$25K project; $500–$2K/mo retainer |
| **Execution process** | Discovery → preview build → review call → launch → optimize |
| **Competitive advantages** | Speed to preview, industry-specific copy, proof-first design |
| **Future expansion** | SEO programs, landing page systems, AI chat capture |
| **Linked offer** | `offer_website_growth` |

---

## Pressure Washing (Exterior Cleaning)

| Field | Value |
|---|---|
| **ID** | `cap_exterior_cleaning` |
| **Problems solved** | Poor first impression, neglected entrances, grease/dirt accumulation, compliance appearance issues |
| **KPIs** | Jobs booked, repeat service rate, before/after quality, contract retention |
| **Typical buyers** | Restaurants, retail pads, medical offices, property managers |
| **Decision makers** | Owner, facilities manager, operations manager |
| **Typical contract size** | $500–$5K per job; $1K–$8K/mo route contracts |
| **Execution process** | Site walk → quote → schedule → service → upsell route |
| **Competitive advantages** | Fast quote, route density, visual proof |
| **Future expansion** | Fleet washing, soft wash bundles, national account programs |
| **Linked offer** | `offer_pressure_washing` |

---

## KTM Labor

| Field | Value |
|---|---|
| **ID** | `cap_ktm_labor` |
| **Problems solved** | Labor shortages, schedule delays, surge staffing, skilled trade gaps |
| **KPIs** | Time to fill, jobs filled, hours worked, overtime reduction, schedule adherence |
| **Typical buyers** | Industrial sites, contractors, turnaround projects, facilities under expansion |
| **Decision makers** | Project manager, site superintendent, HR manager, procurement |
| **Typical contract size** | $50K–$5M+ depending on scope and duration |
| **Execution process** | Qualify need → compliance check → deploy crew → timesheet → invoice |
| **Competitive advantages** | Speed, safety culture, regional crew network, turnaround experience |
| **Future expansion** | National account desk, vendor-on-prem programs |
| **Linked offer** | `offer_ktm_manpower` |

---

## Fire Watch

| Field | Value |
|---|---|
| **ID** | `cap_fire_watch` |
| **Problems solved** | Hot work compliance, insurance requirements, shutdown safety coverage |
| **KPIs** | Compliance incidents (zero target), coverage hours, response time |
| **Typical buyers** | Refineries, chemical plants, construction sites, turnaround contractors |
| **Decision makers** | Safety manager, construction manager, HSE director |
| **Typical contract size** | $5K–$500K per project phase |
| **Execution process** | Cert verify → deploy watchers → log → handoff |
| **Competitive advantages** | Certified roster, 24/7 dispatch, turnaround familiarity |
| **Future expansion** | Bundled with hole watch and safety staffing |

---

## Hole Watch

| Field | Value |
|---|---|
| **ID** | `cap_hole_watch` |
| **Problems solved** | Confined space / opening compliance during maintenance and construction |
| **KPIs** | Compliance, incident prevention, coverage continuity |
| **Typical buyers** | Same as Fire Watch + industrial maintenance |
| **Decision makers** | Safety manager, turnaround planner |
| **Typical contract size** | $5K–$300K per phase |
| **Execution process** | Job hazard analysis → assign certified personnel → monitor |
| **Competitive advantages** | Combined safety services with KTM Labor |
| **Future expansion** | Integrated safety packages |

---

## Safety (General Safety Support)

| Field | Value |
|---|---|
| **ID** | `cap_safety_support` |
| **Problems solved** | Safety staffing gaps, compliance audits, site safety coverage |
| **KPIs** | Recordable incidents, audit pass rate, training completion |
| **Typical buyers** | Industrial, construction, large facilities |
| **Decision makers** | HSE director, site manager |
| **Typical contract size** | $10K–$1M+ |
| **Execution process** | Assess → staff → report → adjust |
| **Competitive advantages** | Multi-service bundling with labor |
| **Future expansion** | Safety consulting, training programs |

---

## Maintenance

| Field | Value |
|---|---|
| **ID** | `cap_maintenance` |
| **Problems solved** | Deferred maintenance, downtime, reliability risk |
| **KPIs** | Uptime, MTBF, cost per asset, backlog reduction |
| **Typical buyers** | Plants, hospitals, schools, commercial portfolios |
| **Decision makers** | Facilities director, plant manager |
| **Typical contract size** | $25K–$2M recurring |
| **Execution process** | Inspect → plan → execute → report → renew |
| **Competitive advantages** | Cross-sell from cleaning and labor capabilities |
| **Future expansion** | IoT-driven predictive maintenance partnerships |

---

## Lead Generation

| Field | Value |
|---|---|
| **ID** | `cap_lead_generation` |
| **Problems solved** | Empty pipeline, unpredictable inbound, poor targeting |
| **KPIs** | Qualified leads, cost per lead, conversion to opportunity |
| **Typical buyers** | Any B2B capability seller (internal use + client service) |
| **Decision makers** | CEO, sales leader, marketing lead |
| **Typical contract size** | Internal capability; client $2K–$20K/mo |
| **Execution process** | ICP → signal/discovery → qualify → handoff to execution |
| **Competitive advantages** | Powered by Opportunity OS itself (meta-capability) |
| **Future expansion** | External SaaS offering — [Future Ideas](./19-future-ideas.md) |

**Note:** Lead lists are **inputs**, not the OS product.

---

## AI Automation

| Field | Value |
|---|---|
| **ID** | `cap_ai_automation` |
| **Problems solved** | Manual workflows, slow response, data silos, repetitive analysis |
| **KPIs** | Hours saved, error reduction, response time, throughput |
| **Typical buyers** | Operations-heavy businesses, agencies, industrial back-office |
| **Decision makers** | COO, CTO, owner |
| **Typical contract size** | $10K–$500K projects; $1K–$20K/mo managed |
| **Execution process** | Process map → automate → monitor → iterate |
| **Competitive advantages** | Opportunity OS as living automation backbone |
| **Future expansion** | Agent marketplace, vertical automation packs |

---

## Capability ↔ Offer Rules

1. Every **Offer** must reference ≥1 **Capability** by ID (Phase 1 convergence).
2. Opportunities match **Problems** to **Capabilities** first; offers second.
3. Never create offer-specific silo code paths — use capability registry.

See [Architecture Rules](./07-architecture-rules.md).

---

## Amendment

New capabilities require: registry entry, problem mapping, KPI definition, owner sign-off, [Build Log](./09-build-log.md) entry.
