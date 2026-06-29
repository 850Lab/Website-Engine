import { readFile } from "node:fs/promises";
import { bootstrapValidator, finalizeValidator, shouldSkipNestedRegressions } from "../../src/engine/validation/index.js";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { buildOpportunityRadar } from "../../src/engine/intelligence/index.js";
import { listOffersWithCapabilities } from "../../src/engine/offers/index.js";
import { CEO_MODES } from "../../src/engine/score-council/index.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const errors = [];
const __validationStartedAt = Date.now();
await bootstrapValidator("0.5");

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

if (!(await fileExists(join(ROOT, "docs/opportunity-os/21-ontology-convergence-plan.md")))) {
  fail("docs/opportunity-os/21-ontology-convergence-plan.md is missing");
} else {
  pass("Ontology convergence plan exists");
}

if (!(await fileExists(join(ROOT, "engine-data/capabilities/capabilities.json")))) {
  fail("engine-data/capabilities/capabilities.json is missing");
} else {
  pass("Capability registry file exists");
}

const offers = JSON.parse(await readFile(join(ROOT, "engine-data/offers/offers.json"), "utf8"));
const capabilities = JSON.parse(await readFile(join(ROOT, "engine-data/capabilities/capabilities.json"), "utf8"));
const capabilityIds = new Set(capabilities.map((row) => row.id));

for (const offer of offers) {
  if (!Array.isArray(offer.capabilityIds) || offer.capabilityIds.length === 0) {
    fail(`Offer ${offer.id} is missing capabilityIds`);
    continue;
  }
  for (const capabilityId of offer.capabilityIds) {
    if (!capabilityIds.has(capabilityId)) {
      fail(`Offer ${offer.id} references unknown capabilityId ${capabilityId}`);
    }
  }
}
if (errors.length === 0) {
  pass("Every offer has valid capabilityIds");
}

const offersWithCapabilities = await listOffersWithCapabilities();
if (!offersWithCapabilities.length) {
  fail("listOffersWithCapabilities() returned no offers");
} else if (!offersWithCapabilities.every((offer) => Array.isArray(offer.capabilities) && offer.capabilities.length > 0)) {
  fail("listOffersWithCapabilities() did not attach capabilities");
} else {
  pass("listOffersWithCapabilities() works");
}

const radar = await buildOpportunityRadar();
if (!radar.length) {
  fail("buildOpportunityRadar() returned no opportunities");
} else {
  pass("buildOpportunityRadar() returns opportunities");
}

const top = radar[0];
if (!top) {
  fail("No top opportunity to inspect");
} else {
  if (!top.scoreVector || typeof top.scoreVector !== "object") {
    fail("Top opportunity is missing scoreVector");
  } else {
    pass("Top opportunity has scoreVector");
  }

  if (!top.scoreCouncil || typeof top.scoreCouncil !== "object") {
    fail("Top opportunity is missing scoreCouncil");
  } else {
    pass("Top opportunity has scoreCouncil");
  }

  if (typeof top.opportunityScore !== "number") {
    fail("Top opportunity is missing opportunityScore");
  } else if (top.opportunityScore !== top.scoreCouncil.compositeScore) {
    fail("opportunityScore does not match scoreCouncil.compositeScore");
  } else {
    pass("opportunityScore remains present and matches compositeScore");
  }
}

for (const mode of Object.keys(CEO_MODES)) {
  const modeRadar = await buildOpportunityRadar({ mode });
  if (!modeRadar.length || typeof modeRadar[0].scoreCouncil.compositeScore !== "number") {
    fail(`CEO mode ${mode} failed to score opportunities`);
  }
}
if (!errors.some((message) => message.includes("CEO mode"))) {
  pass("All CEO modes can score at least one opportunity");
}

await finalizeValidator({ phase: "0.5", errors, startedAt: __validationStartedAt });

console.log("\nPhase 0.5 validation passed.");