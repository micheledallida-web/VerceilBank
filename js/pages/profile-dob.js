import { showConfirmation } from '../shared/profile-confirmation.js';

let listeners = [];
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

function formatDob(value) {
  if (!value) return 'May 14, 1990';
  const [year, month, day] = value.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

export async function init(root, ctx) {
  const { loadPage, showModal } = ctx;

  root.querySelectorAll('[data-action="back"]').forEach((btn) => on(btn, 'click', () => loadPage('profile')));

  const profile = await getOrCreateUserProfile(ctx);
  if (profile && profile.date_of_birth) {
    root.querySelector('#pdDobInput').value = profile.date_of_birth;
    root.querySelector('#pdCurrentDob').textContent = formatDob(profile.date_of_birth);
  }

  on(root.querySelector('#pdSaveBtn'), 'click', async () => {
    const value = root.querySelector('#pdDobInput').value;
    try {
      await saveUserProfile(ctx, { date_of_birth: value });
      showConfirmation(root, ctx, { fieldLabel: 'Date of Birth', valueText: formatDob(value) });
    } catch (err) {
      console.error(err);
      showModal('Could Not Save', 'Please try again.');
    }
  });
}

export function cleanup() {
  listeners.forEach((off) => off());
  listeners = [];
}
