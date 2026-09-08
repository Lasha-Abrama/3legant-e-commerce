(function () {
  var form = document.getElementById('contact-form');
  var locationButton = document.getElementById('use-location');
  var locationStatus = document.getElementById('location-status');
  var locationMap = document.getElementById('location-map');
  var locationMapLink = document.getElementById('open-location-map');

  function setLocationStatus(message, state) {
    locationStatus.textContent = message;
    locationStatus.setAttribute('data-state', state || 'neutral');
  }

  function restoreLocationButton() {
    locationButton.disabled = false;
    locationButton.textContent = 'Try location again';
  }

  function showLocation(position) {
    var latitude = Number(position.coords.latitude);
    var longitude = Number(position.coords.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      showLocationError({ code: 2 });
      return;
    }

    var offset = 0.01;
    var bounds = [longitude - offset, latitude - offset, longitude + offset, latitude + offset];
    var embedParams = new URLSearchParams({
      bbox: bounds.join(','),
      layer: 'mapnik',
      marker: latitude + ',' + longitude,
    });
    var mapParams = new URLSearchParams({ mlat: String(latitude), mlon: String(longitude) });
    mapParams.set('zoom', '15');

    locationMap.src = 'https://www.openstreetmap.org/export/embed.html?' + embedParams.toString();
    locationMap.hidden = false;
    locationMapLink.href = 'https://www.openstreetmap.org/?' + mapParams.toString() + '#map=15/' + latitude + '/' + longitude;
    locationMapLink.hidden = false;
    locationButton.disabled = false;
    locationButton.textContent = 'Update my location';
    setLocationStatus('Location found. It is used only for this map and is not sent with your message.', 'success');
  }

  function showLocationError(error) {
    var messages = {
      1: 'Location access was denied. You can still send us a message.',
      2: 'Your location is currently unavailable. You can still send us a message.',
      3: 'Finding your location took too long. You can try again or continue without it.',
    };
    setLocationStatus(messages[error && error.code] || 'We could not access your location. You can still send us a message.', 'error');
    restoreLocationButton();
  }

  locationButton.addEventListener('click', function () {
    if (!navigator.geolocation) {
      setLocationStatus('Location is not supported by this browser. You can still send us a message.', 'error');
      locationButton.disabled = true;
      return;
    }

    locationButton.disabled = true;
    locationButton.textContent = 'Finding your location...';
    setLocationStatus('Your browser may ask you to allow location access.', 'neutral');
    navigator.geolocation.getCurrentPosition(showLocation, showLocationError, {
      enableHighAccuracy: false,
      timeout: 10000,
      maximumAge: 300000,
    });
  });

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
