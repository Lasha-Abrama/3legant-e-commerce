(function () {
  var productId = qs('id');
  var state = { product: null, reviews: null, color: null, qty: 1, imageIndex: 0, tab: 'reviews', wishlisted: false, me: null };

  if (!productId) {
    document.getElementById('product-content').innerHTML = '<p>Product not found.</p>';
    return;
  }

  function renderProduct() {
    var p = state.product;
    var stock = Math.max(0, Number(p.stock) || 0);
    document.getElementById('crumb').textContent = 'Home / Shop / ' + p.category + ' / ' + p.name;
    document.title = p.name + ' — Gita_3_Team_2';

    document.getElementById('product-content').innerHTML =
      '<div class="product-detail-grid">' +
        '<div>' +
          '<div class="product-main-media">' +
            '<div id="product-main-image"></div>' +
            (p.newArrival ? '<span class="badge badge--new" style="position:absolute;top:14px;left:14px;">NEW</span>' : '') +
            (p.discountLabel ? '<span class="badge badge--discount" style="top:44px;left:14px;position:absolute;">' + escapeHtml(p.discountLabel) + '</span>' : '') +
          '</div>' +
          '<div class="product-thumbs" id="product-thumbs"></div>' +
        '</div>' +
        '<div>' +
          '<div class="product-rating">' + starString(p.ratingAvg) + '&nbsp;&nbsp;' + p.reviewsCount + ' Reviews</div>' +
          '<h1 class="product-title">' + escapeHtml(p.name) + '</h1>' +
          '<p class="product-desc">' + escapeHtml(p.description) + '</p>' +
          '<div class="product-price">' + fmt(p.price) + (p.originalPrice ? '<span class="original">' + fmt(p.originalPrice) + '</span>' : '') + '</div>' +
          '<div class="stock-status' + (stock ? '' : ' is-empty') + '">' + (stock ? stock + ' in stock' : 'Out of stock') + '</div>' +
          (p.measurements ? '<div class="product-meta">Measurements: ' + escapeHtml(p.measurements) + '</div>' : '') +
          '<div style="margin-bottom:20px;">' +
            '<div class="product-option-label">Choose Color &middot; <span style="color:var(--ink);font-weight:600;" id="color-label"></span></div>' +
            '<div class="color-row" id="color-row"></div>' +
          '</div>' +
          '<div class="qty-wishlist-row">' +
            '<div class="qty-stepper qty-stepper--lg">' +
              '<button id="qty-dec" type="button">&minus;</button><span id="qty-val">1</span><button id="qty-inc" type="button">+</button>' +
            '</div>' +
            '<button class="wishlist-btn" id="wishlist-btn">♡ Wishlist</button>' +
          '</div>' +
          '<button class="btn btn--dark btn--block" id="add-to-cart-btn" style="margin-bottom:20px;"' + (stock ? '' : ' disabled') + '>' + (stock ? 'Add to Cart' : 'Out of stock') + '</button>' +
          '<div class="product-sku"><div>SKU: ' + escapeHtml(p.sku) + '</div><div>CATEGORY: ' + escapeHtml(p.category) + '</div></div>' +
        '</div>' +
      '</div>';

    renderGallery();
    renderColors();
    wireQty();
    document.getElementById('add-to-cart-btn').addEventListener('click', function () {
      window.CartStore.addItem({ id: p._id, name: p.name, color: state.color, price: p.price, stock: stock, qty: state.qty });
      var btn = document.getElementById('add-to-cart-btn');
      var original = btn.textContent;
      btn.textContent = 'Added to cart ✓';
      setTimeout(function () { btn.textContent = original; }, 1200);
    });
    document.getElementById('wishlist-btn').addEventListener('click', toggleWishlist);
    updateWishlistButton();
  }

  function renderGallery() {
    var p = state.product;
    var images = (p.images || []).filter(function (image) { return safeImageUrl(image); });
    if (state.imageIndex >= images.length) state.imageIndex = 0;
    document.getElementById('product-main-image').innerHTML =
      imageBoxHtml(images[state.imageIndex], p.imageLabel, '');
    var thumbs = document.getElementById('product-thumbs');
    if (!images.length) {
      thumbs.style.display = 'none';
      return;
    }
    thumbs.style.display = 'grid';
    thumbs.innerHTML = images.map(function (image, index) {
      return '<button class="gallery-thumb' + (index === state.imageIndex ? ' is-active' : '') + '" type="button" data-image-index="' + index + '" aria-label="View image ' + (index + 1) + '" aria-pressed="' + (index === state.imageIndex) + '">' +
        imageBoxHtml(image, p.name + ' image ' + (index + 1), '') +
      '</button>';
    }).join('');
    thumbs.querySelectorAll('[data-image-index]').forEach(function (button) {
      button.addEventListener('click', function () {
        state.imageIndex = Number(button.getAttribute('data-image-index'));
        renderGallery();
      });
    });
  }

  function renderColors() {
    var p = state.product;
    var colors = p.colors && p.colors.length ? p.colors : [{ name: 'Default', hex: '#c9c4b8' }];
    if (!state.color) state.color = colors[0].name;
    document.getElementById('color-label').textContent = state.color;
    document.getElementById('color-row').innerHTML = colors.map(function (c) {
      return '<button class="color-swatch' + (c.name === state.color ? ' is-active' : '') + '" style="background:' + safeCssColor(c.hex) + ';" data-color="' + escapeHtml(c.name) + '" title="' + escapeHtml(c.name) + '"></button>';
    }).join('');
    document.querySelectorAll('.color-swatch').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.color = btn.getAttribute('data-color');
        renderColors();
      });
    });
  }

  function wireQty() {
    var stock = Math.max(0, Number(state.product.stock) || 0);
    function updateQtyControls() {
      document.getElementById('qty-val').textContent = state.qty;
      document.getElementById('qty-dec').disabled = state.qty <= 1;
      document.getElementById('qty-inc').disabled = !stock || state.qty >= stock;
    }
    document.getElementById('qty-dec').addEventListener('click', function () {
      state.qty = Math.max(1, state.qty - 1);
      updateQtyControls();
    });
    document.getElementById('qty-inc').addEventListener('click', function () {
      state.qty = Math.min(stock, state.qty + 1);
      updateQtyControls();
    });
    updateQtyControls();
  }

  function updateWishlistButton() {
    var btn = document.getElementById('wishlist-btn');
    if (!btn) return;
    btn.innerHTML = (state.wishlisted ? '♥' : '♡') + ' Wishlist';
    btn.style.color = state.wishlisted ? 'var(--red)' : 'var(--ink)';
  }

  function toggleWishlist() {
    var p = state.product;
    var call = state.wishlisted ? apiDelete('/users/me/wishlist/' + p._id) : apiPost('/users/me/wishlist/' + p._id);
    call.then(function (res) {
      if (!res) return;
      if (res._status >= 400) {
        var btn = document.getElementById('wishlist-btn');
        btn.textContent = res.message || 'Wishlist unavailable';
        window.setTimeout(updateWishlistButton, 1400);
        return;
      }
      state.wishlisted = !state.wishlisted;
      updateWishlistButton();
    }).catch(function () {
      var btn = document.getElementById('wishlist-btn');
      btn.textContent = 'Wishlist unavailable';
      window.setTimeout(updateWishlistButton, 1400);
    });
  }

  function renderTabs() {
    var tabs = [
      { key: 'info', label: 'Additional Info' },
      { key: 'reviews', label: 'Reviews (' + (state.product.reviewsCount || 0) + ')' },
    ];
    document.getElementById('tab-row').innerHTML = tabs.map(function (t) {
      return '<button class="tab-btn' + (state.tab === t.key ? ' is-active' : '') + '" data-tab="' + t.key + '">' + t.label + '</button>';
    }).join('');
    document.querySelectorAll('.tab-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.tab = btn.getAttribute('data-tab');
        renderTabs();
        renderTabBody();
      });
    });
  }

  function renderTabBody() {
    var p = state.product;
    var body = document.getElementById('tab-body');
    if (state.tab === 'info') {
      body.innerHTML =
        '<div style="font-size:13px;color:#4a4843;line-height:1.9;max-width:640px;">' +
          'Category: ' + escapeHtml(p.category) + '<br>' +
          (p.measurements ? 'Dimensions: ' + escapeHtml(p.measurements) + '<br>' : '') +
          'SKU: ' + escapeHtml(p.sku) + '<br>' +
          'Assembly: no tools required, ready to use out of the box.' +
        '</div>';
      return;
    }
    var reviews = state.reviews || [];
    body.innerHTML =
      '<div>' +
        '<h2 style="font-size:22px;font-weight:600;margin-bottom:20px;">Customer Reviews</h2>' +
        '<div style="display:flex;align-items:center;gap:10px;margin-bottom:24px;">' +
          '<span style="color:#e8b400;">' + starString(p.ratingAvg) + '</span>' +
          '<span class="faint" style="font-size:13px;">' + p.reviewsCount + ' Reviews</span>' +
        '</div>' +
        (state.me
          ? '<textarea class="input" placeholder="Write your review" rows="3" id="review-text" style="margin-bottom:12px;"></textarea>' +
            '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">' +
              '<select class="input" id="review-rating" style="width:110px;">' +
                '<option value="5">★★★★★</option><option value="4">★★★★☆</option><option value="3">★★★☆☆</option>' +
                '<option value="2">★★☆☆☆</option><option value="1">★☆☆☆☆</option>' +
              '</select>' +
              '<button class="btn btn--dark" id="submit-review">Write Review</button>' +
            '</div>' +
            '<div class="faint" style="font-size:11px;margin-bottom:4px;">Reviews are available after purchasing this product. One review per customer.</div>' +
            '<div class="error-text" id="review-error" style="margin-bottom:24px;"></div>'
          : '<div class="faint" style="font-size:13px;margin-bottom:24px;"><a href="login.html?next=' + encodeURIComponent('product.html?id=' + p._id) + '" style="color:var(--ink);text-decoration:underline;">Sign in</a> to review a product you purchased.</div>') +
        '<div id="review-list">' +
          reviews.map(function (r) {
            return (
              '<div class="review-row">' +
                '<div class="ph">Photo</div>' +
                '<div>' +
                  '<div class="review-name">' + escapeHtml(r.authorName) + '</div>' +
                  '<div class="review-stars">' + starString(r.rating) + '</div>' +
                  '<p class="review-text">' + escapeHtml(r.text) + '</p>' +
                '</div>' +
              '</div>'
            );
          }).join('') +
        '</div>' +
      '</div>';

    var submitReviewButton = document.getElementById('submit-review');
    if (!submitReviewButton) return;
    submitReviewButton.addEventListener('click', function () {
      var text = document.getElementById('review-text').value.trim();
      var errorEl = document.getElementById('review-error');
      errorEl.textContent = '';
      if (!text) {
        errorEl.textContent = 'Please write a review before submitting.';
        return;
      }
      var rating = Number(document.getElementById('review-rating').value);
      submitReviewButton.disabled = true;
      apiPost('/products/' + p._id + '/reviews', { text: text, rating: rating }).then(function (res) {
        if (!res) {
          submitReviewButton.disabled = false;
          return;
        }
        if (res._status >= 400) {
          errorEl.textContent = res.message || 'Could not submit review';
          submitReviewButton.disabled = false;
          return;
        }
        reloadReviewsAndProduct();
      }).catch(function () {
        errorEl.textContent = 'The review service is currently unavailable.';
        submitReviewButton.disabled = false;
      });
    });
  }

  function reloadReviewsAndProduct() {
    Promise.all([
      apiGetSilent('/products/' + productId),
      apiGetSilent('/products/' + productId + '/reviews'),
    ]).then(function (results) {
      state.product = results[0];
      state.reviews = results[1];
      renderTabs();
      renderTabBody();
    });
  }

  Promise.all([
    apiGetSilent('/products/' + productId),
    apiGetSilent('/products/' + productId + '/reviews'),
    apiGetSilent('/auth/me'),
  ]).then(function (results) {
    var product = results[0];
    if (!product || product._status >= 400) {
      document.getElementById('product-content').innerHTML = '<p>Product not found.</p>';
      return;
    }
    state.product = product;
    state.reviews = results[1];
    state.me = results[2] && results[2].user;

    var afterAuth = function () {
      renderProduct();
      renderTabs();
      renderTabBody();
    };

    if (state.me) {
      apiGetSilent('/users/me/wishlist').then(function (wishlist) {
        state.wishlisted = Array.isArray(wishlist) && wishlist.some(function (w) { return w._id === productId; });
        afterAuth();
      });
    } else {
      afterAuth();
    }
  });
})();
