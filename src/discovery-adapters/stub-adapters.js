import { DiscoveryAdapter } from "./base-adapter.js";

function stubAdapter(id, name, description) {
  return new (class extends DiscoveryAdapter {
    constructor() {
      super({ id, name, description, enabled: false });
    }

    async discover() {
      throw new Error(`${name} adapter is not enabled yet.`);
    }
  })();
}

export const STUB_ADAPTERS = [
  stubAdapter("facebook", "Facebook", "Discover business pages on Facebook."),
  stubAdapter("instagram", "Instagram", "Discover business profiles on Instagram."),
  stubAdapter("linkedin", "LinkedIn", "Discover company pages on LinkedIn."),
  stubAdapter("yelp", "Yelp", "Discover businesses on Yelp."),
  stubAdapter("bbb", "BBB", "Discover businesses on Better Business Bureau."),
  stubAdapter("chamber", "Chamber of Commerce", "Discover chamber directory listings."),
  stubAdapter("industry_directory", "Industry Directory", "Discover niche industry directories."),
  stubAdapter("state_license", "State License", "Discover licensed contractors from state records."),
  stubAdapter("opportunity_radar", "Opportunity Radar", "Internal opportunity signal scanner."),
];
