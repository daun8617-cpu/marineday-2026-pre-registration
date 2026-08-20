(function () {
  const client = supabase.createClient(window.ADMIN_SUPABASE_URL, window.ADMIN_SUPABASE_KEY);

  const form = document.getElementById('admin-login-form');
  const submitBtn = document.getElementById('admin-submit-btn');
  const errorEl = document.getElementById('admin-error');
  const passwordInput = document.getElementById('admin-password');
  const toggleBtn = document.getElementById('admin-password-toggle');

  toggleBtn.addEventListener('click', function () {
    passwordInput.type = passwordInput.type === 'password' ? 'text' : 'password';
  });

  (async function redirectIfLoggedIn() {
    const { data } = await client.auth.getSession();
    if (data.session) {
      window.location.href = 'admin-dashboard.html';
    }
  })();

  form.addEventListener('submit', async function (e) {
    e.preventDefault();

    errorEl.hidden = true;
    submitBtn.disabled = true;

    const email = form.email.value.trim();
    const password = form.password.value;

    try {
      const { error } = await client.auth.signInWithPassword({ email, password });

      if (error) {
        errorEl.textContent = '이메일 또는 비밀번호가 올바르지 않습니다.';
        errorEl.hidden = false;
        return;
      }

      window.location.href = 'admin-dashboard.html';
    } finally {
      submitBtn.disabled = false;
    }
  });
})();
