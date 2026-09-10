(function () {
  var CATEGORIES = [
    { name: 'Living Room', img: 'images/products/luxury-sofa.jpg' },
    { name: 'Bedroom', img: 'images/products/drawer.jpg' },
    { name: 'Kitchen', img: 'images/products/toaster.jpg' },
  ];
  var FEATURES = [
    { icon: 'fast delivery.svg', title: 'Free Shipping', sub: 'Order above $200' },
    { icon: 'money.svg', title: 'Money-back', sub: '30 days guarantee' },
    { icon: 'lock.svg', title: 'Secure Payments', sub: 'Secured by Stripe' },
    { icon: 'call.svg', title: '24/7 Support', sub: 'Phone and email support' },
  ];
  var HOME_PRODUCT_IMAGES = {
    'Loveseat Sofa': 'images/home/loveseat-sofa.png',
    'Amber Table Lamp': 'images/home/table-lamp.png',
    'Table Lamp Gold': 'images/home/beige-table-lamp.png',
    'Bamboo Basket': 'images/home/bamboo-basket.png',
    'Toaster': 'images/home/toaster.png',
    'Toasted': 'images/home/toaster.png',
  };
  var HOME_PRODUCT_ORDER = ['Loveseat Sofa', 'Amber Table Lamp', 'Table Lamp Gold', 'Bamboo Basket', 'Toaster', 'Toasted'];

  function homeProductCardHtml(product) {
    var image = HOME_PRODUCT_IMAGES[product.name];
    if (!image) return productCardHtml(product);
    return productCardHtml(Object.assign({}, product, { images: [image] }));
  }

  document.getElementById('category-grid').innerHTML = CATEGORIES.map(function (c, index) {
    return (
      '<article class="category-tile category-tile--' + (index === 0 ? 'large' : 'small') + '">' +
        '<img src="' + c.img + '" alt="' + c.name + '">' +
        '<div class="category-tile__text">' +
          '<div class="category-tile__name">' + c.name + '</div>' +
          '<a class="category-tile__link" href="shop.html?category=' + encodeURIComponent(c.name) + '">Shop Now &rarr;</a>' +
        '</div>' +
      '</article>'
    );
  }).join('');

  document.getElementById('feature-grid').innerHTML = FEATURES.map(function (f) {
    return (
      '<div class="feature-box">' +
        '<img class="feature-box__icon" src="images/icons/' + f.icon + '" alt="">' +
        '<div><div class="feature-box__title">' + f.title + '</div><div class="feature-box__sub">' + f.sub + '</div></div>' +
      '</div>'
    );
  }).join('');

  function loadArticles() {
    apiGetSilent('/blogs?take=20').then(function (res) {
      var grid = document.getElementById('article-grid');
      if (!res || res._status >= 400 || !Array.isArray(res.data)) {
        renderRetryState(grid, res && res.message, loadArticles);
        return;
      }
      grid.innerHTML = res.data.length ? res.data.slice().sort(function(a,b) { var order = ['7 ways to decor your home like a professional', 'Inside a beautiful kitchen organization', 'Decor your bedroom for your children']; var x = order.indexOf(a.title), y = order.indexOf(b.title); return (x < 0 ? 99 : x) - (y < 0 ? 99 : y); }).slice(0,3).map(function (a) {
        return (
          '<a class="article-card" href="blog-post.html?id=' + encodeURIComponent(a._id) + '">' +
            '<div class="ph" style="width:100%;height:160px;border-radius:10px;padding:0;">' +
              '<img src="' + safeImageUrl(articleImageUrl(a)) + '" alt="' + escapeHtml(a.title) + '" style="width:100%;height:100%;object-fit:cover;">' +
            '</div>' +
            '<div class="article-card__title">' + escapeHtml(a.title) + '</div>' +
            '<span class="text-link">Read More <span>→</span></span>' +
          '</a>'
        );
      }).join('') : '<div class="shop-empty">No articles published yet.</div>';
    });
  }

  document.getElementById('newsletter-slot').innerHTML = newsletterHtml();
  wireNewsletterForm();

  function loadNewArrivals() {
    apiGetSilent('/products?take=100').then(function (res) {
      var grid = document.getElementById('new-arrivals');
      if (!res || res._status >= 400 || !Array.isArray(res.data)) {
        renderRetryState(grid, res && res.message, loadNewArrivals);
        return;
      }
      grid.innerHTML = res.data.length
        ? res.data.filter(function(p) { return p.newArrival; }).sort(function(a,b) { var x = HOME_PRODUCT_ORDER.indexOf(a.name), y = HOME_PRODUCT_ORDER.indexOf(b.name); return (x < 0 ? 99 : x) - (y < 0 ? 99 : y); }).slice(0,8).map(homeProductCardHtml).join('')
        : '<div class="shop-empty">No new arrivals yet.</div>';
      wireAddToCartButtons(grid);
    });
  }

  var slides = ['slide_1.jpg', 'slide_2.jpg', 'slide_3.jpg', 'slide_4.jpg', 'slide_5.jpg'];
  var slideIndex = 0;
  var dots = document.querySelector('.hero-dots');
  dots.innerHTML = slides.map(function (_, index) { return '<button type="button" aria-label="Slide ' + (index + 1) + '" data-slide="' + index + '"></button>'; }).join('');
  function showSlide(index) {
    slideIndex = (index + slides.length) % slides.length;
    document.getElementById('hero-img').src = 'images/slides/' + slides[slideIndex];
    dots.querySelectorAll('button').forEach(function (dot, i) { dot.setAttribute('aria-pressed', String(i === slideIndex)); });
  }
  document.querySelector('.hero-arrow--prev').addEventListener('click', function () { showSlide(slideIndex - 1); });
  document.querySelector('.hero-arrow--next').addEventListener('click', function () { showSlide(slideIndex + 1); });
  dots.addEventListener('click', function (event) { if (event.target.dataset.slide !== undefined) showSlide(Number(event.target.dataset.slide)); });
  showSlide(0);
  var slider = document.querySelector('.hero-slider');
  var heroImage = document.getElementById('hero-img');
  var gesture = null;
  heroImage.draggable = false;
  slider.addEventListener('pointerdown', function (event) {
    if (event.pointerType === 'mouse' || !event.isPrimary || event.target.closest('button')) return;
    gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, delta: 0 };
    slider.setPointerCapture(event.pointerId);
  });
  slider.addEventListener('pointermove', function (event) {
    if (!gesture || gesture.id !== event.pointerId) return;
    var horizontal = event.clientX - gesture.x;
    var vertical = event.clientY - gesture.y;
    if (Math.abs(vertical) > Math.abs(horizontal)) return;
    gesture.delta = horizontal;
    slider.classList.add('is-swiping');
    heroImage.style.transform = 'translateX(' + Math.max(-slider.clientWidth / 4, Math.min(slider.clientWidth / 4, horizontal)) + 'px)';
  });
  function finishSwipe(event) {
    if (!gesture || gesture.id !== event.pointerId) return;
    if (event.type === 'pointerup' && Math.abs(gesture.delta) >= 40) {
      showSlide(slideIndex + (gesture.delta < 0 ? 1 : -1));
    }
    gesture = null;
    slider.classList.remove('is-swiping');
    heroImage.style.transform = '';
    if (slider.hasPointerCapture(event.pointerId)) slider.releasePointerCapture(event.pointerId);
  }
  slider.addEventListener('pointerup', finishSwipe);
  slider.addEventListener('pointercancel', finishSwipe);
  slider.addEventListener('lostpointercapture', finishSwipe);
  loadArticles();
  loadNewArrivals();
})();
