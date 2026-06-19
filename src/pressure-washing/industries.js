export const PW_TARGET_CITIES = [
  "Beaumont",
  "Port Arthur",
  "Nederland",
  "Port Neches",
  "Groves",
  "Orange",
  "Bridge City",
  "Vidor",
  "Lumberton",
  "Silsbee",
  "Sour Lake",
];

export const PW_INDUSTRIES = [
  "Restaurants",
  "Fast food",
  "Cafes",
  "Auto repair",
  "Tire shops",
  "Gas stations",
  "Strip centers",
  "Medical offices",
  "Daycares",
  "Churches",
  "Gyms",
  "Laundromats",
  "Car washes",
  "Warehouses",
  "Industrial businesses",
  "Small retail stores",
];

const FOOD_INDUSTRY = new Set(["restaurants", "fast food", "cafes"]);

export function isFoodIndustry(industry) {
  return FOOD_INDUSTRY.has(String(industry ?? "").trim().toLowerCase());
}

export function isTargetCity(city) {
  const needle = String(city ?? "").trim().toLowerCase();
  return PW_TARGET_CITIES.some((c) => c.toLowerCase() === needle);
}
