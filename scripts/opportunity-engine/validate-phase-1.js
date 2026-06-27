import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { buildMissionControl } from "../../src/engine/mission-control/index.js";
import { assembleEvidence } from "../../src/engine/evidence/index.js";
import { renderHomePage } from "../../src/pivotal-os/pages/home.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const errors = [];

const REQUIRED_METRICS = [
  "totalOpportunities",
  "highConfidenceOpportunities",
  "estimatedRevenuePotential",
  "estimatedContractPotential",
  "reachableBuyers",
  "reachableDecisionMakers",
  "averageContactCoverage",
  "capabilitiesAvailable",
  "offersAvailable",
  "marketsAvailable",
  "topCeoMode",
  "cashFlowOpportunity",
  "enterpriseOpportunity",
  "fastestWinOpportunity",
  "recurringOpportunity",
  "fiveMillionPlusOpportunity",
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

if (!(await fileExists(join(ROOT, "src/engine/mission-control/index.js")))) {
  fail("src/engine/mission-control/index.js is missing");
} else {
  pass("Mission Control module exists");
}

if (!(await fileExists(join(ROOT, "src/engine/evidence/index.js")))) {
  fail("src/engine/evidence/index.js is missing");
} else {
  pass("Evidence assembler exists");
}

let mc;
try {
  mc = await buildMissionControl();
  pass("buildMissionControl() builds successfully");
} catch (error) {
  fail(`buildMissionControl() failed: ${error.message}`);
  mc = null;
}

if (mc) {
  for (const key of [
    "generatedAt",
    "mission",
    "executiveSummary",
    "topOpportunity",
    "scoreCouncil",
    "evidence",
    "executionPlan",
    "metrics",
    "alerts",
    "recommendations",
  ]) {
    if (!(key in mc)) fail(`Mission Control missing key: ${key}`);
  }
  if (!errors.some((message) => message.includes("missing key"))) {
    pass("Mission Control returns required projection keys");
  }

  if (!mc.topOpportunity) {
    fail("Top opportunity is missing");
  } else {
    pass("Top opportunity exists");
  }

  if (!mc.scoreCouncil || typeof mc.scoreCouncil !== "object") {
    fail("Score Council is not attached to top opportunity");
  } else {
    pass("Score Council attached");
  }

  if (!mc.topOpportunity?.offerRecord && !mc.topOpportunity?.capabilities?.length) {
    fail("Offer/capability linkage missing on top opportunity");
  } else {
    pass("Offer and capabilities attached");
  }

  if (!mc.topOpportunity?.offerId) {
    fail("Offer ID missing on top opportunity");
  } else {
    pass("Offer attached");
  }

  if (!mc.executionPlan) {
    fail("Execution plan is missing");
  } else {
    pass("Execution plan attached");
  }

  for (const metric of REQUIRED_METRICS) {
    if (!(metric in mc.metrics)) fail(`Executive metric missing: ${metric}`);
  }
  if (!errors.some((message) => message.includes("Executive metric missing"))) {
    pass("Executive metrics exist");
  }

  const hardcodedIds = ["hardcoded_opportunity", "placeholder_opportunity"];
  if (hardcodedIds.includes(mc.topOpportunity?.id)) {
    fail("Top opportunity appears hardcoded");
  } else if (!mc.topOpportunity?.id || !mc.topOpportunity?.source) {
    fail("Top opportunity missing dynamic id/source fields");
  } else {
    pass("No hardcoded opportunities detected");
  }

  const evidence = assembleEvidence(mc.topOpportunity, {
    offerRecord: mc.topOpportunity.offerRecord,
    runnerUp: mc.radar?.topTen?.[1] || null,
    rank: 1,
    totalCount: mc.radar?.primaryCount || 1,
  });
  for (const key of [
    "summary",
    "strengths",
    "weaknesses",
    "assumptions",
    "evidence",
    "confidence",
    "whyNow",
    "whyNotOthers",
  ]) {
    if (!(key in evidence)) fail(`Evidence assembler missing key: ${key}`);
  }
  if (!errors.some((message) => message.includes("Evidence assembler missing"))) {
    pass("Evidence assembler works");
  }

  if (!mc.evidence?.explainability?.why) {
    fail("Explainability missing why");
  } else {
    pass("Explainability present");
  }
}

try {
  await import("./generate-mission-control-report.js");
  if (await fileExists(join(ROOT, "reports/mission-control.md"))) {
    pass("Mission Control report generates");
  } else {
    fail("reports/mission-control.md was not created");
  }
} catch (error) {
  fail(`Mission Control report generation failed: ${error.message}`);
}

const homeSource = await readFile(join(ROOT, "src/pivotal-os/pages/home.js"), "utf8");
if (homeSource.includes("buildOpportunityRadar")) {
  fail("Pivotal OS home still references buildOpportunityRadar");
} else if (!homeSource.includes("buildMissionControl")) {
  fail("Pivotal OS home does not use buildMissionControl");
} else {
  pass("Pivotal OS home imports Mission Control only");
}

try {
  const html = await renderHomePage();
  if (!html.includes(mc?.topOpportunity?.offer || "")) {
    fail("Pivotal OS home render missing top opportunity data");
  } else if (!html.includes("Mission Control")) {
    fail("Pivotal OS home render missing Mission Control sections");
  } else {
    pass("Pivotal OS page renders using Mission Control");
  }
} catch (error) {
  fail(`Pivotal OS home render failed: ${error.message}`);
}

if (errors.length) {
  console.error(`\nPhase 1 validation failed with ${errors.length} error(s).`);
  process.exit(1);
}

console.log("\nPhase 1 validation passed.");
