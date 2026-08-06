let listeners = [];
function on(el, evt, fn) { if (!el) return; el.addEventListener(evt, fn); listeners.push(() => el.removeEventListener(evt, fn)); }

export function init(root, ctx) {
  const { supabaseClient, getCurrentUser, genRef, showModal, close } = ctx;
  const reportCardError = root.querySelector('#reportCardError');

  async function submitCardReport(permanent) {
    reportCardError.classList.add('hidden');
    try {
      if (!supabaseClient) throw new Error('Supabase client not available');
      const user = await getCurrentUser();
      if (!user) throw new Error('Not signed in');
      const ref = genRef();
      const { error } = await supabaseClient.from('card_reports').insert({
        user_id: user.id,
        card_type: root.querySelector('#reportCardType').value,
        reason: root.querySelector('#reportReason').value,
        replacement_option: root.querySelector('#reportReplacement').value,
        permanent_block: permanent,
        status: 'blocked',
        reference_number: ref,
      });
      if (error) throw error;
      close();
      showModal('Card Successfully Blocked', `Reference: ${ref}. Replacement: ${root.querySelector('#reportReplacement').value}. Your card can no longer be used for new transactions.`);
    } catch (e) {
      console.error('Card report error:', e);
      reportCardError.textContent = 'Could not process this report right now.';
      reportCardError.classList.remove('hidden');
    }
  }

  on(root.querySelector('[data-action="close"]'), 'click', close);
  on(root.querySelector('#lockNowBtn'), 'click', () => submitCardReport(false));
  on(root.querySelector('#blockPermanentBtn'), 'click', () => submitCardReport(true));
}

export function cleanup() {
  listeners.forEach(off => off());
  listeners = [];
}
