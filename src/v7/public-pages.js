import { buildCustomerDashboard } from "./customer-dashboard.js";
import { publicProjectView } from "./opportunity-project-store.js";
import { publicBaseUrl } from "./shared.js";

const BASE_STYLES = `
  :root {
    color-scheme: light;
    --bg: #0b1220;
    --panel: #121a2b;
    --panel-2: #1a2438;
    --text: #eef3ff;
    --muted: #9fb0d0;
    --accent: #4f8cff;
    --accent-2: #2dd4bf;
    --border: rgba(255,255,255,0.08);
    --shadow: 0 24px 60px rgba(0,0,0,0.35);
    font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: radial-gradient(circle at top, #15213a 0%, var(--bg) 55%);
    color: var(--text);
    min-height: 100vh;
  }
  a { color: inherit; }
  .wrap { max-width: 820px; margin: 0 auto; padding: 22px 18px 40px; }
  .card {
    background: linear-gradient(180deg, rgba(255,255,255,0.03), transparent), var(--panel);
    border: 1px solid var(--border);
    border-radius: 20px;
    box-shadow: var(--shadow);
    padding: 24px;
  }
  .eyebrow {
    text-transform: uppercase;
    letter-spacing: 0.12em;
    font-size: 12px;
    color: var(--accent-2);
    margin: 0 0 8px;
  }
  h1 { margin: 0 0 12px; font-size: clamp(28px, 5vw, 40px); line-height: 1.1; }
  p { color: var(--muted); line-height: 1.6; }
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    border: 0;
    border-radius: 999px;
    padding: 14px 22px;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    text-decoration: none;
  }
  .btn-primary { background: linear-gradient(135deg, var(--accent), #7c5cff); color: white; }
  .btn-secondary { background: var(--panel-2); color: var(--text); border: 1px solid var(--border); }
  .actions { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 20px; }
  .stack { display: grid; gap: 16px; }
  .kicker {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-radius: 999px;
    background: rgba(79,140,255,0.15);
    color: #cfe0ff;
    font-size: 13px;
    font-weight: 600;
  }
  .business-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 12px;
  }
  .meta-pill {
    padding: 6px 10px;
    border-radius: 999px;
    font-size: 13px;
    background: var(--panel-2);
    border: 1px solid var(--border);
    color: #d6e3ff;
  }
  .presentation-note {
    margin: 0;
    color: #c9d6f0;
  }
  .price {
    font-size: 42px;
    font-weight: 700;
    margin: 8px 0;
  }
  .list { margin: 16px 0 0; padding-left: 18px; color: var(--muted); }
  .list li { margin: 8px 0; }
  .grid-3 {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
    margin-top: 16px;
  }
  .stat {
    background: var(--panel-2);
    border: 1px solid var(--border);
    border-radius: 16px;
    padding: 16px;
  }
  .stat strong { display: block; font-size: 28px; margin-bottom: 4px; color: var(--text); }
  .feed { display: grid; gap: 12px; margin-top: 16px; }
  .feed-item {
    background: var(--panel-2);
    border: 1px solid var(--border);
    border-radius: 16px;
    padding: 16px 18px;
  }
  .feed-item h3 { margin: 0 0 6px; font-size: 16px; }
  .feed-item p { margin: 0; font-size: 14px; }
  .momentum-dots { display: flex; gap: 8px; margin: 12px 0; }
  .dot {
    width: 12px; height: 12px; border-radius: 999px;
    background: rgba(255,255,255,0.15);
  }
  .dot.on { background: var(--accent-2); box-shadow: 0 0 12px rgba(45,212,191,0.6); }
  .pulse { animation: pulse 2s ease-in-out infinite; }
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.55; }
  }
  .header-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
    flex-wrap: wrap;
  }
  .status-pill {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 6px 12px;
    border-radius: 999px;
    background: rgba(45,212,191,0.12);
    color: #9ef5e8;
    font-size: 13px;
  }
  .status-dot { width: 8px; height: 8px; border-radius: 999px; background: var(--accent-2); }
  .section-title {
    margin: 0 0 10px;
    font-size: 20px;
    color: var(--text);
  }
  .muted-note {
    margin: 0;
    color: #c6d4ee;
    font-size: 14px;
  }
  .quick-grid {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 10px;
    margin-top: 14px;
  }
  .quick-item {
    background: var(--panel-2);
    border: 1px solid var(--border);
    border-radius: 14px;
    padding: 12px;
  }
  .quick-item strong {
    display: block;
    color: var(--text);
    font-size: 14px;
    margin-bottom: 4px;
  }
  .quick-item span {
    color: var(--muted);
    font-size: 12px;
    line-height: 1.4;
  }
  .two-col {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }
  .timeline {
    margin: 0;
    padding: 0;
    list-style: none;
    display: grid;
    gap: 10px;
  }
  .timeline li {
    background: var(--panel-2);
    border: 1px solid var(--border);
    border-radius: 14px;
    padding: 12px;
  }
  .timeline b {
    display: block;
    color: var(--text);
    margin-bottom: 4px;
  }
  .faq-grid {
    display: grid;
    gap: 10px;
    margin-top: 8px;
  }
  .faq-item {
    background: var(--panel-2);
    border: 1px solid var(--border);
    border-radius: 14px;
    padding: 12px;
  }
  .faq-item h3 {
    margin: 0 0 6px;
    font-size: 15px;
    color: var(--text);
  }
  .faq-item p {
    margin: 0;
    font-size: 14px;
  }
  .field {
    flex: 1;
    min-width: 180px;
    padding: 13px 14px;
    border-radius: 12px;
    border: 1px solid var(--border);
    background: var(--panel-2);
    color: var(--text);
    font-size: 14px;
  }
  .status-text {
    margin-top: 12px;
    font-size: 14px;
    color: #c6d4ee;
  }
  @media (max-width: 720px) {
    .grid-3 { grid-template-columns: 1fr; }
    .quick-grid { grid-template-columns: 1fr 1fr; }
    .two-col { grid-template-columns: 1fr; }
    .wrap { padding: 14px 12px 24px; }
    .card { padding: 18px; border-radius: 16px; }
    .btn { width: 100%; }
    .field { width: 100%; min-width: 100%; }
  }
`;

function pageShell(title, body, extraHead = "") {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <style>${BASE_STYLES}</style>
  ${extraHead}
</head>
<body>${body}</body>
</html>`;
}

function momentumDots(state) {
  const order = ["launching", "building", "active", "strong"];
  const idx = Math.max(0, order.indexOf(state));
  return order
    .map((step, i) => `<span class="dot ${i <= idx ? "on" : ""}"></span>`)
    .join("");
}

export function renderPreviewPage(project, baseUrl) {
  const view = publicProjectView(project);
  const launchUrl = `${baseUrl}/launch/${project.id}`;
  const previewSrc = view.previewUrl ? `${baseUrl}${view.previewUrl}` : "";
  const locationText = [view.city, view.category].filter(Boolean).join(" · ");
  const body = `
    <div class="wrap">
      <div class="card">
        <p class="eyebrow">Website preview</p>
        <h1>${view.businessName}</h1>
        <p>Here is your new website preview for ${view.businessName}${view.city ? ` in ${view.city}` : ""}. Open the full website page to review exactly what customers will see.</p>
        <div class="business-meta">
          ${locationText ? `<span class="meta-pill">${locationText}</span>` : ""}
          <span class="meta-pill">Client-ready presentation</span>
        </div>
        <div class="actions">
          ${previewSrc ? `<a class="btn btn-primary" href="${previewSrc}" target="_blank" rel="noopener">View full website</a>` : ""}
          <a class="btn btn-secondary" href="${launchUrl}">Claim & launch website</a>
        </div>
      </div>
      ${previewSrc ? `<div class="card stack">
        <p class="presentation-note">This preview opens as a full standalone website page with no embedded frame.</p>
        <ul class="list">
          <li>Review headline clarity and trust signals above the fold.</li>
          <li>Check mobile readability and CTA visibility.</li>
          <li>Use “Claim & launch website” when ready to go live.</li>
        </ul>
      </div>` : `<div class="card"><p>Preview is still generating. Refresh in a moment.</p></div>`}
    </div>
    <script>
      (function () {
        const projectId = ${JSON.stringify(project.id)};
        const sessionId = localStorage.getItem("wop_session") || (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()));
        localStorage.setItem("wop_session", sessionId);
        fetch("/api/public/funnel/event", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId, event: "preview_viewed", sessionId })
        }).catch(function () {});
        fetch("/api/public/projects/" + encodeURIComponent(projectId) + "/visitor", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ source: "preview_page" })
        }).catch(function () {});
      })();
    </script>`;
  return pageShell(`${view.businessName} — Preview`, body);
}

export function renderLaunchPage(project, baseUrl, { cancelled = false } = {}) {
  const view = publicProjectView(project);
  const checkoutUrl = `/api/public/projects/${encodeURIComponent(project.id)}/checkout`;
  const locationText = [view.city, view.category].filter(Boolean).join(" · ");
  const body = `
    <div class="wrap">
      <div class="card">
        <p class="eyebrow">Offer Snapshot</p>
        <h1>${view.businessName}</h1>
        <p>In 30 seconds: what this is, what it costs, what is included, how long it takes, and what happens next.</p>
        <div class="business-meta">
          ${locationText ? `<span class="meta-pill">${locationText}</span>` : ""}
          <span class="meta-pill">Built for local customer calls</span>
        </div>
        ${cancelled ? `<p style="color:#ffb4b4; margin-top:12px;">Checkout was cancelled. You can still book a call below or launch when ready.</p>` : ""}
        <div class="quick-grid">
          <div class="quick-item"><strong>What this is</strong><span>Done-for-you launch offer for your new website and local visibility setup.</span></div>
          <div class="quick-item"><strong>Cost</strong><span>$1,000 one-time launch</span></div>
          <div class="quick-item"><strong>Includes</strong><span>Website go-live, campaign activation, and live dashboard setup.</span></div>
          <div class="quick-item"><strong>Timeline</strong><span>Typical launch window: 5 business days.</span></div>
          <div class="quick-item"><strong>Next step</strong><span>Book a 15-minute call or start launch now.</span></div>
        </div>
      </div>

      <div class="card stack">
        <h2 class="section-title">Offer Summary</h2>
        <p class="muted-note">A focused launch package for ${view.businessName}${view.city ? ` in ${view.city}` : ""} to convert local traffic into calls and booked jobs.</p>
      </div>

      <div class="card stack">
        <h2 class="section-title">Deliverables</h2>
        <ul class="list">
          <li>Professional website built for your business</li>
          <li>Visibility campaign activated for your service area</li>
          <li>Live dashboard showing visitors and momentum</li>
          <li>Launch support and handoff checklist</li>
        </ul>
      </div>

      <div class="card stack">
        <h2 class="section-title">Timeline</h2>
        <ul class="timeline">
          <li><b>Day 1</b><span class="muted-note">15-minute kickoff call and launch checklist confirmation.</span></li>
          <li><b>Days 2-4</b><span class="muted-note">Final polish, verification, and publishing preparation.</span></li>
          <li><b>Day 5</b><span class="muted-note">Go live, activate campaign flow, and share dashboard access.</span></li>
        </ul>
      </div>

      <div class="card two-col">
        <div>
          <h2 class="section-title">Pricing</h2>
          <div class="price">$1,000</div>
          <p class="muted-note">One-time launch price. No hidden setup add-ons inside this offer snapshot.</p>
        </div>
        <div>
          <h2 class="section-title">Ownership / Hosting / Domain</h2>
          <ul class="list">
            <li>Domain ownership is confirmed in your name before launch.</li>
            <li>Website files and brand assets are documented at handoff.</li>
            <li>Hosting and recurring costs are clarified before go-live.</li>
          </ul>
        </div>
      </div>

      <div class="card">
        <h2 class="section-title">FAQ</h2>
        <div class="faq-grid">
          <div class="faq-item">
            <h3>What happens on the call?</h3>
            <p>We confirm scope, timeline, ownership details, and launch readiness for your business.</p>
          </div>
          <div class="faq-item">
            <h3>How long does launch take?</h3>
            <p>Most projects in this flow are prepared to launch within 5 business days after kickoff.</p>
          </div>
          <div class="faq-item">
            <h3>Do I need to provide lots of material?</h3>
            <p>No. The call is focused on final confirmations, not a long intake process.</p>
          </div>
          <div class="faq-item">
            <h3>Can I skip the call and launch now?</h3>
            <p>Yes. If you're ready, you can launch directly using secure checkout below.</p>
          </div>
        </div>
      </div>

      <div class="card">
        <h2 class="section-title">Next Step</h2>
        <form class="actions" id="offer-form">
          <input class="field" type="text" name="name" placeholder="Your name (optional)" />
          <input class="field" type="tel" name="phone" placeholder="Best phone (optional)" />
          <input class="field" type="email" name="email" placeholder="Email for scheduling and receipts" required />
          <button class="btn btn-secondary" type="button" id="book-call">Book 15-minute call</button>
          <button class="btn btn-primary" type="submit">Launch now</button>
        </form>
        <p id="offer-status" class="status-text"></p>
      </div>
    </div>
    <script>
      (function () {
        const projectId = ${JSON.stringify(project.id)};
        const sessionId = localStorage.getItem("wop_session") || (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()));
        localStorage.setItem("wop_session", sessionId);
        function track(event, meta) {
          return fetch("/api/public/funnel/event", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ projectId, event, sessionId, meta: meta || {} })
          }).catch(function () {});
        }
        track("launch_page_viewed");
        track("price_viewed");
        var form = document.getElementById("offer-form");
        var status = document.getElementById("offer-status");
        document.getElementById("book-call").addEventListener("click", async function () {
          var formData = new FormData(form);
          var meta = {
            intent: "book_call",
            name: formData.get("name"),
            phone: formData.get("phone"),
            email: formData.get("email")
          };
          await track("tell_me_more", meta);
          status.textContent = "Thanks — we received your request. Next step: we will contact you for a 15-minute call.";
        });
        form.addEventListener("submit", async function (event) {
          event.preventDefault();
          status.textContent = "Redirecting to secure checkout...";
          await track("launch_started");
          const email = new FormData(event.target).get("email");
          const response = await fetch(${JSON.stringify(checkoutUrl)}, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, sessionId })
          });
          const payload = await response.json().catch(function () { return {}; });
          if (!response.ok || !payload.url) {
            status.textContent = payload.error || "Could not start checkout.";
            return;
          }
          window.location.href = payload.url;
        });
      })();
    </script>`;
  return pageShell(`Launch — ${view.businessName}`, body);
}

export function renderActivatePage(project, baseUrl, { sessionId = "" } = {}) {
  const view = publicProjectView(project);
  const body = `
    <div class="wrap">
      <div class="card">
        <p class="eyebrow">Activation</p>
        <h1>Activating ${view.businessName}</h1>
        <p id="status">Confirming payment and launching your campaign...</p>
      </div>
    </div>
    <script>
      (function () {
        const projectId = ${JSON.stringify(project.id)};
        const sessionId = ${JSON.stringify(sessionId)};
        const status = document.getElementById("status");
        fetch("/api/public/projects/" + encodeURIComponent(projectId) + "/activate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId })
        })
          .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, data: d }; }); })
          .then(function (result) {
            if (!result.ok || !result.data.dashboardUrl) {
              status.textContent = result.data.error || "Activation could not be completed yet.";
              return;
            }
            status.textContent = "Success! Opening your dashboard...";
            window.location.href = result.data.dashboardUrl;
          })
          .catch(function () {
            status.textContent = "Something went wrong. Please contact support.";
          });
      })();
    </script>`;
  return pageShell(`Activate — ${view.businessName}`, body);
}

export async function renderDashboardPage(project, baseUrl, { token = "" } = {}) {
  const dashboard = await buildCustomerDashboard(project);
  const view = dashboard.project;
  const siteUrl = view.siteUrl ? `${baseUrl}${view.siteUrl}` : null;
  const dots = momentumDots(dashboard.momentum.state);
  const activityHtml = dashboard.activity.length
    ? dashboard.activity
        .map(
          (item) => `
        <div class="feed-item">
          <h3>${item.headline}</h3>
          <p>${item.detail}${item.geoLabel ? ` · ${item.geoLabel}` : ""}</p>
          ${item.cta?.url ? `<p style="margin-top:10px;"><a class="btn btn-secondary" href="${item.cta.url}">${item.cta.label || "View"}</a></p>` : ""}
          <p style="margin-top:8px; font-size:12px;">${item.occurredRelative || ""}</p>
        </div>`
        )
        .join("")
    : `<div class="feed-item"><h3>Your campaign just went live</h3><p>Updates will appear here as people in your area start finding you.</p></div>`;

  const deltaText =
    dashboard.movement.visitorDelta == null
      ? ""
      : dashboard.movement.visitorDelta >= 0
        ? `+${dashboard.movement.visitorDelta} vs prior week`
        : `${dashboard.movement.visitorDelta} vs prior week`;

  const body = `
    <div class="wrap">
      <div class="card" style="margin-bottom:16px;">
        <div class="header-row">
          <div>
            <p class="eyebrow">Outcome dashboard</p>
            <h1>${view.businessName}</h1>
            <div class="status-pill"><span class="status-dot pulse"></span> Live · ${view.city}</div>
          </div>
          ${siteUrl ? `<a class="btn btn-primary" href="${siteUrl}" target="_blank" rel="noopener">Open my site</a>` : ""}
        </div>
      </div>

      <div class="card" style="margin-bottom:16px;">
        <div class="momentum-dots">${dots}</div>
        <p class="eyebrow">${dashboard.momentum.label}</p>
        <h1 style="font-size:28px;">${dashboard.momentum.primary}</h1>
        <p>${dashboard.momentum.subline}</p>
      </div>

      <div class="card" style="margin-bottom:16px;">
        <p class="eyebrow">This week</p>
        <div class="grid-3">
          <div class="stat"><strong>${dashboard.movement.visitorsThisWeek}</strong>site visits${deltaText ? `<br><span style="font-size:13px;color:var(--muted);">${deltaText}</span>` : ""}</div>
          <div class="stat"><strong>${dashboard.movement.updatesThisWeek}</strong>area updates</div>
          <div class="stat"><strong>${dashboard.movement.lastActivityRelative || "—"}</strong>last activity</div>
        </div>
      </div>

      <div class="card">
        <p class="eyebrow">Recent activity</p>
        <div class="feed">${activityHtml}</div>
      </div>
    </div>
    <script>
      (function () {
        const projectId = ${JSON.stringify(project.id)};
        const token = ${JSON.stringify(token)};
        const sessionId = localStorage.getItem("wop_session") || "";
        fetch("/api/public/funnel/event", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId, event: "dashboard_viewed", sessionId })
        }).catch(function () {});
        if (token) {
          fetch("/api/customer/projects/" + encodeURIComponent(projectId) + "/dashboard?token=" + encodeURIComponent(token))
            .then(function (r) { return r.json(); })
            .catch(function () {});
        }
      })();
    </script>`;
  return pageShell(`Dashboard — ${view.businessName}`, body);
}
