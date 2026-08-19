(function () {
  const checkbox = document.getElementById('terms-consent');
  const agreeBtn = document.getElementById('agree-btn');

  agreeBtn.addEventListener('click', function () {
    if (!checkbox.checked) {
      checkbox.focus();
      alert('개인정보 수집 및 이용에 동의해 주세요.');
      return;
    }
    window.location.href = 'register.html?consent=1';
  });
})();
