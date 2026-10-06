(function () {
  const form = document.getElementById('reg-form');
  const submitBtn = form.querySelector('.submit-btn');

  // Every text field is required. The native `required` check lets a value of
  // only spaces through, so flag those as missing too (the server rejects them).
  const requiredFields = [form.name, form.phone, form.email, form.org, form.position];

  // The terms page is a separate document, so going there and back reloads this
  // form. Keep what was typed in sessionStorage so it survives that round trip
  // (and a refresh), and drop it once the registration is done.
  const DRAFT_KEY = 'md-reg-draft';

  function readDraft() {
    try {
      return JSON.parse(sessionStorage.getItem(DRAFT_KEY)) || {};
    } catch (storageErr) {
      return {};
    }
  }

  function saveDraft() {
    const draft = { consent: form.consent.checked };
    requiredFields.forEach(function (field) {
      draft[field.name] = field.value;
    });
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch (storageErr) {
      console.error('입력값 임시 저장 실패:', storageErr);
    }
  }

  function clearDraft() {
    try {
      sessionStorage.removeItem(DRAFT_KEY);
    } catch (storageErr) {
      console.error('임시 저장값 삭제 실패:', storageErr);
    }
  }

  const draft = readDraft();
  requiredFields.forEach(function (field) {
    if (typeof draft[field.name] === 'string') {
      field.value = draft[field.name];
    }
  });
  form.consent.checked =
    draft.consent === true || new URLSearchParams(window.location.search).get('consent') === '1';

  requiredFields.forEach(function (field) {
    field.addEventListener('input', function () {
      field.setCustomValidity('');
      saveDraft();
    });
  });
  form.consent.addEventListener('change', saveDraft);
  // Leaving for the terms page: save even if nothing fired an input event (autofill).
  let submitted = false;
  window.addEventListener('pagehide', function () {
    if (!submitted) saveDraft();
  });

  form.addEventListener('submit', async function (e) {
    e.preventDefault();

    requiredFields.forEach(function (field) {
      field.setCustomValidity(field.value.trim() === '' ? '필수 입력 항목입니다.' : '');
    });

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

        if (res.status === 409 && body.duplicate) {
          alert(body.error || '이미 사전등록이 완료된 전화번호입니다.');
          submitted = true;
          clearDraft();
          const lookupParams = new URLSearchParams({ phone: data.phone });
          window.location.href = 'lookup.html?' + lookupParams.toString();
          return;
        }

        throw new Error(body.error || '등록에 실패했습니다.');
      }

      const body = await res.json().catch(() => ({}));

      try {
        if (body.qr_token) {
          sessionStorage.setItem('md-qr-token', body.qr_token);
        }
      } catch (storageErr) {
        console.error('QR 토큰 저장 실패:', storageErr);
      }

      submitted = true;
      clearDraft();

      const params = new URLSearchParams({ name: data.name, email: data.email, phone: data.phone });
      window.location.href = 'complete.html?' + params.toString();
    } catch (err) {
      console.error('사전등록 제출 실패:', err);
      alert(err.message || '등록 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
      submitBtn.disabled = false;
    }
  });
})();
