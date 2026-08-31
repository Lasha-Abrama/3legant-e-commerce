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

  window.CartStore = { getCart: getCart, setCart: setCart, updateQty: updateQty, removeItem: removeItem, addItem: addItem, sync: sync, clear: clear, subtotal: subtotal, count: count, canIncrement: canIncrement, stockLimit: stockLimit, KEY: KEY };
})();
