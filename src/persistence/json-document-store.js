import { readFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { get, put } from "@vercel/blob";
import { writeJsonFileSafe } from "../storage.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

export function blobPersistenceEnabled() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim());
}

export function persistenceBackendLabel() {
  return blobPersistenceEnabled() ? "vercel-blob" : "filesystem";
}

function documentKey(filePath) {
  return relative(ROOT, filePath).replace(/\\/g, "/");
}

async function readFilesystemJson(filePath) {
  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === "ENOENT") return null;
    throw err;
  }
}

async function streamToText(stream) {
  return new Response(stream).text();
}

async function readBlobJson(key) {
  const result = await get(key, {
    access: "private",
    token: process.env.BLOB_READ_WRITE_TOKEN,
    useCache: false,
  });
  if (!result || result.statusCode !== 200 || !result.stream) {
    return null;
  }
  const text = await streamToText(result.stream);
  return JSON.parse(text);
}

async function writeBlobJson(key, data) {
  const body = `${JSON.stringify(data, null, 2)}\n`;
  await put(key, body, {
    access: "private",
    token: process.env.BLOB_READ_WRITE_TOKEN,
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
  });
}

function hasDocumentContent(doc) {
  if (!doc || typeof doc !== "object") return false;
  if (Array.isArray(doc)) return doc.length > 0;
  return Object.keys(doc).length > 0;
}

export async function readJsonDocument(filePath) {
  const key = documentKey(filePath);

  if (blobPersistenceEnabled()) {
    const blobDoc = await readBlobJson(key);
    if (hasDocumentContent(blobDoc)) {
      return blobDoc;
    }

    const localDoc = await readFilesystemJson(filePath);
    if (hasDocumentContent(localDoc)) {
      await writeBlobJson(key, localDoc);
      return localDoc;
    }
    return localDoc;
  }

  return readFilesystemJson(filePath);
}

export async function writeJsonDocument(filePath, data) {
  const key = documentKey(filePath);

  if (blobPersistenceEnabled()) {
    await writeBlobJson(key, data);
    return;
  }

  await writeJsonFileSafe(filePath, data);
}

export async function seedBlobFromFilesystem(filePath) {
  if (!blobPersistenceEnabled()) {
    throw new Error("BLOB_READ_WRITE_TOKEN is not configured.");
  }
  const localDoc = await readFilesystemJson(filePath);
  if (!hasDocumentContent(localDoc)) {
    throw new Error(`No local document found at ${filePath}`);
  }
  await writeJsonDocument(filePath, localDoc);
  return documentKey(filePath);
}
