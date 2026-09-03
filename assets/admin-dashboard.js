(function () {
  const client = supabase.createClient(window.ADMIN_SUPABASE_URL, window.ADMIN_SUPABASE_KEY);

  const page = document.getElementById('admin-dashboard-page');
  const body = document.getElementById('admin-dashboard-body');
  const errorEl = document.getElementById('admin-dashboard-error');
  const logoutBtn = document.getElementById('admin-logout-btn');

  const kpiTotalEl = document.getElementById('admin-kpi-total');
  const kpiTodayEl = document.getElementById('admin-kpi-today');
  const kpiCheckedInEl = document.getElementById('admin-kpi-checked-in');
  const kpiNotCheckedInEl = document.getElementById('admin-kpi-not-checked-in');
  const kpiCheckinRateEl = document.getElementById('admin-kpi-checkin-rate');

  const tabDailyBtn = document.getElementById('admin-tab-daily');
  const tabWeeklyBtn = document.getElementById('admin-tab-weekly');
  const chartTitleEl = document.getElementById('admin-chart-title');
  const chartDeltaEl = document.getElementById('admin-chart-delta');
  const plotLineEl = document.getElementById('admin-plot-line');
  const xAxisEl = document.getElementById('admin-x-axis');

  const membersListEl = document.getElementById('admin-members-list');

  const RECENT_LIMIT = 5;

  let registrations = [];
  let chartMode = 'daily';

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

  function addDays(date, days) {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
  }

  function sameDate(a, b) {
    return a.getTime() === b.getTime();
  }

  function startOfWeekMonday(date) {
    const day = date.getDay();
    const diff = (day === 0 ? -6 : 1) - day;
    return addDays(date, diff);
  }

  function formatDotDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}.${m}.${d}`;
  }

  function formatShortDate(date) {
    return `${date.getMonth() + 1}/${date.getDate()}`;
  }

  function formatPercent(current, previous) {
    if (previous === 0) {
      if (current === 0) return { text: '변동 없음', negative: false };
      return { text: `신규 +${current}건`, negative: false };
    }
    const pct = ((current - previous) / previous) * 100;
    const sign = pct >= 0 ? '+' : '';
    return { text: `${sign}${pct.toFixed(1)}% (vs 이전 기간)`, negative: pct < 0 };
  }

  function buildPolylinePoints(counts) {
    const max = Math.max(1, ...counts);
    const w = 700;
    const h = 160;
    const padTop = 16;
    const padBottom = 16;
    const usableH = h - padTop - padBottom;
    const stepX = counts.length > 1 ? w / (counts.length - 1) : w;
    return counts
      .map((c, i) => {
        const x = counts.length > 1 ? i * stepX : w / 2;
        const y = padTop + (usableH - (c / max) * usableH);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  }

  function activeRegistrations() {
    return registrations.filter((r) => r.status !== 'cancelled');
  }

  function renderKpis() {
    const active = activeRegistrations();
    const today = kstCalendarDate(new Date());
    const todayCount = active.filter((r) => sameDate(kstCalendarDate(r.created_at), today)).length;

    kpiTotalEl.textContent = active.length.toLocaleString('ko-KR');
    kpiTodayEl.textContent = todayCount.toLocaleString('ko-KR');

    const checkedInCount = active.filter((r) => r.checked_in).length;
    const notCheckedInCount = active.length - checkedInCount;
    const checkinRate = active.length > 0 ? Math.round((checkedInCount / active.length) * 100) : 0;

    kpiCheckedInEl.textContent = checkedInCount.toLocaleString('ko-KR');
    kpiNotCheckedInEl.textContent = notCheckedInCount.toLocaleString('ko-KR');
    kpiCheckinRateEl.textContent = `${checkinRate}%`;
  }

  function renderChart() {
    const active = activeRegistrations();
    const today = kstCalendarDate(new Date());

    if (chartMode === 'daily') {
      const thisMonday = startOfWeekMonday(today);
      const days = Array.from({ length: 7 }, (_, i) => addDays(thisMonday, i));
      const counts = days.map(
        (day) => active.filter((r) => sameDate(kstCalendarDate(r.created_at), day)).length
      );
      const prevMonday = addDays(thisMonday, -7);
      const prevDays = Array.from({ length: 7 }, (_, i) => addDays(prevMonday, i));
      const prevCounts = prevDays.map(
        (day) => active.filter((r) => sameDate(kstCalendarDate(r.created_at), day)).length
      );

      chartTitleEl.textContent = '일별 사전등록 추이';
      const delta = formatPercent(
        counts.reduce((a, b) => a + b, 0),
        prevCounts.reduce((a, b) => a + b, 0)
      );
      chartDeltaEl.textContent = delta.text.replace('(vs 이전 기간)', '(vs 전주)');
      chartDeltaEl.classList.toggle('negative', delta.negative);

      plotLineEl.setAttribute('points', buildPolylinePoints(counts));
      xAxisEl.innerHTML = ['월', '화', '수', '목', '금', '토', '일']
        .map((label) => `<p>${label}</p>`)
        .join('');
    } else {
      const thisMonday = startOfWeekMonday(today);
      const weekStarts = Array.from({ length: 6 }, (_, i) => addDays(thisMonday, -(5 - i) * 7));
      const counts = weekStarts.map((weekStart) => {
        const weekEnd = addDays(weekStart, 6);
        return active.filter((r) => {
          const d = kstCalendarDate(r.created_at);
          return d.getTime() >= weekStart.getTime() && d.getTime() <= weekEnd.getTime();
        }).length;
      });
      const prevWeekStarts = weekStarts.map((d) => addDays(d, -42));
      const prevCounts = prevWeekStarts.map((weekStart) => {
        const weekEnd = addDays(weekStart, 6);
        return active.filter((r) => {
          const d = kstCalendarDate(r.created_at);
          return d.getTime() >= weekStart.getTime() && d.getTime() <= weekEnd.getTime();
        }).length;
      });

      chartTitleEl.textContent = '주별 사전등록 추이';
      const delta = formatPercent(
        counts.reduce((a, b) => a + b, 0),
        prevCounts.reduce((a, b) => a + b, 0)
      );
      chartDeltaEl.textContent = delta.text.replace('(vs 이전 기간)', '(vs 이전 6주)');
      chartDeltaEl.classList.toggle('negative', delta.negative);

      plotLineEl.setAttribute('points', buildPolylinePoints(counts));
      xAxisEl.innerHTML = weekStarts.map((d) => `<p>${formatShortDate(d)}</p>`).join('');
    }
  }

  function renderMembers() {
    const active = activeRegistrations();
    const list = active.slice(0, RECENT_LIMIT);

    if (list.length === 0) {
      membersListEl.innerHTML = '<div class="admin-members-empty">등록된 사전등록자가 없습니다.</div>';
      return;
    }

    membersListEl.innerHTML = list
      .map((r) => {
        const date = formatDotDate(kstCalendarDate(r.created_at));
        const name = escapeHtml(r.name);
        const phone = escapeHtml(r.phone);
        const org = escapeHtml(r.organization || '-');
        const email = escapeHtml(r.email);
        return `
          <a class="admin-member-card" href="admin-registrant-detail.html?id=${encodeURIComponent(r.id)}">
            <div class="admin-member-top"><p>${date}</p><p>${name}</p></div>
            <div class="admin-member-middle"><p>${phone}</p><p>${org}</p></div>
            <p class="admin-member-email">${email}</p>
          </a>
        `;
      })
      .join('');
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

  function renderAll() {
    renderKpis();
    renderChart();
    renderMembers();
  }

  tabDailyBtn.addEventListener('click', function () {
    if (chartMode === 'daily') return;
    chartMode = 'daily';
    tabDailyBtn.classList.add('active');
    tabWeeklyBtn.classList.remove('active');
    renderChart();
  });

  tabWeeklyBtn.addEventListener('click', function () {
    if (chartMode === 'weekly') return;
    chartMode = 'weekly';
    tabWeeklyBtn.classList.add('active');
    tabDailyBtn.classList.remove('active');
    renderChart();
  });

  logoutBtn.addEventListener('click', async function () {
    await client.auth.signOut();
    window.location.href = 'admin-login.html';
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
      renderAll();
    } catch (err) {
      errorEl.textContent = err.message || '데이터를 불러오는 중 오류가 발생했습니다.';
      errorEl.hidden = false;
    }
  })();
})();
