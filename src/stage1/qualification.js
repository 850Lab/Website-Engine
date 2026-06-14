import { cleanText, isValidPhoneFormat } from "./shared.js";
import { extractEmailsFromHtml } from "./shared.js";

export function evaluateQualification({
  source = "google_maps",
  websiteStatus,
  websiteScore,
  phone = "",
  normalizedPhone = "",
  email = "",
  html = null,
  manualOverride = false,
} = {}) {
  if (manualOverride) {
    return {
      qualificationStatus: "qualified",
      qualificationReason: "Manually overridden by operator",
    };
  }

  if (!cleanText(source)) {
    return {
      qualificationStatus: "rejected",
      qualificationReason: "Discovery source is missing",
    };
  }

  const hasPhone = isValidPhoneFormat(phone) || isValidPhoneFormat(normalizedPhone);
  const resolvedEmail =
    cleanText(email) || (html ? extractEmailsFromHtml(html)[0] : "") || "";
  const hasEmail = Boolean(resolvedEmail);

  if (!hasPhone && !hasEmail) {
    return {
      qualificationStatus: "rejected",
      qualificationReason: "No phone number or email address",
    };
  }

  const noWebsite = websiteStatus === "no_website";
  const poorWebsite = websiteStatus === "poor_website";
  const goodWebsite = websiteStatus === "good_website";

  if (noWebsite) {
    return {
      qualificationStatus: "qualified",
      qualificationReason: "No website — automatic qualify",
    };
  }

  if (poorWebsite) {
    return {
      qualificationStatus: "qualified",
      qualificationReason: `Poor website (score ${websiteScore ?? "—"} below 70)`,
    };
  }

  if (goodWebsite) {
    return {
      qualificationStatus: "rejected",
      qualificationReason: `Good website (score ${websiteScore ?? "—"} at or above 70)`,
    };
  }

  return {
    qualificationStatus: "rejected",
    qualificationReason: "Website quality unknown — could not confirm poor or missing website",
  };
}
