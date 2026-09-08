function newsletterHtml() {
  return '<section class="newsletter"><div class="newsletter__inner">' +
    '<h2>Join Our Newsletter</h2><p>Sign up for deals, new products and promotions</p>' +
    '<form class="newsletter__form" id="newsletter-form">' +
    '<img src="images/icons/email.svg" alt=""><input type="email" placeholder="Email address" aria-label="Email address" id="newsletter-email" required>' +
    '<button type="submit">Signup</button></form><div id="newsletter-msg" role="status"></div></div></section>';
}

function wireNewsletterForm() {
  var form = document.getElementById('newsletter-form');
  if (!form) return;
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var email = document.getElementById('newsletter-email').value;
    var msg = document.getElementById('newsletter-msg');
    apiPost('/newsletter', { email: email }).then(function (res) {
      if (!res) return;
      msg.textContent = res.message || (res._status < 400
        ? 'You successfully joined our newsletter. Please check your email.'
        : 'Newsletter signup failed. Please try again.');
      msg.style.color = res._status < 400 ? 'var(--green)' : 'var(--red)';
      if (res._status < 400) form.reset();
    });
  });
}
