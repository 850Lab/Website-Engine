import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { buildOffer } from "../../src/schema/offer.js";
import { buildCampaign, emptyCampaignConfig } from "../../src/schema/campaign.js";
import { DATA_DIR, SEEDS_DIR, ROOT_DIR } from "./paths.js";

async function readJson(path) {
  const raw = await readFile(path, "utf8");
  return JSON.parse(raw);
}

async function loadSearchTargets(relativePath) {
  if (!relativePath) return [];
  const absolute = relativePath.startsWith("data/")
    ? join(ROOT_DIR, relativePath)
    : join(DATA_DIR, relativePath);
  const parsed = await readJson(absolute);
  return Array.isArray(parsed) ? parsed : [];
}

export async function loadSeedData() {
  const offerRows = await readJson(join(SEEDS_DIR, "offers.json"));
  const campaignRows = await readJson(join(SEEDS_DIR, "campaigns.json"));

  const offers = offerRows.map((row) => buildOffer(row));
  const offerById = Object.fromEntries(offers.map((o) => [o.id, o]));

  const campaigns = [];
  for (const row of campaignRows) {
    const searchTargets = await loadSearchTargets(row.searchTargetsFile);
    const baseConfig = emptyCampaignConfig();
    const mergedConfig = {
      ...baseConfig,
      ...(row.config ?? {}),
      discovery: {
        ...baseConfig.discovery,
        ...(row.config?.discovery ?? {}),
        searchTargets,
      },
    };

    campaigns.push(
      buildCampaign({
        ...row,
        config: mergedConfig,
        offerName: row.offerName ?? offerById[row.offerId]?.name ?? null,
      }),
    );
  }

  return { offers, campaigns, offerById };
}

/** Resolve campaign from focus event dimensions (campaign-agnostic). */
export function resolveCampaignFromFocusEvent(event, campaigns) {
  const industry = String(event.industry ?? "").toLowerCase();
  const city = String(event.city ?? "").toLowerCase();
  const offer = String(event.offer ?? "").toLowerCase();

  return (
    campaigns.find((campaign) => {
      const buyer = campaign.buyer.toLowerCase();
      const region = campaign.region.toLowerCase();
      const offerName = (campaign.offerName ?? "").toLowerCase();
      const industryOk =
        industry.includes(buyer) ||
        buyer.includes(industry) ||
        industry.includes("restaurant") && buyer.includes("restaurant");
      const cityOk = !city || region.includes(city) || city.includes(region);
      const offerOk =
        !offer ||
        offerName.includes(offer) ||
        offer.includes(offerName) ||
        offer.includes("dumpster") && offerName.includes("pressure");
      return industryOk && cityOk && offerOk;
    }) ?? null
  );
}
