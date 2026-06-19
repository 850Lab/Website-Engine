import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { readFile } from "node:fs/promises";
import {
  blobPersistenceEnabled,
  persistenceBackendLabel,
  seedBlobFromFilesystem,
} from "../src/persistence/json-document-store.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

async function loadEnv() {
  for (const name of [".env", ".env.local", ".env.vercel.local"]) {
    try {
      const text = await readFile(join(ROOT, name), "utf8");
      for (const line of text.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
        const eq = trimmed.indexOf("=");
        const key = trimmed.slice(0, eq).trim();
        let value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
        if (key && value && process.env[key] === undefined) process.env[key] = value;
      }
    } catch {
      // optional
    }
  }
}

const RELEASE_FILES = [
  // Website OS
  "data/qualified-businesses.json",
  "data/angle-analyses.json",
  "data/website-quality-scores.json",
  "data/website-search-targets.json",
  // Pressure Washing OS
  "data/pressure-washing-leads.json",
  "data/pw-search-targets.json",
  // Shared focus + baseline config
  "data/outreach-focus.json",
  "data/founder-os.json",
];

async function main() {
  await loadEnv();

  if (!blobPersistenceEnabled()) {
    console.error("BLOB_READ_WRITE_TOKEN is missing. Create a Blob store in Vercel and add the token.");
    process.exit(1);
  }

  console.log(`Seeding Vercel Blob (${persistenceBackendLabel()})...`);

  for (const relativePath of RELEASE_FILES) {
    const absolutePath = join(ROOT, relativePath);
    try {
      const key = await seedBlobFromFilesystem(absolutePath);
      console.log(`  ✓ ${key}`);
    } catch (err) {
      console.log(`  ✗ ${relativePath}: ${err.message}`);
    }
  }

  console.log("\nDone. Website OS + PW OS lead data is on Vercel Blob for production.");
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
