# Verceil Bank — Split-File Vanilla JS Structure

This restructures the single 6,800-line HTML file into small files that load on demand.

## Why this is faster

| Before | After |
|---|---|
| Tailwind CDN compiles all CSS in-browser on every load | Tailwind compiled once at build time into a static `.css` |
| All ~30 screens sit in the DOM permanently (hidden with CSS) | Only the open screen exists in the DOM; cleared on close |
| All JS parsed on initial load | Each screen's JS is `import()`-ed only when opened |
| One 6,800-line file | ~40 small files, fetched as needed |

## Setup

```bash
npm install -D tailwindcss
npx tailwindcss -i css/input.css -o css/output.css --minify
```

Add a watch script while developing:

```bash
npx tailwindcss -i css/input.css -o css/output.css --watch
```

## Supabase configuration (environment variables)

The Supabase URL and anon key are **not** hardcoded in tracked source. They're
injected at build time into a generated, gitignored `js/config.js` by
`scripts/generate-config.js`, which runs automatically as a `prebuild`/`predev`
step before `npm run build` / `npm run dev`.

### On Vercel

1. Go to your Vercel project → **Settings → Environment Variables**.
2. Add:
   - `SUPABASE_URL` — your Supabase project URL (e.g. `https://xxxx.supabase.co`)
   - `SUPABASE_ANON_KEY` — your Supabase anon/public key
3. Redeploy. Vercel runs `npm run build`, which regenerates `js/config.js` from
   those variables on every deploy.

### Locally

Export the variables in your shell before running `dev`/`build`:

```bash
export SUPABASE_URL="https://xxxx.supabase.co"
export SUPABASE_ANON_KEY="your-anon-key"
npm run dev
```

Alternatively, for quick local testing without exporting env vars, copy the
template and fill it in — `js/config.js` is gitignored so it will never be
committed:

```bash
cp js/config.example.js js/config.js
# then edit js/config.js with your own SUPABASE_URL / SUPABASE_ANON_KEY
```

Note that running `npm run build`/`npm run dev` afterwards will overwrite
`js/config.js` with whatever `SUPABASE_URL`/`SUPABASE_ANON_KEY` are (or aren't)
set in your environment at that time.

## Serving

ES modules and `fetch()` need a real HTTP server (not `file://`):

```bash
npx serve .
# or
python3 -m http.server 8000
```

## File structure

```
index.html              # Shell: dashboard + modal + page-root. The only always-loaded HTML.
css/
  input.css             # Tailwind directives + custom CSS
  output.css            # Generated — do not edit
js/
  main.js               # Core: Supabase, helpers, theme, modal, loadPage()
  config.js             # Generated — sets window.SUPABASE_URL/ANON_KEY, gitignored, do not edit
  config.example.js     # Template documenting the shape of js/config.js
  shared/
    receipt.js          # Shared success receipt used by all payment flows
  pages/
    transfer.js         # One module per screen
    send-money.js
    account-detail.js
pages/
  transfer.html         # One markup fragment per screen
  send-money.html
  account-detail.html
```

## The pattern — how to port the remaining screens

Every screen becomes exactly two files. Take any page from the old single-file
version and split it:

### 1. `pages/<name>.html` — markup only

Copy the page's inner markup. Two changes:
- Drop the outer `<div id="xPage" class="hidden fixed inset-0...">` wrapper —
  `#page-root` already provides that.
- Replace back-button IDs with `data-action="close"`.

### 2. `js/pages/<name>.js` — logic only

```js
let listeners = [];
function on(el, evt, fn) { el.addEventListener(evt, fn); listeners.push(() => el.removeEventListener(evt, fn)); }

export function init(root, ctx) {
  const { supabaseClient, getCurrentUser, genRef, formatCurrency, showModal, close, loadPage } = ctx;

  on(root.querySelector('[data-action="close"]'), 'click', close);

  // ...the page's logic, using root.querySelector() instead of document.getElementById()
}

export function cleanup() {
  listeners.forEach(off => off());
  listeners = [];
}
```

Three rules that matter:

1. **Scope queries to `root`** — use `root.querySelector('#x')`, not
   `document.getElementById('x')`. The page only exists while open, and this keeps
   IDs from colliding across screens.
2. **Register listeners via `on()`** — so `cleanup()` can remove them all. Without
   this you leak listeners every time a page is reopened.
3. **Use `ctx` instead of globals** — Supabase and the helpers are passed in, so
   each module stays self-contained.

Exception: dashboard elements that live in the shell (`#checkingBalance`,
`#savingsBalance`, `#investmentsBalance`) are still `document.getElementById()` —
they're outside the page root by design, so flows can update balances live.

### 3. Open it

```js
loadPage('your-page-name');
```

Or from markup: `<button data-page="your-page-name" class="page-open-btn">`

## Screens still to port

Payments: pay-bills, scheduled-payments, payment-history, external-transfers,
wire-transfers, manage-payees, fund-account
Invest: portfolio, trade, watchlist, statements, advisor, wealth-insights
Support: secure-messages, live-chat, contact-support, card-services,
report-card, dispute, travel, help-center
Profile: personal-info, security-center, account-prefs, linked-accounts,
tax-docs, privacy
Accounts: account-summary, routing-numbers, docs-hub

Each follows the identical two-file pattern above. `transfer`, `send-money`
and `account-detail` are complete working references — copy their structure.

## Optional next step

For production, run the JS through a bundler (esbuild is fastest to set up) to
minify and reduce request count. Not required — native ES modules work as-is in
all modern browsers.

```bash
npx esbuild js/main.js --bundle --splitting --format=esm --minify --outdir=dist
```
