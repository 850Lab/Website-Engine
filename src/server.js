import express from "express";
import cookieParser from "cookie-parser";
import { randomBytes } from "node:crypto";
import { join, resolve } from "node:path";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import {
  createAdminAccount,
  getStoredAdminAccount,
  verifyAdminCredentials,
} from "./admin-auth.js";
import { writeJsonFileSafe } from "./storage.js";
import { getAdminSystemStatus } from "./admin-tools.js";
import {
  handleStripeWebhookEvent,
  verifyStripeWebhookPayload,
} from "./stripe-billing.js";
import { registerV7OperatorRoutes, registerV7Routes } from "./v7/index.js";
import { listOpportunityProjects } from "./v7/opportunity-project-store.js";
import { registerStage1Routes } from "./stage1/index.js";
import { registerOpportunityEngineRoutes } from "./opportunity-engine/index.js";
import { migrateRecordsToIdentities } from "./identity/migrate-identities.js";
import { isWorkerJobPath, validateWorkerAuth } from "./worker-auth.js";
import { registerFounderOsRoutes } from "./founder-os/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
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

await loadRuntimeEnvFiles();

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "";
const SESSION_COOKIE = "website_outreach_session";
const SESSION_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 7;
const sessions = new Map();
let httpServer = null;
let sessionsLoaded = false;
let appInitialized = false;

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

const PROTECTED_API_PREFIXES = [
  "/v7/projects",
  "/v7/founder-testing",
  "/stage1/",
  "/opportunity-engine/",
  "/founder-os/",
  "/admin/system-status",
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
  return requireAuth(req, res, next);
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

app.use(express.json({ limit: "8mb" }));
app.use(cookieParser());

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

app.use("/api", protectKnownApiRoutes);

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

app.get("/", async (req, res, next) => {
  try {
    const base = `${req.protocol}://${req.get("host")}`;
    const projects = await listOpportunityProjects();
    const recent = projects.slice(0, 12);
    const projectCards = recent
      .map((project) => {
        const previewUrl = `${base}/p/${project.id}`;
        const launchUrl = `${base}/launch/${project.id}`;
        const city = project.city ? ` · ${project.city}` : "";
        const status = project.status || "draft";
        return `
          <li>
            <strong>${project.businessName || project.id}</strong>
            <span>${status}${city}</span>
            <div>
              <a href="${previewUrl}">Preview</a>
              <a href="${launchUrl}">Offer Snapshot</a>
            </div>
          </li>
        `;
      })
      .join("");

    return res.type("html").send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>WebLab Founder Links</title>
  <style>
    :root { color-scheme: dark; font-family: "Segoe UI", system-ui, sans-serif; }
    body { margin: 0; background: #0b1220; color: #e9f0ff; }
    .wrap { max-width: 880px; margin: 0 auto; padding: 28px 16px 48px; }
    .card {
      background: #121a2b;
      border: 1px solid rgba(255,255,255,0.09);
      border-radius: 18px;
      padding: 20px;
      margin-bottom: 14px;
    }
    h1 { margin: 0 0 8px; font-size: 30px; }
    p { margin: 0; color: #b7c6e5; line-height: 1.55; }
    .actions { margin-top: 14px; display: flex; flex-wrap: wrap; gap: 10px; }
    .btn {
      display: inline-block;
      text-decoration: none;
      border-radius: 999px;
      padding: 10px 14px;
      font-weight: 600;
      font-size: 14px;
      border: 1px solid rgba(255,255,255,0.14);
      color: #e9f0ff;
      background: #1a2438;
    }
    .btn.primary { background: #4f8cff; border-color: #4f8cff; color: #fff; }
    ul { list-style: none; padding: 0; margin: 0; display: grid; gap: 10px; }
    li {
      background: #1a2438;
      border: 1px solid rgba(255,255,255,0.09);
      border-radius: 14px;
      padding: 12px;
      display: grid;
      gap: 6px;
    }
    li strong { font-size: 15px; }
    li span { color: #9fb0d0; font-size: 13px; }
    li div { display: flex; gap: 14px; }
    li a { color: #9ec5ff; text-decoration: none; font-size: 14px; }
  </style>
</head>
<body>
  <main class="wrap">
    <section class="card">
      <h1>WebLab Founder Links</h1>
      <p>Use the public preview and offer snapshot links below for phone/live testing.</p>
    </section>
    <section class="card">
      ${
        projectCards
          ? `<ul>${projectCards}</ul>`
          : `<p>No opportunity projects found yet. Create one through the V7 project API, then refresh this page.</p>`
      }
    </section>
  </main>
</body>
</html>`);
  } catch (err) {
    return next(err);
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

  migrateRecordsToIdentities().catch((err) => {
    console.warn(`Identity migration skipped: ${err.message}`);
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
