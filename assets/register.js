(function () {
  const form = document.getElementById('reg-form');
  const submitBtn = form.querySelector('.submit-btn');

  if (new URLSearchParams(window.location.search).get('consent') === '1') {
    form.consent.checked = true;
  }

  form.addEventListener('submit', async function (e) {
    e.preventDefault();

    if (!form.reportValidity()) {
      return;
    }

    const data = {
      name: form.name.value.trim(),
      phone: form.phone.value.trim(),
      email: form.email.value.trim(),
      org: form.org.value.trim(),
      position: form.position.value.trim(),
      consent: form.consent.checked,
    };

    submitBtn.disabled = true;

    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || '등록에 실패했습니다.');
      }

      const params = new URLSearchParams({ name: data.name, email: data.email });
      window.location.href = 'complete.html?' + params.toString();
    } catch (err) {
      console.error('사전등록 제출 실패:', err);
      alert(err.message || '등록 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
      submitBtn.disabled = false;
    }
  });
})();
