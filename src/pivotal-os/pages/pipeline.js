import { pivotalShell } from "../shell.js";

export function renderPipelinePage() {
  const headExtra = `
    .pipeline-total { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:16px; }
    .stage-list { display:flex; flex-direction:column; gap:8px; }
    .stage-row {
      display:flex; align-items:center; gap:12px;
      background:var(--bg-card); border:1px solid var(--border);
      border-radius:var(--radius-sm); padding:14px 16px;
      text-decoration:none; color:inherit; transition:background 0.15s;
    }
    .stage-row:active { background:var(--bg-card-hover); }
    .stage-count { font-size:24px; font-weight:800; min-width:36px; letter-spacing:-0.02em; }
    .stage-info { flex:1; min-width:0; }
    .stage-name { font-size:15px; font-weight:700; margin-bottom:2px; }
    .stage-meta { font-size:12px; color:var(--text-dim); }
    .stage-bar { width:48px; height:4px; background:rgba(255,255,255,0.06); border-radius:999px; overflow:hidden; }
    .stage-bar-fill { height:100%; background:var(--accent); border-radius:999px; }
  `;

  const body = `
    <p class="eyebrow">Pipeline</p>
    <h1 class="hero-title">Revenue path</h1>
    <p class="hero-sub" id="pipelineSub">Loading pipeline…</p>

    <div class="pipeline-total">
      <div class="card"><div class="card-label">Active deals</div><div class="card-value" id="activeCount">—</div></div>
      <div class="card"><div class="card-label">Pipeline value</div><div class="card-value" id="pipelineValue">—</div></div>
    </div>

    <div class="card" style="margin-bottom:16px">
      <div class="card-label">Win rate</div>
      <div class="card-value" id="winRate">—</div>
      <div class="card-body" id="convRate" style="margin-top:6px"></div>
    </div>

    <div class="card-label" style="margin-bottom:8px">Stages</div>
    <div class="stage-list" id="stageList"><div class="loading">Loading stages…</div></div>
  `;

  const script = `
    function money(n){return '$'+Number(n).toLocaleString();}

    fetch('/api/pivotal-os/pipeline').then(function(r){return r.json();}).then(function(data){
      document.getElementById('pipelineSub').textContent=data.totalActive+' active opportunities in pipeline';
      document.getElementById('activeCount').textContent=data.totalActive;
      document.getElementById('pipelineValue').textContent=money(data.totalRevenue);
      document.getElementById('winRate').textContent=data.winRate+'%';
      document.getElementById('convRate').textContent=data.conversionToAppointment+'% convert to appointment';
      var max=Math.max.apply(null,data.stages.map(function(s){return s.count;}).concat([1]));
      document.getElementById('stageList').innerHTML=data.stages.map(function(s){
        var w=Math.round(s.count/max*100);
        return '<div class="stage-row">'+
          '<div class="stage-count">'+s.count+'</div>'+
          '<div class="stage-info"><div class="stage-name">'+s.label+'</div>'+
          '<div class="stage-meta">'+money(s.revenue)+' potential</div></div>'+
          '<div class="stage-bar"><div class="stage-bar-fill" style="width:'+w+'%"></div></div></div>';
      }).join('');
    }).catch(function(e){document.getElementById('pipelineSub').textContent=e.message;});
  `;

  return pivotalShell({
    title: "Pipeline",
    activeNav: "pipeline",
    bodyHtml: body + `<script>${script}</script>`,
    headExtra,
  });
}
