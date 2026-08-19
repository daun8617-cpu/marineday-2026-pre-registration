(function () {
  const form = document.getElementById('reg-form');

  if (new URLSearchParams(window.location.search).get('consent') === '1') {
    form.consent.checked = true;
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();

    if (!form.reportValidity()) {
      return;
    }

    const data = {
      name: form.name.value.trim(),
      phone: form.phone.value.trim(),
      email: form.email.value.trim(),
      org: form.org.value.trim(),
    };

    // TODO: replace with a real submission endpoint (API, Google Apps Script, etc).
    console.log('사전등록 제출:', data);

    const params = new URLSearchParams({ name: data.name, email: data.email });
    window.location.href = 'complete.html?' + params.toString();
  });
})();
