import { matchCapabilities } from "../capability-matcher/index.js";
import {
  getCapabilityMatchesByProblemId,
  initializeCapabilityMatchStore,
} from "../capability-matches/index.js";
import { getProblem } from "../problems/index.js";
import { requireInputRef, runPipelineStage } from "./utils.js";

export async function capabilityMatchHandler(job, context) {
  return runPipelineStage(job, context, {
    stage: "capability",
    jobType: "capability.match",
    async execute(jobRef, stageContext) {
      const problemId = requireInputRef(jobRef, "capability.match");
      await initializeCapabilityMatchStore();

      const problem = await getProblem(problemId);
      if (!problem) {
        throw new Error(`Problem not found: ${problemId}`);
      }

      const existing = await getCapabilityMatchesByProblemId(problemId);
      let capabilityMatch = existing[existing.length - 1] || null;

      if (!capabilityMatch) {
        capabilityMatch = await matchCapabilities(problem, { persist: true });
      }

      if (!capabilityMatch?.id) {
        throw new Error(`capability.match produced no match for problem ${problemId}`);
      }

      await stageContext.emitDomain("capability.completed", {
        subjectType: "capability_match",
        subjectId: capabilityMatch.id,
        problemId,
        capabilityMatchId: capabilityMatch.id,
      });

      return {
        outputRefs: [capabilityMatch.id],
        skipped: Boolean(existing.length),
        metadata: {
          problemId,
          capabilityMatchId: capabilityMatch.id,
          skipped: Boolean(existing.length),
        },
      };
    },
  });
}
