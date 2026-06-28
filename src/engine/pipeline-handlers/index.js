import { registerJobHandler } from "../processor/registry.js";
import { factBuildHandler } from "./fact-build.js";
import { graphProjectHandler } from "./graph-project.js";
import { situationBuildHandler } from "./situation-build.js";
import { hypothesisGenerateHandler } from "./hypothesis-generate.js";
import { problemInferHandler } from "./problem-infer.js";
import { capabilityMatchHandler } from "./capability-match.js";
import { offerRecommendHandler } from "./offer-recommend.js";
import { opportunityBuildHandler } from "./opportunity-build.js";

export const PIPELINE_JOB_TYPES = Object.freeze([
  "fact.build",
  "graph.project",
  "situation.build",
  "hypothesis.generate",
  "problem.infer",
  "capability.match",
  "offer.recommend",
  "opportunity.build",
]);

export const PIPELINE_HANDLER_ENTRIES = Object.freeze([
  { jobType: "fact.build", handler: factBuildHandler, label: "pipeline.fact_build" },
  { jobType: "graph.project", handler: graphProjectHandler, label: "pipeline.graph_project" },
  { jobType: "situation.build", handler: situationBuildHandler, label: "pipeline.situation_build" },
  {
    jobType: "hypothesis.generate",
    handler: hypothesisGenerateHandler,
    label: "pipeline.hypothesis_generate",
  },
  { jobType: "problem.infer", handler: problemInferHandler, label: "pipeline.problem_infer" },
  {
    jobType: "capability.match",
    handler: capabilityMatchHandler,
    label: "pipeline.capability_match",
  },
  { jobType: "offer.recommend", handler: offerRecommendHandler, label: "pipeline.offer_recommend" },
  {
    jobType: "opportunity.build",
    handler: opportunityBuildHandler,
    label: "pipeline.opportunity_build",
  },
]);

export { PIPELINE_EVENT_TYPES, emitPipelineEvent } from "./events.js";
export {
  RUNTIME_GRAPH_ID,
  requireInputRef,
  requireInputRefs,
  runPipelineStage,
  emitDomainCompletionEvent,
} from "./utils.js";
export { factBuildHandler } from "./fact-build.js";
export { graphProjectHandler } from "./graph-project.js";
export { situationBuildHandler } from "./situation-build.js";
export { hypothesisGenerateHandler } from "./hypothesis-generate.js";
export { problemInferHandler } from "./problem-infer.js";
export { capabilityMatchHandler } from "./capability-match.js";
export { offerRecommendHandler } from "./offer-recommend.js";
export { opportunityBuildHandler } from "./opportunity-build.js";

export function registerPipelineHandlers() {
  for (const entry of PIPELINE_HANDLER_ENTRIES) {
    registerJobHandler(entry.jobType, entry.handler, { label: entry.label });
  }
  return {
    registered: PIPELINE_HANDLER_ENTRIES.map((entry) => entry.jobType),
  };
}

export function listPipelineJobTypes() {
  return [...PIPELINE_JOB_TYPES];
}
