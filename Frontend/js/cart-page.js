(function () {
  var SHIPPING_KEY = 'lc_shipping';
  var SHIPPING_OPTIONS = [
    { key: 'free', label: 'Free shipping', cost: function () { return 0; }, priceLabel: '$0.00' },
    { key: 'express', label: 'Express shipping', cost: function () { return 15; }, priceLabel: '+$15.00' },
    { key: 'pickup', label: 'Pick up (5% off)', cost: function (subtotal) { return -Math.round(subtotal * 0.05 * 100) / 100; }, priceLabel: null },
  ];

  function getShipping() { return localStorage.getItem(SHIPPING_KEY) || 'free'; }
  function setShipping(key) { localStorage.setItem(SHIPPING_KEY, key); }

  function render() {
    var items = window.CartStore.getCart();
    var container = document.getElementById('cart-items');

    if (items.length === 0) {
      container.innerHTML = '<div class="empty-note">Your cart is empty. <a href="index.html" style="color:var(--ink);">Continue shopping &rarr;</a></div>';
    } else {
      container.innerHTML = items.map(function (item, idx) {
        return (
          '<div class="cart-table-row">' +
            '<div style="display:flex;gap:14px;align-items:center;">' +
              '<div class="ph">' + item.name + '</div>' +
              '<div>' +
                '<div style="font-size:14px;font-weight:500;">' + item.name + '</div>' +
                '<div class="faint" style="font-size:12px;margin-top:2px;">Color: ' + item.color + '</div>' +
                '<button class="remove-btn" data-idx="' + idx + '" data-act="remove" style="margin-top:6px;text-decoration:underline;">&#10005; Remove</button>' +
              '</div>' +
            '</div>' +
            '<div class="qty-stepper" data-idx="' + idx + '">' +
              '<button data-act="dec">&minus;</button><span>' + item.qty + '</span><button data-act="inc">+</button>' +
            '</div>' +
            '<div style="font-size:14px;">' + fmt(item.price) + '</div>' +
            '<div style="font-size:14px;font-weight:600;">' + fmt(item.price * item.qty) + '</div>' +
          '</div>'
        );
      }).join('');

      container.querySelectorAll('[data-act]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var idx = Number(btn.getAttribute('data-idx'));
          var item = items[idx];
          var act = btn.getAttribute('data-act');
          if (act === 'inc') window.CartStore.updateQty(item.id, item.color, item.qty + 1);
          if (act === 'dec') window.CartStore.updateQty(item.id, item.color, item.qty - 1);
          if (act === 'remove') window.CartStore.removeItem(item.id, item.color);
        });
      });
    }

    var subtotal = window.CartStore.subtotal(items);
    var shippingKey = getShipping();
    document.getElementById('shipping-options').innerHTML = SHIPPING_OPTIONS.map(function (o) {
      var priceLabel = o.priceLabel || fmt(o.cost(subtotal));
      return (
        '<label class="shipping-opt' + (shippingKey === o.key ? ' is-active' : '') + '" data-ship="' + o.key + '">' +
          '<span style="display:flex;align-items:center;gap:10px;font-size:13px;">' +
            '<input type="radio" name="shipping" ' + (shippingKey === o.key ? 'checked' : '') + '> ' + o.label +
          '</span>' +
          '<span class="muted" style="font-size:13px;">' + priceLabel + '</span>' +
        '</label>'
      );
    }).join('');
    document.querySelectorAll('.shipping-opt').forEach(function (el) {
      el.addEventListener('click', function () {
        setShipping(el.getAttribute('data-ship'));
        render();
      });
    });

    var shipping = SHIPPING_OPTIONS.filter(function (o) { return o.key === shippingKey; })[0];
    var total = Math.max(0, subtotal + shipping.cost(subtotal));
    document.getElementById('subtotal-label').textContent = fmt(subtotal);
    document.getElementById('total-label').textContent = fmt(total);
  }

  render();
  window.addEventListener('cart-updated', render);
})();
