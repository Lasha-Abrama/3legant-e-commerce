(function () {
  var coupons = [];
  var editor = document.getElementById('coupon-editor');
  var message = document.getElementById('coupon-message');

  function load() {
    return apiGet('/admin/coupons').then(function (result) {
      if (!Array.isArray(result)) { message.textContent = result && result.message || 'Could not load coupons.'; return; }
      coupons = result;
      document.getElementById('coupons-body').innerHTML = coupons.map(function (coupon) {
        var expired = Date.parse(coupon.expiresAt) <= Date.now();
        return '<tr><td>' + escapeHtml(coupon.code) + '</td><td>' + Number(coupon.percentage) +
          '%</td><td>' + Number(coupon.usedCount) + ' / ' + (coupon.usageLimit == null ? 'Unlimited' : Number(coupon.usageLimit)) +
          '</td><td>' + Number(coupon.reservedCount) + '</td><td>' + escapeHtml(new Date(coupon.expiresAt).toLocaleString()) +
          '</td><td>' + (expired ? 'Expired' : coupon.active ? 'Active' : 'Inactive') +
          '</td><td><button class="btn btn--outline btn-sm" data-edit="' + escapeHtml(coupon._id) + '">Edit</button> ' +
          (coupon.active ? '<button class="btn btn--outline btn-sm" data-deactivate="' + escapeHtml(coupon._id) + '">Deactivate</button>' : '') +
          '</td></tr>';
      }).join('') || '<tr><td colspan="7">No coupons yet. Add your first coupon.</td></tr>';
    });
  }

  function localDate(value) {
    var date = new Date(value);
    date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
    return date.toISOString().slice(0, 16);
  }

  function edit(coupon) {
    coupon = coupon || {};
    var initialExpiry = coupon.expiresAt ? localDate(coupon.expiresAt) : '';
    editor.hidden = false;
    editor.innerHTML = '<form id="coupon-form"><h2>' + (coupon._id ? 'Edit coupon' : 'Create coupon') + '</h2>' +
      '<label class="field">Code<input class="input" name="code" required minlength="4" maxlength="32" pattern="[A-Za-z0-9][A-Za-z0-9-]{3,31}" value="' + escapeHtml(coupon.code || '') + '"></label>' +
      '<button class="btn btn--outline btn-sm" type="button" id="generate-coupon">Generate Coupon</button>' +
      '<label class="field">Percentage (1–100)<input class="input" type="number" name="percentage" required min="1" max="100" step="1" value="' + Number(coupon.percentage || 10) + '"></label>' +
      '<label class="field">Total usage limit (blank = unlimited)<input class="input" type="number" name="usageLimit" min="1" max="1000000000" step="1" value="' + (coupon.usageLimit == null ? '' : Number(coupon.usageLimit)) + '"></label>' +
      '<label class="field">Expiration (your local time)<input class="input" type="datetime-local" name="expiresAt" required value="' + initialExpiry + '"></label>' +
      '<label class="field"><span><input type="checkbox" name="active"' + (coupon.active !== false ? ' checked' : '') + '> Active</span></label>' +
      '<p role="status" id="coupon-form-message"></p><button class="btn btn--dark btn-sm" type="submit">Save coupon</button> ' +
      '<button class="btn btn--outline btn-sm" type="button" id="cancel-coupon">Cancel</button></form>';
    var form = document.getElementById('coupon-form');
    var status = document.getElementById('coupon-form-message');
    document.getElementById('cancel-coupon').onclick = function () { editor.hidden = true; };
    document.getElementById('generate-coupon').onclick = function () {
      var button = this;
      button.disabled = true;
      apiPost('/admin/coupons/generate', {}).then(function (result) {
        button.disabled = false;
        if (result && result.code) form.elements.code.value = result.code;
        else status.textContent = result && result.message || 'Could not generate a coupon.';
      });
    };
    form.onsubmit = function (event) {
      event.preventDefault();
      var data = {
        code: form.elements.code.value.trim().toUpperCase(),
        percentage: Number(form.elements.percentage.value),
        usageLimit: form.elements.usageLimit.value ? Number(form.elements.usageLimit.value) : null,
        active: form.elements.active.checked,
      };
      if (!coupon._id || form.elements.expiresAt.value !== initialExpiry) {
        var expires = new Date(form.elements.expiresAt.value);
        if (!Number.isFinite(expires.getTime()) || expires.getTime() <= Date.now()) {
          status.textContent = 'Expiration date must be in the future.'; return;
        }
        data.expiresAt = expires.toISOString();
      }
      var save = form.querySelector('[type="submit"]');
      save.disabled = true;
      (coupon._id ? apiPatch('/admin/coupons/' + coupon._id, data) : apiPost('/admin/coupons', data)).then(function (result) {
        save.disabled = false;
        if (!result || result._status >= 400) {
          status.textContent = result && result.message || 'Could not save coupon.'; return;
        }
        editor.hidden = true;
        message.textContent = 'Coupon saved.';
        load();
      });
    };
    form.elements.code.focus();
  }

  document.getElementById('add-coupon').onclick = function () { edit(); };
  document.getElementById('coupons-body').onclick = function (event) {
    var editButton = event.target.closest('[data-edit]');
    if (editButton) { edit(coupons.find(function (coupon) { return coupon._id === editButton.dataset.edit; })); return; }
    var deactivate = event.target.closest('[data-deactivate]');
    if (!deactivate) return;
    deactivate.disabled = true;
    apiDelete('/admin/coupons/' + deactivate.dataset.deactivate).then(function (result) {
      deactivate.disabled = false;
      if (!result || result._status >= 400) { message.textContent = result && result.message || 'Could not deactivate coupon.'; return; }
      message.textContent = 'Coupon deactivated. Existing payment reservations are still honored.';
      load();
    });
  };
  AdminAuth.ready.then(function (user) { if (user) load(); });
})();
