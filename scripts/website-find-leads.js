#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { ingestDiscoveryRecord } from "../src/pipeline/ingest-discovery.js";
import { getFocus, leadMatchesFocus } from "../src/outreach-focus/store.js";
import { buildFocusInventory } from "../src/outreach-focus/inventory.js";
import { replenishWebsiteActiveQueue } from "../src/outreach-focus/website-queue.js";
import { upsertQualifiedBusiness, listQualifiedBusinesses } from "../src/stage1/qualified-business-store.js";
import { cleanText, nowIso } from "../src/stage1/shared.js";
import { FOCUS_MIN_AVAILABLE } from "../src/outreach-focus/constants.js";
import { buildDedupIndex } from "../src/discovery/dedup.js";
import {
  filterTargetsForFocus,
  finalizeDiscoveryReport,
  runQueryDiscovery,
} from "../src/discovery/run-query.js";
import { buildFocusedInventoryDebug } from "../src/outreach-focus/diagnostics.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TARGETS_FILE = join(ROOT, "data", "website-search-targets.json");

async function loadTargets() {
  const raw = await readFile(TARGETS_FILE, "utf8");
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error("Expected array in website-search-targets.json");
  return parsed;
}

async function main() {
  const scrape = process.argv.includes("--scrape");
  const focus = await getFocus("website");
  const targets = filterTargetsForFocus(await loadTargets(), focus);
  const debugBefore = await buildFocusedInventoryDebug("website");

  console.log(`\nWebsite lead finder — focus: ${focus.industry} in ${focus.city}`);
  console.log(`Search targets: ${targets.length}`);
  console.log(`Current focused callable: ${debugBefore.totals.callableFocusMatches}`);
  console.log(`Target: ${FOCUS_MIN_AVAILABLE}+ callable available\n`);

  if (!scrape) {
    console.log("Mode: dry run\nRun: npm run website:find-leads -- --scrape\n");
    for (const target of targets) {
      console.log(`  • ${target.query} — ${target.city}, ${target.state || "TX"} (max ${target.maxResults || 50})`);
    }
    console.log("\nDiagnostics:", JSON.stringify(debugBefore.totals, null, 2));
    return;
  }

  const existing = await listQualifiedBusinesses();
  const dedupIndex = buildDedupIndex(existing);
  const funnels = [];

  async function storeWebsiteLead({ candidate, dup, phoneOk }) {
    const discovery = {
      businessName: candidate.businessName,
      industry: candidate.industry,
      category: candidate.category,
      city: candidate.city,
      state: candidate.state,
      address: candidate.address,
      phone: candidate.phone,
      websiteUrl: candidate.websiteUrl,
      googleMapsUrl: candidate.googleMapsUrl,
      rating: candidate.googleRating,
      reviewCount: candidate.googleReviewCount,
      source: "google_maps",
      sourceUrl: candidate.googleMapsUrl,
      discoveredAt: nowIso(),
    };

    const result = await ingestDiscoveryRecord(discovery, { adapterId: "google_maps" });
    let record = result.record;

    if (record && result.action === "added") {
      const patch = {
        ...record,
        callable: phoneOk,
        cityConfidence: candidate.cityConfidence || record.cityConfidence || "",
        websiteQueueState: phoneOk && leadMatchesFocus(record, focus) ? "available" : record.websiteQueueState,
      };
      if (dup.action === "add_possible_duplicate") {
        patch.possibleDuplicate = true;
        patch.possibleDuplicateOf = dup.matchedLeadId;
      }
      record = await upsertQualifiedBusiness(patch);
    } else if (record) {
      record = await upsertQualifiedBusiness({
        ...record,
        callable: phoneOk,
        cityConfidence: candidate.cityConfidence || "",
      });
    }

    return { record, action: result.action };
  }

  for (const target of targets) {
    console.log(`\n=== ${target.query} — ${target.city} ===`);
    const { funnel } = await runQueryDiscovery({
      target,
      focus,
      mode: "website",
      dedupIndex,
      storeLead: storeWebsiteLead,
      storeNoPhone: true,
    });
    funnels.push(funnel);

    const mid = await buildFocusInventory("website", { replenish: false });
    if (mid.callableFocused >= FOCUS_MIN_AVAILABLE) {
      console.log(`\nReached ${mid.callableFocused} callable focused leads — stopping early.`);
      break;
    }
  }

  await replenishWebsiteActiveQueue(focus);
  const inventoryAfter = await buildFocusInventory("website", { replenish: false });
  const debugAfter = await buildFocusedInventoryDebug("website");
  await finalizeDiscoveryReport("website", focus, funnels, { inventory: inventoryAfter, debug: debugAfter.totals });
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
