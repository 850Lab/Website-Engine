import { cleanText, nowIso } from "../stage1/shared.js";
import {
  getQualifiedBusiness,
  upsertQualifiedBusiness,
  normalizeOutreachStatus,
  OUTREACH_STATUSES,
} from "../stage1/qualified-business-store.js";
import { OUTREACH_STATUS_LABELS } from "../outreach-page.js";
import {
  buildSalesQueue,
  getNextLeadId,
  getQueueStats,
  getSalesLeadById,
} from "./sales-queue.js";

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function updateSalesOutcome(businessId, status) {
  const nextStatus = normalizeOutreachStatus(status);
  if (!OUTREACH_STATUSES.includes(nextStatus)) {
    throw new Error(`Invalid outcome: ${status}`);
  }
  const record = await getQualifiedBusiness(businessId);
  if (!record) throw new Error("Business not found");

  const updated = {
    ...record,
    outreachStatus: nextStatus,
    outreachStatusUpdatedAt: nowIso(),
  };
  await upsertQualifiedBusiness(updated);

  return {
    id: updated.id,
    outreachStatus: nextStatus,
    outreachStatusLabel: OUTREACH_STATUS_LABELS[nextStatus],
  };
}

export async function appendSalesNote(businessId, text) {
  const noteText = cleanText(text);
  if (!noteText) throw new Error("Note cannot be empty.");

  const record = await getQualifiedBusiness(businessId);
  if (!record) throw new Error("Business not found");

  const salesNotes = Array.isArray(record.salesNotes) ? [...record.salesNotes] : [];
  salesNotes.push({ at: nowIso(), text: noteText });

  const updated = { ...record, salesNotes };
  await upsertQualifiedBusiness(updated);

  return salesNotes.slice(-5).reverse();
}

export function registerSalesModeRoutes(app) {
  app.get("/api/mission-control/sales/queue", async (req, res) => {
    try {
      const queue = await buildSalesQueue(req, {
        phoneOnly: req.query.phoneOnly !== "0",
        qualifiedOnly: req.query.qualifiedOnly === "1",
        excludeClosed: req.query.excludeClosed !== "0",
        folder: req.query.folder,
        priority: req.query.priority,
      });
      return res.json({
        stats: getQueueStats(queue),
        queue: queue.map((row) => ({ id: row.id, businessName: row.businessName, priorityLabel: row.priorityLabel })),
      });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/mission-control/sales/lead/:id", async (req, res) => {
    try {
      const lead = await getSalesLeadById(req, req.params.id);
      if (!lead) return res.status(404).json({ error: "Lead not found" });
      const queue = await buildSalesQueue(req, { excludeClosed: true });
      const nextId = getNextLeadId(queue, req.params.id);
      return res.json({ lead, nextId, stats: getQueueStats(queue) });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/mission-control/sales/next", async (req, res) => {
    try {
      const queue = await buildSalesQueue(req, { excludeClosed: true });
      const after = cleanText(req.query.after);
      const nextId = getNextLeadId(queue, after || null);
      if (!nextId) return res.json({ lead: null, stats: getQueueStats(queue) });
      const lead = await getSalesLeadById(req, nextId);
      return res.json({ lead, nextId: getNextLeadId(queue, nextId), stats: getQueueStats(queue) });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.patch("/api/mission-control/sales/lead/:id/outcome", async (req, res) => {
    try {
      const result = await updateSalesOutcome(req.params.id, req.body?.status);
      return res.json(result);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  });

  app.post("/api/mission-control/sales/lead/:id/note", async (req, res) => {
    try {
      const notes = await appendSalesNote(req.params.id, req.body?.text);
      return res.json({ notes });
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  });
}

export function renderSalesModePage() {
  const outcomeButtons = OUTREACH_STATUSES.map(
    (id) =>
      `<button type="button" class="outcome-btn" data-outcome="${id}">${OUTREACH_STATUS_LABELS[id]}</button>`,
  ).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="theme-color" content="#ffffff" />
  <title>Sales Mode — Mission Control</title>
  <style>
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; height: 100%; background: #fff; color: #000; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif; }
    body { display: flex; flex-direction: column; min-height: 100dvh; }
    .top {
      flex-shrink: 0;
      padding: 14px 16px 10px;
      border-bottom: 2px solid #000;
      background: #fff;
      padding-top: max(14px, env(safe-area-inset-top));
    }
    .top-row { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
    .brand { font-size: 13px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; }
    .count { font-size: 13px; font-weight: 600; }
    .stats { font-size: 12px; color: #444; margin-top: 4px; }
    .main {
      flex: 1;
      overflow-y: auto;
      padding: 16px 16px 120px;
      -webkit-overflow-scrolling: touch;
    }
    .empty { padding: 40px 16px; text-align: center; font-size: 16px; line-height: 1.5; color: #333; }
    .lead-name { font-size: 28px; font-weight: 800; line-height: 1.15; margin: 0 0 6px; letter-spacing: -0.02em; }
    .lead-meta { font-size: 15px; color: #333; margin-bottom: 14px; }
    .tags { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }
    .tag {
      border: 2px solid #000;
      border-radius: 999px;
      padding: 4px 10px;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }
    .tag.hot { background: #000; color: #fff; }
    .block {
      border: 2px solid #000;
      border-radius: 12px;
      padding: 12px 14px;
      margin-bottom: 12px;
      background: #fff;
    }
    .block-label {
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: #555;
      margin-bottom: 6px;
    }
    .block-body { font-size: 15px; line-height: 1.45; }
    .script { font-size: 16px; line-height: 1.5; font-weight: 500; }
    .notes-list { margin: 0; padding: 0; list-style: none; }
    .notes-list li { font-size: 14px; line-height: 1.4; padding: 8px 0; border-bottom: 1px solid #ddd; }
    .notes-list li:last-child { border-bottom: none; }
    .note-time { font-size: 11px; color: #666; display: block; margin-bottom: 2px; }
    .dock {
      position: fixed;
      left: 0; right: 0; bottom: 0;
      background: #fff;
      border-top: 2px solid #000;
      padding: 10px 10px max(10px, env(safe-area-inset-bottom));
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 8px;
      z-index: 20;
    }
    .dock-btn {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 4px;
      min-height: 56px;
      border: 2px solid #000;
      border-radius: 12px;
      background: #fff;
      color: #000;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.03em;
      text-transform: uppercase;
      text-decoration: none;
      cursor: pointer;
      padding: 6px 4px;
      -webkit-tap-highlight-color: transparent;
    }
    .dock-btn.primary { background: #000; color: #fff; }
    .dock-btn:disabled, .dock-btn.disabled { opacity: 0.35; pointer-events: none; }
    .dock-icon { font-size: 18px; line-height: 1; }
    .sheet {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.45);
      z-index: 30;
      align-items: flex-end;
    }
    .sheet.open { display: flex; }
    .sheet-panel {
      width: 100%;
      background: #fff;
      border-top: 2px solid #000;
      border-radius: 16px 16px 0 0;
      padding: 16px 16px max(20px, env(safe-area-inset-bottom));
      max-height: 70dvh;
      overflow-y: auto;
    }
    .sheet-title { font-size: 18px; font-weight: 800; margin: 0 0 12px; }
    .outcome-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .outcome-btn {
      min-height: 48px;
      border: 2px solid #000;
      border-radius: 10px;
      background: #fff;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
    }
    .outcome-btn.active { background: #000; color: #fff; }
    .note-input {
      width: 100%;
      min-height: 100px;
      border: 2px solid #000;
      border-radius: 10px;
      padding: 12px;
      font-size: 16px;
      font-family: inherit;
      resize: vertical;
      margin-bottom: 10px;
    }
    .sheet-actions { display: flex; gap: 8px; }
    .sheet-actions button {
      flex: 1;
      min-height: 48px;
      border: 2px solid #000;
      border-radius: 10px;
      font-size: 15px;
      font-weight: 800;
      cursor: pointer;
    }
    .sheet-actions .save { background: #000; color: #fff; }
    .sheet-actions .cancel { background: #fff; color: #000; }
    .hidden { display: none !important; }
  </style>
</head>
<body>
  <header class="top">
    <div class="top-row">
      <div class="brand">Mission Control · Sales</div>
      <div class="count" id="leadCount">—</div>
    </div>
    <div class="stats" id="leadStats">Loading queue…</div>
  </header>

  <main class="main" id="main">
    <div class="empty" id="loading">Loading next lead…</div>
    <div id="leadView" class="hidden"></div>
  </main>

  <nav class="dock" id="dock">
    <a class="dock-btn primary" id="callBtn" href="#"><span class="dock-icon">C</span>Call</a>
    <a class="dock-btn" id="textBtn" href="#"><span class="dock-icon">T</span>Text</a>
    <button type="button" class="dock-btn" id="outcomeBtn"><span class="dock-icon">O</span>Outcome</button>
    <button type="button" class="dock-btn" id="noteBtn"><span class="dock-icon">N</span>Note</button>
    <button type="button" class="dock-btn primary" id="nextBtn"><span class="dock-icon">›</span>Next</button>
  </nav>

  <div class="sheet" id="outcomeSheet">
    <div class="sheet-panel">
      <h2 class="sheet-title">Update outcome</h2>
      <div class="outcome-grid">${outcomeButtons}</div>
      <div class="sheet-actions" style="margin-top:12px;">
        <button type="button" class="cancel" id="outcomeCancel">Close</button>
      </div>
    </div>
  </div>

  <div class="sheet" id="noteSheet">
    <div class="sheet-panel">
      <h2 class="sheet-title">Add note</h2>
      <textarea class="note-input" id="noteInput" placeholder="What happened on the call?"></textarea>
      <div class="sheet-actions">
        <button type="button" class="cancel" id="noteCancel">Cancel</button>
        <button type="button" class="save" id="noteSave">Save note</button>
      </div>
    </div>
  </div>

  <script>
    var currentLead = null;
    var nextLeadId = null;

    function esc(s) {
      return String(s ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
    }

    function formatTime(iso) {
      try {
        return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
      } catch (e) { return iso || ""; }
    }

    function tagClass(label) {
      return label === "Hot" ? "tag hot" : "tag";
    }

    function renderLead(lead) {
      var notes = (lead.salesNotes || []).map(function(n) {
        return '<li><span class="note-time">' + esc(formatTime(n.at)) + '</span>' + esc(n.text) + '</li>';
      }).join("");

      return '' +
        '<h1 class="lead-name">' + esc(lead.businessName) + '</h1>' +
        '<div class="lead-meta">' + esc(lead.city) + (lead.industry ? ' · ' + esc(lead.industry) : '') + '</div>' +
        '<div class="tags">' +
          '<span class="' + tagClass(lead.priorityLabel) + '">' + esc(lead.priorityLabel) + '</span>' +
          '<span class="tag">' + esc(lead.outreachStatusLabel) + '</span>' +
          (lead.folderLabel ? '<span class="tag">' + esc(lead.folderLabel) + '</span>' : '') +
        '</div>' +
        '<div class="block"><div class="block-label">Problem</div><div class="block-body">' + esc(lead.problem) + '</div></div>' +
        '<div class="block"><div class="block-label">Angle</div><div class="block-body">' + esc(lead.primaryAngle) + '</div></div>' +
        '<div class="block"><div class="block-label">Opening line</div><div class="block-body script">' + esc(lead.openingLine) + '</div></div>' +
        '<div class="block"><div class="block-label">If deflected</div><div class="block-body script">' + esc(lead.deflectionLine) + '</div></div>' +
        '<div class="block"><div class="block-label">Emergency question</div><div class="block-body script">' + esc(lead.emergencyQuestion) + '</div></div>' +
        '<div class="block"><div class="block-label">Offer (after discovery)</div><div class="block-body">' + esc(lead.recommendedOffer) + '</div></div>' +
        '<div class="block"><div class="block-label">Next action</div><div class="block-body">' + esc(lead.nextAction) + '</div></div>' +
        (notes ? '<div class="block"><div class="block-label">Notes</div><ul class="notes-list">' + notes + '</ul></div>' : '');
    }

    function updateDock(lead) {
      var callBtn = document.getElementById("callBtn");
      var textBtn = document.getElementById("textBtn");
      if (lead.actions.call) {
        callBtn.href = lead.actions.call;
        callBtn.classList.remove("disabled");
      } else {
        callBtn.href = "#";
        callBtn.classList.add("disabled");
      }
      if (lead.actions.text) {
        textBtn.href = lead.actions.text;
        textBtn.classList.remove("disabled");
      } else {
        textBtn.href = "#";
        textBtn.classList.add("disabled");
      }
      document.querySelectorAll(".outcome-btn").forEach(function(btn) {
        btn.classList.toggle("active", btn.dataset.outcome === lead.outreachStatus);
      });
    }

    function updateHeader(stats) {
      document.getElementById("leadCount").textContent = stats.total + " leads";
      document.getElementById("leadStats").textContent =
        stats.hot + " hot · " + stats.notContacted + " not contacted";
    }

    async function jsonFetch(url, opts) {
      var res = await fetch(url, opts);
      var data = await res.json();
      if (!res.ok) throw new Error(data.error || res.statusText);
      return data;
    }

    async function loadLead(id) {
      document.getElementById("loading").classList.remove("hidden");
      document.getElementById("leadView").classList.add("hidden");
      var url = id
        ? "/api/mission-control/sales/lead/" + encodeURIComponent(id)
        : "/api/mission-control/sales/next";
      var data = await jsonFetch(url);
      currentLead = data.lead;
      nextLeadId = data.nextId;
      if (!currentLead) {
        document.getElementById("loading").textContent = "No leads with phone numbers in queue.";
        document.getElementById("leadView").classList.add("hidden");
        return;
      }
      document.getElementById("loading").classList.add("hidden");
      document.getElementById("leadView").classList.remove("hidden");
      document.getElementById("leadView").innerHTML = renderLead(currentLead);
      updateDock(currentLead);
      updateHeader(data.stats || { total: 0, hot: 0, notContacted: 0 });
      try { localStorage.setItem("salesModeLeadId", currentLead.id); } catch (e) {}
    }

    async function saveOutcome(status) {
      if (!currentLead) return;
      await jsonFetch("/api/mission-control/sales/lead/" + encodeURIComponent(currentLead.id) + "/outcome", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: status })
      });
      currentLead.outreachStatus = status;
      document.getElementById("outcomeSheet").classList.remove("open");
      await loadLead(currentLead.id);
    }

    async function saveNote() {
      var text = document.getElementById("noteInput").value.trim();
      if (!text || !currentLead) return;
      await jsonFetch("/api/mission-control/sales/lead/" + encodeURIComponent(currentLead.id) + "/note", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text })
      });
      document.getElementById("noteInput").value = "";
      document.getElementById("noteSheet").classList.remove("open");
      await loadLead(currentLead.id);
    }

    document.getElementById("nextBtn").addEventListener("click", function() {
      loadLead(nextLeadId || null).catch(function(err) { alert(err.message); });
    });

    document.getElementById("outcomeBtn").addEventListener("click", function() {
      document.getElementById("outcomeSheet").classList.add("open");
    });
    document.getElementById("outcomeCancel").addEventListener("click", function() {
      document.getElementById("outcomeSheet").classList.remove("open");
    });
    document.querySelectorAll(".outcome-btn").forEach(function(btn) {
      btn.addEventListener("click", function() {
        saveOutcome(btn.dataset.outcome).catch(function(err) { alert(err.message); });
      });
    });

    document.getElementById("noteBtn").addEventListener("click", function() {
      document.getElementById("noteSheet").classList.add("open");
      document.getElementById("noteInput").focus();
    });
    document.getElementById("noteCancel").addEventListener("click", function() {
      document.getElementById("noteSheet").classList.remove("open");
    });
    document.getElementById("noteSave").addEventListener("click", function() {
      saveNote().catch(function(err) { alert(err.message); });
    });

    document.getElementById("outcomeSheet").addEventListener("click", function(e) {
      if (e.target === document.getElementById("outcomeSheet")) document.getElementById("outcomeSheet").classList.remove("open");
    });
    document.getElementById("noteSheet").addEventListener("click", function(e) {
      if (e.target === document.getElementById("noteSheet")) document.getElementById("noteSheet").classList.remove("open");
    });

    var savedId = null;
    try { savedId = localStorage.getItem("salesModeLeadId"); } catch (e) {}
    loadLead(savedId).catch(function(err) {
      document.getElementById("loading").textContent = err.message;
    });
  </script>
</body>
</html>`;
}
