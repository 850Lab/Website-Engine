# Founder Decisions Registry

**Purpose:** Audit trail of Founder approvals that unblock engineering and operations.  
**Related:** [Operational Launch Checklist](../opportunity-os/36-operational-launch-checklist.md)

---

## 2026-06-30 — Launch readiness bundle

| ID | Decision | Evidence |
|---|---|---|
| F-1 | Privacy Policy published | `/privacy` · `docs/legal/privacy-policy.md` |
| F-2 | Production hosting: Vercel + Blob | `docs/legal/operations-policy.md` |
| F-3 | Mission #1: Commercial PW, Beaumont 500 mi, $20k/mo, Founder approves all outreach | `runtime/missions/` · `mission_pressure_washing_beaumont_500` |
| F-4 | Google Maps Platform API key provisioned | `GOOGLE_MAPS_API_KEY` · GCP project “Leads” |
| F-5 | PII / business contact data policy approved | `/legal/pii` · `docs/legal/pii-policy.md` |
| F-6 | Email and outreach compliance policy approved | `/legal/email-compliance` · `docs/legal/email-compliance-policy.md` |
| F-7 | ESP + sending domain approved (Resend + pivotalwebsites.com) | `docs/legal/operations-policy.md` · Vercel env |
| F-8 | Outreach approval policy documented | `/legal/outreach-approval` · `docs/legal/outreach-approval-policy.md` |
| F-9 | `PUBLIC_BASE_URL=https://www.pivotalwebsites.com` | `docs/legal/operations-policy.md` |
| F-10 | Backup (Vercel Blob + Git) and alerts (email to privacy@) | `docs/legal/operations-policy.md` |
| BD-8 | Source connector policy approved | `/legal/source-connectors` · `docs/legal/source-connector-policy.md` |
| DEP-6 | Operator session auth for CEO/operator UI | `docs/legal/operations-policy.md` |

---

## Deferred (not required for PW launch)

- KTM / industrial paid sources (`C3`)
- Apartment data vendors (`C4`)
- Government contractor registration (`O-GOV1`)
- SMS A2P (`ALLOW_REAL_SMS_SEND=false`)
- Credit app products (`O-CR1`, `O-CR2`)
- Autonomous email without per-campaign approval

---

## Amendment

Add a row when the Founder makes a new blocking decision. Update linked policy documents and backlog stop conditions when approvals clear engineering tasks.
