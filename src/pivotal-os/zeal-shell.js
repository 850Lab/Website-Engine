import { esc } from "./shell.js";

const PW_NAV = [
  { id: "pw-home", href: "/pw", label: "Mission", icon: "💧" },
  { id: "pw-queue", href: "/pw/queue", label: "Queue", icon: "☎" },
  { id: "website", href: "/", label: "Websites", icon: "◎" },
  { id: "settings", href: "/settings", label: "Settings", icon: "⚙" },
];

export function renderPwNav(activeId) {
  return PW_NAV.map(
    (item) =>
      `<a class="nav-item${item.id === activeId ? " active" : ""}" href="${item.href}"><span class="nav-icon">${item.icon}</span><span class="nav-label">${item.label}</span></a>`,
  ).join("");
}

export function zealShell({ title, activeNav, bodyHtml, headExtra = "" }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="theme-color" content="#0c4a6e" />
  <title>${esc(title)} — Zeal Power Washing</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
  <style>
    :root {
      --bg: #0a1628;
      --bg-elevated: #0f2137;
      --bg-card: #132337;
      --border: rgba(255,255,255,0.08);
      --border-strong: rgba(255,255,255,0.14);
      --text: #f0f9ff;
      --text-muted: #94a3b8;
      --text-dim: #64748b;
      --accent: #0ea5e9;
      --accent-soft: rgba(14,165,233,0.15);
      --success: #22c55e;
      --radius: 16px;
      --radius-sm: 12px;
      --shadow-soft: 0 4px 24px rgba(0,0,0,0.25);
      --safe-top: env(safe-area-inset-top, 0px);
      --safe-bottom: env(safe-area-inset-bottom, 0px);
      --nav-h: 72px;
      --tap: 56px;
      --tap-lg: 64px;
      --font: "Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
    }
    * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
    html, body { margin: 0; padding: 0; min-height: 100%; background: var(--bg); color: var(--text); font-family: var(--font); touch-action: manipulation; }
    body { min-height: 100dvh; background: radial-gradient(ellipse 80% 50% at 50% -20%, rgba(14,165,233,0.2), transparent), var(--bg); }
    .app { min-height: 100dvh; padding-bottom: calc(var(--nav-h) + var(--safe-bottom)); }
    .page { max-width: 720px; margin: 0 auto; padding: calc(16px + var(--safe-top)) 16px 24px; }
    .eyebrow { font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--text-dim); margin: 0 0 8px; }
    .hero-title { font-size: clamp(28px, 7vw, 36px); font-weight: 800; letter-spacing: -0.03em; line-height: 1.1; margin: 0 0 8px; }
    .hero-sub { font-size: 15px; line-height: 1.5; color: var(--text-muted); margin: 0 0 20px; }
    .card { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius); padding: 18px; margin-bottom: 12px; box-shadow: var(--shadow-soft); }
    .card-highlight { background: linear-gradient(145deg, rgba(14,165,233,0.14), rgba(19,35,55,0.95)); border-color: rgba(14,165,233,0.35); }
    .card-label { font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--text-dim); margin-bottom: 8px; }
    .card-value { font-size: clamp(22px, 5vw, 28px); font-weight: 800; letter-spacing: -0.02em; }
    .card-body { font-size: 15px; line-height: 1.55; color: var(--text-muted); }
    .metric-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 16px; }
    .metric { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 14px 10px; text-align: center; }
    .metric-num { font-size: 22px; font-weight: 800; }
    .metric-label { font-size: 10px; font-weight: 600; color: var(--text-dim); text-transform: uppercase; margin-top: 4px; }
    .btn { display: inline-flex; align-items: center; justify-content: center; min-height: var(--tap-lg); padding: 0 20px; border-radius: var(--radius-sm); border: 1px solid var(--border-strong); background: var(--bg-elevated); color: var(--text); font-size: 16px; font-weight: 700; text-decoration: none; cursor: pointer; user-select: none; }
    .btn:active { transform: scale(0.98); }
    .btn-primary { background: var(--accent); color: #fff; border-color: transparent; }
    .btn-ghost { background: transparent; }
    .btn-block { width: 100%; }
    .btn-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 14px; }
    .badge { display: inline-flex; padding: 5px 10px; border-radius: 999px; font-size: 11px; font-weight: 700; text-transform: uppercase; border: 1px solid var(--border); color: var(--text-muted); }
    .badge.hot { background: rgba(14,165,233,0.2); border-color: rgba(14,165,233,0.4); color: #7dd3fc; }
    .bottom-nav { position: fixed; left: 0; right: 0; bottom: 0; height: calc(var(--nav-h) + var(--safe-bottom)); padding: 8px 8px calc(8px + var(--safe-bottom)); background: rgba(10,22,40,0.94); backdrop-filter: blur(20px); border-top: 1px solid var(--border); display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; z-index: 100; }
    .nav-item { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; text-decoration: none; color: var(--text-dim); border-radius: 12px; min-height: 52px; }
    .nav-item.active { color: var(--text); background: rgba(255,255,255,0.06); }
    .nav-icon { font-size: 18px; }
    .nav-label { font-size: 10px; font-weight: 600; }
    .loading { text-align: center; padding: 48px 16px; color: var(--text-muted); }
    .hidden { display: none !important; }
    .busy { opacity: 0.55; pointer-events: none; }
    .toast { position: fixed; left: 50%; bottom: calc(var(--nav-h) + 16px + var(--safe-bottom)); transform: translateX(-50%); background: var(--accent); color: #fff; padding: 12px 20px; border-radius: 999px; font-size: 14px; font-weight: 700; opacity: 0; pointer-events: none; transition: opacity 0.2s; z-index: 200; }
    .toast.show { opacity: 1; }
    ${headExtra}
  </style>
</head>
<body>
  <div class="app">
    <div class="page">${bodyHtml}</div>
  </div>
  <nav class="bottom-nav">${renderPwNav(activeNav)}</nav>
</body>
</html>`;
}
