(function () {
  function fmtDate(d) {
    return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function loadMessages() {
    apiGetSilent('/admin/contact-messages').then(function (messages) {
      if (!messages || !messages.length) {
        document.getElementById('contact-tbody').innerHTML = '<tr><td colspan="5" class="faint">No messages yet.</td></tr>';
        return;
      }
      document.getElementById('contact-tbody').innerHTML = messages.map(function (m) {
        return (
          '<tr>' +
            '<td>' + escapeHtml(m.name) + '</td>' +
            '<td>' + escapeHtml(m.email) + '</td>' +
            '<td style="max-width:320px;">' + escapeHtml(m.message) + '</td>' +
            '<td>' + fmtDate(m.createdAt) + '</td>' +
            '<td><button class="btn btn-danger btn-sm" data-remove-msg="' + escapeHtml(m._id) + '">Delete</button></td>' +
          '</tr>'
        );
      }).join('');
      document.querySelectorAll('[data-remove-msg]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          apiDelete('/admin/contact-messages/' + btn.getAttribute('data-remove-msg')).then(loadMessages);
        });
      });
    });
  }

  function loadSubscribers() {
    apiGetSilent('/admin/newsletter-subscribers').then(function (subs) {
      if (!subs || !subs.length) {
        document.getElementById('newsletter-tbody').innerHTML = '<tr><td colspan="3" class="faint">No subscribers yet.</td></tr>';
        return;
      }
      document.getElementById('newsletter-tbody').innerHTML = subs.map(function (s) {
        return (
          '<tr>' +
            '<td>' + escapeHtml(s.email) + '</td>' +
            '<td>' + fmtDate(s.createdAt) + '</td>' +
            '<td><button class="btn btn-danger btn-sm" data-remove-sub="' + escapeHtml(s._id) + '">Delete</button></td>' +
          '</tr>'
        );
      }).join('');
      document.querySelectorAll('[data-remove-sub]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          apiDelete('/admin/newsletter-subscribers/' + btn.getAttribute('data-remove-sub')).then(loadSubscribers);
        });
      });
    });
  }

  document.querySelectorAll('.tab-toggle button').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.tab-toggle button').forEach(function (b) { b.classList.remove('is-active'); });
      btn.classList.add('is-active');
      var tab = btn.getAttribute('data-tab');
      document.getElementById('contact-panel').style.display = tab === 'contact' ? 'block' : 'none';
      document.getElementById('newsletter-panel').style.display = tab === 'newsletter' ? 'block' : 'none';
    });
  });

  AdminAuth.ready.then(function (user) {
    if (!user) return;
    loadMessages();
    loadSubscribers();
  });
})();
