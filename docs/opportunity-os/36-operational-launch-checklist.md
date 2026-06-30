# 36 — Operational Launch Checklist

**Status:** Phase 5.0 — living operational document  
**Last assessed:** 2026-06-30 (Founder actions F-1 through F-10 cleared)  
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
Deployment                ██████░░░░░░░░░░░  35%
Business Discovery        ██████░░░░░░░░░░░  38%
Contact Discovery         ░░░░░░░░░░░░░░░░░   0%
Campaign Engine           ░░░░░░░░░░░░░░░░░   0%
CRM                       ░░░░░░░░░░░░░░░░░   0%
Learning                  ░░░░░░░░░░░░░░░░░   0%
Founder Actions           ██████████░░░░░░  100%
Overall Business Readiness ██████░░░░░░░░░░░  45%
```

### Score definitions

| Area | Score | Basis |
|---|---:|---|
| **Platform Engineering** | 94% | Reasoning pipeline, validation (29 phases), runtime, jobs/events, OpenClaw, Chief of Staff core, Engineering Director, mission registry, observability data — built and regression-tested. Remaining: mission control projection, analytics, scale hardening. |
| **Deployment** | 45% | Vercel + Blob, `PUBLIC_BASE_URL`, backup/alert policy approved (F-2, F-9, F-10). Missing: `P1` doc, hosted OS runtime, env validation implementation. |
| **Business Discovery** | 38% | Backlog: 6/16 tasks complete (`C1`, `O-PW1`, `O-KTM1`, `O-APT1`, `O-WEB1`, `O-WEB2`). **`C2` ready.** Missing: live connector implementation (`C2`–`C4`). |
| **Contact Discovery** | 0% | Policies published; engineering not started (`D1`–`D4`). |
| **Campaign Engine** | 0% | Compliance policies published; engineering not started. |
| **CRM** | 0% | Backlog: 0/3 tasks. Legacy outcome tracking exists outside OS model. |
| **Learning** | 0% | Backlog: 0/3 tasks. Requires CRM outcomes first. |
| **Founder Actions** | 100% | F-1 through F-10 cleared (2026-06-30). See `docs/legal/founder-decisions.md`. |
| **Overall Business Readiness** | 45% | Founder gate complete. Engineering path open on `A1`, `C2`, `P1`, and downstream tasks. |

### Current system state

| Indicator | Value |
|---|---|
| Backlog tasks complete | 12 / 77 (16%) |
| Next unblocked engineering task | **`C2`** (highest scored) · also ready: **`A1`**, **`P1`**, **`I1`**, **`R2`** |
| Engineering Director status | **Unblocked** — Founder gate complete |
| Active production mission | **Pressure Washing** (`mission_pressure_washing_beaumont_500`) — active in `runtime/missions/` |
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
| PE-4 | Chief of Staff conversation state (`A1`) | 🟡 Waiting | Engineering | Privacy policy published (F-1) |
| PE-5 | Mission activation workflow (`A2`) | 🟡 Waiting | Engineering + **Founder** | `A1`; **PW mission active in runtime (F-3).** |
| PE-6 | Multi-mission prioritization (`A3`) | 🟡 Waiting | Engineering + **Founder** | `A2`; revenue targets set |
| PE-7 | Runtime store compaction at scale (`Q1`) | 🔴 Open | Engineering | Volume pressure — not launch-critical |
| PE-8 | Database migration plan (`Q3`) | 🔴 Open | Engineering | Future — not launch-critical |

---

### Deployment blockers

| ID | Blocker | Status | Owner | Unblocks |
|---|---|---|---|---|
| DEP-1 | Production deployment architecture (`P1`) | 🟡 Waiting | Engineering + **Founder** | **Founder approved Vercel + Blob (F-2).** Engineering documents `P1`. |
| DEP-2 | Hosted Opportunity OS runtime (`OPPORTUNITY_RUNTIME_DIR` on durable volume) | 🔴 Open | Engineering + **Founder** | `DEP-1` |
| DEP-3 | Environment validation script (`P2`) | 🟡 Waiting | Engineering + **External** | `P1`; secrets placeholders defined |
| DEP-4 | Backup and restore (`P3`) | 🟡 Waiting | Engineering | **Vercel Blob + Git approved (F-10).** Implement restore test. |
| DEP-7 | Error alert policy (`S2`) | 🟡 Waiting | Engineering | **Alert policy approved — email privacy@ (F-10).** Implement integration. |
| DEP-8 | `PUBLIC_BASE_URL` set for production OS | 🟢 Cleared | **Founder** | **`https://www.pivotalwebsites.com` (F-9)** |
| DEP-5 | Secrets policy and scanner (`R1`) | 🟡 Waiting | Engineering | Vercel env secrets approved; implement scanner |
| DEP-6 | Production auth hardening for CEO UI | 🟢 Cleared | **Founder** | Operator session auth approved (`docs/legal/operations-policy.md`) |
| DEP-9 | Production `validate-core.js` in CI/CD | 🟡 Waiting | Engineering | `DEP-1`, `DEP-2` |

---

### Business Discovery blockers

| ID | Blocker | Status | Owner | Unblocks |
|---|---|---|---|---|
| BD-1 | Commercial property connector (`C2`) | 🟡 Waiting | Engineering | **Discovery API key provisioned (F-4).** Build `C2` connector. |
| BD-2 | Industrial signal connector (`C3`) | 🔴 Open | Engineering + **External** + **Founder** | Paid source budget + legal approval |
| BD-3 | Apartment relationship source (`C4`) | 🔴 Open | Engineering + **External** | Source terms approved |
| BD-4 | Pressure washing opportunity scoring (`O-PW2`) | 🟡 Waiting | Engineering | `F1` mission-fit ranking |
| BD-5 | KTM industrial trigger library (`O-KTM2`) | 🟡 Waiting | Engineering | `C3` industrial feed |
| BD-6 | Government contracts mission (`O-GOV1`) | 🔴 Open | **Founder** | Registration requirements decision |
| BD-7 | Public bid connector (`O-GOV2`) | 🔴 Open | Engineering + **External** | `O-GOV1`, source credentials/terms |
| BD-8 | Connector policy document | 🟢 Cleared | **Founder** | `/legal/source-connectors` — `docs/legal/source-connector-policy.md` |

**Cleared (reference):** `C1` file-drop intake · `O-WEB2` website scan bridge · mission templates `O-PW1`, `O-KTM1`, `O-APT1`, `O-WEB1`

---

### Contact Discovery blockers

| ID | Blocker | Status | Owner | Unblocks |
|---|---|---|---|---|
| CD-1 | Contact discovery architecture (`D1`) | 🟡 Waiting | Engineering | PII and outreach policies published (F-5, F-8) |
| CD-3 | Contact candidate store (`D3`) | 🟡 Waiting | Engineering | PII policy published (F-5) |
| CD-5 | PII classification policy (`R2`) | 🟡 Waiting | Engineering | PII policy published (F-5) |
| CD-2 | Buyer role resolver (`D2`) | 🟡 Waiting | Engineering | `D1` |
| CD-4 | Contact enrichment adapters (`D4`) | 🔴 Open | Engineering + **External** + **Founder** | Paid enrichment account + legal approval |
| CD-6 | Mission activation workflow | 🟡 Waiting | Engineering | `A2` — contacts tied to approved missions |
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
| CE-10 | Email compliance architecture (`I1`) | 🟡 Waiting | Engineering | Email compliance policy published (F-6) |
| CE-11 | Suppression / unsubscribe store (`I2`) | 🟡 Waiting | Engineering | `I1`, PII policy (F-5) |
| CE-12 | Sending provider adapter (`I3`) | 🟡 Waiting | Engineering | Resend + domain in Vercel env (F-7); build adapter |
| CE-13 | Scale controller 10k/month (`I4`) | 🔴 Open | Engineering + **External** | Deliverability setup, warm-up complete |
| CE-14 | CEO mission review UI (`N1`) | 🟡 Waiting | Engineering | Auth approved (DEP-6); build UI |
| CE-15 | Opportunity review UI (`N2`) | 🟡 Waiting | Engineering | `F2`, `N1` |
| CE-16 | Campaign approval UI (`N3`) | 🟡 Waiting | Engineering + **Founder** | `H2`, compliance policy |
| CE-17 | Outreach approval policy (what Founder must approve) | 🟢 Cleared | **Founder** | `/legal/outreach-approval` (F-8) |

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
| F-1 | Publish Privacy Policy | ☑ | **`/privacy`** — `docs/legal/privacy-policy.md` (2026-06-30) |
| F-2 | Approve hosting provider + production budget | ☑ | **Vercel + Blob — approved 2026-06-30** |
| F-3 | Activate Pressure Washing as first revenue mission | ☑ | **Mission #1 active** — `mission_pressure_washing_beaumont_500` |
| F-4 | Provision Google Maps / commercial discovery API | ☑ | **`GOOGLE_MAPS_API_KEY`** in `.env` — Maps Platform key (2026-06-30) |
| F-5 | Approve PII handling policy | ☑ | **`/legal/pii`** — `docs/legal/pii-policy.md` |
| F-6 | Approve email / outreach compliance policy | ☑ | **`/legal/email-compliance`** |
| F-7 | Create ESP account + register sending domain + DNS | ☑ | **Resend + pivotalwebsites.com** — `docs/legal/operations-policy.md` |
| F-8 | Document outreach approval policy | ☑ | **`/legal/outreach-approval`** |
| F-9 | Set production `PUBLIC_BASE_URL` + webhook alignment | ☑ | **`https://www.pivotalwebsites.com`** |
| F-10 | Choose backup destination + alert channel | ☑ | **Vercel Blob + Git; alerts → privacy@** |

**Founder launch gate (F-1–F-10) is complete.** Remaining work is engineering implementation and deferred missions (KTM, apartment, government).

---

### External blockers (accounts, providers, legal)

| ID | Blocker | Status | Required for |
|---|---|---|---|
| EXT-1 | Privacy policy (legal document) | 🟢 Cleared | Published at `/privacy` — `docs/legal/privacy-policy.md` |
| EXT-2 | PII / data handling legal review | 🟢 Cleared | `/legal/pii` |
| EXT-3 | Email / CAN-SPAM / opt-out legal review | 🟢 Cleared | `/legal/email-compliance` |
| EXT-4 | Google Maps / Places API account | 🟢 Cleared | PW commercial discovery — key provisioned (F-4); wire in `C2` |
| EXT-5 | Industrial data source (paid/news/RFP) | 🔴 Open | KTM mission |
| EXT-6 | Apartment data source terms | 🔴 Open | Apartment mission |
| EXT-7 | Contact enrichment vendor account | 🔴 Open | Scale contact discovery |
| EXT-8 | Transactional ESP (Resend/SendGrid/etc.) | 🟢 Cleared | Resend configured in Vercel env (F-7) |
| EXT-9 | Sending domain + SPF/DKIM/DMARC | 🟢 Cleared | pivotalwebsites.com (F-7) |
| EXT-10 | Inbound reply mailbox / parse webhook | 🔴 Open | Reply processing, CRM |
| EXT-11 | Production secret manager | 🔴 Open | Secure credential storage |
| EXT-12 | Alert service account | 🟢 Cleared | Email alerts to privacy@pivotalwebsites.com (F-10) |
| EXT-13 | Backup storage (S3/Blob/etc.) | 🟢 Cleared | Vercel Blob + Git (F-10) |
| EXT-14 | Auth provider (if multi-user) | 🟢 Cleared | Operator session auth (defer IdP) |
| EXT-15 | Credit app legal approval | 🔴 Open | `O-CR1`, `O-CR2` — defer |
| EXT-16 | Government contractor registration | 🔴 Open | `O-GOV1` — defer |
| EXT-17 | SMS A2P registration | 🔴 Open | SMS campaigns — defer |
| EXT-18 | Source connector ToS / legal review | 🟢 Cleared | `/legal/source-connectors` (PW scope) |

---

## Section 3 — Blocker Summary by Owner

Quick view of **open** blockers only.

| Owner | Count | Top priority |
|---|---:|---|
| **Founder** | **0** launch blockers | Gate complete — see deferred list in `docs/legal/founder-decisions.md` |
| **External** | 8 deferred | EXT-5/6/7/10/11/15/16/17 — not required for PW launch |
| **Engineering** | **Multiple ready tasks** | **`C2`** selected · also **`A1`**, **`P1`**, **`I1`**, **`R2`** |

### Next engineering sequence

```text
C2 (PW feed) or A1 → A2 → A3 → P1 → P2 → F1 → F2 → D1 → D2 → D3
```

Founder gate **F-1 through F-10 complete**. Run `node scripts/opportunity-engine/backlog-progress-dashboard.js` for current task.

---

## Section 4 — Operational Launch Checklist

Check items in order. Do not skip compliance and deployment gates.

### Gate 0 — Founder decisions ✅ COMPLETE

- [x] **F-1** Privacy Policy — `/privacy`
- [x] **F-2** Hosting — Vercel + Blob
- [x] **F-3** PW mission #1 active
- [x] **F-4** Maps Platform API key
- [x] **F-5** PII policy — `/legal/pii`
- [x] **F-6** Email compliance — `/legal/email-compliance`
- [x] **F-7** ESP + sending domain — Resend + pivotalwebsites.com
- [x] **F-8** Outreach approval — `/legal/outreach-approval`
- [x] **F-9** `PUBLIC_BASE_URL` — `https://www.pivotalwebsites.com`
- [x] **F-10** Backup + alerts — Vercel Blob + Git; email privacy@

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
| 2026-06-30 | F-5–F-10 | Founder policies published — `/legal/*`, `docs/legal/founder-decisions.md` |
| 2026-06-30 | F-1 | Privacy policy published — `/privacy`, `docs/legal/privacy-policy.md` |
| 2026-06-30 | F-2 | Founder approved Vercel + Blob for production hosting. |
| 2026-06-30 | F-3 | Pressure Washing mission #1 activated — commercial, Beaumont 500 mi, $20k/mo, Founder approves all outreach. Saved active in `runtime/missions/`. |
| 2026-06-30 | F-4 | Google Maps/Places discovery API key provisioned in `.env`. |
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
