let listeners = [];

function on(el, evt, fn) {
  if (!el) return;
  el.addEventListener(evt, fn);
  listeners.push(() => el.removeEventListener(evt, fn));
}

function openPrintableWindow(title, bodyHtml, autoPrint = false) {
  const win = window.open('', '_blank', 'noopener,noreferrer');
  if (!win) return;
  win.document.write(`<!doctype html><html><head><title>${title}</title><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;padding:32px;color:#111827}h1{font-size:20px;margin:0 0 16px}.row{display:flex;justify-content:space-between;margin:0 0 14px;font-size:14px}p{color:#6B7280;font-size:12px;line-height:1.5}</style></head><body>${bodyHtml}</body></html>`);
  win.document.close();
  if (autoPrint) setTimeout(() => win.print(), 250);
}

function buildDirectDepositFormHtml(root) {
  return `
    <h1>Direct Deposit Authorization Form</h1>
    <div class="row"><span>Bank Name</span><strong>Verceil Bank</strong></div>
    <div class="row"><span>Routing Number</span><strong>${root.querySelector('#rnDdRouting').textContent}</strong></div>
    <div class="row"><span>Account Number</span><strong>${root.querySelector('#rnDdAccount').textContent}</strong></div>
    <div class="row"><span>Account Type</span><strong>Checking</strong></div>
    <p>Provide this form to your employer or payer to set up direct deposit.</p>
  `;
}

export function init(root, ctx) {
  const { close, getCurrentUser, supabaseClient, getOrCreateTempNumber, showModal } = ctx;
  on(root.querySelector('[data-action="close"]'), 'click', close);

  root.querySelector('#rnLockedView').classList.remove('hidden');
  root.querySelector('#rnUnlockedView').classList.add('hidden');
  root.querySelector('#rnVerifyPassword').value = '';
  root.querySelector('#rnVerifyError').classList.add('hidden');

  on(root.querySelector('#rnVerifyBtn'), 'click', async () => {
    const password = root.querySelector('#rnVerifyPassword').value;
    const errorEl = root.querySelector('#rnVerifyError');
    errorEl.classList.add('hidden');

    if (!password) {
      errorEl.textContent = 'Please enter your password.';
      errorEl.classList.remove('hidden');
      return;
    }

    try {
      const user = await getCurrentUser();
      if (!user?.email || !supabaseClient) throw new Error('no user');
      const { error } = await supabaseClient.auth.signInWithPassword({ email: user.email, password });
      if (error) throw error;

      const routing = getOrCreateTempNumber('checking', 'routing');
      const checkingNum = getOrCreateTempNumber('checking', 'account');
      const savingsNum = getOrCreateTempNumber('savings', 'account');
      root.querySelector('#rnRoutingNumber').textContent = routing;
      root.querySelector('#rnCheckingNumber').textContent = checkingNum;
      root.querySelector('#rnSavingsNumber').textContent = savingsNum;
      root.querySelector('#rnDdRouting').textContent = routing;
      root.querySelector('#rnDdAccount').textContent = checkingNum;
      root.querySelector('#rnLockedView').classList.add('hidden');
      root.querySelector('#rnUnlockedView').classList.remove('hidden');
    } catch (err) {
      console.error(err);
      errorEl.textContent = 'That password could not be verified. Please try again.';
      errorEl.classList.remove('hidden');
    }
  });

  root.querySelectorAll('.rn-copy').forEach((btn) => {
    on(btn, 'click', () => {
      const text = root.querySelector(`#${btn.getAttribute('data-target')}`)?.textContent || '';
      navigator.clipboard?.writeText(text).then(() => showModal('Copied', `${text} copied to clipboard.`)).catch(() => showModal('Copy', text));
    });
  });

  on(root.querySelector('#rnShareBtn'), 'click', async () => {
    const text = `Routing: ${root.querySelector('#rnRoutingNumber').textContent} · Checking: ${root.querySelector('#rnCheckingNumber').textContent}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Verceil Bank Account Info', text });
      } catch (err) {
        console.error(err);
      }
    } else {
      showModal('Share Securely', 'Secure sharing isn\'t supported on this browser.');
    }
  });

  on(root.querySelector('#rnDownloadFormBtn'), 'click', () => openPrintableWindow('Direct Deposit Form', buildDirectDepositFormHtml(root)));
  on(root.querySelector('#rnPrintFormBtn'), 'click', () => openPrintableWindow('Direct Deposit Form', buildDirectDepositFormHtml(root), true));
  on(root.querySelector('#rnEmailFormBtn'), 'click', () => {
    const body = encodeURIComponent(`Direct Deposit Authorization\n\nBank Name: Verceil Bank\nRouting Number: ${root.querySelector('#rnDdRouting').textContent}\nAccount Number: ${root.querySelector('#rnDdAccount').textContent}\nAccount Type: Checking`);
    window.location.href = `mailto:?subject=${encodeURIComponent('Direct Deposit Form')}&body=${body}`;
  });
}

export function cleanup() {
  listeners.forEach((off) => off());
  listeners = [];
}
