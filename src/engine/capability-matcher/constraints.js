import { regionTokensFromLocation } from "./problem-context.js";

const URGENCY_RANK = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

function result(type, status, message, penaltyFactor = 1) {
  return {
    type,
    status,
    message,
    penaltyFactor,
    blocksExecution: status === "fail",
  };
}

function regionMatches(servedRegions = [], tokens = []) {
  if (!servedRegions.length) return true;
  if (servedRegions.includes("US") && tokens.includes("US")) return true;
  return tokens.some((token) => servedRegions.includes(token));
}

export function evaluateConstraints(problemContext, capability) {
  const results = [];
  const location = problemContext.location;
  const tokens = regionTokensFromLocation(location);

  const geo = capability.geographicConstraints || {};
  if (geo.remoteEligible) {
    results.push(result("geo", "pass", "Remote-eligible capability"));
  } else if (regionMatches(geo.servedRegions, tokens)) {
    results.push(result("geo", "pass", `Served region includes ${tokens.join(", ")}`));
  } else if (location?.state) {
    results.push(
      result("geo", "fail", `Location ${location.city || ""} ${location.state} outside served regions`),
    );
  } else {
    results.push(result("geo", "penalty", "Location unknown — geographic fit penalized", 0.85));
  }

  if (geo.excludedRegions?.length) {
    const excluded = tokens.some((token) => geo.excludedRegions.includes(token));
    if (excluded) {
      results.push(result("geo", "fail", "Location in excluded region"));
    }
  }

  for (const cert of capability.requiredCertifications || []) {
    if (cert.mandatory) {
      results.push(
        result(
          "license",
          "pass",
          `Mandatory certification tracked: ${cert.label}`,
        ),
      );
    }
  }

  if ((capability.requiredEquipment || []).length) {
    results.push(
      result("equipment", "pass", `${capability.requiredEquipment.length} equipment requirement(s) defined`),
    );
  }

  const capacity = capability.estimatedCapacity || {};
  if (capacity.available <= capacity.committed) {
    results.push(result("availability", "penalty", "Limited available capacity", 0.75));
  } else {
    results.push(result("availability", "pass", "Capacity available"));
  }

  const leadTime = capability.scalability?.leadTimeDays ?? 7;
  const urgencyRank = URGENCY_RANK[problemContext.urgency] || 2;
  if (urgencyRank >= 3 && leadTime > 3) {
    results.push(result("timing", "penalty", `Lead time ${leadTime} days under high urgency`, 0.8));
  } else {
    results.push(result("timing", "pass", `Lead time ${leadTime} days acceptable`));
  }

  if (problemContext.budget && capability.marginProfile?.typicalContractHigh) {
    if (problemContext.budget < capability.marginProfile.typicalContractLow) {
      results.push(result("budget", "penalty", "Problem budget below typical contract range", 0.7));
    } else {
      results.push(result("budget", "pass", "Budget within typical contract range"));
    }
  }

  for (const rule of capability.regulatoryConstraints || []) {
    if (rule.blocksExecutionIfUnmet) {
      results.push(result("regulatory", "pass", `${rule.summary} (${rule.jurisdiction})`));
    }
  }

  if (problemContext.unionRequired && capability.metadata?.unionCompliant !== true) {
    results.push(result("union", "fail", "Union shop requirement not met"));
  }

  if (capability.industryConstraints?.requiresPriorSiteExperience && !problemContext.industry) {
    results.push(
      result("safety", "penalty", "Industry/site experience requirement not verified", 0.9),
    );
  }

  if (capability.category === "Property Services" && problemContext.urgency === "critical") {
    results.push(result("weather", "penalty", "Exterior work may require weather window", 0.9));
  }

  if (capability.executionDifficulty >= 7) {
    results.push(result("safety", "pass", "High-difficulty capability — safety program required"));
  }

  if ((capability.marginProfile?.typicalContractHigh || 0) >= 100000) {
    results.push(result("insurance", "pass", "Industrial contract — COI requirements apply"));
  }

  return results;
}

export function hasHardConstraintFailure(results = []) {
  return results.some((row) => row.blocksExecution);
}

export function constraintPenaltyFactor(results = []) {
  return results.reduce((factor, row) => factor * (row.penaltyFactor ?? 1), 1);
}

export function summarizeConstraints(allResults = []) {
  const summary = {
    pass: 0,
    penalty: 0,
    fail: 0,
    byType: {},
  };

  for (const row of allResults) {
    summary[row.status] = (summary[row.status] || 0) + 1;
    if (!summary.byType[row.type]) {
      summary.byType[row.type] = { pass: 0, penalty: 0, fail: 0 };
    }
    summary.byType[row.type][row.status] += 1;
  }

  return summary;
}
