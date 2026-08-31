(function () {
  var NAV_LINKS = [
    { label: 'Home', href: 'index.html', key: 'Home' },
    { label: 'Shop', href: 'shop.html', key: 'Shop' },
    { label: 'Blog', href: 'blog.html', key: 'Blog' },
    { label: 'Contact Us', href: 'contact.html', key: 'Contact' },
  ];

  function escapeHtml(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function navHtml(active, cls) {
    return NAV_LINKS.map(function (l) {
      return '<a class="' + cls + (l.key === active ? ' is-active' : '') + '" href="' + l.href + '">' + l.label + '</a>';
    }).join('');
  }

  function renderHeader(root) {
    var active = root.getAttribute('data-active') || '';
    var promoDismissed = sessionStorage.getItem('lc_promo_dismissed') === '1';

    root.innerHTML =
      (promoDismissed ? '' :
        '<div class="promo-bar" id="promo-bar">' +
          '<span>30% off storewide &mdash; Limited time!</span>' +
          '<a href="shop.html">Shop Now &rarr;</a>' +
          '<button class="promo-bar__close" id="promo-close" aria-label="Dismiss">&times;</button>' +
        '</div>') +
      '<div class="site-header">' +
        '<a href="index.html" class="site-header__logo">Gita_3_Team_2</a>' +
        '<nav class="site-nav">' + navHtml(active, '') + '</nav>' +
        '<div class="header-actions">' +
          '<button class="icon-btn search-btn" aria-label="Search" aria-controls="header-search-form">' +
            '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="11" cy="11" r="7"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>' +
          '</button>' +
          '<a href="admin/index.html" id="admin-link" class="icon-btn" aria-label="Admin" style="display:none;font-size:11px;font-weight:600;letter-spacing:.02em;">ADMIN</a>' +
          '<a href="#" id="account-link" class="icon-btn" aria-label="Account">' +
            '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="8" r="4"></circle><path d="M4 20c0-4 3.5-6 8-6s8 2 8 6"></path></svg>' +
          '</a>' +
          '<button class="icon-btn cart-icon-wrap" id="cart-open" aria-label="Cart">' +
            '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 7h12l-1 13H7L6 7z"></path><path d="M9 7V5a3 3 0 016 0v2"></path></svg>' +
            '<span class="cart-count" id="cart-count">0</span>' +
          '</button>' +
          '<button class="icon-btn mobile-toggle" id="mobile-toggle" aria-label="Menu">' +
            '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>' +
          '</button>' +
        '</div>' +
      '</div>' +
      '<form class="header-search-panel" id="header-search-form" hidden>' +
        '<label for="header-search-input">Search products</label>' +
        '<input class="input" id="header-search-input" type="search" maxlength="80" placeholder="What are you looking for?" required>' +
        '<button class="btn btn--dark" type="submit">Search</button>' +
        '<button class="icon-btn" id="header-search-close" type="button" aria-label="Close search">&times;</button>' +
      '</form>' +
      '<nav class="mobile-nav" id="mobile-nav" style="display:none;">' +
        navHtml(active, '') +
        '<form class="mobile-search" id="mobile-search-form">' +
          '<input class="input" type="search" maxlength="80" placeholder="Search products" aria-label="Search products" required>' +
          '<button class="btn btn--dark" type="submit">Search</button>' +
        '</form>' +
      '</nav>' +
      '<div id="cart-overlay-slot"></div>' +
      '<div class="cart-drawer" id="cart-drawer">' +
        '<div class="cart-drawer__head">' +
          '<span class="cart-drawer__title">Cart</span>' +
          '<button class="cart-drawer__close" id="cart-close">&times;</button>' +
        '</div>' +
        '<div class="cart-drawer__body" id="cart-drawer-body"></div>' +
        '<div class="cart-drawer__foot" id="cart-drawer-foot"></div>' +
      '</div>';

    var promoClose = document.getElementById('promo-close');
    if (promoClose) {
      promoClose.addEventListener('click', function () {
        sessionStorage.setItem('lc_promo_dismissed', '1');
        document.getElementById('promo-bar').remove();
      });
    }

    document.getElementById('mobile-toggle').addEventListener('click', function () {
      var nav = document.getElementById('mobile-nav');
      nav.style.display = nav.style.display === 'none' ? 'flex' : 'none';
    });

    var searchButton = root.querySelector('.search-btn');
    var searchForm = document.getElementById('header-search-form');
    var searchInput = document.getElementById('header-search-input');
    searchButton.setAttribute('aria-expanded', 'false');
    searchButton.addEventListener('click', function () {
      searchForm.hidden = false;
      searchButton.setAttribute('aria-expanded', 'true');
      searchInput.focus();
    });
    document.getElementById('header-search-close').addEventListener('click', function () {
      searchForm.hidden = true;
      searchButton.setAttribute('aria-expanded', 'false');
      searchButton.focus();
    });
    wireSearchForm(searchForm, searchInput);
    wireSearchForm(document.getElementById('mobile-search-form'));

    document.getElementById('cart-open').addEventListener('click', openCart);
    document.getElementById('cart-close').addEventListener('click', closeCart);

    apiGetSilent('/auth/me').then(function (res) {
      var link = document.getElementById('account-link');
      if (res && res.user) {
        link.href = 'account.html';
        if (res.user.isAdmin) {
          document.getElementById('admin-link').style.display = 'flex';
        }
      } else {
        link.href = 'login.html';
      }
    });

    refreshCart();
    window.addEventListener('cart-updated', refreshCart);
  }

  function wireSearchForm(form, input) {
    var searchInput = input || form.querySelector('input');
    searchInput.value = qs('q') || '';
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var query = searchInput.value.trim();
      if (!query) return;
      window.location.href = 'shop.html?q=' + encodeURIComponent(query);
    });
  }

  function openCart() {
    document.getElementById('cart-drawer').classList.add('is-open');
    var slot = document.getElementById('cart-overlay-slot');
    slot.innerHTML = '<div class="cart-overlay" id="cart-overlay"></div>';
    document.getElementById('cart-overlay').addEventListener('click', closeCart);
    window.CartStore.sync().then(refreshCart);
  }
  function closeCart() {
    document.getElementById('cart-drawer').classList.remove('is-open');
    document.getElementById('cart-overlay-slot').innerHTML = '';
  }

  function refreshCart() {
    var items = window.CartStore ? window.CartStore.getCart() : [];
    var countEl = document.getElementById('cart-count');
    if (countEl) countEl.textContent = window.CartStore ? window.CartStore.count(items) : 0;

    var body = document.getElementById('cart-drawer-body');
    var foot = document.getElementById('cart-drawer-foot');
    if (!body || !foot) return;

    if (items.length === 0) {
      body.innerHTML = '<div class="empty-note">Your cart is empty</div>';
    } else {
      body.innerHTML = items.map(function (item, idx) {
        return (
          '<div class="cart-row">' +
            '<div class="ph" style="width:64px;height:64px;flex-shrink:0;border-radius:8px;">' + escapeHtml(item.name || '') + '</div>' +
            '<div class="cart-row__info">' +
              '<div class="cart-row__top"><span class="cart-row__name">' + escapeHtml(item.name || '') + '</span><span class="cart-row__name">' + fmt(item.price * item.qty) + '</span></div>' +
              '<div class="cart-row__color">Color: ' + escapeHtml(item.color || '') + '</div>' +
              (window.CartStore.stockLimit(item) === null ? '' : '<div class="cart-row__color">' + window.CartStore.stockLimit(item) + ' available</div>') +
              (item.unavailable ? '<div class="error-text">Currently unavailable</div>' : '') +
              '<div style="display:flex;align-items:center;justify-content:space-between;margin-top:8px;">' +
                '<div class="qty-stepper" data-idx="' + idx + '">' +
                  '<button data-act="dec"' + (item.qty <= 1 || item.unavailable ? ' disabled' : '') + '>&minus;</button><span>' + item.qty + '</span><button data-act="inc"' + (window.CartStore.canIncrement(item) && !item.unavailable ? '' : ' disabled') + '>+</button>' +
                '</div>' +
                '<button class="remove-btn" data-act="remove" data-idx="' + idx + '">&#10005;</button>' +
              '</div>' +
            '</div>' +
          '</div>'
        );
      }).join('');
    }

    var subtotal = window.CartStore ? window.CartStore.subtotal(items) : 0;
    var canCheckout = items.length > 0 && items.every(function (item) {
      return window.CartStore.stockLimit(item) !== 0 && !item.unavailable;
    });
    foot.innerHTML =
      '<div class="summary-line"><span>Subtotal</span><span>' + fmt(subtotal) + '</span></div>' +
      '<div class="summary-total"><span>Total</span><span>' + fmt(subtotal) + '</span></div>' +
      '<a' + (canCheckout ? ' href="checkout.html"' : '') + ' class="btn btn--dark btn--block' + (canCheckout ? '' : ' is-disabled') + '"' + (canCheckout ? '' : ' aria-disabled="true"') + '>Checkout</a>' +
      '<a href="cart.html" class="btn" style="display:block;text-align:center;margin-top:10px;color:var(--ink);text-decoration:underline;">View Cart</a>';

    body.querySelectorAll('[data-act]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var idx = Number(btn.getAttribute('data-idx'));
        var item = items[idx];
        var act = btn.getAttribute('data-act');
        if (act === 'inc') window.CartStore.updateQty(item.id, item.color, item.qty + 1);
        if (act === 'dec') window.CartStore.updateQty(item.id, item.color, item.qty - 1);
        if (act === 'remove') window.CartStore.removeItem(item.id, item.color);
      });
    });
  }

  var FOOTER_VARIANTS = {
    full: ['Home', 'Shop', 'Blog', 'Contact'],
    cart: ['Home', 'Blog', 'Contact'],
    minimal: null,
  };
  var FOOTER_HREFS = { Home: 'index.html', Shop: 'shop.html', Blog: 'blog.html', Contact: 'contact.html' };
  var FOOTER_LABELS = { Home: 'Home', Shop: 'Shop', Blog: 'Blog', Contact: 'Contact Us' };

  function renderFooter(root) {
    var variant = root.getAttribute('data-variant') || 'full';
    var keys = FOOTER_VARIANTS[variant];
    var linksHtml = keys
      ? '<div class="site-footer__links">' + keys.map(function (k) {
          return '<a href="' + FOOTER_HREFS[k] + '">' + FOOTER_LABELS[k] + '</a>';
        }).join('') + '</div>'
      : '';
    var topHtml = variant === 'minimal' ? '' :
      '<div class="site-footer__top">' +
        '<div><div class="site-footer__brand">Gita_3_Team_2</div><div class="site-footer__tag">Gift &amp; Decoration Store</div></div>' +
        linksHtml +
      '</div>';
    root.innerHTML =
      '<div class="site-footer">' +
        topHtml +
        '<div class="site-footer__bottom' + (variant === 'minimal' ? '' : '') + '"' +
          (variant === 'minimal' ? ' style="text-align:center;padding-top:0;border-top:none;"' : '') + '>' +
          '<span>&copy; 2026 Gita_3_Team_2. All rights reserved.</span>' +
          '<span class="site-footer__legal"><a href="privacy.html">Privacy Policy</a><a href="terms.html">Terms of Use</a></span>' +
        '</div>' +
      '</div>';
  }

  function mount() {
    var header = document.getElementById('site-header');
    if (header) renderHeader(header);
    var footer = document.getElementById('site-footer');
    if (footer) renderFooter(footer);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
})();
