import { randomUUID } from "node:crypto";

const PHONE_RE =
  /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/;

const EMAIL_RE =
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;

const GENERIC_EMAILS =
  /^(noreply|no-reply|donotreply|admin|webmaster|postmaster|support@example)/i;

export function cleanText(value) {
  return String(value ?? "").trim();
}

export function nowIso() {
  return new Date().toISOString();
}

export function newBusinessId() {
  return `qbd_${randomUUID().slice(0, 8)}`;
}

export function newDiscoveryRunId() {
  return `bdr_${randomUUID().slice(0, 8)}`;
}

export function normalizeBusinessName(name) {
  return cleanText(name).toLowerCase().replace(/[^a-z0-9]+/g, " ");
}

export function normalizePhoneNumber(phone) {
  const digits = cleanText(phone).replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return digits ? `+${digits}` : "";
}

export function isValidPhoneFormat(phone) {
  const normalized = normalizePhoneNumber(phone);
  return /^\+1\d{10}$/.test(normalized);
}

export function extractPhoneFromText(text) {
  const match = cleanText(text).match(PHONE_RE);
  return match ? match[0] : "";
}

export function extractEmailsFromHtml(html) {
  const matches = String(html ?? "").match(EMAIL_RE) ?? [];
  const unique = [];
  for (const email of matches) {
    const lower = email.toLowerCase();
    if (GENERIC_EMAILS.test(lower)) continue;
    if (lower.endsWith(".png") || lower.endsWith(".jpg")) continue;
    if (!unique.includes(lower)) unique.push(lower);
  }
  return unique;
}

export function parseStateFromAddress(address, fallbackState = "") {
  const text = cleanText(address);
  if (!text) return cleanText(fallbackState).toUpperCase();
  const match = text.match(/,\s*([A-Z]{2})(?:\s+\d{5})?\s*$/);
  return match ? match[1] : cleanText(fallbackState).toUpperCase();
}

export function parseCityName(cityField, state) {
  const text = cleanText(cityField);
  const withoutState = text.replace(/,\s*[A-Z]{2}$/i, "").trim();
  return withoutState || text;
}

export function buildDedupKey({ businessName, city, phone, googleMapsUrl }) {
  const maps = cleanText(googleMapsUrl);
  if (maps) return `maps:${maps}`;
  const name = normalizeBusinessName(businessName);
  const place = normalizeBusinessName(city);
  const normalizedPhone = normalizePhoneNumber(phone);
  return `name:${name}|${place}|${normalizedPhone || "no-phone"}`;
}

export function isSocialOnlyWebsite(url) {
  const text = cleanText(url).toLowerCase();
  if (!text) return false;
  try {
    const host = new URL(text.startsWith("http") ? text : `https://${text}`).hostname.replace(
      /^www\./,
      ""
    );
    return [
      "facebook.com",
      "fb.com",
      "instagram.com",
      "linktr.ee",
      "tiktok.com",
      "yelp.com",
    ].some((domain) => host === domain || host.endsWith(`.${domain}`));
  } catch {
    return /facebook\.com|instagram\.com|linktr\.ee/i.test(text);
  }
}
