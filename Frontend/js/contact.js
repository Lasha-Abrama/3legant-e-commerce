(function () {
  var form = document.getElementById('contact-form');
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var msg = document.getElementById('contact-msg');
    var payload = {
      name: document.getElementById('c-name').value,
      email: document.getElementById('c-email').value,
      message: document.getElementById('c-message').value,
    };
    apiPost('/contact', payload).then(function (res) {
      if (!res) return;
      if (res._status >= 400) {
        msg.style.color = 'var(--red)';
        msg.textContent = res.message || 'Could not send message.';
        return;
      }
      msg.style.color = 'var(--green)';
      msg.textContent = 'Thanks — your message has been sent.';
      form.reset();
    });
  });
})();
