function newsletterHtml() {
  return (
    '<div class="newsletter"><div class="newsletter__inner">' +
      '<img src="images/cozy-home-corner.jpg" alt="Cozy home corner" style="width:100%;height:160px;border-radius:12px;object-fit:cover;display:block;">' +
      '<div>' +
        '<h3 style="font-size:26px;font-weight:500;margin:0 0 8px;">Join Our Newsletter</h3>' +
        '<p class="muted" style="font-size:13px;margin:0 0 16px;">Sign up for deals, new products and promotions.</p>' +
        '<form class="newsletter__form" id="newsletter-form">' +
          '<input class="input" type="email" placeholder="Email address" id="newsletter-email" required>' +
          '<button class="btn btn--dark" type="submit">Sign up</button>' +
        '</form>' +
        '<div class="faint" style="font-size:12px;margin-top:8px;" id="newsletter-msg"></div>' +
      '</div>' +
    '</div></div>'
  );
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
      msg.textContent = res._status < 400 ? 'გამოწერა დადასტურებულია — Thanks for subscribing!' : res.message;
      msg.style.color = res._status < 400 ? 'var(--green)' : 'var(--red)';
      if (res._status < 400) form.reset();
    });
  });
}
