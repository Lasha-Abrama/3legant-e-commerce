function breadcrumbHtml(items) {
  return '<ol>' + items.map(function (item, index) {
    return '<li>' + (index ? '<span class="breadcrumb-separator" aria-hidden="true">›</span>' : '') +
      (index === items.length - 1 ? '<span aria-current="page">' + escapeHtml(item.label) + '</span>' :
        '<a href="' + escapeHtml(item.href) + '">' + escapeHtml(item.label) + '</a>') + '</li>';
  }).join('') + '</ol>';
}
function setBreadcrumb(element, items) {
  element.setAttribute('role', 'navigation');
  element.setAttribute('aria-label', 'Breadcrumb');
  element.innerHTML = breadcrumbHtml(items);
}
document.querySelectorAll('.breadcrumb, .page-hero__crumb').forEach(function (element) {
  var parents = { Home: '/', Shop: 'shop.html', Blog: 'blog.html' };
  var labels = element.textContent.split(/[/›]/).map(function (label) { return label.trim(); }).filter(Boolean);
  setBreadcrumb(element, labels.map(function (label) { return { label: label, href: parents[label] || 'shop.html?category=' + encodeURIComponent(label) }; }));
});
function layoutSelectorHtml() {
  var paths = [
    '<path d="M2 2h5v5H2zm7 0h5v5H9zm7 0h5v5h-5zM2 9h5v5H2zm7 0h5v5H9zm7 0h5v5h-5zM2 16h5v5H2zm7 0h5v5H9zm7 0h5v5h-5z"/>',
    '<path d="M3 3h7v7H3zm11 0h7v7h-7zM3 14h7v7H3zm11 0h7v7h-7z"/>',
    '<rect x="3" y="3" width="7" height="18" rx="1"/><rect x="13" y="3" width="7" height="18" rx="1"/>',
    '<rect x="3" y="3" width="18" height="7" rx="1"/><rect x="3" y="13" width="18" height="7" rx="1"/>'
  ];
  return ['three', 'four', 'two', 'list'].map(function (view, index) {
    return '<button type="button" data-blog-view="' + view + '" aria-label="' +
      ['Three column grid', 'Four column grid', 'Two column view', 'List view'][index] +
      '" aria-pressed="' + (index === 0) + '"><svg viewBox="0 0 24 24" aria-hidden="true">' + paths[index] + '</svg></button>';
  }).join('');
}
function articleCardHtml(post) {
  var date = new Date(post.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  return '<a class="article-card" href="blog-post.html?id=' + encodeURIComponent(post._id) + '">' +
    '<div class="ph"><img src="' + safeImageUrl(articleImageUrl(post)) + '" alt="' + escapeHtml(post.title) + '" loading="lazy"></div>' +
    '<div class="article-card-copy"><h3 class="article-card__title">' + escapeHtml(post.title) + '</h3>' +
    '<time class="article-card__date" datetime="' + escapeHtml(post.createdAt) + '">' + date + '</time>' +
    '<p class="article-excerpt">' + escapeHtml(post.excerpt || '') + '</p></div></a>';
}
