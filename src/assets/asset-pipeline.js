import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { findPreviewV3ForLead } from "../render-preview-v3.js";
import { saveVerifiedRealAssets } from "./real-assets.js";
import { generateAiAssets, hasOpenAiKey, AI_ASSET_FILES } from "./ai-assets.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..", "..");

export const MANIFEST_FILE = "asset-manifest.json";
export const ASSETS_SUBDIR = "assets";

/** @typedef {"real"|"ai"|"custom"|"placeholder"} AssetSource */

/**
 * @typedef {object} AssetManifest
 * @property {AssetSource} source
 * @property {number} confidence
 * @property {string} hero
 * @property {string} support
 * @property {string} cta
 * @property {string[]} gallery
 */

export function getAssetsDir(previewDir) {
  return join(previewDir, ASSETS_SUBDIR);
}

export function getManifestPath(previewDir) {
  return join(getAssetsDir(previewDir), MANIFEST_FILE);
}

export async function loadEnvFile() {
  try {
    const envPath = join(PROJECT_ROOT, ".env");
    const text = await readFile(envPath, "utf8");
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      value = value.replace(/^["']|["']$/g, "");
      if (key && process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  } catch {
    // no .env file
  }
}

async function ensurePreviewDir(lead) {
  const existing = await findPreviewV3ForLead(lead);
  if (existing) return existing;
  const { generatePreviewSiteV3 } = await import("../preview-v3.js");
  return generatePreviewSiteV3(lead);
}

async function fileExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/** Legacy paths from earlier ai-images.js */
async function legacyAssetPaths(previewDir) {
  const assets = { hero: "", support: "", cta: "", gallery: [], source: "placeholder", confidence: 0 };
  const legacy = [
    ["hero", join(previewDir, "assets", "ai", "hero.jpg")],
    ["support", join(previewDir, "assets", "ai", "trust.jpg")],
    ["cta", join(previewDir, "assets", "ai", "cta.jpg")],
  ];
  let any = false;
  for (const [slot, abs] of legacy) {
    if (await fileExists(abs)) {
      const rel =
        slot === "hero"
          ? "assets/ai/hero.jpg"
          : slot === "support"
            ? "assets/ai/trust.jpg"
            : "assets/ai/cta.jpg";
      assets[slot] = rel;
      any = true;
    }
  }
  if (any) {
    assets.source = "ai";
  }
  return assets;
}

/**
 * Load asset manifest for preview rendering.
 * @param {string} previewDir
 * @returns {Promise<AssetManifest>}
 */
export async function loadAssetManifest(previewDir) {
  const manifestPath = getManifestPath(previewDir);
  try {
    const raw = await readFile(manifestPath, "utf8");
    const parsed = JSON.parse(raw);
    const manifest = {
      source: parsed.source ?? "placeholder",
      confidence: Number(parsed.confidence) || 0,
      hero: parsed.hero ?? "",
      support: parsed.support ?? "",
      cta: parsed.cta ?? "",
      gallery: Array.isArray(parsed.gallery) ? parsed.gallery : [],
    };

    for (const key of ["hero", "support", "cta"]) {
      if (manifest[key] && !(await fileExists(join(previewDir, manifest[key])))) {
        manifest[key] = "";
      }
    }
    manifest.gallery = (
      await Promise.all(
        manifest.gallery.map(async (item) =>
          item && (await fileExists(join(previewDir, item))) ? item : ""
        )
      )
    ).filter(Boolean);
    if (!manifest.hero && !manifest.support && !manifest.cta && manifest.gallery.length === 0) {
      manifest.source = "placeholder";
      manifest.confidence = 0;
    }
    return manifest;
  } catch {
    return legacyAssetPaths(previewDir);
  }
}

/**
 * Convert manifest to preview-v3 asset shape.
 * @param {AssetManifest} manifest
 */
export function manifestToPreviewAssets(manifest) {
  const paths = [manifest.hero, manifest.support, manifest.cta, ...(manifest.gallery ?? [])];
  const pathIsAi = (p) => String(p).includes("ai-");
  const pathIsReal = (p) => String(p).includes("real-");

  return {
    hero: manifest.hero || "",
    trust: manifest.support || "",
    cta: manifest.cta || "",
    gallery: manifest.gallery ?? [],
    source: manifest.source ?? "placeholder",
    confidence: manifest.confidence ?? 0,
    isReal: manifest.source === "real" || paths.some(pathIsReal),
    isAi: paths.some(pathIsAi),
    isPlaceholder: manifest.source === "placeholder",
  };
}

/**
 * Run full asset pipeline for a lead.
 * @param {object} lead
 */
export async function prepareAssetsForLead(lead) {
  await loadEnvFile();

  const preview = await ensurePreviewDir(lead);
  const assetsDir = getAssetsDir(preview.dir);
  await mkdir(assetsDir, { recursive: true });

  const log = [];

  log.push("Scanning for verified business images…");
  const real = await saveVerifiedRealAssets(lead, assetsDir);
  if (real.saved.length) {
    log.push(`  Saved ${real.saved.length} verified image(s) (confidence ≥ 70).`);
  } else {
    log.push("  No verified real images met confidence threshold.");
  }

  /** @type {AssetManifest} */
  const manifest = {
    source: "placeholder",
    confidence: real.confidence || 0,
    hero: real.files.hero ?? "",
    support: real.files.support ?? "",
    cta: "",
    gallery: real.files.gallery1 ? [real.files.gallery1] : [],
  };

  const aiSlots = [];
  if (!manifest.hero) aiSlots.push("hero");
  if (!manifest.support) aiSlots.push("support");
  if (!manifest.cta) aiSlots.push("cta");

  if (aiSlots.length) {
    if (hasOpenAiKey()) {
      log.push(`Generating AI concept images for: ${aiSlots.join(", ")}…`);
      try {
        const aiWritten = await generateAiAssets({
          lead,
          assetsDir,
          slots: aiSlots,
        });
        if (aiWritten.hero) manifest.hero = aiWritten.hero;
        if (aiWritten.support) manifest.support = aiWritten.support;
        if (aiWritten.cta) manifest.cta = aiWritten.cta;
        log.push(`  AI assets saved: ${Object.keys(aiWritten).join(", ") || "none"}.`);
      } catch (err) {
        log.push(`  AI generation skipped: ${err.message}`);
      }
    } else {
      log.push("OPENAI_API_KEY not set — skipping AI, using CSS placeholders for missing slots.");
    }
  }

  const hasReal =
    manifest.hero.includes("real-") ||
    manifest.support.includes("real-") ||
    manifest.gallery.some((g) => g.includes("real-"));
  const hasAi =
    manifest.hero.includes("ai-") ||
    manifest.support.includes("ai-") ||
    manifest.cta.includes("ai-");

  if (hasReal) {
    manifest.source = "real";
  } else if (hasAi) {
    manifest.source = "ai";
    manifest.confidence = 0;
  } else {
    manifest.source = "placeholder";
    manifest.confidence = 0;
  }

  const manifestPath = getManifestPath(preview.dir);
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  log.push(`Wrote ${ASSETS_SUBDIR}/${MANIFEST_FILE} (source: ${manifest.source}).`);

  const { generatePreviewSiteV3 } = await import("../preview-v3.js");
  await generatePreviewSiteV3(lead);

  return {
    previewDir: preview.dir,
    slug: preview.slug,
    manifest,
    manifestPath,
    log,
  };
}

function safeFileName(value, fallback) {
  const name = String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return name || fallback;
}

function parseDataUrl(dataUrl) {
  const match = String(dataUrl ?? "").match(/^data:(image\/(?:png|jpeg|jpg|webp));base64,([a-z0-9+/=\s]+)$/i);
  if (!match) {
    throw new Error("Custom image must be a PNG, JPG, or WEBP data URL.");
  }
  const mime = match[1].toLowerCase();
  const ext = mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : "jpg";
  return {
    ext,
    buffer: Buffer.from(match[2].replace(/\s+/g, ""), "base64"),
  };
}

/**
 * Save a manually supplied image into the preview asset manifest.
 * @param {object} lead
 * @param {{slot:string, filename?:string, dataUrl:string}} input
 */
export async function saveCustomAssetForLead(lead, input) {
  const slot = String(input?.slot ?? "hero").trim();
  if (!["hero", "support", "cta", "gallery"].includes(slot)) {
    throw new Error("Custom image slot must be hero, support, cta, or gallery.");
  }
  const parsed = parseDataUrl(input?.dataUrl);
  if (parsed.buffer.length > 5 * 1024 * 1024) {
    throw new Error("Custom image is too large. Use an image under 5 MB.");
  }

  const preview = await ensurePreviewDir(lead);
  const assetsDir = getAssetsDir(preview.dir);
  const customDir = join(assetsDir, "custom");
  await mkdir(customDir, { recursive: true });
  const baseName = safeFileName(input?.filename, `${slot}.${parsed.ext}`).replace(/\.(png|jpg|jpeg|webp)$/i, "");
  const fileName = `${slot}-${Date.now()}-${baseName}.${parsed.ext}`;
  const relPath = `assets/custom/${fileName}`;
  await writeFile(join(customDir, fileName), parsed.buffer);

  const manifest = await loadAssetManifest(preview.dir);
  manifest.source = "custom";
  manifest.confidence = 100;
  if (slot === "gallery") {
    manifest.gallery = [...(manifest.gallery ?? []), relPath].slice(-6);
  } else {
    manifest[slot] = relPath;
  }

  const manifestPath = getManifestPath(preview.dir);
  await mkdir(dirname(manifestPath), { recursive: true });
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  const { generatePreviewSiteV3 } = await import("../preview-v3.js");
  await generatePreviewSiteV3(lead);

  return {
    previewDir: preview.dir,
    manifestPath,
    manifest,
    slot,
    file: relPath,
  };
}
