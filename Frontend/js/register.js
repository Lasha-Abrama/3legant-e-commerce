(function () {
  var form = document.getElementById('register-form');
  var errorEl = document.getElementById('register-error');

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    errorEl.textContent = '';

    var data = {
      firstName: form.querySelector('[name="firstName"]').value,
      lastName: form.querySelector('[name="lastName"]').value,
      email: form.querySelector('[name="email"]').value,
      password: form.querySelector('[name="password"]').value,
    };
    var confirmPassword = form.querySelector('[name="confirmPassword"]').value;
    var agree = form.querySelector('[name="agree"]').checked;

    if (data.password !== confirmPassword) {
      errorEl.textContent = 'Passwords do not match.';
      return;
    }
    if (!agree) {
      errorEl.textContent = 'Please agree to the Terms of Use.';
      return;
    }

    apiPost('/auth/register', data).then(function (res) {
      if (!res) return;
      if (res._status >= 400) {
        errorEl.textContent = res.message || 'რეგისტრაცია ვერ მოხერხდა';
        return;
      }
      setAccessToken(res.accessToken);
      window.location.href = safeLocalRedirect(qs('next'), 'account.html');
    });
  });
})();
