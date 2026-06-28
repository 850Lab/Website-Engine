import { getSignalById } from "../signals/index.js";
import { getFactById } from "../facts/index.js";
import { getSituationEvidence } from "../knowledge-graph/index.js";

export const EVIDENCE_TIER_LABELS = ["T1", "T2", "T3", "T4", "T5", "T6"];

const TIER_WEIGHTS = {
  T1: 1.0,
  T2: 0.85,
  T3: 0.7,
  T4: 0.55,
  T5: 0.4,
  T6: 0.25,
};

const SOURCE_TYPE_TIER = {
  government_feed: "T1",
  manual: "T4",
  connector: "T3",
  crm_webhook: "T2",
  news_feed: "T4",
  file_import: "T3",
  unknown: "T5",
};

const PREDICATE_TIER_BOOST = {
  announced: 0,
  located_in: 0,
  has_signal_type: 0,
  affects_market: 0,
  affects_capability: 0,
  observed_at: 0,
};

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function inferSignalTier(signal) {
  if (!signal) return "T5";
  if (signal.signalType === "government_agenda" || signal.signalType === "public_budget") {
    return "T1";
  }
  if (signal.signalType === "permit" || signal.signalType === "contract_award") {
    return "T1";
  }
  if (signal.signalType === "social_signal") return "T6";
  return SOURCE_TYPE_TIER[signal.sourceType] || "T5";
}

function inferFactTier(fact, signalTierMap) {
  const signalTiers = asArray(fact.signalIds).map((id) => signalTierMap.get(id) || "T5");
  const bestSignalTier = signalTiers.sort()[0] || "T5";
  const tierRank = { T1: 1, T2: 2, T3: 3, T4: 4, T5: 5, T6: 6 };
  let tier = bestSignalTier;
  if (fact.predicate === "announced" && tierRank[tier] > 3) tier = "T4";
  if (fact.extractor === "fact_builder_v0") return tier;
  return tier;
}

function inferRelationshipTier(relationship, factTierMap) {
  const tiers = asArray(relationship.factIds).map((id) => factTierMap.get(id) || "T5");
  return tiers.sort()[0] || "T5";
}

function averageTierWeight(tiers) {
  if (!tiers.length) return 0;
  const total = tiers.reduce((sum, tier) => sum + (TIER_WEIGHTS[tier] || TIER_WEIGHTS.T5), 0);
  return Number((total / tiers.length).toFixed(3));
}

export function inferEvidenceTierForSignal(signal) {
  return inferSignalTier(signal);
}

export function inferEvidenceTierForFact(fact, signalTierMap = new Map()) {
  return inferFactTier(fact, signalTierMap);
}

export async function collectEvidenceForHypothesis(hypothesis) {
  if (!hypothesis?.originatingSituationIds?.length) {
    throw new Error("Hypothesis must include originatingSituationIds");
  }

  const situationId = hypothesis.originatingSituationIds[0];
  const baseEvidence = await getSituationEvidence(situationId);
  const situation = baseEvidence.situation;

  const signals = [];
  const signalTierMap = new Map();
  for (const signalId of uniqueIds([
    ...asArray(hypothesis.supportingSignalIds),
    ...asArray(situation.signalIds),
  ])) {
    const signal = await getSignalById(signalId);
    if (!signal) continue;
    const tier = inferSignalTier(signal);
    signalTierMap.set(signalId, tier);
    signals.push({
      id: signalId,
      tier,
      weight: TIER_WEIGHTS[tier],
      signalType: signal.signalType,
      sourceType: signal.sourceType,
      confidence: signal.confidence,
    });
  }

  const facts = [];
  const factTierMap = new Map();
  for (const factId of uniqueIds([
    ...asArray(hypothesis.supportingFactIds),
    ...asArray(situation.factIds),
  ])) {
    const fact = await getFactById(factId);
    if (!fact) continue;
    const tier = inferFactTier(fact, signalTierMap);
    factTierMap.set(factId, tier);
    facts.push({
      id: factId,
      tier,
      weight: TIER_WEIGHTS[tier],
      predicate: fact.predicate,
      confidence: fact.confidence,
      signalIds: fact.signalIds,
    });
  }

  const relationships = asArray(baseEvidence.relationships).map((relationship) => {
    const tier = inferRelationshipTier(relationship, factTierMap);
    return {
      id: relationship.id,
      type: relationship.type,
      tier,
      weight: TIER_WEIGHTS[tier],
      confidence: relationship.confidence,
      factIds: relationship.factIds,
      signalIds: relationship.signalIds,
    };
  });

  const evidenceTiers = {
    signals: summarizeTierCounts(signals),
    facts: summarizeTierCounts(facts),
    relationships: summarizeTierCounts(relationships),
  };

  const evidenceCount = signals.length + facts.length + relationships.length;
  const evidenceWeight = averageTierWeight([
    ...signals.map((row) => row.tier),
    ...facts.map((row) => row.tier),
    ...relationships.map((row) => row.tier),
  ]);

  const missingEvidence = buildMissingEvidence(hypothesis, situation, facts, signals);

  return {
    hypothesisId: hypothesis.id,
    situation,
    signals,
    facts,
    relationships,
    nodes: baseEvidence.nodes,
    evidenceTiers,
    evidenceCount,
    evidenceWeight,
    missingEvidence,
    contradictions: [],
  };
}

function summarizeTierCounts(items) {
  const counts = Object.fromEntries(EVIDENCE_TIER_LABELS.map((tier) => [tier, 0]));
  for (const item of items) {
    counts[item.tier] = (counts[item.tier] || 0) + 1;
  }
  return counts;
}

function buildMissingEvidence(hypothesis, situation, facts, signals) {
  const missing = [];
  const polarity = hypothesis.metadata?.polarity || "positive";

  if (!facts.some((fact) => fact.tier === "T1" || fact.tier === "T2")) {
    missing.push({
      type: "primary_official_source",
      description: "Official permit, contract, or government filing would increase confidence",
      priority: polarity === "positive" ? "high" : "medium",
    });
  }

  if (!signals.length) {
    missing.push({
      type: "supporting_signal",
      description: "At least one supporting signal is required",
      priority: "critical",
    });
  }

  if (!situation.summary?.primaryLocation) {
    missing.push({
      type: "location_confirmation",
      description: "Primary location should be confirmed",
      priority: "medium",
    });
  }

  return missing;
}

function uniqueIds(values) {
  return [...new Set(values.map(String).filter(Boolean))];
}

export { TIER_WEIGHTS, SOURCE_TYPE_TIER };
