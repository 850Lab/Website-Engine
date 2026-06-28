import { getProblemsSolvedForCategory } from "./problem-category-map.js";

function overlapCount(a = [], b = []) {
  const setB = new Set(b.map(String));
  return a.filter((item) => setB.has(String(item))).length;
}

function normalizeHintId(value) {
  return String(value || "")
    .trim()
    .replace(/^cap_/, "")
    .replace(/^site_services$/, "ktm_labor");
}

export function findCandidateCapabilities(problemContext, capabilities = []) {
  const targetProblems = getProblemsSolvedForCategory(problemContext.category);
  const hintIds = new Set(problemContext.affectedCapabilities.map(normalizeHintId));
  const candidates = [];

  for (const capability of capabilities) {
    const matchedProblems = capability.problemsSolved.filter((slug) => targetProblems.includes(slug));
    const hintMatch = hintIds.has(capability.id);
    const parentHint = capability.parentCapability && hintIds.has(capability.parentCapability);
    const childHint = capability.childCapabilities.some((id) => hintIds.has(id));

    if (!matchedProblems.length && !hintMatch && !parentHint && !childHint) {
      continue;
    }

    const reasons = [];
    if (matchedProblems.length) {
      reasons.push(`Problem category maps to ${matchedProblems.join(", ")}`);
    }
    if (hintMatch) {
      reasons.push("Problem affectedCapabilities hint");
    }
    if (parentHint || childHint) {
      reasons.push("Related capability hierarchy hint");
    }

    candidates.push({
      capability,
      selectionReasons: reasons,
      matchedProblems,
      hintMatch: hintMatch || parentHint || childHint,
    });
  }

  return candidates;
}

export function rejectNonCandidates(problemContext, capabilities = [], candidates = []) {
  const candidateIds = new Set(candidates.map((row) => row.capability.id));
  return capabilities
    .filter((capability) => !candidateIds.has(capability.id))
    .map((capability) => {
      const overlap = overlapCount(
        capability.problemsSolved,
        getProblemsSolvedForCategory(problemContext.category),
      );
      return {
        capabilityId: capability.id,
        rejectionReason:
          overlap > 0
            ? "Did not pass candidate threshold after problem category mapping"
            : "No problem category overlap",
        failedConstraints: ["candidate_filter"],
      };
    });
}
