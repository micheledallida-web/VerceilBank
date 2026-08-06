let listeners = [];
let activeAccount = 'checking';
let accountPrefs = { is_default: false, paperless: false, notifications: true };

const accountLabels = {
  checking: 'Verceil Checking',
  savings: 'High-Yield Savings',
  investments: 'Investment Portfolio',
};

function on(el, evt, fn) {
  if (!el) return;
  el.addEventListener(evt, fn);
  listeners.push(() => el.removeEventListener(evt, fn));
}

function setToggleState(btn, onState) {
  btn.classList.toggle('bg-[#2563EB]', onState);
  btn.classList.toggle('bg-gray-200', !onState);
  btn.classList.toggle('dark:bg-white/10', !onState);
  const thumb = btn.querySelector('.ad-thumb');
  if (thumb) thumb.style.left = onState ? '23px' : '3px';
}

async function loadAccountPreferences(ctx, type) {
  const user = await ctx.getCurrentUser();
  if (!user || !ctx.supabaseClient) return { nickname: '', is_default: false, paperless: false, notifications: true };
  try {
    const { data } = await ctx.supabaseClient.from('account_preferences').select('*').eq('user_id', user.id).eq('account_type', type).maybeSingle();
    return data || { nickname: '', is_default: false, paperless: false, notifications: true };
  } catch (err) {
    console.error(err);
    return { nickname: '', is_default: false, paperless: false, notifications: true };
  }
}

async function refresh(root, ctx) {
  const prefs = await loadAccountPreferences(ctx, activeAccount);
  accountPrefs = { is_default: !!prefs.is_default, paperless: !!prefs.paperless, notifications: prefs.notifications !== false };
  root.querySelector('#adNickname').value = prefs.nickname || '';

  let holder = 'Mercy';
  try {
    const user = await ctx.getCurrentUser();
    const { data: profile } = user && ctx.supabaseClient ? await ctx.supabaseClient.from('user_profile').select('*').eq('user_id', user.id).maybeSingle() : { data: null };
    holder = profile?.first_name || user?.user_metadata?.first_name || user?.email?.split('@')[0] || holder;
  } catch (err) {
    console.error(err);
  }

  root.querySelector('#adAccountInfo').innerHTML = `
    <div class="flex justify-between"><span class="text-[#6B7280] dark:text-[#8E9CBA]">Account Type</span><span class="font-semibold text-[#111827] dark:text-white">${accountLabels[activeAccount]}</span></div>
    <div class="flex justify-between"><span class="text-[#6B7280] dark:text-[#8E9CBA]">Status</span><span class="font-semibold text-[#16A34A]">Active</span></div>
    <div class="flex justify-between"><span class="text-[#6B7280] dark:text-[#8E9CBA]">Primary Holder</span><span class="font-semibold text-[#111827] dark:text-white">${holder}</span></div>
    <div class="flex justify-between"><span class="text-[#6B7280] dark:text-[#8E9CBA]">Joint Owner</span><span class="font-semibold text-[#6B7280] dark:text-[#8E9CBA]">None</span></div>
    <div class="flex justify-between"><span class="text-[#6B7280] dark:text-[#8E9CBA]">Branch</span><span class="font-semibold text-[#111827] dark:text-white">Verceil Digital Branch</span></div>
  `;

  root.querySelectorAll('.ad-toggle').forEach((btn) => {
    setToggleState(btn, !!accountPrefs[btn.getAttribute('data-key')]);
  });
  root.querySelectorAll('.ad-acct-tab').forEach((btn) => {
    const active = btn.getAttribute('data-acct') === activeAccount;
    btn.classList.toggle('bg-[#2563EB]', active);
    btn.classList.toggle('text-white', active);
    btn.classList.toggle('bg-white', !active);
    btn.classList.toggle('dark:bg-[#0D1728]', !active);
    btn.classList.toggle('text-[#111827]', !active);
    btn.classList.toggle('dark:text-white', !active);
  });
}

export async function init(root, ctx) {
  const { close, showModal, supabaseClient, getCurrentUser, genRef } = ctx;
  on(root.querySelector('[data-action="close"]'), 'click', close);

  root.querySelectorAll('.ad-acct-tab').forEach((btn) => {
    on(btn, 'click', async () => {
      activeAccount = btn.getAttribute('data-acct');
      await refresh(root, ctx);
    });
  });

  root.querySelectorAll('.ad-toggle').forEach((btn) => {
    on(btn, 'click', () => {
      const key = btn.getAttribute('data-key');
      accountPrefs[key] = !accountPrefs[key];
      setToggleState(btn, !!accountPrefs[key]);
    });
  });

  on(root.querySelector('#adSaveBtn'), 'click', async () => {
    try {
      const user = await getCurrentUser();
      if (!user || !supabaseClient) throw new Error('no user');
      await supabaseClient.from('account_preferences').upsert({ user_id: user.id, account_type: activeAccount, nickname: root.querySelector('#adNickname').value.trim(), ...accountPrefs }, { onConflict: 'user_id,account_type' });
      showModal('Account Updated', 'Your account preferences have been saved.');
    } catch (err) {
      console.error(err);
      showModal('Could Not Save', 'Please try again.');
    }
  });

  on(root.querySelector('#adCloseAcctBtn'), 'click', async () => {
    try {
      const user = await getCurrentUser();
      if (!user || !supabaseClient) throw new Error('no user');
      await supabaseClient.from('account_preferences').upsert({ user_id: user.id, account_type: activeAccount, closure_requested: true }, { onConflict: 'user_id,account_type' });
      showModal('Closure Request Submitted', `Your request to close this account has been received. Reference: ${genRef()}. A specialist will follow up before any action is taken.`);
    } catch (err) {
      console.error(err);
      showModal('Could Not Submit', 'Please try again.');
    }
  });

  await refresh(root, ctx);
}

export function cleanup() {
  listeners.forEach((off) => off());
  listeners = [];
  activeAccount = 'checking';
  accountPrefs = { is_default: false, paperless: false, notifications: true };
}
