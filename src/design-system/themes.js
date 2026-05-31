/**
 * Premium Design System V1 — category color themes
 * Tree palette per DESIGN_EXECUTION_SPEC.md; others use parallel themed palettes.
 */

export const THEMES = {
  tree: {
    key: "tree",
    match: /tree|stump|arbor/i,
    label: "Tree Care",
    dark: "#062b1f",
    primary: "#65c83f",
    accent: "#14532d",
    background: "#f7f8f4",
    text: "#1a1f16",
    muted: "#5c6356",
    star: "#f5b301",
    panel: "#14532d",
  },
  plumbing: {
    key: "plumbing",
    match: /plumb/i,
    label: "Plumbing",
    dark: "#082f49",
    primary: "#0ea5e9",
    accent: "#0369a1",
    background: "#f4f8fb",
    text: "#1a1f16",
    muted: "#5c6356",
    star: "#f5b301",
    panel: "#0c4a6e",
  },
  pressure: {
    key: "pressure",
    match: /pressure|power wash/i,
    label: "Pressure Washing",
    dark: "#0f172a",
    primary: "#38bdf8",
    accent: "#1d4ed8",
    background: "#f4f7fb",
    text: "#1a1f16",
    muted: "#5c6356",
    star: "#f5b301",
    panel: "#1e3a5f",
  },
  roofing: {
    key: "roofing",
    match: /roof/i,
    label: "Roofing",
    dark: "#1e293b",
    primary: "#f97316",
    accent: "#475569",
    background: "#f6f7f8",
    text: "#1a1f16",
    muted: "#5c6356",
    star: "#f5b301",
    panel: "#334155",
  },
  landscaping: {
    key: "landscaping",
    match: /landscap|lawn/i,
    label: "Landscaping",
    dark: "#14532d",
    primary: "#84cc16",
    accent: "#3f6212",
    background: "#f7f8f4",
    text: "#1a1f16",
    muted: "#5c6356",
    star: "#f5b301",
    panel: "#365314",
  },
  hvac: {
    key: "hvac",
    match: /hvac|heat|cool/i,
    label: "HVAC",
    dark: "#172554",
    primary: "#60a5fa",
    accent: "#2563eb",
    background: "#f4f6fb",
    text: "#1a1f16",
    muted: "#5c6356",
    star: "#f5b301",
    panel: "#1e3a8a",
  },
  generic: {
    key: "generic",
    match: /.*/,
    label: "Local Service",
    dark: "#1e293b",
    primary: "#65c83f",
    accent: "#334155",
    background: "#f7f8f4",
    text: "#1a1f16",
    muted: "#5c6356",
    star: "#f5b301",
    panel: "#334155",
  },
};

const THEME_ORDER = [
  "tree",
  "plumbing",
  "pressure",
  "roofing",
  "landscaping",
  "hvac",
  "generic",
];

/** Resolve theme definition by business category string */
export function getThemeByCategory(category) {
  const text = String(category ?? "");
  for (const key of THEME_ORDER) {
    if (key === "generic") continue;
    const theme = THEMES[key];
    if (theme.match.test(text)) return theme;
  }
  return THEMES.generic;
}
