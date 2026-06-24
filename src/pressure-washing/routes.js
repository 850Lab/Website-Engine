import { cleanText } from "../stage1/shared.js";
import {
  appendPwNote,
  getActiveQueueLeads,
  getNextPwLeadId,
  listPwLeads,
  upsertPwLead,
  updatePwLeadStatus,
  mergePwLeadActions,
  refreshPwQueue,
} from "./lead-store.js";
import {
  buildPwDashboard,
  buildPwQueueHealth,
  buildPwQueueResponse,
  filterQueueByView,
  formatPwLeadForQueue,
} from "./metrics.js";
import { PW_QUICK_ACTIONS, getPwQuickAction, normalizePwStatus } from "./statuses.js";
import {
  buildPwFounderControl,
  loadPwSearchTargets,
} from "./founder-control.js";

function parseFollowUpAt(value) {
  const raw = cleanText(value);
  if (!raw) return null;
  const t = Date.parse(raw);
  if (Number.isNaN(t)) throw new Error("Invalid follow-up date");
  return new Date(t).toISOString();
}

function parseAmount(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  if (Number.isNaN(n) || n < 0) throw new Error("Invalid amount");
  return n;
}

async function queuePayloadAfterUpdate(leadId) {
  await refreshPwQueue();
  return buildPwQueueResponse(leadId);
}

export function registerPressureWashingRoutes(app, { requireOperatorApi, requireOperatorPage } = {}) {
  const pageAuth = requireOperatorPage ?? ((_req, _res, next) => next());
  const apiAuth = requireOperatorApi ?? ((_req, _res, next) => next());


  app.get("/api/pw/founder-control", apiAuth, async (_req, res) => {
    try {
      return res.json(await buildPwFounderControl());
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/pw/search-targets", apiAuth, async (_req, res) => {
    try {
      const targets = await loadPwSearchTargets();
      return res.json({
        targets,
        findLeadsCommand: "npm run pw:find-leads -- --scrape",
      });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/pw/queue/health", apiAuth, async (_req, res) => {
    try {
      return res.json(await buildPwQueueHealth());
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/pw/queue/refresh", apiAuth, async (_req, res) => {
    try {
      const result = await refreshPwQueue();
      const payload = await buildPwQueueResponse(null);
      return res.json({ ...payload, promoted: result.promoted, batchId: result.batchId });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/pressure-washing/dashboard", apiAuth, async (_req, res) => {
    try {
      return res.json(await buildPwDashboard());
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/pressure-washing/queue", apiAuth, async (_req, res) => {
    try {
      const payload = await buildPwQueueResponse(null);
      return res.json(payload);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/pressure-washing/lead/:id", apiAuth, async (req, res) => {
    try {
      const view = cleanText(req.query.view);
      const payload = await buildPwQueueResponse(req.params.id, { view });
      if (!payload.lead) return res.status(404).json({ error: "Lead not found" });
      return res.json({ ...payload, quickActions: PW_QUICK_ACTIONS });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/pressure-washing/next", apiAuth, async (req, res) => {
    try {
      const after = cleanText(req.query.after);
      const view = cleanText(req.query.view);
      let targetId = null;
      if (after) {
        const queue = await getActiveQueueLeads();
        const filtered = view ? filterQueueByView(queue, view) : queue;
        targetId = getNextPwLeadId(filtered, after);
      }
      const payload = await buildPwQueueResponse(targetId, { view });
      return res.json({ ...payload, quickActions: PW_QUICK_ACTIONS });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.patch("/api/pressure-washing/lead/:id/status", apiAuth, async (req, res) => {
    try {
      const action = cleanText(req.body?.action);
      const quick = getPwQuickAction(action);
      const status = normalizePwStatus(req.body?.status || quick?.status);

      await updatePwLeadStatus(req.params.id, {
        actionId: action,
        status,
        touchContact: quick?.touchContact ?? req.body?.touchContact === true,
        incrementCall: quick?.incrementCall ?? req.body?.incrementCall === true,
        incrementConversation: quick?.bumpConversation ?? req.body?.incrementConversation === true,
        lastContactResult: quick?.contactResult || cleanText(req.body?.lastContactResult) || status,
        nextFollowUpAt: parseFollowUpAt(req.body?.nextFollowUpAt),
        estimateAmount: parseAmount(req.body?.estimateAmount),
        revenueWon: parseAmount(req.body?.revenueWon),
        estimateStatus: cleanText(req.body?.estimateStatus),
        jobStatus: cleanText(req.body?.jobStatus),
        followUpDays: quick?.setFollowUpDays,
      });

      if (cleanText(req.body?.note)) {
        await appendPwNote(req.params.id, req.body.note, "notes");
      }
      if (cleanText(req.body?.objection)) {
        await appendPwNote(req.params.id, req.body.objection, "objections");
      }
      if (cleanText(req.body?.followUpNote)) {
        await appendPwNote(req.params.id, req.body.followUpNote, "followUpNotes");
      }

      const payload = await queuePayloadAfterUpdate(req.params.id);
      return res.json(payload);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  });

  app.post("/api/pressure-washing/lead/:id/notes", apiAuth, async (req, res) => {
    try {
      await appendPwNote(req.params.id, req.body?.text, req.body?.kind || "notes");
      const payload = await queuePayloadAfterUpdate(req.params.id);
      return res.json(payload);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  });

  app.post("/api/pressure-washing/lead/:id/call", apiAuth, async (req, res) => {
    try {
      await updatePwLeadStatus(req.params.id, {
        actionId: "called",
        status: "called",
        touchContact: true,
        incrementCall: true,
        lastContactResult: "called",
      });
      const payload = await queuePayloadAfterUpdate(req.params.id);
      return res.json(payload);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  });

  app.post("/api/pressure-washing/leads", apiAuth, async (req, res) => {
    try {
      const lead = await upsertPwLead({ ...req.body, queueState: req.body?.queueState || "available" });
      return res.json({ lead: formatPwLeadForQueue(lead) });
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  });

  app.get("/api/pressure-washing/leads", apiAuth, async (_req, res) => {
    try {
      const leads = await listPwLeads();
      return res.json({
        leads: leads.map((l) => mergePwLeadActions(l)),
      });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });
}

export { seedPressureWashingLeadsIfEmpty } from "./seed-leads.js";
