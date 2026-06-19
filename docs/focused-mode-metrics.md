# Focused Mode Metrics

Pivotal OS runs two campaign modes — **Website Mode** and **Pressure Washing Mode**. Each mode runs one controlled daily sales test at a time. There is no separate Experiment Mode; focus configuration lives inside each existing mode.

## Why there is no Experiment Mode

Broad comparisons (best industry, best city, best time, etc.) create noise before you have enough data. Instead, each mode locks to a single setup until **100 calls** are logged. Only then does the system label ratios as a **baseline** and unlock basic optimization views.

## Focus configuration

Each mode stores its current focus in `data/outreach-focus.json`:

```json
{
  "website": {
    "mode": "website",
    "industry": "Restaurant",
    "city": "Beaumont",
    "offer": "Website Preview",
    "salesperson": "Jaylan"
  },
  "pressure-washing": {
    "mode": "pressure-washing",
    "industry": "Restaurant",
    "city": "Beaumont",
    "offer": "Dumpster Pad Cleaning",
    "salesperson": "Jaylan"
  },
  "events": []
}
```

Edit focus from the home page (**Edit Focus**) or via API:

- `GET /api/outreach/focus?mode=website`
- `GET /api/outreach/focus?mode=pressure-washing`
- `PATCH /api/outreach/focus` with body `{ mode, industry, city, offer, salesperson }`

Changing focus starts a new test — progress counts only events that match the exact industry, city, offer, and salesperson snapshot.

## 100-call baseline

Until 100 **calls** are logged for the current focus:

- Home shows progress: `Calls: X / 100`
- Ratios are labeled **Early read**
- Message: *Stay focused. Complete 100 calls for this setup before changing variables.*
- No ranking tables, best-day/time comparisons, or optimization recommendations

After 100 calls:

- Label changes to **Baseline established**
- Final ratios are shown (call→conversation, conversation→sale, call→sale, estimate→sale)
- Basic breakdowns by day, time bucket, industry, city, offer, and salesperson unlock
- Simple recommendations appear (continue focus, adjust offer, change city, etc.)

## Day and time capture

Every call/outcome event stores:

| Field | Source |
|-------|--------|
| `timestamp` (`at`) | ISO time when logged |
| `dayOfWeek` | Local weekday name |
| `timeBucket` | Local time bucket |

Time buckets (local timezone):

- 6am–8am
- 8am–10am
- 10am–12pm
- 12pm–2pm
- 2pm–4pm
- 4pm–6pm
- 6pm–8pm
- After Hours

The home Focus Card displays today's day of week and current time bucket automatically.

## Outcome tracking

When a call or outcome is logged, the system attaches focus metadata:

- `mode`, `industry`, `city`, `offer`, `salesperson`
- `dayOfWeek`, `timeBucket`, `timestamp`

**Website Mode** — events from Twilio recorded calls (`/api/calls/start`) and sales outcome updates.

**Pressure Washing Mode** — events from queue quick actions and status updates.

Events are stored in `data/outreach-focus.json` → `events[]` for future analytics. Broad analytics stay hidden until the 100-call threshold.

## Queue filtering

Call queues prioritize leads matching the current focus **industry** and **city**. Matching leads sort to the top; non-matching leads remain in queue but are deprioritized — the system does **not** silently switch industry or city.

When fewer than 5 matching callable leads exist:

- Warning: *You are low on focused leads.*
- **PW Mode:** run `npm run pw:find-leads -- --scrape`
- **Website Mode:** run `npm run website:pack` to generate previews for the focused segment

Queue pages and home show matching vs total callable counts.

## API endpoints

| Endpoint | Purpose |
|----------|---------|
| `GET /api/outreach/focus?mode=website` | Current website focus |
| `GET /api/outreach/focus?mode=pressure-washing` | Current PW focus |
| `PATCH /api/outreach/focus` | Update focus for a mode |
| `GET /api/outreach/focus-metrics?mode=website` | Focus card + funnel metrics |
| `GET /api/outreach/focus-metrics?mode=pressure-washing` | Focus card + funnel metrics |

Sales and PW queue responses also include a `focus` object with matching lead counts.

## Manual test checklist

1. **Website Mode** home shows Website Focus Card (industry, city, offer, salesperson, day, time bucket).
2. **PW Mode** home shows Pressure Washing Focus Card with the same fields.
3. Calls progress toward 100 on the Focus Card metrics panel.
4. Log a call/outcome — verify `data/outreach-focus.json` gains an event with focus + day/time fields.
5. Open `/call-queue` — matching industry/city leads appear first; focus banner shows counts.
6. Open `/pw/queue` — same prioritization and banner behavior.
7. Before 100 calls: no baseline analytics or optimization recommendations on home.
8. With fewer than 5 matching leads: low-leads warning appears on home and queue.
9. **Edit Focus** → change city → save → progress resets for the new setup.
10. Website call queue and PW queue workflows still complete end-to-end.
11. `npm run build` passes.

### Quick API smoke test

```bash
# Start server
npm run server

# Get focus (requires operator session cookie)
curl -s "http://localhost:3000/api/outreach/focus?mode=website" -H "Cookie: ..."

# Get metrics
curl -s "http://localhost:3000/api/outreach/focus-metrics?mode=pressure-washing" -H "Cookie: ..."

# Update focus
curl -s -X PATCH "http://localhost:3000/api/outreach/focus" \
  -H "Content-Type: application/json" \
  -H "Cookie: ..." \
  -d '{"mode":"website","city":"Beaumont","industry":"Restaurant","offer":"Website Preview","salesperson":"Jaylan"}'
```
