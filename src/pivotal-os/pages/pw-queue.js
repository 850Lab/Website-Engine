import { zealShell } from "../zeal-shell.js";
import { PW_SCRIPTS } from "../../pressure-washing/scripts.js";
import { PW_QUICK_ACTIONS } from "../../pressure-washing/statuses.js";
import { clientSafeRenderScript } from "../safe-render.js";

export function renderPwQueuePage() {
  const scriptDataJson = JSON.stringify(PW_SCRIPTS).replace(/</g, "\\u003c");
  const actionDataJson = JSON.stringify(PW_QUICK_ACTIONS).replace(/</g, "\\u003c");

  const headExtra = `
    .metrics-bar {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      margin-bottom: 14px;
    }
    .m-item { background: var(--bg-card); border: 1px solid var(--border); border-radius: 10px; padding: 10px 6px; text-align: center; }
    .m-num { font-size: 18px; font-weight: 800; line-height: 1.1; }
    .m-label { font-size: 9px; font-weight: 700; text-transform: uppercase; color: var(--text-dim); margin-top: 4px; letter-spacing: 0.04em; }
    .next-best-badge {
      display: inline-flex;
      padding: 6px 12px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      background: rgba(14,165,233,0.22);
      border: 1px solid rgba(14,165,233,0.45);
      color: #7dd3fc;
      margin-bottom: 10px;
    }
    .lead-phone { font-size: 15px; color: var(--text-muted); margin-bottom: 14px; }
    .script-card { background: var(--bg-elevated); border-radius: var(--radius-sm); padding: 14px; margin-bottom: 10px; border: 1px solid var(--border); }
    .script-label { font-size: 10px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--text-dim); margin-bottom: 6px; }
    .script-text { font-size: 16px; line-height: 1.55; white-space: pre-wrap; }
    .script-text.muted { font-size: 15px; color: var(--text-muted); }
    .discovery-q { font-size: 15px; margin-bottom: 8px; font-weight: 500; }
    .discovery-q:last-child { margin-bottom: 0; }
    .action-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px; }
    .quick-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 12px; }
    .quick-btn { min-height: var(--tap); border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--bg-elevated); color: var(--text); font-size: 14px; font-weight: 600; padding: 12px; cursor: pointer; }
    .quick-btn:active { transform: scale(0.98); background: var(--accent-soft); }
    .dock-actions { position: fixed; left: 0; right: 0; bottom: calc(var(--nav-h) + var(--safe-bottom)); padding: 10px 12px; background: rgba(10,22,40,0.95); backdrop-filter: blur(16px); border-top: 1px solid var(--border); display: grid; grid-template-columns: 1fr 1.3fr; gap: 10px; z-index: 50; }
    .app { padding-bottom: calc(var(--nav-h) + 80px + var(--safe-bottom)); }
    .sheet { display:none; position:fixed; inset:0; background:rgba(0,0,0,0.6); z-index:150; align-items:flex-end; }
    .sheet.open { display:flex; }
    .sheet-panel { width:100%; background:var(--bg-card); border-top:1px solid var(--border); border-radius:20px 20px 0 0; padding:20px 16px calc(20px + var(--safe-bottom)); max-height:80dvh; overflow-y:auto; }
    .sheet-handle { width:40px; height:4px; background:var(--border-strong); border-radius:999px; margin:0 auto 16px; }
    .field-input { width:100%; min-height:var(--tap); border:1px solid var(--border); border-radius:var(--radius-sm); background:var(--bg-elevated); color:var(--text); padding:14px 16px; font-size:16px; font-family:inherit; margin-bottom:10px; }
    .field-label { font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--text-dim); margin-bottom: 6px; letter-spacing: 0.06em; }
    .queue-meta { font-size:13px; color:var(--text-dim); margin-bottom:12px; }
    .due-badge { color: #fbbf24; font-weight: 700; }
    .badge-row { display:flex; flex-wrap:wrap; gap:8px; margin-bottom:14px; }
    .health-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 14px; margin-bottom: 14px; }
    .health-note { font-size: 13px; color: var(--text-dim); margin: 10px 0 0; line-height: 1.45; }
  `;

  const body = `
    <p class="eyebrow">Power Washing Queue</p>

    <div class="metrics-bar" id="metricsBar">
      <div class="m-item"><div class="m-num" id="mCalls">—</div><div class="m-label">Calls</div></div>
      <div class="m-item"><div class="m-num" id="mConv">—</div><div class="m-label">Talks</div></div>
      <div class="m-item"><div class="m-num" id="mInterested">—</div><div class="m-label">Interested</div></div>
      <div class="m-item"><div class="m-num" id="mFollowUp">—</div><div class="m-label">FU Due</div></div>
      <div class="m-item"><div class="m-num" id="mEstNeed">—</div><div class="m-label">Est Need</div></div>
      <div class="m-item"><div class="m-num" id="mEstSent">—</div><div class="m-label">Est Sent</div></div>
      <div class="m-item"><div class="m-num" id="mWon">—</div><div class="m-label">Won Today</div></div>
      <div class="m-item"><div class="m-num" id="mRev">—</div><div class="m-label">Rev Won</div></div>
    </div>

    <div class="health-card" id="healthCard">
      <div class="card-label">Queue health</div>
      <div class="card-body" id="healthBody">Loading…</div>
      <p class="health-note">Fresh leads will load automatically when this batch is finished.</p>
      <button type="button" class="btn btn-ghost btn-block" id="refreshQueueBtn" style="margin-top:10px">Refresh Queue</button>
    </div>

    <div class="queue-meta" id="queueMeta">Loading…</div>
    <div id="leadView" class="hidden"></div>
    <div class="loading" id="loading">Loading next lead…</div>

    <div class="dock-actions">
      <button type="button" class="btn btn-ghost" id="noteBtn">Add note</button>
      <button type="button" class="btn btn-primary" id="nextBtn">Next lead →</button>
    </div>

    <div class="toast" id="toast"></div>

    <div class="sheet" id="noteSheet">
      <div class="sheet-panel">
        <div class="sheet-handle"></div>
        <h2 style="font-size:18px;font-weight:800;margin:0 0 14px">Add note</h2>
        <div class="field-label">Note</div>
        <textarea class="field-input" id="noteText" rows="3" placeholder="What happened?"></textarea>
        <div class="field-label">Objection</div>
        <textarea class="field-input" id="objectionText" rows="2" placeholder="Price, timing, not interested…"></textarea>
        <button type="button" class="btn btn-primary btn-block" id="noteSave">Save</button>
        <button type="button" class="btn btn-ghost btn-block" id="noteCancel" style="margin-top:8px">Cancel</button>
      </div>
    </div>

    <div class="sheet" id="followUpSheet">
      <div class="sheet-panel">
        <div class="sheet-handle"></div>
        <h2 style="font-size:18px;font-weight:800;margin:0 0 14px">Schedule follow-up</h2>
        <div class="field-label">Follow-up date & time</div>
        <input type="datetime-local" class="field-input" id="followUpAt" />
        <div class="field-label">Note (optional)</div>
        <textarea class="field-input" id="followUpNote" rows="2" placeholder="Why follow up?"></textarea>
        <button type="button" class="btn btn-primary btn-block" id="followUpSave">Save follow-up</button>
        <button type="button" class="btn btn-ghost btn-block" id="followUpCancel" style="margin-top:8px">Cancel</button>
      </div>
    </div>

    <div class="sheet" id="estimateSheet">
      <div class="sheet-panel">
        <div class="sheet-handle"></div>
        <h2 style="font-size:18px;font-weight:800;margin:0 0 14px">Estimate sent</h2>
        <div class="field-label">Estimate amount</div>
        <input type="number" class="field-input" id="estimateAmount" min="0" step="1" placeholder="450" inputmode="decimal" />
        <button type="button" class="btn btn-primary btn-block" id="estimateSave">Save</button>
        <button type="button" class="btn btn-ghost btn-block" id="estimateCancel" style="margin-top:8px">Cancel</button>
      </div>
    </div>

    <div class="sheet" id="wonSheet">
      <div class="sheet-panel">
        <div class="sheet-handle"></div>
        <h2 style="font-size:18px;font-weight:800;margin:0 0 14px">Job won</h2>
        <div class="field-label">Revenue won</div>
        <input type="number" class="field-input" id="revenueWon" min="0" step="1" placeholder="450" inputmode="decimal" />
        <button type="button" class="btn btn-primary btn-block" id="wonSave">Save won</button>
        <button type="button" class="btn btn-ghost btn-block" id="wonCancel" style="margin-top:8px">Cancel</button>
      </div>
    </div>

    <script type="application/json" id="pwScriptData">${scriptDataJson}</script>
    <script type="application/json" id="pwActionData">${actionDataJson}</script>
  `;

  const script = `
    ${clientSafeRenderScript()}

    var PW_SCRIPTS=JSON.parse(document.getElementById('pwScriptData').textContent);
    var QUICK_ACTIONS=JSON.parse(document.getElementById('pwActionData').textContent);
    var currentLead=null, nextLeadId=null, toastTimer=null, pendingAction=null;

    function money(n){ return '$'+Number(n||0).toLocaleString(); }

    function showToast(msg){
      var el=document.getElementById('toast');
      el.textContent=sanitizeText(msg);
      el.classList.add('show');
      clearTimeout(toastTimer);
      toastTimer=setTimeout(function(){el.classList.remove('show');},1600);
    }
    function setBusy(on){document.body.classList.toggle('busy',on);}

    function closeSheets(){
      document.querySelectorAll('.sheet').forEach(function(s){s.classList.remove('open');});
      pendingAction=null;
    }

    function openSheet(id){
      closeSheets();
      document.getElementById(id).classList.add('open');
    }

    function formatWhen(iso){
      if(!iso) return '';
      try{
        return new Date(iso).toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
      }catch(e){ return sanitizeText(iso); }
    }

    function renderDailyMetrics(d){
      if(!d) return;
      document.getElementById('mCalls').textContent=String(d.callsToday||0);
      document.getElementById('mConv').textContent=String(d.conversationsToday||0);
      document.getElementById('mInterested').textContent=String(d.interestedToday||0);
      document.getElementById('mFollowUp').textContent=String(d.followUpsDue||0);
      document.getElementById('mEstNeed').textContent=String(d.estimatesNeeded||0);
      document.getElementById('mEstSent').textContent=String(d.estimatesSent||0);
      document.getElementById('mWon').textContent=String(d.jobsWonToday||0);
      document.getElementById('mRev').textContent=money(d.revenueWonToday);
    }

    function renderHealth(h){
      if(!h) return;
      var el=document.getElementById('healthBody');
      el.textContent=
        String(h.active||0)+' active remaining · '+
        String(h.available||0)+' available waiting · '+
        String(h.followUpDue||0)+' follow-ups due · '+
        String(h.completedToday||0)+' completed today';
    }

    function mountLead(lead){
      var root=document.createDocumentFragment();
      var hero=makeEl('div','lead-hero');

      if(lead.isNextBestLead){
        hero.appendChild(makeEl('span','next-best-badge','Next Best Lead'));
      }

      var title=document.createElement('h1');
      title.className='hero-title';
      title.style.margin='0';
      setPlainText(title, lead.businessName);
      hero.appendChild(title);

      var phoneLine=makeEl('div','lead-phone');
      phoneLine.textContent=[lead.city, lead.industry, lead.phone].filter(Boolean).map(sanitizeText).join(' · ');
      if(lead.followUpDue){
        var due=document.createElement('span');
        due.className='due-badge';
        due.textContent=' · Follow-up due';
        phoneLine.appendChild(due);
      }
      hero.appendChild(phoneLine);

      var badges=makeEl('div','badge-row');
      badges.appendChild(makeEl('span','badge hot',String(lead.priorityScore||0)+' · '+(lead.priorityLabel||'')));
      badges.appendChild(makeEl('span','badge',lead.statusLabel||''));
      hero.appendChild(badges);
      root.appendChild(hero);

      if(lead.lastContactResultLabel||lead.lastContactedAt){
        var lastText=(lead.lastContactResultLabel||'')+(lead.lastContactedAt?' · '+formatWhen(lead.lastContactedAt):'');
        var lastCard=makeScriptCard('Last contact', lastText);
        lastCard.querySelector('.script-text').classList.add('muted');
        root.appendChild(lastCard);
      }
      if(lead.nextFollowUpAt){
        var fuCard=makeScriptCard('Next follow-up', formatWhen(lead.nextFollowUpAt));
        fuCard.querySelector('.script-text').classList.add('muted');
        root.appendChild(fuCard);
      }

      root.appendChild(makeScriptCard('Why target', lead.pressureWashingAngle));
      var needs=(lead.likelyNeeds||[]).map(sanitizeText).filter(Boolean).join(', ');
      if(needs){
        var needsCard=makeScriptCard('Likely needs', needs);
        needsCard.querySelector('.script-text').classList.add('muted');
        root.appendChild(needsCard);
      }
      root.appendChild(makeScriptCard('Opening Line', lead.openingLine));
      root.appendChild(makeDiscoveryQuestionsCard(lead.discoveryQuestions));
      var offerCard=makeScriptCard('Offer', lead.offer);
      offerCard.querySelector('.script-text').classList.add('muted');
      root.appendChild(offerCard);
      root.appendChild(makeScriptCard('Golden Question', lead.goldenQuestion));
      root.appendChild(makeScriptCard('If owner available', PW_SCRIPTS.ownerAvailable));

      var callRow=makeEl('div','action-grid');
      var callLink=makeLink(lead.actions&&lead.actions.call,'btn btn-primary','📞 Call',['tel:']);
      if(callLink){
        callLink.id='callBtn';
        callRow.appendChild(callLink);
      }else{
        var noCall=makeEl('span','btn btn-ghost','No phone');
        noCall.style.opacity='0.4';
        callRow.appendChild(noCall);
      }
      var textLink=makeLink(lead.actions&&lead.actions.text,'btn btn-ghost','💬 Text',['sms:']);
      if(textLink) callRow.appendChild(textLink);
      else{
        var noText=makeEl('span','btn btn-ghost','No text');
        noText.style.opacity='0.4';
        callRow.appendChild(noText);
      }
      root.appendChild(callRow);

      var quickGrid=makeEl('div','quick-grid');
      QUICK_ACTIONS.forEach(function(action){
        var btn=document.createElement('button');
        btn.type='button';
        btn.className='quick-btn';
        btn.setAttribute('data-action',action.id);
        btn.textContent=sanitizeText(action.label);
        quickGrid.appendChild(btn);
      });
      root.appendChild(quickGrid);

      return root;
    }

    async function jsonFetch(url,opts){
      var res=await fetch(url,opts||{});
      var data=await res.json();
      if(!res.ok) throw new Error(sanitizeText(data.error||res.statusText));
      return data;
    }

    function applyPayload(data){
      if(data.lead) currentLead=data.lead;
      if(data.nextId!==undefined) nextLeadId=data.nextId;
      renderDailyMetrics(data.daily);
      renderHealth(data.health);
      if(data.stats){
        document.getElementById('queueMeta').textContent=
          String(data.stats.callable||0)+' in queue · '+(data.stats.followUpsDue||0)+' follow-ups due';
      }
      if(!data.lead){
        document.getElementById('loading').textContent='Queue complete — no more callable leads.';
        document.getElementById('loading').classList.remove('hidden');
        document.getElementById('leadView').classList.add('hidden');
        return;
      }
      document.getElementById('loading').classList.add('hidden');
      var view=document.getElementById('leadView');
      view.classList.remove('hidden');
      view.replaceChildren();
      view.appendChild(mountLead(data.lead));
      var callBtn=document.getElementById('callBtn');
      if(callBtn) callBtn.addEventListener('click',function(){
        fetch('/api/pressure-washing/lead/'+encodeURIComponent(currentLead.id)+'/call',{method:'POST'})
          .then(function(r){return r.json();})
          .then(function(d){ applyPayload(d); showToast('Call logged'); })
          .catch(function(e){ showToast(e.message); });
      });
      document.querySelectorAll('.quick-btn').forEach(function(btn){
        btn.onclick=function(){ handleAction(btn.getAttribute('data-action')); };
      });
    }

    var queueView='';
    async function loadLead(id){
      setBusy(true);
      try{
        var url;
        if(id){
          url='/api/pressure-washing/lead/'+encodeURIComponent(id)+(queueView?'?view='+encodeURIComponent(queueView):'');
        }else{
          url='/api/pressure-washing/next'+(queueView?'?view='+encodeURIComponent(queueView):'');
        }
        var data=await jsonFetch(url);
        applyPayload(data);
      }catch(e){
        document.getElementById('loading').textContent=sanitizeText(e.message);
      }finally{ setBusy(false); }
    }

    function defaultFollowUpValue(){
      var d=new Date();
      d.setDate(d.getDate()+3);
      d.setMinutes(d.getMinutes()-d.getTimezoneOffset());
      return d.toISOString().slice(0,16);
    }

    function handleAction(action){
      if(!currentLead||!action) return;
      if(action==='follow_up'){
        pendingAction=action;
        document.getElementById('followUpAt').value=defaultFollowUpValue();
        openSheet('followUpSheet');
        return;
      }
      if(action==='estimate_sent'){
        pendingAction=action;
        document.getElementById('estimateAmount').value=currentLead.estimateAmount||'';
        openSheet('estimateSheet');
        return;
      }
      if(action==='won'){
        pendingAction=action;
        document.getElementById('revenueWon').value=currentLead.revenueWon||currentLead.estimateAmount||'';
        openSheet('wonSheet');
        return;
      }
      submitAction(action,{});
    }

    async function submitAction(action, extra){
      if(!currentLead||!action) return;
      setBusy(true);
      try{
        var body=Object.assign({action:action}, extra||{});
        var data=await jsonFetch('/api/pressure-washing/lead/'+encodeURIComponent(currentLead.id)+'/status',{
          method:'PATCH',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify(body)
        });
        closeSheets();
        applyPayload(data);
        showToast('Saved');
      }catch(e){
        showToast(e.message);
      }finally{
        setBusy(false);
      }
    }

    document.getElementById('nextBtn').onclick=function(){
      if(nextLeadId){
        loadLead(nextLeadId);
      }else if(currentLead){
        jsonFetch('/api/pressure-washing/next?after='+encodeURIComponent(currentLead.id)+(queueView?'&view='+encodeURIComponent(queueView):''))
          .then(applyPayload)
          .catch(function(e){ showToast(e.message); });
      }
    };

    document.getElementById('noteBtn').onclick=function(){ openSheet('noteSheet'); };
    document.getElementById('noteCancel').onclick=closeSheets;
    document.getElementById('followUpCancel').onclick=closeSheets;
    document.getElementById('estimateCancel').onclick=closeSheets;
    document.getElementById('wonCancel').onclick=closeSheets;

    document.getElementById('noteSave').onclick=function(){
      if(!currentLead) return;
      var note=document.getElementById('noteText').value.trim();
      var objection=document.getElementById('objectionText').value.trim();
      if(!note&&!objection){ showToast('Add a note or objection'); return; }
      setBusy(true);
      var reqs=[];
      if(note){
        reqs.push(jsonFetch('/api/pressure-washing/lead/'+encodeURIComponent(currentLead.id)+'/notes',{
          method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({text:note, kind:'notes'})
        }));
      }
      if(objection){
        reqs.push(jsonFetch('/api/pressure-washing/lead/'+encodeURIComponent(currentLead.id)+'/notes',{
          method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({text:objection, kind:'objections'})
        }));
      }
      Promise.all(reqs).then(function(results){
        var last=results[results.length-1];
        applyPayload(last);
        document.getElementById('noteText').value='';
        document.getElementById('objectionText').value='';
        closeSheets();
        showToast('Note saved');
      }).catch(function(e){ showToast(e.message); })
      .finally(function(){ setBusy(false); });
    };

    document.getElementById('followUpSave').onclick=function(){
      var at=document.getElementById('followUpAt').value;
      if(!at){ showToast('Pick a follow-up time'); return; }
      var note=document.getElementById('followUpNote').value.trim();
      submitAction('follow_up',{
        nextFollowUpAt:new Date(at).toISOString(),
        followUpNote:note||undefined
      });
      document.getElementById('followUpNote').value='';
    };

    document.getElementById('estimateSave').onclick=function(){
      var amt=document.getElementById('estimateAmount').value;
      submitAction('estimate_sent',{ estimateAmount: amt===''?undefined:Number(amt) });
    };

    document.getElementById('wonSave').onclick=function(){
      var rev=document.getElementById('revenueWon').value;
      submitAction('won',{ revenueWon: rev===''?undefined:Number(rev) });
    };

    document.getElementById('refreshQueueBtn').onclick=function(){
      setBusy(true);
      jsonFetch('/api/pw/queue/refresh',{method:'POST'})
        .then(function(data){
          applyPayload(data);
          showToast(data.promoted?'Promoted '+data.promoted+' leads':'Queue refreshed');
        })
        .catch(function(e){ showToast(e.message); })
        .finally(function(){ setBusy(false); });
    };

    var params=new URLSearchParams(window.location.search);
    queueView=params.get('view')||'';
    if(queueView){
      var eyebrow=document.querySelector('.eyebrow');
      if(eyebrow){
        eyebrow.textContent=queueView==='follow-ups'?'Follow-Up Queue':queueView==='estimates'?'Estimates Queue':'Power Washing Queue';
      }
    }
    loadLead(params.get('lead')||'');
  `;

  return zealShell({
    title: "Call Queue",
    activeNav: "pw-queue",
    bodyHtml: body + `<script>${script}</script>`,
    headExtra,
  });
}
