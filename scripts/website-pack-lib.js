import { access, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  defaultEmailBody,
  defaultEmailSubject,
  defaultFollowUpText,
} from "../src/sales-brief/outreach-copy.js";

export const PAGE_TYPES = ["about", "services", "gallery", "contact"];
export const PAGE_PATTERNS = {
  about: [/about(?:-us|_us)?/i, /who-we-are/i, /our-story/i, /company/i, /brief/i],
  services: [/services?/i, /what-we-do/i, /our-services/i, /solutions/i, /how-we-work/i],
  gallery: [/gallery/i, /projects?/i, /portfolio/i, /our-work/i, /work/i, /creative/i],
  contact: [/contact(?:-us|_us)?/i, /get-in-touch/i, /reach-us/i, /request-quote/i, /consultation/i],
};

export function normalizeWebsite(url) {
  const text = String(url ?? "").trim();
  if (!text) return "";
  if (/^https?:\/\//i.test(text)) return text;
  return `https://${text}`;
}

export function relativeFolderPath(folderName) {
  return join("data", "website-screenshots", folderName).replace(/\\/g, "/");
}

function encodeSmsBody(text) {
  return encodeURIComponent(String(text ?? "").trim());
}

function encodeMail(text) {
  return encodeURIComponent(String(text ?? "").trim());
}

function normalizePhoneDigits(phone) {
  return String(phone ?? "").replace(/[^\d+]/g, "");
}


export function buildActionLinks(business) {
  const phone = normalizePhoneDigits(business.phone);
  const email = String(business.email ?? "").trim();
  const preview = String(business.previewUrl ?? "").trim();
  const offer = String(business.offerUrl ?? "").trim();

  return {
    call: phone ? `tel:${phone}` : "",
    text: phone ? `sms:${phone}?body=${encodeSmsBody(defaultFollowUpText(business))}` : "",
    email: email
      ? `mailto:${email}?subject=${encodeMail(defaultEmailSubject(business))}&body=${encodeMail(defaultEmailBody(business))}`
      : "",
    preview,
    offer,
  };
}

export function buildContactCard(business, actions) {
  return [
    "Business: " + (business.businessName || ""),
    "Industry: " + (business.industry || ""),
    "City: " + (business.city || ""),
    "Phone: " + (business.phone || ""),
    "Email: " + (business.email || ""),
    "Website: " + (business.website || ""),
    "Preview: " + (business.previewUrl || ""),
    "Offer: " + (business.offerUrl || ""),
    "Status: " + (business.outreachStatus || ""),
    "",
    "Call script reminders:",
    "- Do not lead with 'I build websites.'",
    "- Emergency question: How are you guys getting new business today?",
    "- See sales-brief.md for opening, deflection pivot, and discovery questions.",
    "",
    "Call: " + (actions.call || "(no phone)"),
    "Text: " + (actions.text || "(no phone)"),
    "Email: " + (actions.email || "(no email)"),
    "Open Preview: " + (actions.preview || "(no preview link)"),
    "Open Offer: " + (actions.offer || "(no offer link)"),
    "",
  ].join("\n");
}

async function fileExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function sameOrigin(candidate, base) {
  try {
    return new URL(candidate).origin === new URL(base).origin;
  } catch {
    return false;
  }
}

function scoreLink(url, text, patterns) {
  const haystack = `${url} ${text}`.toLowerCase();
  for (let i = 0; i < patterns.length; i += 1) {
    if (patterns[i].test(haystack)) return patterns.length - i;
  }
  return 0;
}

function pickPageLinks(links, homeUrl) {
  const picked = {};
  for (const type of PAGE_TYPES) {
    let best = null;
    let bestScore = 0;
    for (const link of links) {
      if (!link.href || !sameOrigin(link.href, homeUrl)) continue;
      if (link.href === homeUrl) continue;
      const score = scoreLink(link.href, link.text, PAGE_PATTERNS[type]);
      if (score > bestScore) {
        bestScore = score;
        best = link.href;
      }
    }
    if (best) picked[type] = best;
  }
  return picked;
}

async function loadChromium() {
  const { chromium } = await import("playwright");
  return chromium;
}

async function collectLinks(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll("a[href]")]
      .map((anchor) => ({
        href: anchor.href,
        text: (anchor.textContent || "").replace(/\s+/g, " ").trim(),
      }))
      .filter((link) => link.href.startsWith("http")),
  );
}

async function capturePage(page, url, outputPath) {
  const response = await page.goto(url, {
    waitUntil: "domcontentloaded",
    timeout: 45000,
  });
  if (!response) throw new Error("No response from page");
  if (response.status() >= 400) throw new Error(`HTTP ${response.status()}`);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: outputPath, fullPage: true });
}

export async function readScreenshotFlags(folderPath) {
  return {
    home: await fileExists(join(folderPath, "home.png")),
    about: await fileExists(join(folderPath, "about.png")),
    services: await fileExists(join(folderPath, "services.png")),
    gallery: await fileExists(join(folderPath, "gallery.png")),
    contact: await fileExists(join(folderPath, "contact.png")),
  };
}

export function flagsToCaptured(flags) {
  return { ...flags };
}

export async function captureScreenshotsForWebsite(website, folderPath) {
  await mkdir(folderPath, { recursive: true });
  const chromium = await loadChromium();
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.setViewportSize({ width: 1440, height: 1200 });
    await capturePage(page, website, join(folderPath, "home.png"));

    const links = await collectLinks(page);
    const pageLinks = pickPageLinks(links, page.url());

    for (const type of PAGE_TYPES) {
      const targetUrl = pageLinks[type];
      if (!targetUrl) continue;
      try {
        await capturePage(page, targetUrl, join(folderPath, `${type}.png`));
      } catch (err) {
        console.log(`  warning: ${type} not captured (${err.message})`);
      }
    }
  } finally {
    await page.close();
    await browser.close();
  }
}

export async function writeFolderMetadata(business, folderName, folderPath, screenshotsCaptured, screenshotErrors) {
  const actions = business.actions || buildActionLinks(business);
  const metadata = {
    businessName: business.businessName,
    industry: business.industry,
    city: business.city,
    phone: business.phone,
    email: business.email,
    website: business.website,
    previewUrl: business.previewUrl,
    offerUrl: business.offerUrl,
    outreachStatus: business.outreachStatus,
    sourceCsvRow: business.sourceCsvRow,
    screenshotFolder: relativeFolderPath(folderName),
    screenshotsCaptured,
    screenshotErrors: screenshotErrors || "",
    actions,
  };

  await writeFile(join(folderPath, "business.json"), `${JSON.stringify(metadata, null, 2)}\n`, "utf8");
  await writeFile(join(folderPath, "contact-card.txt"), `${buildContactCard(business, actions)}\n`, "utf8");
}
