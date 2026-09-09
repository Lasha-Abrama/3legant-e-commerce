(function () {
  var productId = qs('id');
  var state = { product: null, reviews: [], reviewsError: '', questions: null, questionsError: '', color: null, qty: 1, imageIndex: 0, tab: 'reviews', wishlisted: false, me: null, reviewSort: 'newest', offerTimer: null };

  if (!productId) { document.getElementById('product-content').innerHTML = '<p>Product not found.</p>'; return; }

  function galleryImages() {
    var images = (state.product.images || []).slice();
    if (!images.length && productImageUrl(state.product)) images.push(productImageUrl(state.product));
    if (state.product.name === 'Tray Table') images = images.concat(['images/products/tray-table-serving.png', 'images/products/tray-table-detail.png', 'images/products/tray-table-top.png', 'images/products/tray-table-living-room.png', 'images/products/tray-table-coffee.png']);
    return images.filter(function (image, index, all) { return safeImageUrl(image) && all.indexOf(image) === index; });
  }
  function renderBreadcrumb() {
    var p = state.product;
    setBreadcrumb(document.getElementById('crumb'), [{ label: 'Home', href: '/' }, { label: 'Shop', href: 'shop.html' }, { label: p.category, href: 'shop.html?category=' + encodeURIComponent(p.category) }, { label: p.name }]);
  }
  function offerHtml(p) { return p.originalPrice || p.discountLabel ? '<div class="offer-countdown" id="offer-countdown"><span class="offer-countdown__label">Offer expires in:</span><div class="offer-countdown__units" id="offer-units"></div></div>' : ''; }

  function renderProduct() {
    var p = state.product, stock = Math.max(0, Number(p.stock) || 0);
    renderBreadcrumb(); document.title = p.name + ' — 3legant';
    document.getElementById('product-content').innerHTML = '<div class="product-detail-grid"><div><div class="product-main-media"><div id="product-main-image"></div>' +
      (p.newArrival ? '<span class="badge badge--new" style="position:absolute;top:14px;left:14px;">NEW</span>' : '') +
      (p.discountLabel ? '<span class="badge badge--discount" style="top:44px;left:14px;position:absolute;">' + escapeHtml(p.discountLabel) + '</span>' : '') +
      '<button class="gallery-arrow gallery-arrow--prev" type="button" id="gallery-prev" aria-label="Previous image">&#8592;</button><button class="gallery-arrow gallery-arrow--next" type="button" id="gallery-next" aria-label="Next image">&#8594;</button></div><div class="product-thumbs" id="product-thumbs"></div></div><div>' +
      '<div class="product-rating">' + starString(p.ratingAvg) + '&nbsp;&nbsp;' + p.reviewsCount + ' Reviews</div><h1 class="product-title">' + escapeHtml(p.name) + '</h1><p class="product-desc">' + escapeHtml(p.description) + '</p><div class="product-price">' + fmt(p.price) + (p.originalPrice ? '<span class="original">' + fmt(p.originalPrice) + '</span>' : '') + '</div>' + offerHtml(p) +
      '<div class="stock-status' + (stock ? '' : ' is-empty') + '">' + (stock ? stock + ' in stock' : 'Out of stock') + '</div>' + (p.measurements ? '<div class="product-meta"><strong>Measurements</strong><br>' + escapeHtml(p.measurements) + '</div>' : '') +
      '<div style="margin-bottom:20px;"><div class="product-option-label">Choose Color &middot; <span style="color:var(--ink);font-weight:600;" id="color-label"></span></div><div class="color-row" id="color-row"></div></div><div class="qty-wishlist-row"><div class="qty-stepper qty-stepper--lg"><button id="qty-dec" type="button">&minus;</button><span id="qty-val">1</span><button id="qty-inc" type="button">+</button></div><button class="wishlist-btn" id="wishlist-btn">♡ Wishlist</button></div><button class="btn btn--dark btn--block" id="add-to-cart-btn" style="margin-bottom:20px;"' + (stock ? '' : ' disabled') + '>' + (stock ? 'Add to Cart' : 'Out of stock') + '</button><div class="product-sku"><div>SKU: ' + escapeHtml(p.sku) + '</div><div>CATEGORY: ' + escapeHtml(p.category) + '</div></div></div></div>';
    renderGallery(); renderColors(); wireQty(); wireGalleryArrows(); startOfferTimer();
    document.getElementById('add-to-cart-btn').addEventListener('click', function () { window.CartStore.addItem({ id: p._id, name: p.name, image: galleryImages()[0], color: state.color, price: p.price, stock: stock, qty: state.qty }); var button = document.getElementById('add-to-cart-btn'), original = button.textContent; button.textContent = 'Added to cart ✓'; setTimeout(function () { button.textContent = original; }, 1200); });
    document.getElementById('wishlist-btn').addEventListener('click', toggleWishlist); updateWishlistButton();
  }
  function renderGallery() {
    var p = state.product, images = galleryImages(), thumbs = document.getElementById('product-thumbs');
    if (state.imageIndex >= images.length) state.imageIndex = 0;
    document.getElementById('product-main-image').innerHTML = imageBoxHtml(images[state.imageIndex], p.imageLabel, '');
    if (!images.length) { thumbs.style.display = 'none'; return; }
    thumbs.style.display = 'grid'; thumbs.innerHTML = images.map(function (image, index) { return '<button class="gallery-thumb' + (index === state.imageIndex ? ' is-active' : '') + '" type="button" data-image-index="' + index + '" aria-label="View image ' + (index + 1) + '">' + imageBoxHtml(image, p.name + ' image ' + (index + 1), '') + '</button>'; }).join('');
    thumbs.querySelectorAll('[data-image-index]').forEach(function (button) { button.addEventListener('click', function () { state.imageIndex = Number(button.getAttribute('data-image-index')); renderGallery(); }); });
  }
  function wireGalleryArrows() { function change(step) { var images = galleryImages(); if (images.length < 2) return; state.imageIndex = (state.imageIndex + step + images.length) % images.length; renderGallery(); } document.getElementById('gallery-prev').addEventListener('click', function () { change(-1); }); document.getElementById('gallery-next').addEventListener('click', function () { change(1); }); }
  function offerDeadline() { var key = 'threelegant_offer_end_' + productId, stored = Number(localStorage.getItem(key)); if (stored && stored > Date.now()) return stored; var fallback = Date.now() + 218705000; localStorage.setItem(key, String(fallback)); return fallback; }
  function startOfferTimer() { if (state.offerTimer) window.clearInterval(state.offerTimer); var root = document.getElementById('offer-units'); if (!root) return; var deadline = offerDeadline(); function update() { var remaining = Math.max(0, deadline - Date.now()), values = [Math.floor(remaining / 86400000), Math.floor(remaining / 3600000) % 24, Math.floor(remaining / 60000) % 60, Math.floor(remaining / 1000) % 60], labels = ['Days', 'Hours', 'Minutes', 'Seconds']; root.innerHTML = values.map(function (value, index) { return '<span><b>' + String(value).padStart(2, '0') + '</b><small>' + labels[index] + '</small></span>'; }).join(''); if (!remaining) window.clearInterval(state.offerTimer); } update(); state.offerTimer = window.setInterval(update, 1000); }
  function renderColors() { var colors = state.product.colors && state.product.colors.length ? state.product.colors : [{ name: 'Default', hex: '#c9c4b8' }]; if (!state.color) state.color = colors[0].name; document.getElementById('color-label').textContent = state.color; document.getElementById('color-row').innerHTML = colors.map(function (color) { return '<button class="color-swatch' + (color.name === state.color ? ' is-active' : '') + '" style="background:' + safeCssColor(color.hex) + ';" data-color="' + escapeHtml(color.name) + '" title="' + escapeHtml(color.name) + '"></button>'; }).join(''); document.querySelectorAll('.color-swatch').forEach(function (button) { button.addEventListener('click', function () { state.color = button.getAttribute('data-color'); renderColors(); }); }); }
  function wireQty() { var stock = Math.max(0, Number(state.product.stock) || 0); function updateControls() { document.getElementById('qty-val').textContent = state.qty; document.getElementById('qty-dec').disabled = state.qty <= 1; document.getElementById('qty-inc').disabled = !stock || state.qty >= stock; } document.getElementById('qty-dec').addEventListener('click', function () { state.qty = Math.max(1, state.qty - 1); updateControls(); }); document.getElementById('qty-inc').addEventListener('click', function () { state.qty = Math.min(stock, state.qty + 1); updateControls(); }); updateControls(); }
  function updateWishlistButton() { var button = document.getElementById('wishlist-btn'); if (!button) return; button.innerHTML = (state.wishlisted ? '♥' : '♡') + ' Wishlist'; button.style.color = state.wishlisted ? 'var(--red)' : 'var(--ink)'; }
  function toggleWishlist() { var call = state.wishlisted ? apiDelete('/users/me/wishlist/' + state.product._id) : apiPost('/users/me/wishlist/' + state.product._id); call.then(function (response) { if (!response || response._status >= 400) return; state.wishlisted = !state.wishlisted; updateWishlistButton(); }); }
  var communityLimit = { reviews: 5, questions: 5 };
  var questionSort = 'newest';
  var icons = {
    star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z"/>',
    send: '<path d="m21 3-7 18-4-7-7-4 18-7ZM10 14 21 3"/>',
    chevron: '<path d="m8 10 4 4 4-4"/>',
  };
  function icon(name) { return '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' + icons[name] + '</svg>'; }
  function stars(rating) {
    return '<span class="community-stars" role="img" aria-label="' + Number(rating || 0) + ' out of 5 stars">' + [1, 2, 3, 4, 5].map(function (value) { return '<span class="' + (value <= Math.round(rating) ? 'is-filled' : '') + '">' + icon('star') + '</span>'; }).join('') + '</span>';
  }
  function ratingInput(rating) {
    return '<fieldset class="community-rating"><legend class="sr-only">Rating</legend>' + [1, 2, 3, 4, 5].map(function (value) {
      return '<label class="' + (value <= rating ? 'is-filled' : '') + '"><input type="radio" name="rating" value="' + value + '" aria-label="' + value + ' star' + (value > 1 ? 's' : '') + '"' + (value === rating ? ' checked' : '') + ' required>' + icon('star') + '</label>';
    }).join('') + '</fieldset>';
  }
  function renderTabs() {
    var tabs = [{ key: 'info', label: 'Additional Info' }, { key: 'questions', label: 'Questions' }, { key: 'reviews', label: 'Reviews' }];
    var row = document.getElementById('tab-row');
    row.setAttribute('role', 'tablist');
    row.setAttribute('aria-label', 'Product details');
    row.innerHTML = tabs.map(function (tab) { return '<button type="button" role="tab" id="tab-' + tab.key + '" aria-controls="tab-body" aria-selected="' + (state.tab === tab.key) + '" tabindex="' + (state.tab === tab.key ? 0 : -1) + '" class="tab-btn' + (state.tab === tab.key ? ' is-active' : '') + '" data-tab="' + tab.key + '">' + tab.label + '</button>'; }).join('');
    row.onclick = function (event) { var button = event.target.closest('[data-tab]'); if (!button) return; state.tab = button.dataset.tab; renderTabs(); renderTabBody(); document.getElementById('tab-' + state.tab).focus(); };
    row.onkeydown = function (event) {
      var index = tabs.findIndex(function (tab) { return tab.key === state.tab; });
      if (event.key === 'ArrowRight') index = (index + 1) % tabs.length;
      else if (event.key === 'ArrowLeft') index = (index + tabs.length - 1) % tabs.length;
      else if (event.key === 'Home') index = 0;
      else if (event.key === 'End') index = tabs.length - 1;
      else return;
      event.preventDefault(); row.querySelector('[data-tab="' + tabs[index].key + '"]').click();
    };
  }
  function reviewUserId(item) { return String(item.user && (item.user._id || item.user) || ''); }
  function isOwnReview(item) { return state.me && reviewUserId(item) === String(state.me._id); }
  function author(item) { var user = item.user; return user && (user.displayName || [user.firstName, user.lastName].filter(Boolean).join(' ')) || item.authorName; }
  function reviewAvatarHtml(user, name) { var url = user && safeImageUrl(user.profileImageUrl); return url ? '<img class="review-avatar" src="' + escapeHtml(url) + '" alt="">' : '<div class="review-avatar review-avatar--initial" aria-hidden="true">' + escapeHtml(String(name || '?').charAt(0).toUpperCase()) + '</div>'; }
  function hasReaction(item, field) { return state.me && (item[field] || []).some(function (id) { return String(id && (id._id || id)) === String(state.me._id); }); }
  function actionsHtml(item, path) {
    var voting = path.indexOf('questions/') === 0;
    return '<div class="review-actions"><button type="button" data-action="like" aria-pressed="' + !!hasReaction(item, 'likedBy') + '">Like <span>' + (item.likedBy || []).length + '</span></button>' +
      (voting ? '<button type="button" data-action="dislike" aria-pressed="' + !!hasReaction(item, 'dislikedBy') + '">Dislike <span>' + (item.dislikedBy || []).length + '</span></button>' : '') +
      '<button type="button" data-action="reply">' + (voting && path.split('/').length === 2 ? 'Answer' : 'Reply') + '</button>' +
      (isOwnReview(item) ? '<button type="button" data-action="edit">Edit</button>' : '') + '</div>';
  }
  function contentHtml(item) {
    return (item.rating !== undefined ? '<div class="review-stars">' + stars(item.rating) + '</div>' : '') + '<p class="review-text">' + escapeHtml(item.text) + '</p>';
  }
  function itemHtml(item, path, addressed) {
    var parts = path.split('/'), root = parts.length === 2, children = '';
    if (root && parts[0] === 'reviews') children = (item.replies || []).map(function (reply) {
      var target = (item.replies || []).find(function (entry) { return entry._id === reply.replyTo; });
      return itemHtml(reply, path + '/replies/' + reply._id, author(target || item));
    }).join('');
    if (root && parts[0] === 'questions') children = (item.answers || []).map(function (answer) {
      return itemHtml(answer, path + '/answers/' + answer._id) + (answer.replies || []).map(function (reply) {
        var target = (answer.replies || []).find(function (entry) { return entry._id === reply.replyTo; });
        return itemHtml(reply, path + '/answers/' + answer._id + '/replies/' + reply._id, author(target || answer));
      }).join('');
    }).join('');
    return '<article class="' + (root ? 'review-row' : 'community-reply') + '" data-path="' + escapeHtml(path) + '">' + reviewAvatarHtml(item.user, author(item)) +
      '<div class="review-row__body"><div class="review-name">' + escapeHtml(author(item)) + '</div>' +
      (addressed ? '<div class="reply-address">Replying to <strong>' + escapeHtml(addressed) + '</strong></div>' : '') +
      '<div class="community-content">' + contentHtml(item) + '</div>' + actionsHtml(item, path) +
      '<div class="community-composer-slot"></div><div class="error-text community-error" role="alert"></div>' +
      (children ? '<div class="review-replies">' + children + '</div>' : '') + '</div></article>';
  }
  function sortedItems(kind) {
    var sort = kind === 'reviews' ? state.reviewSort : questionSort;
    return (state[kind] || []).slice().sort(function (a, b) {
      var date = new Date(b.createdAt) - new Date(a.createdAt);
      if (sort === 'oldest') return -date;
      if (sort === 'highest') return b.rating - a.rating || date;
      if (sort === 'lowest') return a.rating - b.rating || date;
      if (sort === 'helpful') return ((b.likedBy || []).length - (b.dislikedBy || []).length) - ((a.likedBy || []).length - (a.dislikedBy || []).length) || date;
      return date;
    });
  }
  function countLabel(count, kind) { return count + ' ' + (kind === 'reviews' ? 'Review' : 'Question') + (count === 1 ? '' : 's'); }
  function renderList(kind) {
    var list = document.getElementById('community-list'); if (!list || state.tab !== kind) return;
    var items = sortedItems(kind);
    if (state[kind + 'Error']) { renderRetryState(list, state[kind + 'Error'], kind === 'reviews' ? loadReviews : loadQuestions); return; }
    list.innerHTML = items.slice(0, communityLimit[kind]).map(function (item) { return itemHtml(item, kind + '/' + item._id); }).join('') || '<p class="faint community-empty">' + (kind === 'reviews' ? 'No reviews yet. Share your experience with this product.' : 'No questions yet. Start the conversation.') + '</p>';
    var more = document.getElementById('community-more'); if (more) more.hidden = items.length <= communityLimit[kind];
  }
  function renderTabBody() {
    var p = state.product, body = document.getElementById('tab-body'), kind = state.tab;
    body.setAttribute('role', 'tabpanel'); body.setAttribute('aria-labelledby', 'tab-' + kind);
    if (kind === 'info') { body.innerHTML = '<div class="product-tab-copy">Category: ' + escapeHtml(p.category) + '<br>' + (p.measurements ? 'Dimensions: ' + escapeHtml(p.measurements) + '<br>' : '') + 'SKU: ' + escapeHtml(p.sku) + '<br>Assembly: no tools required, ready to use out of the box.</div>'; return; }
    if (kind === 'questions' && state.questions === null) { body.innerHTML = '<p role="status">Loading questions…</p>'; loadQuestions(); return; }
    var reviews = kind === 'reviews', items = state[kind], count = items.length;
    body.innerHTML = '<section class="reviews-panel"><h2>' + (reviews ? 'Customer Reviews' : 'Product Questions') + '</h2>' +
      (reviews ? '<div class="review-summary">' + stars(p.ratingAvg) + '<span>' + countLabel(count, kind) + '</span></div>' : '<p class="faint">Ask about this product. Share what you know.</p>') +
      '<div class="review-product-name">' + escapeHtml(p.name) + '</div>' +
      '<form class="community-create" data-kind="' + kind + '">' + '<div class="community-emoji" role="toolbar" aria-label="Insert emoji">' + ['❤️', '🙌', '👍', '😊', '🤣', '😡'].map(function (emoji) { return '<button type="button" data-emoji="' + emoji + '" aria-label="Insert ' + emoji + '">' + emoji + '</button>'; }).join('') + '</div>' + (reviews ? '<div class="compose-rating">' + ratingInput(5) + '</div>' : '') +
      '<div class="community-create__field"><textarea name="text" maxlength="1000" rows="1" required aria-label="' + (reviews ? 'Write your review' : 'Ask a product question') + '" placeholder="' + (reviews ? 'Share your experience' : 'What would you like to know?') + '"></textarea><button type="submit" class="btn btn--dark">' + (reviews ? 'Write Review' : 'Ask question') + '</button></div><div class="error-text" role="alert"></div></form>' +
      (!state.me ? '<p class="community-signin"><a href="login.html?next=' + encodeURIComponent('product.html?id=' + productId) + '">Sign in</a> to join the conversation.' + (reviews ? ' Reviews are available to customers who purchased this product.' : '') + '</p>' : '') +
      '<div class="review-list-head"><h3>' + countLabel(count, kind) + '</h3><label class="community-sort"><span class="sr-only">Sort ' + kind + '</span><select id="community-sort" class="input"><option value="newest">Newest</option><option value="oldest">Oldest</option>' +
      (reviews ? '<option value="highest">Highest rating</option><option value="lowest">Lowest rating</option>' : '<option value="helpful">Most helpful</option>') + '</select>' + icon('chevron') + '</label></div><div id="community-list"></div><button id="community-more" class="btn btn--outline" type="button">Load more</button></section>';
    var sort = document.getElementById('community-sort'); sort.value = reviews ? state.reviewSort : questionSort;
    sort.onchange = function () { if (reviews) state.reviewSort = sort.value; else questionSort = sort.value; renderList(kind); };
    document.getElementById('community-more').onclick = function () { communityLimit[kind] += 5; renderList(kind); };
    body.onclick = communityClick; body.onsubmit = communitySubmit;
    body.onchange = function (event) { if (event.target.name !== 'rating') return; event.target.closest('fieldset').querySelectorAll('label').forEach(function (label) { label.classList.toggle('is-filled', Number(label.querySelector('input').value) <= Number(event.target.value)); }); };
    renderList(kind);
  }
  function findItem(path) {
    var parts = path.split('/'), item = state[parts[0]].find(function (entry) { return entry._id === parts[1]; });
    for (var i = 2; i < parts.length; i += 2) item = (item[parts[i]] || []).find(function (entry) { return entry._id === parts[i + 1]; });
    return item;
  }
  function ownElement(row, selector) { return row.querySelector(':scope > .review-row__body > ' + selector); }
  function requireAuth() { if (state.me) return true; redirectToLogin(); return false; }
  async function requestCommunity(container, call) {
    if (container.dataset.busy === 'true') return null;
    container.dataset.busy = 'true'; container.setAttribute('aria-busy', 'true');
    var controls = Array.from(container.querySelectorAll('button, textarea, input'));
    controls.forEach(function (control) { control.disabled = true; });
    var error = container.matches('article') ? ownElement(container, '.community-error') : container.querySelector('.error-text');
    if (error) error.textContent = '';
    try {
      var response = await call();
      if (!response || response._status >= 400) throw new Error(response && (Array.isArray(response.message) ? response.message.join(' ') : response.message) || 'Could not save. Please try again.');
      return response;
    } catch (failure) { if (error) error.textContent = failure.message; return null; }
    finally { container.dataset.busy = 'false'; container.removeAttribute('aria-busy'); controls.forEach(function (control) { control.disabled = false; }); }
  }
  async function communityClick(event) {
    var emoji = event.target.closest('[data-emoji]');
    if (emoji) { var input = emoji.closest('form').elements.text; if (input.value.length + emoji.dataset.emoji.length <= input.maxLength) input.setRangeText(emoji.dataset.emoji, input.selectionStart, input.selectionEnd, 'end'); input.focus(); return; }
    var button = event.target.closest('[data-action]'); if (!button) return;
    var row = button.closest('[data-path]'), path = row.dataset.path, item = findItem(path), action = button.dataset.action;
    if (action === 'cancel-edit') { ownElement(row, '.community-content').innerHTML = contentHtml(item); ownElement(row, '.review-actions').hidden = false; ownElement(row, '.review-actions').querySelector('[data-action="edit"]').focus(); return; }
    if (action === 'cancel-reply') { ownElement(row, '.community-composer-slot').innerHTML = ''; ownElement(row, '.review-actions').querySelector('[data-action="reply"]').focus(); return; }
    if (!requireAuth()) return;
    if (action === 'like' || action === 'dislike') {
      var result = await requestCommunity(row, function () { return apiPost('/products/' + productId + '/' + path + '/' + action); });
      if (!result) return;
      ['likedBy', 'dislikedBy'].forEach(function (field) {
        if (field === 'dislikedBy' && path.indexOf('reviews/') === 0) return;
        item[field] = (item[field] || []).filter(function (id) { return String(id) !== String(state.me._id); });
        if (result[field === 'likedBy' ? 'liked' : 'disliked']) item[field].push(state.me._id);
      });
      var actions = ownElement(row, '.review-actions');
      ['like', 'dislike'].forEach(function (reaction) { var control = actions.querySelector('[data-action="' + reaction + '"]'); if (!control) return; control.setAttribute('aria-pressed', String(!!result[reaction === 'like' ? 'liked' : 'disliked'])); control.querySelector('span').textContent = result[reaction === 'like' ? 'likesCount' : 'dislikesCount']; });
      return;
    }
    if (action === 'edit') {
      ownElement(row, '.community-composer-slot').innerHTML = '';
      ownElement(row, '.review-actions').hidden = true;
      ownElement(row, '.community-content').innerHTML = '<form class="community-edit">' + (item.rating !== undefined ? ratingInput(item.rating) : '') + '<textarea class="input" name="text" rows="3" maxlength="1000" required aria-label="Edit ' + (item.rating !== undefined ? 'review' : 'message') + '">' + escapeHtml(item.text) + '</textarea><div class="inline-controls"><button class="btn btn--dark" type="submit">Save</button><button type="button" data-action="cancel-edit">Cancel</button></div><div class="error-text" role="alert"></div></form>';
      ownElement(row, '.community-content').querySelector('textarea').focus(); return;
    }
    if (action === 'reply') {
      var slot = ownElement(row, '.community-composer-slot');
      if (slot.children.length) { slot.innerHTML = ''; return; }
      slot.innerHTML = '<form class="community-reply-form"><label>Replying to <strong>' + escapeHtml(author(item)) + '</strong><textarea class="input" name="text" rows="2" maxlength="1000" required aria-label="Reply to ' + escapeHtml(author(item)) + '"></textarea></label><div class="inline-controls"><button class="btn btn--dark send-reply" type="submit" aria-label="Send reply">' + icon('send') + '</button><button type="button" data-action="cancel-reply">Cancel</button></div><div class="error-text" role="alert"></div></form>';
      slot.querySelector('textarea').focus();
    }
  }
  async function communitySubmit(event) {
    var form = event.target;
    if (!form.matches('.community-create, .community-edit, .community-reply-form')) return;
    event.preventDefault(); if (!requireAuth()) return;
    var text = form.elements.text.value.trim();
    if (!text) { form.querySelector('.error-text').textContent = 'Please enter some text.'; form.elements.text.focus(); return; }
    var data = { text: text }, row = form.closest('[data-path]'), path = row && row.dataset.path;
    if (form.elements.rating) data.rating = Number(form.elements.rating.value);
    if (form.matches('.community-create')) {
      var kind = form.dataset.kind;
      var created = await requestCommunity(form, function () { return apiPost('/products/' + productId + '/' + kind, data); });
      if (!created) return;
      created.user = state.me; state[kind].unshift(created); form.reset();
      form.querySelectorAll('.community-rating label').forEach(function (label) { label.classList.add('is-filled'); });
      updateSummary(kind); renderList(kind); return;
    }
    var edit = form.matches('.community-edit'), parts = path.split('/'), endpoint = path;
    if (!edit) {
      if (parts[0] === 'reviews') { endpoint = parts.slice(0, 2).join('/') + '/replies'; if (parts.length > 2) data.replyToId = parts[3]; }
      else if (parts.length === 2) endpoint += '/answers';
      else { endpoint = parts.slice(0, 4).join('/') + '/replies'; if (parts.length > 4) data.replyToId = parts[5]; }
    }
    var response = await requestCommunity(form, function () { return edit ? apiPatch('/products/' + productId + '/' + endpoint, data) : apiPost('/products/' + productId + '/' + endpoint, data); });
    if (!response) return;
    var index = state[parts[0]].findIndex(function (entry) { return entry._id === parts[1]; });
    state[parts[0]][index] = response;
    if (edit) {
      var updated = findItem(path);
      ownElement(row, '.community-content').innerHTML = contentHtml(updated);
      ownElement(row, '.review-actions').hidden = false;
      ownElement(row, '.review-actions').querySelector('[data-action="edit"]').focus();
    } else {
      var root = row.closest('.review-row'), rootPath = parts.slice(0, 2).join('/');
      root.outerHTML = itemHtml(response, rootPath);
      var restored = document.querySelector('[data-path="' + path + '"]');
      if (restored) ownElement(restored, '.review-actions').querySelector('[data-action="reply"]').focus();
    }
    updateSummary(parts[0]);
  }
  function updateSummary(kind) {
    if (kind === 'reviews') {
      state.product.reviewsCount = state.reviews.length;
      state.product.ratingAvg = state.reviews.reduce(function (total, review) { return total + review.rating; }, 0) / (state.reviews.length || 1);
      var summary = document.querySelector('.review-summary'); if (summary) summary.innerHTML = stars(state.product.ratingAvg) + '<span>' + countLabel(state.reviews.length, 'reviews') + '</span>';
      var productRating = document.querySelector('.product-rating'); if (productRating) productRating.textContent = starString(state.product.ratingAvg) + ' ' + state.product.reviewsCount + ' Reviews';
    }
    var heading = document.querySelector('.review-list-head h3'); if (heading && state.tab === kind) heading.textContent = countLabel(state[kind].length, kind);
  }
  function loadQuestions() {
    apiGetSilent('/products/' + productId + '/questions').then(function (questions) { state.questions = Array.isArray(questions) ? questions : []; state.questionsError = Array.isArray(questions) ? '' : (questions && questions.message) || 'Questions could not be loaded.'; if (state.tab === 'questions') renderTabBody(); });
  }
  function loadReviews() {
    apiGetSilent('/products/' + productId + '/reviews').then(function (reviews) { state.reviews = Array.isArray(reviews) ? reviews : []; state.reviewsError = Array.isArray(reviews) ? '' : (reviews && reviews.message) || 'Reviews could not be loaded.'; if (state.tab === 'reviews') renderTabBody(); });
  }
  function loadRecommendations() { apiGetSilent('/products?take=8&category=' + encodeURIComponent(state.product.category)).then(function (response) { var products = response && Array.isArray(response.data) ? response.data : [], recommendations = products.filter(function (product) { return product._id !== productId; }).slice(0, 5); if (!recommendations.length) return; var section = document.getElementById('product-recommendations'), grid = document.getElementById('recommended-products'); grid.innerHTML = recommendations.map(productCardHtml).join(''); wireAddToCartButtons(grid); section.hidden = false; }); }
  function loadProduct() { Promise.all([apiGetSilent('/products/' + productId), apiGetSilent('/products/' + productId + '/reviews'), apiGetSilent('/auth/me')]).then(function (results) { var product = results[0]; if (!product || product._status >= 500 || product._networkError) { renderRetryState(document.getElementById('product-content'), product && product.message, loadProduct); return; } if (product._status >= 400) { document.getElementById('product-content').innerHTML = '<p>Product not found.</p>'; return; } state.product = product; state.reviews = Array.isArray(results[1]) ? results[1] : []; state.reviewsError = Array.isArray(results[1]) ? '' : (results[1] && results[1].message) || 'Reviews could not be loaded.'; state.me = results[2] && results[2].user; function afterAuth() { renderProduct(); renderTabs(); renderTabBody(); loadRecommendations(); } if (state.me) apiGetSilent('/users/me/wishlist').then(function (wishlist) { state.wishlisted = Array.isArray(wishlist) && wishlist.some(function (item) { return item._id === productId; }); afterAuth(); }); else afterAuth(); }); }
  document.getElementById('newsletter-slot').innerHTML = newsletterHtml(); wireNewsletterForm(); loadProduct();
})();
