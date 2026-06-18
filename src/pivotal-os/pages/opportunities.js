import { pivotalShell } from "../shell.js";

export function renderOpportunitiesPage() {
  const headExtra = `
    .folder-card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 18px;
      margin-bottom: 12px;
    }
    .folder-title { font-size: 18px; font-weight: 800; letter-spacing: -0.02em; margin-bottom: 4px; }
    .folder-count { font-size: 13px; color: var(--text-dim); margin-bottom: 14px; }
    .folder-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 14px; }
    .folder-stat { background: var(--bg-elevated); border-radius: var(--radius-sm); padding: 12px; }
    .folder-stat-num { font-size: 18px; font-weight: 800; }
    .folder-stat-label { font-size: 10px; font-weight: 600; color: var(--text-dim); text-transform: uppercase; letter-spacing: 0.06em; margin-top: 2px; }
    .top-opp { font-size: 14px; color: var(--text-muted); margin-bottom: 14px; line-height: 1.45; }
    .folder-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  `;

  const body = `
    <p class="eyebrow">Opportunities</p>
    <h1 class="hero-title">Angle folders</h1>
    <p class="hero-sub" id="oppSub">Grouped by problem — not by database table.</p>
    <div id="folderList"><div class="loading">Loading opportunities…</div></div>
  `;

  const script = `
    function esc(s){return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
    function money(n){return '$'+Number(n).toLocaleString();}

    fetch('/api/pivotal-os/opportunities').then(function(r){return r.json();}).then(function(data){
      document.getElementById('oppSub').textContent=data.totalAnalyzed+' businesses analyzed · sorted by revenue potential';
      document.getElementById('folderList').innerHTML=data.folders.map(function(f){
        var top=f.topOpportunity;
        var topHtml=top?'<div class="top-opp"><strong style="color:var(--text)">Top:</strong> '+esc(top.businessName)+' · '+esc(top.city)+' · '+top.confidence+'%</div>':'';
        return '<div class="folder-card">'+
          '<div class="folder-title">'+esc(f.shortLabel)+'</div>'+
          '<div class="folder-count">'+f.count+' businesses</div>'+
          '<div class="folder-stats">'+
            '<div class="folder-stat"><div class="folder-stat-num">'+money(f.potentialRevenue)+'</div><div class="folder-stat-label">Potential revenue</div></div>'+
            '<div class="folder-stat"><div class="folder-stat-num">'+f.readyToCall+'</div><div class="folder-stat-label">Ready to call</div></div>'+
            '<div class="folder-stat"><div class="folder-stat-num">'+f.avgConfidence+'%</div><div class="folder-stat-label">Avg confidence</div></div>'+
            '<div class="folder-stat"><div class="folder-stat-num">P'+f.priority+'</div><div class="folder-stat-label">Priority</div></div>'+
          '</div>'+topHtml+
          '<div class="folder-actions">'+
            '<a class="btn btn-primary" href="/call-queue?folder='+encodeURIComponent(f.key)+'">Call highest</a>'+
            '<a class="btn btn-ghost" href="/call-queue?folder='+encodeURIComponent(f.key)+'">View folder</a>'+
          '</div></div>';
      }).join('');
    }).catch(function(e){document.getElementById('oppSub').textContent=e.message;});
  `;

  return pivotalShell({
    title: "Opportunities",
    activeNav: "opportunities",
    bodyHtml: body + `<script>${script}</script>`,
    headExtra,
  });
}
