# Operations Policy

**Effective date:** June 30, 2026  
**Owner:** Founder — Pivotal Websites  
**Public URL:** `/legal/operations`

Production and reliability decisions for the website-outreach-engine platform.

---

## Production hosting (F-2)

| Decision | Value |
|---|---|
| Application hosting | **Vercel** (serverless `api/index.js`) |
| Primary JSON persistence | **Vercel Blob** (`BLOB_READ_WRITE_TOKEN`) |
| Monthly budget | Approved within existing Vercel plan |

Opportunity OS `runtime/` stores remain local/gitignored until `P1`/`DEP-2` documents hosted durable runtime storage.

---

## Public URL and webhooks (F-9)

| Setting | Value |
|---|---|
| `PUBLIC_BASE_URL` | **`https://www.pivotalwebsites.com`** (use `www`; apex redirects) |
| Twilio voice webhooks | Must match `PUBLIC_BASE_URL` |
| Privacy/legal pages | Served at `/privacy` and `/legal/*` on same host |

Founder confirms production Vercel environment uses this base URL.

---

## Email infrastructure (F-7)

| Setting | Value |
|---|---|
| Transactional provider | **Resend** (`RESEND_API_KEY` in Vercel env) |
| Sending identity | **`OUTREACH_FROM_EMAIL`** — approved domain on pivotalwebsites.com |
| DNS | SPF, DKIM, DMARC configured on sending domain |
| Outbound mode | `OUTREACH_PROVIDER=manual_simulated` until engineering enables adapter (`I3`) |

Privacy and compliance contact: **privacy@pivotalwebsites.com**

---

## Backup and recovery (F-10)

| Asset | Backup approach |
|---|---|
| Production JSON (PW queue, outcomes, settings) | **Vercel Blob** (provider-managed durability) |
| Application code | **GitHub** (`850Lab/Website-Engine`) |
| Local `runtime/` (OS pipeline) | Founder workstation + future `P3` scripted backup to Blob/S3 |
| Secrets | Vercel environment variables only — never in git |

**Restore test:** Required before declaring `P3` complete (engineering).

---

## Alerting (F-10)

| Setting | Value |
|---|---|
| Primary alert channel | **Email to privacy@pivotalwebsites.com** |
| Scope (initial) | Production health check failures, Twilio webhook errors, Blob write failures |
| Implementation | Engineering task `S2` — policy approved; integration pending |

No silent failures in production once `S2` is implemented.

---

## Authentication (CEO / operator UI)

| Decision | Value |
|---|---|
| Operator auth | Existing **operator session** login (email/password, cookie) |
| Multi-user | Owner + operators via `/api/operators` |
| CEO dashboard (`N1`) | Build on existing auth; no new IdP until scale requires it |

---

## Founder approval

All sections **approved by Founder** June 30, 2026.

**Contact:** privacy@pivotalwebsites.com
