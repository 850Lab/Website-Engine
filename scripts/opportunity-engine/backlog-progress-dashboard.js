import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { evaluateBacklogTask, parseMasterBacklog } from "../../src/engine/founder-intent/index.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const BACKLOG_PATH = join(ROOT, "docs/opportunity-os/33-master-engineering-backlog.md");
const REPORT_MD = join(ROOT, "reports/backlog-progress-dashboard.md");
const REPORT_JSON = join(ROOT, "reports/backlog-progress-dashboard.json");

const COMPLEXITY_HOURS = Object.freeze({ S: 4, M: 12, L: 28, XL: 60 });
const COMPLEXITY_COMMITS = Object.freeze({ S: 1, M: 1, L: 2, XL: 3 });

const CATEGORY_RULES = Object.freeze([
  { id: "engineering", label: "Engineering", epics: ["A", "B", "L", "M", "N", "P", "Q", "R", "S", "T"] },
  { id: "businessDiscovery", label: "Business Discovery", epics: ["C", "O"] },
  { id: "contactDiscovery", label: "Contact Discovery", epics: ["D", "E"] },
  { id: "campaignEngine", label: "Campaign Engine", epics: ["F", "G", "H", "I"] },
  { id: "crm", label: "CRM", epics: ["J"] },
  { id: "learning", label: "Learning", epics: ["K"] },
]);

const EXTERNAL_BLOCKER_PATTERNS = Object.freeze([
  /missing privacy policy/i,
  /registration requirements unknown/i,
  /external credentials/i,
  /credentials required/i,
  /paid source/i,
  /paid account/i,
  /legal approval/i,
  /legal\/compliance/i,
  /pii policy missing/i,
  /source terms/i,
  /provider credentials/i,
  /hosting\/account approval/i,
  /auth\/session unsafe/i,
  /auth provider missing/i,
  /alert account required/i,
  /secrets required/i,
  /deliverability setup absent/i,
  /legal uncertainty/i,
]);

function nowIso() {
  return process.env.OPPORTUNITY_PROGRESS_GENERATED_AT || new Date().toISOString();
}

function stripMarkdown(value) {
  return String(value ?? "").trim().replace(/^`|`$/g, "").trim();
}

function splitMarkdownRow(line) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => stripMarkdown(cell));
}

function parseExecutionStatuses(markdown) {
  const statuses = new Map();
  const lines = String(markdown || "").split("\n");
  let inStatusTable = false;

  for (const line of lines) {
    if (/^##\s+Backlog Execution Status/i.test(line)) {
      inStatusTable = true;
      continue;
    }
    if (inStatusTable && /^---\s*$/.test(line)) {
      break;
    }
    if (!inStatusTable || !/^\|\s*`?[A-Z](?:-[A-Z]+)?\d+`?\s*\|/.test(line)) {
      continue;
    }
    const [id, status, evidence, lastValidation] = splitMarkdownRow(line);
    if (id && status) {
      statuses.set(id, {
        id,
        status: status.toLowerCase(),
        evidence,
        lastValidation,
      });
    }
  }

  return statuses;
}

function isComplete(task, statuses) {
  return statuses.get(task.id)?.status === "complete";
}

function isExternallyBlocked(task) {
  const text = [...(task.dependencies || []), ...(task.stopConditions || [])].join(" ; ");
  return EXTERNAL_BLOCKER_PATTERNS.some((pattern) => pattern.test(text));
}

function percent(done, total) {
  if (!total) return 0;
  return Math.round((done / total) * 100);
}

function bar(value, width = 14) {
  const filled = Math.round((Math.max(0, Math.min(100, value)) / 100) * width);
  return `${"█".repeat(filled)}${"░".repeat(width - filled)}`;
}

function summarizeTasks(tasks, statuses) {
  const total = tasks.length;
  const completed = tasks.filter((task) => isComplete(task, statuses)).length;
  return {
    total,
    completed,
    remaining: Math.max(0, total - completed),
    percent: percent(completed, total),
  };
}

function summarizeCategories(tasks, statuses) {
  return CATEGORY_RULES.map((category) => {
    const categoryTasks = tasks.filter((task) => category.epics.includes(task.epic?.id));
    return {
      ...category,
      ...summarizeTasks(categoryTasks, statuses),
    };
  });
}

function estimateRemaining(tasks, statuses) {
  const remainingTasks = tasks.filter((task) => !isComplete(task, statuses));
  return {
    tasks: remainingTasks.length,
    commits: remainingTasks.reduce((sum, task) => sum + (COMPLEXITY_COMMITS[task.complexity] || 1), 0),
    engineeringHours: remainingTasks.reduce((sum, task) => sum + (COMPLEXITY_HOURS[task.complexity] || 12), 0),
  };
}

function selectCurrentTask(parsed, statuses) {
  const completedTaskIds = parsed.tasks.filter((task) => isComplete(task, statuses)).map((task) => task.id);
  const blockedTaskIds = parsed.tasks.filter((task) => !isComplete(task, statuses) && isExternallyBlocked(task)).map((task) => task.id);
  const blockedTaskIdSet = new Set(blockedTaskIds);
  const ready = parsed.tasks
    .map((task) => evaluateBacklogTask(task, { completedTaskIds }))
    .filter((row) => row.ready && !blockedTaskIdSet.has(row.task.id))
    .sort((a, b) => b.score - a.score || a.task.id.localeCompare(b.task.id));
  return {
    task: ready[0]?.task || null,
    blockedTaskIds,
    readyTop5: ready.slice(0, 5).map((row) => ({
      id: row.task.id,
      title: row.task.title,
      score: row.score,
    })),
    stopCondition:
      ready.length === 0
        ? {
            type: "no_unblocked_task",
            message: "No unblocked backlog task is currently selectable. Remaining work requires dependency completion, external credentials, legal/compliance approval, Founder approval, or another explicit business decision.",
          }
        : null,
  };
}

function renderMarkdown(dashboard) {
  const current = dashboard.currentTask;
  return `# Opportunity OS Progress

Generated: ${dashboard.generatedAt}

Source: \`${dashboard.source.backlog}\`

## Overall Completion

${dashboard.overall.percent}%

| Area | Progress | Complete | Remaining |
|---|---|---:|---:|
| Overall | ${bar(dashboard.overall.percent)} ${dashboard.overall.percent}% | ${dashboard.overall.completed}/${dashboard.overall.total} | ${dashboard.overall.remaining} |
${dashboard.categories
  .map(
    (category) =>
      `| ${category.label} | ${bar(category.percent)} ${category.percent}% | ${category.completed}/${category.total} | ${category.remaining} |`,
  )
  .join("\n")}

## Current Task

${current ? `\`${current.id}\` — ${current.title}` : dashboard.stopCondition?.message || "No unblocked task selected."}

## Estimates

- **Estimated remaining tasks:** ${dashboard.estimates.tasks}
- **Estimated remaining commits:** ${dashboard.estimates.commits}
- **Estimated completion:** ${dashboard.estimates.engineeringHours} engineering hours

## Blocked By External Decisions

${dashboard.blockedTaskIds.length ? dashboard.blockedTaskIds.map((id) => `- \`${id}\``).join("\n") : "- None detected"}
`;
}

async function main() {
  const markdown = await readFile(BACKLOG_PATH, "utf8");
  const parsed = parseMasterBacklog(markdown);
  const statuses = parseExecutionStatuses(markdown);
  const overall = summarizeTasks(parsed.tasks, statuses);
  const categories = summarizeCategories(parsed.tasks, statuses);
  const estimates = estimateRemaining(parsed.tasks, statuses);
  const selected = selectCurrentTask(parsed, statuses);

  const dashboard = {
    schemaVersion: "4.2.progress-dashboard",
    generatedAt: nowIso(),
    source: {
      backlog: "docs/opportunity-os/33-master-engineering-backlog.md",
    },
    overall,
    categories,
    currentTask: selected.task
      ? {
          id: selected.task.id,
          title: selected.task.title,
          validationScript: selected.task.validationScript,
          affectedModules: selected.task.affectedModules,
          stopConditions: selected.task.stopConditions,
        }
      : null,
    readyTop5: selected.readyTop5,
    blockedTaskIds: selected.blockedTaskIds,
    stopCondition: selected.stopCondition,
    estimates,
  };

  await mkdir(join(ROOT, "reports"), { recursive: true });
  await writeFile(REPORT_JSON, `${JSON.stringify(dashboard, null, 2)}\n`, "utf8");
  await writeFile(REPORT_MD, renderMarkdown(dashboard), "utf8");

  console.log("\nOpportunity OS progress dashboard");
  console.log(`  Overall: ${dashboard.overall.percent}%`);
  console.log(`  Current task: ${dashboard.currentTask ? `${dashboard.currentTask.id} ${dashboard.currentTask.title}` : "none"}`);
  console.log("  Report: reports/backlog-progress-dashboard.md");
}

await main();
