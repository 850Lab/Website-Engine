import {
  listOpportunities as listSchemaOpportunities,
  getOpportunity as getSchemaOpportunity,
  listOpportunitiesForCampaign as listSchemaOpportunitiesForCampaign,
  listOpportunitiesForBusiness as listSchemaOpportunitiesForBusiness,
  saveOpportunity as saveSchemaOpportunity,
} from "../schema/opportunity.js";

export async function listOpportunities(filters = {}) {
  let rows = await listSchemaOpportunities();
  if (filters.campaignId) {
    rows = rows.filter((row) => row.campaignId === filters.campaignId);
  }
  if (filters.businessId) {
    rows = rows.filter((row) => row.businessId === filters.businessId);
  }
  return rows;
}

export async function getOpportunity(id) {
  return getSchemaOpportunity(id);
}

export async function listOpportunitiesForCampaign(campaignId) {
  return listSchemaOpportunitiesForCampaign(campaignId);
}

export async function listOpportunitiesForBusiness(businessId) {
  return listSchemaOpportunitiesForBusiness(businessId);
}

export async function saveOpportunity(input = {}) {
  return saveSchemaOpportunity(input);
}
