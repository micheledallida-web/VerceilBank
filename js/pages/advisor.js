let listeners = [];
function on(el, evt, fn) {
  if (!el) return;
  el.addEventListener(evt, fn);
  listeners.push(() => el.removeEventListener(evt, fn));
}

export function init(root, ctx) {
  const { supabaseClient, getCurrentUser, genRef, showModal, loadPage, close } = ctx;

  const apptMeetingType = root.querySelector('#apptMeetingType');
  const apptTopic = root.querySelector('#apptTopic');
  const apptDate = root.querySelector('#apptDate');
  const apptTime = root.querySelector('#apptTime');
  const apptNotes = root.querySelector('#apptNotes');
  const apptError = root.querySelector('#apptError');
  const apptScheduleBtn = root.querySelector('#apptScheduleBtn');
  const apptUpcomingList = root.querySelector('#apptUpcomingList');
  const advisorMessagesList = root.querySelector('#advisorMessagesList');
  const advisorMessageInput = root.querySelector('#advisorMessageInput');
  const advisorSendMessageBtn = root.querySelector('#advisorSendMessageBtn');

  async function loadAppointments() {
    if (!supabaseClient) return [];
    try {
      const user = await getCurrentUser();
      if (!user) return [];
      const { data, error } = await supabaseClient
        .from('advisor_appointments')
        .select('*')
        .eq('user_id', user.id)
        .order('appointment_date', { ascending: true });
      if (error) throw error;
      return data || [];
    } catch (e) {
      console.error('Load appointments error:', e);
      return [];
    }
  }

  async function loadAdvisorMessages() {
    if (!supabaseClient) return [];
    try {
      const user = await getCurrentUser();
      if (!user) return [];
      const { data, error } = await supabaseClient
        .from('advisor_messages')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data || [];
    } catch (e) {
      console.error('Load advisor messages error:', e);
      return [];
    }
  }

  function renderAppointments(list) {
    if (!list.length) {
      apptUpcomingList.innerHTML = '';
      return;
    }
    apptUpcomingList.innerHTML = '<div class="text-[11px] font-bold tracking-[1.2px] text-white/75 dark:text-[#8E9CBA] uppercase mb-[4px]">UPCOMING APPOINTMENTS</div>' + list.map(item => `
      <div class="w-full bg-white dark:bg-[#0D1728] border border-transparent dark:border-white/[0.06] rounded-[16px] p-[14px] shadow-lg">
        <div class="text-[14px] font-bold text-[#111827] dark:text-white">${item.topic}</div>
        <div class="text-[12px] text-[#6B7280] dark:text-[#8E9CBA]">${item.appointment_date} at ${item.appointment_time} · ${String(item.meeting_type || '').replace('_', ' ')}</div>
      </div>
    `).join('');
  }

  function renderAdvisorMessages(list) {
    if (!list.length) {
      advisorMessagesList.innerHTML = '<div class="text-center text-[13px] text-[#6B7280] dark:text-[#8E9CBA] py-2">No messages yet. Say hello to your advisor.</div>';
      return;
    }
    advisorMessagesList.innerHTML = list.map(msg => `
      <div class="flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}">
        <div class="max-w-[75%] px-[12px] py-[8px] rounded-[12px] text-[13px] ${msg.sender === 'user' ? 'bg-[#2563EB] text-white' : 'bg-gray-100 dark:bg-white/10 text-[#111827] dark:text-white'}">${msg.message}</div>
      </div>
    `).join('');
    advisorMessagesList.scrollTop = advisorMessagesList.scrollHeight;
  }

  async function refreshAdvisorData() {
    apptError.classList.add('hidden');
    const [appointments, messages] = await Promise.all([loadAppointments(), loadAdvisorMessages()]);
    renderAppointments(appointments);
    renderAdvisorMessages(messages);
  }

  on(root.querySelector('[data-action="close"]'), 'click', close);
  on(root.querySelector('#advisorViewDocsBtn'), 'click', () => loadPage('statements'));
  on(apptScheduleBtn, 'click', async () => {
    apptError.classList.add('hidden');
    if (!apptDate.value || !apptTime.value) {
      apptError.textContent = 'Please choose a date and time.';
      apptError.classList.remove('hidden');
      return;
    }
    if (!supabaseClient) {
      apptError.textContent = 'Advisor scheduling is unavailable right now.';
      apptError.classList.remove('hidden');
      return;
    }

    apptScheduleBtn.disabled = true;
    apptScheduleBtn.textContent = 'Scheduling...';
    try {
      const user = await getCurrentUser();
      if (!user) throw new Error('Not signed in');
      const topic = apptTopic.value;
      const { error } = await supabaseClient.from('advisor_appointments').insert({
        user_id: user.id,
        meeting_type: apptMeetingType.value,
        topic,
        appointment_date: apptDate.value,
        appointment_time: apptTime.value,
        notes: apptNotes.value.trim() || null,
        status: 'scheduled',
      });
      if (error) throw error;
      apptScheduleBtn.disabled = false;
      apptScheduleBtn.textContent = 'Schedule Appointment';
      apptDate.value = '';
      apptTime.value = '';
      apptNotes.value = '';
      await refreshAdvisorData();
      showModal('Appointment Scheduled', `Your ${topic} appointment has been requested. Confirmation: ${genRef()}`);
    } catch (e) {
      console.error('Schedule appointment error:', e);
      apptScheduleBtn.disabled = false;
      apptScheduleBtn.textContent = 'Schedule Appointment';
      apptError.textContent = 'Could not schedule this appointment right now. Please try again.';
      apptError.classList.remove('hidden');
    }
  });

  async function sendAdvisorMessage() {
    const text = advisorMessageInput.value.trim();
    if (!text) return;
    advisorSendMessageBtn.disabled = true;
    try {
      if (!supabaseClient) throw new Error('Supabase client not available');
      const user = await getCurrentUser();
      if (!user) throw new Error('Not signed in');
      const { error } = await supabaseClient.from('advisor_messages').insert({
        user_id: user.id,
        sender: 'user',
        message: text,
      });
      if (error) throw error;
      advisorMessageInput.value = '';
      renderAdvisorMessages(await loadAdvisorMessages());
    } catch (e) {
      console.error('Send advisor message error:', e);
    } finally {
      advisorSendMessageBtn.disabled = false;
    }
  }

  on(advisorSendMessageBtn, 'click', sendAdvisorMessage);
  on(advisorMessageInput, 'keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      sendAdvisorMessage();
    }
  });

  refreshAdvisorData();
}

export function cleanup() {
  listeners.forEach(off => off());
  listeners = [];
}
