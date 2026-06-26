export function analyzeContactability(buyer) {
  let score = 0;
  const reasons = [];

  if (buyer.phoneAvailable) {
    score += 40;
    reasons.push("Phone available");
  }

  if (buyer.emailAvailable) {
    score += 20;
    reasons.push("Email available");
  }

  return {
    analyzer: "contactability",
    score,
    reasons,
  };
}
