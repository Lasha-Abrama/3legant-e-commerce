(function () {
  var KEY = 'lc_cart_items';

  function getCart() {
    try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; }
  }
  function setCart(items) {
    localStorage.setItem(KEY, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent('cart-updated'));
  }
  function stockLimit(item) {
    var stock = Number(item.stock);
    return Number.isFinite(stock) && stock >= 0 ? Math.floor(stock) : null;
  }
  function clampQty(item, qty) {
    var nextQty = Math.max(1, Math.floor(Number(qty) || 1));
    var stock = stockLimit(item);
    return stock === null || stock === 0 ? nextQty : Math.min(nextQty, stock);
  }
  function canIncrement(item) {
    var stock = stockLimit(item);
    return stock === null || item.qty < stock;
  }
  function updateQty(id, color, qty) {
    var items = getCart().map(function (it) {
      return (it.id === id && it.color === color) ? Object.assign({}, it, { qty: clampQty(it, qty) }) : it;
    });
    setCart(items);
  }
  function removeItem(id, color) {
    setCart(getCart().filter(function (it) { return !(it.id === id && it.color === color); }));
  }
  function addItem(item) {
    var items = getCart();
    var incomingStock = stockLimit(item);
    if (incomingStock === 0) return false;
    var existing = items.find(function (it) { return it.id === item.id && it.color === item.color; });
    if (existing) {
      if (item.image) existing.image = item.image;
      if (incomingStock !== null) existing.stock = incomingStock;
      existing.qty = clampQty(existing, existing.qty + (item.qty || 1));
      setCart(items);
    } else {
      var nextItem = Object.assign({ qty: 1 }, item);
      nextItem.qty = clampQty(nextItem, nextItem.qty);
      setCart(items.concat([nextItem]));
    }
    return true;
  }
  function sync() {
    var items = getCart();
    if (!items.length || typeof apiGetSilent !== 'function') return Promise.resolve(items);
    return apiGetSilent('/products?take=200').then(function (res) {
      if (!res || res._status >= 400 || !Array.isArray(res.data)) return items;
      var products = new Map(res.data.map(function (product) { return [product._id, product]; }));
      var nextItems = items.map(function (item) {
        var product = products.get(item.id);
        if (!product) return Object.assign({}, item, { stock: 0, unavailable: true });
        var nextItem = Object.assign({}, item, {
          name: product.name,
          image: productImageUrl(product),
          price: product.price,
          stock: Math.max(0, Math.floor(Number(product.stock) || 0)),
          unavailable: Number(product.stock) <= 0,
        });
        nextItem.qty = clampQty(nextItem, nextItem.qty);
        return nextItem;
      });
      if (JSON.stringify(nextItems) !== JSON.stringify(items)) setCart(nextItems);
      return nextItems;
    }).catch(function () {
      return items;
    });
  }
  function clear() { setCart([]); }
  function subtotal(items) { return (items || getCart()).reduce(function (s, it) { return s + it.price * it.qty; }, 0); }
  function count(items) { return (items || getCart()).reduce(function (s, it) { return s + it.qty; }, 0); }


  var pricingState = null;
  var pricingKey = '';
  var pricingRequest = null;
  function quotePayload(code) {
    var shipping = localStorage.getItem('lc_shipping') || 'free';
    if (!['free', 'express', 'pickup'].includes(shipping)) shipping = 'free';
    return { items: getCart().map(function (item) { return { productId: item.id, color: item.color, qty: item.qty }; }),
      shippingOption: shipping, couponCode: code === undefined ? (localStorage.getItem('lc_coupon') || '') : code };
  }
  function pricing() {
    return pricingKey === JSON.stringify(quotePayload()) ? pricingState : null;
  }
  function refreshPricing() {
    var payload = quotePayload();
    var key = JSON.stringify(payload);
    if (pricingKey === key && pricingState) return Promise.resolve(pricingState);
    if (pricingRequest && pricingRequest.key === key) return pricingRequest.promise;
    var request = payload.items.length ? apiPost('/orders/quote', payload) :
      Promise.resolve({ subtotal: 0, discount: 0, shippingCost: 0, total: 0 });
    var promise = request.then(function (result) {
      if (key !== JSON.stringify(quotePayload())) return result;
      pricingKey = key;
      pricingState = result && !result._networkError && (!result._status || result._status < 400)
        ? result : { error: (result && result.message) || 'Unable to calculate your total. Please try again.' };
      if (!pricingState.error && Array.isArray(pricingState.items)) {
        var canonical = pricingState.items;
        localStorage.setItem(KEY, JSON.stringify(getCart().map(function (item) {
          var matched = canonical.find(function (line) { return String(line.productId) === item.id && line.color === item.color; });
          return matched ? Object.assign({}, item, { name: matched.name, price: matched.price, image: matched.image || item.image }) : item;
        })));
      }
      window.dispatchEvent(new CustomEvent('pricing-updated'));
      return pricingState;
    }).finally(function () {
      if (pricingRequest && pricingRequest.key === key) pricingRequest = null;
    });
    pricingRequest = { key: key, promise: promise };
    return promise;
  }
  function applyCoupon(code) {
    code = code.trim().toUpperCase();
    var payload = quotePayload(code);
    if (!payload.items.length) return Promise.resolve({ error: 'Add a product before applying a coupon.' });
    return apiPost('/orders/quote', payload).then(function (result) {
      if (!result || result._status >= 400 || result._networkError) {
        return { error: (result && result.message) || 'Coupon could not be applied.' };
      }
      localStorage.setItem('lc_coupon', code);
      pricingKey = JSON.stringify(payload);
      pricingState = result;
      window.dispatchEvent(new CustomEvent('pricing-updated'));
      return result;
    });
  }
  function removePurchased(order) {
    var key = 'lc_cleared_order_' + order._id;
    if (order.paymentStatus !== 'paid' || localStorage.getItem(key)) return;
    var purchased = new Map();
    order.items.forEach(function (item) {
      var itemKey = String(item.productId) + ':' + item.color;
      purchased.set(itemKey, (purchased.get(itemKey) || 0) + item.qty);
    });
    var remaining = getCart().map(function (item) {
      var quantity = purchased.get(item.id + ':' + item.color) || 0;
      return Object.assign({}, item, { qty: Math.max(0, item.qty - quantity) });
    }).filter(function (item) { return item.qty > 0; });
    localStorage.setItem(key, 'true');
    localStorage.removeItem('lc_coupon');
    setCart(remaining);
  }
  function couponHtml() {
    return '<section class="coupon-section"><h3>Have a coupon?</h3><p>Add your code for an instant cart discount.</p>' +
      '<form class="coupon-form"><img src="images/icons/ticket-percent.svg" alt="">' +
      '<input name="coupon" aria-label="Coupon code" placeholder="Coupon Code" maxlength="12" pattern="[A-Za-z0-9]{8,12}" value="' +
      escapeHtml(localStorage.getItem('lc_coupon') || '') + '"><button type="submit">Apply</button></form>' +
      '<button class="coupon-remove" type="button"' + (localStorage.getItem('lc_coupon') ? '' : ' hidden') +
      '>Remove coupon</button><p class="coupon-message" role="status"></p></section>';
  }
  function wireCoupon(root) {
    var section = root.querySelector('.coupon-section');
    if (!section) return;
    function submit(code) {
      var button = section.querySelector('[type=submit]');
      button.disabled = true;
      applyCoupon(code).then(function (result) {
        var current = root.querySelector('.coupon-section') || section;
        current.querySelector('.coupon-message').textContent = result.error || (code ? 'Coupon applied.' : 'Coupon removed.');
        current.querySelector('.coupon-remove').hidden = !localStorage.getItem('lc_coupon');
        if (!result.error) current.querySelector('input').value = code;
        button.disabled = false;
      });
    }
    section.querySelector('form').addEventListener('submit', function (event) {
      event.preventDefault(); submit(section.querySelector('input').value);
    });
    section.querySelector('.coupon-remove').addEventListener('click', function () { submit(''); });

  }

  window.CartStore = { getCart: getCart, setCart: setCart, updateQty: updateQty, removeItem: removeItem, addItem: addItem, sync: sync, clear: clear, subtotal: subtotal, count: count, canIncrement: canIncrement, stockLimit: stockLimit, KEY: KEY, pricing: pricing, refreshPricing: refreshPricing, applyCoupon: applyCoupon, removePurchased: removePurchased, couponHtml: couponHtml, wireCoupon: wireCoupon };
})();
