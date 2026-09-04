(function () {
  const client = supabase.createClient(window.ADMIN_SUPABASE_URL, window.ADMIN_SUPABASE_KEY);

  const page = document.getElementById('admin-detail-page');
  const body = document.getElementById('admin-detail-body');
  const errorEl = document.getElementById('admin-dashboard-error');
  const actionMessageEl = document.getElementById('admin-action-message');

  const avatarEl = document.getElementById('admin-avatar');
  const nameEl = document.getElementById('admin-profile-name');
  const statusTagEl = document.getElementById('admin-status-tag');
  const phoneEl = document.getElementById('admin-info-phone');
  const emailEl = document.getElementById('admin-info-email');
  const orgEl = document.getElementById('admin-info-org');
  const positionEl = document.getElementById('admin-info-position');
  const createdEl = document.getElementById('admin-info-created');
  const checkinRowEl = document.getElementById('admin-info-checkin-row');
  const checkinEl = document.getElementById('admin-info-checkin');

  const deleteBtn = document.getElementById('admin-btn-delete');
  const deleteBtnLabel = document.getElementById('admin-btn-delete-label');
  const editBtn = document.getElementById('admin-btn-edit');

  let accessToken = null;
  let record = null;
  let confirmingDelete = false;

  function kstCalendarDate(dateInput) {
    const formatted = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(dateInput));
    const [y, m, d] = formatted.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  function formatDateTime(dateInput) {
    const date = kstCalendarDate(dateInput);
    const timeFormatted = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Seoul',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(dateInput));
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}.${m}.${d} ${timeFormatted}`;
  }

  function initials(name) {
    const trimmed = (name || '').trim();
    if (!trimmed) return '-';
    return trimmed.length <= 2 ? trimmed : trimmed.slice(0, 2);
  }

  function showActionMessage(text, isError) {
    actionMessageEl.textContent = text;
    actionMessageEl.classList.toggle('error', !!isError);
    actionMessageEl.hidden = false;
  }

  function clearActionMessage() {
    actionMessageEl.hidden = true;
  }

  function renderRecord() {
    avatarEl.textContent = initials(record.name);
    nameEl.textContent = record.name;
    phoneEl.textContent = record.phone;
    emailEl.textContent = record.email;
    orgEl.textContent = record.organization || '-';
    positionEl.textContent = record.position || '-';
    createdEl.textContent = formatDateTime(record.created_at);

    if (record.checked_in && record.checked_in_at) {
      checkinEl.textContent = formatDateTime(record.checked_in_at);
      checkinRowEl.hidden = false;
    } else {
      checkinRowEl.hidden = true;
    }

    const statusInfo = AdminRegistrationStatus.getStatusInfo(record);
    const cancelled = statusInfo.key === 'cancelled';
    statusTagEl.textContent = statusInfo.label;
    statusTagEl.classList.toggle('cancelled', cancelled);
    deleteBtn.disabled = cancelled;
    deleteBtnLabel.textContent = cancelled ? '취소됨' : '등록취소';
  }

  function resetDeleteButton() {
    confirmingDelete = false;
    deleteBtn.classList.remove('confirming');
    deleteBtnLabel.textContent = '등록취소';
  }

  deleteBtn.addEventListener('click', async function () {
    if (!record || record.status === 'cancelled') return;
    clearActionMessage();

    if (!confirmingDelete) {
      confirmingDelete = true;
      deleteBtn.classList.add('confirming');
      deleteBtnLabel.textContent = '한 번 더 누르면 취소됩니다';
      return;
    }

    deleteBtn.disabled = true;
    deleteBtnLabel.textContent = '처리 중...';

    try {
      const res = await fetch('/api/admin-cancel-registration', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ id: record.id }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || '취소 처리 중 오류가 발생했습니다.');
      }
      window.location.href = 'admin-cancel-complete.html';
      return;
    } catch (err) {
      resetDeleteButton();
      deleteBtn.disabled = false;
      showActionMessage(err.message || '취소 처리 중 오류가 발생했습니다.', true);
    }
  });

  editBtn.addEventListener('click', function () {
    if (!record) return;
    window.location.href = `admin-registrant-edit.html?id=${encodeURIComponent(record.id)}`;
  });

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

  (async function init() {
    const { data } = await client.auth.getSession();
    if (!data.session) {
      window.location.href = 'admin-login.html';
      return;
    }
    accessToken = data.session.access_token;
    page.hidden = false;

    const params = new URLSearchParams(window.location.search);
    const id = Number(params.get('id'));

    if (!id) {
      errorEl.textContent = '잘못된 접근입니다.';
      errorEl.hidden = false;
      return;
    }

    try {
      const registrations = await loadRegistrations();
      record = registrations.find((r) => r.id === id);
      if (!record) {
        errorEl.textContent = '해당 등록자를 찾을 수 없습니다.';
        errorEl.hidden = false;
        return;
      }
      body.hidden = false;
      renderRecord();
    } catch (err) {
      errorEl.textContent = err.message || '데이터를 불러오는 중 오류가 발생했습니다.';
      errorEl.hidden = false;
    }
  })();
})();
