export const DEFAULT_ORCHESTRATOR_ID = "orchestrator_main";
export const STORE_VERSION = "3.6.0";

export const PIPELINE_EVENT_ROUTES = Object.freeze({
  "signal.created": {
    jobType: "fact.build",
    stage: "fact_builder",
  },
  "facts.completed": {
    jobType: "graph.project",
    stage: "graph",
  },
  "graph.completed": {
    jobType: "situation.build",
    stage: "situation",
  },
  "situations.completed": {
    jobType: "hypothesis.generate",
    stage: "hypothesis",
  },
  "hypotheses.completed": {
    jobType: "problem.infer",
    stage: "problem",
  },
  "problems.completed": {
    jobType: "capability.match",
    stage: "capability",
  },
  "capability.completed": {
    jobType: "offer.recommend",
    stage: "offer",
  },
  "offer.completed": {
    jobType: "opportunity.build",
    stage: "opportunity",
  },
});

const customRoutes = new Map();

export function registerEventRoute(eventType, route) {
  if (!eventType || !route?.jobType) {
    throw new Error("registerEventRoute requires eventType and route.jobType");
  }
  customRoutes.set(String(eventType), { ...route });
  return { eventType: String(eventType), registered: true };
}

export function unregisterEventRoute(eventType) {
  return { eventType: String(eventType), removed: customRoutes.delete(String(eventType)) };
}

export function listEventRoutes() {
  const base = Object.entries(PIPELINE_EVENT_ROUTES).map(([eventType, route]) => ({
    eventType,
    jobType: route.jobType,
    stage: route.stage,
    source: "pipeline",
  }));
  const extra = [...customRoutes.entries()].map(([eventType, route]) => ({
    eventType,
    jobType: route.jobType,
    stage: route.stage || null,
    source: "custom",
  }));
  return [...base, ...extra];
}

export function resolveEventRoute(eventType) {
  const key = String(eventType || "");
  if (customRoutes.has(key)) {
    return { ...customRoutes.get(key), eventType: key };
  }
  const route = PIPELINE_EVENT_ROUTES[key];
  if (!route) {
    return null;
  }
  return { ...route, eventType: key };
}

export function clearEventRoutesForTests() {
  customRoutes.clear();
}
