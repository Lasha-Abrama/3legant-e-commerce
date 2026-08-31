(function () {
  var form = document.getElementById('forgot-password-form');
  var errorEl = document.getElementById('forgot-password-error');
  var successEl = document.getElementById('forgot-password-success');
  var submitButton = form.querySelector('[type="submit"]');

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    errorEl.textContent = '';
    successEl.textContent = '';
    submitButton.disabled = true;
    submitButton.textContent = 'Sending...';

    apiPost('/auth/forgot-password', {
      email: form.querySelector('[name="email"]').value.trim(),
    }).then(function (res) {
      submitButton.disabled = false;
      submitButton.textContent = 'Send reset link';
      if (!res || res._status >= 400) {
        errorEl.textContent = (res && res.message) || 'The reset request could not be completed.';
        return;
      }
      successEl.textContent = res.message;
      if (res.developmentResetUrl) {
        var developmentLink = document.createElement('a');
        developmentLink.href = res.developmentResetUrl;
        developmentLink.textContent = 'Open development reset link';
        developmentLink.className = 'development-reset-link';
        successEl.appendChild(developmentLink);
      }
    });
  });
})();
