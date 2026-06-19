# Pressure Washing Closed-Loop — Audit (Before Upgrade)

Audit of the PW outreach data flow as it existed before the closed-loop lead engine upgrade.

---

## 1. Where PW leads are stored

**Canonical file:** `data/pressure-washing-leads.json`

Structure:

```json
{
  "version": 1,
  "updatedAt": "ISO timestamp",
  "leads": [ { ...lead } ]
}
```

**Persistence layer:** `src/persistence/json-document-store.js`

- **Local dev:** writes via `writeJsonFileSafe()` in `src/storage.js` (temp file + atomic rename + `.bak`)
- **Production (Vercel):** writes to Vercel Blob when `BLOB_READ_WRITE_TOKEN` is set

**Module:** `src/pressure-washing/lead-store.js` — all CRUD goes through `readJsonDocument` / `writeJsonDocument`.

---

## 2. How `/pw/queue` reads leads

1. Browser loads `src/pivotal-os/pages/pw-queue.js` (server-rendered HTML)
2. Client JS calls `GET /api/pressure-washing/next` or `GET /api/pressure-washing/lead/:id`
3. `buildPwQueueResponse()` in `metrics.js` called `buildPwQueue()` → sorted all non-closed leads with phones
4. **No batch limit** — entire callable pool shown one-at-a-time
5. **No `queueState`** — only `status` field distinguished new vs contacted vs won

---

## 3. How `/pw/queue` writes updates

| Action | Endpoint | Handler |
|--------|----------|---------|
| Outcome buttons | `PATCH /api/pressure-washing/lead/:id/status` | `updatePwLeadStatus()` |
| Add note | `POST /api/pressure-washing/lead/:id/notes` | `appendPwNote()` |
| Call tap | `POST /api/pressure-washing/lead/:id/call` | `updatePwLeadStatus()` |

Each handler called `upsertPwLead()` → `writeLeads()` → JSON file on disk (or blob).

---

## 4. Are updates visible to Cursor?

**Yes, on local dev.** When you tap an outcome on the website, `data/pressure-washing-leads.json` is rewritten. Cursor can read that file immediately.

**Caveat on Vercel:** if blob persistence is enabled, the file on disk in the repo workspace may not reflect production writes unless you sync blob → local or read blob directly.

---

## 5. Are file writes atomic/safe?

**Filesystem (local):** Yes.

- Per-file write queue prevents concurrent corruption
- Writes to `.tmp` then `rename()` atomically
- Previous version backed up to `.bak`

**Blob:** Overwrite via Vercel Blob API (not multi-writer safe if two server instances write simultaneously — acceptable for single-operator use).

---

## 6. How top leads were selected

`sortPwQueue()` in `lead-store.js`:

1. Follow-ups due (`nextFollowUpAt` ≤ now)
2. Interested
3. Estimate needed
4. Other by `priorityScore`
5. New leads by oldest `createdAt`

No cap of 25. No separation between “research pool” and “today’s calling batch.”

---

## 7. What was missing for queue replenishment

| Gap | Impact |
|-----|--------|
| No `queueState` | Cursor and website couldn’t coordinate available vs active vs done |
| No batch promotion | All leads mixed in one pool; no daily top-25 |
| No discovery script for PW | Only 12 seed leads; no `pw-find-leads` pipeline |
| No health endpoint | Cursor couldn’t inspect available/active counts |
| No auto-refill | Marking Won/Lost didn’t promote fresh `available` leads |
| No `sourceQuery` / `discoveredAt` | Hard to trace where leads came from |
| Outcomes didn’t map to queueState | Won/Lost still appeared callable until status filter caught them |

---

## Reusable from website outreach

| Asset | Location | PW reuse |
|-------|----------|----------|
| Google Maps scrape | `src/discover.js` → `scrapeGoogleMaps()` | `scripts/pw-find-leads.js --scrape` |
| Google Maps adapter | `src/discovery-adapters/google-maps-adapter.js` | Same scrape engine |
| JSON persistence | `json-document-store.js` | Same pattern as qualified businesses |
| Phone normalize | `src/stage1/shared.js` | Dedup + tel/sms links |

Website qualified businesses (`data/qualified-businesses.json`) remain **separate** — PW closed loop does not touch website CRM.
