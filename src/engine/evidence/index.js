function money(value) {
  return `$${Number(value || 0).toLocaleString()}`;
}

function averageConfidenceScore(scoreCouncil) {
  const rows = Object.values(scoreCouncil?.scores || {});
  if (!rows.length) return 0;
  return Math.round(rows.reduce((sum, row) => sum + (row.confidence || 0), 0) / rows.length);
}

function topScoreEngines(scoreCouncil, count = 3) {
  return Object.entries(scoreCouncil?.scoreVector || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, count)
    .map(([engine, score]) => ({ engine, score }));
}

function lowScoreEngines(scoreCouncil, threshold = 45, count = 3) {
  return Object.entries(scoreCouncil?.scoreVector || {})
    .filter(([, score]) => score < threshold)
    .sort((a, b) => a[1] - b[1])
    .slice(0, count)
    .map(([engine, score]) => ({ engine, score }));
}

function buildDatabaseEvidence(opportunity) {
  const lines = [];
  if (opportunity.businessesFound != null) {
    lines.push(`Database contains ${opportunity.businessesFound} matching businesses.`);
  }
  if (opportunity.reachableBusinesses != null) {
    lines.push(`${opportunity.reachableBusinesses} businesses are reachable by phone or email.`);
  }
  if (opportunity.reachableByPhone != null) {
    lines.push(`${opportunity.reachableByPhone} reachable by phone.`);
  }
  if (opportunity.reachableByEmail != null) {
    lines.push(`${opportunity.reachableByEmail} reachable by email.`);
  }
  if (opportunity.contactCoverage != null) {
    lines.push(`Contact coverage is ${opportunity.contactCoverage}%.`);
  }
  if (opportunity.databaseConfidence) {
    lines.push(`Database confidence label: ${opportunity.databaseConfidence}.`);
  }
  if (opportunity.source) {
    lines.push(`Opportunity source path: ${opportunity.source}.`);
  }
  return lines;
}

function buildCapabilityEvidence(offerRecord) {
  if (!offerRecord?.capabilities?.length) return [];
  return offerRecord.capabilities.map(
    (capability) =>
      `Capability ${capability.name} solves ${(capability.problemsSolved || []).slice(0, 3).join(", ")}.`,
  );
}

function buildOfferEvidence(offerRecord, opportunity) {
  const lines = [];
  if (offerRecord?.promise) lines.push(`Offer promise: ${offerRecord.promise}`);
  if (offerRecord?.urgency) lines.push(`Urgency: ${offerRecord.urgency}`);
  if (opportunity.estimatedRevenuePotential) {
    lines.push(`Estimated revenue potential: ${money(opportunity.estimatedRevenuePotential)} (directional).`);
  }
  if (opportunity.estimatedContractValue) {
    lines.push(`Estimated contract value: ${money(opportunity.estimatedContractValue)} (directional).`);
  }
  return lines;
}

function buildMarketEvidence(market, opportunity) {
  if (!market) {
    return opportunity.marketId
      ? [`Market record unavailable for marketId ${opportunity.marketId}.`]
      : ["No market library record linked; economics inferred from industry discovery."];
  }
  return [
    `Market: ${market.name}.`,
    `Market priority: ${market.priority}/100.`,
    `Market confidence note: ${market.confidence || "Directional"}.`,
    ...(market.rationale || []).slice(0, 2),
  ];
}

function buildMissingData(opportunity, offerRecord) {
  const missing = [];
  if (!opportunity.reachableBusinesses) missing.push("No reachable businesses in database match.");
  if ((opportunity.contactCoverage || 0) < 40) missing.push("Contact coverage is below 40%.");
  if (opportunity.databaseConfidence === "None" || opportunity.databaseConfidence === "Low") {
    missing.push("Database confidence is limited for this opportunity.");
  }
  if (!offerRecord?.capabilities?.length) missing.push("Offer is not linked to capability registry entries.");
  if (!opportunity.problemId) missing.push("Problem object not yet modeled (Phase 3).");
  if (!opportunity.evidenceRef) missing.push("Graph evidence bundle not yet assembled (Phase 3).");
  return missing;
}

function buildWhyNotOthers(opportunity, runnerUp, rank, totalCount) {
  if (!runnerUp) {
    return [`Ranked #1 of ${totalCount} generated opportunities with no close runner-up in current radar.`];
  }

  const lines = [
    `Ranked #${rank} of ${totalCount} generated opportunities.`,
    `Outranks ${runnerUp.offer} in ${runnerUp.industry || runnerUp.market} by composite score ${opportunity.opportunityScore} vs ${runnerUp.opportunityScore}.`,
  ];

  const topEngines = topScoreEngines(opportunity.scoreCouncil, 2);
  for (const { engine, score } of topEngines) {
    const otherScore = runnerUp.scoreVector?.[engine] ?? 0;
    if (score > otherScore) {
      lines.push(`Higher ${engine} score (${score} vs ${otherScore}).`);
    }
  }

  if ((opportunity.reachableBusinesses || 0) > (runnerUp.reachableBusinesses || 0)) {
    lines.push(
      `More reachable businesses (${opportunity.reachableBusinesses} vs ${runnerUp.reachableBusinesses}).`,
    );
  }

  return lines;
}

function buildWhyNow(opportunity, offerRecord) {
  const lines = [];
  if (offerRecord?.urgency) lines.push(offerRecord.urgency);
  if ((opportunity.contactCoverage || 0) >= 50) {
    lines.push("Contact coverage is sufficient to begin outreach now.");
  }
  if ((opportunity.reachableBusinesses || 0) > 0) {
    lines.push(`${opportunity.reachableBusinesses} buyers can be contacted immediately via configured channels.`);
  }
  if (opportunity.scoreVector?.timing >= 60) {
    lines.push("Timing score indicates near-term action window.");
  }
  if (opportunity.scoreVector?.speed >= 60) {
    lines.push("Speed score favors immediate cash-flow execution.");
  }
  if (!lines.length) lines.push("Validate demand and enrich contacts before large outreach spend.");
  return lines;
}

export function assembleEvidence(opportunity, context = {}) {
  const {
    offerRecord = null,
    market = null,
    runnerUp = null,
    rank = 1,
    totalCount = 1,
  } = context;

  const scoreCouncil = opportunity.scoreCouncil || null;
  const strengths = topScoreEngines(scoreCouncil).map(
    ({ engine, score }) => `${engine} score ${score}/100`,
  );
  const weaknesses = lowScoreEngines(scoreCouncil).map(
    ({ engine, score }) => `${engine} score ${score}/100 needs attention`,
  );

  const evidence = [
    ...buildDatabaseEvidence(opportunity),
    ...(scoreCouncil?.evidence || []),
    ...buildCapabilityEvidence(offerRecord),
    ...buildOfferEvidence(offerRecord, opportunity),
    ...buildMarketEvidence(market, opportunity),
  ];

  const assumptions = [
    ...(scoreCouncil?.assumptions || []),
    "Revenue and contract values are directional unless validated in the field.",
    "Industry/offer matching is transitional until Phase 3 problem inference.",
  ].filter(Boolean);

  const missingData = buildMissingData(opportunity, offerRecord);

  const summary = [
    `${opportunity.offer || "Offer"} in ${opportunity.industry || opportunity.market || "target market"}`,
    `Composite score ${opportunity.opportunityScore}/100 under CEO mode ${scoreCouncil?.mode || "cash_flow"}.`,
    `${opportunity.reachableBusinesses || 0} reachable businesses with ${opportunity.contactCoverage || 0}% contact coverage.`,
  ].join(" ");

  return {
    summary,
    strengths,
    weaknesses,
    assumptions: [...new Set(assumptions)],
    evidence,
    confidence: {
      database: opportunity.databaseConfidence || "None",
      scoreCouncilAverage: averageConfidenceScore(scoreCouncil),
      compositeScore: opportunity.opportunityScore || 0,
    },
    whyNow: buildWhyNow(opportunity, offerRecord),
    whyNotOthers: buildWhyNotOthers(opportunity, runnerUp, rank, totalCount),
    explainability: {
      why: strengths.length
        ? `Top opportunity because ${strengths.slice(0, 2).join(" and ")}.`
        : "Top opportunity by composite score in current radar.",
      whyNow: buildWhyNow(opportunity, offerRecord),
      whyNotOthers: buildWhyNotOthers(opportunity, runnerUp, rank, totalCount),
      assumptions: [...new Set(assumptions)],
      evidence,
      missingData,
    },
    missingData,
  };
}

export function assembleEvidenceForRadar(opportunities, contextById = {}) {
  return opportunities.map((opportunity, index) =>
    assembleEvidence(opportunity, {
      ...contextById[opportunity.id],
      runnerUp: opportunities[index + 1] || null,
      rank: index + 1,
      totalCount: opportunities.length,
    }),
  );
}
