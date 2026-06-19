# Pressure Washing Founder Daily Control

Command-center home page for **Pressure Washing Mode** at `/`.

---

## Founder Control card

When you switch to Pressure Washing Mode, the home page loads **`GET /api/pw/founder-control`**, which combines:

| Source | Data |
|--------|------|
| `buildPwQueueHealth()` | Active, available, follow-ups due, completed today, won/lost/suppressed |
| `aggregatePwDailyForLeads()` | Calls, conversations, estimates, revenue (same logic as queue metrics) |
| `buildTodayActivity()` | Latest 5 leads contacted today |
| `computePwRecommendation()` | Next best action message + buttons |

**Founder Control stats shown:**

- Active leads remaining
- Available leads waiting
- Follow-ups due
- Completed today
- Calls today
- Conversations today
- Estimates needed
- Estimates sent
- Jobs won today
- Revenue won today

Tap **View Queue Health** to expand total leads, won/lost/suppressed, replenishment status, and last file update time.

---

## “What should I do next?” — decision rules

Evaluated **in order** (first match wins):

| # | Condition | Message | Primary action |
|---|-----------|---------|----------------|
| 1 | `active === 0 && available === 0` | Find new leads first. | Run Lead Search (sheet) |
| 2 | `active < 10 && available > 0` | Refresh your active batch. | Load Fresh Leads (POST refresh) |
| 3 | `followUpDue > 0` | Handle follow-ups before new cold calls. | Call Follow-Ups |
| 4 | `callsToday < 50` | Keep calling. Your next target is 50 calls. | Start Calling |
| 5 | `conversationsToday < 10` | Focus on reaching decision-makers. | Start Calling |
| 6 | `estimatesNeeded > 0` | Turn interested leads into estimates. | Send Estimates |
| 7 | `estimatesSent > 0 && jobsWonToday === 0` | Follow up on sent estimates. | Follow Up Estimates |
| 8 | Otherwise | You're on track. Keep the pipeline moving. | Open Queue |

Logic lives in `src/pressure-washing/founder-control.js` → `computePwRecommendation()`.

---

## Daily target progress

Default goals (editable in `PW_DAILY_TARGETS`):

| Metric | Target |
|--------|--------|
| Calls | 50 |
| Conversations | 10 |
| Estimates | 3 |
| Jobs Won | 1 |

Progress bars show **X / target** with fill percentage.

---

## Command buttons

| Button | Behavior |
|--------|----------|
| Find Today's Leads | Opens sheet with terminal command (cannot run from browser) |
| Refresh Active Batch | `POST /api/pw/queue/refresh` → reloads stats |
| Start Calling | `/pw/queue` |
| Call Follow-Ups | `/pw/queue?view=follow-ups` |
| Send Estimates | `/pw/queue?view=estimates` |
| View Queue Health | Expands health details on card |
| Open PW Queue | `/pw/queue` |

---

## Why the browser cannot run Cursor scripts

Lead discovery uses **Playwright + Google Maps scraping** via:

```bash
npm run pw:find-leads -- --scrape
```

This requires:

- Local filesystem access
- Chromium browser
- Long-running scrape (minutes)

The web app runs on Node/Express and has no safe, sandboxed way to spawn arbitrary terminal scripts from a browser button without a dedicated backend job runner (not implemented). The **Find Today's Leads** button shows the exact command to run in Cursor or your terminal.

---

## Search targets page

**`/pw/search-targets`** — read-only list from `data/pw-search-targets.json`.

Linked from recommendation secondary action and Find Leads sheet.

---

## Today's activity

Shows up to **5 most recent leads** with `lastContactedAt` today:

- Business name
- Outcome (from `lastContactResult` or status)
- Time contacted
- Next follow-up date if set

Empty state: *“No pressure washing activity logged today.”*

---

## Manual test checklist

1. Open `/`
2. Switch to **Pressure Washing Mode**
3. Founder Control card loads with health + daily stats
4. Daily target progress bars display
5. Recommendation message matches queue state
6. **Refresh Active Batch** updates stats after POST
7. **Start Calling** → `/pw/queue`
8. **Call Follow-Ups** → `/pw/queue?view=follow-ups`
9. **Send Estimates** → `/pw/queue?view=estimates`
10. **Find Today's Leads** shows `npm run pw:find-leads -- --scrape`
11. `/pw/search-targets` lists search queries
12. Switch to **Website Mode** — original dashboard unchanged
13. `npm run build` passes

---

## Key files

| File | Role |
|------|------|
| `src/pressure-washing/founder-control.js` | Recommendation engine + founder payload |
| `src/pivotal-os/pages/home.js` | PW mode UI (website branch untouched) |
| `src/pivotal-os/pages/pw-search-targets.js` | Search targets page |
| `src/pressure-washing/routes.js` | `/api/pw/founder-control`, pages |
