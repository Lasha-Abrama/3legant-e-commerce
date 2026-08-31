(function () {
  var form = document.getElementById('reset-password-form');
  var errorEl = document.getElementById('reset-password-error');
  var successEl = document.getElementById('reset-password-success');
  var submitButton = form.querySelector('[type="submit"]');
  var token = qs('token');

  if (!token) {
    errorEl.textContent = 'This reset link is invalid. Request a new one.';
    submitButton.disabled = true;
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    errorEl.textContent = '';
    successEl.textContent = '';
    var password = form.querySelector('[name="password"]').value;
    var confirmPassword = form.querySelector('[name="confirmPassword"]').value;
    if (password !== confirmPassword) {
      errorEl.textContent = 'Passwords do not match.';
      return;
    }

    submitButton.disabled = true;
    submitButton.textContent = 'Resetting...';
    apiPost('/auth/reset-password', { token: token, password: password }).then(function (res) {
      if (!res || res._status >= 400) {
        errorEl.textContent = (res && res.message) || 'The password could not be reset.';
        submitButton.disabled = false;
        submitButton.textContent = 'Reset password';
        return;
      }
      form.querySelectorAll('input').forEach(function (input) { input.disabled = true; });
      submitButton.style.display = 'none';
      successEl.innerHTML = escapeHtml(res.message) + ' <a href="login.html">Sign in &rarr;</a>';
    });
  });
})();
