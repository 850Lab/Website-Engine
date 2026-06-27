# 19 — Future Ideas

**Status:** Parking lot · NOT architecture  
**Related:** [Roadmap](./01-roadmap.md) · [Architecture Rules R24](./07-architecture-rules.md)

Ideas live here until promoted into a **Roadmap phase** with exit criteria. **Do not implement from this document.**

---

## Product & Platform

- Rename npm package from `website-outreach-engine` to `opportunity-os`
- Multi-tenant SaaS — sell OS to other companies
- White-label Bloomberg-style terminal for partners
- External API marketplace for third-party capabilities
- Mobile native executive app (beyond Pivotal web shell)

---

## Data & Graph

- Dedicated graph database (Neo4j / Memgraph) vs Postgres+AGE — **decision needed Phase 2**
- Real-time event streaming bus (Kafka/Pulsar)
- National entity registry integration (DUNS, SAM.gov deep link)
- Satellite change detection pipeline
- Proprietary industry indices (Opportunity Index™)

---

## AI & Agents

- Multi-agent swarm for parallel research
- Fine-tuned models per capability vertical
- Voice-first executive interface
- Autonomous negotiation agent (high risk — defer)
- Self-healing extractors

---

## Capabilities & Markets

- Additional capabilities beyond registry v1
- International expansion (non-US signals)
- Insurance/adjacency capabilities
- Private equity portfolio monitoring mode

---

## Legacy Extraction

- Extract v7 preview/customer product to separate repository
- Demolish `qualified-businesses.json` after B1 cutover
- Remove dual-read layer entirely
- Archive `mission-control` as reference adapter

---

## Compliance & Enterprise

- SOC 2 control matrix
- GDPR data subject workflows
- FedRAMP path (if ever required)
- Role-based access control matrix v2

---

## Promotion Process

1. Idea documented here  
2. Owner prioritizes into [Roadmap](./01-roadmap.md) phase  
3. Constitution amended if ontology/boundaries affected  
4. [Build Log](./09-build-log.md) entry on start  

**Rejected ideas** — strike through with reason, do not delete history.

---

## Currently Under Consideration

| Idea | Blocker |
|---|---|
| Graph DB choice | Phase 2 storage decision |
| `/api/os/*` namespace | Phase 1 API design |
| Package rename | Release / deploy coordination |

See implementation close-out **Architectural Ambiguities**.
