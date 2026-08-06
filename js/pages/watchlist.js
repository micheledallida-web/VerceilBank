const categoryMeta = {
  stocks: { label: 'Stocks' },
  etfs: { label: 'ETFs' },
  mutual_funds: { label: 'Mutual Funds' },
  crypto: { label: 'Crypto' },
};

let listeners = [];
function on(el, evt, fn) {
  if (!el) return;
  el.addEventListener(evt, fn);
  listeners.push(() => el.removeEventListener(evt, fn));
}

export function init(root, ctx) {
  const { supabaseClient, getCurrentUser, formatCurrency, loadPage, showModal, close } = ctx;

  const watchlistMainStep = root.querySelector('#watchlistMainStep');
  const investmentDetailsStep = root.querySelector('#investmentDetailsStep');
  const wlSymbol = root.querySelector('#wlSymbol');
  const wlCategory = root.querySelector('#wlCategory');
  const wlName = root.querySelector('#wlName');
  const wlPrice = root.querySelector('#wlPrice');
  const wlAddError = root.querySelector('#wlAddError');
  const wlAddBtn = root.querySelector('#wlAddBtn');
  const watchlistItems = root.querySelector('#watchlistItems');
  const invDetailsSymbol = root.querySelector('#invDetailsSymbol');
  const invDetailsName = root.querySelector('#invDetailsName');
  const invDetailsPrice = root.querySelector('#invDetailsPrice');
  const invDetailsChange = root.querySelector('#invDetailsChange');
  const invDetailsHoldingRow = root.querySelector('#invDetailsHoldingRow');
  const invDetailsHoldingValue = root.querySelector('#invDetailsHoldingValue');

  let currentWatchlist = [];
  let currentHoldings = [];
  let activeWlCategory = 'all';
  let activeInvestment = null;

  function showWatchlistStep() {
    investmentDetailsStep.classList.add('hidden');
    watchlistMainStep.classList.remove('hidden');
  }

  function showInvestmentDetailsStep() {
    watchlistMainStep.classList.add('hidden');
    investmentDetailsStep.classList.remove('hidden');
  }

  function applyCategoryTabState(activeCat) {
    root.querySelectorAll('.wl-cat-tab').forEach(btn => {
      btn.classList.remove('bg-[#2563EB]', 'text-white', 'bg-white', 'dark:bg-[#0D1728]', 'text-[#111827]', 'dark:text-white');
      if (btn.getAttribute('data-cat') === activeCat) btn.classList.add('bg-[#2563EB]', 'text-white');
      else btn.classList.add('bg-white', 'dark:bg-[#0D1728]', 'text-[#111827]', 'dark:text-white');
    });
  }

  async function loadHoldings() {
    if (!supabaseClient) return [];
    try {
      const user = await getCurrentUser();
      if (!user) return [];
      const { data, error } = await supabaseClient
        .from('investment_portfolio')
        .select('*')
        .eq('user_id', user.id)
        .order('value', { ascending: false });
      if (error) throw error;
      return data || [];
    } catch (e) {
      console.error('Load holdings error:', e);
      return [];
    }
  }

  async function loadWatchlist() {
    if (!supabaseClient) return [];
    try {
      const user = await getCurrentUser();
      if (!user) return [];
      const { data, error } = await supabaseClient
        .from('watchlists')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    } catch (e) {
      console.error('Load watchlist error:', e);
      return [];
    }
  }

  function renderWatchlist() {
    const filtered = activeWlCategory === 'all'
      ? currentWatchlist
      : currentWatchlist.filter(item => item.category === activeWlCategory);

    if (!filtered.length) {
      watchlistItems.innerHTML = '<div class="bg-white dark:bg-[#0D1728] border border-transparent dark:border-white/[0.06] rounded-[20px] px-[16px] shadow-lg py-4"><div class="text-center text-[14px] text-[#6B7280] dark:text-[#8E9CBA] py-2">Nothing here yet. Add a symbol above.</div></div>';
      return;
    }

    watchlistItems.innerHTML = filtered.map(item => {
      const price = Number(item.reference_price || 0);
      return `
        <div class="w-full bg-white dark:bg-[#0D1728] border border-transparent dark:border-white/[0.06] rounded-[18px] p-[14px] shadow-lg">
          <div class="flex items-center justify-between">
            <button class="min-w-0 text-left cursor-pointer wl-view-details" data-id="${item.id}">
              <div class="text-[15px] font-bold text-[#111827] dark:text-white">${item.symbol}</div>
              <div class="text-[12px] text-[#6B7280] dark:text-[#8E9CBA] truncate">${item.name || ''}</div>
            </button>
            <div class="text-right flex-shrink-0">
              <div class="text-[15px] font-bold text-[#111827] dark:text-white">${price > 0 ? formatCurrency(price) : '—'}</div>
              <div class="text-[11px] text-[#6B7280] dark:text-[#8E9CBA]">${categoryMeta[item.category]?.label || item.category || '—'}</div>
            </div>
          </div>
          <div class="flex gap-[8px] mt-[10px]">
            <button class="wl-buy flex-1 h-[36px] rounded-[10px] bg-[#2563EB] text-white text-[12px] font-semibold cursor-pointer" data-id="${item.id}">Buy</button>
            <button class="wl-sell flex-1 h-[36px] rounded-[10px] bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-[#111827] dark:text-white text-[12px] font-semibold cursor-pointer" data-id="${item.id}">Sell</button>
            <button class="wl-remove flex-1 h-[36px] rounded-[10px] bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-[#EF4444] text-[12px] font-semibold cursor-pointer" data-id="${item.id}">Remove</button>
          </div>
        </div>
      `;
    }).join('');

    watchlistItems.querySelectorAll('.wl-view-details').forEach(el => {
      on(el, 'click', async () => {
        const item = currentWatchlist.find(entry => String(entry.id) === el.getAttribute('data-id'));
        if (item) await openInvestmentDetails(item);
      });
    });

    watchlistItems.querySelectorAll('.wl-buy').forEach(btn => {
      on(btn, 'click', () => {
        const item = currentWatchlist.find(entry => String(entry.id) === btn.getAttribute('data-id'));
        if (item) loadPage('trade', 'buy', { symbol: item.symbol, name: item.name, price: item.reference_price });
      });
    });

    watchlistItems.querySelectorAll('.wl-sell').forEach(btn => {
      on(btn, 'click', () => {
        const item = currentWatchlist.find(entry => String(entry.id) === btn.getAttribute('data-id'));
        if (item) loadPage('trade', 'sell', { symbol: item.symbol, name: item.name, price: item.reference_price });
      });
    });

    watchlistItems.querySelectorAll('.wl-remove').forEach(btn => {
      on(btn, 'click', async () => {
        try {
          if (!supabaseClient) throw new Error('Supabase client not available');
          await supabaseClient.from('watchlists').delete().eq('id', btn.getAttribute('data-id'));
          currentWatchlist = currentWatchlist.filter(entry => String(entry.id) !== btn.getAttribute('data-id'));
          renderWatchlist();
        } catch (e) {
          console.error('Remove watchlist item error:', e);
        }
      });
    });
  }

  async function openInvestmentDetails(item) {
    activeInvestment = {
      symbol: item.symbol,
      name: item.name || item.symbol,
      price: Number(item.reference_price || 0),
      category: item.category || 'stocks',
    };
    invDetailsSymbol.textContent = activeInvestment.symbol;
    invDetailsName.textContent = activeInvestment.name;
    invDetailsPrice.textContent = activeInvestment.price > 0 ? formatCurrency(activeInvestment.price) : 'No reference price set';
    invDetailsChange.textContent = '';

    currentHoldings = await loadHoldings();
    const held = currentHoldings.find(holding => (holding.symbol || '').toUpperCase() === activeInvestment.symbol.toUpperCase());
    if (held) {
      invDetailsHoldingValue.textContent = `${held.shares} shares · ${formatCurrency(held.value)}`;
      invDetailsHoldingRow.classList.remove('hidden');
    } else {
      invDetailsHoldingRow.classList.add('hidden');
    }

    showInvestmentDetailsStep();
  }

  async function refreshWatchlist() {
    watchlistItems.innerHTML = '<div class="text-center text-[13px] text-white/70 py-4">Loading...</div>';
    currentWatchlist = await loadWatchlist();
    renderWatchlist();
  }

  on(root.querySelector('[data-action="close"]'), 'click', close);
  on(root.querySelector('[data-action="back-to-watchlist"]'), 'click', showWatchlistStep);

  root.querySelectorAll('.wl-cat-tab').forEach(btn => {
    on(btn, 'click', () => {
      activeWlCategory = btn.getAttribute('data-cat') || 'all';
      applyCategoryTabState(activeWlCategory);
      renderWatchlist();
    });
  });
  applyCategoryTabState(activeWlCategory);

  on(wlAddBtn, 'click', async () => {
    const symbol = wlSymbol.value.trim().toUpperCase();
    const name = wlName.value.trim();
    const category = wlCategory.value;
    const price = parseFloat(wlPrice.value) || 0;

    wlAddError.classList.add('hidden');
    if (!symbol) {
      wlAddError.textContent = 'Please enter a symbol.';
      wlAddError.classList.remove('hidden');
      return;
    }
    if (!supabaseClient) {
      wlAddError.textContent = 'Watchlist services are unavailable right now.';
      wlAddError.classList.remove('hidden');
      return;
    }

    wlAddBtn.disabled = true;
    wlAddBtn.textContent = 'Adding...';
    try {
      const user = await getCurrentUser();
      if (!user) throw new Error('Not signed in');
      const { error } = await supabaseClient.from('watchlists').insert({
        user_id: user.id,
        symbol,
        name: name || symbol,
        category,
        reference_price: price,
      });
      if (error) throw error;
      wlSymbol.value = '';
      wlName.value = '';
      wlPrice.value = '';
      wlAddBtn.disabled = false;
      wlAddBtn.textContent = 'Add to Watchlist';
      await refreshWatchlist();
    } catch (e) {
      console.error('Add to watchlist error:', e);
      wlAddBtn.disabled = false;
      wlAddBtn.textContent = 'Add to Watchlist';
      wlAddError.textContent = 'Could not add this symbol right now. Please try again.';
      wlAddError.classList.remove('hidden');
    }
  });

  on(root.querySelector('#invDetailsBuyBtn'), 'click', () => {
    if (!activeInvestment) return;
    loadPage('trade', 'buy', activeInvestment);
  });
  on(root.querySelector('#invDetailsSellBtn'), 'click', () => {
    if (!activeInvestment) return;
    loadPage('trade', 'sell', activeInvestment);
  });
  on(root.querySelector('#invDetailsWatchBtn'), 'click', async () => {
    if (!activeInvestment) return;
    try {
      if (!supabaseClient) throw new Error('Supabase client not available');
      const user = await getCurrentUser();
      if (!user) throw new Error('Not signed in');
      await supabaseClient.from('watchlists').insert({
        user_id: user.id,
        symbol: activeInvestment.symbol,
        name: activeInvestment.name,
        category: activeInvestment.category,
        reference_price: activeInvestment.price,
      });
      showModal('Added to Watchlist', `${activeInvestment.symbol} was added to your watchlist.`);
      await refreshWatchlist();
    } catch (e) {
      console.error('Add to watchlist from details error:', e);
      showModal('Could Not Add', 'This symbol could not be added to your watchlist right now.');
    }
  });
  on(root.querySelector('#invDetailsAlertBtn'), 'click', () => {
    showModal('Set Price Alert', 'Price alerts are coming soon.');
  });

  showWatchlistStep();
  refreshWatchlist();
}

export function cleanup() {
  listeners.forEach(off => off());
  listeners = [];
}
