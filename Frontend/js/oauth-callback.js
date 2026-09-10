(function () {
  var statusEl = document.getElementById('oauth-status');
  var errorEl = document.getElementById('oauth-error');
  var actionsEl = document.getElementById('oauth-actions');
  var error = qs('error');

  function showError(message) {
    document.getElementById('oauth-title').textContent = 'Sign-in could not be completed';
    statusEl.textContent = '';
    errorEl.textContent = message;
    actionsEl.hidden = false;
  }

  if (error === 'account_exists') {
    showError('This email is already registered with another sign-in method. Use your existing sign-in method, or reset your password to access the account.');
    document.getElementById('oauth-reset-password').hidden = false;
    return;
  }
  if (error === 'session_expired') {
    showError('Your Google sign-in session expired or no longer matches this browser. Return to login and start again in the same tab.');
    return;
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
      // The header can already be rotating the refresh cookie. Do not navigate
      // until its response is received: navigation can abort the cookie handoff.
      return refreshAccessToken().then(function (refreshed) {
        if (!refreshed) {
          showError('Your sign-in session could not be restored. Please sign in again.');
          return;
        }
        window.location.replace(safeLocalRedirect(qs('next'), 'account.html'));
      });
    })
    .catch(function () {
      showError(API_UNAVAILABLE_MESSAGE);
    });
})();
