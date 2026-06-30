# 36 — Operational Launch Checklist

**Status:** Phase 5.0 — living operational document  
**Last assessed:** 2026-06-30  
**Related:** [Deployment Readiness Report](./35-deployment-readiness.md) · [Master Engineering Backlog](./33-master-engineering-backlog.md) · [Engineering Director Execution Model](./34-engineering-director-execution-model.md) · [Current Phase](./08-current-phase.md) · [Folder Map](./13-folder-map.md)

**Reading path:** Architecture (`00`–`34`) → [Deployment Readiness Report](./35-deployment-readiness.md) → **this document**

---

## Purpose

This is **not** an architecture document. It is the operational picture of what stands between Opportunity OS and running real businesses in production.

Use it to answer three questions daily:

1. **How ready are we?** — by operating area, not one vague percentage  
2. **What is blocked?** — and who must act  
3. **What unlocks the most capability next?** — Founder vs Engineering vs External

### How to keep this living

| Source | Command / location | Updates |
|---|---|---|
| Backlog task completion | `node scripts/opportunity-engine/backlog-progress-dashboard.js` | Business Discovery, Contact, Campaign, CRM, Learning percentages |
| Runtime health | `node scripts/opportunity-engine/runtime-health.js` | Store counts, gitignore policy |
| Release integrity | `node scripts/opportunity-engine/validate-core.js` | Platform Engineering confidence |
| Founder action checklist | Section 4 below | Founder Actions percentage (manual tick) |

After backlog or deployment milestones, refresh Section 1 percentages and move blockers from **Open** → **Cleared**.

---

## Section 1 — Launch Readiness Dashboard

```text
Opportunity OS Launch Readiness
Last updated: 2026-06-30

Platform Engineering      █████████████████░  94%
Deployment                ████░░░░░░░░░░░░░  25%
Business Discovery        ██████░░░░░░░░░░░  38%
Contact Discovery         ░░░░░░░░░░░░░░░░░   0%
Campaign Engine           ░░░░░░░░░░░░░░░░░   0%
CRM                       ░░░░░░░░░░░░░░░░░   0%
Learning                  ░░░░░░░░░░░░░░░░░   0%
Founder Actions           ███░░░░░░░░░░░░░░  20%
Overall Business Readiness ███░░░░░░░░░░░░░░  25%
```

### Score definitions

| Area | Score | Basis |
|---|---:|---|
| **Platform Engineering** | 94% | Reasoning pipeline, validation (29 phases), runtime, jobs/events, OpenClaw, Chief of Staff core, Engineering Director, mission registry, observability data — built and regression-tested. Remaining: mission control projection, analytics, scale hardening. |
| **Deployment** | 25% | Local Node app + legacy Vercel pattern exist. Missing: approved production architecture, hosted OS runtime, env validation, backup/restore, secrets policy, production alerts. |
| **Business Discovery** | 38% | Backlog: 6/16 tasks complete (`C1`, `O-PW1`, `O-KTM1`, `O-APT1`, `O-WEB1`, `O-WEB2`). Missing: live connectors (`C2`–`C4`), operator scoring (`O-PW2`). |
| **Contact Discovery** | 0% | Backlog: 0/7 tasks. Entire epic blocked on legal/PII and mission workflow prerequisites. |
| **Campaign Engine** | 0% | Backlog: 0/15 tasks across opportunity intelligence, content, campaigns, email infra. |
| **CRM** | 0% | Backlog: 0/3 tasks. Legacy outcome tracking exists outside OS model. |
| **Learning** | 0% | Backlog: 0/3 tasks. Requires CRM outcomes first. |
| **Founder Actions** | 20% | ~2/10 critical Founder unlocks partially satisfied (legacy hosting exists; Twilio partially configured). Policies, mission activation, discovery APIs, email domain not done. |
| **Overall Business Readiness** | 25% | Weighted toward revenue execution path, not platform code volume. Matches [Deployment Readiness Report](./35-deployment-readiness.md) overall score. |

### Current system state

| Indicator | Value |
|---|---|
| Backlog tasks complete | 12 / 77 (16%) |
| Next unblocked engineering task | **None** — legitimate stop condition |
| Engineering Director status | Stopped on external/Founder blockers |
| Revenue via OS today | **No** — legacy manual tools only |
| Fastest cash path | Founder manual PW queue + phone (parallel track) |

---

## Section 2 — Blocker Registry

Every blocker is tagged:

| Tag | Meaning |
|---|---|
| **Engineering** | Engineering Director can implement once dependencies are satisfied — no new Founder decision required |
| **Founder** | Requires your decision, approval, budget, policy, or explicit setup |
| **External** | Requires third-party account, provider, legal/compliance body, or vendor terms |

A blocker may have **multiple tags** when more than one party must act.

### Legend

| Status | Meaning |
|---|---|
| 🔴 Open | Actively blocking progress |
| 🟡 Waiting | Blocked by another open item |
| 🟢 Cleared | Complete — move to changelog at bottom |

---

### Platform Engineering blockers

| ID | Blocker | Status | Owner | Unblocks |
|---|---|---|---|---|
| PE-1 | Mission-fit opportunity ranking (`F1`) | 🟡 Waiting | Engineering | Active mission + portfolio prioritization (`A2`, `A3`) |
| PE-2 | Opportunity review packets (`F2`) | 🟡 Waiting | Engineering | `F1`, contact architecture (`D1`) |
| PE-3 | Mission-aware Mission Control (`M1`, `M2`) | 🟡 Waiting | Engineering | `F1`, mission analytics (`L1`) |
| PE-4 | Chief of Staff conversation state (`A1`) | 🔴 Open | Engineering + **Founder** + **External** | Privacy policy published |
| PE-5 | Mission activation workflow (`A2`) | 🟡 Waiting | Engineering + **Founder** | `A1`; Founder approves missions |
| PE-6 | Multi-mission prioritization (`A3`) | 🟡 Waiting | Engineering + **Founder** | `A2`; revenue targets set |
| PE-7 | Runtime store compaction at scale (`Q1`) | 🔴 Open | Engineering | Volume pressure — not launch-critical |
| PE-8 | Database migration plan (`Q3`) | 🔴 Open | Engineering | Future — not launch-critical |

---

### Deployment blockers

| ID | Blocker | Status | Owner | Unblocks |
|---|---|---|---|---|
| DEP-1 | Production deployment architecture (`P1`) | 🔴 Open | **Founder** + Engineering | Hosting provider + budget approved |
| DEP-2 | Hosted Opportunity OS runtime (`OPPORTUNITY_RUNTIME_DIR` on durable volume) | 🔴 Open | Engineering + **Founder** | `DEP-1` |
| DEP-3 | Environment validation script (`P2`) | 🟡 Waiting | Engineering + **External** | `P1`; secrets placeholders defined |
| DEP-4 | Backup and restore (`P3`) | 🔴 Open | **Founder** + Engineering | Backup destination chosen |
| DEP-5 | Secrets policy and scanner (`R1`) | 🔴 Open | Engineering + **Founder** + **External** | Secret manager choice |
| DEP-6 | Production auth hardening for CEO UI | 🔴 Open | **Founder** + Engineering | Auth approach decided |
| DEP-7 | Error alert policy (`S2`) | 🔴 Open | **Founder** + **External** | Alert channel account (email/Slack/PagerDuty) |
| DEP-8 | `PUBLIC_BASE_URL` set for production OS | 🔴 Open | **Founder** | Domain + deploy target confirmed |
| DEP-9 | Production `validate-core.js` in CI/CD | 🟡 Waiting | Engineering | `DEP-1`, `DEP-2` |

---

### Business Discovery blockers

| ID | Blocker | Status | Owner | Unblocks |
|---|---|---|---|---|
| BD-1 | Commercial property connector (`C2`) | 🔴 Open | Engineering + **External** | Google Maps / discovery API credentials |
| BD-2 | Industrial signal connector (`C3`) | 🔴 Open | Engineering + **External** + **Founder** | Paid source budget + legal approval |
| BD-3 | Apartment relationship source (`C4`) | 🔴 Open | Engineering + **External** | Source terms approved |
| BD-4 | Pressure washing opportunity scoring (`O-PW2`) | 🟡 Waiting | Engineering | `F1` mission-fit ranking |
| BD-5 | KTM industrial trigger library (`O-KTM2`) | 🟡 Waiting | Engineering | `C3` industrial feed |
| BD-6 | Government contracts mission (`O-GOV1`) | 🔴 Open | **Founder** | Registration requirements decision |
| BD-7 | Public bid connector (`O-GOV2`) | 🔴 Open | Engineering + **External** | `O-GOV1`, source credentials/terms |
| BD-8 | Connector policy document | 🔴 Open | **Founder** + Engineering | Allowed sources and compliance rules |

**Cleared (reference):** `C1` file-drop intake · `O-WEB2` website scan bridge · mission templates `O-PW1`, `O-KTM1`, `O-APT1`, `O-WEB1`

---

### Contact Discovery blockers

| ID | Blocker | Status | Owner | Unblocks |
|---|---|---|---|---|
| CD-1 | Contact discovery architecture (`D1`) | 🔴 Open | Engineering + **External** + **Founder** | Legal/compliance rules for contact data |
| CD-2 | Buyer role resolver (`D2`) | 🟡 Waiting | Engineering | `D1` |
| CD-3 | Contact candidate store (`D3`) | 🔴 Open | Engineering + **Founder** | PII policy approved |
| CD-4 | Contact enrichment adapters (`D4`) | 🔴 Open | Engineering + **External** + **Founder** | Paid enrichment account + legal approval |
| CD-5 | PII classification policy (`R2`) | 🔴 Open | **Founder** + **External** | Legal counsel on contact field handling |
| CD-6 | Mission activation workflow | 🟡 Waiting | **Founder** + Engineering | `A2` — contacts tied to approved missions |
| CD-7 | Relationship intelligence (`E1`–`E3`) | 🟡 Waiting | Engineering | `D3`, CRM foundation |

---

### Campaign Engine blockers

| ID | Blocker | Status | Owner | Unblocks |
|---|---|---|---|---|
| CE-1 | Mission-fit ranking (`F1`) | 🟡 Waiting | Engineering + **Founder** | Active mission (`A2`, `A3`) |
| CE-2 | Opportunity review packets (`F2`) | 🟡 Waiting | Engineering | `F1`, `D1` |
| CE-3 | Asset draft schema (`G1`) | 🟡 Waiting | Engineering + **Founder** | `F2`; compliance rules defined |
| CE-4 | Offer-specific copy generator (`G2`) | 🟡 Waiting | Engineering + **External** | `G1`; optional `OPENAI_API_KEY` |
| CE-5 | Personalization rules (`G3`) | 🟡 Waiting | Engineering | `G1` |
| CE-6 | Campaign object schema (`H1`) | 🟡 Waiting | Engineering + **Founder** | `F2`, `G1`, `D3`; approval policy clear |
| CE-7 | Campaign review queue (`H2`) | 🟡 Waiting | Engineering + **Founder** | `H1`, CEO dashboard (`N1`) |
| CE-8 | Sequence planner (`H3`) | 🟡 Waiting | Engineering | `H1`, `G2` |
| CE-9 | Campaign execution queue (`H4`) | 🟡 Waiting | Engineering | `H2`, email infra |
| CE-10 | Email compliance architecture (`I1`) | 🔴 Open | **Founder** + **External** | Legal approval of outreach policy |
| CE-11 | Suppression / unsubscribe store (`I2`) | 🔴 Open | Engineering + **Founder** | `I1`, PII policy |
| CE-12 | Sending provider adapter (`I3`) | 🔴 Open | Engineering + **External** + **Founder** | ESP account, domain, API key |
| CE-13 | Scale controller 10k/month (`I4`) | 🔴 Open | Engineering + **External** | Deliverability setup, warm-up complete |
| CE-14 | CEO mission review UI (`N1`) | 🔴 Open | Engineering + **Founder** | Production auth (`DEP-6`) |
| CE-15 | Opportunity review UI (`N2`) | 🟡 Waiting | Engineering | `F2`, `N1` |
| CE-16 | Campaign approval UI (`N3`) | 🟡 Waiting | Engineering + **Founder** | `H2`, compliance policy |
| CE-17 | Outreach approval policy (what Founder must approve) | 🔴 Open | **Founder** | All campaign sends |

---

### CRM blockers

| ID | Blocker | Status | Owner | Unblocks |
|---|---|---|---|---|
| CRM-1 | CRM object model (`J1`) | 🟡 Waiting | Engineering | `D3`, `H1` |
| CRM-2 | CRM update workflow (`J2`) | 🟡 Waiting | Engineering | `J1`, reply/outcome source |
| CRM-3 | Follow-up scheduler bridge (`J3`) | 🟡 Waiting | Engineering + **Founder** | `J1`; follow-up automation policy |
| CRM-4 | Reply ingestion path | 🔴 Open | Engineering + **External** + **Founder** | Inbound email webhook or mailbox |
| CRM-5 | Legacy ↔ OS CRM convergence | 🔴 Open | Engineering | Schema migration decision |

---

### Learning blockers

| ID | Blocker | Status | Owner | Unblocks |
|---|---|---|---|---|
| LR-1 | Outcome event model (`K1`) | 🟡 Waiting | Engineering | CRM (`J1`), campaign outcomes |
| LR-2 | Score calibration proposals (`K2`) | 🟡 Waiting | Engineering + **Founder** | `K1`; sufficient outcome data |
| LR-3 | Playbook learning (`K3`) | 🟡 Waiting | Engineering + **Founder** | `K1`; PII/privacy rules |
| LR-4 | Founder approval for learning changes | 🔴 Open | **Founder** | System must not self-modify weights |

---

### Founder Actions blockers (decision checklist)

These are **Founder-only** actions. Tick when done; update Founder Actions score in Section 1.

| # | Action | Status | Unlocks |
|---|---|---|---|
| F-1 | Publish Privacy Policy | ☐ | `A1`, responsible data collection, CEO UI path |
| F-2 | Approve hosting provider + production budget | ☐ | `P1`, `DEP-1`, `DEP-2` |
| F-3 | Activate Pressure Washing as first revenue mission | ☐ | `A2`, mission-ranked pipeline, `F1` |
| F-4 | Provision Google Maps / commercial discovery API | ☐ | `C2`, `BD-1` |
| F-5 | Approve PII handling policy | ☐ | `D1`, `D3`, `R2`, `CD-3` |
| F-6 | Approve email / outreach compliance policy | ☐ | `I1`, `CE-10`, campaign path |
| F-7 | Create ESP account + register sending domain + DNS | ☐ | `I3`, `CE-12` |
| F-8 | Document outreach approval policy | ☐ | `H2`, `CE-17`, safe autonomy |
| F-9 | Set production `PUBLIC_BASE_URL` + webhook alignment | ☐ | Twilio/webhooks, `DEP-8` |
| F-10 | Choose backup destination + alert channel | ☐ | `P3`, `S2`, `DEP-4`, `DEP-7` |

**Partial credit today:** legacy Vercel hosting and partial Twilio config count toward ~20% Founder Actions — not sufficient for OS launch.

---

### External blockers (accounts, providers, legal)

| ID | Blocker | Status | Required for |
|---|---|---|---|
| EXT-1 | Privacy policy (legal document) | 🔴 Open | `A1`, conversation persistence |
| EXT-2 | PII / data handling legal review | 🔴 Open | Contact discovery, CRM |
| EXT-3 | Email / CAN-SPAM / opt-out legal review | 🔴 Open | All bulk outreach |
| EXT-4 | Google Maps / Places API account | 🔴 Open | PW commercial discovery |
| EXT-5 | Industrial data source (paid/news/RFP) | 🔴 Open | KTM mission |
| EXT-6 | Apartment data source terms | 🔴 Open | Apartment mission |
| EXT-7 | Contact enrichment vendor account | 🔴 Open | Scale contact discovery |
| EXT-8 | Transactional ESP (Resend/SendGrid/etc.) | 🔴 Open | Email campaigns |
| EXT-9 | Sending domain + SPF/DKIM/DMARC | 🔴 Open | Email deliverability |
| EXT-10 | Inbound reply mailbox / parse webhook | 🔴 Open | Reply processing, CRM |
| EXT-11 | Production secret manager | 🔴 Open | Secure credential storage |
| EXT-12 | Alert service account | 🔴 Open | Production monitoring |
| EXT-13 | Backup storage (S3/Blob/etc.) | 🔴 Open | Disaster recovery |
| EXT-14 | Auth provider (if multi-user) | 🔴 Open | CEO dashboard, `N1`, `R3` |
| EXT-15 | Credit app legal approval | 🔴 Open | `O-CR1`, `O-CR2` — defer |
| EXT-16 | Government contractor registration | 🔴 Open | `O-GOV1` — defer |
| EXT-17 | SMS A2P registration | 🔴 Open | SMS campaigns — defer |
| EXT-18 | Source connector ToS / legal review | 🔴 Open | `C2`, `C3`, `C4` |

---

## Section 3 — Blocker Summary by Owner

Quick view of **open** blockers only.

| Owner | Count | Top priority |
|---|---:|---|
| **Founder** | 10 decision actions + 8 policy/approval blockers | F-1 Privacy Policy · F-2 Hosting · F-3 Activate PW mission |
| **External** | 18 | EXT-4 Maps API · EXT-8 ESP · EXT-9 sending domain |
| **Engineering** | 0 immediately executable | **Stopped** — all ready work depends on Founder/External clears |

### What Engineering can do **immediately after** Founder clears F-1, F-2, F-3, F-4

```text
A1 → A2 → A3 → P1 → P2 → C2 → F1 → F2 → D1 → D2 → D3
```

That sequence restores Engineering Director autonomous execution toward first OS-mediated PW revenue.

---

## Section 4 — Operational Launch Checklist

Check items in order. Do not skip compliance and deployment gates.

### Gate 0 — Founder decisions (required before engineering resumes)

- [ ] **F-1** Privacy Policy published
- [ ] **F-2** Hosting provider and budget approved
- [ ] **F-3** Pressure Washing mission activated
- [ ] **F-4** Discovery API credentials provisioned
- [ ] **F-5** PII policy approved
- [ ] **F-6** Email/compliance policy approved
- [ ] **F-8** Outreach approval policy documented

### Gate 1 — Deploy platform

- [ ] Production architecture documented and approved (`P1`)
- [ ] Runtime on persistent storage (`DEP-2`)
- [ ] Environment validation passes (`P2`)
- [ ] Secrets in secret manager, not repo (`R1`)
- [ ] Backup/restore tested (`P3`)
- [ ] `validate-core.js` passes in production-like environment
- [ ] Runtime health report runs on schedule (`S1`)
- [ ] Alert policy active (`S2`)

### Gate 2 — Discover opportunities (Pressure Washing first)

- [ ] Commercial property connector live (`C2`)
- [ ] Mission activation workflow operational (`A2`)
- [ ] Mission-fit ranking live (`F1`)
- [ ] Opportunity review packets generated (`F2`)
- [ ] Mission analytics summary (`L1`)
- [ ] Founder can review opportunities daily

### Gate 3 — Identify contacts

- [ ] Contact architecture validated (`D1`)
- [ ] Buyer roles resolve for PW mission (`D2`)
- [ ] Contact store operational (`D3`)
- [ ] PII policy enforced in stores (`R2`)

### Gate 4 — Approve outreach (manual first)

- [ ] Campaign schema + review queue (`H1`, `H2`)
- [ ] PW copy drafts with approval (`G1`, `G2`)
- [ ] CEO review UI minimum (`N1`, `N2`)
- [ ] **First outreach mode chosen:** ☐ Phone/Twilio ☐ Email pilot
- [ ] If email: ESP + domain + suppression store (`I1`, `I2`, `I3`)
- [ ] First Founder-approved outreach sent
- [ ] First reply or outcome recorded

### Gate 5 — Close loop

- [ ] CRM operational (`J1`, `J2`)
- [ ] Outcome events captured (`K1`)
- [ ] First won job attributed to OS pipeline
- [ ] Learning proposals generated (`K2`) — optional at launch

### Gate 6 — Scale (post-first-revenue)

- [ ] Email warm-up toward 10,000/month per offer (`I4`)
- [ ] KTM connector + mission path (`C3`, `O-KTM2`)
- [ ] Apartment source + sponsors (`C4`, `E3`, `O-APT2`)
- [ ] Autonomous send policy — **Founder explicit written approval only**

---

## Section 5 — Critical Path (shortest launch)

```text
Founder: Privacy + Hosting + Activate PW + Maps API
    ↓
Engineering: A1 → A2 → P1 → P2 → C2 → F1 → F2
    ↓
Founder: PII + Email compliance policies
    ↓
Engineering: D1 → D2 → D3 → H1 → H2 → G1 → G2
    ↓
Founder: Approve first campaign package
    ↓
First revenue event (call or email) → J1 → K1
```

**Parallel track (fastest cash, not OS):** Founder uses legacy PW queue + Twilio today while Gates 0–4 complete.

---

## Section 6 — Launch Day Definition (operational)

Opportunity OS is **operationally launched** when all of the following are true:

| Criterion | Evidence |
|---|---|
| Hosted and backed up | `P1`–`P3` complete; restore tested |
| PW mission active | Founder activated; opportunities ranked by mission fit |
| Live discovery | `C2` feeding signals with provenance |
| Founder review loop | Opportunity packets + approval UI/workflow |
| Contact path | Candidates in store with compliance flags |
| Approved outreach | At least one Founder-approved send/call logged |
| CRM | Outcome recorded for that outreach |
| Monitoring | Health report + alerts configured |
| Kill switch | Campaign/email can be halted without deploy |

**Not required on launch day:** 10k emails/month · autonomous sending · KTM/apartment live · learning auto-apply · credit/government products

---

## Section 7 — Changelog

Record clears here when blockers move to 🟢.

| Date | Blocker | Notes |
|---|---|---|
| 2026-06-30 | — | Initial operational assessment. Engineering Director stopped: no unblocked backlog task. |
| 2026-06-30 | B1–B5, S1, C1, O-* templates, O-WEB2 | Cleared — see backlog execution status |

---

## Section 8 — Related Documents

| Document | Use when |
|---|---|
| [35-deployment-readiness.md](./35-deployment-readiness.md) | Full deployment audit, email-at-scale plan, risk matrix, revenue-by-business |
| [33-master-engineering-backlog.md](./33-master-engineering-backlog.md) | Task IDs, dependencies, validation scripts |
| [34-engineering-director-execution-model.md](./34-engineering-director-execution-model.md) | How engineering resumes after unblocks |
| `reports/backlog-progress-dashboard.md` | Regenerated category percentages |

---

## Amendment

Update this document when:

- A Founder action is completed (tick + update Section 1 Founder Actions %)
- A backlog task moves to `complete` (update area % + changelog)
- A new external blocker appears (add to Section 2)
- Production deploy occurs (refresh Deployment %)

Do not treat Platform Engineering % as Business Readiness %. They measure different things.
