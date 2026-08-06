let listeners = [];
function on(el, evt, fn) { if (!el) return; el.addEventListener(evt, fn); listeners.push(() => el.removeEventListener(evt, fn)); }

export function init(root, ctx) {
  const { supabaseClient, getCurrentUser, showModal, close } = ctx;
  const travelError = root.querySelector('#travelError');
  const travelSubmitBtn = root.querySelector('#travelSubmitBtn');

  on(root.querySelector('[data-action="close"]'), 'click', close);
  on(travelSubmitBtn, 'click', async () => {
    travelError.classList.add('hidden');
    const destination = root.querySelector('#travelDestination').value.trim();
    const departure = root.querySelector('#travelDeparture').value;
    const ret = root.querySelector('#travelReturn').value;
    if (!destination || !departure || !ret) {
      travelError.textContent = 'Please fill in destination and travel dates.';
      travelError.classList.remove('hidden');
      return;
    }
    travelSubmitBtn.disabled = true;
    travelSubmitBtn.textContent = 'Activating...';
    try {
      if (!supabaseClient) throw new Error('Supabase client not available');
      const user = await getCurrentUser();
      if (!user) throw new Error('Not signed in');
      const cards = [
        root.querySelector('#travelCardDebit').checked ? 'Debit' : null,
        root.querySelector('#travelCardCredit').checked ? 'Credit' : null,
      ].filter(Boolean);
      const { error } = await supabaseClient.from('travel_notifications').insert({
        user_id: user.id,
        destination,
        departure_date: departure,
        return_date: ret,
        cards_traveling: cards.join(', '),
        contact_phone: root.querySelector('#travelPhone').value.trim(),
        contact_email: root.querySelector('#travelEmail').value.trim(),
        international_enabled: root.querySelector('#travelIntl').checked,
        atm_abroad: root.querySelector('#travelAtm').checked,
        fraud_monitoring: root.querySelector('#travelFraud').checked,
        status: 'active',
      });
      if (error) throw error;
      close();
      showModal('Travel Notice Active', `Your travel to ${destination} (${departure} – ${ret}) is on file. International transactions are ${root.querySelector('#travelIntl').checked ? 'enabled' : 'disabled'} for this trip.`);
    } catch (e) {
      console.error('Travel notice error:', e);
      travelError.textContent = 'Could not save this travel notice right now.';
      travelError.classList.remove('hidden');
    } finally {
      travelSubmitBtn.disabled = false;
      travelSubmitBtn.textContent = 'Activate Travel Notice';
    }
  });
}

export function cleanup() {
  listeners.forEach(off => off());
  listeners = [];
}
