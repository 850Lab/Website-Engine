import { pivotalShell } from "../shell.js";

export function renderSettingsPage() {
  const body = `
    <p class="eyebrow">Settings</p>
    <h1 class="hero-title">Profile</h1>
    <p class="hero-sub">Your operator account and team access.</p>

    <div class="card" id="profileCard">
      <div class="card-label">Signed in as</div>
      <div class="card-value" id="profileName" style="font-size:22px">Loading…</div>
      <div class="card-body" id="profileDetail" style="margin-top:8px"></div>
      <div class="btn-row" id="profileActions" style="margin-top:12px"></div>
    </div>

    <div class="card hidden" id="teamCard">
      <div class="card-label">Invite operator</div>
      <p class="card-body" style="margin-bottom:14px">Each operator gets their own call queue. Leads are claimed when they open them, so two people won't call the same business.</p>
      <form id="inviteForm">
        <div class="field"><label class="field-label">Name</label><input class="field-input" id="inviteName" required /></div>
        <div class="field"><label class="field-label">Email</label><input class="field-input" id="inviteEmail" type="email" required /></div>
        <div class="field"><label class="field-label">Temporary password</label><input class="field-input" id="invitePassword" type="password" required /></div>
        <p class="auth-error hidden" id="inviteError"></p>
        <button type="submit" class="btn btn-primary btn-block">Add operator</button>
      </form>
      <div class="card-label" style="margin-top:18px">Team</div>
      <div id="teamList" class="card-body">Loading…</div>
    </div>

    <div class="card">
      <div class="card-label">Outcome storage</div>
      <div class="card-value" id="storageStatus" style="font-size:18px">Checking…</div>
      <div class="card-body" id="storageDetail" style="margin-top:8px"></div>
    </div>

    <div class="card">
      <div class="card-label">Daily targets</div>
      <div class="card-body" id="goalsBody">Loading…</div>
    </div>

    <div class="card">
      <div class="card-label">Deal value</div>
      <div class="card-value" id="dealValue">—</div>
    </div>
  `;

  const headExtra = `
    .field { margin-bottom: 12px; }
    .field-label { display:block; font-size:11px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; color:var(--text-dim); margin-bottom:8px; }
    .field-input { width:100%; min-height:var(--tap); border:1px solid var(--border); border-radius:var(--radius-sm); background:var(--bg-elevated); color:var(--text); padding:14px 16px; font-size:16px; font-family:inherit; }
    .auth-error { font-size:14px; color:#f87171; margin:0 0 12px; }
    .hidden { display:none !important; }
    .team-row { padding:10px 0; border-bottom:1px solid var(--border); }
    .team-row:last-child { border-bottom:none; }
  `;

  const script = `
    function money(n){return '$'+Number(n).toLocaleString();}

    async function jsonFetch(url, opts){
      var res=await fetch(url, opts||{});
      var data=await res.json().catch(function(){return {};});
      if(!res.ok) throw new Error(data.error||res.statusText);
      return data;
    }

    function renderProfile(me){
      document.getElementById('profileName').textContent=me.operator.name;
      document.getElementById('profileDetail').textContent=me.operator.email+' · '+me.operator.role;
      document.getElementById('profileActions').innerHTML='<button type="button" class="btn btn-ghost" id="logoutBtn">Sign out</button>';
      document.getElementById('logoutBtn').onclick=function(){
        fetch('/api/logout',{method:'POST'}).then(function(){window.location.href='/login?return=/settings';});
      };
      if(me.operator.role==='owner'){
        document.getElementById('teamCard').classList.remove('hidden');
        loadTeam();
      }
    }

    async function loadTeam(){
      try{
        var data=await jsonFetch('/api/operators');
        var html=(data.operators||[]).map(function(op){
          return '<div class="team-row"><strong>'+op.name+'</strong><br><span style="color:var(--text-dim)">'+op.email+' · '+op.role+'</span></div>';
        }).join('');
        document.getElementById('teamList').innerHTML=html||'No operators yet.';
      }catch(e){
        document.getElementById('teamList').textContent=e.message;
      }
    }

    document.getElementById('inviteForm').addEventListener('submit',function(e){
      e.preventDefault();
      var errEl=document.getElementById('inviteError');
      errEl.classList.add('hidden');
      jsonFetch('/api/operators',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          name:document.getElementById('inviteName').value.trim(),
          email:document.getElementById('inviteEmail').value.trim(),
          password:document.getElementById('invitePassword').value
        })
      }).then(function(){
        document.getElementById('inviteName').value='';
        document.getElementById('inviteEmail').value='';
        document.getElementById('invitePassword').value='';
        loadTeam();
      }).catch(function(err){
        errEl.textContent=err.message;
        errEl.classList.remove('hidden');
      });
    });

    Promise.all([
      fetch('/api/me').then(function(r){return r.json();}),
      fetch('/api/pivotal-os/settings').then(function(r){return r.json();})
    ]).then(function(results){
      var me=results[0];
      var data=results[1];
      if(!me.authenticated){ window.location.href='/login?return=/settings'; return; }
      renderProfile(me);
      var s=data.storage;
      document.getElementById('storageStatus').textContent=s.outcomesPersist?'Cloud sync active':'Not persisting';
      document.getElementById('storageDetail').textContent=s.outcomesPersist
        ? 'Outcomes and notes save to Vercel Blob ('+s.backend+').'
        : 'Set BLOB_READ_WRITE_TOKEN on Vercel for production persistence.';
      var g=data.goals;
      document.getElementById('goalsBody').textContent=g.calls+' calls · '+g.conversations+' conversations · '+g.appointments+' appointment per day';
      document.getElementById('dealValue').textContent=money(data.dealValue);
    }).catch(function(e){
      document.getElementById('profileName').textContent='Error';
      document.getElementById('profileDetail').textContent=e.message;
    });
  `;

  return pivotalShell({
    title: "Settings",
    activeNav: "settings",
    bodyHtml: body + `<script>${script}</script>`,
    headExtra,
  });
}
