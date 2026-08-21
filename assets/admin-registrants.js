(function () {
  const client = supabase.createClient(window.ADMIN_SUPABASE_URL, window.ADMIN_SUPABASE_KEY);

  const page = document.getElementById('admin-registrants-page');
  const body = document.getElementById('admin-registrants-body');
  const errorEl = document.getElementById('admin-dashboard-error');

  const searchInput = document.getElementById('admin-search-input');
  const filterTabsEl = document.getElementById('admin-filter-tabs');
  const countNumEl = document.getElementById('admin-list-count-num');
  const listEl = document.getElementById('admin-registrants-list');
  const moreBtn = document.getElementById('admin-more-btn');
  const moreBtnLabel = document.getElementById('admin-more-btn-label');
  const downloadBtn = document.getElementById('admin-download-btn');

  const PAGE_SIZE = 20;

  let registrations = [];
  let currentFilter = 'all';
  let searchTerm = '';
  let visibleCount = PAGE_SIZE;

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

  function startOfWeekMonday(date) {
    const day = date.getDay();
    const diff = (day === 0 ? -6 : 1) - day;
    const monday = new Date(date);
    monday.setDate(monday.getDate() + diff);
    return monday;
  }

  function formatDotDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}.${m}.${d}`;
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (ch) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[ch]));
  }

  function activeRegistrations() {
    return registrations.filter((r) => r.status !== 'cancelled');
  }

  function matchesFilter(r) {
    if (currentFilter === 'all') return true;
    const day = kstCalendarDate(r.created_at);
    const today = kstCalendarDate(new Date());
    if (currentFilter === 'today') {
      return day.getTime() === today.getTime();
    }
    if (currentFilter === 'week') {
      const monday = startOfWeekMonday(today);
      const sunday = new Date(monday);
      sunday.setDate(sunday.getDate() + 6);
      return day.getTime() >= monday.getTime() && day.getTime() <= sunday.getTime();
    }
    if (currentFilter === 'month') {
      return day.getFullYear() === today.getFullYear() && day.getMonth() === today.getMonth();
    }
    return true;
  }

  function matchesSearch(r) {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      (r.name || '').toLowerCase().includes(term) ||
      (r.phone || '').toLowerCase().includes(term) ||
      (r.email || '').toLowerCase().includes(term)
    );
  }

  function filteredRegistrations() {
    return activeRegistrations()
      .filter(matchesFilter)
      .filter(matchesSearch);
  }

  function renderList() {
    const filtered = filteredRegistrations();
    const visible = filtered.slice(0, visibleCount);

    countNumEl.textContent = filtered.length.toLocaleString('ko-KR');

    if (filtered.length === 0) {
      listEl.innerHTML = '<div class="admin-registrants-empty">일치하는 사전등록자가 없습니다.</div>';
    } else {
      listEl.innerHTML = visible
        .map((r) => {
          const date = formatDotDate(kstCalendarDate(r.created_at));
          const name = escapeHtml(r.name);
          const phone = escapeHtml(r.phone);
          const org = escapeHtml(r.organization || '-');
          const email = escapeHtml(r.email);
          return `
            <a class="admin-registrant-card" href="admin-registrant-detail.html?id=${encodeURIComponent(r.id)}">
              <div class="admin-registrant-top"><p>${date}</p><p>${name}</p></div>
              <div class="admin-registrant-middle"><p>${phone}</p><p>${org}</p></div>
              <p class="admin-registrant-email">${email}</p>
            </a>
          `;
        })
        .join('');
    }

    const hasMore = visible.length < filtered.length;
    moreBtn.hidden = filtered.length === 0 || !hasMore;
    moreBtnLabel.textContent = `더보기 (${visible.length} / ${filtered.length})`;
  }

  searchInput.addEventListener('input', function () {
    searchTerm = searchInput.value.trim();
    visibleCount = PAGE_SIZE;
    renderList();
  });

  filterTabsEl.addEventListener('click', function (e) {
    const btn = e.target.closest('.admin-filter-tab');
    if (!btn) return;
    filterTabsEl.querySelectorAll('.admin-filter-tab').forEach((el) => el.classList.remove('active'));
    btn.classList.add('active');
    currentFilter = btn.dataset.filter;
    visibleCount = PAGE_SIZE;
    renderList();
  });

  moreBtn.addEventListener('click', function () {
    visibleCount += PAGE_SIZE;
    renderList();
  });

  function toCsvValue(value) {
    const str = String(value == null ? '' : value);
    if (/[",\n]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  downloadBtn.addEventListener('click', function () {
    const filtered = filteredRegistrations();
    const header = ['등록일', '이름', '전화번호', '이메일', '소속', '직급'];
    const rows = filtered.map((r) => [
      formatDotDate(kstCalendarDate(r.created_at)),
      r.name,
      r.phone,
      r.email,
      r.organization || '',
      r.position || '',
    ]);
    const csv = [header, ...rows].map((row) => row.map(toCsvValue).join(',')).join('\r\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const today = kstCalendarDate(new Date());
    const stamp = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
    a.href = url;
    a.download = `사전등록자_${stamp}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });

  async function loadRegistrations(accessToken) {
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
    page.hidden = false;

    try {
      registrations = await loadRegistrations(data.session.access_token);
      body.hidden = false;
      renderList();
    } catch (err) {
      errorEl.textContent = err.message || '데이터를 불러오는 중 오류가 발생했습니다.';
      errorEl.hidden = false;
    }
  })();
})();
