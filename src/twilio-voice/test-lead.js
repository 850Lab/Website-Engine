import {
  buildBusinessRecord,
  getQualifiedBusiness,
  upsertQualifiedBusiness,
} from "../stage1/qualified-business-store.js";
import {
  cleanText,
  normalizePhoneNumber,
  nowIso,
} from "../stage1/shared.js";

export const TWILIO_TEST_BUSINESS_ID = "qbd_twilio_test";
export const TWILIO_TEST_PHONE = "(409) 548-6011";

export function isTwilioTestBusiness(businessId) {
  return String(businessId ?? "") === TWILIO_TEST_BUSINESS_ID;
}

export function displayPhoneFromNormalized(e164) {
  const digits = cleanText(e164).replace(/\D/g, "");
  const ten =
    digits.length === 11 && digits.startsWith("1")
      ? digits.slice(1)
      : digits.length === 10
        ? digits
        : "";
  if (ten.length !== 10) return cleanText(e164);
  return `(${ten.slice(0, 3)}) ${ten.slice(3, 6)}-${ten.slice(6)}`;
}

export function resolveTwilioTestPhone(config = {}) {
  return (
    normalizePhoneNumber(config.testProspectPhone) ||
    normalizePhoneNumber(TWILIO_TEST_PHONE)
  );
}

export async function ensureTwilioTestBusiness(config = {}) {
  const normalizedPhone = resolveTwilioTestPhone(config);
  const displayPhone =
    displayPhoneFromNormalized(normalizedPhone) || TWILIO_TEST_PHONE;
  const existing = await getQualifiedBusiness(TWILIO_TEST_BUSINESS_ID);

  if (
    existing?.normalizedPhone === normalizedPhone &&
    existing?.phone === displayPhone
  ) {
    return existing;
  }

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
    phone: displayPhone,
    normalizedPhone,
    email: "",
    socialUrls: [],
    contactMethodCategory: "text_first",
    qualificationStatus: "qualified",
    qualificationReason: "Manual test record for Twilio Voice V1",
    manualOverride: true,
    dateFound: existing?.dateFound || nowIso(),
    dateScored: nowIso(),
    source: "twilio_test",
    dedupKey: `test:twilio-voice-${normalizedPhone.replace(/\D/g, "")}`,
    outreachStatus: existing?.outreachStatus || "not_contacted",
    outreachStatusUpdatedAt: existing?.outreachStatusUpdatedAt || nowIso(),
  });

  await upsertQualifiedBusiness({ ...existing, ...record });
  return getQualifiedBusiness(TWILIO_TEST_BUSINESS_ID);
}
