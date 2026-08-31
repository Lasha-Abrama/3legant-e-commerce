(function () {
  var CATEGORIES = ['Living Room', 'Bedroom', 'Kitchen', 'Bathroom', 'Dining', 'Outdoor'];

  var state = {
    products: [],
    editingId: null,
    colors: [],
    images: [],
  };

  function loadProducts() {
    return apiGetSilent('/products?take=200').then(function (res) {
      state.products = (res && res.data) || [];
      renderTable();
    });
  }

  function renderTable() {
    document.getElementById('products-tbody').innerHTML = state.products.map(function (p) {
      var thumbUrl = p.images && p.images[0] ? safeImageUrl(p.images[0]) : '';
      var thumb = thumbUrl
        ? '<img src="' + thumbUrl + '" alt="' + escapeHtml(p.name || 'Product') + '" style="width:40px;height:40px;object-fit:cover;border-radius:6px;">'
        : '<div style="width:40px;height:40px;border-radius:6px;background:#f2f1ef;"></div>';
      return (
        '<tr>' +
          '<td>' + thumb + '</td>' +
          '<td>' + escapeHtml(p.name) + (p.newArrival ? ' <span class="pill pill--admin">NEW</span>' : '') + '</td>' +
          '<td>' + escapeHtml(p.category) + '</td>' +
          '<td>' + fmt(p.price) + (p.originalPrice ? ' <span class="faint" style="text-decoration:line-through;">' + fmt(p.originalPrice) + '</span>' : '') + '</td>' +
          '<td>' + p.stock + '</td>' +
          '<td style="white-space:nowrap;">' +
            '<button class="btn btn--ghost btn-sm" data-edit="' + escapeHtml(p._id) + '">Edit</button> ' +
            '<button class="btn btn-danger btn-sm" data-delete="' + escapeHtml(p._id) + '">Delete</button>' +
          '</td>' +
        '</tr>'
      );
    }).join('');

    document.querySelectorAll('[data-edit]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var product = state.products.filter(function (p) { return p._id === btn.getAttribute('data-edit'); })[0];
        openForm(product);
      });
    });
    document.querySelectorAll('[data-delete]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (!confirm('წავშალო პროდუქტი?')) return;
        apiDelete('/products/' + btn.getAttribute('data-delete')).then(function () {
          loadProducts();
        });
      });
    });
  }

  function openForm(product) {
    state.editingId = product ? product._id : null;
    state.colors = product && product.colors && product.colors.length
      ? product.colors.map(function (c) { return { name: c.name, hex: c.hex }; })
      : [{ name: 'Default', hex: '#c9c4b8' }];
    state.images = product && product.images ? product.images.slice() : [];
    renderForm(product);
    var panel = document.getElementById('product-form-panel');
    panel.style.display = 'block';
    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function closeForm() {
    state.editingId = null;
    document.getElementById('product-form-panel').style.display = 'none';
  }

  function renderColorRows() {
    return state.colors.map(function (c, idx) {
      return (
        '<div class="color-row-editor" data-color-idx="' + idx + '">' +
          '<input class="input" style="flex:1;" placeholder="Color name" value="' + escapeHtml(c.name) + '" data-color-name>' +
          '<input type="color" value="' + safeCssColor(c.hex) + '" data-color-hex>' +
          '<button type="button" class="btn btn--ghost btn-sm" data-remove-color>&#10005;</button>' +
        '</div>'
      );
    }).join('');
  }

  function renderImageThumbs() {
    return state.images.map(function (url, idx) {
      var safeUrl = safeImageUrl(url);
      return (
        '<div class="img-thumb">' +
          (safeUrl ? '<img src="' + safeUrl + '" alt="Product preview">' : '') +
          '<button type="button" class="img-thumb__remove" data-remove-image="' + idx + '">&#10005;</button>' +
        '</div>'
      );
    }).join('');
  }

  function renderForm(product) {
    var p = product || {};
    var panel = document.getElementById('product-form-panel');
    panel.innerHTML =
      '<div style="font-size:16px;font-weight:600;margin-bottom:16px;">' + (product ? 'Edit product' : 'Add product') + '</div>' +
      '<div id="product-form-alert"></div>' +
      '<div class="admin-form-grid">' +
        '<div class="field"><span class="field__label">NAME *</span><input class="input" id="f-name" value="' + escapeHtml(p.name || '') + '"></div>' +
        '<div class="field"><span class="field__label">CATEGORY *</span>' +
          '<select class="input" id="f-category">' +
            CATEGORIES.map(function (c) { return '<option ' + (p.category === c ? 'selected' : '') + '>' + c + '</option>'; }).join('') +
          '</select>' +
        '</div>' +
        '<div class="field"><span class="field__label">PRICE *</span><input class="input" type="number" step="0.01" id="f-price" value="' + (p.price != null ? p.price : '') + '"></div>' +
        '<div class="field"><span class="field__label">ORIGINAL PRICE</span><input class="input" type="number" step="0.01" id="f-originalPrice" value="' + (p.originalPrice != null ? p.originalPrice : '') + '"></div>' +
        '<div class="field"><span class="field__label">DISCOUNT LABEL</span><input class="input" id="f-discountLabel" placeholder="-50%" value="' + escapeHtml(p.discountLabel || '') + '"></div>' +
        '<div class="field"><span class="field__label">SKU *</span><input class="input" id="f-sku" value="' + escapeHtml(p.sku || '') + '"></div>' +
        '<div class="field"><span class="field__label">MEASUREMENTS</span><input class="input" id="f-measurements" value="' + escapeHtml(p.measurements || '') + '"></div>' +
        '<div class="field"><span class="field__label">STOCK</span><input class="input" type="number" id="f-stock" value="' + (p.stock != null ? p.stock : 50) + '"></div>' +
      '</div>' +
      '<label style="display:flex;align-items:center;gap:8px;font-size:13px;margin:8px 0 16px;">' +
        '<input type="checkbox" id="f-newArrival" ' + (p.newArrival ? 'checked' : '') + '> Mark as new arrival' +
      '</label>' +
      '<div class="field"><span class="field__label">DESCRIPTION *</span><textarea class="input" id="f-description" rows="3">' + escapeHtml(p.description || '') + '</textarea></div>' +

      '<div class="field"><span class="field__label">COLORS</span></div>' +
      '<div id="color-rows">' + renderColorRows() + '</div>' +
      '<button type="button" class="btn btn--ghost btn-sm" id="add-color-btn" style="margin-bottom:16px;">+ Add color</button>' +

      '<div class="field"><span class="field__label">PHOTOS</span></div>' +
      '<div id="image-thumbs" class="img-thumb-row">' + renderImageThumbs() + '</div>' +
      '<label class="btn btn--ghost btn-sm img-upload-btn" style="width:fit-content;">' +
        '<span id="upload-label">+ Upload photo</span>' +
        '<input type="file" accept="image/jpeg,image/png,image/gif,image/webp" id="image-input" style="display:none;" multiple>' +
      '</label>' +

      '<div style="margin-top:20px;display:flex;gap:10px;">' +
        '<button class="btn btn--dark" id="save-product-btn">' + (product ? 'Save changes' : 'Create product') + '</button>' +
        '<button class="btn btn--ghost" id="cancel-product-btn" type="button">Cancel</button>' +
      '</div>';

    document.getElementById('cancel-product-btn').addEventListener('click', closeForm);
    document.getElementById('add-color-btn').addEventListener('click', function () {
      state.colors.push({ name: '', hex: '#c9c4b8' });
      document.getElementById('color-rows').innerHTML = renderColorRows();
      wireColorRows();
    });
    wireColorRows();

    document.getElementById('image-input').addEventListener('change', function (e) {
      var files = Array.prototype.slice.call(e.target.files);
      if (!files.length) return;
      var alertBox = document.getElementById('product-form-alert');
      var validationError = files.length > 10 ? 'Upload no more than 10 images at once.' : '';
      files.some(function (file) {
        validationError = validationError || validateImageUpload(file);
        return Boolean(validationError);
      });
      if (validationError) {
        alertBox.innerHTML = '<div class="admin-alert admin-alert--error">' + escapeHtml(validationError) + '</div>';
        e.target.value = '';
        return;
      }
      alertBox.innerHTML = '';
      var label = document.getElementById('upload-label');
      var remaining = files.length;
      label.textContent = 'Uploading…';
      files.forEach(function (file) {
        apiUpload('/admin/uploads/image', file).then(function (res) {
          remaining -= 1;
          if (res && res.url) {
            state.images.push(res.url);
            document.getElementById('image-thumbs').innerHTML = renderImageThumbs();
            wireImageRemove();
          } else if (res && res._status >= 400) {
            var message = Array.isArray(res.message) ? res.message.join(', ') : (res.message || 'Upload failed');
            alertBox.innerHTML = '<div class="admin-alert admin-alert--error">' + escapeHtml(message) + '</div>';
          }
          if (remaining === 0) label.textContent = '+ Upload photo';
        });
      });
      e.target.value = '';
    });
    wireImageRemove();

    document.getElementById('save-product-btn').addEventListener('click', saveProduct);
  }

  function wireColorRows() {
    document.querySelectorAll('#color-rows [data-remove-color]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var idx = Number(btn.closest('[data-color-idx]').getAttribute('data-color-idx'));
        state.colors.splice(idx, 1);
        document.getElementById('color-rows').innerHTML = renderColorRows();
        wireColorRows();
      });
    });
  }

  function wireImageRemove() {
    document.querySelectorAll('[data-remove-image]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var idx = Number(btn.getAttribute('data-remove-image'));
        state.images.splice(idx, 1);
        document.getElementById('image-thumbs').innerHTML = renderImageThumbs();
        wireImageRemove();
      });
    });
  }

  function readColorsFromDom() {
    var rows = document.querySelectorAll('#color-rows [data-color-idx]');
    var colors = [];
    rows.forEach(function (row) {
      var name = row.querySelector('[data-color-name]').value.trim();
      var hex = row.querySelector('[data-color-hex]').value;
      if (name) colors.push({ name: name, hex: hex });
    });
    return colors;
  }

  function saveProduct() {
    var name = document.getElementById('f-name').value.trim();
    var alertBox = document.getElementById('product-form-alert');
    alertBox.innerHTML = '';

    var payload = {
      name: name,
      category: document.getElementById('f-category').value,
      price: parseFloat(document.getElementById('f-price').value),
      sku: document.getElementById('f-sku').value.trim(),
      measurements: document.getElementById('f-measurements').value.trim(),
      description: document.getElementById('f-description').value.trim(),
      stock: parseInt(document.getElementById('f-stock').value, 10) || 0,
      newArrival: document.getElementById('f-newArrival').checked,
      colors: readColorsFromDom(),
      images: state.images,
      imageLabel: name ? name + ' photo' : 'Product photo',
    };
    var originalPrice = document.getElementById('f-originalPrice').value;
    if (originalPrice) payload.originalPrice = parseFloat(originalPrice);
    var discountLabel = document.getElementById('f-discountLabel').value.trim();
    if (discountLabel) payload.discountLabel = discountLabel;

    var call = state.editingId
      ? apiPatch('/products/' + state.editingId, payload)
      : apiPost('/products', payload);

    call.then(function (res) {
      if (!res) return;
      if (res._status >= 400) {
        var message = Array.isArray(res.message) ? res.message.join(', ') : (res.message || 'Save failed');
        alertBox.innerHTML = '<div class="admin-alert admin-alert--error">' + escapeHtml(message) + '</div>';
        return;
      }
      closeForm();
      loadProducts();
    });
  }

  document.getElementById('add-product-btn').addEventListener('click', function () {
    openForm(null);
  });

  AdminAuth.ready.then(function (user) {
    if (!user) return;
    loadProducts();
  });
})();
