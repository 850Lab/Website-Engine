# Pressure Washing Mode — Build Plan

**Zeal Power Washing** outreach runs as a **separate campaign mode** inside the same app. Website targeting at `/` stays untouched.

---

## Safest implementation path

| Decision | Choice | Why |
|----------|--------|-----|
| Data store | New `data/pressure-washing-leads.json` | No risk to website qualified businesses |
| Routes | `/pw`, `/pw/queue` | Clear separation from `/call-queue` |
| API prefix | `/api/pressure-washing/*` | Isolated from mission-control sales APIs |
| Auth | Reuse existing operator login | Same team, same sessions |
| Calling | `tel:` + `sms:` first | Works from phone while DoorDashing; Twilio optional later |
| UI | Clone call-queue shell pattern | Proven mobile UX, different accent color |
| Scoring | New `scoring.js` | Restaurant/foot-traffic logic, not website score |

**Do not:** merge PW leads into `qualified-businesses.json`, change website qualification, or remove Pivotal OS routes.

---

## Module layout

```
src/pressure-washing/
  index.js           — registerPressureWashingRoutes
  lead-store.js      — CRUD, blob-aware JSON
  statuses.js        — PW status enum + labels
  industries.js      — prioritized categories + SE Texas cities
  scoring.js         — priorityScore 0–100
  scripts.js         — restaurant opener, gatekeeper, follow-up text
  metrics.js         — daily dashboard aggregates
  seed-leads.js      — sample Southeast Texas leads
  routes.js          — REST API

src/pivotal-os/pages/
  pw-home.js         — daily dashboard
  pw-queue.js        — mobile lead cards + quick actions

src/pivotal-os/
  zeal-shell.js      — PW nav + water-blue theme
```

---

## Lead record schema

Each lead (`pwl_*` id):

| Field | Type | Notes |
|-------|------|-------|
| businessName | string | |
| industry | string | From industries list |
| address, city | string | SE Texas target cities |
| phone, normalizedPhone | string | E.164 for tel/sms |
| website, googleMapsUrl | string | optional |
| googleRating, reviewCount | number | |
| ownerOrManagerName | string | |
| contactRole, contactSource | string | |
| pressureWashingAngle | string | Why target them |
| likelyNeeds | string[] | dumpster pad, entrance, etc. |
| offer | string | Simple estimate offer |
| priorityScore | 0–100 | Computed + manual bump |
| status | enum | See statuses.js |
| lastContactedAt, nextFollowUpAt | ISO | |
| callAttempts, conversationCount | number | |
| estimateStatus, estimateAmount | string/number | |
| jobStatus | string | |
| notes, objections, followUpNotes | string[] | timestamped entries |
| flags | object | driveThru, outdoorSeating, dumpsterPad, curbAppealIssue |

---

## Priority scoring (0–100)

| Signal | Points |
|--------|--------|
| Restaurant / fast food / cafe | +25 |
| Has drive-thru | +10 |
| Outdoor seating | +8 |
| Review count ≥ 100 | +10 |
| Review count ≥ 50 | +5 |
| Target SE Texas city | +10 |
| Has direct phone | +10 |
| Owner/manager name known | +8 |
| Dumpster pad likely (manual flag) | +12 |
| Curb appeal issue noted | +10 |
| Not contacted in 14+ days | +5 |
| Already contacted this week | −15 |

Recalculate on save/import via `computePriorityScore(lead)`.

---

## PW statuses

`not_contacted`, `contacted`, `interested`, `not_interested`, `follow_up`, `estimate_sent`, `estimate_needed`, `needs_visit`, `needs_before_photos`, `needs_quote`, `won`, `lost`

Quick-action buttons map 1:1 to status updates (+ increment counters where relevant).

---

## Mobile queue UX

Same pattern as website call queue:

- Hero: business name, phone, city, score badge
- **Why target:** angle + likely needs
- **Script card:** restaurant opener (expandable)
- **Big buttons:** Call, Text, Add Note, Interested, Not Interested, Follow Up, Estimate Sent, Won, Lost, Needs Visit, Needs Before Photos, Needs Quote
- **Dock:** Log result sheet + Next lead
- **Follow-up due** badge when `nextFollowUpAt <= today`

---

## Dashboard metrics

- Calls today (`callAttempts` delta or status → contacted today)
- Conversations today (`conversationCount` or interested/contacted with note)
- Interested today
- Estimates needed / sent
- Follow-ups due
- Jobs won
- Revenue quoted / won (sum `estimateAmount`)
- Top industries responding
- Next best lead (highest priority, callable, not closed)

---

## Scripts (in-app)

Stored in `scripts.js`, rendered on queue card:

1. **Restaurant opener** — Jaylan / Zeal Power Washing / dumpster pads & entrances
2. **Owner available** — quick estimate offer
3. **Gatekeeper** — who handles exterior cleaning
4. **Follow-up SMS** — short text template for `sms:` body

---

## Seed data

10–15 sample leads: Beaumont/Port Arthur/Nederland restaurants and retail with realistic phones (placeholder), varied scores, mix of statuses for pipeline testing.

Seed runs on startup if store empty (`seedPressureWashingLeadsIfEmpty`).

---

## Phase 2 (not in v1)

- Import PW leads from Stage1 discovery (filter by industry)
- Twilio recorded calls for PW leads
- PropStream / Roboflow / Apollo integrations
- Before/after photo upload
- Route map by city

---

## Testing checklist

- [ ] `/pw` loads dashboard after login
- [ ] `/pw/queue` shows highest-priority lead
- [ ] Call opens phone dialer
- [ ] Text opens SMS with follow-up script
- [ ] Quick actions update status and persist (refresh page)
- [ ] Add note appends to notes[]
- [ ] Follow-up date respected in “due today” count
- [ ] Website `/call-queue` unchanged
- [ ] Blob persistence on Vercel for `pressure-washing-leads.json`
