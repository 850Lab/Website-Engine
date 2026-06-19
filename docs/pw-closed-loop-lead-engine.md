# Pressure Washing Closed-Loop Lead Engine

How Cursor, the local JSON database, and `/pw/queue` work together.

---

## The loop

```
Cursor / scripts/pw-find-leads.js
  → adds leads (queueState: available)
  → data/pressure-washing-leads.json

Website /pw/queue
  → replenishActiveBatch() promotes top 25 available → active
  → you call and tap outcomes
  → same JSON file updated (status, queueState, notes, etc.)

Cursor reads JSON again
  → sees won/lost/suppressed/follow_up
  → runs pw-find-leads.js to add more available leads
  → website auto-refills active batch
```

---

## Where leads are stored

**File:** `data/pressure-washing-leads.json`

Every lead change goes through `src/pressure-washing/lead-store.js` → `writeJsonDocument()`.

On local dev, Cursor sees changes immediately in that file.

---

## How Cursor finds leads

### 1. Edit search targets

`data/pw-search-targets.json`:

```json
[
  { "query": "restaurants", "city": "Beaumont", "industry": "Restaurants", "maxResults": 10 }
]
```

### 2. Run the finder script

```bash
# Dry run — shows targets + current queue health
npm run pw:find-leads

# Live Google Maps scrape (Playwright)
npm run pw:find-leads -- --scrape
```

Uses **`scrapeGoogleMaps()`** from `src/discover.js` — same engine as website outreach discovery.

New leads save with:

- `queueState: "available"`
- `status: "new"`
- `source: "google_maps"`
- `sourceQuery`, `discoveredAt`

Deduplication: phone (last 10 digits), or businessName+city, or googleMapsUrl.

---

## How the website reads leads

1. `GET /api/pressure-washing/next` (or `/lead/:id`)
2. Backend calls `replenishActiveBatch()`:
   - Counts leads with `queueState: "active"`
   - If **&lt; 25**, promotes best `available` leads
   - Assigns `assignedBatchId`, `batchRank`, `addedToQueueAt`
3. Returns sorted **active queue**:
   - `queueState: "active"`
   - OR `queueState: "follow_up"` when follow-up is **due**

Hidden from queue: `won`, `lost`, `suppressed`, `completed`, and follow-ups **not yet due**.

---

## How the website writes outcomes

All actions PATCH/POST to `/api/pressure-washing/lead/:id/*` → `updatePwLeadStatus()` → **`writeLeads()`** → JSON on disk.

### Outcome → queueState mapping

| Button | queueState | Notes |
|--------|------------|-------|
| Called | `active` | Stays in batch |
| No Answer | `active` | After 3 attempts → `follow_up` + default +3 days |
| Gatekeeper | `follow_up` | Removed until follow-up due |
| Interested | `follow_up` | |
| Estimate Needed | `follow_up` | |
| Estimate Sent | `follow_up` | Saves `estimateAmount` |
| Follow Up | `follow_up` | Saves `nextFollowUpAt` |
| Won | `won` | Saves `revenueWon`, leaves queue |
| Lost | `lost` | Leaves queue |
| Not Interested | `suppressed` | Leaves queue |

After each outcome, `refreshPwQueue()` runs to promote fresh leads if active count dropped.

---

## queueState values

| State | Meaning |
|-------|---------|
| `available` | In research pool — waiting for promotion |
| `active` | In today's calling batch (max 25) |
| `follow_up` | Scheduled callback — shows when due |
| `won` | Closed won |
| `lost` | Closed lost |
| `suppressed` | Not interested / do not call |
| `completed` | Batch complete (reserved for future use) |

---

## Top-25 promotion sort

When promoting `available` → `active`:

1. Highest `priorityScore`
2. Restaurants / food businesses
3. Southeast Texas target cities
4. Oldest `discoveredAt`

Active queue display sort:

1. Follow-ups due
2. Interested
3. Estimate needed
4. Batch rank / priority
5. New (oldest first)

---

## Queue health API

```bash
GET /api/pw/queue/health
```

Returns:

```json
{
  "totalLeads": 50,
  "available": 25,
  "active": 25,
  "followUpDue": 2,
  "completedToday": 0,
  "won": 3,
  "lost": 1,
  "suppressed": 2,
  "needsReplenishment": false,
  "nextBatchSize": 0,
  "activeBatchTarget": 25,
  "lastUpdatedAt": "..."
}
```

### Refresh queue manually

```bash
POST /api/pw/queue/refresh
```

Or tap **Refresh Queue** on `/pw/queue`.

---

## Manual test — full loop

1. `npm run server`
2. Open `/pw/queue` — confirm active batch loads (up to 25)
3. Mark several leads: No Answer, Interested, Not Interested, Won
4. Open `data/pressure-washing-leads.json` — confirm fields changed (`queueState`, `lastContactResult`, etc.)
5. Confirm Won/Lost/Not Interested **leave** the active queue
6. Confirm available leads promote when active &lt; 25
7. `curl http://localhost:8787/api/pw/queue/health` (with auth cookie) — verify counts
8. `npm run pw:find-leads` — dry run summary
9. `npm run pw:find-leads -- --scrape` — add real leads (optional, needs Playwright)
10. Refresh `/pw/queue` — new batch fills in
11. Confirm `/call-queue` (website) still works unchanged
12. `npm run build`

---

## Key files

| File | Role |
|------|------|
| `data/pressure-washing-leads.json` | Local lead database |
| `data/pw-search-targets.json` | Cursor search config |
| `scripts/pw-find-leads.js` | Discovery / replenishment script |
| `src/pressure-washing/lead-store.js` | CRUD + batch promotion |
| `src/pressure-washing/queue-engine.js` | Sort + health + dedup |
| `src/pressure-washing/queue-state.js` | queueState + outcome mapping |
| `src/pressure-washing/routes.js` | API including `/api/pw/queue/health` |
| `src/pivotal-os/pages/pw-queue.js` | Mobile queue UI |
