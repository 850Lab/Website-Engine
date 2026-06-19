# Security Fixes — Script Injection in Queue Pages

## Vulnerability

The pressure washing call queue (`/pw/queue`) rendered lead data with **`innerHTML` string concatenation**. Most fields used a basic `esc()` helper, but several paths were unsafe:

1. **Unescaped script copy** — `restaurantOpener` and `ownerAvailable` were injected into HTML as raw strings (`'+opener+'`), not escaped. A poisoned lead record or compromised script constant could inject `<script>` or event handlers.
2. **Unsafe `href` values** — `tel:` / `sms:` links from API data were passed through HTML escape only. Escape does not block `javascript:` URLs, so a malicious `actions.call` value could execute code when tapped on mobile.
3. **`innerHTML` for all lead fields** — Business names, notes, angles, offers, and industry labels from JSON storage were treated as HTML. Any stored `<img onerror=…>`, `<iframe>`, or `<script>` in lead data would run in the operator’s browser (stored XSS).

This is **stored XSS** risk: bad data in `pressure-washing-leads.json` (or via the API) could compromise the founder session on the queue page.

## Files changed

| File | Change |
|------|--------|
| `src/pivotal-os/safe-render.js` | **New** — `sanitizeText()`, `safeHref()`, `escHtml()`, and shared client helpers (`setPlainText`, `makeEl`, `makeLink`, `makeScriptCard`) |
| `src/pivotal-os/pages/pw-queue.js` | Replaced `innerHTML` lead rendering with **DOM APIs** (`createElement`, `textContent`, `replaceChildren`). Scripts loaded from `application/json` block. Links restricted to `tel:` / `sms:` via `safeHref()`. |
| `src/pivotal-os/pages/home.js` | Mode switch added; website call/preview links use `safeHref()`. PW “call next” card uses DOM `textContent` rendering. |

## How the fix prevents injection

- **`textContent` instead of `innerHTML`** — User and business fields never parse HTML; angle brackets display as plain text.
- **`sanitizeText()`** — Strips control characters and HTML tags before display.
- **`safeHref()`** — Blocks `javascript:`, `data:`, `vbscript:`, `file:`, and `blob:` schemes; only allows declared prefixes (`tel:`, `sms:` for queue actions).
- **Static scripts via JSON** — Opener lines ship in `<script type="application/json">` parsed with `JSON.parse`, avoiding JS string breakout in inline script tags.
- **Quick-action buttons** — Built with `createElement`; labels sanitized.

Scripts, offers, and angles still display correctly — as readable plain text in script cards.

## Testing

1. Log in and open `/pw/queue`.
2. Confirm lead cards show business name, angle, offer, and restaurant opener.
3. Optional: add a test lead with `businessName: "<img src=x onerror=alert(1)>"` via API — page should show literal text, no alert.
4. Optional: set `actions.call` to `javascript:alert(1)` — Call button should not appear or link should be blocked.
