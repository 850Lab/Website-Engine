import { randomUUID } from "node:crypto";
import { getValidatorByPhase, getValidatorByScript } from "../validation/graph.js";

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

function uniqueStrings(values) {
  return [...new Set(normalizeArray(values).map((value) => String(value).trim()).filter(Boolean))];
}

function validatorCommand(script) {
  return `node scripts/opportunity-engine/${script}`;
}

function normalizeValidationScript(script) {
  const value = String(script || "").trim();
  if (!value) return "";
  return value.endsWith(".js") ? value : `${value}.js`;
}

export function createEngineeringValidationPlan(options = {}) {
  const phase = String(options.phase || "4.2").trim();
  const validationScript = normalizeValidationScript(options.validationScript || "validate-phase-4-2.js");
  const focusedValidators = validationScript ? [validatorCommand(validationScript)] : [];
  const phaseNode = getValidatorByPhase(phase) || getValidatorByScript(validationScript);
  const phaseValidators = phaseNode ? [validatorCommand(phaseNode.script)] : [];
  const regressionValidators = phaseNode
    ? phaseNode.dependsOn
        .map((dependencyPhase) => getValidatorByPhase(dependencyPhase)?.script)
        .filter(Boolean)
        .map(validatorCommand)
    : [];
  const coreValidation = "node scripts/opportunity-engine/validate-core.js";
  const commands = uniqueStrings([...focusedValidators, ...phaseValidators, ...regressionValidators, coreValidation]);

  return {
    required: true,
    phase,
    validationScript,
    focusedValidators: uniqueStrings(focusedValidators),
    phaseValidators: uniqueStrings(phaseValidators),
    regressionValidators: uniqueStrings(regressionValidators),
    coreValidation,
    commands,
    affectedModules: uniqueStrings(options.affectedModules),
    failureRepairPolicy: {
      stopOnFailure: true,
      repairAllowed: true,
      repairScope: "Only repair regressions caused by the current task and within the approved affected modules.",
      rerunFailedValidator: true,
      rerunPhaseValidator: true,
      rerunCoreBeforeCommit: true,
      commitOnlyAfterAllRequiredValidationPasses: true,
    },
  };
}

export function createEngineeringTaskId(prefix = "engtask") {
  return `${prefix}_${randomUUID()}`;
}

export function createEngineeringTask(overrides = {}) {
  const affectedModules = uniqueStrings(overrides.affectedModules || [overrides.ownerModule || "engine/founder-intent"]);
  const validationPlan = createEngineeringValidationPlan({
    phase: overrides.phase || "4.2",
    validationScript: overrides.validationScript,
    affectedModules,
  });

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
    validationPlan,
    validationCommands: validationPlan.commands,
    affectedModules,
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
  if (!task.validationPlan?.required) errors.push("validationPlan.required must be true");
  if (!task.validationPlan?.commands?.length) errors.push("validationPlan.commands must contain at least one command");
  if (!task.validationPlan?.coreValidation?.includes("validate-core.js")) {
    errors.push("validationPlan.coreValidation must require validate-core.js");
  }
  if (!task.validationPlan?.failureRepairPolicy?.commitOnlyAfterAllRequiredValidationPasses) {
    errors.push("validationPlan.failureRepairPolicy must block commits until validation passes");
  }
  return { valid: errors.length === 0, errors };
}
