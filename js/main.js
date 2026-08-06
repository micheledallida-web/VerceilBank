// ==================== CORE APP MODULE ====================
// This file is the ONLY thing loaded on initial page load.
// Every individual screen (Send Money, Transfer, Portfolio, etc.) is loaded
// on demand via loadPage() — its HTML fragment is fetched, its JS module is
// dynamically imported, and both are torn down again when the page closes.
// This is what actually makes the app fast: the browser only ever downloads
// and parses the one screen someone is looking at.

export const SUPABASE_URL = 'https://kzykuuxoivrttfdjdypl.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt6eWt1dXhvaXZydHRmZGpkeXBsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU1NDQ2NTcsImV4cCI6MjEwMTEyMDY1N30.qHHVx4J626WgTxirEsPVKC8xt-T0z44VyACVQRIPl00';

export let supabaseClient = null;
try {
  if (window.supabase) {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
} catch (err) {
  console.error('Supabase init error:', err);
}

// ---------- Shared helpers (used by every page module) ----------
export async function getCurrentUser() {
  if (!supabaseClient) return null;
  const { data: { session } } = await supabaseClient.auth.getSession();
  return session && session.user ? session.user : null;
}

export function genRef() {
  return 'VB-' + Math.random().toString(36).slice(2, 10).toUpperCase();
}

export function formatCurrency(n) {
  return `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function parseBalanceText(text) {
  return Number(String(text).replace(/[^0-9.-]/g, '')) || 0;
}

export function getOrCreateTempNumber(type, kind) {
  const key = `verceil_temp_${kind}_${type}`;
  let val = null;
  try { val = localStorage.getItem(key); } catch (e) {}
  if (!val) {
    val = String(Math.floor(100000000 + Math.random() * 900000000));
    try { localStorage.setItem(key, val); } catch (e) {}
  }
  return val;
}

// ---------- Theme ----------
const htmlElement = document.documentElement;
export function applyTheme(isDark) {
  htmlElement.classList.toggle('dark', isDark);
  document.body.classList.toggle('dark', isDark);
  localStorage.setItem('vercel_bank_theme', isDark ? 'dark' : 'light');
}
applyTheme((localStorage.getItem('vercel_bank_theme') || 'light') === 'dark');

// ---------- Shared modal (every page module can call this) ----------
const actionModal = document.getElementById('actionModal');
const modalTitle = document.getElementById('modalTitle');
const modalDesc = document.getElementById('modalDesc');
const modalCloseBtn = document.getElementById('modalCloseBtn');

export function showModal(title, desc) {
  modalTitle.textContent = title;
  modalDesc.textContent = desc;
  actionModal.classList.remove('hidden');
}
modalCloseBtn.addEventListener('click', () => actionModal.classList.add('hidden'));

// ---------- Lazy page loader ----------
// pageRoot is a single empty <div> in index.html. Every screen's markup gets
// injected there only while it's open, then cleared again on close — so the
// DOM never carries the weight of 30 screens at once.
const pageRoot = document.getElementById('page-root');
let activePageCleanup = null;

/**
 * Open a page by name. Expects:
 *   /pages/<name>.html   — the fragment markup
 *   /js/pages/<name>.js  — a module exporting `init(root)` and optionally `cleanup()`
 */
export async function loadPage(name, ...args) {
  // Tear down whatever page is currently open first
  if (activePageCleanup) { activePageCleanup(); activePageCleanup = null; }

  const [html, mod] = await Promise.all([
    fetch(`/pages/${name}.html`).then(r => r.text()),
    import(`/js/pages/${name}.js`)
  ]);

  pageRoot.innerHTML = html;
  pageRoot.classList.remove('hidden');
  document.body.style.overflow = 'hidden';

  // Each page module gets shared helpers passed in, rather than importing
  // globals off `window` — keeps every page module self-contained and testable.
  const closePage = () => {
    if (mod.cleanup) mod.cleanup();
    pageRoot.classList.add('hidden');
    pageRoot.innerHTML = '';
    document.body.style.overflow = '';
  };

  mod.init(pageRoot, {
    close: closePage,
    loadPage,
    supabaseClient,
    getCurrentUser,
    genRef,
    formatCurrency,
    parseBalanceText,
    getOrCreateTempNumber,
    showModal,
  }, ...args);

  activePageCleanup = closePage;
}

// Expose for inline onclick handlers if any page markup still uses them
window.loadPage = loadPage;
window.showModal = showModal;
