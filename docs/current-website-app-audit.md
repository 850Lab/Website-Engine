# Current Website Targeting App — Engineering Audit

Plain-English audit of **Pivotal OS** / website-outreach-engine as of June 2026. Goal: understand what exists before adding pressure washing as a separate mode.

---

## What the app is designed to do

This is a **local business website opportunity system** for field sales:

1. **Discover** businesses (primarily Google Maps scraping)
2. **Score** their websites and qualify them as outreach targets
3. **Generate** preview websites (V7 opportunity projects)
4. **Call/text** owners from a mobile-first queue
5. **Track** outcomes, notes, and recorded calls
6. **Close** website projects ($1k launch funnel + maintenance)

Brand surface: **Pivotal OS** at `/` (Mission Control). Operator login required for all sales pages.

---

## Exact workflow: finding a business → contacting them

```
Google Maps discovery run
  → ingestDiscoveryRecord (pipeline/ingest-discovery.js)
  → scoreWebsiteQuality + evaluateQualification
  → upsertQualifiedBusiness (data/qualified-businesses.json)
  → optional: analyzeBusinessAngle (angle-analyses.json)
  → optional: POST /api/stage1/businesses/:id/project → preview site in previews-v3/
  → founder opens /call-queue on phone
  → GET /api/mission-control/sales/next → lead with scripts
  → Call with Recording (Twilio) or Call Direct (tel:)
  → Log result → PATCH outcome → outreachStatus on business record
  → notes/calls append to salesNotes[] / salesCalls[] on same record
```

**Daily loop (founder):**

1. Open `/` — see daily goals, Twilio test card, next best lead
2. Go to `/call-queue` — one lead at a time, mobile dock (Log result / Next)
3. Call → log outcome → next lead
4. Check `/pipeline` and `/opportunities` for funnel view

---

## Database / data structure

### Canonical CRM: qualified businesses

| Item | Value |
|------|--------|
| File | `data/qualified-businesses.json` |
| Shape | `{ version: 1, records: BusinessRecord[] }` |
| Module | `src/stage1/qualified-business-store.js` |
| IDs | `qbd_*` |

**Key fields on each record:**

- Identity: `businessName`, `industry`, `category`, `city`, `state`, `address`, `dedupKey`
- Google: `googleMapsUrl`, `googleRating`, `googleReviewCount`
- Website: `websiteUrl`, `websiteStatus`, `websiteScore`, `websiteScoreReasons`
- Contact: `phone`, `normalizedPhone`, `email`, `socialUrls`, `contactMethodCategory`
- Qualification: `qualificationStatus`, `qualificationReason`
- Project: `opportunityProjectId`, `previewUrl`, `previewGenerated`, `readyForOutreach`
- Outreach (runtime): `outreachStatus`, `outreachStatusUpdatedAt`, `salesNotes[]`, `salesCalls[]`
- Operators: `assignedOperatorId`, `lastOperatorId`

### Supporting stores

| File | Purpose |
|------|---------|
| `data/angle-analyses.json` | Sales angle, opening line, priority label per business |
| `data/website-quality-scores.json` | Scoring audit trail |
| `data/opportunity-projects.json` | V7 project metadata (filesystem only) |
| `previews-v3/` | Generated HTML preview sites |
| `data/call-sessions.json` | Twilio call session state (blob-aware) |
| `data/operators.json` | Multi-operator auth |
| `data/founder-os.json` | **Legacy parallel CRM** — not updated by call queue |

### Persistence: local vs remote

| Store | Local disk | Vercel Blob |
|-------|------------|-------------|
| Qualified businesses | ✓ | ✓ (if `BLOB_READ_WRITE_TOKEN`) |
| Angle analyses | ✓ | ✓ |
| Call sessions, operators, Twilio settings | ✓ | ✓ |
| Opportunity projects + preview HTML | ✓ | ✗ (lost on serverless redeploy) |
| Founder-os, identities | ✓ | ✗ |

Production sales outcomes **persist** via Blob. Preview URLs may **404** after redeploy unless previews are re-generated or migrated.

---

## How businesses are qualified

1. **Website score** (`src/stage1/website-quality-score.js`) — HTTPS, mobile, CTA, PageSpeed, etc.
2. **Qualification rules** (`src/stage1/qualification.js`):
   - `no_website` → qualified
   - `poor_website` → qualified
   - `good_website` → rejected
   - Must have phone or email
3. **Angle priority** (`src/angle-analysis/analyzer.js`) — Hot/Warm/Nurture for queue ordering
4. **Ready for outreach** — requires verified preview project (`isReadyForOutreach`)

Pressure washing does **not** need website qualification — different buyer signal.

---

## Outreach status tracking

**Canonical statuses** (`OUTREACH_STATUSES` in qualified-business-store):

`not_contacted` → `contacted` → `replied` → `asked_price` → `appointment` → `won` | `lost`

Updated via `updateSalesOutcome()` in `src/mission-control/sales-mode.js`.

**Legacy duplicate:** `founder-os.json` uses a different 9-state enum — partially bridged in `outreach-page.js` only.

---

## Call notes, texts, follow-ups

| Type | Storage | Writer |
|------|---------|--------|
| Sales notes | `salesNotes[]` on business | `appendSalesNote()` |
| Call metadata + recording | `salesCalls[]` on business | `twilio-voice/sales-calls.js` |
| Call sessions | `call-sessions.json` | `call-session-store.js` |
| Text content | **Not stored** — pre-filled `sms:` link from `sales-brief/outreach-copy.js` |
| Founder timeline | `founder-os.json` | Separate system, not wired to queue |

**Gap:** Call queue UI has no **Add Note** field (API exists; legacy sales mode page had it).

---

## Founder workflow pages

| Route | Component | Role |
|-------|-----------|------|
| `/` | `pivotal-os/pages/home.js` | Mission dashboard, Twilio test, next lead |
| `/call-queue` | `pivotal-os/pages/call-queue.js` | **Primary mobile sales surface** |
| `/pipeline` | `pivotal-os/pages/pipeline.js` | Funnel stages |
| `/opportunities` | `pivotal-os/pages/opportunities.js` | Angle folders |
| `/settings` | `pivotal-os/pages/settings.js` | Profile, team, Twilio Voice |
| `/login` | `pivotal-os/pages/login.js` | Auth |
| `/outreach` | `outreach-page.js` | Desktop list (older) |

Shell: `src/pivotal-os/shell.js` — bottom nav, dark theme, 56–64px tap targets.

---

## Mobile buttons / actions (call queue)

| Button | Behavior |
|--------|----------|
| Call with Recording | `POST /api/calls/start` → Twilio bridge |
| Call Direct | `tel:` link |
| Text | `sms:?body=` with follow-up copy |
| Open preview | `/p/:projectId` |
| Log result | Bottom sheet → outcome → `PATCH .../outcome` |
| Next lead → | `GET /api/mission-control/sales/next` |

---

## Most important files

```
src/server.js                    — Express entry, auth, route registration
src/pivotal-os/routes.js         — Pivotal OS pages + dashboard APIs
src/pivotal-os/pages/call-queue.js — Mobile call UI
src/pivotal-os/metrics.js        — Dashboard metrics, pipeline
src/mission-control/sales-mode.js — Sales API (queue, outcome, notes)
src/mission-control/sales-queue.js — Queue build + lead merge w/ angles
src/stage1/qualified-business-store.js — Canonical business CRM
src/stage1/qualification.js      — Website qualification rules
src/angle-analysis/analyzer.js   — Sales angles / priority
src/preview-v3.js                — Preview site generator
src/v7/opportunity-project.js    — Project creation
src/twilio-voice/routes.js       — Click-to-call + recording
src/persistence/json-document-store.js — Blob vs filesystem
src/operators/*                  — Login, sessions, lead assignment
```

---

## What works well (reuse for pressure washing)

- **Pivotal OS shell** — mobile-first layout, bottom nav, tap targets
- **Call queue pattern** — one lead, dock actions, outcome sheet
- **Operator auth** — site-wide login, owner vs operator
- **JSON + Blob persistence** — `readJsonDocument` / `writeJsonDocument`
- **Twilio Voice** — click-to-call (can stay website-only initially)
- **tel: / sms: deep links** — zero-config mobile calling/texting
- **Daily dashboard pattern** — `metrics.js` + card grid
- **Separate campaign data store** — cleanest path for PW leads

---

## What should NOT be reused as-is

- **Website qualification** (`no_website` / `poor_website` gates) — wrong signal for PW
- **Angle analysis / preview generation** — website-specific; PW uses cleaning angles
- **founder-os.json** parallel store — avoid third CRM
- **OUTREACH_STATUSES** website funnel — PW needs estimate/won/lost/visit states
- **Ready-for-outreach preview gate** — not applicable
- **Twilio test business** — website-specific

---

## Broken, duplicated, or confusing parts

| Issue | Severity |
|-------|----------|
| Split persistence (blob CRM vs FS previews) | High in production |
| founder-os vs qualified businesses duplicate | Medium |
| Two sales UIs (call-queue vs renderSalesModePage) | Low |
| Daily “calls” metric uses status change proxy, not real calls | Medium |
| No note UI in call queue | Medium |
| README says Mission Control removed; it’s Pivotal OS at `/` | Low |
| `good_website` at score exactly 70 edge case | Low |

---

## Recommended next build steps (pressure washing)

1. Add **`src/pressure-washing/`** module with its own lead store (`data/pressure-washing-leads.json`, blob-aware)
2. Add **`/pw`** routes — separate dashboard + queue; do not modify website queue logic
3. Reuse **shell pattern** with Zeal Power Washing branding (water blue accent)
4. Reuse **operator auth** and **tel/sms** actions; defer Twilio integration for PW leads
5. Implement **PW-specific statuses** and **priority scoring** (restaurants, SE Texas cities)
6. Ship **seed leads** for Southeast Texas restaurants
7. Add **mode switch** link: Website (`/`) ↔ Power Washing (`/pw`)
8. Later: import from Google Maps discovery filtered by PW industries

See `docs/pressure-washing-build-plan.md` for implementation details.
