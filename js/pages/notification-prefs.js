// Notification Preferences — Profile > Additional > Notification Preferences.
// Push / email / SMS notification toggles, persisted to Supabase.

const pushItems = ['Transactions', 'Deposits', 'Withdrawals', 'Card Purchases', 'Bill Payments', 'Transfers', 'Investment Activity', 'Security Alerts'];
const emailItems = ['Statements', 'Security Alerts', 'Investment Reports', 'Marketing Preferences'];
const smsItems = ['Verification Codes', 'Fraud Alerts', 'Large Transactions'];

let listeners = [];
let notifPrefs = null;

function on(el, evt, fn) {
  if (!el) return;
  el.addEventListener(evt, fn);
  listeners.push(() => el.removeEventListener(evt, fn));
}

function renderPrefGroup(container, items, groupKey, values) {
  container.innerHTML = items.map((label, index) => {
    const onState = values[label] !== false;
    return `<div class="flex items-center justify-between py-[8px]${index > 0 ? ' border-t border-gray-100 dark:border-white/[0.06]' : ''}"><span class="text-[13px] text-[#111827] dark:text-white">${label}</span><button class="pref-toggle w-[44px] h-[24px] rounded-full relative cursor-pointer ${onState ? 'bg-[#2563EB]' : 'bg-gray-200 dark:bg-white/10'}" data-group="${groupKey}" data-label="${label}"><span class="pref-thumb absolute top-[3px] w-[18px] h-[18px] rounded-full bg-white transition-all" style="left:${onState ? '23px' : '3px'};"></span></button></div>`;
  }).join('');
}

async function getOrCreateNotifPrefs({ supabaseClient, getCurrentUser }) {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!supabaseClient) return { user_id: user.id, push: {}, email: {}, sms: {} };

  try {
    const { data } = await supabaseClient.from('notification_preferences').select('*').eq('user_id', user.id).maybeSingle();
    return data || { user_id: user.id, push: {}, email: {}, sms: {} };
  } catch (err) {
    console.error(err);
    return { user_id: user.id, push: {}, email: {}, sms: {} };
  }
}

export async function init(root, ctx) {
  const { loadPage, showModal, supabaseClient, getCurrentUser } = ctx;

  on(root.querySelector('[data-action="back"]'), 'click', () => loadPage('profile'));

  notifPrefs = await getOrCreateNotifPrefs(ctx);
  if (!notifPrefs) notifPrefs = { push: {}, email: {}, sms: {} };
  renderPrefGroup(root.querySelector('#pushPrefsCard'), pushItems, 'push', notifPrefs?.push || {});
  renderPrefGroup(root.querySelector('#emailPrefsCard'), emailItems, 'email', notifPrefs?.email || {});
  renderPrefGroup(root.querySelector('#smsPrefsCard'), smsItems, 'sms', notifPrefs?.sms || {});

  root.querySelectorAll('.pref-toggle').forEach((btn) => {
    on(btn, 'click', () => {
      const group = btn.getAttribute('data-group');
      const label = btn.getAttribute('data-label');
      notifPrefs[group] = notifPrefs[group] || {};
      notifPrefs[group][label] = notifPrefs[group][label] === false ? true : false;
      const onState = notifPrefs[group][label] !== false;
      btn.classList.toggle('bg-[#2563EB]', onState);
      btn.classList.toggle('bg-gray-200', !onState);
      btn.classList.toggle('dark:bg-white/10', !onState);
      const thumb = btn.querySelector('.pref-thumb');
      if (thumb) thumb.style.left = onState ? '23px' : '3px';
    });
  });

  on(root.querySelector('#apSaveBtn'), 'click', async () => {
    try {
      const user = await getCurrentUser();
      if (!user || !supabaseClient) throw new Error('no user');
      await supabaseClient.from('notification_preferences').upsert({ user_id: user.id, ...notifPrefs }, { onConflict: 'user_id' });
      showModal('Preferences Saved', 'Your notification preferences have been updated.');
    } catch (err) {
      console.error(err);
      showModal('Could Not Save', 'Please try again.');
    }
  });
}

export function cleanup() {
  listeners.forEach((off) => off());
  listeners = [];
  notifPrefs = null;
}
