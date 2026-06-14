import { cleanText, extractEmailsFromHtml, normalizePhoneNumber, nowIso } from "../stage1/shared.js";
import { hasContactForm } from "../stage1/website-quality-score.js";
import { saveBusinessIdentity, getBusinessIdentity } from "../identity/identity-store.js";
import { upsertQualifiedBusiness } from "../stage1/qualified-business-store.js";

const FETCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml",
};

function normalizeUrl(url) {
  const trimmed = cleanText(url);
  if (!trimmed || trimmed === "[EXISTS]") return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

async function fetchHtml(url, timeoutMs = 12000) {
  const target = normalizeUrl(url);
  if (!target) return null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const response = await fetch(target, {
      signal: controller.signal,
      redirect: "follow",
      headers: FETCH_HEADERS,
    });
    clearTimeout(timer);
    if (!response.ok) return null;
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
      return null;
    }
    return await response.text();
  } catch {
    return null;
  }
}

function extractSocialUrls(html, websiteUrl) {
  const urls = { facebook: "", instagram: "", linkedin: "" };
  const source = String(html ?? "");
  const matches = source.match(/https?:\/\/[^\s"'<>]+/gi) ?? [];
  for (const match of matches) {
    const clean = match.split(/[)"'\s]/)[0];
    if (!urls.facebook && /facebook\.com/i.test(clean)) urls.facebook = clean;
    if (!urls.instagram && /instagram\.com/i.test(clean)) urls.instagram = clean;
    if (!urls.linkedin && /linkedin\.com/i.test(clean)) urls.linkedin = clean;
  }
  const site = normalizeUrl(websiteUrl);
  if (site) {
    if (/facebook\.com/i.test(site)) urls.facebook = urls.facebook || site;
    if (/instagram\.com/i.test(site)) urls.instagram = urls.instagram || site;
    if (/linkedin\.com/i.test(site)) urls.linkedin = urls.linkedin || site;
  }
  return urls;
}

function extractPhonesFromHtml(html) {
  const matches = String(html ?? "").match(
    /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
  ) ?? [];
  return [...new Set(matches.map((m) => normalizePhoneNumber(m)).filter(Boolean))];
}

export async function enrichQualifiedOpportunity(record) {
  if (record.qualificationStatus !== "qualified") {
    return { enriched: false, reason: "not_qualified" };
  }

  const html = record.websiteUrl ? await fetchHtml(record.websiteUrl) : null;
  const social = extractSocialUrls(html, record.websiteUrl);
  const emails = html ? extractEmailsFromHtml(html) : [];
  const primaryEmail = cleanText(record.email) || emails[0] || "";
  const extraPhones = html ? extractPhonesFromHtml(html) : [];
  const hasForm = html ? hasContactForm(html) : false;

  const enrichment = {
    facebookUrl: social.facebook || record.facebookUrl || "",
    instagramUrl: social.instagram || record.instagramUrl || "",
    linkedinUrl: social.linkedin || record.linkedinUrl || "",
    emails: [...new Set([primaryEmail, ...emails].filter(Boolean))],
    phones: [...new Set([record.normalizedPhone, normalizePhoneNumber(record.phone), ...extraPhones].filter(Boolean))],
    hasContactForm: hasForm,
    enrichedAt: nowIso(),
  };

  const socialUrls = [
    ...new Set([
      ...(record.socialUrls ?? []),
      enrichment.facebookUrl,
      enrichment.instagramUrl,
      enrichment.linkedinUrl,
    ].filter(Boolean)),
  ];

  const updatedRecord = {
    ...record,
    email: primaryEmail || record.email,
    socialUrls,
    facebookUrl: enrichment.facebookUrl,
    instagramUrl: enrichment.instagramUrl,
    linkedinUrl: enrichment.linkedinUrl,
    enrichment,
    enrichedAt: enrichment.enrichedAt,
  };

  await upsertQualifiedBusiness(updatedRecord);

  if (record.businessIdentityId) {
    const identity = await getBusinessIdentity(record.businessIdentityId);
    if (identity) {
      await saveBusinessIdentity({
        ...identity,
        email: identity.email || primaryEmail,
        facebookUrl: identity.facebookUrl || enrichment.facebookUrl,
        instagramUrl: identity.instagramUrl || enrichment.instagramUrl,
        linkedinUrl: identity.linkedinUrl || enrichment.linkedinUrl,
      });
    }
  }

  return { enriched: true, enrichment, record: updatedRecord };
}
