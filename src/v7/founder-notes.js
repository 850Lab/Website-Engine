import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { DATA_DIR, writeJsonFileSafe } from "../storage.js";
import { cleanText, nowIso } from "./shared.js";

export const FOUNDER_NOTES_FILE = join(DATA_DIR, "founder-notes.json");

const EMPTY_NOTES = {
  confusing: "",
  trust: "",
  questions: "",
  wouldBuy: "",
  score: null,
};

async function readRecords() {
  try {
    const parsed = JSON.parse(await readFile(FOUNDER_NOTES_FILE, "utf8"));
    return parsed?.records && typeof parsed.records === "object" ? parsed.records : {};
  } catch (err) {
    if (err.code === "ENOENT") return {};
    throw err;
  }
}

async function writeRecords(records) {
  await writeJsonFileSafe(FOUNDER_NOTES_FILE, { version: 1, records });
}

export async function getFounderNotes(projectId) {
  const records = await readRecords();
  const entry = records[projectId];
  if (!entry) return { projectId, ...EMPTY_NOTES, updatedAt: null };
  return {
    projectId,
    confusing: cleanText(entry.confusing),
    trust: cleanText(entry.trust),
    questions: cleanText(entry.questions),
    wouldBuy: cleanText(entry.wouldBuy),
    score: Number.isFinite(Number(entry.score)) ? Number(entry.score) : null,
    updatedAt: entry.updatedAt ?? null,
  };
}

export async function saveFounderNotes(projectId, input = {}) {
  const records = await readRecords();
  const scoreRaw = input.score;
  const score =
    scoreRaw === null || scoreRaw === undefined || scoreRaw === ""
      ? null
      : Math.min(10, Math.max(1, Math.round(Number(scoreRaw))));

  const entry = {
    confusing: cleanText(input.confusing),
    trust: cleanText(input.trust),
    questions: cleanText(input.questions),
    wouldBuy: cleanText(input.wouldBuy),
    score: Number.isFinite(score) ? score : null,
    updatedAt: nowIso(),
  };
  records[projectId] = entry;
  await writeRecords(records);
  return { projectId, ...entry };
}
