import { collectAutopilotState } from "./autopilot-status.js";

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
  fail(`Git working tree is not clean (${state.dirtyFiles.length} file(s) changed)`);
  for (const file of state.dirtyFiles.slice(0, 20)) {
    console.error(`  - ${file}`);
  }
  if (state.dirtyFiles.length > 20) {
    console.error(`  ... and ${state.dirtyFiles.length - 20} more`);
  }
} else {
  pass("Git working tree is clean");
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
