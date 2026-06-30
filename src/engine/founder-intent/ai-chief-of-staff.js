import { analyzeFounderIntent } from "./intent-engine.js";
import { interpretFounderIntent, completeMissionFromClarification } from "./mission-interpreter.js";
import { recommendEngineeringTasks, validateEngineeringTask } from "./engineering-director.js";
import { summarizeMission } from "./mission-summary.js";

function buildDecisionMode(intent) {
  if (intent.detectedGoals.includes("replace_job_income") || intent.detectedGoals.includes("cash_flow")) {
    return "business";
  }
  if (intent.detectedGoals.includes("scale_outreach")) {
    return "engineering";
  }
  return "business";
}

function buildApprovalGates(mission, engineeringTasks = []) {
  return {
    missionApprovalRequired: true,
    strategyApprovalRequired: true,
    engineeringApprovalRequired: engineeringTasks.length > 0,
    opportunityApprovalRequired: true,
    campaignApprovalRequired: true,
    outreachExecutionAllowed: false,
    founderApprovalBeforeOutreach: mission?.approvalPolicy?.requireFounderApprovalBeforeOutreach !== false,
  };
}

export async function prepareChiefOfStaffPlan(founderText, options = {}) {
  const intent = analyzeFounderIntent(founderText, options.intentOptions || {});
  const missionResult = await interpretFounderIntent(founderText, options.interpreterOptions || {});

  if (missionResult.status === "clarify") {
    return {
      status: "clarify",
      mode: buildDecisionMode(intent),
      intent,
      clarification: {
        questions: missionResult.questions || [],
        missingFields: missionResult.missingFields || intent.missingFields,
      },
      draft: missionResult.draft,
      approvalGates: buildApprovalGates(missionResult.draft, []),
    };
  }

  if (missionResult.status !== "ready" || !missionResult.mission) {
    return {
      status: missionResult.status || "invalid",
      mode: buildDecisionMode(intent),
      intent,
      validation: missionResult.validation || null,
      error: missionResult.error || null,
      approvalGates: buildApprovalGates(missionResult.draft, []),
    };
  }

  const engineeringTasks = recommendEngineeringTasks({ intent, mission: missionResult.mission });
  return {
    status: "ready",
    mode: buildDecisionMode(intent),
    intent,
    mission: missionResult.mission,
    strategy: missionResult.mission.strategy || null,
    engineeringTasks,
    taskValidation: engineeringTasks.map((task) => ({
      taskId: task.taskId,
      ...validateEngineeringTask(task),
    })),
    summary: summarizeMission(missionResult.mission),
    approvalGates: buildApprovalGates(missionResult.mission, engineeringTasks),
  };
}

export async function prepareChiefOfStaffPlanFromClarification(draft, answers = {}, options = {}) {
  const missionResult = await completeMissionFromClarification(draft, answers, options.interpreterOptions || {});
  const intent = analyzeFounderIntent(missionResult.mission?.sourceIntent || missionResult.draft?.sourceIntent || "", {
    source: "founder_chat",
  });

  if (missionResult.status !== "ready" || !missionResult.mission) {
    return {
      status: missionResult.status || "invalid",
      mode: buildDecisionMode(intent),
      intent,
      draft: missionResult.draft,
      clarification: {
        questions: missionResult.questions || [],
        missingFields: missionResult.missingFields || intent.missingFields,
      },
      validation: missionResult.validation || null,
      approvalGates: buildApprovalGates(missionResult.draft, []),
    };
  }

  const engineeringTasks = recommendEngineeringTasks({ intent, mission: missionResult.mission });
  return {
    status: "ready",
    mode: buildDecisionMode(intent),
    intent,
    mission: missionResult.mission,
    strategy: missionResult.mission.strategy || null,
    engineeringTasks,
    taskValidation: engineeringTasks.map((task) => ({
      taskId: task.taskId,
      ...validateEngineeringTask(task),
    })),
    summary: summarizeMission(missionResult.mission),
    approvalGates: buildApprovalGates(missionResult.mission, engineeringTasks),
  };
}
