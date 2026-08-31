(function () {
  var postId = qs('id');

  function formatDate(iso) {
    return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  function renderPost(p) {
    document.getElementById('crumb').textContent = 'Home / Blog / ' + p.title;
    document.title = p.title + ' — Gita_3_Team_2';

    document.getElementById('post-content').innerHTML =
      '<div class="ph" style="width:100%;height:360px;border-radius:14px;padding:0;margin-bottom:28px;">' +
        '<img src="' + safeImageUrl(p.image) + '" alt="' + escapeHtml(p.title) + '" style="width:100%;height:100%;object-fit:cover;">' +
      '</div>' +
      '<h1 style="font-size:34px;font-weight:500;line-height:1.2;margin-bottom:10px;">' + escapeHtml(p.title) + '</h1>' +
      '<div class="muted" style="font-size:13px;margin-bottom:28px;">' + formatDate(p.createdAt) + '</div>' +
      '<p style="font-size:15px;line-height:1.9;color:#4a4843;white-space:pre-wrap;">' + escapeHtml(p.content) + '</p>' +
      '<a href="blog.html" style="display:inline-block;margin-top:36px;font-size:13px;text-decoration:underline;">&larr; Back to Blog</a>';
  }

  function loadPost() {
    apiGetSilent('/blogs/' + postId).then(function (post) {
      if (!post || post._status >= 500 || post._networkError) {
        renderRetryState(document.getElementById('post-content'), post && post.message, loadPost);
        return;
      }
      if (post._status >= 400) {
        document.getElementById('post-content').innerHTML = '<p>Blog post not found.</p>';
        return;
      }
      renderPost(post);
    });
  }

  if (!postId) {
    document.getElementById('post-content').innerHTML = '<p>Blog post not found.</p>';
  } else {
    loadPost();
  }

  document.getElementById('newsletter-slot').innerHTML = newsletterHtml();
  wireNewsletterForm();
})();
