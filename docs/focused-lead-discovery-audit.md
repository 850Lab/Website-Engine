# Focused Lead Discovery Audit

Last updated: 2026-06-15

## Executive summary

The low focused inventory (Website: 11 fence companies, PW: 2 restaurants) was **not** primarily because Beaumont lacks businesses. The pipeline had never been run at scale for Beaumont-focused queries, and several filters were too strict or silent.

| Layer | Website Mode | Pressure Washing Mode |
|-------|--------------|----------------------|
| Raw database | 481 qualified businesses | 12 PW leads |
| Industry-related | 35 fence/fencing across SETX | 6 food-related across SETX |
| Beaumont + industry | 11–12 fence-like in Beaumont | 2 restaurants in Beaumont |
| Root cause | Discovery not run for Beaumont fences; city/industry spread across region | Seed data from other cities; scrape never run at volume |

## Where leads were being lost

### 1. Discovery never executed at volume (both modes)

- `npm run website:find-leads -- --scrape` and `npm run pw:find-leads -- --scrape` had not been run with Beaumont-only targets at 40–75 results per query.
- PW database contained only **12 total leads** from mixed-city seed data (Nederland, Port Arthur, Bridge City, etc.).
- Website database had **218 Beaumont businesses** but only **11–12 fence-related** — most discovery runs targeted other industries/cities.

### 2. Google Maps scraper depth (fixed)

**Before:** `scrollResultsFeed` stopped after 20 scroll attempts or 4 stagnant rounds; often collected only ~10 visible cards.

**After:** Up to 40 scroll rounds, stops after 3 consecutive no-growth rounds; logs `cardsSeen`, `detailPagesOpened`, `scrollRounds`. Phone extraction retries up to 3 times with body-text fallback.

### 3. No-phone leads discarded (fixed)

**Before:** Both find-leads scripts `continue` on missing phone — leads never stored, funnel opaque.

**After:** No-phone leads are stored with `callable: false` for later enrichment. Funnel reports `withoutPhone` vs `storedNoPhone`.

### 4. Industry matching too narrow (fixed)

**Before:** Simple substring checks; missed BBQ, grill, diner, pizza, gate contractor, etc.

**After:** `src/outreach-focus/matching.js` uses pattern sets for fence and restaurant subcategories, checks name + category + address blob, allows construction/deck only when fence/fencing appears in context.

### 5. City matching rejected valid Beaumont results (fixed)

**Before:** `cityMatches` returned `false` when city field empty or parsed as `"Beaumont, TX"` inconsistently.

**After:** Matches address contains "Beaumont", city field variants, and **`inferred_from_search`** when query was Beaumont TX and address missing. Sets `cityConfidence: inferred_from_search`.

### 6. Duplicate logic collapsed locations (fixed)

**Before (PW):** `leadDedupKey` used `name + city` as exact dedup — two McDonald's in Beaumont would collapse to one.

**After:** `src/discovery/dedup.js` priority:
1. Google Maps place ID / URL → exact skip
2. Normalized phone → exact skip
3. Name + address → exact skip
4. Name + city → **possible duplicate** (still added, flagged)

### 7. PW replenishment ignored focus (fixed earlier)

`replenishFocusActiveBatch(focus)` only promotes Beaumont restaurant leads into active queue.

### 8. Silent skip on ingest duplicates (website)

Duplicates from `ingestDiscoveryRecord` are counted in funnel with reason + matched lead id. Existing records can receive `cityConfidence` updates.

## Funnel report (per query)

Each scrape run now prints and writes JSON:

```text
Query: restaurants Beaumont TX

Raw Maps results: 47
Parsed businesses: 42
With phone: 36
Without phone: 6
City matched: 34
Industry matched: 32
Focus matched: 32
Callable focus matched: 28
Duplicates skipped: 6
New focused leads added: 26
Rejected:
- No phone (not stored): 0
- City mismatch: 2
- Industry mismatch: 4
- Duplicate: 6
```

Reports written to:
- `data/discovery-reports/website-latest.json`
- `data/discovery-reports/pw-latest.json`

## Debug endpoints

```
GET /api/outreach/focused-inventory/debug?mode=website
GET /api/outreach/focused-inventory/debug?mode=pressure-washing
```

Returns totals, rejection breakdown, sample rejected records, and exhaustion message when callable focused count stays below 50.

## Current database snapshot (pre-scrape)

Run diagnostics:

```bash
node -e "import { buildFocusedInventoryDebug } from './src/outreach-focus/diagnostics.js'; console.log(JSON.stringify(await buildFocusedInventoryDebug('website'), null, 2))"
node -e "import { buildFocusedInventoryDebug } from './src/outreach-focus/diagnostics.js'; console.log(JSON.stringify(await buildFocusedInventoryDebug('pressure-washing'), null, 2))"
```

### Website — Fence Companies / Beaumont

| Stage | Count |
|-------|-------|
| Total qualified | 481 |
| Industry match (fence) | ~35 (SETX) |
| City match (Beaumont) | 218 |
| Focus match | 11 |
| Callable focused | 11 |
| Rejected by city (fence in other cities) | 22 |

### PW — Restaurants / Beaumont

| Stage | Count |
|-------|-------|
| Total PW leads | 12 |
| Food-related | 6 |
| Focus match (Beaumont restaurant) | 2 |
| Rejected by city (food in other cities) | 4 |

## Search targets (updated)

**Website:** 8 Beaumont fence queries, 45–60 maxResults each  
**PW:** 13 Beaumont restaurant queries, 40–75 maxResults each

## Next steps

1. Install Playwright Chromium if needed: `npx playwright install chromium`
2. Run discovery:
   ```bash
   npm run website:find-leads -- --scrape
   npm run pw:find-leads -- --scrape
   ```
3. Check funnel JSON reports and debug endpoints
4. If callable focused count still below 50 after full scrape, UI shows: **"Beaumont focused inventory is exhausted."**

Focus remains **Beaumont only** — no silent expansion to Southeast Texas.
