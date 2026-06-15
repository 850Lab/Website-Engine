import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { DATA_DIR } from "./storage.js";
import { cleanText } from "./stage1/shared.js";
import {
  getQualifiedBusiness,
  listQualifiedBusinesses,
  normalizeOutreachStatus,
  OUTREACH_STATUSES,
  upsertQualifiedBusiness,
} from "./stage1/qualified-business-store.js";
import { publicBaseUrl } from "./v7/shared.js";

const FOUNDER_OS_FILE = join(DATA_DIR, "founder-os.json");

export const OUTREACH_STATUS_LABELS = {
  not_contacted: "Not contacted",
  contacted: "Contacted",
  replied: "Replied",
  asked_price: "Asked price",
  appointment: "Appointment",
  won: "Won",
  lost: "Lost",
};

async function loadFounderOsStatusMap() {
  try {
    const parsed = JSON.parse(await readFile(FOUNDER_OS_FILE, "utf8"));
    const map = new Map();
    for (const row of parsed?.businesses ?? []) {
      const sourceId = cleanText(row.sourceRecordId);
      if (sourceId) map.set(sourceId, cleanText(row.outreachStatus));
    }
    return map;
  } catch {
    return new Map();
  }
}

function mapLegacyFounderStatus(status) {
  const value = cleanText(status).toLowerCase();
  const mapping = {
    new: "not_contacted",
    contacted: "contacted",
    follow_up: "contacted",
    responded: "replied",
    interested: "asked_price",
    appointment_scheduled: "appointment",
    proposal_sent: "asked_price",
    won: "won",
    lost: "lost",
  };
  return mapping[value] ?? null;
}

function resolveOutreachStatus(record, founderOsMap) {
  const stored = cleanText(record.outreachStatus);
  if (stored) return normalizeOutreachStatus(stored);
  const legacy = mapLegacyFounderStatus(founderOsMap.get(record.id));
  return legacy ? normalizeOutreachStatus(legacy) : "not_contacted";
}

function encodeSmsBody(text) {
  return encodeURIComponent(cleanText(text));
}

function encodeMail(text) {
  return encodeURIComponent(cleanText(text));
}

function normalizePhoneDigits(phone) {
  return cleanText(phone).replace(/[^\d+]/g, "");
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
  return `Hi ${name},\n\nI built a quick website preview showing what a stronger mobile-first site could look like for your business.\n\nPreview: ${previewUrl}\n\nOpen to a quick call?\n\n- WebLab`;
}

function resolveLinks(record, baseUrl) {
  const projectId = cleanText(record.opportunityProjectId);
  const previewUrl =
    cleanText(record.previewUrl) || (projectId ? `${baseUrl}/p/${projectId}` : "");
  const launchUrl =
    cleanText(record.launchUrl) || (projectId ? `${baseUrl}/launch/${projectId}` : "");
  return { previewUrl, launchUrl };
}

export function buildOutreachItem(record, baseUrl, founderOsMap = new Map()) {
  const { previewUrl, launchUrl } = resolveLinks(record, baseUrl);
  const phone = normalizePhoneDigits(record.phone || record.normalizedPhone);
  const email = cleanText(record.email);
  const website = cleanText(record.websiteUrl);
  const outreachStatus = resolveOutreachStatus(record, founderOsMap);
  const smsBody = previewUrl ? defaultPreviewText(record, previewUrl) : defaultPreviewText(record, baseUrl);
  const emailSubject = defaultEmailSubject(record);
  const emailBody = previewUrl
    ? defaultEmailBody(record, previewUrl)
    : defaultEmailBody(record, baseUrl);

  return {
    id: record.id,
    businessName: record.businessName,
    city: record.city,
    state: record.state,
    industry: record.industry || record.category,
    phone: record.phone || record.normalizedPhone || "",
    email,
    website,
    previewUrl,
    launchUrl,
    outreachStatus,
    outreachStatusLabel: OUTREACH_STATUS_LABELS[outreachStatus] || outreachStatus,
    qualificationStatus: record.qualificationStatus,
    hasPreview: Boolean(previewUrl),
    hasPhone: Boolean(phone),
    actions: {
      call: phone ? `tel:${phone}` : "",
      text: phone ? `sms:${phone}?body=${encodeSmsBody(smsBody)}` : "",
      email: email ? `mailto:${email}?subject=${encodeMail(emailSubject)}&body=${encodeMail(emailBody)}` : "",
      preview: previewUrl,
      offer: launchUrl,
    },
  };
}

function parseBoolFilter(value) {
  if (value === "1" || value === "true") return true;
  if (value === "0" || value === "false") return false;
  return null;
}

function matchesFilters(item, query) {
  const search = cleanText(query.search).toLowerCase();
  if (search) {
    const haystack = [
      item.businessName,
      item.city,
      item.industry,
      item.phone,
      item.email,
      item.website,
    ]
      .join(" ")
      .toLowerCase();
    if (!haystack.includes(search)) return false;
  }

  const city = cleanText(query.city);
  if (city && cleanText(item.city).toLowerCase() !== city.toLowerCase()) return false;

  const industry = cleanText(query.industry);
  if (industry && cleanText(item.industry).toLowerCase() !== industry.toLowerCase()) return false;

  const hasPreview = parseBoolFilter(query.hasPreview);
  if (hasPreview === true && !item.hasPreview) return false;
  if (hasPreview === false && item.hasPreview) return false;

  const hasPhone = parseBoolFilter(query.hasPhone);
  if (hasPhone === true && !item.hasPhone) return false;
  if (hasPhone === false && item.hasPhone) return false;

  if (parseBoolFilter(query.notContacted) === true && item.outreachStatus !== "not_contacted") {
    return false;
  }

  const status = cleanText(query.status);
  if (status && item.outreachStatus !== normalizeOutreachStatus(status)) return false;

  return true;
}

export async function listOutreachBusinesses(req, query = {}) {
  const baseUrl = publicBaseUrl(req);
  const [records, founderOsMap] = await Promise.all([
    listQualifiedBusinesses(),
    loadFounderOsStatusMap(),
  ]);

  const all = records.map((record) => buildOutreachItem(record, baseUrl, founderOsMap));
  const filtered = all.filter((item) => matchesFilters(item, query));

  const cities = [...new Set(all.map((row) => cleanText(row.city)).filter(Boolean))].sort();
  const industries = [...new Set(all.map((row) => cleanText(row.industry)).filter(Boolean))].sort();

  return {
    total: all.length,
    filtered: filtered.length,
    businesses: filtered,
    filters: {
      cities,
      industries,
      statuses: OUTREACH_STATUSES.map((id) => ({
        id,
        label: OUTREACH_STATUS_LABELS[id],
      })),
    },
    summary: {
      withPreview: all.filter((row) => row.hasPreview).length,
      withPhone: all.filter((row) => row.hasPhone).length,
      notContacted: all.filter((row) => row.outreachStatus === "not_contacted").length,
    },
  };
}

export async function updateOutreachStatus(businessId, status) {
  const nextStatus = normalizeOutreachStatus(status);
  if (!OUTREACH_STATUSES.includes(nextStatus)) {
    throw new Error(`Invalid outreach status: ${status}`);
  }

  const record = await getQualifiedBusiness(businessId);
  if (!record) throw new Error("Business not found");

  const updated = {
    ...record,
    outreachStatus: nextStatus,
    outreachStatusUpdatedAt: new Date().toISOString(),
  };
  await upsertQualifiedBusiness(updated);

  return {
    id: updated.id,
    outreachStatus: nextStatus,
    outreachStatusLabel: OUTREACH_STATUS_LABELS[nextStatus],
  };
}

export function registerOutreachRoutes(app) {
  app.get("/api/public/outreach/businesses", async (req, res) => {
    try {
      return res.json(await listOutreachBusinesses(req, req.query ?? {}));
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.patch("/api/public/outreach/businesses/:id/status", async (req, res) => {
    try {
      const result = await updateOutreachStatus(req.params.id, req.body?.status);
      return res.json(result);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  });
}

export function renderOutreachPage() {
  const statusButtons = OUTREACH_STATUSES.map(
    (id) =>
      `<button type="button" class="status-chip" data-status-value="${id}">${OUTREACH_STATUS_LABELS[id]}</button>`,
  ).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>WebLab Outreach</title>
  <style>
    :root { color-scheme: dark; font-family: "Segoe UI", system-ui, sans-serif; }
    body { margin: 0; background: #0b1220; color: #e9f0ff; }
    .wrap { max-width: 920px; margin: 0 auto; padding: 16px 12px 56px; }
    .card {
      background: #121a2b;
      border: 1px solid rgba(255,255,255,0.09);
      border-radius: 16px;
      padding: 14px;
      margin-bottom: 12px;
    }
    h1 { margin: 0 0 6px; font-size: 24px; }
    h2 { margin: 0 0 8px; font-size: 16px; }
    .muted { color: #b7c6e5; font-size: 14px; line-height: 1.45; }
    .summary { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
    .pill {
      background: #1a2438;
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 999px;
      padding: 6px 10px;
      font-size: 12px;
      color: #b7c6e5;
    }
    .filters { display: grid; gap: 8px; grid-template-columns: 1fr 1fr; margin-top: 10px; }
    .field, .select {
      width: 100%;
      box-sizing: border-box;
      background: #0f1730;
      color: #e9f0ff;
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 10px;
      padding: 11px 12px;
      font-size: 16px;
    }
    .search-row { grid-column: 1 / -1; }
    .checks { grid-column: 1 / -1; display: flex; flex-wrap: wrap; gap: 10px; }
    .checks label { display: flex; align-items: center; gap: 6px; font-size: 14px; color: #b7c6e5; }
    .checks input { width: 18px; height: 18px; }
    .list { display: grid; gap: 12px; margin-top: 12px; }
    .biz {
      background: #1a2438;
      border: 1px solid rgba(255,255,255,0.09);
      border-radius: 14px;
      padding: 14px;
      display: grid;
      gap: 10px;
    }
    .biz-head { display: flex; justify-content: space-between; gap: 10px; align-items: flex-start; }
    .biz-head strong { font-size: 17px; line-height: 1.25; }
    .badge {
      display: inline-block;
      padding: 5px 10px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 700;
      background: #355f9e;
      color: #eef4ff;
      white-space: nowrap;
    }
    .meta { color: #9fb0d0; font-size: 13px; line-height: 1.5; }
    .meta a { color: #9ec5ff; }
    .actions { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .btn {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 46px;
      text-decoration: none;
      border-radius: 12px;
      padding: 10px 12px;
      font-weight: 700;
      font-size: 14px;
      border: 1px solid rgba(255,255,255,0.14);
      color: #e9f0ff;
      background: #24314d;
      cursor: pointer;
    }
    .btn.primary { background: #4f8cff; border-color: #4f8cff; color: #fff; grid-column: 1 / -1; }
    .btn.success { background: #2f9e6b; border-color: #2f9e6b; color: #fff; }
    .btn.warn { background: #8f6a1e; border-color: #8f6a1e; color: #fff; }
    .btn:disabled, .btn.disabled { opacity: 0.45; pointer-events: none; }
    .status-row { display: flex; flex-wrap: wrap; gap: 6px; }
    .status-chip {
      border: 1px solid rgba(255,255,255,0.12);
      background: #0f1730;
      color: #b7c6e5;
      border-radius: 999px;
      padding: 6px 10px;
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
    }
    .status-chip.active { background: #4f8cff; border-color: #4f8cff; color: #fff; }
    .empty { padding: 20px 0; text-align: center; color: #9fb0d0; }
    .top-link { color: #9ec5ff; font-size: 14px; }
    @media (max-width: 720px) {
      .filters { grid-template-columns: 1fr; }
      .actions { grid-template-columns: 1fr; }
      .btn.primary { grid-column: auto; }
    }
  </style>
</head>
<body>
  <main class="wrap">
    <section class="card">
      <h1>Outreach Queue</h1>
      <p class="muted">Your existing businesses — call, text, or email manually and track status.</p>
      <p><a class="top-link" href="/">← Founder OS</a></p>
      <div class="summary" id="summaryPills"></div>
    </section>

    <section class="card">
      <h2>Filters</h2>
      <div class="filters">
        <input id="search" class="field search-row" placeholder="Search name, city, phone..." />
        <select id="city" class="select"><option value="">All cities</option></select>
        <select id="industry" class="select"><option value="">All industries</option></select>
        <select id="status" class="select">
          <option value="">All statuses</option>
          ${OUTREACH_STATUSES.map((id) => `<option value="${id}">${OUTREACH_STATUS_LABELS[id]}</option>`).join("")}
        </select>
        <div class="checks">
          <label><input type="checkbox" id="hasPreview" /> Has preview link</label>
          <label><input type="checkbox" id="hasPhone" /> Has phone</label>
          <label><input type="checkbox" id="notContacted" /> Not contacted</label>
        </div>
      </div>
    </section>

    <section class="card">
      <h2>Businesses <span id="resultCount" class="muted"></span></h2>
      <div id="businessList" class="list"></div>
    </section>
  </main>
  <script>
    (function () {
      var STATUS_LABELS = ${JSON.stringify(OUTREACH_STATUS_LABELS)};
      var STATUS_VALUES = ${JSON.stringify(OUTREACH_STATUSES)};
      var debounceTimer = null;

      function esc(text) {
        return String(text || "")
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;");
      }

      function queryParams() {
        var params = new URLSearchParams();
        var search = document.getElementById("search").value.trim();
        var city = document.getElementById("city").value;
        var industry = document.getElementById("industry").value;
        var status = document.getElementById("status").value;
        if (search) params.set("search", search);
        if (city) params.set("city", city);
        if (industry) params.set("industry", industry);
        if (status) params.set("status", status);
        if (document.getElementById("hasPreview").checked) params.set("hasPreview", "1");
        if (document.getElementById("hasPhone").checked) params.set("hasPhone", "1");
        if (document.getElementById("notContacted").checked) params.set("notContacted", "1");
        return params;
      }

      function renderSummary(summary) {
        document.getElementById("summaryPills").innerHTML =
          '<span class="pill">' + summary.total + ' total</span>' +
          '<span class="pill">' + summary.withPreview + ' with preview</span>' +
          '<span class="pill">' + summary.withPhone + ' with phone</span>' +
          '<span class="pill">' + summary.notContacted + ' not contacted</span>';
      }

      function fillFilters(filters) {
        var citySelect = document.getElementById("city");
        var industrySelect = document.getElementById("industry");
        var cityValue = citySelect.value;
        var industryValue = industrySelect.value;
        citySelect.innerHTML = '<option value="">All cities</option>' +
          filters.cities.map(function (city) {
            return '<option value="' + esc(city) + '">' + esc(city) + '</option>';
          }).join("");
        industrySelect.innerHTML = '<option value="">All industries</option>' +
          filters.industries.map(function (industry) {
            return '<option value="' + esc(industry) + '">' + esc(industry) + '</option>';
          }).join("");
        citySelect.value = cityValue;
        industrySelect.value = industryValue;
      }

      function statusChips(business) {
        return STATUS_VALUES.map(function (status) {
          var active = business.outreachStatus === status ? " active" : "";
          return '<button type="button" class="status-chip' + active + '" data-business-id="' + esc(business.id) + '" data-status-value="' + status + '">' + esc(STATUS_LABELS[status]) + '</button>';
        }).join("");
      }

      function renderList(payload) {
        document.getElementById("resultCount").textContent = "(" + payload.filtered + " shown)";
        renderSummary({
          total: payload.total,
          withPreview: payload.summary.withPreview,
          withPhone: payload.summary.withPhone,
          notContacted: payload.summary.notContacted
        });
        fillFilters(payload.filters);

        var list = document.getElementById("businessList");
        if (!payload.businesses.length) {
          list.innerHTML = '<div class="empty">No businesses match these filters.</div>';
          return;
        }

        list.innerHTML = payload.businesses.map(function (biz) {
          var actions = biz.actions || {};
          var meta = [biz.city, biz.state, biz.industry].filter(Boolean).join(" · ");
          return '<article class="biz" data-id="' + esc(biz.id) + '">' +
            '<div class="biz-head">' +
              '<div><strong>' + esc(biz.businessName) + '</strong><div class="meta">' + esc(meta) + '</div></div>' +
              '<span class="badge">' + esc(biz.outreachStatusLabel) + '</span>' +
            '</div>' +
            '<div class="meta">' +
              (biz.phone ? 'Phone: ' + esc(biz.phone) + '<br/>' : '') +
              (biz.email ? 'Email: ' + esc(biz.email) + '<br/>' : '') +
              (biz.website ? 'Website: <a href="' + esc(biz.website) + '" target="_blank" rel="noopener">' + esc(biz.website) + '</a><br/>' : '') +
              (biz.previewUrl ? 'Preview: <a href="' + esc(biz.previewUrl) + '" target="_blank" rel="noopener">open</a>' : 'Preview: not yet') +
            '</div>' +
            '<div class="actions">' +
              (actions.call ? '<a class="btn primary" href="' + esc(actions.call) + '">Call</a>' : '<span class="btn primary disabled">Call</span>') +
              (actions.text ? '<a class="btn" href="' + esc(actions.text) + '">Text w/ Preview</a>' : '<span class="btn disabled">Text w/ Preview</span>') +
              (actions.email ? '<a class="btn" href="' + esc(actions.email) + '">Email w/ Preview</a>' : '<span class="btn disabled">Email w/ Preview</span>') +
              (actions.preview ? '<a class="btn success" href="' + esc(actions.preview) + '" target="_blank" rel="noopener">Open Preview</a>' : '<span class="btn success disabled">Open Preview</span>') +
              (actions.offer ? '<a class="btn warn" href="' + esc(actions.offer) + '" target="_blank" rel="noopener">Open Offer</a>' : '<span class="btn warn disabled">Open Offer</span>') +
            '</div>' +
            '<div class="status-row">' + statusChips(biz) + '</div>' +
          '</article>';
        }).join("");
      }

      async function loadBusinesses() {
        var response = await fetch("/api/public/outreach/businesses?" + queryParams().toString());
        var payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Failed to load businesses");
        renderList(payload);
      }

      async function updateStatus(businessId, status) {
        var response = await fetch("/api/public/outreach/businesses/" + encodeURIComponent(businessId) + "/status", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: status })
        });
        var payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Failed to update status");
        await loadBusinesses();
      }

      function scheduleLoad() {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(function () {
          loadBusinesses().catch(function (err) {
            document.getElementById("businessList").innerHTML = '<div class="empty">' + esc(err.message) + '</div>';
          });
        }, 250);
      }

      ["search"].forEach(function (id) {
        document.getElementById(id).addEventListener("input", scheduleLoad);
      });
      ["city", "industry", "status", "hasPreview", "hasPhone", "notContacted"].forEach(function (id) {
        document.getElementById(id).addEventListener("change", scheduleLoad);
      });

      document.getElementById("businessList").addEventListener("click", function (event) {
        var chip = event.target.closest(".status-chip");
        if (!chip) return;
        var businessId = chip.getAttribute("data-business-id");
        var status = chip.getAttribute("data-status-value");
        if (!businessId || !status) return;
        chip.disabled = true;
        updateStatus(businessId, status).catch(function (err) {
          alert(err.message);
        }).finally(function () {
          chip.disabled = false;
        });
      });

      loadBusinesses().catch(function (err) {
        document.getElementById("businessList").innerHTML = '<div class="empty">' + esc(err.message) + '</div>';
      });
    })();
  </script>
</body>
</html>`;
}
