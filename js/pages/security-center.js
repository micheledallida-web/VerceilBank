let listeners = [];
let secSettings = null;

function on(el, evt, fn) {
  if (!el) return;
  el.addEventListener(evt, fn);
  listeners.push(() => el.removeEventListener(evt, fn));
}

function renderToggleRow(label, key, onState) {
  return `<div class="flex items-center justify-between py-[8px]"><span class="text-[13px] text-[#111827] dark:text-white">${label}</span><button class="bio-toggle w-[44px] h-[24px] rounded-full relative cursor-pointer ${onState ? 'bg-[#2563EB]' : 'bg-gray-200 dark:bg-white/10'}" data-key="${key}"><span class="bio-thumb absolute top-[3px] w-[18px] h-[18px] rounded-full bg-white transition-all" style="left:${onState ? '23px' : '3px'};"></span></button></div>`;
}

function setToggleState(btn, onState, isDanger = false) {
  btn.classList.toggle('bg-[#DC2626]', isDanger && onState);
  btn.classList.toggle('bg-[#2563EB]', !isDanger && onState);
  btn.classList.toggle('bg-gray-200', !onState);
  btn.classList.toggle('dark:bg-white/10', !onState);
  const thumb = btn.querySelector('.bio-thumb, .sec-thumb');
  if (thumb) thumb.style.left = onState ? '23px' : '3px';
}

async function getOrCreateSecuritySettings({ supabaseClient, getCurrentUser }) {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!supabaseClient) {
    return { user_id: user.id, biometric_face_id: false, biometric_touch_id: false, biometric_payments: false, biometric_investments: false, two_factor_enabled: false, two_factor_method: 'sms', security_alerts_enabled: true, fraud_protection_enabled: true, account_locked: false };
  }

  try {
    const { data } = await supabaseClient.from('security_settings').select('*').eq('user_id', user.id).maybeSingle();
    return data || { user_id: user.id, biometric_face_id: false, biometric_touch_id: false, biometric_payments: false, biometric_investments: false, two_factor_enabled: false, two_factor_method: 'sms', security_alerts_enabled: true, fraud_protection_enabled: true, account_locked: false };
  } catch (err) {
    console.error('Load security settings error:', err);
    return { user_id: user.id };
  }
}

async function saveSecuritySettings({ supabaseClient, getCurrentUser }, patch) {
  const user = await getCurrentUser();
  if (!user || !supabaseClient) throw new Error('Not signed in');
  const { error } = await supabaseClient.from('security_settings').upsert({ user_id: user.id, ...patch }, { onConflict: 'user_id' });
  if (error) throw error;
}

function bindBiometricToggles(root, ctx) {
  root.querySelectorAll('#biometricCard .bio-toggle').forEach((btn) => {
    on(btn, 'click', async () => {
      const key = btn.getAttribute('data-key');
      secSettings[key] = !secSettings[key];
      setToggleState(btn, !!secSettings[key]);
      try {
        await saveSecuritySettings(ctx, { [key]: !!secSettings[key] });
      } catch (err) {
        console.error(err);
      }
    });
  });
}

async function loadTrustedDevices(root, ctx) {
  const { supabaseClient, getCurrentUser } = ctx;
  const list = root.querySelector('#trustedDevicesList');
  const user = await getCurrentUser();
  if (!user || !supabaseClient) {
    list.innerHTML = '<div class="bg-white dark:bg-[#0D1728] border border-transparent dark:border-white/[0.06] rounded-[14px] px-[16px] py-3 shadow-lg text-center text-[12px] text-[#6B7280] dark:text-[#8E9CBA]">No device data available.</div>';
    return;
  }

  try {
    let { data } = await supabaseClient.from('trusted_devices').select('*').eq('user_id', user.id).order('last_active', { ascending: false });
    if (!data || data.length === 0) {
      const deviceName = /Mobile|Android|iPhone/.test(navigator.userAgent) ? 'This Mobile Device' : 'This Browser';
      await supabaseClient.from('trusted_devices').insert({ user_id: user.id, device_name: deviceName, browser: navigator.userAgent.slice(0, 60), trusted: true, last_active: new Date().toISOString() });
      const retry = await supabaseClient.from('trusted_devices').select('*').eq('user_id', user.id).order('last_active', { ascending: false });
      data = retry.data;
    }

    list.innerHTML = (data || []).map((device) => `
      <div class="w-full bg-white dark:bg-[#0D1728] border border-transparent dark:border-white/[0.06] rounded-[14px] p-[12px] shadow-lg flex items-center justify-between">
        <div class="min-w-0"><div class="text-[13px] font-semibold text-[#111827] dark:text-white">${device.device_name} ${device.trusted ? '· Trusted' : ''}</div><div class="text-[11px] text-[#6B7280] dark:text-[#8E9CBA] truncate">${device.browser} · Last active ${new Date(device.last_active).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</div></div>
        <button class="device-remove text-[11px] font-semibold text-[#EF4444] cursor-pointer flex-shrink-0" data-id="${device.id}">Remove</button>
      </div>
    `).join('');

    list.querySelectorAll('.device-remove').forEach((btn) => {
      on(btn, 'click', async () => {
        await supabaseClient.from('trusted_devices').delete().eq('id', btn.getAttribute('data-id'));
        loadTrustedDevices(root, ctx);
      });
    });
  } catch (err) {
    console.error('Load trusted devices error:', err);
    list.innerHTML = '';
  }
}

async function loadLoginActivity(root, ctx) {
  const { supabaseClient, getCurrentUser } = ctx;
  const list = root.querySelector('#loginActivityList');
  const user = await getCurrentUser();
  if (!user || !supabaseClient) {
    list.innerHTML = '<div class="bg-white dark:bg-[#0D1728] border border-transparent dark:border-white/[0.06] rounded-[14px] px-[16px] py-3 shadow-lg text-center text-[12px] text-[#6B7280] dark:text-[#8E9CBA]">No login activity available.</div>';
    return;
  }

  try {
    let { data } = await supabaseClient.from('login_activity').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(10);
    if (!data || data.length === 0) {
      await supabaseClient.from('login_activity').insert({ user_id: user.id, device: /Mobile|Android|iPhone/.test(navigator.userAgent) ? 'Mobile' : 'Desktop', browser: navigator.userAgent.slice(0, 60), success: true });
      const retry = await supabaseClient.from('login_activity').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(10);
      data = retry.data;
    }

    list.innerHTML = (data || []).map((entry) => `
      <div class="w-full bg-white dark:bg-[#0D1728] border border-transparent dark:border-white/[0.06] rounded-[14px] p-[12px] shadow-lg">
        <div class="flex items-center justify-between"><span class="text-[13px] font-semibold ${entry.success ? 'text-[#111827] dark:text-white' : 'text-[#EF4444]'}">${entry.success ? 'Successful Login' : 'Failed Login'}</span><span class="text-[11px] text-[#6B7280] dark:text-[#8E9CBA]">${new Date(entry.created_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</span></div>
        <div class="text-[11px] text-[#6B7280] dark:text-[#8E9CBA] truncate">${entry.device} · ${entry.browser} · Location & IP not tracked yet</div>
      </div>
    `).join('');
  } catch (err) {
    console.error('Load login activity error:', err);
    list.innerHTML = '';
  }
}

export async function init(root, ctx) {
  const { close, getCurrentUser, showModal, supabaseClient } = ctx;

  on(root.querySelector('[data-action="close"]'), 'click', close);

  secSettings = await getOrCreateSecuritySettings(ctx);
  if (!secSettings) {
    secSettings = {
      biometric_face_id: false,
      biometric_touch_id: false,
      biometric_payments: false,
      biometric_investments: false,
      two_factor_enabled: false,
      two_factor_method: 'sms',
      security_alerts_enabled: true,
      fraud_protection_enabled: true,
      account_locked: false,
    };
  }
  root.querySelector('#biometricCard').innerHTML = [
    renderToggleRow('Enable Face ID', 'biometric_face_id', !!secSettings?.biometric_face_id),
    renderToggleRow('Enable Touch ID', 'biometric_touch_id', !!secSettings?.biometric_touch_id),
    renderToggleRow('Biometric Login for Payments', 'biometric_payments', !!secSettings?.biometric_payments),
    renderToggleRow('Biometric Login for Investments', 'biometric_investments', !!secSettings?.biometric_investments),
  ].join('<div class="border-t border-gray-100 dark:border-white/[0.06]"></div>');
  bindBiometricToggles(root, ctx);

  const user = await getCurrentUser();
  root.querySelector('#pwLoginEmail').textContent = `Login email: ${user?.email || '—'}`;
  root.querySelector('#pwLastChanged').textContent = secSettings?.password_updated_at ? `Last changed: ${new Date(secSettings.password_updated_at).toLocaleDateString()}` : 'Password never changed in this session';
  root.querySelector('#tfaMethod').value = secSettings?.two_factor_method || 'sms';
  root.querySelector('#tfaStatus').textContent = secSettings?.two_factor_enabled ? `2FA enabled via ${secSettings.two_factor_method}` : '2FA is currently disabled';
  root.querySelector('#tfaBackupCodes').classList.add('hidden');

  root.querySelectorAll('.sec-toggle').forEach((btn) => {
    const key = btn.getAttribute('data-key');
    setToggleState(btn, !!secSettings?.[key], key === 'account_locked');
    on(btn, 'click', async () => {
      secSettings[key] = !secSettings[key];
      setToggleState(btn, !!secSettings[key], key === 'account_locked');
      try {
        await saveSecuritySettings(ctx, { [key]: !!secSettings[key] });
        if (key === 'account_locked' && secSettings[key]) showModal('Account Locked', 'Your account has been flagged as locked. Contact support to unlock it.');
      } catch (err) {
        console.error(err);
      }
    });
  });

  await loadTrustedDevices(root, ctx);
  await loadLoginActivity(root, ctx);

  on(root.querySelector('#pwUpdateBtn'), 'click', async () => {
    const err = root.querySelector('#pwError');
    const newPw = root.querySelector('#pwNew').value;
    const confirmPw = root.querySelector('#pwConfirm').value;
    err.classList.add('hidden');

    if (newPw.length < 8) {
      err.textContent = 'Password must be at least 8 characters.';
      err.classList.remove('hidden');
      return;
    }
    if (newPw !== confirmPw) {
      err.textContent = 'Passwords do not match.';
      err.classList.remove('hidden');
      return;
    }
    if (!supabaseClient) {
      err.textContent = 'Password updates are unavailable right now.';
      err.classList.remove('hidden');
      return;
    }

    try {
      const { error } = await supabaseClient.auth.updateUser({ password: newPw });
      if (error) throw error;
      await saveSecuritySettings(ctx, { password_updated_at: new Date().toISOString() });
      root.querySelector('#pwNew').value = '';
      root.querySelector('#pwConfirm').value = '';
      root.querySelector('#pwLastChanged').textContent = `Last changed: ${new Date().toLocaleDateString()}`;
      showModal('Password Updated', 'Your password has been changed successfully.');
    } catch (e) {
      console.error(e);
      err.textContent = 'Could not update password. Please try again.';
      err.classList.remove('hidden');
    }
  });

  on(root.querySelector('#tfaEnableBtn'), 'click', async () => {
    secSettings.two_factor_enabled = true;
    secSettings.two_factor_method = root.querySelector('#tfaMethod').value;
    root.querySelector('#tfaStatus').textContent = `2FA enabled via ${secSettings.two_factor_method}`;
    try {
      await saveSecuritySettings(ctx, { two_factor_enabled: true, two_factor_method: secSettings.two_factor_method });
      showModal('Two-Factor Enabled', 'Two-factor authentication is now active on your account.');
    } catch (err) {
      console.error(err);
    }
  });

  on(root.querySelector('#tfaDisableBtn'), 'click', async () => {
    secSettings.two_factor_enabled = false;
    root.querySelector('#tfaStatus').textContent = '2FA is currently disabled';
    try {
      await saveSecuritySettings(ctx, { two_factor_enabled: false });
      showModal('Two-Factor Disabled', 'Two-factor authentication has been turned off.');
    } catch (err) {
      console.error(err);
    }
  });

  on(root.querySelector('#tfaBackupBtn'), 'click', () => {
    const codes = Array.from({ length: 8 }, () => Math.random().toString(36).slice(2, 8).toUpperCase());
    root.querySelector('#tfaBackupCodes').innerHTML = codes.map((code) => `<div class="bg-gray-50 dark:bg-white/5 rounded-[8px] px-[8px] py-[6px] text-center">${code}</div>`).join('');
    root.querySelector('#tfaBackupCodes').classList.remove('hidden');
  });

  on(root.querySelector('#signOutAllDevicesBtn'), 'click', async () => {
    try {
      if (supabaseClient) await supabaseClient.auth.signOut({ scope: 'global' });
    } catch (err) {
      console.error(err);
    }
    window.location.href = '/login';
  });
}

export function cleanup() {
  listeners.forEach((off) => off());
  listeners = [];
  secSettings = null;
}
