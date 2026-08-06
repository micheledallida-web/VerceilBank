// Shared success-receipt component. Any page module can import and call
// showReceipt({ amount, recipient, confirmation }) — it mounts itself as an
// overlay above whatever page is open and tears itself down on Done.

let receiptEl = null;

function ensureMounted() {
  if (receiptEl) return receiptEl;
  const el = document.createElement('div');
  el.id = 'receiptOverlay';
  el.className = 'fixed inset-0 z-[80] bg-[#0B4CC2] dark:bg-[#060B14] overflow-y-auto';
  el.innerHTML = `
    <div class="w-full max-w-[430px] mx-auto px-[16px] pt-[40px] pb-[40px] text-center">
      <div class="w-[64px] h-[64px] rounded-full bg-[#10B981]/15 flex items-center justify-center mx-auto mb-[16px]">
        <svg class="w-[32px] h-[32px] text-[#10B981]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
      </div>
      <div class="text-[20px] font-bold text-white mb-[24px]">Transaction Complete</div>
      <div class="bg-white dark:bg-[#0D1728] border border-transparent dark:border-white/[0.06] rounded-[22px] p-[18px] shadow-lg text-left divide-y divide-gray-100 dark:divide-white/[0.06]">
        <div class="flex items-center justify-between py-[12px]"><span class="text-[13px] text-[#6B7280] dark:text-[#8E9CBA]">Amount</span><span data-field="amount" class="text-[16px] font-bold text-[#111827] dark:text-white"></span></div>
        <div class="flex items-center justify-between py-[12px]"><span class="text-[13px] text-[#6B7280] dark:text-[#8E9CBA]">Recipient</span><span data-field="recipient" class="text-[14px] font-semibold text-[#111827] dark:text-white"></span></div>
        <div class="flex items-center justify-between py-[12px]"><span class="text-[13px] text-[#6B7280] dark:text-[#8E9CBA]">Date & Time</span><span data-field="datetime" class="text-[14px] font-semibold text-[#111827] dark:text-white"></span></div>
        <div class="flex items-center justify-between py-[12px]"><span class="text-[13px] text-[#6B7280] dark:text-[#8E9CBA]">Confirmation Number</span><span data-field="confirmation" class="text-[14px] font-semibold text-[#111827] dark:text-white"></span></div>
        <div class="flex items-center justify-between py-[12px]"><span class="text-[13px] text-[#6B7280] dark:text-[#8E9CBA]">Status</span><span class="text-[14px] font-semibold text-[#16A34A] dark:text-[#22C55E]">Completed</span></div>
      </div>
      <button data-action="done" class="w-full h-[46px] rounded-[14px] bg-[#2563EB] text-white text-[14px] font-semibold cursor-pointer hover:opacity-90 transition-all mt-[16px]">Done</button>
    </div>
  `;
  document.body.appendChild(el);
  el.querySelector('[data-action="done"]').addEventListener('click', () => hideReceipt());
  receiptEl = el;
  return el;
}

export function showReceipt({ amount, recipient, confirmation }) {
  const el = ensureMounted();
  el.querySelector('[data-field="amount"]').textContent = amount;
  el.querySelector('[data-field="recipient"]').textContent = recipient;
  el.querySelector('[data-field="datetime"]').textContent = new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
  el.querySelector('[data-field="confirmation"]').textContent = confirmation;
  el.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

export function hideReceipt() {
  if (receiptEl) receiptEl.classList.add('hidden');
  document.body.style.overflow = '';
}
