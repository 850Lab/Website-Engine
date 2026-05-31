const CATEGORY_PROFILES = [
  {
    match: /plumb/i,
    key: "plumbing",
    label: "Plumbing",
    services: [
      "Emergency plumbing repairs",
      "Drain cleaning & clog removal",
      "Water heater install & repair",
      "Leak detection & pipe repair",
      "Fixture installation",
    ],
  },
  {
    match: /tree|stump/i,
    key: "tree",
    label: "Tree Service",
    services: [
      "Tree trimming & pruning",
      "Tree removal",
      "Stump grinding",
      "Storm damage cleanup",
      "Lot clearing",
    ],
  },
  {
    match: /pressure wash|power wash/i,
    key: "pressure_washing",
    label: "Pressure Washing",
    services: [
      "Driveway & sidewalk cleaning",
      "House & siding wash",
      "Deck & fence restoration",
      "Roof soft wash",
      "Commercial storefront cleaning",
    ],
  },
  {
    match: /roof/i,
    key: "roofing",
    label: "Roofing",
    services: [
      "Roof inspection & repair",
      "Shingle replacement",
      "Storm damage restoration",
      "Gutter installation",
      "New roof installation",
    ],
  },
  {
    match: /hvac|heating|cooling/i,
    key: "hvac",
    label: "HVAC",
    services: [
      "AC repair & tune-ups",
      "Furnace repair & maintenance",
      "System installation",
      "Duct cleaning",
      "Seasonal maintenance plans",
    ],
  },
  {
    match: /landscap|lawn/i,
    key: "landscaping",
    label: "Landscaping",
    services: [
      "Lawn mowing & maintenance",
      "Landscape design & install",
      "Mulching & bed care",
      "Seasonal cleanups",
      "Irrigation & sprinkler repair",
    ],
  },
  {
    match: /electric/i,
    key: "electrical",
    label: "Electrical",
    services: [
      "Panel upgrades",
      "Outlet & lighting installs",
      "Emergency electrical repair",
      "Ceiling fan installation",
      "Home safety inspections",
    ],
  },
  {
    match: /clean/i,
    key: "cleaning",
    label: "Cleaning",
    services: [
      "Residential cleaning",
      "Deep cleaning",
      "Move-in / move-out cleaning",
      "Recurring maintenance plans",
      "Commercial cleaning",
    ],
  },
  {
    match: /fence/i,
    key: "fence",
    label: "Fencing",
    services: [
      "Fence installation",
      "Fence repair & replacement",
      "Gate installation",
      "Wood & vinyl options",
      "Commercial fencing",
    ],
  },
  {
    match: /concrete/i,
    key: "concrete",
    label: "Concrete",
    services: [
      "Driveway installation",
      "Patio & sidewalk work",
      "Concrete repair & resurfacing",
      "Stamped concrete",
      "Commercial flatwork",
    ],
  },
  {
    match: /paint/i,
    key: "painting",
    label: "Painting",
    services: [
      "Interior painting",
      "Exterior painting",
      "Cabinet refinishing",
      "Deck & fence staining",
      "Commercial painting",
    ],
  },
  {
    match: /contract|remodel|repair/i,
    key: "contractor",
    label: "Contracting",
    services: [
      "Home repairs",
      "Kitchen & bath updates",
      "Remodeling projects",
      "Custom carpentry",
      "Free project estimates",
    ],
  },
];

const DEFAULT_PROFILE = {
  key: "general",
  label: "Local Service",
  services: [
    "Core residential services",
    "Commercial service options",
    "Emergency / same-day availability",
    "Free estimates",
    "Service area coverage",
  ],
};

const ANGLE_TEMPLATES = {
  no_website: {
    sections: [
      "Hero with phone CTA",
      "Services overview",
      "Why choose us / trust bar",
      "Service area map",
      "Google reviews",
      "Photo gallery",
      "Contact & quote form",
    ],
    heroSuffix: "Trusted Local Pros — Call Today",
    cta: "Call Now for a Free Estimate",
    outreachNote:
      "Lead has no website but shows demand signals. Pitch a simple, mobile-first site built to capture calls and showcase reviews.",
  },
  weak_website: {
    sections: [
      "Hero with click-to-call",
      "Before/after or project gallery",
      "Services with clear pricing cues",
      "Trust badges & reviews",
      "Process / how it works",
      "FAQ",
      "Strong footer CTA",
    ],
    heroSuffix: "Better Website. More Calls.",
    cta: "Get Your Free Quote",
    outreachNote:
      "Lead has a weak site that likely under-converts. Pitch a faster rebuild with clearer CTAs, proof blocks, and mobile UX.",
  },
  conversion_improvement: {
    sections: [
      "Conversion-focused hero",
      "Top services (3–5 cards)",
      "Social proof strip",
      "Booking / contact CTA",
      "Local SEO content block",
      "Reviews carousel",
      "Final CTA banner",
    ],
    heroSuffix: "Book Service in Minutes",
    cta: "Schedule Service Online",
    outreachNote:
      "Lead already has web presence. Pitch landing-page and conversion improvements: speed, booking flow, trust, and local SEO.",
  },
};

function resolveCategoryProfile(category) {
  const text = String(category ?? "");
  return (
    CATEGORY_PROFILES.find((p) => p.match.test(text)) ?? {
      ...DEFAULT_PROFILE,
      match: null,
    }
  );
}

function resolveAngleKey(lead) {
  if (lead.outreachKey) return lead.outreachKey;
  const angle = String(lead.outreachAngle ?? "").toLowerCase();
  if (angle.includes("no website")) return "no_website";
  if (angle.includes("weak")) return "weak_website";
  return "conversion_improvement";
}

function buildTrustPoints(lead) {
  const points = [];
  const reviews = Number(lead.googleReviewCount) || 0;
  const rating = Number(lead.googleRating) || 0;

  if (reviews > 0 && rating > 0) {
    points.push(`${rating}-star average from ${reviews}+ Google reviews`);
  } else if (reviews > 0) {
    points.push(`${reviews}+ verified Google reviews`);
  } else if (rating > 0) {
    points.push(`${rating}-star customer rating`);
  }

  if (lead.strongProof) {
    points.push("Real project photos and branded crew/trucks on site");
  }
  if (lead.socialEvidence) {
    points.push("Active social presence and recent customer activity");
  }
  if (lead.phone) {
    points.push("Direct phone line — speak to a local team member");
  }
  if (lead.serviceBusiness) {
    points.push("Licensed, insured local service professionals");
  }

  if (points.length === 0) {
    points.push(
      "Locally owned and operated",
      "Free estimates available",
      "Serving homeowners and businesses nearby"
    );
  }

  return points.slice(0, 5);
}

function buildHeroHeadline(lead, profile, angleKey) {
  const angle = ANGLE_TEMPLATES[angleKey] ?? ANGLE_TEMPLATES.conversion_improvement;
  const city = String(lead.city ?? "").trim();
  const serviceLabel = profile.label || "Local Service";
  const cityPart = city ? ` in ${city}` : "";
  return `${lead.businessName} — ${serviceLabel}${cityPart} | ${angle.heroSuffix}`;
}

function buildOutreachNote(lead, angleKey) {
  const angle = ANGLE_TEMPLATES[angleKey] ?? ANGLE_TEMPLATES.conversion_improvement;
  const parts = [angle.outreachNote];
  if (lead.outreachPitch) parts.push(lead.outreachPitch);
  if (lead.notes) parts.push(`Notes: ${lead.notes}`);
  parts.push(`Status: ${lead.status} | Score: ${lead.score}`);
  return parts.join(" ");
}

/**
 * Build a deterministic website preview brief from lead data.
 */
export function generateBrief(lead) {
  const profile = resolveCategoryProfile(lead.category);
  const angleKey = resolveAngleKey(lead);
  const angle = ANGLE_TEMPLATES[angleKey] ?? ANGLE_TEMPLATES.conversion_improvement;

  return {
    businessName: lead.businessName,
    category: lead.category,
    city: lead.city,
    websiteAngle: lead.outreachAngle ?? angleKey,
    homepageSections: [...angle.sections],
    heroHeadline: buildHeroHeadline(lead, profile, angleKey),
    ctaText: angle.cta,
    trustPoints: buildTrustPoints(lead),
    servicesToHighlight: profile.services.slice(0, 5),
    outreachNote: buildOutreachNote(lead, angleKey),
  };
}

export function formatBrief(brief) {
  const lines = [
    "=== Website Preview Brief ===",
    "",
    `Business name: ${brief.businessName}`,
    `Category: ${brief.category}`,
    `City: ${brief.city}`,
    `Website angle: ${brief.websiteAngle}`,
    "",
    "Recommended homepage sections:",
    ...brief.homepageSections.map((s) => `  - ${s}`),
    "",
    `Hero headline: ${brief.heroHeadline}`,
    `CTA text: ${brief.ctaText}`,
    "",
    "Trust points:",
    ...brief.trustPoints.map((t) => `  - ${t}`),
    "",
    "Services to highlight:",
    ...brief.servicesToHighlight.map((s) => `  - ${s}`),
    "",
    `Outreach note: ${brief.outreachNote}`,
  ];
  return lines.join("\n");
}
