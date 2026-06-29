import { readFile, readdir, stat } from "node:fs/promises";
import { bootstrapValidator, finalizeValidator, shouldSkipNestedRegressions } from "../../src/engine/validation/index.js";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { ingestManualObservation } from "../../src/engine/signals/ingest-manual.js";
import {
  getSignalById,
  getSignalRegistrySummary,
} from "../../src/engine/signals/index.js";
import { listFacts } from "../../src/engine/facts/index.js";
import { listProblems } from "../../src/engine/problems/index.js";
import { listOpportunities } from "../../src/engine/opportunities/index.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const errors = [];
const __validationStartedAt = Date.now();
await bootstrapValidator("2.2");

function fail(message) {
  errors.push(message);
  console.error(`FAIL: ${message}`);
}

function pass(message) {
  console.log(`PASS: ${message}`);
}

async function fileExists(path) {
  try {
    await readFile(path, "utf8");
    return true;
  } catch {
    return false;
  }
}

async function dirExists(path) {
  try {
    const info = await stat(path);
    return info.isDirectory();
  } catch {
    return false;
  }
}

async function listFilesRecursive(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFilesRecursive(fullPath)));
    } else if (entry.isFile() && entry.name.endsWith(".json") && entry.name !== ".gitkeep") {
      files.push(fullPath);
    }
  }
  return files;
}

const rawDir = join(ROOT, "engine-data/signals/raw");
if (!(await dirExists(rawDir))) {
  fail("engine-data/signals/raw/ directory missing");
} else {
  pass("Raw directory exists");
}

const connectorDir = join(ROOT, "src/engine/signals/connectors");
if (await dirExists(connectorDir)) {
  fail("Connector code directory exists");
} else {
  pass("No connector code");
}

for (const path of [join(ROOT, "engine-data/facts"), join(ROOT, "engine-data/problems")]) {
  if (await dirExists(path)) {
    fail(`Legacy engine-data layer exists: ${path}`);
  }
}
if (!errors.some((message) => message.includes("Legacy engine-data layer"))) {
  pass("No legacy engine-data fact or problem stores added");
}

const homeSource = await readFile(join(ROOT, "src/pivotal-os/pages/home.js"), "utf8");
if (!homeSource.includes("buildMissionControl")) {
  fail("Mission Control home page missing expected import");
} else if (homeSource.includes("ingestManualObservation") || homeSource.includes("ingest-signal")) {
  fail("Mission Control was modified for ingest");
} else {
  pass("No Mission Control changes");
}

const unique = randomUUID();
let ingestResult;
try {
  ingestResult = await ingestManualObservation({
    source: "manual",
    signalType: "company_news",
    headline: `Phase 2.2 validation ${unique}`,
    summary: "ABC Manufacturing announces new facility in Beaumont with $40M investment.",
    location: "Beaumont, TX",
    url: "https://example.com/news/abc-manufacturing",
  });
  pass("Manual ingest workflow works");
} catch (error) {
  fail(`Manual ingest workflow failed: ${error.message}`);
  ingestResult = null;
}

if (ingestResult) {
  const { signal, rawTextRef, observation } = ingestResult;

  if (!rawTextRef || !(await fileExists(join(ROOT, rawTextRef)))) {
    fail("Raw archive file was not created");
  } else {
    pass("Raw files created");
  }

  const rawRecord = JSON.parse(
    await readFile(join(ROOT, rawTextRef), "utf8"),
  );
  if (!rawRecord.originalText || !rawRecord.observationId) {
    fail("Raw archive missing originalText or observationId");
  } else {
    pass("Raw observation archived correctly");
  }

  if (signal.processingState !== "classified") {
    fail(`Expected processingState classified, got ${signal.processingState}`);
  } else {
    pass("Signal classified");
  }

  if (!signal.lifecycle.some((event) => event.to === "captured")) {
    fail("Lifecycle missing captured event");
  } else if (!signal.lifecycle.some((event) => event.to === "normalized")) {
    fail("Lifecycle missing normalized event");
  } else {
    pass("Signal normalized and lifecycle complete");
  }

  if (signal.signalType !== "expansion") {
    fail(`Expected expansion classification from expansion summary, got ${signal.signalType}`);
  } else {
    pass("Signal semantically classified from headline/summary");
  }

  if ((await listFacts()).length > 0) {
    fail("Manual ingest created facts (Phase 2.2 must stop at signals)");
  } else if ((await listProblems()).length > 0) {
    fail("Manual ingest created problems (Phase 2.2 must stop at signals)");
  } else if ((await listOpportunities()).length > 0) {
    fail("Manual ingest created opportunities (Phase 2.2 must stop at signals)");
  } else {
    pass("Manual ingest stops at signal registry (no facts, problems, or opportunities)");
  }

  if (!signal.rawTextRef || signal.rawTextRef !== rawTextRef) {
    fail("Signal rawTextRef does not point to archived observation");
  } else {
    pass("Signal linked to raw observation");
  }

  if (signal.headline !== `Phase 2.2 validation ${unique}`) {
    fail("Signal observation headline mutated unexpectedly");
  } else {
    pass("Observation fields preserved on signal");
  }

  const reloaded = await getSignalById(signal.id);
  if (!reloaded || reloaded.id !== signal.id) {
    fail("Signal not persisted in registry");
  } else {
    pass("Signal persisted in registry");
  }

  if (observation.originalText !== rawRecord.originalText) {
    fail("Raw observation text mismatch");
  }
}

const summary = await getSignalRegistrySummary();
const requiredSummaryFields = [
  "totalSignals",
  "signalsToday",
  "signalsByType",
  "signalsBySource",
  "signalsByState",
  "newestSignal",
  "oldestSignal",
  "unknownSignals",
  "classificationRate",
  "normalizationRate",
];
for (const field of requiredSummaryFields) {
  if (!(field in summary)) fail(`Registry summary missing ${field}`);
}
if (!errors.some((message) => message.includes("Registry summary missing"))) {
  pass("Registry summary extended fields exist");
}

const cliScript = join(ROOT, "scripts/opportunity-engine/ingest-signal.js");
await new Promise((resolve) => {
  const uniqueCli = randomUUID();
  const child = spawn(
    process.execPath,
    [
      cliScript,
      "--source",
      "manual",
      "--type",
      "expansion",
      "--headline",
      `CLI validation ${uniqueCli}`,
      "--summary",
      "Warehouse expansion announced.",
      "--location",
      "Houston, TX",
    ],
    { cwd: ROOT, stdio: "pipe" },
  );

  let output = "";
  child.stdout.on("data", (chunk) => {
    output += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    output += chunk.toString();
  });

  child.on("close", (code) => {
    if (code !== 0 || !output.includes("Observation archived.")) {
      fail(`CLI ingest failed with code ${code}`);
    } else {
      pass("CLI works");
    }
    resolve();
  });
});

const rawFiles = await listFilesRecursive(rawDir);
if (rawFiles.length < 2) {
  fail("Expected at least two raw archive files after ingest tests");
} else {
  pass("Raw archive contains ingested observations");
}

await finalizeValidator({ phase: "2.2", errors, startedAt: __validationStartedAt });

console.log("\nPhase 2.2 validation passed.");