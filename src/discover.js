const PHONE_RE =
  /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/;

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
        results.push({ ...detail, googleMapsUrl: href });
      }
    }
  } finally {
    await browser.close();
  }

  return results;
}

export { scrapeGoogleMaps, toLeadFields, normalizeBusinessName };
