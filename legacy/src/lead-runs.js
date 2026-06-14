import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { listLeadsWithMeta } from "./mission-control.js";
import { writeJsonFileSafe } from "./storage.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");
const LEAD_RUNS_FILE = join(DATA_DIR, "lead-runs.json");

function cleanText(value) {
  return String(value ?? "").trim();
}

function normalizeTitle(value) {
  return cleanText(value).replace(/\s+/g, " ");
}

function uniqueTitle(baseTitle, existingRuns) {
  const title = normalizeTitle(baseTitle);
  if (!title) throw new Error("Run Title is required.");
  const used = new Set(existingRuns.map((run) => normalizeTitle(run.title).toLowerCase()));
  if (!used.has(title.toLowerCase())) return title;
  const stamp = new Date().toISOString().replace("T", " ").slice(0, 16);
  return `${title} (${stamp})`;
}

async function readLeadRuns() {
  try {
    const raw = await readFile(LEAD_RUNS_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    if (err.code === "ENOENT") return [];
    throw err;
  }
}

async function writeLeadRuns(runs) {
  await writeJsonFileSafe(LEAD_RUNS_FILE, runs);
}

function dedupeIds(ids) {
  return [...new Set((ids ?? []).map(cleanText).filter(Boolean))];
}

function normalizeRejectedLead(item) {
  return {
    leadId: cleanText(item?.leadId) || null,
    businessName: cleanText(item?.businessName) || "Unknown business",
    score: Number(item?.score) || 0,
    websiteStatus: cleanText(item?.websiteStatus) || "unknown",
    reasons: Array.isArray(item?.reasons)
      ? item.reasons.map(cleanText).filter(Boolean)
      : [],
  };
}

function normalizeLeadRun(run) {
  const createdAt = run.createdAt ?? run.startedAt ?? new Date().toISOString();
  return {
    id: cleanText(run.id),
    title: normalizeTitle(run.title),
    createdAt,
    updatedAt: run.updatedAt ?? createdAt,
    archived: Boolean(run.archived),
    searchTerm: cleanText(run.searchTerm),
    city: cleanText(run.city),
    state: cleanText(run.state),
    runMode: cleanText(run.runMode),
    filters: run.filters && typeof run.filters === "object" ? run.filters : {},
    previewSettings:
      run.previewSettings && typeof run.previewSettings === "object" ? run.previewSettings : {},
    qualifiedLeadIds: dedupeIds(run.qualifiedLeadIds),
    rejectedLeads: Array.isArray(run.rejectedLeads)
      ? run.rejectedLeads.map(normalizeRejectedLead)
      : [],
    stats: {
      totalDiscovered: Number(run.stats?.totalDiscovered) || 0,
      qualified: Number(run.stats?.qualified) || 0,
      rejected: Number(run.stats?.rejected) || 0,
      previewReady: Number(run.stats?.previewReady) || 0,
      contacted: Number(run.stats?.contacted) || 0,
      replied: Number(run.stats?.replied) || 0,
      won: Number(run.stats?.won) || 0,
      lost: Number(run.stats?.lost) || 0,
    },
  };
}

function leadPipelineStats(leads) {
  return leads.reduce(
    (stats, lead) => {
      if (lead.previewStatus && lead.previewStatus !== "not_generated") stats.previewReady += 1;
      if (lead.pipelineStage === "contacted" || lead.replyStatus === "contacted") stats.contacted += 1;
      if (lead.pipelineStage === "replied" || lead.replyStatus === "replied") stats.replied += 1;
      if (lead.pipelineStage === "won" || lead.replyStatus === "won") stats.won += 1;
      if (lead.pipelineStage === "lost" || lead.replyStatus === "lost") stats.lost += 1;
      return stats;
    },
    { previewReady: 0, contacted: 0, replied: 0, won: 0, lost: 0 }
  );
}

async function hydrateLeadRun(run) {
  const normalized = normalizeLeadRun(run);
  const allLeads = await listLeadsWithMeta();
  const leadById = new Map(allLeads.map((lead) => [lead.id, lead]));
  const qualifiedLeads = normalized.qualifiedLeadIds
    .map((id) => leadById.get(id))
    .filter(Boolean);
  const pipeline = leadPipelineStats(qualifiedLeads);

  return {
    ...normalized,
    stats: {
      ...normalized.stats,
      qualified: qualifiedLeads.length,
      rejected: normalized.rejectedLeads.length,
      ...pipeline,
    },
    qualifiedLeads,
  };
}

export async function listLeadRuns({ limit = 100 } = {}) {
  const runs = await readLeadRuns();
  const sorted = runs
    .map(normalizeLeadRun)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  const limited = sorted.slice(0, Math.max(1, Math.min(500, Number(limit) || 100)));
  return Promise.all(limited.map(hydrateLeadRun));
}

export async function getLeadRun(runId) {
  const runs = await readLeadRuns();
  const run = runs.find((item) => item.id === runId);
  return run ? hydrateLeadRun(run) : null;
}

export async function createLeadRun(payload) {
  const runs = await readLeadRuns();
  const now = new Date().toISOString();
  const run = normalizeLeadRun({
    ...payload,
    id: payload.id || `run_${Date.now()}`,
    title: uniqueTitle(payload.title, runs),
    createdAt: payload.createdAt ?? now,
    updatedAt: now,
  });
  runs.push(run);
  await writeLeadRuns(runs);
  return hydrateLeadRun(run);
}

export async function upsertLeadRun(payload) {
  const runs = await readLeadRuns();
  const index = runs.findIndex((run) => run.id === payload.id);
  const now = new Date().toISOString();
  if (index === -1) {
    return createLeadRun(payload);
  }

  const title =
    payload.title && normalizeTitle(payload.title) !== normalizeTitle(runs[index].title)
      ? uniqueTitle(payload.title, runs.filter((_, i) => i !== index))
      : runs[index].title;

  const next = normalizeLeadRun({
    ...runs[index],
    ...payload,
    title,
    updatedAt: now,
  });
  runs[index] = next;
  await writeLeadRuns(runs);
  return hydrateLeadRun(next);
}

export async function patchLeadRun(runId, patch) {
  const runs = await readLeadRuns();
  const index = runs.findIndex((run) => run.id === runId);
  if (index === -1) throw new Error(`Target Lead Group not found: ${runId}`);

  const next = {
    ...runs[index],
    ...patch,
    id: runs[index].id,
    updatedAt: new Date().toISOString(),
  };
  if (patch.title) {
    next.title = uniqueTitle(patch.title, runs.filter((_, i) => i !== index));
  }
  runs[index] = normalizeLeadRun(next);
  await writeLeadRuns(runs);
  return hydrateLeadRun(runs[index]);
}

export async function deleteLeadRun(runId) {
  const runs = await readLeadRuns();
  const next = runs.filter((run) => run.id !== runId);
  await writeLeadRuns(next);
  return { ok: next.length !== runs.length };
}

export async function archiveLeadRun(runId, archived = true) {
  return patchLeadRun(runId, { archived: Boolean(archived) });
}

export async function reconsiderRejectedLead(runId, leadKey) {
  const run = await getLeadRun(runId);
  if (!run) throw new Error(`Target Lead Group not found: ${runId}`);
  const key = cleanText(leadKey);
  return patchLeadRun(runId, {
    rejectedLeads: run.rejectedLeads.filter(
      (item) => item.leadId !== key && item.businessName !== key
    ),
  });
}

export async function moveRejectedLeadToQualified(runId, leadId) {
  const run = await getLeadRun(runId);
  if (!run) throw new Error(`Target Lead Group not found: ${runId}`);
  const id = cleanText(leadId);
  if (!id) throw new Error("leadId is required.");
  return patchLeadRun(runId, {
    qualifiedLeadIds: dedupeIds([...run.qualifiedLeadIds, id]),
    rejectedLeads: run.rejectedLeads.filter((item) => item.leadId !== id),
  });
}

export { LEAD_RUNS_FILE };
