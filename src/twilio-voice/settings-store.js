import { join } from "node:path";
import { DATA_DIR } from "../storage.js";
import { readJsonDocument, writeJsonDocument } from "../persistence/json-document-store.js";
import { cleanText, nowIso } from "../stage1/shared.js";

export const TWILIO_VOICE_SETTINGS_FILE = join(DATA_DIR, "twilio-voice-settings.json");

const ENV_KEYS = [
  "TWILIO_ACCOUNT_SID",
  "TWILIO_AUTH_TOKEN",
  "TWILIO_FROM_NUMBER",
  "FOUNDER_PHONE",
  "PUBLIC_BASE_URL",
];

function pickEnvConfig() {
  return {
    accountSid: cleanText(process.env.TWILIO_ACCOUNT_SID),
    authToken: cleanText(process.env.TWILIO_AUTH_TOKEN),
    fromNumber: cleanText(process.env.TWILIO_FROM_NUMBER),
    founderPhone: cleanText(process.env.FOUNDER_PHONE),
    publicBaseUrl: cleanText(process.env.PUBLIC_BASE_URL),
  };
}

export async function readTwilioVoiceSettingsRecord() {
  const parsed = await readJsonDocument(TWILIO_VOICE_SETTINGS_FILE);
  if (!parsed?.config || typeof parsed.config !== "object") {
    return null;
  }
  return {
    accountSid: cleanText(parsed.config.accountSid),
    authToken: cleanText(parsed.config.authToken),
    fromNumber: cleanText(parsed.config.fromNumber),
    founderPhone: cleanText(parsed.config.founderPhone),
    publicBaseUrl: cleanText(parsed.config.publicBaseUrl),
    updatedAt: cleanText(parsed.config.updatedAt) || null,
  };
}

export async function saveTwilioVoiceSettingsRecord(input) {
  const config = {
    accountSid: cleanText(input.accountSid),
    authToken: cleanText(input.authToken),
    fromNumber: cleanText(input.fromNumber),
    founderPhone: cleanText(input.founderPhone),
    publicBaseUrl: cleanText(input.publicBaseUrl).replace(/\/$/, ""),
    updatedAt: nowIso(),
  };
  await writeJsonDocument(TWILIO_VOICE_SETTINGS_FILE, { version: 1, config });
  return config;
}

export async function syncEnvTwilioToBlobIfEmpty() {
  const existing = await readTwilioVoiceSettingsRecord();
  if (existing?.accountSid && existing?.authToken) return null;

  const fromEnv = pickEnvConfig();
  if (!fromEnv.accountSid || !fromEnv.authToken) return null;

  return saveTwilioVoiceSettingsRecord({
    ...existing,
    ...fromEnv,
    accountSid: fromEnv.accountSid || existing?.accountSid,
    authToken: fromEnv.authToken || existing?.authToken,
    fromNumber: fromEnv.fromNumber || existing?.fromNumber,
    founderPhone: fromEnv.founderPhone || existing?.founderPhone,
    publicBaseUrl: fromEnv.publicBaseUrl || existing?.publicBaseUrl,
  });
}

export function maskSecret(value, visible = 4) {
  const text = cleanText(value);
  if (!text) return "";
  if (text.length <= visible * 2) return "*".repeat(text.length);
  return `${text.slice(0, visible)}…${text.slice(-visible)}`;
}

export function twilioConfigSources(envConfig, blobConfig) {
  const sources = [];
  const fields = [
    ["TWILIO_ACCOUNT_SID", "accountSid"],
    ["TWILIO_AUTH_TOKEN", "authToken"],
    ["TWILIO_FROM_NUMBER", "fromNumber"],
    ["FOUNDER_PHONE", "founderPhone"],
    ["PUBLIC_BASE_URL", "publicBaseUrl"],
  ];
  for (const [envKey, field] of fields) {
    if (cleanText(envConfig[field])) sources.push(`${envKey}:env`);
    else if (cleanText(blobConfig?.[field])) sources.push(`${envKey}:blob`);
  }
  return sources;
}
