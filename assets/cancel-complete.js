(function () {
  const params = new URLSearchParams(window.location.search);
  const name = params.get('name');
  const email = params.get('email');

  document.getElementById('summary-name').textContent = name || '-';
  document.getElementById('summary-email').textContent = email || '-';
})();
