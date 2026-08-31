(function () {
  function loadUsers(currentUser) {
    apiGetSilent('/admin/users').then(function (users) {
      if (!users || !users.length) {
        document.getElementById('users-tbody').innerHTML = '<tr><td colspan="5" class="faint">No users yet.</td></tr>';
        return;
      }
      document.getElementById('users-tbody').innerHTML = users.map(function (u) {
        var isCurrentUser = String(u.id) === String(currentUser.id);
        var action = isCurrentUser
          ? '<button class="btn btn--ghost btn-sm" disabled title="You cannot change your own admin role">Current admin</button>'
          : '<button class="btn btn--ghost btn-sm" data-toggle-role="' + escapeHtml(u.id) + '" data-current="' + (u.isAdmin ? 'true' : 'false') + '" data-user-name="' + escapeHtml(u.displayName || (u.firstName + ' ' + u.lastName)) + '">' +
              (u.isAdmin ? 'Revoke admin' : 'Make admin') +
            '</button>';
        return (
          '<tr>' +
            '<td>' + escapeHtml(u.displayName || (u.firstName + ' ' + u.lastName)) + '</td>' +
            '<td>' + escapeHtml(u.email) + '</td>' +
            '<td>' + escapeHtml(u.phone || '—') + '</td>' +
            '<td><span class="pill ' + (u.isAdmin ? 'pill--admin' : 'pill--user') + '">' + (u.isAdmin ? 'Admin' : 'Customer') + '</span></td>' +
            '<td>' + action + '</td>' +
          '</tr>'
        );
      }).join('');

      document.querySelectorAll('[data-toggle-role]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var current = btn.getAttribute('data-current') === 'true';
          var userName = btn.getAttribute('data-user-name');
          var action = current ? 'Revoke admin access from ' : 'Grant admin access to ';
          if (!confirm(action + userName + '?')) return;
          apiPatch('/admin/users/' + btn.getAttribute('data-toggle-role') + '/role', { isAdmin: !current }).then(function (res) {
            if (!res) return;
            if (res._status >= 400) {
              alert(res.message || 'Could not update role');
              return;
            }
            loadUsers(currentUser);
          });
        });
      });
    });
  }

  AdminAuth.ready.then(function (user) {
    if (!user) return;
    loadUsers(user);
  });
})();
