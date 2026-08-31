var API = '/api';
var ACCESS_TOKEN_KEY = 'threelegant_access_token';
var API_UNAVAILABLE_MESSAGE = 'The service is currently unavailable. Please try again.';

function apiFailure() {
  return { _status: 503, _networkError: true, message: API_UNAVAILABLE_MESSAGE };
}

function parseApiResponse(res) {
  return res
    .json()
    .catch(function () {
      return {};
    })
    .then(function (json) {
      json._status = res.status;
      return json;
    });
}

function renderRetryState(container, message, retry) {
  if (!container) return;
  container.innerHTML =
    '<div class="service-state">' +
      '<p>' + escapeHtml(message || API_UNAVAILABLE_MESSAGE) + '</p>' +
      '<button class="btn btn--outline" type="button">Try again</button>' +
    '</div>';
  container.querySelector('button').addEventListener('click', retry);
}

function getAuthHeaders() {
  var token = localStorage.getItem(ACCESS_TOKEN_KEY) || sessionStorage.getItem(ACCESS_TOKEN_KEY);
  return token ? { Authorization: 'Bearer ' + token } : {};
}

function setAccessToken(token, remember) {
  clearAccessToken();
  if (!token) return;
  var storage = remember === false ? sessionStorage : localStorage;
  storage.setItem(ACCESS_TOKEN_KEY, token);
}

function clearAccessToken() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  sessionStorage.removeItem(ACCESS_TOKEN_KEY);
}

function redirectToLogin() {
  var next = encodeURIComponent(location.pathname + location.search);
  window.location.href = 'login.html?next=' + next;
}

function apiGet(url) {
  return fetch(API + url, { headers: getAuthHeaders() }).then(function (res) {
    if (res.status === 401) {
      clearAccessToken();
      redirectToLogin();
      return null;
    }
    return parseApiResponse(res);
  }).catch(apiFailure);
}

function apiGetSilent(url) {
  return fetch(API + url, { headers: getAuthHeaders() }).then(function (res) {
    if (res.status === 401) {
      clearAccessToken();
    }
    return parseApiResponse(res);
  }).catch(apiFailure);
}

function apiSend(method, url, data) {
  return fetch(API + url, {
    method: method,
    headers: Object.assign({ 'Content-Type': 'application/json' }, getAuthHeaders()),
    body: data !== undefined ? JSON.stringify(data) : undefined,
  }).then(function (res) {
    if (res.status === 401) {
      clearAccessToken();
      redirectToLogin();
      return null;
    }
    return parseApiResponse(res);
  }).catch(apiFailure);
}

function apiUpload(url, file) {
  var formData = new FormData();
  formData.append('file', file);
  return fetch(API + url, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: formData,
  }).then(function (res) {
    if (res.status === 401) {
      clearAccessToken();
      redirectToLogin();
      return null;
    }
    return parseApiResponse(res);
  }).catch(apiFailure);
}

function validateImageUpload(file) {
  var allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (allowedTypes.indexOf(file.type) === -1) {
    return 'Choose a JPEG, PNG, GIF, or WebP image.';
  }
  if (file.size > 4 * 1024 * 1024) {
    return 'Images must be 4 MB or smaller.';
  }
  return '';
}

function apiPost(url, data) {
  return apiSend('POST', url, data);
}

function apiPatch(url, data) {
  return apiSend('PATCH', url, data);
}

function apiDelete(url) {
  return apiSend('DELETE', url);
}

function fmt(n) {
  return '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function qs(name) {
  return new URLSearchParams(window.location.search).get(name);
}

function safeLocalRedirect(value, fallback) {
  var fallbackPath = fallback || 'index.html';
  var candidate = String(value == null ? '' : value).trim();
  if (!candidate) return fallbackPath;
  try {
    var parsed = new URL(candidate, window.location.href);
    if (!/^https?:$/.test(parsed.protocol) || parsed.origin !== window.location.origin) {
      return fallbackPath;
    }
    return parsed.pathname + parsed.search + parsed.hash;
  } catch (error) {
    return fallbackPath;
  }
}

function escapeHtml(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, function (character) {
    return {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[character];
  });
}

function safeImageUrl(value) {
  var url = String(value == null ? '' : value).trim();
  if (!url) return '';
  try {
    var parsed = new URL(url, window.location.href);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';
    return escapeHtml(url);
  } catch (error) {
    return '';
  }
}

function safeCssColor(value) {
  var color = String(value == null ? '' : value).trim();
  return /^#[0-9a-f]{3,8}$/i.test(color) ? color : '#c9c4b8';
}
