import { access, mkdir, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { buildSalesBriefMarkdown } from "../src/sales-brief/industry-rules.js";
import {
  buildActionLinks,
  buildContactCard,
  captureScreenshotsForWebsite,
  flagsToCaptured,
  normalizeWebsite,
  readScreenshotFlags,
  relativeFolderPath,
  writeFolderMetadata,
} from "./website-pack-lib.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT_ROOT = join(ROOT, "data", "website-screenshots");

function readArg(name) {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return "";
  return String(process.argv[idx + 1] ?? "").trim();
}

function folderFromWebsite(url) {
  try {
    const hostname = new URL(normalizeWebsite(url)).hostname.replace(/^www\./i, "");
    return hostname.replace(/\./g, "-").toLowerCase();
  } catch {
    return "website";
  }
}

async function fileExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const website = normalizeWebsite(readArg("--website") || readArg("-w"));
  if (!website) {
    throw new Error("Usage: node scripts/run-single-website.js --website https://example.com [--name] [--industry] [--city] [--phone] [--email]");
  }

  const business = {
    sourceCsvRow: null,
    businessName: readArg("--name") || folderFromWebsite(website).replace(/-/g, " "),
    industry: readArg("--industry") || "General",
    city: readArg("--city") || "",
    phone: readArg("--phone") || "",
    email: readArg("--email") || "",
    website,
    previewUrl: readArg("--preview") || "",
    offerUrl: readArg("--offer") || "",
    outreachStatus: readArg("--status") || "not_contacted",
  };

  if (business.previewUrl && !business.offerUrl) {
    business.offerUrl = business.previewUrl.replace(/\/p\//, "/launch/");
  }

  const folderName = readArg("--folder") || folderFromWebsite(website);
  const folderPath = join(OUTPUT_ROOT, folderName);
  await mkdir(folderPath, { recursive: true });

  const skipIfHomeExists = !process.argv.includes("--force");
  if (skipIfHomeExists && (await fileExists(join(folderPath, "home.png")))) {
    console.log(`Skipping screenshots (${folderName}/home.png exists). Use --force to recapture.`);
  } else {
    console.log(`Capturing screenshots for ${website}...`);
    await captureScreenshotsForWebsite(website, folderPath);
  }

  const flags = await readScreenshotFlags(folderPath);
  const screenshotsCaptured = flagsToCaptured(flags);
  const errors = [];

  if (!flags.home) errors.push("home: not captured");

  business.actions = buildActionLinks(business);
  await writeFolderMetadata(
    business,
    folderName,
    folderPath,
    screenshotsCaptured,
    errors.join(" | "),
  );

  business.screenshotsCaptured = screenshotsCaptured;
  const brief = buildSalesBriefMarkdown(business);
  await writeFile(join(folderPath, "sales-brief.md"), brief, "utf8");

  console.log("\nDone.");
  console.log(`Folder: ${relativeFolderPath(folderName)}`);
  console.log(`Screenshots: ${Object.entries(screenshotsCaptured).filter(([, v]) => v).map(([k]) => k).join(", ") || "none"}`);
  console.log(`Sales brief: ${relativeFolderPath(folderName)}/sales-brief.md`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
