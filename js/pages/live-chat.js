let listeners = [];
let timeouts = [];
function on(el, evt, fn) { if (!el) return; el.addEventListener(evt, fn); listeners.push(() => el.removeEventListener(evt, fn)); }
function later(fn, delay) { const id = setTimeout(fn, delay); timeouts.push(id); return id; }

const chatAgentName = 'Jordan';
let chatSessionMessages = [];
let chatSessionId = null;

function formatChatTime(d) {
  return new Date(d).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function renderChat(root) {
  const chatMessages = root.querySelector('#chatMessages');
  chatMessages.innerHTML = chatSessionMessages.map(m => `
    <div class="flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}">
      <div class="max-w-[75%] px-[12px] py-[8px] rounded-[12px] text-[13px] ${m.sender === 'user' ? 'bg-[#2563EB] text-white' : 'bg-gray-100 dark:bg-white/10 text-[#111827] dark:text-white'}">${m.message}</div>
      <span class="text-[10px] text-[#6B7280] dark:text-[#8E9CBA] mt-[2px] px-[2px]">${m.sender === 'user' ? 'You' : chatAgentName} · ${formatChatTime(m.time)}</span>
    </div>
  `).join('');
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function generateAgentReply(userText) {
  const t = userText.toLowerCase();
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  if (/card.*lock|lock.*card|lost|stolen/.test(t)) {
    return pick([
      'I can help with that. Want me to open Report Lost or Stolen Card so we can lock it right now?',
      'For a lost or stolen card, the fastest fix is locking it immediately — I can walk you to that screen if you\'d like.'
    ]);
  }
  if (/dispute|charge|unauthorized|fraud/.test(t)) {
    return pick([
      'Sorry to hear that. Let\'s get a dispute filed — head to Dispute a Transaction and pick the charge in question, and I\'ll keep an eye on the case.',
      'That sounds like it needs a formal dispute. Once you submit it under Dispute a Transaction you\'ll get a case number to track.'
    ]);
  }
  if (/transfer|zelle|send money|payment/.test(t)) {
    return pick([
      'For transfers or Zelle payments, you\'ll find both under Payments. Let me know if one of them isn\'t going through.',
      'Got it — payment issues are usually quick to sort out. Which account is it affecting?'
    ]);
  }
  if (/invest|portfolio|stock/.test(t)) {
    return pick([
      'I can loop in someone from investment support, or you can check your Portfolio Overview for the latest on your holdings.',
      'For anything account-specific on investments, our team can dig in — want me to flag this for a specialist?'
    ]);
  }
  if (/account help/.test(t)) {
    return 'Happy to help with your account — what\'s going on? Balance question, missing transaction, or something else?';
  }
  if (/thank/.test(t)) {
    return pick(['Anytime! Anything else I can help with?', 'You\'re welcome — let me know if anything else comes up.']);
  }
  return pick([
    'Got it, thanks for the details. Let me look into that for you.',
    'Understood — give me just a moment to check on this.',
    'I hear you. Can you tell me a bit more about when this started?',
    'Thanks for flagging that. I\'m pulling up your account now.'
  ]);
}

export function init(root, ctx) {
  const { supabaseClient, getCurrentUser, genRef, close } = ctx;

  const chatMessages = root.querySelector('#chatMessages');
  const chatInput = root.querySelector('#chatInput');
  const chatSendBtn = root.querySelector('#chatSendBtn');
  const chatTypingIndicator = root.querySelector('#chatTypingIndicator');
  const chatHeaderStatus = root.querySelector('#chatHeaderStatus');

  async function pushChatMessage(sender, message) {
    const time = new Date().toISOString();
    chatSessionMessages.push({ sender, message, time });
    renderChat(root);
    try {
      const user = await getCurrentUser();
      if (user && supabaseClient) {
        await supabaseClient.from('support_chats').insert({
          user_id: user.id,
          session_id: chatSessionId,
          sender,
          message,
        });
      }
    } catch (e) {
      console.error('Save chat message error:', e);
    }
  }

  async function sendChatMessage() {
    const text = chatInput.value.trim();
    if (!text) return;
    chatInput.value = '';
    await pushChatMessage('user', text);
    const reply = generateAgentReply(text);
    chatTypingIndicator.classList.remove('hidden');
    chatTypingIndicator.classList.add('flex');
    const delay = 700 + Math.min(1800, reply.length * 18);
    later(async () => {
      chatTypingIndicator.classList.add('hidden');
      chatTypingIndicator.classList.remove('flex');
      await pushChatMessage('agent', reply);
    }, delay);
  }

  function startChat() {
    chatSessionId = genRef();
    chatSessionMessages = [];
    chatMessages.innerHTML = '';
    chatHeaderStatus.textContent = 'Connecting you with an agent...';
    chatTypingIndicator.classList.remove('hidden');
    chatTypingIndicator.classList.add('flex');
    later(() => {
      chatTypingIndicator.classList.add('hidden');
      chatTypingIndicator.classList.remove('flex');
      chatHeaderStatus.textContent = `${chatAgentName} · Online`;
      pushChatMessage('agent', `Hi, I'm ${chatAgentName} with Verceil Bank support. How can I help today?`);
    }, 1400);
  }

  on(root.querySelector('[data-action="close"]'), 'click', close);
  root.querySelectorAll('.chat-quick-btn').forEach(btn => {
    on(btn, 'click', () => {
      chatInput.value = btn.getAttribute('data-opt') || '';
      sendChatMessage();
    });
  });
  on(chatSendBtn, 'click', sendChatMessage);
  on(chatInput, 'keydown', e => { if (e.key === 'Enter') sendChatMessage(); });
  on(root.querySelector('#chatEndBtn'), 'click', close);
  on(root.querySelector('#chatSaveTranscriptBtn'), 'click', () => {
    const text = chatSessionMessages.map(m => `[${formatChatTime(m.time)}] ${m.sender === 'user' ? 'You' : chatAgentName}: ${m.message}`).join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat-transcript-${chatSessionId || 'session'}.txt`;
    a.click();
    later(() => URL.revokeObjectURL(url), 1000);
  });

  startChat();
}

export function cleanup() {
  listeners.forEach(off => off());
  listeners = [];
  timeouts.forEach(id => clearTimeout(id));
  timeouts = [];
  chatSessionMessages = [];
  chatSessionId = null;
}
