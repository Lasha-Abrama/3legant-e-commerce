(function () {
  var CATEGORIES = ['All Rooms', 'Living Room', 'Bedroom', 'Kitchen', 'Bathroom', 'Dining', 'Outdoor'];
  var PRICE_BRACKETS = [
    { label: '$0 - $100', min: 0, max: 100 },
    { label: '$100 - $150', min: 100, max: 150 },
    { label: '$150 - $200', min: 150, max: 200 },
    { label: '$200 - $300', min: 200, max: 300 },
    { label: '$300 - $400', min: 300, max: 400 },
    { label: '$400+', min: 400, max: Infinity },
  ];
  var PAGE_SIZE = 9;

  var state = {
    category: 'All Rooms',
    prices: {},
    search: (qs('q') || '').trim(),
    sort: '',
    visible: PAGE_SIZE,
    allProducts: [],
  };

  function updateResultsLabel() {
    document.getElementById('active-category-label').textContent = state.search
      ? 'Search: “' + state.search + '”'
      : state.category;
  }

  function renderCategoryList() {
    document.getElementById('category-list').innerHTML = CATEGORIES.map(function (c) {
      return '<button data-cat="' + c + '" class="' + (state.category === c ? 'is-active' : '') + '">' + c + '</button>';
    }).join('');
    document.querySelectorAll('#category-list button').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.category = btn.getAttribute('data-cat');
        state.visible = PAGE_SIZE;
        updateResultsLabel();
        loadProducts();
      });
    });
  }

  function renderPriceList() {
    document.getElementById('price-list').innerHTML = PRICE_BRACKETS.map(function (p, i) {
      return '<label><input type="checkbox" data-price-idx="' + i + '"> ' + p.label + '</label>';
    }).join('');
    document.querySelectorAll('#price-list input').forEach(function (input) {
      input.addEventListener('change', function () {
        var idx = input.getAttribute('data-price-idx');
        state.prices[idx] = input.checked;
        state.visible = PAGE_SIZE;
        renderGrid();
      });
    });
  }

  function matchesPrice(price) {
    var active = Object.keys(state.prices).filter(function (k) { return state.prices[k]; });
    if (active.length === 0) return true;
    return active.some(function (idx) {
      var b = PRICE_BRACKETS[idx];
      return price >= b.min && price <= b.max;
    });
  }

  function applySort(list) {
    var sorted = list.slice();
    if (state.sort === 'price_asc') sorted.sort(function (a, b) { return a.price - b.price; });
    if (state.sort === 'price_desc') sorted.sort(function (a, b) { return b.price - a.price; });
    if (state.sort === 'newest') sorted.sort(function (a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });
    return sorted;
  }

  function renderGrid() {
    var filtered = applySort(state.allProducts.filter(function (p) { return matchesPrice(p.price); }));
    var slice = filtered.slice(0, state.visible);
    var grid = document.getElementById('product-grid');
    grid.innerHTML = slice.length
      ? slice.map(productCardHtml).join('')
      : '<div class="shop-empty">No products found' +
        (state.search ? ' for “' + escapeHtml(state.search) + '”' : '') +
        '.</div>';
    wireAddToCartButtons(grid);
    document.getElementById('show-more').style.display = slice.length >= filtered.length ? 'none' : 'inline-flex';
  }

  function loadProducts() {
    renderCategoryList();
    var url = '/products?take=200' + (state.category !== 'All Rooms' ? '&category=' + encodeURIComponent(state.category) : '');
    if (state.search) url += '&search=' + encodeURIComponent(state.search);
    apiGetSilent(url).then(function (res) {
      state.allProducts = (res && res.data) || [];
      renderGrid();
    });
  }

  updateResultsLabel();
  renderPriceList();
  loadProducts();

  document.getElementById('sort-select').addEventListener('change', function (e) {
    state.sort = e.target.value;
    renderGrid();
  });

  document.getElementById('show-more').addEventListener('click', function () {
    state.visible += PAGE_SIZE;
    renderGrid();
  });

  document.getElementById('mobile-filter-toggle').addEventListener('click', function () {
    document.getElementById('shop-sidebar').classList.toggle('is-open');
  });

  document.getElementById('newsletter-slot').innerHTML = newsletterHtml();
  wireNewsletterForm();
})();
