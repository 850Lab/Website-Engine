import { readFile, writeFile, mkdir, access, rename, unlink } from "node:fs/promises";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";

const RETRYABLE_CODES = new Set(["EBUSY", "EPERM", "EACCES", "ENOENT"]);
const DEFAULT_RETRIES = 6;
const DEFAULT_BACKOFF_MS = 75;

export function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function safeFileExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export async function ensureDirectory(path) {
  await mkdir(path, { recursive: true });
}

function isRetryableError(error) {
  return RETRYABLE_CODES.has(error?.code);
}

export async function withRetry(operation, options = {}) {
  const retries = options.retries ?? DEFAULT_RETRIES;
  const backoffMs = options.backoffMs ?? DEFAULT_BACKOFF_MS;
  let lastError;

  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!isRetryableError(error) || attempt === retries - 1) {
        throw error;
      }
      await wait(backoffMs * (attempt + 1));
    }
  }

  throw lastError;
}

export async function readJsonWithRetry(filePath, fallback = null) {
  if (!(await safeFileExists(filePath))) {
    return fallback;
  }

  const raw = await withRetry(() => readFile(filePath, "utf8"));
  return JSON.parse(raw);
}

export async function writeJsonAtomic(filePath, data) {
  const directory = dirname(filePath);
  await ensureDirectory(directory);
  const payload = `${JSON.stringify(data, null, 2)}\n`;
  const tempPath = join(directory, `.${randomUUID()}.tmp`);

  await writeFile(tempPath, payload, "utf8");

  try {
    await rename(tempPath, filePath);
  } catch (error) {
    if (isRetryableError(error) || error.code === "EEXIST") {
      try {
        if (await safeFileExists(filePath)) {
          await unlink(filePath);
        }
      } catch {
        // Best effort before retry rename.
      }
      await rename(tempPath, filePath);
    } else {
      try {
        await unlink(tempPath);
      } catch {
        // Ignore cleanup failure.
      }
      throw error;
    }
  }
}

export async function writeJsonAtomicWithRetry(filePath, data) {
  return withRetry(() => writeJsonAtomic(filePath, data));
}

export function isRetryableIoError(error) {
  return isRetryableError(error);
}
