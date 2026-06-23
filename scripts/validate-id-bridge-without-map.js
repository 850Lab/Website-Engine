#!/usr/bin/env node
import { access, rename } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  clearIdMapCache,
  resolveLegacyToBusinessId,
  resolveLegacyToOpportunityId,
} from "../src/services/id-bridge.js";
import { getCampaignByOfferSlug } from "../src/services/campaigns.js";
import { recordWebsiteOutcomeWrite } from "../src/services/schema-outcomes/record-write.js";
import { buildSchemaSalesQueue } from "../src/services/schema-queue/website-queue-read.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ID_MAP_FILE = join(ROOT, "data", "migration", "id-map.json");
const ID_MAP_BACKUP = `${ID_MAP_FILE}.validate-bak`;

function mockRequest() {
  return {
    protocol: "http",
    headers: { host: "localhost" },
    get(name) {
      return name.toLowerCase() === "host" ? "localhost" : undefined;
    },
  };
}

async function idMapExists() {
  try {
    await access(ID_MAP_FILE);
    return true;
  } catch {
    return false;
  }
}

async function withIdMapHidden(work) {
  const hadMap = await idMapExists();
  if (hadMap) {
    await rename(ID_MAP_FILE, ID_MAP_BACKUP);
  }
  clearIdMapCache();
  try {
    return await work();
  } finally {
    clearIdMapCache();
    if (hadMap) {
      await rename(ID_MAP_BACKUP, ID_MAP_FILE);
    }
  }
}

async function pickWebsiteLegacyId() {
  const queue = await buildSchemaSalesQueue(mockRequest(), {
    focusOnly: true,
    phoneOnly: true,
    excludeTwilioTest: true,
    excludeClosed: false,
  });
  return queue[0]?.id ?? null;
}

async function main() {
  if (process.env.USE_SCHEMA_OUTCOME_WRITES !== "1") {
    console.error("Set USE_SCHEMA_OUTCOME_WRITES=1 before running id-bridge validation.");
    process.exit(1);
  }

  const legacyId = await pickWebsiteLegacyId();
  if (!legacyId) {
    console.error("No website legacy id available for validation.");
    process.exit(1);
  }

  const campaign = await getCampaignByOfferSlug("website");
  if (!campaign) {
    console.error("Website campaign seed not found.");
    process.exit(1);
  }

  const report = await withIdMapHidden(async () => {
    const businessId = await resolveLegacyToBusinessId(legacyId);
    const opportunityId = await resolveLegacyToOpportunityId(legacyId, campaign.id);
    const writeResult = await recordWebsiteOutcomeWrite({
      legacyId,
      status: "contacted",
      operator: { id: "id_map_validation", name: "ID Map Validation" },
    });

    return {
      legacyId,
      campaignId: campaign.id,
      businessId,
      opportunityId,
      writeOk: Boolean(writeResult?.attempt || writeResult?.duplicateAttempt),
      duplicateAttempt: writeResult?.duplicateAttempt ?? false,
      attemptId: writeResult?.attempt?.id ?? null,
    };
  });

  const checks = {
    businessResolved: Boolean(report.businessId),
    opportunityResolved: Boolean(report.opportunityId),
    outcomeWriteSucceeded: report.writeOk,
  };
  const ready = Object.values(checks).every(Boolean);

  console.log("ID bridge validation (missing id-map.json)");
  console.log("────────────────────────────────────────");
  console.log(`Legacy id: ${report.legacyId}`);
  console.log(`Business resolved: ${checks.businessResolved ? report.businessId : "no"}`);
  console.log(`Opportunity resolved: ${checks.opportunityResolved ? report.opportunityId : "no"}`);
  console.log(`Outcome write: ${checks.outcomeWriteSucceeded ? report.attemptId || "duplicate" : "failed"}`);
  console.log(`Result: ${ready ? "PASS" : "FAIL"}`);

  process.exit(ready ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
