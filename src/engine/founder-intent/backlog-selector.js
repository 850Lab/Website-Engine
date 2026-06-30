import { createEngineeringValidationPlan } from "./engineering-director.js";

const BACKLOG_COLUMNS = Object.freeze([
  "id",
  "title",
  "description",
  "businessPurpose",
  "priority",
  "dependencies",
  "validationScript",
  "complexity",
  "businessValue",
  "stopConditions",
  "affectedModules",
  "completionCriteria",
]);

const PRIORITY_SCORE = Object.freeze({ P0: 100, P1: 75, P2: 45, P3: 20 });
const VALUE_SCORE = Object.freeze({ XL: 100, L: 75, M: 45, S: 20 });
const COMPLEXITY_FIT = Object.freeze({ S: 100, M: 75, L: 45, XL: 20 });

const DEFAULT_COMPLETED_CAPABILITIES = Object.freeze([
  "this document",
  "phase 4.1 mission registry",
  "mission registry",
  "founder briefing",
  "current alignment",
  "openclaw builder",
  "validation framework",
  "runtime health script",
  "connector policy",
  "source connector policy",
]);

const EXTERNAL_BLOCKER_PATTERNS = Object.freeze([
  /external credentials/i,
  /credentials/i,
  /third-party/i,
  /paid (?:api|source|account)/i,
  /provider credentials/i,
  /legal approval/i,
  /legal\/compliance approval/i,
  /founder approval/i,
  /business decision/i,
  /hosting\/account approval/i,
  /requires paid account/i,
  /source terms/i,
]);

function stripMarkdown(value) {
  return String(value ?? "")
    .trim()
    .replace(/^`|`$/g, "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function splitMarkdownRow(line) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => stripMarkdown(cell));
}

function isTaskRow(line) {
  return /^\|\s*`?[A-Z](?:-[A-Z]+)?\d+`?\s*\|/.test(line.trim());
}

function splitList(value) {
  const text = stripMarkdown(value);
  if (!text || /^none$/i.test(text)) return [];
  return text
    .split(/\s*,\s*|\s+and\s+/i)
    .map((row) => stripMarkdown(row))
    .filter(Boolean);
}

function normalizeTask(cells, epic) {
  const task = { epic };
  for (let index = 0; index < BACKLOG_COLUMNS.length; index += 1) {
    task[BACKLOG_COLUMNS[index]] = cells[index] || "";
  }
  task.id = stripMarkdown(task.id);
  task.priority = task.priority.toUpperCase();
  task.dependencies = splitList(task.dependencies);
  task.stopConditions = splitList(task.stopConditions);
  task.affectedModules = splitList(task.affectedModules);
  return task;
}

export function parseMasterBacklog(markdown) {
  const tasks = [];
  let currentEpic = null;

  for (const line of String(markdown || "").split("\n")) {
    const epicMatch = line.match(/^##\s+Epic\s+([A-Z])\s+-\s+(.+)$/);
    if (epicMatch) {
      currentEpic = {
        id: epicMatch[1],
        title: epicMatch[2].trim(),
      };
      continue;
    }

    if (!currentEpic || !isTaskRow(line)) continue;
    const cells = splitMarkdownRow(line);
    if (cells.length < BACKLOG_COLUMNS.length) continue;
    tasks.push(normalizeTask(cells, currentEpic));
  }

  return {
    tasks,
    epics: [...new Map(tasks.map((task) => [task.epic.id, task.epic])).values()],
  };
}

function normalizeDependency(value) {
  return stripMarkdown(value).toLowerCase();
}

function dependencySatisfied(dependency, context) {
  const normalized = normalizeDependency(dependency);
  if (!normalized) return true;
  if (context.completedTaskIds.has(dependency)) return true;
  if (context.completedTaskIds.has(normalized.toUpperCase())) return true;
  if (context.completedCapabilities.has(normalized)) return true;
  return false;
}

function hasExternalBlocker(task, context) {
  const blockerText = [...task.dependencies, ...task.stopConditions].join(" ; ");
  return EXTERNAL_BLOCKER_PATTERNS.some((pattern) => {
    if (!pattern.test(blockerText)) return false;
    return !context.approvedExternalBlockers.some((approval) => pattern.test(approval));
  });
}

export function evaluateBacklogTask(task, options = {}) {
  const context = {
    completedTaskIds: new Set((options.completedTaskIds || []).map((id) => String(id).toUpperCase())),
    completedCapabilities: new Set([
      ...DEFAULT_COMPLETED_CAPABILITIES,
      ...(options.completedCapabilities || []).map((capability) => normalizeDependency(capability)),
    ]),
    approvedExternalBlockers: options.approvedExternalBlockers || [],
  };

  const blockers = [];
  if (context.completedTaskIds.has(task.id.toUpperCase())) {
    blockers.push({ type: "already_complete", detail: `${task.id} is already complete` });
  }

  for (const dependency of task.dependencies) {
    if (!dependencySatisfied(dependency, context)) {
      blockers.push({ type: "dependency", detail: `Missing dependency: ${dependency}` });
    }
  }

  if (hasExternalBlocker(task, context)) {
    blockers.push({ type: "external", detail: `External approval or credentials required: ${task.stopConditions.join("; ")}` });
  }

  return {
    task,
    ready: blockers.length === 0,
    blocked: blockers.length > 0,
    blockers,
    score: scoreBacklogTask(task, blockers),
  };
}

function containsAny(task, patterns) {
  const text = [
    task.id,
    task.title,
    task.description,
    task.businessPurpose,
    task.dependencies.join(" "),
    task.completionCriteria,
  ].join(" ");
  return patterns.some((pattern) => pattern.test(text));
}

function founderPriorityFit(task) {
  const text = [
    task.id,
    task.title,
    task.description,
    task.businessPurpose,
    task.affectedModules.join(" "),
    task.completionCriteria,
  ].join(" ");
  if (/pressure washing|commercial property|beaumont/i.test(text)) return 100;
  if (/\bktm\b|industrial|turnaround|shutdown|refinery/i.test(text)) return 90;
  if (/apartment|sponsor|workshop|property manager/i.test(text)) return 80;
  if (/10,?000|email|scale|campaign/i.test(text)) return 65;
  return 45;
}

export function scoreBacklogTask(task, blockers = []) {
  if (blockers.length) return 0;

  const priority = PRIORITY_SCORE[task.priority] || 0;
  const businessValue = VALUE_SCORE[task.businessValue] || 0;
  const effortFit = COMPLEXITY_FIT[task.complexity] || 40;
  const founderFit = founderPriorityFit(task);
  const revenueImpact = containsAny(task, [/revenue/i, /pressure washing/i, /ktm/i, /apartment/i, /cash/i])
    ? 100
    : 45;
  const dependencyLeverage = containsAny(task, [/selector/i, /registry/i, /unblock/i, /dependencies/i])
    ? 100
    : 50;
  const validationConfidence = task.validationScript ? 90 : 20;
  const riskReduction = containsAny(task, [/approval/i, /validation/i, /compliance/i, /security/i]) ? 80 : 45;
  const technicalDebtReduction = containsAny(task, [/manual prompts/i, /selector/i, /simpl/i]) ? 90 : 35;
  const executionModelBoost = task.id === "B1" ? 30 : 0;

  return Number(
    (
      priority * 0.15 +
      businessValue * 0.2 +
      revenueImpact * 0.15 +
      founderFit * 0.1 +
      dependencyLeverage * 0.15 +
      validationConfidence * 0.1 +
      effortFit * 0.08 +
      riskReduction * 0.07 +
      technicalDebtReduction * 0.05 +
      executionModelBoost
    ).toFixed(2),
  );
}

export function selectNextBacklogTask(markdownOrParsed, options = {}) {
  const parsed = typeof markdownOrParsed === "string" ? parseMasterBacklog(markdownOrParsed) : markdownOrParsed;
  const evaluations = parsed.tasks.map((task) => evaluateBacklogTask(task, options));
  const ready = evaluations
    .filter((row) => row.ready)
    .sort((a, b) => b.score - a.score || a.task.id.localeCompare(b.task.id));

  return {
    selected: ready[0] || null,
    ready,
    blocked: evaluations.filter((row) => row.blocked),
    totalTasks: evaluations.length,
  };
}

function taskPaths(task) {
  const modules = task.affectedModules || [];
  const allowed = new Set(["docs/opportunity-os/**", "scripts/opportunity-engine/**"]);
  const forbidden = new Set([
    "src/engine/openclaw/**",
    "src/engine/processor/**",
    "src/engine/orchestrator/**",
    "src/engine/scheduler/**",
  ]);

  for (const moduleName of modules) {
    const cleaned = moduleName.replace(/^engine\//, "src/engine/").replace(/^runtime\//, "runtime/");
    if (cleaned.startsWith("src/") || cleaned.startsWith("scripts/") || cleaned.startsWith("docs/")) {
      allowed.add(`${cleaned.replace(/\/?$/, "/")}**`);
    } else if (cleaned.startsWith("runtime/")) {
      allowed.add(`${cleaned.replace(/\/?$/, "/")}**`);
    } else if (cleaned === "founder-intent") {
      allowed.add("src/engine/founder-intent/**");
    }
  }

  return {
    allowedFiles: [...allowed],
    forbiddenFiles: [...forbidden],
  };
}

export function createBuilderPlanFromBacklogTask(task) {
  const paths = taskPaths(task);
  const validationPlan = createEngineeringValidationPlan({
    phase: "4.2",
    validationScript: task.validationScript || "validate-engineering-director.js",
    affectedModules: task.affectedModules,
  });
  return {
    taskId: task.id,
    title: task.title,
    objective: task.description,
    businessPurpose: task.businessPurpose,
    priority: task.priority,
    phase: "4.2",
    allowedFiles: paths.allowedFiles,
    forbiddenFiles: paths.forbiddenFiles,
    requiredReading: [
      "docs/opportunity-os/32-ai-chief-of-staff.md",
      "docs/opportunity-os/33-master-engineering-backlog.md",
      "docs/opportunity-os/34-engineering-director-execution-model.md",
    ],
    validationPlan,
    validationCommands: validationPlan.commands,
    expectedOutputs: [task.completionCriteria],
    stopConditions: task.stopConditions,
    affectedModules: task.affectedModules,
    commitPolicy: {
      enabled: true,
      messageHint: `${task.title}`,
    },
  };
}
