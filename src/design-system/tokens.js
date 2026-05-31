/**
 * Premium Design System V1 — global tokens (DESIGN_EXECUTION_SPEC.md)
 */

export const TOKENS = {
  spacing: {
    xs: "0.35rem",
    sm: "0.5rem",
    md: "0.75rem",
    lg: "1rem",
    xl: "1.5rem",
    "2xl": "2rem",
    "3xl": "2.5rem",
    sectionY: "clamp(3rem, 7vw, 5rem)",
    sectionYLg: "clamp(3.5rem, 8vw, 5rem)",
    containerGutter: "2rem",
    headerHeight: "84px",
    heroMinHeight: "620px",
    trustMinHeight: "440px",
  },

  typography: {
    fontFamily: '"Inter", system-ui, sans-serif',
    fontUrl:
      'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap',
    bodySize: "1rem",
    bodyLineHeight: "1.65",
    bodyMaxWidth: "540px",
    labelSize: "0.72rem",
    labelTracking: "0.14em",
    navSize: "0.88rem",
    phoneSize: "1.05rem",
    heroHeadline: "clamp(3.75rem, 7.5vw, 4.75rem)",
    heroSubhead: "clamp(1.02rem, 2vw, 1.15rem)",
    sectionTitle: "clamp(1.75rem, 4vw, 2.35rem)",
    trustTitle: "clamp(1.5rem, 3.5vw, 2rem)",
    statNumber: "clamp(2rem, 5vw, 2.75rem)",
    ctaTitle: "clamp(1.65rem, 4vw, 2.15rem)",
    weights: {
      regular: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
      extrabold: 800,
    },
  },

  borderRadius: {
    sm: "6px",
    md: "8px",
    lg: "10px",
    xl: "12px",
    pill: "999px",
    circle: "50%",
  },

  shadows: {
    header: "0 1px 0 rgba(0,0,0,0.06)",
    card: "0 4px 20px rgba(26, 31, 22, 0.08)",
    cardHover: "0 12px 32px rgba(26, 31, 22, 0.1)",
    button: "0 6px 24px rgba(0,0,0,0.28)",
  },

  buttons: {
    padding: "0.95rem 1.5rem",
    fontSize: "0.95rem",
    fontWeight: 700,
    borderRadius: "999px",
    mobilePadding: "0.5rem 1rem",
    mobileFontSize: "0.85rem",
    ghostBorder: "2px solid rgba(255,255,255,0.55)",
  },

  sectionWidths: {
    max: "1180px",
    heroContent: "620px",
    sectionHead: "40rem",
    serviceDesc: "28ch",
    trustImage: "420px",
    footerAbout: "28ch",
  },

  animation: {
    ease: "cubic-bezier(0.22, 1, 0.36, 1)",
    fast: "0.2s",
    normal: "0.25s",
    hoverLift: "-2px",
    cardLift: "-4px",
  },

  colors: {
    surface: "#ffffff",
    ink: "#1a1f16",
    inkMuted: "#5c6356",
    border: "#e2e8e0",
  },

  breakpoints: {
    nav: "960px",
    reviews: "768px",
    services: "1100px",
  },
};

/** CSS custom properties block for :root */
export function buildTokenCssVars(theme) {
  const t = TOKENS;
  return `
  --brand: ${theme.primary};
  --brand-dark: ${theme.dark};
  --brand-panel: ${theme.panel};
  --hero-photo: ${theme.heroPhoto};
  --image-bg: ${theme.imageBg};
  --cta-bg: ${theme.ctaBg};
  --surface: ${t.colors.surface};
  --bg: ${theme.background};
  --ink: ${theme.text};
  --ink-muted: ${theme.muted};
  --border: ${t.colors.border};
  --gold: ${theme.star};
  --max: ${t.sectionWidths.max};
  --font: ${t.typography.fontFamily};
  --header-h: ${t.spacing.headerHeight};
  --radius: ${t.borderRadius.lg};
  --shadow-header: ${t.shadows.header};
  --shadow-card: ${t.shadows.card};
  --ease: ${t.animation.ease};
  --body-max: ${t.typography.bodyMaxWidth};
  --hero-content-max: ${t.sectionWidths.heroContent};
  --hero-min-h: ${t.spacing.heroMinHeight};
  --hero-headline: ${t.typography.heroHeadline};
  --hero-sub: ${t.typography.heroSubhead};
  `.trim();
}
