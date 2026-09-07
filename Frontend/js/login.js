(function () {
  var form = document.getElementById('login-form');
  var errorEl = document.getElementById('login-error');
  var googleLogin = document.getElementById('google-login');

  if (googleLogin) {
    googleLogin.href = API + '/auth/google?next=' + encodeURIComponent(
      safeLocalRedirect(qs('next'), 'account.html'),
    );
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    errorEl.textContent = '';
    var email = form.querySelector('[name="email"]').value;
    var password = form.querySelector('[name="password"]').value;

    apiPost('/auth/login', { email: email, password: password }).then(function (res) {
      if (!res) return;
      if (res._status >= 400) {
        errorEl.textContent = res.message || 'ავტორიზაცია ვერ მოხერხდა';
        return;
      }
      setAccessToken(res.accessToken, form.querySelector('[name="remember"]').checked);
      window.location.href = safeLocalRedirect(qs('next'), 'account.html');
    });
  });
})();
