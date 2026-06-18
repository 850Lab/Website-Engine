import { cleanText } from "../stage1/shared.js";
import { persistenceBackendLabel } from "../persistence/json-document-store.js";
import {
  readTwilioVoiceSettingsRecord,
  saveTwilioVoiceSettingsRecord,
  twilioConfigSources,
} from "./settings-store.js";

function fromEnv() {
  return {
    accountSid: cleanText(process.env.TWILIO_ACCOUNT_SID),
    authToken: cleanText(process.env.TWILIO_AUTH_TOKEN),
    fromNumber: cleanText(process.env.TWILIO_FROM_NUMBER),
    founderPhone: cleanText(process.env.FOUNDER_PHONE),
    publicBaseUrl: cleanText(process.env.PUBLIC_BASE_URL),
  };
}

export function resolvePublicBaseUrl(req) {
  const configured = cleanText(process.env.PUBLIC_BASE_URL);
  if (configured) return configured.replace(/\/$/, "");
  const forwardedProto = String(req.get("x-forwarded-proto") || "").split(",")[0].trim();
  const protocol = forwardedProto || req.protocol || "http";
  const host = req.get("host") || "localhost:8787";
  return `${protocol}://${host}`.replace(/\/$/, "");
}

function mergeConfig(envConfig, blobConfig, req) {
  const merged = {
    accountSid: envConfig.accountSid || cleanText(blobConfig?.accountSid),
    authToken: envConfig.authToken || cleanText(blobConfig?.authToken),
    fromNumber: envConfig.fromNumber || cleanText(blobConfig?.fromNumber),
    founderPhone: envConfig.founderPhone || cleanText(blobConfig?.founderPhone),
    publicBaseUrl:
      envConfig.publicBaseUrl ||
      cleanText(blobConfig?.publicBaseUrl) ||
      (req ? resolvePublicBaseUrl(req) : ""),
  };
  merged.publicBaseUrl = merged.publicBaseUrl.replace(/\/$/, "");
  return merged;
}

export async function getTwilioVoiceConfig(req = null) {
  const blob = await readTwilioVoiceSettingsRecord();
  return mergeConfig(fromEnv(), blob, req);
}

export function listMissingTwilioFields(config) {
  const missing = [];
  if (!config.accountSid) missing.push("TWILIO_ACCOUNT_SID");
  if (!config.authToken) missing.push("TWILIO_AUTH_TOKEN");
  if (!config.fromNumber) missing.push("TWILIO_FROM_NUMBER");
  if (!config.founderPhone) missing.push("FOUNDER_PHONE");
  if (!config.publicBaseUrl) missing.push("PUBLIC_BASE_URL");
  return missing;
}

export async function assertTwilioVoiceConfigured(req = null) {
  const config = await getTwilioVoiceConfig(req);
  const missing = listMissingTwilioFields(config);
  if (missing.length) {
    throw new Error(
      `Twilio Voice is not configured. Missing: ${missing.join(", ")}. Add in Vercel env or Settings → Twilio Voice.`,
    );
  }
  return config;
}

export async function buildTwilioVoiceStatus(req = null) {
  const envConfig = fromEnv();
  const blob = await readTwilioVoiceSettingsRecord();
  const merged = mergeConfig(envConfig, blob, req);
  const missing = listMissingTwilioFields(merged);

  return {
    configured: missing.length === 0,
    missing,
    sources: twilioConfigSources(envConfig, blob),
    storage: persistenceBackendLabel(),
    accountSid: merged.accountSid || "",
    fromNumber: merged.fromNumber || "",
    founderPhone: merged.founderPhone || "",
    publicBaseUrl: merged.publicBaseUrl || "",
    hasAuthToken: Boolean(merged.authToken),
    updatedAt: blob?.updatedAt ?? null,
  };
}

export async function updateTwilioVoiceSettings(input) {
  const current = await readTwilioVoiceSettingsRecord();
  const envConfig = fromEnv();
  const accountSidInput = cleanText(input.accountSid);
  const authTokenInput = cleanText(input.authToken);
  const next = {
    accountSid:
      accountSidInput || current?.accountSid || envConfig.accountSid,
    authToken:
      authTokenInput || current?.authToken || envConfig.authToken,
    fromNumber:
      cleanText(input.fromNumber) || current?.fromNumber || envConfig.fromNumber,
    founderPhone:
      cleanText(input.founderPhone) || current?.founderPhone || envConfig.founderPhone,
    publicBaseUrl:
      cleanText(input.publicBaseUrl) ||
      current?.publicBaseUrl ||
      envConfig.publicBaseUrl,
  };

  if (!next.accountSid) throw new Error("TWILIO_ACCOUNT_SID is required.");
  if (!next.authToken) throw new Error("TWILIO_AUTH_TOKEN is required.");
  if (!next.fromNumber) throw new Error("TWILIO_FROM_NUMBER is required.");
  if (!next.founderPhone) throw new Error("FOUNDER_PHONE is required.");

  await saveTwilioVoiceSettingsRecord(next);
  return buildTwilioVoiceStatus();
}
