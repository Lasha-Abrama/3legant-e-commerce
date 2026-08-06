(function () {
  AdminAuth.ready.then(function (user) {
    if (!user) return;

    Promise.all([
      apiGetSilent('/products?take=1'),
      apiGetSilent('/admin/orders'),
      apiGetSilent('/admin/users'),
      apiGetSilent('/admin/contact-messages'),
    ]).then(function (results) {
      var products = results[0];
      var orders = results[1];
      var users = results[2];
      var messages = results[3];
      var tiles = document.querySelectorAll('#stat-grid .stat-tile__value');
      tiles[0].textContent = (products && products.total) || 0;
      tiles[1].textContent = (orders && orders.length) || 0;
      tiles[2].textContent = (users && users.length) || 0;
      tiles[3].textContent = (messages && messages.length) || 0;
    });
  });
})();
