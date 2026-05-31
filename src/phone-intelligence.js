const PHONE_TYPES = ["mobile", "landline", "fixed_voip", "non_fixed_voip", "toll_free", "unknown"];
const CONSENT_STATUSES = ["unknown", "consented", "opted_out"];

function cleanText(value) {
  return String(value ?? "").trim();
}

function normalizePhoneType(value) {
  const key = cleanText(value).toLowerCase().replace(/[\s-]+/g, "_");
  const aliases = {
    fixedvoip: "fixed_voip",
    fixed_voip: "fixed_voip",
    nonfixedvoip: "non_fixed_voip",
    non_fixed_voip: "non_fixed_voip",
    nonfixed_voip: "non_fixed_voip",
    tollfree: "toll_free",
    toll_free: "toll_free",
    landline: "landline",
    mobile: "mobile",
  };
  return PHONE_TYPES.includes(aliases[key] ?? key) ? aliases[key] ?? key : "unknown";
}

function normalizeConsentStatus(value) {
  const status = cleanText(value).toLowerCase();
  return CONSENT_STATUSES.includes(status) ? status : "unknown";
}

function hasTwilioLookupConfig() {
  return Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN);
}

async function classifyWithTwilio(phone) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const url = new URL(`https://lookups.twilio.com/v2/PhoneNumbers/${encodeURIComponent(phone)}`);
  url.searchParams.set("Fields", "line_type_intelligence");
  const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
  const response = await fetch(url, {
    headers: {
      Authorization: `Basic ${auth}`,
    },
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Twilio Lookup failed (${response.status}): ${body.slice(0, 160)}`);
  }
  const payload = await response.json();
  const lineType = payload.line_type_intelligence?.type ?? payload.line_type_intelligence?.carrier_type;
  return {
    phoneType: normalizePhoneType(lineType),
    provider: "twilio_lookup",
    rawLineType: lineType ?? null,
  };
}

export async function classifyPhoneNumber(phone) {
  const normalizedPhone = cleanText(phone);
  if (!normalizedPhone) {
    return {
      phoneType: "unknown",
      provider: "none",
      status: "not_available",
      checkedAt: new Date().toISOString(),
      error: "No phone number saved.",
    };
  }
  if (!hasTwilioLookupConfig()) {
    return {
      phoneType: "unknown",
      provider: "manual_review",
      status: "credentials_missing",
      checkedAt: new Date().toISOString(),
      error: "Twilio Lookup credentials are missing; manual review required.",
    };
  }
  try {
    const result = await classifyWithTwilio(normalizedPhone);
    return {
      ...result,
      status: "classified",
      checkedAt: new Date().toISOString(),
      error: "",
    };
  } catch (err) {
    return {
      phoneType: "unknown",
      provider: "twilio_lookup",
      status: "failed",
      checkedAt: new Date().toISOString(),
      error: err.message,
    };
  }
}

export function buildContactRouting(lead, classification = {}) {
  const phoneType = normalizePhoneType(classification.phoneType ?? lead.phoneType);
  const consentStatus = normalizeConsentStatus(lead.consentStatus);
  const hasPhone = Boolean(cleanText(lead.phone));
  const hasWebsite = Boolean(cleanText(lead.websiteUrl));
  const base = {
    phoneType,
    consentStatus,
    automatedOutreachAllowed: false,
    contactAllowed: true,
    contactRisk: "medium",
    recommendedChannel: "manual_review",
    recommendedAction: "Manual review required before choosing a contact path.",
    complianceWarning: "",
    optOutLanguage:
      "If you would rather not hear from me again, reply STOP or tell me and I will not contact you again.",
  };

  if (consentStatus === "opted_out") {
    return {
      ...base,
      contactAllowed: false,
      contactRisk: "high",
      recommendedChannel: "blocked",
      recommendedAction: "Blocked: do not contact this lead.",
      complianceWarning: "This lead is opted out. Contact is not allowed.",
    };
  }

  if (!hasPhone) {
    return {
      ...base,
      contactRisk: hasWebsite ? "medium" : "high",
      recommendedChannel: hasWebsite ? "website_manual" : "manual_review",
      recommendedAction: hasWebsite
        ? "Use the website/contact form manually. No phone route is available."
        : "Manual review required because no phone or website contact path is saved.",
      complianceWarning: "No phone classification is available because no phone number is saved.",
    };
  }

  if (phoneType === "mobile") {
    return {
      ...base,
      contactRisk: consentStatus === "consented" ? "low" : "medium",
      recommendedChannel: "manual_sms",
      recommendedAction:
        "Prepare an SMS draft for manual send only. Confirm consent/context first; do not auto-send texts.",
      complianceWarning:
        consentStatus === "unknown"
          ? "Consent is unknown. Manual confirmation is required before any automated channel."
          : "",
    };
  }

  if (phoneType === "landline") {
    return {
      ...base,
      contactRisk: "low",
      recommendedChannel: "manual_call",
      recommendedAction: "Use a manual call script or voicemail script. Do not use prerecorded voice outreach.",
    };
  }

  if (phoneType === "toll_free") {
    return {
      ...base,
      contactRisk: "low",
      recommendedChannel: "business_call",
      recommendedAction: "Use a business call script. Expect a shared or front-desk number.",
    };
  }

  if (phoneType === "fixed_voip" || phoneType === "non_fixed_voip") {
    return {
      ...base,
      contactRisk: "medium",
      recommendedChannel: "manual_review",
      recommendedAction: "VOIP number detected. Manually review before calling or drafting outreach.",
      complianceWarning: "VOIP numbers can be ambiguous; verify the safest manual route first.",
    };
  }

  return {
    ...base,
    contactRisk: "medium",
    recommendedChannel: "manual_review",
    recommendedAction: "Phone type is unknown. Manually review before choosing SMS or call.",
    complianceWarning: "Phone type is unknown. Add lookup credentials or verify manually.",
  };
}
