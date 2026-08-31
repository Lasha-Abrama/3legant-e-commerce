(function () {
  var state = {
    blogs: [],
    editingId: null,
    image: null,
  };

  function loadBlogs() {
    return apiGetSilent('/blogs?take=200').then(function (res) {
      state.blogs = (res && res.data) || [];
      renderTable();
    });
  }

  function renderTable() {
    document.getElementById('blogs-tbody').innerHTML = state.blogs.map(function (b) {
      var thumbUrl = safeImageUrl(b.image);
      var thumb = thumbUrl
        ? '<img src="' + thumbUrl + '" alt="' + escapeHtml(b.title || 'Blog post') + '" style="width:40px;height:40px;object-fit:cover;border-radius:6px;">'
        : '<div style="width:40px;height:40px;border-radius:6px;background:#f2f1ef;"></div>';
      var date = new Date(b.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
      return (
        '<tr>' +
          '<td>' + thumb + '</td>' +
          '<td>' + escapeHtml(b.title) + '</td>' +
          '<td>' + date + '</td>' +
          '<td>' + (b.featured ? '<span class="pill pill--admin">FEATURED</span>' : '') + '</td>' +
          '<td style="white-space:nowrap;">' +
            '<button class="btn btn--ghost btn-sm" data-edit="' + escapeHtml(b._id) + '">Edit</button> ' +
            '<button class="btn btn-danger btn-sm" data-delete="' + escapeHtml(b._id) + '">Delete</button>' +
          '</td>' +
        '</tr>'
      );
    }).join('');

    if (!state.blogs.length) {
      document.getElementById('blogs-tbody').innerHTML = '<tr><td colspan="5" class="faint">No blog posts yet.</td></tr>';
    }

    document.querySelectorAll('[data-edit]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var blog = state.blogs.filter(function (b) { return b._id === btn.getAttribute('data-edit'); })[0];
        openForm(blog);
      });
    });
    document.querySelectorAll('[data-delete]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (!confirm('წავშალო ბლოგპოსტი?')) return;
        apiDelete('/blogs/' + btn.getAttribute('data-delete')).then(function () {
          loadBlogs();
        });
      });
    });
  }

  function openForm(blog) {
    state.editingId = blog ? blog._id : null;
    state.image = blog ? blog.image : null;
    renderForm(blog);
    var panel = document.getElementById('blog-form-panel');
    panel.style.display = 'block';
    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function closeForm() {
    state.editingId = null;
    document.getElementById('blog-form-panel').style.display = 'none';
  }

  function renderImagePreview() {
    var safeUrl = safeImageUrl(state.image);
    if (!safeUrl) return '';
    return (
      '<div class="img-thumb">' +
        '<img src="' + safeUrl + '" alt="Blog post preview">' +
        '<button type="button" class="img-thumb__remove" id="remove-blog-image">&#10005;</button>' +
      '</div>'
    );
  }

  function renderForm(blog) {
    var b = blog || {};
    var panel = document.getElementById('blog-form-panel');
    panel.innerHTML =
      '<div style="font-size:16px;font-weight:600;margin-bottom:16px;">' + (blog ? 'Edit blog post' : 'Add blog post') + '</div>' +
      '<div id="blog-form-alert"></div>' +
      '<div class="field"><span class="field__label">TITLE *</span><input class="input" id="f-title" value="' + escapeHtml(b.title || '') + '"></div>' +
      '<div class="field"><span class="field__label">EXCERPT</span><textarea class="input" id="f-excerpt" rows="2">' + escapeHtml(b.excerpt || '') + '</textarea></div>' +
      '<div class="field"><span class="field__label">CONTENT *</span><textarea class="input" id="f-content" rows="8">' + escapeHtml(b.content || '') + '</textarea></div>' +
      '<label style="display:flex;align-items:center;gap:8px;font-size:13px;margin:8px 0 16px;">' +
        '<input type="checkbox" id="f-featured" ' + (b.featured ? 'checked' : '') + '> Mark as featured' +
      '</label>' +

      '<div class="field"><span class="field__label">PHOTO *</span></div>' +
      '<div id="blog-image-thumb" class="img-thumb-row">' + renderImagePreview() + '</div>' +
      '<label class="btn btn--ghost btn-sm img-upload-btn" style="width:fit-content;">' +
        '<span id="blog-upload-label">' + (state.image ? '+ Replace photo' : '+ Upload photo') + '</span>' +
        '<input type="file" accept="image/*" id="blog-image-input" style="display:none;">' +
      '</label>' +

      '<div style="margin-top:20px;display:flex;gap:10px;">' +
        '<button class="btn btn--dark" id="save-blog-btn">' + (blog ? 'Save changes' : 'Create post') + '</button>' +
        '<button class="btn btn--ghost" id="cancel-blog-btn" type="button">Cancel</button>' +
      '</div>';

    document.getElementById('cancel-blog-btn').addEventListener('click', closeForm);

    document.getElementById('blog-image-input').addEventListener('change', function (e) {
      var file = e.target.files[0];
      if (!file) return;
      var label = document.getElementById('blog-upload-label');
      label.textContent = 'Uploading…';
      apiUpload('/admin/uploads/image', file).then(function (res) {
        if (res && res.url) {
          state.image = res.url;
          document.getElementById('blog-image-thumb').innerHTML = renderImagePreview();
          wireImageRemove();
        }
        label.textContent = state.image ? '+ Replace photo' : '+ Upload photo';
      });
      e.target.value = '';
    });
    wireImageRemove();

    document.getElementById('save-blog-btn').addEventListener('click', saveBlog);
  }

  function wireImageRemove() {
    var btn = document.getElementById('remove-blog-image');
    if (!btn) return;
    btn.addEventListener('click', function () {
      state.image = null;
      document.getElementById('blog-image-thumb').innerHTML = renderImagePreview();
    });
  }

  function saveBlog() {
    var title = document.getElementById('f-title').value.trim();
    var alertBox = document.getElementById('blog-form-alert');
    alertBox.innerHTML = '';

    if (!state.image) {
      alertBox.innerHTML = '<div class="admin-alert admin-alert--error">ატვირთეთ ფოტო</div>';
      return;
    }

    var payload = {
      title: title,
      excerpt: document.getElementById('f-excerpt').value.trim(),
      content: document.getElementById('f-content').value.trim(),
      featured: document.getElementById('f-featured').checked,
      image: state.image,
    };

    var call = state.editingId
      ? apiPatch('/blogs/' + state.editingId, payload)
      : apiPost('/blogs', payload);

    call.then(function (res) {
      if (!res) return;
      if (res._status >= 400) {
        var message = Array.isArray(res.message) ? res.message.join(', ') : (res.message || 'Save failed');
        alertBox.innerHTML = '<div class="admin-alert admin-alert--error">' + escapeHtml(message) + '</div>';
        return;
      }
      closeForm();
      loadBlogs();
    });
  }

  document.getElementById('add-blog-btn').addEventListener('click', function () {
    openForm(null);
  });

  AdminAuth.ready.then(function (user) {
    if (!user) return;
    loadBlogs();
  });
})();
