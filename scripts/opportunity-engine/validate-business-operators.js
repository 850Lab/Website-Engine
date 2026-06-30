import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  APARTMENT_WORKSHOP_TEMPLATE_ID,
  KTM_TEMPLATE_ID,
  PRESSURE_WASHING_TEMPLATE_ID,
  WEBSITE_AGENCY_TEMPLATE_ID,
  createApartmentWorkshopMissionTemplate,
  createKtmMissionTemplate,
  createPressureWashingMissionTemplate,
  createWebsiteAgencyMissionTemplate,
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
const apartmentTemplate = templates.find((template) => template.templateId === APARTMENT_WORKSHOP_TEMPLATE_ID);
const pressureTemplate = templates.find((template) => template.templateId === PRESSURE_WASHING_TEMPLATE_ID);
const ktmTemplate = templates.find((template) => template.templateId === KTM_TEMPLATE_ID);
const websiteTemplate = templates.find((template) => template.templateId === WEBSITE_AGENCY_TEMPLATE_ID);
if (!apartmentTemplate) {
  fail("Apartment workshop mission template is missing from business operator templates");
} else {
  pass("Apartment workshop mission template is registered");
}
if (!pressureTemplate) {
  fail("Pressure washing mission template is missing from business operator templates");
} else {
  pass("Pressure washing mission template is registered");
}
if (!ktmTemplate) {
  fail("KTM mission template is missing from business operator templates");
} else {
  pass("KTM mission template is registered");
}
if (!websiteTemplate) {
  fail("Website agency mission template is missing from business operator templates");
} else {
  pass("Website agency mission template is registered");
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

const ktmMission = createKtmMissionTemplate();
const ktmValidation = await validateMission(ktmMission);
if (!ktmValidation.valid) {
  fail(`KTM mission template failed validation: ${ktmValidation.errors.join("; ")}`);
} else {
  pass("KTM mission template creates a valid mission");
}

if (ktmMission.offers?.[0] !== "offer_ktm_manpower") {
  fail("KTM template must use offer_ktm_manpower");
} else {
  pass("KTM template maps to offer_ktm_manpower");
}

for (const capabilityId of ["ktm_labor", "fire_watch", "hole_watch", "safety_support", "maintenance_support"]) {
  if (!ktmMission.capabilities?.includes(capabilityId)) {
    fail(`KTM template must include ${capabilityId} capability`);
  }
}
if (!errors.some((message) => message.includes("KTM template must include"))) {
  pass("KTM template maps to supported industrial capabilities");
}

if (!ktmMission.geography?.some((geo) => geo.city === "Beaumont" && geo.state === "TX" && geo.radiusMiles === 500)) {
  fail("KTM template must target a 500-mile radius from Beaumont, TX");
} else {
  pass("KTM template targets Beaumont 500-mile radius");
}

if (!ktmMission.buyerTypes?.some((buyer) => /maintenance manager|safety manager|turnaround/i.test(buyer))) {
  fail("KTM template must include industrial decision makers");
} else {
  pass("KTM template includes industrial decision makers");
}

if (!ktmMission.requiredSignals?.some((signal) => /turnaround|shutdown|staffing shortages|safety coverage/i.test(signal))) {
  fail("KTM template must include industrial trigger signals");
} else {
  pass("KTM template includes industrial trigger signals");
}

if (ktmMission.approvalPolicy?.requireFounderApprovalBeforeOutreach !== true) {
  fail("KTM template must keep outreach approval gate enabled");
} else {
  pass("KTM template keeps outreach approval gate enabled");
}

const apartmentMission = createApartmentWorkshopMissionTemplate();
const apartmentValidation = await validateMission(apartmentMission);
if (!apartmentValidation.valid) {
  fail(`Apartment workshop mission template failed validation: ${apartmentValidation.errors.join("; ")}`);
} else {
  pass("Apartment workshop mission template creates a valid mission");
}

if (apartmentMission.offers?.[0] !== "offer_website_growth") {
  fail("Apartment workshop template must use offer_website_growth until a dedicated offer is approved");
} else {
  pass("Apartment workshop template maps to supported offer_website_growth");
}

for (const capabilityId of ["website_growth", "lead_generation"]) {
  if (!apartmentMission.capabilities?.includes(capabilityId)) {
    fail(`Apartment workshop template must include ${capabilityId} capability`);
  }
}
if (!errors.some((message) => message.includes("Apartment workshop template must include"))) {
  pass("Apartment workshop template maps to supported growth capabilities");
}

if (
  !apartmentMission.geography?.some((geo) => geo.city === "Beaumont" && geo.state === "TX" && geo.radiusMiles === 500)
) {
  fail("Apartment workshop template must target a 500-mile radius from Beaumont, TX");
} else {
  pass("Apartment workshop template targets Beaumont 500-mile radius");
}

if (!apartmentMission.buyerTypes?.some((buyer) => /property manager|apartment owner|sponsor/i.test(buyer))) {
  fail("Apartment workshop template must include apartment and sponsor decision makers");
} else {
  pass("Apartment workshop template includes apartment and sponsor decision makers");
}

if (!apartmentMission.requiredSignals?.some((signal) => /resident|community|sponsor/i.test(signal))) {
  fail("Apartment workshop template must include apartment workshop trigger signals");
} else {
  pass("Apartment workshop template includes apartment workshop trigger signals");
}

if (apartmentMission.approvalPolicy?.requireFounderApprovalBeforeOutreach !== true) {
  fail("Apartment workshop template must keep outreach approval gate enabled");
} else {
  pass("Apartment workshop template keeps outreach approval gate enabled");
}

const websiteMission = createWebsiteAgencyMissionTemplate();
const websiteValidation = await validateMission(websiteMission);
if (!websiteValidation.valid) {
  fail(`Website agency mission template failed validation: ${websiteValidation.errors.join("; ")}`);
} else {
  pass("Website agency mission template creates a valid mission");
}

if (websiteMission.offers?.[0] !== "offer_website_growth") {
  fail("Website agency template must use offer_website_growth");
} else {
  pass("Website agency template maps to offer_website_growth");
}

for (const capabilityId of ["website_growth", "lead_generation"]) {
  if (!websiteMission.capabilities?.includes(capabilityId)) {
    fail(`Website agency template must include ${capabilityId} capability`);
  }
}
if (!errors.some((message) => message.includes("Website agency template must include"))) {
  pass("Website agency template maps to supported growth capabilities");
}

if (!websiteMission.buyerTypes?.some((buyer) => /owner|manager/i.test(buyer))) {
  fail("Website agency template must include local business decision makers");
} else {
  pass("Website agency template includes local business decision makers");
}

if (!websiteMission.requiredSignals?.some((signal) => /weak website|conversion|rebrand/i.test(signal))) {
  fail("Website agency template must include website growth trigger signals");
} else {
  pass("Website agency template includes website growth trigger signals");
}

if (websiteMission.approvalPolicy?.requireFounderApprovalBeforeOutreach !== true) {
  fail("Website agency template must keep outreach approval gate enabled");
} else {
  pass("Website agency template keeps outreach approval gate enabled");
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
