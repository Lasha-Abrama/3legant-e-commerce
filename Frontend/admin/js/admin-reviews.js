(function () {
  function stars(rating) {
    var full = Math.round(rating || 0);
    return '★★★★★'.slice(0, full) + '☆☆☆☆☆'.slice(0, 5 - full);
  }

  function loadReviews() {
    apiGetSilent('/admin/reviews').then(function (reviews) {
      if (!reviews || !reviews.length) {
        document.getElementById('reviews-tbody').innerHTML = '<tr><td colspan="6" class="faint">No reviews yet.</td></tr>';
        return;
      }
      document.getElementById('reviews-tbody').innerHTML = reviews.map(function (r) {
        var date = new Date(r.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
        return (
          '<tr>' +
            '<td>' + escapeHtml(r.product ? r.product.name : '(deleted product)') + '</td>' +
            '<td>' + escapeHtml(r.authorName) + '</td>' +
            '<td style="color:#e8b400;">' + stars(r.rating) + '</td>' +
            '<td style="max-width:320px;">' + escapeHtml(r.text) + '</td>' +
            '<td>' + date + '</td>' +
            '<td><button class="btn btn-danger btn-sm" data-remove-review="' + escapeHtml(r._id) + '">Delete</button></td>' +
          '</tr>'
        );
      }).join('');
      document.querySelectorAll('[data-remove-review]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          if (!confirm('წავშალო შეფასება?')) return;
          apiDelete('/admin/reviews/' + btn.getAttribute('data-remove-review')).then(loadReviews);
        });
      });
    });
  }

  AdminAuth.ready.then(function (user) {
    if (!user) return;
    loadReviews();
  });
})();
