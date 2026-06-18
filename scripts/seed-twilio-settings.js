import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { readFile } from "node:fs/promises";
import {
  blobPersistenceEnabled,
  persistenceBackendLabel,
} from "../src/persistence/json-document-store.js";
import { syncEnvTwilioToBlobIfEmpty } from "../src/twilio-voice/settings-store.js";
import { buildTwilioVoiceStatus } from "../src/twilio-voice/config.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

async function loadEnv() {
  for (const name of [".env", ".env.local"]) {
    try {
      const text = await readFile(join(ROOT, name), "utf8");
      for (const line of text.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
        const eq = trimmed.indexOf("=");
        const key = trimmed.slice(0, eq).trim();
        let value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
        if (key && process.env[key] === undefined) process.env[key] = value;
      }
    } catch {
      // optional
    }
  }
}

async function main() {
  await loadEnv();

  if (!blobPersistenceEnabled()) {
    console.error("BLOB_READ_WRITE_TOKEN is not set — cannot seed Twilio settings to cloud.");
    process.exit(1);
  }

  const saved = await syncEnvTwilioToBlobIfEmpty();
  const status = await buildTwilioVoiceStatus();

  console.log(`Persistence backend: ${persistenceBackendLabel()}`);
  if (saved) {
    console.log("Twilio settings copied from .env to blob storage.");
  } else {
    console.log("Blob already had Twilio settings, or .env is missing TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN.");
  }
  console.log(`Configured: ${status.configured}`);
  if (status.missing?.length) {
    console.log(`Still missing: ${status.missing.join(", ")}`);
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
