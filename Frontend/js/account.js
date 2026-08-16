(function () {
  var TABS = [
    { key: 'account', label: 'Account' },
    { key: 'address', label: 'Address' },
    { key: 'orders', label: 'Orders' },
    { key: 'wishlist', label: 'Wishlist' },
  ];
  var state = { tab: qs('tab') || 'account', user: null };

  document.getElementById('logout-link').addEventListener('click', function (e) {
    e.preventDefault();
    apiPost('/auth/logout', {}).then(function () {
      clearAccessToken();
      window.location.href = 'index.html';
    });
  });

  function renderNav() {
    document.getElementById('account-nav').innerHTML = TABS.map(function (t) {
      return '<button class="' + (state.tab === t.key ? 'is-active' : '') + '" data-tab="' + t.key + '">' + t.label + '</button>';
    }).join('');
    document.querySelectorAll('#account-nav button').forEach(function (btn) {
      btn.addEventListener('click', function () { setTab(btn.getAttribute('data-tab')); });
    });

    var select = document.getElementById('account-mobile-select');
    select.innerHTML = TABS.map(function (t) {
      return '<option value="' + t.key + '"' + (state.tab === t.key ? ' selected' : '') + '>' + t.label + '</option>';
    }).join('');
    select.onchange = function () { setTab(select.value); };
  }

  function setTab(tab) {
    state.tab = tab;
    renderNav();
    renderContent();
  }

  function renderContent() {
    var content = document.getElementById('account-content');
    if (state.tab === 'account') return renderAccountTab(content);
    if (state.tab === 'address') return renderAddressTab(content);
    if (state.tab === 'orders') return renderOrdersTab(content);
    if (state.tab === 'wishlist') return renderWishlistTab(content);
  }

  function renderAccountTab(content) {
    var u = state.user;
    content.innerHTML =
      '<div class="account-section-title">Account Details</div>' +
      '<div class="row-2">' +
        '<div class="field"><span class="field__label">FIRST NAME *</span><input class="input" id="f-firstName" value="' + (u.firstName || '') + '"></div>' +
        '<div class="field"><span class="field__label">LAST NAME *</span><input class="input" id="f-lastName" value="' + (u.lastName || '') + '"></div>' +
      '</div>' +
      '<div class="field"><span class="field__label">DISPLAY NAME *</span><input class="input" id="f-displayName" value="' + (u.displayName || '') + '"></div>' +
      '<div class="faint" style="font-size:11px;margin-bottom:16px;">This will be how your name will be displayed in the account section and in reviews.</div>' +
      '<div class="field"><span class="field__label">EMAIL *</span><input class="input" id="f-email" value="' + (u.email || '') + '"></div>' +
      '<div class="field"><span class="field__label">PHONE</span><input class="input" id="f-phone" value="' + (u.phone || '') + '"></div>' +
      '<div class="error-text" id="profile-msg"></div>' +
      '<button class="btn btn--dark" id="save-profile" style="margin-bottom:28px;">Save changes</button>' +

      '<div style="font-size:15px;font-weight:600;margin-bottom:16px;">Password</div>' +
      '<div style="display:flex;flex-direction:column;gap:12px;max-width:400px;margin-bottom:12px;">' +
        '<div class="field"><span class="field__label">OLD PASSWORD</span><input class="input" type="password" id="f-oldPassword"></div>' +
        '<div class="field"><span class="field__label">NEW PASSWORD</span><input class="input" type="password" id="f-newPassword"></div>' +
        '<div class="field"><span class="field__label">REPEAT NEW PASSWORD</span><input class="input" type="password" id="f-repeatPassword"></div>' +
      '</div>' +
      '<div class="error-text" id="password-msg"></div>' +
      '<button class="btn btn--dark" id="save-password">Update password</button>';

    document.getElementById('save-profile').addEventListener('click', function () {
      var msg = document.getElementById('profile-msg');
      apiPatch('/users/me', {
        firstName: document.getElementById('f-firstName').value,
        lastName: document.getElementById('f-lastName').value,
        displayName: document.getElementById('f-displayName').value,
        email: document.getElementById('f-email').value,
        phone: document.getElementById('f-phone').value,
      }).then(function (res) {
        if (!res) return;
        if (res._status >= 400) { msg.style.color = 'var(--red)'; msg.textContent = res.message; return; }
        state.user = res;
        msg.style.color = 'var(--green)';
        msg.textContent = 'Saved.';
        document.getElementById('account-name').textContent = res.displayName || (res.firstName + ' ' + res.lastName);
      });
    });

    document.getElementById('save-password').addEventListener('click', function () {
      var msg = document.getElementById('password-msg');
      var oldPassword = document.getElementById('f-oldPassword').value;
      var newPassword = document.getElementById('f-newPassword').value;
      var repeat = document.getElementById('f-repeatPassword').value;
      if (newPassword !== repeat) { msg.style.color = 'var(--red)'; msg.textContent = 'Passwords do not match.'; return; }
      apiPatch('/users/me/password', { oldPassword: oldPassword, newPassword: newPassword }).then(function (res) {
        if (!res) return;
        if (res._status >= 400) { msg.style.color = 'var(--red)'; msg.textContent = res.message; return; }
        msg.style.color = 'var(--green)';
        msg.textContent = 'Password updated.';
        document.getElementById('f-oldPassword').value = '';
        document.getElementById('f-newPassword').value = '';
        document.getElementById('f-repeatPassword').value = '';
      });
    });
  }

  function addressCard(type, label, addr) {
    var has = addr && (addr.street || addr.fullName);
    return (
      '<div class="address-card" data-type="' + type + '">' +
        '<div class="address-card__head"><span style="font-size:13px;font-weight:600;">' + label + '</span><span style="font-size:12px;text-decoration:underline;cursor:pointer;" class="edit-address" data-type="' + type + '">&#9998; Edit</span></div>' +
        '<div class="address-view" style="font-size:13px;color:#4a4843;line-height:1.7;">' +
          (has
            ? (addr.fullName || '') + '<br>' + (addr.phone || '') + '<br>' + [addr.street, addr.city, addr.state, addr.zip, addr.country].filter(Boolean).join(', ')
            : '<span class="faint">No address on file yet.</span>') +
        '</div>' +
      '</div>'
    );
  }

  function renderAddressTab(content) {
    var u = state.user;
    content.innerHTML =
      '<div class="account-section-title">Address</div>' +
      '<div class="address-grid" id="address-grid">' +
        addressCard('billing', 'Billing Address', u.billingAddress) +
        addressCard('shipping', 'Shipping Address', u.shippingAddress) +
      '</div>';

    content.querySelectorAll('.edit-address').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var type = btn.getAttribute('data-type');
        openAddressForm(type);
      });
    });
  }

  function openAddressForm(type) {
    var addr = (type === 'billing' ? state.user.billingAddress : state.user.shippingAddress) || {};
    var card = document.querySelector('.address-card[data-type="' + type + '"]');
    card.innerHTML =
      '<div class="address-card__head"><span style="font-size:13px;font-weight:600;">' + (type === 'billing' ? 'Billing Address' : 'Shipping Address') + '</span></div>' +
      '<div class="field"><input class="input" placeholder="Full name" id="addr-fullName" value="' + (addr.fullName || '') + '"></div>' +
      '<div class="field"><input class="input" placeholder="Phone" id="addr-phone" value="' + (addr.phone || '') + '"></div>' +
      '<div class="field"><input class="input" placeholder="Street" id="addr-street" value="' + (addr.street || '') + '"></div>' +
      '<div class="row-2" style="margin-bottom:12px;">' +
        '<input class="input" placeholder="City" id="addr-city" value="' + (addr.city || '') + '">' +
        '<input class="input" placeholder="State" id="addr-state" value="' + (addr.state || '') + '">' +
      '</div>' +
      '<div class="row-2" style="margin-bottom:12px;">' +
        '<input class="input" placeholder="Zip" id="addr-zip" value="' + (addr.zip || '') + '">' +
        '<input class="input" placeholder="Country" id="addr-country" value="' + (addr.country || '') + '">' +
      '</div>' +
      '<button class="btn btn--dark" id="save-address">Save</button>';

    document.getElementById('save-address').addEventListener('click', function () {
      apiPatch('/users/me/address', {
        type: type,
        fullName: document.getElementById('addr-fullName').value,
        phone: document.getElementById('addr-phone').value,
        street: document.getElementById('addr-street').value,
        city: document.getElementById('addr-city').value,
        state: document.getElementById('addr-state').value,
        zip: document.getElementById('addr-zip').value,
        country: document.getElementById('addr-country').value,
      }).then(function (res) {
        if (!res || res._status >= 400) return;
        state.user = res;
        renderAddressTab(document.getElementById('account-content'));
      });
    });
  }

  function renderOrdersTab(content) {
    content.innerHTML = '<div class="account-section-title">Orders History</div><div id="orders-list" class="faint" style="font-size:13px;">Loading...</div>';
    apiGet('/orders/me').then(function (orders) {
      if (!orders) return;
      var list = document.getElementById('orders-list');
      if (!orders.length) {
        list.innerHTML = '<div class="faint" style="font-size:13px;">No orders yet.</div>';
        return;
      }
      list.innerHTML =
        '<div class="orders-head"><span>Number ID</span><span>Date</span><span>Status</span><span>Price</span></div>' +
        orders.map(function (o) {
          var date = new Date(o.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
          return (
            '<div class="order-row">' +
              '<span data-label="Number ID">#' + o._id.slice(-8) + '</span>' +
              '<span data-label="Date">' + date + '</span>' +
              '<span data-label="Status" style="color:var(--green);">' + o.status + '</span>' +
              '<span data-label="Price">' + fmt(o.total) + '</span>' +
            '</div>'
          );
        }).join('');
    });
  }

  function renderWishlistTab(content) {
    content.innerHTML = '<div class="account-section-title">Your Wishlist</div><div id="wishlist-list" class="faint" style="font-size:13px;">Loading...</div>';
    apiGet('/users/me/wishlist').then(function (items) {
      if (!items) return;
      var list = document.getElementById('wishlist-list');
      if (!items.length) {
        list.innerHTML = '<div class="faint" style="font-size:13px;">Your wishlist is empty. <a href="shop.html" style="color:var(--ink);">Browse products &rarr;</a></div>';
        return;
      }
      list.innerHTML = items.map(function (p) {
        var color = (p.colors && p.colors[0] && p.colors[0].name) || 'Default';
        return (
          '<div class="wishlist-row">' +
            '<div class="ph">' + p.imageLabel + '</div>' +
            '<div style="flex:1;">' +
              '<div style="font-size:13px;font-weight:500;">' + p.name + '</div>' +
              '<div class="faint" style="font-size:11px;">Color: ' + color + '</div>' +
              '<div style="font-size:13px;font-weight:600;margin-top:2px;">' + fmt(p.price) + '</div>' +
            '</div>' +
            '<button class="btn btn--dark" data-add="' + p._id + '" data-name="' + p.name + '" data-color="' + color + '" data-price="' + p.price + '" style="padding:10px 18px;font-size:12px;">Add to cart</button>' +
            '<button class="remove-btn" data-remove="' + p._id + '" style="margin-left:8px;">&#10005;</button>' +
          '</div>'
        );
      }).join('');
      list.querySelectorAll('[data-add]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          window.CartStore.addItem({ id: btn.getAttribute('data-add'), name: btn.getAttribute('data-name'), color: btn.getAttribute('data-color'), price: parseFloat(btn.getAttribute('data-price')), qty: 1 });
          btn.textContent = 'Added ✓';
        });
      });
      list.querySelectorAll('[data-remove]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          apiDelete('/users/me/wishlist/' + btn.getAttribute('data-remove')).then(function () { renderWishlistTab(content); });
        });
      });
    });
  }

  apiGetSilent('/auth/me').then(function (res) {
    if (!res || !res.user) {
      window.location.href = 'login.html?next=' + encodeURIComponent('account.html');
      return;
    }
    state.user = res.user;
    document.getElementById('account-name').textContent = res.user.displayName || (res.user.firstName + ' ' + res.user.lastName);
    renderNav();
    renderContent();
  });
})();
