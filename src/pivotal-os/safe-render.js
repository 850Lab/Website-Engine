/** HTML escape for server-rendered strings. */
export function escHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Strip control chars and angle brackets from user/business text. */
export function sanitizeText(value) {
  return String(value ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<\/?[^>]+(>|$)/g, "")
    .trim();
}

const BLOCKED_HREF =
  /^\s*(javascript|data|vbscript|file|blob):/i;

/** Allow only safe URL schemes for links. */
export function safeHref(url, allowedPrefixes = ["tel:", "sms:", "http:", "https:"]) {
  const raw = String(url ?? "").trim();
  if (!raw || BLOCKED_HREF.test(raw)) return "";
  if (raw.startsWith("/") && !raw.startsWith("//")) return raw;
  const lower = raw.toLowerCase();
  for (const prefix of allowedPrefixes) {
    if (lower.startsWith(prefix)) return raw;
  }
  return "";
}

/** Inline script helpers for server-rendered HTML pages (no innerHTML for user data). */
export function clientSafeRenderScript() {
  return `
function escHtml(s){
  return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function sanitizeText(s){
  return String(s??'').replace(/[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\u007F]/g,'')
    .replace(/<script\\b[^<]*(?:(?!<\\/script>)<[^<]*)*<\\/script>/gi,'')
    .replace(/<\\/?[^>]+(>|$)/g,'').trim();
}
function safeHref(url,allowed){
  allowed=allowed||['tel:','sms:','http:','https:'];
  var raw=String(url??'').trim();
  if(!raw||/^\\s*(javascript|data|vbscript|file|blob):/i.test(raw)) return '';
  if(raw.indexOf('/')===0&&raw.indexOf('//')!==0) return raw;
  var lower=raw.toLowerCase();
  for(var i=0;i<allowed.length;i++){ if(lower.indexOf(allowed[i])===0) return raw; }
  return '';
}
function setPlainText(el,text){
  if(!el) return;
  el.textContent=sanitizeText(text);
}
function makeEl(tag,className,text){
  var el=document.createElement(tag);
  if(className) el.className=className;
  if(text!=null&&text!=='') el.textContent=sanitizeText(text);
  return el;
}
function makeLink(href,className,label,allowed){
  var safe=safeHref(href,allowed);
  if(!safe) return null;
  var a=document.createElement('a');
  a.className=className;
  a.href=safe;
  a.textContent=sanitizeText(label);
  return a;
}
function makeScriptCard(label,text){
  var card=makeEl('div','script-card');
  card.appendChild(makeEl('div','script-label',label));
  var body=makeEl('div','script-text');
  setPlainText(body,text);
  card.appendChild(body);
  return card;
}
function makeDiscoveryQuestionsCard(questions){
  var card=makeEl('div','script-card');
  card.appendChild(makeEl('div','script-label','Discovery Questions'));
  var list=Array.isArray(questions)?questions.slice(0,5):[];
  if(!list.length){
    card.appendChild(makeEl('div','script-text muted','No discovery questions yet.'));
    return card;
  }
  list.forEach(function(q,i){
    var row=makeEl('div','script-text discovery-q');
    setPlainText(row,String(i+1)+'. '+q);
    card.appendChild(row);
  });
  return card;
}
`.trim();
}
