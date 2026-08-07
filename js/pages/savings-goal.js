// Savings Goal — High-Yield Savings "Savings Goal" quick action. Lets a
// user create and track goals against the same `financial_goals` table used
// by Wealth Insights, tagged with goal_type 'Savings Goal' so they stay
// scoped to this account without duplicating data models.

const GOAL_TYPE = 'Savings Goal';

let listeners = [];
function on(el, evt, fn) {
  if (!el) return;
  el.addEventListener(evt, fn);
  listeners.push(() => el.removeEventListener(evt, fn));
}

export async function init(root, ctx) {
  const { supabaseClient, getCurrentUser, formatCurrency, showModal, close } = ctx;

  const sgGoalsList = root.querySelector('#sgGoalsList');
  const sgGoalAddForm = root.querySelector('#sgGoalAddForm');
  const sgGoalName = root.querySelector('#sgGoalName');
  const sgGoalTarget = root.querySelector('#sgGoalTarget');
  const sgGoalCurrent = root.querySelector('#sgGoalCurrent');
  const sgGoalDate = root.querySelector('#sgGoalDate');
  const sgGoalError = root.querySelector('#sgGoalError');
  const sgSaveGoalBtn = root.querySelector('#sgSaveGoalBtn');

  on(root.querySelector('[data-action="close"]'), 'click', close);
  on(root.querySelector('#sgAddGoalBtn'), 'click', () => sgGoalAddForm.classList.toggle('hidden'));

  function renderGoals(goals) {
    if (!goals.length) {
      sgGoalsList.innerHTML = '<div class="bg-white dark:bg-[#0D1728] border border-transparent dark:border-white/[0.06] rounded-[20px] px-[16px] shadow-lg py-4"><div class="text-center text-[14px] text-[#6B7280] dark:text-[#8E9CBA] py-2">No savings goals yet. Tap "+ New Goal" to start tracking one.</div></div>';
      return;
    }

    sgGoalsList.innerHTML = goals.map(goal => {
      const pct = goal.target_amount > 0 ? Math.min(100, (Number(goal.current_amount || 0) / Number(goal.target_amount)) * 100) : 0;
      return `
        <div class="bg-white dark:bg-[#0D1728] border border-transparent dark:border-white/[0.06] rounded-[20px] p-[16px] shadow-lg">
          <div class="flex items-center justify-between mb-[6px]">
            <span class="text-[14px] font-bold text-[#111827] dark:text-white">${goal.goal_name || 'Savings Goal'}</span>
            <span class="text-[12px] text-[#6B7280] dark:text-[#8E9CBA]">${formatCurrency(goal.current_amount || 0)} / ${formatCurrency(goal.target_amount)}</span>
          </div>
          <div class="w-full h-[8px] rounded-full bg-gray-100 dark:bg-white/10 overflow-hidden mb-[6px]"><div class="h-full bg-[#2563EB] rounded-full" style="width:${pct}%;"></div></div>
          <div class="text-[11px] text-[#6B7280] dark:text-[#8E9CBA]">${goal.target_date ? `Target date: ${goal.target_date}` : 'No target date set'}</div>
        </div>
      `;
    }).join('');
  }

  async function loadGoals() {
    if (!supabaseClient) return [];
    try {
      const user = await getCurrentUser();
      if (!user) return [];
      const { data, error } = await supabaseClient
        .from('financial_goals')
        .select('*')
        .eq('user_id', user.id)
        .eq('goal_type', GOAL_TYPE)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    } catch (e) {
      console.error('Load savings goals error:', e);
      return [];
    }
  }

  on(sgSaveGoalBtn, 'click', async () => {
    const target = parseFloat(sgGoalTarget.value);

    sgGoalError.classList.add('hidden');
    if (!target || target <= 0) {
      sgGoalError.textContent = 'Please enter a valid target amount.';
      sgGoalError.classList.remove('hidden');
      return;
    }
    if (!supabaseClient) {
      sgGoalError.textContent = 'Goal tracking is unavailable right now.';
      sgGoalError.classList.remove('hidden');
      return;
    }

    sgSaveGoalBtn.disabled = true;
    sgSaveGoalBtn.textContent = 'Saving...';
    try {
      const user = await getCurrentUser();
      if (!user) throw new Error('Not signed in');
      const { error } = await supabaseClient.from('financial_goals').insert({
        user_id: user.id,
        goal_type: GOAL_TYPE,
        goal_name: sgGoalName.value.trim() || 'Savings Goal',
        target_amount: target,
        current_amount: parseFloat(sgGoalCurrent.value) || 0,
        target_date: sgGoalDate.value || null,
      });
      if (error) throw error;
      sgGoalName.value = '';
      sgGoalTarget.value = '';
      sgGoalCurrent.value = '';
      sgGoalDate.value = '';
      sgGoalAddForm.classList.add('hidden');
      renderGoals(await loadGoals());
      showModal('Goal Saved', 'Your savings goal has been saved.');
    } catch (e) {
      console.error('Save savings goal error:', e);
      sgGoalError.textContent = 'Could not save this goal right now. Please try again.';
      sgGoalError.classList.remove('hidden');
    } finally {
      sgSaveGoalBtn.disabled = false;
      sgSaveGoalBtn.textContent = 'Save Goal';
    }
  });

  renderGoals(await loadGoals().catch(() => []));
}

export function cleanup() {
  listeners.forEach((off) => off());
  listeners = [];
}
