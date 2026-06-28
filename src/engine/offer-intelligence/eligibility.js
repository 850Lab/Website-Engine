import { MIN_CAPABILITY_FIT_FOR_OFFER } from "./constants.js";

function check(name, status, message) {
  return { check: name, status, message, blocksOffer: status === "fail" };
}

export function evaluateOfferEligibility(matchContext, candidate) {
  const { offer, overlappingCapabilities } = candidate;
  const fitById = matchContext.fitByCapabilityId;
  const checks = [];

  if (!offer.capabilityIds.length) {
    checks.push(check("capability_link", "fail", "Offer has no capabilityIds"));
  } else {
    checks.push(check("capability_link", "pass", "Offer references capabilities"));
  }

  const qualifyingOverlap = overlappingCapabilities.filter(
    (id) => (fitById.get(id) || 0) >= MIN_CAPABILITY_FIT_FOR_OFFER,
  );

  if (!qualifyingOverlap.length && !matchContext.requiredCapabilityIds.length) {
    checks.push(
      check(
        "capability_fit_floor",
        "fail",
        `No overlapping capability meets fit floor (${MIN_CAPABILITY_FIT_FOR_OFFER})`,
      ),
    );
  } else {
    checks.push(check("capability_fit_floor", "pass", "Capability fit floor satisfied"));
  }

  if (matchContext.requiredCapabilityIds.length) {
    const missingRequired = matchContext.requiredCapabilityIds.filter(
      (id) => !offer.capabilityIds.includes(id),
    );
    if (missingRequired.length) {
      checks.push(
        check(
          "composition_required",
          "fail",
          `Missing required composition capabilities: ${missingRequired.join(", ")}`,
        ),
      );
    } else {
      checks.push(check("composition_required", "pass", "Composition required capabilities covered"));
    }
  }

  const blocksOffer = checks.some((row) => row.blocksOffer);
  return {
    eligible: !blocksOffer,
    checks,
  };
}

export function hasEligibilityFailure(eligibility) {
  return !eligibility.eligible;
}
