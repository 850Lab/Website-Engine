# PII and Business Contact Data Policy

**Effective date:** June 30, 2026  
**Owner:** Founder — Pivotal Websites  
**Public URL:** `/legal/pii`  
**Related:** [Privacy Policy](/privacy)

---

## Purpose

This policy defines how Pivotal Websites classifies, stores, redacts, and retains **personally identifiable information (PII)** and **business contact data** in sales and operating systems—including the Opportunity OS, pressure washing queue, and outreach tools.

We pursue **B2B commercial** opportunities only. We minimize PII, store only what operations require, and do not sell personal data.

---

## Data classes

### Class A — Public business facts (low sensitivity)

May be stored with provenance. Examples:

- Business legal name, public address, public phone on website or Maps
- Industry, category, public website URL
- Public Google rating/review count
- Signal headlines from public sources

**Handling:** Store in lead/opportunity records. No redaction required in operator UI.

### Class B — Professional contact data (medium sensitivity)

Business-context contact details used for B2B outreach. Examples:

- Name and title of facility manager, owner, or operations contact
- Work email and direct business phone
- Call notes, estimate details, follow-up dates
- Twilio call metadata and recordings when enabled

**Handling:** Store in CRM/queue with source and date collected. Restrict access to authenticated operators. Redact in audit exports unless required for the export purpose.

### Class C — Restricted (high sensitivity — do not collect without purpose)

Examples:

- Social Security numbers, government IDs, bank accounts
- Health information, consumer household data
- Passwords, API secrets, payment card numbers (use Stripe/Twilio providers instead)
- Residential-only consumer lists marketed as personal, not business

**Handling:** **Do not collect or store** in sales systems. If accidentally received, delete promptly and log the incident.

---

## Retention

| Data type | Retention |
|---|---|
| Active PW / sales leads | While actively worked or follow-up is due |
| Won customer records | Minimum 7 years for tax/dispute needs |
| Lost/suppressed contacts | Suppression list retained indefinitely |
| Call recordings | 90 days default unless needed for dispute |
| Founder conversation state | While mission active + 12 months archive |

---

## Redaction rules

- Public status feeds and shared reports **must not** include Class B email/phone unless the viewer is an authenticated operator.
- Logs must not print API keys, session tokens, or full payment data.
- Export to third parties requires Founder approval when Class B is included.

---

## Consent and opt-out

- B2B cold outreach is permitted under this policy and the [Email Compliance Policy](/legal/email-compliance) when targeting commercial prospects.
- Any request to **stop contact** must be honored within 2 business days and added to the suppression list.
- Do-not-contact flags override all campaigns.

---

## Approved storage locations

- Vercel Blob / application JSON stores (production)
- Local `runtime/` stores (development and OS pipeline — not production CRM of record until deployed)
- Twilio (call metadata/recordings under their terms)
- Email provider (message metadata under their terms)

---

## Founder approval

This policy is **approved by the Founder** as of June 30, 2026 for Pressure Washing mission #1 and related B2B operations.

Changes require Founder written approval and an updated effective date.

**Contact:** privacy@pivotalwebsites.com
