function starString(rating) {
  var full = Math.round(rating || 5);
  return '★★★★★'.slice(0, full) + '☆☆☆☆☆'.slice(0, 5 - full);
}

function imageBoxHtml(url, fallbackLabel, sizeStyle) {
  var safeUrl = safeImageUrl(url);
  if (safeUrl) {
    return (
      '<div class="ph" style="' + sizeStyle + 'padding:0;">' +
        '<img class="product-img" src="' + safeUrl + '" alt="' + escapeHtml(fallbackLabel) + '">' +
      '</div>'
    );
  }
  return '<div class="ph" style="' + sizeStyle + '">' + escapeHtml(fallbackLabel) + '</div>';
}

function productCardHtml(p) {
  var color = (p.colors && p.colors[0]) || { name: 'Default' };
  var mainImage = p.images && p.images[0];
  return (
    '<div class="product-card" data-product-id="' + escapeHtml(p._id) + '">' +
      '<div class="product-card__media">' +
        '<a href="product.html?id=' + encodeURIComponent(p._id) + '">' +
          imageBoxHtml(mainImage, p.imageLabel, 'width:100%;height:200px;') +
        '</a>' +
        (p.newArrival ? '<span class="badge badge--new">NEW</span>' : '') +
        (p.discountLabel ? '<span class="badge badge--discount" style="' + (p.newArrival ? 'top:34px;' : '') + '">' + escapeHtml(p.discountLabel) + '</span>' : '') +
        '<button class="product-card__add" data-add-id="' + escapeHtml(p._id) + '" data-add-name="' + escapeHtml(p.name) + '" data-add-color="' + escapeHtml(color.name) + '" data-add-price="' + escapeHtml(p.price) + '">Add to Cart</button>' +
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
  root.querySelectorAll('[data-add-id]').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      window.CartStore.addItem({
        id: btn.getAttribute('data-add-id'),
        name: btn.getAttribute('data-add-name'),
        color: btn.getAttribute('data-add-color'),
        price: parseFloat(btn.getAttribute('data-add-price')),
        qty: 1,
      });
      var original = btn.textContent;
      btn.textContent = 'Added ✓';
      setTimeout(function () { btn.textContent = original; }, 1200);
    });
  });
}
