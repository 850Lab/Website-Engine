# Source Connector Policy

**Effective date:** June 30, 2026  
**Owner:** Founder — Pivotal Websites  
**Public URL:** `/legal/source-connectors`

---

## Purpose

Defines which external data sources Opportunity OS and legacy discovery tools may use for **business signals only** (observations → signals). Connectors must not write contacts, campaigns, or send outreach directly.

---

## Approved sources (Mission #1 — Pressure Washing)

| Source | Use | Requirements |
|---|---|---|
| **Google Maps / Places Platform API** | Commercial business discovery | `GOOGLE_MAPS_API_KEY`; respect Google Maps Platform Terms |
| **Legacy Playwright Maps scrape** | PW lead search CLI (`pw:find-leads`) | Manual/operator-initiated; rate-limit responsibly |
| **File-drop observations** | Testing and partner feeds | JSON inbox only; mission hints as metadata |
| **Legacy website scan JSON** | Website agency / quality signals | Read-only bridge (`O-WEB2`) |
| **Public business websites** | Qualification and angle analysis | robots.txt respected where practical |

---

## Conditionally approved (future missions — separate Founder approval)

| Source | Condition |
|---|---|
| Industrial news/RFP feeds | KTM mission + paid license + legal review |
| Apartment/property data vendors | Apartment mission + vendor ToS review |
| Government bid portals | `O-GOV1` registration complete |
| Contact enrichment APIs | PII policy + vendor contract (`D4`) |

---

## Prohibited sources

- Purchased consumer email lists unrelated to business role
- Sources whose terms prohibit automated access or storage
- Credential-sharing or scraped login-protected data without authorization
- Any source that cannot record provenance in the signal pipeline

---

## Compliance

- Store **provenance** on every observation (source label, timestamp, query/API)
- Do not persist API keys in runtime JSON stores
- Review Google Cloud API restrictions quarterly
- Stop using a source immediately if terms change or Founder revokes approval

---

## Founder approval

**Approved by Founder** June 30, 2026 for PW commercial discovery via Maps Platform API and existing legacy paths.

**Contact:** privacy@pivotalwebsites.com
