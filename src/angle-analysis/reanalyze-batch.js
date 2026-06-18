import { join } from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { readFile } from "node:fs/promises";
import { DATA_DIR } from "../storage.js";
import { listQualifiedBusinesses, WEBSITE_QUALITY_SCORES_FILE } from "../stage1/qualified-business-store.js";
import { analyzeBusinessRecord } from "./analyzer.js";
import { upsertAngleAnalysis, saveBatchRunSummary } from "./store.js";
import { folderLabel } from "./categories.js";

function slugify(name) {
  return String(name ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 72);
}

async function loadQualityScoresMap() {
  try {
    const parsed = JSON.parse(await readFile(WEBSITE_QUALITY_SCORES_FILE, "utf8"));
    const scores = parsed.scores ?? [];
    return new Map(scores.map((row) => [row.businessId, row]));
  } catch {
    return new Map();
  }
}

export function createBatchState() {
  return {
    running: false,
    startedAt: null,
    processed: 0,
    total: 0,
    errors: [],
    summary: null,
  };
}

let activeBatch = createBatchState();

export function getBatchState() {
  return { ...activeBatch, errors: [...activeBatch.errors] };
}

async function writePerBusinessFile(analysis) {
  const slug = slugify(analysis.business_name);
  const folder = join(DATA_DIR, "website-screenshots", slug);
  await mkdir(folder, { recursive: true });
  await writeFile(join(folder, "angle-analysis.json"), `${JSON.stringify(analysis, null, 2)}\n`, "utf8");
}

export async function reanalyzeAllBusinesses(options = {}) {
  if (activeBatch.running) {
    throw new Error("Batch reanalysis already running.");
  }

  const fetchLive = Boolean(options.fetchLive);
  const records = await listQualifiedBusinesses();
  const qualityScoresMap = await loadQualityScoresMap();

  activeBatch = {
    running: true,
    startedAt: new Date().toISOString(),
    processed: 0,
    total: records.length,
    errors: [],
    summary: null,
  };

  const folderCounts = {};
  let manualReview = 0;
  const priorities = [];

  for (const record of records) {
    try {
      const analysis = await analyzeBusinessRecord(record, {
        qualityScoresMap,
        fetchLive,
        loadScreenshots: true,
      });
      await upsertAngleAnalysis(record.id, analysis);
      try {
        await writePerBusinessFile(analysis);
      } catch {
        // screenshot folder optional
      }

      folderCounts[analysis.folder] = (folderCounts[analysis.folder] ?? 0) + 1;
      if (analysis.folder === "unknown") manualReview += 1;
      priorities.push({ ...analysis, id: record.id });
    } catch (err) {
      activeBatch.errors.push({
        businessId: record.id,
        businessName: record.businessName,
        error: err.message,
      });
    }
    activeBatch.processed += 1;
  }

  priorities.sort((a, b) => b.priority_score - a.priority_score);
  const topFolder = Object.entries(folderCounts).sort((a, b) => b[1] - a[1])[0];

  const summary = {
    totalAnalyzed: activeBatch.processed - activeBatch.errors.length,
    totalAssigned: activeBatch.processed - activeBatch.errors.length - manualReview,
    totalManualReview: manualReview,
    totalErrors: activeBatch.errors.length,
    topFolderByCount: topFolder
      ? { key: topFolder[0], label: folderLabel(topFolder[0]), count: topFolder[1] }
      : null,
    topHotBusinesses: priorities.slice(0, 10).map((row) => ({
      businessId: row.businessId,
      business_name: row.business_name,
      city: row.city,
      folder: row.folder,
      folder_label: row.folder_label,
      priority_score: row.priority_score,
      priority_label: row.priority_label,
      confidence_score: row.confidence_score,
      primary_angle: row.primary_angle,
    })),
    folderCounts,
    startedAt: activeBatch.startedAt,
    completedAt: new Date().toISOString(),
  };

  await saveBatchRunSummary(summary);

  activeBatch.running = false;
  activeBatch.summary = summary;

  return summary;
}

export async function startReanalyzeBatch(options = {}) {
  if (activeBatch.running) {
    return getBatchState();
  }
  const promise = reanalyzeAllBusinesses(options).catch((err) => {
    activeBatch.running = false;
    activeBatch.errors.push({ businessId: null, businessName: null, error: err.message });
    throw err;
  });
  if (options.awaitCompletion) {
    await promise;
  }
  return getBatchState();
}
