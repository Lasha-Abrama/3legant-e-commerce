(function () {
  var sizes = { three: 9, four: 12, two: 6, list: 6 };
  var state = { filter: 'all', sort: 'newest', view: 'three', page: 0, posts: [], total: 0, request: 0, loading: false };
  var grid = document.getElementById('post-grid');
  var more = document.getElementById('blog-show-more');
  document.getElementById('blog-layouts').innerHTML = layoutSelectorHtml();
  function render() {
    grid.dataset.view = state.view;
    grid.innerHTML = state.posts.length ? state.posts.map(articleCardHtml).join('') : '<p>No blog posts found.</p>';
    more.hidden = state.posts.length >= state.total;
  }
  async function load(append) {
    var request = ++state.request;
    var page = append ? state.page + 1 : 1;
    state.loading = true; more.disabled = true; grid.setAttribute('aria-busy', 'true');
    if (!append) { state.posts = []; grid.innerHTML = '<p role="status">Loading articles…</p>'; more.hidden = true; }
    try {
      var result = await apiGetSilent('/blogs?take=' + sizes[state.view] + '&page=' + page +
        '&sort=' + state.sort + (state.filter === 'featured' ? '&featured=true' : ''));
      if (request !== state.request) return;
      if (!result || result._status >= 400 || !Array.isArray(result.data)) throw new Error('Articles could not be loaded.');
      var posts = append ? state.posts.concat(result.data) : result.data;
      state.posts = posts.filter(function (post, index) { return posts.findIndex(function (item) { return item._id === post._id; }) === index; });
      state.total = result.total; state.page = page; render();
    } catch (error) {
      if (request === state.request) renderRetryState(grid, 'Articles could not be loaded.', function () { load(append); });
    } finally {
      if (request === state.request) { state.loading = false; more.disabled = false; grid.setAttribute('aria-busy', 'false'); }
    }
  }
  document.querySelectorAll('[data-filter]').forEach(function (button) {
    button.addEventListener('click', function () {
      state.filter = button.dataset.filter;
      document.querySelectorAll('[data-filter]').forEach(function (item) {
        item.classList.toggle('is-active', item === button); item.setAttribute('aria-pressed', String(item === button));
      }); load(false);
    });
  });
  document.getElementById('blog-sort-select').addEventListener('change', function () { state.sort = this.value; load(false); });
  document.querySelectorAll('[data-blog-view]').forEach(function (button) {
    button.addEventListener('click', function () {
      state.view = button.dataset.blogView;
      document.querySelectorAll('[data-blog-view]').forEach(function (item) { item.setAttribute('aria-pressed', String(item === button)); });
      load(false);
    });
  });
  more.addEventListener('click', function () { if (!state.loading) load(true); });
  document.getElementById('newsletter-slot').innerHTML = newsletterHtml(); wireNewsletterForm(); load(false);
})();
