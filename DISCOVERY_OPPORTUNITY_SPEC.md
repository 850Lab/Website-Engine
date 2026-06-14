# Discovery Opportunity Specification (V7)

**Version:** 1.0
**Status:** Normative — two engineers implementing this spec MUST produce identical counts for the same inputs.

---

## 1. Purpose

A **Discovery Opportunity** is the atomic unit of value in a Website Opportunity Project.

It is used for:

- Fulfillment quotas (e.g. 1,000 per project)
- Customer dashboard progress (`247 / 1000`)
- Guarantees and renewals
- Pricing ($1,000 launch includes 1,000 delivered opportunities)
- Campaign progress (`delivered / entitlement × 100`)

A Discovery Opportunity is **not** a website page, article, visitor session, or operator lead record.

---

## 2. Definition

> **Discovery Opportunity:** A single persisted ledger record that represents one **qualified, deduplicated, owner-visible local demand signal** tied to exactly one Website Opportunity Project, with `status = delivered`.

Only records with `status = delivered` increment the customer's **Delivered** count.

---

## 3. Record schema (normative)

Each record MUST be stored with these fields:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | UUID | yes | Unique record id |
| `projectId` | string | yes | Website Opportunity Project id |
| `opportunityType` | enum | yes | See §4 |
| `subjectKey` | string | yes | Type-specific identity (§5) |
| `opportunityKey` | string | yes | `sha256(projectId + ":" + opportunityType + ":" + subjectKey)` lowercase hex |
| `geoCell` | string | yes | Normalized geography (§6) |
| `serviceCategory` | string | yes | Project category at qualification time |
| `qualificationScore` | integer 0–100 | yes | Score at qualification (§7) |
| `status` | enum | yes | `candidate` \| `qualified` \| `delivered` \| `expired` \| `rejected` |
| `title` | string | yes | Owner-visible headline (max 120 chars) |
| `summary` | string | yes | Owner-visible body (max 500 chars) |
| `recommendedAction` | string | yes | Single CTA instruction (max 200 chars) |
| `source` | enum | yes | See §8 |
| `sourceRef` | string | no | Opaque source id (run id, crawl id, event id) |
| `identifiedAt` | ISO-8601 | yes | When signal first detected |
| `qualifiedAt` | ISO-8601 | no | When score threshold passed |
| `deliveredAt` | ISO-8601 | no | When owner dashboard first showed this record |
| `rejectedAt` | ISO-8601 | no | When permanently disqualified |
| `rejectedReason` | string | no | Machine-readable reject code (§9) |

**Uniqueness constraint:** At most one record per `(projectId, opportunityKey)` may ever exist.

---

## 4. Opportunity types (closed enum)

Only these values are valid for `opportunityType` in V7.0:

| Type | Meaning |
|------|---------|
| `search_visibility_gap` | A specific local search query + geo where the project site can capture demand but currently underperforms |
| `service_area_expansion` | A specific city/ZIP in the project's category where demand exists and the business should be visible |
| `inbound_intent` | A verified high-intent interaction on the project's live site (§5.3) |

No other type counts until a new spec version adds it.

---

## 5. Subject key formulas (normative)

`subjectKey` MUST be computed exactly as follows. All text is lowercased and trimmed before hashing.

### 5.1 `search_visibility_gap`

```
subjectKey = normalizeKeyword(query) + "|" + geoCell
```

`normalizeKeyword(query)`:

1. Lowercase, trim
2. Remove punctuation except spaces and hyphens
3. Collapse whitespace to single spaces
4. Remove stopwords: `a`, `an`, `the`, `near`, `me`, `in`, `for`
5. Sort tokens alphabetically and rejoin with space

**Example:** query `"Tree Removal in Beaumont TX"` + geoCell `beaumont|tx` →
`subjectKey = "beaumont removal tree|beaumont|tx"`

### 5.2 `service_area_expansion`

```
subjectKey = serviceCategorySlug + "|" + geoCell
```

`serviceCategorySlug`: lowercase category with non-alphanumeric → `-` (e.g. `tree-service`).

**Example:** `tree-service|77701`

### 5.3 `inbound_intent`

```
subjectKey = sessionId + "|" + intentAction
```

`intentAction` ∈ `form_submit` \| `click_to_call` \| `quote_request`

`sessionId`: first-party cookie `wop_sid` or server-generated UUID for the session; stable for 30 minutes of inactivity.

One `inbound_intent` per session per `intentAction` maximum.

---

## 6. Geo cell normalization (normative)

`geoCell` MUST be one of:

| Input | Normalized `geoCell` |
|-------|---------------------|
| US ZIP (5 digits) | `zip:#####` (e.g. `zip:77701`) |
| City + state | `city:{city}\|{ST}` where city is lowercase a-z spaces→hyphens, ST is uppercase 2-letter |
| County + state | `county:{name}\|{ST}` (only if ZIP unavailable) |

If multiple inputs exist, priority: **ZIP > city|ST > county|ST**.

A record is **in-area** if `geoCell` matches any cell in the project's `serviceAreaCells[]` (exact string match).

---

## 7. Qualification rules (normative)

A record moves `candidate` → `qualified` when **all** are true:

| Rule | Requirement |
|------|-------------|
| Q1 In-area | `geoCell` ∈ project `serviceAreaCells[]` |
| Q2 Category match | `serviceCategory` equals project `category` OR project `categoryAliases[]` |
| Q3 Score threshold | `qualificationScore >= 60` |
| Q4 Actionable | `recommendedAction` non-empty and `title` non-empty |
| Q5 Not rejected | No existing record with same `opportunityKey` in `rejected` or `delivered` |

### 7.1 Scoring rubric (0–100)

Start at 0. Add points (cap 100):

| Signal | Points | Applies to type |
|--------|--------|-----------------|
| Query contains category keyword | +25 | `search_visibility_gap` |
| geoCell is project primary city | +20 | all |
| Project has no ranking page for query | +25 | `search_visibility_gap` |
| Competitor has visible presence for query | +15 | `search_visibility_gap` |
| Population cell ≥ 10,000 (if known) | +10 | `service_area_expansion` |
| Intent action is `form_submit` | +40 | `inbound_intent` |
| Intent action is `click_to_call` | +35 | `inbound_intent` |
| Intent action is `quote_request` | +30 | `inbound_intent` |

---

## 8. Sources (closed enum)

| Source | Description |
|--------|-------------|
| `local_search_index` | Derived from search visibility analysis |
| `service_area_map` | Derived from project service-area definition + demand index |
| `site_analytics` | First-party events on project site |
| `manual_operator` | Human-entered (must still pass qualification) |

---

## 9. Rejection codes (do not count)

| Code | Meaning |
|------|---------|
| `duplicate` | `opportunityKey` already exists |
| `out_of_area` | Failed Q1 |
| `category_mismatch` | Failed Q2 |
| `below_threshold` | Failed Q3 |
| `entitlement_exhausted` | Project delivered count ≥ entitlement |
| `project_not_active` | Project status ≠ `active` |

Rejected records NEVER increment Delivered count.

---

## 10. Delivery rule (normative)

A record moves `qualified` → `delivered` when **all** are true:

1. Project `status = active`
2. `deliveredCount < entitlement` (default entitlement: **1000**)
3. Record is written to the project ledger
4. Record appears in the customer dashboard feed API response
5. `deliveredAt` is set to the timestamp of step 4

**Counting formula:**

```
deliveredCount(projectId) = COUNT(records WHERE projectId = X AND status = 'delivered')
remainingCount = entitlement - deliveredCount
campaignProgressPercent = floor((deliveredCount / entitlement) * 1000) / 10
```

**Example:** 247 delivered → `campaignProgressPercent = 24.7`

---

## 11. Deduplication (normative)

1. Before insert, compute `opportunityKey`.
2. If a record exists with same `opportunityKey` and `status ∈ {delivered, qualified, candidate}` → do not create; log `duplicate`.
3. If a record exists with `status = rejected` and `rejectedReason = below_threshold` → may re-evaluate after 30 days if `sourceRef` changes (new crawl id).
4. Cross-project deduplication is NOT required in V7.0 (same signal may exist on two projects).

---

## 12. Logging (normative)

Every state transition MUST append an immutable log entry:

```json
{
  "at": "ISO-8601",
  "projectId": "string",
  "opportunityId": "uuid",
  "opportunityKey": "string",
  "fromStatus": "string",
  "toStatus": "string",
  "reason": "string",
  "actor": "system|operator|customer"
}
```

Logs are append-only. Counts are derived from ledger `status`, not from logs.

---

## 13. What is NOT a Discovery Opportunity

| Item | Why excluded |
|------|--------------|
| Website preview HTML | Asset, not demand signal |
| Published article | Tracked separately as `articlesPublished` |
| Raw page view | Tracked as `visitors`; only qualifying intent actions become `inbound_intent` |
| Operator lead in `leads.json` | Outbound prospecting, not customer fulfillment |
| V6 audit finding | Sales collateral, not delivered opportunity |
| Maintenance ticket | Operations, not discovery |
| Duplicate `opportunityKey` | Deduplicated |

---

## 14. Project entitlement (normative)

Each Website Opportunity Project has:

```json
{
  "entitlement": 1000,
  "entitlementPeriodDays": 365,
  "entitlementStartsAt": "ISO-8601 when project becomes active"
}
```

Renewal adds a new entitlement bucket or extends `entitlement` per commercial terms (out of scope for counting spec).

---

## 15. Worked example (count agreement)

**Project:** `wop_abc123`, category `Tree Service`, serviceAreaCells: `["zip:77701", "city:beaumont|tx"]`, entitlement 1000.

**Events:**

1. Crawl finds query "tree removal beaumont" in `zip:77701`, score 72 → new `search_visibility_gap`, delivered → **count = 1**
2. Same query crawled again → duplicate → **count = 1**
3. `service_area_expansion` for `zip:77705`, score 65 → delivered → **count = 2**
4. Visitor submits quote form, new session → `inbound_intent` delivered → **count = 3**
5. Same session second form submit → duplicate subjectKey → **count = 3**

**Dashboard:** `Discovery Opportunities: 3 / 1000`, `Campaign Progress: 0.3%`

---

## 16. Versioning

Spec changes that affect counts require a version bump and a migration script that recalculates `opportunityKey` or archives pre-migration records.
