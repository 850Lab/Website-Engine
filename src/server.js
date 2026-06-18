import express from "express";
import cookieParser from "cookie-parser";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { getAdminSystemStatus } from "./admin-tools.js";
import {
  handleStripeWebhookEvent,
  verifyStripeWebhookPayload,
} from "./stripe-billing.js";
import { registerV7OperatorRoutes, registerV7Routes } from "./v7/index.js";
import { registerStage1Routes } from "./stage1/index.js";
import { registerOpportunityEngineRoutes } from "./opportunity-engine/index.js";
import { migrateRecordsToIdentities } from "./identity/migrate-identities.js";
import { isWorkerJobPath, validateWorkerAuth } from "./worker-auth.js";
import { registerFounderOsRoutes } from "./founder-os/index.js";
import {
  registerTwilioCallRoutes,
  registerTwilioVoiceWebhookRoutes,
  syncEnvTwilioToBlobIfEmpty,
} from "./twilio-voice/index.js";
import {
  createOperator,
  createOperatorSession,
  destroyOperatorSession,
  getSessionForRequest,
  hasOperators,
  listOperators,
  migrateLegacyAdminAccountIfNeeded,
  requireOperatorApi,
  requireOperatorPage,
  requireOwnerApi,
  sanitizeOperator,
  verifyOperatorCredentials,
  registerOperatorAppGuard,
} from "./operators/index.js";
import { cleanText } from "./stage1/shared.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const PREVIEWS_ROOT = join(ROOT, "previews-v3");
const RENDERS_ROOT = join(ROOT, "renders");
const DATA_DIR = join(ROOT, "data");

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

await loadRuntimeEnvFiles();

let httpServer = null;
let appInitialized = false;

const PROTECTED_API_PREFIXES = [
  "/v7/projects",
  "/v7/founder-testing",
  "/stage1/",
  "/opportunity-engine/",
  "/founder-os/",
  "/admin/system-status",
  "/calls/",
  "/operators/",
];

async function protectKnownApiRoutes(req, res, next) {
  if (isWorkerJobPath(req.path)) {
    const workerAuth = validateWorkerAuth(req);
    if (workerAuth.ok) {
      return next();
    }
    return res.status(workerAuth.status).json({ error: workerAuth.error });
  }
  const matched = PROTECTED_API_PREFIXES.some(
    (prefix) => req.path === prefix || req.path.startsWith(prefix),
  );
  if (!matched) {
    return res.status(404).json({ error: "Not found" });
  }
  return requireOperatorApi(req, res, next);
}

export const app = express();

app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  try {
    const event = verifyStripeWebhookPayload(req.body, req.get("stripe-signature"));
    const webhookResult = await handleStripeWebhookEvent(event);
    return res.json({ received: true, duplicate: Boolean(webhookResult?.duplicate) });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

const twilioFormParser = express.urlencoded({ extended: false });
registerTwilioVoiceWebhookRoutes(app, twilioFormParser);

app.use(express.json({ limit: "8mb" }));
app.use(cookieParser());
registerOperatorAppGuard(app);

app.get("/api/health", (req, res) => {
  const port = Number(process.env.PORT || 8787);
  return res.json({
    ok: true,
    service: "website-outreach-engine-api",
    version: "opportunity-engine-v1.5",
    origin: `${req.protocol}://${req.get("host")}`,
    port,
  });
});

app.get("/api/auth/status", async (_req, res) => {
  await migrateLegacyAdminAccountIfNeeded();
  const signupRequired = !(await hasOperators());
  return res.json({
    signupRequired,
    hasOperators: !signupRequired,
  });
});

app.post("/api/signup", async (req, res) => {
  try {
    await migrateLegacyAdminAccountIfNeeded();
    if (await hasOperators()) {
      return res.status(403).json({ error: "Signup is closed. Ask the owner for an account." });
    }
    const { name, email, password } = req.body ?? {};
    const created = await createOperator({
      name,
      email,
      password,
      role: "owner",
    });
    await createOperatorSession(res, created);
    return res.json({ ok: true, operator: created });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

app.post("/api/login", async (req, res) => {
  try {
    await migrateLegacyAdminAccountIfNeeded();
    const { email, password } = req.body ?? {};
    const operator = await verifyOperatorCredentials({ email, password });
    if (!operator) {
      return res.status(401).json({ error: "Invalid email or password." });
    }
    await createOperatorSession(res, operator);
    return res.json({ ok: true, operator });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

app.get("/api/me", async (req, res) => {
  const session = await getSessionForRequest(req);
  if (!session?.operatorId) {
    return res.json({ authenticated: false, operator: null });
  }
  return res.json({
    authenticated: true,
    operator: {
      id: session.operatorId,
      name: session.operatorName,
      email: session.operatorEmail,
      role: session.operatorRole,
    },
  });
});

app.post("/api/logout", async (req, res) => {
  await destroyOperatorSession(req, res);
  return res.json({ ok: true });
});

registerV7Routes(app, { requireOperatorApi, requireOperatorPage });

app.use("/api", protectKnownApiRoutes);

registerTwilioCallRoutes(app, { requireOperatorApi, requireOwnerApi });

app.get("/api/operators", requireOwnerApi, async (_req, res) => {
  try {
    return res.json({ operators: await listOperators() });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.post("/api/operators", requireOwnerApi, async (req, res) => {
  try {
    const created = await createOperator({
      name: req.body?.name,
      email: req.body?.email,
      password: req.body?.password,
      role: "operator",
    });
    return res.status(201).json({ operator: created });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

registerV7OperatorRoutes(app);
registerStage1Routes(app);
registerOpportunityEngineRoutes(app);
registerFounderOsRoutes(app);

app.get("/api/admin/system-status", async (_req, res) => {
  try {
    return res.json(await getAdminSystemStatus());
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.use("/previews", express.static(PREVIEWS_ROOT));
app.use("/renders", express.static(RENDERS_ROOT));

async function startServer() {
  await initializeApp();

  const port = Number(process.env.PORT || 8787);
  httpServer = app.listen(port, () => {
    console.log(`Website Outreach server listening on http://localhost:${port}`);
  });
  if (typeof httpServer.ref === "function") {
    httpServer.ref();
  }
}

export async function initializeApp() {
  if (appInitialized) return;
  appInitialized = true;

  migrateLegacyAdminAccountIfNeeded().catch((err) => {
    console.warn(`Operator migration skipped: ${err.message}`);
  });

  migrateRecordsToIdentities().catch((err) => {
    console.warn(`Identity migration skipped: ${err.message}`);
  });

  syncEnvTwilioToBlobIfEmpty().catch((err) => {
    console.warn(`Twilio settings sync skipped: ${err.message}`);
  });
}

export const appReady = initializeApp();

const isDirectRun = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  startServer().catch((err) => {
    console.error(`Failed to start server: ${err.message}`);
    process.exit(1);
  });
}
