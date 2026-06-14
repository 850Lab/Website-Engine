export const SOUTHEAST_TEXAS_CITIES = [
  "Beaumont",
  "Port Arthur",
  "Nederland",
  "Port Neches",
  "Groves",
  "Bridge City",
  "Orange",
  "Vidor",
  "Lumberton",
  "Silsbee",
  "Kountze",
  "Sour Lake",
  "Jasper",
  "Kirbyville",
  "Woodville",
];

export const DEFAULT_INDUSTRIES = [
  "Pressure Washing",
  "Roofing",
  "HVAC",
  "Plumbing",
  "Electrical",
  "Landscaping",
  "Tree Service",
  "Concrete",
  "Fencing",
  "Pool Service",
];

export const REGION_PRESETS = {
  "southeast-texas": {
    id: "southeast-texas",
    name: "Southeast Texas",
    state: "TX",
    cities: SOUTHEAST_TEXAS_CITIES,
    industries: DEFAULT_INDUSTRIES,
    description: "Golden Triangle and surrounding Southeast Texas service markets.",
  },
};

export function getRegionPreset(regionId = "southeast-texas") {
  return REGION_PRESETS[regionId] ?? null;
}

export function listRegionPresets() {
  return Object.values(REGION_PRESETS);
}

export function normalizeCampaignSelection({ regionId, cities, industries }) {
  const preset = getRegionPreset(regionId) ?? getRegionPreset("southeast-texas");
  const selectedCities = Array.isArray(cities) && cities.length
    ? cities.map((city) => String(city).trim()).filter(Boolean)
    : preset.cities;
  const selectedIndustries = Array.isArray(industries) && industries.length
    ? industries.map((industry) => String(industry).trim()).filter(Boolean)
    : preset.industries;

  return {
    regionId: preset.id,
    regionName: preset.name,
    state: preset.state,
    cities: selectedCities,
    industries: selectedIndustries,
  };
}

export function buildCampaignPairs(cities, industries) {
  const pairs = [];
  for (const city of cities) {
    for (const industry of industries) {
      pairs.push({ city, industry });
    }
  }
  return pairs;
}
