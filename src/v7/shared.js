import { randomBytes, randomUUID } from "node:crypto";

export function cleanText(value) {
  return String(value ?? "").trim();
}

export function nowIso() {
  return new Date().toISOString();
}

export function newProjectId() {
  return `wop_${randomUUID().slice(0, 8)}`;
}

export function newCustomerToken() {
  return randomBytes(24).toString("hex");
}

export function publicBaseUrl(req) {
  const forwardedProto = String(req.get("x-forwarded-proto") || "").split(",")[0].trim();
  const protocol = forwardedProto || req.protocol || "http";
  const host = req.get("host") || "localhost:8787";
  return cleanText(process.env.PUBLIC_BASE_URL) || `${protocol}://${host}`;
}

export function geoCellFromCity(city) {
  const text = cleanText(city);
  if (!text) return "city:local-area|XX";
  const match = text.match(/^(.+?),\s*([A-Z]{2})$/i);
  if (match) {
    const citySlug = match[1].toLowerCase().replace(/[^a-z0-9]+/g, "-");
    return `city:${citySlug}|${match[2].toUpperCase()}`;
  }
  const slug = text.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return `city:${slug}|XX`;
}
