# Pressure Washing Mobile Queue

Mobile-first call queue for Zeal Power Washing outreach at **`/pw/queue`**.

---

## What was added

### Lead action tracking

Each lead in `data/pressure-washing-leads.json` (blob-aware on Vercel) now tracks:

| Field | Purpose |
|-------|---------|
| `status` | Pipeline stage (New → Won/Lost) |
| `callAttempts` | Times a call attempt was logged |
| `conversationCount` | Real conversations (Interested, Gatekeeper) |
| `lastContactedAt` | ISO timestamp of last touch |
| `lastContactResult` | Result slug from last action (e.g. `no_answer`, `interested`) |
| `lastConversationAt` | ISO timestamp when conversationCount last incremented |
| `nextFollowUpAt` | Scheduled follow-up |
| `notes`, `objections`, `followUpNotes` | Timestamped arrays |
| `estimateStatus`, `estimateAmount` | Quote tracking |
| `jobStatus`, `revenueWon`, `wonAt` | Closed job tracking |

**Statuses:** New, Called, No Answer, Gatekeeper, Interested, Follow Up, Estimate Needed, Estimate Sent, Won, Lost, Not Interested.

Legacy slugs (`not_contacted`, `contacted`, etc.) auto-map on read.

### Mobile action buttons

Large 2-column grid on each lead card:

- Called · No Answer · Gatekeeper · Interested · Follow Up
- Estimate Needed · Estimate Sent · Won · Lost

**Add note** is in the bottom dock (with objection field).

Actions PATCH `/api/pressure-washing/lead/:id/status` immediately and return updated lead + daily metrics.

### Input sheets

| Action | Sheet fields |
|--------|----------------|
| Add note | Note + objection |
| Follow Up | Date/time picker + optional note |
| Estimate Sent | Estimate amount ($) |
| Won | Revenue won ($) |

### Next-best-lead sorting

Queue order (`sortPwQueue` in `lead-store.js`):

1. **Follow-ups due/overdue** (`nextFollowUpAt` ≤ now)
2. **Interested**
3. **Estimate needed**
4. **Other callable leads** by `priorityScore` (desc)
5. **New leads** by `createdAt` (oldest first)

The first lead in the sorted queue gets **`isNextBestLead: true`** and shows a **“Next Best Lead”** badge.

### Daily metrics bar

Top of `/pw/queue` shows 8 live metrics from saved lead data:

| Metric | Source |
|--------|--------|
| Calls today | `lastContactedAt` is today |
| Talks today | `lastConversationAt` is today |
| Interested today | `status === interested` and `updatedAt` is today |
| Follow-ups due | `nextFollowUpAt` ≤ now |
| Estimates needed | `status === estimate_needed` |
| Estimates sent | `status === estimate_sent` |
| Won today | `status === won` and `wonAt`/`updatedAt` is today |
| Rev won today | Sum of `revenueWon` for jobs won today |

### Security

All lead/business fields render via **DOM `textContent`** — no `innerHTML` for user data. Links use `safeHref()` (`tel:` / `sms:` only).

---

## How lead actions work

```
Tap action button
  → (optional) sheet for follow-up / estimate / revenue
  → PATCH /api/pressure-washing/lead/:id/status
  → updatePwLeadStatus() writes JSON file
  → response includes lead + daily + stats
  → UI refreshes in place (toast confirmation)
```

| Button | Status | Side effects |
|--------|--------|--------------|
| Called | `called` | +1 callAttempts, lastContactedAt |
| No Answer | `no_answer` | +1 callAttempts |
| Gatekeeper | `gatekeeper` | +1 callAttempts, +1 conversationCount |
| Interested | `interested` | +1 conversationCount |
| Follow Up | `follow_up` | sets nextFollowUpAt |
| Estimate Needed | `estimate_needed` | estimateStatus = needed |
| Estimate Sent | `estimate_sent` | saves estimateAmount |
| Won | `won` | saves revenueWon, wonAt |
| Lost | `lost` | closes lead (removed from queue) |

**Call** button also POSTs `/call` (+1 callAttempts, status Called).

---

## Persistence

Uses existing pattern: **`data/pressure-washing-leads.json`** via `readJsonDocument` / `writeJsonDocument` (same as website qualified businesses). On Vercel, syncs to Blob when `BLOB_READ_WRITE_TOKEN` is set.

Changes survive page refresh and server restart.

---

## Manual test on mobile

1. Log in → open **`/pw/queue`** on your phone (or narrow browser window).
2. Confirm **8 metrics** at top and **“Next Best Lead”** on first card.
3. Tap **Call** — phone dialer opens; callAttempts increments on return.
4. Tap **No Answer** — toast “Saved”, callAttempts +1.
5. Tap **Interested** — conversationCount +1, metrics update.
6. Tap **Follow Up** — pick date/time → Save.
7. Tap **Estimate Sent** — enter amount → Save.
8. Tap **Add note** — enter note/objection → Save.
9. Tap **Won** — enter revenue → Save.
10. Tap **Next lead →** — advances in sorted queue.
11. Refresh page — all changes persist.

---

## Key files

| File | Role |
|------|------|
| `src/pressure-washing/statuses.js` | Status enum + quick actions |
| `src/pressure-washing/lead-store.js` | CRUD, sorting, queue build |
| `src/pressure-washing/metrics.js` | Daily aggregates + queue API payload |
| `src/pressure-washing/routes.js` | REST endpoints |
| `src/pivotal-os/pages/pw-queue.js` | Mobile UI |
| `src/pivotal-os/safe-render.js` | XSS-safe DOM helpers |
