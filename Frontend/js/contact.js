(function () {
  var form = document.getElementById('contact-form');
  // Demo company address. Update the address and coordinates together for a real store.
  var company = { name: 'Loam & Co.', address: '1 Freedom Square, Tbilisi, Georgia', latitude: 41.6934, longitude: 44.8015 };
  var locationButton = document.getElementById('use-location');
  var locationStatus = document.getElementById('location-status');
  var directions = document.getElementById('open-location-map');
  document.getElementById('company-address').textContent = company.address;

  function setLocationStatus(message) {
    locationStatus.textContent = message;
    locationStatus.hidden = false;
  }

  function initializeMap() {
    if (!window.L) {
      setLocationStatus('The map could not load. You can still open directions.');
      locationButton.disabled = true;
      return;
    }
    var destination = L.latLng(company.latitude, company.longitude);
    var map = L.map('location-map', { scrollWheelZoom: false }).setView(destination, 15);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);
    var popup = document.createElement('div');
    var title = document.createElement('strong');
    title.textContent = company.name;
    popup.appendChild(title);
    popup.appendChild(document.createElement('br'));
    popup.appendChild(document.createTextNode(company.address));
    L.marker(destination, {
      title: company.name + ' — ' + company.address,
      icon: L.divIcon({ className: 'company-map-pin', html: '<span></span>', iconSize: [30, 38], iconAnchor: [15, 38], popupAnchor: [0, -34] }),
    }).addTo(map).bindPopup(popup).openPopup();
    var visitorMarker;
    var connection;

    function showLocationError(error) {
      var messages = {
        1: 'Location access was denied. Our company is still marked on the map.',
        2: 'Your location is currently unavailable. Please try again.',
        3: 'Finding your location took too long. Please try again.',
      };
      setLocationStatus(messages[error && error.code] || 'Could not find your location. Please try again.');
      locationButton.disabled = false;
      locationButton.textContent = 'Try distance again';
    }

    locationButton.addEventListener('click', function () {
      if (!navigator.geolocation) {
        setLocationStatus('This browser does not support location. Use Directions to enter a starting point.');
        return;
      }
      locationButton.disabled = true;
      locationButton.textContent = 'Locating…';
      setLocationStatus('Allow browser location access to calculate your distance.');
      navigator.geolocation.getCurrentPosition(function (position) {
        var latitude = position.coords.latitude;
        var longitude = position.coords.longitude;
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
          showLocationError({ code: 2 });
          return;
        }
        var visitor = L.latLng(latitude, longitude);
        if (visitorMarker) map.removeLayer(visitorMarker);
        if (connection) map.removeLayer(connection);
        visitorMarker = L.circleMarker(visitor, { radius: 8, color: '#fff', weight: 3, fillColor: '#2563eb', fillOpacity: 1 }).addTo(map).bindPopup('You are here');
        connection = L.polyline([destination, visitor], { color: '#2563eb', weight: 2, dashArray: '6 7' }).addTo(map);
        map.fitBounds(L.latLngBounds([destination, visitor]), { paddingTopLeft: [45, 85], paddingBottomRight: [45, 90], maxZoom: 16 });
        var meters = destination.distanceTo(visitor);
        var distance = meters < 1000 ? Math.round(meters) + ' m' : (meters / 1000).toFixed(1) + ' km';
        setLocationStatus('About ' + distance + ' away · straight-line distance. Open Directions for a road route.');
        directions.href = 'https://www.google.com/maps/dir/?' + new URLSearchParams({ api: '1', origin: latitude + ',' + longitude, destination: company.latitude + ',' + company.longitude }).toString();
        directions.title = 'Open Google Maps with your location and our company as the route endpoints';
        locationButton.disabled = false;
        locationButton.textContent = 'Update distance';
      }, showLocationError, { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 });
    });
    if (window.ResizeObserver) new ResizeObserver(function () { map.invalidateSize(); }).observe(document.getElementById('location-map'));
  }

  initializeMap();

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
