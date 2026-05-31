import { access, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { getThemeByCategory } from "../design-system/themes.js";

export const AI_ASSET_FILES = {
  hero: "ai-hero.jpg",
  support: "ai-support.jpg",
  cta: "ai-cta.jpg",
};

const PHOTO_STYLE =
  "Photorealistic local service business photography for a website concept mockup only. Natural daylight, sharp focus, believable US residential/commercial setting. No text, no logos, no watermarks, no cartoons, no illustrations, not a stock template.";

const CONCEPT_NOTE =
  "This is concept preview art for a website design — not an actual completed client project photo.";

/** @type {Record<string, { hero: string; support: string; cta: string }>} */
const CATEGORY_PROMPTS = {
  tree: {
    hero: `Wide cinematic hero photo: professional arborist in a bucket truck trimming a large tree at a wooded residential jobsite, sawdust in the air, safety gear, ${PHOTO_STYLE} ${CONCEPT_NOTE}`,
    support: `Medium shot: tree service crew with chainsaw and stump grinder at a suburban wooded property, teamwork, professional uniforms without readable branding, ${PHOTO_STYLE} ${CONCEPT_NOTE}`,
    cta: `Moody wide shot: storm-damaged tree cleanup with crew and chipper at dusk, dramatic sky, ${PHOTO_STYLE} ${CONCEPT_NOTE}`,
  },
  plumbing: {
    hero: `Wide hero photo: licensed plumber repairing pipes under a kitchen sink in a clean modern home, tools and flashlight, professional appearance, ${PHOTO_STYLE} ${CONCEPT_NOTE}`,
    support: `Medium shot: plumber with wrench and toolbox in a bright residential bathroom, friendly professional at work, ${PHOTO_STYLE} ${CONCEPT_NOTE}`,
    cta: `Wide shot: plumber inspecting water heater in a tidy utility room, warm interior light, ${PHOTO_STYLE} ${CONCEPT_NOTE}`,
  },
  pressure: {
    hero: `Wide hero photo: pressure washing technician spraying a residential driveway, visible water spray and clean concrete contrast, professional equipment, ${PHOTO_STYLE} ${CONCEPT_NOTE}`,
    support: `Medium shot: worker pressure washing house siding with surface cleaner attachment, satisfying clean streaks, ${PHOTO_STYLE} ${CONCEPT_NOTE}`,
    cta: `Wide shot: gleaming clean concrete patio and driveway after pressure washing, suburban home exterior, ${PHOTO_STYLE} ${CONCEPT_NOTE}`,
  },
  roofing: {
    hero: `Wide hero photo: professional roofing crew installing asphalt shingles on a suburban home, ladder and safety harness, clear sky, ${PHOTO_STYLE} ${CONCEPT_NOTE}`,
    support: `Medium shot: roofer inspecting shingles on a residential roof, professional exterior, ${PHOTO_STYLE} ${CONCEPT_NOTE}`,
    cta: `Wide shot: completed roof on a beautiful home exterior, roofing tools staged neatly, golden hour, ${PHOTO_STYLE} ${CONCEPT_NOTE}`,
  },
  landscaping: {
    hero: `Wide hero photo: landscaping crew mowing and maintaining a lush green lawn at a suburban home, professional equipment, ${PHOTO_STYLE} ${CONCEPT_NOTE}`,
    support: `Medium shot: landscapers trimming hedges and mulching garden beds, tidy residential yard, ${PHOTO_STYLE} ${CONCEPT_NOTE}`,
    cta: `Wide shot: beautifully landscaped front yard with healthy lawn and flower beds, ${PHOTO_STYLE} ${CONCEPT_NOTE}`,
  },
  hvac: {
    hero: `Wide hero photo: HVAC technician servicing an outdoor AC unit beside a home, gauges and tools, professional uniform without readable text, ${PHOTO_STYLE} ${CONCEPT_NOTE}`,
    support: `Medium shot: technician checking thermostat and indoor furnace, clean home interior, ${PHOTO_STYLE} ${CONCEPT_NOTE}`,
    cta: `Wide shot: modern home exterior with technician finishing AC maintenance, ${PHOTO_STYLE} ${CONCEPT_NOTE}`,
  },
  generic: {
    hero: `Wide hero photo: skilled local service technician at work on a residential property, professional tools, trustworthy appearance, ${PHOTO_STYLE} ${CONCEPT_NOTE}`,
    support: `Medium shot: service team member completing quality work at a suburban home, ${PHOTO_STYLE} ${CONCEPT_NOTE}`,
    cta: `Wide shot: satisfied service scene at a well-kept home exterior, ${PHOTO_STYLE} ${CONCEPT_NOTE}`,
  },
};

const IMAGE_SIZES = {
  hero: "1792x1024",
  support: "1024x1024",
  cta: "1792x1024",
};

export function getApiKey() {
  return process.env.OPENAI_API_KEY?.trim() ?? "";
}

export function hasOpenAiKey() {
  return Boolean(getApiKey());
}

export function getPromptsForCategory(category) {
  const theme = getThemeByCategory(category);
  return CATEGORY_PROMPTS[theme.key] ?? CATEGORY_PROMPTS.generic;
}

async function callOpenAiImage(prompt, size) {
  const apiKey = getApiKey();
  if (!apiKey) return null;

  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "dall-e-3",
      prompt,
      n: 1,
      size,
      quality: "standard",
      response_format: "url",
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI Images API error (${response.status}): ${body}`);
  }

  const payload = await response.json();
  const imageUrl = payload?.data?.[0]?.url;
  if (!imageUrl) return null;

  const imageResponse = await fetch(imageUrl);
  if (!imageResponse.ok) return null;

  return Buffer.from(await imageResponse.arrayBuffer());
}

/**
 * Generate AI fallback files for missing slots.
 * @param {object} options
 * @param {object} options.lead
 * @param {string} options.assetsDir
 * @param {string[]} options.slots - e.g. ['hero','support','cta']
 */
export async function generateAiAssets({ lead, assetsDir, slots }) {
  const category = lead.category ?? "Local Service";
  const prompts = getPromptsForCategory(category);
  const written = {};

  for (const slot of slots) {
    const filename = AI_ASSET_FILES[slot];
    if (!filename) continue;

    const outPath = join(assetsDir, filename);
    try {
      await access(outPath);
      written[slot] = `assets/${filename}`;
      continue;
    } catch {
      // generate
    }

    const size = IMAGE_SIZES[slot] ?? "1024x1024";
    const buffer = await callOpenAiImage(prompts[slot], size);
    if (!buffer) continue;

    await writeFile(outPath, buffer);
    written[slot] = `assets/${filename}`;
  }

  return written;
}
