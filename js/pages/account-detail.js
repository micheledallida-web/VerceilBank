// Account Detail — opens from any account card on the dashboard shell
// (Checking, Savings, Investments, Credit). Expects the account `type` as
// the argument passed via loadPage('account-detail', type).

const accountConfigs = {
  checking: {
    title: 'Verceil Checking',
    balanceLabel: 'Available Balance',
    balanceSourceId: 'checkingBalance',
    iconBg: '#1D61F2',
    iconSvg: '<svg class="w-[26px] h-[26px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2"><rect x="3" y="6" width="18" height="12" rx="3"></rect><path d="M3 10h18"></path></svg>',
    number: '•4892',
  },
  interest_checking: {
    title: 'Vercel Interest Checking',
    balanceLabel: 'Available Balance · Up to 4.00% APY',
    balanceSourceId: 'interestCheckingBalance',
    iconBg: '#1D61F2',
    iconSvg: '<svg class="w-[26px] h-[26px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2"><rect x="3" y="6" width="18" height="12" rx="3"></rect><path d="M3 10h18"></path></svg>',
    number: '•2461',
  },
  savings: {
    title: 'High-Yield Savings',
    balanceLabel: 'Available Balance',
    balanceSourceId: 'savingsBalance',
    iconBg: '#10B981',
    iconSvg: '<svg class="w-[26px] h-[26px]" fill="currentColor" viewBox="0 0 24 24"><path d="M19.5 9.5c-0.7 0-1.3 0.3-1.8 0.7-1.2-1.3-2.9-2.2-4.7-2.2H11C8.2 8 6 10.2 6 13c0 0.8 0.2 1.5 0.5 2.2L5 17h3v1c0 0.6 0.4 1 1 1h2c0.6 0 1-0.4 1-1v-1h4v1c0 0.6 0.4 1 1 1h2c0.6 0 1-0.4 1-1v-1.2c1.8-1 3-2.9 3-5.1 0-1.8-1.5-3.3-3.5-3.3zM16 11c0.6 0 1 0.4 1 1s-0.4 1-1 1-1-0.4-1-1 0.4-1 1-1z"/></svg>',
    number: '•9104',
  },
  investments: {
    title: 'Investment Portfolio',
    balanceLabel: 'Total Value',
    balanceSourceId: 'investmentsBalance',
    iconBg: '#8B5CF6',
    iconSvg: '<svg class="w-[26px] h-[26px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path></svg>',
    number: '•7721',
  },
  credit: {
    title: 'Verceil Signature Card',
    balanceLabel: 'Account Status',
    balanceSourceId: null,
    iconBg: '#EF4444',
    iconSvg: '<svg class="w-[26px] h-[26px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2"><rect x="2" y="5" width="20" height="14" rx="3"></rect><path d="M2 10h20"></path><path d="M6 15h4"></path></svg>',
    number: 'Subject to credit approval',
    unapplied: true,
  },
};

let listeners = [];
function on(el, evt, fn) { el.addEventListener(evt, fn); listeners.push(() => el.removeEventListener(evt, fn)); }

export function init(root, ctx, type) {
  const { supabaseClient, getCurrentUser, getOrCreateTempNumber, loadPage, close } = ctx;

  const cfg = accountConfigs[type] || accountConfigs.checking;

  const detailAccountName = root.querySelector('#detailAccountName');
  const detailAccountIcon = root.querySelector('#detailAccountIcon');
  const detailAccountTitle = root.querySelector('#detailAccountTitle');
  const detailAccountNumber = root.querySelector('#detailAccountNumber');
  const detailAccountBalanceLabel = root.querySelector('#detailAccountBalanceLabel');
  const detailAccountBalance = root.querySelector('#detailAccountBalance');
  const detailRoutingSection = root.querySelector('#detailRoutingSection');
  const detailFullRoutingNumber = root.querySelector('#detailFullRoutingNumber');
  const detailFullAccountNumber = root.querySelector('#detailFullAccountNumber');
  const detailTransactionsSection = root.querySelector('#detailTransactionsSection');
  const detailTransactionsList = root.querySelector('#detailTransactionsList');

  on(root.querySelector('[data-action="close"]'), 'click', close);
  on(root.querySelector('#detailFundAccountBtn'), 'click', () => {
    loadPage('fund-account');
  });

  detailAccountName.textContent = cfg.title;
  detailAccountTitle.textContent = cfg.title;
  detailAccountIcon.style.background = cfg.iconBg;
  detailAccountIcon.innerHTML = cfg.iconSvg;
  detailAccountNumber.textContent = cfg.number;
  detailAccountBalanceLabel.textContent = cfg.balanceLabel;

  const balanceSourceEl = cfg.balanceSourceId ? document.getElementById(cfg.balanceSourceId) : null;
  detailAccountBalance.textContent = cfg.unapplied
    ? 'Apply'
    : (balanceSourceEl ? balanceSourceEl.textContent : '$0.00');

  function renderTransactions(transactions) {
    if (!transactions || transactions.length === 0) {
      detailTransactionsList.className = 'w-full bg-white dark:bg-[#0D1728] border border-transparent dark:border-white/[0.06] rounded-[20px] px-[16px] shadow-lg py-4';
      detailTransactionsList.innerHTML = '<div class="text-center text-[14px] text-[#6B7280] dark:text-[#8E9CBA] py-2">No recent activity</div>';
      return;
    }

    detailTransactionsList.className = 'w-full bg-white dark:bg-[#0D1728] border border-transparent dark:border-white/[0.06] rounded-[20px] px-[16px] shadow-lg divide-y divide-gray-100 dark:divide-white/[0.06]';
    detailTransactionsList.innerHTML = transactions.map(tx => {
      const isNegative = Number(tx.amount) < 0;
      const formattedAmount = `${isNegative ? '-' : '+'}$${Math.abs(Number(tx.amount)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      const amountColorClass = isNegative ? 'text-[#111827] dark:text-[#FFFFFF]' : 'text-[#16A34A] dark:text-[#22C55E]';
      return `
        <div class="flex items-center justify-between py-[14px]">
          <div class="flex items-center gap-[12px]">
            <div class="w-[40px] h-[40px] rounded-[12px] bg-emerald-100 dark:bg-[#10B981]/20 text-emerald-700 dark:text-[#10B981] flex items-center justify-center font-bold text-xs">
              ${tx.icon_text || '↓'}
            </div>
            <div>
              <div class="text-[15px] font-semibold text-[#111827] dark:text-[#FFFFFF] leading-tight">${tx.title}</div>
              <div class="text-[12px] font-normal text-[#6B7280] dark:text-[#8E9CBA] mt-0.5">${tx.date_info}</div>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <div class="text-[15px] font-semibold ${amountColorClass}">${formattedAmount}</div>
            <svg class="w-[14px] h-[14px] text-gray-400 dark:text-[#52607D]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
          </div>
        </div>
      `;
    }).join('');
  }

  async function loadTransactions() {
    detailTransactionsList.className = 'w-full bg-white dark:bg-[#0D1728] border border-transparent dark:border-white/[0.06] rounded-[20px] px-[16px] shadow-lg py-4';
    detailTransactionsList.innerHTML = '<div class="text-center text-[14px] text-[#6B7280] dark:text-[#8E9CBA] py-2">Loading...</div>';

    if (!supabaseClient) {
      renderTransactions([]);
      return;
    }

    try {
      const user = await getCurrentUser();
      if (!user) {
        renderTransactions([]);
        return;
      }

      const { data: txData, error: txError } = await supabaseClient
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .eq('account_type', type)
        .order('created_at', { ascending: false });

      if (txError) {
        renderTransactions([]);
        return;
      }

      renderTransactions(txData);
    } catch (err) {
      console.error('Account transactions fetch error:', err);
      renderTransactions([]);
    }
  }

  if (cfg.unapplied) {
    detailRoutingSection.classList.add('hidden');
    detailTransactionsSection.classList.add('hidden');
  } else {
    detailFullRoutingNumber.textContent = getOrCreateTempNumber(type, 'routing');
    detailFullAccountNumber.textContent = getOrCreateTempNumber(type, 'account');
    detailRoutingSection.classList.remove('hidden');
    detailTransactionsSection.classList.remove('hidden');
    loadTransactions();
  }
}

export function cleanup() {
  listeners.forEach(off => off());
  listeners = [];
}
