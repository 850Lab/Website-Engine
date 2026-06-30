import { readFile, access } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseMasterBacklog,
  selectNextBacklogTask,
  createBuilderPlanFromBacklogTask,
  evaluateBacklogTask,
} from "../../src/engine/founder-intent/index.js";
import { assertEngineDataClean } from "./assert-engine-data-clean.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const BACKLOG_PATH = join(ROOT, "docs/opportunity-os/33-master-engineering-backlog.md");
const EXECUTION_MODEL_PATH = join(ROOT, "docs/opportunity-os/34-engineering-director-execution-model.md");
const errors = [];

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

if (!(await fileExists(BACKLOG_PATH))) {
  fail("Master Engineering Backlog is missing");
}
if (!(await fileExists(EXECUTION_MODEL_PATH))) {
  fail("Engineering Director execution model is missing");
}

const backlogMarkdown = await readFile(BACKLOG_PATH, "utf8");
const executionModel = await readFile(EXECUTION_MODEL_PATH, "utf8");

const parsed = parseMasterBacklog(backlogMarkdown);
if (parsed.tasks.length < 40) {
  fail(`Expected at least 40 backlog tasks, parsed ${parsed.tasks.length}`);
} else {
  pass(`Parsed ${parsed.tasks.length} backlog tasks`);
}

if (parsed.epics.length < 20) {
  fail(`Expected at least 20 backlog epics, parsed ${parsed.epics.length}`);
} else {
  pass("Parsed all required backlog epics");
}

const b1 = parsed.tasks.find((task) => task.id === "B1");
if (!b1) {
  fail("B1 backlog reader task missing from parsed backlog");
} else {
  pass("B1 backlog reader task is present");
}

const initialSelection = selectNextBacklogTask(parsed);
if (initialSelection.selected?.task?.id !== "B1") {
  fail(`Expected B1 as first selected task, got ${initialSelection.selected?.task?.id || "none"}`);
} else {
  pass("Engineering Director selects B1 as first unblocked task");
}

const c2 = parsed.tasks.find((task) => task.id === "C2");
const c2Evaluation = c2 ? evaluateBacklogTask(c2) : null;
if (!c2Evaluation?.blocked) {
  fail("C2 should remain blocked until C1 and source requirements are satisfied");
} else {
  pass("Blocked source connector work is not selected prematurely");
}

const nextAfterB1 = selectNextBacklogTask(parsed, { completedTaskIds: ["B1"] });
if (nextAfterB1.selected?.task?.id === "B1") {
  fail("Completed B1 should not be selected again");
} else if (!nextAfterB1.selected) {
  fail("Expected another ready task after B1 is marked complete");
} else if (nextAfterB1.selected.task.id !== "O-PW1") {
  fail(`Expected pressure washing template after B1, got ${nextAfterB1.selected.task.id}`);
} else {
  pass("After B1, Engineering Director selects the pressure washing mission template");
}

const plan = b1 ? createBuilderPlanFromBacklogTask(b1) : null;
if (!plan?.taskId || !plan?.allowedFiles?.length || !plan?.validationCommands?.length) {
  fail("Builder Plan for B1 missing required fields");
} else {
  pass("Builder Plan contains required execution fields");
}

if (!plan?.validationCommands?.some((command) => command.includes("validate-engineering-director.js"))) {
  fail("Builder Plan must include focused Engineering Director validation");
} else {
  pass("Builder Plan includes focused validation command");
}

if (!executionModel.includes("B1 - Backlog reader and task selector")) {
  fail("Execution model must list B1 as first task under this model");
} else {
  pass("Execution model identifies B1 as the first task");
}

const selectorSource = await readFile(join(ROOT, "src/engine/founder-intent/backlog-selector.js"), "utf8");
const forbidden = ["runOpenClaw", "processNextJob", "appendEvent", "sendEmail", "writeJsonAtomic"];
for (const pattern of forbidden) {
  if (selectorSource.includes(pattern)) {
    fail(`Backlog selector contains forbidden execution pattern: ${pattern}`);
  }
}
if (!errors.some((message) => message.includes("forbidden execution pattern"))) {
  pass("Backlog selector is planning-only and does not execute jobs or outreach");
}

try {
  await assertEngineDataClean();
  pass("engine-data/ unchanged by Engineering Director validation");
} catch (error) {
  fail(error.message);
}

if (errors.length) {
  console.error(`\nEngineering Director validation failed with ${errors.length} error(s).`);
  process.exit(1);
}

console.log("\nEngineering Director validation passed.");
