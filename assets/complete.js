(function () {
  const params = new URLSearchParams(window.location.search);
  const name = params.get('name');
  const email = params.get('email');
  const phone = params.get('phone');

  document.getElementById('summary-name').textContent = name || '-';
  document.getElementById('summary-email').textContent = email || '-';

  const qrCard = document.getElementById('qr-card');
  const qrMissing = document.getElementById('qr-missing');

  let qrToken = null;
  try {
    qrToken = sessionStorage.getItem('md-qr-token');
    sessionStorage.removeItem('md-qr-token');
  } catch (storageErr) {
    console.error('QR 토큰 조회 실패:', storageErr);
  }

  if (qrToken && window.QRCode) {
    qrCard.hidden = false;
    QRCode.toCanvas(document.getElementById('qr-canvas'), qrToken, {
      width: 220,
      margin: 1,
      errorCorrectionLevel: 'M',
    }, function (err) {
      if (err) {
        console.error('QR 생성 실패:', err);
        qrCard.hidden = true;
        qrMissing.hidden = false;
      }
    });
  } else {
    qrMissing.hidden = false;
  }

  const cancelBtn = document.getElementById('cancel-btn');

  cancelBtn.addEventListener('click', async function () {
    if (!name || !phone) {
      window.location.href = 'lookup.html';
      return;
    }

    if (!window.confirm('사전등록을 취소하시겠습니까?')) {
      return;
    }

    cancelBtn.disabled = true;

    try {
      const res = await fetch('/api/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone }),
      });

      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(body.error || '취소에 실패했습니다.');
      }

      const cancelParams = new URLSearchParams({ name, email: email || '' });
      window.location.href = 'cancel-complete.html?' + cancelParams.toString();
    } catch (err) {
      console.error('사전등록 취소 실패:', err);
      alert(err.message || '취소 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
      cancelBtn.disabled = false;
    }
  });
})();
