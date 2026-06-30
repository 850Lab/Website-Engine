import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { bootstrapValidator, finalizeValidator } from "../../src/engine/validation/index.js";
import {
  activateEngineeringTask,
  approveEngineeringTask,
  blockEngineeringTask,
  clearEngineeringTaskStoreForTests,
  completeEngineeringTask,
  createEngineeringTask,
  getEngineeringTaskById,
  getEngineeringTaskRegistrySummary,
  listEngineeringTasks,
  saveEngineeringTask,
} from "../../src/engine/founder-intent/index.js";
import { getRuntimeEngineeringTaskStorePath } from "../../src/engine/runtime/index.js";
import { assertEngineDataClean } from "./assert-engine-data-clean.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const errors = [];
const __validationStartedAt = Date.now();
await bootstrapValidator("4.2");

function fail(message) {
  errors.push(message);
  console.error(`FAIL: ${message}`);
}

function pass(message) {
  console.log(`PASS: ${message}`);
}

await clearEngineeringTaskStoreForTests();
const task = createEngineeringTask({
  taskId: "engtask_validation_registry",
  title: "Validation registry task",
  problem: "Validate engineering task registry lifecycle.",
  scope: {
    allowedPaths: ["src/engine/founder-intent/", "scripts/opportunity-engine/", "docs/opportunity-os/"],
  },
  acceptanceCriteria: ["Task can be persisted", "Lifecycle can be audited", "No execution occurs"],
});

const saved = await saveEngineeringTask(task);
if (!saved.path.endsWith("runtime-validation") && !saved.path.includes("engineering-tasks")) {
  fail("Engineering task registry did not write under engineering-tasks runtime path");
} else {
  pass("Engineering task registry writes under runtime engineering-tasks path");
}

if (getRuntimeEngineeringTaskStorePath() !== saved.path) {
  fail("Runtime engineering task path helper does not match saved registry path");
} else {
  pass("Runtime engineering task path helper resolves registry store");
}

let tasks = await listEngineeringTasks();
if (tasks.length !== 1 || tasks[0].taskId !== task.taskId) {
  fail("Engineering task registry did not persist task");
} else {
  pass("Engineering task registry persists proposed tasks");
}

await approveEngineeringTask(task.taskId, { approvedBy: "validation" });
await activateEngineeringTask(task.taskId, { activatedBy: "validation" });
await blockEngineeringTask(task.taskId, "validation blocker", { blockedBy: "validation" });
await completeEngineeringTask(task.taskId, {
  blockerReason: null,
  validationResult: { command: "node scripts/opportunity-engine/validate-engineering-task-registry.js", ok: true },
  commitHash: "validation-only",
});

const completed = await getEngineeringTaskById(task.taskId);
if (completed?.status !== "completed" || completed?.validationResult?.ok !== true) {
  fail("Engineering task lifecycle did not reach completed with validation result");
} else {
  pass("Engineering task lifecycle supports approve, active, blocked, and completed states");
}

tasks = await listEngineeringTasks();
const summary = getEngineeringTaskRegistrySummary(tasks);
if (summary.completed !== 1 || summary.total !== 1) {
  fail("Engineering task registry summary is incorrect");
} else {
  pass("Engineering task registry summary reports lifecycle counts");
}

let invalidRejected = false;
try {
  await saveEngineeringTask({ taskId: "bad_task", title: "Bad task", mode: "engineering" });
} catch {
  invalidRejected = true;
}
if (!invalidRejected) {
  fail("Engineering task registry should reject invalid task objects");
} else {
  pass("Engineering task registry rejects invalid task objects");
}

const source = await readFile(join(ROOT, "src/engine/founder-intent/engineering-task-registry.js"), "utf8");
for (const forbidden of ["runOpenClaw", "processNextJob", "dispatchNextJob", "sendEmail", "saveMission"]) {
  if (source.includes(forbidden)) {
    fail(`Engineering task registry contains forbidden execution pattern: ${forbidden}`);
  }
}
if (!errors.some((message) => message.includes("forbidden execution pattern"))) {
  pass("Engineering task registry does not execute jobs, OpenClaw, missions, or outreach");
}

try {
  await assertEngineDataClean();
  pass("engine-data/ unchanged by engineering task registry validation");
} catch (error) {
  fail(error.message);
}

await finalizeValidator({ phase: "4.2", errors, startedAt: __validationStartedAt });

console.log("\nEngineering task registry validation passed.");
