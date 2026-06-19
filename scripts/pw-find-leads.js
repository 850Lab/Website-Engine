#!/usr/bin/env node
/**
 * Pressure washing lead discovery — adds leads to data/pressure-washing-leads.json
 *
 * Usage:
 *   node scripts/pw-find-leads.js              # summary + TODO (no scrape)
 *   node scripts/pw-find-leads.js --scrape     # Google Maps via Playwright (requires chromium)
 */
import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { scrapeGoogleMaps } from "../src/discover.js";
import {
  buildDedupIndex,
  leadDedupKey,
  listPwLeads,
  upsertPwLead,
} from "../src/pressure-washing/lead-store.js";
import { buildPwQueueHealth } from "../src/pressure-washing/metrics.js";
import { cleanText, nowIso } from "../src/stage1/shared.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TARGETS_FILE = join(ROOT, "data", "pw-search-targets.json");

async function loadTargets() {
  try {
    const raw = await readFile(TARGETS_FILE, "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error("Expected array in pw-search-targets.json");
    return parsed;
  } catch (err) {
    if (err.code === "ENOENT") {
      throw new Error(`Missing ${TARGETS_FILE}. Create search targets first.`);
    }
    throw err;
  }
}

function placeToLead(place, target) {
  const city = cleanText(target.city) || cleanText(place.city);
  return {
    businessName: cleanText(place.businessName),
    industry: cleanText(target.industry) || "Restaurants",
    address: cleanText(place.address),
    city,
    phone: cleanText(place.phone),
    website: cleanText(place.websiteUrl),
    googleMapsUrl: cleanText(place.googleMapsUrl),
    googleRating: Number(place.googleRating) || 0,
    reviewCount: Number(place.googleReviewCount) || 0,
    source: "google_maps",
    sourceQuery: cleanText(target.query) + " " + city,
    queueState: "available",
    status: "new",
    discoveredAt: nowIso(),
  };
}

async function main() {
  const scrape = process.argv.includes("--scrape");
  const targets = await loadTargets();
  const existing = await listPwLeads();
  const dedup = buildDedupIndex(existing);

  let searchesProcessed = 0;
  let leadsFound = 0;
  let newLeadsAdded = 0;
  let duplicatesSkipped = 0;

  console.log(`\nZeal PW lead finder — ${targets.length} search targets loaded`);
  console.log(`Existing leads in database: ${existing.length}\n`);

  if (!scrape) {
    console.log("Mode: dry run (no scraping)");
    console.log("");
    console.log("TODO: Run with --scrape to search Google Maps:");
    console.log("  node scripts/pw-find-leads.js --scrape");
    console.log("");
    console.log("Requires Playwright + Chromium:");
    console.log("  npx playwright install chromium");
    console.log("");
    console.log("Reuses scrapeGoogleMaps() from src/discover.js (same as website outreach).");
    console.log("");
    for (const target of targets) {
      console.log(`  • ${target.query} — ${target.city} (${target.industry})`);
    }
    const health = await buildPwQueueHealth();
    console.log("");
    console.log("Current queue health:");
    console.log(`  available: ${health.available}`);
    console.log(`  active:    ${health.active}`);
    console.log(`  needs replenishment: ${health.needsReplenishment}`);
    return;
  }

  console.log("Mode: Google Maps scrape\n");

  for (const target of targets) {
    const cityLabel = `${cleanText(target.city)}, TX`;
    const searchTerm = cleanText(target.query) || cleanText(target.industry);
    const maxResults = Number(target.maxResults) || 10;

    console.log(`Searching: "${searchTerm}" in ${cityLabel}…`);
    searchesProcessed += 1;

    let places = [];
    try {
      places = await scrapeGoogleMaps({
        searchTerm,
        city: cityLabel,
        maxResults,
      });
    } catch (err) {
      console.warn(`  Search failed: ${err.message}`);
      continue;
    }

    leadsFound += places.length;
    console.log(`  Found ${places.length} places`);

    for (const place of places) {
      if (!cleanText(place.businessName)) continue;
      const candidate = placeToLead(place, target);
      if (!candidate.phone) {
        console.log(`  Skip (no phone): ${candidate.businessName}`);
        continue;
      }

      const key = leadDedupKey(candidate);
      if (key && dedup.has(key)) {
        duplicatesSkipped += 1;
        continue;
      }

      const saved = await upsertPwLead(candidate);
      if (key) dedup.set(key, saved.id);
      newLeadsAdded += 1;
      console.log(`  + ${saved.businessName} (${saved.city}) score ${saved.priorityScore}`);
    }
  }

  const health = await buildPwQueueHealth();
  console.log("\n--- Summary ---");
  console.log(`Searches processed:  ${searchesProcessed}`);
  console.log(`Leads found:         ${leadsFound}`);
  console.log(`New leads added:     ${newLeadsAdded}`);
  console.log(`Duplicates skipped:  ${duplicatesSkipped}`);
  console.log(`Available leads:     ${health.available}`);
  console.log(`Active leads:        ${health.active}`);
  console.log(`Needs replenishment: ${health.needsReplenishment}`);
  console.log("");
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
