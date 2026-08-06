(function () {
  var CATEGORIES = [
    { name: 'Living Room', placeholder: 'Living room photo' },
    { name: 'Bedroom', placeholder: 'Bedroom photo' },
    { name: 'Kitchen', placeholder: 'Kitchen photo' },
  ];
  var FEATURES = [
    { icon: '🚚', title: 'Free Shipping', sub: 'Order above $200' },
    { icon: '↩', title: 'Money-back', sub: '30 days guarantee' },
    { icon: '🔒', title: 'Secure Payments', sub: 'Secured by Stripe' },
    { icon: '☎', title: '24/7 Support', sub: 'Phone and email support' },
  ];

  document.getElementById('category-grid').innerHTML = CATEGORIES.map(function (c) {
    return (
      '<div class="category-tile">' +
        '<div class="ph" style="width:100%;height:200px;">' + c.placeholder + '</div>' +
        '<div class="category-tile__overlay"></div>' +
        '<div class="category-tile__text">' +
          '<div class="category-tile__name">' + c.name + '</div>' +
          '<a class="category-tile__link" href="shop.html">Shop Now &rarr;</a>' +
        '</div>' +
      '</div>'
    );
  }).join('');

  document.getElementById('feature-grid').innerHTML = FEATURES.map(function (f) {
    return (
      '<div class="feature-box">' +
        '<span class="feature-box__icon">' + f.icon + '</span>' +
        '<div><div class="feature-box__title">' + f.title + '</div><div class="feature-box__sub">' + f.sub + '</div></div>' +
      '</div>'
    );
  }).join('');

  document.getElementById('article-grid').innerHTML = window.BLOG_POSTS.slice(0, 3).map(function (a) {
    return (
      '<a class="article-card" href="blog.html">' +
        '<div class="ph" style="width:100%;height:160px;border-radius:10px;">' + a.placeholder + '</div>' +
        '<div class="article-card__title">' + a.title + '</div>' +
        '<div class="article-card__date">' + a.date + '</div>' +
      '</a>'
    );
  }).join('');

  document.getElementById('newsletter-slot').innerHTML = newsletterHtml();
  wireNewsletterForm();

  apiGetSilent('/products?sort=newest&take=4').then(function (res) {
    var grid = document.getElementById('new-arrivals');
    if (!res || !res.data) return;
    grid.innerHTML = res.data.map(productCardHtml).join('');
    wireAddToCartButtons(grid);
  });
})();
