import { access, mkdir } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { generatePreviewSiteV3, previewV3DirName, resolvePreviewV3Dir } from "./preview-v3.js";
import { slugifyBusinessName } from "./preview.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PREVIEWS_V3_ROOT = join(__dirname, "..", "previews-v3");
const RENDERS_ROOT = join(__dirname, "..", "renders");

export const VIEWPORTS = {
  desktop: { width: 1440, height: 1200 },
  mobile: { width: 390, height: 1200 },
};

/** Locate an existing v3 preview folder (same rules as resolvePreviewV3Dir). */
export async function findPreviewV3ForLead(lead) {
  const slug = slugifyBusinessName(lead.businessName);
  const canonicalDir = await resolvePreviewV3Dir(slug, lead.id);
  const canonicalIndexPath = join(canonicalDir, "index.html");
  try {
    await access(canonicalIndexPath);
    return {
      dir: canonicalDir,
      indexPath: canonicalIndexPath,
      slug,
      dirName: previewV3DirName(slug, lead.id),
    };
  } catch {
    const legacyDir = join(PREVIEWS_V3_ROOT, slug);
    const legacyIndexPath = join(legacyDir, "index.html");
    try {
      await access(legacyIndexPath);
      return { dir: legacyDir, indexPath: legacyIndexPath, slug, dirName: slug };
    } catch {
      return null;
    }
  }
}

async function ensurePreviewV3(lead) {
  const existing = await findPreviewV3ForLead(lead);
  if (existing) return existing;
  return generatePreviewSiteV3(lead);
}

async function loadChromium() {
  try {
    const { chromium } = await import("playwright");
    return chromium;
  } catch {
    throw new Error(
      "Playwright is required for render-preview-v3. Run: npm install && npx playwright install chromium"
    );
  }
}

/**
 * Render desktop + mobile screenshots for a lead's v3 preview.
 * @param {object} lead
 */
export async function renderPreviewV3Screenshots(lead) {
  const preview = await ensurePreviewV3(lead);
  const { indexPath, slug } = preview;
  const renderKey = preview.dirName ?? basename(preview.dir);
  const fileUrl = pathToFileURL(indexPath).href;

  const renderDir = join(RENDERS_ROOT, renderKey);
  await mkdir(renderDir, { recursive: true });

  const desktopPath = join(renderDir, "desktop.png");
  const mobilePath = join(renderDir, "mobile.png");

  const chromium = await loadChromium();
  const browser = await chromium.launch({ headless: true });

  try {
    const page = await browser.newPage();

    for (const [name, viewport] of Object.entries(VIEWPORTS)) {
      await page.setViewportSize(viewport);
      await page.goto(fileUrl, { waitUntil: "load", timeout: 60_000 });
      await new Promise((resolve) => setTimeout(resolve, 800));
      const path = name === "desktop" ? desktopPath : mobilePath;
      await page.screenshot({ path, fullPage: false });
    }
  } finally {
    await browser.close();
  }

  return { slug, renderSlug: renderKey, renderDir, desktopPath, mobilePath };
}
