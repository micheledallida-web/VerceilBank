// Fund Account — Payments > Fund Account. Lets a user choose a funding
// provider (Bitcoin on/off-ramps or a debit card processor) to add money to
// their Verceil Bank account. Ported from the legacy single-file dashboard.

const fundProviders = [
  {
    name: 'Coinbase',
    initial: 'C',
    color: '#1652F0',
    category: 'Bitcoin',
    badgeBg: 'rgba(22,82,240,0.12)',
    badgeColor: '#1652F0',
    description: 'Buy Bitcoin securely with Coinbase',
    buttonLabel: 'Go to Coinbase',
    url: 'https://www.coinbase.com',
  },
  {
    name: 'MoonPay',
    initial: 'M',
    color: '#7B2FF7',
    category: 'Bitcoin',
    badgeBg: 'rgba(123,47,247,0.12)',
    badgeColor: '#7B2FF7',
    description: 'Buy Bitcoin instantly with MoonPay',
    buttonLabel: 'Go to MoonPay',
    url: 'https://www.moonpay.com',
  },
  {
    name: 'Paybis',
    initial: 'P',
    color: '#00B894',
    category: 'Bitcoin',
    badgeBg: 'rgba(0,184,148,0.12)',
    badgeColor: '#00B894',
    description: 'Buy Bitcoin easily with Paybis',
    buttonLabel: 'Go to Paybis',
    url: 'https://www.paybis.com',
  },
  {
    name: 'Debit Card',
    initial: 'D',
    color: '#635BFF',
    category: 'Card',
    badgeBg: 'rgba(99,91,255,0.12)',
    badgeColor: '#635BFF',
    description: 'Use your debit card to add funds instantly via Stripe',
    buttonLabel: 'Pay with Stripe',
    url: 'https://stripe.com',
  },
];

let listeners = [];
function on(el, evt, fn) { el.addEventListener(evt, fn); listeners.push(() => el.removeEventListener(evt, fn)); }

export function init(root, ctx) {
  const { close } = ctx;

  const fundProvidersList = root.querySelector('#fundProvidersList');

  on(root.querySelector('[data-action="close"]'), 'click', close);

  fundProvidersList.innerHTML = fundProviders.map((p, idx) => `
    <div class="w-full bg-white dark:bg-[#0D1728] border border-transparent dark:border-white/[0.06] rounded-[22px] p-[18px] shadow-lg">
      <div class="flex items-start gap-[14px]">
        <div class="w-[48px] h-[48px] rounded-[16px] flex items-center justify-center text-white flex-shrink-0" style="background:${p.color};">
          <span class="text-[18px] font-bold">${p.initial}</span>
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-[8px] flex-wrap">
            <div class="text-[16px] font-bold text-[#111827] dark:text-white">${p.name}</div>
            <span class="text-[10px] font-bold uppercase tracking-wide px-[8px] py-[2px] rounded-full flex-shrink-0" style="background:${p.badgeBg};color:${p.badgeColor};">${p.category}</span>
          </div>
          <div class="text-[13px] font-normal text-[#6B7280] dark:text-[#8E9CBA] mt-[4px]">${p.description}</div>
        </div>
      </div>
      <button class="fund-action-btn w-full mt-[14px] h-[44px] rounded-[14px] bg-[#2563EB] text-white text-[14px] font-semibold flex items-center justify-center gap-[6px] cursor-pointer hover:opacity-90 transition-all" data-index="${idx}">
        <span>${p.buttonLabel}</span>
        <svg class="w-[16px] h-[16px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
      </button>
    </div>
  `).join('');

  fundProvidersList.querySelectorAll('.fund-action-btn').forEach(btn => {
    on(btn, 'click', () => {
      const provider = fundProviders[parseInt(btn.getAttribute('data-index'), 10)];
      window.open(provider.url, '_blank', 'noopener,noreferrer');
    });
  });
}

export function cleanup() {
  listeners.forEach(off => off());
  listeners = [];
}
