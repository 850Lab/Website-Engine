import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { DATA_DIR, LEADS_FILE, writeJsonFileSafe } from "./storage.js";
import { LEAD_RUNS_FILE } from "./lead-runs.js";
import { LEAD_GENERATION_RUNS_FILE } from "./lead-generation-runs.js";
import { getStoredAdminAccount } from "./admin-auth.js";

const ROOT = join(DATA_DIR, "..");
const PREVIEWS_ROOT = join(ROOT, "previews-v3");
const RENDERS_ROOT = join(ROOT, "renders");
const TEST_TOKEN_RE = /(^|[\s_-])(E2E|TEST)([\s_-]|$)/i;

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

async function countRenderScreenshots() {
  const dirs = await listDir(RENDERS_ROOT);
  let count = 0;
  for (const entry of dirs) {
    if (!entry.isDirectory()) continue;
    const files = await listDir(join(RENDERS_ROOT, entry.name));
    count += files.filter((file) => file.isFile() && file.name.toLowerCase().endsWith(".png")).length;
  }
  return count;
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

function looksLikeTestText(value) {
  return TEST_TOKEN_RE.test(String(value ?? ""));
}

function isTestLead(lead) {
  return (
    looksLikeTestText(lead?.businessName) ||
    looksLikeTestText(lead?.notes) ||
    String(lead?.notes ?? "").toLowerCase().includes("production readiness test")
  );
}

function isTestLeadRun(run) {
  return (
    looksLikeTestText(run?.id) ||
    looksLikeTestText(run?.title) ||
    looksLikeTestText(run?.searchTerm)
  );
}

function isTestGenerationRun(run) {
  return (
    looksLikeTestText(run?.id) ||
    looksLikeTestText(run?.title) ||
    looksLikeTestText(run?.config?.runTitle) ||
    looksLikeTestText(run?.config?.searchTerm)
  );
}

export async function getAdminSystemStatus() {
  const [account, leads, leadRuns, generationRuns, previewDirs, renderScreenshotCount, lastBackupAt] =
    await Promise.all([
      getStoredAdminAccount(),
      readJsonFile(LEADS_FILE, []),
      readJsonFile(LEAD_RUNS_FILE, []),
      readJsonFile(LEAD_GENERATION_RUNS_FILE, []),
      listDir(PREVIEWS_ROOT),
      countRenderScreenshots(),
      latestBackupTimestamp(),
    ]);

  return {
    admin: {
      hasAdminAccount: Boolean(account),
      email: account?.email ?? null,
      authMode: account ? "file" : process.env.ADMIN_PASSWORD ? "env-password" : "not-configured",
    },
    counts: {
      leads: Array.isArray(leads) ? leads.length : 0,
      leadGroups: Array.isArray(leadRuns) ? leadRuns.length : 0,
      generationRuns: Array.isArray(generationRuns) ? generationRuns.length : 0,
      previewFolders: previewDirs.filter((entry) => entry.isDirectory()).length,
      renderScreenshots: renderScreenshotCount,
    },
    integrations: {
      openAiKeyDetected: Boolean(process.env.OPENAI_API_KEY),
      playwrightAvailable: await playwrightAvailable(),
    },
    storage: {
      dataDir: DATA_DIR,
      lastBackupAt,
      files: {
        leads: LEADS_FILE,
        leadRuns: LEAD_RUNS_FILE,
        generationRuns: LEAD_GENERATION_RUNS_FILE,
      },
    },
  };
}

export async function cleanupTestRecords({ dryRun = true, confirm = "" } = {}) {
  if (!dryRun && confirm !== "DELETE TEST RECORDS") {
    throw new Error('Cleanup requires confirm: "DELETE TEST RECORDS".');
  }

  const leads = await readJsonFile(LEADS_FILE, []);
  const leadRuns = await readJsonFile(LEAD_RUNS_FILE, []);
  const generationRuns = await readJsonFile(LEAD_GENERATION_RUNS_FILE, []);

  const testLeadIds = new Set(leads.filter(isTestLead).map((lead) => lead.id).filter(Boolean));
  const nextLeads = leads.filter((lead) => !testLeadIds.has(lead.id));
  const removedLeadRuns = leadRuns.filter(isTestLeadRun);
  const keptLeadRuns = leadRuns.filter((run) => !isTestLeadRun(run));
  const nextLeadRuns = keptLeadRuns.map((run) => ({
    ...run,
    qualifiedLeadIds: (run.qualifiedLeadIds ?? []).filter((id) => !testLeadIds.has(id)),
    rejectedLeads: (run.rejectedLeads ?? []).filter((lead) => !testLeadIds.has(lead.leadId)),
  }));
  const removedGenerationRuns = generationRuns.filter(isTestGenerationRun);
  const nextGenerationRuns = generationRuns.filter((run) => !isTestGenerationRun(run));

  const summary = {
    dryRun: Boolean(dryRun),
    matches: {
      leads: leads.filter((lead) => testLeadIds.has(lead.id)).map((lead) => ({
        id: lead.id,
        businessName: lead.businessName,
      })),
      leadGroups: removedLeadRuns.map((run) => ({ id: run.id, title: run.title })),
      generationRuns: removedGenerationRuns.map((run) => ({
        id: run.id,
        title: run.title ?? run.config?.runTitle,
      })),
    },
    removed: {
      leads: testLeadIds.size,
      leadGroups: removedLeadRuns.length,
      generationRuns: removedGenerationRuns.length,
    },
    backupsCreated: dryRun ? [] : [
      `${LEADS_FILE}.bak`,
      `${LEAD_RUNS_FILE}.bak`,
      `${LEAD_GENERATION_RUNS_FILE}.bak`,
    ],
  };

  if (!dryRun) {
    await writeJsonFileSafe(LEADS_FILE, nextLeads);
    await writeJsonFileSafe(LEAD_RUNS_FILE, nextLeadRuns);
    await writeJsonFileSafe(LEAD_GENERATION_RUNS_FILE, nextGenerationRuns);
  }

  return summary;
}
