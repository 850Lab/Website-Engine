import { processSignalIntoFacts } from "../fact-builder/pipeline.js";
import { requireInputRef, runPipelineStage } from "./utils.js";

export async function factBuildHandler(job, context) {
  return runPipelineStage(job, context, {
    stage: "fact_builder",
    jobType: "fact.build",
    async execute(jobRef, stageContext) {
      const signalId = requireInputRef(jobRef, "fact.build");
      const result = await processSignalIntoFacts(signalId);
      const factIds = result.factIds || result.facts?.map((row) => row.id) || [];

      if (!factIds.length) {
        throw new Error(`fact.build produced no facts for signal ${signalId}`);
      }

      await stageContext.emitDomain("facts.completed", {
        subjectType: "fact",
        subjectId: factIds[0],
        signalId,
        factIds,
      });

      return {
        outputRefs: factIds,
        skipped: result.skipped === true,
        metadata: {
          signalId,
          factIds,
          skipped: result.skipped === true,
        },
      };
    },
  });
}
