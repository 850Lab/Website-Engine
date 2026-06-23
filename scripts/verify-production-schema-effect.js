#!/usr/bin/env node
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  getSchemaRuntimeDiagnostics,
  readSchemaCollectionCounts,
  readLeadWriteSnapshot,
} from "../src/services/schema-diagnostics.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT_DIR = join(ROOT, "data", "migration", "production-verification");
const BASE_URL = process.env.BASE_URL || "https://www.pivotalwebsites.com";

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

async function fetchProductionFlags() {
  try {
    const res = await fetch(`${BASE_URL}/api/health`, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) {
      return { reachable: false, error: `HTTP ${res.status}` };
    }
    const body = await res.json();
    const schema = body.schema ?? null;
    return {
      reachable: true,
      baseUrl: BASE_URL,
      hasSchemaDiagnostics: Boolean(schema),
      flags: schema
        ? {
            USE_SCHEMA_QUEUE_READS: Boolean(schema.USE_SCHEMA_QUEUE_READS),
            USE_SCHEMA_OUTCOME_WRITES: Boolean(schema.USE_SCHEMA_OUTCOME_WRITES),
            queueReadSource: schema.queueReadSource ?? null,
            outcomeWriteMode: schema.outcomeWriteMode ?? null,
            persistenceBackend: schema.persistenceBackend ?? null,
          }
        : null,
      raw: body,
    };
  } catch (err) {
    return { reachable: false, baseUrl: BASE_URL, error: err.message };
  }
}

function parseArgs(argv) {
  const args = {
    legacyId: null,
    offerSlug: "website",
    label: "snapshot",
    compare: null,
  };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--legacy-id") args.legacyId = argv[++i];
    else if (arg === "--offer") args.offerSlug = argv[++i];
    else if (arg === "--label") args.label = argv[++i];
    else if (arg === "--compare") args.compare = argv[++i];
  }
  return args;
}

function diffSnapshots(before, after) {
  if (!before || !after) return null;
  return {
    attemptCountDelta: after.schema.attemptCount - before.schema.attemptCount,
    opportunityStatusChanged: before.schema.outreachStatus !== after.schema.outreachStatus,
    queueStateChanged: before.schema.queueState !== after.schema.queueState,
    legacyStatusChanged:
      before.legacy?.outreachStatus !== after.legacy?.outreachStatus ||
      before.legacy?.queueState !== after.legacy?.queueState,
    legacyNoteCountDelta:
      (after.legacy?.noteCount ?? 0) - (before.legacy?.noteCount ?? 0),
    schemaAttemptIncreased: after.schema.attemptCount > before.schema.attemptCount,
  };
}

function classifyConclusion({ productionFlags, localDiagnostics, counts, diff, legacyId }) {
  if (!productionFlags.reachable) {
    return "production unreachable — rerun with valid BASE_URL";
  }
  if (!productionFlags.hasSchemaDiagnostics) {
    return "production still legacy only (deploy diagnostics build, then rerun)";
  }
  if (
    !productionFlags.flags?.USE_SCHEMA_QUEUE_READS &&
    !productionFlags.flags?.USE_SCHEMA_OUTCOME_WRITES
  ) {
    return "schema flags not active";
  }
  if (localDiagnostics.persistenceBackend !== "vercel-blob") {
    return "schema data missing locally — set BLOB_READ_WRITE_TOKEN to inspect production blob";
  }
  if (!counts || counts.businesses === 0 || counts.opportunities === 0) {
    return "schema data missing";
  }
  if (legacyId && diff) {
    if (
      diff.schemaAttemptIncreased &&
      (diff.opportunityStatusChanged || diff.legacyNoteCountDelta > 0) &&
      (diff.legacyStatusChanged || diff.legacyNoteCountDelta > 0)
    ) {
      return "schema cutover working";
    }
    if (productionFlags.flags?.USE_SCHEMA_OUTCOME_WRITES && !diff.schemaAttemptIncreased) {
      return "schema flags active but write effect not observed for test lead";
    }
  }
  if (productionFlags.flags?.USE_SCHEMA_QUEUE_READS) {
    return "schema queue reads likely active — perform UI write test and rerun with --compare";
  }
  return "inconclusive — rerun after UI test with --legacy-id";
}

async function main() {
  await loadEnv();
  const args = parseArgs(process.argv);

  const [productionFlags, localDiagnostics, counts] = await Promise.all([
    fetchProductionFlags(),
    Promise.resolve(getSchemaRuntimeDiagnostics()),
    readSchemaCollectionCounts().catch((err) => ({ error: err.message })),
  ]);

  let leadSnapshot = null;
  let compareDiff = null;
  let compareBefore = null;

  if (args.legacyId) {
    leadSnapshot = await readLeadWriteSnapshot(args.legacyId, args.offerSlug);
  }

  if (args.compare) {
    try {
      compareBefore = JSON.parse(await readFile(args.compare, "utf8"));
      compareDiff = diffSnapshots(compareBefore.leadSnapshot, leadSnapshot);
    } catch (err) {
      compareDiff = { error: err.message };
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    flagsActive:
      productionFlags.flags?.USE_SCHEMA_QUEUE_READS === true ||
      productionFlags.flags?.USE_SCHEMA_OUTCOME_WRITES === true
        ? {
            USE_SCHEMA_QUEUE_READS: productionFlags.flags?.USE_SCHEMA_QUEUE_READS === true,
            USE_SCHEMA_OUTCOME_WRITES: productionFlags.flags?.USE_SCHEMA_OUTCOME_WRITES === true,
          }
        : productionFlags.hasSchemaDiagnostics
          ? {
              USE_SCHEMA_QUEUE_READS: false,
              USE_SCHEMA_OUTCOME_WRITES: false,
            }
          : "unknown — deploy latest code and check /api/health",
    queueSourceUsed: productionFlags.flags?.queueReadSource ?? "unknown",
    attemptsBefore: compareBefore?.counts?.attempts ?? counts?.attempts ?? null,
    attemptsAfter: counts?.attempts ?? null,
    attemptCountDelta: compareDiff?.attemptCountDelta ?? null,
    opportunityUpdated: compareDiff?.opportunityStatusChanged ?? null,
    queueItemUpdated: compareDiff?.queueStateChanged ?? null,
    legacyUpdated:
      compareDiff?.legacyStatusChanged === true || (compareDiff?.legacyNoteCountDelta ?? 0) > 0
        ? true
        : compareDiff
          ? false
          : null,
    productionFlags,
    localDiagnostics,
    counts,
    leadSnapshot,
    compareDiff,
    conclusion: classifyConclusion({
      productionFlags,
      localDiagnostics,
      counts,
      diff: compareDiff,
      legacyId: args.legacyId,
    }),
    howToRun: {
      beforeUiTest: "node scripts/verify-production-schema-effect.js --label before > data/migration/production-verification/before.json",
      afterUiTest:
        "node scripts/verify-production-schema-effect.js --legacy-id qbd_XXXX --offer website --compare data/migration/production-verification/before.json",
      productionFlags: `curl ${BASE_URL}/api/health`,
      vercelLogs: "Look for [schema-queue-read] source=schema|legacy when loading queues",
    },
  };

  await mkdir(OUTPUT_DIR, { recursive: true });
  const outPath = join(OUTPUT_DIR, `${args.label}.json`);
  await writeFile(outPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  console.log("Production schema effect verification");
  console.log("───────────────────────────────────");
  console.log(`Production URL: ${BASE_URL}`);
  console.log(
    `Flags active: ${
      typeof report.flagsActive === "string"
        ? report.flagsActive
        : `reads=${report.flagsActive.USE_SCHEMA_QUEUE_READS} writes=${report.flagsActive.USE_SCHEMA_OUTCOME_WRITES}`
    }`,
  );
  console.log(`Queue source (from prod health): ${report.queueSourceUsed}`);
  console.log(`Attempts count (blob/local): ${counts?.attempts ?? "n/a"}`);
  if (compareDiff && compareDiff.attemptCountDelta != null) {
    console.log(`Attempt delta: ${compareDiff.attemptCountDelta}`);
    console.log(`Opportunity updated: ${report.opportunityUpdated}`);
    console.log(`Queue item updated: ${report.queueItemUpdated}`);
    console.log(`Legacy updated: ${report.legacyUpdated}`);
  }
  console.log(`Conclusion: ${report.conclusion}`);
  console.log(`Report: ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
