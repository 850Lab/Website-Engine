import { collectAutopilotState, isIgnoredGeneratedReport } from "./autopilot-status.js";

const errors = [];

function fail(message) {
  errors.push(message);
  console.error(`FAIL: ${message}`);
}

function pass(message) {
  console.log(`PASS: ${message}`);
}

const state = await collectAutopilotState();

if (state.isDirty) {
  fail(`Git working tree has blocking changes (${state.blockingDirtyFiles.length} file(s))`);
  for (const file of state.blockingDirtyFiles.slice(0, 20)) {
    console.error(`  - ${file}`);
  }
  if (state.blockingDirtyFiles.length > 20) {
    console.error(`  ... and ${state.blockingDirtyFiles.length - 20} more`);
  }
} else {
  pass("Git working tree is clean (ignored generated reports excluded)");
}

const ignoredDirty = state.dirtyFiles.filter((file) => isIgnoredGeneratedReport(file));
if (ignoredDirty.length) {
  console.log(`NOTE: ${ignoredDirty.length} generated report file(s) ignored for autopilot blocking`);
}

if (state.ownerApprovalRequired || state.currentPhaseStatus === "BLOCKED") {
  fail("Current phase documentation indicates the next subphase is blocked");
} else {
  pass("Current phase is not blocked for active implementation");
}

if (state.missingValidationScripts.length) {
  for (const script of state.missingValidationScripts) {
    fail(`Missing validation script: ${script}`);
  }
} else {
  pass("Required validation scripts exist");
}

console.log("");
console.log("Autopilot check summary");
console.log(`  Phase: ${state.currentPhase} (${state.currentPhaseStatus})`);
console.log(`  Last commit: ${state.lastCommit}`);
console.log(`  Owner approval required: ${state.ownerApprovalRequired ? "yes" : "no"}`);
console.log("");
console.log("Next step:");
console.log(`  ${state.recommendedNextStep}`);
console.log("");
console.log("Validation commands:");
for (const command of state.validationCommands) {
  console.log(`  ${command.startsWith("node") ? command : `node ${command}`}`);
}

if (errors.length) {
  console.error(`\nAutopilot check failed with ${errors.length} issue(s).`);
  console.error("Refresh status with: npm run autopilot:status");
  process.exit(1);
}

console.log("\nAutopilot check passed.");
