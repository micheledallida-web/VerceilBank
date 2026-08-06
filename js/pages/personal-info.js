let listeners = [];
let pendingPhoneCode = null;
let pendingEmailCode = null;

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

function showProfileUpdateConfirmation(showModal, genRef, fieldLabel) {
  showModal('Profile Updated Successfully', `${fieldLabel} was updated. Confirmation: ${genRef()} · ${new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}`);
}

function toggleMailFields(root, sameAsResidential) {
  const fields = root.querySelector('#piMailFields');
  fields.classList.toggle('hidden', sameAsResidential);
  fields.classList.toggle('flex', !sameAsResidential);
}

export async function init(root, ctx) {
  const { close, getCurrentUser, showModal, genRef } = ctx;

  on(root.querySelector('[data-action="close"]'), 'click', close);
  on(root.querySelector('#piMailSame'), 'change', (event) => toggleMailFields(root, event.target.checked));

  const profile = await getOrCreateUserProfile(ctx);
  if (profile) {
    root.querySelector('#piFirstName').value = profile.first_name || '';
    root.querySelector('#piMiddleName').value = profile.middle_name || '';
    root.querySelector('#piLastName').value = profile.last_name || '';
    root.querySelector('#piDob').value = profile.date_of_birth || '';
    root.querySelector('#piResStreet').value = profile.res_street || '';
    root.querySelector('#piResApt').value = profile.res_apt || '';
    root.querySelector('#piResCity').value = profile.res_city || '';
    root.querySelector('#piResState').value = profile.res_state || '';
    root.querySelector('#piResZip').value = profile.res_zip || '';
    root.querySelector('#piResCountry').value = profile.res_country || 'United States';
    root.querySelector('#piMailSame').checked = profile.mail_same_as_res !== false;
    root.querySelector('#piMailStreet').value = profile.mail_street || '';
    root.querySelector('#piMailCity').value = profile.mail_city || '';
    root.querySelector('#piMailState').value = profile.mail_state || '';
    root.querySelector('#piMailZip').value = profile.mail_zip || '';
    root.querySelector('#piPhoneCode').value = profile.phone_country_code || '+1';
    root.querySelector('#piPhoneNumber').value = profile.phone_number || '';
    root.querySelector('#piPhoneStatus').textContent = profile.phone_verified ? '✅ Verified' : 'Not verified';
    root.querySelector('#piEmail').value = profile.email || (await getCurrentUser())?.email || '';
    root.querySelector('#piEmailStatus').textContent = profile.email_verified ? '✅ Verified' : 'Not verified';
  }

  toggleMailFields(root, root.querySelector('#piMailSame').checked);

  on(root.querySelector('#piSaveNameBtn'), 'click', async () => {
    try {
      await saveUserProfile(ctx, {
        first_name: root.querySelector('#piFirstName').value.trim(),
        middle_name: root.querySelector('#piMiddleName').value.trim(),
        last_name: root.querySelector('#piLastName').value.trim(),
      });
      showProfileUpdateConfirmation(showModal, genRef, 'Full Legal Name');
    } catch (err) {
      console.error(err);
      showModal('Could Not Save', 'Please try again.');
    }
  });

  on(root.querySelector('#piSaveDobBtn'), 'click', async () => {
    try {
      await saveUserProfile(ctx, { date_of_birth: root.querySelector('#piDob').value });
      showProfileUpdateConfirmation(showModal, genRef, 'Date of Birth');
    } catch (err) {
      console.error(err);
      showModal('Could Not Save', 'Please try again.');
    }
  });

  on(root.querySelector('#piSaveResBtn'), 'click', async () => {
    try {
      await saveUserProfile(ctx, {
        res_street: root.querySelector('#piResStreet').value.trim(),
        res_apt: root.querySelector('#piResApt').value.trim(),
        res_city: root.querySelector('#piResCity').value.trim(),
        res_state: root.querySelector('#piResState').value.trim(),
        res_zip: root.querySelector('#piResZip').value.trim(),
        res_country: root.querySelector('#piResCountry').value.trim(),
      });
      showProfileUpdateConfirmation(showModal, genRef, 'Residential Address');
    } catch (err) {
      console.error(err);
      showModal('Could Not Save', 'Please try again.');
    }
  });

  on(root.querySelector('#piSaveMailBtn'), 'click', async () => {
    const same = root.querySelector('#piMailSame').checked;
    try {
      await saveUserProfile(ctx, {
        mail_same_as_res: same,
        mail_street: same ? null : root.querySelector('#piMailStreet').value.trim(),
        mail_city: same ? null : root.querySelector('#piMailCity').value.trim(),
        mail_state: same ? null : root.querySelector('#piMailState').value.trim(),
        mail_zip: same ? null : root.querySelector('#piMailZip').value.trim(),
      });
      showProfileUpdateConfirmation(showModal, genRef, 'Mailing Address');
    } catch (err) {
      console.error(err);
      showModal('Could Not Save', 'Please try again.');
    }
  });

  on(root.querySelector('#piSendPhoneCodeBtn'), 'click', () => {
    pendingPhoneCode = String(Math.floor(100000 + Math.random() * 900000));
    root.querySelector('#piPhoneVerifyRow').classList.remove('hidden');
    showModal('Verification Code Sent', `Demo mode — no SMS provider connected. Your code is: ${pendingPhoneCode}`);
  });

  on(root.querySelector('#piVerifyPhoneBtn'), 'click', async () => {
    if (root.querySelector('#piPhoneCodeInput').value.trim() !== pendingPhoneCode) {
      showModal('Incorrect Code', 'That code did not match. Please try again.');
      return;
    }
    try {
      await saveUserProfile(ctx, { phone_verified: true });
      root.querySelector('#piPhoneStatus').textContent = '✅ Verified';
      root.querySelector('#piPhoneVerifyRow').classList.add('hidden');
      showModal('Phone Verified', 'Your phone number has been verified.');
    } catch (err) {
      console.error(err);
      showModal('Could Not Verify', 'Please try again.');
    }
  });

  on(root.querySelector('#piSavePhoneBtn'), 'click', async () => {
    try {
      await saveUserProfile(ctx, {
        phone_country_code: root.querySelector('#piPhoneCode').value.trim(),
        phone_number: root.querySelector('#piPhoneNumber').value.trim(),
      });
      showProfileUpdateConfirmation(showModal, genRef, 'Phone Number');
    } catch (err) {
      console.error(err);
      showModal('Could Not Save', 'Please try again.');
    }
  });

  on(root.querySelector('#piSendEmailCodeBtn'), 'click', () => {
    pendingEmailCode = String(Math.floor(100000 + Math.random() * 900000));
    root.querySelector('#piEmailVerifyRow').classList.remove('hidden');
    showModal('Verification Email Sent', `Demo mode — no email provider connected. Your code is: ${pendingEmailCode}`);
  });

  on(root.querySelector('#piVerifyEmailBtn'), 'click', async () => {
    if (root.querySelector('#piEmailCodeInput').value.trim() !== pendingEmailCode) {
      showModal('Incorrect Code', 'That code did not match. Please try again.');
      return;
    }
    try {
      await saveUserProfile(ctx, { email_verified: true });
      root.querySelector('#piEmailStatus').textContent = '✅ Verified';
      root.querySelector('#piEmailVerifyRow').classList.add('hidden');
      showModal('Email Verified', 'Your email address has been verified.');
    } catch (err) {
      console.error(err);
      showModal('Could Not Verify', 'Please try again.');
    }
  });

  on(root.querySelector('#piSaveEmailBtn'), 'click', async () => {
    try {
      await saveUserProfile(ctx, { email: root.querySelector('#piEmail').value.trim() });
      showProfileUpdateConfirmation(showModal, genRef, 'Email Address');
    } catch (err) {
      console.error(err);
      showModal('Could Not Save', 'Please try again.');
    }
  });
}

export function cleanup() {
  listeners.forEach((off) => off());
  listeners = [];
  pendingPhoneCode = null;
  pendingEmailCode = null;
}
