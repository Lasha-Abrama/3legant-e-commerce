(function () {
  var postId = qs('id');
  function contentHtml(post) {
    var images = (post.supportingImages || []).filter(function (url) { return safeImageUrl(url); });
    var paragraphs = (post.content || '').split(/\n\s*\n/).filter(Boolean);
    return paragraphs.map(function (paragraph, index) {
      var match = paragraph.match(/^##\s+([^\n]+)(?:\n([\s\S]*))?$/);
      var html = match ? '<h2>' + escapeHtml(match[1]) + '</h2>' +
        (match[2] ? '<p>' + escapeHtml(match[2]) + '</p>' : '') : '<p>' + escapeHtml(paragraph) + '</p>';
      if (images[index]) html += '<figure><img src="' + safeImageUrl(images[index]) + '" alt="Supporting interior detail for ' + escapeHtml(post.title) + '" loading="lazy"></figure>';
      return html;
    }).join('');
  }
  async function related(post) {
    var query = '/blogs?take=3&exclude=' + encodeURIComponent(post._id);
    var same = post.category ? await apiGetSilent(query + '&category=' + encodeURIComponent(post.category)) : null;
    var selected = same && Array.isArray(same.data) ? same.data.filter(function (item) { return item._id !== post._id; }) : [];
    for (var suffix of ['&featured=true', '&sort=newest']) {
      if (selected.length >= 3) break;
      var response = await apiGetSilent(query + suffix);
      if (response && Array.isArray(response.data)) response.data.forEach(function (item) {
        if (item._id !== post._id && !selected.some(function (existing) { return existing._id === item._id; })) selected.push(item);
      });
    }
    var container = document.getElementById('related-posts');
    if (selected.length) {
      container.innerHTML = '<div class="section-head"><h2>You might also like</h2><a href="blog.html">More articles →</a></div>' +
        '<div class="related-grid">' + selected.slice(0, 3).map(articleCardHtml).join('') + '</div>';
    } else {
      container.innerHTML = '<a href="blog.html">More articles →</a>';
    }
  }
  function renderPost(post) {
    setBreadcrumb(document.getElementById('crumb'), [{ label: 'Home', href: '/' }, { label: 'Blog', href: 'blog.html' }, { label: post.title }]);
    document.title = post.title + ' — 3legant';
    var author = post.author && typeof post.author === 'object' ? post.author : null;
    var name = author && (author.displayName || [author.firstName, author.lastName].filter(Boolean).join(' '));
    var date = new Date(post.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    document.getElementById('post-content').innerHTML =
      '<article><div class="post-eyebrow">' + escapeHtml(post.category || 'ARTICLE') + '</div>' +
      '<h1 class="post-title">' + escapeHtml(post.title) + '</h1>' +
      '<div class="post-meta"><span>' + (name ? 'By ' + escapeHtml(name) : 'Author not recorded') + '</span>' +
      '<time datetime="' + escapeHtml(post.createdAt) + '">' + date + '</time></div>' +
      '<div class="post-image"><img src="' + safeImageUrl(articleImageUrl(post)) + '" alt="' + escapeHtml(post.title) + '"></div>' +
      '<div class="article-body">' + contentHtml(post) + '<a class="back-to-blog" href="blog.html">← Back to Blog</a></div></article>' +
      '<section id="related-posts" aria-label="Related articles"></section>';
    related(post);
  }
  function loadPost() {
    apiGetSilent('/blogs/' + encodeURIComponent(postId)).then(function (post) {
      if (!post || post._status >= 500 || post._networkError) {
        renderRetryState(document.getElementById('post-content'), post && post.message, loadPost); return;
      }
      if (post._status >= 400) { document.getElementById('post-content').textContent = 'Blog post not found.'; return; }
      renderPost(post);
    });
  }
  if (postId) loadPost(); else document.getElementById('post-content').textContent = 'Blog post not found.';
  document.getElementById('newsletter-slot').innerHTML = newsletterHtml(); wireNewsletterForm();
})();
