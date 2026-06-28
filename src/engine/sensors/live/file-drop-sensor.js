import { createHash } from "node:crypto";
import { readdir, readFile, stat, copyFile } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import {
  ensureDirectory,
  ensureRuntimeDirectories,
  getRuntimeInboxObservationsDirectory,
  getRuntimeInboxProcessedDirectory,
  safeFileExists,
  writeJsonAtomicWithRetry,
} from "../../runtime/index.js";
import { getSensor, registerSensor, runSensor } from "../index.js";

export const FILE_DROP_SENSOR_ID = "file_drop";
const SUPPORTED_EXTENSIONS = new Set([".json", ".txt", ".md"]);

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function nowIso() {
  return new Date().toISOString();
}

function hashContent(content) {
  return `sha256:${createHash("sha256").update(String(content)).digest("hex")}`;
}

function collapseWhitespace(value) {
  return String(value ?? "")
    .replace(/\uFEFF/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isSupportedFile(name) {
  const ext = extname(name).toLowerCase();
  return SUPPORTED_EXTENSIONS.has(ext);
}

function markerPath(fileName) {
  return join(getRuntimeInboxProcessedDirectory(), `${fileName}.marker.json`);
}

async function readMarker(fileName) {
  const path = markerPath(fileName);
  if (!(await safeFileExists(path))) {
    return null;
  }
  try {
    const raw = await readFile(path, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function writeMarker(fileName, marker) {
  await ensureDirectory(getRuntimeInboxProcessedDirectory());
  await writeJsonAtomicWithRetry(markerPath(fileName), marker);
}

async function archiveProcessedCopy(fileName, absolutePath) {
  const archiveDir = join(getRuntimeInboxProcessedDirectory(), "archive");
  await ensureDirectory(archiveDir);
  const target = join(archiveDir, fileName);
  if (!(await safeFileExists(target))) {
    await copyFile(absolutePath, target);
  }
}

export async function listInboxObservationFiles(options = {}) {
  await ensureRuntimeDirectories();
  const inboxDir = options.inboxDir || getRuntimeInboxObservationsDirectory();
  await ensureDirectory(inboxDir);
  await ensureDirectory(getRuntimeInboxProcessedDirectory());

  const entries = await readdir(inboxDir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (entry.name.startsWith(".")) continue;
    if (!isSupportedFile(entry.name)) continue;

    const absolutePath = join(inboxDir, entry.name);
    const content = await readFile(absolutePath, "utf8");
    const contentHash = hashContent(content);
    const marker = await readMarker(entry.name);
    if (marker?.contentHash === contentHash) {
      continue;
    }

    files.push({
      fileName: entry.name,
      absolutePath,
      content,
      contentHash,
      modifiedAt: (await stat(absolutePath)).mtime.toISOString(),
    });
  }

  return files;
}

function parseJsonObservation(file, parsed) {
  const headline = collapseWhitespace(parsed.headline || parsed.title);
  const summary = collapseWhitespace(parsed.summary || parsed.body || headline);
  if (!headline) {
    throw new Error("JSON observation missing headline");
  }

  const observedAt = parsed.observedAt ? new Date(parsed.observedAt).toISOString() : file.modifiedAt;
  const location = parsed.location || null;

  return {
    capturedAt: observedAt,
    source: collapseWhitespace(parsed.source || "file_drop").toLowerCase().replace(/\s+/g, "_"),
    originalText: collapseWhitespace(parsed.rawText || `${headline}. ${summary}`),
    headline,
    summary,
    signalType: collapseWhitespace(parsed.signalType || "unknown").toLowerCase(),
    url: parsed.url ? collapseWhitespace(parsed.url) : null,
    location,
    geo: parsed.geo || { lat: null, lng: null },
    metadata: {
      fileDrop: true,
      fileName: file.fileName,
      contentHash: file.contentHash,
      sourceType: parsed.sourceType || "file",
    },
  };
}

function parseTextObservation(file) {
  const lines = String(file.content).replace(/\r\n/g, "\n").split("\n");
  const nonEmpty = lines.map((line) => line.trim()).filter(Boolean);
  const headline = collapseWhitespace(nonEmpty[0] || basename(file.fileName, extname(file.fileName)));
  const summary = collapseWhitespace(nonEmpty.slice(1).join(" ") || headline);
  const rawText = String(file.content).trim();

  return {
    capturedAt: file.modifiedAt,
    source: "file_drop",
    originalText: rawText,
    headline,
    summary,
    signalType: "unknown",
    url: null,
    location: null,
    geo: { lat: null, lng: null },
    metadata: {
      fileDrop: true,
      fileName: file.fileName,
      contentHash: file.contentHash,
      rawText,
    },
  };
}

function parseFileObservation(file) {
  const ext = extname(file.fileName).toLowerCase();
  if (ext === ".json") {
    let parsed;
    try {
      parsed = JSON.parse(file.content);
    } catch (error) {
      throw new Error(`Invalid JSON in ${file.fileName}: ${error.message}`);
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error(`Invalid JSON object in ${file.fileName}`);
    }
    return parseJsonObservation(file, parsed);
  }

  return parseTextObservation(file);
}

export async function collectFileDropObservations(options = {}) {
  const files = await listInboxObservationFiles(options);
  const observations = [];
  const fileRecords = [];
  const errors = [];

  for (const file of files) {
    try {
      const observation = parseFileObservation(file);
      observations.push(observation);
      fileRecords.push({
        fileName: file.fileName,
        absolutePath: file.absolutePath,
        contentHash: file.contentHash,
      });
    } catch (error) {
      errors.push(`${file.fileName}: ${error.message}`);
      fileRecords.push({
        fileName: file.fileName,
        absolutePath: file.absolutePath,
        contentHash: file.contentHash,
        error: error.message,
      });
    }
  }

  return { observations, files: fileRecords, errors };
}

export async function markFileDropProcessed(fileName, metadata = {}) {
  const marker = {
    fileName,
    contentHash: metadata.contentHash,
    processedAt: nowIso(),
    signalIds: asArray(metadata.signalIds),
  };
  await writeMarker(fileName, marker);
  if (metadata.absolutePath) {
    await archiveProcessedCopy(fileName, metadata.absolutePath);
  }
  return marker;
}

export const fileDropSensor = {
  id: FILE_DROP_SENSOR_ID,
  name: "File Drop Sensor",
  description: "Reads local observation files dropped into runtime/inbox/observations/.",
  domain: "documents",
  sourceTypes: ["file_import"],
  capabilities: ["observe_file_drop"],
  async collect(context = {}) {
    if (context.__fileDropCache?.observations) {
      return context.__fileDropCache.observations;
    }
    const collected = await collectFileDropObservations(context);
    return collected.observations;
  },
  async healthCheck(context = {}) {
    try {
      await ensureRuntimeDirectories();
      const inboxDir = context.inboxDir || getRuntimeInboxObservationsDirectory();
      await ensureDirectory(inboxDir);
      return { ok: true, message: "File drop inbox is available." };
    } catch (error) {
      return { ok: false, message: error.message };
    }
  },
  validate(observation) {
    if (!observation.originalText) throw new Error("Missing originalText");
    if (!observation.headline) throw new Error("Missing headline");
    if (!observation.summary) throw new Error("Missing summary");
    if (!observation.source) throw new Error("Missing source");
    return true;
  },
  mapToObservation(observation) {
    const location =
      typeof observation.location === "string"
        ? observation.location
        : observation.location || null;

    return {
      source: observation.source,
      sourceType: "file_import",
      signalType: observation.signalType,
      headline: observation.headline,
      summary: observation.summary,
      url: observation.url,
      location,
      geo: observation.geo,
      observedAt: observation.capturedAt,
      dedupKey: `file_drop:${observation.metadata?.contentHash || observation.headline}`,
      provenance: {
        sensorId: FILE_DROP_SENSOR_ID,
        fileName: observation.metadata?.fileName || null,
        contentHash: observation.metadata?.contentHash || null,
        ingestChannel: "file_drop_sensor",
      },
    };
  },
};

export function registerFileDropSensor() {
  if (getSensor(FILE_DROP_SENSOR_ID)) {
    return getSensor(FILE_DROP_SENSOR_ID);
  }
  return registerSensor(fileDropSensor);
}

export async function runFileDropSensor(options = {}) {
  registerFileDropSensor();

  const collected = await collectFileDropObservations(options);
  const result = {
    sensorId: FILE_DROP_SENSOR_ID,
    observationsFound: collected.observations.length,
    observationsIngested: 0,
    filesProcessed: [],
    signalsCreated: [],
    errors: [...collected.errors],
  };

  if (!collected.observations.length) {
    return result;
  }

  try {
    const runResult = await runSensor(
      FILE_DROP_SENSOR_ID,
      {
        ...options,
        __fileDropCache: collected,
      },
      { publish: true, ...(options.ingestOptions || {}) },
    );

    const ingested = runResult.ingested || [];
    result.observationsIngested = ingested.length;
    result.signalsCreated = ingested.map((row) => row.signal.id);

    const processableFiles = collected.files.filter((row) => !row.error);
    for (let index = 0; index < ingested.length; index += 1) {
      const fileRecord = processableFiles[index];
      if (!fileRecord) continue;

      await markFileDropProcessed(fileRecord.fileName, {
        contentHash: fileRecord.contentHash,
        absolutePath: fileRecord.absolutePath,
        signalIds: [ingested[index].signal.id],
      });

      if (!result.filesProcessed.includes(fileRecord.fileName)) {
        result.filesProcessed.push(fileRecord.fileName);
      }
    }
  } catch (error) {
    if (/Duplicate signal detected/i.test(error.message)) {
      for (const file of collected.files.filter((row) => !row.error)) {
        await markFileDropProcessed(file.fileName, {
          contentHash: file.contentHash,
          absolutePath: file.absolutePath,
          signalIds: [],
        });
        if (!result.filesProcessed.includes(file.fileName)) {
          result.filesProcessed.push(file.fileName);
        }
      }
      result.errors.push(error.message);
    } else {
      result.errors.push(error.message);
    }
  }

  return result;
}
