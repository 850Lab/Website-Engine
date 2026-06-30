import { randomUUID } from "node:crypto";

const DEFAULT_FORBIDDEN_PATHS = Object.freeze([
  "src/engine/openclaw/",
  "src/engine/processor/",
  "src/engine/orchestrator/",
  "src/engine/scheduler/",
  "src/engine/pipeline-handlers/",
]);

const DEFAULT_ACCEPTANCE_CRITERIA = Object.freeze([
  "No outreach is launched",
  "Founder approval gates remain enforced",
  "Validation uses isolated runtime",
  "No writes to engine-data/",
]);

function normalizeArray(values) {
  return Array.isArray(values) ? values.filter(Boolean) : [];
}

export function createEngineeringTaskId(prefix = "engtask") {
  return `${prefix}_${randomUUID()}`;
}

export function createEngineeringTask(overrides = {}) {
  return {
    taskId: overrides.taskId || createEngineeringTaskId(),
    missionId: overrides.missionId || null,
    title: overrides.title || "Proposed engineering task",
    mode: "engineering",
    ownerModule: overrides.ownerModule || "engine/founder-intent",
    phase: overrides.phase || "4.2",
    problem: overrides.problem || "",
    scope: {
      allowedPaths: normalizeArray(overrides.scope?.allowedPaths),
      forbiddenPaths: normalizeArray(overrides.scope?.forbiddenPaths).length
        ? normalizeArray(overrides.scope?.forbiddenPaths)
        : [...DEFAULT_FORBIDDEN_PATHS],
    },
    acceptanceCriteria: normalizeArray(overrides.acceptanceCriteria).length
      ? normalizeArray(overrides.acceptanceCriteria)
      : [...DEFAULT_ACCEPTANCE_CRITERIA],
    approvalRequired: overrides.approvalRequired ?? true,
    openClawEligible: overrides.openClawEligible ?? false,
    status: overrides.status || "proposed",
    createdAt: overrides.createdAt || new Date().toISOString(),
    notes: overrides.notes || "",
  };
}

function missionNeedsReviewBoard(mission) {
  return mission?.status === "active" || mission?.approvalPolicy?.requireFounderApprovalBeforeOutreach;
}

function missionNeedsSourceConnectors(mission) {
  return normalizeArray(mission?.requiredSignals).length > 0;
}

function missionNeedsContactDiscovery(mission) {
  return normalizeArray(mission?.buyerTypes).length > 0 && normalizeArray(mission?.preferredChannels).length > 0;
}

function missionNeedsScalePrep(intent, mission) {
  return (
    normalizeArray(intent?.scaleTargets).some((row) => row.type === "email_volume") ||
    normalizeArray(mission?.constraints).some((row) => /10,?000|email/i.test(String(row)))
  );
}

export function recommendEngineeringTasks({ intent = null, mission = null } = {}) {
  const tasks = [];
  const missionId = mission?.missionId || null;

  if (missionNeedsReviewBoard(mission)) {
    tasks.push(
      createEngineeringTask({
        taskId: createEngineeringTaskId("engtask_review_board"),
        missionId,
        title: "Build mission-aware opportunity review board",
        ownerModule: "pivotal-os",
        phase: "4.2",
        problem: "Founder needs to approve missions and mission-ranked opportunities before any outreach preparation.",
        scope: {
          allowedPaths: ["src/pivotal-os/", "src/engine/founder-intent/", "scripts/opportunity-engine/", "docs/opportunity-os/"],
        },
        acceptanceCriteria: [
          "Founder can view active missions",
          "Founder can review mission alignment for opportunities",
          "No campaign or outreach execution is added",
          ...DEFAULT_ACCEPTANCE_CRITERIA,
        ],
        openClawEligible: true,
      }),
    );
  }

  if (missionNeedsSourceConnectors(mission)) {
    tasks.push(
      createEngineeringTask({
        taskId: createEngineeringTaskId("engtask_source_connectors"),
        missionId,
        title: "Add mission-aware source connectors v1",
        ownerModule: "engine/sensors",
        phase: "4.3",
        problem: "Mission search signals need real observation sources beyond file drop.",
        scope: {
          allowedPaths: ["src/engine/sensors/", "scripts/opportunity-engine/", "docs/opportunity-os/"],
        },
        acceptanceCriteria: [
          "Connectors write observations only",
          "No opportunities are created directly",
          "Signals remain routed through the existing registry",
          ...DEFAULT_ACCEPTANCE_CRITERIA,
        ],
        openClawEligible: true,
      }),
    );
  }

  if (missionNeedsContactDiscovery(mission)) {
    tasks.push(
      createEngineeringTask({
        taskId: createEngineeringTaskId("engtask_contact_discovery"),
        missionId,
        title: "Design mission-aware contact discovery",
        ownerModule: "engine/contact-discovery",
        phase: "4.4",
        problem: "Mission buyer types need validated decision-maker discovery before campaign preparation.",
        scope: {
          allowedPaths: ["src/engine/contact-discovery/", "scripts/opportunity-engine/", "docs/opportunity-os/"],
        },
        acceptanceCriteria: [
          "Contact records are proposed, not contacted",
          "No email sending is added",
          "Founder approval required before campaign use",
          ...DEFAULT_ACCEPTANCE_CRITERIA,
        ],
        openClawEligible: false,
      }),
    );
  }

  if (missionNeedsScalePrep(intent, mission)) {
    tasks.push(
      createEngineeringTask({
        taskId: createEngineeringTaskId("engtask_email_scale_controls"),
        missionId,
        title: "Define email scale compliance and safety controls",
        ownerModule: "engine/compliance",
        phase: "4.4",
        problem: "10,000 emails/month/offer requires approval, deliverability, unsubscribe, suppression, audit, and kill-switch controls before execution.",
        scope: {
          allowedPaths: ["docs/opportunity-os/", "scripts/opportunity-engine/"],
          forbiddenPaths: [...DEFAULT_FORBIDDEN_PATHS, "src/engine/execution-queue/"],
        },
        acceptanceCriteria: [
          "No sending infrastructure is implemented",
          "Compliance gates are documented",
          "Founder approval remains mandatory",
          ...DEFAULT_ACCEPTANCE_CRITERIA,
        ],
        openClawEligible: false,
      }),
    );
  }

  return tasks;
}

export function validateEngineeringTask(task) {
  const errors = [];
  if (!task || typeof task !== "object") {
    return { valid: false, errors: ["Engineering task must be an object"] };
  }
  if (!task.taskId) errors.push("taskId is required");
  if (!task.title) errors.push("title is required");
  if (task.mode !== "engineering") errors.push("mode must be engineering");
  if (task.approvalRequired !== true) errors.push("approvalRequired must be true");
  if (!task.scope?.allowedPaths?.length) errors.push("scope.allowedPaths must contain at least one path");
  if (!task.scope?.forbiddenPaths?.length) errors.push("scope.forbiddenPaths must contain at least one path");
  if (!task.acceptanceCriteria?.length) errors.push("acceptanceCriteria must contain at least one item");
  return { valid: errors.length === 0, errors };
}
