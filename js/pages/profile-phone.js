import { showConfirmation } from '../shared/profile-confirmation.js';

let listeners = [];
let pendingCode = null;

function on(el, evt, fn) {
  if (!el) return;
  el.addEventListener(evt, fn);
  listeners.push(() => el.removeEventListener(evt, fn));
}

async function getOrCreateUserProfile({ supabaseClient, getCurrentUser }) {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!supabaseClient) return { user_id: user.id };
  try {
    const { data } = await supabaseClient.from('user_profile').select('*').eq('user_id', user.id).maybeSingle();
    return data || { user_id: user.id };
  } catch (err) {
    console.error('Load profile error:', err);
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
  const { loadPage, showModal } = ctx;

  root.querySelectorAll('[data-action="back"]').forEach((btn) => on(btn, 'click', () => loadPage('profile')));

  const profile = await getOrCreateUserProfile(ctx);
  if (profile) {
    root.querySelector('#phCode').value = profile.phone_country_code || '+1';
    root.querySelector('#phNumber').value = profile.phone_number || '';
    root.querySelector('#phStatus').textContent = profile.phone_verified ? '✅ Verified' : 'Not verified';
    if (profile.phone_number) root.querySelector('#pdCurrentPhone').textContent = `${profile.phone_country_code || '+1'} ${profile.phone_number}`;
  }

  on(root.querySelector('#phSendCodeBtn'), 'click', () => {
    pendingCode = String(Math.floor(100000 + Math.random() * 900000));
    root.querySelector('#phVerifyRow').classList.remove('hidden');
    root.querySelector('#phVerifyRow').classList.add('flex');
    showModal('Verification Code Sent', `Demo mode — no SMS provider connected. Your code is: ${pendingCode}`);
  });

  on(root.querySelector('#phVerifyBtn'), 'click', async () => {
    if (root.querySelector('#phCodeInput').value.trim() !== pendingCode) {
      showModal('Incorrect Code', 'That code did not match. Please try again.');
      return;
    }
    try {
      await saveUserProfile(ctx, { phone_verified: true });
      root.querySelector('#phStatus').textContent = '✅ Verified';
      root.querySelector('#phVerifyRow').classList.add('hidden');
      showModal('Phone Verified', 'Your phone number has been verified.');
    } catch (err) {
      console.error(err);
      showModal('Could Not Verify', 'Please try again.');
    }
  });

  on(root.querySelector('#pdSaveBtn'), 'click', async () => {
    const code = root.querySelector('#phCode').value.trim();
    const number = root.querySelector('#phNumber').value.trim();
    try {
      await saveUserProfile(ctx, { phone_country_code: code, phone_number: number });
      showConfirmation(root, ctx, { fieldLabel: 'Phone Number', valueText: `${code} ${number}`.trim() || '(212) 555-0188' });
    } catch (err) {
      console.error(err);
      showModal('Could Not Save', 'Please try again.');
    }
  });
}

export function cleanup() {
  listeners.forEach((off) => off());
  listeners = [];
  pendingCode = null;
}
