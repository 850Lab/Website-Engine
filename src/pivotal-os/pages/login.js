import { pivotalShell } from "../shell.js";

export function renderLoginPage(returnTo = "/") {
  const safeReturn = String(returnTo ?? "/").startsWith("/") ? returnTo : "/";

  const body = `
    <p class="eyebrow">Sign in</p>
    <h1 class="hero-title">Operator access</h1>
    <p class="hero-sub" id="loginSub">Required for recorded calls and protected tools.</p>

    <div class="card" id="authCard">
      <div class="card-label" id="authModeLabel">Sign in</div>
      <form id="authForm" autocomplete="on">
        <div id="emailWrap" class="field">
          <label class="field-label" for="authEmail">Email</label>
          <input class="field-input" id="authEmail" name="email" type="email" autocomplete="username" />
        </div>
        <div class="field">
          <label class="field-label" for="authPassword">Password</label>
          <input class="field-input" id="authPassword" name="password" type="password" autocomplete="current-password" required />
        </div>
        <p class="field-hint" id="authHint"></p>
        <p class="auth-error hidden" id="authError"></p>
        <button type="submit" class="btn btn-primary btn-block" id="authSubmit">Sign in</button>
      </form>
    </div>

    <a class="btn btn-ghost btn-block" href="${safeReturn.replace(/"/g, "&quot;")}">Back</a>
  `;

  const headExtra = `
    .field { margin-bottom: 14px; }
    .field-label {
      display: block; font-size: 11px; font-weight: 700; letter-spacing: 0.08em;
      text-transform: uppercase; color: var(--text-dim); margin-bottom: 8px;
    }
    .field-input {
      width: 100%; min-height: var(--tap); border: 1px solid var(--border);
      border-radius: var(--radius-sm); background: var(--bg-elevated); color: var(--text);
      padding: 14px 16px; font-size: 16px; font-family: inherit;
    }
    .field-input:focus { outline: none; border-color: rgba(99,102,241,0.5); }
    .field-hint { font-size: 13px; color: var(--text-dim); line-height: 1.45; margin: 0 0 12px; }
    .auth-error { font-size: 14px; color: #f87171; margin: 0 0 12px; }
    .hidden { display: none !important; }
  `;

  const script = `
    var returnTo=${JSON.stringify(safeReturn)};
    var signupMode=false;

    function showError(msg){
      var el=document.getElementById('authError');
      el.textContent=msg||'';
      el.classList.toggle('hidden',!msg);
    }

    async function jsonFetch(url, opts){
      var res=await fetch(url, opts||{});
      var data=await res.json().catch(function(){return {};});
      if(!res.ok) throw new Error(data.error||res.statusText||'Request failed');
      return data;
    }

    function setSignupMode(on){
      signupMode=on;
      document.getElementById('authModeLabel').textContent=on?'Create account':'Sign in';
      document.getElementById('authSubmit').textContent=on?'Create account':'Sign in';
      document.getElementById('loginSub').textContent=on
        ? 'Set up the first operator account for this deployment.'
        : 'Required for recorded calls and protected tools.';
      document.getElementById('authHint').textContent=on
        ? 'This creates the admin account for Pivotal OS.'
        : 'Use your admin email and password. If only ADMIN_PASSWORD is configured, email can be blank.';
    }

    fetch('/api/auth/status').then(function(r){return r.json();}).then(function(status){
      if(status.signupRequired) setSignupMode(true);
      if(status.adminEmail && !status.signupRequired){
        document.getElementById('authEmail').value=status.adminEmail;
      }
    }).catch(function(){});

    fetch('/api/me').then(function(r){return r.json();}).then(function(me){
      if(me.authenticated) window.location.href=returnTo;
    }).catch(function(){});

    document.getElementById('authForm').addEventListener('submit',function(e){
      e.preventDefault();
      showError('');
      var email=document.getElementById('authEmail').value.trim();
      var password=document.getElementById('authPassword').value;
      var url=signupMode?'/api/signup':'/api/login';
      var body={password:password};
      if(email) body.email=email;
      document.getElementById('authSubmit').disabled=true;
      jsonFetch(url,{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify(body)
      }).then(function(){
        window.location.href=returnTo;
      }).catch(function(err){
        showError(err.message||'Sign in failed');
      }).finally(function(){
        document.getElementById('authSubmit').disabled=false;
      });
    });
  `;

  return pivotalShell({
    title: "Sign in",
    activeNav: "settings",
    bodyHtml: body + `<script>${script}</script>`,
    headExtra,
  });
}
