(function () {
  function loadUsers() {
    apiGetSilent('/admin/users').then(function (users) {
      if (!users || !users.length) {
        document.getElementById('users-tbody').innerHTML = '<tr><td colspan="5" class="faint">No users yet.</td></tr>';
        return;
      }
      document.getElementById('users-tbody').innerHTML = users.map(function (u) {
        return (
          '<tr>' +
            '<td>' + escapeHtml(u.displayName || (u.firstName + ' ' + u.lastName)) + '</td>' +
            '<td>' + escapeHtml(u.email) + '</td>' +
            '<td>' + escapeHtml(u.phone || '—') + '</td>' +
            '<td><span class="pill ' + (u.isAdmin ? 'pill--admin' : 'pill--user') + '">' + (u.isAdmin ? 'Admin' : 'Customer') + '</span></td>' +
            '<td><button class="btn btn--ghost btn-sm" data-toggle-role="' + escapeHtml(u.id) + '" data-current="' + (u.isAdmin ? 'true' : 'false') + '">' +
              (u.isAdmin ? 'Revoke admin' : 'Make admin') +
            '</button></td>' +
          '</tr>'
        );
      }).join('');

      document.querySelectorAll('[data-toggle-role]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var current = btn.getAttribute('data-current') === 'true';
          apiPatch('/admin/users/' + btn.getAttribute('data-toggle-role') + '/role', { isAdmin: !current }).then(function (res) {
            if (!res) return;
            if (res._status >= 400) {
              alert(res.message || 'Could not update role');
              return;
            }
            loadUsers();
          });
        });
      });
    });
  }

  AdminAuth.ready.then(function (user) {
    if (!user) return;
    loadUsers();
  });
})();
