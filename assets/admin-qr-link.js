// Shared by the admin registrant list and detail pages: builds the
// participant-facing QR page URL (qr.html?t=<qr_token>) and copies it.
// The qr_token only reaches the browser through /api/admin-registrations,
// which requires an admin session.
(function () {
  // The address participants actually open. Links that leave the admin pages
  // (the CSV used for the SMS send-out) must point here even when the admin
  // is working on a preview deployment or localhost.
  const PRODUCTION_ORIGIN = 'https://marineday-2026-pre-registration.vercel.app';

  function buildUrl(origin, record) {
    if (!record || !record.qr_token || record.status === 'cancelled') return '';
    return `${origin}/qr.html?t=${encodeURIComponent(record.qr_token)}`;
  }

  // For "QR 보기 / QR 링크 복사" on screen: same deployment the admin is on.
  function urlFor(record) {
    return buildUrl(window.location.origin, record);
  }

  // For exports: always the production domain.
  function productionUrlFor(record) {
    return buildUrl(PRODUCTION_ORIGIN, record);
  }

  async function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return;
    }
    // Fallback for browsers/contexts without the async clipboard API.
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    if (!ok) throw new Error('copy failed');
  }

  async function copyFromButton(button, text) {
    const original = button.dataset.qrLabel || button.textContent;
    button.dataset.qrLabel = original;
    try {
      await copyText(text);
      button.textContent = '복사됨';
    } catch (err) {
      console.error('QR 링크 복사 실패:', err);
      button.textContent = '복사 실패';
    }
    setTimeout(function () {
      button.textContent = original;
    }, 1500);
  }

  window.AdminQrLink = { urlFor, productionUrlFor, copyFromButton };
})();
