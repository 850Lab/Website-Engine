import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { buildOffer } from "../../src/schema/offer.js";
import { buildCampaign } from "../../src/schema/campaign.js";
import { ROOT } from "./load-legacy.js";

async function resolveSearchTargets(config = {}) {
  const discovery = { ...config.discovery };
  if (discovery.searchTargetsFile) {
    const filePath = join(ROOT, discovery.searchTargetsFile);
    const parsed = JSON.parse(await readFile(filePath, "utf8"));
    discovery.searchTargets = Array.isArray(parsed) ? parsed : [];
    delete discovery.searchTargetsFile;
  }
  if (!Array.isArray(discovery.searchTargets)) {
    discovery.searchTargets = [];
  }
  return { ...config, discovery };
}

export async function loadSeedOffersAndCampaigns() {
  const offersRaw = JSON.parse(
    await readFile(join(ROOT, "data/seeds/offers.json"), "utf8"),
  );
  const campaignsRaw = JSON.parse(
    await readFile(join(ROOT, "data/seeds/campaigns.json"), "utf8"),
  );

  const offers = offersRaw.map((row) => buildOffer(row));
  const offerById = Object.fromEntries(offers.map((o) => [o.id, o]));

  const campaigns = [];
  for (const row of campaignsRaw) {
    const config = await resolveSearchTargets(row.config ?? {});
    const offer = offerById[row.offerId];
    campaigns.push(
      buildCampaign({
        ...row,
        config,
        offerName: row.offerName || offer?.name || null,
      }),
    );
  }

  return { offers, campaigns, campaignsRaw };
}
