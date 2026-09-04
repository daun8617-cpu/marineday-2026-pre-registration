(function () {
  const form = document.getElementById('lookup-form');
  const submitBtn = form.querySelector('.submit-btn');
  const resultCard = document.getElementById('result-card');
  const cancelBlock = document.getElementById('cancel-block');
  const cancelBtn = document.getElementById('cancel-btn');
  const qrCard = document.getElementById('qr-card');
  let currentRecord = null;

  const prefillPhone = new URLSearchParams(window.location.search).get('phone');
  if (prefillPhone) {
    form.phone.value = prefillPhone;
  }

  function formatPhone(phone) {
    const digits = (phone || '').replace(/\D/g, '');
    if (digits.length === 11) {
      return digits.slice(0, 3) + '-' + digits.slice(3, 7) + '-' + digits.slice(7);
    }
    return phone;
  }

  function formatDate(iso) {
    if (!iso) return '-';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '-';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return y + '.' + m + '.' + day;
  }

  function showResult(record) {
    currentRecord = record;
    document.getElementById('result-name').textContent = record.name;
    document.getElementById('result-phone').textContent = formatPhone(record.phone);
    document.getElementById('result-email').textContent = record.email;
    document.getElementById('result-org').textContent = record.organization || '-';
    document.getElementById('result-date').textContent = formatDate(record.created_at);

    if (record.qr_token && window.QRCode) {
      qrCard.hidden = false;
      QRCode.toCanvas(document.getElementById('qr-canvas'), record.qr_token, {
        width: 220,
        margin: 1,
        errorCorrectionLevel: 'M',
      }, function (err) {
        if (err) {
          console.error('QR 생성 실패:', err);
          qrCard.hidden = true;
        }
      });
    } else {
      qrCard.hidden = true;
    }

    resultCard.hidden = false;
    cancelBlock.hidden = false;
  }

  form.addEventListener('submit', async function (e) {
    e.preventDefault();

    if (!form.reportValidity()) {
      return;
    }

    const name = form.name.value.trim();
    const phone = form.phone.value.trim();

    submitBtn.disabled = true;
    resultCard.hidden = true;
    cancelBlock.hidden = true;

    try {
      const res = await fetch('/api/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone }),
      });

      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(body.error || '조회에 실패했습니다.');
      }

      showResult(body);
    } catch (err) {
      console.error('사전등록 조회 실패:', err);
      alert(err.message || '조회 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      submitBtn.disabled = false;
    }
  });

  cancelBtn.addEventListener('click', async function () {
    const name = form.name.value.trim();
    const phone = form.phone.value.trim();

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

      const params = new URLSearchParams({
        name: currentRecord.name,
        email: currentRecord.email,
      });
      window.location.href = 'cancel-complete.html?' + params.toString();
    } catch (err) {
      console.error('사전등록 취소 실패:', err);
      alert(err.message || '취소 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
      cancelBtn.disabled = false;
    }
  });
})();
