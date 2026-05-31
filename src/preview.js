import { mkdir, writeFile, access } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { generateBrief } from "./brief.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PREVIEWS_ROOT = join(__dirname, "..", "previews");

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function slugifyBusinessName(name) {
  const slug = String(name ?? "")
    .toLowerCase()
    .trim()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "business";
}

function phoneHref(phone) {
  const digits = String(phone ?? "").replace(/\D/g, "");
  return digits ? `tel:+${digits.length === 10 ? "1" : ""}${digits}` : "#contact";
}

function buildStyles() {
  return `/* Website Outreach Engine — static preview */
:root {
  --color-bg: #f8fafc;
  --color-surface: #ffffff;
  --color-text: #0f172a;
  --color-muted: #475569;
  --color-primary: #0d9488;
  --color-primary-dark: #0f766e;
  --color-accent: #f59e0b;
  --color-border: #e2e8f0;
  --shadow: 0 4px 24px rgba(15, 23, 42, 0.08);
  --radius: 12px;
  --max-width: 1100px;
  --font: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
}

*, *::before, *::after { box-sizing: border-box; }

html { scroll-behavior: smooth; }

body {
  margin: 0;
  font-family: var(--font);
  font-size: 1rem;
  line-height: 1.6;
  color: var(--color-text);
  background: var(--color-bg);
}

img { max-width: 100%; height: auto; display: block; }

a { color: inherit; text-decoration: none; }

.container {
  width: min(100% - 2rem, var(--max-width));
  margin-inline: auto;
}

/* Header */
.site-header {
  position: sticky;
  top: 0;
  z-index: 100;
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
  box-shadow: 0 1px 0 rgba(15, 23, 42, 0.04);
}

.header-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.875rem 0;
}

.logo {
  font-weight: 700;
  font-size: 1.05rem;
  letter-spacing: -0.02em;
}

.header-cta {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.55rem 1rem;
  background: var(--color-primary);
  color: #fff;
  font-weight: 600;
  font-size: 0.9rem;
  border-radius: 999px;
  white-space: nowrap;
  transition: background 0.15s;
}

.header-cta:hover { background: var(--color-primary-dark); }

/* Hero */
.hero {
  padding: 3rem 0 2.5rem;
  background: linear-gradient(160deg, #0f766e 0%, #0d9488 45%, #14b8a6 100%);
  color: #fff;
}

.hero-tag {
  display: inline-block;
  margin-bottom: 0.75rem;
  padding: 0.25rem 0.75rem;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 999px;
}

.hero h1 {
  margin: 0 0 0.75rem;
  font-size: clamp(1.75rem, 5vw, 2.5rem);
  line-height: 1.15;
  letter-spacing: -0.03em;
  max-width: 20ch;
}

.hero-sub {
  margin: 0 0 1.5rem;
  font-size: 1.05rem;
  opacity: 0.92;
  max-width: 36ch;
}

.btn-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.85rem 1.5rem;
  background: var(--color-accent);
  color: #1c1917;
  font-weight: 700;
  font-size: 1rem;
  border-radius: var(--radius);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.15);
  transition: transform 0.15s, box-shadow 0.15s;
}

.btn-primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.2);
}

/* Trust bar */
.trust-bar {
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
  padding: 1.25rem 0;
}

.trust-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem 1.5rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.trust-list li {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  font-size: 0.9rem;
  color: var(--color-muted);
  flex: 1 1 200px;
}

.trust-list li::before {
  content: "✓";
  flex-shrink: 0;
  color: var(--color-primary);
  font-weight: 700;
}

/* Sections */
.section {
  padding: 3rem 0;
}

.section-alt {
  background: var(--color-surface);
}

.section h2 {
  margin: 0 0 0.5rem;
  font-size: clamp(1.35rem, 4vw, 1.75rem);
  letter-spacing: -0.02em;
}

.section-lead {
  margin: 0 0 2rem;
  color: var(--color-muted);
  max-width: 50ch;
}

/* Services */
.services-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
}

@media (min-width: 540px) {
  .services-grid { grid-template-columns: repeat(2, 1fr); }
}

@media (min-width: 800px) {
  .services-grid { grid-template-columns: repeat(3, 1fr); }
}

.service-card {
  padding: 1.25rem;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
}

.service-card h3 {
  margin: 0;
  font-size: 1rem;
  line-height: 1.35;
}

/* Placeholders */
.placeholder-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.75rem;
}

@media (min-width: 600px) {
  .placeholder-grid { grid-template-columns: repeat(3, 1fr); }
}

.placeholder-box {
  aspect-ratio: 4 / 3;
  background: linear-gradient(135deg, #e2e8f0 0%, #cbd5e1 100%);
  border-radius: var(--radius);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-muted);
  font-size: 0.8rem;
  font-weight: 600;
  text-align: center;
  padding: 0.5rem;
}

.reviews-placeholder {
  padding: 2rem;
  background: var(--color-surface);
  border: 2px dashed var(--color-border);
  border-radius: var(--radius);
  text-align: center;
  color: var(--color-muted);
}

.reviews-placeholder strong {
  display: block;
  margin-bottom: 0.5rem;
  font-size: 1.1rem;
  color: var(--color-text);
}

.stars {
  color: var(--color-accent);
  font-size: 1.25rem;
  letter-spacing: 0.1em;
}

/* Contact */
.contact {
  padding: 3rem 0 4rem;
  background: var(--color-text);
  color: #f8fafc;
}

.contact h2 { color: #fff; }

.contact-grid {
  display: grid;
  gap: 1.5rem;
}

@media (min-width: 640px) {
  .contact-grid { grid-template-columns: 1fr auto; align-items: end; }
}

.contact-meta {
  margin: 0;
  color: #94a3b8;
  font-size: 0.95rem;
}

.contact-meta span { display: block; margin-top: 0.25rem; }

.contact .btn-primary {
  background: var(--color-primary);
  color: #fff;
}

/* Footer */
.site-footer {
  padding: 1rem 0;
  text-align: center;
  font-size: 0.8rem;
  color: var(--color-muted);
  border-top: 1px solid var(--color-border);
  background: var(--color-surface);
}

.preview-badge {
  display: inline-block;
  margin-top: 0.5rem;
  padding: 0.2rem 0.5rem;
  font-size: 0.7rem;
  background: #fef3c7;
  color: #92400e;
  border-radius: 4px;
}
`;
}

function buildHtml(lead, brief) {
  const name = escapeHtml(brief.businessName);
  const category = escapeHtml(brief.category);
  const city = escapeHtml(brief.city);
  const headline = escapeHtml(brief.heroHeadline);
  const cta = escapeHtml(brief.ctaText);
  const phone = escapeHtml(lead.phone || "Call for a quote");
  const tel = phoneHref(lead.phone);
  const angle = escapeHtml(brief.websiteAngle);

  const trustItems = brief.trustPoints
    .map((t) => `<li>${escapeHtml(t)}</li>`)
    .join("\n        ");

  const serviceCards = brief.servicesToHighlight
    .map((s) => `<article class="service-card"><h3>${escapeHtml(s)}</h3></article>`)
    .join("\n        ");

  const reviewCount = Number(lead.googleReviewCount) || 0;
  const rating = Number(lead.googleRating) || 0;
  const reviewsLabel =
    reviewCount > 0 && rating > 0
      ? `${rating} ★ average · ${reviewCount}+ Google reviews`
      : reviewCount > 0
        ? `${reviewCount}+ Google reviews`
        : "Customer reviews";

  const galleryBoxes = Array.from({ length: 6 }, (_, i) => {
    const n = i + 1;
    return `<div class="placeholder-box" aria-hidden="true">Project photo ${n}</div>`;
  }).join("\n        ");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="${name} — ${category} in ${city}">
  <title>${name} | ${category}</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <header class="site-header">
    <div class="container header-inner">
      <a class="logo" href="#">${name}</a>
      <a class="header-cta" href="${tel}">📞 ${phone}</a>
    </div>
  </header>

  <section class="hero">
    <div class="container">
      <span class="hero-tag">${category} · ${city}</span>
      <h1>${headline}</h1>
      <p class="hero-sub">Professional ${category} you can trust. Serving ${city} and nearby areas.</p>
      <a class="btn-primary" href="${tel}">${cta}</a>
    </div>
  </section>

  <div class="trust-bar">
    <div class="container">
      <ul class="trust-list">
        ${trustItems}
      </ul>
    </div>
  </div>

  <section class="section" id="services">
    <div class="container">
      <h2>Our Services</h2>
      <p class="section-lead">Reliable ${category} solutions for homes and businesses.</p>
      <div class="services-grid">
        ${serviceCards}
      </div>
    </div>
  </section>

  <section class="section section-alt" id="reviews">
    <div class="container">
      <h2>Customer Reviews</h2>
      <p class="section-lead">What local customers are saying.</p>
      <div class="reviews-placeholder">
        <strong>${escapeHtml(reviewsLabel)}</strong>
        <span class="stars" aria-hidden="true">★★★★★</span>
        <p>Google reviews widget placeholder — connect live reviews in production.</p>
      </div>
    </div>
  </section>

  <section class="section" id="gallery">
    <div class="container">
      <h2>Project Gallery</h2>
      <p class="section-lead">Recent work from our crew.</p>
      <div class="placeholder-grid">
        ${galleryBoxes}
      </div>
    </div>
  </section>

  <section class="contact" id="contact">
    <div class="container contact-grid">
      <div>
        <h2>Get a Free Estimate</h2>
        <p class="contact-meta">
          <span><strong>${name}</strong></span>
          <span>${category} · ${city}</span>
          <span>Angle: ${angle}</span>
        </p>
      </div>
      <a class="btn-primary" href="${tel}">${cta}</a>
    </div>
  </section>

  <footer class="site-footer">
    <div class="container">
      <p>© ${new Date().getFullYear()} ${name}. All rights reserved.</p>
      <span class="preview-badge">Static preview — Website Outreach Engine</span>
    </div>
  </footer>
</body>
</html>
`;
}

async function resolvePreviewDir(slug, leadId) {
  let dir = join(PREVIEWS_ROOT, slug);
  try {
    await access(dir);
    dir = join(PREVIEWS_ROOT, `${slug}-${leadId.slice(0, 8)}`);
  } catch {
    // directory does not exist — use slug as-is
  }
  return dir;
}

/**
 * Generate static preview site files from lead + brief.
 * @returns {{ dir: string, indexPath: string, cssPath: string }}
 */
export async function generatePreviewSite(lead) {
  const brief = generateBrief(lead);
  const slug = slugifyBusinessName(lead.businessName);
  const dir = await resolvePreviewDir(slug, lead.id);

  await mkdir(dir, { recursive: true });

  const indexPath = join(dir, "index.html");
  const cssPath = join(dir, "styles.css");

  await writeFile(indexPath, buildHtml(lead, brief), "utf8");
  await writeFile(cssPath, buildStyles(), "utf8");

  return { dir, indexPath, cssPath, slug };
}
