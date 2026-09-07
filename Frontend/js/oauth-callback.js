(function () {
  var statusEl = document.getElementById('oauth-status');
  var errorEl = document.getElementById('oauth-error');
  var actionsEl = document.getElementById('oauth-actions');
  var error = qs('error');

  function showError(message) {
    statusEl.textContent = '';
    errorEl.textContent = message;
    actionsEl.hidden = false;
  }

  if (error === 'cancelled') {
    showError('Google sign-in was cancelled. You can try again whenever you are ready.');
    return;
  }
  if (error) {
    showError('Google sign-in could not be completed. Please try again.');
    return;
  }

  fetch(API + '/auth/google/session', { credentials: 'same-origin' })
    .then(parseApiResponse)
    .then(function (result) {
      if (result._status >= 400 || !result.accessToken) {
        showError(result.message || 'Your Google sign-in session expired. Please try again.');
        return;
      }
      setAccessToken(result.accessToken, true);
      window.location.replace(safeLocalRedirect(qs('next'), 'account.html'));
    })
    .catch(function () {
      showError(API_UNAVAILABLE_MESSAGE);
    });
})();
