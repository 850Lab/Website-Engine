# 33 - Master Engineering Backlog

**Status:** Phase 4.2 planning source of truth - design/backlog only  
**Related:** [Roadmap](./01-roadmap.md) - [Current Phase](./08-current-phase.md) - [AI Chief of Staff](./32-ai-chief-of-staff.md) - [Runtime Data Boundaries](./24-runtime-data-boundaries.md) - [Autonomous Operating Loop](./28-autonomous-operating-loop.md) - [OpenClaw Constitution](./29-openclaw-constitution.md)

---

## Purpose

This document is the permanent engineering backlog for Opportunity OS.

It exists so the **AI Chief of Staff**, **Engineering Director**, **OpenClaw Builder**, and **OpenClaw QA** can determine what to build next without relying on manually authored one-off prompts.

Future development should be selected from this backlog, validated against dependencies, and executed only when the task is unblocked and consistent with the architecture.

---

## Completed Foundation

Do not redesign these layers. Extend them.

- Phase 3 foundation
- Runtime and runtime-validation
- Validation framework
- Event system
- Scheduler
- Processor
- Dispatcher
- Orchestrator
- Pipeline handlers
- Signal registry
- Facts
- Knowledge graph
- Situations
- Hypotheses
- Problems
- Capability matching
- Offer recommendation
- Opportunity builder
- AI Chief of Staff core
- Founder intent
- Mission registry
- Engineering Director core
- Founder briefing
- OpenClaw Builder
- OpenClaw QA

---

## Backlog Execution Status

| ID | Status | Completion evidence | Last validation |
|---|---|---|---|
| `B1` | `complete` | `parseMasterBacklog()`, `selectNextBacklogTask()`, and `createBuilderPlanFromBacklogTask()` implemented in `src/engine/founder-intent/backlog-selector.js`; Phase 4.2 registered in validation graph. | `node scripts/opportunity-engine/validate-phase-4-2.js` |
| `B2` | `complete` | `saveEngineeringTask()`, lifecycle helpers, and `getEngineeringTaskRegistrySummary()` implemented in `src/engine/founder-intent/engineering-task-registry.js`; tasks persist under `runtime/engineering-tasks/` without source backlog mutation or execution side effects. | `node scripts/opportunity-engine/validate-engineering-task-registry.js` |
| `B3` | `complete` | `createOpenClawHandoffPackage()` and `validateOpenClawHandoffPackage()` implemented in `src/engine/founder-intent/openclaw-handoff.js`; approved OpenClaw-eligible engineering tasks become schema-valid handoff drafts without creating, dispatching, or running jobs. | `node scripts/opportunity-engine/validate-openclaw-handoff.js` |
| `O-PW1` | `complete` | `createPressureWashingMissionTemplate()` implemented in `src/engine/founder-intent/business-operators.js`; template creates a valid commercial pressure washing mission for Beaumont 500-mile radius with offer/capability mapping and outreach approval gate. | `node scripts/opportunity-engine/validate-business-operators.js` |
| `O-KTM1` | `complete` | `createKtmMissionTemplate()` implemented in `src/engine/founder-intent/business-operators.js`; template creates a valid KTM industrial maintenance mission for Beaumont 500-mile radius with `offer_ktm_manpower`, supported capabilities, industrial buyers, trigger signals, and outreach approval gate. | `node scripts/opportunity-engine/validate-business-operators.js` |
| `C1` | `complete` | File-drop JSON observations can carry `candidateMissionIds`, `missionHints`, and `sourceLabel`; the metadata is preserved through signal provenance without creating facts, situations, problems, opportunities, contacts, campaigns, or outreach. | `node scripts/opportunity-engine/validate-business-discovery.js` |
| `O-APT1` | `complete` | `createApartmentWorkshopMissionTemplate()` implemented in `src/engine/founder-intent/business-operators.js`; template creates a valid apartment financial workshop mission for Beaumont 500-mile radius using supported growth/lead-generation capabilities and preserving outreach approval gates. | `node scripts/opportunity-engine/validate-business-operators.js` |
| `O-WEB1` | `complete` | `createWebsiteAgencyMissionTemplate()` implemented in `src/engine/founder-intent/business-operators.js`; template creates a valid local service website growth mission mapped to `offer_website_growth`, `website_growth`, and `lead_generation`, with outreach approval gates preserved. | `node scripts/opportunity-engine/validate-business-operators.js` |
| `S1` | `complete` | `runtime-health.js` emits deterministic JSON/Markdown report data with schema version, runtime store counts, and generated-report policy; `validate-observability.js` verifies determinism, gitignored outputs, and no dashboard/daemon/live-service behavior. | `node scripts/opportunity-engine/validate-observability.js` |

Status rows are factual execution records. Do not mark a backlog task `complete` unless its completion criteria are met, required validation passes, docs are updated, and the task is committed or explicitly approved as uncommitted.

---

## Founder Revenue Priorities

Engineering priority must favor revenue-producing work when dependencies allow.

1. Commercial pressure washing within approximately 500 miles of Beaumont, Texas
2. KTM industrial opportunities: maintenance, turnaround, staffing, safety, contractor demand
3. Apartment complexes for financial workshops and sponsor acquisition
4. Every offer eventually capable of 10,000 personalized emails per month

---

## Priority Scale

| Priority | Meaning |
|---|---|
| `P0` | Required before the Founder can reliably use the OS for revenue |
| `P1` | High business value after P0 blockers clear |
| `P2` | Important scaling or quality work |
| `P3` | Future platform expansion |

Complexity and value use `S`, `M`, `L`, `XL`.

Stop conditions are mandatory. If a stop condition is hit, halt and request Founder approval or missing information.

---

## Epic A - AI Chief of Staff Evolution

| ID | Title | Description | Business purpose | Priority | Dependencies | Validation script | Complexity | Business value | Stop conditions | Affected modules | Completion criteria |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `A1` | Founder conversation state | Persist multi-turn Founder conversations, clarification state, and active intent context without executing business actions. | Founder can express goals naturally over time. | P0 | Phase 4.1 mission registry | `validate-phase-4-2.js` | M | L | Missing privacy policy; asks to send outreach | `src/engine/founder-intent/`, `runtime/chief-of-staff/` | Conversations resume, clarification state is auditable, no pipeline execution. |
| `A2` | Mission activation workflow | Add approval-gated workflow from draft mission to active mission. | Founder can approve what the OS should pursue. | P0 | A1 | `validate-phase-4-2.js` | M | L | Founder approval absent | `founder-intent`, `pivotal-os` | Draft, approve, activate, pause, archive all validated. |
| `A3` | Multi-mission portfolio prioritization | Rank active missions by cash flow, urgency, upside, execution difficulty, and capacity. | Focuses scarce effort on highest-return missions. | P0 | A2 | `validate-phase-4-2.js` | M | XL | Revenue target missing | `founder-intent` | Pressure Washing, KTM, and Apartment missions produce ordered priorities. |
| `A4` | Chief-of-Staff daily briefing | Generate daily Founder briefing: active missions, best opportunities, blockers, next decisions. | Founder knows what to do today. | P1 | A3, L1 | `validate-chief-of-staff-briefing.js` | M | L | No active missions | `founder-intent`, `reports/` | Markdown/JSON briefing generated with no side effects. |

---

## Epic B - Engineering Director Evolution

| ID | Title | Description | Business purpose | Priority | Dependencies | Validation script | Complexity | Business value | Stop conditions | Affected modules | Completion criteria |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `B1` | Backlog reader and task selector | Let Engineering Director parse this backlog, identify unblocked tasks, and recommend next build. | Removes need for manual prompts. | P0 | This document | `validate-engineering-director.js` | M | XL | Ambiguous dependencies | `founder-intent`, `docs/opportunity-os/` | Highest-value unblocked task is selected with explanation. |
| `B2` | Engineering task registry | Persist proposed, approved, active, blocked, and completed engineering tasks. | Creates durable engineering operating memory. | P0 | B1 | `validate-engineering-task-registry.js` | M | L | Task requests source changes without approval | `runtime/engineering-tasks/`, `founder-intent` | Task lifecycle works and is git-clean. |
| `B3` | OpenClaw handoff package | Convert approved engineering tasks into OpenClaw job specs with scopes, validation commands, stop conditions. | Safely delegates coding work. | P1 | B2, OpenClaw Builder | `validate-openclaw-handoff.js` | M | L | OpenClaw scope exceeds allowed modules | `founder-intent`, `openclaw` | Handoff package validates but does not run OpenClaw. |
| `B4` | Regression-aware planning | Require selected tasks to declare impacted validators before implementation. | Protects architecture and release quality. | P1 | B1, validation framework | `validate-engineering-director.js` | S | M | No validation path exists | `founder-intent`, `validation` | Every task recommendation includes validation plan. |

---

## Epic C - Business Discovery

| ID | Title | Description | Business purpose | Priority | Dependencies | Validation script | Complexity | Business value | Stop conditions | Affected modules | Completion criteria |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `C1` | Mission-aware file drop intake | Allow file-drop observations to carry mission hints and source labels. | Fastest path to pressure washing and KTM signal testing. | P0 | Mission registry | `validate-business-discovery.js` | S | L | Attempts direct opportunity creation | `sensors/live`, `signals` | Observations tag candidate mission IDs; pipeline remains unchanged. |
| `C2` | Commercial property source connector v1 | Add first connector for business openings, remodels, property management, shopping centers. | Directly supports pressure washing revenue. | P0 | C1, connector policy | `validate-source-connectors-v1.js` | L | XL | External credentials/API required | `sensors`, `runtime/inbox` | Connector writes observations only; no facts/opportunities directly. |
| `C3` | Industrial signal connector v1 | Add KTM-oriented source for turnarounds, shutdowns, permits, RFP/news. | Feeds high-upside KTM opportunities. | P1 | C1, connector policy | `validate-source-connectors-v1.js` | L | XL | Paid source or legal approval required | `sensors` | Industrial observations enter signal registry with provenance. |
| `C4` | Apartment relationship source v1 | Add source for apartment communities, property management groups, community event signals. | Supports apartment workshop/sponsor mission. | P1 | C1 | `validate-source-connectors-v1.js` | L | L | Source terms prohibit use | `sensors` | Apartment observations flow into pipeline as signals. |

---

## Epic D - Contact Discovery

| ID | Title | Description | Business purpose | Priority | Dependencies | Validation script | Complexity | Business value | Stop conditions | Affected modules | Completion criteria |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `D1` | Contact discovery architecture | Define contact object, provenance, confidence, allowed sources, and no-contact rules. | Required before any outreach. | P0 | Mission approval workflow | `validate-contact-discovery.js` | M | XL | Legal/compliance uncertainty | `docs`, `engine/contact-discovery` | Contact schema and validation rules exist; no sending. |
| `D2` | Buyer role resolver | Map missions to buyer roles: property manager, operations manager, safety manager, owner. | Finds the right people to contact. | P0 | D1 | `validate-contact-discovery.js` | M | XL | Role cannot be inferred | `contact-discovery`, `founder-intent` | Mission -> buyer roles are deterministic and explainable. |
| `D3` | Contact candidate store | Persist contact candidates with source, confidence, consent/compliance flags. | Prepares CRM and outreach safely. | P1 | D1, D2 | `validate-contact-store.js` | M | XL | PII policy missing | `runtime/contacts/` | Contacts store validates, supports archive, no outreach. |
| `D4` | Contact enrichment adapters | Add approved enrichment sources for email, phone, title, company. | Improves campaign quality and deliverability. | P2 | D3, legal approval | `validate-contact-enrichment.js` | XL | XL | Requires paid account/API | `contact-discovery` | Enrichment produces candidates with provenance and confidence. |

---

## Epic E - Relationship Intelligence

| ID | Title | Description | Business purpose | Priority | Dependencies | Validation script | Complexity | Business value | Stop conditions | Affected modules | Completion criteria |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `E1` | Organization relationship graph | Model relationships between companies, facilities, owners, managers, sponsors, contractors. | Improves who-to-contact and opportunity relevance. | P1 | D3, graph store | `validate-relationship-intelligence.js` | L | L | Source confidence too low | `graph-store`, `relationship-builder` | Relationships are stored with provenance and confidence. |
| `E2` | Warm path detector | Identify existing connections, prior outcomes, and reusable relationships. | Increases conversion odds. | P1 | CRM foundation | `validate-relationship-intelligence.js` | M | L | No CRM history | `crm`, `relationship-intelligence` | Opportunities show warm-path flags when available. |
| `E3` | Sponsor relationship mapper | Map apartment workshop missions to likely local sponsors. | Enables apartment campaign revenue model. | P2 | D3, E1 | `validate-sponsor-mapping.js` | L | L | Sponsor category missing | `relationship-intelligence` | Sponsor candidates rank by mission fit. |

---

## Epic F - Opportunity Intelligence

| ID | Title | Description | Business purpose | Priority | Dependencies | Validation script | Complexity | Business value | Stop conditions | Affected modules | Completion criteria |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `F1` | Mission-fit opportunity ranking | Make mission fit a first-class opportunity ranking input. | Prioritizes revenue-aligned opportunities over random ones. | P0 | A3, current alignment | `validate-opportunity-mission-fit.js` | M | XL | Active mission missing | `founder-intent`, `opportunities`, `mission-control` | Ranked outputs include mission match, confidence, value, difficulty. |
| `F2` | Opportunity review packet | Generate Founder-readable packet with evidence, contact needs, offer, and next action. | Enables safe human approval. | P0 | F1, D1 | `validate-opportunity-review-packet.js` | M | XL | Evidence incomplete | `opportunity-factory`, `founder-intent`, `reports/` | Packet is generated without outreach. |
| `F3` | Revenue potential model v1 | Estimate value by mission, offer, buyer type, geography, and confidence. | Improves cash-flow decisions. | P1 | F1, CRM outcomes later | `validate-revenue-model.js` | M | XL | No comparable assumptions | `opportunity-intelligence` | Revenue estimate includes assumptions and confidence. |
| `F4` | Abstention tuning by mission | Tune abstention thresholds per mission to reduce weak opportunities. | Protects Founder time and reputation. | P1 | F1 | `validate-opportunity-abstention.js` | M | L | No validation fixtures | `opportunity-factory`, `founder-intent` | Weak mission-fit opportunities abstain with explanation. |

---

## Epic G - Content Generation

| ID | Title | Description | Business purpose | Priority | Dependencies | Validation script | Complexity | Business value | Stop conditions | Affected modules | Completion criteria |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `G1` | Asset draft schema | Define email, call script, landing page, flyer, and visit script draft objects. | Prepares outreach without sending. | P1 | F2, approval gates | `validate-content-drafts.js` | M | XL | Compliance rules undefined | `engine/content`, `runtime/content-drafts/` | Drafts validate and require approval before use. |
| `G2` | Offer-specific copy generator | Generate grounded copy for pressure washing, KTM, apartment workshops, website agency. | Converts opportunities into usable sales assets. | P1 | G1, F2 | `validate-content-drafts.js` | L | XL | LLM unavailable and no template fallback | `content`, `offers`, `founder-intent` | Drafts cite mission, opportunity evidence, and offer. |
| `G3` | Personalization rules | Define safe personalization tokens and forbidden claims. | Enables future 10,000/month scale safely. | P1 | G1 | `validate-personalization-rules.js` | M | XL | Data quality insufficient | `content`, `contact-discovery` | Drafts reject unsupported personalization claims. |

---

## Epic H - Campaign Engine

| ID | Title | Description | Business purpose | Priority | Dependencies | Validation script | Complexity | Business value | Stop conditions | Affected modules | Completion criteria |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `H1` | Campaign object schema | Define campaign, audience, sequence, approval, and state machine. | Required before any campaign execution. | P0 | F2, G1, D3 | `validate-campaign-engine.js` | M | XL | Approval policy unclear | `engine/campaign-engine`, `runtime/campaigns/` | Campaign draft lifecycle validates; no sending. |
| `H2` | Campaign review queue | Create Founder approval queue for mission, opportunity, contacts, assets, sequence. | Prevents unsafe outreach. | P0 | H1, CEO dashboard | `validate-campaign-review.js` | L | XL | Founder approval UI absent | `campaign-engine`, `pivotal-os` | Campaign cannot move past draft without approval. |
| `H3` | Sequence planner | Build email/call/visit sequence drafts by mission and buyer type. | Turns opportunities into action plans. | P1 | H1, G2 | `validate-sequence-planner.js` | M | XL | Contact consent unavailable | `campaign-engine`, `content` | Sequence plan generated with approval and stop rules. |
| `H4` | Campaign execution queue | Queue approved campaign tasks for future execution adapters. | Bridges planning to controlled execution. | P2 | H2, Email infra | `validate-campaign-execution-queue.js` | L | XL | Sending adapter not approved | `execution-queue`, `campaign-engine` | Queue persists approved tasks but does not send by default. |

---

## Epic I - Email Infrastructure

| ID | Title | Description | Business purpose | Priority | Dependencies | Validation script | Complexity | Business value | Stop conditions | Affected modules | Completion criteria |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `I1` | Email compliance architecture | Define consent, unsubscribe, suppression, rate limits, legal policies. | Required before email scale. | P0 | H1 | `validate-email-compliance.js` | M | XL | Legal approval required | `docs`, `engine/compliance` | Compliance policy blocks sending until configured. |
| `I2` | Suppression and unsubscribe store | Persist unsubscribes, bounces, do-not-contact, and suppressed domains. | Protects deliverability and compliance. | P0 | I1 | `validate-suppression-store.js` | M | XL | PII policy missing | `runtime/compliance/` | Suppression checks are enforced before queueing sends. |
| `I3` | Sending provider adapter | Add provider abstraction for approved email account. | Enables controlled sending later. | P2 | I1, I2, provider credentials | `validate-email-adapter.js` | L | XL | Credentials/account required | `engine/email` | Adapter validates in dry-run until credentials approved. |
| `I4` | Scale controller | Enforce 10,000 emails/month/offer caps, warmup, throttles, and kill switch. | Supports long-term scale safely. | P2 | I3, observability | `validate-email-scale-controller.js` | XL | XL | Deliverability setup absent | `engine/email`, `runtime/compliance/` | Caps and kill switch validated in simulation. |

---

## Epic J - CRM

| ID | Title | Description | Business purpose | Priority | Dependencies | Validation script | Complexity | Business value | Stop conditions | Affected modules | Completion criteria |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `J1` | CRM object model | Define account, contact, opportunity, activity, outcome, and relationship states. | Creates durable sales memory. | P0 | D3, H1 | `validate-crm.js` | L | XL | Conflicts with existing schema unresolved | `engine/crm`, `runtime/crm/` | CRM store validates and links to missions/opportunities. |
| `J2` | CRM update workflow | Update CRM from approved outreach outcomes and replies. | Tracks revenue progress and next actions. | P1 | J1, Reply processing | `validate-crm-updates.js` | L | XL | No outcome source | `crm`, `campaign-engine` | Outcomes update CRM without corrupting opportunity history. |
| `J3` | Follow-up scheduler bridge | Convert CRM next steps into approved jobs. | Prevents missed revenue opportunities. | P1 | J1, Scheduler, approval gates | `validate-crm-followups.js` | M | L | No owner approval for follow-up automation | `crm`, `scheduler`, `jobs` | Follow-up jobs are created only under policy. |

---

## Epic K - Learning Engine

| ID | Title | Description | Business purpose | Priority | Dependencies | Validation script | Complexity | Business value | Stop conditions | Affected modules | Completion criteria |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `K1` | Outcome event model | Define won/lost/replied/booked/ignored outcomes with mission and campaign links. | Enables learning from reality. | P1 | CRM | `validate-learning-engine.js` | M | XL | Outcome source missing | `engine/learning`, `runtime/outcomes/` | Outcomes validate and link to mission/opportunity/contact. |
| `K2` | Score calibration proposals | Generate proposed changes to mission-fit, revenue, and confidence weights. | Improves future recommendations. | P2 | K1, analytics | `validate-calibration-proposals.js` | L | XL | Too little outcome data | `learning`, `founder-intent` | Proposals are generated but require approval to apply. |
| `K3` | Playbook learning | Mine winning messages, buyer segments, channels, and objections. | Compounds campaign performance. | P2 | K1, content generation | `validate-playbook-learning.js` | L | XL | PII/privacy concerns | `learning`, `content` | Playbook proposals include evidence and approval gate. |

---

## Epic L - Analytics

| ID | Title | Description | Business purpose | Priority | Dependencies | Validation script | Complexity | Business value | Stop conditions | Affected modules | Completion criteria |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `L1` | Mission analytics summary | Report opportunities, contacts, campaigns, revenue, and blockers by mission. | Founder can see business progress. | P0 | Founder briefing, CRM later | `validate-mission-analytics.js` | M | L | Missing mission data | `analytics`, `founder-intent` | Summary works with partial data and no side effects. |
| `L2` | Funnel metrics | Track signal -> opportunity -> contact -> campaign -> reply -> revenue funnel. | Identifies bottlenecks. | P1 | CRM, campaign engine | `validate-funnel-analytics.js` | L | XL | No campaign outcomes | `analytics`, `runtime/reports/` | Funnel report generated per mission and offer. |
| `L3` | Revenue forecast v1 | Forecast expected revenue from active missions and current pipeline. | Helps Founder allocate time and cash. | P2 | L2, K1 | `validate-revenue-forecast.js` | L | XL | Insufficient data | `analytics`, `forecasting` | Forecast includes confidence, assumptions, and backtest placeholder. |

---

## Epic M - Mission Control

| ID | Title | Description | Business purpose | Priority | Dependencies | Validation script | Complexity | Business value | Stop conditions | Affected modules | Completion criteria |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `M1` | Mission-aware projection | Update Mission Control projection to use active missions and mission-ranked opportunities. | Replaces generic radar with Founder agenda. | P0 | F1, L1 | `validate-mission-control.js` | M | XL | Breaks existing home projection | `mission-control`, `founder-intent` | Mission Control shows mission-fit ranking and blockers. |
| `M2` | Mission blocker projection | Show missing sources, contacts, assets, approvals, credentials. | Directs engineering and business work. | P0 | B1, L1 | `validate-mission-control.js` | M | L | Blocker source unclear | `mission-control`, `founder-intent` | Each active mission lists blockers and next action. |
| `M3` | Operator-safe status feed | Feed UI/dashboard without exposing secrets or PII. | Enables safe daily operations. | P1 | Security policy | `validate-mission-control-security.js` | M | M | PII redaction incomplete | `mission-control`, `security` | Projection redacts sensitive fields. |

---

## Epic N - CEO Dashboard

| ID | Title | Description | Business purpose | Priority | Dependencies | Validation script | Complexity | Business value | Stop conditions | Affected modules | Completion criteria |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `N1` | Mission review board UI | Founder can view, approve, pause, and prioritize missions. | Makes Chief of Staff usable. | P0 | A2, auth | `validate-ceo-dashboard.js` | L | XL | Auth/session unsafe | `src/pivotal-os/` | UI shows missions and approval controls. |
| `N2` | Opportunity review board UI | Founder can approve/reject/defer opportunities with evidence. | Required before outreach. | P0 | F2, N1 | `validate-opportunity-review-ui.js` | L | XL | Evidence missing | `pivotal-os`, `opportunities` | Review actions are persisted and auditable. |
| `N3` | Campaign approval UI | Founder approves campaign package before queueing execution. | Required before any sending. | P1 | H2, G2, D3 | `validate-campaign-approval-ui.js` | XL | XL | Compliance policy missing | `pivotal-os`, `campaign-engine` | Campaigns cannot execute without approval state. |

---

## Epic O - Business Operators

### Pressure Washing

| ID | Title | Description | Business purpose | Priority | Dependencies | Validation script | Complexity | Business value | Stop conditions | Affected modules | Completion criteria |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `O-PW1` | Pressure washing mission template | Default mission, strategy, buyer types, signals, and constraints for Beaumont radius. | Fastest Founder cash-flow path. | P0 | Mission registry | `validate-business-operators.js` | S | XL | Offer not supported | `founder-intent` | Template creates valid pressure washing mission. |
| `O-PW2` | Pressure washing opportunity scoring | Rank entryways, sidewalks, building washing jobs by value and ease. | Prioritizes executable jobs. | P0 | F1 | `validate-pressure-washing-operator.js` | M | XL | Job type unknown | `opportunity-intelligence` | Ranking favors commercial jobs in target radius. |

### KTM

| ID | Title | Description | Business purpose | Priority | Dependencies | Validation script | Complexity | Business value | Stop conditions | Affected modules | Completion criteria |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `O-KTM1` | KTM mission template | Default KTM industrial maintenance, safety, staffing, turnaround mission. | High-upside industrial revenue. | P0 | Mission registry | `validate-business-operators.js` | S | XL | Capability absent | `founder-intent` | Template maps to KTM offer/capabilities and signals. |
| `O-KTM2` | Industrial trigger library | Maintain trigger phrases and sources for shutdowns, turnarounds, refinery work. | Improves signal quality. | P1 | C3 | `validate-ktm-operator.js` | M | XL | Source legally restricted | `signals`, `founder-intent` | Industrial trigger fixtures classify correctly. |

### Apartment Campaign

| ID | Title | Description | Business purpose | Priority | Dependencies | Validation script | Complexity | Business value | Stop conditions | Affected modules | Completion criteria |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `O-APT1` | Apartment workshop mission template | Default apartment property manager and sponsor mission. | Enables workshop/sponsor revenue. | P1 | Mission registry | `validate-business-operators.js` | S | L | Offer needs registry update | `founder-intent` | Template creates valid mission and strategy. |
| `O-APT2` | Sponsor acquisition model | Map apartment workshops to sponsor categories and value proposition. | Creates monetization path. | P1 | E3 | `validate-apartment-operator.js` | M | L | Sponsor categories unclear | `relationship-intelligence`, `offers` | Sponsor recommendations include rationale. |

### Website Agency

| ID | Title | Description | Business purpose | Priority | Dependencies | Validation script | Complexity | Business value | Stop conditions | Affected modules | Completion criteria |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `O-WEB1` | Website agency mission template | Default website growth mission for local service businesses. | Adds digital-service revenue path. | P2 | Mission registry | `validate-business-operators.js` | S | M | Offer inactive | `founder-intent` | Mission maps to website offer and capabilities. |
| `O-WEB2` | Website scan signal bridge | Connect legacy website scans as OS observations. | Reuses existing assets without redesign. | P2 | C1 | `validate-website-operator.js` | M | L | Legacy data unreliable | `sensors`, `legacy adapters` | Website scan produces observations only. |

### Credit App

| ID | Title | Description | Business purpose | Priority | Dependencies | Validation script | Complexity | Business value | Stop conditions | Affected modules | Completion criteria |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `O-CR1` | Credit app mission design | Define offer, buyer, compliance, and revenue model before implementation. | Future finance product path. | P3 | Founder approval | `validate-credit-app-operator.js` | M | M | Legal/compliance approval required | `docs`, `founder-intent` | Design approved; no financial advice automation. |
| `O-CR2` | Credit app compliance gate | Define legal and data boundaries for credit-related workflows. | Prevents regulated-risk errors. | P3 | O-CR1, legal approval | `validate-credit-app-compliance.js` | L | M | Legal approval absent | `security`, `compliance` | Compliance blocks unsafe use. |

### Government Contracts

| ID | Title | Description | Business purpose | Priority | Dependencies | Validation script | Complexity | Business value | Stop conditions | Affected modules | Completion criteria |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `O-GOV1` | Government contracts mission template | Create mission for public bids/RFPs aligned to current offers. | Opens larger contract channel. | P2 | Mission registry | `validate-business-operators.js` | S | L | Registration requirements unknown | `founder-intent` | Mission validates and recommends RFP sources. |
| `O-GOV2` | Public bid source connector | Ingest public bid/RFP observations. | Finds large opportunities. | P2 | C1, O-GOV1 | `validate-government-operator.js` | L | L | Source terms or credentials required | `sensors` | RFP observations enter signal registry. |

---

## Epic P - Deployment

| ID | Title | Description | Business purpose | Priority | Dependencies | Validation script | Complexity | Business value | Stop conditions | Affected modules | Completion criteria |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `P1` | Production deployment architecture | Define hosting, runtime storage, environment variables, backups, auth. | Makes OS usable outside local machine. | P1 | Security basics | `validate-deployment-plan.js` | M | L | Hosting/account approval required | `docs`, `scripts/deploy/` | Deployment plan approved; no secrets committed. |
| `P2` | Environment validation | Verify required env vars, runtime paths, secrets placeholders. | Prevents broken production runs. | P1 | P1 | `validate-environment.js` | M | L | Secrets required | `scripts/opportunity-engine/` | Environment check reports missing config safely. |
| `P3` | Backup and restore | Backup runtime stores and restore to clean environment. | Protects business data. | P1 | P1 | `validate-backup-restore.js` | L | L | Backup destination absent | `scripts/runtime/`, `runtime/` | Backup/restore validated with test runtime. |

---

## Epic Q - Scaling

| ID | Title | Description | Business purpose | Priority | Dependencies | Validation script | Complexity | Business value | Stop conditions | Affected modules | Completion criteria |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `Q1` | Runtime store compaction | Prevent JSON runtime stores from becoming slow or unsafe at scale. | Supports thousands of signals and contacts. | P1 | Increased volume | `validate-runtime-scale.js` | L | M | Data migration risk | `runtime`, stores | Compaction preserves data and passes release suite. |
| `Q2` | Queue throughput simulation | Simulate large job/event volume without external sends. | Prepares for 10,000/month operations. | P1 | Campaign engine | `validate-throughput-simulation.js` | L | L | Performance unstable | `jobs`, `events`, `processor` | Simulation passes with metrics and no side effects. |
| `Q3` | Database migration plan | Plan move from JSON stores to durable DB if needed. | Long-term reliability. | P2 | Runtime scale limits observed | `validate-db-migration-plan.js` | XL | L | Migration risk too high | `docs`, future db adapters | Plan approved before code. |

---

## Epic R - Security

| ID | Title | Description | Business purpose | Priority | Dependencies | Validation script | Complexity | Business value | Stop conditions | Affected modules | Completion criteria |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `R1` | Secrets policy and scanner | Define secrets handling and block accidental commits. | Protects accounts and compliance. | P0 | Deployment planning | `validate-security.js` | M | XL | Requires secret provider approval | `scripts/security/`, `.gitignore` | Scanner blocks common secret patterns. |
| `R2` | PII classification | Classify contact/customer fields and redaction rules. | Required before contact discovery scale. | P0 | D1 | `validate-pii-policy.js` | M | XL | Legal uncertainty | `security`, `contact-discovery` | PII fields have handling policy and tests. |
| `R3` | Permission model | Define roles: Founder, operator, QA, builder, read-only auditor. | Safe multi-user operations. | P1 | CEO dashboard | `validate-permissions.js` | L | L | Auth provider missing | `operators`, `pivotal-os` | Role checks protect privileged actions. |

---

## Epic S - Observability

| ID | Title | Description | Business purpose | Priority | Dependencies | Validation script | Complexity | Business value | Stop conditions | Affected modules | Completion criteria |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `S1` | Runtime health dashboard data | Emit health for jobs, events, stores, missions, connectors, campaigns. | Founder sees system reliability. | P1 | Runtime health script | `validate-observability.js` | M | L | Metrics source missing | `scripts/opportunity-engine`, `runtime/health` | Health JSON/MD generated and gitignored. |
| `S2` | Error alert policy | Define alert thresholds, channels, and escalation rules. | Prevents silent failures. | P1 | Deployment | `validate-alert-policy.js` | M | L | Alert account required | `docs`, `observability` | Alert policy exists; no external sends until configured. |
| `S3` | Audit trail explorer | Read-only report for mission, opportunity, campaign, contact history. | Builds trust and debuggability. | P2 | CRM, campaign engine | `validate-audit-report.js` | M | M | PII redaction incomplete | `reports`, `runtime/events` | Audit report renders with redaction. |

---

## Epic T - Future Platform Expansion

| ID | Title | Description | Business purpose | Priority | Dependencies | Validation script | Complexity | Business value | Stop conditions | Affected modules | Completion criteria |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `T1` | Multi-company workspace model | Support multiple businesses with isolated missions, offers, runtime views. | Founder can operate multiple AI-assisted companies. | P3 | Security, CRM, mission registry | `validate-workspaces.js` | XL | XL | Data isolation unclear | `runtime`, `founder-intent`, `pivotal-os` | Workspace isolation validated. |
| `T2` | Partner capability marketplace | Model partner capabilities, constraints, economics, approval. | Expands offers beyond owned capacity. | P3 | Capability registry, contracts | `validate-partner-capabilities.js` | XL | XL | Legal/business approval required | `capabilities`, `offers` | Partner capabilities remain approval-gated. |
| `T3` | Forecasting and market maps | Predict opportunity emergence by geography, industry, and precursor signals. | Moves OS from reactive to predictive. | P3 | Learning engine, signal history | `validate-forecasting.js` | XL | XL | Insufficient history | `forecasting`, `analytics` | Forecasts include confidence and backtest metrics. |

---

## Dependency Graph

### Critical path to first usable revenue product

```text
A1 Founder conversation state
  -> A2 Mission activation workflow
  -> A3 Multi-mission portfolio prioritization
  -> L1 Mission analytics summary
  -> M1 Mission-aware projection
  -> N1 Mission review board UI
  -> F1 Mission-fit opportunity ranking
  -> F2 Opportunity review packet
  -> N2 Opportunity review board UI
  -> C1 Mission-aware file drop intake
  -> C2 Commercial property source connector v1
```

### Critical path to approved outreach

```text
F2 Opportunity review packet
  -> D1 Contact discovery architecture
  -> D2 Buyer role resolver
  -> D3 Contact candidate store
  -> G1 Asset draft schema
  -> G2 Offer-specific copy generator
  -> H1 Campaign object schema
  -> I1 Email compliance architecture
  -> I2 Suppression and unsubscribe store
  -> H2 Campaign review queue
  -> N3 Campaign approval UI
  -> I3 Sending provider adapter
  -> H4 Campaign execution queue
```

### Critical path to autonomous email execution

```text
Approved outreach path
  -> I4 Scale controller
  -> J1 CRM object model
  -> J2 CRM update workflow
  -> K1 Outcome event model
  -> S1 Runtime health dashboard data
  -> S2 Error alert policy
  -> R1 Secrets policy and scanner
  -> R2 PII classification
  -> R3 Permission model
  -> Founder-approved autonomy policy
```

### Parallel work

- `A1-A4`, `B1-B4`, and `L1` can proceed before real connectors.
- `O-PW1`, `O-KTM1`, `O-APT1`, `O-WEB1`, and `O-GOV1` can proceed as mission templates in parallel.
- `R1`, `R2`, and `P1` can proceed before campaign execution.
- `S1` can proceed using current runtime and validation outputs.

### Blocked work

- Source connectors that require accounts, paid APIs, or legal review: blocked until credentials and approvals exist.
- Contact enrichment: blocked until PII policy and legal source approval.
- Email sending: blocked until compliance, suppression, approvals, provider credentials, and kill switch.
- Credit app: blocked until legal/compliance approval.
- Autonomous execution: blocked until campaign approval workflow, observability, CRM, learning, and Founder autonomy policy exist.

### Highest-priority task

`A1 - Founder conversation state`

Reason: It is the smallest missing layer that turns the Chief of Staff from one-shot mission creation into a usable operating partner. It unlocks mission activation, review UX, and future backlog-driven engineering selection.

### Highest business value task

`C2 - Commercial property source connector v1`

Reason: It feeds the current highest cash-flow mission: commercial pressure washing jobs within 500 miles of Beaumont.

### Highest engineering value task

`B1 - Backlog reader and task selector`

Reason: It lets the Engineering Director consume this document and select unblocked work automatically, reducing future dependence on manual prompts.

---

## Revenue Prioritization Rules

When multiple tasks are unblocked:

1. Prefer tasks that generate or qualify pressure washing revenue.
2. Then prefer tasks that find KTM industrial opportunities.
3. Then prefer tasks that find apartment workshop/sponsor relationships.
4. Then prefer tasks that improve mission review, opportunity approval, and contact discovery.
5. Only build scale infrastructure when it is required by a revenue path.
6. Never build autonomous sending before compliance, suppression, approval, CRM, observability, and kill switch exist.

---

## Overall Completion Estimate

| Measure | Estimate |
|---|---|
| Current completion | 32% |
| Remaining completion | 68% |
| Remaining engineering hours | 900-1,400 hours |
| Hours to first usable revenue product | 120-180 hours |
| Hours to approved campaign execution | 300-450 hours |
| Hours to safe autonomous email execution | 600-900 hours |
| Hours to full multi-business AI OS | 900-1,400 hours |

### Major milestones remaining

1. Founder conversation state and mission approval workflow
2. Mission-aware review board
3. Pressure washing and KTM source connectors
4. Contact discovery and CRM foundation
5. Opportunity review packets
6. Content draft generation
7. Campaign object and approval queue
8. Email compliance and suppression
9. Sending provider dry-run adapter
10. CRM updates and reply processing
11. Learning and analytics
12. Deployment, security, observability
13. Approved autonomous execution
14. Multi-company platform expansion

---

## Definition of Complete

Opportunity OS is complete when the Founder can describe a business goal in natural language and the system can safely plan, discover, qualify, contact, learn, and improve within configured approval boundaries.

### Required complete-state capabilities

- Understand Founder intent
- Ask only necessary clarification questions
- Create and activate missions
- Prioritize missions by cash flow, recurring revenue, upside, difficulty, and capacity
- Discover relevant business signals from real sources
- Convert observations into opportunities through the deterministic pipeline
- Rank opportunities by mission fit
- Discover contacts with provenance and compliance status
- Draft personalized outreach assets grounded in evidence
- Package campaigns for Founder approval
- Execute approved campaigns within rate, compliance, and kill-switch limits
- Process replies
- Update CRM
- Schedule follow-ups
- Learn from outcomes
- Improve rankings, messaging, offers, and targeting
- Operate multiple businesses from one OS
- Maintain audit trails, validation, backups, alerts, and security controls

### Day-in-the-life scenario

The Founder opens Opportunity OS and says:

> I need to replace my job. Prioritize commercial pressure washing near Beaumont, keep KTM industrial opportunities running in the background, and start building apartment workshop relationships. I can travel 500 miles. I want every offer to eventually support 10,000 personalized emails per month, but do not send anything without approval.

Opportunity OS responds:

1. The AI Chief of Staff extracts intent and asks only for missing revenue, budget, and capacity constraints.
2. The Mission Planner creates three active missions: Pressure Washing, KTM Industrial, Apartment Workshops.
3. The Strategy Generator defines buyer types, source signals, ignored signals, channels, and success metrics.
4. The Engineering Director identifies missing system work and selects the highest-value unblocked task.
5. Business Discovery ingests commercial property, industrial, and apartment signals.
6. The deterministic pipeline creates facts, graph records, situations, problems, capability matches, offer recommendations, and opportunities.
7. Mission Control ranks opportunities by mission fit and explains why each matters.
8. Contact Discovery finds decision makers with source provenance and compliance flags.
9. Content Generation drafts personalized email, call, and visit assets.
10. The Campaign Engine packages contacts, assets, and sequences for Founder approval.
11. The Founder approves selected campaigns.
12. Email infrastructure sends within configured caps, suppression, unsubscribe, and kill-switch policies.
13. Replies are processed into CRM outcomes.
14. Follow-ups are scheduled.
15. Learning Engine updates recommendations from wins, losses, replies, and objections.
16. The next morning, the Chief of Staff briefs the Founder on revenue progress, blockers, and the next best action.

---

## Backlog Consumption Rules

Future agents must use this process:

1. Read this backlog.
2. Read current phase docs.
3. Inspect git state.
4. Identify unblocked tasks.
5. Select the highest business-value task whose dependencies are met.
6. Explain why that task was selected.
7. Implement only the selected task.
8. Run declared validation.
9. Repair regressions.
10. Update docs.
11. Commit successful work when requested or when operating under an explicit autonomous development charter.
12. Stop if credentials, legal approval, irreversible business decisions, or insufficient repository information are required.

---

## Permanent Rule

This backlog is subordinate to the Constitution and architecture boundaries.

If a backlog task conflicts with runtime boundaries, approval gates, OpenClaw rules, security policy, or validation integrity, the task is blocked until the conflict is resolved by explicit Founder approval and documentation updates.
