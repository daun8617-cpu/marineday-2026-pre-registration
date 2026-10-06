(function () {
  const checkbox = document.getElementById('terms-consent');
  const agreeBtn = document.getElementById('agree-btn');

  agreeBtn.addEventListener('click', function () {
    if (!checkbox.checked) {
      checkbox.focus();
      alert('개인정보 수집 및 이용에 동의해 주세요.');
      return;
    }
    // Carry the consent back to the registration form's saved draft (see register.js).
    try {
      const draft = JSON.parse(sessionStorage.getItem('md-reg-draft')) || {};
      draft.consent = true;
      sessionStorage.setItem('md-reg-draft', JSON.stringify(draft));
    } catch (storageErr) {
      console.error('동의 상태 저장 실패:', storageErr);
    }
    window.location.href = 'register.html?consent=1';
  });
})();
