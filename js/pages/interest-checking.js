// Interest Checking — dashboard promo card "Get Started" flow. Two-step,
// in-dashboard experience: benefits overview -> Open Interest Checking ->
// premium confirmation. On approval the new account is added to the
// Accounts section and Account Summary via the shared `accounts` table
// (account_type: 'interest_checking'), same as every other account card.

const benefits = [
  'Up to 4.00% APY',
  'No monthly maintenance fees',
  'FDIC insured',
  'Mobile check deposit',
  'Zelle® transfers',
  'Early direct deposit',
];

let listeners = [];
function on(el, evt, fn) { if (!el) return; el.addEventListener(evt, fn); listeners.push(() => el.removeEventListener(evt, fn)); }

// Reveals the Interest Checking account card on the always-present dashboard
// shell and hides the promo banner now that the account has been opened.
function revealDashboardAccount(formatCurrency, balance) {
  const section = document.getElementById('sectionInterestChecking');
  const promo = document.getElementById('promoBanner');
  const balanceEl = document.getElementById('interestCheckingBalance');
  if (balanceEl) balanceEl.textContent = formatCurrency(balance);
  if (section) section.classList.remove('hidden');
  if (promo) promo.classList.add('hidden');
}

export function init(root, ctx) {
  const { close, loadPage, showModal, supabaseClient, getCurrentUser, genRef, formatCurrency } = ctx;

  const offerStep = root.querySelector('#icOfferStep');
  const confirmStep = root.querySelector('#icConfirmStep');
  const benefitsList = root.querySelector('#icBenefitsList');
  const openAccountBtn = root.querySelector('#icOpenAccountBtn');

  benefitsList.innerHTML = benefits.map((label, idx) => `
    <div class="flex items-center gap-[12px] px-[10px] py-[12px]${idx > 0 ? ' border-t border-gray-100 dark:border-white/[0.06]' : ''}">
      <span class="w-[22px] h-[22px] rounded-full bg-[#EFF6FF] dark:bg-[#1D61F2]/20 flex items-center justify-center flex-shrink-0">
        <svg class="w-[13px] h-[13px] text-[#2563EB] dark:text-[#3B82F6]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
      </span>
      <span class="text-[14px] font-medium text-[#111827] dark:text-white">${label}</span>
    </div>
  `).join('');

  on(root.querySelector('[data-action="close"]'), 'click', close);
  on(root.querySelector('#icTransferFundsBtn'), 'click', () => loadPage('transfer'));
  on(root.querySelector('#icLearnMoreBtn'), 'click', () => {
    showModal('Vercel Interest Checking', 'Earn up to 4.00% APY with no monthly maintenance fees, FDIC insurance, mobile check deposit, Zelle® transfers, and early direct deposit — all with no minimum balance required.');
  });

  on(openAccountBtn, 'click', async () => {
    openAccountBtn.disabled = true;
    openAccountBtn.textContent = 'Opening Account...';

    const confirmationNumber = genRef();
    const initialBalance = 0;

    try {
      if (supabaseClient) {
        const user = await getCurrentUser();
        if (user) {
          await supabaseClient.from('accounts').upsert({
            user_id: user.id,
            account_type: 'interest_checking',
            balance: initialBalance,
            status: 'approved',
          }, { onConflict: 'user_id,account_type' });
        }
      }
    } catch (err) {
      console.error('Open Interest Checking error:', err);
    }

    try {
      localStorage.setItem('verceil_interest_checking_opened', '1');
      localStorage.setItem('verceil_interest_checking_balance', String(initialBalance));
    } catch (err) {}

    root.querySelector('#icConfirmationNumber').textContent = confirmationNumber;
    root.querySelector('#icInitialBalance').textContent = formatCurrency(initialBalance);

    revealDashboardAccount(formatCurrency, initialBalance);

    openAccountBtn.disabled = false;
    openAccountBtn.textContent = 'Open Interest Checking';

    offerStep.classList.add('hidden');
    confirmStep.classList.remove('hidden');
  });

  on(root.querySelector('#icViewAccountBtn'), 'click', () => loadPage('account-detail', 'interest_checking'));
  on(root.querySelector('#icReturnToDashboardBtn'), 'click', close);
}

export function cleanup() {
  listeners.forEach(off => off());
  listeners = [];
}
