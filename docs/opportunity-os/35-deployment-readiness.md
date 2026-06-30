# 35 — Deployment Readiness Report

**Status:** Phase 5.0 — assessment only · no implementation  
**Generated:** 2026-06-30  
**Related:** [Current Phase](./08-current-phase.md) · [Master Engineering Backlog](./33-master-engineering-backlog.md) · [Engineering Director Execution Model](./34-engineering-director-execution-model.md) · [Operational Launch Checklist](./36-operational-launch-checklist.md) · [Runtime Data Boundaries](./24-runtime-data-boundaries.md) · [Security](./17-security.md) · [Folder Map](./13-folder-map.md)

**Reading path:** Architecture (`00`–`34`) → **this document** → [Operational Launch Checklist](./36-operational-launch-checklist.md)

---

## Executive Summary

Opportunity OS has a **strong engineering foundation**: reasoning pipeline, validation framework, runtime architecture, Chief of Staff core, Engineering Director, OpenClaw Builder/QA, mission registry, and observability reporting.

It does **not** yet operate real businesses autonomously or at production scale.

**What prevents Opportunity OS from making money today:**

1. **No production deployment** — runtime, missions, signals, and engineering state live on a local gitignored machine, not a hosted always-on environment.
2. **No live business discovery connectors** — pressure washing and KTM missions cannot continuously ingest qualified commercial signals without external source credentials and connector work (`C2`, `C3`).
3. **No contact discovery layer** — the OS cannot identify owners, managers, or decision-makers with compliance-safe provenance (`D1`–`D4`).
4. **No campaign engine or approved outreach path** — no campaign objects, review queue, email compliance, suppression store, or sending adapter in the Opportunity OS path (`H1`–`H4`, `I1`–`I4`).
5. **No CRM or learning loop in OS** — replies, quotes, customers, and follow-ups are not captured in the new operating model (`J1`–`J3`, `K1`–`K3`).
6. **Founder and legal blockers** — privacy policy, PII policy, hosting approval, email provider setup, mission activation workflow, and CEO review UI all require Founder decisions before autonomous execution is safe.

**Bottom line:** Revenue is possible **today only through legacy manual workflows** (pressure washing lead scripts, qualified business queue, Twilio voice, operator UI). Opportunity OS can **plan and validate** missions but cannot yet **discover → contact → campaign → close → learn** as a unified production operator.

**Shortest path to first OS-mediated revenue:** Unblock Founder decisions → deploy runtime + app → activate Pressure Washing mission → add commercial property connector → build contact discovery + opportunity review → run **Founder-approved manual outreach** before scaling to email automation.

Current backlog-derived progress (from `reports/backlog-progress-dashboard.json`):

| Measure | Value |
|---|---|
| Overall backlog completion | 16% (12/77 tasks) |
| Engineering category | 18% |
| Business Discovery | 38% |
| Contact Discovery | 0% |
| Campaign Engine | 0% |
| CRM | 0% |
| Learning | 0% |
| Unblocked next task | None — legitimate stop condition |

---

## Section 1 — Current Operational Readiness

Status key:

| Status | Meaning |
|---|---|
| **Complete** | Built, validated, and usable for its scoped purpose |
| **Ready** | Core exists; minor gaps do not block local/dev use |
| **Needs Work** | Partial implementation; critical path items remain |
| **Blocked** | Cannot proceed without Founder/external decision or credential |
| **Not Started** | No meaningful implementation in Opportunity OS path |

| Subsystem | Status | Evidence | What remains |
|---|---|---|---|
| **Chief of Staff** | Needs Work | Mission interpreter, strategy generator, Founder briefing, business operator templates (`Phase 4.1–4.2`) | Multi-turn conversation state (`A1`, blocked: privacy policy), mission activation (`A2`), portfolio prioritization (`A3`), daily briefing automation (`A4`) |
| **Engineering Director** | Complete | Backlog parser, selector, Builder Plans, task registry, OpenClaw handoff drafts, regression-aware planning, progress dashboard (`B1`–`B5`) | Autonomous loop stopped on external blockers; no further engineering until Founder unblocks |
| **Business Discovery** | Needs Work | File-drop intake (`C1`), website scan bridge (`O-WEB2`), legacy lead data in `data/` | Live connectors for commercial property (`C2`, blocked: credentials), industrial (`C3`), apartment sources (`C4`); Google Maps / permit / news automation not in OS path |
| **Contact Discovery** | Not Started | Legacy contact fields in `qualified-businesses.json` only | Full architecture (`D1`, blocked: legal/compliance), buyer role resolver (`D2`), contact store (`D3`, blocked: PII policy), enrichment (`D4`) |
| **Signal Processing** | Complete | Sensor framework, signal registry, classification, dedupe, live pipeline to `classified` | Production connectors and scale tuning; no blocker for architecture |
| **Reasoning** | Complete | Facts → graph → situations → hypotheses → problems → capability match → offer recommendation → opportunity factory with abstention (`Phases 2.4–2.9`, `4.0`) | Mission-fit ranking (`F1`) and review packets (`F2`) not yet integrated |
| **Mission Planning** | Ready | Mission registry, templates for PW/KTM/Apartment/Website, alignment scoring, approval gates | Activate missions (`A2`), rank by cash flow (`A3`), mission-aware Mission Control (`M1`) |
| **Campaign Engine** | Not Started | Legacy manual outreach queues exist outside OS campaign model | Campaign schema (`H1`), review queue (`H2`), sequences (`H3`), execution queue (`H4`) |
| **CRM** | Not Started | Legacy schema/outcome dual-write; `founder-os.json` tracker | OS CRM model (`J1`), update workflow (`J2`), follow-up bridge (`J3`) |
| **Learning** | Not Started | Score Council, calibration design docs | Outcome events (`K1`), calibration proposals (`K2`), playbook learning (`K3`) |
| **Observability** | Ready | Runtime health JSON/MD (`S1`), backlog dashboard, validation reports, autopilot status | Alert policy (`S2`, blocked: alert account), audit explorer (`S3`), production monitoring service |
| **Validation** | Complete | 29-phase release suite, isolated validation runtime, engine-data guard, phase 4.2 wrappers | Deployment and environment validators (`P2`) not yet authored |
| **Deployment** | Blocked | Local Node server, Vercel-compatible app shell, Blob persistence pattern in legacy paths | Production architecture (`P1`, blocked: hosting approval), env validation (`P2`), backup/restore (`P3`), secrets policy (`R1`) |

---

## Section 2 — External Dependencies

These cannot be solved by writing code alone. Each requires Founder action, vendor account setup, legal review, or business approval.

### Domains, DNS, and Web Presence

| Dependency | Why it matters | Owner |
|---|---|---|
| Production domain(s) | Hosted app, webhooks, email authentication | Founder |
| DNS records (A/CNAME/TXT) | App routing, SPF, DKIM, DMARC, verification | Founder + DNS provider |
| `PUBLIC_BASE_URL` | Twilio webhooks, preview links, OAuth callbacks | Founder |
| SSL/TLS certificates | Usually provider-managed (Vercel/etc.) | Hosting choice |

### Email and Messaging

| Dependency | Why it matters | Owner |
|---|---|---|
| Transactional email provider (Resend, SendGrid, Postmark, SES) | OS has `OUTREACH_PROVIDER=manual_simulated` only | Founder |
| Sending domain(s) per offer/brand | Deliverability and reputation isolation | Founder |
| Mailboxes (`hello@`, `sales@`, reply handling) | Inbound replies, human escalation | Founder |
| SPF, DKIM, DMARC configuration | Required before scale | Founder + provider |
| Domain warm-up plan | Required before 10,000/month | Founder + ops |
| CAN-SPAM / opt-out policy | Legal requirement before bulk email | Founder + legal |
| Twilio Voice (partially wired) | Click-to-call exists; A2P/SMS not approved | Founder |
| SMS A2P registration | `ALLOW_REAL_SMS_SEND=false` by design | Founder |

### Maps, Discovery, and Data Sources

| Dependency | Why it matters | Owner |
|---|---|---|
| Google Maps / Places API or equivalent | Commercial property and business discovery | Founder |
| Google PageSpeed API (`GOOGLE_PAGESPEED_API_KEY`) | Website scoring; optional but improves quality | Founder |
| Permit / construction data sources | Pressure washing and industrial signals | Founder + legal review of terms |
| News / RFP / industrial paid feeds | KTM turnaround and shutdown intelligence | Founder + budget |
| Contact enrichment vendors (Apollo, ZoomInfo, etc.) | Email/phone discovery at scale | Founder + legal + budget |
| Apartment / property management data sources | Workshop sponsor mission | Founder + terms review |

### AI and Platform Keys

| Dependency | Why it matters | Owner |
|---|---|---|
| `OPENAI_API_KEY` | Optional mission interpreter (`MISSION_INTERPRETER_LLM=1`), copy generation future | Founder |
| Vercel / hosting account | Current production pattern for legacy app | Founder |
| `BLOB_READ_WRITE_TOKEN` | Production JSON persistence on Vercel | Founder |
| `VERCEL_TOKEN` / team ID | Preview deployments | Founder |
| PostgreSQL (`DATABASE_URL`) | Optional distributed worker campaigns | Founder |
| Stripe keys | Billing for website product; not core to OS outreach | Founder |

### Security, Legal, and Compliance

| Dependency | Why it matters | Owner |
|---|---|---|
| Privacy policy | Blocks `A1` Founder conversation state | Founder + legal |
| Terms of Service | Production user-facing requirement | Founder + legal |
| PII handling policy | Blocks contact store and enrichment (`D3`, `R2`) | Founder + legal |
| Email compliance policy | Blocks `I1` and all sending | Founder + legal |
| Outreach consent rules | Required before contact discovery scale | Founder + legal |
| Credit app legal review | Blocks `O-CR1`, `O-CR2` entirely | Founder + legal |
| Government contractor registration | Blocks `O-GOV1` business decision | Founder |

### Authentication and Access

| Dependency | Why it matters | Owner |
|---|---|---|
| Production auth/session hardening | Blocks CEO dashboard (`N1`: auth/session unsafe) | Founder + engineering after provider choice |
| OAuth / SSO provider (if multi-user) | Future operator roles (`R3`) | Founder |
| Secret manager (Vault, Doppler, Vercel env) | Production secrets (`R1`) | Founder |
| Admin/operator credentials | `ADMIN_PASSWORD` fallback only today | Founder |

### Business and Operational

| Dependency | Why it matters | Owner |
|---|---|---|
| Mission activation approvals | OS will not pursue revenue without active approved missions | Founder |
| Offer/pricing decisions per business line | Campaign copy and close paths | Founder |
| Autonomy policy for email sending | Required before autonomous execution | Founder |
| Hosting budget and backup destination | Blocks `P1`, `P3` | Founder |
| Alert channel (email/SMS/Slack/PagerDuty) | Blocks `S2` | Founder |
| Spam reputation baseline | New domains need warm-up; no shortcut | Founder + ops |

---

## Section 3 — Credential Inventory

| System | Purpose | Required? | Priority | Owner | Configured? | Blocked? | Notes |
|---|---|---:|---|---|---|---|---|
| `PUBLIC_BASE_URL` | Webhooks, links, OAuth callbacks | Yes | P0 | Founder | Partial | No | Legacy app uses `pivotalwebsites.com`; OS runtime not deployed |
| Hosting (Vercel or alternative) | Always-on app + API | Yes | P0 | Founder | Partial | Yes | Legacy on Vercel; OS production architecture not approved (`P1`) |
| `BLOB_READ_WRITE_TOKEN` | Production JSON store persistence | Yes (Vercel) | P0 | Founder | Unknown | No | Required for Sales Mode outcomes; OS runtime stores separate |
| `OPPORTUNITY_RUNTIME_DIR` | Production runtime root | Yes | P0 | Engineering | Local only | Yes | Must point to durable volume in production |
| Privacy policy (document) | Founder conversation + data collection | Yes | P0 | Founder | No | Yes | Blocks `A1` |
| Google Maps / Places API | Business discovery connector | Yes | P0 | Founder | No | Yes | Blocks `C2` |
| Commercial property data source | PW lead feed | Yes | P0 | Founder | No | Yes | Blocks `C2`; may be Maps + permits composite |
| `OPENAI_API_KEY` | LLM mission interpreter, future copy | Optional | P1 | Founder | Optional | No | Rules interpreter works without it |
| `GOOGLE_PAGESPEED_API_KEY` | Website quality scoring | Optional | P1 | Founder | Optional | No | Fallback scoring exists |
| Email provider API key (`RESEND_API_KEY` etc.) | Outbound email | Yes (for email revenue) | P0 | Founder | No | Yes | `OUTREACH_PROVIDER=manual_simulated` |
| Sending domain + DNS | Email authentication | Yes | P0 | Founder | No | Yes | Required before any bulk send |
| Inbound reply mailbox / webhook | Reply processing | Yes | P1 | Founder | No | Yes | No OS reply handler yet |
| `TWILIO_ACCOUNT_SID` / `AUTH_TOKEN` | Voice outreach | Optional | P1 | Founder | Partial | No | Voice works; not integrated with OS campaigns |
| `TWILIO_FROM_NUMBER` | Outbound calls | Optional | P1 | Founder | Partial | No | Manual click-to-call path |
| `DATABASE_URL` | Distributed workers / campaigns | Optional | P2 | Founder | No | No | JSON store default |
| `WORKER_API_KEY` | Background job workers | Optional | P2 | Engineering | No | No | For scale later |
| `STRIPE_*` | Website product billing | No (OS core) | P3 | Founder | Partial | No | Separate product line |
| `VERCEL_TOKEN` | Preview deploy automation | Optional | P2 | Founder | Optional | No | OpenClaw/build automation |
| Secret scanner / vault | Production secret hygiene | Yes | P1 | Founder | Partial | Yes | `.gitignore` only; `R1` not done |
| Alert integration | Production failure notification | Yes | P1 | Founder | No | Yes | Blocks `S2` |
| Contact enrichment API | Email/phone at scale | Yes (scale) | P1 | Founder | No | Yes | Legal + paid account |
| Industrial signal paid source | KTM opportunities | Yes (KTM path) | P1 | Founder | No | Yes | Blocks `C3` |
| Auth provider / session secret | CEO dashboard | Yes | P0 | Founder | Partial | Yes | Blocks `N1` |
| Backup storage destination | Runtime disaster recovery | Yes | P1 | Founder | No | Yes | Blocks `P3` |

---

## Section 4 — Deployment Checklist

Complete production checklist for Opportunity OS as a revenue operator. Order reflects dependencies.

### Phase A — Founder and Legal (before production code deploy)

- [ ] Approve production hosting provider and monthly budget
- [ ] Approve primary domain strategy (one domain vs per-offer domains)
- [ ] Publish Privacy Policy (unblocks `A1`)
- [ ] Publish Terms of Service
- [ ] Approve PII handling policy (unblocks `D3`, `R2`)
- [ ] Approve email/compliance policy (unblocks `I1`)
- [ ] Define mission activation and outreach approval policy
- [ ] Choose auth approach for CEO dashboard (session hardening minimum)

### Phase B — Infrastructure

- [ ] Acquire and configure production domain(s)
- [ ] Configure DNS (app, www, mail subdomains)
- [ ] Provision hosting environment (Vercel + durable runtime storage or VM/container)
- [ ] Set `PUBLIC_BASE_URL` to production URL
- [ ] Configure `OPPORTUNITY_RUNTIME_DIR` on persistent volume
- [ ] Configure secret storage (no secrets in repo)
- [ ] Set `BLOB_READ_WRITE_TOKEN` or equivalent persistence layer
- [ ] Configure backup destination and schedule (`P3`)
- [ ] Deploy Node application (`npm start` / serverless equivalent)
- [ ] Verify health endpoints and `runtime-health.js` in production
- [ ] Configure alert channel (`S2`)

### Phase C — Email Infrastructure (before scaled outreach)

- [ ] Select email provider (Resend recommended for dev velocity; SendGrid/SES for scale)
- [ ] Create sending domain(s) per brand/offer
- [ ] Configure SPF, DKIM, DMARC
- [ ] Create mailboxes and reply routing
- [ ] Configure provider webhooks for bounces and replies
- [ ] Implement suppression/unsubscribe store (`I2`) — engineering after policy approved
- [ ] Run warm-up plan (start 20–50/day, scale over 4–8 weeks)
- [ ] Dry-run sending adapter (`I3`) before live sends

### Phase D — Opportunity OS Application Layer

- [ ] Deploy runtime-backed mission registry
- [ ] Deploy Engineering Director tooling (reports, backlog dashboard generation)
- [ ] Deploy signal ingestion (file drop + first live connector)
- [ ] Deploy contact discovery store (after policies)
- [ ] Deploy opportunity review reports/UI
- [ ] Deploy campaign draft + approval queue
- [ ] Deploy CRM store
- [ ] Deploy learning outcome capture

### Phase E — Discovery and Revenue Connectors

- [ ] Configure Google Maps / commercial property source (`C2`)
- [ ] Activate Pressure Washing mission (`A2`)
- [ ] Validate live pipeline: observation → signal → opportunity
- [ ] Configure contact sources for PW buyer roles
- [ ] Configure KTM industrial source when ready (`C3`)

### Phase F — Verification and Go-Live

- [ ] Run `validate-core.js` against production-like environment
- [ ] Smoke test: ingest observation, classify signal, build opportunity
- [ ] Smoke test: create mission, align opportunity, generate review packet
- [ ] Smoke test: create campaign draft, Founder approve, dry-run send
- [ ] Smoke test: record reply/outcome in CRM
- [ ] Verify backup restore
- [ ] Verify kill switch and rate limits
- [ ] Production validation sign-off
- [ ] Go-live with **manual approval gate enforced**

---

## Section 5 — Revenue Readiness by Founder Business

| Business | Can OS support today? | Ready now | Missing for OS-mediated revenue |
|---|---|---|---|
| **Pressure Washing** | **Partial** | Mission template (`O-PW1`), file-drop intake, legacy PW leads in `data/`, reasoning pipeline, manual legacy outreach tools | Active mission workflow, live commercial property connector (`C2`), mission-fit ranking (`F1`), opportunity review (`F2`), contacts (`D1`–`D3`), campaigns (`H1`–`H2`), compliance (`I1`–`I2`), production deploy, Founder-approved send path |
| **KTM Industrial** | **Partial** | Mission template (`O-KTM1`), reasoning for industrial signals, legacy KTM report scripts | Industrial connector (`C3`, paid/legal), trigger library (`O-KTM2`), contact discovery for safety/ops managers, longer sales cycle CRM, no live industrial feed |
| **Apartment Campaign** | **Minimal** | Mission template (`O-APT1`) | Apartment source (`C4`), sponsor mapper (`O-APT2`, `E3`), relationship intelligence, workshop offer clarity, contacts for property managers |
| **Website Agency** | **Partial** | Mission template (`O-WEB1`), website scan bridge (`O-WEB2`), legacy angle analyses | Mission activation, contact discovery, campaign engine, deliverability for cold email at scale; legacy website queue exists separately |
| **Credit App** | **No** | Nothing operational | Entire product blocked on legal/compliance (`O-CR1`, `O-CR2`); do not pursue until counsel approves |
| **Government Contracts** | **No** | Nothing operational | Registration requirements unknown (`O-GOV1` blocked), RFP connector (`O-GOV2`), different sales motion than local services |

### What works today without Opportunity OS deployment

The repository **can produce revenue today** through **legacy operator workflows** that predate the OS campaign model:

- `scripts/pw-find-leads.js` — discover pressure washing targets
- `data/qualified-businesses.json` / `data/pressure-washing-leads.json` — lead inventory
- Mission Control / Pivotal OS sales mode — manual queue and outreach status
- Twilio Voice — click-to-call with recording
- Founder manual follow-up

These are **not** unified with Opportunity OS missions, CRM, campaigns, or learning. They are parallel cash-flow tools until integration completes.

---

## Section 6 — First Revenue Plan

### Goal

Fastest path to **first dollars** with Opportunity OS as the operating layer, prioritizing **Commercial Pressure Washing within 500 miles of Beaumont, Texas**.

### Reality check: two timelines

| Path | Time to first revenue | OS involvement |
|---|---|---|
| **A. Founder manual (legacy tools)** | Days | Minimal — use existing PW queue and phone |
| **B. OS-mediated manual outreach** | 8–14 weeks | Full — mission → discovery → review → approved send/call |
| **C. OS autonomous email at scale** | 5–9 months | Full — includes compliance, CRM, learning, monitoring |

Path A is fastest for cash. Path B is the **shortest honest path to OS-mediated revenue**. This plan optimizes for Path B while Path A runs in parallel.

### Launch sequence

#### Stage 0 — Founder unblocks (Week 1)

1. Approve Privacy Policy → unblocks Chief of Staff conversation state (`A1`)
2. Choose hosting + approve production budget → unblocks deployment (`P1`)
3. Approve PII and email compliance policies → unblocks contacts and sending architecture
4. Activate Pressure Washing mission explicitly → unblocks mission-ranked work (`A2`)
5. Provision Google Maps / commercial discovery credentials → unblocks `C2`

#### Stage 1 — Deploy minimum operating surface (Weeks 2–3)

Engineering Director work (after Founder unblocks):

- `P1` Production deployment architecture
- `P2` Environment validation
- `A1` Founder conversation state
- `A2` Mission activation workflow
- Deploy runtime + app with health monitoring

**Outcome:** Founder can define goals, activate PW mission, and see system health in production.

#### Stage 2 — Feed the PW mission (Weeks 3–5)

- `C2` Commercial property source connector v1
- `F1` Mission-fit opportunity ranking
- `F2` Opportunity review packet
- `L1` Mission analytics summary
- `M1` / `M2` Mission-aware projection and blockers

**Outcome:** OS continuously ingests commercial property signals and produces Founder-reviewable PW opportunities with evidence.

#### Stage 3 — Contact and approve (Weeks 5–8)

- `D1` Contact discovery architecture
- `D2` Buyer role resolver
- `D3` Contact candidate store
- `N1` Mission review board UI (minimum)
- `N2` Opportunity review board UI (minimum)

**Outcome:** Founder can see who to contact and approve opportunities before any outreach.

#### Stage 4 — First approved outreach (Weeks 8–12)

Two acceptable first outreach modes (Founder choice):

| Mode | Pros | Cons |
|---|---|---|
| **Manual call/text via Twilio + operator UI** | Fastest; no email deliverability risk | Not scalable; not fully logged in OS CRM yet |
| **Small-batch email (50–100/week)** | Tests full campaign path | Requires email infra Stage C |

Engineering path for email:

- `G1` Asset draft schema
- `G2` Offer-specific copy (PW)
- `H1` Campaign object schema
- `H2` Campaign review queue
- `I1` Email compliance architecture
- `I2` Suppression store
- `I3` Sending provider adapter (dry-run → live)

**Outcome:** First Founder-approved outreach to PW opportunities with audit trail.

#### Stage 5 — Close loop (Weeks 12–16)

- `J1` CRM object model
- `J2` CRM update workflow (manual reply entry initially)
- `K1` Outcome event model
- Record first won job → first OS-attributed revenue event

#### Then: KTM (Weeks 16–24)

- Unblock industrial source credentials/legal (`C3`)
- `O-KTM2` Industrial trigger library
- Reuse contact + campaign + CRM stack from PW
- Founder-approved industrial outreach

#### Then: Apartment Campaign (Weeks 24–32)

- `C4` Apartment source
- `E3` / `O-APT2` Sponsor acquisition model
- Workshop-specific campaign assets

### First revenue KPI

| Milestone | Definition |
|---|---|
| **R0** | First paid PW job sourced while PW mission is active in OS (any channel) |
| **R1** | First opportunity created from OS live connector (not file drop alone) |
| **R2** | First Founder-approved outreach sent from OS campaign draft |
| **R3** | First reply logged in OS CRM |
| **R4** | First closed/won outcome in OS learning store |

Target: **R0** via legacy tools in days; **R2** in 8–12 weeks if Founder blockers clear in Week 1.

---

## Section 7 — Email Infrastructure

Target: **10,000 personalized emails per month per offer** (Founder requirement from backlog).

### Architecture requirements

| Component | Requirement |
|---|---|
| Domains | Minimum 1 dedicated sending domain per offer/brand; prefer subdomain isolation (`outreach.brand.com`) |
| Mailboxes | At least 1 human-monitored reply mailbox per offer; optional rotation mailboxes for warm-up |
| Provider | Transactional ESP with API + webhooks (Resend, SendGrid, Postmark, Amazon SES) |
| Authentication | SPF + DKIM + DMARC aligned; BIMI optional later |
| Suppression | Global unsubscribe, bounce, complaint, do-not-contact (`I2`) |
| Personalization | Template tokens with forbidden-claim rules (`G3`) |
| Rate control | Per-offer cap 10,000/month, daily throttle, kill switch (`I4`) |
| Reply handling | Inbound parse or mailbox sync → CRM (`J2`) |
| Monitoring | Bounce rate, complaint rate, domain reputation, send volume (`S1`, `S2`) |

### Provider selection

| Provider | Best for | Approx. cost at 10k/mo | Notes |
|---|---|---:|---|
| **Resend** | Fast integration, developer velocity | $20–$100/mo | Already named in `.env.example` |
| **SendGrid** | Scale, analytics, mature compliance | $50–$200/mo | Strong webhook ecosystem |
| **Postmark** | Deliverability focus, transactional | $50–$150/mo | Less marketing-feature noise |
| **Amazon SES** | Lowest cost at high volume | $1–$10/mo + ops overhead | Requires more engineering |

**Recommendation for first revenue:** Resend or Postmark for PW pilot (low volume). Migrate to SendGrid or SES when multiple offers exceed 30k/month combined.

### Warm-up plan (required — no shortcut)

Cold domains cannot send 10,000/month on day one.

| Week | Daily send cap (per domain) | Cumulative monthly |
|---|---:|---:|
| 1 | 20–50 | ~350 |
| 2 | 50–100 | ~1,000 |
| 3 | 100–200 | ~2,500 |
| 4 | 200–400 | ~5,000 |
| 5–8 | 400–700 | ~10,000 |

Monitor bounce rate (<2%), complaint rate (<0.1%), and pause on reputation signals.

### Authentication checklist

```text
1. Register sending domain
2. Add SPF TXT record (include provider)
3. Enable DKIM (provider CNAME/TXT records)
4. Publish DMARC (start p=none, move to quarantine/reject)
5. Configure custom return-path / bounce domain if provider supports
6. Verify domain in provider dashboard
7. Send seed tests (Gmail, Outlook, Yahoo)
8. Enable webhook endpoints for delivered/bounced/complained/replied
```

### Bounce, reply, and compliance handling

| Event | Required behavior |
|---|---|
| Hard bounce | Suppress address immediately; never retry |
| Soft bounce | Retry with backoff; suppress after N failures |
| Complaint/spam report | Suppress immediately; investigate copy/targeting |
| Unsubscribe | One-click; honor within 24 hours |
| Reply | Route to CRM; pause sequence for contact |
| Missing consent | Do not send — abstain |

Engineering tasks: `I1`, `I2`, `I3`, `I4`, `H2`, `N3`, `J2`.

### Cost estimate at target scale (per offer, 10k/month)

| Item | Monthly estimate |
|---|---:|
| ESP sending fees | $50–$200 |
| Domain(s) | $1–$3 |
| Reply mailbox (Google Workspace) | $6–$12 |
| Enrichment (if used) | $100–$500 |
| Monitoring/alerts | $0–$50 |
| **Total per offer** | **$160–$765/mo** |

Three active offers (PW + KTM + Website) at full scale: **~$500–$2,300/mo** in infrastructure before labor.

### Deployment order for email

1. Legal/compliance policy approved (`I1` prerequisite)
2. Domain + DNS authenticated
3. Suppression store live (`I2`)
4. Provider adapter dry-run (`I3`)
5. Campaign review queue (`H2`) + Founder approval UI (`N3`)
6. Pilot send 50/week with manual approval
7. Reply logging to CRM (`J2`)
8. Warm-up scale toward 10k/month
9. Scale controller + kill switch (`I4`)
10. Autonomous send policy (Founder explicit approval)

---

## Section 8 — Risk Assessment

| Risk | Category | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| Sending cold email without compliance | Legal | High if rushed | Critical | Complete `I1`/`I2`; Founder approval gate; start with calls |
| PII stored without policy | Privacy | High | Critical | `R2` + legal review before `D3` |
| Local runtime loss (no backup) | Operational | Medium | High | `P3` backup/restore before production |
| New domain reputation destruction | Business | High at scale | High | Warm-up plan; low initial volume; suppression |
| Connector ToS violation | Legal | Medium | High | Legal review per source; provenance in signals |
| Founder bottleneck on approvals | Business | High | Medium | Review packets (`F2`); batch approval UI |
| Engineering builds ahead of credentials | Engineering | Medium | Medium | Engineering Director stop conditions (current model working) |
| Legacy + OS dual workflows diverge | Operational | High | Medium | Migrate PW queue into OS path; single CRM target |
| Autonomous send before kill switch | Security | Low now | Critical | `I4`, `H2`, explicit autonomy policy |
| Secret leak in repo | Security | Low | Critical | `R1` secrets scanner; env-only secrets |
| JSON runtime corruption at scale | Engineering | Medium | High | `Q1` compaction; eventual `Q3` DB migration |
| OpenAI dependency for copy | Financial | Medium | Low | Template fallback (`G2` stop condition) |
| Credit/government scope creep | Legal | Low | High | Keep blocked until explicit Founder approval |
| Single-machine production | Deployment | High today | High | Hosted deploy + persistent runtime volume |
| No alert on pipeline failure | Operational | Medium | Medium | `S2` alert policy + monitoring |
| Overstated AI personalization claims | Legal/Reputation | Medium | High | `G3` personalization rules; abstention gate |

---

## Section 9 — Production Readiness Score

Scores reflect **ability to operate real businesses in production**, not lines of code written.

| Dimension | Score | Justification |
|---|---:|---|
| **Engineering Complete** | **62%** | Reasoning pipeline, validation, runtime, scheduler/processor/orchestrator, OpenClaw, Chief of Staff core, Engineering Director, and observability reporting are built and regression-tested. Missing: deployment scripts, contact/campaign/CRM/learning modules, CEO UI, and production hardening (`P1`–`P3`, `R1`). |
| **Business Ready** | **18%** | Mission templates and legacy lead assets exist. No live discovery connectors, contact layer, opportunity review UX, or campaign approval path. Founder cannot yet run a mission end-to-end inside OS. |
| **Deployment Ready** | **12%** | App runs locally; Vercel pattern exists for legacy product. No approved production architecture, env validator, backup/restore, secrets policy, or hosted Opportunity OS runtime. |
| **Revenue Ready** | **8%** | Legacy manual outreach can produce revenue outside OS. OS-mediated revenue requires ~10 major backlog tranches and Founder unblocks. No autonomous or even approved OS outreach path exists. |
| **Overall Opportunity OS Readiness** | **25%** | Strong platform engineering; early business-operating engineering. The system is a validated **engineering project** transitioning toward a **revenue operator**. Backlog task completion (16%) understates platform completeness but accurately reflects revenue-path completeness. |

### Score interpretation

```text
Platform / intelligence engineering:  ████████████░░░░  ~75%
Business operating engineering:       ███░░░░░░░░░░░░░  ~20%
Production deployment:                ██░░░░░░░░░░░░░░  ~12%
Revenue execution:                    █░░░░░░░░░░░░░░░  ~8%
```

---

## Section 10 — Founder Action List

Only actions that require the Founder. Everything else is future **Engineering Director** work after unblocking.

### Immediate (this week)

1. **Approve or draft Privacy Policy** — unblocks `A1` and responsible data handling
2. **Choose production hosting provider and budget** — unblocks `P1` deployment architecture
3. **Explicitly activate Pressure Washing as the first revenue mission** — unblocks mission-ranked pipeline
4. **Decide first outreach mode: phone vs email pilot** — determines whether Twilio-first or email infra comes first
5. **Provision Google Maps / commercial discovery API access** — unblocks `C2` pressure washing feed

### This week (continued) / early next week

6. **Approve PII handling rules** (what contact data can be stored, retention, redaction) — unblocks `D1`, `D3`, `R2`
7. **Approve email/compliance policy** (consent, unsubscribe, CAN-SPAM, cold outreach rules) — unblocks `I1`
8. **Register or designate primary sending domain** — required before any OS email
9. **Create transactional email provider account** (Resend/SendGrid/etc.) — unblocks `I3`
10. **Confirm `PUBLIC_BASE_URL` and production domain** for webhooks and links

### This month

11. **Approve production auth approach** for CEO/mission review UI — unblocks `N1`
12. **Choose backup destination** (S3, Blob, etc.) — unblocks `P3`
13. **Choose alert channel** for production failures — unblocks `S2`
14. **Review and approve opportunity/outreach approval policy** (what Founder must approve vs delegate)
15. **Decide KTM industrial data budget and legal tolerance** for paid/news sources — unblocks `C3`
16. **Set revenue targets per mission** (PW monthly job count, KTM deal size assumptions) — unblocks `A3` prioritization

### Later

17. **Government contractor registration research** — only if pursuing `O-GOV1`
18. **Credit app legal review** — only if pursuing `O-CR1`
19. **Autonomous email execution policy** — explicit written approval before removing human send gate
20. **Multi-operator RBAC decisions** — roles beyond Founder (`R3`)
21. **Apartment sponsor category strategy** — workshop monetization model
22. **10,000/month email commitment per offer** — infrastructure budget approval

### Engineering Director work (NOT Founder — runs after unblocks)

- `A1`–`A3` Chief of Staff evolution
- `P1`–`P3` deployment and backup
- `C2` commercial property connector
- `D1`–`D3` contact discovery
- `F1`–`F2` opportunity intelligence
- `G1`–`G2` content drafts
- `H1`–`H2` campaign engine
- `I1`–`I3` email infrastructure
- `J1`–`J2` CRM
- `N1`–`N2` review UI
- `R1`–`R2` security policies

---

## Section 11 — Definition of Production

What Opportunity OS looks like on **official launch day** — the moment it becomes a production business operator, not a local engineering environment.

### Infrastructure

- Hosted application with HTTPS, persistent runtime storage, automated backups, and health monitoring
- Secrets in environment/secret manager only
- Validation suite passes in production-like CI/CD
- Alert policy fires on pipeline failures, send anomalies, and storage errors
- Runtime stores (`missions`, `signals`, `contacts`, `campaigns`, `crm`, `events`, `jobs`) on durable storage with restore tested

### Founder workflow

1. Founder states goal in natural language: *"I need pressure washing jobs within 500 miles of Beaumont."*
2. Chief of Staff clarifies only necessary questions and persists conversation context
3. Chief of Staff proposes or updates mission; Founder **activates** it in review UI
4. Founder receives daily briefing: active missions, top opportunities, blockers, decisions needed
5. Founder approves/rejects opportunities with evidence packets
6. Founder approves campaign packages (contacts + copy + sequence) before any send
7. Founder sees funnel metrics: signals → opportunities → contacts → campaigns → replies → revenue
8. Founder approves learning proposals; system never self-modifies weights without approval

### Chief of Staff workflow

- Maintains active mission portfolio with ranked priorities
- Generates strategy per mission (buyers, signals, constraints, offers)
- Produces blockers list: missing sources, contacts, credentials, approvals
- Does **not** send outreach or mutate business state without approval gates

### Engineering Director workflow

- Reads Master Engineering Backlog continuously
- Selects highest-value unblocked task with validation plan
- Implements via bounded changes or OpenClaw handoff drafts
- Runs validation, updates docs/backlog, commits atomically
- Stops only on external blockers (credentials, legal, Founder decision)

### Discovery

- Live connectors feed observations (commercial property, industrial, apartment, website scans)
- Signals carry mission hints and provenance
- Pipeline produces mission-aligned opportunities with abstention for weak fits
- Legacy file-drop remains for manual imports

### Contacts

- Contact candidates stored with source, confidence, role, and compliance flags
- Buyer role resolver maps mission → property manager / ops / safety / owner
- Enrichment only from approved sources
- Suppression and do-not-contact enforced before outreach

### Campaigns

- Campaign objects: audience, sequence, assets, approval state, kill switch
- Email/call/visit sequences generated from offer templates with personalization rules
- Nothing sends without Founder approval state = approved
- Execution queue hands off to provider adapters (email, Twilio)

### CRM

- Accounts, contacts, opportunities, activities, outcomes linked to missions
- Replies and calls update CRM automatically or via operator entry
- Next actions generate follow-up jobs under policy
- Full history auditable with PII redaction in reports

### Learning

- Outcome events: won, lost, replied, booked, ignored — linked to mission/campaign/contact
- System proposes calibration and playbook improvements weekly
- Founder approves changes; no silent self-optimization

### Revenue

- Founder sees revenue by mission, offer, and channel
- Pressure Washing is first cash-flow mission; KTM and Apartment follow
- OS attributes revenue to signals and campaigns for learning

### Monitoring

- Runtime health dashboard updated on schedule
- Alerts on job failures, send rate anomalies, bounce spikes
- Audit trail explorer for missions, opportunities, campaigns, contacts

### Continuous improvement

- Weekly learning proposals from outcome data
- Backlog progress dashboard tracks engineering vs business readiness
- Engineering Director continues autonomous implementation until only external blockers remain

### Launch day explicit non-goals

- Fully autonomous email without Founder approval
- Credit app or government contracts without separate approval
- 10,000 emails/month on day one (warm-up required)
- Multi-tenant workspace for unrelated businesses

---

## Final Requirement — Next 10 Founder Actions by Return on Effort

Ordered by **greatest unlock of autonomous capability per hour of Founder effort**.

| Rank | Founder action | Unlocks | Effort |
|---|---|---|---|
| **1** | **Publish Privacy Policy** | Chief of Staff conversation state (`A1`), responsible data collection, path to CEO UI | 2–8 hours with template + review |
| **2** | **Approve hosting provider + budget + production domain** | Entire deployment epic (`P1`–`P3`), always-on runtime, webhooks, production validation | 1–2 hours decision + vendor signup |
| **3** | **Activate Pressure Washing mission as first revenue mission** | Mission-ranked pipeline, analytics, review workflows (`A2`, `F1`, `L1`) | 30 minutes |
| **4** | **Provision Google Maps / commercial discovery API** | Live PW lead connector (`C2`) — highest business-value engineering task | 1–2 hours |
| **5** | **Approve PII policy (what contact data can be stored and how)** | Contact discovery architecture (`D1`–`D3`), security classification (`R2`) | 2–4 hours with counsel template |
| **6** | **Approve email/compliance policy (consent, unsubscribe, cold outreach rules)** | Email infrastructure (`I1`–`I2`), campaign approval path | 2–4 hours with counsel template |
| **7** | **Create email provider account + register sending domain with DNS** | Sending adapter dry-run (`I3`), pilot campaigns | 2–3 hours |
| **8** | **Decide and document outreach approval policy** (what requires Founder sign-off) | Campaign review queue (`H2`), CEO campaign UI scope (`N3`), safe autonomy boundaries | 1 hour |
| **9** | **Set `PUBLIC_BASE_URL` and confirm Twilio/webhook domain alignment** | Voice outreach reliability, reply webhooks, preview links in production | 30–60 minutes |
| **10** | **Choose backup destination + alert channel** | Backup/restore (`P3`), error alert policy (`S2`), production confidence | 1–2 hours |

### What these 10 actions collectively unlock

Once complete, the Engineering Director can autonomously implement:

```text
A1 → A2 → A3 → P1 → P2 → C2 → F1 → F2 → D1 → D2 → D3
→ G1 → G2 → H1 → H2 → I1 → I2 → I3 → J1 → N1 → N2
```

That sequence takes Opportunity OS from **local engineering project** to **Founder-supervised revenue operator** capable of:

- Ingesting live pressure washing opportunities
- Identifying contacts with compliance
- Generating approved outreach
- Sending first pilot emails or coordinated calls
- Recording outcomes in CRM
- Beginning the learning loop

**Without these Founder actions, Engineering Director correctly stops** — as it does today with `stopCondition: no_unblocked_task`.

---

## Appendix — Related Commands (Local Dev Only)

These exist today for engineering validation. They are **not** production deployment.

```bash
node scripts/opportunity-engine/validate-core.js
node scripts/opportunity-engine/validate-phase-4-2.js
node scripts/opportunity-engine/backlog-progress-dashboard.js
node scripts/opportunity-engine/runtime-health.js
npm run autopilot:status
```

Production deployment commands (`validate-deployment-plan.js`, `validate-environment.js`, `validate-backup-restore.js`) are **defined in backlog but not yet implemented**.

---

## Amendment

When production deployment begins, update [Current Phase](./08-current-phase.md) to Phase 5.0 and record decisions in [Build Log](./09-build-log.md). Do not mark deployment complete until Section 4 checklist passes and `validate-core.js` succeeds in the production-like environment.

For the living operational dashboard, blocker registry, and gated launch checklist, use [36 — Operational Launch Checklist](./36-operational-launch-checklist.md).
