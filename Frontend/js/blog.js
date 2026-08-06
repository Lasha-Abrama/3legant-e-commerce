(function () {
  document.getElementById('post-grid').innerHTML = window.BLOG_POSTS.map(function (p) {
    return (
      '<a class="article-card" href="#">' +
        '<div class="ph" style="width:100%;height:180px;border-radius:10px;">' + p.placeholder + '</div>' +
        '<div class="article-card__title" style="font-size:15px;">' + p.title + '</div>' +
        '<div class="article-card__date">' + p.date + '</div>' +
      '</a>'
    );
  }).join('');

  document.getElementById('newsletter-slot').innerHTML = newsletterHtml();
  wireNewsletterForm();
})();
