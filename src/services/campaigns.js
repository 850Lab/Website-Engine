import {
  listCampaigns as listSchemaCampaigns,
  getCampaign as getSchemaCampaign,
} from "../schema/campaign.js";

export async function listCampaigns(filters = {}) {
  let rows = await listSchemaCampaigns();
  if (filters.status) {
    rows = rows.filter((row) => row.status === filters.status);
  }
  if (filters.offerId) {
    rows = rows.filter((row) => row.offerId === filters.offerId);
  }
  return rows;
}

export async function getCampaign(id) {
  return getSchemaCampaign(id);
}

export async function getCampaignByOfferSlug(offerSlug) {
  const needle = String(offerSlug).toLowerCase().replace(/-/g, " ");
  const offerIdGuess = `offer_${String(offerSlug).toLowerCase().replace(/-/g, "_")}`;
  const campaigns = await listSchemaCampaigns();
  return (
    campaigns.find((row) => row.offerId === offerIdGuess) ??
    campaigns.find((row) =>
      String(row.offer ?? "")
        .toLowerCase()
        .replace(/-/g, " ")
        .includes(needle),
    ) ??
    campaigns.find((row) => row.id.includes(String(offerSlug).replace(/-/g, "_"))) ??
    null
  );
}
