let listeners = [];
function on(el, evt, fn) { if (!el) return; el.addEventListener(evt, fn); listeners.push(() => el.removeEventListener(evt, fn)); }

let activeCardServiceType = 'debit';
let cardControlsState = { atm: true, online: true, international: false, contactless: true, locked: false };

function paintCardTabs(root) {
  root.querySelectorAll('.card-select-tab').forEach(btn => {
    const active = btn.getAttribute('data-card') === activeCardServiceType;
    btn.classList.toggle('bg-[#2563EB]', active);
    btn.classList.toggle('text-white', active);
    btn.classList.toggle('bg-white', !active);
    btn.classList.toggle('dark:bg-[#0D1728]', !active);
    btn.classList.toggle('text-[#111827]', !active);
    btn.classList.toggle('dark:text-white', !active);
  });
}

function paintCardControls(root) {
  root.querySelectorAll('.control-toggle').forEach(btn => {
    const key = btn.getAttribute('data-control');
    const enabled = !!cardControlsState[key];
    btn.classList.toggle('bg-[#2563EB]', enabled);
    btn.classList.toggle('bg-gray-200', !enabled);
    btn.classList.toggle('dark:bg-white/10', !enabled);
    btn.querySelector('.control-thumb').style.left = enabled ? '23px' : '3px';
  });
  const lockThumb = root.querySelector('#cardLockThumb');
  const lockToggle = root.querySelector('#cardLockToggle');
  lockThumb.style.transform = cardControlsState.locked ? 'translateX(22px)' : 'translateX(0)';
  lockToggle.classList.toggle('bg-[#DC2626]', cardControlsState.locked);
  lockToggle.classList.toggle('bg-gray-200', !cardControlsState.locked);
  lockToggle.classList.toggle('dark:bg-white/10', !cardControlsState.locked);
}

export function init(root, ctx) {
  const { supabaseClient, getCurrentUser, showModal, close } = ctx;

  async function saveCardSettings() {
    try {
      if (!supabaseClient) return;
      const user = await getCurrentUser();
      if (!user) return;
      await supabaseClient.from('card_settings').upsert({
        user_id: user.id,
        card_type: activeCardServiceType,
        ...cardControlsState,
      }, { onConflict: 'user_id,card_type' });
    } catch (e) {
      console.error('Save card settings error:', e);
    }
  }

  async function loadCardSettings() {
    try {
      if (!supabaseClient) {
        cardControlsState = { atm: true, online: true, international: false, contactless: true, locked: false };
      } else {
        const user = await getCurrentUser();
        if (!user) {
          cardControlsState = { atm: true, online: true, international: false, contactless: true, locked: false };
        } else {
          const { data } = await supabaseClient
            .from('card_settings')
            .select('*')
            .eq('user_id', user.id)
            .eq('card_type', activeCardServiceType)
            .maybeSingle();
          cardControlsState = data
            ? {
                atm: !!data.atm,
                online: !!data.online,
                international: !!data.international,
                contactless: !!data.contactless,
                locked: !!data.locked,
              }
            : { atm: true, online: true, international: false, contactless: true, locked: false };
        }
      }
    } catch (e) {
      console.error('Load card settings error:', e);
      cardControlsState = { atm: true, online: true, international: false, contactless: true, locked: false };
    }
    paintCardTabs(root);
    paintCardControls(root);
  }

  on(root.querySelector('[data-action="close"]'), 'click', close);

  root.querySelectorAll('.card-select-tab').forEach(btn => {
    on(btn, 'click', async () => {
      activeCardServiceType = btn.getAttribute('data-card') || 'debit';
      paintCardTabs(root);
      await loadCardSettings();
    });
  });

  on(root.querySelector('#cardLockToggle'), 'click', async () => {
    cardControlsState.locked = !cardControlsState.locked;
    paintCardControls(root);
    await saveCardSettings();
    showModal(cardControlsState.locked ? 'Card Locked' : 'Card Unlocked', cardControlsState.locked ? 'This card is temporarily blocked from new transactions.' : 'This card can be used normally again.');
  });

  root.querySelectorAll('.control-toggle').forEach(btn => {
    on(btn, 'click', async () => {
      const key = btn.getAttribute('data-control');
      cardControlsState[key] = !cardControlsState[key];
      paintCardControls(root);
      await saveCardSettings();
    });
  });

  root.querySelectorAll('.card-mgmt-btn').forEach(btn => {
    on(btn, 'click', () => {
      const action = btn.getAttribute('data-action');
      showModal(action, `${action} will be handled by a card specialist. This flow is coming soon.`);
    });
  });

  paintCardTabs(root);
  loadCardSettings();
}

export function cleanup() {
  listeners.forEach(off => off());
  listeners = [];
  activeCardServiceType = 'debit';
  cardControlsState = { atm: true, online: true, international: false, contactless: true, locked: false };
}
