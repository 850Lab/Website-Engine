import { randomUUID } from "node:crypto";

export function cleanText(value) {
  return String(value ?? "").trim();
}

export function nowIso() {
  return new Date().toISOString();
}

export function newPackageId() {
  return `v6_${randomUUID().slice(0, 8)}`;
}

export function slugify(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}
