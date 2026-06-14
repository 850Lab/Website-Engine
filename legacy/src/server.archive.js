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
import {
  generateV6Package,
  getV6Package,
  getV6PackageDownload,
  listV6Packages,
} from "./v6/index.js";
import { registerV7OperatorRoutes, registerV7Routes } from "./v7/index.js";
import { registerStage1Routes } from "./stage1/index.js";
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
import {
  createRevenueRecordForLead,
  attachRevenueCheckoutUrl,
  attachRevenueClient,
  getRevenueRecord,
  getRevenuePipelineView,
  linkRevenueClient,
  listRevenueRecords,
  logRevenueMeeting,
  logRevenueProposal,
  logRevenueReply,
  markRevenueLost,
  markRevenueWon,
  transitionRevenueStage,
  transitionRevenueStageIfEarlier,
  updateRevenueProposal,
} from "./revenue-pipeline.js";
import {
  createFulfillmentRecord,
  getFulfillmentView,
  linkFulfillmentSite,
  listFulfillmentRecords,
  updateFulfillmentChecklistItem,
} from "./fulfillment.js";
import {
  appendWebsiteEvent,
  buildWebsiteFactoryView,
  getWebsiteById,
  updateWebsiteExceptionAction,
} from "./website-factory.js";
import {
  deployStaticPreview,
  getDeploymentProviderStatus,
  verifyDeploymentProviderConnection,
} from "./deployment.js";
import { setWebsiteFactoryStatus } from "./website-state.js";
import { latestWebsiteQcRecord, runWebsiteQc } from "./qc.js";
import {
  approveAndQueueOutreach,
  createOutreachDraft,
  latestOutreachForWebsite,
  markOutreachSent,
} from "./outreach-queue.js";
import {
  createAutomationJob,
  getAutomationConfig,
  listAutomationJobs,
  listAutomationLogs,
  listAutomationRuns,
  listAutomationWorkers,
  planPreviewChainJobs,
  enqueuePreviewChainJobs,
  planQcDeploymentChainJobs,
  enqueueQcDeploymentChainJobs,
  planOutreachChainJobs,
  enqueueOutreachChainJobs,
  planReplyRevenueChainJobs,
  enqueueReplyRevenueChainJobs,
  createAutomationInboundReply,
  runAutomationCycle,
  updateAutomationConfig,
} from "./automation.js";
import {
  getOrchestratorStatus,
  listOrchestrationLogs,
  orchestrateWebsite,
} from "./orchestrator.js";
import {
  getSchedulerStatus,
  maybeStartScheduler,
  runAutomationSchedulerOnce,
  setSchedulerEnabled,
} from "./scheduler.js";
import {
  getTwilioProviderStatus,
  recordTwilioInboundSms,
  sendTwilioSms,
  verifyTwilioWebhookSignature,
} from "./providers/messaging/twilio.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const FRONTEND_DIST = join(ROOT, "mission-control", "dist");
const PREVIEWS_ROOT = join(ROOT, "previews-v3");
const RENDERS_ROOT = join(ROOT, "renders");
const DATA_DIR = join(ROOT, "data");
const SESSIONS_FILE = join(DATA_DIR, "admin-sessions.json");

async function loadRuntimeEnvFiles() {
  for (const filename of [".env", ".env.local"]) {
    try {
      const text = await readFile(join(ROOT, filename), "utf8");
      for (const line of text.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eq = trimmed.indexOf("=");
        if (eq === -1) continue;
        const key = trimmed.slice(0, eq).trim();
        let value = trimmed.slice(eq + 1).trim();
        value = value.replace(/^["']|["']$/g, "");
        if (key && process.env[key] === undefined) {
          process.env[key] = value;
        }
      }
    } catch (err) {
      if (err.code !== "ENOENT") {
        console.warn(`Unable to load ${filename}: ${err.message}`);
      }
    }
  }
}

function getVercelRuntimeEnvDiagnostic() {
  const token = String(process.env.VERCEL_TOKEN ?? "").trim();
  const teamId = String(process.env.VERCEL_TEAM_ID ?? "").trim();
  return {
    hasVercelToken: Boolean(token),
    tokenPrefix: token ? token.slice(0, 4) : "",
    tokenLength: token.length,
    hasTeamId: Boolean(teamId),
  };
}

function getTwilioRuntimeEnvDiagnostic() {
  const accountSid = String(process.env.TWILIO_ACCOUNT_SID ?? "").trim();
  const authToken = String(process.env.TWILIO_AUTH_TOKEN ?? "").trim();
  const messagingServiceSid = String(process.env.TWILIO_MESSAGING_SERVICE_SID ?? "").trim();
  const fromNumber = String(process.env.TWILIO_FROM_NUMBER ?? "").trim();
  return {
    hasAccountSid: Boolean(accountSid),
    accountSidPrefix: accountSid ? accountSid.slice(0, 2) : "",
    hasAuthToken: Boolean(authToken),
    authTokenLength: authToken.length,
    hasMessagingServiceSid: Boolean(messagingServiceSid),
    messagingServiceSidPrefix: messagingServiceSid ? messagingServiceSid.slice(0, 2) : "",
    hasFromNumber: Boolean(fromNumber),
    fromNumberPrefix: fromNumber ? fromNumber.slice(0, 2) : "",
    allowRealSmsSend: String(process.env.ALLOW_REAL_SMS_SEND ?? "").trim().toLowerCase() === "true",
  };
}

await loadRuntimeEnvFiles();

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

function shouldServeSpaFallback(req) {
  if (!["GET", "HEAD"].includes(req.method)) return false;
  if (req.path.startsWith("/api")) return false;
  if (req.path.startsWith("/previews")) return false;
  if (req.path.startsWith("/renders")) return false;
  if (req.path.startsWith("/p/")) return false;
  if (req.path.startsWith("/launch/")) return false;
  if (req.path.startsWith("/activate/")) return false;
  if (req.path.startsWith("/dashboard/")) return false;
  return true;
}

function serveFrontendApp(req, res, next) {
  if (!shouldServeSpaFallback(req)) return next();
  return res.sendFile(join(FRONTEND_DIST, "index.html"));
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

app.post("/api/webhooks/twilio/sms", express.urlencoded({ extended: false }), async (req, res) => {
  try {
    const forwardedProto = String(req.get("x-forwarded-proto") || "").split(",")[0].trim();
    const protocol = forwardedProto || req.protocol;
    const webhookUrl = `${protocol}://${req.get("host")}${req.originalUrl}`;
    const signature = verifyTwilioWebhookSignature({
      url: webhookUrl,
      params: req.body ?? {},
      signature: req.get("x-twilio-signature"),
    });
    if (!signature.verified && !signature.skipped) {
      return res.status(403).json({ error: "Invalid Twilio webhook signature." });
    }
    const result = await recordTwilioInboundSms(req.body ?? {});
    let enqueueResult = null;
    if (result.websiteId && !result.duplicate) {
      enqueueResult = await enqueueReplyRevenueChainJobs(result.websiteId, { dryRun: false });
    }
    return res.json({
      received: true,
      duplicate: Boolean(result.duplicate),
      matched: Boolean(result.matched),
      websiteId: result.websiteId,
      outreachId: result.outreachId,
      inboundReplyId: result.reply?.inboundReplyId,
      replyPipelineEnqueued: Boolean(enqueueResult?.created?.length),
    });
  } catch (err) {
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

app.get("/api/providers/twilio/status", (_req, res) => {
  return res.json(getTwilioProviderStatus());
});

app.get("/api/runtime/twilio-env", (_req, res) => {
  return res.json(getTwilioRuntimeEnvDiagnostic());
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

registerV7Routes(app);

app.use("/api", requireAuth);

app.get("/api/leads", async (req, res) => {
  const leads = await listLeadsWithMeta();
  const withViews = await Promise.all(leads.map((lead) => enrichLeadView(lead)));
  return res.json(withViews);
});

app.get("/api/demo-projects", async (_req, res) => {
  return res.json(await listDemoProjects());
});

registerV7OperatorRoutes(app);
registerStage1Routes(app);

app.get("/api/v6/packages", async (_req, res) => {
  const packages = await listV6Packages();
  return res.json(
    packages.map((record) => ({
      id: record.id,
      businessName: record.businessName,
      status: record.status,
      previewUrl: record.previewUrl,
      severityScore: record.severityScore,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    }))
  );
});

app.get("/api/v6/packages/:id", async (req, res) => {
  const record = await getV6Package(req.params.id);
  if (!record) return res.status(404).json({ error: "V6 package not found" });
  return res.json(record);
});

app.post("/api/v6/packages", async (req, res) => {
  try {
    const record = await generateV6Package(req.body ?? {});
    return res.status(201).json(record);
  } catch (err) {
    return res.status(400).json({ error: err.message || "Failed to generate V6 package" });
  }
});

app.get("/api/v6/packages/:id/download", async (req, res) => {
  const bundle = await getV6PackageDownload(req.params.id);
  if (!bundle) return res.status(404).json({ error: "V6 package not found" });
  const filename = `${bundle.businessName.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-sales-package.json`;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  return res.send(`${JSON.stringify(bundle, null, 2)}\n`);
});

app.get("/api/operations", async (_req, res) => {
  const operations = await getClientOperationsView({ fulfillmentRecords: await listFulfillmentRecords() });
  const billingSetup = getStripeBillingStatus();
  // #region agent log
  fetch('http://127.0.0.1:7614/ingest/6f0f275e-1f8a-4058-adf1-e65618aa0a8f',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'684fa0'},body:JSON.stringify({sessionId:'684fa0',runId:'initial',hypothesisId:'H1',location:'src/server.js:395',message:'operations response billing setup',data:{clientCount:operations.clients?.length ?? 0,configured:billingSetup.configured,webhookConfigured:billingSetup.webhookConfigured,checkoutMissing:billingSetup.checkoutMissing,webhookMissing:billingSetup.webhookMissing},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  return res.json({
    ...operations,
    billingSetup,
  });
});

app.get("/api/revenue", async (_req, res) => {
  const [leads, operations] = await Promise.all([
    listLeadsWithMeta(),
    getClientOperationsView(),
  ]);
  return res.json(await getRevenuePipelineView({
    leads,
    clients: operations.clients,
    sites: operations.sites,
    fulfillmentRecords: await listFulfillmentRecords(),
  }));
});

app.get("/api/fulfillment", async (_req, res) => {
  const [operations, revenueRecords] = await Promise.all([
    getClientOperationsView({ fulfillmentRecords: await listFulfillmentRecords() }),
    listRevenueRecords(),
  ]);
  return res.json(await getFulfillmentView({
    clients: operations.clients,
    sites: operations.sites,
    revenueRecords,
    maintenanceRequests: operations.maintenanceRequests,
  }));
});

async function buildWebsiteApiView() {
  const fulfillmentRecords = await listFulfillmentRecords();
  const [leads, revenueRecords, operations] = await Promise.all([
    listLeadsWithMeta(),
    listRevenueRecords(),
    getClientOperationsView({ fulfillmentRecords }),
  ]);
  return buildWebsiteFactoryView({
    leads,
    revenueRecords,
    fulfillmentRecords,
    operations,
  });
}

app.get("/api/websites", async (_req, res) => {
  return res.json(await buildWebsiteApiView());
});

app.get("/api/websites/conveyor", async (_req, res) => {
  const view = await buildWebsiteApiView();
  return res.json({
    version: view.version,
    stages: view.stages,
    conveyor: view.conveyor,
  });
});

app.get("/api/runtime/vercel-env", (_req, res) => {
  return res.json(getVercelRuntimeEnvDiagnostic());
});

app.get("/api/deployment/status", async (req, res) => {
  if (req.query?.verify === "true") {
    return res.json(await verifyDeploymentProviderConnection());
  }
  return res.json(getDeploymentProviderStatus());
});

app.post("/api/providers/twilio/send-test", async (req, res) => {
  try {
    const result = await sendTwilioSms({
      to: req.body?.to,
      body: req.body?.body || "Website Engine SMS integration test.",
      metadata: { source: "mission_control_twilio_test" },
    });
    return res.json({
      ok: true,
      provider: result.provider,
      simulated: result.simulated,
      sent: result.sent,
      providerMessageId: result.providerMessageId,
      status: result.status,
      message: result.message,
    });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

app.get("/api/automation/config", async (_req, res) => {
  return res.json(await getAutomationConfig());
});

app.patch("/api/automation/config", async (req, res) => {
  try {
    return res.json(await updateAutomationConfig(req.body ?? {}));
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

app.get("/api/automation/workers", (_req, res) => {
  return res.json({ workers: listAutomationWorkers() });
});

app.get("/api/automation/jobs", async (req, res) => {
  return res.json({
    jobs: await listAutomationJobs({
      limit: req.query?.limit,
      status: req.query?.status,
    }),
  });
});

app.post("/api/automation/jobs", async (req, res) => {
  try {
    const job = await createAutomationJob(req.body ?? {});
    return res.status(201).json({ job });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

app.get("/api/automation/preview-chain/:websiteId/plan", async (req, res) => {
  try {
    return res.json(await planPreviewChainJobs(req.params.websiteId));
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

app.post("/api/automation/preview-chain/:websiteId/enqueue", async (req, res) => {
  try {
    return res.json(await enqueuePreviewChainJobs(req.params.websiteId, {
      dryRun: req.body?.dryRun !== false,
    }));
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

app.get("/api/automation/qc-deployment-chain/:websiteId/plan", async (req, res) => {
  try {
    return res.json(await planQcDeploymentChainJobs(req.params.websiteId));
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

app.post("/api/automation/qc-deployment-chain/:websiteId/enqueue", async (req, res) => {
  try {
    return res.json(await enqueueQcDeploymentChainJobs(req.params.websiteId, {
      dryRun: req.body?.dryRun !== false,
    }));
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

app.get("/api/automation/outreach-chain/:websiteId/plan", async (req, res) => {
  try {
    return res.json(await planOutreachChainJobs(req.params.websiteId));
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

app.post("/api/automation/outreach-chain/:websiteId/enqueue", async (req, res) => {
  try {
    return res.json(await enqueueOutreachChainJobs(req.params.websiteId, {
      dryRun: req.body?.dryRun !== false,
    }));
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

app.post("/api/automation/reply-inbox/:websiteId", async (req, res) => {
  try {
    return res.status(201).json({ reply: await createAutomationInboundReply(req.params.websiteId, req.body ?? {}) });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

app.get("/api/automation/reply-revenue-chain/:websiteId/plan", async (req, res) => {
  try {
    return res.json(await planReplyRevenueChainJobs(req.params.websiteId));
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

app.post("/api/automation/reply-revenue-chain/:websiteId/enqueue", async (req, res) => {
  try {
    return res.json(await enqueueReplyRevenueChainJobs(req.params.websiteId, {
      dryRun: req.body?.dryRun !== false,
    }));
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

app.post("/api/automation/run-cycle", async (req, res) => {
  try {
    const run = await runAutomationCycle({
      requestedBy: "mission_control",
      maxJobs: req.body?.maxJobs,
    });
    return res.json({ run });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

app.get("/api/automation/orchestrator/status", async (_req, res) => {
  return res.json({
    orchestrator: await getOrchestratorStatus(),
    scheduler: await getSchedulerStatus(),
  });
});

app.post("/api/automation/orchestrator/website/:websiteId", async (req, res) => {
  try {
    return res.json(await orchestrateWebsite(req.params.websiteId, {
      dryRun: req.body?.dryRun,
      executeCycles: req.body?.executeCycles !== false,
      maxDepth: req.body?.maxDepth,
      requestedBy: "mission_control",
    }));
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

app.post("/api/automation/scheduler/run", async (req, res) => {
  try {
    if (typeof req.body?.enabled === "boolean") {
      await setSchedulerEnabled(req.body.enabled);
    }
    const result = await runAutomationSchedulerOnce({
      dryRun: req.body?.dryRun,
      maxWebsites: req.body?.maxWebsites,
      maxDepth: req.body?.maxDepth,
      requestedBy: "mission_control",
    });
    return res.json(result);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

app.get("/api/automation/orchestration/logs", async (req, res) => {
  return res.json({ logs: await listOrchestrationLogs({ limit: req.query?.limit }) });
});

app.get("/api/automation/runs", async (req, res) => {
  return res.json({ runs: await listAutomationRuns({ limit: req.query?.limit }) });
});

app.get("/api/automation/logs", async (req, res) => {
  return res.json({ logs: await listAutomationLogs({ limit: req.query?.limit }) });
});

app.get("/api/exceptions", async (_req, res) => {
  const view = await buildWebsiteApiView();
  return res.json({
    version: view.version,
    exceptions: view.exceptionQueue.open,
    metrics: view.exceptionQueue.metrics,
    stages: view.stages,
  });
});

app.get("/api/exceptions/:exceptionId", async (req, res) => {
  const view = await buildWebsiteApiView();
  const exception = view.exceptionQueue.exceptions.find((item) => item.exceptionId === req.params.exceptionId);
  if (!exception) return res.status(404).json({ error: "Exception not found." });
  const website = getWebsiteById(view, exception.websiteId);
  return res.json({ exception, website });
});

function retryActionForException(exception) {
  if (exception.category === "generation" && exception.message.toLowerCase().includes("asset")) return "generate_assets";
  if (exception.category === "generation" && exception.message.toLowerCase().includes("screenshot")) return "render_screenshots";
  if (exception.category === "generation" && exception.message.toLowerCase().includes("preview")) return "generate_preview";
  if (exception.category === "deployment") return "deploy_preview";
  return "";
}

app.post("/api/exceptions/:exceptionId/actions/:action", async (req, res) => {
  try {
    const view = await buildWebsiteApiView();
    const exception = view.exceptionQueue.exceptions.find((item) => item.exceptionId === req.params.exceptionId);
    if (!exception) return res.status(404).json({ error: "Exception not found." });
    const action = req.params.action;
    let statePatch = {};
    if (action === "mark_resolved") {
      statePatch = { status: "resolved", resolvedAt: new Date().toISOString(), notes: req.body?.notes };
    } else if (action === "escalate") {
      statePatch = { status: "open", escalated: true, notes: req.body?.notes };
    } else if (action === "manual_review") {
      statePatch = { status: "manual_review", manualReview: true, notes: req.body?.notes };
    } else if (action === "retry_automation") {
      const retryAction = retryActionForException(exception);
      if (exception.category === "deployment") {
        const website = getWebsiteById(view, exception.websiteId);
        if (!website) return res.status(404).json({ error: "Website not found." });
        await deployWebsitePreview(website, { confirmOverwrite: Boolean(req.body?.confirmOverwrite) });
        await appendWebsiteEvent(exception.websiteId, {
          type: "deployment_retry_requested",
          label: "Deployment retry requested",
          detail: exception.message,
          source: "exception_queue",
          metadata: { exceptionId: exception.exceptionId },
        });
      }
      if (retryAction) {
        await appendWebsiteEvent(exception.websiteId, {
          type: "exception_retry_requested",
          label: `Retry requested: ${exception.category}`,
          detail: `Recommended retry action: ${retryAction}`,
          source: "exception_queue",
        });
      }
      statePatch = { status: "open", retryCount: Number(exception.retryCount || 0) + 1, notes: retryAction ? `Retry requested: ${retryAction}` : "No safe automatic retry mapped." };
    } else {
      return res.status(400).json({ error: `Unknown exception action: ${action}` });
    }
    const exceptionState = await updateWebsiteExceptionAction(exception.exceptionId, statePatch);
    await appendWebsiteEvent(exception.websiteId, {
      type: `exception_${action}`,
      label: `Exception ${action.replace(/_/g, " ")}`,
      detail: exception.message,
      source: "exception_queue",
      metadata: { exceptionId: exception.exceptionId },
    });
    const nextView = await buildWebsiteApiView();
    return res.json({
      ok: true,
      exceptionState,
      exceptions: nextView.exceptionQueue.open,
      metrics: nextView.exceptionQueue.metrics,
    });
  } catch (err) {
    return res.status(err.statusCode || 400).json({ error: err.message });
  }
});

app.get("/api/websites/:websiteId", async (req, res) => {
  const view = await buildWebsiteApiView();
  const website = getWebsiteById(view, req.params.websiteId);
  if (!website) return res.status(404).json({ error: "Website not found." });
  return res.json({ website, stages: view.stages });
});

app.get("/api/websites/:websiteId/timeline", async (req, res) => {
  const view = await buildWebsiteApiView();
  const website = getWebsiteById(view, req.params.websiteId);
  if (!website) return res.status(404).json({ error: "Website not found." });
  return res.json({ websiteId: website.websiteId, timeline: website.timeline });
});

app.get("/api/websites/:websiteId/exceptions", async (req, res) => {
  const view = await buildWebsiteApiView();
  const website = getWebsiteById(view, req.params.websiteId);
  if (!website) return res.status(404).json({ error: "Website not found." });
  return res.json({ websiteId: website.websiteId, exceptions: website.exceptions });
});

async function getWebsiteForAction(websiteId) {
  const view = await buildWebsiteApiView();
  const website = getWebsiteById(view, websiteId);
  if (!website) return { view, website: null };
  return { view, website };
}

function latestWebsiteProposal(website) {
  return [...(website.revenue?.proposals ?? [])].sort((a, b) =>
    String(b.createdAt || b.sentAt).localeCompare(String(a.createdAt || a.sentAt))
  )[0] ?? null;
}

async function deployWebsitePreview(website, { confirmOverwrite = false } = {}) {
  if (!website.preview?.previewExists || !website.preview?.previewDirBase) {
    throw new Error("Cannot deploy because no generated preview artifact exists.");
  }
  const latestQc = await latestWebsiteQcRecord(website.websiteId);
  if (!latestQc?.passed) {
    const err = new Error("Deployment requires a passing deterministic QC run.");
    err.statusCode = 400;
    throw err;
  }
  if (website.deployedUrl && !confirmOverwrite) {
    const err = new Error("A deployed URL already exists. Confirm overwrite before deploying again.");
    err.statusCode = 409;
    throw err;
  }
  await setWebsiteFactoryStatus(website.websiteId, "deploying", {
    source: "deploy_preview",
    notes: "Public preview deployment started.",
  });
  let result;
  try {
    result = await deployStaticPreview({
      websiteId: website.websiteId,
      leadId: website.mapping.leadId,
      sitePath: join(PREVIEWS_ROOT, website.preview.previewDirBase),
      metadata: {
        name: website.businessName,
      },
    });
  } catch (err) {
    await setWebsiteFactoryStatus(website.websiteId, "deploy_failed", {
      source: "deploy_preview",
      notes: err.message,
    });
    throw err;
  }
  await appendWebsiteEvent(website.websiteId, {
    type: "preview_deployed",
    label: "Public preview deployed",
    detail: result.deployedUrl,
    source: "deployment",
    metadata: { deploymentId: result.deploymentId, provider: result.provider },
  });
  await setWebsiteFactoryStatus(website.websiteId, result.status === "ready" && result.deployedUrl ? "deployed" : "deploying", {
    source: "deploy_preview",
    notes: result.deployedUrl || "Deployment created but public URL is not ready yet.",
    metadata: { deploymentRecordId: result.deploymentRecordId, deployedUrl: result.deployedUrl },
  });
  return result;
}

app.post("/api/websites/:websiteId/actions/:action", async (req, res) => {
  try {
    const { website } = await getWebsiteForAction(req.params.websiteId);
    if (!website) return res.status(404).json({ error: "Website not found." });
    const action = req.params.action;
    const body = req.body ?? {};
    const leadId = website.mapping.leadId;
    const revenueId = website.mapping.revenueId;
    const fulfillmentId = website.mapping.fulfillmentId;
    const clientId = website.mapping.clientId;
    const siteId = website.mapping.siteId;
    let result = null;

    if (action === "refresh_research") {
      if (!leadId) return res.status(400).json({ error: "Website has no lead record to refresh." });
      await setWebsiteFactoryStatus(website.websiteId, "researching", { source: action, notes: "Research refresh started." });
      const lead = await findLeadWithMeta(leadId);
      const { fields } = await enrichLeadFields(lead);
      result = await updateLeadMissionControl(leadId, {
        ...fields,
        activity: { type: "website_research_refreshed", summary: "Research refreshed from Website Detail." },
      });
      await setWebsiteFactoryStatus(website.websiteId, "researched", { source: action, notes: "Research refreshed." });
      await appendWebsiteEvent(website.websiteId, { type: "research_refreshed", label: "Research refreshed", source: "website_action" });
    } else if (action === "approve_research") {
      if (!leadId) return res.status(400).json({ error: "Website has no lead record to approve." });
      result = await updateLeadMissionControl(leadId, {
        websiteResearchApprovedAt: new Date().toISOString(),
        pipelineStage: "preview_ready",
        activity: { type: "research_approved", summary: "Research approved from Website Detail." },
      });
      await setWebsiteFactoryStatus(website.websiteId, "researched", { source: action, notes: "Research approved." });
      await appendWebsiteEvent(website.websiteId, { type: "research_approved", label: "Research approved", detail: "Lifecycle advanced to generation.", source: "website_action" });
    } else if (action === "generate_preview" || action === "regenerate_preview") {
      if (!leadId) return res.status(400).json({ error: "Website has no lead record for preview generation." });
      await setWebsiteFactoryStatus(website.websiteId, "generating", { source: action, notes: "Preview generation started." });
      const lead = await findLead(leadId);
      result = await generatePreviewSiteV3(lead);
      await updateLeadMissionControl(leadId, {
        previewStatus: "generated",
        pipelineStage: "preview_ready",
        previewGeneratedAt: new Date().toISOString(),
        activity: { type: action, summary: action === "regenerate_preview" ? "Preview regenerated from Website Detail." : "Preview generated from Website Detail." },
      });
      await setWebsiteFactoryStatus(website.websiteId, "generated", { source: action, notes: "Preview generated." });
      await appendWebsiteEvent(website.websiteId, { type: action, label: action === "regenerate_preview" ? "Preview regenerated" : "Preview generated", source: "website_action" });
    } else if (action === "generate_assets") {
      if (!leadId) return res.status(400).json({ error: "Website has no lead record for asset generation." });
      const lead = await findLead(leadId);
      result = await prepareAssetsForLead(lead);
      await updateLeadMissionControl(leadId, {
        previewStatus: "assets_ready",
        pipelineStage: "preview_ready",
        activity: { type: "assets_generated", summary: "Assets generated from Website Detail." },
      });
      await setWebsiteFactoryStatus(website.websiteId, "generated", { source: action, notes: "Assets generated." });
      await appendWebsiteEvent(website.websiteId, { type: "assets_generated", label: "Assets generated", source: "website_action" });
    } else if (action === "render_screenshots") {
      if (!leadId) return res.status(400).json({ error: "Website has no lead record for screenshot rendering." });
      const lead = await findLead(leadId);
      result = await renderPreviewV3Screenshots(lead);
      await updateLeadMissionControl(leadId, {
        previewStatus: "rendered",
        activity: { type: "screenshots_rendered", summary: "Screenshots rendered from Website Detail." },
      });
      await setWebsiteFactoryStatus(website.websiteId, "preview_ready", { source: action, notes: "Screenshots rendered." });
      await appendWebsiteEvent(website.websiteId, { type: "screenshots_rendered", label: "Screenshots rendered", source: "website_action" });
    } else if (action === "run_qc") {
      await setWebsiteFactoryStatus(website.websiteId, "qc_running", { source: action, notes: "Deterministic QC started." });
      result = await runWebsiteQc(website);
      await setWebsiteFactoryStatus(website.websiteId, result.passed ? "qc_passed" : "qc_failed", {
        source: action,
        notes: result.passed ? "Deterministic QC passed." : "Deterministic QC failed.",
        metadata: { qcId: result.qcId },
      });
      await appendWebsiteEvent(website.websiteId, {
        type: "qc_run",
        label: result.passed ? "Deterministic QC passed" : "Deterministic QC failed",
        detail: `${result.checks.filter((check) => check.status === "fail").length} failing check(s).`,
        source: "qc",
        metadata: { qcId: result.qcId },
      });
    } else if (action === "approve_qc") {
      if (!leadId) return res.status(400).json({ error: "Website has no lead record for QC approval." });
      result = await updateLeadMissionControl(leadId, {
        previewStatus: "approved",
        previewApprovedAt: new Date().toISOString(),
        websiteQcApprovedAt: new Date().toISOString(),
        pipelineStage: "preview_ready",
        qcNotes: body.notes,
        activity: { type: "qc_approved", summary: "QC approved from Website Detail." },
      });
      await setWebsiteFactoryStatus(website.websiteId, "qc_passed", { source: action, notes: body.notes || "QC approved." });
      await appendWebsiteEvent(website.websiteId, { type: "qc_approved", label: "QC approved", detail: body.notes || "Lifecycle advanced to deployment.", source: "website_action" });
    } else if (action === "reject_qc" || action === "add_qc_notes") {
      if (!leadId) return res.status(400).json({ error: "Website has no lead record for QC notes." });
      const rejected = action === "reject_qc";
      result = await updateLeadMissionControl(leadId, {
        qcStatus: rejected ? "rejected" : body.status || "notes_added",
        qcNotes: body.notes,
        activity: { type: action, summary: rejected ? "QC rejected from Website Detail." : "QC notes added from Website Detail." },
      });
      if (rejected) {
        await setWebsiteFactoryStatus(website.websiteId, "qc_failed", { source: action, notes: body.notes || "QC rejected." });
      }
      await appendWebsiteEvent(website.websiteId, { type: action, label: rejected ? "QC rejected" : "QC notes added", detail: body.notes || "", source: "website_action" });
    } else if (action === "add_reply") {
      if (!leadId && !revenueId) return res.status(400).json({ error: "Website has no lead or revenue record for reply capture." });
      if (leadId && !revenueId) {
        const lead = await findLeadWithMeta(leadId);
        await createRevenueRecordForLead(lead);
      }
      result = await logRevenueReply(revenueId ? { revenueId } : { leadId }, body);
      if (leadId) {
        await updateLeadMissionControl(leadId, {
          pipelineStage: "replied",
          replyStatus: body.sentiment === "not_interested" ? "lost" : "replied",
          activity: { type: "reply_logged", summary: body.nextAction || body.replyText || "Reply logged from Website Detail." },
        });
      }
      await setWebsiteFactoryStatus(website.websiteId, body.sentiment === "not_interested" ? "lost" : "replied", {
        source: action,
        notes: body.nextAction || body.replyText || "Reply logged.",
      });
      await appendWebsiteEvent(website.websiteId, { type: "reply_logged", label: "Reply logged", detail: body.nextAction || body.replyText || "", source: "website_action" });
    } else if (action === "schedule_meeting") {
      if (!leadId && !revenueId) return res.status(400).json({ error: "Website has no lead or revenue record for meeting capture." });
      if (leadId && !revenueId) {
        const lead = await findLeadWithMeta(leadId);
        await createRevenueRecordForLead(lead);
      }
      result = await logRevenueMeeting(revenueId ? { revenueId } : { leadId }, body);
      await appendWebsiteEvent(website.websiteId, { type: "meeting_scheduled", label: "Meeting scheduled", detail: body.expectedOutcome || body.notes || "", source: "website_action" });
    } else if (action === "create_proposal") {
      if (!leadId) return res.status(400).json({ error: "Website has no lead record for proposal generation." });
      const lead = await findLeadWithMeta(leadId);
      const proposal = generateProposalForLead({ ...lead, ...body });
      await createRevenueRecordForLead(lead);
      result = await logRevenueProposal({ leadId }, {
        proposalId: proposal.proposalId || proposal.id,
        sentAt: proposal.generatedAt || new Date().toISOString(),
        amount: body.amount || lead.estimatedDealValue || proposal.pricingEstimate,
        monthlyAmount: body.monthlyAmount || 50,
        activationFee: body.activationFee || 150,
        status: "sent",
        proposalNotes: proposal.summary || body.notes || "Proposal generated from Website Detail.",
        checkoutUrl: body.checkoutUrl || "",
      });
      await updateLeadMissionControl(leadId, {
        currentProposal: proposal,
        proposalHistory: [...(lead.proposalHistory ?? []), proposal].slice(-20),
        proposalStatus: "draft",
        dealStage: lead.dealStage === "discovery" || lead.dealStage === "contacted" ? "quoting" : lead.dealStage,
        activity: { type: "proposal_generated", summary: "Proposal generated from Website Detail." },
      });
      await appendWebsiteEvent(website.websiteId, { type: "proposal_created", label: "Proposal created", detail: proposal.summary || "", source: "website_action" });
    } else if (action === "proposal_viewed" || action === "proposal_accepted") {
      if (!revenueId) return res.status(400).json({ error: "Website has no revenue record for proposal updates." });
      const proposal = latestWebsiteProposal(website);
      if (!proposal) return res.status(400).json({ error: "Website has no proposal to update." });
      result = await updateRevenueProposal({ revenueId }, proposal.proposalId, {
        status: action === "proposal_accepted" ? "accepted" : "viewed",
      });
      if (leadId && action === "proposal_accepted") {
        await updateLeadMissionControl(leadId, {
          proposalStatus: "accepted",
          dealStage: "won",
          activity: { type: "proposal_accepted", summary: "Proposal accepted from Website Detail." },
        });
        await setWebsiteFactoryStatus(website.websiteId, "won", { source: action, notes: "Proposal accepted." });
      }
      await appendWebsiteEvent(website.websiteId, { type: action, label: action === "proposal_accepted" ? "Proposal accepted" : "Proposal viewed", source: "website_action" });
    } else if (action === "start_checkout") {
      if (!clientId) return res.status(400).json({ error: "Website has no client record for Stripe checkout." });
      const operations = await getClientOperationsView();
      const client = operations.clients.find((item) => item.clientId === clientId);
      if (!client) return res.status(404).json({ error: "Client not found." });
      const origin = `${req.protocol}://${req.get("host")}`;
      const session = await createMaintenanceCheckoutSession({ client, origin });
      await linkRevenueClient({ clientId });
      await transitionRevenueStageIfEarlier({ clientId }, "checkout_started", "Stripe Checkout session created from Website Detail.");
      result = session;
      await appendWebsiteEvent(website.websiteId, { type: "checkout_started", label: "Checkout started", detail: session.url || "", source: "website_action" });
    } else if (action === "fulfillment_checklist") {
      if (!fulfillmentId) return res.status(400).json({ error: "Website has no fulfillment record." });
      if (body.key === "create_site_record" && body.status === "complete" && !siteId) {
        return res.status(400).json({ error: "Link or create a site before completing this checklist item." });
      }
      result = await updateFulfillmentChecklistItem(fulfillmentId, body.key, {
        status: body.status,
        notes: body.notes,
      });
      await appendWebsiteEvent(website.websiteId, { type: "fulfillment_checklist_updated", label: `Checklist updated: ${body.key}`, detail: `${body.status || "updated"} ${body.notes || ""}`.trim(), source: "website_action" });
    } else if (action === "link_site") {
      if (!fulfillmentId) return res.status(400).json({ error: "Website has no fulfillment record to link a site." });
      result = await linkFulfillmentSite(fulfillmentId, body.siteId);
      await appendWebsiteEvent(website.websiteId, { type: "site_linked", label: "Site linked", detail: body.siteId || "", source: "website_action" });
    } else if (action === "create_maintenance_request") {
      if (!clientId) return res.status(400).json({ error: "Website has no client record for maintenance intake." });
      result = await createMaintenanceRequest({
        ...body,
        clientId,
        siteId: body.siteId || siteId,
        fulfillmentId: fulfillmentId || body.fulfillmentId,
        title: body.title || "Website maintenance request",
        status: body.status || "submitted",
      });
      if (fulfillmentId) {
        await updateFulfillmentChecklistItem(fulfillmentId, "create_first_maintenance_request_option", {
          status: "complete",
          notes: `Linked maintenance request ${result.requestId}.`,
        });
      }
      await appendWebsiteEvent(website.websiteId, { type: "maintenance_request_created", label: "Maintenance request created", detail: result.title, source: "website_action" });
    } else if (action === "update_maintenance_request" || action === "add_maintenance_notes") {
      result = await patchMaintenanceRequest(body.requestId, {
        status: body.status,
        notes: body.notes,
      });
      await appendWebsiteEvent(website.websiteId, { type: action, label: action === "update_maintenance_request" ? "Maintenance request updated" : "Maintenance notes added", detail: `${result.title} ${result.status}`.trim(), source: "website_action" });
    } else if (action === "deployment_complete") {
      if (fulfillmentId) {
        result = await updateFulfillmentChecklistItem(fulfillmentId, "launch_site", {
          status: "complete",
          notes: body.notes || "Deployment marked complete from Website Detail.",
        });
      }
      await appendWebsiteEvent(website.websiteId, { type: "deployment_complete", label: "Deployment complete", detail: body.notes || "Lifecycle advanced to live when site is linked.", source: "website_action" });
    } else if (action === "deploy_preview") {
      result = await deployWebsitePreview(website, { confirmOverwrite: Boolean(body.confirmOverwrite) });
    } else if (action === "draft_outreach") {
      result = await createOutreachDraft({
        website,
        subject: body.subject,
        body: body.body,
        channel: body.channel || "email",
        to: body.to,
      });
      if (leadId) {
        await createRevenueRecordForLead(website.lead ?? {});
        await transitionRevenueStageIfEarlier({ leadId }, "outreach_prepared", "Website outreach drafted.");
      }
      await setWebsiteFactoryStatus(website.websiteId, "outreach_drafted", { source: action, notes: "Outreach draft created.", metadata: { outreachId: result.outreachId } });
      await appendWebsiteEvent(website.websiteId, { type: "outreach_drafted", label: "Outreach drafted", detail: result.subject, source: "outreach", metadata: { outreachId: result.outreachId } });
    } else if (action === "approve_outreach") {
      const outreach = body.outreachId ? { outreachId: body.outreachId } : await latestOutreachForWebsite(website.websiteId);
      if (!outreach?.outreachId) return res.status(400).json({ error: "Website has no outreach draft to approve." });
      result = await approveAndQueueOutreach(outreach.outreachId);
      await setWebsiteFactoryStatus(website.websiteId, "outreach_queued", { source: action, notes: "Outreach approved and queued.", metadata: { outreachId: result.outreachId } });
      await appendWebsiteEvent(website.websiteId, { type: "outreach_queued", label: "Outreach queued", detail: result.subject, source: "outreach", metadata: { outreachId: result.outreachId } });
    } else if (action === "mark_outreach_sent") {
      const outreach = body.outreachId ? { outreachId: body.outreachId } : await latestOutreachForWebsite(website.websiteId);
      if (!outreach?.outreachId) return res.status(400).json({ error: "Website has no queued outreach to mark sent." });
      result = await markOutreachSent(outreach.outreachId, body);
      if (leadId) {
        await appendOutreachHistory(leadId, {
          subject: result.subject,
          body: result.body,
          channel: result.channel,
          replyStatus: "contacted",
          action: "outreach_sent",
          notes: body.notes || "Outreach marked sent from Website Detail.",
        });
      }
      if (leadId) await transitionRevenueStageIfEarlier({ leadId }, "outreach_sent", body.notes || "Outreach marked sent.");
      await setWebsiteFactoryStatus(website.websiteId, "outreach_sent", { source: action, notes: "Outreach marked sent.", metadata: { outreachId: result.outreachId } });
      await appendWebsiteEvent(website.websiteId, { type: "outreach_sent", label: "Outreach sent", detail: result.subject, source: "outreach", metadata: { outreachId: result.outreachId } });
    } else if (action === "mark_won") {
      if (revenueId) await markRevenueWon({ revenueId }, body.notes || "Marked won from Website Detail.");
      else if (leadId) {
        await createRevenueRecordForLead(website.lead ?? {});
        await markRevenueWon({ leadId }, body.notes || "Marked won from Website Detail.");
      }
      if (leadId) {
        await updateLeadMissionControl(leadId, {
          pipelineStage: "won",
          replyStatus: "won",
          dealStage: "won",
          activity: { type: "deal_won", summary: body.notes || "Deal marked won from Website Detail." },
        });
      }
      await setWebsiteFactoryStatus(website.websiteId, "won", { source: action, notes: body.notes || "Deal marked won." });
      await appendWebsiteEvent(website.websiteId, { type: "deal_won", label: "Deal marked won", detail: body.notes || "", source: "website_action" });
      result = { status: "won" };
    } else if (action === "mark_lost") {
      if (revenueId) await markRevenueLost({ revenueId }, body.reason || body.notes || "Marked lost from Website Detail.");
      if (leadId) {
        await updateLeadMissionControl(leadId, {
          pipelineStage: "lost",
          replyStatus: "lost",
          dealStage: "lost",
          activity: { type: "deal_lost", summary: body.reason || body.notes || "Deal marked lost from Website Detail." },
        });
      }
      await setWebsiteFactoryStatus(website.websiteId, "lost", { source: action, notes: body.reason || body.notes || "Deal marked lost." });
      await appendWebsiteEvent(website.websiteId, { type: "deal_lost", label: "Deal marked lost", detail: body.reason || body.notes || "", source: "website_action" });
      result = { status: "lost" };
    } else {
      return res.status(400).json({ error: `Unknown website action: ${action}` });
    }

    const nextView = await buildWebsiteApiView();
    const nextWebsite = getWebsiteById(nextView, website.websiteId);
    return res.json({ ok: true, action, result, website: nextWebsite, stages: nextView.stages });
  } catch (err) {
    return res.status(err.statusCode || 400).json({ error: err.message });
  }
});

app.post("/api/fulfillment/from-client/:clientId", async (req, res) => {
  try {
    const [operations, revenueRecord] = await Promise.all([
      getClientOperationsView(),
      getRevenueRecord({ clientId: req.params.clientId }),
    ]);
    const client = operations.clients.find((item) => item.clientId === req.params.clientId);
    if (!client) return res.status(404).json({ error: "Client not found." });
    const record = await createFulfillmentRecord({
      clientId: client.clientId,
      revenueId: req.body?.revenueId || revenueRecord?.revenueId || "",
      leadId: req.body?.leadId || revenueRecord?.leadId || client.sourceLeadId || "",
      siteId: req.body?.siteId || "",
    });
    return res.status(201).json({ record });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

app.patch("/api/fulfillment/:fulfillmentId/site", async (req, res) => {
  try {
    const record = await linkFulfillmentSite(req.params.fulfillmentId, req.body?.siteId);
    if (!record) return res.status(404).json({ error: "Fulfillment record not found." });
    return res.json({ record });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

app.patch("/api/fulfillment/:fulfillmentId/checklist/:key", async (req, res) => {
  try {
    const current = (await listFulfillmentRecords()).find((item) => item.fulfillmentId === req.params.fulfillmentId);
    if (!current) return res.status(404).json({ error: "Fulfillment record not found." });
    if (req.params.key === "create_site_record" && req.body?.status === "complete" && !current.siteId) {
      return res.status(400).json({ error: "Link or create an Operations site record before completing this checklist item." });
    }
    const record = await updateFulfillmentChecklistItem(req.params.fulfillmentId, req.params.key, req.body ?? {});
    return res.json({ record });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

app.post("/api/fulfillment/:fulfillmentId/maintenance-requests", async (req, res) => {
  try {
    const fulfillment = (await listFulfillmentRecords()).find((item) => item.fulfillmentId === req.params.fulfillmentId);
    if (!fulfillment) return res.status(404).json({ error: "Fulfillment record not found." });
    const request = await createMaintenanceRequest({
      ...req.body,
      fulfillmentId: fulfillment.fulfillmentId,
      clientId: req.body?.clientId || fulfillment.clientId,
      siteId: req.body?.siteId || fulfillment.siteId,
      title: req.body?.title || "First maintenance request",
      requestType: req.body?.requestType || "other",
      status: req.body?.status || "submitted",
    });
    await updateFulfillmentChecklistItem(fulfillment.fulfillmentId, "create_first_maintenance_request_option", {
      status: "complete",
      notes: `Linked maintenance request ${request.requestId}.`,
    });
    return res.status(201).json({ request });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

app.post("/api/revenue/from-lead/:id", async (req, res) => {
  try {
    const lead = await findLeadWithMeta(req.params.id);
    if (!lead) return res.status(404).json({ error: "Lead not found." });
    const record = await createRevenueRecordForLead(lead, {
      currentStage: req.body?.currentStage || "lead",
      estimatedValue: req.body?.estimatedValue,
    });
    return res.status(201).json({
      record,
      revenue: await getRevenuePipelineView({
        leads: await listLeadsWithMeta(),
        clients: (await getClientOperationsView()).clients,
        fulfillmentRecords: await listFulfillmentRecords(),
      }),
    });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

app.get("/api/revenue/lead/:id", async (req, res) => {
  const record = await getRevenueRecord({ leadId: req.params.id });
  return res.json({ record });
});

app.post("/api/revenue/lead/:id/replies", async (req, res) => {
  try {
    const lead = await findLeadWithMeta(req.params.id);
    if (!lead) return res.status(404).json({ error: "Lead not found." });
    await createRevenueRecordForLead(lead);
    const result = await logRevenueReply({ leadId: lead.id }, req.body ?? {});
    await updateLeadMissionControl(lead.id, {
      replyStatus: req.body?.sentiment === "not_interested" ? "no_response" : "replied",
      pipelineStage: req.body?.sentiment === "interested" ? "interested" : "replied",
      followUpNeeded: Boolean(req.body?.followUpDate || req.body?.nextAction),
      nextFollowUpAt: req.body?.followUpDate || null,
      notes: req.body?.nextAction,
      activity: {
        type: "reply_logged",
        summary: `Reply logged (${req.body?.channel || "other"} / ${req.body?.sentiment || "neutral"}).`,
      },
    });
    return res.status(201).json(result);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

app.post("/api/revenue/lead/:id/meetings", async (req, res) => {
  try {
    const lead = await findLeadWithMeta(req.params.id);
    if (!lead) return res.status(404).json({ error: "Lead not found." });
    await createRevenueRecordForLead(lead);
    const result = await logRevenueMeeting({ leadId: lead.id }, req.body ?? {});
    await updateLeadMissionControl(lead.id, {
      replyStatus: "replied",
      pipelineStage: "interested",
      dealStage: "negotiating",
      activity: {
        type: "meeting_scheduled",
        summary: `Meeting scheduled for ${req.body?.scheduledAt || "unspecified time"}.`,
      },
    });
    return res.status(201).json(result);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

app.patch("/api/revenue/:revenueId/stage", async (req, res) => {
  try {
    const record = await transitionRevenueStage(
      { revenueId: req.params.revenueId },
      req.body?.stage,
      req.body?.notes || "Manual revenue stage update."
    );
    if (!record) return res.status(404).json({ error: "Revenue record not found." });
    if (record.currentStage === "activated" && record.clientId) {
      await createFulfillmentRecord({
        clientId: record.clientId,
        revenueId: record.revenueId,
        leadId: record.leadId,
      });
    }
    return res.json({
      record,
      revenue: await getRevenuePipelineView({
        leads: await listLeadsWithMeta(),
        clients: (await getClientOperationsView()).clients,
        fulfillmentRecords: await listFulfillmentRecords(),
      }),
    });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

app.post("/api/revenue/:revenueId/replies", async (req, res) => {
  try {
    const result = await logRevenueReply({ revenueId: req.params.revenueId }, req.body ?? {});
    if (!result) return res.status(404).json({ error: "Revenue record not found." });
    return res.status(201).json(result);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

app.post("/api/revenue/:revenueId/meetings", async (req, res) => {
  try {
    const result = await logRevenueMeeting({ revenueId: req.params.revenueId }, req.body ?? {});
    if (!result) return res.status(404).json({ error: "Revenue record not found." });
    return res.status(201).json(result);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

app.post("/api/revenue/:revenueId/proposals", async (req, res) => {
  try {
    const result = await logRevenueProposal({ revenueId: req.params.revenueId }, req.body ?? {});
    if (!result) return res.status(404).json({ error: "Revenue record not found." });
    return res.status(201).json(result);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

app.patch("/api/revenue/:revenueId/proposals/:proposalId", async (req, res) => {
  try {
    const result = await updateRevenueProposal(
      { revenueId: req.params.revenueId },
      req.params.proposalId,
      req.body ?? {}
    );
    if (!result) return res.status(404).json({ error: "Revenue proposal not found." });

    let checkoutSession = null;
    if (req.body?.status === "accepted" && result.record.clientId) {
      const operations = await getClientOperationsView();
      const client = operations.clients.find((item) => item.clientId === result.record.clientId);
      if (client) {
        const origin = `${req.protocol}://${req.get("host")}`;
        checkoutSession = await createMaintenanceCheckoutSession({ client, origin });
        await attachRevenueCheckoutUrl(
          { revenueId: result.record.revenueId },
          checkoutSession.url,
          "Proposal accepted; Stripe checkout created."
        );
      }
    }
    return res.json({ ...result, checkoutSession });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

app.patch("/api/revenue/:revenueId/checkout-url", async (req, res) => {
  try {
    const record = await attachRevenueCheckoutUrl(
      { revenueId: req.params.revenueId },
      req.body?.checkoutUrl,
      req.body?.notes || "Checkout URL attached manually."
    );
    if (!record) return res.status(404).json({ error: "Revenue record not found." });
    return res.json({ record });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

app.patch("/api/revenue/:revenueId/client", async (req, res) => {
  try {
    const record = await attachRevenueClient({ revenueId: req.params.revenueId }, req.body?.clientId);
    if (!record) return res.status(404).json({ error: "Revenue record not found." });
    return res.json({ record });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

app.post("/api/revenue/:revenueId/lost", async (req, res) => {
  try {
    const record = await markRevenueLost(
      { revenueId: req.params.revenueId },
      req.body?.reason || "Marked lost by operator."
    );
    if (!record) return res.status(404).json({ error: "Revenue record not found." });
    return res.json({ record });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
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
    await linkRevenueClient({ clientId: client.clientId });
    await transitionRevenueStageIfEarlier(
      { clientId: client.clientId },
      "checkout_started",
      "Stripe Checkout session created."
    );
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
    await linkRevenueClient({
      leadId: lead.id,
      clientId: client.clientId,
      estimatedValue: req.body?.estimatedValue,
    });
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
  await createRevenueRecordForLead(lead);
  await transitionRevenueStageIfEarlier(
    { leadId: lead.id },
    "outreach_prepared",
    "Outreach draft generated."
  );
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
    await createRevenueRecordForLead(lead);
    await transitionRevenueStageIfEarlier(
      { leadId: lead.id },
      "outreach_prepared",
      "Field test outreach package prepared."
    );
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
    await createRevenueRecordForLead(lead);
    await transitionRevenueStageIfEarlier(
      { leadId: lead.id },
      "outreach_sent",
      req.body?.notes || "Field test outreach executed."
    );
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
      const stage =
        status === "rejected"
          ? "lost"
          : status === "meeting_booked"
            ? "meeting_scheduled"
            : status === "interested"
              ? "interested"
              : status === "replied"
                ? "replied"
                : null;
      if (stage) {
        await transitionRevenueStageIfEarlier(
          { leadId: slot.leadId },
          stage,
          req.body?.notes || `Field test outcome: ${status}.`
        );
      }
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
    await createRevenueRecordForLead(lead);
    await logRevenueProposal({ leadId: lead.id }, {
      proposalId: proposal.proposalId || proposal.id,
      sentAt: proposal.generatedAt || new Date().toISOString(),
      amount: req.body?.amount || lead.estimatedDealValue || proposal.pricingEstimate,
      monthlyAmount: req.body?.monthlyAmount || 50,
      activationFee: req.body?.activationFee || 150,
      status: "sent",
      proposalNotes: proposal.summary || "Proposal generated from Lead Detail.",
      checkoutUrl: req.body?.checkoutUrl || "",
    });
    await transitionRevenueStageIfEarlier(
      { leadId: lead.id },
      "proposal_sent",
      "Proposal generated."
    );
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
    await createRevenueRecordForLead(lead);
    await transitionRevenueStageIfEarlier(
      { leadId: lead.id },
      "outreach_sent",
      req.body?.notes || "Outreach history appended."
    );
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
  const websiteView = await buildWebsiteApiView();
  summary.factoryExceptions = websiteView.exceptionQueue.metrics;
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
  const schedulerStarted = await maybeStartScheduler();
  console.log(`Automation scheduler ${schedulerStarted ? "started" : "not started"}.`);
  const hasFrontendDist = await fileExists(FRONTEND_DIST);
  if (hasFrontendDist) {
    app.use(express.static(FRONTEND_DIST));
    app.get(/.*/, serveFrontendApp);
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
