import { mkdir, writeFile, cp } from "node:fs/promises";
import { join } from "node:path";
import { writeJsonDocument } from "../../src/persistence/json-document-store.js";
import {
  OFFERS_FILE,
  CAMPAIGNS_FILE,
  BUSINESSES_FILE,
  CONTACTS_FILE,
  OPPORTUNITIES_FILE,
  QUEUE_ITEMS_FILE,
  ATTEMPTS_FILE,
} from "../../src/schema/paths.js";
import { MIGRATION_DIR, ID_MAP_FILE } from "./paths.js";

const SCHEMA_FILES = [
  OFFERS_FILE,
  CAMPAIGNS_FILE,
  BUSINESSES_FILE,
  CONTACTS_FILE,
  OPPORTUNITIES_FILE,
  QUEUE_ITEMS_FILE,
  ATTEMPTS_FILE,
];

export async function backupSchemaFiles() {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupDir = join(MIGRATION_DIR, "backups", `pre-write-${stamp}`);
  await mkdir(backupDir, { recursive: true });

  for (const file of SCHEMA_FILES) {
    try {
      await cp(file, join(backupDir, file.split(/[/\\]/).pop()));
    } catch (err) {
      if (err.code !== "ENOENT") throw err;
    }
  }

  return backupDir;
}

export async function writeSchemaCollections({
  offers,
  campaigns,
  businesses,
  contacts,
  opportunities,
  queueItems,
  attempts,
  idMap,
}) {
  await mkdir(MIGRATION_DIR, { recursive: true });

  const writes = [
    [OFFERS_FILE, "offers", offers],
    [CAMPAIGNS_FILE, "campaigns", campaigns],
    [BUSINESSES_FILE, "businesses", businesses],
    [CONTACTS_FILE, "contacts", contacts],
    [OPPORTUNITIES_FILE, "opportunities", opportunities],
    [QUEUE_ITEMS_FILE, "queueItems", queueItems],
    [ATTEMPTS_FILE, "attempts", attempts],
  ];

  for (const [file, key, rows] of writes) {
    await writeJsonDocument(file, {
      version: 1,
      [key]: rows,
      updatedAt: new Date().toISOString(),
    });
  }

  await writeFile(
    ID_MAP_FILE,
    `${JSON.stringify(
      {
        version: 1,
        generatedAt: new Date().toISOString(),
        entries: idMap,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
}
