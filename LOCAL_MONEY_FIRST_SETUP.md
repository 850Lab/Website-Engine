# Local Money-First Setup

Use this flow to run discovery, generate previews, and contact businesses manually from your phone **this week**.

## Important: run locally (not Vercel-only)

Discovery jobs, qualified businesses, and preview files are stored on disk (`data/`, `previews-v3/`). The worker reads the same files as the server.

For money-first ops:

1. Run **server + worker on your computer**.
2. Open the Founder OS page on your phone against **that computer** (same Wi‑Fi IP or a tunnel).
3. Set `PUBLIC_BASE_URL` in `.env` to the **same URL** you send to business owners (tunnel URL recommended).

If you start a campaign on Vercel but run the worker locally, they will not share data.

---

## One-time setup

```bash
npm install
npx playwright install chromium
```

Create `.env` in the project root (minimum):

```bash
PUBLIC_BASE_URL=https://YOUR-TUNNEL-OR-LAN-URL
ADMIN_PASSWORD=your-password
```

Optional worker key (only needed if you split server/worker across machines later):

```bash
WORKER_API_KEY=local-dev-worker-key
```

---

## Daily operation

### Terminal 1 — API server

```bash
npm run server
```

Server listens on `http://localhost:8787`.

### Terminal 2 — discovery worker

```bash
npm run worker
```

Leave both running. The worker picks up campaign jobs created from your phone.

---

## Phone access

### Option A — same Wi‑Fi (fastest test)

1. Find your computer's LAN IP (e.g. `192.168.1.42`).
2. On your phone, open: `http://192.168.1.42:8787`
3. Set in `.env`:
   ```bash
   PUBLIC_BASE_URL=http://192.168.1.42:8787
   ```
4. Restart `npm run server` after changing `.env`.

Preview/text links only work for owners on your Wi‑Fi with this option.

### Option B — public tunnel (recommended for real outreach)

Use ngrok, Cloudflare Tunnel, or similar so owners can open preview links:

```bash
# example with ngrok
ngrok http 8787
```

Set `.env`:

```bash
PUBLIC_BASE_URL=https://abc123.ngrok-free.app
```

Restart the server. Open that URL on your phone.

---

## Phone workflow (Founder OS)

Open `/` on your phone.

### 1. Start a campaign

- **City:** e.g. `Lumberton`
- **State:** `TX`
- **Industry:** e.g. `Roofing`
- **Max businesses:** `25`
- Tap **Start Campaign**

Status shows **Pending** until the worker claims the job, then **Running**, then **Complete**.

If status stays Pending with 0 discovered, check Terminal 2 (`npm run worker`).

### 2. Generate previews

When the campaign is **Complete** and you have qualified businesses:

- Tap **Generate Top 25 Previews**
- Wait a few minutes (generates one preview at a time)

### 3. Preview queue — manual outreach

Each row shows:

- Business name, city, industry
- Phone and email (when discovered)
- **Call** — opens dialer
- **Text** — pre-filled SMS with preview link
- **Email** — pre-filled email with preview link
- **Preview** — open the sales preview page
- **Offer** — open the offer/pricing page

Send manually. No automated outreach in this mode.

---

## API equivalents (optional)

Start campaign:

```bash
curl -X POST http://localhost:8787/api/public/founder/campaigns \
  -H "Content-Type: application/json" \
  -d '{"city":"Lumberton","state":"TX","industry":"Roofing","maxBusinesses":25}'
```

Campaign status:

```bash
curl http://localhost:8787/api/public/founder/campaigns/active
```

Generate top 25 previews:

```bash
curl -X POST http://localhost:8787/api/public/founder/previews/generate \
  -H "Content-Type: application/json" \
  -d '{"mode":"top_25"}'
```

Preview queue:

```bash
curl http://localhost:8787/api/public/founder/preview-queue
```

---

## Link types you send owners

| Link | Path | Purpose |
|------|------|---------|
| Preview | `/p/{projectId}` | “Here’s your website preview” |
| Offer | `/launch/{projectId}` | Pricing, deliverables, CTA |

These URLs use `PUBLIC_BASE_URL` from `.env`.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Campaign stuck on Pending | Start `npm run worker` in Terminal 2 |
| Playwright errors | Run `npx playwright install chromium` |
| Preview links 404 for owners | `PUBLIC_BASE_URL` must match the server that has the data (tunnel/LAN) |
| Generate previews fails | Run a campaign first; need qualified businesses in QBD |
| Phone can't reach server | Same Wi‑Fi, firewall allows port 8787, or use a tunnel |

---

## What this mode does not include

- Automated email/SMS sending
- Postgres / Railway migration
- Campaign execution on Vercel serverless alone
- New preview templates

Those come after your first manual sales week.
