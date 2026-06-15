# Customer Dashboard Specification (V7)

**Version:** 1.0
**Status:** Normative for all customer-facing UI
**Companion:** `VISIBILITY_UNIT_SPEC.md` (internal fulfillment only)

---

## 1. Design principle

The customer dashboard is a **trust engine**, not a fulfillment ledger.

| Wrong feeling | Right feeling |
|---------------|---------------|
| "A counter is increasing." | "Something is happening." |
| "I'm buying 1,000 units." | "People in my area are starting to find me." |
| "24.7% complete" | "We're building momentum." |

**Visibility Units (VUs)** remain the internal atomic fulfillment metric. Customers never see VU counts, unit numbers, entitlements, or percentage-to-quota progress.

---

## 2. Customer-facing metric model

### 2.1 Primary metrics (always visible)

| Metric | Source | Customer label | Never show |
|--------|--------|----------------|------------|
| **Visitors** | First-party analytics (`wop_sid`, page views on project domain) | "People who visited your site" | Raw session logs |
| **Activity** | Derived from delivered VUs → Activity Events (§4) | "What's happened lately" | VU ids, scores, keys |
| **Momentum** | Computed state (§5) | "Campaign momentum" | `visibilityDelivered / 1000` |
| **Movement** | Week-over-week deltas | "This week" callouts | Internal unit # |

### 2.2 Secondary metrics (supporting)

| Metric | Customer label |
|--------|----------------|
| `contentPublished` | "Pages & articles live" (count only, no quota) |
| `visitorsThisWeek` | "Visited this week" |
| `lastActivityAt` | "Last update" (relative time) |

### 2.3 Forbidden on customer dashboard

- `visibilityDelivered`, `visibilityRemaining`, `entitlement`
- `unitNumber`, `visibilityKey`, `qualificationScore`
- `Campaign Progress: 24.7%`
- `247 / 1000`
- "Visibility Unit", "Discovery Opportunity"
- Intent Radar raw scrape data
- Operator notes, rejection codes

---

## 3. Information architecture

```
┌─────────────────────────────────────────┐
│  HEADER: Business name · Site status    │
├─────────────────────────────────────────┤
│  MOMENTUM STRIP (hero)                  │
│  state + one-line outcome sentence      │
├─────────────────────────────────────────┤
│  THIS WEEK (movement)                   │
│  visitors delta · activity count        │
├─────────────────────────────────────────┤
│  ACTIVITY FEED (primary scroll)         │
│  outcome-oriented events, newest first  │
├─────────────────────────────────────────┤
│  YOUR WEBSITE (action)                  │
│  open site · share link                 │
├─────────────────────────────────────────┤
│  QUIET FOOTER                           │
│  help · account                         │
└─────────────────────────────────────────┘
```

**Order rule:** Momentum → Movement → Activity. Never lead with a progress bar to a numeric goal.

---

## 4. Activity Events (customer layer)

Each delivered Visibility Unit MUST emit exactly one **Activity Event** for the customer feed. The VU ledger is authoritative; the feed is the presentation layer.

### 4.1 Activity Event schema

```json
{
  "id": "act_{uuid}",
  "projectId": "wop_...",
  "visibilityUnitId": "vu_...",
  "type": "page_live|article_live|local_need_addressed|momentum_notice",
  "headline": "string max 80 chars, outcome language",
  "detail": "string max 200 chars, plain English",
  "geoLabel": "Beaumont area",
  "occurredAt": "ISO-8601",
  "cta": { "label": "View page", "url": "https://..." }
}
```

### 4.2 VU → Activity copy mapping (normative)

| Internal `actionType` | `type` | Headline template |
|----------------------|--------|-------------------|
| `intent_page_published` | `page_live` | "New page live for people dealing with {intentPlain}" |
| `local_content_published` | `article_live` | "New article helping homeowners with {intentPlain}" |
| `profile_visibility_update` | `local_need_addressed` | "Your business profile updated for {geoLabel}" |
| `intent_visibility_delivered` | `local_need_addressed` | "We addressed a local need: {intentPlain}" |

`intentPlain` = customer-safe phrase derived from `rawIntentText` (no normalization keys, no class names).

**Example (VU #437 internal, customer sees):**

```json
{
  "headline": "New article helping homeowners with siding stains",
  "detail": "People in Beaumont often search when HOA letters mention exterior stains. Your site now answers that.",
  "type": "article_live"
}
```

Customer does **not** see: #437, visibility unit, intent class `problem`, or `/1000`.

### 4.3 System-generated activity (non-VU)

| `type` | Trigger | Headline |
|--------|---------|----------|
| `momentum_notice` | Momentum state upgrade (§5) | "Your campaign is building momentum" |
| `visitor_milestone` | Visitors cross 10, 25, 50, 100 (lifetime) | "More people are finding your website" |
| `campaign_started` | Activation complete | "Your visibility campaign is live" |

---

## 5. Momentum states (customer-facing)

Momentum is **qualitative + derived**. It is NOT `visibilityDelivered / entitlement`.

### 5.1 States (closed enum)

| State | Customer label | Entry condition (all internal) |
|-------|----------------|-------------------------------|
| `launching` | "Getting started" | Activation complete; <3 activity events |
| `building` | "Building momentum" | ≥3 activity events OR ≥5 visitors |
| `active` | "People are finding you" | ≥10 visitors AND ≥1 activity in last 14 days |
| `strong` | "Strong local presence" | ≥25 visitors AND ≥3 activities in last 30 days |

States only move **forward** unless project paused. Downgrade never shown to customer.

### 5.2 Momentum strip copy (normative)

| State | Primary line | Subline |
|-------|--------------|---------|
| `launching` | "Your campaign just went live." | "We're watching what people in your area need." |
| `building` | "Something is happening." | "{visitorsThisWeek} people visited this week." |
| `active` | "People in your area are finding you." | "{activityCountThisWeek} updates this week." |
| `strong` | "Your visibility is growing." | "Keep sharing your site link with customers." |

### 5.3 Visual treatment

- Use a **pulse indicator** (subtle animation on first load after new activity), not a filling quota bar.
- Optional soft arc or stage dots (4 stages) — **no percentages**.
- Never display `X / 1000` or `% complete`.

---

## 6. Movement block ("This week")

Always show week-over-week **outcomes**:

```
THIS WEEK
  12 people visited your site          (+4 vs last week)
  3 updates published for your area
  Last activity · 2 hours ago
```

Rules:

- Deltas only when prior week data exists; otherwise omit comparison.
- "Updates published" = activity events with `type` ∈ {page_live, article_live, local_need_addressed} in last 7 days.
- Green/up only for positive visitor delta; neutral copy for zero ("We're still early — share your link").

---

## 7. Wireframe — desktop

```
┌────────────────────────────────────────────────────────────────┐
│  Joe's Pressure Washing                    [Open my site]      │
│  ● Live · Beaumont, TX                                         │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  ● ● ● ○   Building momentum                                   │
│                                                                │
│  Something is happening.                                       │
│  12 people visited your site this week.                        │
│                                                                │
├────────────────────────────────────────────────────────────────┤
│  THIS WEEK                                                     │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐            │
│  │ 12           │ │ 3            │ │ 2h ago       │            │
│  │ site visits  │ │ area updates │ │ last activity│            │
│  │ +4 vs prior  │ │              │ │              │            │
│  └──────────────┘ └──────────────┘ └──────────────┘            │
├────────────────────────────────────────────────────────────────┤
│  RECENT ACTIVITY                                               │
│                                                                │
│  Today                                                         │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  New page live for people who need driveway cleaning     │  │
│  │  Your site now speaks to homeowners in 77706.            │  │
│  │  [ View page ]                                           │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                │
│  Yesterday                                                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  More people are finding your website                    │  │
│  │  You've had 25 visits since launch.                      │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                │
│  Jun 8                                                         │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  New article helping homeowners with siding stains       │  │
│  │  Common when HOA letters mention exterior stains.        │  │
│  │  [ Read article ]                                        │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                │
│  [ Load more ]                                                 │
│                                                                │
├────────────────────────────────────────────────────────────────┤
│  12 pages & articles live on your site                         │
│  Questions? support@pivotalwebsites.com                        │
└────────────────────────────────────────────────────────────────┘
```

---

## 8. Wireframe — mobile (primary)

```
┌─────────────────────────┐
│ Joe's Pressure Washing  │
│ ● Live                  │
│ [ Open my site ]        │
├─────────────────────────┤
│ ●●●○ Building momentum  │
│                         │
│ Something is            │
│ happening.              │
│ 12 visits this week     │
├─────────────────────────┤
│ THIS WEEK               │
│ 12 visits · +4          │
│ 3 updates · 2h ago      │
├─────────────────────────┤
│ RECENT ACTIVITY         │
│ ┌─────────────────────┐ │
│ │ New page live for   │ │
│ │ driveway cleaning   │ │
│ │ [ View page ]       │ │
│ └─────────────────────┘ │
│ ┌─────────────────────┐ │
│ │ New article: siding │ │
│ │ stains & HOA        │ │
│ └─────────────────────┘ │
├─────────────────────────┤
│ 12 pages live           │
└─────────────────────────┘
```

---

## 9. API contract (customer dashboard)

### `GET /api/customer/projects/:projectId/dashboard`

Response shape (customer-safe only):

```json
{
  "projectId": "wop_joespw",
  "businessName": "Joe's Pressure Washing",
  "siteStatus": "live",
  "siteUrl": "https://...",
  "momentum": {
    "state": "building",
    "label": "Building momentum",
    "headline": "Something is happening.",
    "subline": "12 people visited your site this week."
  },
  "thisWeek": {
    "visitors": 12,
    "visitorsDelta": 4,
    "updatesPublished": 3,
    "lastActivityAt": "ISO-8601"
  },
  "totals": {
    "visitors": 38,
    "contentLive": 12
  },
  "activity": [
    { "id": "act_...", "type": "page_live", "headline": "...", "detail": "...", "occurredAt": "...", "cta": {} }
  ]
}
```

**Must not appear in this response:** `visibilityDelivered`, `entitlement`, `unitNumber`, `visibilityKey`.

### Operator-only: `GET /api/operator/projects/:projectId/fulfillment`

Returns VU ledger, counts, entitlement, dispute data — operator-only.

---

## 10. Empty and early states

| Situation | Customer sees |
|-----------|---------------|
| Just activated, 0 visitors | "Your campaign just went live." + "Share your site link to get your first visitors." |
| 0 activity events | "We're watching what people in your area need." — no empty counter |
| 0 visitors week 2 | "We're still early." — not "0 / 1000" |

Never show an empty progress bar.

---

## 11. Renewal (customer language)

When internal `visibilityDelivered >= entitlement` (operator knows campaign fulfilled):

| Internal | Customer sees |
|----------|---------------|
| 1000/1000 VUs | Momentum state `strong` + activity feed continues if renewal active |
| Entitlement exhausted, no renewal | "Your campaign period is complete." + renewal CTA — **not** "1000/1000 visibility units" |

---

## 12. Implementation notes (Phase 1–2)

1. **Phase 1 dashboard:** Momentum `launching`, activity feed with `campaign_started` only, visitors = 0 with encouraging copy.
2. **Phase 2:** On VU delivery, write Activity Event + recompute momentum; still no VU numbers on customer API.
3. **Visitor pixel:** First-party script on preview/live site; increments `visitors` only.
4. **Operator tools** retain fulfillment tab with full VU ledger for disputes and economics.

---

## 13. Acceptance criteria

- [ ] No customer screen shows `N / 1000` or percent-to-quota
- [ ] Every delivered VU produces one human-readable activity line
- [ ] Dashboard loads with meaningful copy when visitors = 0
- [ ] Momentum state changes at least once in first 14 days for active projects
- [ ] Operator can audit VU #437 without customer ever seeing "437"
