let listeners = [];
let currentSchedTab = 'upcoming';

function on(el, evt, fn) { if (!el) return; el.addEventListener(evt, fn); listeners.push(() => el.removeEventListener(evt, fn)); }

export function init(root, ctx) {
  const { supabaseClient, getCurrentUser, formatCurrency, close } = ctx;

  const scheduledList = root.querySelector('#scheduledList');
  const addScheduledToggleBtn = root.querySelector('#addScheduledToggleBtn');
  const addScheduledForm = root.querySelector('#addScheduledForm');
  const schedRecipient = root.querySelector('#schedRecipient');
  const schedAmount = root.querySelector('#schedAmount');
  const schedStartDate = root.querySelector('#schedStartDate');
  const schedEndDate = root.querySelector('#schedEndDate');
  const schedFrequency = root.querySelector('#schedFrequency');
  const schedFormError = root.querySelector('#schedFormError');
  const saveScheduledBtn = root.querySelector('#saveScheduledBtn');
  const tabButtons = root.querySelectorAll('.sched-tab-btn');

  function updateTabStyles(activeTab) {
    tabButtons.forEach((btn) => {
      const active = btn.getAttribute('data-tab') === activeTab;
      btn.className = `sched-tab-btn flex-1 h-[38px] rounded-[12px] text-[13px] font-semibold cursor-pointer ${active ? 'bg-white text-[#111827]' : 'bg-white/15 text-white'}`;
    });
  }

  async function loadScheduledPayments() {
    scheduledList.innerHTML = '<div class="text-center text-[13px] text-white/70 py-2">Loading...</div>';

    try {
      const user = await getCurrentUser();
      if (!user || !supabaseClient) {
        scheduledList.innerHTML = '';
        return;
      }

      let query = supabaseClient.from('scheduled_payments').select('*').eq('user_id', user.id);
      if (currentSchedTab === 'completed') query = query.eq('status', 'completed');
      else if (currentSchedTab === 'recurring') query = query.neq('frequency', 'One-time').eq('status', 'active');
      else query = query.eq('status', 'active');

      const { data, error } = await query.order('start_date', { ascending: true });
      if (error) throw error;

      if (!data || data.length === 0) {
        scheduledList.innerHTML = '<div class="bg-white dark:bg-[#0D1728] rounded-[16px] p-[16px] text-center text-[13px] text-[#6B7280] dark:text-[#8E9CBA]">Nothing here yet</div>';
        return;
      }

      scheduledList.innerHTML = data.map((payment) => `
        <div class="bg-white dark:bg-[#0D1728] border border-transparent dark:border-white/[0.06] rounded-[16px] p-[14px] shadow-lg">
          <div class="flex items-center justify-between mb-[6px]">
            <div class="text-[14px] font-semibold text-[#111827] dark:text-white">${payment.recipient}</div>
            <div class="text-[14px] font-bold text-[#111827] dark:text-white">${formatCurrency(payment.amount)}</div>
          </div>
          <div class="text-[12px] text-[#6B7280] dark:text-[#8E9CBA] mb-[10px]">${payment.frequency} • Starts ${payment.start_date}</div>
          <div class="flex gap-[8px]">
            <button class="sched-action-btn flex-1 h-[34px] rounded-[10px] bg-gray-50 dark:bg-white/5 text-[12px] font-semibold text-[#111827] dark:text-white cursor-pointer" data-id="${payment.id}" data-action="pause">${payment.status === 'paused' ? 'Resume' : 'Pause'}</button>
            <button class="sched-action-btn flex-1 h-[34px] rounded-[10px] bg-gray-50 dark:bg-white/5 text-[12px] font-semibold text-[#EF4444] cursor-pointer" data-id="${payment.id}" data-action="cancel">Cancel</button>
          </div>
        </div>
      `).join('');

      scheduledList.querySelectorAll('.sched-action-btn').forEach((btn) => {
        on(btn, 'click', async () => {
          const id = btn.getAttribute('data-id');
          const action = btn.getAttribute('data-action');
          const newStatus = action === 'cancel' ? 'cancelled' : (btn.textContent === 'Resume' ? 'active' : 'paused');
          try {
            if (!supabaseClient) throw new Error('Supabase client not available');
            await supabaseClient.from('scheduled_payments').update({ status: newStatus }).eq('id', id);
            await loadScheduledPayments();
          } catch (err) {
            console.error('Scheduled payment update error:', err);
          }
        });
      });
    } catch (err) {
      console.error('Load scheduled payments error:', err);
      scheduledList.innerHTML = '<div class="text-center text-[13px] text-white/70 py-2">Could not load scheduled payments.</div>';
    }
  }

  on(root.querySelector('[data-action="close"]'), 'click', close);
  on(addScheduledToggleBtn, 'click', () => addScheduledForm.classList.toggle('hidden'));

  tabButtons.forEach((btn) => {
    on(btn, 'click', () => {
      currentSchedTab = btn.getAttribute('data-tab');
      updateTabStyles(currentSchedTab);
      loadScheduledPayments();
    });
  });

  on(saveScheduledBtn, 'click', async () => {
    schedFormError.classList.add('hidden');
    const recipient = schedRecipient.value.trim();
    const amount = parseFloat(schedAmount.value);

    if (!recipient) {
      schedFormError.textContent = 'Please enter a biller or recipient.';
      schedFormError.classList.remove('hidden');
      return;
    }
    if (!amount || amount <= 0) {
      schedFormError.textContent = 'Please enter a valid amount.';
      schedFormError.classList.remove('hidden');
      return;
    }
    if (!schedStartDate.value) {
      schedFormError.textContent = 'Please choose a start date.';
      schedFormError.classList.remove('hidden');
      return;
    }

    saveScheduledBtn.disabled = true;
    saveScheduledBtn.textContent = 'Saving...';

    try {
      if (!supabaseClient) throw new Error('Supabase client not available');
      const user = await getCurrentUser();
      if (!user) throw new Error('Not signed in');

      const { error } = await supabaseClient.from('scheduled_payments').insert({
        user_id: user.id,
        recipient,
        amount,
        start_date: schedStartDate.value,
        end_date: schedEndDate.value || null,
        frequency: schedFrequency.value,
        status: 'active',
      });

      if (error) throw error;

      schedRecipient.value = '';
      schedAmount.value = '';
      schedStartDate.value = '';
      schedEndDate.value = '';
      saveScheduledBtn.disabled = false;
      saveScheduledBtn.textContent = 'Save Scheduled Payment';
      addScheduledForm.classList.add('hidden');
      await loadScheduledPayments();
    } catch (err) {
      console.error('Save scheduled payment error:', err);
      saveScheduledBtn.disabled = false;
      saveScheduledBtn.textContent = 'Save Scheduled Payment';
      schedFormError.textContent = 'Could not save this scheduled payment. Please try again.';
      schedFormError.classList.remove('hidden');
    }
  });

  updateTabStyles(currentSchedTab);
  loadScheduledPayments();
}

export function cleanup() {
  listeners.forEach(off => off());
  listeners = [];
  currentSchedTab = 'upcoming';
}
