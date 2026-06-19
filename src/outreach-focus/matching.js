import { cleanText, normalizeBusinessName } from "../stage1/shared.js";

export function normalizeMatch(value) {
  return cleanText(value).toLowerCase().replace(/\s+/g, " ").trim();
}

function leadTextBlob(lead = {}) {
  return [
    lead.industry,
    lead.category,
    lead.businessName,
    lead.address,
    lead.sourceQuery,
    lead.website,
    lead.websiteUrl,
    lead.pressureWashingAngle,
  ]
    .filter(Boolean)
    .join(" ");
}

const FENCE_INDUSTRY_PATTERNS = [
  /\bfence\b/,
  /\bfencing\b/,
  /\bgate\b/,
  /\bchain[- ]?link\b/,
  /\bwood fence\b/,
  /\bprivacy fence\b/,
  /\bfence (company|contractor|installation|repair|supply|builder)\b/,
  /\bfencing contractor\b/,
  /\bgate (installation|contractor|repair)\b/,
  /\bdeck (builder|contractor)\b/,
];

const FENCE_NAME_PATTERNS = [/\bfence\b/, /\bfencing\b/, /\bgate\b/, /\bchain[- ]?link\b/];

const RESTAURANT_INDUSTRY_PATTERNS = [
  /\brestaurant\b/,
  /\bfast food\b/,
  /\bcafes?\b/,
  /\bcafé\b/,
  /\bcoffee shop\b/,
  /\bdonut shop\b/,
  /\bbakery\b/,
  /\bdiner\b/,
  /\bgrill\b/,
  /\bbar and grill\b/,
  /\bbarbecue\b/,
  /\bbbq\b/,
  /\bpizza\b/,
  /\bburger\b/,
  /\bhamburger\b/,
  /\bbreakfast\b/,
  /\bseafood\b/,
  /\bmexican\b/,
  /\bcajun\b/,
  /\bchicken\b/,
  /\btaco\b/,
  /\bsushi\b/,
  /\bsteakhouse\b/,
  /\bbistro\b/,
  /\beatery\b/,
  /\bkitchen\b/,
  /\bfood truck\b/,
];

const RESTAURANT_NAME_PATTERNS = [
  /\brestaurant\b/,
  /\bgrill\b/,
  /\bcafes?\b/,
  /\bdiner\b/,
  /\bpizza\b/,
  /\bbbq\b/,
  /\bbarbecue\b/,
  /\btaco\b/,
  /\bseafood\b/,
  /\bkitchen\b/,
];

function focusIndustryKind(focusIndustry) {
  const b = normalizeMatch(focusIndustry);
  if (/fence|fencing/.test(b)) return "fence";
  if (/restaurant|food/.test(b)) return "restaurant";
  return "generic";
}

function matchesFenceFocus(lead) {
  const blob = normalizeMatch(leadTextBlob(lead));
  const name = normalizeMatch(lead.businessName);
  const category = normalizeMatch(lead.category || lead.industry);

  if (FENCE_INDUSTRY_PATTERNS.some((re) => re.test(category) || re.test(blob))) return true;
  if (FENCE_NAME_PATTERNS.some((re) => re.test(name))) return true;

  if (/\bconstruction\b|\bcontractor\b|\bbuilder\b/.test(category) || /\bconstruction\b/.test(blob)) {
    return FENCE_NAME_PATTERNS.some((re) => re.test(name) || re.test(blob));
  }

  if (/\bdeck\b/.test(category) || /\bdeck\b/.test(name)) {
    return /\bfence\b|\bfencing\b/.test(blob) || /\bfence\b|\bfencing\b/.test(name);
  }

  return false;
}

function matchesRestaurantFocus(lead) {
  const blob = normalizeMatch(leadTextBlob(lead));
  const category = normalizeMatch(lead.category || lead.industry);
  const name = normalizeMatch(lead.businessName);

  if (RESTAURANT_INDUSTRY_PATTERNS.some((re) => re.test(category) || re.test(blob))) return true;
  if (RESTAURANT_NAME_PATTERNS.some((re) => re.test(name))) return true;
  return false;
}

export function industryMatchesLead(lead = {}, focusIndustry = "") {
  const b = normalizeMatch(focusIndustry);
  if (!b) return true;

  const a = normalizeMatch(lead.industry || lead.category);
  if (a && (a === b || a.includes(b) || b.includes(a))) return true;

  const kind = focusIndustryKind(focusIndustry);
  if (kind === "fence") return matchesFenceFocus(lead);
  if (kind === "restaurant") return matchesRestaurantFocus(lead);

  const blob = normalizeMatch(leadTextBlob(lead));
  return blob.includes(b);
}

/** @deprecated use industryMatchesLead */
export function industryMatches(leadIndustry, focusIndustry) {
  return industryMatchesLead({ industry: leadIndustry, category: leadIndustry }, focusIndustry);
}

export function extractCityCandidates(lead = {}) {
  const candidates = [];
  const city = cleanText(lead.city);
  const address = cleanText(lead.address);
  if (city) candidates.push(city);
  if (address) {
    const parts = address.split(",").map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
      candidates.push(parts[parts.length - 2]);
      const stateZip = parts[parts.length - 1];
      const stateMatch = stateZip.match(/^([A-Z]{2})\b/);
      if (stateMatch) candidates.push(`${parts[parts.length - 2]}, ${stateMatch[1]}`);
    }
  }
  return candidates;
}

export function cityMatchesLead(lead = {}, focusCity = "", { searchCity = "" } = {}) {
  const b = normalizeMatch(focusCity);
  if (!b) return { matches: true, confidence: "explicit", reason: "no_focus_city" };

  const candidates = extractCityCandidates(lead);
  for (const candidate of candidates) {
    const a = normalizeMatch(candidate);
    if (!a) continue;
    if (a === b) return { matches: true, confidence: "explicit", reason: "city_field" };
    if (a.startsWith(`${b},`) || a.startsWith(`${b} `)) {
      return { matches: true, confidence: "explicit", reason: "city_with_state" };
    }
    if (a.includes(b)) return { matches: true, confidence: "address", reason: "address_contains_city" };
  }

  const address = normalizeMatch(lead.address);
  if (address.includes(b)) {
    return { matches: true, confidence: "address", reason: "address_contains_city" };
  }

  const search = normalizeMatch(searchCity || lead.searchCity || lead.sourceQuery);
  if (search.includes(b) && candidates.length === 0 && !address) {
    return { matches: true, confidence: "inferred_from_search", reason: "inferred_from_search" };
  }

  if (search.includes(b) && !address && cleanText(lead.businessName)) {
    return { matches: true, confidence: "inferred_from_search", reason: "inferred_from_search_no_address" };
  }

  return { matches: false, confidence: null, reason: candidates.length ? "city_mismatch" : "missing_city" };
}

/** @deprecated use cityMatchesLead */
export function cityMatches(leadCity, focusCity) {
  return cityMatchesLead({ city: leadCity }, focusCity).matches;
}

export function evaluateFocusMatch(lead = {}, focus = {}, context = {}) {
  const industryOk = industryMatchesLead(lead, focus.industry);
  const cityResult = cityMatchesLead(lead, focus.city, context);
  const matches = industryOk && cityResult.matches;

  const reasons = [];
  if (!industryOk) reasons.push("industry_mismatch");
  if (!cityResult.matches) reasons.push(cityResult.reason || "city_mismatch");

  return {
    matches,
    industryMatch: industryOk,
    cityMatch: cityResult.matches,
    cityConfidence: cityResult.confidence,
    cityReason: cityResult.reason,
    reasons,
  };
}

export function leadMatchesFocus(lead = {}, focus = {}, context = {}) {
  return evaluateFocusMatch(lead, focus, context).matches;
}

export function hasCallablePhone(lead = {}) {
  const phone = cleanText(lead.phone || lead.normalizedPhone);
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 10;
}

export function normalizeLeadCity(lead = {}, focusCity = "", context = {}) {
  const cityResult = cityMatchesLead(lead, focusCity, context);
  if (cityResult.matches && cityResult.confidence === "inferred_from_search") {
    return {
      ...lead,
      city: cleanText(focusCity) || cleanText(lead.city),
      cityConfidence: "inferred_from_search",
    };
  }
  if (cityResult.matches && focusCity && !cleanText(lead.city)) {
    return {
      ...lead,
      city: cleanText(focusCity),
      cityConfidence: cityResult.confidence || "explicit",
    };
  }
  if (cityResult.matches) {
    return { ...lead, cityConfidence: cityResult.confidence || lead.cityConfidence || null };
  }
  return lead;
}
