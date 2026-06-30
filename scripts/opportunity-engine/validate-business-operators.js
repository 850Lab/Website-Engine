import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  PRESSURE_WASHING_TEMPLATE_ID,
  createPressureWashingMissionTemplate,
  listBusinessOperatorMissionTemplates,
  validateMission,
} from "../../src/engine/founder-intent/index.js";
import { assertEngineDataClean } from "./assert-engine-data-clean.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const errors = [];

function fail(message) {
  errors.push(message);
  console.error(`FAIL: ${message}`);
}

function pass(message) {
  console.log(`PASS: ${message}`);
}

const templates = listBusinessOperatorMissionTemplates();
const pressureTemplate = templates.find((template) => template.templateId === PRESSURE_WASHING_TEMPLATE_ID);
if (!pressureTemplate) {
  fail("Pressure washing mission template is missing from business operator templates");
} else {
  pass("Pressure washing mission template is registered");
}

const mission = createPressureWashingMissionTemplate();
const validation = await validateMission(mission);
if (!validation.valid) {
  fail(`Pressure washing mission template failed validation: ${validation.errors.join("; ")}`);
} else {
  pass("Pressure washing mission template creates a valid mission");
}

if (mission.offers?.[0] !== "offer_pressure_washing") {
  fail("Pressure washing template must use offer_pressure_washing");
} else {
  pass("Pressure washing template maps to offer_pressure_washing");
}

if (!mission.capabilities?.includes("exterior_cleaning")) {
  fail("Pressure washing template must include exterior_cleaning capability");
} else {
  pass("Pressure washing template maps to exterior_cleaning capability");
}

if (!mission.geography?.some((geo) => geo.city === "Beaumont" && geo.state === "TX" && geo.radiusMiles === 500)) {
  fail("Pressure washing template must target a 500-mile radius from Beaumont, TX");
} else {
  pass("Pressure washing template targets Beaumont 500-mile radius");
}

if (!mission.buyerTypes?.some((buyer) => /property manager|property owner/i.test(buyer))) {
  fail("Pressure washing template must include commercial property decision makers");
} else {
  pass("Pressure washing template includes commercial property decision makers");
}

if (!mission.requiredSignals?.some((signal) => /business openings|store remodels|shopping centers/i.test(signal))) {
  fail("Pressure washing template must include commercial buying signals");
} else {
  pass("Pressure washing template includes commercial buying signals");
}

if (mission.approvalPolicy?.requireFounderApprovalBeforeOutreach !== true) {
  fail("Pressure washing template must keep outreach approval gate enabled");
} else {
  pass("Pressure washing template keeps outreach approval gate enabled");
}

const source = await readFile(join(ROOT, "src/engine/founder-intent/business-operators.js"), "utf8");
for (const forbidden of ["saveMission", "createSignal", "processNextJob", "runOpenClaw", "sendEmail", "writeJsonAtomic"]) {
  if (source.includes(forbidden)) {
    fail(`Business operator template contains forbidden execution pattern: ${forbidden}`);
  }
}
if (!errors.some((message) => message.includes("forbidden execution pattern"))) {
  pass("Business operator templates do not execute pipeline, OpenClaw, or outreach");
}

try {
  await assertEngineDataClean();
  pass("engine-data/ unchanged by business operator validation");
} catch (error) {
  fail(error.message);
}

if (errors.length) {
  console.error(`\nBusiness operator validation failed with ${errors.length} error(s).`);
  process.exit(1);
}

console.log("\nBusiness operator validation passed.");
