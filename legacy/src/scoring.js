const SERVICE_KEYWORDS = [
  "service",
  "pressure washing",
  "power washing",
  "tree",
  "roofing",
  "landscaping",
  "fence",
  "junk removal",
  "hvac",
  "electrical",
  "plumbing",
  "concrete",
  "painting",
  "cleaning",
  "contractor",
  "remodeling",
  "repair",
];

function hasWebsite(websiteUrl) {
  return Boolean(String(websiteUrl ?? "").trim());
}

function isServiceCategory(category) {
  const lower = String(category ?? "").toLowerCase();
  return SERVICE_KEYWORDS.some((kw) => lower.includes(kw));
}

export function scoreLead(lead) {
  const breakdown = [];
  let score = 0;

  const website = hasWebsite(lead.websiteUrl);

  if (!website) {
    score += 5;
    breakdown.push({ rule: "No website", points: 5 });
  } else if (lead.weakWebsite) {
    score += 3;
    breakdown.push({ rule: "Weak website", points: 3 });
  }

  const reviewCount = Number(lead.googleReviewCount) || 0;
  if (reviewCount >= 10) {
    score += 3;
    breakdown.push({ rule: "10+ reviews", points: 3 });
  }

  if (String(lead.phone ?? "").trim()) {
    score += 2;
    breakdown.push({ rule: "Phone visible", points: 2 });
  }

  const serviceBusiness =
    lead.serviceBusiness ?? isServiceCategory(lead.category);
  if (serviceBusiness) {
    score += 2;
    breakdown.push({ rule: "Service business", points: 2 });
  }

  if (lead.socialEvidence) {
    score += 2;
    breakdown.push({ rule: "Active social/page evidence", points: 2 });
  }

  if (lead.strongProof) {
    score += 2;
    breakdown.push({ rule: "Strong proof (branded trucks/photos/reviews)", points: 2 });
  }

  return { score, breakdown, serviceBusiness };
}

export function statusFromScore(score) {
  if (score >= 15) return "TARGET";
  if (score >= 10) return "HOLD";
  return "SKIP";
}
