import { readJsonDocument, writeJsonDocument } from "../persistence/json-document-store.js";
import { SCHEMA_VERSION } from "./constants.js";

function emptyDocument(collectionKey) {
  return { version: SCHEMA_VERSION, [collectionKey]: [], updatedAt: null };
}

export async function readCollection(filePath, collectionKey = "records") {
  const parsed = await readJsonDocument(filePath);
  if (!parsed) return [];
  if (Array.isArray(parsed)) return parsed;
  if (Array.isArray(parsed[collectionKey])) return parsed[collectionKey];
  return [];
}

export async function writeCollection(filePath, collectionKey, records, { updatedAt } = {}) {
  const stamp = updatedAt ?? new Date().toISOString();
  await writeJsonDocument(filePath, {
    version: SCHEMA_VERSION,
    [collectionKey]: records,
    updatedAt: stamp,
  });
}

export async function listRecords(filePath, collectionKey = "records") {
  return readCollection(filePath, collectionKey);
}

export async function getRecordById(filePath, id, collectionKey = "records") {
  const records = await readCollection(filePath, collectionKey);
  return records.find((row) => row.id === id) ?? null;
}

export async function upsertRecord(
  filePath,
  record,
  {
    collectionKey = "records",
    validate,
    uniqueFields = [],
  } = {},
) {
  if (validate) validate(record);

  const records = await readCollection(filePath, collectionKey);
  const index = records.findIndex((row) => row.id === record.id);

  for (const { field, message } of uniqueFields) {
    const value = record[field];
    if (value == null || value === "") continue;
    const conflict = records.find(
      (row, i) => i !== index && String(row[field]) === String(value),
    );
    if (conflict) {
      throw new Error(message ?? `Duplicate ${field}: ${value}`);
    }
  }

  if (index === -1) {
    records.push(record);
  } else {
    records[index] = record;
  }

  await writeCollection(filePath, collectionKey, records);
  return record;
}

export async function ensureCollectionFile(filePath, collectionKey = "records") {
  const existing = await readJsonDocument(filePath);
  if (existing) return;
  await writeJsonDocument(filePath, emptyDocument(collectionKey));
}
