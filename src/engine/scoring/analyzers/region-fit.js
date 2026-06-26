export function analyzeRegionFit(buyer, mission) {
  let score = 0;
  const reasons = [];

  if (buyer.city || buyer.region) {
    score += 20;
    reasons.push(`Located in ${buyer.city || buyer.region}`);
  }

  return {
    analyzer: "regionFit",
    score,
    reasons,
  };
}
