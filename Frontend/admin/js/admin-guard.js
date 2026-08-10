(function () {
  var NAV = [
    { key: 'dashboard', label: 'Dashboard', href: 'index.html' },
    { key: 'products', label: 'Products', href: 'products.html' },
    { key: 'blogs', label: 'Blog', href: 'blogs.html' },
    { key: 'orders', label: 'Orders', href: 'orders.html' },
    { key: 'users', label: 'Users', href: 'users.html' },
    { key: 'messages', label: 'Messages', href: 'messages.html' },
    { key: 'reviews', label: 'Reviews', href: 'reviews.html' },
  ];

  function renderShell(active) {
    var shell = document.getElementById('admin-shell');
    if (!shell) return;
    shell.innerHTML =
      '<div class="admin-sidebar">' +
        '<div class="admin-sidebar__brand">Gita_3_Team_2<span>Admin panel</span></div>' +
        '<nav class="admin-nav">' +
          NAV.map(function (item) {
            return '<a href="' + item.href + '" class="' + (item.key === active ? 'is-active' : '') + '">' + item.label + '</a>';
          }).join('') +
        '</nav>' +
        '<div class="admin-sidebar__footer">' +
          '<a href="../index.html">&larr; View storefront</a>' +
          '<a href="#" id="admin-logout">Log out</a>' +
        '</div>' +
      '</div>';

    document.getElementById('admin-logout').addEventListener('click', function (e) {
      e.preventDefault();
      apiPost('/auth/logout', {}).then(function () {
        window.location.href = 'login.html';
      });
    });
  }

  var active = document.body.getAttribute('data-admin-page') || '';

  window.AdminAuth = {
    ready: apiGetSilent('/auth/me').then(function (res) {
      if (!res || !res.user || !res.user.isAdmin) {
        window.location.href = 'login.html';
        return null;
      }
      renderShell(active);
      return res.user;
    }),
  };
})();
