// Icons: blue outline icons for each Personal Information / Account row, and
// a red outline logout icon for Sign Out — matching the Citi-style profile
// layout described in the design spec.
const ICONS = {
  name: '<path stroke-linecap="round" stroke-linejoin="round" d="M5.5 21a6.5 6.5 0 0113 0M12 11a4 4 0 100-8 4 4 0 000 8z"></path>',
  dob: '<rect x="3" y="4.5" width="18" height="16" rx="3"></rect><path stroke-linecap="round" d="M3 9.5h18M8 2.5v4M16 2.5v4"></path>',
  home: '<path stroke-linecap="round" stroke-linejoin="round" d="M3 10.5L12 3l9 7.5M5 9.5V21h14V9.5"></path>',
  mail: '<path stroke-linecap="round" stroke-linejoin="round" d="M3.5 20.5L20.5 12 3.5 3.5l2.2 7.2 9.8 1.3-9.8 1.3-2.2 7.2z"></path>',
  phone: '<path stroke-linecap="round" stroke-linejoin="round" d="M5 4h3.4l1.6 5-2.2 1.6a12 12 0 006.6 6.6l1.6-2.2 5 1.6V20a2 2 0 01-2.2 2C10.5 21.6 2.4 13.5 3 5.2 3.1 4.5 3.7 4 4.4 4H5z"></path>',
  envelope: '<rect x="3" y="5" width="18" height="14" rx="2.5"></rect><path stroke-linecap="round" stroke-linejoin="round" d="M3.5 6.5l8.5 6.5 8.5-6.5"></path>',
  link: '<path stroke-linecap="round" stroke-linejoin="round" d="M9 12a4 4 0 004 4h1a4 4 0 000-8h-1m-2 4a4 4 0 00-4-4H6a4 4 0 000 8h1"></path>',
  doc: '<path stroke-linecap="round" stroke-linejoin="round" d="M7 3h7l5 5v13a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1z"></path><path stroke-linecap="round" stroke-linejoin="round" d="M14 3v5h5M9 13h6M9 17h6"></path>',
  bell: '<path stroke-linecap="round" stroke-linejoin="round" d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 00-4-5.7V5a2 2 0 10-4 0v.3C7.7 6.2 6 8.4 6 11v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path>',
  shield: '<path stroke-linecap="round" stroke-linejoin="round" d="M12 3l7 3v6c0 4.5-3 8.4-7 9-4-.6-7-4.5-7-9V6l7-3z"></path>',
  logout: '<path stroke-linecap="round" stroke-linejoin="round" d="M9 5H6a2 2 0 00-2 2v10a2 2 0 002 2h3M15 16l4-4-4-4M19 12H9"></path>',
};

function iconSvg(name, colorClass) {
  return `<svg class="w-[22px] h-[22px] ${colorClass}" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">${ICONS[name] || ''}</svg>`;
}

function chevronSvg() {
  return '<svg class="w-[16px] h-[16px] text-[#9CA3AF] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.4"><polyline points="9 18 15 12 9 6"></polyline></svg>';
}

function rowHTML({ icon, title, secondary, isLast, danger }) {
  const titleColor = danger ? 'text-[#DC2626]' : 'text-[#0F172A] dark:text-white';
  const iconColor = danger ? 'text-[#DC2626]' : 'text-[#2563EB]';
  return `
    <button type="button" class="profile-row w-full flex items-center gap-[14px] px-[18px] min-h-[60px] cursor-pointer text-left transition-colors duration-150 hover:bg-gray-50 dark:hover:bg-white/5 ${isLast ? '' : 'border-b border-[#E5E7EB]'}">
      <span class="w-[38px] h-[38px] rounded-full ${danger ? 'bg-red-50' : 'bg-blue-50'} dark:bg-white/5 flex items-center justify-center flex-shrink-0">${iconSvg(icon, iconColor)}</span>
      <span class="flex-1 min-w-0 py-[12px]">
        <span class="block text-[16px] font-semibold ${titleColor} truncate">${title}</span>
        <span class="block text-[13px] text-[#6B7280] dark:text-[#8E9CBA] truncate mt-[2px]">${secondary}</span>
      </span>
      ${danger ? '' : chevronSvg()}
    </button>
  `;
}

const PERSONAL_INFO_ROWS = [
  { icon: 'name', title: 'Full Legal Name', secondary: 'Mercy Johnson', page: 'profile-full-name' },
  { icon: 'dob', title: 'Date of Birth', secondary: 'May 14, 1990', page: 'profile-dob' },
  { icon: 'home', title: 'Residential Address', secondary: '123 Main Street, New York, NY 10001', page: 'profile-residential-address' },
  { icon: 'mail', title: 'Mailing Address', secondary: 'Same as residential address', page: 'profile-mailing-address' },
  { icon: 'phone', title: 'Phone Number', secondary: '(212) 555-0188', page: 'profile-phone' },
  { icon: 'envelope', title: 'Email Address', secondary: 'mercy.johnson@email.com', page: 'profile-email' },
];

const ACCOUNT_ROWS = [
  { icon: 'link', title: 'Linked Accounts', secondary: '3 accounts linked', page: 'linked-accounts' },
  { icon: 'doc', title: 'Tax Documents', secondary: 'View and download tax forms', page: 'tax-docs' },
  { icon: 'bell', title: 'Notification Preferences', secondary: 'Manage alerts and notifications', page: 'notification-prefs' },
  { icon: 'shield', title: 'Privacy & Data Settings', secondary: 'Manage your privacy preferences', page: 'privacy' },
];

let listeners = [];
function on(el, evt, fn) {
  if (!el) return;
  el.addEventListener(evt, fn);
  listeners.push(() => el.removeEventListener(evt, fn));
}

function wireRows(root, container, rows, ctx) {
  container.querySelectorAll('.profile-row').forEach((btn, idx) => {
    on(btn, 'click', () => ctx.loadPage(rows[idx].page));
  });
}

export async function init(root, ctx) {
  const { close, showModal, signOut } = ctx;

  on(root.querySelector('[data-action="close"]'), 'click', close);

  const personalInfoCard = root.querySelector('#personalInfoCard');
  personalInfoCard.innerHTML = PERSONAL_INFO_ROWS.map((row, idx) => rowHTML({ ...row, isLast: idx === PERSONAL_INFO_ROWS.length - 1 })).join('');
  wireRows(root, personalInfoCard, PERSONAL_INFO_ROWS, ctx);

  const accountCard = root.querySelector('#accountCard');
  accountCard.innerHTML = ACCOUNT_ROWS.map((row, idx) => rowHTML({ ...row, isLast: idx === ACCOUNT_ROWS.length - 1 })).join('');
  wireRows(root, accountCard, ACCOUNT_ROWS, ctx);

  const signOutCard = root.querySelector('#signOutCard');
  signOutCard.innerHTML = rowHTML({ icon: 'logout', title: 'Sign Out', secondary: 'Sign out of your account', isLast: true, danger: true });
  on(signOutCard.querySelector('.profile-row'), 'click', () => {
    if (typeof signOut === 'function') signOut();
    else showModal('Sign Out', 'Signing out...');
  });

  // Try to reflect the signed-in user's initials in the avatar, preferring
  // their saved first/last name over the email address when available.
  try {
    const user = await ctx.getCurrentUser();
    if (user) {
      let initials = null;
      if (ctx.supabaseClient) {
        const { data: profile } = await ctx.supabaseClient.from('user_profile').select('first_name,last_name').eq('user_id', user.id).maybeSingle();
        if (profile && (profile.first_name || profile.last_name)) {
          initials = `${(profile.first_name || '').charAt(0)}${(profile.last_name || '').charAt(0)}`.toUpperCase();
        }
      }
      if (!initials && user.email) {
        const local = user.email.split('@')[0];
        initials = local.slice(0, 2).toUpperCase();
      }
      const avatar = root.querySelector('#profileAvatar');
      if (avatar && initials) avatar.textContent = initials;
    }
  } catch (err) {
    // Non-fatal — fall back to the default initials already in the markup.
  }
}

export function cleanup() {
  listeners.forEach((off) => off());
  listeners = [];
}
