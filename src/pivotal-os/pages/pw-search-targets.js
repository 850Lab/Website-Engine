import { zealShell } from "../zeal-shell.js";
import { clientSafeRenderScript } from "../safe-render.js";

export function renderPwSearchTargetsPage() {
  const body = `
    <p class="eyebrow">Lead Discovery</p>
    <h1 class="hero-title" style="margin:0 0 12px">Search Targets</h1>
    <p class="hero-sub">Southeast Texas queries for <code style="font-size:13px">npm run pw:find-leads -- --scrape</code></p>

    <div class="card">
      <div class="card-label">Configured searches</div>
      <div id="targetsList" class="loading">Loading targets…</div>
    </div>

    <div class="card">
      <div class="card-label">Run from terminal</div>
      <p class="card-body" style="margin:0 0 10px;font-family:monospace;font-size:14px;background:var(--bg-elevated);padding:12px;border-radius:8px" id="cmdText">npm run pw:find-leads -- --scrape</p>
      <p class="card-body" style="margin:0;font-size:13px;color:var(--text-dim)">Run this in Cursor or your terminal. The browser cannot execute local scripts for security reasons.</p>
    </div>

    <a class="btn btn-ghost btn-block" href="/" style="margin-top:12px">← Back to Command Center</a>
  `;

  const headExtra = `
    .target-row { padding: 12px 0; border-bottom: 1px solid var(--border); }
    .target-row:last-child { border-bottom: none; }
    .target-query { font-weight: 700; font-size: 16px; margin-bottom: 4px; }
    .target-meta { font-size: 14px; color: var(--text-muted); }
  `;

  const script = `
    ${clientSafeRenderScript()}

    fetch('/api/pw/search-targets').then(function(r){return r.json();}).then(function(data){
      var el=document.getElementById('targetsList');
      el.replaceChildren();
      var targets=data.targets||[];
      if(!targets.length){
        el.appendChild(makeEl('p','card-body','No search targets configured. Add entries to data/pw-search-targets.json'));
        return;
      }
      targets.forEach(function(t){
        var row=makeEl('div','target-row');
        var q=makeEl('div','target-query');
        setPlainText(q, t.query||'');
        row.appendChild(q);
        var meta=makeEl('div','target-meta');
        setPlainText(meta, [t.city, t.industry, t.maxResults?'max '+t.maxResults:null].filter(Boolean).join(' · '));
        row.appendChild(meta);
        el.appendChild(row);
      });
      if(data.findLeadsCommand){
        document.getElementById('cmdText').textContent=data.findLeadsCommand;
      }
    }).catch(function(e){
      document.getElementById('targetsList').textContent=sanitizeText(e.message);
    });
  `;

  return zealShell({
    title: "Search Targets",
    activeNav: "pw-home",
    bodyHtml: body + `<script>${script}</script>`,
    headExtra,
  });
}
