(function () {
  const client = supabase.createClient(window.ADMIN_SUPABASE_URL, window.ADMIN_SUPABASE_KEY);

  const page = document.getElementById('admin-checkin-page');
  const body = document.getElementById('admin-checkin-body');
  const errorEl = document.getElementById('admin-checkin-error');
  const resultEl = document.getElementById('admin-checkin-result');
  const manualInput = document.getElementById('admin-checkin-manual-input');
  const manualBtn = document.getElementById('admin-checkin-manual-btn');
  const startBtn = document.getElementById('admin-checkin-start-btn');
  const READER_ID = 'admin-checkin-reader';

  const RESCAN_LOCK_MS = 3000;
  const CAMERA_STORAGE_KEY = 'md-admin-checkin-camera-id';
  const SCAN_CONFIG = { fps: 10, qrbox: 250 };

  let accessToken = null;
  let html5Qrcode = null;
  let scanning = false;
  let startLock = null; // Promise of the in-flight startCamera() call, or null when idle
  let busy = false;
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

  function rememberCamera(deviceId) {
    if (!deviceId) return;
    try {
      localStorage.setItem(CAMERA_STORAGE_KEY, deviceId);
    } catch (e) {
      // localStorage unavailable (private mode etc.) — camera memory is a
      // convenience, not a requirement, so just skip it.
    }
  }

  function getRememberedCamera() {
    try {
      return localStorage.getItem(CAMERA_STORAGE_KEY);
    } catch (e) {
      return null;
    }
  }

  function captureActiveCameraId() {
    try {
      const settings = html5Qrcode.getRunningTrackSettings();
      if (settings && settings.deviceId) {
        rememberCamera(settings.deviceId);
      }
    } catch (e) {
      // Not fatal — some browsers don't expose track settings.
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
        return;
      }

      if (!res.ok) {
        showResult('err', '체크인 실패', null, escapeHtml(responseBody.error) || '오류가 발생했습니다.');
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
      // Camera keeps running so the next attendee's QR can be scanned right away.
    } catch (err) {
      showResult('err', '체크인 실패', null, err.message || '네트워크 오류');
    } finally {
      busy = false;
    }
  }

  function onScanSuccess(decodedText) {
    const text = decodedText.trim();
    const now = Date.now();
    if (busy) return;
    // Same code scanned again inside the cooldown window: ignore (camera
    // keeps firing on whatever QR is still in frame). A different code, or
    // the same code after the cooldown, is processed immediately.
    if (text === lastDecodedText && (now - lastDecodedAt) < RESCAN_LOCK_MS) return;
    lastDecodedText = text;
    lastDecodedAt = now;
    submitToken(text);
  }

  function onScanFailure() {
    // ignore per-frame scan failures (normal while no QR is in view)
  }

  // ---------------------------------------------------------------------
  // Camera lifecycle. Everything here funnels through ONE entry point,
  // startCamera(), which holds a true Promise lock (startLock) so a second
  // call — from the auto-start on load, a fast double-tap of the fallback
  // button, or anything else — never runs concurrently with an in-flight
  // one; it just joins the same in-flight promise instead of calling
  // Html5Qrcode.start() again.
  //
  // Confirmed on a real Android device: a start() call that fails
  // constraint validation BEFORE ever touching the camera — e.g. the
  // unsupported shape `facingMode: { ideal: "environment" }`, which
  // html5-qrcode rejects synchronously with "'facingMode' should be string
  // or object with exact as key" — still flips the instance's internal
  // state flag, and that flag never recovers: the very next start() call on
  // the SAME instance fails immediately with "Cannot transition to a new
  // state, already under transition", no matter how long you wait or how
  // many times you stop()+poll getState() first. So the rule is not
  // "recover the instance" but "never reuse it": every attempt below gets
  // its own brand-new Html5Qrcode instance (see attemptStart) and the
  // reader DOM is wiped by hand in between (see discardInstance), and only
  // constraint shapes html5-qrcode actually accepts are ever passed to
  // start() — a plain camera deviceId string, `{ facingMode: "environment"
  // }`, or `{ facingMode: { exact: "environment" } }`. Never `{ ideal:
  // ... }`.
  // ---------------------------------------------------------------------

  function startCamera() {
    if (scanning) return Promise.resolve();
    if (startLock) {
      console.log('[QR] startCamera() called while already in flight — joining the existing attempt, not starting a new one.');
      return startLock;
    }
    startLock = runStartCameraSequence().finally(function () {
      startLock = null;
    });
    return startLock;
  }

  function resetReaderDom() {
    const readerEl = document.getElementById(READER_ID);
    if (readerEl) readerEl.innerHTML = '';
  }

  async function discardInstance(reason) {
    if (!html5Qrcode) return;
    const instance = html5Qrcode;
    html5Qrcode = null;
    console.log('[QR] discarding scanner instance (' + reason + ')');
    try {
      // Bounded wait: clear() can itself hang on an instance whose internal
      // state is stuck, so this must never block the next attempt.
      await Promise.race([
        instance.clear(),
        new Promise((resolve) => setTimeout(resolve, 500)),
      ]);
    } catch (e) {
      console.log('[QR] clear() during discard failed (ignored, instance is being thrown away anyway): [' + (e && e.name) + '] ' + (e && e.message));
    }
    resetReaderDom();
  }

  async function attemptStart(source, label) {
    // Always a fresh instance — see the comment above this section for why
    // reusing one after a failed start() is not reliable on real devices.
    resetReaderDom();
    html5Qrcode = new Html5Qrcode(READER_ID);
    console.log('[QR] attempting camera start (' + label + '):', JSON.stringify(source));
    const waitHint = setTimeout(function () {
      errorEl.textContent = '카메라 권한 응답을 기다리는 중입니다... 화면에 권한 요청 팝업이 떠 있다면 허용해 주세요.';
      errorEl.hidden = false;
    }, 4000);
    try {
      await html5Qrcode.start(source, SCAN_CONFIG, onScanSuccess, onScanFailure);
    } finally {
      clearTimeout(waitHint);
    }
    console.log('[QR] camera started successfully via ' + label);
    scanning = true;
    startBtn.hidden = true;
    errorEl.hidden = true;
    captureActiveCameraId();
  }

  function describeCameraError(err) {
    const name = (err && err.name) || 'Error';
    const message = (err && err.message) || String(err);
    let hint = '카메라를 시작하지 못했습니다.';
    if (name === 'NotAllowedError') {
      hint = '카메라 권한이 거부되었습니다. 브라우저 설정에서 카메라 권한을 허용한 뒤 다시 시도해 주세요.';
    } else if (name === 'NotFoundError') {
      hint = '사용 가능한 카메라를 찾지 못했습니다.';
    } else if (name === 'OverconstrainedError') {
      hint = '요청한 카메라 조건(후면 카메라 등)을 만족하는 카메라를 찾지 못했습니다.';
    } else if (name === 'NotReadableError') {
      hint = '카메라를 다른 앱이 사용 중입니다. 다른 앱을 종료한 뒤 다시 시도해 주세요.';
    } else if (name === 'SecurityError') {
      hint = '브라우저 보안 정책으로 카메라 접근이 차단되었습니다.';
    }
    // Always append the raw error so the actual cause is visible on-screen,
    // not just a translated guess — needed to diagnose real-device failures
    // without remote devtools access.
    return hint + ` [${name}] ${message}`;
  }

  async function runStartCameraSequence() {
    // Immediate feedback so a tap on the fallback button is never silent —
    // if this text never appears, the click handler itself isn't firing.
    startBtn.hidden = true;
    errorEl.textContent = '카메라를 시작하는 중입니다... (권한 요청이 뜨면 허용해 주세요)';
    errorEl.hidden = false;

    if (typeof Html5Qrcode === 'undefined') {
      errorEl.textContent = 'QR 스캐너 라이브러리를 불러오지 못했습니다.';
      errorEl.hidden = false;
      return;
    }

    // Camera access requires a secure context (https://, or localhost). A
    // plain http:// LAN address — common when testing from a phone against
    // a local dev server — will never be able to open the camera, on either
    // iOS Safari or Android Chrome, so surface that clearly instead of
    // leaving the user with an inert button.
    if (!window.isSecureContext) {
      errorEl.textContent = '카메라는 https:// 또는 localhost 주소에서만 사용할 수 있습니다. 현재 접속 주소(' + window.location.origin + ')에서는 카메라를 켤 수 없습니다.';
      errorEl.hidden = false;
      startBtn.hidden = true;
      return;
    }

    if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
      console.error('[QR] navigator.mediaDevices.getUserMedia is unavailable in this browser context.');
      errorEl.textContent = '이 브라우저에서는 카메라 API(navigator.mediaDevices)를 사용할 수 없습니다.';
      errorEl.hidden = false;
      startBtn.hidden = true;
      return;
    }

    const rememberedId = getRememberedCamera();

    // Enumerate real cameras up front so we can prefer an actual back-camera
    // deviceId (the most reliable source format) over guessing via
    // facingMode constraints. getCameras() itself needs permission, so this
    // also doubles as the first opportunity for that prompt to appear.
    let cameras = null;
    try {
      cameras = await Html5Qrcode.getCameras();
      console.log('[QR] getCameras() returned', cameras && cameras.length, 'camera(s):', JSON.stringify(cameras));
    } catch (e) {
      console.log('[QR] getCameras() failed up front (will still try facingMode constraints): [' + (e && e.name) + '] ' + (e && e.message));
    }

    const backCamera = (cameras || []).find((c) => /back|rear|environment|후면/i.test(c.label || ''));

    // Try, in order: the camera the user used last time; a camera whose
    // label clearly identifies it as the back camera; the two facingMode
    // constraint shapes html5-qrcode actually validates (never the
    // unsupported `{ ideal: ... }` form — see the comment above this
    // section); and finally whatever camera the device reports at all, so a
    // phone that can't satisfy "environment" still gets a working scanner
    // instead of a dead end.
    const attempts = [];
    if (rememberedId) {
      attempts.push({ source: rememberedId, label: 'remembered camera' });
    }
    if (backCamera) {
      attempts.push({ source: backCamera.id, label: 'camera matched by label: ' + backCamera.label });
    }
    attempts.push({ source: { facingMode: 'environment' }, label: 'facingMode=environment' });
    attempts.push({ source: { facingMode: { exact: 'environment' } }, label: 'facingMode exact=environment' });
    if (cameras && cameras.length > 0) {
      const lastCamera = cameras[cameras.length - 1];
      attempts.push({ source: lastCamera.id, label: 'last enumerated camera (any facing): ' + (lastCamera.label || lastCamera.id) });
    }

    const errors = [];
    const triedIds = new Set();
    for (const attempt of attempts) {
      // Same deviceId string already attempted (e.g. remembered camera ===
      // the label-matched back camera) — skip the redundant retry.
      if (typeof attempt.source === 'string') {
        if (triedIds.has(attempt.source)) continue;
        triedIds.add(attempt.source);
      }
      try {
        await attemptStart(attempt.source, attempt.label);
        return;
      } catch (err) {
        errors.push({ label: attempt.label, err });
        console.error('[QR] camera start failed (' + attempt.label + '): [' + (err && err.name) + '] ' + (err && err.message), err);
        // Fully discard the failed instance and confirm the reader DOM is
        // clean BEFORE the next attempt is even considered — never start a
        // new attempt back-to-back with a failed one.
        await discardInstance('attempt "' + attempt.label + '" failed');
      }
    }

    // Surface every underlying error collected along the way (not just the
    // last one), since a later attempt failing can mask what the *first*,
    // real failure actually was.
    startBtn.hidden = false;
    errorEl.textContent = errors.map((e) => e.label + ': ' + describeCameraError(e.err)).join(' | ');
    errorEl.hidden = false;
  }

  startBtn.addEventListener('click', function () {
    startCamera();
  });

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
    body.hidden = false;
    startCamera();
  })();
})();
