import { pivotalShell } from "../shell.js";
import { CALL_QUEUE_OUTCOMES } from "../metrics.js";

export function renderCallQueuePage() {
  const outcomeButtons = CALL_QUEUE_OUTCOMES.map(
    (o) => `<button type="button" class="outcome-btn" data-outcome="${o.id}" data-status="${o.status}">${o.label}</button>`,
  ).join("");

  const headExtra = `
    .lead-hero { margin-bottom: 16px; }
    .lead-phone { font-size: 15px; color: var(--text-muted); margin-bottom: 14px; }
    .script-card { background: var(--bg-elevated); border-radius: var(--radius-sm); padding: 14px; margin-bottom: 10px; border: 1px solid var(--border); }
    .script-label { font-size: 10px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--text-dim); margin-bottom: 6px; }
    .script-text { font-size: 17px; line-height: 1.55; font-weight: 500; }
    .discovery-q { font-size: 15px; margin-bottom: 8px; color: var(--text); font-weight: 500; }
    .discovery-q:last-child { margin-bottom: 0; }
    .action-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px; }
    .action-grid .btn { min-height: var(--tap-lg); font-size: 17px; }
    .call-status {
      font-size: 14px; font-weight: 600; margin-bottom: 14px; min-height: 20px;
      color: var(--accent); line-height: 1.4;
    }
    .call-status.error { color: #f87171; }
    .call-status.ok { color: #4ade80; }
    .dock-actions {
      position: fixed;
      left: 0; right: 0;
      bottom: calc(var(--nav-h) + var(--safe-bottom));
      padding: 10px 12px;
      background: rgba(9,9,11,0.95);
      backdrop-filter: blur(16px);
      border-top: 1px solid var(--border);
      display: grid;
      grid-template-columns: 1fr 1.3fr;
      gap: 10px;
      z-index: 50;
    }
    .app { padding-bottom: calc(var(--nav-h) + 80px + var(--safe-bottom)); }
    .sheet { display:none; position:fixed; inset:0; background:rgba(0,0,0,0.6); z-index:150; align-items:flex-end; }
    .sheet.open { display:flex; }
    .sheet-panel {
      width:100%; background:var(--bg-card); border-top:1px solid var(--border);
      border-radius:20px 20px 0 0; padding:20px 16px calc(20px + var(--safe-bottom));
      max-height:80dvh; overflow-y:auto;
    }
    .sheet-handle { width:40px; height:4px; background:var(--border-strong); border-radius:999px; margin:0 auto 16px; }
    .sheet-title { font-size:18px; font-weight:800; margin:0 0 14px; }
    .outcome-grid { display:flex; flex-direction:column; gap:8px; }
    .outcome-btn {
      min-height:var(--tap); border:1px solid var(--border); border-radius:var(--radius-sm);
      background:var(--bg-elevated); color:var(--text); font-size:16px; font-weight:600;
      padding:14px 16px; text-align:left; cursor:pointer;
    }
    .outcome-btn:active { transform:scale(0.99); }
    .outcome-btn.active { background:var(--accent-soft); border-color:rgba(99,102,241,0.4); }
    .queue-meta { font-size:13px; color:var(--text-dim); margin-bottom:12px; }
    .focus-banner {
      font-size: 14px; line-height: 1.45; padding: 12px 14px; margin-bottom: 12px;
      border-radius: var(--radius-sm); border: 1px solid var(--border); background: var(--bg-elevated);
    }
    .focus-banner.warn { border-color: rgba(251,191,36,0.45); background: rgba(251,191,36,0.08); color: var(--text); }
    .focus-body { font-size: 14px; line-height: 1.55; }
    .focus-line { margin-bottom: 4px; }
  `;

  const body = `
    <p class="eyebrow">Call Queue</p>
    <div class="card card-highlight" id="focusCard">
      <div class="card-label">Current Focus</div>
      <div id="focusBody" class="focus-body">Loading…</div>
    </div>
    <div class="focus-banner warn hidden" id="focusLowBanner"></div>
    <div class="queue-meta" id="queueMeta">Loading…</div>
    <div id="leadView" class="hidden"></div>
    <div class="loading" id="loading">Loading next lead…</div>

    <div class="dock-actions" id="dockActions">
      <button type="button" class="btn btn-ghost" id="outcomeBtn">Log result</button>
      <button type="button" class="btn btn-primary" id="nextBtn">Next lead →</button>
    </div>

    <div class="toast" id="toast"></div>

    <div class="sheet" id="outcomeSheet">
      <div class="sheet-panel">
        <div class="sheet-handle"></div>
        <h2 class="sheet-title">What happened?</h2>
        <div class="outcome-grid">${outcomeButtons}</div>
        <button type="button" class="btn btn-ghost btn-block" id="outcomeCancel" style="margin-top:12px">Cancel</button>
      </div>
    </div>
  `;

  const script = `
    var currentLead=null, nextLeadId=null, toastTimer=null;

    function esc(s){return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
    function showToast(msg){
      var el=document.getElementById('toast'); el.textContent=msg; el.classList.add('show');
      clearTimeout(toastTimer); toastTimer=setTimeout(function(){el.classList.remove('show');},1600);
    }
    function setBusy(on){document.body.classList.toggle('busy',on);}

    function renderDiscoveryQuestions(questions){
      if(!questions||!questions.length) return '';
      var items=questions.slice(0,5).map(function(q,i){
        return '<div class="script-text discovery-q">'+(i+1)+'. '+esc(q)+'</div>';
      }).join('');
      return '<div class="script-card"><div class="script-label">Discovery Questions</div>'+items+'</div>';
    }

    function renderLead(lead){
      return '<div class="lead-hero">'+
        '<h1 class="hero-title" style="margin:0">'+esc(lead.businessName)+'</h1>'+
        '<div class="lead-phone">'+esc(lead.city)+(lead.industry?' · '+esc(lead.industry):'')+(lead.phone?' · '+esc(lead.phone):'')+'</div>'+
        '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px">'+
          '<span class="badge hot">'+esc(lead.priorityLabel)+'</span>'+
          '<span class="badge">'+esc(lead.folderLabel)+'</span>'+
          (lead.confidenceScore?'<span class="badge accent">'+lead.confidenceScore+'%</span>':'')+
        '</div></div>'+
        '<div id="callStatus" class="call-status" aria-live="polite"></div>'+
        '<div class="action-grid">'+
          (lead.actions.call
            ? '<button type="button" class="btn btn-primary" id="recordedCallBtn">📞 Call with Recording</button>'
            : '<span class="btn btn-ghost" style="opacity:0.4">No phone</span>')+
          (lead.actions.call
            ? '<a class="btn btn-ghost" href="'+esc(lead.actions.call)+'">Call Direct</a>'
            : '<span class="btn btn-ghost" style="opacity:0.4">No phone</span>')+
        '</div>'+
        (lead.actions.text
          ? '<a class="btn btn-ghost btn-block" href="'+esc(lead.actions.text)+'" style="margin-bottom:14px">💬 Text</a>'
          : '')+
        (lead.previewUrl?'<a class="btn btn-ghost btn-block" href="'+esc(lead.previewUrl)+'" target="_blank" rel="noopener" style="margin-bottom:14px">Open preview</a>':'')+
        '<div class="script-card"><div class="script-label">Problem</div><div class="script-text" style="font-size:15px;color:var(--text-muted)">'+esc(lead.problem)+'</div></div>'+
        '<div class="script-card"><div class="script-label">Angle</div><div class="script-text" style="font-size:15px;color:var(--text-muted)">'+esc(lead.primaryAngle)+'</div></div>'+
        '<div class="script-card"><div class="script-label">Opening line</div><div class="script-text">'+esc(lead.openingLine)+'</div></div>'+
        renderDiscoveryQuestions(lead.discoveryQuestions)+
        '<div class="script-card"><div class="script-label">Offer</div><div class="script-text" style="font-size:15px;color:var(--text-muted)">'+esc(lead.recommendedOffer)+'</div></div>'+
        (lead.goldenQuestion?'<div class="script-card"><div class="script-label">Golden Question</div><div class="script-text">'+esc(lead.goldenQuestion)+'</div></div>':'');
    }

    async function jsonFetch(url,opts){
      var res=await fetch(url,opts); var data=await res.json();
      if(!res.ok) throw new Error(data.error||res.statusText); return data;
    }

    function renderFocusCard(focusMeta){
      var bodyEl=document.getElementById('focusBody');
      var lowEl=document.getElementById('focusLowBanner');
      if(!focusMeta||!focusMeta.focus){
        bodyEl.textContent='Focus config unavailable.';
        lowEl.classList.add('hidden');
        return;
      }
      var f=focusMeta.focus;
      var c=focusMeta.clock||{};
      bodyEl.innerHTML=
        '<div class="focus-line"><strong>Industry:</strong> '+esc(f.industry)+'</div>'+
        '<div class="focus-line"><strong>City:</strong> '+esc(f.city)+'</div>'+
        '<div class="focus-line"><strong>Offer:</strong> '+esc(f.offer)+'</div>'+
        '<div class="focus-line"><strong>Salesperson:</strong> '+esc(f.salesperson)+'</div>'+
        '<div class="focus-line"><strong>Day:</strong> '+esc(c.dayOfWeek||'')+'</div>'+
        '<div class="focus-line"><strong>Time Bucket:</strong> '+esc(c.timeBucket||'')+'</div>'+
        '<div class="focus-line"><strong>Status:</strong> '+esc(focusMeta.status||'Baseline Collection')+'</div>';
      if(focusMeta.lowFocusedLeads){
        var inv=focusMeta.inventory||{};
        var lowText=focusMeta.warning||'Not enough focused website leads available.';
        if(focusMeta.leadDiscovery&&focusMeta.leadDiscovery.command) lowText+=' Run: '+focusMeta.leadDiscovery.command;
        lowEl.textContent=lowText+' ('+(inv.available||0)+' available · '+(inv.active||0)+' active · target '+String(focusMeta.minAvailable||50)+' available)';
        lowEl.classList.remove('hidden');
      }else{
        lowEl.classList.add('hidden');
      }
    }

    async function loadFocusPreview(){
      try{
        var data=await jsonFetch('/api/mission-control/sales/queue');
        renderFocusCard(data.focus);
        if(data.stats){
          document.getElementById('queueMeta').textContent=
            data.stats.total+' in queue · '+data.stats.hot+' hot · '+data.stats.notContacted+' not contacted';
        }
      }catch(e){
        document.getElementById('focusBody').textContent='Could not load focus.';
      }
    }

    async function loadLead(id, opts){
      opts=opts||{};
      document.getElementById('loading').classList.remove('hidden');
      document.getElementById('leadView').classList.add('hidden');
      var params=new URLSearchParams(window.location.search);
      var folder=params.get('folder')||'';
      var qs=folder?'?folder='+encodeURIComponent(folder):'';
      var url=id?'/api/mission-control/sales/lead/'+encodeURIComponent(id)+qs:'/api/mission-control/sales/next'+qs;
      var data;
      try{
        data=await jsonFetch(url);
      }catch(e){
        if(id&&!opts.retried&&(String(e.message||'').indexOf('not found')>=0||String(e.message||'').indexOf('not in current focus')>=0)){
          try{localStorage.removeItem('callQueueLeadId');}catch(x){}
          return loadLead(null,{retried:true});
        }
        throw e;
      }
      if(data.staleLead&&!opts.retried){
        try{localStorage.removeItem('callQueueLeadId');}catch(x){}
      }
      currentLead=data.lead; nextLeadId=data.nextId;
      if(!currentLead){
        var msg='No matching focused leads in queue.';
        if(data.focus){
          if(data.focus.warning) msg=data.focus.warning;
          if(data.focus.leadDiscovery&&data.focus.leadDiscovery.command){
            msg+=' Run: '+data.focus.leadDiscovery.command;
          }
          msg+=' ('+(data.focus.matchingCallable||0)+' matching / '+(data.focus.callable||0)+' total callable)';
        }
        document.getElementById('loading').textContent=msg;
        renderFocusCard(data.focus);
        document.getElementById('dockActions').classList.add('hidden');
        return;
      }
      document.getElementById('dockActions').classList.remove('hidden');
      document.getElementById('loading').classList.add('hidden');
      document.getElementById('leadView').classList.remove('hidden');
      document.getElementById('leadView').innerHTML=renderLead(currentLead);
      bindRecordedCallButton();
      var stats=data.stats||{total:0,hot:0,notContacted:0};
      document.getElementById('queueMeta').textContent=stats.total+' in queue · '+stats.hot+' hot · '+stats.notContacted+' not contacted';
      renderFocusCard(data.focus);
      try{localStorage.setItem('callQueueLeadId',currentLead.id);}catch(e){}
      window.scrollTo(0,0);
    }

    function setCallStatus(msg, kind){
      var el=document.getElementById('callStatus');
      if(!el) return;
      el.textContent=msg||'';
      el.className='call-status'+(kind?' '+kind:'');
    }

    async function startRecordedCall(){
      if(!currentLead) return;
      var btn=document.getElementById('recordedCallBtn');
      if(btn) btn.disabled=true;
      setCallStatus('Calling your phone…');
      setBusy(true);
      try{
        var result=await jsonFetch('/api/calls/start',{
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify({businessId:currentLead.id})
        });
        setCallStatus('Call started — answer your phone to connect to '+currentLead.businessName+'.','ok');
        showToast('Calling your phone');
      }catch(e){
        setCallStatus(e.message||'Call failed','error');
        showToast('Call failed');
      }finally{
        if(btn) btn.disabled=false;
        setBusy(false);
      }
    }

    function bindRecordedCallButton(){
      var btn=document.getElementById('recordedCallBtn');
      if(!btn) return;
      btn.onclick=function(){
        startRecordedCall().catch(function(e){
          setCallStatus(e.message||'Call failed','error');
        });
      };
    }

    async function saveOutcome(outcomeId, status){
      if(!currentLead) return;
      setBusy(true);
      try{
        await jsonFetch('/api/mission-control/sales/lead/'+encodeURIComponent(currentLead.id)+'/outcome',{
          method:'PATCH', headers:{'Content-Type':'application/json'},
          body:JSON.stringify({status:status, outcomeId:outcomeId})
        });
        document.getElementById('outcomeSheet').classList.remove('open');
        showToast('Saved — next lead');
        await loadLead(nextLeadId||null);
      }finally{setBusy(false);}
    }

    document.getElementById('nextBtn').addEventListener('click',function(){
      setBusy(true);
      loadLead(nextLeadId||null).catch(function(e){alert(e.message);}).finally(function(){setBusy(false);});
    });
    document.getElementById('outcomeBtn').addEventListener('click',function(){
      document.getElementById('outcomeSheet').classList.add('open');
    });
    document.getElementById('outcomeCancel').addEventListener('click',function(){
      document.getElementById('outcomeSheet').classList.remove('open');
    });
    document.querySelectorAll('.outcome-btn').forEach(function(btn){
      btn.addEventListener('click',function(){
        saveOutcome(btn.dataset.outcome, btn.dataset.status).catch(function(e){alert(e.message);});
      });
    });
    document.getElementById('outcomeSheet').addEventListener('click',function(e){
      if(e.target===document.getElementById('outcomeSheet')) document.getElementById('outcomeSheet').classList.remove('open');
    });

    var savedId=null;
    try{savedId=localStorage.getItem('callQueueLeadId');}catch(e){}
    var params=new URLSearchParams(window.location.search);
    var leadParam=params.get('lead');
    fetch('/api/me').then(function(r){return r.json();}).then(function(me){
      if(!me.authenticated){window.location.href='/login?return='+encodeURIComponent(window.location.pathname+window.location.search);return;}
      loadFocusPreview();
      loadLead(leadParam||savedId).catch(function(e){
        document.getElementById('loading').textContent=e.message;
        loadFocusPreview();
      });
    }).catch(function(){window.location.href='/login?return='+encodeURIComponent(window.location.pathname+window.location.search);});
  `;

  return pivotalShell({
    title: "Call Queue",
    activeNav: "queue",
    bodyHtml: body + `<script>${script}</script>`,
    headExtra,
  });
}
