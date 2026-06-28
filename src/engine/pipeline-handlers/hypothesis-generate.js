import { generateHypothesesFromSituation } from "../hypothesis-generator/index.js";
import {
  createHypothesis,
  initializeHypothesisStore,
  listHypotheses,
} from "../hypotheses/index.js";
import { requireInputRef, runPipelineStage } from "./utils.js";

export async function hypothesisGenerateHandler(job, context) {
  return runPipelineStage(job, context, {
    stage: "hypothesis",
    jobType: "hypothesis.generate",
    async execute(jobRef, stageContext) {
      const situationId = requireInputRef(jobRef, "hypothesis.generate");
      await initializeHypothesisStore();

      const existing = (await listHypotheses()).filter((row) =>
        row.originatingSituationIds?.includes(situationId),
      );

      let hypotheses = existing;
      if (!existing.length) {
        const drafts = await generateHypothesesFromSituation(situationId);
        hypotheses = [];
        for (const draft of drafts) {
          hypotheses.push(await createHypothesis(draft));
        }
      }

      const hypothesisIds = hypotheses.map((row) => row.id);
      if (!hypothesisIds.length) {
        throw new Error(`hypothesis.generate produced no hypotheses for situation ${situationId}`);
      }

      await stageContext.emitDomain("hypotheses.completed", {
        subjectType: "hypothesis",
        subjectId: hypothesisIds[0],
        situationId,
        hypothesisIds,
      });

      return {
        outputRefs: hypothesisIds,
        skipped: existing.length > 0,
        metadata: {
          situationId,
          hypothesisIds,
          skipped: existing.length > 0,
        },
      };
    },
  });
}
