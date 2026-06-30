import { listOffers } from "../offers/index.js";
import { listCapabilities } from "../capabilities/index.js";
import { MISSION_PRIORITIES, REQUIRED_MISSION_FIELDS } from "./mission-schema.js";

const US_STATE_CODES = new Set([
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
]);

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function validateGeographyEntry(entry, index, errors) {
  if (!entry || typeof entry !== "object") {
    errors.push(`geography[${index}] must be an object`);
    return;
  }
  if (!isNonEmptyString(entry.label)) {
    errors.push(`geography[${index}].label is required`);
  }
  if (entry.radiusMiles != null && (typeof entry.radiusMiles !== "number" || entry.radiusMiles <= 0)) {
    errors.push(`geography[${index}].radiusMiles must be a positive number`);
  }
  if (entry.state && !US_STATE_CODES.has(String(entry.state).toUpperCase())) {
    errors.push(`geography[${index}].state is not a valid US state code`);
  }
}

function validateApprovalPolicy(policy, errors) {
  if (!policy || typeof policy !== "object") {
    errors.push("approvalPolicy must be an object");
    return;
  }
  if (typeof policy.requireFounderApprovalBeforeOutreach !== "boolean") {
    errors.push("approvalPolicy.requireFounderApprovalBeforeOutreach must be boolean");
  }
  if (policy.maxAutonomousActionsPerDay != null && typeof policy.maxAutonomousActionsPerDay !== "number") {
    errors.push("approvalPolicy.maxAutonomousActionsPerDay must be a number");
  }
}

export async function validateMission(mission, options = {}) {
  const errors = [];
  const warnings = [];

  if (!mission || typeof mission !== "object") {
    return { valid: false, errors: ["Mission must be an object"], warnings };
  }

  for (const field of REQUIRED_MISSION_FIELDS) {
    if (!(field in mission)) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  if (!isNonEmptyString(mission.name)) {
    errors.push("name is required");
  }
  if (!isNonEmptyString(mission.goal)) {
    errors.push("goal is required");
  }
  if (!MISSION_PRIORITIES.includes(mission.priority)) {
    errors.push(`priority must be one of: ${MISSION_PRIORITIES.join(", ")}`);
  }
  if (!Array.isArray(mission.geography) || mission.geography.length === 0) {
    errors.push("geography must contain at least one entry");
  } else {
    mission.geography.forEach((entry, index) => validateGeographyEntry(entry, index, errors));
  }
  if (!Array.isArray(mission.offers) || mission.offers.length === 0) {
    errors.push("offers must contain at least one offer id");
  }

  validateApprovalPolicy(mission.approvalPolicy, errors);

  if (options.enforceFounderApproval !== false && mission.approvalPolicy?.requireFounderApprovalBeforeOutreach !== true) {
    errors.push("approvalPolicy.requireFounderApprovalBeforeOutreach must remain true in Phase 4.1");
  }

  const offers = await listOffers();
  const offerIds = new Set(offers.map((row) => row.id));
  for (const offerId of mission.offers || []) {
    if (!offerIds.has(offerId)) {
      errors.push(`Unsupported offer id: ${offerId}`);
    }
  }

  const capabilities = await listCapabilities();
  const capabilityIds = new Set(capabilities.map((row) => row.id));
  for (const capabilityId of mission.capabilities || []) {
    if (!capabilityIds.has(capabilityId)) {
      errors.push(`Unsupported capability id: ${capabilityId}`);
    }
  }

  if (mission.deadline) {
    const deadlineText = String(mission.deadline).trim();
    const parsed = new Date(deadlineText);
    const relativeDuration = /^\d+\s*(day|days|week|weeks|month|months|year|years)$/i.test(deadlineText);
    if (Number.isNaN(parsed.getTime()) && !relativeDuration) {
      errors.push("deadline must be a valid ISO date or relative duration when provided");
    }
  }

  if (mission.revenueTarget && typeof mission.revenueTarget !== "object") {
    errors.push("revenueTarget must be an object when provided");
  }

  if (mission.revenueTarget?.amount != null && typeof mission.revenueTarget.amount !== "number") {
    errors.push("revenueTarget.amount must be a number when provided");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export async function assertValidMission(mission, options = {}) {
  const result = await validateMission(mission, options);
  if (!result.valid) {
    throw new Error(result.errors.join("; "));
  }
  return result;
}
