import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  scoreImageConfidence,
  meetsConfidenceThreshold,
} from "./asset-confidence.js";

const FETCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,image/avif,image/webp,image/*,*/*;q=0.8",
};

const SOCIAL_RE =
  /https?:\/\/(?:www\.)?(?:facebook\.com|fb\.com|instagram\.com)\/[^\s"'<>]+/gi;

const IMG_ATTR_RE =
  /<(?:img|source)[^>]+(?:src|srcset)=["']([^"']+)["'][^>]*>/gi;
const OG_IMAGE_RE =
  /<meta[^>]+(?:property|name)=["']og:image["'][^>]+content=["']([^"']+)["'][^>]*>/gi;
const OG_IMAGE_ALT_RE =
  /<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']og:image["'][^>]*>/gi;

export const REAL_ASSET_FILES = {
  hero: "real-hero.jpg",
  support: "real-support.jpg",
  gallery1: "real-gallery-1.jpg",
};

function normalizeUrl(url, baseUrl) {
  const trimmed = String(url ?? "").trim();
  if (!trimmed || trimmed.startsWith("data:")) return "";
  try {
    return new URL(trimmed, baseUrl).href;
  } catch {
    return "";
  }
}

function hasRealWebsiteUrl(websiteUrl) {
  const url = String(websiteUrl ?? "").trim();
  return Boolean(url) && url !== "[EXISTS]";
}

export function extractSocialUrlsFromLead(lead) {
  const haystack = [lead.notes, lead.websiteUrl].filter(Boolean).join(" ");
  const urls = new Set();
  for (const match of haystack.matchAll(SOCIAL_RE)) {
    const normalized = normalizeUrl(match[0]);
    if (normalized) urls.add(normalized);
  }
  return [...urls];
}

export function collectSourcePages(lead) {
  const pages = [];
  if (hasRealWebsiteUrl(lead.websiteUrl)) {
    pages.push({ url: normalizeUrl(lead.websiteUrl), kind: "website" });
  }
  for (const url of extractSocialUrlsFromLead(lead)) {
    pages.push({ url, kind: "social" });
  }
  return pages.filter((p) => p.url);
}

async function fetchHtml(url, timeoutMs = 12000) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: FETCH_HEADERS,
    });
    clearTimeout(timer);
    if (!response.ok) return null;
    const contentType = response.headers.get("content-type") ?? "";
    if (
      !contentType.includes("text/html") &&
      !contentType.includes("application/xhtml")
    ) {
      return null;
    }
    return await response.text();
  } catch {
    return null;
  }
}

function pickSrcFromSrcset(value) {
  const first = String(value ?? "").split(",")[0]?.trim() ?? "";
  const url = first.split(/\s+/)[0];
  return url ?? "";
}

function isLikelyPhotoUrl(url) {
  const u = url.toLowerCase();
  if (!u || u.startsWith("data:")) return false;
  if (u.endsWith(".svg") || u.endsWith(".ico")) return false;
  if (/logo|icon|sprite|pixel|tracking|badge|avatar|emoji|spacer|1x1/i.test(u)) {
    return false;
  }
  return (
    /\.(jpe?g|png|webp|avif)(\?|$)/i.test(u) ||
    /\/images?\//i.test(u) ||
    /wp-content\/uploads/i.test(u)
  );
}

function extractImageUrls(html, pageUrl) {
  const urls = new Set();

  const add = (raw) => {
    const resolved = normalizeUrl(
      raw.includes(",") ? pickSrcFromSrcset(raw) : raw,
      pageUrl
    );
    if (resolved && isLikelyPhotoUrl(resolved)) urls.add(resolved);
  };

  for (const match of String(html ?? "").matchAll(IMG_ATTR_RE)) {
    add(match[1]);
  }
  for (const match of String(html ?? "").matchAll(OG_IMAGE_RE)) {
    add(match[1]);
  }
  for (const match of String(html ?? "").matchAll(OG_IMAGE_ALT_RE)) {
    add(match[1]);
  }

  return [...urls];
}

async function downloadImage(url) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: FETCH_HEADERS,
    });
    clearTimeout(timer);
    if (!response.ok) return null;

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.startsWith("image/")) return null;

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length < 8000) return null;

    const ext = contentType.includes("png")
      ? ".png"
      : contentType.includes("webp")
        ? ".webp"
        : ".jpg";

    return { buffer, ext };
  } catch {
    return null;
  }
}

/**
 * Scan lead sources and return scored image candidates.
 * @param {object} lead
 */
export async function discoverRealImageCandidates(lead) {
  const pages = collectSourcePages(lead);
  const candidates = [];
  const seenUrls = new Set();

  for (const page of pages) {
    const html = await fetchHtml(page.url);
    if (!html) continue;

    const imageUrls = extractImageUrls(html, page.url);
    for (const imageUrl of imageUrls) {
      if (seenUrls.has(imageUrl)) continue;
      seenUrls.add(imageUrl);

      const { score, breakdown } = scoreImageConfidence({
        lead,
        pageHtml: html,
        pageUrl: page.url,
        sourceKind: page.kind,
        category: lead.category,
      });

      candidates.push({
        imageUrl,
        pageUrl: page.url,
        sourceKind: page.kind,
        score,
        breakdown,
      });
    }
  }

  return candidates.sort((a, b) => b.score - a.score);
}

/**
 * Download high-confidence images and save as real-*.jpg
 * @returns {Promise<{ files: Record<string, string>, confidence: number, saved: string[] }>}
 */
export async function saveVerifiedRealAssets(lead, assetsDir) {
  const candidates = await discoverRealImageCandidates(lead);
  const qualified = candidates.filter((c) => meetsConfidenceThreshold(c.score));

  const slots = [
    { key: "hero", file: REAL_ASSET_FILES.hero },
    { key: "support", file: REAL_ASSET_FILES.support },
    { key: "gallery1", file: REAL_ASSET_FILES.gallery1 },
  ];

  const files = {};
  const saved = [];
  let maxConfidence = 0;
  const usedUrls = new Set();

  for (const slot of slots) {
    const pick = qualified.find((c) => !usedUrls.has(c.imageUrl));
    if (!pick) break;

    const downloaded = await downloadImage(pick.imageUrl);
    if (!downloaded) continue;

    usedUrls.add(pick.imageUrl);
    const diskPath = join(assetsDir, slot.file);
    await writeFile(diskPath, downloaded.buffer);

    files[slot.key] = `assets/${slot.file}`;
    saved.push(slot.file);
    maxConfidence = Math.max(maxConfidence, pick.score);
  }

  return { files, confidence: maxConfidence, saved, qualifiedCount: qualified.length };
}
