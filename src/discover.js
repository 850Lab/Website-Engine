import * as readline from "node:readline";
import { openSync, ReadStream } from "node:fs";
import { stdin as input, stdout as output } from "node:process";
import { addLead, listLeads } from "./leads.js";
import { enrichLead } from "./enrich.js";

const PHONE_RE =
  /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/;

function openConsoleInput() {
  try {
    const path = process.platform === "win32" ? "CON" : "/dev/tty";
    const fd = openSync(path, "r");
    return new ReadStream(undefined, { fd });
  } catch {
    return null;
  }
}

function createPromptInput() {
  if (input.isTTY) return { stream: input, ownsStream: false };
  const stream = openConsoleInput();
  return stream ? { stream, ownsStream: true } : { stream: null, ownsStream: false };
}

function readlineQuestion(rl, prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

function normalizeBusinessName(name) {
  return String(name ?? "").trim().toLowerCase();
}

function parseCityFromAddress(address, fallbackCity) {
  const fallback = String(fallbackCity ?? "").trim();
  const text = String(address ?? "").trim();
  if (!text) return fallback;

  const parts = text.split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const last = parts[parts.length - 1];
    const stateZip = last.match(/^([A-Z]{2})\b/);
    if (stateZip) {
      const cityPart = parts[parts.length - 2];
      return `${cityPart}, ${stateZip[1]}`;
    }
    return parts.slice(-2).join(", ");
  }

  return fallback || text;
}

function parseRatingReviews(text) {
  const source = String(text ?? "");
  const ratingMatch = source.match(/([\d.]+)\s*(?:stars?|★)/i);
  const reviewMatch = source.match(/([\d,]+)\s+reviews?/i);
  return {
    rating: ratingMatch ? Number(ratingMatch[1]) : 0,
    reviews: reviewMatch ? Number(reviewMatch[1].replace(/,/g, "")) : 0,
  };
}

function extractPhone(text) {
  const match = String(text ?? "").match(PHONE_RE);
  return match ? match[0] : "";
}

function toLeadFields(result, { searchTerm, city }) {
  const businessName = String(result.businessName ?? "").trim();
  const category = String(result.category ?? searchTerm ?? "").trim();
  const resolvedCity = parseCityFromAddress(result.address, city);
  const phone = extractPhone(result.phone);
  const websiteUrl = result.hasWebsite
    ? String(result.websiteUrl ?? "").trim() || "[EXISTS]"
    : "";

  const notesParts = [`Discovered via Google Maps: ${searchTerm} in ${city}`];
  if (result.address) notesParts.push(`Address: ${result.address}`);

  return {
    businessName,
    category,
    city: resolvedCity,
    phone,
    websiteUrl,
    googleReviewCount: Number(result.googleReviewCount) || 0,
    googleRating: Number(result.googleRating) || 0,
    notes: notesParts.join(" | "),
  };
}

async function dismissConsent(page) {
  const selectors = [
    'button:has-text("Accept all")',
    'button:has-text("Reject all")',
    'button:has-text("I agree")',
  ];

  for (const selector of selectors) {
    try {
      const button = page.locator(selector).first();
      if (await button.isVisible({ timeout: 1500 })) {
        await button.click();
        await page.waitForTimeout(500);
        return;
      }
    } catch {
      // try next selector
    }
  }
}

async function scrollResultsFeed(page, targetCount) {
  const feed = page.locator('[role="feed"]');
  let previousCount = 0;

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const count = await page.locator('a[href*="/maps/place/"]').count();
    if (count >= targetCount) return;
    if (count === previousCount && attempt > 4) break;

    previousCount = count;
    try {
      await feed.evaluate((el) => {
        el.scrollTop = el.scrollHeight;
      });
    } catch {
      break;
    }
    await page.waitForTimeout(1200);
  }
}

async function collectPlaceLinks(page, maxResults) {
  const hrefs = await page.evaluate(() => {
    const seen = new Set();
    const links = [];

    for (const anchor of document.querySelectorAll('a[href*="/maps/place/"]')) {
      const card = anchor.closest('[role="article"], [jsaction], div');
      const cardText = card?.textContent ?? "";
      if (/\bAd\b/.test(cardText) && cardText.length < 200) continue;

      const href = anchor.href;
      if (!href || seen.has(href)) continue;
      seen.add(href);
      links.push(href);
    }

    return links;
  });

  return hrefs.slice(0, maxResults);
}

async function extractPlaceDetails(page, defaults) {
  return page.evaluate(({ defaultCategory, defaultCity }) => {
    function parseRatingReviews(text) {
      const source = String(text ?? "");
      const ratingMatch = source.match(/([\d.]+)\s*(?:stars?|★)/i);
      const reviewMatch = source.match(/([\d,]+)\s+reviews?/i);
      return {
        rating: ratingMatch ? Number(ratingMatch[1]) : 0,
        reviews: reviewMatch ? Number(reviewMatch[1].replace(/,/g, "")) : 0,
      };
    }

    function parseCityFromAddress(address, fallbackCity) {
      const fallback = String(fallbackCity ?? "").trim();
      const text = String(address ?? "").trim();
      if (!text) return fallback;

      const parts = text.split(",").map((part) => part.trim()).filter(Boolean);
      if (parts.length >= 2) {
        const last = parts[parts.length - 1];
        const stateZip = last.match(/^([A-Z]{2})\b/);
        if (stateZip) {
          return `${parts[parts.length - 2]}, ${stateZip[1]}`;
        }
        return parts.slice(-2).join(", ");
      }

      return fallback || text;
    }

    const name =
      document.querySelector("h1")?.textContent?.trim() ??
      document.querySelector('[data-attrid="title"]')?.textContent?.trim() ??
      "";

    let category = defaultCategory;
    const categoryCandidates = [
      ...document.querySelectorAll("button[jsaction*='category']"),
      ...document.querySelectorAll("button"),
    ];
    for (const button of categoryCandidates) {
      const text = button.textContent?.trim() ?? "";
      if (!text || text.length > 80) continue;
      if (/^(Directions|Save|Share|Website|Menu|Order|Reserve)$/i.test(text)) continue;
      if (text.includes("·")) {
        const part = text.split("·").map((piece) => piece.trim()).find(Boolean);
        if (part) {
          category = part;
          break;
        }
      } else if (!/^\d/.test(text) && !/stars?/i.test(text)) {
        category = text;
        break;
      }
    }

    let rating = 0;
    let reviews = 0;
    for (const el of document.querySelectorAll('[role="img"][aria-label*="star"], [aria-label*="stars"]')) {
      const parsed = parseRatingReviews(el.getAttribute("aria-label"));
      if (parsed.rating > 0 || parsed.reviews > 0) {
        rating = parsed.rating;
        reviews = parsed.reviews;
        break;
      }
    }

    if (!reviews) {
      const reviewText = document.body.innerText.match(/([\d,]+)\s+reviews?/i);
      if (reviewText) reviews = Number(reviewText[1].replace(/,/g, ""));
    }

    let phone = "";
    const phoneButton = document.querySelector(
      'button[data-item-id*="phone"], button[aria-label*="Phone:"], button[aria-label*="phone:"]'
    );
    if (phoneButton) {
      phone =
        phoneButton.getAttribute("aria-label")?.replace(/^Phone:\s*/i, "") ??
        phoneButton.textContent?.trim() ??
        "";
    }
    if (!phone) {
      phone = document.querySelector('a[href^="tel:"]')?.textContent?.trim() ?? "";
    }

    const websiteLink = document.querySelector(
      'a[data-item-id="authority"], a[aria-label*="Website"], a[href^="http"]:not([href*="google.com"])'
    );
    const websiteUrl = websiteLink?.href ?? "";
    const hasWebsite = Boolean(websiteUrl);

    const addressButton = document.querySelector(
      'button[data-item-id="address"], button[aria-label*="Address:"]'
    );
    const address =
      addressButton?.getAttribute("aria-label")?.replace(/^Address:\s*/i, "") ??
      addressButton?.textContent?.trim() ??
      "";

    return {
      businessName: name,
      category,
      city: parseCityFromAddress(address, defaultCity),
      address,
      phone,
      hasWebsite,
      websiteUrl,
      googleReviewCount: reviews,
      googleRating: rating,
    };
  }, defaults);
}

async function scrapeGoogleMaps({ searchTerm, city, maxResults }) {
  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    throw new Error(
      "Playwright is required for discover. Run: npm install && npx playwright install chromium"
    );
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    locale: "en-US",
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();
  const query = `${searchTerm} ${city}`;
  const results = [];

  try {
    await page.goto(
      `https://www.google.com/maps/search/${encodeURIComponent(query)}`,
      { waitUntil: "domcontentloaded", timeout: 60000 }
    );
    await dismissConsent(page);
    await page.waitForSelector('[role="feed"], h1', { timeout: 45000 });
    await scrollResultsFeed(page, maxResults);

    const placeLinks = await collectPlaceLinks(page, maxResults);
    if (placeLinks.length === 0) {
      throw new Error("No Google Maps results found for that search.");
    }

    for (const href of placeLinks) {
      await page.goto(href, { waitUntil: "domcontentloaded", timeout: 45000 });
      await page.waitForTimeout(1200);

      const detail = await extractPlaceDetails(page, {
        defaultCategory: searchTerm,
        defaultCity: city,
      });

      if (detail.businessName) {
        results.push(detail);
      }
    }
  } finally {
    await browser.close();
  }

  return results;
}

export async function promptDiscoverOptions() {
  const { stream, ownsStream } = createPromptInput();
  if (!stream) {
    throw new Error("discover requires an interactive terminal for prompts.");
  }

  const rl = readline.createInterface({ input: stream, output, terminal: true });
  try {
    console.log("\nGoogle Maps discovery\n");

    const searchTerm = (await readlineQuestion(rl, "search term: ")).trim();
    const city = (await readlineQuestion(rl, "city: ")).trim();
    const maxRaw = (await readlineQuestion(rl, "max results: ")).trim();
    const maxResults = Number.parseInt(maxRaw, 10);

    if (!searchTerm || !city) {
      throw new Error("search term and city are required.");
    }
    if (!Number.isFinite(maxResults) || maxResults < 1 || maxResults > 50) {
      throw new Error("max results must be a number between 1 and 50.");
    }

    return { searchTerm, city, maxResults };
  } finally {
    rl.close();
    if (ownsStream && typeof stream.destroy === "function") {
      stream.destroy();
    }
  }
}

/**
 * Search Google Maps, map results to lead schema, score, dedupe, and save.
 */
export async function runDiscover(options) {
  const { searchTerm, city, maxResults } = options;
  const onProgress =
    typeof options?.onProgress === "function" ? options.onProgress : () => {};

  onProgress({
    step: "started",
    message: "Lead generation started.",
    searchTerm,
    city,
    maxResults,
  });
  onProgress({
    step: "searching",
    message: `Searching Google Maps for "${searchTerm}" in ${city}...`,
  });
  console.log(`\nSearching Google Maps for "${searchTerm}" in ${city}...\n`);

  const discovered = await scrapeGoogleMaps({ searchTerm, city, maxResults });
  onProgress({
    step: "leads_found",
    message: `Found ${discovered.length} candidate businesses.`,
    count: discovered.length,
  });
  const existing = await listLeads();
  const knownNames = new Set(existing.map((lead) => normalizeBusinessName(lead.businessName)));

  const summary = {
    found: discovered.length,
    imported: 0,
    enriched: 0,
    TARGET: 0,
    HOLD: 0,
    SKIP: 0,
  };

  for (const result of discovered) {
    const fields = toLeadFields(result, { searchTerm, city });
    if (!fields.businessName || !fields.category || !fields.city) continue;

    const normalizedName = normalizeBusinessName(fields.businessName);
    if (knownNames.has(normalizedName)) continue;

    const { fields: enrichedFields, enriched } = await enrichLead(fields);
    onProgress({
      step: "enriched",
      message: `${fields.businessName}: enrichment ${enriched ? "completed" : "partial"}.`,
      leadName: fields.businessName,
      enriched,
    });
    const lead = await addLead(enrichedFields);
    onProgress({
      step: "scored",
      message: `${lead.businessName}: scored ${lead.score} (${lead.status}).`,
      leadId: lead.id,
      leadName: lead.businessName,
      score: lead.score,
      status: lead.status,
    });
    knownNames.add(normalizedName);
    summary.imported += 1;
    if (enriched) summary.enriched += 1;
    summary[lead.status] += 1;
    onProgress({
      step: "saved",
      message: `${lead.businessName}: saved to leads.json.`,
      leadId: lead.id,
      leadName: lead.businessName,
    });

    console.log(
      `  ${lead.businessName} — Enriched: ${enriched ? "yes" : "no"} | ${lead.status} (${lead.score})`
    );
  }

  onProgress({
    step: "completed",
    message: "Lead generation completed.",
    summary,
  });
  return summary;
}

export async function runDiscoverInteractive() {
  const options = await promptDiscoverOptions();
  return runDiscover(options);
}

export function formatDiscoverSummary(summary) {
  return [
    `Found: ${summary.found}`,
    `Imported: ${summary.imported}`,
    `Enriched: ${summary.enriched ?? 0}`,
    `TARGET: ${summary.TARGET}`,
    `HOLD: ${summary.HOLD}`,
    `SKIP: ${summary.SKIP}`,
  ].join("\n");
}

export { scrapeGoogleMaps, toLeadFields, normalizeBusinessName };
