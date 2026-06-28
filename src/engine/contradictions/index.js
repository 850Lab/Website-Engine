import { randomUUID } from "node:crypto";

export const CONTRADICTION_PAIRS = [
  {
    id: "expansion_vs_closure",
    leftKeys: ["expansion_contractor_demand"],
    rightKeys: ["expansion_delay_risk"],
    leftPolarity: ["positive"],
    rightPolarity: ["negative"],
    labels: ["Expansion", "Closure"],
    confidencePenalty: 0.12,
  },
  {
    id: "hiring_vs_layoffs",
    leftKeys: ["hiring_staffing_surge"],
    rightKeys: ["hiring_layoff_risk"],
    labels: ["Hiring", "Layoffs"],
    confidencePenalty: 0.12,
  },
  {
    id: "funding_approved_vs_cancelled",
    leftKeys: ["funding_program_demand"],
    rightKeys: ["funding_cancelled_risk"],
    labels: ["Funding Approved", "Funding Cancelled"],
    confidencePenalty: 0.15,
  },
];

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function templateKey(hypothesis) {
  return hypothesis.metadata?.templateKey || hypothesis.metadata?.problemCategoryCandidate;
}

function polarity(hypothesis) {
  return hypothesis.metadata?.polarity || "neutral";
}

export function detectCompetingHypotheses(hypotheses = []) {
  const links = [];

  for (const pair of CONTRADICTION_PAIRS) {
    const left = hypotheses.filter((row) => pair.leftKeys?.includes(templateKey(row)));
    const right = hypotheses.filter((row) => pair.rightKeys?.includes(templateKey(row)));

    for (const a of left) {
      for (const b of right) {
        if (a.id === b.id) continue;
        if (!shareSituation(a, b)) continue;
        links.push({ a, b, pair });
      }
    }
  }

  return links;
}

function shareSituation(a, b) {
  const aSituations = new Set(asArray(a.originatingSituationIds));
  return asArray(b.originatingSituationIds).some((id) => aSituations.has(id));
}

export function findContradictions(hypotheses = []) {
  const competing = detectCompetingHypotheses(hypotheses);
  const records = [];

  for (const link of competing) {
    records.push({
      id: `con_${randomUUID()}`,
      type: link.pair.id,
      label: `${link.pair.labels[0]} vs ${link.pair.labels[1]}`,
      hypothesisIds: [link.a.id, link.b.id],
      situationIds: uniqueStrings([
        ...link.a.originatingSituationIds,
        ...link.b.originatingSituationIds,
      ]),
      confidencePenalty: link.pair.confidencePenalty,
      status: "active",
      resolution: "unresolved",
      createdAt: new Date().toISOString(),
    });
  }

  return records;
}

function uniqueStrings(values) {
  return [...new Set(values.map(String).filter(Boolean))];
}

export function applyContradictionsToHypotheses(hypotheses, contradictions) {
  const byId = new Map(hypotheses.map((row) => [row.id, { ...row }]));
  const contradictionByHypothesis = new Map();

  for (const contradiction of contradictions) {
    for (const hypothesisId of contradiction.hypothesisIds) {
      if (!contradictionByHypothesis.has(hypothesisId)) {
        contradictionByHypothesis.set(hypothesisId, []);
      }
      contradictionByHypothesis.get(hypothesisId).push(contradiction.id);
    }
  }

  for (const [hypothesisId, contradictionIds] of contradictionByHypothesis.entries()) {
    const row = byId.get(hypothesisId);
    if (!row) continue;
    row.contradictionIds = uniqueStrings([...(row.contradictionIds || []), ...contradictionIds]);
    if (row.status === "generated" || row.status === "supported") {
      row.status = "contested";
    }
  }

  return [...byId.values()];
}
