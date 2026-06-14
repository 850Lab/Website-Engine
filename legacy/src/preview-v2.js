import { mkdir, writeFile, access } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { generateBrief } from "./brief.js";
import { slugifyBusinessName } from "./preview.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PREVIEWS_V2_ROOT = join(__dirname, "..", "previews-v2");

const SERVICE_ICONS = [
  "ðŸ”§",
  "âš¡",
  "ðŸ ",
  "âœ¨",
  "ðŸ“‹",
];

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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

function buildTrustChips(lead, brief) {
  const chips = [];
  const reviewCount = Number(lead.googleReviewCount) || 0;
  const rating = Number(lead.googleRating) || 0;

  if (reviewCount > 0) {
    chips.push({
      label: rating > 0 ? `${formatRating(rating)}â˜… Reviews` : `${reviewCount}+ Reviews`,
      icon: "â˜…",
    });
  } else {
    chips.push({ label: "Top-Rated Reviews", icon: "â˜…" });
  }

  chips.push({
    label: lead.serviceBusiness ? "Licensed & Insured" : "Licensed Pros",
    icon: "âœ“",
  });

  const city = String(lead.city ?? brief.city ?? "").trim();
  chips.push({
    label: city ? `Local to ${city}` : "Locally Owned",
    icon: "ðŸ“",
  });

  if (lead.strongProof) {
    chips.push({ label: "Strong Proof", icon: "ðŸ“¸" });
  } else if (brief.trustPoints.length > 0) {
    const short = String(brief.trustPoints[0]).slice(0, 28);
    chips.push({ label: short.length < brief.trustPoints[0].length ? `${short}â€¦` : short, icon: "âœ“" });
  } else {
    chips.push({ label: "Trusted Locally", icon: "âœ“" });
  }

  return chips.slice(0, 4);
}

function buildStyles() {
  return `/* Website Outreach Engine â€” preview v2 (mobile-first) */
:root {
  --color-bg: #f1f5f9;
  --color-surface: #ffffff;
  --color-text: #0f172a;
  --color-muted: #64748b;
  --color-primary: #0d9488;
  --color-primary-dark: #0f766e;
  --color-accent: #f59e0b;
  --color-overlay: rgba(15, 23, 42, 0.72);
  --color-border: #e2e8f0;
  --shadow: 0 8px 30px rgba(15, 23, 42, 0.1);
  --radius: 14px;
  --radius-sm: 10px;
  --max-width: 1100px;
  --font: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  --sticky-cta-h: 3.25rem;
}

*, *::before, *::after { box-sizing: border-box; }

html { scroll-behavior: smooth; }

body {
  margin: 0;
  font-family: var(--font);
  font-size: 1rem;
  line-height: 1.55;
  color: var(--color-text);
  background: var(--color-bg);
  padding-bottom: var(--sticky-cta-h);
}

@media (min-width: 768px) {
  body { padding-bottom: 0; }
}

img { max-width: 100%; height: auto; display: block; }

a { color: inherit; text-decoration: none; }

.container {
  width: min(100% - 1.5rem, var(--max-width));
  margin-inline: auto;
}

/* Hero â€” full-width image */
.hero {
  position: relative;
  min-height: 72vh;
  min-height: 72dvh;
  display: flex;
  align-items: flex-end;
  color: #fff;
  overflow: hidden;
}

.hero-bg {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(180deg, rgba(15, 23, 42, 0.35) 0%, rgba(15, 23, 42, 0.85) 100%),
    url("https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=1400&q=80")
      center / cover no-repeat;
  z-index: 0;
}

.hero-bg::after {
  content: "";
  position: absolute;
  inset: 0;
  background: var(--color-overlay);
}

.hero-content {
  position: relative;
  z-index: 1;
  width: 100%;
  padding: 2rem 0 2.5rem;
}

.hero-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  margin-bottom: 0.75rem;
  padding: 0.35rem 0.75rem;
  font-size: 0.8rem;
  font-weight: 700;
  background: rgba(245, 158, 11, 0.95);
  color: #1c1917;
  border-radius: 999px;
}

.hero-badge .stars {
  letter-spacing: 0.05em;
}

.hero-meta {
  margin: 0 0 0.5rem;
  font-size: 0.9rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  opacity: 0.9;
}

.hero h1 {
  margin: 0 0 1.25rem;
  font-size: clamp(1.85rem, 7vw, 2.75rem);
  line-height: 1.1;
  letter-spacing: -0.03em;
  max-width: 16ch;
}

.hero-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.8rem 1.25rem;
  font-weight: 700;
  font-size: 0.95rem;
  border-radius: var(--radius-sm);
  transition: transform 0.15s, box-shadow 0.15s;
}

.btn-primary {
  background: var(--color-accent);
  color: #1c1917;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
}

.btn-secondary {
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
  border: 2px solid rgba(255, 255, 255, 0.45);
  backdrop-filter: blur(4px);
}

.btn:hover { transform: translateY(-1px); }

/* Trust bar â€” horizontal chips */
.trust-bar {
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
  padding: 0.85rem 0;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.trust-chips {
  display: flex;
  gap: 0.5rem;
  margin: 0;
  padding: 0;
  list-style: none;
  min-width: min-content;
}

.trust-chip {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.45rem 0.85rem;
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--color-text);
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: 999px;
  white-space: nowrap;
}

.trust-chip-icon {
  font-size: 0.9rem;
  line-height: 1;
}

/* Sections */
.section {
  padding: 2.5rem 0;
}

.section-alt {
  background: var(--color-surface);
}

.section h2 {
  margin: 0 0 0.35rem;
  font-size: clamp(1.35rem, 4vw, 1.65rem);
  letter-spacing: -0.02em;
}

.section-lead {
  margin: 0 0 1.5rem;
  color: var(--color-muted);
  font-size: 0.95rem;
  max-width: 42ch;
}

/* Services â€” icon cards, 2-col mobile */
.services-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.65rem;
}

@media (min-width: 640px) {
  .services-grid { grid-template-columns: repeat(3, 1fr); gap: 0.85rem; }
}

.service-card {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 1rem 0.85rem;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
}

.service-icon {
  width: 2.25rem;
  height: 2.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.15rem;
  background: #ccfbf1;
  border-radius: 10px;
}

.service-card h3 {
  margin: 0;
  font-size: 0.82rem;
  line-height: 1.35;
  font-weight: 700;
}

/* Results â€” before / after */
.results-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
}

@media (min-width: 540px) {
  .results-grid { grid-template-columns: repeat(2, 1fr); }
}

.result-pair {
  border-radius: var(--radius);
  overflow: hidden;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  box-shadow: var(--shadow);
}

.result-labels {
  display: grid;
  grid-template-columns: 1fr 1fr;
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.result-labels span {
  padding: 0.4rem 0.5rem;
  text-align: center;
}

.result-labels .before-label {
  background: #fef3c7;
  color: #92400e;
}

.result-labels .after-label {
  background: #d1fae5;
  color: #065f46;
}

.result-images {
  display: grid;
  grid-template-columns: 1fr 1fr;
}

.result-slot {
  aspect-ratio: 4 / 3;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--color-muted);
  text-align: center;
  padding: 0.5rem;
}

.result-slot.before {
  background: linear-gradient(145deg, #e2e8f0, #cbd5e1);
}

.result-slot.after {
  background: linear-gradient(145deg, #99f6e4, #5eead4);
  color: #134e4a;
}

/* Reviews â€” large card */
.review-card {
  padding: 1.75rem 1.25rem;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  text-align: center;
}

.review-stars {
  font-size: 1.75rem;
  color: var(--color-accent);
  letter-spacing: 0.12em;
  margin-bottom: 0.5rem;
}

.review-score {
  margin: 0 0 0.25rem;
  font-size: 2rem;
  font-weight: 800;
  letter-spacing: -0.03em;
}

.review-count {
  margin: 0 0 1rem;
  color: var(--color-muted);
  font-size: 0.95rem;
}

.review-quote {
  margin: 0;
  font-size: 1.05rem;
  font-style: italic;
  color: var(--color-text);
  max-width: 36ch;
  margin-inline: auto;
}

.review-attribution {
  margin: 1rem 0 0;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-muted);
}

/* Gallery â€” masonry */
.gallery-masonry {
  columns: 2;
  column-gap: 0.65rem;
}

@media (min-width: 640px) {
  .gallery-masonry { columns: 3; column-gap: 0.75rem; }
}

.gallery-item {
  break-inside: avoid;
  margin-bottom: 0.65rem;
  border-radius: var(--radius-sm);
  overflow: hidden;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  box-shadow: 0 2px 12px rgba(15, 23, 42, 0.06);
}

.gallery-item.tall { min-height: 11rem; }
.gallery-item.wide { min-height: 7rem; }

.gallery-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  min-height: inherit;
  padding: 1rem 0.5rem;
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--color-muted);
  text-align: center;
  background: linear-gradient(160deg, #e2e8f0 0%, #f8fafc 50%, #cbd5e1 100%);
}

.gallery-placeholder .icon {
  font-size: 1.5rem;
  opacity: 0.7;
}

.gallery-item:nth-child(3n) .gallery-placeholder {
  background: linear-gradient(160deg, #ccfbf1 0%, #f0fdfa 50%, #99f6e4 100%);
  color: #0f766e;
}

.gallery-item:nth-child(5n) .gallery-placeholder {
  background: linear-gradient(160deg, #fef3c7 0%, #fffbeb 50%, #fde68a 100%);
  color: #92400e;
}

/* Contact CTA section */
.cta-section {
  padding: 2.5rem 0 3rem;
  background: var(--color-text);
  color: #f8fafc;
  text-align: center;
}

.cta-section h2 {
  margin: 0 0 0.5rem;
  color: #fff;
}

.cta-section p {
  margin: 0 0 1.25rem;
  color: #94a3b8;
  font-size: 0.95rem;
}

.cta-section .btn-primary {
  background: var(--color-primary);
  color: #fff;
}

/* Sticky mobile bottom CTA */
.sticky-cta {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 200;
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  height: var(--sticky-cta-h);
  background: var(--color-surface);
  border-top: 1px solid var(--color-border);
  box-shadow: 0 -4px 24px rgba(15, 23, 42, 0.12);
}

@media (min-width: 768px) {
  .sticky-cta { display: none; }
}

.sticky-cta a {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--color-text);
  border-right: 1px solid var(--color-border);
}

.sticky-cta a:last-child { border-right: none; }

.sticky-cta a.primary {
  background: var(--color-primary);
  color: #fff;
}

/* Footer */
.site-footer {
  padding: 1.25rem 0 1.5rem;
  text-align: center;
  font-size: 0.8rem;
  color: var(--color-muted);
  background: var(--color-surface);
  border-top: 1px solid var(--color-border);
}

@media (max-width: 767px) {
  .site-footer { padding-bottom: calc(1.5rem + var(--sticky-cta-h)); }
}

.site-footer strong {
  display: block;
  margin-bottom: 0.25rem;
  color: var(--color-text);
  font-size: 0.85rem;
}
`;
}

function buildHtml(lead, brief) {
  const name = escapeHtml(brief.businessName);
  const category = escapeHtml(brief.category);
  const city = escapeHtml(brief.city);
  const cta = escapeHtml(brief.ctaText);
  const phone = escapeHtml(lead.phone || "Call now");
  const tel = phoneHref(lead.phone);

  const reviewCount = Number(lead.googleReviewCount) || 0;
  const rating = Number(lead.googleRating) || 0;
  const displayRating = rating > 0 ? formatRating(rating) : "5.0";
  const reviewCountLabel =
    reviewCount > 0 ? `${reviewCount}+ Google reviews` : "Trusted by local customers";

  const trustChips = buildTrustChips(lead, brief)
    .map(
      (chip) =>
        `<li class="trust-chip"><span class="trust-chip-icon" aria-hidden="true">${escapeHtml(chip.icon)}</span>${escapeHtml(chip.label)}</li>`
    )
    .join("\n        ");

  const serviceCards = brief.servicesToHighlight
    .map((service, i) => {
      const icon = SERVICE_ICONS[i % SERVICE_ICONS.length];
      return `<article class="service-card">
          <span class="service-icon" aria-hidden="true">${icon}</span>
          <h3>${escapeHtml(service)}</h3>
        </article>`;
    })
    .join("\n        ");

  const resultPairs = Array.from({ length: 4 }, (_, i) => {
    const n = i + 1;
    return `<article class="result-pair">
          <div class="result-labels">
            <span class="before-label">Before</span>
            <span class="after-label">After</span>
          </div>
          <div class="result-images">
            <div class="result-slot before" aria-hidden="true">Before ${n}</div>
            <div class="result-slot after" aria-hidden="true">After ${n}</div>
          </div>
        </article>`;
  }).join("\n        ");

  const gallerySizes = ["", " tall", " wide", " tall", "", " wide", " tall", ""];
  const galleryItems = Array.from({ length: 8 }, (_, i) => {
    const n = i + 1;
    const sizeClass = gallerySizes[i % gallerySizes.length];
    return `<figure class="gallery-item${sizeClass}">
          <div class="gallery-placeholder" aria-hidden="true">
            <span class="icon">ðŸ“·</span>
            <span>Project ${n}</span>
          </div>
        </figure>`;
  }).join("\n        ");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="${name} â€” ${category} in ${city}">
  <title>${name} | ${category}</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <section class="hero" id="top">
    <div class="hero-bg" role="img" aria-label="Professional ${category} work in ${city}"></div>
    <div class="container hero-content">
      <div class="hero-badge" aria-label="${displayRating} star rating">
        <span class="stars" aria-hidden="true">â˜…â˜…â˜…â˜…â˜…</span>
        <span>${displayRating}</span>
      </div>
      <p class="hero-meta">${category} Â· ${city}</p>
      <h1>${name}</h1>
      <div class="hero-actions">
        <a class="btn btn-primary" href="${tel}">${cta}</a>
        <a class="btn btn-secondary" href="#gallery">View Our Work</a>
      </div>
    </div>
  </section>

  <div class="trust-bar">
    <div class="container">
      <ul class="trust-chips">
        ${trustChips}
      </ul>
    </div>
  </div>

  <section class="section" id="services">
    <div class="container">
      <h2>Our Services</h2>
      <p class="section-lead">Professional ${category} for homes and businesses in ${city}.</p>
      <div class="services-grid">
        ${serviceCards}
      </div>
    </div>
  </section>

  <section class="section section-alt" id="results">
    <div class="container">
      <h2>Real Results</h2>
      <p class="section-lead">See the difference our crew makes â€” before and after every job.</p>
      <div class="results-grid">
        ${resultPairs}
      </div>
    </div>
  </section>

  <section class="section" id="reviews">
    <div class="container">
      <h2>Customer Reviews</h2>
      <p class="section-lead">What neighbors in ${city} are saying.</p>
      <article class="review-card">
        <div class="review-stars" aria-hidden="true">â˜…â˜…â˜…â˜…â˜…</div>
        <p class="review-score">${displayRating}<span style="font-size:1rem;font-weight:600;color:var(--color-muted)"> / 5</span></p>
        <p class="review-count">${escapeHtml(reviewCountLabel)}</p>
        <blockquote class="review-quote">"Professional, on time, and great communication from start to finish. Highly recommend ${name}."</blockquote>
        <p class="review-attribution">â€” Verified local customer</p>
      </article>
    </div>
  </section>

  <section class="section section-alt" id="gallery">
    <div class="container">
      <h2>Project Gallery</h2>
      <p class="section-lead">Recent work from our team.</p>
      <div class="gallery-masonry">
        ${galleryItems}
      </div>
    </div>
  </section>

  <section class="cta-section" id="contact">
    <div class="container">
      <h2>Ready to Get Started?</h2>
      <p>${name} Â· ${category} Â· ${city}</p>
      <a class="btn btn-primary" href="${tel}">${cta}</a>
    </div>
  </section>

  <footer class="site-footer">
    <div class="container">
      <strong>Website preview generated by Website Outreach Engine</strong>
      <p>Â© ${new Date().getFullYear()} ${name}. Static preview for outreach.</p>
    </div>
  </footer>

  <nav class="sticky-cta" aria-label="Quick actions">
    <a class="primary" href="${tel}">Call</a>
    <a href="#gallery">Gallery</a>
    <a href="#contact">Quote</a>
  </nav>
</body>
</html>
`;
}

async function resolvePreviewDir(slug, leadId) {
  let dir = join(PREVIEWS_V2_ROOT, slug);
  try {
    await access(dir);
    dir = join(PREVIEWS_V2_ROOT, `${slug}-${leadId.slice(0, 8)}`);
  } catch {
    // directory does not exist â€” use slug as-is
  }
  return dir;
}

/**
 * Generate static preview v2 site files from lead + brief.
 * @returns {{ dir: string, indexPath: string, cssPath: string, slug: string }}
 */
export async function generatePreviewSiteV2(lead) {
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
