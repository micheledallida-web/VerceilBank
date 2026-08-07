// ==================== CORE APP MODULE ====================
// This file is the ONLY thing loaded on initial page load.
// Every individual screen (Send Money, Transfer, Portfolio, etc.) is loaded
// on demand via loadPage() — its HTML fragment is fetched, its JS module is
// dynamically imported, and both are torn down again when the page closes.
// This is what actually makes the app fast: the browser only ever downloads
// and parses the one screen someone is looking at.

// Populated by js/config.js (generated at build time from SUPABASE_URL /
// SUPABASE_ANON_KEY env vars -- see scripts/generate-config.js). js/config.js
// is loaded as a plain script in dashboard.html, before this module.
export const SUPABASE_URL = window.SUPABASE_URL;
export const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY;

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
    signOut: () => handleSignOut(),
  }, ...args);

  activePageCleanup = closePage;
}

// Expose for inline onclick handlers if any page markup still uses them
window.loadPage = loadPage;
window.showModal = showModal;

// ==================== DASHBOARD SHELL ====================
// Everything below wires up the always-present shell: header dropdown menus,
// account cards, the bottom nav bar and its slide-up menu sheet. Screens that
// haven't been ported yet (see README "Screens still to port") fall back to
// the shared modal instead of silently doing nothing.

const greetingLine1 = document.getElementById('greetingLine1');
const greetingLine2 = document.getElementById('greetingLine2');

// ---------- Header dropdown (More / Appearance / Alerts / Messages / Profile) ----------
const headerMenus = {
  more: {
    title: 'Quick Actions',
    items: [
      { label: 'View Statements' },
      { label: 'Transfer Funds' },
      { label: 'Card Services' },
      { label: 'Notifications' },
      { label: 'Settings' },
      { label: 'Help & Support' },
    ],
  },
  appearance: { title: 'Appearance', items: ['Light Mode', 'Dark Mode', 'System Default'] },
  alerts: { title: 'Alerts', items: ['Transaction Alerts', 'Security Alerts', 'Payment Reminders', 'Account Notifications', 'Notification Settings'] },
  messages: { title: 'Messages', items: ['Secure Inbox', 'Contact Support', 'Live Chat', 'Schedule an Appointment'] },
  profile: { title: 'Profile', items: ['My Profile', 'Linked Accounts', 'Notification Preferences', 'Privacy & Data Settings', 'Sign Out'] },
};

const headerDropdownOverlay = document.getElementById('headerDropdownOverlay');
const headerDropdown = document.getElementById('headerDropdown');
const headerDropdownTitle = document.getElementById('headerDropdownTitle');
const headerDropdownList = document.getElementById('headerDropdownList');

function clearCachedUserData() {
  try {
    Object.keys(localStorage)
      .filter((key) => key.startsWith('verceil_'))
      .forEach((key) => localStorage.removeItem(key));
  } catch (err) {}
  try { sessionStorage.clear(); } catch (err) {}
}

function goToSignIn() {
  // Land on the main landing page with ?signin=1 so it automatically opens
  // the Sign In modal (see index.html), per the Dashboard -> Sign Out ->
  // Landing Page -> Sign In Modal flow.
  window.location.href = 'index.html?signin=1';
}

async function handleSignOut() {
  try {
    if (supabaseClient) await supabaseClient.auth.signOut();
  } catch (err) {
    console.error('Sign out error:', err);
  } finally {
    clearCachedUserData();
    goToSignIn();
  }
}

// Route protection: the dashboard shell requires an active Supabase session.
// If none exists (first load, expired session, or a sign-out that just
// happened in another tab) send the user straight back to the landing page
// with the Sign In modal ready to open.
async function enforceAuthGuard() {
  if (!supabaseClient) return;
  try {
    const user = await getCurrentUser();
    if (!user) goToSignIn();
  } catch (err) {
    console.error('Auth guard error:', err);
  }
}
enforceAuthGuard();

// Cross-tab / cross-device sync: supabase-js mirrors auth state changes made
// in any tab (or device, via the shared session) into every other tab's
// client through onAuthStateChange. When a sign-out happens anywhere, every
// open dashboard tab reacts immediately instead of trusting stale state.
if (supabaseClient) {
  supabaseClient.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') {
      clearCachedUserData();
      goToSignIn();
    }
  });
}

function openHeaderDropdown(key, anchorEl) {
  const menu = headerMenus[key];
  if (!menu) return;
  const isLight = !htmlElement.classList.contains('dark');

  headerDropdown.style.background = isLight ? '#FFFFFF' : '#0D1728';
  headerDropdown.style.border = isLight ? '1px solid transparent' : '1px solid rgba(255,255,255,0.06)';
  headerDropdownTitle.style.color = isLight ? '#111827' : '#FFFFFF';
  headerDropdownTitle.textContent = menu.title;

  const rowBorder = isLight ? '#F3F4F6' : 'rgba(255,255,255,0.06)';
  const textColor = isLight ? '#111827' : '#FFFFFF';
  const chevronColor = isLight ? '#6B7280' : '#8E9CBA';

  headerDropdownList.innerHTML = menu.items.map((item, idx) => {
    const label = typeof item === 'string' ? item : item.label;
    const isLast = idx === menu.items.length - 1;
    return `
      <button class="header-dropdown-item w-full flex items-center gap-[12px] px-[16px] transition-colors duration-200 cursor-pointer text-left"
        style="height:52px; ${isLast ? '' : `border-bottom:1px solid ${rowBorder};`} color:${textColor};"
        data-label="${label}">
        <span class="flex-1 text-[15px] font-medium truncate">${label}</span>
        <svg class="w-[16px] h-[16px] flex-shrink-0" style="color:${chevronColor};" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
      </button>
    `;
  }).join('');

  const rect = anchorEl.getBoundingClientRect();
  const dropdownWidth = 260;
  let leftPos = Math.min(rect.left, window.innerWidth - dropdownWidth - 16);
  leftPos = Math.max(leftPos, 16);
  headerDropdown.style.top = (rect.bottom + 10) + 'px';
  headerDropdown.style.left = leftPos + 'px';
  headerDropdown.style.right = 'auto';

  headerDropdownOverlay.classList.remove('hidden');
  headerDropdown.classList.remove('hidden');

  headerDropdownList.querySelectorAll('.header-dropdown-item').forEach(btn => {
    btn.addEventListener('mouseenter', () => { btn.style.color = '#2563EB'; });
    btn.addEventListener('mouseleave', () => { btn.style.color = textColor; });
    btn.addEventListener('click', () => {
      const clickedLabel = btn.getAttribute('data-label');
      closeHeaderDropdown();
      if (key === 'appearance') {
        if (clickedLabel === 'Light Mode') applyTheme(false);
        else if (clickedLabel === 'Dark Mode') applyTheme(true);
        else applyTheme(window.matchMedia('(prefers-color-scheme: dark)').matches);
      } else if (clickedLabel === 'Sign Out') {
        handleSignOut();
      } else if (headerMenuRoutes[clickedLabel]) {
        setTimeout(() => headerMenuRoutes[clickedLabel](), 200);
      } else {
        setTimeout(() => showModal(clickedLabel, `Opening ${clickedLabel}...`), 200);
      }
    });
  });
}

function closeHeaderDropdown() {
  headerDropdownOverlay.classList.add('hidden');
  headerDropdown.classList.add('hidden');
}

headerDropdownOverlay.addEventListener('click', closeHeaderDropdown);
document.getElementById('moreMenuBtn').addEventListener('click', (e) => openHeaderDropdown('more', e.currentTarget));
document.getElementById('appearanceBtn').addEventListener('click', (e) => openHeaderDropdown('appearance', e.currentTarget));
document.getElementById('alertsBtn').addEventListener('click', (e) => openHeaderDropdown('alerts', e.currentTarget));
document.getElementById('messagesBtn').addEventListener('click', (e) => openHeaderDropdown('messages', e.currentTarget));
document.getElementById('profilePillBtn').addEventListener('click', (e) => openHeaderDropdown('profile', e.currentTarget));

// ---------- Account cards ----------
document.getElementById('cardChecking').addEventListener('click', () => loadPage('account-detail', 'checking'));
document.getElementById('cardSavings').addEventListener('click', () => loadPage('account-detail', 'savings'));
document.getElementById('cardInvestments').addEventListener('click', () => loadPage('account-detail', 'investments'));
document.getElementById('cardCredit').addEventListener('click', () => loadPage('account-detail', 'credit'));
document.getElementById('cardInterestChecking').addEventListener('click', () => loadPage('account-detail', 'interest_checking'));
document.getElementById('promoBanner').addEventListener('click', () => loadPage('interest-checking'));
document.getElementById('getStartedBtn').addEventListener('click', (e) => {
  e.stopPropagation();
  loadPage('interest-checking');
});

// ---------- Bottom nav dropdown menu sheet (Citi-style) ----------
const navMenus = {
  navAccounts: {
    title: 'Accounts',
    items: ['Account Summary', 'Checking', 'Savings', 'Interest Checking', 'Credit Cards', 'Investment Accounts', 'Statements & Documents', 'Account Details', 'Routing & Account Numbers'],
  },
  navPayments: {
    title: 'Payments',
    items: ['Transfer Between Accounts', 'Fund Account', 'Send Money (Zelle®)', 'Scheduled Payments', 'External Transfers', 'Wire Transfers'],
  },
  navInvest: {
    title: 'Invest',
    items: ['Portfolio Overview', 'Market Performance', 'Watchlist', 'Buy & Sell Investments', 'Retirement Accounts', 'Wealth Insights', 'Investment Statements', 'Financial Advisor'],
  },
  navSupport: {
    title: 'Support',
    items: ['Secure Messages', 'Live Chat', 'Contact Support', 'Card Services', 'Report Lost or Stolen Card', 'Dispute a Transaction', 'Travel Notification', 'Help Center'],
  },
};

const navMenuOverlay = document.getElementById('navMenuOverlay');
const navMenuSheet = document.getElementById('navMenuSheet');
const navMenuTitle = document.getElementById('navMenuTitle');
const navMenuList = document.getElementById('navMenuList');
const navMenuCloseBtn = document.getElementById('navMenuCloseBtn');

// Labels that map to a screen already ported to the split architecture.
const navMenuRoutes = {
  // Accounts
  'Account Summary': () => loadPage('account-summary'),
  'Checking': () => loadPage('account-detail', 'checking'),
  'Savings': () => loadPage('account-detail', 'savings'),
  'Interest Checking': () => loadPage('account-detail', 'interest_checking'),
  'Credit Cards': () => loadPage('account-detail', 'credit'),
  'Investment Accounts': () => loadPage('account-detail', 'investments'),
  'Statements & Documents': () => loadPage('docs-hub'),
  'Account Details': () => loadPage('account-details'),
  'Routing & Account Numbers': () => loadPage('routing-numbers'),

  // Payments
  'Transfer Between Accounts': () => loadPage('transfer'),
  'Fund Account': () => loadPage('fund-account'),
  'Send Money (Zelle®)': () => loadPage('send-money'),
  'Scheduled Payments': () => loadPage('scheduled-payments'),
  'External Transfers': () => loadPage('external-transfers'),
  'Wire Transfers': () => loadPage('wire-transfers'),

  // Invest
  'Portfolio Overview': () => loadPage('portfolio'),
  'Watchlist': () => loadPage('watchlist'),
  'Buy & Sell Investments': () => loadPage('trade'),
  'Wealth Insights': () => loadPage('wealth-insights'),
  'Investment Statements': () => loadPage('statements'),
  'Financial Advisor': () => loadPage('advisor'),

  // Support
  'Secure Messages': () => loadPage('secure-messages'),
  'Live Chat': () => loadPage('live-chat'),
  'Contact Support': () => loadPage('contact-support'),
  'Card Services': () => loadPage('card-services'),
  'Report Lost or Stolen Card': () => loadPage('report-card'),
  'Dispute a Transaction': () => loadPage('dispute'),
  'Travel Notification': () => loadPage('travel'),
  'Help Center': () => loadPage('help-center'),
};

// Labels in the header "quick actions" dropdown that map to a ported screen.
const headerMenuRoutes = {
  'View Statements': () => loadPage('docs-hub'),
  'Transfer Funds': () => loadPage('transfer'),
  'Card Services': () => loadPage('card-services'),
  'Secure Inbox': () => loadPage('secure-messages'),
  'Contact Support': () => loadPage('contact-support'),
  'Live Chat': () => loadPage('live-chat'),
  'My Profile': () => loadPage('profile'),
  'Linked Accounts': () => loadPage('linked-accounts'),
  'Notification Preferences': () => loadPage('notification-prefs'),
  'Privacy & Data Settings': () => loadPage('privacy'),
};

function openNavMenu(key) {
  const menu = navMenus[key];
  if (!menu) return;

  navMenuTitle.textContent = menu.title;

  if (menu.groups) {
    navMenuList.innerHTML = menu.groups.map(group => `
      <div class="px-[12px] pt-[16px] pb-[4px] text-[12px] font-bold uppercase tracking-[0.8px] text-[#6B7280] dark:text-[#8E9CBA]">${group.category}</div>
      ${group.items.map(item => `
        <button class="nav-menu-item w-full flex items-center justify-between px-[12px] py-[14px] rounded-[14px] hover:bg-gray-50 dark:hover:bg-white/5 transition-all cursor-pointer text-left">
          <span class="text-[15px] font-medium text-[#111827] dark:text-[#FFFFFF]">${item}</span>
          <svg class="w-[16px] h-[16px] text-gray-400 dark:text-[#52607D] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
        </button>
      `).join('')}
    `).join('') + (menu.standaloneItems ? `
      <div class="border-t border-gray-100 dark:border-white/[0.06] mt-[8px] pt-[8px]">
        ${menu.standaloneItems.map(item => `
          <button class="nav-menu-item w-full flex items-center justify-between px-[12px] py-[14px] rounded-[14px] hover:bg-red-50 dark:hover:bg-white/5 transition-all cursor-pointer text-left">
            <span class="text-[15px] font-semibold text-[#DC2626]">${item}</span>
          </button>
        `).join('')}
      </div>
    ` : '');
  } else {
    navMenuList.innerHTML = menu.items.map(item => `
      <button class="nav-menu-item w-full flex items-center justify-between px-[12px] py-[14px] rounded-[14px] hover:bg-gray-50 dark:hover:bg-white/5 transition-all cursor-pointer text-left">
        <span class="text-[15px] font-medium text-[#111827] dark:text-[#FFFFFF]">${item}</span>
        <svg class="w-[16px] h-[16px] text-gray-400 dark:text-[#52607D] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
      </button>
    `).join('');
  }

  navMenuList.querySelectorAll('.nav-menu-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const label = btn.querySelector('span').textContent;
      closeNavMenu();
      if (label === 'Sign Out') {
        handleSignOut();
      } else if (navMenuRoutes[label]) {
        setTimeout(() => navMenuRoutes[label](), 260);
      } else {
        setTimeout(() => showModal(label, `Opening ${label}...`), 260);
      }
    });
  });

  navMenuOverlay.classList.remove('hidden');
  navMenuSheet.classList.remove('hidden');
  requestAnimationFrame(() => {
    navMenuSheet.classList.remove('translate-y-full');
  });
  document.body.style.overflow = 'hidden';
}

function closeNavMenu() {
  navMenuSheet.classList.add('translate-y-full');
  document.body.style.overflow = '';
  setTimeout(() => {
    navMenuOverlay.classList.add('hidden');
    navMenuSheet.classList.add('hidden');
  }, 300);
}

navMenuCloseBtn.addEventListener('click', closeNavMenu);
navMenuOverlay.addEventListener('click', closeNavMenu);
document.getElementById('navAccounts').addEventListener('click', () => openNavMenu('navAccounts'));
document.getElementById('navPayments').addEventListener('click', () => openNavMenu('navPayments'));
document.getElementById('navInvest').addEventListener('click', () => openNavMenu('navInvest'));
document.getElementById('navSupport').addEventListener('click', () => openNavMenu('navSupport'));
document.getElementById('navProfile').addEventListener('click', () => loadPage('profile'));

// ---------- Greeting + live balances from Supabase ----------
async function initSupabaseData() {
  const hours = new Date().getHours();
  let timeOfDay = 'Good Afternoon';
  if (hours < 12) timeOfDay = 'Good Morning';
  else if (hours >= 17) timeOfDay = 'Good Evening';

  let userName = 'Mercy';

  function applyAccountRow(acc) {
    const val = formatCurrency(acc.balance);
    if (acc.account_type === 'checking') {
      const el = document.getElementById('checkingBalance');
      if (el) el.textContent = val;
    } else if (acc.account_type === 'savings') {
      const el = document.getElementById('savingsBalance');
      if (el) el.textContent = val;
    } else if (acc.account_type === 'investments') {
      const el = document.getElementById('investmentsBalance');
      if (el) el.textContent = val;
    } else if (acc.account_type === 'interest_checking') {
      const el = document.getElementById('interestCheckingBalance');
      if (el) el.textContent = val;
      const section = document.getElementById('sectionInterestChecking');
      const promo = document.getElementById('promoBanner');
      if (section) section.classList.remove('hidden');
      if (promo) promo.classList.add('hidden');
    } else if (acc.account_type === 'credit') {
      if (acc.status === 'approved' || Number(acc.balance) > 0 || Number(acc.available_credit) > 0) {
        const rightContainer = document.getElementById('creditCardRightContent');
        if (rightContainer) {
          const availVal = acc.available_credit !== undefined ? formatCurrency(acc.available_credit) : '$0.00';
          rightContainer.innerHTML = `
            <div class="text-[18px] font-bold text-[#111827] dark:text-[#FFFFFF] tracking-tight leading-none">${val}</div>
            <div class="text-[12px] font-normal text-[#6B7280] dark:text-[#8E9CBA] mt-[6px]">Current Balance</div>
            <div class="text-[10px] font-normal text-[#6B7280] dark:text-[#8E9CBA] mt-[2px]">Available Credit ${availVal}</div>
          `;
        }
        const titleDiv = document.querySelector('#cardCredit .card-title');
        if (titleDiv && acc.account_number) {
          titleDiv.innerHTML = `Verceil Signature Card<div class="text-[13px] font-normal text-[#6B7280] dark:text-[#8E9CBA] mt-1"><span class="inline-block w-1.5 h-1.5 rounded-full bg-[#6B7280] dark:bg-[#8E9CBA] mr-0.5 align-middle"></span>${acc.account_number.slice(-4)}</div>`;
        }
      }
    }
  }

  // Demo-mode fallback: if the Interest Checking account was opened while
  // Supabase was unavailable (or before a session exists), still reveal it
  // from the locally cached flag so the dashboard reflects prior activity.
  try {
    if (localStorage.getItem('verceil_interest_checking_opened') === '1') {
      const cachedBalance = Number(localStorage.getItem('verceil_interest_checking_balance') || 0);
      applyAccountRow({ account_type: 'interest_checking', balance: cachedBalance });
    }
  } catch (err) {}

  if (supabaseClient) {
    try {
      const user = await getCurrentUser();
      if (user) {
        if (user.user_metadata && user.user_metadata.first_name) {
          userName = user.user_metadata.first_name;
        } else if (user.email) {
          userName = user.email.split('@')[0];
        }

        const { data: accountsData, error: accountsError } = await supabaseClient
          .from('accounts')
          .select('*')
          .eq('user_id', user.id);

        if (accountsData && !accountsError) {
          accountsData.forEach(applyAccountRow);
        }
      }

      supabaseClient
        .channel('public:accounts')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'accounts' }, (payload) => {
          if (payload.new) applyAccountRow(payload.new);
        })
        .subscribe();
    } catch (err) {
      console.error('Supabase data fetch error:', err);
    }
  }

  greetingLine1.textContent = `${timeOfDay},`;
  greetingLine2.textContent = userName;
}

initSupabaseData();
