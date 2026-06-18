/** Sales execution folders — each answers why contact, what problem, what offer, what to say first. */

export const ANGLE_FOLDERS = [
  { key: "no_website", label: "No Website / Website Needed", outreachPriority: 1 },
  { key: "weak_conversion", label: "Website Exists but Weak Conversion", outreachPriority: 2 },
  { key: "google_traffic_poor_capture", label: "Google Traffic but Poor Lead Capture", outreachPriority: 2 },
  { key: "ranking_opportunity", label: "Ranking Opportunity", outreachPriority: 3 },
  { key: "menu_ordering", label: "Menu / Ordering Opportunity", outreachPriority: 2 },
  { key: "booking_appointment", label: "Booking / Appointment Opportunity", outreachPriority: 2 },
  { key: "trust_review", label: "Trust / Review Conversion Opportunity", outreachPriority: 3 },
  { key: "service_page", label: "Service Page Opportunity", outreachPriority: 3 },
  { key: "local_landing", label: "Local Landing Page Opportunity", outreachPriority: 3 },
  { key: "emergency_service", label: "Emergency Service Lead Opportunity", outreachPriority: 2 },
  { key: "seasonal_campaign", label: "Seasonal Campaign Opportunity", outreachPriority: 4 },
  { key: "outdated_design", label: "Outdated Design / Credibility Gap", outreachPriority: 3 },
  { key: "social_media_only", label: "Social Media Only / No Owned Website", outreachPriority: 2 },
  { key: "unknown", label: "Unknown / Needs Manual Review", outreachPriority: 99 },
];

export const FOLDER_BY_KEY = Object.fromEntries(ANGLE_FOLDERS.map((f) => [f.key, f]));

export const PRIORITY_LABELS = ["Hot", "Warm", "Nurture", "Manual Review"];

export const CONFIDENCE_MANUAL_REVIEW_THRESHOLD = 70;

export function folderLabel(key) {
  return FOLDER_BY_KEY[key]?.label ?? key;
}
