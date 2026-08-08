// Fund Account — Payments > Fund Account. Two screens in one view: choose a
// funding method (Screen 1), then the Bitcoin deposit details (Screen 2).
// Screen 2 is reachable only from Screen 1; opening the page always lands on
// Screen 1.

// ---------------------------------------------------------------------------
// PLACEHOLDER DEPOSIT DATA — AWAITING BACKEND WIRING.
//
// This repo has no deposit data source yet, so the address, amounts and locked
// rate are declared here instead of being scattered through the markup. When a
// backend exists, replace this object with the values it returns for the
// current deposit request; nothing else in this file reads these values from
// anywhere else.
//
// `lockMinutes` is how long a quote is held. The expiry itself is an absolute
// timestamp persisted under `expiryKey`, so a reload shows the real remaining
// time rather than a fresh countdown.
//
// NOTE: `address` is the placeholder from the design. Its bech32 checksum is
// invalid, so wallets refuse to send to it — replace it with a real receiving
// address as part of the backend wiring.
// ---------------------------------------------------------------------------
const DEPOSIT = {
  address: 'bc1qh4kl29xf7ejm3wvp8dz6ncrt5aygu0svq2xlpe',
  btcAmount: '0.00234814',
  usdAmount: '$250.00',
  rate: '$106,468.20',
  lockMinutes: 30,
  expiryKey: 'verceil_fund_deposit_expiry',
};

const WARN_MS = 5 * 60 * 1000;
const COPIED_MS = 1600;

let listeners = [];
function on(el, evt, fn) { if (!el) return; el.addEventListener(evt, fn); listeners.push(() => el.removeEventListener(evt, fn)); }

let tickHandle = null;
let copyHandle = null;

function lockDurationMs() {
  return DEPOSIT.lockMinutes * 60 * 1000;
}

// The countdown runs off an absolute timestamp so a reload can't hand someone
// a fresh 30 minutes on a quote that is nearly up.
function readExpiry() {
  let stored = null;
  try { stored = localStorage.getItem(DEPOSIT.expiryKey); } catch (err) {}
  const parsed = Number(stored);
  if (stored && isFinite(parsed) && parsed > 0) return parsed;
  return writeExpiry();
}

function writeExpiry() {
  const expiry = Date.now() + lockDurationMs();
  try { localStorage.setItem(DEPOSIT.expiryKey, String(expiry)); } catch (err) {}
  return expiry;
}

function clearExpiry() {
  try { localStorage.removeItem(DEPOSIT.expiryKey); } catch (err) {}
}

export function init(root, ctx) {
  const { close } = ctx;

  const backBtn = root.querySelector('[data-action="close"]');
  // The header markup is shared by both screens, so the title is the back
  // button's sibling rather than a screen-specific element.
  const titleEl = backBtn.nextElementSibling;

  const methodScreen = root.querySelector('#fundMethodScreen');
  const depositScreen = root.querySelector('#fundDepositScreen');

  const timerValue = root.querySelector('#fundTimerValue');
  const timerBar = root.querySelector('#fundTimerBar');

  const amountCard = root.querySelector('#fundAmountCard');
  const btcAmountEl = root.querySelector('#fundBtcAmount');
  const usdAmountEl = root.querySelector('#fundUsdAmount');
  const rateLineEl = root.querySelector('#fundRateLine');

  const qrCard = root.querySelector('#fundQrCard');
  const qrBox = root.querySelector('#fundQrBox');
  const qrHolder = root.querySelector('#fundQrHolder');
  const addressEl = root.querySelector('#fundAddress');
  const copyBtn = root.querySelector('#fundCopyBtn');

  const buy = root.querySelector('#fundBuy');
  const buyHead = root.querySelector('#fundBuyHead');

  const statusTitle = root.querySelector('#fundStatusTitle');
  const statusSub = root.querySelector('#fundStatusSub');

  const cancelBtn = root.querySelector('#fundCancelBtn');
  const restartBtn = root.querySelector('#fundRestartBtn');

  let expiry = 0;

  // ---------- Deposit details ----------
  // Everything on Screen 2 that carries a value comes from DEPOSIT, so the
  // markup holds no deposit literals.
  function renderDeposit() {
    btcAmountEl.textContent = `${DEPOSIT.btcAmount} BTC`;
    usdAmountEl.textContent = `≈ ${DEPOSIT.usdAmount} USD`;
    rateLineEl.textContent = `1 BTC = ${DEPOSIT.rate} · locked at this rate`;
    addressEl.textContent = DEPOSIT.address;
    renderQr();
  }

  // A QR that encodes nothing is worse than no QR at all, so if generation
  // fails for any reason the whole container is hidden and the text address
  // carries the screen on its own.
  function renderQr() {
    qrHolder.innerHTML = '';
    qrBox.classList.remove('fund-hidden');
    const uri = `bitcoin:${DEPOSIT.address}?amount=${DEPOSIT.btcAmount}`;
    try {
      if (typeof window.QRCode !== 'function') throw new Error('QR library unavailable');
      new window.QRCode(qrHolder, {
        text: uri,
        width: 180,
        height: 180,
        colorDark: '#000000',
        colorLight: '#ffffff',
        correctLevel: window.QRCode.CorrectLevel.M,
      });
      if (!qrHolder.querySelector('canvas, img, table, svg')) throw new Error('QR renderer produced nothing');
    } catch (err) {
      console.error('Deposit QR could not be generated:', err);
      qrHolder.innerHTML = '';
      qrBox.classList.add('fund-hidden');
    }
  }

  // ---------- Countdown ----------
  function renderTimer() {
    const remaining = Math.max(0, expiry - Date.now());
    if (remaining <= 0) {
      expire();
      return;
    }

    const seconds = Math.ceil(remaining / 1000);
    const minutes = Math.floor(seconds / 60);
    timerValue.textContent = `${minutes}:${String(seconds % 60).padStart(2, '0')}`;

    const pct = Math.max(0, Math.min(100, (remaining / lockDurationMs()) * 100));
    timerBar.style.width = `${pct}%`;

    const warning = remaining <= WARN_MS;
    timerValue.classList.toggle('fund-warn', warning);
    timerBar.classList.toggle('fund-warn', warning);
  }

  function startTimer() {
    stopTimer();
    renderTimer();
    if (expiry - Date.now() > 0) tickHandle = setInterval(renderTimer, 1000);
  }

  function stopTimer() {
    if (tickHandle) { clearInterval(tickHandle); tickHandle = null; }
  }

  function expire() {
    stopTimer();
    timerValue.textContent = 'Expired';
    timerValue.classList.add('fund-warn');
    timerBar.classList.add('fund-warn');
    timerBar.style.width = '0%';
    amountCard.classList.add('fund-dim');
    qrCard.classList.add('fund-dim');
    statusTitle.textContent = 'This deposit request expired';
    statusSub.classList.add('fund-hidden');
    cancelBtn.classList.add('fund-hidden');
    restartBtn.classList.remove('fund-hidden');
  }

  function revive() {
    timerValue.classList.remove('fund-warn');
    timerBar.classList.remove('fund-warn');
    amountCard.classList.remove('fund-dim');
    qrCard.classList.remove('fund-dim');
    statusTitle.textContent = 'Awaiting your payment';
    statusSub.classList.remove('fund-hidden');
    cancelBtn.classList.remove('fund-hidden');
    restartBtn.classList.add('fund-hidden');
  }

  // ---------- Screens ----------
  function showMethodScreen() {
    stopTimer();
    depositScreen.classList.remove('fund-screen-active');
    methodScreen.classList.add('fund-screen-active');
    titleEl.textContent = 'Fund Account';
    root.scrollTop = 0;
  }

  function showDepositScreen() {
    methodScreen.classList.remove('fund-screen-active');
    depositScreen.classList.add('fund-screen-active');
    titleEl.textContent = 'Deposit Bitcoin';
    root.scrollTop = 0;

    expiry = readExpiry();
    if (expiry - Date.now() > 0) revive();
    renderDeposit();
    startTimer();
  }

  // On Screen 2 the back arrow steps back to the method chooser; on Screen 1
  // it closes the page as it always has.
  on(backBtn, 'click', () => {
    if (depositScreen.classList.contains('fund-screen-active')) showMethodScreen();
    else close();
  });

  on(root.querySelector('#fundMethodBitcoin'), 'click', showDepositScreen);
  on(cancelBtn, 'click', showMethodScreen);

  on(restartBtn, 'click', () => {
    clearExpiry();
    expiry = writeExpiry();
    revive();
    renderDeposit();
    startTimer();
  });

  // ---------- Address ----------
  function markCopied() {
    copyBtn.textContent = 'Copied';
    copyBtn.classList.add('fund-done');
    if (copyHandle) clearTimeout(copyHandle);
    copyHandle = setTimeout(() => {
      copyBtn.textContent = 'Copy';
      copyBtn.classList.remove('fund-done');
      copyHandle = null;
    }, COPIED_MS);
  }

  // No clipboard API (older or non-secure contexts): select the address so it
  // can be copied by hand.
  function selectAddress() {
    const range = document.createRange();
    range.selectNodeContents(addressEl);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  }

  on(copyBtn, 'click', () => {
    if (!navigator.clipboard) {
      selectAddress();
      return;
    }
    navigator.clipboard.writeText(DEPOSIT.address).then(markCopied).catch(selectAddress);
  });

  // ---------- Buy Bitcoin ----------
  on(buyHead, 'click', () => {
    buy.classList.toggle('fund-open');
  });
}

export function cleanup() {
  if (tickHandle) { clearInterval(tickHandle); tickHandle = null; }
  if (copyHandle) { clearTimeout(copyHandle); copyHandle = null; }
  listeners.forEach(off => off());
  listeners = [];
}
