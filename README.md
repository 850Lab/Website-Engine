# Website Outreach Engine

Backend-first Opportunity Engine for discovery, project previews, launch offers, and customer dashboard flows.

This repository no longer includes Mission Control.

## Run locally

1) Install dependencies:

```bash
npm install
```

2) Create `.env` in repo root:

```bash
ADMIN_PASSWORD=your-password
PUBLIC_BASE_URL=https://your-domain.com
```

3) Start server:

```bash
npm run server
```

4) Open:

- `http://localhost:8787/` (founder links page)
- `http://localhost:8787/api/health`

## Requirements

- Node.js 18+

## Commands

```bash
# Add a lead
npm run outreach -- add --name "Joe's Plumbing" --category plumbing --city Austin --phone 512-555-0100 --reviews 24 --rating 4.6 --social --strong-proof

# List all leads (optional filter)
npm run outreach -- list
npm run outreach -- list --status HOLD

# Show TARGET leads only
npm run outreach -- targets

# Override status manually
npm run outreach -- update-status <lead-id> HOLD

# Generate a website preview brief for a lead
npm run outreach -- brief <lead-id>

# Paste raw business text (interactive)
npm run outreach -- import-text

# Discover leads from Google Maps (interactive)
npm run outreach -- discover
```

First-time setup for `discover` (browser automation):

```bash
npm install
npx playwright install chromium
```

### brief

Prints a deterministic website preview brief (no AI) based on the lead's category and outreach angle:

- Business name, category, city, website angle
- Recommended homepage sections
- Hero headline, CTA text, trust points
- Services to highlight
- Outreach note

```bash
npm run outreach -- brief 54823018-f3a6-4c96-9904-212f53b22934
```

### generate-preview

Builds a static, mobile-first HTML preview from the lead's brief (no React, no AI):

```bash
npm run outreach -- generate-preview <lead-id>
```

Creates:

```
previews/<slug-business-name>/
  index.html
  styles.css
```

Includes hero, call CTA, services, trust bar, reviews placeholder, gallery placeholder, and contact section. Open `index.html` in a browser to view.

### generate-preview-v2

Enhanced static preview (mobile-first) with image hero, trust chips, icon service cards, before/after results, large review card, masonry gallery, and sticky bottom CTA on mobile:

```bash
npm run outreach -- generate-preview-v2 <lead-id>
```

Creates:

```
previews-v2/<slug-business-name>/
  index.html
  styles.css
```

Sections: full-width image hero with overlay, horizontal trust bar, 2-column service cards, before/after results (4 pairs), reviews with rating + count, masonry gallery, sticky **Call | Gallery | Quote** bar (mobile), and footer credit for Website Outreach Engine. The original `generate-preview` command is unchanged.

### generate-preview-v3

Premium conversion template aligned to [DESIGN_EXECUTION_SPEC.md](DESIGN_EXECUTION_SPEC.md). Styling, colors, copy patterns, and image placeholders come from `src/design-system/` (tokens, themes, copy-rules, image-rules). Layout: sticky header, photographic hero, services grid, split trust, review/stats, CTA band, footer.

```bash
npm run outreach -- generate-preview-v3 <lead-id>
```

Creates:

```
previews-v3/<slug-business-name>/
  index.html
  styles.css
  assets/ai/          (optional, via generate-ai-assets)
    hero.jpg
    trust.jpg
    cta.jpg
```

When `assets/asset-manifest.json` exists, preview-v3 uses those image paths (real → AI → CSS placeholders). AI images are **concept preview art only** — not real client project photos.

### prepare-assets

Runs the **Asset Pipeline V1** — chooses the best image source per slot:

1. Verified real business images (website + social URLs, confidence ≥ 70)
2. AI-generated category fallbacks (`OPENAI_API_KEY` in `.env`)
3. Premium CSS placeholders

```bash
npm run outreach -- prepare-assets <lead-id>
```

Writes `previews-v3/<slug>/assets/asset-manifest.json` and refreshes the preview. See `.env.example` for API key setup.

### generate-ai-assets

Runs the full asset pipeline (same as `prepare-assets`). Prefer `prepare-assets` for real → AI → placeholder priority.

```bash
# Set your API key (see .env.example)
export OPENAI_API_KEY=sk-...

npm run outreach -- generate-ai-assets <lead-id>
```

Creates `previews-v3/<slug>/assets/ai/hero.jpg`, `trust.jpg`, and `cta.jpg`. Prompts are tailored per category (tree, plumbing, pressure washing, roofing, landscaping, HVAC, generic). Requires `OPENAI_API_KEY`.

### render-preview-v3

Renders a v3 preview to PNG screenshots with Playwright. Generates the preview first if it does not exist.

```bash
npm run outreach -- render-preview-v3 <lead-id>
```

Requires Playwright Chromium (`npx playwright install chromium`).

Creates:

```
renders/<slug-business-name>/
  desktop.png   (1440×1200 viewport)
  mobile.png    (390×1200 viewport)
```

### discover

Interactive Google Maps search automation. Prompts for search term, city, and max results, then scrapes listings and imports them as leads with existing scoring and duplicate detection.

```bash
npm run outreach -- discover
```

Example prompts:

```
search term: pressure washing
city: Beaumont TX
max results: 20
```

Extracts business name, category, city, phone (when shown), website presence, review count, and rating. Each imported lead is enriched automatically:

- **Social evidence** — Facebook/Instagram links on the website or via business name search
- **Strong proof** — review count ≥ 15 or rating ≥ 4.7
- **Website quality** — `strong`, `weak`, or `unknown` (sets `weakWebsite` only when weak)

Prints a summary:

```
Found: XX
Imported: XX
Enriched: XX
TARGET: XX
HOLD: XX
SKIP: XX
```

Per business: `Business Name — Enriched: yes/no | STATUS (score)`

### import-text

Paste multi-line business info, then press **Enter twice** to finish. The CLI parses name, category, city, phone, website, reviews, and rating, scores the lead, saves it, and prints the same summary as `add`.

Example paste:

```
Patteson Stump Grinding
Tree service
Groves TX
(409) 280-9286
No website
18 reviews
4.8 stars
```

You can also pipe text in:

```bash
Get-Content lead.txt | node src/cli.js import-text
```

## Scoring

| Rule | Points |
|------|--------|
| No website | +5 |
| Weak website (`--weak-website`) | +3 |
| 10+ Google reviews | +3 |
| Phone provided | +2 |
| Service business (auto from category or `--service-business`) | +2 |
| Social/page evidence (`--social`) | +2 |
| Strong proof (`--strong-proof`) | +2 |

**Status:** TARGET (≥15), HOLD (10–14), SKIP (&lt;10)

## Outreach angles

- **No website** — no `website` URL on the lead
- **Weak website** — `--weak-website` when a URL exists
- **Conversion improvement** — has a site that is not marked weak

## Lead fields

`businessName`, `category`, `city`, `phone`, `websiteUrl`, `googleReviewCount`, `googleRating`, `notes`, plus optional flags: `weakWebsite`, `socialEvidence`, `strongProof`, `websiteQuality`, `serviceBusiness`.
