let listeners = [];

function on(el, evt, fn) {
  if (!el) return;
  el.addEventListener(evt, fn);
  listeners.push(() => el.removeEventListener(evt, fn));
}

export async function init(root, ctx) {
  const { close, loadPage, parseBalanceText, formatCurrency, showModal, supabaseClient, getCurrentUser } = ctx;
  on(root.querySelector('[data-action="close"]'), 'click', close);

  const checking = parseBalanceText(document.getElementById('checkingBalance')?.textContent || '0');
  const savings = parseBalanceText(document.getElementById('savingsBalance')?.textContent || '0');
  const investments = parseBalanceText(document.getElementById('investmentsBalance')?.textContent || '0');
  root.querySelector('#asTotalDeposits').textContent = formatCurrency(checking + savings);
  root.querySelector('#asTotalInvestments').textContent = formatCurrency(investments);
  root.querySelector('#asAvailableCash').textContent = formatCurrency(checking + savings);

  let creditBalance = 0;
  try {
    const user = await getCurrentUser();
    if (user && supabaseClient) {
      const { data: creditAccount } = await supabaseClient.from('accounts').select('*').eq('user_id', user.id).eq('account_type', 'credit').maybeSingle();
      creditBalance = Number(creditAccount?.balance || 0);
    }
  } catch (err) {
    console.error(err);
  }
  root.querySelector('#asCreditBalance').textContent = formatCurrency(creditBalance);

  root.querySelector('#asAccountsList').innerHTML = `
    <button class="as-acct-row w-full bg-white dark:bg-[#0D1728] border border-transparent dark:border-white/[0.06] rounded-[16px] p-[14px] shadow-lg flex items-center justify-between text-left cursor-pointer" data-acct="checking"><span class="text-[13px] font-semibold text-[#111827] dark:text-white">Verceil Checking</span><span class="text-[14px] font-bold text-[#111827] dark:text-white">${formatCurrency(checking)}</span></button>
    <button class="as-acct-row w-full bg-white dark:bg-[#0D1728] border border-transparent dark:border-white/[0.06] rounded-[16px] p-[14px] shadow-lg flex items-center justify-between text-left cursor-pointer" data-acct="savings"><span class="text-[13px] font-semibold text-[#111827] dark:text-white">High-Yield Savings</span><span class="text-[14px] font-bold text-[#111827] dark:text-white">${formatCurrency(savings)}</span></button>
    <button class="as-acct-row w-full bg-white dark:bg-[#0D1728] border border-transparent dark:border-white/[0.06] rounded-[16px] p-[14px] shadow-lg flex items-center justify-between text-left cursor-pointer" data-acct="investments"><span class="text-[13px] font-semibold text-[#111827] dark:text-white">Investment Portfolio</span><span class="text-[14px] font-bold text-[#111827] dark:text-white">${formatCurrency(investments)}</span></button>
    <button class="as-acct-row w-full bg-white dark:bg-[#0D1728] border border-transparent dark:border-white/[0.06] rounded-[16px] p-[14px] shadow-lg flex items-center justify-between text-left cursor-pointer" data-acct="credit"><span class="text-[13px] font-semibold text-[#111827] dark:text-white">Verceil Signature Card</span><span class="text-[13px] font-semibold text-[#6B7280] dark:text-[#8E9CBA]">Apply</span></button>
  `;

  root.querySelectorAll('.as-acct-row').forEach((btn) => on(btn, 'click', () => loadPage('account-detail', btn.getAttribute('data-acct'))));
  on(root.querySelector('#asQuickTransfer'), 'click', () => loadPage('transfer'));
  on(root.querySelector('#asQuickDeposit'), 'click', () => loadPage('fund-account'));
  on(root.querySelector('#asQuickStatements'), 'click', () => loadPage('docs-hub'));
  on(root.querySelector('#asQuickPayBills'), 'click', () => showModal('Pay Bills', 'Opening Pay Bills...'));

  const activity = root.querySelector('#asRecentActivity');
  const user = await getCurrentUser();
  if (!user || !supabaseClient) {
    activity.innerHTML = '<div class="bg-white dark:bg-[#0D1728] border border-transparent dark:border-white/[0.06] rounded-[14px] px-[16px] py-3 shadow-lg text-center text-[12px] text-[#6B7280] dark:text-[#8E9CBA]">No recent activity.</div>';
    return;
  }

  try {
    const [{ data: pays }, { data: transfersData }] = await Promise.all([
      supabaseClient.from('payments').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(10),
      supabaseClient.from('transfers').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(10),
    ]);

    const combined = [
      ...(pays || []).map((payment) => ({ label: payment.recipient_name, amount: -Math.abs(Number(payment.amount || 0)), date: payment.created_at })),
      ...(transfersData || []).map((transfer) => ({ label: `Transfer: ${transfer.from_account} → ${transfer.to_account}`, amount: 0, date: transfer.created_at })),
    ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 10);

    activity.innerHTML = combined.length ? combined.map((entry) => `
      <div class="w-full bg-white dark:bg-[#0D1728] border border-transparent dark:border-white/[0.06] rounded-[14px] p-[12px] shadow-lg flex items-center justify-between">
        <div><div class="text-[13px] font-semibold text-[#111827] dark:text-white">${entry.label}</div><div class="text-[11px] text-[#6B7280] dark:text-[#8E9CBA]">${new Date(entry.date).toLocaleDateString()}</div></div>
        ${entry.amount !== 0 ? `<span class="text-[13px] font-bold ${entry.amount < 0 ? 'text-[#111827] dark:text-white' : 'text-[#16A34A]'}">${entry.amount < 0 ? '-' : '+'}${formatCurrency(Math.abs(entry.amount))}</span>` : ''}
      </div>
    `).join('') : '<div class="bg-white dark:bg-[#0D1728] border border-transparent dark:border-white/[0.06] rounded-[14px] px-[16px] py-3 shadow-lg text-center text-[12px] text-[#6B7280] dark:text-[#8E9CBA]">No recent activity.</div>';
  } catch (err) {
    console.error(err);
    activity.innerHTML = '';
  }
}

export function cleanup() {
  listeners.forEach((off) => off());
  listeners = [];
}
