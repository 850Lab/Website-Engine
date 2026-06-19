import { hasRealWebsiteUrl } from "../enrich.js";
import { cleanText, isSocialOnlyWebsite } from "./shared.js";

function socialProfileUrls(record = {}) {
  const urls = [];
  if (cleanText(record.facebookUrl)) urls.push(record.facebookUrl);
  if (cleanText(record.instagramUrl)) urls.push(record.instagramUrl);
  if (cleanText(record.linkedinUrl)) urls.push(record.linkedinUrl);
  for (const url of record.socialUrls ?? []) {
    if (cleanText(url)) urls.push(url);
  }
  return urls;
}

/** True only when the business has no owned website URL and no social/web substitute on file. */
export function trulyHasNoWebsite(record = {}) {
  const url = cleanText(record.websiteUrl);

  if (url === "[EXISTS]") return false;
  if (hasRealWebsiteUrl(url)) return false;
  if (url && isSocialOnlyWebsite(url)) return false;

  const profiles = socialProfileUrls(record);
  if (profiles.length > 0) return false;

  return true;
}
