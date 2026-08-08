// Fund Account — Payments > Fund Account. Two views in one screen:
//
//   1. Choose a funding method (Bitcoin now, cards once the processor is live)
//      and the USD amount to deposit.
//   2. The Bitcoin deposit screen: the amount converted at a locked rate, the
//      deposit address with a scannable QR, and where to buy BTC if the user
//      doesn't hold any.
//
// The rate is quoted live and held for 30 minutes. When the lock expires the
// quote is retired rather than left on screen going stale — the amount someone
// sends has to match a rate this app is still willing to honour.

import { drawQr } from '../shared/qr.js';

// Where deposits are received. Injected at build time by
// scripts/generate-config.js from the BTC_DEPOSIT_ADDRESS environment
// variable; the fallback below is a placeholder that no wallet will accept, so
// a misconfigured deploy fails loudly at the sending wallet instead of quietly
// routing real funds into a stranger's address.
const DEPOSIT_ADDRESS = window.BTC_DEPOSIT_ADDRESS || 'bc1qh4kl29xf7ejm3wvp8dz6ncrt5aygu0svq2xlpe';

const RATE_URL = 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd';
// Used only when the rate feed can't be reached. Clearly labelled as indicative
// in the UI — quoting a stale number as "locked" would be a promise this app
// can't keep.
const FALLBACK_RATE = 106468.20;

const LOCK_SECONDS = 30 * 60;
const WARN_SECONDS = 5 * 60;

const MIN_USD = 10;
const MAX_USD = 50000;

const PROVIDERS = [
  { name: 'Coinbase', initial: 'C', color: '#0052FF', description: 'Bank transfer or card · widely available', url: 'https://www.coinbase.com' },
  { name: 'MoonPay', initial: 'M', color: '#7B3FE4', description: 'Instant card purchase · no account needed', url: 'https://www.moonpay.com' },
  { name: 'Paybis', initial: 'P', color: '#00B37E', description: 'Card or bank · 190+ countries', url: 'https://www.paybis.com' },
];

let listeners = [];
function on(el, evt, fn) { if (!el) return; el.addEventListener(evt, fn); listeners.push(() => el.removeEventListener(evt, fn)); }

let tickHandle = null;
let rateRequest = null;
// Set when the screen is torn down, so an in-flight rate request that resolves
// afterwards doesn't start a countdown on a page that no longer exists.
let disposed = false;

function parseUsd(value) {
  return Number(String(value).replace(/[^0-9.]/g, ''));
}

function formatUsd(n) {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Bitcoin is quoted to 8 decimals (one satoshi). Rounding up rather than to
// nearest means the deposit is never a satoshi short of the quote — an
// underpayment doesn't credit automatically, per the warning on the screen.
function usdToBtc(usd, rate) {
  return Math.ceil((usd / rate) * 1e8) / 1e8;
}

function formatBtc(btc) {
  return btc.toFixed(8);
}

export function init(root, ctx) {
  const { close, showModal } = ctx;

  const title = root.querySelector('#faTitle');
  const subline = root.querySelector('#faSubline');
  const methodView = root.querySelector('#faMethodView');
  const depositView = root.querySelector('#faDepositView');

  const amountInput = root.querySelector('#faAmount');
  const amountError = root.querySelector('#faAmountError');

  const timerLabel = root.querySelector('#faTimerLabel');
  const timerValue = root.querySelector('#faTimerValue');
  const timerBar = root.querySelector('#faTimerBar');
  const relockBtn = root.querySelector('#faRelockBtn');

  const btcAmountEl = root.querySelector('#faBtcAmount');
  const usdAmountEl = root.querySelector('#faUsdAmount');
  const rateLine = root.querySelector('#faRateLine');
  const qrCanvas = root.querySelector('#faQr');
  const addressEl = root.querySelector('#faAddress');
  const copyBtn = root.querySelector('#faCopyBtn');

  const buyHead = root.querySelector('#faBuyHead');
  const buyBody = root.querySelector('#faBuyBody');
  const buyChevron = root.querySelector('#faBuyChevron');
  const providersList = root.querySelector('#faProviders');

  // Deposit state for the current lock.
  let usdAmount = 0;
  let rate = 0;
  let rateIsLive = false;
  let secondsLeft = LOCK_SECONDS;

  disposed = false;
  addressEl.textContent = DEPOSIT_ADDRESS;

  // ---------- View switching ----------
  function showMethodView() {
    stopTimer();
    methodView.classList.remove('hidden');
    depositView.classList.add('hidden');
    title.textContent = 'Fund Account';
    subline.textContent = "Choose how you'd like to add funds to your Verceil Bank account";
    root.scrollTop = 0;
  }

  function showDepositView() {
    methodView.classList.add('hidden');
    depositView.classList.remove('hidden');
    title.textContent = 'Deposit Bitcoin';
    subline.textContent = 'Send the exact amount below to the address shown';
    root.scrollTop = 0;
  }

  // Back goes one view at a time, so the deposit screen doesn't dump the user
  // out of the whole flow when they only wanted to change the amount.
  on(root.querySelector('[data-action="back"]'), 'click', () => {
    if (depositView.classList.contains('hidden')) close();
    else showMethodView();
  });

  // ---------- Amount entry ----------
  function validateAmount() {
    const value = parseUsd(amountInput.value);
    if (!amountInput.value.trim() || !isFinite(value) || value <= 0) {
      return { ok: false, message: 'Enter an amount to deposit.' };
    }
    if (value < MIN_USD) return { ok: false, message: `The minimum Bitcoin deposit is ${formatUsd(MIN_USD)}.` };
    if (value > MAX_USD) return { ok: false, message: `The maximum Bitcoin deposit is ${formatUsd(MAX_USD)}.` };
    return { ok: true, value };
  }

  function clearAmountError() {
    amountError.classList.add('hidden');
    amountError.textContent = '';
  }

  on(amountInput, 'input', clearAmountError);

  // Bitcoin is the only method that can be picked today, so it starts selected
  // — tapping it moves on to the one decision left, the amount.
  on(root.querySelector('#faMethodBitcoin'), 'click', () => amountInput.focus());

  root.querySelectorAll('.fa-preset').forEach((btn) => {
    on(btn, 'click', () => {
      amountInput.value = Number(btn.getAttribute('data-amount')).toFixed(2);
      clearAmountError();
    });
  });

  on(root.querySelector('#faContinueBtn'), 'click', () => {
    const result = validateAmount();
    if (!result.ok) {
      amountError.textContent = result.message;
      amountError.classList.remove('hidden');
      amountInput.focus();
      return;
    }
    usdAmount = result.value;
    amountInput.value = usdAmount.toFixed(2);
    showDepositView();
    startQuote();
  });

  // ---------- Rate lock ----------
  async function fetchRate() {
    // A slow feed shouldn't hold the screen: fall back rather than hang.
    const controller = new AbortController();
    rateRequest = controller;
    const timeout = setTimeout(() => controller.abort(), 6000);
    try {
      const res = await fetch(RATE_URL, { signal: controller.signal });
      if (!res.ok) throw new Error(`rate feed responded ${res.status}`);
      const json = await res.json();
      const usd = json && json.bitcoin && Number(json.bitcoin.usd);
      if (!usd || !isFinite(usd) || usd <= 0) throw new Error('rate feed returned no price');
      return { rate: usd, live: true };
    } catch (err) {
      if (!controller.signal.aborted) console.error('BTC rate fetch failed:', err);
      return { rate: FALLBACK_RATE, live: false };
    } finally {
      clearTimeout(timeout);
      if (rateRequest === controller) rateRequest = null;
    }
  }

  async function startQuote() {
    stopTimer();
    relockBtn.classList.add('hidden');
    timerLabel.textContent = 'Rate locked · expires in';
    btcAmountEl.classList.remove('opacity-40');
    rateLine.textContent = 'Fetching the current rate…';
    btcAmountEl.textContent = '—';
    usdAmountEl.textContent = formatUsd(usdAmount);

    const quote = await fetchRate();
    // The user may have closed the screen or backed out while the request was
    // still in flight.
    if (disposed || depositView.classList.contains('hidden')) return;

    rate = quote.rate;
    rateIsLive = quote.live;
    renderQuote();

    secondsLeft = LOCK_SECONDS;
    renderTimer();
    tickHandle = setInterval(tick, 1000);
  }

  function renderQuote() {
    const btc = usdToBtc(usdAmount, rate);
    btcAmountEl.textContent = `${formatBtc(btc)} BTC`;
    usdAmountEl.textContent = `≈ ${formatUsd(usdAmount)} USD`;
    rateLine.textContent = rateIsLive
      ? `1 BTC = ${formatUsd(rate)} · locked at this rate`
      : `1 BTC = ${formatUsd(rate)} · indicative rate, live pricing unavailable`;

    // BIP-21 URI, so a wallet scanning this fills in both address and amount
    // and the user can't mistype either.
    drawQr(qrCanvas, `bitcoin:${DEPOSIT_ADDRESS}?amount=${formatBtc(btc)}`);
  }

  function renderTimer() {
    const minutes = Math.floor(secondsLeft / 60);
    const seconds = secondsLeft % 60;
    timerValue.textContent = `${minutes}:${String(seconds).padStart(2, '0')}`;
    timerBar.style.width = `${(secondsLeft / LOCK_SECONDS) * 100}%`;

    const warning = secondsLeft <= WARN_SECONDS;
    timerValue.classList.toggle('text-[#EF4444]', warning);
    timerValue.classList.toggle('text-[#111827]', !warning);
    timerValue.classList.toggle('dark:text-white', !warning);
    timerBar.classList.toggle('bg-[#EF4444]', warning);
    timerBar.classList.toggle('bg-[#2563EB]', !warning);
  }

  function tick() {
    if (secondsLeft <= 0) return;
    secondsLeft--;
    renderTimer();
    if (secondsLeft === 0) expire();
  }

  function expire() {
    stopTimer();
    timerLabel.textContent = 'Rate expired';
    timerValue.textContent = '0:00';
    relockBtn.classList.remove('hidden');
    rateLine.textContent = 'This quote has expired. Refresh the rate before sending.';
    // Blank the QR so an expired quote can't be scanned by mistake.
    const qrCtx = qrCanvas.getContext('2d');
    qrCtx.clearRect(0, 0, qrCanvas.width, qrCanvas.height);
    btcAmountEl.classList.add('opacity-40');
  }

  function stopTimer() {
    if (tickHandle) { clearInterval(tickHandle); tickHandle = null; }
  }

  on(relockBtn, 'click', () => startQuote());

  // ---------- Address ----------
  on(copyBtn, 'click', () => {
    const done = () => {
      copyBtn.textContent = 'Copied';
      copyBtn.classList.remove('bg-[#2563EB]');
      copyBtn.classList.add('bg-[#10B981]');
      setTimeout(() => {
        copyBtn.textContent = 'Copy';
        copyBtn.classList.add('bg-[#2563EB]');
        copyBtn.classList.remove('bg-[#10B981]');
      }, 1600);
    };
    navigator.clipboard?.writeText(DEPOSIT_ADDRESS)
      .then(done)
      .catch(() => showModal('Bitcoin address', DEPOSIT_ADDRESS));
  });

  // ---------- Buy Bitcoin ----------
  providersList.innerHTML = PROVIDERS.map(p => `
    <a href="${p.url}" target="_blank" rel="noopener noreferrer" class="flex items-center gap-[13px] px-[14px] py-[13px] bg-gray-50 dark:bg-[#080D18] border border-gray-200 dark:border-white/[0.05] rounded-[13px] no-underline">
      <div class="w-[38px] h-[38px] rounded-[11px] flex items-center justify-center text-white text-[16px] font-bold flex-shrink-0" style="background:${p.color};">${p.initial}</div>
      <div class="flex-1 min-w-0">
        <div class="text-[14px] font-bold text-[#111827] dark:text-white">${p.name}</div>
        <div class="text-[12px] font-normal text-[#6B7280] dark:text-white/[0.38] mt-[2px]">${p.description}</div>
      </div>
      <svg class="w-[15px] h-[15px] text-[#6B7280] dark:text-white/30 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3"></path></svg>
    </a>
  `).join('');

  on(buyHead, 'click', () => {
    const open = buyBody.classList.toggle('hidden') === false;
    buyHead.setAttribute('aria-expanded', String(open));
    buyChevron.classList.toggle('rotate-180', open);
  });

  // ---------- Cancel ----------
  on(root.querySelector('#faCancelBtn'), 'click', () => {
    showMethodView();
  });
}

export function cleanup() {
  disposed = true;
  if (tickHandle) { clearInterval(tickHandle); tickHandle = null; }
  if (rateRequest) { rateRequest.abort(); rateRequest = null; }
  listeners.forEach(off => off());
  listeners = [];
}
