(function () {
  var STATUSES = ['Processing', 'Shipped', 'Delivered', 'Cancelled'];

  function loadOrders() {
    apiGetSilent('/admin/orders').then(function (orders) {
      if (!orders || !orders.length) {
        document.getElementById('orders-tbody').innerHTML = '<tr><td colspan="6" class="faint">No orders yet.</td></tr>';
        return;
      }
      document.getElementById('orders-tbody').innerHTML = orders.map(function (o) {
        var customer = o.user ? (o.user.firstName + ' ' + o.user.lastName) : (o.contact.firstName + ' ' + o.contact.lastName);
        var date = new Date(o.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
        var itemsSummary = o.items.map(function (it) {
          return escapeHtml(it.name) + ' &times;' + escapeHtml(it.qty);
        }).join(', ');
        return (
          '<tr>' +
            '<td>#' + o._id.slice(-8) + '</td>' +
            '<td>' + escapeHtml(customer) + '<br><span class="faint" style="font-size:11px;">' + escapeHtml(o.contact.email) + '</span></td>' +
            '<td>' + date + '</td>' +
            '<td style="max-width:260px;">' + itemsSummary + '</td>' +
            '<td>' + fmt(o.total) + '</td>' +
            '<td>' +
              '<select class="status-select" data-order-id="' + escapeHtml(o._id) + '" data-current-status="' + escapeHtml(o.status) + '">' +
                STATUSES.map(function (s) { return '<option ' + (o.status === s ? 'selected' : '') + '>' + s + '</option>'; }).join('') +
              '</select>' +
            '</td>' +
          '</tr>'
        );
      }).join('');

      document.querySelectorAll('[data-order-id]').forEach(function (select) {
        select.addEventListener('change', function () {
          var previousStatus = select.getAttribute('data-current-status');
          select.disabled = true;
          apiPatch('/admin/orders/' + select.getAttribute('data-order-id') + '/status', { status: select.value }).then(function (res) {
            select.disabled = false;
            if (!res || res._status >= 400) {
              select.value = previousStatus;
              var message = res && res.message ? res.message : 'Order status could not be updated.';
              window.alert(Array.isArray(message) ? message.join('\n') : message);
              return;
            }
            select.value = res.status;
            select.setAttribute('data-current-status', res.status);
          });
        });
      });
    });
  }

  AdminAuth.ready.then(function (user) {
    if (!user) return;
    loadOrders();
  });
})();
