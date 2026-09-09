function breadcrumbHtml(items) {
  return '<ol>' + items.map(function (item, index) {
    return '<li>' + (index ? '<span class="breadcrumb-separator" aria-hidden="true">›</span>' : '') +
      (index === items.length - 1 ? '<span aria-current="page">' + escapeHtml(item.label) + '</span>' :
        '<a href="' + escapeHtml(safeLocalRedirect(item.href, '/')) + '">' + escapeHtml(item.label) + '</a>') + '</li>';
  }).join('') + '</ol>';
}
function setBreadcrumb(element, items) {
  if (!element) return;
  element.setAttribute('role', 'navigation');
  element.setAttribute('aria-label', 'Breadcrumb');
  element.innerHTML = breadcrumbHtml(items);
}
// Static pages declare their current label; dynamic product/article pages replace
// it with the loaded title. Never split a title on slash characters or guess URLs.
document.querySelectorAll('[data-breadcrumb-current]').forEach(function (element) {
  var parents = { Shop: 'shop.html', Blog: 'blog.html' };
  var items = [{ label: 'Home', href: '/' }], parent = element.dataset.breadcrumbParent;
  if (parents[parent]) items.push({ label: parent, href: parents[parent] });
  items.push({ label: element.dataset.breadcrumbCurrent });
  setBreadcrumb(element, items);
});
function articleDateHtml(value) {
  var date = value ? new Date(value) : null;
  if (!date || !Number.isFinite(date.getTime())) return '';
  return '<time datetime="' + date.toISOString() + '">' +
    date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) + '</time>';
}
function layoutSelectorHtml() {
  var paths = [
    '<path d="M2 2h5v5H2zm7 0h5v5H9zm7 0h5v5h-5zM2 9h5v5H2zm7 0h5v5H9zm7 0h5v5h-5zM2 16h5v5H2zm7 0h5v5H9zm7 0h5v5h-5z"/>',
    '<path d="M1 3h4v8H1zm6 0h4v8H7zm6 0h4v8h-4zm6 0h4v8h-4zM1 13h4v8H1zm6 0h4v8H7zm6 0h4v8h-4zm6 0h4v8h-4z"/>',
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
  var image = safeImageUrl(articleImageUrl(post));
  return '<a class="article-card" href="blog-post.html?id=' + encodeURIComponent(post._id) + '">' +
    '<div class="ph">' + (image ? '<img src="' + escapeHtml(image) + '" alt="' + escapeHtml(post.title) + '" loading="lazy">' : '') + '</div>' +
    '<div class="article-card-copy"><h3 class="article-card__title">' + escapeHtml(post.title) + '</h3>' +
    '<span class="article-card__date">' + articleDateHtml(post.createdAt) + '</span>' +
    '<p class="article-excerpt">' + escapeHtml(post.excerpt || '') + '</p></div></a>';
}
