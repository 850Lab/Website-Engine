import { scrapeGoogleMapsWithStats } from "../discover.js";
import {
  evaluateFocusMatch,
  hasCallablePhone,
  industryMatchesLead,
  cityMatchesLead,
  normalizeLeadCity,
} from "../outreach-focus/matching.js";
import {
  createDiscoveryFunnel,
  bumpRejected,
  formatFunnelReport,
  writeDiscoveryReport,
} from "./funnel.js";
import { resolveDuplicate, registerLeadInIndex } from "./dedup.js";
import { cleanText, nowIso } from "../stage1/shared.js";

export function placeToCandidate(place, target, mode) {
  const city = cleanText(target.city) || cleanText(parseCityOnly(place.city, target));
  const state = cleanText(target.state) || "TX";
  const searchCity = `${city}, ${state}`;
  const industry = cleanText(target.industry) || (mode === "website" ? "Fence Companies" : "Restaurants");

  return normalizeLeadCity(
    {
      businessName: cleanText(place.businessName),
      industry,
      category: cleanText(place.category) || cleanText(target.query),
      city,
      state,
      address: cleanText(place.address),
      phone: cleanText(place.phone),
      normalizedPhone: cleanText(place.phone),
      website: cleanText(place.websiteUrl),
      websiteUrl: cleanText(place.websiteUrl),
      googleMapsUrl: cleanText(place.googleMapsUrl),
      googleRating: Number(place.googleRating) || 0,
      reviewCount: Number(place.googleReviewCount) || 0,
      googleReviewCount: Number(place.googleReviewCount) || 0,
      source: "google_maps",
      sourceQuery: `${cleanText(target.query)} ${searchCity}`,
      searchCity,
      discoveredAt: nowIso(),
      callable: hasCallablePhone(place),
    },
    city,
    { searchCity },
  );
}

function parseCityOnly(cityField, target) {
  const raw = cleanText(cityField);
  if (!raw) return target.city;
  return raw.split(",")[0].trim();
}

export function evaluateCandidate(candidate, focus) {
  const industryOk = industryMatchesLead(candidate, focus.industry);
  const cityResult = cityMatchesLead(candidate, focus.city, { searchCity: candidate.searchCity });
  const evalResult = evaluateFocusMatch(candidate, focus, { searchCity: candidate.searchCity });
  return { industryOk, cityResult, evalResult };
}

export async function runQueryDiscovery({
  target,
  focus,
  mode,
  dedupIndex,
  storeLead,
  storeNoPhone = true,
}) {
  const state = cleanText(target.state) || "TX";
  const cityLabel = `${cleanText(target.city)}, ${state}`;
  const searchTerm = cleanText(target.query) || cleanText(target.industry);
  const maxResults = Number(target.maxResults) || 50;
  const funnel = createDiscoveryFunnel(`${searchTerm} ${cityLabel}`);

  let places = [];
  try {
    const scraped = await scrapeGoogleMapsWithStats({ searchTerm, city: cityLabel, maxResults });
    places = scraped.results;
    funnel.scrapeStats = scraped.stats;
    funnel.rawMapsResults = scraped.stats.cardsSeen || places.length;
  } catch (err) {
    funnel.error = err.message;
    return { funnel, added: [] };
  }

  funnel.parsedBusinesses = places.length;
  const added = [];

  for (const place of places) {
    if (!cleanText(place.businessName)) {
      bumpRejected(funnel, "no_business_name", { name: place.businessName });
      continue;
    }

    const candidate = placeToCandidate(place, target, mode);
    const phoneOk = hasCallablePhone(candidate);
    if (phoneOk) funnel.withPhone += 1;
    else funnel.withoutPhone += 1;

    const { industryOk, cityResult, evalResult } = evaluateCandidate(candidate, focus);
    if (industryOk) funnel.industryMatched += 1;
    else {
      bumpRejected(funnel, "industry_mismatch", {
        businessName: candidate.businessName,
        category: candidate.category,
      });
    }

    if (cityResult.matches) funnel.cityMatched += 1;
    else if (industryOk) {
      bumpRejected(funnel, "city_mismatch", {
        businessName: candidate.businessName,
        city: candidate.city,
        address: candidate.address,
      });
    }

    if (evalResult.matches) funnel.focusMatched += 1;
    if (evalResult.matches && phoneOk) funnel.callableFocusMatched += 1;

    const dup = resolveDuplicate(candidate, dedupIndex);
    if (dup.action === "skip") {
      funnel.duplicatesSkipped += 1;
      bumpRejected(funnel, "duplicate", {
        businessName: candidate.businessName,
        reason: dup.reason,
        matchedLeadId: dup.matchedLeadId,
      });
      continue;
    }

    if (!phoneOk && !storeNoPhone) {
      bumpRejected(funnel, "no_phone_not_stored", { businessName: candidate.businessName });
      continue;
    }

    try {
      const saved = await storeLead({
        candidate,
        target,
        focus,
        evalResult,
        dup,
        phoneOk,
      });

      if (saved?.record) {
        registerLeadInIndex(dedupIndex, saved.record);
        funnel.newLeadsAdded += 1;
        if (dup.action === "add_possible_duplicate") funnel.possibleDuplicatesAdded += 1;
        if (!phoneOk) funnel.storedNoPhone += 1;

        const savedEval = evaluateFocusMatch(saved.record, focus, { searchCity: candidate.searchCity });
        if (savedEval.matches) {
          funnel.newFocusedLeadsAdded += 1;
          if (funnel.samples.added.length < 15) {
            funnel.samples.added.push({
              businessName: saved.record.businessName,
              city: saved.record.city,
              callable: phoneOk,
            });
          }
        } else {
          bumpRejected(funnel, "outside_focus_after_ingest", {
            businessName: saved.record.businessName,
          });
        }
        added.push(saved.record);
      }
    } catch (err) {
      bumpRejected(funnel, "ingest_error", {
        businessName: candidate.businessName,
        error: err.message,
      });
    }
  }

  console.log("\n" + formatFunnelReport(funnel));
  return { funnel, added };
}

export async function finalizeDiscoveryReport(mode, focus, funnels, inventoryAfter) {
  const report = {
    mode,
    focus,
    queries: funnels,
    summary: funnels.reduce(
      (acc, f) => {
        acc.rawMapsResults += f.rawMapsResults || 0;
        acc.parsedBusinesses += f.parsedBusinesses || 0;
        acc.withPhone += f.withPhone || 0;
        acc.withoutPhone += f.withoutPhone || 0;
        acc.focusMatched += f.focusMatched || 0;
        acc.newLeadsAdded += f.newLeadsAdded || 0;
        acc.newFocusedLeadsAdded += f.newFocusedLeadsAdded || 0;
        acc.duplicatesSkipped += f.duplicatesSkipped || 0;
        return acc;
      },
      {
        rawMapsResults: 0,
        parsedBusinesses: 0,
        withPhone: 0,
        withoutPhone: 0,
        focusMatched: 0,
        newLeadsAdded: 0,
        newFocusedLeadsAdded: 0,
        duplicatesSkipped: 0,
      },
    ),
    inventoryAfter,
  };

  const path = await writeDiscoveryReport(mode, report);
  console.log(`\nDiscovery report written: ${path}`);
  return report;
}

export function filterTargetsForFocus(targets, focus) {
  return targets.filter(
    (target) => cleanText(target.city).toLowerCase() === cleanText(focus.city).toLowerCase(),
  );
}
