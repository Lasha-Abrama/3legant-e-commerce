(function () {
  var SHIPPING_KEY = 'lc_shipping';
  var SHIPPING_OPTIONS = {
    free: { label: 'Free shipping', cost: function () { return 0; } },
    express: { label: 'Express shipping', cost: function () { return 15; } },
    pickup: { label: 'Pick up (5% off)', cost: function (subtotal) { return -Math.round(subtotal * 0.05 * 100) / 100; } },
  };

  var form = {
    firstName: '', lastName: '', phone: '', email: '',
    street: '', country: '', city: '', state: '', zip: '',
    paymentMethod: 'card',
  };

  function renderSteps(step) {
    var dots = [1, 2, 3];
    var labels = ['Shopping cart', 'Checkout details', 'Order complete'];
    document.getElementById('step-indicator').innerHTML = dots.map(function (n, i) {
      var dotClass = n < step ? 'step__dot--done' : n === step ? 'step__dot--active' : '';
      var dotContent = n < step ? '&#10003;' : n;
      var labelClass = n < step ? 'step__label--done' : n === step ? 'step__label--active' : '';
      var line = i < 2 ? '<div class="step__line"></div>' : '';
      return '<div class="step"><span class="step__dot ' + dotClass + '">' + dotContent + '</span><span class="step__label ' + labelClass + '">' + labels[i] + '</span></div>' + line;
    }).join('');
  }

  function field(label, name, opts) {
    opts = opts || {};
    return (
      '<input class="input" placeholder="' + label + '" data-field="' + name + '" value="' + (form[name] || '') + '"' + (opts.type ? ' type="' + opts.type + '"' : '') + '>'
    );
  }

  function renderForm() {
    var cart = window.CartStore.getCart();
    var subtotal = window.CartStore.subtotal(cart);
    var shippingKey = localStorage.getItem(SHIPPING_KEY) || 'free';
    var shipping = SHIPPING_OPTIONS[shippingKey];
    var shippingCost = shipping.cost(subtotal);
    var total = Math.max(0, subtotal + shippingCost);

    document.getElementById('checkout-body').innerHTML =
      '<div class="checkout-form-grid">' +
        '<div style="display:flex;flex-direction:column;gap:28px;">' +
          '<div>' +
            '<div class="form-section-title">Contact Information</div>' +
            '<div class="row-2" style="margin-bottom:12px;">' + field('First name', 'firstName') + field('Last name', 'lastName') + '</div>' +
            '<div style="margin-bottom:12px;">' + field('Phone number', 'phone') + '</div>' +
            '<div>' + field('Your Email', 'email', { type: 'email' }) + '</div>' +
          '</div>' +
          '<div>' +
            '<div class="form-section-title">Shipping Address</div>' +
            '<div style="margin-bottom:12px;">' + field('Street Address', 'street') + '</div>' +
            '<select class="input" data-field="country" style="margin-bottom:12px;">' +
              ['', 'United States', 'Georgia', 'Germany', 'France', 'United Kingdom', 'Canada'].map(function (c) {
                return '<option value="' + c + '"' + (form.country === c ? ' selected' : '') + '>' + (c || 'Country') + '</option>';
              }).join('') +
            '</select>' +
            '<div style="margin-bottom:12px;">' + field('Town / City', 'city') + '</div>' +
            '<div class="row-2">' + field('State', 'state') + field('Zip Code', 'zip') + '</div>' +
          '</div>' +
          '<div>' +
            '<div class="form-section-title">Payment method</div>' +
            '<label class="pay-option' + (form.paymentMethod === 'card' ? ' is-active' : '') + '"><input type="radio" name="pay" data-pay="card" ' + (form.paymentMethod === 'card' ? 'checked' : '') + '> Pay by Card Credit</label>' +
            '<label class="pay-option' + (form.paymentMethod === 'paypal' ? ' is-active' : '') + '"><input type="radio" name="pay" data-pay="paypal" ' + (form.paymentMethod === 'paypal' ? 'checked' : '') + '> PayPal</label>' +
          '<p class="faint" style="margin:16px 0 0;">Card details are entered securely on Stripe Checkout.</p>' +
          '</div>' +
          '<div id="checkout-error" class="error-text"></div>' +
        '</div>' +

        '<div class="cart-summary">' +
          '<div class="cart-summary__title">Order summary</div>' +
          '<div id="order-lines">' +
            cart.map(function (item) {
              return (
                '<div class="order-line">' +
                  '<div class="ph">' + item.name + '</div>' +
                  '<div style="flex:1;">' +
                    '<div style="display:flex;justify-content:space-between;font-size:13px;font-weight:500;"><span>' + item.name + '</span><span>' + fmt(item.price * item.qty) + '</span></div>' +
                    '<div class="faint" style="font-size:11px;">Color: ' + item.color + '</div>' +
                    '<div class="faint" style="font-size:11px;">Qty: ' + item.qty + '</div>' +
                  '</div>' +
                '</div>'
              );
            }).join('') +
          '</div>' +
          '<div style="display:flex;gap:8px;margin:16px 0;">' +
            '<input class="input" placeholder="Coupon code" style="flex:1;background:#fff;">' +
            '<button class="btn btn--dark" type="button" style="padding:10px 16px;">Apply</button>' +
          '</div>' +
          '<div class="summary-line"><span>Shipping</span><span>' + shipping.label + (shippingCost ? ' (' + fmt(shippingCost) + ')' : '') + '</span></div>' +
          '<div class="summary-line" style="padding-bottom:12px;border-bottom:1px solid var(--border);"><span>Subtotal</span><span>' + fmt(subtotal) + '</span></div>' +
          '<div class="summary-total"><span>Total</span><span>' + fmt(total) + '</span></div>' +
          '<button class="btn btn--dark btn--block" id="place-order-btn">Place Order</button>' +
        '</div>' +
      '</div>';

    document.querySelectorAll('[data-field]').forEach(function (el) {
      el.addEventListener('input', function () { form[el.getAttribute('data-field')] = el.value; });
      el.addEventListener('change', function () { form[el.getAttribute('data-field')] = el.value; });
    });
    document.querySelectorAll('[data-pay]').forEach(function (el) {
      el.addEventListener('change', function () {
        form.paymentMethod = el.getAttribute('data-pay');
        renderForm();
      });
    });
    document.getElementById('place-order-btn').addEventListener('click', function () {
      placeOrder(cart, subtotal, shippingKey);
    });
  }

  function placeOrder(cart, subtotal, shippingKey) {
    var errorEl = document.getElementById('checkout-error');
    errorEl.textContent = '';
    var required = ['firstName', 'lastName', 'phone', 'email', 'street', 'city', 'state', 'zip', 'country'];
    var missing = required.filter(function (k) { return !form[k]; });
    if (missing.length) {
      errorEl.textContent = 'გთხოვთ შეავსოთ ყველა სავალდებულო ველი';
      return;
    }

    var payload = {
      items: cart.map(function (item) {
        return { productId: item.id, name: item.name, color: item.color, price: item.price, qty: item.qty };
      }),
      contact: { firstName: form.firstName, lastName: form.lastName, phone: form.phone, email: form.email },
      shippingAddress: { street: form.street, city: form.city, state: form.state, zip: form.zip, country: form.country },
      paymentMethod: form.paymentMethod,
      shippingOption: shippingKey,
    };

    var btn = document.getElementById('place-order-btn');
    btn.disabled = true;
    btn.textContent = 'Placing order...';

    apiPost('/orders', payload).then(function (res) {
      if (!res) return;
      if (res._status >= 400) {
        errorEl.textContent = res.message || 'შეკვეთის გაფორმება ვერ მოხერხდა';
        btn.disabled = false;
        btn.textContent = 'Place Order';
        return;
      }
      if (form.paymentMethod !== 'card') {
        errorEl.textContent = 'Card payments are currently available only.';
        btn.disabled = false;
        btn.textContent = 'Place Order';
        return;
      }

      apiPost('/payments/checkout-session', { orderId: res._id }).then(function (payment) {
        if (!payment || payment._status >= 400 || !payment.checkoutUrl) {
          errorEl.textContent = (payment && payment.message) || 'Payment could not be started.';
          btn.disabled = false;
          btn.textContent = 'Place Order';
          return;
        }
        window.location.href = payment.checkoutUrl;
      });
    });
  }

  function renderComplete(order) {
    renderSteps(3);
    document.getElementById('checkout-body').innerHTML =
      '<div class="order-complete">' +
        '<div class="order-complete__icon">&#10003;</div>' +
        '<h2 style="font-size:26px;font-weight:600;margin-bottom:12px;">Thank you, your order is placed!</h2>' +
        '<p class="muted" style="font-size:14px;margin-bottom:24px;">Order total <strong>' + fmt(order.total) + '</strong> &middot; status: ' + order.status + '</p>' +
        '<div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;">' +
          '<a class="btn btn--dark" href="account.html?tab=orders">View my orders</a>' +
          '<a class="btn btn--outline" href="index.html">Continue shopping</a>' +
        '</div>' +
      '</div>';
  }

  apiGetSilent('/auth/me').then(function (res) {
    if (!res || !res.user) {
      window.location.href = 'login.html?next=' + encodeURIComponent('checkout.html');
      return;
    }
    form.firstName = res.user.firstName || '';
    form.lastName = res.user.lastName || '';
    form.email = res.user.email || '';
    form.phone = res.user.phone || '';
    var addr = res.user.shippingAddress;
    if (addr) {
      form.street = addr.street || '';
      form.city = addr.city || '';
      form.state = addr.state || '';
      form.zip = addr.zip || '';
      form.country = addr.country || '';
    }

    if (window.CartStore.getCart().length === 0) {
      renderSteps(2);
      document.getElementById('checkout-body').innerHTML = '<div class="empty-note">Your cart is empty. <a href="shop.html" style="color:var(--ink);">Go shopping &rarr;</a></div>';
      return;
    }

    renderSteps(2);
    renderForm();
  });
})();
