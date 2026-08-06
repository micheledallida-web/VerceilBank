let listeners = [];

function on(el, evt, fn) { el.addEventListener(evt, fn); listeners.push(() => el.removeEventListener(evt, fn)); }

export function init(root, ctx) {
  const { supabaseClient, getCurrentUser, close } = ctx;

  const addPayeeToggleBtn = root.querySelector('#addPayeeToggleBtn');
  const addPayeeForm = root.querySelector('#addPayeeForm');
  const payeesList = root.querySelector('#payeesList');
  const payeeName = root.querySelector('#payeeName');
  const payeeNickname = root.querySelector('#payeeNickname');
  const payeeBankName = root.querySelector('#payeeBankName');
  const payeeRouting = root.querySelector('#payeeRouting');
  const payeeAccountNumber = root.querySelector('#payeeAccountNumber');
  const payeeEmail = root.querySelector('#payeeEmail');
  const payeePhone = root.querySelector('#payeePhone');
  const payeeFormError = root.querySelector('#payeeFormError');
  const savePayeeBtn = root.querySelector('#savePayeeBtn');

  async function loadPayees() {
    payeesList.innerHTML = '<div class="text-center text-[13px] text-white/70 py-2">Loading...</div>';

    try {
      const user = await getCurrentUser();
      if (!user || !supabaseClient) {
        payeesList.innerHTML = '';
        return;
      }

      const { data, error } = await supabaseClient
        .from('payees')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (!data || data.length === 0) {
        payeesList.innerHTML = '<div class="bg-white dark:bg-[#0D1728] rounded-[16px] p-[16px] text-center text-[13px] text-[#6B7280] dark:text-[#8E9CBA]">No payees saved yet</div>';
        return;
      }

      payeesList.innerHTML = data.map((payee) => `
        <div class="bg-white dark:bg-[#0D1728] border border-transparent dark:border-white/[0.06] rounded-[16px] p-[14px] shadow-lg flex items-center justify-between">
          <div class="min-w-0">
            <div class="text-[14px] font-semibold text-[#111827] dark:text-white truncate">${payee.nickname || payee.full_name}</div>
            <div class="text-[12px] text-[#6B7280] dark:text-[#8E9CBA] truncate">${payee.bank_name} • ****${String(payee.account_number).slice(-4)}</div>
          </div>
          <button class="delete-payee-btn text-[12px] font-semibold text-[#EF4444] cursor-pointer flex-shrink-0 ml-[10px]" data-id="${payee.id}">Delete</button>
        </div>
      `).join('');

      payeesList.querySelectorAll('.delete-payee-btn').forEach((btn) => {
        on(btn, 'click', async () => {
          try {
            if (!supabaseClient) throw new Error('Supabase client not available');
            await supabaseClient.from('payees').delete().eq('id', btn.getAttribute('data-id'));
            await loadPayees();
          } catch (err) {
            console.error('Delete payee error:', err);
          }
        });
      });
    } catch (err) {
      console.error('Load payees error:', err);
      payeesList.innerHTML = '<div class="text-center text-[13px] text-white/70 py-2">Could not load payees.</div>';
    }
  }

  on(root.querySelector('[data-action="close"]'), 'click', close);
  on(addPayeeToggleBtn, 'click', () => addPayeeForm.classList.toggle('hidden'));

  on(savePayeeBtn, 'click', async () => {
    payeeFormError.classList.add('hidden');
    const name = payeeName.value.trim();
    const bank = payeeBankName.value.trim();
    const account = payeeAccountNumber.value.trim();

    if (!name || !bank || !account) {
      payeeFormError.textContent = 'Name, bank name, and account number are required.';
      payeeFormError.classList.remove('hidden');
      return;
    }

    savePayeeBtn.disabled = true;
    savePayeeBtn.textContent = 'Saving...';

    try {
      if (!supabaseClient) throw new Error('Supabase client not available');
      const user = await getCurrentUser();
      if (!user) throw new Error('Not signed in');

      const { error } = await supabaseClient.from('payees').insert({
        user_id: user.id,
        full_name: name,
        nickname: payeeNickname.value.trim() || null,
        bank_name: bank,
        routing_number: payeeRouting.value.trim(),
        account_number: account,
        email: payeeEmail.value.trim() || null,
        phone: payeePhone.value.trim() || null,
      });

      if (error) throw error;

      payeeName.value = '';
      payeeNickname.value = '';
      payeeBankName.value = '';
      payeeRouting.value = '';
      payeeAccountNumber.value = '';
      payeeEmail.value = '';
      payeePhone.value = '';
      savePayeeBtn.disabled = false;
      savePayeeBtn.textContent = 'Save Payee';
      addPayeeForm.classList.add('hidden');
      await loadPayees();
    } catch (err) {
      console.error('Save payee error:', err);
      savePayeeBtn.disabled = false;
      savePayeeBtn.textContent = 'Save Payee';
      payeeFormError.textContent = 'Could not save this payee. Please try again.';
      payeeFormError.classList.remove('hidden');
    }
  });

  loadPayees();
}

export function cleanup() {
  listeners.forEach(off => off());
  listeners = [];
}
