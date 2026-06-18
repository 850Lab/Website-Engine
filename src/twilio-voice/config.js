import { cleanText } from "../stage1/shared.js";

export function getTwilioVoiceConfig() {
  return {
    accountSid: cleanText(process.env.TWILIO_ACCOUNT_SID),
    authToken: cleanText(process.env.TWILIO_AUTH_TOKEN),
    fromNumber: cleanText(process.env.TWILIO_FROM_NUMBER),
    founderPhone: cleanText(process.env.FOUNDER_PHONE),
    publicBaseUrl: cleanText(process.env.PUBLIC_BASE_URL),
  };
}

export function assertTwilioVoiceConfigured() {
  const config = getTwilioVoiceConfig();
  const missing = [];
  if (!config.accountSid) missing.push("TWILIO_ACCOUNT_SID");
  if (!config.authToken) missing.push("TWILIO_AUTH_TOKEN");
  if (!config.fromNumber) missing.push("TWILIO_FROM_NUMBER");
  if (!config.founderPhone) missing.push("FOUNDER_PHONE");
  if (!config.publicBaseUrl) missing.push("PUBLIC_BASE_URL");
  if (missing.length) {
    throw new Error(`Twilio Voice is not configured. Missing: ${missing.join(", ")}`);
  }
  return config;
}

export function resolvePublicBaseUrl(req) {
  const configured = cleanText(process.env.PUBLIC_BASE_URL);
  if (configured) return configured.replace(/\/$/, "");
  const forwardedProto = String(req.get("x-forwarded-proto") || "").split(",")[0].trim();
  const protocol = forwardedProto || req.protocol || "http";
  const host = req.get("host") || "localhost:8787";
  return `${protocol}://${host}`.replace(/\/$/, "");
}
