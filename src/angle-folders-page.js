import { getQualifiedBusiness } from "./stage1/qualified-business-store.js";
import { listQualifiedBusinesses } from "./stage1/qualified-business-store.js";
import { trulyHasNoWebsite } from "./stage1/website-presence.js";
import { publicBaseUrl } from "./v7/shared.js";
import { ANGLE_FOLDERS, folderLabel } from "./angle-analysis/categories.js";
import { listAngleAnalyses, getAngleAnalysis, getAngleAnalysisStore } from "./angle-analysis/store.js";
import { analyzeBusinessRecord } from "./angle-analysis/analyzer.js";
import { getBatchState, startReanalyzeBatch } from "./angle-analysis/reanalyze-batch.js";
import { defaultFollowUpText, defaultEmailBody, defaultEmailSubject } from "./sales-brief/outreach-copy.js";

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function buildAngleFolderSummary() {
  const [analyses, records] = await Promise.all([listAngleAnalyses(), listQualifiedBusinesses()]);
  const recordMap = new Map(records.map((row) => [row.id, row]));
  const byFolder = new Map(ANGLE_FOLDERS.map((f) => [f.key, []]));

  for (const row of analyses) {
    let key = byFolder.has(row.folder) ? row.folder : "unknown";
    if (key === "no_website") {
      const record = recordMap.get(row.businessId);
      if (record && !trulyHasNoWebsite(record)) continue;
    }
    byFolder.get(key).push(row);
  }

  const folders = ANGLE_FOLDERS.map((folder) => {
    const rows = byFolder.get(folder.key) ?? [];
    const avgConfidence =
      rows.length > 0
        ? Math.round(rows.reduce((sum, r) => sum + (r.confidence_score || 0), 0) / rows.length)
        : 0;
    const topFive = [...rows]
      .sort((a, b) => (b.priority_score || 0) - (a.priority_score || 0))
      .slice(0, 5);

    return {
      key: folder.key,
      label: folder.label,
      count: rows.length,
      avgConfidence,
      outreachPriority: folder.outreachPriority,
      topBusinesses: topFive.map((r) => ({
        businessId: r.businessId,
        business_name: r.business_name,
        city: r.city,
        priority_label: r.priority_label,
        priority_score: r.priority_score,
        confidence_score: r.confidence_score,
        primary_angle: r.primary_angle,
      })),
    };
  });

  const store = await getAngleAnalysisStore();
  return {
    folders,
    totalAnalyzed: analyses.length,
    lastBatchRun: store.lastBatchRun,
    batch: getBatchState(),
  };
}

export async function listBusinessesInFolder(folderKey) {
  const [analyses, records] = await Promise.all([listAngleAnalyses(), listQualifiedBusinesses()]);
  const recordMap = new Map(records.map((row) => [row.id, row]));
  const rows = analyses
    .filter((row) => row.folder === folderKey)
    .filter((row) => {
      if (folderKey !== "no_website") return true;
      const record = recordMap.get(row.businessId);
      return !record || trulyHasNoWebsite(record);
    })
    .sort((a, b) => (b.priority_score || 0) - (a.priority_score || 0));

  return {
    folder: folderKey,
    label: folderLabel(folderKey),
    count: rows.length,
    businesses: rows,
  };
}

export function buildOutreachMessage(analysis) {
  return {
    opening: analysis.suggested_opening_line,
    deflection: analysis.suggested_deflection_response,
    emergencyQuestion: analysis.emergency_question,
    offer: analysis.suggested_offer_line,
    followUpText: defaultFollowUpText(
      { businessName: analysis.business_name, previewUrl: analysis.previewUrl },
      analysis.previewUrl,
    ),
    emailSubject: defaultEmailSubject({ businessName: analysis.business_name }),
    emailBody: defaultEmailBody({ businessName: analysis.business_name }, analysis.previewUrl),
    callScript: [
      `Opening: ${analysis.suggested_opening_line}`,
      `If deflected: ${analysis.suggested_deflection_response}`,
      `Emergency: ${analysis.emergency_question}`,
      `After discovery offer: ${analysis.suggested_offer_line}`,
    ].join("\n\n"),
  };
}

export function registerAngleFolderRoutes(app) {
  app.get("/api/public/angle-folders/summary", async (_req, res) => {
    try {
      return res.json(await buildAngleFolderSummary());
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/public/angle-folders/reanalyze/status", (_req, res) => {
    return res.json(getBatchState());
  });

  app.post("/api/public/angle-folders/reanalyze", async (req, res) => {
    try {
      const fetchLive = Boolean(req.body?.fetchLive);
      startReanalyzeBatch({ fetchLive }).catch(() => {});
      return res.json({ ok: true, batch: getBatchState() });
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  });

  app.get("/api/public/angle-folders/folder/:folderKey", async (req, res) => {
    try {
      return res.json(await listBusinessesInFolder(req.params.folderKey));
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/public/angle-folders/business/:id", async (req, res) => {
    try {
      const analysis = await getAngleAnalysis(req.params.id);
      const record = await getQualifiedBusiness(req.params.id);
      if (!analysis && !record) return res.status(404).json({ error: "Business not found" });

      let resolved = analysis;
      if (!resolved && record) {
        resolved = await analyzeBusinessRecord(record);
      }

      const baseUrl = publicBaseUrl(req);
      const previewUrl =
        record?.previewUrl ||
        (record?.opportunityProjectId ? `${baseUrl}/p/${record.opportunityProjectId}` : "");

      return res.json({
        analysis: { ...resolved, previewUrl },
        record: record
          ? {
              id: record.id,
              outreachStatus: record.outreachStatus,
              opportunityProjectId: record.opportunityProjectId,
              previewUrl,
              launchUrl: record.launchUrl,
            }
          : null,
        outreachMessage: buildOutreachMessage({ ...resolved, previewUrl }),
      });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/public/angle-folders/business/:id/analyze", async (req, res) => {
    try {
      const record = await getQualifiedBusiness(req.params.id);
      if (!record) return res.status(404).json({ error: "Business not found" });
      const analysis = await analyzeBusinessRecord(record, {
        fetchLive: Boolean(req.body?.fetchLive),
        loadScreenshots: true,
      });
      const { upsertAngleAnalysis } = await import("./angle-analysis/store.js");
      await upsertAngleAnalysis(record.id, analysis);
      return res.json(analysis);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/public/angle-folders/business/:id/outreach-message", async (req, res) => {
    try {
      const analysis = await getAngleAnalysis(req.params.id);
      if (!analysis) return res.status(404).json({ error: "Run analysis first" });
      return res.json(buildOutreachMessage(analysis));
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });
}

export function renderAngleFoldersPage() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Angle Folders — WebLab</title>
  <style>
    :root { color-scheme: dark; font-family: "Segoe UI", system-ui, sans-serif; }
    body { margin: 0; background: #0b1220; color: #e9f0ff; }
    .wrap { max-width: 980px; margin: 0 auto; padding: 16px 12px 56px; }
    .card { background: #121a2b; border: 1px solid rgba(255,255,255,0.09); border-radius: 16px; padding: 14px; margin-bottom: 12px; }
    h1 { margin: 0 0 6px; font-size: 24px; }
    h2 { margin: 0 0 8px; font-size: 16px; }
    .muted { color: #b7c6e5; font-size: 14px; line-height: 1.45; }
    .nav { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 10px; }
    .nav a { color: #8ec5ff; text-decoration: none; font-size: 14px; }
    .btn {
      display: inline-block; background: #355f9e; color: #fff; border: none; border-radius: 10px;
      padding: 10px 14px; font-size: 14px; font-weight: 600; cursor: pointer; text-decoration: none;
    }
    .btn.secondary { background: #1a2438; border: 1px solid rgba(255,255,255,0.12); }
    .btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .folder-grid { display: grid; gap: 10px; margin-top: 12px; }
    .folder {
      background: #1a2438; border: 1px solid rgba(255,255,255,0.09); border-radius: 14px;
      padding: 12px; cursor: pointer;
    }
    .folder:hover { border-color: rgba(142,197,255,0.35); }
    .folder.active { border-color: #8ec5ff; }
    .folder-head { display: flex; justify-content: space-between; gap: 8px; align-items: flex-start; }
    .folder-head strong { font-size: 15px; line-height: 1.3; }
    .count { font-size: 12px; color: #8ec5ff; white-space: nowrap; }
    .meta { font-size: 12px; color: #b7c6e5; margin-top: 6px; }
    .table-wrap { overflow-x: auto; margin-top: 10px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { text-align: left; padding: 8px 6px; border-bottom: 1px solid rgba(255,255,255,0.08); vertical-align: top; }
    th { color: #b7c6e5; font-weight: 600; }
    .pill { display: inline-block; padding: 3px 8px; border-radius: 999px; font-size: 11px; font-weight: 700; background: #355f9e; }
    .pill.hot { background: #c45c26; }
    .pill.warm { background: #8a6d1d; }
    .pill.nurture { background: #355f9e; }
    .pill.manual { background: #5a5a5a; }
    .actions { display: flex; flex-wrap: wrap; gap: 6px; }
    .mini { padding: 6px 8px; font-size: 12px; border-radius: 8px; }
    .detail { display: none; margin-top: 12px; background: #0f1730; border-radius: 12px; padding: 12px; }
    .detail.open { display: block; }
    .detail pre { white-space: pre-wrap; word-break: break-word; font-size: 13px; color: #dbe7ff; }
    .progress { height: 8px; background: #1a2438; border-radius: 999px; overflow: hidden; margin-top: 8px; }
    .progress > span { display: block; height: 100%; background: #8ec5ff; width: 0%; transition: width 0.2s; }
    .summary-pills { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
    .summary-pills span { background: #1a2438; border-radius: 999px; padding: 6px 10px; font-size: 12px; color: #b7c6e5; }
  </style>
</head>
<body>
  <main class="wrap">
    <section class="card">
      <h1>Angle Folders</h1>
      <p class="muted">Sales execution view — why contact, what problem, what offer, what to say first.</p>
      <div class="nav">
        <a href="/">← Founder OS</a>
        <a href="/outreach">Outreach Queue</a>
      </div>
      <div style="margin-top:12px; display:flex; flex-wrap:wrap; gap:8px; align-items:center;">
        <button type="button" class="btn" id="reanalyzeBtn">Reanalyze All Businesses</button>
        <span class="muted" id="batchStatus">Ready</span>
      </div>
      <div class="progress"><span id="batchBar"></span></div>
      <div class="summary-pills" id="batchSummary"></div>
    </section>

    <section class="card">
      <h2>Folders</h2>
      <div class="folder-grid" id="folderGrid"><p class="muted">Loading…</p></div>
    </section>

    <section class="card" id="folderDetailSection" style="display:none;">
      <h2 id="folderDetailTitle">Folder</h2>
      <p class="muted" id="folderDetailMeta"></p>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Business</th>
              <th>City</th>
              <th>Angle</th>
              <th>Priority</th>
              <th>Conf.</th>
              <th>Opening</th>
              <th>Next</th>
              <th></th>
            </tr>
          </thead>
          <tbody id="folderTableBody"></tbody>
        </table>
      </div>
    </section>

    <section class="card detail" id="analysisDetail">
      <h2 id="detailTitle">Analysis</h2>
      <div id="detailBody"></div>
    </section>
  </main>
  <script>
    var activeFolder = null;

    function esc(s) {
      return String(s ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
    }

    function pillClass(label) {
      var v = String(label || "").toLowerCase();
      if (v === "hot") return "pill hot";
      if (v === "warm") return "pill warm";
      if (v === "nurture") return "pill nurture";
      return "pill manual";
    }

    async function jsonFetch(url, opts) {
      var res = await fetch(url, opts);
      var data = await res.json();
      if (!res.ok) throw new Error(data.error || res.statusText);
      return data;
    }

    function renderFolders(data) {
      var grid = document.getElementById("folderGrid");
      if (!data.folders.length) {
        grid.innerHTML = '<p class="muted">No analyses yet. Click Reanalyze All Businesses.</p>';
        return;
      }
      grid.innerHTML = data.folders.map(function(f) {
        return '<div class="folder" data-folder="' + esc(f.key) + '">' +
          '<div class="folder-head"><strong>' + esc(f.label) + '</strong><span class="count">' + f.count + '</span></div>' +
          '<div class="meta">Avg confidence ' + f.avgConfidence + '% · Priority ' + f.outreachPriority + '</div>' +
          (f.topBusinesses[0] ? '<div class="meta">Top: ' + esc(f.topBusinesses[0].business_name) + '</div>' : '') +
        '</div>';
      }).join("");
      grid.querySelectorAll(".folder").forEach(function(el) {
        el.addEventListener("click", function() { openFolder(el.dataset.folder); });
      });
    }

    async function openFolder(key) {
      activeFolder = key;
      document.querySelectorAll(".folder").forEach(function(el) {
        el.classList.toggle("active", el.dataset.folder === key);
      });
      var data = await jsonFetch("/api/public/angle-folders/folder/" + encodeURIComponent(key));
      document.getElementById("folderDetailSection").style.display = "block";
      document.getElementById("folderDetailTitle").textContent = data.label;
      document.getElementById("folderDetailMeta").textContent = data.count + " businesses in this folder";
      var tbody = document.getElementById("folderTableBody");
      tbody.innerHTML = data.businesses.map(function(b) {
        return '<tr>' +
          '<td><strong>' + esc(b.business_name) + '</strong><br/><span class="muted">' + esc(b.industry) + '</span></td>' +
          '<td>' + esc(b.city) + '</td>' +
          '<td>' + esc(b.primary_angle) + '</td>' +
          '<td><span class="' + pillClass(b.priority_label) + '">' + esc(b.priority_label) + '</span><br/>' + (b.priority_score || 0) + '</td>' +
          '<td>' + (b.confidence_score || 0) + '</td>' +
          '<td style="max-width:180px;">' + esc(b.suggested_opening_line) + '</td>' +
          '<td style="max-width:160px;">' + esc(b.next_action) + '</td>' +
          '<td><div class="actions">' +
            '<button type="button" class="btn mini secondary" data-view="' + esc(b.businessId) + '">Analysis</button>' +
            '<button type="button" class="btn mini secondary" data-msg="' + esc(b.businessId) + '">Outreach</button>' +
            '<button type="button" class="btn mini secondary" data-mock="' + esc(b.businessId) + '">Mockup</button>' +
          '</div></td></tr>';
      }).join("");
      tbody.querySelectorAll("[data-view]").forEach(function(btn) {
        btn.addEventListener("click", function() { openAnalysis(btn.dataset.view); });
      });
      tbody.querySelectorAll("[data-msg]").forEach(function(btn) {
        btn.addEventListener("click", function() { openOutreach(btn.dataset.msg); });
      });
      tbody.querySelectorAll("[data-mock]").forEach(function(btn) {
        btn.addEventListener("click", function() { openMockup(btn.dataset.mock); });
      });
    }

    async function openAnalysis(id) {
      var data = await jsonFetch("/api/public/angle-folders/business/" + encodeURIComponent(id));
      var a = data.analysis;
      var el = document.getElementById("analysisDetail");
      el.classList.add("open");
      document.getElementById("detailTitle").textContent = a.business_name;
      document.getElementById("detailBody").innerHTML =
        '<p><strong>Problem:</strong> ' + esc(a.detected_problem) + '</p>' +
        '<p><strong>Angle:</strong> ' + esc(a.primary_angle) + '</p>' +
        '<p><strong>Offer:</strong> ' + esc(a.recommended_offer) + '</p>' +
        '<p><strong>Why:</strong> ' + esc(a.reason_for_angle) + '</p>' +
        '<p><strong>Folder:</strong> ' + esc(a.folder_label) + ' · Confidence ' + a.confidence_score + '% · Priority ' + esc(a.priority_label) + '</p>' +
        '<p><strong>Opening:</strong> ' + esc(a.suggested_opening_line) + '</p>' +
        '<p><strong>Deflection:</strong> ' + esc(a.suggested_deflection_response) + '</p>' +
        '<p><strong>Emergency Q:</strong> ' + esc(a.emergency_question) + '</p>' +
        '<p><strong>Next action:</strong> ' + esc(a.next_action) + '</p>' +
        (data.record && data.record.previewUrl ? '<p><a class="btn mini" href="' + esc(data.record.previewUrl) + '" target="_blank" rel="noopener">Open Preview</a></p>' : '');
    }

    async function openOutreach(id) {
      var data = await jsonFetch("/api/public/angle-folders/business/" + encodeURIComponent(id));
      var m = data.outreachMessage;
      var el = document.getElementById("analysisDetail");
      el.classList.add("open");
      document.getElementById("detailTitle").textContent = "Outreach — " + data.analysis.business_name;
      document.getElementById("detailBody").innerHTML = '<pre>' + esc(m.callScript) + '</pre>';
    }

    async function openMockup(id) {
      var data = await jsonFetch("/api/public/angle-folders/business/" + encodeURIComponent(id));
      if (data.record && data.record.previewUrl) {
        window.open(data.record.previewUrl, "_blank");
        return;
      }
      alert("No mockup yet. Generate a preview from Founder OS first.");
    }

    async function refreshSummary() {
      var data = await jsonFetch("/api/public/angle-folders/summary");
      renderFolders(data);
      if (data.lastBatchRun) {
        var s = data.lastBatchRun;
        document.getElementById("batchSummary").innerHTML =
          '<span>Analyzed ' + s.totalAnalyzed + '</span>' +
          '<span>Manual review ' + s.totalManualReview + '</span>' +
          (s.topFolderByCount ? '<span>Top folder: ' + esc(s.topFolderByCount.label) + ' (' + s.topFolderByCount.count + ')</span>' : '');
      }
      if (activeFolder) openFolder(activeFolder);
    }

    async function pollBatch() {
      var batch = await jsonFetch("/api/public/angle-folders/reanalyze/status");
      var pct = batch.total ? Math.round((batch.processed / batch.total) * 100) : 0;
      document.getElementById("batchBar").style.width = pct + "%";
      document.getElementById("batchStatus").textContent = batch.running
        ? ("Analyzing " + batch.processed + " / " + batch.total)
        : (batch.summary ? "Complete" : "Ready");
      document.getElementById("reanalyzeBtn").disabled = batch.running;
      if (batch.running) {
        setTimeout(pollBatch, 1500);
      } else if (batch.summary) {
        await refreshSummary();
      }
    }

    document.getElementById("reanalyzeBtn").addEventListener("click", async function() {
      try {
        await jsonFetch("/api/public/angle-folders/reanalyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
        pollBatch();
      } catch (err) {
        alert(err.message);
      }
    });

    refreshSummary().catch(function(err) { document.getElementById("folderGrid").innerHTML = '<p class="muted">' + esc(err.message) + '</p>'; });
  </script>
</body>
</html>`;
}
