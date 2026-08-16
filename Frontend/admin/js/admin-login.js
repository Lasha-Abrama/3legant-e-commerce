(function () {
  var form = document.getElementById('admin-login-form');
  var errorEl = document.getElementById('admin-login-error');

  apiGetSilent('/auth/me').then(function (res) {
    if (res && res.user && res.user.isAdmin) {
      window.location.href = 'index.html';
    }
  });

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
      setAccessToken(res.accessToken);
      if (!res.user.isAdmin) {
        errorEl.textContent = 'ამ ანგარიშს არ აქვს ადმინისტრატორის უფლებები';
        apiPost('/auth/logout', {}).then(clearAccessToken);
        return;
      }
      window.location.href = 'index.html';
    });
  });
})();
