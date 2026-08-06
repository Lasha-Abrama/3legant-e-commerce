(function () {
  var STATUSES = ['Processing', 'Shipped', 'Delivered', 'Cancelled'];

  function escapeHtml(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function loadOrders() {
    apiGetSilent('/admin/orders').then(function (orders) {
      if (!orders || !orders.length) {
        document.getElementById('orders-tbody').innerHTML = '<tr><td colspan="6" class="faint">No orders yet.</td></tr>';
        return;
      }
      document.getElementById('orders-tbody').innerHTML = orders.map(function (o) {
        var customer = o.user ? (o.user.firstName + ' ' + o.user.lastName) : (o.contact.firstName + ' ' + o.contact.lastName);
        var date = new Date(o.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
        var itemsSummary = o.items.map(function (it) { return it.name + ' &times;' + it.qty; }).join(', ');
        return (
          '<tr>' +
            '<td>#' + o._id.slice(-8) + '</td>' +
            '<td>' + escapeHtml(customer) + '<br><span class="faint" style="font-size:11px;">' + escapeHtml(o.contact.email) + '</span></td>' +
            '<td>' + date + '</td>' +
            '<td style="max-width:260px;">' + itemsSummary + '</td>' +
            '<td>' + fmt(o.total) + '</td>' +
            '<td>' +
              '<select class="status-select" data-order-id="' + o._id + '">' +
                STATUSES.map(function (s) { return '<option ' + (o.status === s ? 'selected' : '') + '>' + s + '</option>'; }).join('') +
              '</select>' +
            '</td>' +
          '</tr>'
        );
      }).join('');

      document.querySelectorAll('[data-order-id]').forEach(function (select) {
        select.addEventListener('change', function () {
          apiPatch('/admin/orders/' + select.getAttribute('data-order-id') + '/status', { status: select.value });
        });
      });
    });
  }

  AdminAuth.ready.then(function (user) {
    if (!user) return;
    loadOrders();
  });
})();
