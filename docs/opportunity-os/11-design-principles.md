# 11 — Design Principles

**Status:** Constitution · Engineering philosophy  
**Related:** [Architecture Rules](./07-architecture-rules.md) · [Master Vision](./00-master-vision.md) · [Performance](./18-performance.md)

---

## Principles

### 1. Build reusable systems
Capabilities, scorers, and connectors are registered once and reused. No fork-per-vertical logic in new code.

### 2. Think in capabilities, not products
Website Growth and Exterior Cleaning are capabilities. They are not architectural boundaries.

### 3. Think in problems, not industries
Industries are tags. Problems drive matching, scoring, and execution.

### 4. Evidence before AI
Rules, facts, and graph traversal first. LLM is tiered escalation, not default parser.

### 5. Reason before execution
No outreach dispatch without problem hypothesis, score vector, and execution plan.

### 6. Everything must learn
Outcomes update weights, playbooks, and calibrations — not just dashboards.

### 7. Projections are disposable; truth is not
UI and CRM can be rewritten. Engine + graph semantics cannot drift casually.

### 8. One signal, many opportunities
Design for fan-out from day one.

### 9. Never one score
Expose score vectors. Composite rank is a mode-weighted view only.

### 10. Avoid premature optimization
Ship Phase exit criteria before graph databases, multi-agent fleets, or real-time everything.

### 11. Converge, don't parallelize truth
During migration, legacy is adapter — not second source of truth for new features.

### 12. Human gates for high stakes
Autonomy increases only with calibration evidence — [Security](./17-security.md).

### 13. Cost is architecture
Tiered processing and caching are design requirements — [Performance](./18-performance.md).

### 14. Constitution before code
Phase 0 exists because this repository already carries migration debt. Speed without law repeats silos.

---

## Anti-Patterns (Explicit)

| Anti-pattern | Why forbidden |
|---|---|
| CRM as source of truth | Records activity, not economic reasoning |
| Industry × offer matrix as core | Blocks multi-capability fan-out |
| LLM score with no engines | Not auditable for CEO decisions |
| New legacy JSON store | Expands migration debt |
| Feature without phase tag | Scope creep |

See [Future Ideas](./19-future-ideas.md) for deferred ambitions.
