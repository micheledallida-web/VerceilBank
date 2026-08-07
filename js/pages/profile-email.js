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
  const { loadPage, showModal, getCurrentUser } = ctx;

  root.querySelectorAll('[data-action="back"]').forEach((btn) => on(btn, 'click', () => loadPage('profile')));

  const profile = await getOrCreateUserProfile(ctx);
  const currentUser = await getCurrentUser();
  const emailValue = (profile && profile.email) || (currentUser && currentUser.email) || '';
  root.querySelector('#emEmail').value = emailValue;
  if (emailValue) root.querySelector('#pdCurrentEmail').textContent = emailValue;
  root.querySelector('#emStatus').textContent = profile && profile.email_verified ? '✅ Verified' : 'Not verified';

  on(root.querySelector('#emSendCodeBtn'), 'click', () => {
    pendingCode = String(Math.floor(100000 + Math.random() * 900000));
    root.querySelector('#emVerifyRow').classList.remove('hidden');
    root.querySelector('#emVerifyRow').classList.add('flex');
    showModal('Verification Email Sent', `Demo mode — no email provider connected. Your code is: ${pendingCode}`);
  });

  on(root.querySelector('#emVerifyBtn'), 'click', async () => {
    if (root.querySelector('#emCodeInput').value.trim() !== pendingCode) {
      showModal('Incorrect Code', 'That code did not match. Please try again.');
      return;
    }
    try {
      await saveUserProfile(ctx, { email_verified: true });
      root.querySelector('#emStatus').textContent = '✅ Verified';
      root.querySelector('#emVerifyRow').classList.add('hidden');
      showModal('Email Verified', 'Your email address has been verified.');
    } catch (err) {
      console.error(err);
      showModal('Could Not Verify', 'Please try again.');
    }
  });

  on(root.querySelector('#pdSaveBtn'), 'click', async () => {
    const email = root.querySelector('#emEmail').value.trim();
    try {
      await saveUserProfile(ctx, { email });
      showConfirmation(root, ctx, { fieldLabel: 'Email Address', valueText: email || 'mercy.johnson@email.com' });
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
