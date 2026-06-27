# 12 — AI Agents

**Status:** Constitution · Future worker definitions (NOT implemented)  
**Related:** [Ontology](./02-ontology.md) · [Decision Engine](./06-decision-engine.md) · [Security](./17-security.md) · [Performance](./18-performance.md)

Agents are **bounded workers** with tools — not monolithic chatbots. Orchestration is event-driven DAGs, not open-ended loops.

---

## Agent Catalog

### Executive AI
| Attribute | Value |
|---|---|
| **Purpose** | CEO-facing narratives, mode explanations, opportunity briefings |
| **Reads** | Score vectors, evidence chains, mission config |
| **Writes** | None to truth; may draft narrative artifacts |
| **Model tier** | Medium |
| **Autonomy** | Read-only + draft summaries |
| **Phase** | 1+ |

---

### Research AI
| Attribute | Value |
|---|---|
| **Purpose** | Company/project research, fact gathering, source triangulation |
| **Reads** | Signals, web captures, graph |
| **Writes** | Fact proposals (pending validation) |
| **Model tier** | Medium → Frontier for synthesis |
| **Autonomy** | Create facts in **Extracted** state only |
| **Phase** | 2–3 |

---

### Sales AI (Execution AI — outbound)
| Attribute | Value |
|---|---|
| **Purpose** | Draft emails, call scripts, talk tracks grounded in evidence |
| **Reads** | Opportunity, plan, capability registry, playbooks |
| **Writes** | Task drafts; never sends without policy gate |
| **Model tier** | Small → Medium |
| **Autonomy** | Draft tier; dispatch requires approval |
| **Phase** | 4 |

---

### Operations AI
| Attribute | Value |
|---|---|
| **Purpose** | Capacity, cert, crew scheduling checks for Execution score |
| **Reads** | Operations data, capability requirements |
| **Writes** | Execution score inputs, blocker flags |
| **Model tier** | Rules + Small |
| **Autonomy** | Auto for scoring inputs |
| **Phase** | 4 |

---

### Marketing AI
| Attribute | Value |
|---|---|
| **Purpose** | Positioning variants, offer messaging by problem type |
| **Reads** | Capability registry, win/loss themes |
| **Writes** | Offer copy proposals (human approved) |
| **Model tier** | Medium |
| **Autonomy** | Draft only |
| **Phase** | 4+ |

---

### Forecasting AI
| Attribute | Value |
|---|---|
| **Purpose** | Predict problem emergence from precursors + indicators |
| **Reads** | Warehouse features, signal history, graph patterns |
| **Writes** | Forecast objects |
| **Model tier** | ML + Medium for qualitative tags |
| **Autonomy** | Auto generate; human reviews strategic forecasts |
| **Phase** | 5 |

---

### Learning AI
| Attribute | Value |
|---|---|
| **Purpose** | Calibrate probabilities, mine objections, update playbooks |
| **Reads** | Outcomes, transcripts (summarized), score history |
| **Writes** | Learning proposals → [Learning](./02-ontology.md#learning) objects |
| **Model tier** | ML primary; Medium for summarization |
| **Autonomy** | Propose; human applies weight changes |
| **Phase** | 5 |

---

## Supporting Workers (Technical Agents)

| Agent | Role | Phase |
|---|---|---|
| **Classifier** | Signal type and urgency | 2 |
| **Extractor** | Facts from raw captures | 2 |
| **Resolver** | Entity match and merge suggest | 2 |
| **Problemist** | Problem hypotheses from fact sets | 3 |
| **Economist** | Revenue/profit modeling | 3 |
| **Strategist** | Win probability, barriers | 3 |
| **Planner** | Execution plan builder | 4 |
| **Scribe** | Asset drafts | 4 |
| **Auditor** | Policy and compliance check | 4 |
| **Chronicler** | Call/meeting summaries | 5 |
| **Calibrator** | Score weight updates | 5 |
| **Narrator** | Evidence-linked CEO narratives | 1 |

See [03-knowledge-graph.md](./03-knowledge-graph.md) for graph write rules per agent.

---

## Agent Rules

1. No agent deletes signals or facts — archive only.
2. No agent sends external communications without **Auditor + policy gate**.
3. No agent modifies **Capability Registry** without human approval.
4. Every write includes `agentId`, `modelVersion`, `promptVersion`.
5. Agents read via Graph Reader — never bypass services.

---

## NOT in Scope (Phase 0)

Implementation, prompt libraries, tool SDKs, agent runtime. See [Roadmap](./01-roadmap.md).
