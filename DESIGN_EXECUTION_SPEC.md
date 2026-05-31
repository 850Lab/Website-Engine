# Website Outreach Engine — Design Execution Spec v1

## Goal

Generate local service business website previews that look like premium $1,500–$2,500 agency websites, not generic AI templates.

**Reference standard:** A premium tree-service homepage with white sticky header, logo left, nav center, phone CTA right, dark photographic hero, large bold headline, green accent word, two CTA buttons, trust chips above fold, clean service cards, split trust/testimonial section, dark CTA band, professional footer.

---

## Core Rule

The AI does not invent layout.

The system uses **locked templates** and swaps in:

- business name
- category
- city
- phone
- services
- reviews
- service areas
- images
- CTA copy

---

## Required Page Flow

1. Header  
2. Hero  
3. Services  
4. Trust / Why Choose Us  
5. Review / Stats  
6. Final CTA  
7. Footer  

**Optional:** Gallery, Before/After, Service Areas

---

## Header Rules

**Desktop:**

- height: 84px  
- logo left  
- nav center  
- phone CTA right  
- white background  
- subtle shadow or bottom border  

**Mobile:**

- logo left  
- phone button right  
- collapsed nav  

---

## Hero Rules

**Desktop:**

- min-height: 620px  
- full-width background image  
- dark overlay  
- content max-width: 620px  
- headline 60–76px  
- green accent word  
- subheadline max 2 lines  
- two CTAs  
- trust chips at bottom  

Hero must feel visual, not empty.

**Bad:** small image card floating on right, generic gradient background, tiny headline, unrelated image  

**Good:** worker in action, category-specific image, strong contrast, bold local trust message  

---

## Typography Rules

- clean sans-serif for body  
- bold display for headline  

**Headline:** large, short, emotional, max 4 lines  

**Body:** short sentences, no long paragraphs, max width 540px  

---

## Color Rules (Tree Service Reference)

| Token | Hex |
|-------|-----|
| dark forest | `#062b1f` |
| deep green | `#14532d` |
| bright green | `#65c83f` |
| white | `#ffffff` |
| soft background | `#f7f8f4` |
| gold stars | `#f5b301` |

Do not randomly invent colors. Other categories use parallel themed palettes in `preview-v3.js`.

---

## Services Rules

**Desktop:** 5 cards in one row when possible  

**Mobile:** 2-column grid  

Each card: icon, title, short description, Learn More text. No walls of text.

---

## Trust Section Rules

Split layout:

- **Left:** dark green background, headline, bullet list, CTA  
- **Right:** category image frame  

Must communicate: licensed/insured, local, fast response, clean work, reviews.

---

## Review / Stats Rules

- large number  
- star rating  
- quote  
- customer name placeholder  

Example: `100+ Happy Customers`, `5★ Average Rating`  

If actual reviews exist, use review count and rating from lead data.

---

## CTA Band Rules

Dark photo or dark green background. Must include:

- “Ready to Get Started?”  
- phone CTA  
- estimate CTA  

---

## Footer Rules

Dark green background. Columns: business summary, services, service areas, contact.

---

## Image Rules

If real images are unavailable, use **category-specific styled placeholders** that look intentional.

**Tree service image types:** arborist, bucket truck, stump grinding, storm cleanup, crew photo, wooded background.

Do not use unrelated imagery or random stock URLs in the generator.

---

## Pass / Fail Checklist

**PASS if:**

- looks like a real local business homepage  
- CTAs are obvious above the fold  
- hero has strong image impact  
- typography is bold and readable  
- service cards feel intentional  
- footer looks complete  
- no obvious gray placeholder boxes  
- page could plausibly be sold for $1,500+  

**FAIL if:**

- generic template feel, empty sections, unrelated images, visible placeholder boxes, small headline, random colors, too much text  

---

## Implementation Map

| Concern | Location |
|---------|----------|
| Generator | `src/preview-v3.js` → `generatePreviewSiteV3()` |
| CLI | `node src/cli.js generate-preview-v3 <lead-id>` |
| Output | `previews-v3/<slug>/index.html`, `styles.css` |
| Data | `generateBrief(lead)` — businessName, category, city, ctaText, servicesToHighlight, trustPoints |
| Lead fields | phone, googleReviewCount, googleRating |

Agent shorthand: `.cursor/rules/website-outreach-engine.md`
