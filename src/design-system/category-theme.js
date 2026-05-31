/**
 * Premium Design System V1 — resolved category theme for preview generation
 */

import { getThemeByCategory } from "./themes.js";
import { getImageRules } from "./image-rules.js";

/**
 * Full theme bundle for a business category (colors + image placeholders).
 * @param {string} category
 */
export function getCategoryTheme(category) {
  const base = getThemeByCategory(category);
  const images = getImageRules(base.key);

  return {
    key: base.key,
    label: base.label,

    // Semantic tokens (design system)
    dark: base.dark,
    primary: base.primary,
    accent: base.accent,
    background: base.background,
    text: base.text,
    muted: base.muted,
    star: base.star,
    panel: base.panel,

    // Image placeholders
    heroPhoto: images.heroBackground,
    imageBg: images.supportingBackground,
    ctaBg: images.ctaBackground,
    heroAriaLabel: images.heroAriaLabel,
    supportingLabel: images.supportingLabel,
    acceptableImageThemes: images.acceptableThemes,

    // Legacy aliases used by preview-v3 CSS/HTML
    brand: base.primary,
    brandDark: base.dark,
    brandPanel: base.panel,
    gold: base.star,
    bg: base.background,
  };
}
