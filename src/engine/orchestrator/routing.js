import { resolveEventRoute } from "./registry.js";

function asArray(value) {
  if (Array.isArray(value)) return value.filter(Boolean).map(String);
  if (value == null || value === "") return [];
  return [String(value)];
}

function firstRef(...candidates) {
  for (const candidate of candidates) {
    const rows = asArray(candidate);
    if (rows.length) return rows;
  }
  return [];
}

export function resolveRoute(eventType) {
  return resolveEventRoute(eventType);
}

export function extractInputRefs(event = {}, route = {}) {
  const payload = event.payload || {};

  switch (route.jobType) {
    case "fact.build":
      return firstRef(payload.signalId, payload.signalIds, event.subjectId);
    case "graph.project":
      return firstRef(payload.factIds, payload.outputRefs, payload.factId, event.subjectId);
    case "situation.build":
      return firstRef(payload.graphId, payload.graphIds, payload.outputRefs, event.subjectId);
    case "hypothesis.generate":
      return firstRef(payload.situationId, payload.situationIds, payload.outputRefs, event.subjectId);
    case "problem.infer":
      return firstRef(payload.hypothesisIds, payload.hypothesisId, payload.outputRefs, event.subjectId);
    case "capability.match":
      return firstRef(payload.problemId, payload.problemIds, payload.outputRefs, event.subjectId);
    case "offer.recommend":
      return firstRef(
        payload.capabilityMatchId,
        payload.capabilityMatchIds,
        payload.outputRefs,
        event.subjectId,
      );
    case "opportunity.build":
      return firstRef(
        payload.offerRecommendationId,
        payload.offerRecommendationIds,
        payload.outputRefs,
        event.subjectId,
      );
    default:
      return firstRef(payload.inputRefs, payload.outputRefs, event.subjectId);
  }
}

export function buildOrchestratorIdempotencyKey(eventType, jobType, inputRefs = []) {
  const sorted = [...inputRefs].map(String).filter(Boolean).sort();
  return `orchestrator:${eventType}:${jobType}:${sorted.join("|")}`;
}
