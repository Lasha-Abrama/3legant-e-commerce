(function () {
  var KEY = 'lc_cart_items';

  function getCart() {
    try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; }
  }
  function setCart(items) {
    localStorage.setItem(KEY, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent('cart-updated'));
  }
  function updateQty(id, color, qty) {
    var items = getCart().map(function (it) {
      return (it.id === id && it.color === color) ? Object.assign({}, it, { qty: Math.max(1, qty) }) : it;
    });
    setCart(items);
  }
  function removeItem(id, color) {
    setCart(getCart().filter(function (it) { return !(it.id === id && it.color === color); }));
  }
  function addItem(item) {
    var items = getCart();
    var existing = items.find(function (it) { return it.id === item.id && it.color === item.color; });
    if (existing) {
      existing.qty += item.qty || 1;
      setCart(items);
    } else {
      setCart(items.concat([Object.assign({ qty: 1 }, item)]));
    }
  }
  function clear() { setCart([]); }
  function subtotal(items) { return (items || getCart()).reduce(function (s, it) { return s + it.price * it.qty; }, 0); }
  function count(items) { return (items || getCart()).reduce(function (s, it) { return s + it.qty; }, 0); }

  window.CartStore = { getCart: getCart, setCart: setCart, updateQty: updateQty, removeItem: removeItem, addItem: addItem, clear: clear, subtotal: subtotal, count: count, KEY: KEY };
})();
