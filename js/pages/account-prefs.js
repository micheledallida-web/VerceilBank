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

function setToggleState(btn, onState) {
  btn.classList.toggle('bg-[#2563EB]', onState);
  btn.classList.toggle('bg-gray-200', !onState);
  btn.classList.toggle('dark:bg-white/10', !onState);
  const thumb = btn.querySelector('.pref-thumb, .pref-secondary-thumb');
  if (thumb) thumb.style.left = onState ? '23px' : '3px';
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
  if (!supabaseClient) return { user_id: user.id, push: {}, email: {}, sms: {}, paperless_statements: false, communication_marketing: false };

  try {
    const { data } = await supabaseClient.from('notification_preferences').select('*').eq('user_id', user.id).maybeSingle();
    return data || { user_id: user.id, push: {}, email: {}, sms: {}, paperless_statements: false, communication_marketing: false };
  } catch (err) {
    console.error(err);
    return { user_id: user.id, push: {}, email: {}, sms: {}, paperless_statements: false, communication_marketing: false };
  }
}

async function getOrCreateUserProfile({ supabaseClient, getCurrentUser }) {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!supabaseClient) return { user_id: user.id };
  try {
    const { data } = await supabaseClient.from('user_profile').select('*').eq('user_id', user.id).maybeSingle();
    return data || { user_id: user.id };
  } catch (err) {
    console.error(err);
    return { user_id: user.id };
  }
}

async function saveUserProfile({ supabaseClient, getCurrentUser }, patch) {
  const user = await getCurrentUser();
  if (!user || !supabaseClient) throw new Error('Not signed in');
  const { error } = await supabaseClient.from('user_profile').upsert({ user_id: user.id, ...patch }, { onConflict: 'user_id' });
  if (error) throw error;
}

export async function init(root, ctx) {
  const { close, showModal, loadPage, supabaseClient, getCurrentUser } = ctx;

  on(root.querySelector('[data-action="close"]'), 'click', close);

  notifPrefs = await getOrCreateNotifPrefs(ctx);
  if (!notifPrefs) notifPrefs = { push: {}, email: {}, sms: {}, paperless_statements: false, communication_marketing: false };
  renderPrefGroup(root.querySelector('#pushPrefsCard'), pushItems, 'push', notifPrefs?.push || {});
  renderPrefGroup(root.querySelector('#emailPrefsCard'), emailItems, 'email', notifPrefs?.email || {});
  renderPrefGroup(root.querySelector('#smsPrefsCard'), smsItems, 'sms', notifPrefs?.sms || {});

  root.querySelectorAll('.pref-toggle').forEach((btn) => {
    on(btn, 'click', () => {
      const group = btn.getAttribute('data-group');
      const label = btn.getAttribute('data-label');
      notifPrefs[group] = notifPrefs[group] || {};
      notifPrefs[group][label] = notifPrefs[group][label] === false ? true : false;
      setToggleState(btn, notifPrefs[group][label] !== false);
    });
  });

  root.querySelectorAll('.pref-secondary-toggle').forEach((btn) => {
    const key = btn.getAttribute('data-key');
    const onState = key === 'paperless_statements' ? !!notifPrefs.paperless_statements : !!notifPrefs.communication_marketing;
    setToggleState(btn, onState);
    on(btn, 'click', () => {
      if (key === 'paperless_statements') notifPrefs.paperless_statements = !notifPrefs.paperless_statements;
      else notifPrefs.communication_marketing = !notifPrefs.communication_marketing;
      const nextState = key === 'paperless_statements' ? !!notifPrefs.paperless_statements : !!notifPrefs.communication_marketing;
      setToggleState(btn, nextState);
    });
  });

  const profile = await getOrCreateUserProfile(ctx);
  root.querySelector('#apLanguage').value = profile?.language || 'English';
  root.querySelector('#apDefaultAccount').value = profile?.default_payment_account || 'checking';

  on(root.querySelector('#apManageLinkedBtn'), 'click', () => loadPage('linked-accounts'));
  on(root.querySelector('#apPrivacyBtn'), 'click', () => loadPage('privacy'));

  on(root.querySelector('#apSaveBtn'), 'click', async () => {
    try {
      const user = await getCurrentUser();
      if (!user || !supabaseClient) throw new Error('no user');
      await supabaseClient.from('notification_preferences').upsert({ user_id: user.id, ...notifPrefs }, { onConflict: 'user_id' });
      await saveUserProfile(ctx, {
        language: root.querySelector('#apLanguage').value,
        default_payment_account: root.querySelector('#apDefaultAccount').value,
      });
      showModal('Preferences Saved', 'Your account preferences have been updated.');
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
