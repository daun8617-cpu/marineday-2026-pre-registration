(function () {
  const client = supabase.createClient(window.ADMIN_SUPABASE_URL, window.ADMIN_SUPABASE_KEY);

  const page = document.getElementById('admin-edit-page');
  const form = document.getElementById('admin-edit-form');
  const errorEl = document.getElementById('admin-dashboard-error');
  const formErrorEl = document.getElementById('admin-form-error');
  const saveBtn = document.getElementById('admin-save-btn');
  const backBtn = document.getElementById('admin-back-btn');
  const cancelBtn = document.getElementById('admin-cancel-edit-btn');

  let accessToken = null;
  let registrantId = null;

  async function loadRegistrations() {
    const res = await fetch('/api/admin-registrations', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.error || '데이터를 불러오지 못했습니다.');
    }
    return json.registrations;
  }

  form.addEventListener('submit', async function (e) {
    e.preventDefault();

    formErrorEl.hidden = true;

    if (!form.reportValidity()) {
      return;
    }

    const data = {
      id: registrantId,
      name: form.name.value.trim(),
      phone: form.phone.value.trim(),
      email: form.email.value.trim(),
      org: form.org.value.trim(),
      position: form.position.value.trim(),
    };

    saveBtn.disabled = true;
    saveBtn.textContent = '저장 중...';

    try {
      const res = await fetch('/api/admin-update-registration', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || '수정 처리 중 오류가 발생했습니다.');
      }
      window.location.href = `admin-registrant-detail.html?id=${encodeURIComponent(registrantId)}`;
    } catch (err) {
      formErrorEl.textContent = err.message || '수정 처리 중 오류가 발생했습니다.';
      formErrorEl.hidden = false;
      saveBtn.disabled = false;
      saveBtn.textContent = '저장';
    }
  });

  (async function init() {
    const { data } = await client.auth.getSession();
    if (!data.session) {
      window.location.href = 'admin-login.html';
      return;
    }
    accessToken = data.session.access_token;
    page.hidden = false;

    const params = new URLSearchParams(window.location.search);
    registrantId = Number(params.get('id'));

    if (!registrantId) {
      errorEl.textContent = '잘못된 접근입니다.';
      errorEl.hidden = false;
      return;
    }

    const detailHref = `admin-registrant-detail.html?id=${encodeURIComponent(registrantId)}`;
    backBtn.href = detailHref;
    cancelBtn.href = detailHref;

    try {
      const registrations = await loadRegistrations();
      const record = registrations.find((r) => r.id === registrantId);
      if (!record) {
        errorEl.textContent = '해당 등록자를 찾을 수 없습니다.';
        errorEl.hidden = false;
        return;
      }
      if (record.status === 'cancelled') {
        errorEl.textContent = '취소된 등록은 수정할 수 없습니다.';
        errorEl.hidden = false;
        return;
      }

      form.name.value = record.name;
      form.phone.value = record.phone;
      form.email.value = record.email;
      form.org.value = record.organization || '';
      form.position.value = record.position || '';

      form.hidden = false;
    } catch (err) {
      errorEl.textContent = err.message || '데이터를 불러오는 중 오류가 발생했습니다.';
      errorEl.hidden = false;
    }
  })();
})();
