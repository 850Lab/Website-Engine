import { cleanText, nowIso } from "../stage1/shared.js";
import {
  getQualifiedBusiness,
  upsertQualifiedBusiness,
  normalizeOutreachStatus,
  OUTREACH_STATUSES,
} from "../stage1/qualified-business-store.js";
import { OUTREACH_STATUS_LABELS } from "../outreach-page.js";
import {
  blobPersistenceEnabled,
  persistenceBackendLabel,
} from "../persistence/json-document-store.js";
import {
  buildSalesQueue,
  getNextLeadId,
  getQueueStats,
  getSalesLeadById,
} from "./sales-queue.js";
import { assignLeadToOperator } from "../operators/lead-assignment.js";
import { buildFocusQueueMeta } from "../outreach-focus/metrics.js";
import { getFocus, leadMatchesFocus } from "../outreach-focus/routes.js";

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function updateSalesOutcome(businessId, status, operator = null) {
  const nextStatus = normalizeOutreachStatus(status);
  if (!OUTREACH_STATUSES.includes(nextStatus)) {
    throw new Error(`Invalid outcome: ${status}`);
  }
  if (operator) {
    await assignLeadToOperator(businessId, operator);
  }
  const record = await getQualifiedBusiness(businessId);
  if (!record) throw new Error("Business not found");

  const updated = {
    ...record,
    outreachStatus: nextStatus,
    outreachStatusUpdatedAt: nowIso(),
    lastOperatorId: operator?.id ?? record.lastOperatorId ?? null,
    lastOperatorName: operator?.name ?? record.lastOperatorName ?? null,
  };
  await upsertQualifiedBusiness(updated);

  try {
    const { recordWebsiteFocusActivity } = await import("../outreach-focus/routes.js");
    await recordWebsiteFocusActivity({ business: updated, status: nextStatus });
  } catch {
    /* focus logging is best-effort */
  }

  return {
    id: updated.id,
    outreachStatus: nextStatus,
    outreachStatusLabel: OUTREACH_STATUS_LABELS[nextStatus],
  };
}

export async function appendSalesNote(businessId, text, operator = null) {
  const noteText = cleanText(text);
  if (!noteText) throw new Error("Note cannot be empty.");

  if (operator) {
    await assignLeadToOperator(businessId, operator);
  }
  const record = await getQualifiedBusiness(businessId);
  if (!record) throw new Error("Business not found");

  const salesNotes = Array.isArray(record.salesNotes) ? [...record.salesNotes] : [];
  salesNotes.push({
    at: nowIso(),
    text: noteText,
    operatorId: operator?.id ?? null,
    operatorName: operator?.name ?? null,
  });

  const updated = { ...record, salesNotes };
  await upsertQualifiedBusiness(updated);

  return salesNotes.slice(-5).reverse();
}

function queueFiltersFromQuery(req) {
  return {
    excludeClosed: req.query.excludeClosed !== "0",
    folder: req.query.folder,
    priority: req.query.priority,
    phoneOnly: req.query.phoneOnly !== "0",
    qualifiedOnly: req.query.qualifiedOnly === "1",
  };
}

export function registerSalesModeRoutes(app, { requireOperatorApi } = {}) {
  const auth = requireOperatorApi ?? ((_req, _res, next) => next());

  app.get("/api/mission-control/sales/queue", auth, async (req, res) => {
    try {
      const queue = await buildSalesQueue(req, queueFiltersFromQuery(req), req.operator);
      const focus = await buildFocusQueueMeta("website");
      return res.json({
        stats: getQueueStats(queue),
        queue: queue.map((row) => ({ id: row.id, businessName: row.businessName, priorityLabel: row.priorityLabel })),
        focus,
      });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/mission-control/sales/lead/:id", auth, async (req, res) => {
    try {
      const focus = await getFocus("website");
      const lead = await getSalesLeadById(req, req.params.id, req.operator, { claim: true });
      if (!lead) return res.status(404).json({ error: "Lead not found" });
      if (!leadMatchesFocus(lead, focus)) {
        return res.status(404).json({ error: "Lead not in current focus. Edit focus on Mission home or add matching leads." });
      }
      const queue = await buildSalesQueue(req, queueFiltersFromQuery(req), req.operator);
      const nextId = getNextLeadId(queue, req.params.id);
      const focusMeta = await buildFocusQueueMeta("website");
      return res.json({ lead, nextId, stats: getQueueStats(queue), focus: focusMeta });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/mission-control/sales/next", auth, async (req, res) => {
    try {
      const queue = await buildSalesQueue(req, queueFiltersFromQuery(req), req.operator);
      const after = cleanText(req.query.after);
      const nextId = getNextLeadId(queue, after || null);
      const focus = await buildFocusQueueMeta("website");
      if (!nextId) return res.json({ lead: null, stats: getQueueStats(queue), focus });
      const lead = await getSalesLeadById(req, nextId, req.operator, { claim: true });
      return res.json({ lead, nextId: getNextLeadId(queue, nextId), stats: getQueueStats(queue), focus });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.patch("/api/mission-control/sales/lead/:id/outcome", auth, async (req, res) => {
    try {
      const result = await updateSalesOutcome(req.params.id, req.body?.status, req.operator);
      return res.json(result);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  });

  app.post("/api/mission-control/sales/lead/:id/note", auth, async (req, res) => {
    try {
      const notes = await appendSalesNote(req.params.id, req.body?.text, req.operator);
      return res.json({ notes });
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  });

  app.get("/api/mission-control/sales/storage", auth, (_req, res) => {
    return res.json({
      backend: persistenceBackendLabel(),
      outcomesPersist: blobPersistenceEnabled(),
    });
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
  <meta name="apple-mobile-web-app-status-bar-style" content="default" />
  <meta name="theme-color" content="#ffffff" />
  <title>Sales Mode — Mission Control</title>
  <style>
    :root {
      --safe-top: env(safe-area-inset-top, 0px);
      --safe-bottom: env(safe-area-inset-bottom, 0px);
      --tap: 56px;
      --tap-lg: 64px;
      --radius: 14px;
      --border: 2px solid #000;
    }
    * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
    html, body {
      margin: 0; padding: 0; height: 100%;
      background: #fff; color: #000;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
      touch-action: manipulation;
    }
    body { display: flex; flex-direction: column; min-height: 100dvh; }

    .top {
      flex-shrink: 0;
      padding: calc(10px + var(--safe-top)) 16px 10px;
      border-bottom: var(--border);
      background: #fff;
    }
    .top-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
    }
    .brand {
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }
    .count {
      font-size: 13px;
      font-weight: 700;
      white-space: nowrap;
    }
    .stats {
      font-size: 13px;
      color: #444;
      margin-top: 4px;
      line-height: 1.35;
    }
    .storage-dot {
      display: inline-block;
      width: 8px; height: 8px;
      border-radius: 50%;
      margin-right: 6px;
      vertical-align: middle;
      background: #ccc;
    }
    .storage-dot.ok { background: #000; }
    .storage-dot.warn { background: #e00; }

    .main {
      flex: 1;
      overflow-y: auto;
      overflow-x: hidden;
      padding: 16px 16px calc(100px + var(--safe-bottom));
      -webkit-overflow-scrolling: touch;
    }
    .empty {
      padding: 48px 8px;
      text-align: center;
      font-size: 17px;
      line-height: 1.5;
      color: #333;
    }

    .lead-name {
      font-size: clamp(26px, 7vw, 34px);
      font-weight: 800;
      line-height: 1.1;
      margin: 0 0 8px;
      letter-spacing: -0.02em;
      word-break: break-word;
    }
    .lead-meta {
      font-size: 16px;
      color: #333;
      margin-bottom: 12px;
      line-height: 1.35;
    }
    .tags {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 16px;
    }
    .tag {
      border: var(--border);
      border-radius: 999px;
      padding: 6px 12px;
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.03em;
      text-transform: uppercase;
    }
    .tag.hot { background: #000; color: #fff; }

    .action-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin-bottom: 18px;
    }
    .action-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      min-height: var(--tap-lg);
      border: var(--border);
      border-radius: var(--radius);
      font-size: 18px;
      font-weight: 800;
      letter-spacing: 0.02em;
      text-decoration: none;
      color: #000;
      background: #fff;
      cursor: pointer;
      padding: 12px 16px;
      user-select: none;
    }
    .action-btn.primary {
      background: #000;
      color: #fff;
    }
    .action-btn.disabled {
      opacity: 0.3;
      pointer-events: none;
    }
    .action-btn:active:not(.disabled) {
      transform: scale(0.98);
    }
    .action-icon {
      font-size: 22px;
      line-height: 1;
    }

    .card {
      border: var(--border);
      border-radius: var(--radius);
      margin-bottom: 10px;
      background: #fff;
      overflow: hidden;
    }
    .card-static {
      padding: 14px 16px;
    }
    .card-label {
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #555;
      margin-bottom: 6px;
    }
    .card-body {
      font-size: 16px;
      line-height: 1.5;
    }
    .card-body.script {
      font-size: 17px;
      font-weight: 500;
      line-height: 1.55;
    }

    details.card {
      padding: 0;
    }
    details.card summary {
      list-style: none;
      cursor: pointer;
      padding: 14px 16px;
      font-size: 15px;
      font-weight: 800;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      min-height: var(--tap);
    }
    details.card summary::-webkit-details-marker { display: none; }
    details.card summary::after {
      content: "+";
      font-size: 20px;
      font-weight: 400;
      flex-shrink: 0;
    }
    details.card[open] summary::after { content: "−"; }
    details.card .card-inner {
      padding: 0 16px 14px;
      border-top: 1px solid #ddd;
    }
    details.card[open] summary {
      border-bottom: 1px solid #ddd;
    }

    .notes-list { margin: 0; padding: 0; list-style: none; }
    .notes-list li {
      font-size: 15px;
      line-height: 1.45;
      padding: 10px 0;
      border-bottom: 1px solid #eee;
    }
    .notes-list li:last-child { border-bottom: none; }
    .note-time {
      font-size: 12px;
      color: #666;
      display: block;
      margin-bottom: 4px;
    }

    .dock {
      position: fixed;
      left: 0; right: 0; bottom: 0;
      background: #fff;
      border-top: var(--border);
      padding: 10px 12px calc(10px + var(--safe-bottom));
      display: grid;
      grid-template-columns: 1fr 1fr 1.2fr;
      gap: 10px;
      z-index: 20;
      box-shadow: 0 -4px 24px rgba(0,0,0,0.06);
    }
    .dock-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: var(--tap-lg);
      border: var(--border);
      border-radius: var(--radius);
      background: #fff;
      color: #000;
      font-size: 16px;
      font-weight: 800;
      letter-spacing: 0.01em;
      cursor: pointer;
      padding: 12px 8px;
    }
    .dock-btn.primary {
      background: #000;
      color: #fff;
    }
    .dock-btn:active { transform: scale(0.98); }
    .dock-btn:disabled { opacity: 0.35; pointer-events: none; }

    .sheet {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.5);
      z-index: 30;
      align-items: flex-end;
    }
    .sheet.open { display: flex; }
    .sheet-panel {
      width: 100%;
      background: #fff;
      border-top: var(--border);
      border-radius: 20px 20px 0 0;
      padding: 20px 16px calc(20px + var(--safe-bottom));
      max-height: 85dvh;
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
    }
    .sheet-handle {
      width: 40px;
      height: 4px;
      background: #ccc;
      border-radius: 999px;
      margin: 0 auto 16px;
    }
    .sheet-title {
      font-size: 20px;
      font-weight: 800;
      margin: 0 0 16px;
    }
    .outcome-grid {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .outcome-btn {
      min-height: var(--tap-lg);
      border: var(--border);
      border-radius: var(--radius);
      background: #fff;
      font-size: 17px;
      font-weight: 700;
      cursor: pointer;
      padding: 14px 16px;
      text-align: left;
    }
    .outcome-btn:active { transform: scale(0.99); }
    .outcome-btn.active {
      background: #000;
      color: #fff;
    }
    .sheet-close {
      width: 100%;
      min-height: var(--tap);
      margin-top: 12px;
      border: var(--border);
      border-radius: var(--radius);
      background: #f5f5f5;
      font-size: 16px;
      font-weight: 700;
      cursor: pointer;
    }

    .note-input {
      width: 100%;
      min-height: 120px;
      border: var(--border);
      border-radius: var(--radius);
      padding: 14px 16px;
      font-size: 17px;
      font-family: inherit;
      line-height: 1.45;
      resize: none;
      margin-bottom: 12px;
    }
    .sheet-actions {
      display: grid;
      grid-template-columns: 1fr 1.4fr;
      gap: 10px;
    }
    .sheet-actions button {
      min-height: var(--tap-lg);
      border: var(--border);
      border-radius: var(--radius);
      font-size: 17px;
      font-weight: 800;
      cursor: pointer;
    }
    .sheet-actions .save { background: #000; color: #fff; }
    .sheet-actions .cancel { background: #fff; color: #000; }

    .toast {
      position: fixed;
      left: 50%;
      bottom: calc(90px + var(--safe-bottom));
      transform: translateX(-50%) translateY(12px);
      background: #000;
      color: #fff;
      padding: 12px 20px;
      border-radius: 999px;
      font-size: 15px;
      font-weight: 700;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.2s, transform 0.2s;
      z-index: 40;
      white-space: nowrap;
    }
    .toast.show {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }

    .hidden { display: none !important; }
    .busy { opacity: 0.6; pointer-events: none; }
  </style>
</head>
<body>
  <header class="top">
    <div class="top-row">
      <div class="brand">Sales Mode</div>
      <div class="count" id="leadCount">—</div>
    </div>
    <div class="stats" id="leadStats">Loading queue…</div>
    <div class="stats" id="storageLine"><span class="storage-dot" id="storageDot"></span><span id="storageText">Checking sync…</span></div>
  </header>

  <main class="main" id="main">
    <div class="empty" id="loading">Loading next lead…</div>
    <div id="leadView" class="hidden"></div>
  </main>

  <nav class="dock" id="dock">
    <button type="button" class="dock-btn" id="outcomeBtn">Outcome</button>
    <button type="button" class="dock-btn" id="noteBtn">Note</button>
    <button type="button" class="dock-btn primary" id="nextBtn">Next lead</button>
  </nav>

  <div class="toast" id="toast"></div>

  <div class="sheet" id="outcomeSheet">
    <div class="sheet-panel">
      <div class="sheet-handle"></div>
      <h2 class="sheet-title">Set outcome</h2>
      <div class="outcome-grid">${outcomeButtons}</div>
      <button type="button" class="sheet-close" id="outcomeCancel">Close</button>
    </div>
  </div>

  <div class="sheet" id="noteSheet">
    <div class="sheet-panel">
      <div class="sheet-handle"></div>
      <h2 class="sheet-title">Add note</h2>
      <textarea class="note-input" id="noteInput" placeholder="What happened on the call?" rows="4"></textarea>
      <div class="sheet-actions">
        <button type="button" class="cancel" id="noteCancel">Cancel</button>
        <button type="button" class="save" id="noteSave">Save note</button>
      </div>
    </div>
  </div>

  <script>
    var currentLead = null;
    var nextLeadId = null;
    var toastTimer = null;

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

    function showToast(msg) {
      var el = document.getElementById("toast");
      el.textContent = msg;
      el.classList.add("show");
      clearTimeout(toastTimer);
      toastTimer = setTimeout(function() { el.classList.remove("show"); }, 1800);
    }

    function setBusy(on) {
      document.body.classList.toggle("busy", on);
    }

    function renderLead(lead) {
      var notes = (lead.salesNotes || []).map(function(n) {
        return '<li><span class="note-time">' + esc(formatTime(n.at)) + '</span>' + esc(n.text) + '</li>';
      }).join("");

      var callClass = lead.actions.call ? "action-btn primary" : "action-btn primary disabled";
      var textClass = lead.actions.text ? "action-btn" : "action-btn disabled";
      var callHref = lead.actions.call || "#";
      var textHref = lead.actions.text || "#";

      return '' +
        '<h1 class="lead-name">' + esc(lead.businessName) + '</h1>' +
        '<div class="lead-meta">' + esc(lead.city) + (lead.industry ? ' · ' + esc(lead.industry) : '') + '</div>' +
        '<div class="tags">' +
          '<span class="' + tagClass(lead.priorityLabel) + '">' + esc(lead.priorityLabel) + '</span>' +
          '<span class="tag">' + esc(lead.outreachStatusLabel) + '</span>' +
          (lead.folderLabel ? '<span class="tag">' + esc(lead.folderLabel) + '</span>' : '') +
        '</div>' +
        '<div class="action-row">' +
          '<a class="' + callClass + '" id="callBtn" href="' + esc(callHref) + '"><span class="action-icon">📞</span> Call</a>' +
          '<a class="' + textClass + '" id="textBtn" href="' + esc(textHref) + '"><span class="action-icon">💬</span> Text</a>' +
        '</div>' +
        '<div class="card card-static">' +
          '<div class="card-label">Opening line</div>' +
          '<div class="card-body script">' + esc(lead.openingLine) + '</div>' +
        '</div>' +
        (function(){
          var qs=lead.discoveryQuestions||[];
          if(!qs.length) return '';
          var items=qs.slice(0,5).map(function(q,i){
            return '<div class="card-body script" style="margin-bottom:8px">'+(i+1)+'. '+esc(q)+'</div>';
          }).join('');
          return '<div class="card card-static">' +
            '<div class="card-label">Discovery Questions</div>' + items +
          '</div>';
        })() +
        '<div class="card card-static">' +
          '<div class="card-label">Offer</div>' +
          '<div class="card-body">' + esc(lead.recommendedOffer) + '</div>' +
        '</div>' +
        '<div class="card card-static">' +
          '<div class="card-label">Golden Question</div>' +
          '<div class="card-body script">' + esc(lead.goldenQuestion || '') + '</div>' +
        '</div>' +
        '<details class="card">' +
          '<summary>Problem &amp; angle</summary>' +
          '<div class="card-inner">' +
            '<div class="card-label">Problem</div>' +
            '<div class="card-body" style="margin-bottom:12px">' + esc(lead.problem) + '</div>' +
            '<div class="card-label">Angle</div>' +
            '<div class="card-body">' + esc(lead.primaryAngle) + '</div>' +
          '</div>' +
        '</details>' +
        '<details class="card">' +
          '<summary>If deflected</summary>' +
          '<div class="card-inner"><div class="card-body script">' + esc(lead.deflectionLine) + '</div></div>' +
        '</details>' +
        '<details class="card">' +
          '<summary>Emergency question</summary>' +
          '<div class="card-inner"><div class="card-body script">' + esc(lead.emergencyQuestion) + '</div></div>' +
        '</details>' +
        '<details class="card">' +
          '<summary>Offer &amp; next step</summary>' +
          '<div class="card-inner">' +
            '<div class="card-label">Next action</div>' +
            '<div class="card-body">' + esc(lead.nextAction) + '</div>' +
          '</div>' +
        '</details>' +
        (notes ? '<div class="card card-static"><div class="card-label">Notes</div><ul class="notes-list">' + notes + '</ul></div>' : '');
    }

    function syncOutcomeButtons(status) {
      document.querySelectorAll(".outcome-btn").forEach(function(btn) {
        btn.classList.toggle("active", btn.dataset.outcome === status);
      });
    }

    function updateHeader(stats) {
      document.getElementById("leadCount").textContent = stats.total + " leads";
      document.getElementById("leadStats").textContent =
        stats.hot + " hot · " + stats.notContacted + " not contacted";
    }

    function updateStoragePill(info) {
      var dot = document.getElementById("storageDot");
      var text = document.getElementById("storageText");
      if (!dot || !text || !info) return;
      if (info.outcomesPersist) {
        dot.className = "storage-dot ok";
        text.textContent = "Outcomes sync to cloud";
      } else {
        dot.className = "storage-dot warn";
        text.textContent = "Outcomes not saving — check Blob token";
      }
    }

    async function loadStorageStatus() {
      try {
        var info = await jsonFetch("/api/mission-control/sales/storage");
        updateStoragePill(info);
      } catch (e) {
        updateStoragePill({ outcomesPersist: false });
      }
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
        document.getElementById("dock").classList.add("hidden");
        return;
      }
      document.getElementById("dock").classList.remove("hidden");
      document.getElementById("loading").classList.add("hidden");
      document.getElementById("leadView").classList.remove("hidden");
      document.getElementById("leadView").innerHTML = renderLead(currentLead);
      syncOutcomeButtons(currentLead.outreachStatus);
      updateHeader(data.stats || { total: 0, hot: 0, notContacted: 0 });
      try { localStorage.setItem("salesModeLeadId", currentLead.id); } catch (e) {}
      window.scrollTo(0, 0);
    }

    async function saveOutcome(status) {
      if (!currentLead) return;
      setBusy(true);
      try {
        await jsonFetch("/api/mission-control/sales/lead/" + encodeURIComponent(currentLead.id) + "/outcome", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: status })
        });
        document.getElementById("outcomeSheet").classList.remove("open");
        showToast("Outcome saved");
        await loadLead(currentLead.id);
      } finally {
        setBusy(false);
      }
    }

    async function saveNote() {
      var text = document.getElementById("noteInput").value.trim();
      if (!text || !currentLead) return;
      setBusy(true);
      try {
        await jsonFetch("/api/mission-control/sales/lead/" + encodeURIComponent(currentLead.id) + "/note", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: text })
        });
        document.getElementById("noteInput").value = "";
        document.getElementById("noteSheet").classList.remove("open");
        showToast("Note saved");
        await loadLead(currentLead.id);
      } finally {
        setBusy(false);
      }
    }

    document.getElementById("nextBtn").addEventListener("click", function() {
      setBusy(true);
      loadLead(nextLeadId || null)
        .catch(function(err) { alert(err.message); })
        .finally(function() { setBusy(false); });
    });

    document.getElementById("outcomeBtn").addEventListener("click", function() {
      syncOutcomeButtons(currentLead ? currentLead.outreachStatus : "");
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
      setTimeout(function() { document.getElementById("noteInput").focus(); }, 200);
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
    loadStorageStatus();
    loadLead(savedId).catch(function(err) {
      document.getElementById("loading").textContent = err.message;
    });
  </script>
</body>
</html>`;
}
