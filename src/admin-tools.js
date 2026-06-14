import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { DATA_DIR } from "./storage.js";
import { getStoredAdminAccount } from "./admin-auth.js";
import { getLaunchStripeStatus } from "./v7/stripe-launch.js";
import { getStripeBillingStatus } from "./stripe-billing.js";
import { QUALIFIED_BUSINESSES_FILE } from "./stage1/qualified-business-store.js";
import { OPPORTUNITY_PROJECTS_FILE } from "./v7/opportunity-project-store.js";

const ROOT = join(DATA_DIR, "..");
const PREVIEWS_ROOT = join(ROOT, "previews-v3");

async function readJsonFile(filePath, fallback) {
  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === "ENOENT") return fallback;
    throw err;
  }
}

async function listDir(path) {
  try {
    return await readdir(path, { withFileTypes: true });
  } catch (err) {
    if (err.code === "ENOENT") return [];
    throw err;
  }
}

async function latestBackupTimestamp() {
  const files = await listDir(DATA_DIR);
  let latest = 0;
  for (const file of files) {
    if (!file.isFile() || !file.name.endsWith(".bak")) continue;
    const info = await stat(join(DATA_DIR, file.name));
    latest = Math.max(latest, info.mtimeMs);
  }
  return latest ? new Date(latest).toISOString() : null;
}

async function playwrightAvailable() {
  try {
    await import("playwright");
    return true;
  } catch {
    return false;
  }
}

function countRecords(parsed, key = "records") {
  if (Array.isArray(parsed)) return parsed.length;
  if (Array.isArray(parsed?.[key])) return parsed[key].length;
  return 0;
}

export async function getAdminSystemStatus() {
  const [account, qualifiedBusinesses, opportunityProjects, previewDirs, lastBackupAt] =
    await Promise.all([
      getStoredAdminAccount(),
      readJsonFile(QUALIFIED_BUSINESSES_FILE, { records: [] }),
      readJsonFile(OPPORTUNITY_PROJECTS_FILE, { records: [] }),
      listDir(PREVIEWS_ROOT),
      latestBackupTimestamp(),
    ]);

  return {
    admin: {
      hasAdminAccount: Boolean(account),
      email: account?.email ?? null,
      authMode: account ? "file" : process.env.ADMIN_PASSWORD ? "env-password" : "not-configured",
    },
    counts: {
      qualifiedBusinesses: countRecords(qualifiedBusinesses),
      opportunityProjects: countRecords(opportunityProjects),
      previewFolders: previewDirs.filter((entry) => entry.isDirectory()).length,
    },
    integrations: {
      playwrightAvailable: await playwrightAvailable(),
      pageSpeedConfigured: Boolean(process.env.GOOGLE_PAGESPEED_API_KEY),
      publicBaseUrl: process.env.PUBLIC_BASE_URL || "",
      stripeLaunch: getLaunchStripeStatus(),
      stripeWebhook: {
        configured: getStripeBillingStatus().webhookConfigured,
        missing: getStripeBillingStatus().webhookMissing,
      },
    },
    storage: {
      dataDir: DATA_DIR,
      lastBackupAt,
    },
  };
}
