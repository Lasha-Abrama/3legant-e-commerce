var API = '/api';
var ACCESS_TOKEN_KEY = 'threelegant_access_token';
var accessToken = '';
var accessTokenExpiresAt = 0;
var sessionReady = false;
var refreshRequest = null;
try { localStorage.removeItem(ACCESS_TOKEN_KEY); sessionStorage.removeItem(ACCESS_TOKEN_KEY); } catch (error) {}
var API_UNAVAILABLE_MESSAGE = 'The service is currently unavailable. Please try again.';

function productImageUrl(product) {
  var image = product.image || (product.images && product.images[0]);
  if (image && safeImageUrl(image)) return image;
  return product.name === 'Tray Table' ? 'images/products/tray-table.jpg' : '';
}

function cartImageHtml(item) {
  var url = safeImageUrl(productImageUrl(item));
  return '<div class="ph cart-product-image">' + (url
    ? '<img class="product-img" src="' + url + '" alt="' + escapeHtml(item.name) + '">'
    : escapeHtml(item.name)) + '</div>';
}

// Replace only legacy seed artwork; custom article uploads retain their own images.
function articleImageUrl(article) {
  var artwork = {
    '/images/hero-living-room.webp': 'images/slides/slide_3.jpg',
    '/images/category-kitchen.jpg': 'images/slides/slide_4.jpg',
    '/images/category-bedroom.jpg': 'images/slides/slide_5.jpg',
    '/images/category-living-room.jpg': 'images/slides/slide_3.jpg',
  };
  return artwork[article.image] || article.image;
}

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
  return accessToken ? { Authorization: 'Bearer ' + accessToken } : {};
}

function setAccessToken(token, remember) {
  accessToken = token || '';
  accessTokenExpiresAt = Date.now() + 19 * 60 * 1000;
  try {
    var payload = JSON.parse(atob(accessToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    if (Number.isFinite(payload.exp)) accessTokenExpiresAt = payload.exp * 1000 - 60 * 1000;
  } catch (error) {}
  sessionReady = true;
}

function clearAccessToken() {
  accessToken = '';
  accessTokenExpiresAt = 0;
  sessionReady = true;
  try { localStorage.removeItem(ACCESS_TOKEN_KEY); sessionStorage.removeItem(ACCESS_TOKEN_KEY); } catch (error) {}
}

function refreshAccessToken() {
  if (refreshRequest) return refreshRequest;
  function rotate() {
    return fetch(API + '/auth/refresh', {
      method: 'POST', credentials: 'same-origin', headers: { 'X-Requested-With': 'threelegant' },
    }).then(function (response) {
      if (response.status === 401) { clearAccessToken(); return false; }
      if (!response.ok) throw new Error(API_UNAVAILABLE_MESSAGE);
      return response.json().then(function (data) { setAccessToken(data.accessToken); return true; });
    });
  }
  refreshRequest = (navigator.locks ? navigator.locks.request('threelegant-session', rotate) : rotate())
    .finally(function () { refreshRequest = null; });
  return refreshRequest;
}

function authenticatedFetch(url, options) {
  options = options || {};
  var ready = !sessionReady || (accessToken && Date.now() >= accessTokenExpiresAt)
    ? refreshAccessToken() : Promise.resolve();
  function send() {
    return fetch(API + url, Object.assign({}, options, {
      credentials: 'same-origin',
      headers: Object.assign({}, options.headers, getAuthHeaders()),
    }));
  }
  return ready.then(send).then(function (response) {
    if (response.status !== 401 || url === '/auth/login' || url === '/auth/register') return response;
    return refreshAccessToken().then(function (refreshed) { return refreshed ? send() : response; });
  });
}

function redirectToLogin() {
  var next = encodeURIComponent(location.pathname + location.search);
  window.location.href = 'login.html?next=' + next;
}

function apiGet(url) {
  return authenticatedFetch(url).then(function (res) {
    if (res.status === 401) {
      clearAccessToken();
      redirectToLogin();
      return null;
    }
    return parseApiResponse(res);
  }).catch(apiFailure);
}

function apiGetSilent(url) {
  return authenticatedFetch(url).then(function (res) {
    if (res.status === 401) {
      clearAccessToken();
    }
    return parseApiResponse(res);
  }).catch(apiFailure);
}

function apiGetPublic(url) {
  return fetch(API + url, { credentials: 'same-origin' })
    .then(parseApiResponse)
    .catch(apiFailure);
}

function apiSend(method, url, data) {
  return authenticatedFetch(url, {
    method: method,
    headers: { 'Content-Type': 'application/json' },
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

function apiUpload(url, file, options) {
  options = options || {};
  var formData = new FormData();
  formData.append(options.field || 'file', file);
  return authenticatedFetch(url, {
    method: options.method || 'POST',
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

function apiProfileImage(file) {
  var formData = new FormData();
  formData.append('image', file);
  return authenticatedFetch('/users/me/profile-image', {
    method: 'PATCH',
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
