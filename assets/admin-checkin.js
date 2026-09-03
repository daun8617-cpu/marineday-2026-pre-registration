(function () {
  const client = supabase.createClient(window.ADMIN_SUPABASE_URL, window.ADMIN_SUPABASE_KEY);

  const page = document.getElementById('admin-checkin-page');
  const body = document.getElementById('admin-checkin-body');
  const errorEl = document.getElementById('admin-checkin-error');
  const resultEl = document.getElementById('admin-checkin-result');
  const manualInput = document.getElementById('admin-checkin-manual-input');
  const manualBtn = document.getElementById('admin-checkin-manual-btn');

  const RESCAN_LOCK_MS = 3000;

  let accessToken = null;
  let scanner = null;
  let busy = false;
  let scanLocked = false;
  let lastDecodedText = null;
  let lastDecodedAt = 0;

  function showResult(status, labelText, name, sub) {
    resultEl.className = `admin-checkin-result visible ${status}`;
    resultEl.innerHTML = `
      <p class="status-label">${labelText}</p>
      ${name ? `<p class="status-name">${name}</p>` : ''}
      ${sub ? `<p class="status-sub">${sub}</p>` : ''}
    `;
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, (ch) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[ch]));
  }

  function stopScanner() {
    if (scanner) {
      scanner.clear().catch(function () {});
    }
  }

  async function submitToken(qrToken) {
    if (busy || !qrToken) return;
    busy = true;
    try {
      const res = await fetch('/api/admin-checkin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ qr_token: qrToken }),
      });
      const responseBody = await res.json().catch(() => ({}));

      if (res.status === 404) {
        showResult('notfound', '등록되지 않은 QR', null, '사전등록 정보를 찾을 수 없습니다.');
        scanLocked = false;
        return;
      }

      if (!res.ok) {
        showResult('err', '체크인 실패', null, escapeHtml(responseBody.error) || '오류가 발생했습니다.');
        scanLocked = false;
        return;
      }

      if (responseBody.already) {
        showResult(
          'dup',
          '이미 체크인됨',
          escapeHtml(responseBody.name),
          `${escapeHtml(responseBody.organization) || ''} · ${escapeHtml(responseBody.checked_in_at) || ''}`
        );
      } else {
        showResult(
          'ok',
          '체크인 성공',
          escapeHtml(responseBody.name),
          `${escapeHtml(responseBody.organization) || ''} · ${escapeHtml(responseBody.checked_in_at) || ''}`
        );
      }
      // Success or already-checked-in is a definitive result: stop scanning
      // immediately so the camera can't keep re-firing on the same QR code.
      stopScanner();
    } catch (err) {
      showResult('err', '체크인 실패', null, err.message || '네트워크 오류');
      scanLocked = false;
    } finally {
      busy = false;
    }
  }

  manualBtn.addEventListener('click', function () {
    submitToken(manualInput.value.trim());
  });

  (async function init() {
    const { data } = await client.auth.getSession();
    if (!data.session) {
      window.location.href = 'admin-login.html';
      return;
    }
    accessToken = data.session.access_token;
    page.hidden = false;

    try {
      body.hidden = false;

      scanner = new Html5QrcodeScanner('admin-checkin-reader', { fps: 10, qrbox: 250 }, false);
      scanner.render(function (decodedText) {
        const text = decodedText.trim();
        const now = Date.now();
        if (scanLocked) return;
        if (text === lastDecodedText && (now - lastDecodedAt) < RESCAN_LOCK_MS) return;
        lastDecodedText = text;
        lastDecodedAt = now;
        scanLocked = true;
        submitToken(text);
      }, function () {
        // ignore per-frame scan failures (normal while no QR is in view)
      });
    } catch (err) {
      errorEl.textContent = err.message || '스캐너를 초기화하는 중 오류가 발생했습니다.';
      errorEl.hidden = false;
    }
  })();
})();
