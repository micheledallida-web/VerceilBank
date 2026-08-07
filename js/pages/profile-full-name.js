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

export async function init(root, ctx) {
  const { loadPage, showModal } = ctx;

  root.querySelectorAll('[data-action="back"]').forEach((btn) => on(btn, 'click', () => loadPage('profile')));

  const profile = await getOrCreateUserProfile(ctx);
  if (profile) {
    root.querySelector('#pnFirstName').value = profile.first_name || '';
    root.querySelector('#pnMiddleName').value = profile.middle_name || '';
    root.querySelector('#pnLastName').value = profile.last_name || '';
    root.querySelector('#pnSuffix').value = profile.suffix || '';
    const fullName = [profile.first_name, profile.middle_name, profile.last_name, profile.suffix].filter(Boolean).join(' ');
    if (fullName) root.querySelector('#pdCurrentName').textContent = fullName;
  }

  on(root.querySelector('#pdSaveBtn'), 'click', async () => {
    const firstName = root.querySelector('#pnFirstName').value.trim();
    const middleName = root.querySelector('#pnMiddleName').value.trim();
    const lastName = root.querySelector('#pnLastName').value.trim();
    const suffix = root.querySelector('#pnSuffix').value.trim();

    try {
      await saveUserProfile(ctx, { first_name: firstName, middle_name: middleName, last_name: lastName, suffix });
      const fullName = [firstName, middleName, lastName, suffix].filter(Boolean).join(' ') || 'Mercy Johnson';
      showConfirmation(root, ctx, { fieldLabel: 'Full Legal Name', valueText: fullName });
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
