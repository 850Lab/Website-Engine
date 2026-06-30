# 20 — Project History

**Status:** Constitution · Evolution narrative  
**Related:** [Master Vision](./00-master-vision.md) · [Build Log](./09-build-log.md) · [Folder Map](./13-folder-map.md)

Explains **why** the architecture evolved — not just what exists.

---

## Era 1 — Website Outreach Engine

**Approximate period:** Project inception through 2025

**What was built:**
- Local business discovery via Google Maps adapters
- Website quality scoring and qualification (`stage1/`)
- Angle analysis and sales brief generation
- Preview site generation (`v7/`, `preview-v3.js`)
- Outreach queues tied to `qualified-businesses.json`
- Operator sales mode for website offer outreach

**Architectural character:**
- Single-product tool: *find businesses with bad websites and sell them a better one*
- Business-list-centric data model
- Industry implied by search targets, not problem ontology

**Why it made sense then:** Validated discovery, qualification, and operator workflow before generalizing.

---

## Era 2 — Pressure Washing Vertical

**Approximate period:** 2025

**What was built:**
- Parallel product silo: `pressure-washing-leads.json`, PW queue, PW mobile UI
- Separate scoring, statuses, discovery scripts
- Shared focus system (`outreach-focus.json`) across verticals

**Architectural character:**
- **Dual-product CRM** sharing server but not unified intelligence
- Copy-paste patterns from website stack

**Why it happened:** Revenue diversification required fast vertical launch, not platform rewrite.

**Debt created:** Industry/product silos contradict Opportunity OS vision — explicitly transitional per [Architecture Rules R10](./07-architecture-rules.md).

---

## Era 3 — KTM Opportunity Discovery

**Approximate period:** 2025–2026

**What was built:**
- KTM manpower offer in strategic planning
- `engine-data/markets/markets.json` with industrial buyer markets
- Market analysis from existing business database
- KTM opportunity report generation
- Recognition that **Commercial Construction** in database enables faster validation than greenfield institutional sales

**Architectural character:**
- Shift from *lists* toward *market opportunity sizing*
- Still buyer/industry framed, not problem-centric

**Why it mattered:** Proved engine-data + database evidence could rank **economic** opportunities, not just call lists.

---

## Era 4 — Locked Schema & Migration (Outreach OS)

**Approximate period:** 2026

**What was built:**
- Eight locked entities: Offer, Campaign, Business, Contact, Opportunity, QueueItem, Attempt, LearningReport
- Migration scripts from legacy JSON
- `src/services/` layer with feature flags
- Schema queue reads and outcome dual-writes
- Id-bridge for legacy ID compatibility
- Production validation scripts and diagnostics

**Architectural character:**
- **Strangler fig migration** — schema truth emerging while legacy operates
- Dual-read/dual-write parity discipline

**Why it was necessary:** Could not build OS on inconsistent JSON stores forever; needed stable entities for engine projection.

---

## Era 5 — Capability-Driven Opportunity OS (Current)

**Approximate period:** 2026 (present)

**What was built:**
- `src/engine/` module family
- Industry discovery, opportunity factory, intelligence radar
- Pivotal OS executive home wired to `buildOpportunityRadar()`
- AI Constitution (`docs/opportunity-os/`)

**Architectural character:**
- **Problem-capability-opportunity spine** defined in Constitution
- Legacy stacks remain as projections/adapters
- Phase 0: law before velocity

**Why the architecture evolved:**

| From | To | Reason |
|---|---|---|
| Business lists | Signals → facts → problems | World changes; lists don't explain *why* |
| Industry silos | Capabilities | Same company sells labor, cleaning, web, safety |
| One product score | Score council + CEO modes | CEOs optimize different objectives |
| CRM records | Opportunities with evidence | Need auditable economic bets |
| Manual queues | Execution plans | Need *how to win*, not *who to call* |

---

## Repository Name vs Vision

**Package:** `website-outreach-engine` (historical)  
**Vision:** Opportunity Operating System  

Rename deferred — [Future Ideas](./19-future-ideas.md).

---

## What Must Not Repeat

1. Building parallel product brains (`website/*`, `pw/*`) for each new capability  
2. Treating JSON CRM files as permanent truth  
3. Single-score ranking without evidence  
4. Skipping Constitution before feature sprints  

---

## Next Historical Entry (Pending)

**Phase 0 approval → Phase 1 Executive OS** — document in [Build Log](./09-build-log.md) upon owner sign-off.

---

## Reading Order for New Engineers

1. [Master Vision](./00-master-vision.md)  
2. [Project History](./20-project-history.md) (this document)  
3. [Folder Map](./13-folder-map.md)  
4. [Current Phase](./08-current-phase.md)  
5. Active phase in [Roadmap](./01-roadmap.md)

---

## Launch Readiness Reading Path (Founder / Operations)

After the architecture constitution (`00`–`31`, plus `32`–`34`):

1. [Deployment Readiness Report](./35-deployment-readiness.md) — assessment, external dependencies, risks  
2. [Operational Launch Checklist](./36-operational-launch-checklist.md) — living dashboard, blockers, gated launch checklist
