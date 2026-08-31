(function () {
  var PAGE_SIZE = 6;
  var state = { filter: 'all', sort: 'newest', page: 1, posts: [], total: 0, loading: false };

  function formatDate(iso) {
    return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  function articleCardHtml(post) {
    return (
      '<a class="article-card" href="blog-post.html?id=' + encodeURIComponent(post._id) + '">' +
        '<div class="ph" style="width:100%;height:180px;border-radius:10px;padding:0;">' +
          '<img src="' + safeImageUrl(post.image) + '" alt="' + escapeHtml(post.title) + '" style="width:100%;height:100%;object-fit:cover;">' +
        '</div>' +
        '<div class="article-card__title" style="font-size:15px;">' + escapeHtml(post.title) + '</div>' +
        '<div class="article-card__date">' + formatDate(post.createdAt) + '</div>' +
      '</a>'
    );
  }

  function renderPosts() {
    var grid = document.getElementById('post-grid');
    grid.innerHTML = state.posts.length
      ? state.posts.map(articleCardHtml).join('')
      : '<div class="shop-empty">No blog posts found.</div>';
    document.getElementById('blog-show-more').style.display =
      state.posts.length < state.total ? 'inline-flex' : 'none';
  }

  function loadPosts(append) {
    if (state.loading) return;
    state.loading = true;
    var showMore = document.getElementById('blog-show-more');
    showMore.disabled = true;
    showMore.textContent = 'Loading...';
    var url = '/blogs?take=' + PAGE_SIZE + '&page=' + state.page + '&sort=' + state.sort;
    if (state.filter === 'featured') url += '&featured=true';

    apiGetSilent(url).then(function (res) {
      if (!res || res._status >= 400) throw new Error('Blog posts could not be loaded');
      state.posts = append ? state.posts.concat(res.data || []) : (res.data || []);
      state.total = res.total || 0;
      renderPosts();
    }).catch(function () {
      document.getElementById('post-grid').innerHTML =
        '<div class="shop-empty">Blog posts could not be loaded. Please try again.</div>';
      showMore.style.display = 'none';
    }).finally(function () {
      state.loading = false;
      showMore.disabled = false;
      showMore.textContent = 'Show more';
    });
  }

  document.querySelectorAll('[data-filter]').forEach(function (button) {
    button.addEventListener('click', function () {
      state.filter = button.getAttribute('data-filter');
      state.page = 1;
      state.posts = [];
      document.querySelectorAll('[data-filter]').forEach(function (item) {
        item.classList.toggle('is-active', item === button);
      });
      loadPosts(false);
    });
  });

  document.getElementById('blog-sort-select').addEventListener('change', function (event) {
    state.sort = event.target.value;
    state.page = 1;
    state.posts = [];
    loadPosts(false);
  });

  document.getElementById('blog-show-more').addEventListener('click', function () {
    state.page += 1;
    loadPosts(true);
  });

  document.getElementById('newsletter-slot').innerHTML = newsletterHtml();
  wireNewsletterForm();
  loadPosts(false);
})();
