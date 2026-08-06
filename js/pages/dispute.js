let listeners = [];
function on(el, evt, fn) { if (!el) return; el.addEventListener(evt, fn); listeners.push(() => el.removeEventListener(evt, fn)); }

let selectedDisputeTx = null;

export function init(root, ctx) {
  const { supabaseClient, getCurrentUser, genRef, formatCurrency, showModal, close } = ctx;

  const formStep = root.querySelector('#disputeFormStep');
  const reviewStep = root.querySelector('#disputeReviewStep');
  const disputeTxList = root.querySelector('#disputeTxList');
  const disputeFormWrap = root.querySelector('#disputeFormWrap');
  const disputeSelectedTx = root.querySelector('#disputeSelectedTx');
  const disputeReason = root.querySelector('#disputeReason');
  const disputeDescription = root.querySelector('#disputeDescription');
  const disputeError = root.querySelector('#disputeError');
  const disputeReviewRows = root.querySelector('#disputeReviewRows');
  const disputeSubmitError = root.querySelector('#disputeSubmitError');

  async function loadRecentTransactionsForDispute() {
    if (!supabaseClient) return [];
    const user = await getCurrentUser();
    if (!user) return [];
    try {
      const { data } = await supabaseClient
        .from('payments')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(15);
      return (data || []).map(p => ({
        id: p.id,
        label: p.recipient_name,
        amount: p.amount,
        date: p.created_at,
      }));
    } catch (e) {
      console.error('Load tx for dispute error:', e);
      return [];
    }
  }

  async function renderTransactionList() {
    disputeFormWrap.classList.add('hidden');
    disputeTxList.innerHTML = '<div class="bg-white dark:bg-[#0D1728] border border-transparent dark:border-white/[0.06] rounded-[16px] px-[16px] shadow-lg py-4"><div class="text-center text-[13px] text-[#6B7280] dark:text-[#8E9CBA] py-2">Loading...</div></div>';
    const txs = await loadRecentTransactionsForDispute();
    if (txs.length === 0) {
      disputeTxList.innerHTML = '<div class="bg-white dark:bg-[#0D1728] border border-transparent dark:border-white/[0.06] rounded-[16px] px-[16px] shadow-lg py-4"><div class="text-center text-[13px] text-[#6B7280] dark:text-[#8E9CBA] py-2">No recent transactions found.</div></div>';
      return;
    }
    disputeTxList.innerHTML = txs.map(t => `
      <button class="dispute-tx-item w-full bg-white dark:bg-[#0D1728] border border-transparent dark:border-white/[0.06] rounded-[14px] p-[12px] shadow-lg flex items-center justify-between text-left cursor-pointer" data-id="${t.id}">
        <div><div class="text-[13px] font-semibold text-[#111827] dark:text-white">${t.label || 'Transaction'}</div><div class="text-[11px] text-[#6B7280] dark:text-[#8E9CBA]">${t.date ? new Date(t.date).toLocaleDateString() : ''}</div></div>
        <span class="text-[13px] font-bold text-[#111827] dark:text-white">${formatCurrency(t.amount || 0)}</span>
      </button>
    `).join('');
    root.querySelectorAll('.dispute-tx-item').forEach(btn => {
      on(btn, 'click', () => {
        selectedDisputeTx = txs.find(t => String(t.id) === btn.getAttribute('data-id')) || null;
        if (!selectedDisputeTx) return;
        disputeSelectedTx.textContent = `${selectedDisputeTx.label} — ${formatCurrency(selectedDisputeTx.amount)}`;
        disputeFormWrap.classList.remove('hidden');
      });
    });
  }

  on(root.querySelector('[data-action="close"]'), 'click', close);
  on(root.querySelector('[data-action="back-to-form"]'), 'click', () => {
    reviewStep.classList.add('hidden');
    formStep.classList.remove('hidden');
  });

  on(root.querySelector('#disputeReviewBtn'), 'click', () => {
    disputeError.classList.add('hidden');
    if (!selectedDisputeTx) {
      disputeError.textContent = 'Please select a transaction first.';
      disputeError.classList.remove('hidden');
      return;
    }
    if (!disputeDescription.value.trim()) {
      disputeError.textContent = 'Please describe what happened.';
      disputeError.classList.remove('hidden');
      return;
    }
    disputeReviewRows.innerHTML = `
      <div class="flex justify-between gap-[12px] py-[12px]"><span class="text-[13px] text-[#6B7280] dark:text-[#8E9CBA]">Transaction</span><span class="text-[14px] font-semibold text-[#111827] dark:text-white text-right">${selectedDisputeTx.label} — ${formatCurrency(selectedDisputeTx.amount)}</span></div>
      <div class="flex justify-between gap-[12px] py-[12px]"><span class="text-[13px] text-[#6B7280] dark:text-[#8E9CBA]">Reason</span><span class="text-[14px] font-semibold text-[#111827] dark:text-white text-right">${disputeReason.value}</span></div>
      <div class="flex justify-between gap-[12px] py-[12px]"><span class="text-[13px] text-[#6B7280] dark:text-[#8E9CBA]">Description</span><span class="text-[13px] text-[#111827] dark:text-white text-right max-w-[220px]">${disputeDescription.value.trim()}</span></div>
    `;
    formStep.classList.add('hidden');
    reviewStep.classList.remove('hidden');
  });

  on(root.querySelector('#disputeSubmitBtn'), 'click', async () => {
    disputeSubmitError.classList.add('hidden');
    try {
      if (!supabaseClient) throw new Error('Supabase client not available');
      const user = await getCurrentUser();
      if (!user) throw new Error('Not signed in');
      const caseNum = `CASE-${genRef()}`;
      const { error } = await supabaseClient.from('transaction_disputes').insert({
        user_id: user.id,
        transaction_id: selectedDisputeTx.id,
        reason: disputeReason.value,
        description: disputeDescription.value.trim(),
        status: 'submitted',
        case_number: caseNum,
      });
      if (error) throw error;
      disputeDescription.value = '';
      close();
      showModal('Dispute Submitted', `Case Number: ${caseNum}. Estimated resolution: 5–10 business days. You can track status under Payment History.`);
    } catch (e) {
      console.error('Submit dispute error:', e);
      disputeSubmitError.textContent = 'Could not submit this dispute right now.';
      disputeSubmitError.classList.remove('hidden');
    }
  });

  renderTransactionList();
}

export function cleanup() {
  listeners.forEach(off => off());
  listeners = [];
  selectedDisputeTx = null;
}
