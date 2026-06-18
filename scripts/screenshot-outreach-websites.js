import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";
import {
  defaultEmailBody,
  defaultEmailSubject,
  defaultFollowUpText,
} from "../src/sales-brief/outreach-copy.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const INPUT_CSV = join(ROOT, "data", "outreach-top-50.csv");
const OUTPUT_ROOT = join(ROOT, "data", "website-screenshots");
const SUMMARY_CSV = join(OUTPUT_ROOT, "screenshot-summary.csv");
const METADATA_ONLY = process.argv.includes("--metadata-only");

const PAGE_TYPES = ["about", "services", "gallery", "contact"];
const PAGE_PATTERNS = {
  about: [/about(?:-us|_us)?/i, /who-we-are/i, /our-story/i, /company/i],
  services: [/services?/i, /what-we-do/i, /our-services/i, /solutions/i],
  gallery: [/gallery/i, /projects?/i, /portfolio/i, /our-work/i, /work/i],
  contact: [/contact(?:-us|_us)?/i, /get-in-touch/i, /reach-us/i, /request-quote/i],
};

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }

  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

function csvEscape(value) {
  const text = String(value ?? "");
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function safeFolderName(name, index) {
  const slug = String(name ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
  return slug || `business-${index + 1}`;
}

function normalizeWebsite(url) {
  const text = String(url ?? "").trim();
  if (!text) return "";
  if (/^https?:\/\//i.test(text)) return text;
  return `https://${text}`;
}

function deriveOfferUrl(previewUrl) {
  const preview = String(previewUrl ?? "").trim();
  if (!preview) return "";
  if (preview.includes("/launch/")) return preview;
  return preview.replace(/\/p\//, "/launch/");
}

function parseBusinessRow(header, row, dataIndex) {
  const get = (column) => {
    const idx = header.indexOf(column);
    return idx === -1 ? "" : String(row[idx] ?? "").trim();
  };

  const previewUrl = get("Preview URL");
  return {
    sourceCsvRow: dataIndex + 2,
    businessName: get("Business Name"),
    industry: get("Industry"),
    city: get("City"),
    phone: get("Phone"),
    email: get("Email"),
    website: get("Website"),
    previewUrl,
    offerUrl: deriveOfferUrl(previewUrl),
    outreachStatus: get("Outreach Status") || "not_contacted",
  };
}

function normalizePhoneDigits(phone) {
  return String(phone ?? "").replace(/[^\d+]/g, "");
}

function encodeSmsBody(text) {
  return encodeURIComponent(String(text ?? "").trim());
}

function encodeMail(text) {
  return encodeURIComponent(String(text ?? "").trim());
}

function defaultPreviewText(business) {
  return defaultFollowUpText(business, business.previewUrl || business.website || "");
}

function buildActionLinks(business) {
  const phone = normalizePhoneDigits(business.phone);
  const email = String(business.email ?? "").trim();
  const preview = String(business.previewUrl ?? "").trim();
  const offer = String(business.offerUrl ?? "").trim();

  return {
    call: phone ? `tel:${phone}` : "",
    text: phone ? `sms:${phone}?body=${encodeSmsBody(defaultPreviewText(business))}` : "",
    email: email
      ? `mailto:${email}?subject=${encodeMail(defaultEmailSubject(business))}&body=${encodeMail(defaultEmailBody(business))}`
      : "",
    preview,
    offer,
  };
}

function relativeFolderPath(folderName) {
  return join("data", "website-screenshots", folderName).replace(/\\/g, "/");
}

function sameOrigin(candidate, base) {
  try {
    const a = new URL(candidate);
    const b = new URL(base);
    return a.origin === b.origin;
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

async function fileExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function loadChromium() {
  try {
    const { chromium } = await import("playwright");
    return chromium;
  } catch {
    throw new Error(
      "Playwright is required. Run: npm install && npx playwright install chromium",
    );
  }
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
  if (!response) {
    throw new Error("No response from page");
  }
  if (response.status() >= 400) {
    throw new Error(`HTTP ${response.status()}`);
  }
  await page.waitForTimeout(1200);
  await page.screenshot({ path: outputPath, fullPage: true });
}

async function readScreenshotFlags(folderPath) {
  return {
    home: await fileExists(join(folderPath, "home.png")),
    about: await fileExists(join(folderPath, "about.png")),
    services: await fileExists(join(folderPath, "services.png")),
    gallery: await fileExists(join(folderPath, "gallery.png")),
    contact: await fileExists(join(folderPath, "contact.png")),
  };
}

function flagsToCaptured(flags) {
  return {
    home: flags.home,
    about: flags.about,
    services: flags.services,
    gallery: flags.gallery,
    contact: flags.contact,
  };
}

function flagsToSummary(flags) {
  return {
    homeCaptured: flags.home ? "yes" : "no",
    aboutCaptured: flags.about ? "yes" : "no",
    servicesCaptured: flags.services ? "yes" : "no",
    galleryCaptured: flags.gallery ? "yes" : "no",
    contactCaptured: flags.contact ? "yes" : "no",
  };
}

function buildContactCard(business, actions) {
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
    "Suggested manual actions:",
    "",
    "Call: " + (actions.call || "(no phone)"),
    "Text: " + (actions.text || "(no phone)"),
    "Email: " + (actions.email || "(no email)"),
    "Open Preview: " + (actions.preview || "(no preview link)"),
    "Open Offer: " + (actions.offer || "(no offer link)"),
    "",
  ].join("\n");
}

async function writeFolderMetadata(business, folderName, folderPath, screenshotsCaptured, screenshotErrors) {
  const actions = buildActionLinks(business);
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

  return metadata;
}

function buildSummaryRow(business, folderName, flags, errors) {
  const summaryFlags = flagsToSummary(flags);
  return {
    businessName: business.businessName,
    phone: business.phone,
    email: business.email,
    industry: business.industry,
    city: business.city,
    website: normalizeWebsite(business.website),
    previewUrl: business.previewUrl,
    offerUrl: business.offerUrl,
    outreachStatus: business.outreachStatus,
    folderPath: relativeFolderPath(folderName),
    ...summaryFlags,
    errors: errors || "",
  };
}

async function backfillMetadata(business, index) {
  const folderName = safeFolderName(business.businessName, index);
  const folderPath = join(OUTPUT_ROOT, folderName);
  await mkdir(folderPath, { recursive: true });

  const flags = await readScreenshotFlags(folderPath);
  const screenshotsCaptured = flagsToCaptured(flags);
  const errors = !business.website
    ? "No website URL"
    : flags.home
      ? ""
      : "No screenshots captured yet";

  await writeFolderMetadata(business, folderName, folderPath, screenshotsCaptured, errors);
  return buildSummaryRow(business, folderName, flags, errors);
}

async function captureScreenshots(browser, business, index) {
  const folderName = safeFolderName(business.businessName, index);
  const folderPath = join(OUTPUT_ROOT, folderName);
  const website = normalizeWebsite(business.website);

  await mkdir(folderPath, { recursive: true });

  let flags = await readScreenshotFlags(folderPath);
  const errors = [];
  let skippedCapture = false;

  if (!website) {
    const screenshotErrors = "No website URL";
    await writeFolderMetadata(business, folderName, folderPath, flagsToCaptured(flags), screenshotErrors);
    return buildSummaryRow(business, folderName, flags, screenshotErrors);
  }

  const homePath = join(folderPath, "home.png");
  if (flags.home) {
    skippedCapture = true;
  } else {
    const page = await browser.newPage();
    try {
      await page.setViewportSize({ width: 1440, height: 1200 });

      try {
        await capturePage(page, website, homePath);
        flags.home = true;
      } catch (err) {
        errors.push(`home: ${err.message}`);
      }

      if (flags.home) {
        let pageLinks = {};
        try {
          const links = await collectLinks(page);
          pageLinks = pickPageLinks(links, page.url());
        } catch (err) {
          errors.push(`link-scan: ${err.message}`);
        }

        for (const type of PAGE_TYPES) {
          const targetUrl = pageLinks[type];
          if (!targetUrl) continue;
          const outputPath = join(folderPath, `${type}.png`);
          try {
            await capturePage(page, targetUrl, outputPath);
            flags[type] = true;
          } catch (err) {
            errors.push(`${type}: ${err.message}`);
          }
        }
      }
    } finally {
      await page.close();
    }
  }

  if (skippedCapture) {
    errors.unshift("Skipped screenshot (home.png already exists)");
  }

  const screenshotErrors = errors.filter(Boolean).join(" | ");
  await writeFolderMetadata(
    business,
    folderName,
    folderPath,
    flagsToCaptured(flags),
    screenshotErrors,
  );

  return buildSummaryRow(business, folderName, flags, screenshotErrors);
}

async function writeSummaryCsv(summaryRows) {
  const summaryHeader = [
    "Business Name",
    "Phone",
    "Email",
    "Industry",
    "City",
    "Website",
    "Preview URL",
    "Offer URL",
    "Outreach Status",
    "Folder Path",
    "Home Captured",
    "About Captured",
    "Services Captured",
    "Gallery Captured",
    "Contact Captured",
    "Errors",
  ];

  const summaryCsv = [
    summaryHeader.join(","),
    ...summaryRows.map((row) =>
      [
        row.businessName,
        row.phone,
        row.email,
        row.industry,
        row.city,
        row.website,
        row.previewUrl,
        row.offerUrl,
        row.outreachStatus,
        row.folderPath,
        row.homeCaptured,
        row.aboutCaptured,
        row.servicesCaptured,
        row.galleryCaptured,
        row.contactCaptured,
        row.errors,
      ]
        .map(csvEscape)
        .join(","),
    ),
  ].join("\n");

  await writeFile(SUMMARY_CSV, `${summaryCsv}\n`, "utf8");
}

async function loadBusinesses() {
  const csvText = await readFile(INPUT_CSV, "utf8");
  const table = parseCsv(csvText);
  const [header, ...dataRows] = table;
  if (!header?.length) {
    throw new Error(`CSV header missing in ${INPUT_CSV}`);
  }
  if (header.indexOf("Business Name") === -1) {
    throw new Error("CSV must include Business Name column");
  }

  return dataRows
    .filter((row) => row.some((cell) => String(cell ?? "").trim()))
    .map((row, index) => parseBusinessRow(header, row, index));
}

async function main() {
  const businesses = await loadBusinesses();
  await mkdir(OUTPUT_ROOT, { recursive: true });
  const summaryRows = [];

  if (METADATA_ONLY) {
    console.log(`Backfilling metadata for ${businesses.length} businesses...`);
    for (let i = 0; i < businesses.length; i += 1) {
      const business = businesses[i];
      console.log(`[${i + 1}/${businesses.length}] ${business.businessName}`);
      summaryRows.push(await backfillMetadata(business, i));
    }
  } else {
    const chromium = await loadChromium();
    const browser = await chromium.launch({ headless: true });

    try {
      for (let i = 0; i < businesses.length; i += 1) {
        const business = businesses[i];
        console.log(`[${i + 1}/${businesses.length}] ${business.businessName}`);
        try {
          const result = await captureScreenshots(browser, business, i);
          summaryRows.push(result);
          if (result.errors) {
            console.log(`  note: ${result.errors}`);
          }
        } catch (err) {
          const folderName = safeFolderName(business.businessName, i);
          const folderPath = join(OUTPUT_ROOT, folderName);
          await mkdir(folderPath, { recursive: true });
          const flags = await readScreenshotFlags(folderPath);
          await writeFolderMetadata(
            business,
            folderName,
            folderPath,
            flagsToCaptured(flags),
            err.message,
          );
          summaryRows.push(buildSummaryRow(business, folderName, flags, err.message));
          console.log(`  error: ${err.message}`);
        }

        if (i < businesses.length - 1) {
          await sleep(2000);
        }
      }
    } finally {
      await browser.close();
    }
  }

  await writeSummaryCsv(summaryRows);
  console.log(`\nDone. Summary written to ${SUMMARY_CSV}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
