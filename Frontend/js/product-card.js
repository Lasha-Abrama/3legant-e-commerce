function starString(rating) {
  var full = Math.round(rating || 5);
  return '★★★★★'.slice(0, full) + '☆☆☆☆☆'.slice(0, 5 - full);
}

function imageBoxHtml(url, fallbackLabel, sizeStyle) {
  var safeUrl = safeImageUrl(url);
  if (safeUrl) {
    return (
      '<div class="ph" style="' + sizeStyle + 'padding:0;">' +
        '<img class="product-img" src="' + safeUrl + '" alt="' + escapeHtml(fallbackLabel) + '" loading="lazy" decoding="async">' +
      '</div>'
    );
  }
  return '<div class="ph" style="' + sizeStyle + '">' + escapeHtml(fallbackLabel) + '</div>';
}

function wishlistIconHtml(saved) {
  return '<svg class="wishlist-icon" viewBox="0 0 48 48" fill="none" aria-hidden="true">' +
    '<rect x="8" width="32" height="32" rx="16" fill="white"></rect>' +
    '<path fill-rule="evenodd" clip-rule="evenodd" d="M24.577 11.764a.833.833 0 0 1-1.154 0l-.577-.554a3.737 3.737 0 0 0-2.596-1.043 3.75 3.75 0 0 0-3.75 3.75c0 1.985 1.075 3.625 2.626 4.972 1.553 1.348 3.41 2.242 4.52 2.699a.925.925 0 0 0 .708 0c1.11-.457 2.967-1.351 4.52-2.7 1.551-1.346 2.626-2.986 2.626-4.971a3.75 3.75 0 0 0-3.75-3.75c-1.008 0-1.92.395-2.596 1.043l-.577.554ZM24 10.008A5.4 5.4 0 0 0 20.25 8.5a5.417 5.417 0 0 0-5.417 5.417c0 5.306 5.809 8.237 8.178 9.212a2.606 2.606 0 0 0 1.977 0c2.37-.975 8.179-3.906 8.179-9.212A5.417 5.417 0 0 0 27.75 8.5 5.4 5.4 0 0 0 24 10.008Z" fill="' + (saved ? '#c0392b' : '#6C7275') + '"></path>' +
  '</svg>';
}

function productCardHtml(p) {
  var color = (p.colors && p.colors[0]) || { name: 'Default' };
  var mainImage = productImageUrl(p);
  var inStock = Number(p.stock) > 0;
  return (
    '<div class="product-card" data-product-id="' + escapeHtml(p._id) + '">' +
      '<div class="product-card__media">' +
        '<a href="product.html?id=' + encodeURIComponent(p._id) + '">' +
          imageBoxHtml(mainImage, p.name, 'width:100%;height:200px;') +
        '</a>' +
        '<button type="button" class="product-card__heart" data-wish-id="' + escapeHtml(p._id) + '" aria-label="Save ' + escapeHtml(p.name) + ' to wishlist" aria-pressed="false">' + wishlistIconHtml(false) + '</button>' +
        (p.newArrival ? '<span class="badge badge--new">NEW</span>' : '') +
        (p.discountLabel ? '<span class="badge badge--discount" style="' + (p.newArrival ? 'top:34px;' : '') + '">' + escapeHtml(p.discountLabel) + '</span>' : '') +
        '<button class="product-card__add" data-add-id="' + escapeHtml(p._id) + '" data-add-name="' + escapeHtml(p.name) + '" data-add-color="' + escapeHtml(color.name) + '" data-add-price="' + escapeHtml(p.price) + '" data-add-stock="' + escapeHtml(p.stock) + '"' + (inStock ? '' : ' disabled') + '>' + (inStock ? 'Add to Cart' : 'Out of stock') + '</button>' +
      '</div>' +
      '<a href="product.html?id=' + encodeURIComponent(p._id) + '" style="text-decoration:none;color:inherit;">' +
        '<div class="product-card__stars">' + starString(p.ratingAvg) + '</div>' +
        '<div class="product-card__title">' + escapeHtml(p.name) + '</div>' +
        '<div class="product-card__price">' + fmt(p.price) +
          (p.originalPrice ? '<span class="product-card__price-original">' + fmt(p.originalPrice) + '</span>' : '') +
        '</div>' +
      '</a>' +
    '</div>'
  );
}

function wireAddToCartButtons(root) {
  var wishButtons = root.querySelectorAll('[data-wish-id]');
  if (getAuthHeaders().Authorization && wishButtons.length) {
    apiGetSilent('/users/me/wishlist').then(function (items) {
      if (!Array.isArray(items)) return;
      wishButtons.forEach(function (button) {
        var saved = items.some(function (item) { return item._id === button.dataset.wishId; });
        button.setAttribute('aria-pressed', String(saved));
        button.innerHTML = wishlistIconHtml(saved);
      });
    });
  }
  wishButtons.forEach(function (button) {
    button.addEventListener('click', function () {
      if (!getAuthHeaders().Authorization) { redirectToLogin(); return; }
      var saved = button.getAttribute('aria-pressed') === 'true';
      button.disabled = true;
      (saved ? apiDelete : apiPost)('/users/me/wishlist/' + encodeURIComponent(button.dataset.wishId)).then(function (res) {
        button.disabled = false;
        if (!res) return;
        if (res._status >= 400) { button.title = res.message || 'Wishlist could not be updated.'; return; }
        button.setAttribute('aria-pressed', String(!saved));
        button.innerHTML = wishlistIconHtml(!saved);
      });
    });
  });
  root.querySelectorAll('[data-add-id]').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      window.CartStore.addItem({
        id: btn.getAttribute('data-add-id'),
        name: btn.getAttribute('data-add-name'),
        image: btn.closest('.product-card').querySelector('.product-img')?.getAttribute('src') || '',
        color: btn.getAttribute('data-add-color'),
        price: parseFloat(btn.getAttribute('data-add-price')),
        stock: parseInt(btn.getAttribute('data-add-stock'), 10),
        qty: 1,
      });
      var original = btn.textContent;
      btn.textContent = 'Added ✓';
      setTimeout(function () { btn.textContent = original; }, 1200);
    });
  });
}
