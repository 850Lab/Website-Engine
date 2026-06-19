import { cleanText } from "../stage1/shared.js";
import { isFoodIndustry } from "./industries.js";

const UNIVERSAL_QUESTIONS = [
  "Who normally handles exterior cleaning around the property?",
  "Are there any areas outside that have become difficult to keep clean?",
  "Do customers ever mention the condition of the entrance or parking area?",
  "When was the last time the concrete or storefront exterior was professionally cleaned?",
];

const INDUSTRY_QUESTIONS = {
  restaurants: [
    "How often do you have the dumpster area cleaned?",
    "Do customers ever mention the condition of the entrance or sidewalks?",
    "Who normally handles exterior cleaning around the property?",
    "Are there any areas outside that have become difficult to keep clean?",
    "Do you currently have someone maintaining the concrete and dumpster pad?",
  ],
  "fast food": [
    "How often is the drive-thru and entrance concrete cleaned?",
    "Does grease buildup around the dumpster or back door ever become an issue?",
    "Who handles exterior cleaning for the location?",
    "Are there stains near the entrance that customers walk through?",
    "Do you have a regular schedule for the dumpster pad and sidewalks?",
  ],
  cafes: [
    "Do customers comment on the patio, entrance, or sidewalk area?",
    "Who handles exterior cleaning for outdoor seating or walkways?",
    "Are coffee stains or gum buildup showing up on the concrete out front?",
    "Is the storefront entrance cleaned as often as the inside?",
    "Are there any exterior areas that have gotten harder to keep presentable?",
  ],
  "auto repair": [
    "Do oil stains and customer traffic create ongoing cleanup issues?",
    "Are there areas outside you'd like to improve before customers arrive?",
    "Who handles cleaning the lot and bay apron areas?",
    "Do customers ever comment on the condition of the parking lot?",
    "Are there grease or fluid stains that keep coming back on the concrete?",
  ],
  "tire shops": [
    "Does rubber marking and brake dust build up on the lot over time?",
    "Are the entrance and customer waiting area outside kept as clean as you'd like?",
    "Who handles exterior cleaning around the bays and parking lot?",
    "Do customers ever mention the condition of the driveway or sidewalk?",
    "Are there oil or tire marks that are hard to remove on your own?",
  ],
  "gas stations": [
    "How often do you clean the pumps and surrounding concrete?",
    "Are there any areas with buildup that are hard to remove?",
    "Who handles cleaning the fuel island and entrance walkways?",
    "Do customers comment on stains near the pumps or storefront?",
    "Is the dumpster or back lot area cleaned on a regular schedule?",
  ],
  "strip centers": [
    "Do tenants share responsibility for shared walkways and parking areas?",
    "Are there common areas that stay dirty longer than they should?",
    "Who coordinates cleaning for the shared exterior spaces?",
    "Do customers comment on gum, stains, or grime in the parking lot?",
    "Are any storefront entrances showing wear that affects foot traffic?",
  ],
  "medical offices": [
    "Is the entrance and sidewalk kept as clean and professional as the inside?",
    "Do patients ever comment on stains or buildup outside?",
    "Who handles exterior maintenance for the building?",
    "Are walkways and parking areas cleaned before busy appointment days?",
    "Are there areas near the entrance that have become difficult to keep clean?",
  ],
  daycares: [
    "Are playground borders, sidewalks, and entry areas cleaned regularly?",
    "Do parents ever mention the condition of the exterior when they drop off?",
    "Who handles cleaning around the entrance and pickup area?",
    "Are there gum, food, or stain issues on walkways kids use every day?",
    "Is the parking lot and front curb area kept as safe and clean as you'd like?",
  ],
  churches: [
    "Are walkways and entrance steps kept clean for Sunday traffic?",
    "Who handles exterior cleaning for the building and parking areas?",
    "Do members comment on stains or buildup on sidewalks and curbs?",
    "Are there areas that get heavy foot traffic and need regular cleaning?",
    "Is the parking lot presentable before big events or services?",
  ],
  gyms: [
    "Does foot traffic and weather leave the entrance and sidewalk looking worn?",
    "Are there areas outside that members walk through before coming inside?",
    "Who handles cleaning the parking lot and storefront exterior?",
    "Do members ever mention the condition of the entrance area?",
    "Are gum, sweat, and traffic stains building up on the concrete out front?",
  ],
  laundromats: [
    "Does detergent runoff or lint buildup show up on the exterior concrete?",
    "Are the entrance and sidewalk kept as clean as customers expect?",
    "Who handles cleaning around the storefront and parking area?",
    "Do customers comment on stains near the entrance or side walkways?",
    "Are there areas that stay dirty no matter how often staff sweep?",
  ],
  "car washes": [
    "Do overspray, grime, or traffic stains build up on areas customers see first?",
    "Are the entrance, signage area, and vacuum lanes kept as clean as the wash bay?",
    "Who handles pressure washing for the lot and concrete aprons?",
    "Are there stubborn stains on the property that regular cleaning doesn't fix?",
    "Do customers comment on the condition of the driveway or waiting area?",
  ],
  warehouses: [
    "Does loading dock grime and traffic stains build up on the apron and lot?",
    "Are there exterior areas that affect how professional the facility looks?",
    "Who handles cleaning the dock, entrances, and parking areas?",
    "Do visitors or drivers comment on oil stains or buildup outside?",
    "Are there concrete areas that have become slippery or hard to maintain?",
  ],
  "industrial businesses": [
    "Does equipment traffic leave oil or chemical stains on the lot and aprons?",
    "Are entrance and visitor areas kept clean despite heavy operational use?",
    "Who handles exterior cleaning for the facility?",
    "Are there safety or appearance issues from buildup on walkways?",
    "Do customers or inspectors comment on the condition of the exterior?",
  ],
  "small retail stores": [
    "Does the entrance and sidewalk reflect the quality of what you sell inside?",
    "Do customers comment on gum, stains, or grime out front?",
    "Who handles exterior cleaning for the storefront?",
    "Are there areas near the entrance that stay dirty between regular sweepings?",
    "Would a cleaner storefront help foot traffic or first impressions?",
  ],
};

const GOLDEN_BY_INDUSTRY = {
  restaurants:
    "If you could fix one exterior area customers see first — the entrance, sidewalk, or dumpster pad — which would make the biggest difference?",
  "fast food":
    "If the drive-thru, entrance, or dumpster pad could look spotless again, which area would help the most?",
  "gas stations":
    "If you could get one area looking new again — the pumps, entrance, or back lot — which would matter most?",
  "auto repair":
    "If you could clean up one area before the next customer pulls in, which would you pick first?",
};

const DEFAULT_GOLDEN =
  "If you could improve one exterior area customers notice first, which would make the biggest difference for the business?";

function normalizeIndustry(industry) {
  return String(industry ?? "")
    .trim()
    .toLowerCase();
}

function normalizeStored(value) {
  if (!Array.isArray(value)) return [];
  return value.map((q) => cleanText(q)).filter(Boolean).slice(0, 5);
}

function uniquePush(list, question) {
  const text = cleanText(question);
  if (!text) return;
  const key = text.toLowerCase();
  if (list.some((row) => row.toLowerCase() === key)) return;
  list.push(text);
}

function resolveIndustryKey(industry) {
  const key = normalizeIndustry(industry);
  if (INDUSTRY_QUESTIONS[key]) return key;
  if (isFoodIndustry(industry)) return "restaurants";
  if (key.includes("restaurant") || key.includes("food")) return "restaurants";
  if (key.includes("gas")) return "gas stations";
  if (key.includes("auto") || key.includes("mechanic")) return "auto repair";
  if (key.includes("tire")) return "tire shops";
  if (key.includes("medical") || key.includes("dental") || key.includes("clinic")) return "medical offices";
  if (key.includes("church")) return "churches";
  if (key.includes("gym") || key.includes("fitness")) return "gyms";
  if (key.includes("warehouse")) return "warehouses";
  if (key.includes("retail") || key.includes("store")) return "small retail stores";
  return "";
}

function tailorToLead(lead, questions) {
  const tailored = [...questions];
  const industryKey = resolveIndustryKey(lead.industry);
  const needs = Array.isArray(lead.likelyNeeds) ? lead.likelyNeeds.map(cleanText).filter(Boolean) : [];
  const food = industryKey === "restaurants" || industryKey === "fast food" || industryKey === "cafes";

  if (food && needs.some((n) => /dumpster/i.test(n)) && !tailored.some((q) => /dumpster/i.test(q))) {
    uniquePush(tailored, "How often is the dumpster pad cleaned, and does grease buildup ever become a problem?");
  }
  if ((food || industryKey === "fast food") && needs.some((n) => /drive/i.test(n)) && !tailored.some((q) => /drive/i.test(q))) {
    uniquePush(tailored, "Does traffic and grease buildup around the drive-thru area ever become an issue?");
  }
  if (needs.some((n) => /entrance|curb/i.test(n)) && !tailored.some((q) => /entrance/i.test(q))) {
    uniquePush(tailored, "Do customers ever mention the condition of the entrance or sidewalks?");
  }
  return tailored;
}

export function buildPwDiscoveryQuestions(lead = {}) {
  const stored = normalizeStored(lead.discoveryQuestions);
  if (stored.length >= 3) return stored;

  const industryKey = resolveIndustryKey(lead.industry);
  const pool = INDUSTRY_QUESTIONS[industryKey] ?? UNIVERSAL_QUESTIONS;
  const picked = [];

  for (const q of pool) {
    uniquePush(picked, q);
    if (picked.length >= 5) break;
  }

  for (const q of UNIVERSAL_QUESTIONS) {
    uniquePush(picked, q);
    if (picked.length >= 5) break;
  }

  const angle = cleanText(lead.pressureWashingAngle);
  if (angle && picked.length < 5) {
    if (/dumpster/i.test(angle) && !picked.some((q) => /dumpster/i.test(q))) {
      uniquePush(picked, "Do you currently have someone maintaining the dumpster pad and back concrete?");
    }
    if (/entrance|curb/i.test(angle) && !picked.some((q) => /entrance/i.test(q))) {
      uniquePush(picked, "Is the entrance area cleaned as often as you'd like before customers walk in?");
    }
  }

  const tailored = tailorToLead(lead, picked);
  const count = Math.min(5, Math.max(3, tailored.length));
  return tailored.slice(0, count);
}

export function buildPwGoldenQuestion(lead = {}) {
  const stored = cleanText(lead.goldenQuestion);
  if (stored) return stored;

  const industryKey = resolveIndustryKey(lead.industry);
  return GOLDEN_BY_INDUSTRY[industryKey] ?? DEFAULT_GOLDEN;
}

export function buildPwOpeningLine(lead = {}) {
  const stored = cleanText(lead.openingLine);
  if (stored) return stored;

  const name = cleanText(lead.businessName) || "your location";
  const industryKey = resolveIndustryKey(lead.industry);

  if (industryKey === "restaurants" || industryKey === "fast food" || industryKey === "cafes") {
    return `Hey, this is Jaylan with Zeal Power Washing. I'm local here in Southeast Texas. I'm calling restaurants in the area because we're helping clean up dumpster pads, entrances, and concrete areas that build up grease and traffic stains. Who usually handles exterior cleaning for ${name}?`;
  }
  if (industryKey === "gas stations") {
    return `Hey, this is Jaylan with Zeal Power Washing — local in Southeast Texas. We help gas stations keep pump islands, concrete, and entrance areas looking clean. Who handles exterior cleaning at ${name}?`;
  }
  if (industryKey === "auto repair" || industryKey === "tire shops") {
    return `Hey, this is Jaylan with Zeal Power Washing. We work with auto shops around Southeast Texas on oil stains, lot cleaning, and entrance concrete. Who usually handles exterior cleaning for ${name}?`;
  }

  return `Hey, this is Jaylan with Zeal Power Washing. I'm local here in Southeast Texas and we help businesses clean entrances, parking lots, and concrete that builds up from foot traffic and weather. Who handles exterior cleaning for ${name}?`;
}
