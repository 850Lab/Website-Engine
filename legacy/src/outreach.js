function hasWebsite(websiteUrl) {
  return Boolean(String(websiteUrl ?? "").trim());
}

const ANGLES = {
  NO_WEBSITE: {
    key: "no_website",
    label: "No website angle",
    pitch:
      "They have demand signals but no owned web presence — offer a simple site that captures calls and reviews.",
  },
  WEAK_WEBSITE: {
    key: "weak_website",
    label: "Weak website angle",
    pitch:
      "They have a site that likely under-converts — offer a faster, mobile-first rebuild with clear CTAs and trust blocks.",
  },
  CONVERSION: {
    key: "conversion_improvement",
    label: "Conversion improvement angle",
    pitch:
      "They already invest online — offer landing-page and conversion tweaks (speed, booking, proof, local SEO).",
  },
};

export function generateOutreachAngle(lead) {
  if (!hasWebsite(lead.websiteUrl)) {
    return ANGLES.NO_WEBSITE;
  }
  if (lead.weakWebsite) {
    return ANGLES.WEAK_WEBSITE;
  }
  return ANGLES.CONVERSION;
}
