import { showReceipt } from '../shared/receipt.js';

let listeners = [];
let selectedBiller = null;

function on(el, evt, fn) { el.addEventListener(evt, fn); listeners.push(() => el.removeEventListener(evt, fn)); }

export function init(root, ctx) {
  const { supabaseClient, getCurrentUser, genRef, formatCurrency, parseBalanceText, close } = ctx;

  const addBillerToggleBtn = root.querySelector('#addBillerToggleBtn');
  const addBillerForm = root.querySelector('#addBillerForm');
  const billersList = root.querySelector('#billersList');
  const payBillForm = root.querySelector('#payBillForm');
  const payBillHeader = root.querySelector('#payBillHeader');
  const billerCompanyName = root.querySelector('#billerCompanyName');
  const billerAccountNumber = root.querySelector('#billerAccountNumber');
  const billerCategory = root.querySelector('#billerCategory');
  const billerNickname = root.querySelector('#billerNickname');
  const billerFormError = root.querySelector('#billerFormError');
  const saveBillerBtn = root.querySelector('#saveBillerBtn');
  const billPayAmount = root.querySelector('#billPayAmount');
  const billPayDate = root.querySelector('#billPayDate');
  const billPayMemo = root.querySelector('#billPayMemo');
  const billPayError = root.querySelector('#billPayError');
  const submitBillPayBtn = root.querySelector('#submitBillPayBtn');

  async function loadBillers() {
    billersList.innerHTML = '<div class="text-center text-[13px] text-white/70 py-2">Loading billers...</div>';

    try {
      const user = await getCurrentUser();
      if (!user || !supabaseClient) {
        billersList.innerHTML = '';
        return;
      }

      const { data, error } = await supabaseClient
        .from('billers')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (!data || data.length === 0) {
        billersList.innerHTML = '<div class="bg-white dark:bg-[#0D1728] rounded-[16px] p-[16px] text-center text-[13px] text-[#6B7280] dark:text-[#8E9CBA]">No saved billers yet</div>';
        return;
      }

      billersList.innerHTML = data.map((biller) => `
        <button class="biller-row w-full bg-white dark:bg-[#0D1728] border border-transparent dark:border-white/[0.06] rounded-[16px] p-[14px] shadow-lg flex items-center justify-between cursor-pointer text-left" data-id="${biller.id}" data-name="${biller.company_name}">
          <div class="min-w-0">
            <div class="text-[14px] font-semibold text-[#111827] dark:text-white truncate">${biller.nickname || biller.company_name}</div>
            <div class="text-[12px] text-[#6B7280] dark:text-[#8E9CBA]">${biller.category} • ****${String(biller.account_number).slice(-4)}</div>
          </div>
          <svg class="w-[16px] h-[16px] text-gray-400 dark:text-[#52607D] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
        </button>
      `).join('');

      billersList.querySelectorAll('.biller-row').forEach((row) => {
        on(row, 'click', () => {
          selectedBiller = { id: row.getAttribute('data-id'), name: row.getAttribute('data-name') };
          payBillHeader.textContent = `Pay ${selectedBiller.name}`;
          billPayAmount.value = '';
          billPayMemo.value = '';
          billPayDate.value = new Date().toISOString().slice(0, 10);
          billPayError.classList.add('hidden');
          addBillerForm.classList.add('hidden');
          payBillForm.classList.remove('hidden');
        });
      });
    } catch (err) {
      console.error('Load billers error:', err);
      billersList.innerHTML = '<div class="text-center text-[13px] text-white/70 py-2">Could not load billers.</div>';
    }
  }

  on(root.querySelector('[data-action="close"]'), 'click', close);
  on(addBillerToggleBtn, 'click', () => {
    addBillerForm.classList.toggle('hidden');
    payBillForm.classList.add('hidden');
  });

  on(saveBillerBtn, 'click', async () => {
    billerFormError.classList.add('hidden');
    const company = billerCompanyName.value.trim();
    const account = billerAccountNumber.value.trim();

    if (!company || !account) {
      billerFormError.textContent = 'Company name and account number are required.';
      billerFormError.classList.remove('hidden');
      return;
    }

    saveBillerBtn.disabled = true;
    saveBillerBtn.textContent = 'Saving...';

    try {
      if (!supabaseClient) throw new Error('Supabase client not available');
      const user = await getCurrentUser();
      if (!user) throw new Error('Not signed in');

      const { error } = await supabaseClient.from('billers').insert({
        user_id: user.id,
        company_name: company,
        account_number: account,
        category: billerCategory.value,
        nickname: billerNickname.value.trim() || null,
      });

      if (error) throw error;

      billerCompanyName.value = '';
      billerAccountNumber.value = '';
      billerNickname.value = '';
      saveBillerBtn.disabled = false;
      saveBillerBtn.textContent = 'Save Biller';
      addBillerForm.classList.add('hidden');
      await loadBillers();
    } catch (err) {
      console.error('Save biller error:', err);
      saveBillerBtn.disabled = false;
      saveBillerBtn.textContent = 'Save Biller';
      billerFormError.textContent = 'Could not save this biller. Please try again.';
      billerFormError.classList.remove('hidden');
    }
  });

  on(submitBillPayBtn, 'click', async () => {
    billPayError.classList.add('hidden');
    const amount = parseFloat(billPayAmount.value);

    if (!selectedBiller) return;
    if (!amount || amount <= 0) {
      billPayError.textContent = 'Please enter a valid amount.';
      billPayError.classList.remove('hidden');
      return;
    }

    const checkingEl = document.getElementById('checkingBalance');
    if (checkingEl && amount > parseBalanceText(checkingEl.textContent)) {
      billPayError.textContent = 'Insufficient funds in Verceil Checking.';
      billPayError.classList.remove('hidden');
      return;
    }

    submitBillPayBtn.disabled = true;
    submitBillPayBtn.textContent = 'Processing...';

    try {
      if (!supabaseClient) throw new Error('Supabase client not available');
      const user = await getCurrentUser();
      if (!user) throw new Error('Not signed in');
      const ref = genRef();

      const { error } = await supabaseClient.from('bill_payments').insert({
        user_id: user.id,
        biller_id: selectedBiller.id,
        amount,
        payment_date: billPayDate.value,
        memo: billPayMemo.value.trim(),
        status: 'scheduled',
        confirmation_number: ref,
      });

      if (error) throw error;

      if (checkingEl) {
        checkingEl.textContent = formatCurrency(parseBalanceText(checkingEl.textContent) - amount);
      }

      submitBillPayBtn.disabled = false;
      submitBillPayBtn.textContent = 'Submit Payment';
      close();
      showReceipt({ amount: formatCurrency(amount), recipient: selectedBiller.name, confirmation: ref });
    } catch (err) {
      console.error('Bill payment error:', err);
      submitBillPayBtn.disabled = false;
      submitBillPayBtn.textContent = 'Submit Payment';
      billPayError.textContent = 'This payment could not be submitted. Please try again.';
      billPayError.classList.remove('hidden');
    }
  });

  loadBillers();
}

export function cleanup() {
  listeners.forEach(off => off());
  listeners = [];
  selectedBiller = null;
}
