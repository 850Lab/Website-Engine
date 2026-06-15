# Visibility Unit Specification (V7)

**Version:** 1.0
**Status:** Normative — supersedes `DISCOVERY_OPPORTUNITY_SPEC.md`
**Internal term:** Visibility Unit (VU)
**Customer-facing term:** Never "Visibility Unit" — use *visibility delivered*, *being found*, *discovery*, *attention*

---

## 1. Purpose

A **Visibility Unit** is the atomic unit of fulfillment for a Website Opportunity Project.

It answers: *"What did we do to help this business become discoverable for a specific piece of local intent?"*

Used for:

- Launch entitlement (default: **1,000** per project)
- **Internal** fulfillment accounting, guarantees, renewals, and dispute resolution
- **Operator** fulfillment views only

Customer dashboard presentation is defined in `CUSTOMER_DASHBOARD_SPEC.md`. Customers never see VU counts, entitlements, or quota percentages.

A Visibility Unit is **not**:

- A raw keyword
- A website template
- A page view
- An operator prospecting lead
- An unpublished draft

---

## 2. Definition

> **Visibility Unit:** One persisted ledger record where a **qualified Intent Signal** was paired with a **completed Visibility Action** for exactly one Website Opportunity Project, with `status = delivered`.

**Counting rule:**

```
visibilityDelivered(projectId) =
  COUNT(records WHERE projectId = X AND status = 'delivered')
```

Only `status = delivered` increments the customer-facing count.

---

## 3. Critical examples (normative narratives)

### Visibility Unit #1

**Project:** Joe's Pressure Washing, Beaumont TX (`wop_joespw`)
**Intent Signal (classified):**

| Field | Value |
|-------|-------|
| `intentClass` | `buying_signal` |
| `rawIntentText` | "need my driveway cleaned before the weekend" |
| `geoCell` | `zip:77706` |
| `intentSignalKey` | `buying_signal\|need driveway cleaned weekend\|zip:77706` |

**Visibility Action completed:**

| Field | Value |
|-------|-------|
| `actionType` | `intent_page_published` |
| `actionRef` | `/services/driveway-cleaning-beaumont` (live URL on project site) |
| `actionCompletedAt` | `2026-06-10T14:22:00Z` |

**Owner sees on dashboard:**
*"Driveway cleaning intent in 77706 — page live targeting 'need driveway cleaned'."*

**Why it counts:** Qualified intent in service area + deduplicated key + visibility action verified live + `deliveredAt` set when dashboard card first shown.

---

### Visibility Unit #437

**Project:** Same (`wop_joespw`), entitlement 1000, currently 436 delivered.

**Intent Signal:**

| Field | Value |
|-------|-------|
| `intentClass` | `problem` |
| `rawIntentText` | "black streaks on siding HOA sent a letter" |
| `geoCell` | `city:beaumont\|TX` |
| `intentSignalKey` | `problem\|black streaks siding hoa letter\|city:beaumont\|TX` |

**Visibility Action:**

| Field | Value |
|-------|-------|
| `actionType` | `local_content_published` |
| `actionRef` | `/blog/hoa-siding-stains-beaumont` |
| `actionCompletedAt` | `2026-09-02T09:15:00Z` |

**Why it counts:** This is the 437th **unique** `visibilityKey` delivered for this project. Prior 436 records each had distinct `visibilityKey` values. A duplicate HOA siding post for the same normalized intent would **not** become #438.

**If challenged:** Show ledger row `vu_…`, `visibilityKey` hash, intent normalization log, live URL check at `actionRef`, and `deliveredAt` timestamp.

---

### Visibility Unit #1000

**Project:** Same, final entitlement unit.

**Intent Signal:**

| Field | Value |
|-------|-------|
| `intentClass` | `recommendation_request` |
| `rawIntentText` | "anyone know a good pressure washer near me" |
| `geoCell` | `zip:77701` |
| `intentSignalKey` | `recommendation_request\|anyone know good pressure washer\|zip:77701` |

**Visibility Action:**

| Field | Value |
|-------|-------|
| `actionType` | `intent_page_published` |
| `actionRef` | `/beaumont-pressure-washing-reviews` |
| `actionCompletedAt` | `2026-11-18T16:40:00Z` |

**System behavior:** On delivery, `visibilityDelivered` reaches **1000**. Entitlement gate blocks unit #1001 with `rejectedReason = entitlement_exhausted`.

**Customer message (via dashboard):** *"Your campaign period is complete. Renew to keep building momentum."* — never show `1,000 / 1,000` (see `CUSTOMER_DASHBOARD_SPEC.md` §11).

---

## 4. Record schema (normative)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | UUID | yes | `vu_{uuid}` |
| `unitNumber` | integer | yes | Monotonic per project: 1..entitlement at delivery time |
| `projectId` | string | yes | Website Opportunity Project id |
| `intentClass` | enum | yes | §5 |
| `rawIntentText` | string | yes | Source text (max 500 chars) |
| `intentSignalKey` | string | yes | §6 |
| `actionType` | enum | yes | §7 |
| `actionRef` | string | yes | URL or asset id proving completion |
| `visibilityKey` | string | yes | `sha256(projectId + ":" + intentSignalKey + ":" + actionType)` hex |
| `geoCell` | string | yes | §8 |
| `serviceCategory` | string | yes | Project category at delivery |
| `qualificationScore` | int 0–100 | yes | §9 |
| `status` | enum | yes | `candidate` \| `qualified` \| `delivered` \| `rejected` \| `expired` |
| `ownerTitle` | string | yes | Customer-facing headline (max 120) — no jargon |
| `ownerSummary` | string | yes | Plain-language summary (max 500) |
| `source` | enum | yes | §10 |
| `sourceRef` | string | no | Radar run id, operator id, etc. |
| `identifiedAt` | ISO-8601 | yes | Intent first detected |
| `qualifiedAt` | ISO-8601 | no | Passed qualification |
| `actionCompletedAt` | ISO-8601 | no | Action verified live |
| `deliveredAt` | ISO-8601 | no | Dashboard first showed this unit |
| `rejectedAt` | ISO-8601 | no | |
| `rejectedReason` | string | no | §11 |

**Uniqueness:** At most one record per `(projectId, visibilityKey)`.

**unitNumber assignment:** On transition to `delivered`, set `unitNumber = visibilityDelivered(projectId)` **before** increment (i.e. first delivered gets `unitNumber = 1`).

---

## 5. Intent classes (closed enum — Intent Radar)

| `intentClass` | Detect when text expresses… | Example |
|---------------|----------------------------|---------|
| `problem` | A pain or symptom | "black driveway", "roof stains" |
| `question` | Information seeking | "how much does pressure washing cost" |
| `complaint` | Frustration / warning | "HOA warning", "contractor no-show" |
| `buying_signal` | Ready-to-buy language | "need X cleaned", "looking to hire" |
| `recommendation_request` | Asking for referrals | "who can pressure wash", "anyone know a roofer" |
| `comparison_request` | Evaluating options | "X vs Y", "is it worth hiring" |
| `service_request` | Direct service ask | "pressure wash my house Tuesday" |

Phase 1–2 may use `manual_operator` classification. Phase 3 uses Intent Radar classifier. **Counting does not depend on classifier version** — only on stored `intentClass` + `intentSignalKey`.

---

## 6. Intent signal key (normative)

```
intentSignalKey = intentClass + "|" + normalizeIntent(rawIntentText) + "|" + geoCell
```

**normalizeIntent(text):**

1. Lowercase, trim
2. Remove URLs, emails, phone numbers
3. Remove punctuation except spaces
4. Remove stopwords: `a`, `an`, `the`, `my`, `me`, `i`, `we`, `in`, `on`, `for`, `to`, `near`, `please`, `anyone`, `someone`, `who`, `can`, `need`, `looking`
5. Collapse whitespace
6. Sort remaining tokens alphabetically, join with space
7. Truncate to 80 chars

**Example:**
`"who can pressure wash my driveway"` → class `recommendation_request` →
`normalizeIntent` → `"driveway pressure wash"` →
`intentSignalKey = "recommendation_request|driveway pressure wash|zip:77706"`

---

## 7. Visibility action types (closed enum)

A unit is **not deliverable** until `actionType` is completed and `actionRef` is verifiable.

| `actionType` | Completion criteria | `actionRef` format |
|--------------|---------------------|-------------------|
| `intent_page_published` | HTTP 200 on project domain; page contains normalized intent tokens | `https://{domain}/path` |
| `local_content_published` | Article/post live; targets intent | `https://{domain}/path` |
| `profile_visibility_update` | GBP/listing field updated (manual attestation Phase 2) | `gbp:{locationId}:{field}` |
| `intent_visibility_delivered` | **Phase 2 manual only:** operator attests intent surfaced + owner briefed; requires approval | `manual:{operatorId}:{date}` |

**Phase 2 default for manual validation:** `intent_visibility_delivered`
**Phase 3 target:** automated `intent_page_published` / `local_content_published`

`intent_visibility_delivered` MUST NOT exceed **20%** of a project's delivered units without customer opt-in (commercial rule, not counting rule).

---

## 8. Geo cell normalization (normative)

Same as prior spec:

| Input | `geoCell` |
|-------|-----------|
| US ZIP | `zip:#####` |
| City + ST | `city:{city}\|{ST}` |
| County + ST | `county:{name}\|{ST}` |

Priority: ZIP > city|ST > county|ST.

Record is **in-area** if `geoCell` ∈ project `serviceAreaCells[]` (exact match).

---

## 9. Qualification rules (normative)

`candidate` → `qualified` when **all** true:

| Rule | Requirement |
|------|-------------|
| Q1 | `geoCell` ∈ project `serviceAreaCells[]` |
| Q2 | `serviceCategory` matches project category or aliases |
| Q3 | `qualificationScore >= 60` |
| Q4 | `intentClass` is valid enum |
| Q5 | `normalizeIntent(rawIntentText)` length ≥ 2 tokens after normalization |
| Q6 | No existing record with same `visibilityKey` in `delivered` or `qualified` |

### Scoring rubric (0–100)

| Signal | Points |
|--------|--------|
| `intentClass` ∈ {buying_signal, service_request, recommendation_request} | +30 |
| `intentClass` ∈ {problem, complaint} | +20 |
| `intentClass` ∈ {question, comparison_request} | +15 |
| geoCell is project primary cell | +20 |
| raw text contains category synonym | +25 |
| Action type is `intent_page_published` or `local_content_published` (action planned) | +15 |

Cap at 100.

---

## 10. Sources (closed enum)

| Source | Phase |
|--------|-------|
| `manual_operator` | 2 |
| `intent_radar_v1` | 3 |
| `site_analytics` | 3 |
| `community_scan` | 3 |

---

## 11. Rejection codes

| Code | Meaning |
|------|---------|
| `duplicate` | `visibilityKey` exists |
| `out_of_area` | Q1 failed |
| `category_mismatch` | Q2 failed |
| `below_threshold` | Q3 failed |
| `thin_intent` | Q5 failed |
| `action_not_verified` | `actionRef` check failed |
| `entitlement_exhausted` | Would exceed 1000 |
| `manual_cap_exceeded` | >20% manual without opt-in |
| `project_not_active` | Project not in `active` status |

---

## 12. Delivery rule (normative)

`qualified` → `delivered` when **all** true:

1. Project `status = active` and activation checklist complete (§13)
2. `visibilityDelivered < entitlement`
3. `actionCompletedAt` set and `actionRef` passes verification
4. Record written to ledger with `unitNumber` assigned
5. Record returned in customer dashboard API
6. `deliveredAt` = timestamp of step 5

**Internal fulfillment fields (operator only):**

```
visibilityRemaining = entitlement - visibilityDelivered
campaignProgressPercent = floor((visibilityDelivered / entitlement) * 1000) / 10
```

These fields MUST NOT be exposed on customer dashboard APIs.

**Customer-facing layer:** Each delivered VU emits one Activity Event per `CUSTOMER_DASHBOARD_SPEC.md` §4. Customer momentum states (§5 of that doc) are derived from visitors + activity density — not from `campaignProgressPercent`.

`visitors` and `contentPublished` are **separate outcome metrics** on the customer dashboard — not Visibility Units.

```
contentPublished = COUNT(units WHERE actionType IN (intent_page_published, local_content_published) AND status = delivered)
```

---

## 13. Activation gate (normative)

No Visibility Unit may be `delivered` until project activation flags are all `true`:

| Flag | Meaning |
|------|---------|
| `websiteLive` | Preview deployed to public URL, HTTP 200 |
| `visibilityCampaignActivated` | Entitlement clock started |
| `dashboardReady` | Customer auth/session works |
| `campaignStarted` | First dashboard load after payment recorded |

Set at end of **Activation Screen** flow (post-checkout).

---

## 14. Logging (append-only)

```json
{
  "at": "ISO-8601",
  "projectId": "string",
  "visibilityUnitId": "uuid",
  "visibilityKey": "string",
  "fromStatus": "string",
  "toStatus": "string",
  "reason": "string",
  "actor": "system|operator|customer"
}
```

Counts derive from ledger `status`, not logs.

---

## 15. Dispute resolution

If customer challenges unit #N:

1. Fetch ledger record where `unitNumber = N` and `projectId = X`
2. Show `rawIntentText`, `intentClass`, normalized key, `geoCell`
3. Show `actionType`, `actionRef`, verification timestamp
4. Show `deliveredAt` and activation state at delivery
5. If duplicate: show colliding `visibilityKey` on earlier unit

---

## 16. Versioning

Changes affecting `visibilityKey` or qualification require spec version bump + migration.
