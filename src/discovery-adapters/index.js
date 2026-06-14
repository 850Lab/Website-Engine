export { createDiscoveryRecord, identitySignalsFromDiscovery } from "./schema.js";
export { DiscoveryAdapter } from "./base-adapter.js";
export { GoogleMapsAdapter } from "./google-maps-adapter.js";
export {
  getAdapter,
  listAdapters,
  getEnabledAdapters,
  recordAdapterRun,
  getAdapterRegistryView,
} from "./registry.js";
