(function () {
  var categories = ['All Rooms', 'Living Room', 'Bedroom', 'Kitchen', 'Bathroom', 'Dining', 'Outdoor'];
  var prices = [
    { label: 'All Price' },
    { label: '$0.00 - 99.99', min: 0, max: 99.99 },
    { label: '$100.00 - 199.99', min: 100, max: 199.99 },
    { label: '$200.00 - 299.99', min: 200, max: 299.99 },
    { label: '$300.00 - 399.99', min: 300, max: 399.99 },
    { label: '$400.00+', min: 400 }
  ];
  var sizes = { three: 9, four: 12, two: 6, list: 6 };
  var state = {
    category: categories.includes(qs('category')) ? qs('category') : 'All Rooms',
    search: (qs('q') || '').trim(), price: 0, sort: 'newest', view: 'three',
    products: [], total: 0, page: 0, loading: false, request: 0
  };
  var grid = document.getElementById('product-grid');
  var more = document.getElementById('show-more');
  var status = document.getElementById('shop-status');
  var layout = document.querySelector('.shop-layout');
  var categorySelect = document.getElementById('category-select');
  var priceSelect = document.getElementById('price-select');

  document.querySelectorAll('[data-store-icon]').forEach(function (element) {
    element.innerHTML = storeIcon(element.dataset.storeIcon);
  });
  categorySelect.innerHTML = categories.map(function (category) {
    return '<option>' + category + '</option>';
  }).join('');
  priceSelect.innerHTML = prices.map(function (price, index) {
    return '<option value="' + index + '">' + price.label + '</option>';
  }).join('');
  function syncFilters() {
    categorySelect.value = state.category;
    priceSelect.value = String(state.price);
    document.getElementById('active-category-label').textContent = state.search ? 'Search: ' + state.search : state.category;
    document.getElementById('category-list').innerHTML = categories.map(function (category) {
      return '<button type="button" data-cat="' + category + '" class="' +
        (category === state.category ? 'is-active' : '') + '" aria-pressed="' +
        (category === state.category) + '">' + category + '</button>';
    }).join('');
    document.getElementById('price-list').innerHTML = prices.map(function (price, index) {
      return '<label>' + price.label + '<input type="radio" name="price-range" value="' +
        index + '"' + (index === state.price ? ' checked' : '') + '></label>';
    }).join('');
  }
  function render() {
    grid.innerHTML = state.products.map(productCardHtml).join('');
    if (state.view === 'two' || state.view === 'list') {
      grid.querySelectorAll('.product-card').forEach(function (card, index) {
        var details = document.createElement('div');
        details.className = 'shop-card-details';
        details.appendChild(card.lastElementChild);
        var description = document.createElement('p');
        description.className = 'shop-card-description';
        description.textContent = state.products[index].description || '';
        details.appendChild(description);
        details.appendChild(card.querySelector('[data-add-id]'));
        var wishlist = card.querySelector('[data-wish-id]');
        wishlist.classList.add('shop-card-wishlist');
        details.appendChild(wishlist);
        card.appendChild(details);
      });
    }
    wireAddToCartButtons(grid);
    more.hidden = state.products.length >= state.total;
  }
  async function load(append) {
    var request = ++state.request;
    var page = append ? state.page + 1 : 1;
    state.loading = true;
    grid.setAttribute('aria-busy', 'true');
    more.disabled = true;
    status.textContent = 'Loading products…';
    if (!append) { state.products = []; state.total = 0; render(); }
    var params = new URLSearchParams({ page: String(page), take: String(sizes[state.view]), sort: state.sort });
    if (state.category !== 'All Rooms') params.set('category', state.category);
    if (state.search) params.set('search', state.search);
    var price = prices[state.price];
    if (price.min !== undefined) params.set('minPrice', price.min);
    if (price.max !== undefined) params.set('maxPrice', price.max);
    try {
      var response = await apiGetSilent('/products?' + params);
      if (request !== state.request) return;
      if (!response || response._status >= 400 || !Array.isArray(response.data)) throw new Error('load');
      var combined = append ? state.products.concat(response.data) : response.data;
      state.products = combined.filter(function (product, index, all) {
        return all.findIndex(function (item) { return item._id === product._id; }) === index;
      });
      state.page = page;
      state.total = Number(response.total) || 0;
      render();
      status.textContent = state.products.length ? '' : 'No products found. Try another category or price range.';
    } catch (error) {
      if (request !== state.request) return;
      status.textContent = '';
      renderRetryState(status, 'Products could not be loaded. Please try again.', function () { load(append); });
    } finally {
      if (request === state.request) {
        state.loading = false;
        grid.setAttribute('aria-busy', 'false');
        more.disabled = false;
      }
    }
  }
  function filterChanged() { syncFilters(); load(false); }
  document.getElementById('category-list').addEventListener('click', function (event) {
    var button = event.target.closest('[data-cat]');
    if (button) { state.category = button.dataset.cat; filterChanged(); }
  });
  document.getElementById('price-list').addEventListener('change', function (event) {
    state.price = Number(event.target.value); filterChanged();
  });
  categorySelect.addEventListener('change', function () { state.category = this.value; filterChanged(); });
  priceSelect.addEventListener('change', function () { state.price = Number(this.value); filterChanged(); });
  document.getElementById('sort-select').addEventListener('change', function () { state.sort = this.value; load(false); });
  document.querySelectorAll('[data-shop-view]').forEach(function (button) {
    button.addEventListener('click', function () {
      if (state.view === button.dataset.shopView) return;
      state.view = button.dataset.shopView;
      layout.dataset.view = state.view;
      document.querySelectorAll('[data-shop-view]').forEach(function (item) {
        item.setAttribute('aria-pressed', String(item === button));
      });
      load(false);
    });
  });
  more.addEventListener('click', function () { if (!state.loading) load(true); });
  document.getElementById('mobile-filter-toggle').addEventListener('click', function () {
    var open = document.getElementById('shop-sidebar').classList.toggle('is-open');
    this.setAttribute('aria-expanded', String(open));
  });
  syncFilters();
  load(false);
  document.getElementById('newsletter-slot').innerHTML = newsletterHtml();
  wireNewsletterForm();
})();
