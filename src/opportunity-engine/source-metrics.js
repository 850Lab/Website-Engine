import { listQualifiedBusinesses } from "../stage1/qualified-business-store.js";
import { listBusinessIdentities, listBusinessSources } from "../identity/identity-store.js";
import { getAdapterRegistryView } from "../discovery-adapters/registry.js";

function hasUrl(record, field) {
  return Boolean(String(record[field] ?? "").trim());
}

function hasSocial(record, pattern, field = "") {
  const urls = [...(record.socialUrls ?? []), record.websiteUrl ?? ""].filter(Boolean);
  return urls.some((url) => pattern.test(url)) || (field && pattern.test(record[field] ?? ""));
}

export async function buildSourceAgnosticMetrics(records = null) {
  const list = records ?? (await listQualifiedBusinesses());
  const identities = await listBusinessIdentities();
  const sources = await listBusinessSources();
  const adapters = await getAdapterRegistryView();

  const withFacebook = list.filter(
    (r) => hasUrl(r, "facebookUrl") || hasSocial(r, /facebook\.com/i, "facebookUrl"),
  ).length;
  const withInstagram = list.filter(
    (r) => hasUrl(r, "instagramUrl") || hasSocial(r, /instagram\.com/i, "instagramUrl"),
  ).length;
  const withLinkedin = list.filter(
    (r) => hasUrl(r, "linkedinUrl") || hasSocial(r, /linkedin\.com/i, "linkedinUrl"),
  ).length;
  const withEmail = list.filter((r) => Boolean(String(r.email ?? "").trim())).length;

  const sourcesByIdentity = {};
  for (const source of sources) {
    sourcesByIdentity[source.businessIdentityId] =
      (sourcesByIdentity[source.businessIdentityId] ?? 0) + 1;
  }

  const multiSourceIdentities = Object.values(sourcesByIdentity).filter((count) => count > 1).length;
  const avgSources =
    identities.length > 0
      ? Math.round((sources.length / identities.length) * 100) / 100
      : 0;

  return {
    businessesWithFacebook: withFacebook,
    businessesWithInstagram: withInstagram,
    businessesWithLinkedin: withLinkedin,
    businessesWithEmail: withEmail,
    businessesWithMultipleSources: multiSourceIdentities,
    averageSourcesPerBusiness: avgSources,
    totalIdentities: identities.length,
    totalSources: sources.length,
    adapters,
  };
}
