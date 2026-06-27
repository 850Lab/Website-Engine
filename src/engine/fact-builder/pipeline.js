import { getSignalById, linkFactsToSignal } from "../signals/index.js";
import { createFact, getFactsBySignalId } from "../facts/index.js";
import { buildGraphProjectionFromFacts } from "../knowledge-graph/index.js";
import { buildFactsFromSignal } from "./index.js";

const FACT_ELIGIBLE_STATES = new Set([
  "classified",
  "entity_linked",
  "problem_inferred",
  "opportunity_generated",
]);

export async function processSignalIntoFacts(signalId, options = {}) {
  const signal = await getSignalById(signalId);
  if (!signal) {
    throw new Error(`Signal not found: ${signalId}`);
  }

  if (!FACT_ELIGIBLE_STATES.has(signal.processingState)) {
    throw new Error(
      `Signal ${signalId} must be classified or later (current: ${signal.processingState})`,
    );
  }

  if (signal.processingState === "archived" || signal.processingState === "rejected") {
    throw new Error(`Signal ${signalId} is terminal and cannot produce facts`);
  }

  if (asArray(signal.factIds).length && !options.force) {
    const existing = await getFactsBySignalId(signalId);
    return {
      signalId,
      facts: existing,
      factIds: signal.factIds,
      graphProjection: buildGraphProjectionFromFacts(existing),
      skipped: true,
    };
  }

  const drafts = buildFactsFromSignal(signal);
  const created = [];

  for (const draft of drafts) {
    created.push(await createFact(draft));
  }

  const factIds = created.map((fact) => fact.id);
  const updatedSignal = await linkFactsToSignal(signalId, factIds, {
    extractor: "fact_builder_v0",
    factCount: factIds.length,
  });

  const graphProjection = buildGraphProjectionFromFacts(created);

  return {
    signalId,
    signal: updatedSignal,
    facts: created,
    factIds: updatedSignal.factIds,
    graphProjection,
    skipped: false,
  };
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}
