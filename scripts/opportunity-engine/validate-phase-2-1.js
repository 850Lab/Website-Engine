import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import {
  listSignals,
  getSignalById,
  createSignal,
  normalizeSignal,
  updateSignalState,
  getSignalRegistrySummary,
  getSignalsByState,
  getSignalsBySource,
  getSignalsByType,
  canTransition,
} from "../../src/engine/signals/index.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const errors = [];

const REQUIRED_SIGNAL_FIELDS = [
  "id",
  "source",
  "sourceType",
  "observedAt",
  "capturedAt",
  "location",
  "geo",
  "entitiesMentioned",
  "headline",
  "summary",
  "rawTextRef",
  "url",
  "evidence",
  "confidence",
  "freshness",
  "signalType",
  "urgency",
  "affectedMarkets",
  "affectedCapabilities",
  "possibleProblems",
  "possibleOpportunities",
  "processingState",
  "provenance",
  "hash",
  "dedupKey",
  "riskFlags",
  "factIds",
  "entityIds",
  "problemIds",
  "opportunityIds",
  "createdAt",
  "updatedAt",
  "lifecycle",
];

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

const storePath = join(ROOT, "engine-data/signals/signals.json");
if (!(await fileExists(storePath))) {
  fail("engine-data/signals/signals.json is missing");
} else {
  pass("Signal store exists");
  const store = JSON.parse(await readFile(storePath, "utf8"));
  if (!store.metadata || !Array.isArray(store.signals)) {
    fail("Signal store missing metadata or signals array");
  } else {
    pass("Signal store has metadata and signals array");
  }
}

const modulePath = join(ROOT, "src/engine/signals/index.js");
if (!(await fileExists(modulePath))) {
  fail("src/engine/signals/index.js is missing");
} else {
  pass("Signal module loads");
}

const connectorDir = join(ROOT, "src/engine/signals/connectors");
if (await fileExists(connectorDir)) {
  fail("Connector code directory exists at src/engine/signals/connectors");
} else {
  pass("No connector code was created");
}

const connectorPatterns = [
  join(ROOT, "src/engine/signals/connectors"),
  join(ROOT, "src/engine/signals/connector"),
];
for (const path of connectorPatterns) {
  if (await fileExists(path)) {
    fail(`Connector path detected: ${path}`);
  }
}

let created;
const unique = randomUUID();
try {
  created = await createSignal({
    source: "manual_validation",
    sourceType: "manual",
    observedAt: new Date().toISOString(),
    headline: `Phase 2.1 validation signal ${unique}`,
    summary: "Validation-only signal for lifecycle testing.",
    rawTextRef: `engine-data/signals/raw/validation/${unique}.json`,
    signalType: "crm_event",
    urgency: "low",
    dedupKey: `manual_validation|crm_event|${unique}`,
    provenance: { ingestJobId: `validate_${unique}` },
  });
  pass("createSignal() works");
} catch (error) {
  fail(`createSignal() failed: ${error.message}`);
  created = null;
}

if (created) {
  for (const field of REQUIRED_SIGNAL_FIELDS) {
    if (!(field in created)) {
      fail(`Created signal missing field: ${field}`);
    }
  }
  if (!errors.some((message) => message.includes("missing field"))) {
    pass("Created signal has required fields");
  }

  if (!Array.isArray(created.lifecycle) || created.lifecycle.length === 0) {
    fail("Created signal missing lifecycle[]");
  } else {
    pass("Lifecycle exists on created signal");
  }

  if (created.processingState !== "captured") {
    fail(`Expected processingState captured, got ${created.processingState}`);
  }

  const normalized = normalizeSignal(created);
  if (normalized.headline !== created.headline) {
    fail("normalizeSignal() altered observation headline unexpectedly");
  } else {
    pass("normalizeSignal() preserves observation fields");
  }

  try {
    await updateSignalState(created.id, "classified", { action: "invalid_skip_states" });
    fail("Invalid transition captured -> classified was allowed");
  } catch (transitionError) {
    if (transitionError.message.includes("Invalid transition")) {
      pass("Invalid transition is rejected");
    } else {
      fail(`Unexpected error on invalid transition: ${transitionError.message}`);
    }
  }

  try {
    const updated = await updateSignalState(created.id, "normalized", {
      action: "validation_normalize",
    });
    if (updated.processingState !== "normalized") {
      fail("State transition captured -> normalized did not apply");
    } else if (updated.lifecycle.length < 2) {
      fail("Lifecycle did not append normalized transition");
    } else if (updated.headline !== created.headline) {
      fail("State transition mutated observation headline");
    } else {
      pass("State transition captured -> normalized works");
    }
  } catch (error) {
    fail(`State transition failed: ${error.message}`);
  }

  try {
    await updateSignalState(created.id, "captured");
    fail("Backward transition was allowed");
  } catch (error) {
    if (error.message.includes("Invalid transition")) {
      pass("Backward transition rejected");
    }
  }

  if (!canTransition("rejected", "normalized")) {
    pass("Rejected -> normalized blocked without manual override");
  } else {
    fail("Rejected -> normalized should be blocked by default");
  }

  const reloaded = await getSignalById(created.id);
  if (!reloaded) {
    fail("getSignalById() could not reload created signal");
  } else {
    pass("getSignalById() works");
  }

  const byState = await getSignalsByState("normalized");
  if (!byState.some((row) => row.id === created.id)) {
    fail("getSignalsByState() did not return created signal");
  } else {
    pass("getSignalsByState() works");
  }

  const bySource = await getSignalsBySource("manual_validation");
  if (!bySource.some((row) => row.id === created.id)) {
    fail("getSignalsBySource() did not return created signal");
  } else {
    pass("getSignalsBySource() works");
  }

  const byType = await getSignalsByType("crm_event");
  if (!byType.some((row) => row.id === created.id)) {
    fail("getSignalsByType() did not return created signal");
  } else {
    pass("getSignalsByType() works");
  }
}

const summary = await getSignalRegistrySummary();
if (typeof summary.total !== "number" || !summary.byState || !summary.bySource || !summary.byType) {
  fail("getSignalRegistrySummary() missing expected count fields");
} else {
  pass("Summary counts work");
}

const allSignals = await listSignals();
if (!Array.isArray(allSignals)) {
  fail("listSignals() did not return an array");
} else {
  pass("listSignals() works");
}

if (errors.length) {
  console.error(`\nPhase 2.1 validation failed with ${errors.length} error(s).`);
  process.exit(1);
}

console.log("\nPhase 2.1 validation passed.");
