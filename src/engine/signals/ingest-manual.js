import { readFile } from "node:fs/promises";
import { createSignal, normalizeSignal, updateSignalState } from "./index.js";
import { archiveObservation, normalizeObservationInput } from "./observations.js";
import { classifySignalRules, UNKNOWN_TYPE } from "./classify.js";
import { buildCalibratedDedupKey } from "./dedup.js";

export async function ingestManualObservation(input = {}) {
  let originalText = input.originalText;
  if (input.filePath) {
    originalText = await readFile(input.filePath, "utf8");
  }

  const normalizedInput = normalizeObservationInput({
    ...input,
    originalText,
  });

  const archived = await archiveObservation({
    ...normalizedInput,
    originalText: originalText ?? normalizedInput.summary ?? normalizedInput.headline,
    metadata: {
      filePath: input.filePath || null,
    },
  });

  const classification = classifySignalRules({
    headline: normalizedInput.headline,
    summary: normalizedInput.summary,
    signalType: normalizedInput.signalType,
  });

  const signalDraft = normalizeSignal({
    ...normalizedInput,
    rawTextRef: archived.rawTextRef,
    signalType: classification.signalType,
    confidence: classification.confidence,
    dedupKey: buildCalibratedDedupKey({
      source: normalizedInput.source,
      headline: normalizedInput.headline,
      signalType: classification.signalType,
      location: normalizedInput.location,
      observedAt: normalizedInput.observedAt,
      contentHash: normalizedInput.provenance?.contentHash,
      semanticEventType: classification.semanticEventType || classification.signalType,
    }),
    provenance: {
      ...normalizedInput.provenance,
      observationId: archived.observationId,
      classificationMethod: classification.method,
      matchedRules: classification.matchedRules,
      semanticEventType: classification.semanticEventType || classification.signalType,
    },
    evidence: [
      {
        type: "observation",
        text: normalizedInput.headline,
        ref: archived.rawTextRef,
        confidence: classification.confidence,
      },
    ],
    riskFlags: classification.signalType === UNKNOWN_TYPE ? ["unknown_signal_type"] : [],
  });

  const captured = await createSignal(signalDraft);

  const normalized = await updateSignalState(captured.id, "normalized", {
    action: "manual_ingest_normalize",
    observationId: archived.observationId,
    rawTextRef: archived.rawTextRef,
  });

  const classified = await updateSignalState(normalized.id, "classified", {
    action: "manual_ingest_classify",
    classification,
    signalType: classification.signalType,
  });

  return {
    observation: archived.record,
    rawTextRef: archived.rawTextRef,
    classification,
    signal: classified,
  };
}
