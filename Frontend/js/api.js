var API = '/api';
var ACCESS_TOKEN_KEY = 'threelegant_access_token';

function getAuthHeaders() {
  var token = localStorage.getItem(ACCESS_TOKEN_KEY);
  return token ? { Authorization: 'Bearer ' + token } : {};
}

function setAccessToken(token) {
  if (token) {
    localStorage.setItem(ACCESS_TOKEN_KEY, token);
  }
}

function clearAccessToken() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
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
    return res.json().then(function (json) {
      json._status = res.status;
      return json;
    });
  });
}

function apiGetSilent(url) {
  return fetch(API + url, { headers: getAuthHeaders() }).then(function (res) {
    if (res.status === 401) {
      clearAccessToken();
    }
    return res.json().then(function (json) {
      json._status = res.status;
      return json;
    });
  });
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
    return res
      .json()
      .catch(function () {
        return {};
      })
      .then(function (json) {
        json._status = res.status;
        return json;
      });
  });
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
    return res.json().then(function (json) {
      json._status = res.status;
      return json;
    });
  });
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
