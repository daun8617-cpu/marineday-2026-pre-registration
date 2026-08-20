(function () {
  const client = supabase.createClient(window.ADMIN_SUPABASE_URL, window.ADMIN_SUPABASE_KEY);

  const page = document.getElementById('admin-dashboard-page');
  const logoutBtn = document.getElementById('admin-logout-btn');

  (async function guard() {
    const { data } = await client.auth.getSession();
    if (!data.session) {
      window.location.href = 'admin-login.html';
      return;
    }
    page.hidden = false;
  })();

  logoutBtn.addEventListener('click', async function () {
    await client.auth.signOut();
    window.location.href = 'admin-login.html';
  });
})();
