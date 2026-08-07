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

function toggleFields(root, sameAsResidential) {
  const fields = root.querySelector('#maFields');
  fields.classList.toggle('hidden', sameAsResidential);
  fields.classList.toggle('flex', !sameAsResidential);
}

export async function init(root, ctx) {
  const { loadPage, showModal } = ctx;

  root.querySelectorAll('[data-action="back"]').forEach((btn) => on(btn, 'click', () => loadPage('profile')));
  on(root.querySelector('#maSame'), 'change', (e) => toggleFields(root, e.target.checked));

  const profile = await getOrCreateUserProfile(ctx);
  if (profile) {
    const same = profile.mail_same_as_res !== false;
    root.querySelector('#maSame').checked = same;
    root.querySelector('#maStreet').value = profile.mail_street || '';
    root.querySelector('#maCity').value = profile.mail_city || '';
    root.querySelector('#maState').value = profile.mail_state || '';
    root.querySelector('#maZip').value = profile.mail_zip || '';
    if (!same) {
      const line = [profile.mail_street, [profile.mail_city, profile.mail_state].filter(Boolean).join(', '), profile.mail_zip].filter(Boolean).join(', ');
      if (line) root.querySelector('#pdCurrentMail').textContent = line;
    }
  }
  toggleFields(root, root.querySelector('#maSame').checked);

  on(root.querySelector('#pdSaveBtn'), 'click', async () => {
    const same = root.querySelector('#maSame').checked;
    const street = root.querySelector('#maStreet').value.trim();
    const city = root.querySelector('#maCity').value.trim();
    const state = root.querySelector('#maState').value.trim();
    const zip = root.querySelector('#maZip').value.trim();

    try {
      await saveUserProfile(ctx, {
        mail_same_as_res: same,
        mail_street: same ? null : street,
        mail_city: same ? null : city,
        mail_state: same ? null : state,
        mail_zip: same ? null : zip,
      });
      const valueText = same ? 'Same as residential address' : ([street, [city, state].filter(Boolean).join(', '), zip].filter(Boolean).join(', ') || 'Mailing address updated');
      showConfirmation(root, ctx, { fieldLabel: 'Mailing Address', valueText });
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
