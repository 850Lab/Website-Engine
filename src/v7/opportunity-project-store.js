import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { DATA_DIR, writeJsonFileSafe } from "../storage.js";
import { cleanText, nowIso } from "./shared.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const OPPORTUNITY_PROJECTS_FILE = join(DATA_DIR, "opportunity-projects.json");

async function readRecords() {
  try {
    const parsed = JSON.parse(await readFile(OPPORTUNITY_PROJECTS_FILE, "utf8"));
    if (Array.isArray(parsed)) return parsed;
    if (Array.isArray(parsed?.records)) return parsed.records;
    return [];
  } catch (err) {
    if (err.code === "ENOENT") return [];
    throw err;
  }
}

async function writeRecords(records) {
  await writeJsonFileSafe(OPPORTUNITY_PROJECTS_FILE, { version: 1, records });
}

export async function listOpportunityProjects() {
  const records = await readRecords();
  return records.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

export async function getOpportunityProject(projectId) {
  const records = await readRecords();
  return records.find((record) => record.id === projectId) ?? null;
}

export async function saveOpportunityProject(record) {
  const records = await readRecords();
  const index = records.findIndex((entry) => entry.id === record.id);
  const next = { ...record, updatedAt: nowIso() };
  if (index === -1) {
    records.push(next);
  } else {
    records[index] = {
      ...records[index],
      ...next,
      createdAt: records[index].createdAt ?? next.createdAt,
    };
  }
  await writeRecords(records);
  return index === -1 ? next : records[index];
}

export function publicProjectView(project) {
  if (!project) return null;
  return {
    id: project.id,
    businessName: project.businessName,
    category: project.category,
    city: project.city,
    status: project.status,
    previewUrl: project.preview?.previewUrl ?? null,
    siteUrl: project.preview?.publicUrl ?? project.preview?.previewUrl ?? null,
    momentumState: project.momentumState ?? "launching",
  };
}

export function sanitizeProjectForOperator(project) {
  return project;
}
