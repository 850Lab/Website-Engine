import {
  DEFAULT_FOLLOW_UP_OBJECTIVE,
  DEFAULT_SUGGESTED_OFFER,
  DEFAULT_SUGGESTED_OFFER_ALT,
  EMERGENCY_QUESTION,
  FIRST_DEFLECTION_RESPONSES,
  OPENING_LINES,
} from "./outreach-copy.js";

const VISUAL_INDUSTRIES = new Set([
  "Tree Service",
  "Landscaping",
  "Fencing",
  "Concrete",
  "Pressure Washing",
  "Pool Service",
  "Roofing",
]);

const DEFAULT_RULES = {
  decisionMaker: "Owner or Office Manager",
  businessGrowthAngle:
    "Lead with how they get customers today — referrals, relationships, search, repeat work — not with a website pitch.",
  suggestedOffer: DEFAULT_SUGGESTED_OFFER,
  suggestedOfferAlt: DEFAULT_SUGGESTED_OFFER_ALT,
  discoveryQuestions: [
    "Do most customers find you through Google, referrals, or repeat relationships?",
    "What type of jobs are most profitable for you right now?",
    "Are you trying to grow residential, commercial, or both?",
    "If someone found you online for the first time, what would you want them to trust immediately?",
    "What makes customers choose you instead of another local option?",
  ],
  goldenQuestion:
    "If a new customer compared you to two competitors tonight, what would make them trust you first?",
  followUpObjective: DEFAULT_FOLLOW_UP_OBJECTIVE,
};

export const INDUSTRY_RULES = {
  Roofing: {
    decisionMaker: "Owner or Project Manager",
    businessGrowthAngle:
      "Roofing wins on storm urgency and referrals — discover whether they want more estimate calls, storm work, or maintenance before mentioning any site work.",
    suggestedOffer:
      "When it makes sense, help them show service area, storm/inspection path, and proof so Google and referral shoppers trust them before the first call.",
    discoveryQuestions: [
      "Do most estimate calls come from storms, referrals, or Google searches?",
      "Which roofing jobs are most profitable for you right now?",
      "Are you trying to grow residential, commercial, or insurance work?",
      "If a homeowner compared you to two roofers tonight, what would make them trust you first?",
      "What type of roofing work do you wish you had more of this season?",
    ],
    goldenQuestion:
      "If a homeowner in {city} compared you to two roofing companies tonight, what would make them choose you first?",
    followUpObjective: "Confirm who handles estimates and book a follow-up after learning their lead sources.",
  },
  HVAC: {
    decisionMaker: "Owner or Service Manager",
    businessGrowthAngle:
      "HVAC is urgency-driven — learn how emergency vs maintenance vs replacement jobs come in before proposing any online fix.",
    suggestedOffer:
      "When relevant, clarify emergency service, maintenance plans, and trust signals for the jobs they actually want more of.",
    discoveryQuestions: [
      "How many calls are true emergencies vs maintenance or replacement jobs?",
      "Do customers usually find you through Google Maps, referrals, or repeat service?",
      "What service do you wish more homeowners booked before peak season?",
      "If someone's AC failed tonight, what would make them call you instead of the next company?",
      "Are you trying to grow residential, commercial, or both?",
    ],
    goldenQuestion:
      "When someone's AC fails on a hot day in {city}, what would make them call you instead of the next company?",
    followUpObjective: "Identify who approves growth decisions and schedule a short follow-up call.",
  },
  Plumbing: {
    decisionMaker: "Owner or Dispatch Lead",
    businessGrowthAngle:
      "Plumbing buyers call under pressure — discover which jobs they want more of and how those customers find them today.",
    suggestedOffer:
      "When it fits, make service clarity and the call path obvious for the job types they want to grow.",
    discoveryQuestions: [
      "Which jobs do you most want more of — emergency, repipe, water heater, or commercial?",
      "Do most customers come from referrals, Google, or repeat relationships?",
      "What do customers ask before they trust a plumber they found online?",
      "If a homeowner had a leak tonight, what would make them call you first?",
      "What type of work has the best margin for your crew right now?",
    ],
    goldenQuestion:
      "If a homeowner had a leak tonight, what would make them call you first instead of another plumber in {city}?",
    followUpObjective: "Confirm best number/time for follow-up and who handles new customer inquiries.",
  },
  Electrical: {
    decisionMaker: "Owner or Operations Manager",
    businessGrowthAngle:
      "Electrical buyers need confidence — learn whether they grow through plants, contractors, residential, or referrals before assuming the website is the issue.",
    suggestedOffer:
      "When relevant, help the right type of customer understand services, trust, and how to take the next step — not a generic redesign.",
    discoveryQuestions: [
      "Are you trying to grow residential, commercial, industrial, or all of them?",
      "What types of electrical jobs are most profitable for you?",
      "Do customers usually find you through Google, referrals, or existing relationships?",
      "How are you getting new business today?",
      "If someone found your business online for the first time, what would you want them to trust immediately?",
    ],
    goldenQuestion:
      "If a property owner in {city} compared you to two electrical contractors tonight, what would make them trust you first?",
    followUpObjective: "Identify who handles growth decisions and book a callback if the decision maker was unavailable.",
  },
  "Pool Service": {
    decisionMaker: "Owner or Service Coordinator",
    businessGrowthAngle:
      "Pool companies win on reliability and seasonality — discover maintenance vs repair vs remodel demand before pitching anything online.",
    suggestedOffer:
      "When it fits, make maintenance, repair, and local proof easy to understand for the customers they want more of.",
    discoveryQuestions: [
      "Do you want more maintenance accounts, repairs, or remodel/leak work?",
      "How do customers usually find you before pool season starts?",
      "What question do homeowners ask before choosing a pool company?",
      "Do most customers come from referrals, Google, or repeat relationships?",
      "What type of pool work is most profitable for you?",
    ],
    goldenQuestion:
      "When a pool owner in {city} compared two service companies online, what would make them choose you?",
    followUpObjective: "Learn who handles new service requests and schedule a follow-up.",
  },
  "Tree Service": {
    decisionMaker: "Owner or Crew Lead",
    businessGrowthAngle:
      "Tree service is visual and urgent — learn whether storm, removal, or maintenance drives revenue before discussing proof or contact paths.",
    suggestedOffer:
      "When relevant, show capability, safety, and fast contact for the job types they want to grow.",
    discoveryQuestions: [
      "Do most jobs come from storm damage, lot clearing, or maintenance trimming?",
      "Do customers ask for photos or proof before they book?",
      "Which jobs do you want more of this season?",
      "Do most customers find you through Google, referrals, or repeat relationships?",
      "What makes customers choose your crew over another tree service in {city}?",
    ],
    goldenQuestion:
      "If a homeowner needed a tree removed this week, what would make them trust you enough to call?",
    followUpObjective: "Confirm who gives estimates and book a short follow-up.",
  },
  Landscaping: {
    decisionMaker: "Owner or Account Manager",
    businessGrowthAngle:
      "Landscaping sales depend on visual proof and local trust — discover residential vs commercial focus and how quotes are won today.",
    suggestedOffer:
      "When it fits, help prospects see results and understand how to request the work they want to grow.",
    discoveryQuestions: [
      "Are you focused on residential maintenance, installs, or commercial accounts?",
      "Do prospects usually ask for photos before requesting a quote?",
      "What service has the best margin that you want to grow?",
      "Do most customers find you through referrals, Google, or repeat relationships?",
      "If someone found you online for the first time, what would you want them to trust immediately?",
    ],
    goldenQuestion:
      "What would make a homeowner in {city} choose your crew over the next landscaper they find?",
    followUpObjective: "Book a follow-up to learn lead sources and who approves marketing changes.",
  },
  Fencing: {
    decisionMaker: "Owner or Estimator",
    businessGrowthAngle:
      "Fence buyers compare price and proof quickly — learn how estimates are won before suggesting any online improvement.",
    suggestedOffer:
      "When relevant, show project examples and make the estimate path obvious for the fence types they want to sell.",
    discoveryQuestions: [
      "Which fence types drive most of your revenue?",
      "Do customers usually call after seeing photos or just price shopping?",
      "What objections come up most on first contact?",
      "Do most customers find you through Google, referrals, or contractor relationships?",
      "What makes customers choose you instead of another fence company in {city}?",
    ],
    goldenQuestion:
      "When someone in {city} requests three fence quotes, what helps them pick the company they trust?",
    followUpObjective: "Confirm who handles estimate scheduling and book a follow-up.",
  },
  Concrete: {
    decisionMaker: "Owner or Project Estimator",
    businessGrowthAngle:
      "Concrete buyers want proof and scheduling confidence — discover which job types they want more of before mentioning the website.",
    suggestedOffer:
      "When it fits, show finished work and scope clearly for the jobs they want to grow.",
    discoveryQuestions: [
      "Are you trying to grow driveways, slabs, commercial, or decorative work?",
      "Do customers ask for photos of past jobs before booking?",
      "What job size is the sweet spot for your crew right now?",
      "How are you getting new business today?",
      "What would make a property owner trust you with a concrete job in {city}?",
    ],
    goldenQuestion:
      "What would your business need to show for a property owner to trust you with a concrete job in {city}?",
    followUpObjective: "Identify who approves growth decisions and schedule a callback.",
  },
  "Pressure Washing": {
    decisionMaker: "Owner",
    businessGrowthAngle:
      "Pressure washing is comparison-driven — learn residential vs commercial mix and how customers find them before pitching proof or booking paths.",
    suggestedOffer:
      "When relevant, use before/after proof and a fast quote path for the services they want to grow.",
    discoveryQuestions: [
      "Do you want more residential, commercial, or fleet work?",
      "What service packages do customers ask about most?",
      "How do people usually find you — Google, door hangers, or referrals?",
      "What type of jobs are most profitable for you?",
      "If someone compared three pressure washing companies tonight, what would make them pick you?",
    ],
    goldenQuestion:
      "If a property owner in {city} compared three pressure washing companies tonight, what would make them pick you?",
    followUpObjective: "Learn who handles quote requests and book a follow-up.",
  },
  "Public Relations": {
    decisionMaker: "Founder or Brand Director",
    businessGrowthAngle:
      "PR buyers need clarity before visibility — discover how leads arrive and where prospects hesitate before any site conversation.",
    suggestedOffer:
      "When it fits, make positioning, narrative, and proof of authority obvious before content or ad spend.",
    discoveryQuestions: [
      "Are leads coming from referrals, content, or direct search today?",
      "Where does your message feel clear — and where do prospects still hesitate?",
      "What offer do you most want more qualified conversations for?",
      "How are you getting new business today?",
      "If a founder compared your brand to two competitors tonight, what would make them trust you first?",
    ],
    goldenQuestion:
      "If a founder in {city} compared your brand to two competitors tonight, what would make them trust you first?",
    followUpObjective: "Book a strategy conversation and confirm who owns brand decisions.",
  },
};

export function resolveIndustryRules(industry) {
  const key = String(industry ?? "").trim();
  return { ...DEFAULT_RULES, ...(INDUSTRY_RULES[key] ?? {}) };
}

export function fillTemplate(text, context) {
  return String(text ?? "")
    .replace(/\{city\}/g, context.city || "your area")
    .replace(/\{businessName\}/g, context.businessName || "your business")
    .replace(/\{industry\}/g, context.industry || "local service");
}

export function buildOpeningLine(_business, _rules, _context) {
  return OPENING_LINES.preferred;
}

/** @deprecated use buildOpeningLine */
export function buildColdCallOpeningLine(business, rules, context) {
  return buildOpeningLine(business, rules, context);
}

export function classifyLead(business, screenshots) {
  const captured = screenshots ?? business.screenshotsCaptured ?? {};
  const website = String(business.website ?? business.websiteUrl ?? "").trim();
  const industry = String(business.industry ?? "").trim();

  if (!website || website === "[EXISTS]") {
    return {
      grade: "A",
      label: "A Lead",
      reason:
        "No usable website on file — when prospects look you up, there may be no place to build trust or capture interest.",
      recommendedProblem: "Discoverability and first-impression trust — not a forced full rebuild pitch.",
    };
  }

  if (!captured.home) {
    return {
      grade: "A",
      label: "A Lead",
      reason:
        "Website exists but homepage could not be captured — site may be down, outdated, or hard to evaluate on mobile.",
      recommendedProblem: "Clarify whether the site is hurting trust when someone does look them up.",
    };
  }

  const missing = [];
  if (!captured.about) missing.push("about/trust page");
  if (!captured.services) missing.push("services page");
  if (!captured.contact) missing.push("contact path");
  if (VISUAL_INDUSTRIES.has(industry) && !captured.gallery) {
    missing.push("project/gallery proof");
  }

  if (missing.length >= 3) {
    return {
      grade: "A",
      label: "A Lead",
      reason: `Visible gaps: ${missing.join(", ")}. Incomplete or unclear online presence.`,
      recommendedProblem:
        "Sell the right gap — trust, service clarity, contact path — not a generic redesign.",
      gaps: missing,
    };
  }

  if (missing.length >= 1) {
    return {
      grade: "B",
      label: "B Lead",
      reason: `Website exists with some structure, but possible gaps: ${missing.join(", ")}.`,
      recommendedProblem:
        "Look for conversion, trust path, or contact friction — not a full redesign by default.",
      gaps: missing,
    };
  }

  return {
    grade: "C",
    label: "C Lead",
    reason:
      "Strong website structure with core pages reachable. Low priority unless discovery reveals a conversion or trust gap.",
    recommendedProblem:
      "Skip or deprioritize unless the call reveals analytics, funnel, or trust-path opportunity.",
  };
}

export function buildVisibleWebsiteGap(business, screenshots) {
  const captured = screenshots ?? business.screenshotsCaptured ?? {};
  const classification = classifyLead(business, captured);
  const lines = [classification.reason, `Recommended focus: ${classification.recommendedProblem}`];

  if (classification.gaps?.length) {
    lines.push(`Missing or weak: ${classification.gaps.join(", ")}.`);
  }

  if (captured.services && !captured.contact) {
    lines.push("Services may be visible, but the contact path may not be obvious enough for mobile callers.");
  }

  if (captured.gallery && !captured.about) {
    lines.push("Visual proof exists, but the trust story may be weaker than the project photos.");
  }

  return lines.join(" ");
}

/** @deprecated use buildVisibleWebsiteGap */
export function buildObservation(business, screenshots) {
  return buildVisibleWebsiteGap(business, screenshots);
}

export function buildSalesBriefMarkdown(business, options = {}) {
  const rules = resolveIndustryRules(business.industry);
  const context = {
    city: business.city || "",
    businessName: business.businessName || "",
    industry: business.industry || "",
  };

  const visibleGap = options.observation ?? buildVisibleWebsiteGap(business, business.screenshotsCaptured);
  const classification = classifyLead(business, business.screenshotsCaptured);
  const discoveryQuestions = rules.discoveryQuestions
    .slice(0, 5)
    .map((q) => fillTemplate(q, context));
  const goldenQuestion = fillTemplate(rules.goldenQuestion, context);
  const openingLine = buildOpeningLine(business, rules, context);
  const suggestedOffer = business.offerUrl
    ? `${rules.suggestedOffer} Offer link: ${business.offerUrl}`
    : rules.suggestedOffer;
  const deflectionResponse = FIRST_DEFLECTION_RESPONSES[0];

  const screenshotList = Object.entries(business.screenshotsCaptured ?? {})
    .filter(([, captured]) => captured)
    .map(([page]) => page)
    .join(", ");

  return `# Sales Brief: ${business.businessName}

## Business Name
${business.businessName || "—"}

## Industry
${business.industry || "—"}

## City
${business.city || "—"}

## Phone Number
${business.phone || "—"}

## Website
${business.website || "—"}

## Suggested Decision Maker
${rules.decisionMaker}

## Visible Website Gap
${visibleGap}

## Business Growth Angle
${fillTemplate(rules.businessGrowthAngle, context)}

## Opening Line
${openingLine}

**Owner-direct:** ${OPENING_LINES.ownerDirect}

**Receptionist:** ${OPENING_LINES.receptionist}

## First Deflection Response
${deflectionResponse}

**Alternate:** ${FIRST_DEFLECTION_RESPONSES[1]}

## Emergency Question
${EMERGENCY_QUESTION}

## Discovery Questions
${discoveryQuestions.map((q, i) => `${i + 1}. ${q}`).join("\n")}

## Golden Question
${goldenQuestion}

## Suggested Offer
${suggestedOffer}

**Alternate framing:** ${rules.suggestedOfferAlt || DEFAULT_SUGGESTED_OFFER_ALT}

## Follow-Up Objective
${rules.followUpObjective}

## Lead Classification
**${classification.label}** (${classification.grade})

${classification.reason}

## Outreach Status
${business.outreachStatus || "not_contacted"}

## Preview Link
${business.previewUrl || "—"}

## Screenshots Available
${screenshotList || "None captured"}

## Quick Actions
- Call: ${business.actions?.call || "—"}
- Text: ${business.actions?.text ? "See contact-card.txt" : "—"}
- Preview: ${business.previewUrl || "—"}
- Offer: ${business.offerUrl || "—"}
`;
}

export { OPENING_LINES, FIRST_DEFLECTION_RESPONSES, EMERGENCY_QUESTION };
