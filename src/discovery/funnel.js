import { mkdir, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { nowIso } from "../stage1/shared.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

export function createDiscoveryFunnel(queryLabel = "") {
  return {
    query: queryLabel,
    startedAt: nowIso(),
    rawMapsResults: 0,
    parsedBusinesses: 0,
    withPhone: 0,
    withoutPhone: 0,
    cityMatched: 0,
    industryMatched: 0,
    focusMatched: 0,
    callableFocusMatched: 0,
    duplicatesSkipped: 0,
    possibleDuplicatesAdded: 0,
    newLeadsAdded: 0,
    newFocusedLeadsAdded: 0,
    storedNoPhone: 0,
    rejected: {
      no_phone_not_stored: 0,
      no_business_name: 0,
      city_mismatch: 0,
      industry_mismatch: 0,
      duplicate: 0,
      ingest_error: 0,
      outside_focus_after_ingest: 0,
    },
    scrapeStats: null,
    samples: {
      rejected: [],
      added: [],
    },
  };
}

export function bumpRejected(funnel, reason, sample = null) {
  funnel.rejected[reason] = (funnel.rejected[reason] || 0) + 1;
  if (sample && funnel.samples.rejected.length < 20) {
    funnel.samples.rejected.push({ reason, ...sample });
  }
}

export function formatFunnelReport(funnel) {
  const lines = [
    `Query: ${funnel.query}`,
    "",
    `Raw Maps results: ${funnel.rawMapsResults}`,
    `Parsed businesses: ${funnel.parsedBusinesses}`,
    `With phone: ${funnel.withPhone}`,
    `Without phone: ${funnel.withoutPhone}`,
    `City matched: ${funnel.cityMatched}`,
    `Industry matched: ${funnel.industryMatched}`,
    `Focus matched: ${funnel.focusMatched}`,
    `Callable focus matched: ${funnel.callableFocusMatched}`,
    `Duplicates skipped: ${funnel.duplicatesSkipped}`,
    `Possible duplicates added: ${funnel.possibleDuplicatesAdded}`,
    `New leads added: ${funnel.newLeadsAdded}`,
    `New focused leads added: ${funnel.newFocusedLeadsAdded}`,
    `Stored without phone: ${funnel.storedNoPhone}`,
    "Rejected:",
    `- No phone (not stored): ${funnel.rejected.no_phone_not_stored || 0}`,
    `- No business name: ${funnel.rejected.no_business_name || 0}`,
    `- City mismatch: ${funnel.rejected.city_mismatch || 0}`,
    `- Industry mismatch: ${funnel.rejected.industry_mismatch || 0}`,
    `- Duplicate: ${funnel.rejected.duplicate || 0}`,
    `- Ingest error: ${funnel.rejected.ingest_error || 0}`,
    `- Outside focus after ingest: ${funnel.rejected.outside_focus_after_ingest || 0}`,
  ];

  if (funnel.scrapeStats) {
    lines.push(
      "",
      "Scrape stats:",
      `- Result cards seen: ${funnel.scrapeStats.cardsSeen || 0}`,
      `- Detail pages opened: ${funnel.scrapeStats.detailPagesOpened || 0}`,
      `- Scroll rounds: ${funnel.scrapeStats.scrollRounds || 0}`,
    );
  }

  return lines.join("\n");
}

export async function writeDiscoveryReport(mode, report) {
  const dir = join(ROOT, "data", "discovery-reports");
  await mkdir(dir, { recursive: true });
  const file = mode === "pressure-washing" ? "pw-latest.json" : "website-latest.json";
  const path = join(dir, file);
  await writeFile(path, JSON.stringify({ ...report, writtenAt: nowIso() }, null, 2));
  return path;
}
