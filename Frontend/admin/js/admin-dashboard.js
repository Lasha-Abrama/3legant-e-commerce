(function () {
  AdminAuth.ready.then(function (user) {
    if (!user) return;

    Promise.all([
      apiGetSilent('/products?take=1'),
      apiGetSilent('/blogs?take=1'),
      apiGetSilent('/admin/orders'),
      apiGetSilent('/admin/users'),
      apiGetSilent('/admin/contact-messages'),
    ]).then(function (results) {
      var products = results[0];
      var blogs = results[1];
      var orders = results[2];
      var users = results[3];
      var messages = results[4];
      var tiles = document.querySelectorAll('#stat-grid .stat-tile__value');
      tiles[0].textContent = (products && products.total) || 0;
      tiles[1].textContent = (blogs && blogs.total) || 0;
      tiles[2].textContent = (orders && orders.length) || 0;
      tiles[3].textContent = (users && users.length) || 0;
      tiles[4].textContent = (messages && messages.length) || 0;
    });
  });
})();
