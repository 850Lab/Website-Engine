import { randomUUID } from "node:crypto";

export const MISSION_SCHEMA_VERSION = "4.1.0";

export const MISSION_STATUSES = Object.freeze(["draft", "active", "paused", "archived"]);

export const MISSION_PRIORITIES = Object.freeze(["low", "medium", "high", "critical"]);

export const DEFAULT_APPROVAL_POLICY = Object.freeze({
  requireFounderApprovalBeforeOutreach: true,
  maxAutonomousActionsPerDay: 0,
  allowDraftAssetGeneration: false,
});

export const REQUIRED_MISSION_FIELDS = Object.freeze([
  "missionId",
  "name",
  "goal",
  "priority",
  "geography",
  "offers",
  "approvalPolicy",
]);

export function nowIso() {
  return new Date().toISOString();
}

export function createMissionId(prefix = "mission") {
  return `${prefix}_${randomUUID()}`;
}

export function createEmptyMission(overrides = {}) {
  const missionId = overrides.missionId || createMissionId();
  return {
    schemaVersion: MISSION_SCHEMA_VERSION,
    missionId,
    name: "",
    goal: "",
    revenueTarget: null,
    deadline: null,
    priority: "medium",
    geography: [],
    industries: [],
    buyerTypes: [],
    offers: [],
    capabilities: [],
    constraints: [],
    requiredSignals: [],
    ignoredSignals: [],
    preferredChannels: [],
    approvalPolicy: { ...DEFAULT_APPROVAL_POLICY },
    successMetrics: {},
    notes: "",
    status: "draft",
    sourceIntent: "",
    clarificationHistory: [],
    strategy: null,
    metadata: {
      createdAt: nowIso(),
      updatedAt: nowIso(),
      interpreterMode: "rules",
    },
    ...overrides,
  };
}

function collapseWhitespace(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeMission(input = {}) {
  const mission = createEmptyMission({
    ...input,
    missionId: collapseWhitespace(input.missionId) || createMissionId(),
    name: collapseWhitespace(input.name),
    goal: collapseWhitespace(input.goal),
    revenueTarget: input.revenueTarget ?? null,
    deadline: input.deadline ?? null,
    priority: MISSION_PRIORITIES.includes(input.priority) ? input.priority : "medium",
    geography: Array.isArray(input.geography) ? [...input.geography] : [],
    industries: Array.isArray(input.industries) ? [...input.industries] : [],
    buyerTypes: Array.isArray(input.buyerTypes) ? [...input.buyerTypes] : [],
    offers: Array.isArray(input.offers) ? [...input.offers] : [],
    capabilities: Array.isArray(input.capabilities) ? [...input.capabilities] : [],
    constraints: Array.isArray(input.constraints) ? [...input.constraints] : [],
    requiredSignals: Array.isArray(input.requiredSignals) ? [...input.requiredSignals] : [],
    ignoredSignals: Array.isArray(input.ignoredSignals) ? [...input.ignoredSignals] : [],
    preferredChannels: Array.isArray(input.preferredChannels) ? [...input.preferredChannels] : [],
    approvalPolicy: {
      ...DEFAULT_APPROVAL_POLICY,
      ...(input.approvalPolicy || {}),
    },
    successMetrics:
      input.successMetrics && typeof input.successMetrics === "object" ? { ...input.successMetrics } : {},
    notes: collapseWhitespace(input.notes),
    status: MISSION_STATUSES.includes(input.status) ? input.status : "draft",
    sourceIntent: collapseWhitespace(input.sourceIntent),
    clarificationHistory: Array.isArray(input.clarificationHistory) ? [...input.clarificationHistory] : [],
    strategy: input.strategy ?? null,
    metadata: {
      ...(input.metadata || {}),
      updatedAt: nowIso(),
    },
  });

  if (!mission.metadata.createdAt) {
    mission.metadata.createdAt = nowIso();
  }

  return mission;
}

export function isMissionSpecification(value) {
  if (!value || typeof value !== "object") return false;
  return REQUIRED_MISSION_FIELDS.every((field) => field in value);
}
