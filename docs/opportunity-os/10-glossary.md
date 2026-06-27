# 10 — Glossary

**Status:** Constitution · Terminology  
**Related:** [Ontology](./02-ontology.md) · [Master Vision](./00-master-vision.md) · [Capability Registry](./05-capability-registry.md)

Use these terms consistently across code, docs, and AI prompts.

---

| Term | Definition |
|---|---|
| **Opportunity OS** | The AI Operating System defined by this Constitution |
| **Capability** | What the company can deliver; internal truth — [05](./05-capability-registry.md) |
| **Offer** | Commercial packaging of capabilities for sale |
| **Problem** | Expensive emerging need; primary unit of reasoning |
| **Signal** | Immutable observation that the world changed |
| **Fact** | Structured claim extracted from signals |
| **Entity** | Company, person, facility, project, or contract in the graph |
| **Opportunity** | Actionable economic bet with score vector and evidence |
| **Score vector** | Independent subscores; never collapse to one number in UI |
| **CEO Mode** | Weight preset over score engines — [06](./06-decision-engine.md) |
| **Score Council** | Collection of independent scoring engines |
| **Execution Plan** | How to win a specific opportunity |
| **Projection** | UI/CRM view of engine/graph truth — not authoritative |
| **Engine** | `src/engine/` — runtime source of truth for opportunity logic |
| **Schema** | `src/schema/` — locked persistence entities |
| **Services** | `src/services/` — schema access and migration layer |
| **Legacy store** | Pre-schema JSON (`qualified-businesses.json`, etc.) — transitional |
| **Id-bridge** | Maps legacy IDs to schema IDs — transitional |
| **Dual-read** | Parity validation between legacy and schema reads |
| **Dual-write** | Writing to legacy and schema during migration |
| **Graph Writer** | Sole service allowed to mutate knowledge graph truth |
| **Evidence chain** | Signal → fact → problem → opportunity provenance path |
| **Fan-out** | One signal producing multiple opportunities |
| **Radar** | Ranked opportunity projection (`buildOpportunityRadar`) |
| **Mission** | CEO focus context driving system priority — not a task list |
| **Outcome** | Win/loss/revenue result feeding learning |
| **Learning** | Model/playbook update from outcomes |
| **Forecast** | Forward prediction of problem emergence |
| **Autonomy level** | Policy tier for human approval vs auto dispatch |
| **Tier-0/1/2/3 processing** | Rules → embeddings → small LLM → frontier LLM |
| **Industry** | Tag on entities — not primary ontology axis |
| **Buyer** | Entity type or role that purchases a capability |
| **Constitution** | `docs/opportunity-os/` — permanent architecture law |

---

## Deprecated Terms (Do Not Use in New Work)

| Deprecated | Use instead |
|---|---|
| Lead (as primary object) | Opportunity or Entity |
| Website OS / PW OS | Capability + projection |
| Hot lead | Scored opportunity in CEO mode |
| Single opportunity score | Score vector + composite |

---

## Abbreviations

| Abbr | Meaning |
|---|---|
| **OS** | Operating System (this project) |
| **KTM** | Capability: labor and safety support |
| **PW** | Capability: exterior cleaning (legacy folder name) |
| **CON** | Certificate of Need (healthcare) |
| **RFP** | Request for Proposal |
| **ACV / TCV** | Annual / Total contract value |
| **HSE** | Health, Safety, Environment |
