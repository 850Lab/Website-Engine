# 17 — Security

**Status:** Constitution · Security model  
**Related:** [AI Agents](./12-ai-agents.md) · [Architecture Rules](./07-architecture-rules.md) · [API Boundaries](./15-api-boundaries.md)

Existing notes: `docs/security-fixes.md` (legacy) — Constitution supersedes for OS design.

---

## Authentication

| Layer | Mechanism | Location |
|---|---|---|
| Operator UI | Session cookies, operator credentials | `src/operators/session.js` |
| API routes | `requireOperatorApi`, `requireOperatorPage` | `src/operators/middleware.js` |
| Worker jobs | Worker auth header | `src/worker-auth.js` |
| Admin | Owner role gate | `requireOwnerApi` |

**Rules:**
- No anonymous write access to execution or outcome endpoints in production
- Session secrets from environment — never committed
- Twilio webhooks validated per Twilio signature rules

---

## Authorization

| Resource | Policy |
|---|---|
| Opportunities (read) | Authenticated operator |
| Opportunities (approve) | Operator + future role matrix |
| Outcome write | Operator assigned or owner |
| Focus config PATCH | Owner / authorized role |
| Learning apply | Owner only |
| Capability registry edit | Owner / platform admin |
| Connector credentials | Ops role only |

**Future:** RBAC matrix aligned to CEO / sales / ops / read-only.

---

## Secrets

| Secret | Storage |
|---|---|
| Twilio keys | Env + optional blob settings store |
| Stripe keys | Env |
| Blob token | Env |
| DB connection | Env |
| Connector API keys | Secret manager (Phase 2+) — not in repo |

**Rule:** Never commit `.env`, credentials, or tokens. `scripts/seed-*` must not embed production secrets.

---

## Permissions Model (Target)

```
Role → allowed actions → autonomy max level
```

| Action type | Default autonomy |
|---|---|
| Read radar | Auto |
| Draft email/script | Auto draft |
| Send email/SMS | Human approve |
| Record call | Human initiate |
| Apply learning weights | Owner approve |
| Merge entity | Human approve if low confidence |

See [AI Agents](./12-ai-agents.md).

---

## Audit Logging

**Required events (Phase 1+):**
- Opportunity approved / rejected
- Execution plan approved
- Task dispatched
- Outcome verified (revenue)
- Learning applied
- Entity merge
- CEO mode change

**Each log entry:** `who`, `when`, `what`, `before`, `after`, `evidenceRef`

**Retention:** Minimum 7 years for revenue-related audit (configurable by legal).

---

## Human Approval Gates

| Gate | Trigger |
|---|---|
| **G1** | First contact to new buyer entity |
| **G2** | Estimated opportunity value > threshold |
| **G3** | Autonomy level escalation |
| **G4** | Learning weight change |
| **G5** | Entity merge across companies |

Autonomy policy stored in config — not hardcoded in agents.

---

## Data Protection

- PII in contacts — minimize exposure in logs  
- Raw captures may contain sensitive content — access controlled  
- Operator sessions expire  
- Production validation scripts must not log secrets — see `verify-production-schema-effect.js` patterns  

---

## AI-Specific Security

| Risk | Mitigation |
|---|---|
| Prompt injection in signal HTML | Sanitize; isolate extraction context |
| Fabricated evidence | Evidence assembler requires graph citations |
| Autonomous send | Auditor agent + G1–G3 gates |
| Model exfiltration | No secrets in prompts |

---

## Compliance Hooks (Future)

- Source ToS classification per connector  
- Call recording consent flows (Twilio)  
- Opt-out handling for outreach  

Details: [Future Ideas](./19-future-ideas.md) — not Phase 0–1 blockers.

---

## Incident Response

1. Disable autonomy dispatch globally (kill switch config)  
2. Preserve audit log and event spine  
3. Document in [Build Log](./09-build-log.md)  
