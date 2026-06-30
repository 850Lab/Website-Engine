import { readFile, access } from "node:fs/promises";
import { bootstrapValidator, finalizeValidator } from "../../src/engine/validation/index.js";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  analyzeFounderIntent,
  isIntentObject,
  prepareChiefOfStaffPlan,
  prepareChiefOfStaffPlanFromClarification,
  interpretFounderIntent,
  completeMissionFromClarification,
  splitMultiMissionBrief,
  validateMission,
  saveMission,
  activateMission,
  listMissions,
  getActiveMissions,
  clearMissionStoreForTests,
  getMissionRegistrySummary,
  alignOpportunityToMission,
  rankOpportunitiesForMission,
  attachStrategyToMission,
  summarizeMission,
  recommendEngineeringTasks,
  validateEngineeringTask,
  isLlmInterpreterEnabled,
  normalizeMission,
  createEmptyMission,
} from "../../src/engine/founder-intent/index.js";
import { assertEngineDataClean } from "./assert-engine-data-clean.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const FOUNDER_INTENT_DIR = join(ROOT, "src/engine/founder-intent");
const errors = [];
const __validationStartedAt = Date.now();
await bootstrapValidator("4.1");

function fail(message) {
  errors.push(message);
  console.error(`FAIL: ${message}`);
}

function pass(message) {
  console.log(`PASS: ${message}`);
}

async function fileExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function readSource(relPath) {
  return readFile(join(ROOT, relPath), "utf8");
}

pass("Founder Intent Interpreter module loads");

if (isLlmInterpreterEnabled()) {
  pass("LLM interpreter available when MISSION_INTERPRETER_LLM=1 and OPENAI_API_KEY are set");
} else {
  pass("Rules interpreter is default when LLM is not explicitly enabled");
}

const replacementIntent = analyzeFounderIntent(
  "I need to replace my job with pressure washing and KTM. I want 10,000 emails/month per offer and I can travel 500 miles from Beaumont.",
);
if (!isIntentObject(replacementIntent)) {
  fail("Intent Engine did not create a valid intent object");
} else {
  pass("Intent Engine creates structured intent objects from Founder language");
}

if (
  !replacementIntent.detectedGoals.includes("replace_job_income") ||
  !replacementIntent.scaleTargets.some((row) => row.type === "email_volume") ||
  !replacementIntent.constraintsMentioned.some((row) => row.type === "geography_radius")
) {
  fail("Intent Engine missed replacement-income, scale, or geography signals");
} else {
  pass("Intent Engine detects replacement-income, scale, and travel-radius constraints");
}

const pressureIntent = "I need to make money with pressure washing.";
const pressureFirst = await interpretFounderIntent(pressureIntent, { mode: "rules" });
if (pressureFirst.status !== "clarify") {
  fail(`Expected clarification for pressure washing intent, got ${pressureFirst.status}`);
} else {
  pass("Pressure washing intent triggers clarification before mission creation");
}

const pressureCompleted = await completeMissionFromClarification(pressureFirst.draft, {
  geography: "500 miles from Beaumont, Texas",
  revenueTarget: "$20,000/month",
  buyerTypes: "Restaurants, Retail, Office, Medical, Industrial",
  preferredChannels: "Email, Cold Call, Visit",
  residentialCommercial: "Commercial",
  equipment: "4 GPM cold water; entryways, sidewalks, buildings",
  deadline: "90 days",
});
if (pressureCompleted.status !== "ready" || !pressureCompleted.mission) {
  fail(
    `Pressure washing mission not ready after clarification: ${pressureCompleted.status}${
      pressureCompleted.validation?.errors?.length
        ? ` (${pressureCompleted.validation.errors.join("; ")})`
        : ""
    }`,
  );
} else {
  pass("Pressure washing mission becomes deterministic after clarification");
}

if (!pressureCompleted.mission?.offers?.includes("offer_pressure_washing")) {
  fail("Pressure washing mission missing offer_pressure_washing");
} else {
  pass("Pressure washing mission maps to offer_pressure_washing");
}

const ktmIntent = "Help KTM win industrial maintenance contracts around turnarounds and refinery work.";
const ktmResult = await interpretFounderIntent(ktmIntent, { mode: "rules" });
if (ktmResult.status !== "clarify" && ktmResult.status !== "ready") {
  fail(`Unexpected KTM interpreter status: ${ktmResult.status}`);
} else {
  pass("KTM industrial intent interpreted without requiring exact signal vocabulary");
}

const ktmMission = attachStrategyToMission(
  normalizeMission({
    ...(ktmResult.mission || ktmResult.draft),
    geography: [{ label: "Beaumont, TX", city: "Beaumont", state: "TX", country: "US", radiusMiles: 250 }],
    revenueTarget: { amount: 50000, period: "month", currency: "USD" },
    buyerTypes: ["Industrial contractors", "Refineries", "Turnaround planners"],
    preferredChannels: ["Email", "Phone"],
    deadline: "120 days",
  }),
);
const ktmValidation = await validateMission(ktmMission);
if (!ktmValidation.valid) {
  fail(`KTM mission validation failed: ${ktmValidation.errors.join("; ")}`);
} else {
  pass("KTM industrial mission validates against supported offers and capabilities");
}

if (!ktmMission.strategy?.recommendedSearchSignals?.some((row) => /turnaround|shutdown|maintenance/i.test(row))) {
  fail("KTM mission strategy missing industrial signal recommendations");
} else {
  pass("KTM mission strategy recommends turnaround/maintenance search signals");
}

const apartmentIntent =
  "I need apartment complexes that will allow me to host financial workshops and recruit local sponsors.";
const apartmentResult = await interpretFounderIntent(apartmentIntent, { mode: "rules" });
const apartmentMission = attachStrategyToMission(
  normalizeMission({
    ...(apartmentResult.mission || apartmentResult.draft),
    geography: [{ label: "Beaumont, TX", city: "Beaumont", state: "TX", country: "US", radiusMiles: 200 }],
    revenueTarget: { amount: 10000, period: "month", currency: "USD" },
    buyerTypes: ["Property managers", "Regional managers", "Apartment owners"],
    preferredChannels: ["Email", "Phone", "Visit"],
    deadline: "6 months",
  }),
);
const apartmentValidation = await validateMission(apartmentMission);
if (!apartmentValidation.valid) {
  fail(`Apartment workshop mission validation failed: ${apartmentValidation.errors.join("; ")}`);
} else {
  pass("Apartment financial workshop mission validates successfully");
}

const multiIntent =
  "I need cash flow in 90 days from pressure washing, KTM industrial contracts, and apartment financial workshops within 500 miles of Beaumont.";
const multiResult = await interpretFounderIntent(multiIntent, { mode: "rules" });
const multiDraft = multiResult.mission || multiResult.draft;
const splitMissions = splitMultiMissionBrief(multiDraft);
if (splitMissions.length < 3) {
  fail(`Expected multi-mission brief to split into at least 3 missions, got ${splitMissions.length}`);
} else {
  pass("Multi-mission founder brief splits into separate mission specifications");
}

const invalidMission = createEmptyMission({
  name: "Invalid Mission",
  goal: "Test invalid offer",
  geography: [{ label: "Beaumont, TX", state: "TX" }],
  offers: ["offer_does_not_exist"],
  approvalPolicy: { requireFounderApprovalBeforeOutreach: true, maxAutonomousActionsPerDay: 0 },
});
const invalidValidation = await validateMission(invalidMission);
if (invalidValidation.valid) {
  fail("Invalid mission with unsupported offer should be rejected");
} else {
  pass("Mission validator rejects unsupported offers");
}

await clearMissionStoreForTests();
const savedPressure = await saveMission({ ...pressureCompleted.mission, status: "active" });
const savedKtm = await saveMission({ ...ktmMission, status: "active" });
const savedApartment = await saveMission({ ...apartmentMission, status: "active" });
const active = await getActiveMissions();
if (active.length < 3) {
  fail(`Expected at least 3 active missions in registry, got ${active.length}`);
} else {
  pass("Mission registry supports multiple simultaneous ACTIVE missions");
}

const summary = getMissionRegistrySummary(await listMissions());
if (summary.active < 3) {
  fail("Mission registry summary undercounted active missions");
} else {
  pass("Mission registry summary reports active mission counts");
}

await activateMission(savedPressure.mission.missionId);
pass("Mission activation path works");

const alignment = alignOpportunityToMission(
  {
    title: "KTM Manpower and Safety Support — Maintenance support demand is increasing",
    offerId: "offer_ktm_manpower",
    signalType: "maintenance",
    confidence: 0.71,
    urgency: "high",
    location: { city: "Beaumont", state: "TX" },
  },
  ktmMission,
);
if (typeof alignment.missionMatch !== "number" || !alignment.recommendedNextAction) {
  fail("Mission alignment missing required scoring fields");
} else {
  pass("Mission alignment returns mission fit and recommended next action");
}

const ranked = rankOpportunitiesForMission(
  [
    { title: "Random retail website", offerId: "offer_website_growth", confidence: 0.4 },
    {
      title: "KTM support for turnaround labor surge",
      offerId: "offer_ktm_manpower",
      signalType: "turnaround",
      confidence: 0.8,
      location: { city: "Beaumont", state: "TX" },
    },
  ],
  ktmMission,
);
if (ranked[0]?.opportunity?.offerId !== "offer_ktm_manpower") {
  fail("Mission-ranked opportunities did not prioritize mission fit");
} else {
  pass("Opportunities rank by mission fit rather than global importance");
}

const markdown = summarizeMission(savedKtm.mission, savedKtm.mission.strategy);
if (!markdown.includes("Founder approval required before outreach")) {
  fail("Mission summary missing approval policy");
} else {
  pass("Mission summary includes founder approval policy");
}

const engineeringTasks = recommendEngineeringTasks({ intent: replacementIntent, mission: pressureCompleted.mission });
if (!engineeringTasks.length) {
  fail("Engineering Director did not create task drafts for mission gaps");
} else {
  pass("Engineering Director creates approval-gated engineering task drafts");
}

const invalidTask = engineeringTasks.find((task) => !validateEngineeringTask(task).valid);
if (invalidTask) {
  fail(`Engineering task failed validation: ${invalidTask.taskId}`);
} else {
  pass("Engineering task drafts validate against the Phase 4.1 schema");
}

if (engineeringTasks.some((task) => task.approvalRequired !== true)) {
  fail("Engineering tasks must require approval");
} else {
  pass("Engineering tasks preserve approval gates");
}

const chiefFirst = await prepareChiefOfStaffPlan("I need to make money with pressure washing.", {
  interpreterOptions: { mode: "rules" },
});
if (chiefFirst.status !== "clarify" || !chiefFirst.clarification?.questions?.length) {
  fail("AI Chief of Staff should ask clarifying questions before pressure washing mission creation");
} else {
  pass("AI Chief of Staff orchestrates intent + clarification");
}

const chiefReady = await prepareChiefOfStaffPlanFromClarification(chiefFirst.draft, {
  geography: "500 miles from Beaumont, Texas",
  revenueTarget: "$20,000/month",
  buyerTypes: "Restaurants, Retail, Office, Medical, Industrial",
  preferredChannels: "Email, Cold Call, Visit",
  residentialCommercial: "Commercial",
  equipment: "4 GPM cold water; entryways, sidewalks, buildings",
  deadline: "90 days",
});
if (chiefReady.status !== "ready" || chiefReady.approvalGates?.outreachExecutionAllowed !== false) {
  fail("AI Chief of Staff should produce a ready plan with outreach blocked");
} else {
  pass("AI Chief of Staff creates mission, strategy, engineering tasks, and blocked outreach gates");
}

const forbiddenPatterns = [
  { file: "src/engine/founder-intent/index.js", patterns: ["orchestrator", "processNextJob", "buildOpportunity", "runOpenClaw", "dispatchNextJob"] },
  { file: "src/engine/founder-intent/mission-interpreter.js", patterns: ["createSignal", "appendEvent", "processNextJob"] },
  { file: "src/engine/founder-intent/mission-registry.js", patterns: ["engine-data/"] },
  { file: "src/engine/founder-intent/ai-chief-of-staff.js", patterns: ["saveMission", "appendEvent", "processNextJob", "sendEmail"] },
  { file: "src/engine/founder-intent/engineering-director.js", patterns: ["writeJsonAtomic", "runOpenClaw", "dispatchNextJob"] },
];
for (const check of forbiddenPatterns) {
  const source = await readSource(check.file);
  for (const pattern of check.patterns) {
    if (source.includes(pattern)) {
      fail(`Forbidden pattern ${pattern} found in ${check.file}`);
    }
  }
}
if (!errors.some((message) => message.includes("Forbidden pattern"))) {
  pass("Founder Intent layer does not import or call pipeline execution directly");
}

for (const rel of [
  "src/engine/founder-intent/intent-engine.js",
  "src/engine/founder-intent/ai-chief-of-staff.js",
  "src/engine/founder-intent/engineering-director.js",
  "src/engine/founder-intent/mission-schema.js",
  "src/engine/founder-intent/mission-interpreter.js",
  "src/engine/founder-intent/clarification-engine.js",
  "src/engine/founder-intent/mission-validator.js",
  "src/engine/founder-intent/mission-registry.js",
  "src/engine/founder-intent/mission-strategy.js",
  "src/engine/founder-intent/mission-summary.js",
  "src/engine/founder-intent/index.js",
]) {
  if (!(await fileExists(join(ROOT, rel)))) {
    fail(`Missing deliverable ${rel}`);
  }
}
if (!errors.some((message) => message.includes("Missing deliverable"))) {
  pass("All Phase 4.1 deliverable modules exist");
}

try {
  await assertEngineDataClean();
  pass("engine-data/ unchanged by founder intent layer");
} catch (error) {
  fail(error.message);
}

await finalizeValidator({ phase: "4.1", errors, startedAt: __validationStartedAt });

console.log("\nPhase 4.1 validation passed.");
console.log("Founder Intent Interpreter complete. Outreach remains blocked. STOP.");
