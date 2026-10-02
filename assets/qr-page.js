(function () {
  const loadingEl = document.getElementById('qr-loading');
  const readyEl = document.getElementById('qr-ready');
  const cancelledEl = document.getElementById('qr-cancelled');
  const errorEl = document.getElementById('qr-error');
  const errorTextEl = document.getElementById('qr-error-text');

  function show(el) {
    loadingEl.hidden = true;
    el.hidden = false;
  }

  function showError(message) {
    if (message) errorTextEl.textContent = message;
    show(errorEl);
  }

  const token = (new URLSearchParams(window.location.search).get('t') || '').trim();

  if (!token) {
    showError();
    return;
  }

  (async function init() {
    try {
      const res = await fetch('/api/qr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const body = await res.json().catch(() => ({}));

      if (res.status === 404) {
        showError();
        return;
      }
      if (!res.ok) {
        throw new Error(body.error || '조회에 실패했습니다.');
      }

      if (body.cancelled) {
        document.getElementById('qr-cancelled-name').textContent = body.name;
        show(cancelledEl);
        return;
      }

      if (!window.QRCode) {
        throw new Error('QR 라이브러리를 불러오지 못했습니다.');
      }

      document.getElementById('qr-name').textContent = body.name;
      // Same encoding as complete.html / lookup.html: the QR holds the bare
      // qr_token, which is what the admin check-in scanner expects.
      QRCode.toCanvas(document.getElementById('qr-canvas'), token, {
        width: 220,
        margin: 1,
        errorCorrectionLevel: 'M',
      }, function (err) {
        if (err) {
          console.error('QR 생성 실패:', err);
          showError('QR 코드를 만드는 중 오류가 발생했습니다. 잠시 후 다시 열어 주세요.');
          return;
        }
        show(readyEl);
      });
    } catch (err) {
      console.error('QR 조회 실패:', err);
      showError('일시적인 오류로 QR 코드를 불러오지 못했습니다. 잠시 후 다시 열어 주세요.');
    }
  })();
})();
