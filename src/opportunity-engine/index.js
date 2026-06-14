export { registerOpportunityEngineRoutes } from "./routes.js";
export {
  getOpportunityEngineConfig,
  executeDiscoveryCampaign,
  resumeDiscoveryCampaign,
  setLiveCampaign,
} from "./discovery-campaign.js";
export { buildOpportunityDashboard } from "./dashboard-metrics.js";
export { buildIntelligenceDashboard } from "./intelligence-dashboard.js";
export { buildSoutheastTexasOpportunityReport } from "./reports/southeast-texas-report.js";
export {
  getRegionPreset,
  listRegionPresets,
  SOUTHEAST_TEXAS_CITIES,
  DEFAULT_INDUSTRIES,
} from "./region-presets.js";
