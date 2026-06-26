export function analyzeOfferFit(buyer, mission) {
  let score = 0;
  const reasons = [];

  const text = `${buyer.name || ""} ${buyer.industry || ""}`.toLowerCase();
  const keywords = mission.target?.keywords || [];

  for (const keyword of keywords) {
    if (text.includes(String(keyword).toLowerCase())) {
      score += 25;
      reasons.push(`Matches keyword: ${keyword}`);
      break;
    }
  }

  return {
    analyzer: "offerFit",
    score,
    reasons,
  };
}
