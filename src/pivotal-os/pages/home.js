import { pivotalShell } from "../shell.js";
import { clientSafeRenderScript } from "../safe-render.js";

const MODE_STORAGE_KEY = "pivotalCampaignMode";

export function renderHomePage() {
  const body = `
    <div class="mode-switch" id="modeSwitch" role="tablist" aria-label="Campaign mode">
      <button type="button" class="mode-btn active" data-mode="website" role="tab" aria-selected="true">Website Mode</button>
      <button type="button" class="mode-btn" data-mode="pressure-washing" role="tab" aria-selected="false">Pressure Washing Mode</button>
    </div>

    <p class="eyebrow" id="modeEyebrow">Website Outreach</p>
    <h1 class="hero-title" id="modeTitle">Website Outreach Command Center</h1>
    <p class="hero-sub" id="greeting">Loading your day…</p>

    <div id="websitePanel">
      <div class="card card-highlight" id="webFocusCard">
        <div class="card-label">Current Focus</div>
        <div id="webFocusBody" class="focus-body">Loading…</div>
        <button type="button" class="btn btn-ghost btn-block" id="webEditFocusBtn" style="margin-top:12px">Edit Focus</button>
      </div>
      <div class="card" id="webInventoryCard">
        <div class="card-label">Focused Lead Inventory</div>
        <div id="webInventoryBody">Loading…</div>
      </div>
      <div class="card" id="webBaselineCard">
        <div class="card-label">Baseline Progress</div>
        <div id="webBaselineBody">Loading…</div>
      </div>
      <div class="card hidden warn-card" id="webLowLeadsCard">
        <div class="card-body" id="webLowLeadsBody"></div>
      </div>
      <div class="btn-row" style="margin-top:4px">
        <a class="btn btn-primary btn-block" href="/call-queue">Start Calling</a>
        <a class="btn btn-ghost btn-block" href="/call-queue">View Matching Leads</a>
      </div>
    </div>

    <div id="pwPanel" class="hidden">
      <div class="card card-highlight pw-highlight" id="pwFocusCard">
        <div class="card-label">Current Focus</div>
        <div id="pwFocusBody" class="focus-body">Loading…</div>
        <button type="button" class="btn btn-ghost btn-block" id="pwEditFocusBtn" style="margin-top:12px">Edit Focus</button>
      </div>
      <div class="card" id="pwInventoryCard">
        <div class="card-label">Focused Lead Inventory</div>
        <div id="pwInventoryBody">Loading…</div>
      </div>
      <div class="card" id="pwBaselineCard">
        <div class="card-label">Baseline Progress</div>
        <div id="pwBaselineBody">Loading…</div>
      </div>
      <div class="card hidden warn-card" id="pwLowLeadsCard">
        <div class="card-body" id="pwLowLeadsBody"></div>
      </div>
      <div class="btn-row" style="margin-top:4px">
        <a class="btn btn-primary btn-block pw-cta" href="/pw/queue">Start Calling</a>
        <a class="btn btn-ghost btn-block" href="/pw/queue">View Matching Leads</a>
      </div>
    </div>

    <div class="sheet" id="focusEditSheet">
      <div class="sheet-panel">
        <div class="sheet-handle"></div>
        <h2 style="font-size:18px;font-weight:800;margin:0 0 14px">Edit Focus</h2>
        <div class="field-label">Industry</div>
        <input class="field-input" id="focusIndustry" />
        <div class="field-label">City</div>
        <input class="field-input" id="focusCity" />
        <div class="field-label">Offer</div>
        <input class="field-input" id="focusOffer" />
        <div class="field-label">Salesperson</div>
        <input class="field-input" id="focusSalesperson" />
        <button type="button" class="btn btn-primary btn-block" id="focusSaveBtn">Save Focus</button>
        <button type="button" class="btn btn-ghost btn-block" id="focusCancelBtn" style="margin-top:8px">Cancel</button>
      </div>
    </div>
  `;

  const headExtra = `
    .mode-switch {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      margin-bottom: 18px;
      padding: 4px;
      background: var(--bg-elevated);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
    }
    .mode-btn {
      min-height: var(--tap);
      border: none;
      border-radius: 10px;
      background: transparent;
      color: var(--text-muted);
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      padding: 12px 8px;
      line-height: 1.2;
    }
    .mode-btn.active {
      background: var(--accent-soft);
      color: var(--text);
      box-shadow: inset 0 0 0 1px rgba(99,102,241,0.35);
    }
    body.mode-pressure-washing {
      background: radial-gradient(ellipse 80% 50% at 50% -20%, rgba(14,165,233,0.18), transparent), var(--bg);
    }
    body.mode-pressure-washing .mode-btn.active {
      background: rgba(14,165,233,0.18);
      box-shadow: inset 0 0 0 1px rgba(14,165,233,0.4);
    }
    body.mode-pressure-washing .pw-highlight {
      border-color: rgba(14,165,233,0.35);
      background: linear-gradient(145deg, rgba(14,165,233,0.12), rgba(24,24,27,0.95));
    }
    body.mode-pressure-washing .pw-cta {
      background: #0ea5e9;
      border-color: transparent;
    }
    .pw-stat-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      font-size: 14px;
      line-height: 1.45;
    }
    .focus-body { font-size: 15px; line-height: 1.6; }
    .focus-row { display: flex; justify-content: space-between; gap: 12px; padding: 6px 0; border-bottom: 1px solid var(--border); }
    .focus-row:last-child { border-bottom: none; }
    .focus-key { color: var(--text-dim); font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
    .focus-val { font-weight: 600; text-align: right; }
    .focus-insight { margin-top: 12px; font-size: 14px; color: var(--text-muted); line-height: 1.5; }
    .focus-metric { margin-bottom: 10px; font-size: 15px; }
    .focus-metric strong { color: var(--text); }
    .inventory-status { font-weight: 800; margin-top: 8px; }
    .inventory-status.low { color: #fbbf24; }
    .inventory-status.critical { color: #f87171; }
    .discovery-cmd { font-family: ui-monospace, monospace; font-size: 13px; margin-top: 8px; color: var(--text-muted); word-break: break-all; }
    .progress-wrap { margin-top: 12px; }
    .progress-bar { height: 10px; background: var(--bg-elevated); border-radius: 999px; overflow: hidden; }
    .progress-fill { height: 100%; background: var(--accent); border-radius: 999px; transition: width 0.2s; }
    body.mode-pressure-washing .progress-fill { background: #0ea5e9; }
    .warn-card { border-color: rgba(251,191,36,0.45); background: rgba(251,191,36,0.08); }
    .field-label { font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--text-dim); margin-bottom: 6px; letter-spacing: 0.06em; }
    .field-input { width:100%; min-height:var(--tap); border:1px solid var(--border); border-radius:var(--radius-sm); background:var(--bg-elevated); color:var(--text); padding:14px 16px; font-size:16px; font-family:inherit; margin-bottom:10px; }
    .sheet { display:none; position:fixed; inset:0; background:rgba(0,0,0,0.6); z-index:150; align-items:flex-end; }
    .sheet.open { display:flex; }
    .sheet-panel { width:100%; background:var(--bg-card); border-top:1px solid var(--border); border-radius:20px 20px 0 0; padding:20px 16px calc(20px + var(--safe-bottom)); max-height:80dvh; overflow-y:auto; }
    .sheet-handle { width:40px; height:4px; background:var(--border-strong); border-radius:999px; margin:0 auto 16px; }
    .next-name { font-size: clamp(22px, 5vw, 28px); font-weight: 800; letter-spacing: -0.02em; margin-bottom: 10px; }
  `;

  const script = `
    ${clientSafeRenderScript()}

    var MODE_KEY='${MODE_STORAGE_KEY}';
    var currentMode='website';

    function esc(s){return escHtml(s);}
    function pct(c,t){return t?Math.min(100,Math.round(c/t*100)):0;}
    function money(n){return '$'+Number(n||0).toLocaleString();}

    function getStoredMode(){
      try{
        var m=localStorage.getItem(MODE_KEY);
        return m==='pressure-washing'?'pressure-washing':'website';
      }catch(e){ return 'website'; }
    }

    function setMode(mode){
      currentMode=mode==='pressure-washing'?'pressure-washing':'website';
      try{ localStorage.setItem(MODE_KEY, currentMode); }catch(e){}
      document.body.classList.toggle('mode-pressure-washing', currentMode==='pressure-washing');
      document.getElementById('websitePanel').classList.toggle('hidden', currentMode!=='website');
      document.getElementById('pwPanel').classList.toggle('hidden', currentMode!=='pressure-washing');
      document.querySelectorAll('.mode-btn').forEach(function(btn){
        var active=btn.getAttribute('data-mode')===currentMode;
        btn.classList.toggle('active', active);
        btn.setAttribute('aria-selected', active?'true':'false');
      });
      if(currentMode==='website'){
        document.getElementById('modeEyebrow').textContent='Website Outreach';
        document.getElementById('modeTitle').textContent='Website Outreach Command Center';
        loadFocusMetrics('website');
      }else{
        document.getElementById('modeEyebrow').textContent='Zeal Power Washing';
        document.getElementById('modeTitle').textContent='Pressure Washing Outreach Command Center';
        loadFocusMetrics('pressure-washing');
      }
    }

    function focusPrefix(mode){
      return mode==='pressure-washing'?'pw':'web';
    }

    function renderFocusRow(key, val){
      var row=makeEl('div','focus-row');
      row.appendChild(makeEl('span','focus-key',key));
      var v=makeEl('span','focus-val');
      setPlainText(v, val);
      row.appendChild(v);
      return row;
    }

    function renderFocusCard(mode, data){
      var p=focusPrefix(mode);
      var body=document.getElementById(p+'FocusBody');
      body.replaceChildren();
      var f=data.focus||{};
      var c=data.clock||{};
      body.appendChild(renderFocusRow('Industry', f.industry||''));
      body.appendChild(renderFocusRow('City', f.city||''));
      body.appendChild(renderFocusRow('Offer', f.offer||''));
      body.appendChild(renderFocusRow('Salesperson', f.salesperson||''));
      body.appendChild(renderFocusRow('Day', c.dayOfWeek||''));
      body.appendChild(renderFocusRow('Time Bucket', c.timeBucket||''));
      body.appendChild(renderFocusRow('Status', data.baselineComplete?'Baseline Established':'Baseline Collection'));
    }

    function inventoryStatusClass(status){
      if(status==='Healthy') return 'healthy';
      if(status==='Low Inventory') return 'low';
      return 'critical';
    }

    function renderInventoryCard(mode, data){
      var p=focusPrefix(mode);
      var body=document.getElementById(p+'InventoryBody');
      var inv=data.inventory||{};
      var targets=inv.targets||{available:50,active:25};
      body.replaceChildren();
      body.appendChild(makeEl('div','focus-metric','Available: '+String(inv.available||0)));
      body.appendChild(makeEl('div','focus-metric','Active: '+String(inv.active||0)));
      body.appendChild(makeEl('div','focus-metric','Target: '+targets.available+' Available · '+targets.active+' Active'));
      var statusEl=makeEl('div','inventory-status '+inventoryStatusClass(inv.status||''),'Status: '+(inv.status||'Unknown'));
      body.appendChild(statusEl);
    }

    function renderBaselineCard(mode, data){
      var p=focusPrefix(mode);
      var body=document.getElementById(p+'BaselineBody');
      var b=data.baseline||{};
      var funnel=data.funnel||{};
      body.replaceChildren();
      body.appendChild(makeEl('div','focus-metric','Calls: '+String(b.calls||0)+' / '+String(b.target||100)));
      body.appendChild(makeEl('div','focus-metric','Conversations: '+String(b.conversations||funnel.conversations||0)));
      if(mode==='pressure-washing'){
        body.appendChild(makeEl('div','focus-metric','Estimates: '+String(b.estimates||funnel.estimates||0)));
      }
      body.appendChild(makeEl('div','focus-metric','Sales: '+String(b.sales||funnel.sales||0)));
      body.appendChild(makeEl('div','focus-metric','Current Ratio: '+(b.currentRatio||data.ratios?.currentRatio||'Not enough data')));
    }

    function renderLowLeadsWarning(mode, data){
      var p=focusPrefix(mode);
      var lowEl=document.getElementById(p+'LowLeadsCard');
      var inv=data.inventory||{};
      var q=data.queue||{};
      if(inv.lowInventory||q.lowFocusedLeads){
        lowEl.classList.remove('hidden');
        var lowText=q.warning||inv.warning||'Low focused lead inventory.';
        if(q.leadDiscovery&&q.leadDiscovery.command){
          lowText+=' Run: '+q.leadDiscovery.command;
        }
        var body=document.getElementById(p+'LowLeadsBody');
        body.replaceChildren();
        body.appendChild(makeEl('div','',sanitizeText(lowText)));
        if(q.leadDiscovery&&q.leadDiscovery.command){
          body.appendChild(makeEl('div','discovery-cmd',q.leadDiscovery.command));
        }
      }else{
        lowEl.classList.add('hidden');
      }
    }

    function renderFocusMetrics(mode, data){
      renderInventoryCard(mode, data);
      renderBaselineCard(mode, data);
      renderLowLeadsWarning(mode, data);
    }

    function loadFocusMetrics(mode){
      fetch('/api/outreach/focus-metrics?mode='+encodeURIComponent(mode)).then(function(r){return r.json();}).then(function(data){
        renderFocusCard(mode, data);
        renderFocusMetrics(mode, data);
        if(currentMode===(mode==='pressure-washing'?'pressure-washing':'website')){
          var g=greetName();
          document.getElementById('greeting').textContent=g.greet+', '+g.name+'. '+data.progress.current+' / '+data.progress.target+' focused calls logged.';
        }
      }).catch(function(e){
        var p=focusPrefix(mode);
        document.getElementById(p+'FocusBody').textContent=sanitizeText(e.message);
      });
    }

    var editingFocusMode='website';
    function openFocusEditor(mode){
      editingFocusMode=mode;
      fetch('/api/outreach/focus?mode='+encodeURIComponent(mode)).then(function(r){return r.json();}).then(function(data){
        var f=data.focus||{};
        document.getElementById('focusIndustry').value=f.industry||'';
        document.getElementById('focusCity').value=f.city||'';
        document.getElementById('focusOffer').value=f.offer||'';
        document.getElementById('focusSalesperson').value=f.salesperson||'';
        document.getElementById('focusEditSheet').classList.add('open');
      });
    }

    function closeFocusEditor(){
      document.getElementById('focusEditSheet').classList.remove('open');
    }

    document.getElementById('webEditFocusBtn').onclick=function(){ openFocusEditor('website'); };
    document.getElementById('pwEditFocusBtn').onclick=function(){ openFocusEditor('pressure-washing'); };
    document.getElementById('focusCancelBtn').onclick=closeFocusEditor;
    document.getElementById('focusSaveBtn').onclick=function(){
      jsonFetch('/api/outreach/focus',{
        method:'PATCH',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          mode: editingFocusMode,
          industry: document.getElementById('focusIndustry').value.trim(),
          city: document.getElementById('focusCity').value.trim(),
          offer: document.getElementById('focusOffer').value.trim(),
          salesperson: document.getElementById('focusSalesperson').value.trim()
        })
      }).then(function(){
        closeFocusEditor();
        loadFocusMetrics(editingFocusMode);
      }).catch(function(e){ alert(e.message); });
    };

    function greetName(operator){
      var h=new Date().getHours();
      var greet=h<12?'Good morning':h<17?'Good afternoon':'Good evening';
      var name=operator&&operator.name?operator.name.split(' ')[0]:'Jaylan';
      return { greet: greet, name: name };
    }

    async function jsonFetch(url, opts){
      var res=await fetch(url, opts||{});
      var data=await res.json();
      if(!res.ok) throw new Error(data.error||res.statusText);
      return data;
    }

    document.getElementById('modeSwitch').addEventListener('click',function(e){
      var btn=e.target.closest('.mode-btn');
      if(!btn) return;
      setMode(btn.getAttribute('data-mode'));
    });

    setMode(getStoredMode());
  `;

  return pivotalShell({
    title: "Mission Control",
    activeNav: "home",
    bodyHtml: body + `<script>${script}</script>`,
    headExtra,
  });
}
