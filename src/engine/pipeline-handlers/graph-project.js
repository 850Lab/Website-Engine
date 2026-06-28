import { getFactById } from "../facts/index.js";
import { buildGraphFromFactsAndPersist } from "../knowledge-graph/index.js";
import { requireInputRefs, runPipelineStage, RUNTIME_GRAPH_ID } from "./utils.js";

export async function graphProjectHandler(job, context) {
  return runPipelineStage(job, context, {
    stage: "graph",
    jobType: "graph.project",
    async execute(jobRef, stageContext) {
      const factIds = requireInputRefs(jobRef, "graph.project");
      const facts = [];

      for (const factId of factIds) {
        const fact = await getFactById(factId);
        if (!fact) {
          throw new Error(`Fact not found: ${factId}`);
        }
        facts.push(fact);
      }

      await buildGraphFromFactsAndPersist(facts);

      await stageContext.emitDomain("graph.completed", {
        subjectType: "graph",
        subjectId: RUNTIME_GRAPH_ID,
        graphId: RUNTIME_GRAPH_ID,
        factIds,
      });

      return {
        outputRefs: [RUNTIME_GRAPH_ID],
        metadata: {
          graphId: RUNTIME_GRAPH_ID,
          factIds,
        },
      };
    },
  });
}
