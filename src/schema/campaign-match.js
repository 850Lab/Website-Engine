import { cleanText } from "../stage1/shared.js";

function normalizeMatch(value) {
  return cleanText(value).toLowerCase().replace(/\s+/g, " ").trim();
}

function businessTextBlob(business = {}) {
  return [
    business.name,
    business.industry,
    business.address,
    business.website,
    ...(Array.isArray(business.tags) ? business.tags : []),
    business.source?.sourceQuery,
    business.source?.legacy?.googleMapsUrl,
  ]
    .filter(Boolean)
    .join(" ");
}

function compilePatterns(patterns = []) {
  return (Array.isArray(patterns) ? patterns : [])
    .map((pattern) => cleanText(pattern))
    .filter(Boolean)
    .map((pattern) => {
      try {
        return new RegExp(pattern, "i");
      } catch {
        const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        return new RegExp(escaped, "i");
      }
    });
}

function matchesAnyPattern(text, patterns = []) {
  const blob = normalizeMatch(text);
  if (!blob) return false;
  return compilePatterns(patterns).some((re) => re.test(blob));
}

function matchesBuyerRules(business, rules = {}) {
  const blob = businessTextBlob(business);
  const name = normalizeMatch(business.name);
  const industry = normalizeMatch(business.industry);

  const exclude = rules.excludePatterns ?? [];
  if (matchesAnyPattern(blob, exclude) || matchesAnyPattern(name, exclude)) {
    return { ok: false, reason: "buyer_exclude" };
  }

  const industryPatterns = rules.industryPatterns ?? [];
  const namePatterns = rules.namePatterns ?? [];
  const buyerLabel = normalizeMatch(rules.buyerLabel ?? "");

  if (buyerLabel && (industry.includes(buyerLabel) || blob.includes(buyerLabel))) {
    return { ok: true, reason: "buyer_label" };
  }

  if (matchesAnyPattern(industry, industryPatterns) || matchesAnyPattern(blob, industryPatterns)) {
    return { ok: true, reason: "industry_pattern" };
  }

  if (matchesAnyPattern(name, namePatterns) || matchesAnyPattern(blob, namePatterns)) {
    return { ok: true, reason: "name_pattern" };
  }

  if (!industryPatterns.length && !namePatterns.length && !buyerLabel) {
    return { ok: true, reason: "no_buyer_rules" };
  }

  return { ok: false, reason: "buyer_mismatch" };
}

function extractCityCandidates(business = {}) {
  const candidates = [];
  const city = cleanText(business.city);
  const address = cleanText(business.address);
  const region = cleanText(business.region);
  if (region) candidates.push(region);
  if (city) candidates.push(city);
  if (address) {
    const parts = address.split(",").map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 2) candidates.push(parts[parts.length - 2]);
  }
  return candidates;
}

function matchesRegion(business, campaignRegion = "") {
  const target = normalizeMatch(campaignRegion);
  if (!target) return { ok: true, reason: "no_region_rule" };

  for (const candidate of extractCityCandidates(business)) {
    const value = normalizeMatch(candidate);
    if (!value) continue;
    if (value === target) return { ok: true, reason: "region_exact" };
    if (value.startsWith(`${target},`) || value.includes(target)) {
      return { ok: true, reason: "region_contains" };
    }
  }

  return { ok: false, reason: "region_mismatch" };
}

function readSignal(business, signal) {
  const signals = business.signals ?? {};
  if (signal === "buyerTag") return null;
  return signals[signal];
}

function hasBuyerTag(business, tag) {
  const tags = Array.isArray(business.tags) ? business.tags : [];
  return tags.includes(tag);
}

function evaluateRule(rule = {}, business = {}) {
  const signal = cleanText(rule.signal);
  const op = cleanText(rule.op).toLowerCase() || "eq";
  const expected = rule.value;

  if (signal === "buyerTag") {
    const hasTag = hasBuyerTag(business, rule.tag);
    if (op === "eq") return hasTag === Boolean(expected);
    if (op === "match") return hasTag;
    return hasTag;
  }

  const actual = readSignal(business, signal);
  if (op === "eq") return actual === expected;
  if (op === "neq") return actual !== expected;
  if (op === "lt") return Number(actual) < Number(expected);
  if (op === "lte") return Number(actual) <= Number(expected);
  if (op === "gt") return Number(actual) > Number(expected);
  if (op === "gte") return Number(actual) >= Number(expected);
  if (op === "match") return Boolean(actual);
  return Boolean(actual);
}

function passesQualificationRules(business, rules = []) {
  const list = Array.isArray(rules) ? rules : [];
  if (!list.length) return { ok: true, reason: "no_qualification_rules" };

  for (const rule of list) {
    if (rule.require && Array.isArray(rule.require)) {
      for (const signal of rule.require) {
        if (!readSignal(business, signal) && !hasBuyerTag(business, signal)) {
          return { ok: false, reason: `missing_${signal}` };
        }
      }
    }
    if (rule.rejectIf && Array.isArray(rule.rejectIf)) {
      for (const condition of rule.rejectIf) {
        if (evaluateRule(condition, business)) {
          return { ok: false, reason: "rejected_by_rule" };
        }
      }
    }
    if (rule.signal && !evaluateRule(rule, business)) {
      return { ok: false, reason: `failed_${rule.signal}` };
    }
  }

  return { ok: true, reason: "qualified" };
}

/**
 * Generic campaign ↔ business matcher.
 * Uses only Campaign.config rules — no product-specific branches.
 */
export function evaluateCampaignMatch(business, campaign) {
  const buyerRules = {
    ...(campaign.config?.discovery?.buyerMatchRules ?? {}),
    buyerLabel: campaign.buyer,
  };
  const buyer = matchesBuyerRules(business, buyerRules);
  const region = matchesRegion(business, campaign.region);
  const qualification = passesQualificationRules(
    business,
    campaign.config?.qualificationRules ?? [],
  );

  const matches = buyer.ok && region.ok && qualification.ok;
  const reasons = [];
  if (!buyer.ok) reasons.push(buyer.reason);
  if (!region.ok) reasons.push(region.reason);
  if (!qualification.ok) reasons.push(qualification.reason);

  return {
    matches,
    buyerMatch: buyer.ok,
    regionMatch: region.ok,
    qualificationMatch: qualification.ok,
    reasons,
    campaignId: campaign.id,
    configVersion: campaign.configVersion,
  };
}

export function listMatchingCampaigns(business, campaigns = []) {
  return campaigns.filter((campaign) => evaluateCampaignMatch(business, campaign).matches);
}
