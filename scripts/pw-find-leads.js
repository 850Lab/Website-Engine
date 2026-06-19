#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { listPwLeads, upsertPwLead, replenishFocusActiveBatch } from "../src/pressure-washing/lead-store.js";
import { buildFocusInventory } from "../src/outreach-focus/inventory.js";
import { getFocus } from "../src/outreach-focus/store.js";
import { FOCUS_MIN_AVAILABLE } from "../src/outreach-focus/constants.js";
import { cleanText } from "../src/stage1/shared.js";
import { buildDedupIndex } from "../src/discovery/dedup.js";
import {
  filterTargetsForFocus,
  finalizeDiscoveryReport,
  runQueryDiscovery,
} from "../src/discovery/run-query.js";
import { buildFocusedInventoryDebug } from "../src/outreach-focus/diagnostics.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TARGETS_FILE = join(ROOT, "data", "pw-search-targets.json");

async function loadTargets() {
  const raw = await readFile(TARGETS_FILE, "utf8");
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error("Expected array in pw-search-targets.json");
  return parsed;
}

async function main() {
  const scrape = process.argv.includes("--scrape");
  const focus = await getFocus("pressure-washing");
  const targets = filterTargetsForFocus(await loadTargets(), focus);
  const debugBefore = await buildFocusedInventoryDebug("pressure-washing");

  console.log(`\nPW lead finder — focus: ${focus.industry} in ${focus.city}`);
  console.log(`Search targets: ${targets.length}`);
  console.log(`Current focused callable: ${debugBefore.totals.callableFocusMatches}`);
  console.log(`Target: ${FOCUS_MIN_AVAILABLE}+\n`);

  if (!scrape) {
    console.log("Mode: dry run\nRun: npm run pw:find-leads -- --scrape\n");
    for (const target of targets) {
      console.log(`  • ${target.query} — ${target.city} (max ${target.maxResults || 50})`);
    }
    console.log("\nDiagnostics:", JSON.stringify(debugBefore.totals, null, 2));
    return;
  }

  const existing = await listPwLeads();
  const dedupIndex = buildDedupIndex(existing);
  const funnels = [];

  async function storePwLead({ candidate, dup, phoneOk }) {
    const saved = await upsertPwLead({
      ...candidate,
      industry: candidate.industry || "Restaurants",
      queueState: phoneOk ? "available" : "available",
      status: "new",
      callable: phoneOk,
      possibleDuplicate: dup.action === "add_possible_duplicate",
      possibleDuplicateOf: dup.matchedLeadId || "",
    });
    return { record: saved, action: "added" };
  }

  for (const target of targets) {
    console.log(`\n=== ${target.query} — ${target.city} ===`);
    const { funnel } = await runQueryDiscovery({
      target,
      focus,
      mode: "pressure-washing",
      dedupIndex,
      storeLead: storePwLead,
      storeNoPhone: true,
    });
    funnels.push(funnel);

    const mid = await buildFocusInventory("pressure-washing", { replenish: false });
    if (mid.callableFocused >= FOCUS_MIN_AVAILABLE) {
      console.log(`\nReached ${mid.callableFocused} callable focused leads — stopping early.`);
      break;
    }
  }

  await replenishFocusActiveBatch(focus);
  const inventoryAfter = await buildFocusInventory("pressure-washing", { replenish: false });
  const debugAfter = await buildFocusedInventoryDebug("pressure-washing");
  await finalizeDiscoveryReport("pressure-washing", focus, funnels, {
    inventory: inventoryAfter,
    debug: debugAfter.totals,
  });
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
