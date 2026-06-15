import { cleanText } from "./stage1/shared.js";
import { listQualifiedBusinesses } from "./stage1/qualified-business-store.js";
import {
  generateProjectsForRecords,
  selectQualifiedBusinesses,
  founderQueueView,
} from "./stage1/founder-preview-bridge.js";
import {
  executeDiscoveryCampaign,
  getLiveCampaign,
  setLiveCampaign,
  campaignQueue,
} from "./opportunity-engine/discovery-campaign.js";
import {
  getDiscoveryCampaign,
  listDiscoveryCampaigns,
  newCampaignId,
} from "./opportunity-engine/campaign-store.js";
import { enrichCampaignView } from "./opportunity-engine/campaign-progress.js";
import { refreshCampaignFromJobs } from "./opportunity-engine/distributed-job-store.js";
import { publicBaseUrl } from "./v7/shared.js";

function queueCampaignRun(runner) {
  runner().catch(() => {});
}

export function mapCampaignStatusLabel(status) {
  const value = String(status ?? "").toLowerCase();
  if (value === "completed") return "Complete";
  if (value === "failed") return "Failed";
  if (value === "running") return "Running";
  return "Pending";
}

function buildCampaignPhoneView(campaign) {
  const totals = campaign.totals ?? {};
  const progress = campaign.progress ?? {};
  return {
    id: campaign.id,
    status: campaign.status,
    statusLabel: mapCampaignStatusLabel(campaign.status),
    cities: campaign.cities ?? [],
    industries: campaign.industries ?? [],
    discovered: Number(totals.businessesFound) || 0,
    qualified: Number(totals.qualifiedCount) || 0,
    rejected: Number(totals.rejectedCount) || 0,
    duplicates: Number(totals.duplicateCount) || 0,
    completedPairs: progress.completedPairs ?? campaign.completedPairs ?? 0,
    totalPairs: progress.totalPairs ?? campaign.totalPairs ?? 0,
    percentComplete: progress.percentComplete ?? 0,
    error: campaign.error ?? null,
    startedAt: campaign.startedAt ?? null,
    finishedAt: campaign.finishedAt ?? null,
  };
}

async function resolveCampaign(campaignId) {
  if (campaignId) {
    const refreshed = await refreshCampaignFromJobs(campaignId);
    if (refreshed) {
      setLiveCampaign(refreshed);
      return enrichCampaignView(refreshed);
    }
    const live = getLiveCampaign(campaignId);
    if (live) return enrichCampaignView(live);
    const saved = await getDiscoveryCampaign(campaignId);
    if (saved) return enrichCampaignView(saved);
    return null;
  }

  const campaigns = await listDiscoveryCampaigns();
  if (!campaigns.length) return null;
  const latest = campaigns[0];
  const refreshed = await refreshCampaignFromJobs(latest.id);
  const campaign = refreshed ?? latest;
  if (refreshed) setLiveCampaign(refreshed);
  return enrichCampaignView(campaign);
}

function encodeSmsBody(text) {
  return encodeURIComponent(cleanText(text));
}

function encodeMail(text) {
  return encodeURIComponent(cleanText(text));
}

function normalizePhoneDigits(phone) {
  const digits = cleanText(phone).replace(/[^\d+]/g, "");
  return digits || "";
}

function defaultPreviewText(business, previewUrl) {
  const name = business.businessName || "your business";
  return `Hi ${name}, I put together a quick website preview for ${name}. Take a look: ${previewUrl}`;
}

function defaultEmailSubject(business) {
  return `${business.businessName || "Your business"} website preview`;
}

function defaultEmailBody(business, previewUrl) {
  const name = business.businessName || "there";
  return `Hi ${name},\n\nI reviewed your online presence and built a quick website preview showing what a stronger mobile-first site could look like for your business.\n\nPreview: ${previewUrl}\n\nOpen to a quick call?\n\n- WebLab`;
}

export function buildPreviewQueueItem(record, baseUrl) {
  const item = founderQueueView(record);
  const previewUrl = item.previewUrl || (item.opportunityProjectId ? `${baseUrl}/p/${item.opportunityProjectId}` : "");
  const launchUrl = item.launchUrl || (item.opportunityProjectId ? `${baseUrl}/launch/${item.opportunityProjectId}` : "");
  const phone = normalizePhoneDigits(item.phone);
  const email = cleanText(item.email);
  const smsBody = defaultPreviewText(item, previewUrl);
  const emailSubject = defaultEmailSubject(item);
  const emailBody = defaultEmailBody(item, previewUrl);

  return {
    ...item,
    previewUrl,
    launchUrl,
    actions: {
      call: phone ? `tel:${phone}` : "",
      text: phone ? `sms:${phone}?body=${encodeSmsBody(smsBody)}` : "",
      email: email ? `mailto:${email}?subject=${encodeMail(emailSubject)}&body=${encodeMail(emailBody)}` : "",
      preview: previewUrl,
      offer: launchUrl,
    },
  };
}

export async function startFounderCampaign(req, body = {}) {
  const city = cleanText(body.city);
  const industry = cleanText(body.industry);
  const state = cleanText(body.state || "TX").toUpperCase();
  const maxBusinessesPerSearch = Math.min(
    200,
    Math.max(1, Number(body.maxBusinesses ?? body.maxBusinessesPerSearch) || 25),
  );

  if (!city) throw new Error("City is required.");
  if (!industry) throw new Error("Industry is required.");

  const campaignId = newCampaignId();
  campaignQueue.set(campaignId, {
    id: campaignId,
    status: "starting",
    startedAt: new Date().toISOString(),
    logs: [{ at: new Date().toISOString(), message: "Discovery campaign queued from phone" }],
    progress: 0,
  });

  queueCampaignRun(() =>
    executeDiscoveryCampaign(
      {
        regionId: "southeast-texas",
        cities: [city],
        industries: [industry],
        state,
        maxBusinessesPerSearch,
        forceNew: true,
      },
      {
        campaignId,
        onProgress: (update) => campaignQueue.set(campaignId, update),
      },
    ),
  );

  return {
    campaignId,
    status: "starting",
    statusLabel: "Pending",
    message: "Campaign started. Make sure your local worker is running (npm run worker).",
  };
}

export async function getFounderCampaignStatus(campaignId) {
  const campaign = await resolveCampaign(campaignId);
  if (!campaign) return null;
  return buildCampaignPhoneView(campaign);
}

export async function generateFounderTopPreviews(req, mode = "top_25") {
  const records = await listQualifiedBusinesses();
  const selected = selectQualifiedBusinesses(records, mode, []);
  if (!selected.length) {
    return {
      requested: 0,
      successful: 0,
      created: 0,
      existing: 0,
      failed: 0,
      verifiedPreviews: 0,
      outcomes: [],
      message: "No qualified businesses found. Run a discovery campaign first.",
    };
  }
  return generateProjectsForRecords(selected, req);
}

export async function getFounderPreviewQueue(req, { limit = 50 } = {}) {
  const baseUrl = publicBaseUrl(req);
  const records = await listQualifiedBusinesses();
  const queue = records
    .filter((row) => row.qualificationStatus === "qualified" && (row.previewUrl || row.opportunityProjectId))
    .map((row) => buildPreviewQueueItem(row, baseUrl))
    .slice(0, Math.max(1, Number(limit) || 50));

  const withPreview = queue.filter((row) => row.previewGenerated || row.previewUrl).length;
  const ready = queue.filter((row) => row.readyForOutreach).length;

  return {
    total: queue.length,
    withPreview,
    readyForOutreach: ready,
    queue,
  };
}

export function registerFounderPhoneRoutes(app) {
  app.post("/api/public/founder/campaigns", async (req, res) => {
    try {
      const result = await startFounderCampaign(req, req.body ?? {});
      return res.status(202).json(result);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  });

  app.get("/api/public/founder/campaigns/active", async (req, res) => {
    const campaignId = cleanText(req.query?.campaignId);
    const view = await getFounderCampaignStatus(campaignId || null);
    if (!view) {
      return res.json({ campaign: null });
    }
    return res.json({ campaign: view });
  });

  app.get("/api/public/founder/campaigns/:campaignId", async (req, res) => {
    const view = await getFounderCampaignStatus(req.params.campaignId);
    if (!view) return res.status(404).json({ error: "Campaign not found" });
    return res.json({ campaign: view });
  });

  app.post("/api/public/founder/previews/generate", async (req, res) => {
    try {
      const mode = cleanText(req.body?.mode) || "top_25";
      const result = await generateFounderTopPreviews(req, mode);
      return res.status(200).json(result);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/public/founder/preview-queue", async (req, res) => {
    try {
      return res.json(await getFounderPreviewQueue(req));
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });
}

export function renderFounderPhonePage() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>WebLab Founder OS</title>
  <style>
    :root { color-scheme: dark; font-family: "Segoe UI", system-ui, sans-serif; }
    body { margin: 0; background: #0b1220; color: #e9f0ff; }
    .wrap { max-width: 880px; margin: 0 auto; padding: 20px 14px 48px; }
    .card {
      background: #121a2b;
      border: 1px solid rgba(255,255,255,0.09);
      border-radius: 18px;
      padding: 18px;
      margin-bottom: 12px;
    }
    h1 { margin: 0 0 6px; font-size: 26px; }
    h2 { margin: 0 0 10px; font-size: 18px; }
    p, .muted { margin: 0; color: #b7c6e5; line-height: 1.5; font-size: 14px; }
    .form-grid {
      display: grid;
      gap: 10px;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      margin-top: 12px;
    }
    .field {
      width: 100%;
      box-sizing: border-box;
      background: #0f1730;
      color: #e9f0ff;
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 10px;
      padding: 11px 12px;
      font-size: 16px;
    }
    .actions { margin-top: 12px; display: flex; flex-wrap: wrap; gap: 8px; }
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      text-decoration: none;
      border-radius: 999px;
      padding: 11px 14px;
      font-weight: 600;
      font-size: 14px;
      border: 1px solid rgba(255,255,255,0.14);
      color: #e9f0ff;
      background: #1a2438;
      cursor: pointer;
    }
    .btn.primary { background: #4f8cff; border-color: #4f8cff; color: #fff; }
    .btn.success { background: #2f9e6b; border-color: #2f9e6b; color: #fff; }
    .btn:disabled { opacity: 0.55; cursor: not-allowed; }
    .btn-mini { font-size: 13px; padding: 9px 12px; border-radius: 12px; min-width: 72px; }
    .status { margin-top: 10px; color: #9fb0d0; font-size: 13px; min-height: 18px; }
    .stats {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
      margin-top: 12px;
    }
    .stat {
      background: #1a2438;
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 12px;
      padding: 10px 12px;
    }
    .stat strong { display: block; font-size: 20px; margin-bottom: 2px; }
    .stat span { color: #9fb0d0; font-size: 12px; }
    .badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.02em;
    }
    .badge.pending { background: #3a4660; color: #dbe6ff; }
    .badge.running { background: #355f9e; color: #dbe6ff; }
    .badge.complete { background: #2f7d57; color: #eafff3; }
    .badge.failed { background: #8b3a3a; color: #ffe8e8; }
    .queue { list-style: none; padding: 0; margin: 12px 0 0; display: grid; gap: 10px; }
    .queue li {
      background: #1a2438;
      border: 1px solid rgba(255,255,255,0.09);
      border-radius: 14px;
      padding: 12px;
      display: grid;
      gap: 8px;
    }
    .queue-head { display: flex; justify-content: space-between; gap: 10px; align-items: flex-start; }
    .queue-head strong { font-size: 15px; line-height: 1.3; }
    .queue-meta { color: #9fb0d0; font-size: 13px; }
    .queue-actions { display: flex; flex-wrap: wrap; gap: 8px; }
    .queue-actions a { text-decoration: none; }
    .empty { padding: 8px 0; }
    @media (max-width: 720px) {
      .wrap { padding: 14px 10px 36px; }
      .form-grid, .stats { grid-template-columns: 1fr; }
      .field { font-size: 16px; }
    }
  </style>
</head>
<body>
  <main class="wrap">
    <section class="card">
      <h1>WebLab Founder OS</h1>
      <p class="muted">Run discovery, generate previews, and contact businesses from your phone.</p>
      <p class="muted"><a href="/outreach" style="color:#9ec5ff;">Open Outreach Queue →</a></p>
    </section>

    <section class="card">
      <h2>1. Start Campaign</h2>
      <p class="muted">One campaign = one city + one industry. Keep your worker running locally.</p>
      <div class="form-grid">
        <input id="campCity" class="field" placeholder="City" value="Lumberton" />
        <input id="campState" class="field" placeholder="State" value="TX" maxlength="2" />
        <input id="campIndustry" class="field" placeholder="Industry" value="Roofing" />
        <input id="campMax" class="field" type="number" min="1" max="200" placeholder="Max businesses" value="25" />
      </div>
      <div class="actions">
        <button id="startCampaign" class="btn primary">Start Campaign</button>
      </div>
      <p id="campaignStartStatus" class="status"></p>
    </section>

    <section class="card">
      <h2>2. Campaign Status</h2>
      <div id="campaignStatusWrap">
        <p class="muted empty">No campaign yet. Start one above.</p>
      </div>
    </section>

    <section class="card">
      <h2>3. Generate Previews</h2>
      <p class="muted">Creates preview + offer links for the top 25 qualified businesses.</p>
      <div class="actions">
        <button id="generatePreviews" class="btn success">Generate Top 25 Previews</button>
      </div>
      <p id="generateStatus" class="status"></p>
    </section>

    <section class="card">
      <h2>4. Preview Queue</h2>
      <p class="muted">Tap call, text, or email to reach owners manually.</p>
      <div id="previewQueueWrap">
        <p class="muted empty">No previews yet. Run a campaign, then generate previews.</p>
      </div>
    </section>
  </main>
  <script>
    (function () {
      var activeCampaignId = localStorage.getItem("we_active_campaign_id") || "";
      var pollTimer = null;

      function esc(text) {
        return String(text || "")
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;");
      }

      function setText(id, message) {
        var el = document.getElementById(id);
        if (el) el.textContent = message || "";
      }

      async function jsonGet(url) {
        var response = await fetch(url);
        var payload = await response.json().catch(function () { return {}; });
        if (!response.ok) throw new Error(payload.error || "Request failed");
        return payload;
      }

      async function jsonPost(url, body) {
        var response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body || {})
        });
        var payload = await response.json().catch(function () { return {}; });
        if (!response.ok) throw new Error(payload.error || "Request failed");
        return payload;
      }

      function badgeClass(label) {
        var value = String(label || "").toLowerCase();
        if (value === "complete") return "complete";
        if (value === "failed") return "failed";
        if (value === "running") return "running";
        return "pending";
      }

      function renderCampaign(campaign) {
        var wrap = document.getElementById("campaignStatusWrap");
        if (!campaign) {
          wrap.innerHTML = '<p class="muted empty">No campaign yet. Start one above.</p>';
          return;
        }
        var cities = (campaign.cities || []).join(", ");
        var industries = (campaign.industries || []).join(", ");
        wrap.innerHTML =
          '<div class="queue-head">' +
            '<div><strong>' + esc(cities) + ' · ' + esc(industries) + '</strong>' +
            '<div class="queue-meta">Campaign ' + esc(campaign.id) + '</div></div>' +
            '<span class="badge ' + badgeClass(campaign.statusLabel) + '">' + esc(campaign.statusLabel) + '</span>' +
          '</div>' +
          '<div class="stats">' +
            '<div class="stat"><strong>' + esc(String(campaign.discovered)) + '</strong><span>Discovered</span></div>' +
            '<div class="stat"><strong>' + esc(String(campaign.qualified)) + '</strong><span>Qualified</span></div>' +
            '<div class="stat"><strong>' + esc(String(campaign.completedPairs)) + '/' + esc(String(campaign.totalPairs)) + '</strong><span>Jobs done</span></div>' +
            '<div class="stat"><strong>' + esc(String(campaign.percentComplete || 0)) + '%</strong><span>Progress</span></div>' +
          '</div>' +
          (campaign.error ? '<p class="status">' + esc(campaign.error) + '</p>' : '') +
          (campaign.statusLabel === 'Pending' && campaign.discovered === 0
            ? '<p class="status">Waiting for worker. Run <code>npm run worker</code> on your computer.</p>'
            : '');
      }

      function renderQueue(data) {
        var wrap = document.getElementById("previewQueueWrap");
        var queue = (data && data.queue) || [];
        if (!queue.length) {
          wrap.innerHTML = '<p class="muted empty">No previews yet. Run a campaign, then generate previews.</p>';
          return;
        }
        var html = '<ul class="queue">';
        queue.forEach(function (item) {
          var meta = [item.city, item.industry].filter(Boolean).join(" · ");
          var actions = item.actions || {};
          html += '<li>' +
            '<div class="queue-head">' +
              '<div><strong>' + esc(item.businessName) + '</strong>' +
              '<div class="queue-meta">' + esc(meta) + '</div></div>' +
            '</div>' +
            '<div class="queue-meta">' +
              (item.phone ? 'Phone: ' + esc(item.phone) + '<br/>' : '') +
              (item.email ? 'Email: ' + esc(item.email) : '') +
            '</div>' +
            '<div class="queue-actions">' +
              (actions.call ? '<a class="btn btn-mini primary" href="' + esc(actions.call) + '">Call</a>' : '') +
              (actions.text ? '<a class="btn btn-mini" href="' + esc(actions.text) + '">Text</a>' : '') +
              (actions.email ? '<a class="btn btn-mini" href="' + esc(actions.email) + '">Email</a>' : '') +
              (actions.preview ? '<a class="btn btn-mini" href="' + esc(actions.preview) + '" target="_blank" rel="noopener">Preview</a>' : '') +
              (actions.offer ? '<a class="btn btn-mini" href="' + esc(actions.offer) + '" target="_blank" rel="noopener">Offer</a>' : '') +
            '</div>' +
          '</li>';
        });
        html += '</ul>';
        wrap.innerHTML = html;
      }

      async function refreshCampaign() {
        var url = activeCampaignId
          ? "/api/public/founder/campaigns/" + encodeURIComponent(activeCampaignId)
          : "/api/public/founder/campaigns/active";
        var payload = await jsonGet(url);
        var campaign = payload.campaign || null;
        if (campaign && campaign.id) {
          activeCampaignId = campaign.id;
          localStorage.setItem("we_active_campaign_id", activeCampaignId);
        }
        renderCampaign(campaign);
        if (campaign && (campaign.statusLabel === "Pending" || campaign.statusLabel === "Running")) {
          if (!pollTimer) {
            pollTimer = setInterval(refreshCampaign, 5000);
          }
        } else if (pollTimer) {
          clearInterval(pollTimer);
          pollTimer = null;
        }
      }

      async function refreshQueue() {
        var payload = await jsonGet("/api/public/founder/preview-queue");
        renderQueue(payload);
      }

      document.getElementById("startCampaign").addEventListener("click", async function () {
        var btn = document.getElementById("startCampaign");
        btn.disabled = true;
        setText("campaignStartStatus", "Starting campaign...");
        try {
          var result = await jsonPost("/api/public/founder/campaigns", {
            city: document.getElementById("campCity").value,
            state: document.getElementById("campState").value,
            industry: document.getElementById("campIndustry").value,
            maxBusinesses: Number(document.getElementById("campMax").value) || 25
          });
          activeCampaignId = result.campaignId;
          localStorage.setItem("we_active_campaign_id", activeCampaignId);
          setText("campaignStartStatus", result.message || "Campaign started.");
          await refreshCampaign();
        } catch (err) {
          setText("campaignStartStatus", err.message);
        } finally {
          btn.disabled = false;
        }
      });

      document.getElementById("generatePreviews").addEventListener("click", async function () {
        var btn = document.getElementById("generatePreviews");
        btn.disabled = true;
        setText("generateStatus", "Generating previews... this may take a few minutes.");
        try {
          var result = await jsonPost("/api/public/founder/previews/generate", { mode: "top_25" });
          setText(
            "generateStatus",
            "Done: " + result.created + " created, " + result.existing + " existing, " + result.failed + " failed."
          );
          await refreshQueue();
        } catch (err) {
          setText("generateStatus", err.message);
        } finally {
          btn.disabled = false;
        }
      });

      refreshCampaign().catch(function () {});
      refreshQueue().catch(function () {});
    })();
  </script>
</body>
</html>`;
}
