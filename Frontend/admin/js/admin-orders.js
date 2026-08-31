(function () {
  var PAYMENT_CLASSES = {
    paid: 'pill--paid',
    refunded: 'pill--refunded',
    failed: 'pill--failed',
    pending: 'pill--pending',
  };

  function paymentStatusHtml(order) {
    var paymentStatus = String(order.paymentStatus || 'pending');
    var statusClass = PAYMENT_CLASSES[paymentStatus] || 'pill--user';
    return (
      '<span class="pill ' + statusClass + '">' + escapeHtml(paymentStatus) + '</span>' +
      '<div class="faint" style="font-size:10px;margin-top:4px;">Inventory: ' + escapeHtml(order.inventoryStatus || 'pending') + '</div>'
    );
  }

  function refundActionHtml(order) {
    var canRefund = order.status === 'Processing' && order.paymentStatus === 'paid' && order.stripePaymentIntentId;
    if (!canRefund) return '<span class="faint">—</span>';
    return '<button class="btn btn-danger btn-sm" data-refund-order="' + escapeHtml(order._id) + '">Refund</button>';
  }

  function hasActiveCheckoutSession(order) {
    if (order.checkoutSessionStatus === 'completed') return true;
    if (order.checkoutSessionStatus !== 'open') return false;
    if (!order.stripeCheckoutExpiresAt) return true;
    return new Date(order.stripeCheckoutExpiresAt).getTime() > Date.now();
  }

  function canCancel(order) {
    if (order.paymentStatus === 'paid') return false;
    return order.paymentStatus !== 'pending' || !hasActiveCheckoutSession(order);
  }

  function availableStatuses(order) {
    var statuses = [order.status];
    if (order.status === 'Processing') {
      if (order.paymentStatus === 'paid' && order.inventoryStatus === 'adjusted') {
        statuses.push('Shipped');
      }
      if (canCancel(order)) statuses.push('Cancelled');
    } else if (order.status === 'Shipped') {
      statuses.push('Delivered');
    }
    return statuses;
  }

  function statusSelectHtml(order) {
    var statuses = availableStatuses(order);
    var disabled = statuses.length === 1 ? ' disabled title="No status changes available"' : '';
    return (
      '<select class="status-select" data-order-id="' + escapeHtml(order._id) + '" data-current-status="' + escapeHtml(order.status) + '"' + disabled + '>' +
        statuses.map(function (status) {
          return '<option ' + (order.status === status ? 'selected' : '') + '>' + status + '</option>';
        }).join('') +
      '</select>'
    );
  }

  function loadOrders() {
    apiGetSilent('/admin/orders').then(function (orders) {
      if (!orders || !orders.length) {
        document.getElementById('orders-tbody').innerHTML = '<tr><td colspan="8" class="faint">No orders yet.</td></tr>';
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
            '<td>' + paymentStatusHtml(o) + '</td>' +
            '<td>' + statusSelectHtml(o) + '</td>' +
            '<td>' + refundActionHtml(o) + '</td>' +
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
            loadOrders();
          });
        });
      });

      document.querySelectorAll('[data-refund-order]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var orderId = btn.getAttribute('data-refund-order');
          var orderCode = '#' + orderId.slice(-8);
          if (!confirm('Issue a full Stripe refund for order ' + orderCode + '?')) return;

          btn.disabled = true;
          btn.textContent = 'Requesting…';
          apiPost('/admin/payments/orders/' + encodeURIComponent(orderId) + '/refund', {}).then(function (res) {
            if (!res || res._status >= 400) {
              btn.disabled = false;
              btn.textContent = 'Refund';
              var message = res && res.message ? res.message : 'Refund could not be requested.';
              window.alert(Array.isArray(message) ? message.join('\n') : message);
              return;
            }
            btn.textContent = 'Refund requested';
            window.alert('Refund requested. Stripe will finalize the order after the signed webhook arrives.');
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
