import { scrapeGoogleMaps } from "../discover.js";
import { createDiscoveryRecord } from "./schema.js";
import { DiscoveryAdapter } from "./base-adapter.js";
import { parseCityName, parseStateFromAddress } from "../stage1/shared.js";

export class GoogleMapsAdapter extends DiscoveryAdapter {
  constructor() {
    super({
      id: "google_maps",
      name: "Google Maps",
      description: "Discover businesses via Google Maps search results.",
      enabled: true,
    });
  }

  async discover({ industry, city, state, maxResults = 25 }) {
    const searchCity = state ? `${city}, ${state}` : city;
    const places = await scrapeGoogleMaps({
      searchTerm: industry,
      city: searchCity,
      maxResults,
    });

    return places.map((place) => {
      const address = String(place.address ?? "").trim();
      const parsedState = parseStateFromAddress(address, state);
      const parsedCity = parseCityName(place.city || city, parsedState);
      const websiteUrl = place.hasWebsite ? String(place.websiteUrl ?? "").trim() : "";

      return createDiscoveryRecord({
        businessName: place.businessName,
        category: place.category ?? industry,
        industry,
        phone: place.phone,
        website: websiteUrl,
        address,
        city: parsedCity,
        state: parsedState,
        source: "google_maps",
        sourceUrl: place.googleMapsUrl ?? "",
        googleMapsUrl: place.googleMapsUrl ?? "",
        reviewCount: place.googleReviewCount,
        rating: place.googleRating,
        metadata: { searchCity, searchTerm: industry },
      });
    });
  }
}
