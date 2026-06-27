import { createHash } from "node:crypto";

export function entityIdFromLabel(label) {
  const normalized = String(label || "unknown").trim().toLowerCase();
  const hash = createHash("sha256").update(normalized).digest("hex").slice(0, 12);
  return `ent_${hash}`;
}
