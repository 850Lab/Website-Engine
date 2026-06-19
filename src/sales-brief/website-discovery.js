import { cleanText } from "../stage1/shared.js";
import { fillTemplate, resolveIndustryRules } from "./industry-rules.js";

const UNIVERSAL_QUESTIONS = [
  "How are most new customers finding you today?",
  "Are you getting as many calls or inquiries from your website as you'd like?",
  "If you could improve one thing about how customers find or contact you online, what would it be?",
  "Do you feel like your website is helping grow the business or just existing online?",
  "Are there certain services you'd like more people to find you for?",
];

const FOLDER_QUESTIONS = {
  no_website: [
    "When someone searches for {industry} in {city}, how do they usually find you?",
    "Do you feel like you're missing calls from people who can't find a website for your business?",
    "What happens when a new customer tries to look you up online before they call?",
  ],
  weak_conversion: [
    "When someone lands on your website, do they usually know how to call or request service?",
    "Are you getting as many inquiries from the site as you'd expect for the work you do?",
    "What do customers say when they first contact you — do they mention finding you online?",
  ],
  google_traffic_poor_capture: [
    "Do people tell you they found you on Google before they call?",
    "Are you getting visibility on Google but not as many calls as you'd like?",
    "When someone finds you online, what usually happens next — call, form, or nothing?",
  ],
  ranking_opportunity: [
    "Are there services you'd like more people to find you for when they search online?",
    "Do customers usually find you for the jobs you most want to grow?",
    "What type of work do you wish showed up more when people search in {city}?",
  ],
  menu_ordering: [
    "How do most customers place orders today — phone, app, or walk-in?",
    "Do online customers have an easy path to see your menu and order?",
    "Are you happy with how new customers discover what you serve before they visit?",
  ],
  booking_appointment: [
    "How do most customers book or request service today?",
    "Is it easy for someone new to figure out how to schedule with you online?",
    "Do you lose people who look you up but don't know the next step to hire you?",
  ],
  trust_review: [
    "What do new customers usually ask before they trust you enough to call?",
    "Do people mention reviews or proof when they decide to contact you?",
    "When someone compares you to another {industry} in {city}, what do they need to see first?",
  ],
  service_page: [
    "Do customers usually know everything you offer before they call?",
    "Are there services you do that people don't realize you offer?",
    "What type of job do you wish more people found you for online?",
  ],
  local_landing: [
    "Are you trying to grow in {city} or in nearby areas too?",
    "Do customers in different areas find you the same way online?",
    "Which locations or service areas would you most want more calls from?",
  ],
  emergency_service: [
    "When someone has an urgent need, how do they usually reach you?",
    "Do emergency callers find you fast enough online, or do they call someone else?",
    "What happens when someone searches for help after hours?",
  ],
  seasonal_campaign: [
    "Do you get a rush of calls at certain times of year?",
    "Are you set up to capture demand when season picks up?",
    "What service do customers start looking for right before your busy season?",
  ],
  outdated_design: [
    "Do new customers mention your website when they call, or mostly referrals and Google?",
    "When someone looks you up online, does it match the quality of work you actually do?",
    "Have you ever wondered if the site is costing you calls from people who compare options?",
  ],
  social_media_only: [
    "How do customers who aren't on social media usually find you?",
    "Do you feel like you're depending on social instead of something you fully control?",
    "When someone searches Google, do they land somewhere that makes calling easy?",
  ],
  unknown: [
    "How are you getting new business today — referrals, Google, repeat customers?",
    "If you could fix one thing about how customers find or contact you online, what would it be?",
  ],
};

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

export function buildWebsiteDiscoveryQuestions(record = {}, analysis = null) {
  const stored = normalizeStored(record.discoveryQuestions);
  if (stored.length >= 3) return stored;

  const fromAnalysis = normalizeStored(analysis?.discovery_questions);
  if (fromAnalysis.length >= 3) return fromAnalysis;

  const context = {
    city: cleanText(record.city) || "your area",
    businessName: cleanText(record.businessName) || "your business",
    industry: cleanText(record.industry || record.category) || "local service",
  };

  const folder = cleanText(analysis?.folder) || "unknown";
  const rules = resolveIndustryRules(context.industry);
  const picked = [];

  for (const q of FOLDER_QUESTIONS[folder] ?? FOLDER_QUESTIONS.unknown) {
    uniquePush(picked, fillTemplate(q, context));
    if (picked.length >= 5) break;
  }

  for (const q of UNIVERSAL_QUESTIONS) {
    uniquePush(picked, fillTemplate(q, context));
    if (picked.length >= 5) break;
  }

  for (const q of rules.discoveryQuestions ?? []) {
    uniquePush(picked, fillTemplate(q, context));
    if (picked.length >= 5) break;
  }

  const count = Math.min(5, Math.max(3, picked.length));
  return picked.slice(0, count);
}
