# Email and Outreach Compliance Policy

**Effective date:** June 30, 2026  
**Owner:** Founder — Pivotal Websites  
**Public URL:** `/legal/email-compliance`  
**Related:** [Privacy Policy](/privacy) · [PII Policy](/legal/pii) · [Outreach Approval Policy](/legal/outreach-approval)

---

## Scope

This policy governs **email**, **phone**, and **in-person** B2B outreach for commercial services (primarily pressure washing). It applies to manual operator outreach and any future automated sending through Opportunity OS.

---

## Core rules

1. **B2B only** — Target businesses and commercial properties, not residential consumer lists.
2. **Founder approval required** — No bulk or automated send without explicit Founder approval per [Outreach Approval Policy](/legal/outreach-approval).
3. **Truthful content** — No false claims, fake urgency, or misrepresented affiliation.
4. **Opt-out honored** — Stop contacting anyone who opts out; record in suppression list.
5. **CAN-SPAM compliance** (US email) — Include valid physical address, accurate From identity, and unsubscribe mechanism for marketing email.
6. **No purchased spam lists** — Do not use scraped personal emails unrelated to a business role.

---

## Email-specific requirements

Before live email beyond one-to-one manual sends:

- Sending domain authenticated (SPF, DKIM, DMARC)
- `OUTREACH_FROM_EMAIL` uses an approved domain identity
- Transactional provider configured (`RESEND_API_KEY` or equivalent)
- Suppression store enforced before queue (`I2` — engineering)
- Warm-up plan for volume above 50/day

### Required in marketing email

- Clear sender identity (Pivotal Websites or approved trade name)
- One-click or reply-based unsubscribe
- Physical mailing address (business address on file)
- Subject line reflects content

---

## Phone outreach (Twilio)

- Click-to-call through authenticated operator UI only today
- Identify caller and purpose honestly
- Honor do-not-call requests immediately
- Call recordings retained per [PII Policy](/legal/pii)

---

## Prohibited

- Autonomous sends without approval workflow
- SMS until A2P registration complete (`ALLOW_REAL_SMS_SEND=false`)
- Email to addresses on suppression list
- Misleading “Re:” subjects or spoofed domains

---

## Volume limits (initial)

| Channel | Limit until warm-up complete |
|---|---|
| Manual email | Founder/operator discretion, prefer &lt; 25/day |
| Automated email | Disabled until `I3` adapter + Founder approval |
| Phone | Operator daily targets in PW mode |

Scale toward 10,000/month only after deliverability warm-up (`I4`).

---

## Founder approval

**Approved by Founder** June 30, 2026.

**Contact:** privacy@pivotalwebsites.com
