(function () {
  function formatDate(iso) {
    return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  function articleCardHtml(p) {
    return (
      '<a class="article-card" href="blog-post.html?id=' + encodeURIComponent(p._id) + '">' +
        '<div class="ph" style="width:100%;height:180px;border-radius:10px;padding:0;">' +
          '<img src="' + safeImageUrl(p.image) + '" alt="' + escapeHtml(p.title) + '" style="width:100%;height:100%;object-fit:cover;">' +
        '</div>' +
        '<div class="article-card__title" style="font-size:15px;">' + escapeHtml(p.title) + '</div>' +
        '<div class="article-card__date">' + formatDate(p.createdAt) + '</div>' +
      '</a>'
    );
  }

  apiGetSilent('/blogs?take=9').then(function (res) {
    var posts = (res && res.data) || [];
    document.getElementById('post-grid').innerHTML = posts.length
      ? posts.map(articleCardHtml).join('')
      : '<div class="faint">No blog posts yet.</div>';
  });

  document.getElementById('newsletter-slot').innerHTML = newsletterHtml();
  wireNewsletterForm();
})();
