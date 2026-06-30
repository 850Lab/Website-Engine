# 32 - AI Chief of Staff

**Status:** Phase 4.1 architecture - design document  
**Related:** [AI Agents](./12-ai-agents.md) - [Runtime Data Boundaries](./24-runtime-data-boundaries.md) - [Autonomous Operating Loop](./28-autonomous-operating-loop.md) - [OpenClaw Constitution](./29-openclaw-constitution.md) - [OpenClaw Job Schema](./30-openclaw-job-schema.md)

---

## Purpose

This document defines the **AI Chief of Staff**: the missing human-to-Opportunity-OS layer.

Opportunity OS should not scan the world for random interesting opportunities. It should first understand what the Founder wants, convert that intent into structured missions, then configure the existing pipeline around those missions.

Canonical control flow:

```text
Founder
  -> AI Chief of Staff
  -> Intent Engine
  -> Clarification Engine
  -> Mission Planner
  -> Strategy Generator
  -> Opportunity OS
  -> OpenClaw / Future Execution
```

This is a **planning and translation layer**, not an outreach system and not a replacement reasoning engine.

---

## 1. What the AI Chief of Staff Is

The AI Chief of Staff is the Founder-facing strategic interface for Opportunity OS.

It converts plain language such as:

- "I need to replace my job."
- "Pressure washing is my priority."
- "KTM has the biggest upside."
- "I want 10,000 emails/month per offer."
- "I'm willing to travel 500 miles."

into structured objects the machine can use:

- Intent objects
- Mission objects
- Strategy objects
- Engineering task objects
- Approval-gated execution plans

The Chief of Staff is allowed to reason about the Founder's goals, ask questions, propose priorities, and create plans. It is not allowed to execute business actions by itself.

---

## 2. What Problem It Solves

Opportunity OS currently has strong internal machinery:

- Sensors
- Signal registry
- Fact builder
- Knowledge graph
- Situation and problem inference
- Capability matching
- Offer intelligence
- Opportunity factory
- Job/Event runtime
- Validation framework
- OpenClaw bounded workers

The missing layer is **Founder intent**.

Without this layer, the system can produce technically valid opportunities that are not aligned with the Founder:

- Too random
- Too broad
- Too low value
- Too difficult to execute
- Not tied to current cash-flow needs
- Not tied to the right offer
- Not tied to current geography, equipment, team, budget, or time horizon

The AI Chief of Staff solves this by making the Founder the source of operating direction.

---

## 3. Founder Conversation Model

The Founder communicates in normal business language. The system responds by interpreting, clarifying, structuring, and confirming.

### Conversation loop

```text
Founder statement
  -> intent extraction
  -> missing constraint detection
  -> clarification questions
  -> structured mission draft
  -> Founder confirmation
  -> validated mission registry entry
  -> strategy and engineering plan
```

### Example

Founder:

> I need to replace my job.

Chief of Staff:

> I can help. I need a few constraints before creating missions:
> - What monthly income replaces your job?
> - What timeframe matters most?
> - Which offers are currently deliverable?
> - How far are you willing to travel?
> - Should I prioritize fast cash, highest upside, or long-term compounding?

The Chief of Staff must not guess critical constraints. It may infer obvious context, but it must ask for missing fields that affect business execution.

---

## 4. Intent Engine

The Intent Engine extracts structured meaning from the Founder's language.

It identifies:

- Primary goal
- Business mode
- Offer focus
- Revenue target
- Time horizon
- Geography
- Risk tolerance
- Scale objective
- Constraints
- Implied missions
- Required engineering work

### Example interpretations

| Founder statement | Extracted intent |
|---|---|
| "Pressure washing is my priority." | Prioritize commercial pressure washing mission |
| "KTM has the biggest upside." | Increase priority for KTM industrial mission |
| "I want 10,000 emails/month per offer." | Scale requirement for future outreach infrastructure |
| "I'm willing to travel 500 miles." | Geography radius constraint |
| "I need to replace my job." | Cash-flow replacement objective requiring multi-mission planning |

The Intent Engine may use an LLM for language interpretation, but the output must be validated before it affects runtime or planning.

---

## 5. Clarification Engine

The Clarification Engine decides what the system still needs before creating a mission.

It asks short questions when required information is missing.

### Required clarification topics

- Revenue goal
- Timeframe
- Geography and travel radius
- Offer or business line
- Buyer type
- Delivery capacity
- Budget
- Approval policy
- Risk tolerance
- Scale target

### Critical rule

The system must never guess execution-critical constraints.

Examples:

- If revenue target is missing, ask.
- If geography is missing, ask.
- If the offer is ambiguous, ask.
- If a scale target implies email execution, ask about approval and compliance.
- If a capability is not in the registry, reject or ask for confirmation before adding future work.

---

## 6. Mission Planner

The Mission Planner converts clarified intent into one or more missions.

A mission is a machine-executable objective that configures the rest of Opportunity OS.

Mission examples:

- Commercial pressure washing cash mission
- KTM industrial maintenance opportunity mission
- Apartment financial workshop campaign mission
- Website agency lead-generation mission
- Government contract exploration mission

The Mission Planner supports multiple simultaneous active missions. It should not force one global priority across the whole OS.

---

## 7. Strategy Generator

The Strategy Generator creates the operating strategy for each mission.

It recommends:

- Priority buyer types
- Industries
- Search signals
- Ignored signals
- Preferred channels
- Offer positioning
- Constraints
- Success metrics
- First engineering tasks
- Recommended next actions

The Strategy Generator does not execute strategy. It prepares a validated plan for Opportunity OS and future execution systems.

---

## 8. Mission Registry

The Mission Registry stores active, paused, and archived missions.

The registry is the machine-readable operating agenda for Opportunity OS.

### Responsibilities

- Store mission specs
- Track mission status
- Support multiple active missions
- Provide mission context to opportunity ranking
- Preserve Founder approval policies
- Record strategy and constraints

### States

| State | Meaning |
|---|---|
| `draft` | Mission exists but is not active |
| `active` | Mission should shape opportunity detection and ranking |
| `paused` | Mission preserved but not currently prioritized |
| `archived` | Historical mission retained for audit |

---

## 9. Engineering Director

The Engineering Director turns Founder objectives into engineering tasks without writing code itself.

It answers:

- What is missing from the OS to achieve this mission?
- Which module owns that missing capability?
- Is the missing work business-mode or engineering-mode?
- Which future phase should contain it?
- Can OpenClaw safely receive a bounded implementation task?

### Engineering task examples

- Add a permit source connector
- Add opportunity review board UI
- Add CSV export for reviewed opportunities
- Add contact discovery module
- Add email compliance gate
- Add campaign send queue

The Engineering Director may create task specs for OpenClaw, but OpenClaw remains bounded by its own constitution and approval gates.

---

## 10. Relationship to OpenClaw

OpenClaw is not the Chief of Staff.

| Layer | Role |
|---|---|
| AI Chief of Staff | Understand Founder intent, create missions, prepare engineering tasks |
| OpenClaw Builder | Execute approved code-building jobs within strict file scopes |
| OpenClaw QA | Review approved outputs and validate constraints |

The Chief of Staff may propose OpenClaw jobs, but it may not:

- Run OpenClaw directly
- Modify OpenClaw constraints
- Bypass OpenClaw QA
- Expand OpenClaw file scopes
- Use OpenClaw to launch outreach

All OpenClaw work remains one approved job at a time.

---

## 11. Relationship to Existing Opportunity OS Pipeline

The AI Chief of Staff sits above the pipeline.

It does not replace:

- Sensors
- Signal registry
- Fact builder
- Knowledge graph
- Situation builder
- Problem inference
- Capability matcher
- Offer intelligence
- Opportunity factory
- Job/Event runtime
- Processor
- Orchestrator

Instead, it configures the pipeline by supplying mission context.

### Mission-aware pipeline behavior

Future Opportunity OS stages should use missions to:

- Filter signal priority
- Rank opportunities by mission fit
- Suppress irrelevant opportunities
- Explain why an opportunity matters
- Recommend the next action
- Determine which opportunities require Founder review first

The pipeline remains deterministic. The LLM may create mission context, but deterministic modules decide validity and execution eligibility.

---

## 12. Business-Mode Responsibilities

In business mode, the AI Chief of Staff helps the Founder decide what to pursue.

Responsibilities:

- Understand goals
- Clarify constraints
- Prioritize missions
- Recommend which offer to push
- Recommend which buyer segments matter
- Recommend which signals to watch
- Translate cash-flow goals into operating targets
- Compare missions by urgency, upside, execution difficulty, and capacity
- Prepare Founder-ready summaries

Business mode produces decisions and plans, not runtime execution.

---

## 13. Engineering-Mode Responsibilities

In engineering mode, the AI Chief of Staff helps the Founder decide what must be built.

Responsibilities:

- Identify missing system capabilities
- Convert business needs into engineering tasks
- Assign likely owning module
- Define validation expectations
- Identify safety gates
- Sequence phases
- Prepare bounded OpenClaw task specs
- Flag risks before implementation

Engineering mode produces task objects and phase recommendations. It does not modify source code by itself.

---

## 14. What the LLM May Do

The LLM may:

- Interpret plain language
- Ask clarifying questions
- Create structured intent
- Create mission drafts
- Recommend strategy
- Recommend priorities
- Create engineering task drafts for OpenClaw
- Prepare plans
- Summarize missions
- Explain tradeoffs
- Detect missing constraints
- Suggest future phases

All LLM outputs must pass validation before becoming active operating context.

---

## 15. What the LLM May Never Do

The LLM may never:

- Launch outreach
- Send emails
- Send texts
- Place calls
- Bypass approval gates
- Modify runtime directly
- Execute jobs directly
- Invent capabilities not in the registry
- Ignore validation
- Make irreversible business decisions
- Call OpenClaw directly
- Change OpenClaw policy
- Modify Scheduler, Processor, Orchestrator, or Pipeline behavior directly
- Create opportunities directly
- Write facts, signals, problems, or opportunities directly
- Change `engine-data/` during runtime

The LLM is an interpreter and planner. It is not an autonomous operator.

---

## 16. Mission Object Schema

```json
{
  "missionId": "mission_pressure_washing_cash",
  "schemaVersion": "4.1.0",
  "name": "Commercial Pressure Washing Cash Mission",
  "goal": "Generate commercial pressure washing revenue within 500 miles of Beaumont, TX.",
  "status": "active",
  "priority": "high",
  "businessMode": "cash_flow",
  "revenueTarget": {
    "amount": 20000,
    "currency": "USD",
    "period": "month"
  },
  "deadline": "90 days",
  "geography": [
    {
      "label": "Beaumont, TX",
      "city": "Beaumont",
      "state": "TX",
      "country": "US",
      "radiusMiles": 500
    }
  ],
  "industries": ["Commercial Property Services"],
  "buyerTypes": ["Restaurants", "Retail", "Office", "Medical", "Industrial"],
  "offers": ["offer_pressure_washing"],
  "capabilities": ["exterior_cleaning"],
  "constraints": ["Commercial only", "4 GPM cold water equipment", "No outreach without approval"],
  "requiredSignals": ["Business openings", "Store remodels", "Property management", "Shopping centers"],
  "ignoredSignals": ["Residential", "Roofs", "Dumpster pads"],
  "preferredChannels": ["Email", "Cold Call", "Visit"],
  "approvalPolicy": {
    "requireFounderApprovalBeforeOutreach": true,
    "maxAutonomousActionsPerDay": 0,
    "allowDraftAssetGeneration": false
  },
  "successMetrics": {
    "qualifiedOpportunitiesPerWeek": 25,
    "quotedJobsPerMonth": 20,
    "revenuePerMonth": 20000
  },
  "strategyId": "strategy_pressure_washing_cash",
  "notes": "Prioritize realistic, executable commercial jobs over interesting but low-fit opportunities."
}
```

---

## 17. Intent Object Schema

```json
{
  "intentId": "intent_...",
  "source": "founder_chat",
  "rawText": "I need to replace my job.",
  "detectedGoals": ["replace_job_income", "cash_flow"],
  "businessLinesMentioned": ["pressure_washing", "ktm_industrial", "apartment_workshops"],
  "constraintsMentioned": [
    {
      "type": "geography_radius",
      "value": 500,
      "unit": "miles",
      "anchor": "Beaumont, TX"
    }
  ],
  "scaleTargets": [
    {
      "type": "email_volume",
      "value": 10000,
      "period": "month",
      "scope": "per_offer"
    }
  ],
  "missingFields": ["monthly_income_target", "available_budget"],
  "confidence": 0.84,
  "requiresClarification": true,
  "createdAt": "2026-06-29T00:00:00.000Z"
}
```

---

## 18. Strategy Object Schema

```json
{
  "strategyId": "strategy_ktm_industrial",
  "missionId": "mission_ktm_industrial",
  "summary": "Prioritize industrial maintenance, turnaround, safety, and staffing opportunities for KTM.",
  "priorityBuyers": ["Refineries", "Petrochemical plants", "Industrial contractors", "Maintenance contractors"],
  "recommendedSearchSignals": ["Turnarounds", "Shutdowns", "Refinery expansion", "Maintenance windows", "Staffing shortages"],
  "ignoredSignals": ["Residential", "Retail storefronts"],
  "recommendedChannels": ["Email", "Phone", "Visit"],
  "rankingWeights": {
    "missionFit": 0.35,
    "commercialValue": 0.25,
    "urgency": 0.2,
    "executionDifficulty": 0.1,
    "confidence": 0.1
  },
  "recommendedNextActions": ["Find real source feeds", "Create review board", "Prepare contact discovery requirements"],
  "createdAt": "2026-06-29T00:00:00.000Z"
}
```

---

## 19. Engineering Task Object Schema

```json
{
  "taskId": "engtask_source_connector_permits_v1",
  "missionId": "mission_pressure_washing_cash",
  "title": "Add commercial permit source connector",
  "mode": "engineering",
  "ownerModule": "engine/sensors",
  "phase": "4.2",
  "problem": "The mission needs real-world commercial property signals, but only file-drop input exists.",
  "scope": {
    "allowedPaths": ["src/engine/sensors/", "scripts/opportunity-engine/", "docs/opportunity-os/"],
    "forbiddenPaths": ["src/engine/openclaw/", "src/engine/processor/", "src/engine/orchestrator/"]
  },
  "acceptanceCriteria": [
    "Connector writes observations only",
    "No opportunities created directly",
    "Validation uses isolated runtime",
    "Founder approval gates unchanged"
  ],
  "approvalRequired": true,
  "openClawEligible": true,
  "status": "proposed"
}
```

---

## 20. Example: Pressure Washing Cash Mission

Founder:

> Pressure washing is my priority. I need commercial jobs within 500 miles of Beaumont.

Chief of Staff interpretation:

- Goal: generate cash from commercial pressure washing
- Offer: exterior cleaning
- Geography: 500 miles from Beaumont, TX
- Buyer types: restaurants, retail, office, medical, industrial
- Required signals: remodels, openings, property management, shopping centers
- Ignored signals: residential, roofs, dumpster pads
- Channels: email, cold call, visits

Clarification questions:

- What monthly revenue target should this mission optimize for?
- What equipment and crew capacity are available?
- What job sizes are too small to pursue?
- Is the Founder willing to travel for one-off jobs or only contracts?

Output:

- One active mission
- One strategy
- Engineering tasks for source feeds and review UI
- No outreach launched

---

## 21. Example: KTM Industrial Opportunity Mission

Founder:

> KTM has the biggest upside. Find industrial maintenance opportunities.

Chief of Staff interpretation:

- Goal: win industrial maintenance and safety support work
- Offer: KTM manpower and safety support
- Signals: shutdowns, turnarounds, refinery expansion, maintenance windows, staffing shortages
- Buyer types: refineries, petrochemical plants, industrial contractors, maintenance contractors
- Geography: ask if missing
- Priority: high

Clarification questions:

- What region should KTM target first?
- What contract size matters?
- Which services are deliverable now: fire watch, hole watch, labor, maintenance, safety?
- Are union, certification, or insurance constraints relevant?

Output:

- KTM mission
- Industrial strategy
- Mission-aligned opportunity ranking
- Engineering tasks for permit/news/RFP sources

---

## 22. Example: Apartment Financial Workshop Mission

Founder:

> I need apartment complexes that will allow me to host financial workshops and recruit local sponsors.

Chief of Staff interpretation:

- Target: apartment complexes
- Decision makers: property managers, regional managers, owners
- Offer: financial workshop
- Revenue model: sponsor acquisition
- Goal: apartment acquisition campaign
- Signals: resident events, property management changes, community programs

Clarification questions:

- What geography should this start in?
- What sponsor categories matter?
- What workshop topic and promise should be used?
- What proof or credentials are available?
- What is the target number of apartment communities per month?

Output:

- Apartment workshop mission
- Sponsor strategy
- Engineering tasks for contact discovery and campaign review
- No automatic emails

---

## 23. Example: "Replace My Job" Multi-Mission Plan

Founder:

> I need to generate enough cash flow over the next 90 days to replace my job. I can provide pressure washing services, pursue industrial safety and maintenance contracts through KTM, and run financial workshops for apartment communities. Prioritize opportunities within 500 miles of Beaumont, Texas. Build missions that maximize revenue, recommend the best offers for each mission, and prepare the system to eventually execute up to 10,000 personalized emails per month per offer - but do not launch outreach without my approval.

Chief of Staff interpretation:

- Top-level objective: replace job income
- Timeframe: 90 days
- Geography: 500 miles from Beaumont, TX
- Missions:
  1. Commercial pressure washing cash mission
  2. KTM industrial opportunity mission
  3. Apartment financial workshop sponsor mission
- Scale target: 10,000 personalized emails/month/offer
- Approval gate: outreach prohibited without Founder approval

Clarification questions:

- What exact monthly income replaces the job?
- Which mission should get the first 14 days of attention?
- What budget is available for data, tools, and sending infrastructure?
- What offers are ready to sell today?
- What compliance standards should email execution follow?

Output:

- Multi-mission portfolio
- Ranked mission priorities
- Engineering backlog
- Source connector plan
- Review board requirement
- Email execution prerequisites

---

## 24. Approval Gates

Approval gates protect the Founder and the business.

| Gate | Required before |
|---|---|
| Founder confirms mission | Mission becomes active |
| Founder approves strategy | Strategy affects ranking or source priority |
| Founder approves engineering task | OpenClaw or any agent receives implementation work |
| Founder approves opportunity | Outreach assets can be prepared |
| Founder approves campaign | Any email, text, call, or visit task can be queued |
| Compliance approval | High-volume email infrastructure can send |

Default policy:

```json
{
  "requireFounderApprovalBeforeOutreach": true,
  "maxAutonomousActionsPerDay": 0,
  "allowDraftAssetGeneration": false
}
```

---

## 25. Stop Conditions

The AI Chief of Staff must stop and ask for approval when:

- A mission lacks revenue target, geography, offer, or buyer type
- A requested capability is not in the registry
- The Founder asks for outreach execution
- The Founder asks for 10,000 emails/month but compliance infrastructure is missing
- A task would modify OpenClaw policy
- A task would modify Scheduler, Processor, Orchestrator, or Pipeline
- A task would write to `engine-data/`
- A mission requires irreversible business action
- An LLM output fails validation
- The system cannot explain why an opportunity matches a mission

---

## 26. Future Phases Required to Implement This

### Recommended Phase 4.2 - Mission Runtime + Review Board

Build the product surface that lets the Founder:

- Chat with the AI Chief of Staff
- Review structured intent
- Answer clarifying questions
- Approve missions
- See active missions
- Rank opportunities by mission fit

No outreach execution.

### Recommended Phase 4.3 - Source Connectors v1

Add the first mission-aware source connectors:

- Permit feeds
- Public news/RSS
- RFP/bid feeds
- Commercial property signals

Connectors write observations only.

### Recommended Phase 4.4 - Contact Discovery + Campaign Preparation

Add mission-aware contact discovery and campaign preparation:

- Buyer/contact matching
- Decision-maker enrichment
- Outreach asset drafts
- Campaign review packets
- Compliance checks

Still no automatic sending without approval.

### What Must Be Built Before Autonomous Email Execution

Before autonomous email execution, the OS needs:

- CEO review board
- Mission approval UI
- Opportunity approval workflow
- Contact discovery validation
- Email compliance policy
- Unsubscribe handling
- Sending domain and deliverability setup
- Rate limits
- Suppression lists
- Reply processing
- CRM update rules
- Audit logs
- Error alerts
- Kill switch
- Human approval gate for campaign launch

### What the Founder Can Do Once This Layer Is Implemented

Once the AI Chief of Staff layer is implemented, the Founder will be able to:

- Speak business goals in plain language
- Turn goals into validated missions
- Run multiple active missions at once
- Prioritize pressure washing, KTM, apartments, or future offers
- Set cash-flow, geography, and scale constraints
- See what the OS needs to build next
- Generate OpenClaw-ready engineering task specs
- Rank opportunities by mission fit
- Prepare for high-volume execution safely
- Keep outreach blocked until explicitly approved

---

## Final Rule

The AI Chief of Staff makes Opportunity OS strategic. It does not make Opportunity OS autonomous.

Autonomy begins only after mission, opportunity, campaign, compliance, and Founder approval gates exist.
