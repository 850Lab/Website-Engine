/**
 * Premium Design System V1 — category image placeholders & gradients
 * No random stock URLs; intentional CSS gradients per category.
 */

import { THEMES } from "./themes.js";

function hexToRgb(hex) {
  const h = hex.replace("#", "");
  const n = parseInt(h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgba(hex, alpha) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const IMAGE_RULES = {
  tree: {
    heroBackground: `
      linear-gradient(105deg, ${rgba("#062b1f", 0.9)} 0%, ${rgba("#062b1f", 0.55)} 45%, ${rgba("#062b1f", 0.25)} 100%),
      radial-gradient(ellipse 85% 65% at 78% 22%, ${rgba("#65c83f", 0.35)} 0%, transparent 50%),
      radial-gradient(ellipse 55% 45% at 15% 85%, ${rgba("#14532d", 0.55)} 0%, transparent 45%),
      linear-gradient(165deg, #1a5c38 0%, #14532d 35%, #062b1f 70%, #041a12 100%)`,
    supportingBackground: `
      radial-gradient(ellipse 70% 60% at 30% 20%, ${rgba("#65c83f", 0.35)} 0%, transparent 50%),
      linear-gradient(155deg, #14532d 0%, #1a5c38 45%, #062b1f 100%)`,
    ctaBackground: `
      linear-gradient(105deg, ${rgba("#062b1f", 0.92)} 0%, ${rgba("#062b1f", 0.75)} 100%),
      linear-gradient(160deg, #062b1f 0%, #14532d 100%)`,
    heroAriaLabel: "Arborist and tree crew at work",
    supportingLabel: "Our crew on site",
    acceptableThemes: [
      "arborist in bucket truck",
      "stump grinding",
      "storm cleanup",
      "crew with chainsaw",
      "wooded residential background",
    ],
  },
  plumbing: {
    heroBackground: `
      linear-gradient(105deg, ${rgba("#082f49", 0.9)} 0%, ${rgba("#082f49", 0.5)} 50%, ${rgba("#082f49", 0.2)} 100%),
      radial-gradient(ellipse 80% 60% at 75% 30%, ${rgba("#0ea5e9", 0.3)} 0%, transparent 50%),
      linear-gradient(165deg, #0c4a6e 0%, #0369a1 50%, #082f49 100%)`,
    supportingBackground: `linear-gradient(155deg, #082f49 0%, #0369a1 50%, #0ea5e9 100%)`,
    ctaBackground: `linear-gradient(160deg, ${rgba("#082f49", 0.95)} 0%, #082f49 100%)`,
    heroAriaLabel: "Licensed plumber at work",
    supportingLabel: "Professional plumbing service",
    acceptableThemes: [
      "plumber under sink",
      "water heater install",
      "pipe repair",
      "service van",
      "residential bathroom",
    ],
  },
  pressure: {
    heroBackground: `
      linear-gradient(105deg, ${rgba("#0f172a", 0.9)} 0%, ${rgba("#0f172a", 0.5)} 50%, transparent 100%),
      radial-gradient(ellipse 75% 55% at 70% 25%, ${rgba("#38bdf8", 0.35)} 0%, transparent 50%),
      linear-gradient(165deg, #1e3a5f 0%, #1d4ed8 55%, #0f172a 100%)`,
    supportingBackground: `linear-gradient(155deg, #0f172a 0%, #1d4ed8 50%, #38bdf8 100%)`,
    ctaBackground: `linear-gradient(160deg, ${rgba("#0f172a", 0.95)} 0%, #0f172a 100%)`,
    heroAriaLabel: "Pressure washing driveway and siding",
    supportingLabel: "Before and after clean surfaces",
    acceptableThemes: [
      "driveway wash",
      "house siding spray",
      "deck cleaning",
      "commercial storefront",
      "technician with wand",
    ],
  },
  roofing: {
    heroBackground: `
      linear-gradient(105deg, ${rgba("#1e293b", 0.92)} 0%, ${rgba("#1e293b", 0.55)} 50%, transparent 100%),
      radial-gradient(ellipse 70% 50% at 80% 20%, ${rgba("#f97316", 0.25)} 0%, transparent 50%),
      linear-gradient(165deg, #334155 0%, #475569 50%, #1e293b 100%)`,
    supportingBackground: `linear-gradient(155deg, #1e293b 0%, #64748b 50%, #f97316 100%)`,
    ctaBackground: `linear-gradient(160deg, ${rgba("#1e293b", 0.95)} 0%, #1e293b 100%)`,
    heroAriaLabel: "Roofing crew on residential roof",
    supportingLabel: "Quality roof installation",
    acceptableThemes: [
      "shingle install",
      "roof inspection",
      "storm damage repair",
      "ladder on home",
      "aerial roof view",
    ],
  },
  landscaping: {
    heroBackground: `
      linear-gradient(105deg, ${rgba("#14532d", 0.88)} 0%, ${rgba("#14532d", 0.5)} 50%, transparent 100%),
      radial-gradient(ellipse 80% 60% at 72% 28%, ${rgba("#84cc16", 0.35)} 0%, transparent 50%),
      linear-gradient(165deg, #365314 0%, #3f6212 50%, #14532d 100%)`,
    supportingBackground: `linear-gradient(155deg, #14532d 0%, #4d7c0f 50%, #84cc16 100%)`,
    ctaBackground: `linear-gradient(160deg, ${rgba("#14532d", 0.95)} 0%, #14532d 100%)`,
    heroAriaLabel: "Landscaping crew maintaining lawn",
    supportingLabel: "Lawn and landscape professionals",
    acceptableThemes: [
      "mowing crew",
      "mulch and beds",
      "hedge trim",
      "irrigation",
      "lush green lawn",
    ],
  },
  hvac: {
    heroBackground: `
      linear-gradient(105deg, ${rgba("#172554", 0.9)} 0%, ${rgba("#172554", 0.5)} 50%, transparent 100%),
      radial-gradient(ellipse 75% 55% at 75% 25%, ${rgba("#60a5fa", 0.3)} 0%, transparent 50%),
      linear-gradient(165deg, #1e3a8a 0%, #2563eb 50%, #172554 100%)`,
    supportingBackground: `linear-gradient(155deg, #172554 0%, #2563eb 50%, #60a5fa 100%)`,
    ctaBackground: `linear-gradient(160deg, ${rgba("#172554", 0.95)} 0%, #172554 100%)`,
    heroAriaLabel: "HVAC technician servicing unit",
    supportingLabel: "Heating and cooling experts",
    acceptableThemes: [
      "AC unit service",
      "furnace install",
      "ductwork",
      "thermostat",
      "technician with tools",
    ],
  },
  generic: {
    heroBackground: `
      linear-gradient(105deg, ${rgba("#1e293b", 0.9)} 0%, ${rgba("#1e293b", 0.5)} 50%, transparent 100%),
      radial-gradient(ellipse 75% 55% at 75% 25%, ${rgba("#65c83f", 0.25)} 0%, transparent 50%),
      linear-gradient(165deg, #334155 0%, #475569 50%, #1e293b 100%)`,
    supportingBackground: `linear-gradient(155deg, #1e293b 0%, #475569 50%, #64748b 100%)`,
    ctaBackground: `linear-gradient(160deg, ${rgba("#1e293b", 0.95)} 0%, #1e293b 100%)`,
    heroAriaLabel: "Local service professional at work",
    supportingLabel: "Our team on site",
    acceptableThemes: [
      "technician at work",
      "service vehicle",
      "residential property",
      "tools and equipment",
      "happy homeowner",
    ],
  },
};

/**
 * @param {string} themeKey - e.g. tree, plumbing
 */
export function getImageRules(themeKey) {
  return IMAGE_RULES[themeKey] ?? IMAGE_RULES.generic;
}

/** Resolve image rules from category string */
export function getImageRulesForCategory(category) {
  const text = String(category ?? "");
  for (const key of Object.keys(THEMES)) {
    if (key === "generic") continue;
    if (THEMES[key].match.test(text)) {
      return getImageRules(key);
    }
  }
  return getImageRules("generic");
}
