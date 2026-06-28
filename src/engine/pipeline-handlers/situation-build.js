import { processGraphIntoSituations } from "../situation-builder/index.js";
import { listSituations } from "../situations/index.js";
import { requireInputRef, runPipelineStage } from "./utils.js";

export async function situationBuildHandler(job, context) {
  return runPipelineStage(job, context, {
    stage: "situation",
    jobType: "situation.build",
    async execute(jobRef, stageContext) {
      const graphId = requireInputRef(jobRef, "situation.build");
      const existing = await listSituations();

      if (existing.length) {
        const situationIds = existing.map((row) => row.id);
        await stageContext.emitDomain("situations.completed", {
          subjectType: "situation",
          subjectId: situationIds[0],
          graphId,
          situationId: situationIds[0],
          situationIds,
        });

        return {
          outputRefs: situationIds,
          skipped: true,
          metadata: {
            graphId,
            situationIds,
            skipped: true,
          },
        };
      }

      const result = await processGraphIntoSituations();
      const situations = result.situations || [];
      const situationIds = situations.map((row) => row.id);

      if (!situationIds.length) {
        throw new Error(`situation.build produced no situations for graph ${graphId}`);
      }

      await stageContext.emitDomain("situations.completed", {
        subjectType: "situation",
        subjectId: situationIds[0],
        graphId,
        situationId: situationIds[0],
        situationIds,
      });

      return {
        outputRefs: situationIds,
        skipped: result.created?.length === 0 && result.updated?.length === 0,
        metadata: {
          graphId,
          situationIds,
          createdCount: result.created?.length || 0,
          updatedCount: result.updated?.length || 0,
        },
      };
    },
  });
}
