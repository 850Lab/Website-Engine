import {
  buildBusinessRecord,
  getQualifiedBusiness,
  upsertQualifiedBusiness,
} from "../stage1/qualified-business-store.js";
import {
  normalizePhoneNumber,
  nowIso,
} from "../stage1/shared.js";

export const TWILIO_TEST_BUSINESS_ID = "qbd_twilio_test";
export const TWILIO_TEST_PHONE = "(409) 548-6011";

export function isTwilioTestBusiness(businessId) {
  return String(businessId ?? "") === TWILIO_TEST_BUSINESS_ID;
}

export function resolveTwilioTestPhone(config = {}) {
  return (
    normalizePhoneNumber(config.testProspectPhone) ||
    normalizePhoneNumber(TWILIO_TEST_PHONE)
  );
}

export async function ensureTwilioTestBusiness(config = {}) {
  const normalizedPhone = resolveTwilioTestPhone(config);
  const existing = await getQualifiedBusiness(TWILIO_TEST_BUSINESS_ID);

  if (existing?.normalizedPhone === normalizedPhone) {
    return existing;
  }

  const phone = normalizedPhone || TWILIO_TEST_PHONE;
  const record = buildBusinessRecord({
    id: TWILIO_TEST_BUSINESS_ID,
    businessName: "Twilio Test Company",
    industry: "Test",
    category: "Test business",
    city: "Beaumont",
    state: "TX",
    address: "Test address, Beaumont, TX",
    googleMapsUrl: "",
    googleRating: 0,
    googleReviewCount: 0,
    websiteUrl: "",
    websiteStatus: "no_website",
    websiteScore: null,
    websiteScoreReasons: ["Twilio Voice test record — not a real lead"],
    phone: existing?.phone || TWILIO_TEST_PHONE,
    normalizedPhone: phone,
    email: "",
    socialUrls: [],
    contactMethodCategory: "text_first",
    qualificationStatus: "qualified",
    qualificationReason: "Manual test record for Twilio Voice V1",
    manualOverride: true,
    dateFound: existing?.dateFound || nowIso(),
    dateScored: nowIso(),
    source: "twilio_test",
    dedupKey: "test:twilio-voice-4095486011",
    outreachStatus: "not_contacted",
    outreachStatusUpdatedAt: nowIso(),
  });

  await upsertQualifiedBusiness({ ...existing, ...record });
  return getQualifiedBusiness(TWILIO_TEST_BUSINESS_ID);
}
