const NAV = [
  { id: "home", href: "/", label: "Mission", icon: "◎" },
  { id: "queue", href: "/call-queue", label: "Queue", icon: "☎" },
  { id: "pipeline", href: "/pipeline", label: "Pipeline", icon: "▤" },
  { id: "opportunities", href: "/opportunities", label: "Opps", icon: "◆" },
  { id: "settings", href: "/settings", label: "Settings", icon: "⚙" },
];

export function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function renderNav(activeId) {
  return NAV.map(
    (item) =>
      `<a class="nav-item${item.id === activeId ? " active" : ""}" href="${item.href}"><span class="nav-icon">${item.icon}</span><span class="nav-label">${item.label}</span></a>`,
  ).join("");
}

export function pivotalShell({ title, activeNav, bodyHtml, headExtra = "" }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="theme-color" content="#09090b" />
  <title>${esc(title)} — Pivotal OS</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
  <style>
    :root {
      --bg: #09090b;
      --bg-elevated: #111113;
      --bg-card: #18181b;
      --bg-card-hover: #1f1f23;
      --border: rgba(255,255,255,0.08);
      --border-strong: rgba(255,255,255,0.14);
      --text: #fafafa;
      --text-muted: #a1a1aa;
      --text-dim: #71717a;
      --accent: #6366f1;
      --accent-soft: rgba(99,102,241,0.15);
      --success: #22c55e;
      --success-soft: rgba(34,197,94,0.12);
      --warning: #f59e0b;
      --danger: #ef4444;
      --radius: 16px;
      --radius-sm: 12px;
      --shadow: 0 8px 32px rgba(0,0,0,0.45);
      --shadow-soft: 0 4px 24px rgba(0,0,0,0.25);
      --safe-top: env(safe-area-inset-top, 0px);
      --safe-bottom: env(safe-area-inset-bottom, 0px);
      --nav-h: 72px;
      --tap: 56px;
      --tap-lg: 64px;
      --font: "Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
      --ease: cubic-bezier(0.22, 1, 0.36, 1);
    }
    * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
    html, body {
      margin: 0; padding: 0; min-height: 100%;
      background: var(--bg); color: var(--text);
      font-family: var(--font);
      touch-action: manipulation;
    }
    body {
      min-height: 100dvh;
      background:
        radial-gradient(ellipse 80% 50% at 50% -20%, rgba(99,102,241,0.18), transparent),
        var(--bg);
    }
    .app {
      min-height: 100dvh;
      padding-bottom: calc(var(--nav-h) + var(--safe-bottom));
    }
    .page {
      max-width: 720px;
      margin: 0 auto;
      padding: calc(16px + var(--safe-top)) 16px 24px;
    }
    .page-wide { max-width: 960px; }

    .eyebrow {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--text-dim);
      margin: 0 0 8px;
    }
    .hero-title {
      font-size: clamp(28px, 7vw, 36px);
      font-weight: 800;
      letter-spacing: -0.03em;
      line-height: 1.1;
      margin: 0 0 8px;
    }
    .hero-sub {
      font-size: 15px;
      line-height: 1.5;
      color: var(--text-muted);
      margin: 0 0 20px;
    }

    .card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 18px;
      margin-bottom: 12px;
      box-shadow: var(--shadow-soft);
    }
    .card-highlight {
      background: linear-gradient(145deg, rgba(99,102,241,0.12), rgba(24,24,27,0.95));
      border-color: rgba(99,102,241,0.35);
    }
    .card-label {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--text-dim);
      margin-bottom: 8px;
    }
    .card-value {
      font-size: clamp(22px, 5vw, 28px);
      font-weight: 800;
      letter-spacing: -0.02em;
      line-height: 1.15;
    }
    .card-body {
      font-size: 15px;
      line-height: 1.55;
      color: var(--text-muted);
    }

    .metric-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
      margin-bottom: 16px;
    }
    .metric {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      padding: 14px 12px;
      text-align: center;
    }
    .metric-num {
      font-size: 22px;
      font-weight: 800;
      letter-spacing: -0.02em;
      line-height: 1.1;
    }
    .metric-label {
      font-size: 10px;
      font-weight: 600;
      color: var(--text-dim);
      text-transform: uppercase;
      letter-spacing: 0.06em;
      margin-top: 4px;
    }
    .metric-target {
      font-size: 11px;
      color: var(--text-muted);
      margin-top: 2px;
    }

    .progress-wrap { margin-top: 10px; }
    .progress-bar {
      height: 6px;
      background: rgba(255,255,255,0.06);
      border-radius: 999px;
      overflow: hidden;
    }
    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, var(--accent), #818cf8);
      border-radius: 999px;
      transition: width 0.4s var(--ease);
    }
    .progress-fill.success { background: linear-gradient(90deg, var(--success), #4ade80); }

    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      min-height: var(--tap-lg);
      padding: 0 20px;
      border-radius: var(--radius-sm);
      border: 1px solid var(--border-strong);
      background: var(--bg-elevated);
      color: var(--text);
      font-size: 16px;
      font-weight: 700;
      text-decoration: none;
      cursor: pointer;
      transition: transform 0.15s var(--ease), background 0.15s;
      user-select: none;
    }
    .btn:active { transform: scale(0.98); }
    .btn-primary {
      background: var(--text);
      color: var(--bg);
      border-color: transparent;
    }
    .btn-accent {
      background: var(--accent);
      color: #fff;
      border-color: transparent;
    }
    .btn-ghost {
      background: transparent;
      border-color: var(--border-strong);
    }
    .btn-block { width: 100%; }
    .btn-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin-top: 14px;
    }
    .btn-row.single { grid-template-columns: 1fr; }

    .badge {
      display: inline-flex;
      align-items: center;
      padding: 5px 10px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      border: 1px solid var(--border);
      color: var(--text-muted);
    }
    .badge.hot {
      background: rgba(239,68,68,0.15);
      border-color: rgba(239,68,68,0.35);
      color: #fca5a5;
    }
    .badge.accent {
      background: var(--accent-soft);
      border-color: rgba(99,102,241,0.35);
      color: #c7d2fe;
    }

    .bottom-nav {
      position: fixed;
      left: 0; right: 0; bottom: 0;
      height: calc(var(--nav-h) + var(--safe-bottom));
      padding: 8px 8px calc(8px + var(--safe-bottom));
      background: rgba(9,9,11,0.92);
      backdrop-filter: blur(20px);
      border-top: 1px solid var(--border);
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 4px;
      z-index: 100;
    }
    .nav-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 2px;
      text-decoration: none;
      color: var(--text-dim);
      border-radius: 12px;
      min-height: 52px;
      transition: color 0.15s, background 0.15s;
    }
    .nav-item.active {
      color: var(--text);
      background: rgba(255,255,255,0.06);
    }
    .nav-icon { font-size: 18px; line-height: 1; }
    .nav-label { font-size: 10px; font-weight: 600; letter-spacing: 0.02em; }

    .loading {
      text-align: center;
      padding: 48px 16px;
      color: var(--text-muted);
      font-size: 15px;
    }
    .hidden { display: none !important; }
    .busy { opacity: 0.55; pointer-events: none; }

    .toast {
      position: fixed;
      left: 50%;
      bottom: calc(var(--nav-h) + 16px + var(--safe-bottom));
      transform: translateX(-50%) translateY(8px);
      background: var(--text);
      color: var(--bg);
      padding: 12px 20px;
      border-radius: 999px;
      font-size: 14px;
      font-weight: 700;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.2s, transform 0.2s;
      z-index: 200;
      white-space: nowrap;
    }
    .toast.show { opacity: 1; transform: translateX(-50%) translateY(0); }

    @media (min-width: 768px) {
      .bottom-nav {
        top: 0; bottom: auto;
        height: auto;
        padding: 12px 24px;
        display: flex;
        justify-content: center;
        gap: 8px;
        border-top: none;
        border-bottom: 1px solid var(--border);
      }
      .nav-item {
        flex-direction: row;
        padding: 10px 16px;
        min-height: 44px;
        gap: 8px;
      }
      .nav-label { font-size: 13px; }
      .app { padding-top: 64px; padding-bottom: 24px; }
      .toast { bottom: 32px; }
    }
    ${headExtra}
  </style>
</head>
<body>
  <div class="app">
    <div class="page${activeNav === "opportunities" || activeNav === "pipeline" ? " page-wide" : ""}">
      ${bodyHtml}
    </div>
  </div>
  <nav class="bottom-nav">${renderNav(activeNav)}</nav>
</body>
</html>`;
}
