import { mkdir, writeFile, access } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { generateBrief } from "./brief.js";
import { slugifyBusinessName } from "./preview.js";
import {
  loadAssetManifest,
  manifestToPreviewAssets,
} from "./assets/asset-pipeline.js";
import { getCategoryTheme } from "./design-system/category-theme.js";
import { TOKENS, buildTokenCssVars } from "./design-system/tokens.js";
import {
  buildHeroCopy,
  getCtaLabels,
  getSectionCopy,
  serviceDescription,
  DEFAULT_TRUST_POINTS,
  DEFAULT_SERVICES,
} from "./design-system/copy-rules.js";
const __dirname = dirname(fileURLToPath(import.meta.url));
const PREVIEWS_V3_ROOT = join(__dirname, "..", "previews-v3");

const SERVICE_SVGS = [
  `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2"><path d="M24 8v32M16 16l8-8 8 8M12 40h24"/><circle cx="24" cy="12" r="4"/></svg>`,
  `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 40h32M14 40V22l10-10 10 10v18"/><path d="M20 28h8v12"/></svg>`,
  `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="24" cy="36" rx="14" ry="6"/><path d="M24 36V18M18 24h12"/></svg>`,
  `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2"><path d="M24 6l4 10h10l-8 6 3 10-9-6-9 6 3-10-8-6h10z"/></svg>`,
  `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="14" width="36" height="24" rx="2"/><path d="M6 22h36M14 14V8h20v6"/></svg>`,
];

const LOGO_MARK_SVG = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L4 14h5v8h6v-8h5L12 2z"/></svg>`;
const PHONE_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"/></svg>`;
const CALENDAR_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>`;
const MENU_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16M4 12h16M4 18h16"/></svg>`;

const HERO_TRUST_ICONS = ["✓", "★", "$"];

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function coalesce(...values) {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text) return text;
  }
  return "";
}

function phoneHref(phone) {
  const digits = String(phone ?? "").replace(/\D/g, "");
  return digits ? `tel:+${digits.length === 10 ? "1" : ""}${digits}` : "#contact";
}

function formatRating(rating) {
  const n = Number(rating);
  if (!n || n <= 0) return "5.0";
  return n.toFixed(1);
}

function buildLogoText(businessName) {
  const name = String(businessName ?? "Local Business").trim();
  const words = name.split(/\s+/);
  if (words.length <= 1) return { strong: name, rest: "" };
  return { strong: words[0], rest: words.slice(1).join(" ") };
}

function buildAssetImageCss(theme, assets = {}) {
  if (!assets.hero && !assets.trust && !assets.cta) return "";

  let css = "\n/* Asset pipeline imagery */\n";

  if (assets.hero) {
    css += `
.hero-bg.has-asset-photo {
  background: linear-gradient(105deg, rgba(0,0,0,0.62) 0%, rgba(0,0,0,0.42) 45%, rgba(0,0,0,0.28) 100%),
    url("${assets.hero}") center right / cover no-repeat;
}
`;
  }

  if (assets.trust) {
    css += `
.trust-image.has-asset-photo {
  background: url("${assets.trust}") center / cover no-repeat;
}
`;
    if (assets.isAi && assets.trust.includes("ai-")) {
      css += `
.trust-image.has-asset-photo.is-ai::before {
  content: "Concept preview · not a client photo";
}
`;
    } else if (assets.isReal && assets.trust.includes("real-")) {
      css += `
.trust-image.has-asset-photo.is-real::before {
  content: "From business website";
}
`;
    }
  }

  if (assets.cta) {
    css += `
.final-cta.has-asset-photo {
  background: linear-gradient(105deg, rgba(0,0,0,0.78) 0%, rgba(0,0,0,0.58) 100%),
    url("${assets.cta}") center / cover no-repeat;
}
`;
  }

  return css;
}

function buildStylesV3(theme, assets = {}) {
  const t = TOKENS;
  const bp = t.breakpoints;

  return `/* Preview V3 — Premium Design System V1 */
@import url("${t.typography.fontUrl}");

:root {
${buildTokenCssVars(theme)}
  --trust-label: "${theme.supportingLabel.replace(/"/g, '\\"')}";
}

*, *::before, *::after { box-sizing: border-box; }
html { scroll-behavior: smooth; }

body {
  margin: 0;
  font-family: var(--font);
  font-size: ${t.typography.bodySize};
  line-height: ${t.typography.bodyLineHeight};
  color: var(--ink);
  background: var(--bg);
  -webkit-font-smoothing: antialiased;
}

a { color: inherit; text-decoration: none; }

.container {
  width: min(100% - ${t.spacing.containerGutter}, var(--max));
  margin-inline: auto;
}

.site-header {
  position: sticky;
  top: 0;
  z-index: 500;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  box-shadow: var(--shadow-header);
}

.header-grid {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  height: var(--header-h);
  gap: ${t.spacing.lg};
}

.logo {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  justify-self: start;
  min-width: 0;
}

.logo-mark {
  flex-shrink: 0;
  width: 2.75rem;
  height: 2.75rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--brand);
  color: #fff;
  border-radius: ${t.borderRadius.circle};
}

.logo-mark svg { width: 1.35rem; height: 1.35rem; }

.logo-text {
  font-size: 0.7rem;
  font-weight: ${t.typography.weights.extrabold};
  letter-spacing: 0.07em;
  text-transform: uppercase;
  line-height: 1.2;
  color: var(--ink);
}

.logo-text strong {
  display: block;
  font-size: 0.92rem;
  letter-spacing: 0.04em;
}

.nav {
  display: none;
  align-items: center;
  justify-content: center;
  gap: 1.65rem;
  font-size: ${t.typography.navSize};
  font-weight: ${t.typography.weights.semibold};
  color: var(--ink-muted);
  justify-self: center;
}

.nav a {
  padding-bottom: 3px;
  border-bottom: 2px solid transparent;
  transition: color ${t.animation.fast}, border-color ${t.animation.fast};
}

.nav a:hover { color: var(--brand); }
.nav a.is-active { color: var(--brand); border-bottom-color: var(--brand); }

.header-end {
  display: flex;
  align-items: center;
  gap: ${t.spacing.md};
  justify-self: end;
}

.header-phone {
  display: none;
  flex-direction: column;
  align-items: flex-end;
  text-align: right;
}

.phone-num {
  display: flex;
  align-items: center;
  gap: ${t.spacing.xs};
  font-size: ${t.typography.phoneSize};
  font-weight: ${t.typography.weights.extrabold};
  color: var(--brand);
}

.phone-num svg { width: 1rem; height: 1rem; }

.phone-sub {
  font-size: 0.7rem;
  font-weight: ${t.typography.weights.semibold};
  color: var(--ink-muted);
}

.header-cta-mobile {
  display: inline-flex;
  padding: ${t.buttons.mobilePadding};
  background: var(--brand);
  color: #fff;
  font-weight: ${t.typography.weights.bold};
  font-size: ${t.buttons.mobileFontSize};
  border-radius: ${t.borderRadius.pill};
}

.nav-toggle {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0,0,0,0);
  border: 0;
}

.menu-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  border: 1px solid var(--border);
  border-radius: ${t.borderRadius.md};
  background: var(--bg);
  color: var(--ink);
  cursor: pointer;
}

.menu-btn svg { width: 1.25rem; height: 1.25rem; }

.nav-drawer {
  display: none;
  flex-direction: column;
  padding-bottom: ${t.spacing.lg};
  border-top: 1px solid var(--border);
}

.nav-drawer a {
  padding: 0.85rem 0;
  font-weight: ${t.typography.weights.semibold};
  font-size: 0.95rem;
  color: var(--ink-muted);
  border-bottom: 1px solid var(--border);
}

.nav-drawer a.is-active { color: var(--brand); }
.nav-toggle:checked ~ .nav-drawer { display: flex; }

@media (min-width: ${bp.nav}) {
  .nav, .header-phone { display: flex; }
  .header-cta-mobile, .menu-btn { display: none; }
  .nav-drawer { display: none !important; }
}

.hero {
  position: relative;
  min-height: var(--hero-min-h);
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  color: #fff;
  overflow: hidden;
}

.hero-bg {
  position: absolute;
  inset: 0;
  background: var(--hero-photo);
  background-size: cover;
  background-position: center right;
}

.hero-bg::after {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, transparent 50%, rgba(0,0,0,0.35) 100%);
  pointer-events: none;
}

.hero-inner {
  position: relative;
  z-index: 2;
  width: 100%;
  max-width: var(--hero-content-max);
  padding: ${t.spacing["3xl"]} 0 2.75rem;
}

.hero-badge {
  display: inline-block;
  margin-bottom: ${t.spacing.lg};
  font-size: ${t.typography.labelSize};
  font-weight: ${t.typography.weights.extrabold};
  letter-spacing: ${t.typography.labelTracking};
  text-transform: uppercase;
  color: var(--brand);
}

.hero h1 {
  margin: 0 0 ${t.spacing.lg};
  font-size: var(--hero-headline);
  font-weight: ${t.typography.weights.extrabold};
  line-height: 1.05;
  letter-spacing: -0.03em;
}

.hero h1 .accent {
  display: block;
  color: var(--brand);
}

.hero-sub {
  margin: 0 0 1.75rem;
  font-size: var(--hero-sub);
  line-height: 1.55;
  color: rgba(255,255,255,0.92);
  max-width: var(--body-max);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.hero-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.85rem;
  margin-bottom: ${t.spacing["2xl"]};
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: ${t.spacing.sm};
  padding: ${t.buttons.padding};
  font-weight: ${t.buttons.fontWeight};
  font-size: ${t.buttons.fontSize};
  border-radius: ${t.buttons.borderRadius};
  transition: transform ${t.animation.fast} var(--ease);
  border: none;
  cursor: pointer;
}

.btn svg { width: 1.1rem; height: 1.1rem; flex-shrink: 0; }

.btn-primary {
  background: var(--brand);
  color: #fff;
  box-shadow: ${t.shadows.button};
}

.btn-ghost {
  background: transparent;
  color: #fff;
  border: ${t.buttons.ghostBorder};
}

.btn:hover { transform: translateY(${t.animation.hoverLift}); }

.hero-trust {
  display: flex;
  flex-wrap: wrap;
  gap: 1.25rem ${t.spacing["2xl"]};
  padding-top: ${t.spacing.xl};
  border-top: 1px solid rgba(255,255,255,0.18);
}

.hero-trust-item {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  font-size: 0.88rem;
  font-weight: ${t.typography.weights.semibold};
}

.trust-icon {
  width: 2.25rem;
  height: 2.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--brand);
  color: #fff;
  border-radius: ${t.borderRadius.circle};
  font-size: 0.8rem;
  font-weight: ${t.typography.weights.extrabold};
  flex-shrink: 0;
}

.section-services {
  padding: ${t.spacing.sectionYLg} 0;
  background: var(--surface);
}

.section-head-center {
  text-align: center;
  max-width: ${t.sectionWidths.sectionHead};
  margin: 0 auto 2.75rem;
}

.section-label {
  display: block;
  margin-bottom: ${t.spacing.sm};
  font-size: ${t.typography.labelSize};
  font-weight: ${t.typography.weights.extrabold};
  letter-spacing: ${t.typography.labelTracking};
  text-transform: uppercase;
  color: var(--brand);
}

.section-head-center h2 {
  margin: 0 0 ${t.spacing.md};
  font-size: ${t.typography.sectionTitle};
  font-weight: ${t.typography.weights.extrabold};
  letter-spacing: -0.02em;
}

.section-head-center p {
  margin: 0 auto;
  max-width: var(--body-max);
  color: var(--ink-muted);
  font-size: 1.02rem;
}

.services-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: ${t.spacing.lg};
}

@media (min-width: ${bp.services}) {
  .services-grid { grid-template-columns: repeat(5, 1fr); }
}

.service-card {
  display: flex;
  flex-direction: column;
  padding: ${t.spacing.xl} 1.15rem;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow-card);
  transition: transform ${t.animation.normal} var(--ease), box-shadow ${t.animation.normal} var(--ease);
}

.service-card:hover {
  transform: translateY(${t.animation.cardLift});
  box-shadow: ${t.shadows.cardHover};
}

.service-icon {
  width: 2.5rem;
  height: 2.5rem;
  color: var(--brand);
  margin-bottom: ${t.spacing.lg};
}

.service-icon svg { width: 100%; height: 100%; }

.service-card h3 {
  margin: 0 0 0.45rem;
  font-size: 0.95rem;
  font-weight: ${t.typography.weights.extrabold};
  line-height: 1.3;
}

.service-card p {
  margin: 0 0 ${t.spacing.lg};
  flex: 1;
  font-size: 0.84rem;
  color: var(--ink-muted);
  line-height: 1.5;
  max-width: ${t.sectionWidths.serviceDesc};
}

.learn-more {
  font-size: 0.85rem;
  font-weight: ${t.typography.weights.bold};
  color: var(--brand);
}

.learn-more:hover { text-decoration: underline; }

.trust-section { background: var(--bg); }

.trust-split { display: grid; gap: 0; }

@media (min-width: ${bp.nav}) {
  .trust-split {
    grid-template-columns: 1fr 1fr;
    min-height: ${t.spacing.trustMinHeight};
  }
}

.trust-left {
  padding: clamp(2.5rem, 6vw, 3.5rem);
  background: var(--brand-panel);
  color: #fff;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.trust-left .section-label { color: var(--brand); }

.trust-left h2 {
  margin: 0 0 1.25rem;
  font-size: ${t.typography.trustTitle};
  font-weight: ${t.typography.weights.extrabold};
  line-height: 1.2;
  max-width: 18ch;
}

.trust-checklist {
  margin: 0 0 1.75rem;
  padding: 0;
  list-style: none;
}

.trust-checklist li {
  display: flex;
  gap: 0.65rem;
  align-items: flex-start;
  margin-bottom: 0.85rem;
  font-size: 0.95rem;
  font-weight: ${t.typography.weights.medium};
}

.trust-checklist li::before {
  content: "✓";
  flex-shrink: 0;
  width: 1.35rem;
  height: 1.35rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--brand);
  color: #fff;
  border-radius: ${t.borderRadius.circle};
  font-size: 0.72rem;
  font-weight: ${t.typography.weights.extrabold};
}

.trust-right {
  padding: ${t.spacing.xl};
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg);
}

.trust-image {
  width: 100%;
  max-width: ${t.sectionWidths.trustImage};
  aspect-ratio: 4/3;
  border-radius: var(--radius);
  overflow: hidden;
  border: 6px solid var(--surface);
  box-shadow: var(--shadow-card);
  background: var(--image-bg);
  position: relative;
}

.trust-image::before {
  content: var(--trust-label);
  position: absolute;
  bottom: ${t.spacing.lg};
  left: ${t.spacing.lg};
  right: ${t.spacing.lg};
  padding: 0.65rem 0.85rem;
  font-size: 0.8rem;
  font-weight: ${t.typography.weights.semibold};
  background: rgba(0,0,0,0.55);
  border-radius: ${t.borderRadius.sm};
  color: #fff;
  z-index: 1;
}

.reviews-section {
  padding: ${t.spacing.sectionY} 0;
  background: var(--surface);
  border-top: 1px solid var(--border);
}

.reviews-inner {
  display: grid;
  gap: 2.5rem;
  align-items: center;
}

@media (min-width: ${bp.reviews}) {
  .reviews-inner { grid-template-columns: auto 1fr; gap: ${t.spacing["3xl"]}; }
}

.reviews-stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${t.spacing["2xl"]};
}

.stat-block .num {
  display: block;
  font-size: ${t.typography.statNumber};
  font-weight: ${t.typography.weights.extrabold};
  color: var(--brand);
  line-height: 1.05;
}

.stat-block .lbl {
  font-size: 0.88rem;
  font-weight: ${t.typography.weights.semibold};
  color: var(--ink-muted);
}

.reviews-quote-wrap { max-width: var(--body-max); }

.testimonial-stars {
  color: var(--gold);
  font-size: 1.2rem;
  letter-spacing: 0.12em;
  margin-bottom: ${t.spacing.md};
}

.testimonial-quote {
  margin: 0 0 ${t.spacing.lg};
  font-size: clamp(1.1rem, 2.5vw, 1.35rem);
  font-style: italic;
  line-height: 1.55;
  color: var(--ink);
}

.testimonial-author {
  margin: 0;
  font-size: 0.9rem;
  font-weight: ${t.typography.weights.bold};
  color: var(--ink-muted);
}

.final-cta {
  position: relative;
  padding: ${t.spacing.sectionYLg} 0;
  background: var(--cta-bg);
  color: #fff;
  overflow: hidden;
}

.final-cta-inner {
  position: relative;
  z-index: 2;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: ${t.spacing["2xl"]};
}

@media (min-width: ${bp.reviews}) {
  .final-cta-inner {
    justify-content: space-between;
    text-align: left;
  }
}

.cta-icon {
  width: 3.5rem;
  height: 3.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--brand);
  border-radius: ${t.borderRadius.xl};
  flex-shrink: 0;
}

.cta-icon svg { width: 1.75rem; height: 1.75rem; color: #fff; }

.cta-copy h2 {
  margin: 0 0 0.35rem;
  font-size: ${t.typography.ctaTitle};
  font-weight: ${t.typography.weights.extrabold};
}

.cta-copy p {
  margin: 0;
  color: rgba(255,255,255,0.82);
  font-size: ${t.typography.bodySize};
  max-width: var(--body-max);
}

.cta-actions {
  display: flex;
  flex-wrap: wrap;
  gap: ${t.spacing.md};
}

.site-footer {
  background: var(--brand-dark);
  color: rgba(255,255,255,0.82);
  padding: 3.5rem 0 0;
}

.footer-grid {
  display: grid;
  gap: ${t.spacing["2xl"]};
  padding-bottom: 2.5rem;
}

@media (min-width: ${bp.reviews}) {
  .footer-grid { grid-template-columns: 1.4fr 1fr 1fr 1.2fr; }
}

.footer-brand .logo-text { color: #fff; }
.footer-brand .logo-mark { margin-bottom: ${t.spacing.md}; }

.footer-about {
  margin: ${t.spacing.lg} 0;
  font-size: 0.92rem;
  line-height: ${t.typography.bodyLineHeight};
  max-width: ${t.sectionWidths.footerAbout};
}

.social-links { display: flex; gap: 0.65rem; }

.social-links a {
  width: 2rem;
  height: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255,255,255,0.1);
  border-radius: ${t.borderRadius.circle};
  font-size: 0.7rem;
  font-weight: ${t.typography.weights.extrabold};
  color: #fff;
}

.footer-col h3 {
  margin: 0 0 ${t.spacing.lg};
  font-size: ${t.typography.labelSize};
  font-weight: ${t.typography.weights.extrabold};
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(255,255,255,0.45);
}

.footer-col ul { margin: 0; padding: 0; list-style: none; }
.footer-col li { margin-bottom: 0.4rem; }
.footer-col a { font-size: 0.92rem; font-weight: ${t.typography.weights.medium}; color: rgba(255,255,255,0.88); }
.footer-col a:hover { color: var(--brand); }

.footer-badge {
  display: inline-flex;
  margin-top: ${t.spacing.md};
  padding: 0.4rem 0.75rem;
  font-size: 0.75rem;
  font-weight: ${t.typography.weights.bold};
  background: rgba(255,255,255,0.08);
  border-radius: ${t.borderRadius.sm};
}

.footer-bottom {
  padding: 1.25rem 0;
  border-top: 1px solid rgba(255,255,255,0.1);
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem 1.5rem;
  justify-content: space-between;
  font-size: 0.82rem;
  color: rgba(255,255,255,0.45);
}

.footer-bottom a { color: rgba(255,255,255,0.55); }
.footer-bottom a:hover { color: #fff; }
.preview-credit { opacity: 0.65; }
${buildAssetImageCss(theme, assets)}
`;
}

function buildHtmlV3(lead, brief, assets = {}) {
  const category = coalesce(brief.category, lead.category, "Local Service");
  const theme = getCategoryTheme(category);
  const name = coalesce(brief.businessName, lead.businessName, "Local Business");
  const city = coalesce(brief.city, lead.city, "your area");
  const phone = coalesce(lead.phone, "");
  const tel = phoneHref(lead.phone);

  const ctaLabels = getCtaLabels(category, brief.ctaText, phone);
  const sectionCopy = getSectionCopy(category, city);
  const hero = buildHeroCopy(category, city);

  const nameHtml = escapeHtml(name);
  const categoryHtml = escapeHtml(category);
  const cityHtml = escapeHtml(city);
  const ctaHtml = escapeHtml(ctaLabels.estimate);
  const phoneHtml = escapeHtml(phone || "Call now");

  const logo = buildLogoText(name);
  const heroAriaBase = `${theme.heroAriaLabel} in ${city}`;
  let heroAriaSuffix = heroAriaBase;
  if (assets.hero && assets.isAi) {
    heroAriaSuffix = `Website concept preview (AI-generated, not a client project photo): ${heroAriaBase}`;
  } else if (assets.hero && assets.isReal) {
    heroAriaSuffix = `Business website photo used for preview: ${heroAriaBase}`;
  }
  const heroAria = escapeHtml(heroAriaSuffix);

  const heroBgClass = assets.hero
    ? `hero-bg has-asset-photo${assets.isAi && assets.hero.includes("ai-") ? " is-ai" : assets.isReal ? " is-real" : ""}`
    : "hero-bg";
  const trustImageClass = assets.trust
    ? `trust-image has-asset-photo${assets.trust.includes("ai-") ? " is-ai" : assets.trust.includes("real-") ? " is-real" : ""}`
    : "trust-image";
  const finalCtaClass = assets.cta
    ? `final-cta has-asset-photo${assets.cta.includes("ai-") ? " is-ai" : ""}`
    : "final-cta";

  const reviewCount = Number(lead.googleReviewCount) || 0;
  const rating = Number(lead.googleRating) || 0;
  const displayRating = rating > 0 ? formatRating(rating) : "5.0";
  const customerStat = reviewCount >= 10 ? `${reviewCount}+` : "100+";

  const services = (brief.servicesToHighlight?.length
    ? brief.servicesToHighlight
    : DEFAULT_SERVICES
  ).slice(0, 5);

  const trustPoints = (brief.trustPoints?.length ? brief.trustPoints : DEFAULT_TRUST_POINTS).slice(
    0,
    4
  );

  const serviceCards = services
    .map((service, i) => {
      const icon = SERVICE_SVGS[i % SERVICE_SVGS.length];
      const desc = escapeHtml(serviceDescription(service, category));
      return `<article class="service-card">
          <div class="service-icon" aria-hidden="true">${icon}</div>
          <h3>${escapeHtml(service)}</h3>
          <p>${desc}</p>
          <a class="learn-more" href="${tel}">Learn More →</a>
        </article>`;
    })
    .join("\n        ");

  const trustItems = trustPoints
    .map((point) => `<li>${escapeHtml(point)}</li>`)
    .join("\n          ");

  const footerServices = services
    .map((s) => `<li><a href="#services">${escapeHtml(s)}</a></li>`)
    .join("\n            ");

  const heroTrustHtml = hero.heroTrust
    .map((label, i) => {
      const icon = HERO_TRUST_ICONS[i % HERO_TRUST_ICONS.length];
      return `<div class="hero-trust-item"><span class="trust-icon" aria-hidden="true">${icon}</span> ${escapeHtml(label)}</div>`;
    })
    .join("\n        ");

  const logoRest = logo.rest ? ` ${escapeHtml(logo.rest)}` : "";
  const primaryCtaLabel = escapeHtml(ctaLabels.primaryPhone);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="${nameHtml} — ${categoryHtml} in ${cityHtml}">
  <title>${nameHtml} | ${categoryHtml}</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body class="theme-${theme.key}">
  <header class="site-header">
    <div class="container">
      <div class="header-grid">
        <a class="logo" href="#top">
          <span class="logo-mark" aria-hidden="true">${LOGO_MARK_SVG}</span>
          <span class="logo-text"><strong>${escapeHtml(logo.strong)}</strong>${logoRest}</span>
        </a>
        <nav class="nav" aria-label="Primary">
          <a href="#top" class="is-active">Home</a>
          <a href="#services">Services</a>
          <a href="#why">About Us</a>
          <a href="#service-area">Service Areas</a>
          <a href="#reviews">Reviews</a>
          <a href="#contact">Contact</a>
        </nav>
        <div class="header-end">
          <div class="header-phone">
            <a class="phone-num" href="${tel}">${PHONE_SVG} ${phoneHtml}</a>
            <span class="phone-sub">${escapeHtml(ctaLabels.phoneSub)}</span>
          </div>
          <a class="header-cta-mobile" href="${tel}">${escapeHtml(ctaLabels.callShort)}</a>
          <label for="nav-toggle" class="menu-btn" aria-label="Open menu">${MENU_SVG}</label>
        </div>
      </div>
      <input type="checkbox" id="nav-toggle" class="nav-toggle" aria-hidden="true">
      <nav class="nav-drawer" aria-label="Mobile">
        <a href="#top" class="is-active">Home</a>
        <a href="#services">Services</a>
        <a href="#why">About Us</a>
        <a href="#service-area">Service Areas</a>
        <a href="#reviews">Reviews</a>
        <a href="#contact">Contact</a>
      </nav>
    </div>
  </header>

  <section class="hero" id="top">
    <div class="${heroBgClass}" role="img" aria-label="${heroAria}"></div>
    <div class="container hero-inner">
      <span class="hero-badge">${escapeHtml(hero.badge)}</span>
      <h1>${escapeHtml(hero.line1)}<span class="accent">${escapeHtml(hero.line2)}</span></h1>
      <p class="hero-sub">${escapeHtml(hero.sub)}</p>
      <div class="hero-actions">
        <a class="btn btn-primary" href="${tel}">${PHONE_SVG} ${primaryCtaLabel}</a>
        <a class="btn btn-ghost" href="#contact">${ctaHtml}</a>
      </div>
      <div class="hero-trust">
        ${heroTrustHtml}
      </div>
    </div>
  </section>

  <section class="section-services" id="services">
    <div class="container">
      <div class="section-head-center">
        <span class="section-label">Our Services</span>
        <h2>${escapeHtml(sectionCopy.servicesTitle)}</h2>
        <p>${escapeHtml(sectionCopy.servicesBlurb)}</p>
      </div>
      <div class="services-grid">
        ${serviceCards}
      </div>
    </div>
  </section>

  <section class="trust-section" id="why">
    <div class="trust-split">
      <div class="trust-left">
        <span class="section-label">Why Choose Us</span>
        <h2>${escapeHtml(sectionCopy.trustTitle)}</h2>
        <ul class="trust-checklist">
          ${trustItems}
        </ul>
        <a class="btn btn-primary" href="${tel}">${escapeHtml(ctaLabels.learnMoreAbout)}</a>
      </div>
      <div class="trust-right" aria-hidden="true">
        <div class="${trustImageClass}" role="img" aria-label="${escapeHtml(
    assets.trust && assets.isAi
      ? "AI concept preview — not an actual client project photo"
      : assets.trust && assets.isReal
        ? "Photo from business website"
        : "Supporting image"
  )}"></div>
      </div>
    </div>
  </section>

  <section class="reviews-section" id="reviews">
    <div class="container reviews-inner">
      <div class="reviews-stats">
        <div class="stat-block">
          <span class="num">${escapeHtml(customerStat)}</span>
          <span class="lbl">Happy Customers</span>
        </div>
        <div class="stat-block">
          <span class="num">${displayRating}★</span>
          <span class="lbl">Average Rating</span>
        </div>
      </div>
      <div class="reviews-quote-wrap">
        <div class="testimonial-stars" aria-hidden="true">★★★★★</div>
        <blockquote class="testimonial-quote">${escapeHtml(sectionCopy.testimonialQuote)}</blockquote>
        <p class="testimonial-author">— Verified customer, ${cityHtml}</p>
      </div>
    </div>
  </section>

  <section class="${finalCtaClass}" id="contact">
    <div class="container final-cta-inner">
      <div class="cta-icon" aria-hidden="true">${CALENDAR_SVG}</div>
      <div class="cta-copy">
        <h2>${escapeHtml(ctaLabels.finalTitle)}</h2>
        <p>${escapeHtml(ctaLabels.finalSub)}</p>
      </div>
      <div class="cta-actions">
        <a class="btn btn-primary" href="${tel}">${PHONE_SVG} ${escapeHtml(ctaLabels.callShort)}</a>
        <a class="btn btn-ghost" href="${tel}">${ctaHtml}</a>
      </div>
    </div>
  </section>

  <footer class="site-footer" id="service-area">
    <div class="container">
      <div class="footer-grid">
        <div class="footer-col footer-brand">
          <a class="logo" href="#top">
            <span class="logo-mark" aria-hidden="true">${LOGO_MARK_SVG}</span>
          </a>
          <span class="logo-text"><strong>${escapeHtml(logo.strong)}</strong>${logoRest}</span>
          <p class="footer-about">${escapeHtml(sectionCopy.footerAbout)}</p>
          <div class="social-links" aria-label="Social links">
            <a href="#" aria-label="Facebook">f</a>
            <a href="#" aria-label="Google">G</a>
          </div>
        </div>
        <div class="footer-col">
          <h3>Services</h3>
          <ul>${footerServices}</ul>
        </div>
        <div class="footer-col">
          <h3>Service Areas</h3>
          <ul>
            <li><a href="#service-area">${cityHtml}</a></li>
            <li><a href="#service-area">Surrounding areas</a></li>
          </ul>
        </div>
        <div class="footer-col">
          <h3>Contact Us</h3>
          <ul>
            <li><a href="${tel}">${phoneHtml}</a></li>
            <li><a href="#contact">${ctaHtml}</a></li>
          </ul>
          <span class="footer-badge">Licensed &amp; Insured</span>
        </div>
      </div>
      <div class="footer-bottom">
        <span>© ${new Date().getFullYear()} ${nameHtml}. All rights reserved.</span>
        <span><a href="#">Privacy Policy</a> · <a href="#">Terms of Service</a></span>
        <span class="preview-credit">Preview · Website Outreach Engine${
          assets.isAi ? " · AI concept imagery" : assets.isReal ? " · verified business photos" : ""
        }</span>
      </div>
    </div>
  </footer>
</body>
</html>
`;
}

export function previewV3DirName(slug, leadId) {
  const id = String(leadId ?? "").slice(0, 8);
  return id ? `${slug}-${id}` : slug;
}

export async function resolvePreviewV3Dir(slug, leadId) {
  return join(PREVIEWS_V3_ROOT, previewV3DirName(slug, leadId));
}

export async function generatePreviewSiteV3(lead) {
  const brief = generateBrief(lead);
  const category = coalesce(brief.category, lead.category);
  const theme = getCategoryTheme(category);
  const slug = slugifyBusinessName(lead.businessName);
  const dir = await resolvePreviewV3Dir(slug, lead.id);

  await mkdir(dir, { recursive: true });

  const indexPath = join(dir, "index.html");
  const cssPath = join(dir, "styles.css");

  const manifest = await loadAssetManifest(dir);
  const assets = manifestToPreviewAssets(manifest);

  await writeFile(indexPath, buildHtmlV3(lead, brief, assets), "utf8");
  await writeFile(cssPath, buildStylesV3(theme, assets), "utf8");

  return { dir, indexPath, cssPath, slug, dirName: previewV3DirName(slug, lead.id) };
}
