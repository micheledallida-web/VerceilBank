let listeners = [];
function on(el, evt, fn) { if (!el) return; el.addEventListener(evt, fn); listeners.push(() => el.removeEventListener(evt, fn)); }

let activeMsgsFolder = 'inbox';
let currentMsgs = [];

function paintFolderTabs(root) {
  root.querySelectorAll('.msgs-tab').forEach(btn => {
    const active = btn.getAttribute('data-folder') === activeMsgsFolder;
    btn.classList.toggle('bg-[#2563EB]', active);
    btn.classList.toggle('text-white', active);
    btn.classList.toggle('bg-white', !active);
    btn.classList.toggle('dark:bg-[#0D1728]', !active);
    btn.classList.toggle('text-[#111827]', !active);
    btn.classList.toggle('dark:text-white', !active);
  });
}

function renderMsgs(root) {
  const msgsList = root.querySelector('#msgsList');
  const filtered = currentMsgs.filter(m => (m.folder || 'inbox') === activeMsgsFolder);
  if (filtered.length === 0) {
    msgsList.innerHTML = '<div class="bg-white dark:bg-[#0D1728] border border-transparent dark:border-white/[0.06] rounded-[18px] px-[16px] shadow-lg py-4"><div class="text-center text-[13px] text-[#6B7280] dark:text-[#8E9CBA] py-2">Nothing here.</div></div>';
    return;
  }

  msgsList.innerHTML = filtered.map(m => `
    <div class="w-full bg-white dark:bg-[#0D1728] border border-transparent dark:border-white/[0.06] rounded-[16px] p-[14px] shadow-lg">
      <div class="flex items-center justify-between gap-[10px] mb-[4px]">
        <span class="text-[13px] font-bold text-[#111827] dark:text-white">${m.subject || '(No subject)'}</span>
        <span class="text-[10px] font-bold uppercase px-[8px] py-[2px] rounded-full bg-blue-50 dark:bg-white/10 text-[#2563EB] flex-shrink-0">${m.category || 'General Inquiry'}</span>
      </div>
      <div class="text-[12px] text-[#6B7280] dark:text-[#8E9CBA] line-clamp-2">${m.body || ''}</div>
      <div class="text-[11px] text-[#6B7280] dark:text-[#8E9CBA] mt-[6px]">${m.created_at ? new Date(m.created_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : 'Just now'}</div>
    </div>
  `).join('');
}

export function init(root, ctx) {
  const { supabaseClient, getCurrentUser, showModal, close } = ctx;

  const composeMsgBtn = root.querySelector('#composeMsgBtn');
  const composeMsgForm = root.querySelector('#composeMsgForm');
  const msgCategory = root.querySelector('#msgCategory');
  const msgSubject = root.querySelector('#msgSubject');
  const msgBody = root.querySelector('#msgBody');
  const msgAttachment = root.querySelector('#msgAttachment');
  const msgError = root.querySelector('#msgError');
  const msgsList = root.querySelector('#msgsList');

  async function loadSupportMessages() {
    if (!supabaseClient) return [];
    const user = await getCurrentUser();
    if (!user) return [];
    try {
      const { data, error } = await supabaseClient
        .from('support_messages')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    } catch (e) {
      console.error('Load messages error:', e);
      return [];
    }
  }

  async function refreshMessages() {
    msgsList.innerHTML = '<div class="bg-white dark:bg-[#0D1728] border border-transparent dark:border-white/[0.06] rounded-[18px] px-[16px] shadow-lg py-4"><div class="text-center text-[13px] text-[#6B7280] dark:text-[#8E9CBA] py-2">Loading...</div></div>';
    currentMsgs = await loadSupportMessages();
    paintFolderTabs(root);
    renderMsgs(root);
  }

  async function saveSupportMessage(folder) {
    msgError.classList.add('hidden');
    if (!msgSubject.value.trim() || !msgBody.value.trim()) {
      msgError.textContent = 'Please enter a subject and message.';
      msgError.classList.remove('hidden');
      return false;
    }
    try {
      if (!supabaseClient) throw new Error('Supabase client not available');
      const user = await getCurrentUser();
      if (!user) throw new Error('Not signed in');
      const hasAttachment = msgAttachment.files.length > 0;
      const { error } = await supabaseClient.from('support_messages').insert({
        user_id: user.id,
        category: msgCategory.value,
        subject: msgSubject.value.trim(),
        body: msgBody.value.trim(),
        folder,
        has_attachment: hasAttachment,
      });
      if (error) throw error;
      return true;
    } catch (e) {
      console.error('Save message error:', e);
      msgError.textContent = 'Could not save this message.';
      msgError.classList.remove('hidden');
      return false;
    }
  }

  function resetComposeForm() {
    msgSubject.value = '';
    msgBody.value = '';
    msgAttachment.value = '';
    composeMsgForm.classList.add('hidden');
  }

  on(root.querySelector('[data-action="close"]'), 'click', close);
  on(composeMsgBtn, 'click', () => composeMsgForm.classList.toggle('hidden'));

  root.querySelectorAll('.msgs-tab').forEach(btn => {
    on(btn, 'click', () => {
      activeMsgsFolder = btn.getAttribute('data-folder') || 'inbox';
      paintFolderTabs(root);
      renderMsgs(root);
    });
  });

  on(root.querySelector('#saveDraftBtn'), 'click', async () => {
    if (await saveSupportMessage('draft')) {
      resetComposeForm();
      currentMsgs = await loadSupportMessages();
      activeMsgsFolder = 'draft';
      paintFolderTabs(root);
      renderMsgs(root);
    }
  });

  on(root.querySelector('#sendMsgBtn'), 'click', async () => {
    if (await saveSupportMessage('sent')) {
      resetComposeForm();
      currentMsgs = await loadSupportMessages();
      paintFolderTabs(root);
      renderMsgs(root);
      showModal('Message Sent', 'Your secure message was sent. A specialist typically responds within 1 business day.');
    }
  });

  paintFolderTabs(root);
  refreshMessages();
}

export function cleanup() {
  listeners.forEach(off => off());
  listeners = [];
  activeMsgsFolder = 'inbox';
  currentMsgs = [];
}
