import { copyFile, readFile, rename, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "data");
const LEADS_FILE = join(DATA_DIR, "leads.json");
const writeQueues = new Map();

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function retryFileOperation(operation, { attempts = 5, delayMs = 75 } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (err) {
      lastError = err;
      if (!["EPERM", "EBUSY", "EACCES"].includes(err.code) || attempt === attempts) {
        throw err;
      }
      await sleep(delayMs * attempt);
    }
  }
  throw lastError;
}

export async function writeJsonFileSafe(filePath, data) {
  const previous = writeQueues.get(filePath) ?? Promise.resolve();
  const next = previous.then(async () => {
    await mkdir(dirname(filePath), { recursive: true });
    const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
    try {
      await readFile(filePath, "utf8");
      await retryFileOperation(() => copyFile(filePath, `${filePath}.bak`));
    } catch (err) {
      if (err.code !== "ENOENT") throw err;
    }
    await writeFile(tempPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
    await retryFileOperation(() => rename(tempPath, filePath));
  });
  writeQueues.set(
    filePath,
    next.catch(() => {
      // Keep the queue alive after a failed write.
    })
  );
  return next;
}

export async function loadLeads() {
  try {
    const raw = await readFile(LEADS_FILE, "utf8");
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch (err) {
    if (err.code === "ENOENT") return [];
    throw err;
  }
}

export async function saveLeads(leads) {
  await writeJsonFileSafe(LEADS_FILE, leads);
}

export { DATA_DIR, LEADS_FILE };
