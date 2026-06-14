import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DATA_DIR, writeJsonFileSafe } from "../storage.js";
import { nowIso } from "./shared.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..");
export const V6_PACKAGES_FILE = join(DATA_DIR, "v6-packages.json");
export const V6_ARTIFACTS_ROOT = join(ROOT, "sales-packages");

async function readPackages() {
  try {
    const parsed = JSON.parse(await readFile(V6_PACKAGES_FILE, "utf8"));
    if (Array.isArray(parsed)) return parsed;
    if (Array.isArray(parsed?.records)) return parsed.records;
    return [];
  } catch (err) {
    if (err.code === "ENOENT") return [];
    throw err;
  }
}

async function writePackages(records) {
  await writeJsonFileSafe(V6_PACKAGES_FILE, { version: 1, records });
}

export async function listV6Packages() {
  const records = await readPackages();
  return records.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

export async function getV6Package(packageId) {
  const records = await readPackages();
  return records.find((record) => record.id === packageId) ?? null;
}

async function writeArtifact(packageId, filename, data) {
  const dir = join(V6_ARTIFACTS_ROOT, packageId);
  await mkdir(dir, { recursive: true });
  const filePath = join(dir, filename);
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  return filePath;
}

export async function saveV6Package(record) {
  const records = await readPackages();
  const index = records.findIndex((entry) => entry.id === record.id);
  const next = {
    ...record,
    updatedAt: nowIso(),
  };

  if (index === -1) {
    records.push(next);
  } else {
    records[index] = {
      ...records[index],
      ...next,
      createdAt: records[index].createdAt ?? next.createdAt,
    };
  }

  await writePackages(records);
  return index === -1 ? next : records[index];
}

export async function writeV6Artifacts(packageId, deliverables) {
  const files = {
    "research-report.json": deliverables.researchReport,
    "competitor-analysis.json": deliverables.competitorAnalysis,
    "revenue-leak-audit.json": deliverables.revenueLeakAudit,
    "website-redesign.json": deliverables.websiteRedesign,
    "annotation-assets.json": deliverables.annotationAssets,
    "loom-scripts.json": deliverables.loomScripts,
    "outreach-assets.json": deliverables.outreachAssets,
    "sales-package.json": deliverables.salesPackage,
  };

  const written = {};
  for (const [filename, payload] of Object.entries(files)) {
    written[filename] = await writeArtifact(packageId, filename, payload);
  }
  return written;
}

export function buildDownloadBundle(record) {
  const { deliverables, intake, status, id, businessName, createdAt, updatedAt } = record;
  return {
    version: 1,
    packageId: id,
    businessName,
    status,
    createdAt,
    updatedAt,
    intake,
    deliverables,
  };
}
