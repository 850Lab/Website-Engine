import { listQualifiedBusinesses } from "../../stage1/qualified-business-store.js";
import { cleanText } from "../../stage1/shared.js";
import { SOUTHEAST_TEXAS_CITIES, DEFAULT_INDUSTRIES } from "../region-presets.js";

function groupStats(records, field) {
  const map = {};
  for (const record of records) {
    const key = cleanText(record[field]) || "Unknown";
    if (!map[key]) {
      map[key] = { found: 0, qualified: 0 };
    }
    map[key].found += 1;
    if (record.qualificationStatus === "qualified") {
      map[key].qualified += 1;
    }
  }

  return Object.entries(map)
    .map(([name, stats]) => ({
      name,
      found: stats.found,
      qualified: stats.qualified,
      qualificationRate: stats.found
        ? Math.round((stats.qualified / stats.found) * 1000) / 10
        : 0,
    }))
    .sort((a, b) => b.qualified - a.qualified || b.found - a.found);
}

export async function buildCoverageAnalysisReport() {
  const records = await listQualifiedBusinesses();
  const byCity = groupStats(records, "city");
  const byIndustry = groupStats(records, "industry");

  const citiesCovered = new Set(records.map((r) => cleanText(r.city)).filter(Boolean));
  const industriesCovered = new Set(records.map((r) => cleanText(r.industry)).filter(Boolean));

  const missingCities = SOUTHEAST_TEXAS_CITIES.filter(
    (city) => !citiesCovered.has(city),
  );
  const missingIndustries = DEFAULT_INDUSTRIES.filter(
    (industry) => !industriesCovered.has(industry),
  );

  const topCitiesByQualified = [...byCity].sort((a, b) => b.qualified - a.qualified).slice(0, 10);
  const topIndustriesByQualified = [...byIndustry].sort((a, b) => b.qualified - a.qualified).slice(0, 10);
  const topCitiesByDensity = [...byCity]
    .filter((row) => row.found >= 5)
    .sort((a, b) => b.qualificationRate - a.qualificationRate)
    .slice(0, 10);
  const topIndustriesByDensity = [...byIndustry]
    .filter((row) => row.found >= 5)
    .sort((a, b) => b.qualificationRate - a.qualificationRate)
    .slice(0, 10);

  return {
    businessesFoundByCity: byCity,
    qualifiedByCity: byCity.map(({ name, qualified, qualificationRate }) => ({
      name,
      qualified,
      qualificationRate,
    })),
    businessesFoundByIndustry: byIndustry,
    qualifiedByIndustry: byIndustry.map(({ name, qualified, qualificationRate }) => ({
      name,
      qualified,
      qualificationRate,
    })),
    qualificationRateByCity: byCity.map(({ name, qualificationRate, found, qualified }) => ({
      name,
      qualificationRate,
      found,
      qualified,
    })),
    qualificationRateByIndustry: byIndustry.map(({ name, qualificationRate, found, qualified }) => ({
      name,
      qualificationRate,
      found,
      qualified,
    })),
    highestDensityMarkets: {
      cities: topCitiesByDensity,
      industries: topIndustriesByDensity,
    },
    topCitiesByQualified,
    topIndustriesByQualified,
    coverage: {
      citiesCovered: citiesCovered.size,
      citiesTarget: SOUTHEAST_TEXAS_CITIES.length,
      industriesCovered: industriesCovered.size,
      industriesTarget: DEFAULT_INDUSTRIES.length,
      missingCities,
      missingIndustries,
    },
  };
}
