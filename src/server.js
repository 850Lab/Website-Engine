import express from "express";
import cookieParser from "cookie-parser";
import { randomBytes } from "node:crypto";
import { basename, join } from "node:path";
import { access, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { addLead, findLead } from "./leads.js";
import { parseBusinessText } from "./parse-text.js";
import { enrichLead as enrichLeadFields } from "./enrich.js";
import {
  createAdminAccount,
  getStoredAdminAccount,
  verifyAdminCredentials,
} from "./admin-auth.js";
import { generatePreviewSiteV3 } from "./preview-v3.js";
import { prepareAssetsForLead, saveCustomAssetForLead } from "./assets/asset-pipeline.js";
import { getManifestPath } from "./assets/asset-pipeline.js";
import { renderPreviewV3Screenshots } from "./render-preview-v3.js";
import { findPreviewV3ForLead } from "./render-preview-v3.js";
import {
  appendOutreachHistory,
  buildDashboardSummary,
  buildOutreachDraft,
  findLeadWithMeta,
  generateProposalForLead,
  listLeadsWithMeta,
  updateLeadMissionControl,
} from "./mission-control.js";
import {
  executeLeadGenerationRun,
  estimateLeadGenerationWorkload,
  getLeadGenerationRun,
  listLeadGenerationRuns,
  normalizeLeadGenerationConfig,
  RUN_MODE_DETAILS,
  RUN_MODES,
} from "./lead-generation-runs.js";
import {
  createLeadRun,
  archiveLeadRun,
  deleteLeadRun,
  getLeadRun,
  listLeadRuns,
  moveRejectedLeadToQualified,
  patchLeadRun,
  reconsiderRejectedLead,
} from "./lead-runs.js";
import { writeJsonFileSafe } from "./storage.js";
import { cleanupTestRecords, getAdminSystemStatus } from "./admin-tools.js";
import { buildRecoveryReport } from "./recovery.js";
import {
  buildOpportunityInbox,
  getAutopilotStatus,
  listAutopilotRuns,
  patchAutopilotConfig,
  pauseAutopilot,
  readAutopilotConfig,
  resumeAutopilot,
  runAutopilotNow,
  startAutopilotWorker,
} from "./autopilot.js";
import { listDemoProjects, saveDemoProjectForLead } from "./demo-projects.js";
import { buildSalesSupportForLead } from "./sales-support.js";
import {
  buildFieldTestView,
  readFieldTestState,
  recordFieldTestDemo,
  recordFieldTestExecution,
  recordFieldTestLead,
  recordFieldTestOutcome,
  recordFieldTestOutreachPrep,
  resetFieldTestState,
} from "./field-test.js";
import {
  buildAutonomousMissionView,
  readAutonomousFieldTestMission,
  refreshAutonomousContactRouting,
  runAutonomousMissionCycle,
  startAutonomousFieldTestMission,
} from "./autonomous-field-test.js";
import {
  archiveClient,
  createClient,
  createClientFromLead,
  createMaintenanceRequest,
  createSite,
  getClientOperationsView,
  patchClientBilling,
  patchMaintenanceRequest,
  setManualClientBillingStatus,
} from "./client-operations.js";
import {
  createMaintenanceCheckoutSession,
  getStripeBillingStatus,
  handleStripeWebhookEvent,
  verifyStripeWebhookPayload,
} from "./stripe-billing.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const FRONTEND_DIST = join(ROOT, "mission-control", "dist");
const PREVIEWS_ROOT = join(ROOT, "previews-v3");
const RENDERS_ROOT = join(ROOT, "renders");
const DATA_DIR = join(ROOT, "data");
const SESSIONS_FILE = join(DATA_DIR, "admin-sessions.json");

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "";
const SESSION_COOKIE = "mission_control_session";
const SESSION_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 7;
const sessions = new Map();
const discoverRuns = new Map();
const leadGenerationRuns = new Map();
let httpServer = null;
let sessionsLoaded = false;

function sanitizeLead(lead) {
  return {
    ...lead,
    notes: lead.notes ?? "",
    pipelineStage: lead.pipelineStage ?? "new",
    previewStatus: lead.previewStatus ?? "not_generated",
    replyStatus: lead.replyStatus ?? "not_contacted",
    followUpNeeded: Boolean(lead.followUpNeeded),
    followUpCount: Number(lead.followUpCount) || 0,
    outreachHistory: Array.isArray(lead.outreachHistory) ? lead.outreachHistory : [],
    dealStage: lead.dealStage ?? "discovery",
    proposalStatus: lead.proposalStatus ?? "not_generated",
    proposalHistory: Array.isArray(lead.proposalHistory) ? lead.proposalHistory : [],
    operatorActivityLog: Array.isArray(lead.operatorActivityLog) ? lead.operatorActivityLog : [],
  };
}

function publicLead(lead) {
  return sanitizeLead(lead);
}

async function loadPersistedSessions() {
  if (sessionsLoaded) return;
  sessionsLoaded = true;
  try {
    const raw = await readFile(SESSIONS_FILE, "utf8");
    const parsed = JSON.parse(raw);
    const now = Date.now();
    for (const [token, session] of Object.entries(parsed ?? {})) {
      if (session?.expiresAt && session.expiresAt > now) {
        sessions.set(token, session);
      }
    }
  } catch (err) {
    if (err.code !== "ENOENT") throw err;
  }
}

async function savePersistedSessions() {
  const now = Date.now();
  const activeSessions = {};
  for (const [token, session] of sessions.entries()) {
    if (session?.expiresAt && session.expiresAt > now) {
      activeSessions[token] = session;
    } else {
      sessions.delete(token);
    }
  }
  await writeJsonFileSafe(SESSIONS_FILE, activeSessions);
}

async function getSessionForRequest(req) {
  await loadPersistedSessions();
  const token = req.cookies?.[SESSION_COOKIE];
  if (!token) return null;
  const session = sessions.get(token);
  if (!session || !session.expiresAt || session.expiresAt <= Date.now()) {
    if (token) {
      sessions.delete(token);
      await savePersistedSessions();
    }
    return null;
  }
  return session;
}

async function requireAuth(req, res, next) {
  const session = await getSessionForRequest(req);
  if (!session) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  req.session = session;
  return next();
}

async function createSession(res) {
  const token = randomBytes(24).toString("hex");
  const now = Date.now();
  sessions.set(token, {
    createdAt: now,
    expiresAt: now + SESSION_MAX_AGE_MS,
  });
  await savePersistedSessions();
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    maxAge: SESSION_MAX_AGE_MS,
  });
}

async function destroySession(req, res) {
  await loadPersistedSessions();
  const token = req.cookies?.[SESSION_COOKIE];
  if (token) sessions.delete(token);
  await savePersistedSessions();
  res.clearCookie(SESSION_COOKIE);
}

function slugifyBusinessName(name) {
  return String(name ?? "")
    .toLowerCase()
    .trim()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "business";
}

async function fileExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function buildPreviewInfo(lead, previewDirName) {
  const slug = slugifyBusinessName(lead.businessName);
  const previewDirBase = previewDirName ?? `${slug}-${lead.id.slice(0, 8)}`;
  const previewDir = join(PREVIEWS_ROOT, previewDirBase);
  const indexPath = join(previewDir, "index.html");
  const renderDir = join(RENDERS_ROOT, previewDirBase);
  return {
    slug,
    previewDirBase,
    previewDir,
    indexPath,
    previewUrl: `/previews/${previewDirBase}/index.html`,
    assetManifestPath: getManifestPath(previewDir),
    desktopRenderPath: join(renderDir, "desktop.png"),
    mobileRenderPath: join(renderDir, "mobile.png"),
    desktopRenderUrl: `/renders/${previewDirBase}/desktop.png`,
    mobileRenderUrl: `/renders/${previewDirBase}/mobile.png`,
  };
}

function isLocalDevRequest(req) {
  const host = String(req.get("host") ?? "").toLowerCase();
  const hostname = String(req.hostname ?? "").toLowerCase();
  return process.env.NODE_ENV !== "production" && (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    host.startsWith("localhost:") ||
    host.startsWith("127.0.0.1:")
  );
}

async function enrichLeadView(lead) {
  const existing = await findPreviewV3ForLead(lead);
  const previewDirName = existing?.dirName ?? (existing?.dir ? basename(existing.dir) : undefined);
  const preview = buildPreviewInfo(lead, previewDirName);
  const previewExists = await fileExists(preview.indexPath);
  const assetsReady = await fileExists(preview.assetManifestPath);
  const desktopExists = await fileExists(preview.desktopRenderPath);
  const mobileExists = await fileExists(preview.mobileRenderPath);
  return {
    ...publicLead(lead),
    preview: {
      slug: preview.slug,
      previewDir: preview.previewDir,
      previewUrl: previewExists ? preview.previewUrl : null,
      previewExists,
      assetsReady,
      desktopRenderUrl: desktopExists ? preview.desktopRenderUrl : null,
      mobileRenderUrl: mobileExists ? preview.mobileRenderUrl : null,
      desktopExists,
      mobileExists,
    },
  };
}

async function updatePreviewStatusByArtifacts(leadId) {
  const lead = await findLeadWithMeta(leadId);
  if (!lead) return null;
  const view = await enrichLeadView(lead);
  let previewStatus = lead.previewStatus ?? "not_generated";
  if (view.preview.previewExists) previewStatus = "generated";
  if (view.preview.assetsReady) previewStatus = "assets_ready";
  if (view.preview.desktopExists || view.preview.mobileExists) previewStatus = "rendered";
  if (lead.previewApprovedAt) previewStatus = "approved";
  if (previewStatus !== lead.previewStatus) {
    await updateLeadMissionControl(leadId, { previewStatus });
    return (await findLeadWithMeta(leadId)) ?? lead;
  }
  return lead;
}

const app = express();
app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  try {
    const event = verifyStripeWebhookPayload(req.body, req.get("stripe-signature"));
    const webhookResult = await handleStripeWebhookEvent(event);
    // #region agent log
    fetch('http://127.0.0.1:7614/ingest/6f0f275e-1f8a-4058-adf1-e65618aa0a8f',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'684fa0'},body:JSON.stringify({sessionId:'684fa0',runId:'initial',hypothesisId:'H4,H5',location:'src/server.js:310',message:'stripe webhook handled',data:{eventType:event?.type ?? "",eventId:event?.id ?? "",objectType:event?.data?.object?.object ?? "",duplicate:Boolean(webhookResult?.duplicate),matchedClient:Boolean(webhookResult?.client),billingStatus:webhookResult?.billingStatus ?? null,hasCustomerId:Boolean(webhookResult?.client?.stripeCustomerId),hasSubscriptionId:Boolean(webhookResult?.client?.stripeSubscriptionId)},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    return res.json({ received: true, duplicate: Boolean(webhookResult?.duplicate) });
  } catch (err) {
    // #region agent log
    fetch('http://127.0.0.1:7614/ingest/6f0f275e-1f8a-4058-adf1-e65618aa0a8f',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'684fa0'},body:JSON.stringify({sessionId:'684fa0',runId:'initial',hypothesisId:'H4',location:'src/server.js:314',message:'stripe webhook failed before handling',data:{hasSignature:Boolean(req.get("stripe-signature")),bodyLength:req.body?.length ?? 0,error:err.message},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    return res.status(400).json({ error: err.message });
  }
});

app.use(express.json({ limit: "8mb" }));
app.use(cookieParser());

app.get("/api/health", (req, res) => {
  const port = Number(process.env.PORT || 8787);
  return res.json({
    ok: true,
    service: "mission-control-api",
    version: "dev",
    origin: `${req.protocol}://${req.get("host")}`,
    port,
    routes: {
      autonomousFieldTest: true,
    },
  });
});

app.get("/api/auth/status", async (_req, res) => {
  const account = await getStoredAdminAccount();
  return res.json({
    signupRequired: !account,
    hasAdminAccount: Boolean(account),
    adminEmail: account?.email ?? null,
  });
});

app.post("/api/signup", async (req, res) => {
  try {
    const { email, password } = req.body ?? {};
    const created = await createAdminAccount({ email, password });
    await createSession(res);
    return res.json({ ok: true, account: created });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

app.post("/api/login", async (req, res) => {
  const { email, password } = req.body ?? {};
  const account = await getStoredAdminAccount();
  const isValid = account
    ? await verifyAdminCredentials({ email, password })
    : Boolean(ADMIN_PASSWORD && password && password === ADMIN_PASSWORD);
  if (!isValid) {
    return res.status(401).json({ error: "Invalid password" });
  }
  await createSession(res);
  return res.json({
    ok: true,
    account: {
      email: account?.email ?? "env-admin",
      source: account ? "file" : "env",
    },
  });
});

app.get("/api/me", async (req, res) => {
  const session = await getSessionForRequest(req);
  return res.json({ authenticated: Boolean(session) });
});

app.post("/api/logout", async (req, res) => {
  await destroySession(req, res);
  return res.json({ ok: true });
});

app.use("/api", requireAuth);

app.get("/api/leads", async (req, res) => {
  const leads = await listLeadsWithMeta();
  const withViews = await Promise.all(leads.map((lead) => enrichLeadView(lead)));
  return res.json(withViews);
});

app.get("/api/demo-projects", async (_req, res) => {
  return res.json(await listDemoProjects());
});

app.get("/api/operations", async (_req, res) => {
  const operations = await getClientOperationsView();
  const billingSetup = getStripeBillingStatus();
  // #region agent log
  fetch('http://127.0.0.1:7614/ingest/6f0f275e-1f8a-4058-adf1-e65618aa0a8f',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'684fa0'},body:JSON.stringify({sessionId:'684fa0',runId:'initial',hypothesisId:'H1',location:'src/server.js:395',message:'operations response billing setup',data:{clientCount:operations.clients?.length ?? 0,configured:billingSetup.configured,webhookConfigured:billingSetup.webhookConfigured,checkoutMissing:billingSetup.checkoutMissing,webhookMissing:billingSetup.webhookMissing},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  return res.json({
    ...operations,
    billingSetup,
  });
});

app.post("/api/operations/clients", async (req, res) => {
  try {
    // #region agent log
    fetch('http://127.0.0.1:7614/ingest/6f0f275e-1f8a-4058-adf1-e65618aa0a8f',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'684fa0'},body:JSON.stringify({sessionId:'684fa0',runId:'initial',hypothesisId:'H7',location:'src/server.js:410',message:'create client route entered',data:{hasCompanyName:Boolean(req.body?.companyName),hasPlan:Boolean(req.body?.plan),hasEmail:Boolean(req.body?.email)},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    const client = await createClient(req.body ?? {});
    // #region agent log
    fetch('http://127.0.0.1:7614/ingest/6f0f275e-1f8a-4058-adf1-e65618aa0a8f',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'684fa0'},body:JSON.stringify({sessionId:'684fa0',runId:'initial',hypothesisId:'H7',location:'src/server.js:415',message:'create client route succeeded',data:{clientId:client.clientId,billingStatus:client.billingStatus,hasEmail:Boolean(client.email)},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    return res.status(201).json(client);
  } catch (err) {
    // #region agent log
    fetch('http://127.0.0.1:7614/ingest/6f0f275e-1f8a-4058-adf1-e65618aa0a8f',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'684fa0'},body:JSON.stringify({sessionId:'684fa0',runId:'initial',hypothesisId:'H7',location:'src/server.js:420',message:'create client route failed',data:{error:err.message},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    return res.status(400).json({ error: err.message });
  }
});

app.post("/api/operations/clients/:clientId/archive", async (req, res) => {
  try {
    const client = await archiveClient(req.params.clientId);
    return res.json({ client, operations: await getClientOperationsView() });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

app.post("/api/operations/clients/:clientId/billing/checkout", async (req, res) => {
  try {
    const operations = await getClientOperationsView();
    const client = operations.clients.find((item) => item.clientId === req.params.clientId);
    // #region agent log
    fetch('http://127.0.0.1:7614/ingest/6f0f275e-1f8a-4058-adf1-e65618aa0a8f',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'684fa0'},body:JSON.stringify({sessionId:'684fa0',runId:'initial',hypothesisId:'H2',location:'src/server.js:426',message:'checkout route client lookup',data:{requestedClientId:req.params.clientId,found:Boolean(client),clientCount:operations.clients?.length ?? 0,hasEmail:Boolean(client?.email),hasSubscription:Boolean(client?.stripeSubscriptionId)},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    if (!client) return res.status(404).json({ error: "Client not found." });
    const origin = `${req.protocol}://${req.get("host")}`;
    const session = await createMaintenanceCheckoutSession({ client, origin });
    return res.json({ session, operations: await getClientOperationsView() });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

app.patch("/api/operations/clients/:clientId/billing", async (req, res) => {
  try {
    const localDev = isLocalDevRequest(req);
    // #region agent log
    fetch('http://127.0.0.1:7614/ingest/6f0f275e-1f8a-4058-adf1-e65618aa0a8f',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'684fa0'},body:JSON.stringify({sessionId:'684fa0',runId:'initial',hypothesisId:'H6',location:'src/server.js:442',message:'manual billing local dev gate',data:{clientId:req.params.clientId,host:req.get("host"),hostname:req.hostname,nodeEnv:process.env.NODE_ENV ?? "",localDev,status:String(req.body?.billingStatus ?? "").trim()},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    if (!localDev) {
      return res.status(403).json({ error: "Manual billing status updates are available for local dev testing only." });
    }
    const allowed = ["not_configured", "checkout_started", "active", "past_due", "canceled"];
    const status = String(req.body?.billingStatus ?? "").trim();
    if (!allowed.includes(status)) {
      return res.status(400).json({ error: `billingStatus must be one of: ${allowed.join(", ")}.` });
    }
    const client = await setManualClientBillingStatus(req.params.clientId, status);
    return res.json({ client, operations: await getClientOperationsView() });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

app.patch("/api/operations/clients/:clientId/billing-fields", async (req, res) => {
  try {
    const client = await patchClientBilling(req.params.clientId, req.body ?? {});
    return res.json({ client, operations: await getClientOperationsView() });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

app.post("/api/operations/clients/from-lead/:id", async (req, res) => {
  try {
    const lead = await findLeadWithMeta(req.params.id);
    if (!lead) return res.status(404).json({ error: "Lead not found." });
    if (lead.pipelineStage !== "won" && lead.replyStatus !== "won" && lead.dealStage !== "won") {
      return res.status(400).json({ error: "Only won deals can be converted into clients." });
    }
    const client = await createClientFromLead(lead, req.body ?? {});
    await updateLeadMissionControl(lead.id, {
      dealStage: "onboarding",
      activity: {
        type: "client_created",
        summary: `Converted won deal to client ${client.clientId}.`,
      },
    });
    return res.status(201).json({ client, operations: await getClientOperationsView() });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

app.post("/api/operations/sites", async (req, res) => {
  try {
    return res.status(201).json(await createSite(req.body ?? {}));
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

app.post("/api/operations/maintenance-requests", async (req, res) => {
  try {
    return res.status(201).json(await createMaintenanceRequest(req.body ?? {}));
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

app.patch("/api/operations/maintenance-requests/:requestId", async (req, res) => {
  try {
    return res.json(await patchMaintenanceRequest(req.params.requestId, req.body ?? {}));
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

app.get("/api/field-test", async (_req, res) => {
  return res.json(buildFieldTestView(await readFieldTestState()));
});

app.get("/api/autonomous-field-test", async (_req, res) => {
  return res.json(await buildAutonomousMissionView(await readAutonomousFieldTestMission()));
});

app.post("/api/autonomous-field-test/start", async (req, res) => {
  try {
    const mission = await startAutonomousFieldTestMission(req.body ?? {});
    return res.status(201).json(await buildAutonomousMissionView(mission));
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

app.post("/api/autonomous-field-test/run-cycle", async (_req, res) => {
  try {
    return res.json(await runAutonomousMissionCycle());
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

app.post("/api/autonomous-field-test/contact-routing", async (req, res) => {
  try {
    const mission = await refreshAutonomousContactRouting({ force: Boolean(req.body?.force) });
    return res.json(await buildAutonomousMissionView(mission));
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

app.post("/api/field-test/reset", async (_req, res) => {
  return res.json(buildFieldTestView(await resetFieldTestState()));
});

app.post("/api/field-test/slots/:slotNumber/lead", async (req, res) => {
  try {
    const payload = req.body ?? {};
    const lead = await addLead({
      businessName: payload.businessName,
      category: payload.niche,
      city: payload.city,
      phone: payload.phone,
      websiteUrl: payload.websiteUrl,
      notes: [payload.email ? `Email: ${payload.email}` : "", payload.social ? `Social: ${payload.social}` : ""]
        .filter(Boolean)
        .join("\n"),
      websiteQuality: payload.websiteUrl ? "unknown" : "missing",
    });
    const state = await recordFieldTestLead(req.params.slotNumber, lead, payload);
    return res.status(201).json(buildFieldTestView(state));
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

app.post("/api/field-test/slots/:slotNumber/attach-lead", async (req, res) => {
  try {
    const lead = await findLeadWithMeta(req.body?.leadId);
    if (!lead) return res.status(404).json({ error: "Lead not found." });
    const emailMatch = String(lead.notes ?? "").match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    const socialMatch = String(lead.notes ?? "").match(/https?:\/\/(?:www\.)?(facebook|instagram|linkedin|x|twitter)\.[^\s]+/i);
    const state = await recordFieldTestLead(req.params.slotNumber, lead, {
      email: emailMatch?.[0] ?? "",
      social: socialMatch?.[0] ?? "",
    });
    return res.json(buildFieldTestView(state));
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

app.post("/api/leads", async (req, res) => {
  try {
    const lead = await addLead(req.body ?? {});
    const groupId = req.body?.targetLeadGroupId;
    if (groupId) {
      const group = await getLeadRun(groupId);
      if (group) {
        await patchLeadRun(groupId, {
          qualifiedLeadIds: [...new Set([...(group.qualifiedLeadIds ?? []), lead.id])],
        });
      }
    }
    return res.status(201).json(await enrichLeadView(lead));
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

app.post("/api/leads/import-text", async (req, res) => {
  try {
    const fields = parseBusinessText(String(req.body?.text ?? ""));
    const lead = await addLead(fields);
    const groupId = req.body?.targetLeadGroupId;
    if (groupId) {
      const group = await getLeadRun(groupId);
      if (group) {
        await patchLeadRun(groupId, {
          qualifiedLeadIds: [...new Set([...(group.qualifiedLeadIds ?? []), lead.id])],
        });
      }
    }
    return res.status(201).json(await enrichLeadView(lead));
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

app.get("/api/leads/:id", async (req, res) => {
  const lead = await findLeadWithMeta(req.params.id);
  if (!lead) return res.status(404).json({ error: "Lead not found" });
  await updatePreviewStatusByArtifacts(lead.id);
  const fresh = (await findLeadWithMeta(req.params.id)) ?? lead;
  const view = await enrichLeadView(fresh);
  return res.json(view);
});

app.patch("/api/leads/:id", async (req, res) => {
  try {
    const updated = await updateLeadMissionControl(req.params.id, req.body ?? {});
    const view = await enrichLeadView(updated);
    return res.json(view);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

app.post("/api/leads/:id/enrich", async (req, res) => {
  const lead = await findLeadWithMeta(req.params.id);
  if (!lead) return res.status(404).json({ error: "Lead not found" });
  const { fields } = await enrichLeadFields(lead);
  const updated = await updateLeadMissionControl(req.params.id, fields);
  return res.json(await enrichLeadView(updated));
});

app.post("/api/leads/:id/generate-preview-v3", async (req, res) => {
  const lead = await findLead(req.params.id);
  if (!lead) return res.status(404).json({ error: "Lead not found" });
  const result = await generatePreviewSiteV3(lead);
  await updateLeadMissionControl(lead.id, {
    previewStatus: "generated",
    pipelineStage: "preview_ready",
  });
  const updatedLead = (await findLeadWithMeta(lead.id)) ?? lead;
  return res.json({
    ok: true,
    result,
    lead: await enrichLeadView(updatedLead),
  });
});

app.post("/api/leads/:id/prepare-assets", async (req, res) => {
  const lead = await findLead(req.params.id);
  if (!lead) return res.status(404).json({ error: "Lead not found" });
  const result = await prepareAssetsForLead(lead);
  await updateLeadMissionControl(lead.id, {
    previewStatus: "assets_ready",
    pipelineStage: "preview_ready",
  });
  const updatedLead = (await findLeadWithMeta(lead.id)) ?? lead;
  return res.json({
    ok: true,
    result,
    lead: await enrichLeadView(updatedLead),
  });
});

app.post("/api/leads/:id/custom-image", async (req, res) => {
  try {
    const lead = await findLead(req.params.id);
    if (!lead) return res.status(404).json({ error: "Lead not found" });
    const result = await saveCustomAssetForLead(lead, req.body ?? {});
    await updateLeadMissionControl(lead.id, {
      previewStatus: "assets_ready",
      pipelineStage: "preview_ready",
      activity: {
        type: "custom_image_uploaded",
        summary: `Uploaded custom ${result.slot} image.`,
      },
    });
    const updatedLead = (await findLeadWithMeta(lead.id)) ?? lead;
    return res.json({ ok: true, result, lead: await enrichLeadView(updatedLead) });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

app.post("/api/leads/:id/render-preview-v3", async (req, res) => {
  const lead = await findLead(req.params.id);
  if (!lead) return res.status(404).json({ error: "Lead not found" });
  const result = await renderPreviewV3Screenshots(lead);
  await updateLeadMissionControl(lead.id, { previewStatus: "rendered" });
  const updatedLead = (await findLeadWithMeta(lead.id)) ?? lead;
  return res.json({
    ok: true,
    result: {
      ...result,
      desktopUrl: `/renders/${result.renderSlug ?? result.slug}/desktop.png`,
      mobileUrl: `/renders/${result.renderSlug ?? result.slug}/mobile.png`,
    },
    lead: await enrichLeadView(updatedLead),
  });
});

app.post("/api/leads/:id/generate-outreach-draft", async (req, res) => {
  const lead = await findLeadWithMeta(req.params.id);
  if (!lead) return res.status(404).json({ error: "Lead not found" });
  const draft = buildOutreachDraft(lead);
  return res.json(draft);
});

app.get("/api/leads/:id/sales-support", async (req, res) => {
  const lead = await findLeadWithMeta(req.params.id);
  if (!lead) return res.status(404).json({ error: "Lead not found" });
  return res.json(buildSalesSupportForLead(lead));
});

app.post("/api/leads/:id/save-demo-project", async (req, res) => {
  try {
    const lead = await findLeadWithMeta(req.params.id);
    if (!lead) return res.status(404).json({ error: "Lead not found" });
    const view = await enrichLeadView(lead);
    const project = await saveDemoProjectForLead(view);
    await updateLeadMissionControl(lead.id, {
      activity: {
        type: "demo_project_saved",
        summary: "Saved lead preview and sales material as a demo project.",
      },
    });
    return res.json(project);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

app.post("/api/field-test/slots/:slotNumber/demo", async (req, res) => {
  const state = await readFieldTestState();
  const slot = state.slots[Number(req.params.slotNumber) - 1];
  if (!slot?.leadId) return res.status(400).json({ error: "Create/save a lead for this slot first." });
  const started = Date.now();
  try {
    const lead = await findLead(slot.leadId);
    if (!lead) return res.status(404).json({ error: "Field test lead not found." });
    await generatePreviewSiteV3(lead);
    await updateLeadMissionControl(lead.id, { previewStatus: "generated", pipelineStage: "preview_ready" });
    if (req.body?.prepareAssets !== false) {
      await prepareAssetsForLead(lead);
      await updateLeadMissionControl(lead.id, { previewStatus: "assets_ready", pipelineStage: "preview_ready" });
    }
    if (req.body?.renderScreenshots) {
      await renderPreviewV3Screenshots(lead);
      await updateLeadMissionControl(lead.id, { previewStatus: "rendered", pipelineStage: "preview_ready" });
    }
    const updated = await updatePreviewStatusByArtifacts(lead.id);
    const view = await enrichLeadView((await findLeadWithMeta(lead.id)) ?? updated ?? lead);
    const next = await recordFieldTestDemo(req.params.slotNumber, {
      durationMs: Date.now() - started,
      previewExists: Boolean(view.preview?.previewExists),
    });
    return res.json(buildFieldTestView(next));
  } catch (err) {
    const next = await recordFieldTestDemo(req.params.slotNumber, {
      durationMs: Date.now() - started,
      previewExists: false,
      error: err.message,
    });
    return res.status(400).json({ ...buildFieldTestView(next), error: err.message });
  }
});

app.post("/api/field-test/slots/:slotNumber/outreach-prep", async (req, res) => {
  try {
    const state = await readFieldTestState();
    const slot = state.slots[Number(req.params.slotNumber) - 1];
    if (!slot?.leadId) return res.status(400).json({ error: "Create/save a lead for this slot first." });
    const lead = await findLeadWithMeta(slot.leadId);
    if (!lead) return res.status(404).json({ error: "Field test lead not found." });
    const draft = buildOutreachDraft(lead);
    const sales = buildSalesSupportForLead(lead);
    const next = await recordFieldTestOutreachPrep(req.params.slotNumber, {
      subject: draft.subject,
      body: draft.body,
      pitchScript: sales.pitchScript,
      objectionHandling: sales.objectionHandling,
      followUpScripts: sales.followUpScripts,
      closeCta: sales.closeCta,
    });
    return res.json(buildFieldTestView(next));
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

app.post("/api/field-test/slots/:slotNumber/outreach-execution", async (req, res) => {
  try {
    const state = await readFieldTestState();
    const slot = state.slots[Number(req.params.slotNumber) - 1];
    if (!slot?.leadId) return res.status(400).json({ error: "Create/save a lead for this slot first." });
    const lead = await appendOutreachHistory(slot.leadId, {
      subject: slot.outreach.subject,
      body: slot.outreach.body,
      channel: req.body?.contactMethod || "phone",
      replyStatus: "contacted",
      followUpNeeded: Boolean(req.body?.followUpNeeded),
      nextFollowUpAt: req.body?.nextFollowUpAt ?? null,
      action: "field_test_contact",
      notes: req.body?.notes ?? "Field test outreach executed.",
    });
    await updateLeadMissionControl(lead.id, {
      pipelineStage: "contacted",
      replyStatus: "contacted",
      contactedAt: new Date().toISOString(),
      lastContactedAt: new Date().toISOString(),
    });
    const next = await recordFieldTestExecution(req.params.slotNumber, {
      contacted: true,
      contactMethod: req.body?.contactMethod,
      followUpNeeded: req.body?.followUpNeeded,
      nextFollowUpAt: req.body?.nextFollowUpAt,
    });
    return res.json(buildFieldTestView(next));
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

app.post("/api/field-test/slots/:slotNumber/outcome", async (req, res) => {
  try {
    const state = await readFieldTestState();
    const slot = state.slots[Number(req.params.slotNumber) - 1];
    if (slot?.leadId) {
      const status = req.body?.status;
      await updateLeadMissionControl(slot.leadId, {
        replyStatus:
          status === "rejected"
            ? "lost"
            : ["replied", "interested", "meeting_booked"].includes(status)
              ? "replied"
              : "no_response",
        pipelineStage:
          status === "rejected"
            ? "lost"
            : status === "meeting_booked"
              ? "interested"
              : ["replied", "interested"].includes(status)
                ? "replied"
                : "contacted",
        notes: req.body?.notes,
      });
    }
    const next = await recordFieldTestOutcome(req.params.slotNumber, req.body ?? {});
    return res.json(buildFieldTestView(next));
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

app.post("/api/leads/:id/generate-proposal", async (req, res) => {
  try {
    const lead = await findLeadWithMeta(req.params.id);
    if (!lead) return res.status(404).json({ error: "Lead not found" });
    const proposal = generateProposalForLead({ ...lead, ...(req.body ?? {}) });
    const history = [...(lead.proposalHistory ?? []), proposal].slice(-20);
    const updated = await updateLeadMissionControl(req.params.id, {
      currentProposal: proposal,
      proposalHistory: history,
      proposalStatus: "draft",
      dealStage: lead.dealStage === "discovery" || lead.dealStage === "contacted" ? "quoting" : lead.dealStage,
      activity: {
        type: "proposal_generated",
        summary: `Generated ${proposal.summary}`,
      },
    });
    return res.json({ proposal, lead: await enrichLeadView(updated) });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

app.post("/api/leads/:id/append-outreach", async (req, res) => {
  try {
    const lead = await appendOutreachHistory(req.params.id, req.body ?? {});
    return res.json(await enrichLeadView(lead));
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

app.post("/api/leads/:id/approve-preview", async (req, res) => {
  try {
    const lead = await updateLeadMissionControl(req.params.id, {
      previewStatus: "approved",
      previewApprovedAt: new Date().toISOString(),
      pipelineStage: "preview_ready",
    });
    return res.json(await enrichLeadView(lead));
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

app.get("/api/dashboard-summary", async (req, res) => {
  const leads = await listLeadsWithMeta();
  const summary = buildDashboardSummary(leads);
  const recovery = await buildRecoveryReport(leads);
  const autopilot = await getAutopilotStatus();
  summary.recovery = {
    warningCount: recovery.warningCount,
    criticalCount: recovery.criticalCount,
    failedJobs: recovery.failedJobs,
    recommendations: recovery.recommendations.slice(0, 4),
  };
  summary.autopilot = {
    enabled: autopilot.enabled,
    running: autopilot.running,
    lastRun: autopilot.lastRun,
    nextRunAt: autopilot.nextRunAt,
    opportunitiesFoundToday: autopilot.opportunitiesFoundToday,
    previewsGeneratedToday: autopilot.previewsGeneratedToday,
    errorsToday: autopilot.errorsToday,
    warnings: autopilot.warnings,
  };
  summary.recentTargetLeadGroups = (await listLeadRuns({ limit: 5 })).map((run) => ({
    id: run.id,
    title: run.title,
    qualified: run.stats.qualified,
    contacted: run.stats.contacted,
    replied: run.stats.replied,
    won: run.stats.won,
    lost: run.stats.lost,
    createdAt: run.createdAt,
    archived: run.archived,
  }));
  summary.activeTargetLeadGroups = summary.recentTargetLeadGroups.filter((run) => !run.archived).length;
  return res.json(summary);
});

app.get("/api/admin/system-status", async (_req, res) => {
  try {
    const [status, leads] = await Promise.all([getAdminSystemStatus(), listLeadsWithMeta()]);
    const recovery = await buildRecoveryReport(leads);
    return res.json({ ...status, recovery });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.get("/api/recovery-report", async (_req, res) => {
  try {
    return res.json(await buildRecoveryReport(await listLeadsWithMeta()));
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.post("/api/recovery/:leadId/:action", async (req, res) => {
  const lead = await findLead(req.params.leadId);
  if (!lead) return res.status(404).json({ error: "Lead not found" });
  try {
    if (req.params.action === "generate_preview") {
      await generatePreviewSiteV3(lead);
      await updateLeadMissionControl(lead.id, { previewStatus: "generated", pipelineStage: "preview_ready" });
    } else if (req.params.action === "prepare_assets") {
      await prepareAssetsForLead(lead);
      await updateLeadMissionControl(lead.id, { previewStatus: "assets_ready", pipelineStage: "preview_ready" });
    } else if (req.params.action === "render_preview") {
      await renderPreviewV3Screenshots(lead);
      await updateLeadMissionControl(lead.id, { previewStatus: "rendered" });
    } else {
      return res.status(400).json({ error: "Unsupported recovery action." });
    }
    const updated = await updatePreviewStatusByArtifacts(lead.id);
    return res.json({ ok: true, lead: await enrichLeadView(updated ?? lead) });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

app.post("/api/admin/cleanup-test-records", async (req, res) => {
  try {
    const result = await cleanupTestRecords({
      dryRun: req.body?.dryRun !== false,
      confirm: req.body?.confirm ?? "",
    });
    return res.json(result);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

app.get("/api/autopilot/status", async (_req, res) => {
  try {
    return res.json(await getAutopilotStatus());
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.get("/api/autopilot/config", async (_req, res) => {
  try {
    return res.json(await readAutopilotConfig());
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.patch("/api/autopilot/config", async (req, res) => {
  try {
    const config = await patchAutopilotConfig(req.body ?? {});
    return res.json(config);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

app.post("/api/autopilot/run-now", async (_req, res) => {
  try {
    const run = await runAutopilotNow({ source: "manual", ignoreDisabled: true });
    return res.json(run);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

app.post("/api/autopilot/pause", async (_req, res) => {
  try {
    return res.json(await pauseAutopilot());
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

app.post("/api/autopilot/resume", async (_req, res) => {
  try {
    return res.json(await resumeAutopilot());
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

app.get("/api/autopilot/runs", async (req, res) => {
  const limit = Number(req.query?.limit) || 100;
  return res.json(await listAutopilotRuns({ limit }));
});

app.get("/api/opportunities", async (_req, res) => {
  try {
    const leads = await listLeadsWithMeta();
    return res.json(await buildOpportunityInbox(leads));
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

console.log("Autopilot routes mounted");

app.post("/api/discover", async (req, res) => {
  let config;
  try {
    config = normalizeLeadGenerationConfig(req.body ?? {});
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  const runId = randomBytes(8).toString("hex");
  const runState = {
    id: runId,
    title: config.runTitle,
    status: "pending",
    startedAt: new Date().toISOString(),
    logs: [],
    summary: null,
    error: null,
    config,
    modeDescription: RUN_MODE_DETAILS[config.runMode],
    qualifiedLeads: [],
    rejectedLeads: [],
  };
  discoverRuns.set(runId, runState);
  leadGenerationRuns.set(runId, runState);

  const pushLog = (entry) => {
    runState.logs.push({
      at: new Date().toISOString(),
      ...entry,
    });
    if (runState.logs.length > 200) {
      runState.logs = runState.logs.slice(-200);
    }
  };

  (async () => {
    try {
      runState.status = "searching";
      const result = await executeLeadGenerationRun(config, (entry) => {
        runState.status = entry.step;
        pushLog(entry);
      }, { runId });
      runState.summary = result.summary;
      runState.qualifiedLeads = result.qualifiedLeads;
      runState.rejectedLeads = result.rejectedLeads;
      runState.targetLeadGroup = result.targetLeadGroup;
      runState.status = "completed";
      pushLog({ step: "completed", message: "Run completed.", summary: result.summary });
    } catch (err) {
      runState.status = "failed";
      runState.error = err.message;
      pushLog({ step: "failed", message: err.message });
    }
  })();

  return res.json({ runId, status: runState.status });
});

app.get("/api/discover/:runId", async (req, res) => {
  let run = discoverRuns.get(req.params.runId) ?? leadGenerationRuns.get(req.params.runId);
  if (!run) {
    run = await getLeadGenerationRun(req.params.runId);
  }
  if (!run) return res.status(404).json({ error: "Run not found" });
  return res.json(run);
});

app.get("/api/lead-generation/workload", async (req, res) => {
  try {
    const estimate = estimateLeadGenerationWorkload(req.query ?? {});
    return res.json(estimate);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

app.post("/api/lead-generation/workload", async (req, res) => {
  try {
    const estimate = estimateLeadGenerationWorkload(req.body ?? {});
    return res.json(estimate);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

app.get("/api/lead-generation/runs", async (req, res) => {
  const limit = Number(req.query?.limit) || 20;
  const rows = await listLeadGenerationRuns({ limit });
  return res.json(rows);
});

app.get("/api/lead-generation/runs/:runId", async (req, res) => {
  const run = await getLeadGenerationRun(req.params.runId);
  if (!run) return res.status(404).json({ error: "Run not found" });
  return res.json(run);
});

app.get("/api/lead-generation/run-modes", (_req, res) => {
  return res.json({
    runModes: RUN_MODES.map((mode) => ({
      id: mode,
      description: RUN_MODE_DETAILS[mode],
    })),
  });
});

app.get("/api/lead-runs", async (req, res) => {
  const limit = Number(req.query?.limit) || 100;
  const runs = await listLeadRuns({ limit });
  return res.json(runs);
});

app.get("/api/lead-runs/:runId", async (req, res) => {
  const run = await getLeadRun(req.params.runId);
  if (!run) return res.status(404).json({ error: "Target Lead Group not found" });
  return res.json(run);
});

app.get("/api/lead-runs/:runId/export.csv", async (req, res) => {
  const run = await getLeadRun(req.params.runId);
  if (!run) return res.status(404).send("Target Lead Group not found");
  const header = [
    "Business Name",
    "City",
    "Category",
    "Phone",
    "Website",
    "Score",
    "Status",
    "Preview Status",
    "Pipeline Stage",
    "Last Contacted",
  ];
  const esc = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const rows = (run.qualifiedLeads ?? []).map((lead) =>
    [
      lead.businessName,
      lead.city,
      lead.category,
      lead.phone,
      lead.websiteUrl,
      lead.score,
      lead.status,
      lead.previewStatus,
      lead.pipelineStage,
      lead.lastContactedAt,
    ].map(esc).join(",")
  );
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${run.title.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() || run.id}.csv"`
  );
  return res.send([header.map(esc).join(","), ...rows].join("\n"));
});

app.post("/api/lead-runs", async (req, res) => {
  try {
    const run = await createLeadRun(req.body ?? {});
    return res.status(201).json(run);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

app.patch("/api/lead-runs/:runId", async (req, res) => {
  try {
    const run = await patchLeadRun(req.params.runId, req.body ?? {});
    return res.json(run);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

app.delete("/api/lead-runs/:runId", async (req, res) => {
  return res.json(await deleteLeadRun(req.params.runId));
});

app.post("/api/lead-runs/:runId/archive", async (req, res) => {
  try {
    return res.json(await archiveLeadRun(req.params.runId, req.body?.archived ?? true));
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

app.post("/api/lead-runs/:runId/reconsider-lead", async (req, res) => {
  try {
    const key = req.body?.leadId ?? req.body?.businessName;
    const run = await reconsiderRejectedLead(req.params.runId, key);
    return res.json(run);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

app.post("/api/lead-runs/:runId/move-to-qualified", async (req, res) => {
  try {
    const run = await moveRejectedLeadToQualified(req.params.runId, req.body?.leadId);
    return res.json(run);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

app.use("/previews", express.static(PREVIEWS_ROOT));
app.use("/renders", express.static(RENDERS_ROOT));

async function startServer() {
  startAutopilotWorker();
  const hasFrontendDist = await fileExists(FRONTEND_DIST);
  if (hasFrontendDist) {
    app.use(express.static(FRONTEND_DIST));
    app.get(/.*/, (req, res, next) => {
      if (req.path.startsWith("/api")) return next();
      res.sendFile(join(FRONTEND_DIST, "index.html"));
    });
  } else {
    app.get("/", (_req, res) => {
      res.json({
        ok: true,
        message:
          "Mission Control API is running. Frontend dist not found; run mission-control build or dev server.",
      });
    });
  }

  const port = Number(process.env.PORT || 8787);
  httpServer = app.listen(port, () => {
    console.log(`Mission Control server listening on http://localhost:${port}`);
  });
  if (typeof httpServer.ref === "function") {
    httpServer.ref();
  }
}

startServer().catch((err) => {
  console.error(`Failed to start server: ${err.message}`);
  process.exit(1);
});
