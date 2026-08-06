let listeners = [];
let currentHistoryFilter = 'all';
let currentTransactions = [];

function on(el, evt, fn) { if (!el) return; el.addEventListener(evt, fn); listeners.push(() => el.removeEventListener(evt, fn)); }

export function init(root, ctx) {
  const { supabaseClient, getCurrentUser, formatCurrency, showModal, close } = ctx;

  const listStep = root.querySelector('#paymentHistoryListStep');
  const detailStep = root.querySelector('#paymentHistoryDetailStep');
  const historyList = root.querySelector('#historyList');
  const filterButtons = root.querySelectorAll('.history-filter-btn');
  const txDetailsCard = root.querySelector('#txDetailsCard');

  function updateFilterStyles(activeFilter) {
    filterButtons.forEach((btn) => {
      const active = btn.getAttribute('data-filter') === activeFilter;
      btn.className = `history-filter-btn flex-shrink-0 h-[34px] px-[14px] rounded-full text-[12px] font-semibold cursor-pointer ${active ? 'bg-white text-[#111827]' : 'bg-white/15 text-white'}`;
    });
  }

  function showListStep() {
    detailStep.classList.add('hidden');
    listStep.classList.remove('hidden');
  }

  function openTransactionDetails(tx) {
    const rows = [
      ['Type', tx.type],
      ['Confirmation Number', tx.ref || '—'],
      ['Date', new Date(tx.date).toLocaleDateString()],
      ['Time', new Date(tx.date).toLocaleTimeString()],
      ['Recipient', tx.label || '—'],
      ['Amount', formatCurrency(tx.amount || 0)],
      ['Status', tx.status || 'completed'],
      ['Memo', tx.raw && tx.raw.memo ? tx.raw.memo : '—'],
      ['Funding Account', 'Verceil Checking'],
    ];

    txDetailsCard.innerHTML = rows.map(([label, value]) => `
      <div class="flex items-center justify-between py-[12px]">
        <span class="text-[13px] text-[#6B7280] dark:text-[#8E9CBA]">${label}</span>
        <span class="text-[14px] font-semibold text-[#111827] dark:text-white text-right">${value}</span>
      </div>
    `).join('');

    listStep.classList.add('hidden');
    detailStep.classList.remove('hidden');
  }

  async function loadPaymentHistory() {
    historyList.innerHTML = '<div class="text-center text-[13px] text-white/70 py-2">Loading...</div>';

    try {
      const user = await getCurrentUser();
      if (!user || !supabaseClient) {
        historyList.innerHTML = '';
        return;
      }

      currentTransactions = [];
      const requests = [];
      if (currentHistoryFilter === 'all' || currentHistoryFilter === 'zelle') {
        requests.push(supabaseClient.from('payments').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).then(({ data }) => {
          (data || []).forEach((row) => currentTransactions.push({ type: 'Zelle', label: row.recipient_name, amount: row.amount, status: row.status, ref: row.confirmation_number, date: row.created_at, raw: row }));
        }));
      }
      if (currentHistoryFilter === 'all' || currentHistoryFilter === 'bills') {
        requests.push(supabaseClient.from('bill_payments').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).then(({ data }) => {
          (data || []).forEach((row) => currentTransactions.push({ type: 'Bill', label: 'Bill Payment', amount: row.amount, status: row.status, ref: row.confirmation_number, date: row.created_at, raw: row }));
        }));
      }
      if (currentHistoryFilter === 'all' || currentHistoryFilter === 'transfers') {
        requests.push(supabaseClient.from('transfers').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).then(({ data }) => {
          (data || []).forEach((row) => currentTransactions.push({ type: 'Transfer', label: `${row.from_account} → ${row.to_account}`, amount: row.amount, status: row.status, ref: row.id, date: row.created_at, raw: row }));
        }));
        requests.push(supabaseClient.from('external_transfers').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).then(({ data }) => {
          (data || []).forEach((row) => currentTransactions.push({ type: 'External Transfer', label: 'External Account', amount: row.amount, status: row.status, ref: row.id, date: row.created_at, raw: row }));
        }));
      }
      if (currentHistoryFilter === 'all' || currentHistoryFilter === 'wires') {
        requests.push(supabaseClient.from('wire_transfers').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).then(({ data }) => {
          (data || []).forEach((row) => currentTransactions.push({ type: 'Wire', label: row.recipient_name, amount: row.amount, status: row.status, ref: row.id, date: row.created_at, raw: row }));
        }));
      }
      if (currentHistoryFilter === 'all' || currentHistoryFilter === 'deposits') {
        requests.push(supabaseClient.from('card_deposits').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).then(({ data }) => {
          (data || []).forEach((row) => currentTransactions.push({ type: 'Deposit', label: `Card ending ${row.last4}`, amount: row.amount, status: row.status, ref: row.id, date: row.created_at, raw: row }));
        }));
      }

      await Promise.all(requests);
      currentTransactions.sort((a, b) => new Date(b.date) - new Date(a.date));

      if (currentTransactions.length === 0) {
        historyList.innerHTML = '<div class="bg-white dark:bg-[#0D1728] rounded-[16px] p-[16px] text-center text-[13px] text-[#6B7280] dark:text-[#8E9CBA]">No transactions yet</div>';
        return;
      }

      historyList.innerHTML = currentTransactions.map((tx, idx) => `
        <button class="history-row w-full bg-white dark:bg-[#0D1728] border border-transparent dark:border-white/[0.06] rounded-[16px] p-[14px] shadow-lg flex items-center justify-between cursor-pointer text-left" data-idx="${idx}">
          <div class="min-w-0">
            <div class="text-[14px] font-semibold text-[#111827] dark:text-white truncate">${tx.label || tx.type}</div>
            <div class="text-[12px] text-[#6B7280] dark:text-[#8E9CBA]">${tx.type} • ${new Date(tx.date).toLocaleDateString()}</div>
          </div>
          <div class="text-right flex-shrink-0 ml-[10px]">
            <div class="text-[14px] font-bold text-[#111827] dark:text-white">${formatCurrency(tx.amount || 0)}</div>
            <div class="text-[11px] text-[#16A34A] dark:text-[#22C55E] capitalize">${tx.status || 'completed'}</div>
          </div>
        </button>
      `).join('');

      historyList.querySelectorAll('.history-row').forEach((row) => {
        on(row, 'click', () => openTransactionDetails(currentTransactions[parseInt(row.getAttribute('data-idx'), 10)]));
      });
    } catch (err) {
      console.error('Load payment history error:', err);
      historyList.innerHTML = '<div class="text-center text-[13px] text-white/70 py-2">Could not load payment history.</div>';
    }
  }

  on(root.querySelector('[data-action="close"]'), 'click', close);
  on(root.querySelector('[data-action="back-to-history"]'), 'click', showListStep);
  on(root.querySelector('#txDetailsDownloadBtn'), 'click', () => showModal('Download PDF', 'PDF receipt download is coming soon.'));
  on(root.querySelector('#txDetailsShareBtn'), 'click', () => showModal('Share', 'Receipt sharing is coming soon.'));

  filterButtons.forEach((btn) => {
    on(btn, 'click', () => {
      currentHistoryFilter = btn.getAttribute('data-filter');
      updateFilterStyles(currentHistoryFilter);
      showListStep();
      loadPaymentHistory();
    });
  });

  updateFilterStyles(currentHistoryFilter);
  loadPaymentHistory();
}

export function cleanup() {
  listeners.forEach(off => off());
  listeners = [];
  currentHistoryFilter = 'all';
  currentTransactions = [];
}
