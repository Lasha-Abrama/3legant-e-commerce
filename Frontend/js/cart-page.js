(function () {
  var SHIPPING_KEY = 'lc_shipping';
  var SHIPPING_OPTIONS = [
    { key: 'free', label: 'Free shipping', cost: function () { return 0; }, priceLabel: '$0.00' },
    { key: 'express', label: 'Express shipping', cost: function () { return 15; }, priceLabel: '+$15.00' },
    { key: 'pickup', label: 'Pick up (5% off)', cost: function (subtotal) { return -Math.round(subtotal * 0.05 * 100) / 100; }, priceLabel: null },
  ];

  function getShipping() { var key = localStorage.getItem(SHIPPING_KEY); return ['free', 'express', 'pickup'].includes(key) ? key : 'free'; }
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
              cartImageHtml(item) +
              '<div>' +
                '<div style="font-size:14px;font-weight:500;">' + escapeHtml(item.name) + '</div>' +
                '<div class="faint" style="font-size:12px;margin-top:2px;">Color: ' + escapeHtml(item.color) + '</div>' +
                (window.CartStore.stockLimit(item) === null ? '' : '<div class="faint" style="font-size:12px;margin-top:2px;">' + window.CartStore.stockLimit(item) + ' available</div>') +
                (item.unavailable ? '<div class="error-text">This product is currently unavailable.</div>' : '') +
                '<button class="remove-btn" data-idx="' + idx + '" data-act="remove" style="margin-top:6px;text-decoration:underline;">&#10005; Remove</button>' +
              '</div>' +
            '</div>' +
            '<div class="qty-stepper" data-idx="' + idx + '">' +
              '<button data-act="dec"' + (item.qty <= 1 || item.unavailable ? ' disabled' : '') + '>&minus;</button><span>' + item.qty + '</span><button data-act="inc"' + (window.CartStore.canIncrement(item) && !item.unavailable ? '' : ' disabled') + '>+</button>' +
            '</div>' +
            '<div style="font-size:14px;">' + fmt(item.price) + '</div>' +
            '<div style="font-size:14px;font-weight:600;">' + fmt(item.price * item.qty) + '</div>' +
          '</div>'
        );
      }).join('');

      container.querySelectorAll('[data-act]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var idx = Number(btn.closest('[data-idx]').getAttribute('data-idx'));
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

    var pricing = window.CartStore.pricing();
    window.CartStore.refreshPricing();
    document.getElementById('subtotal-label').textContent = pricing && !pricing.error ? fmt(pricing.subtotal) : '—';
    document.getElementById('total-label').textContent = pricing && !pricing.error ? fmt(pricing.total) : '—';
    document.getElementById('discount-label').textContent = pricing && pricing.discount ? '−' + fmt(pricing.discount) : fmt(0);
    document.getElementById('pricing-error').textContent = pricing && pricing.error || '';
    var checkoutLink = document.getElementById('cart-checkout-link');
    var canCheckout = pricing && !pricing.error && items.length > 0 && items.every(function (item) { return !item.unavailable; });
    checkoutLink.classList.toggle('is-disabled', !canCheckout);
    checkoutLink.setAttribute('aria-disabled', String(!canCheckout));
    if (canCheckout) checkoutLink.setAttribute('href', 'checkout.html');
    else checkoutLink.removeAttribute('href');
  }

  document.getElementById('cart-coupon').innerHTML = window.CartStore.couponHtml();
  window.CartStore.wireCoupon(document.getElementById('cart-coupon'));
  window.addEventListener('pricing-updated', render);
  render();
  window.CartStore.sync().then(render);
  window.addEventListener('cart-updated', render);
})();
