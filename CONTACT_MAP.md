# Contact Us map

The company map fills the panel beside the contact form. It loads immediately,
with a company pin and address popup. The optional **Show my distance** button
is a compact overlay on the map, rather than a heading/prompt above it.

## Stack and configuration

The static HTML/CSS/vanilla JavaScript storefront uses locally vendored Leaflet
1.9.4 and OpenStreetMap raster tiles. No API key, billing account, backend map
endpoint, environment variable, or database collection is required.

- `Frontend/js/contact.js`: company configuration, map, visitor marker, distance.
- `Frontend/contact.html`: map container, address fallback, directions fallback.
- `Frontend/css/styles.css`: map sizing and compact controls.
- `Frontend/vendor/leaflet/`: library, stylesheet, and license. Markers use custom
  CSS and SVG circles, so Leaflet's default marker image files are unnecessary.

Demo address: **1 Freedom Square, Tbilisi, Georgia**, at 41.6934, 44.8015.
This is an illustrative company location, not a claim that this business occupies
that address. Update the company object in `contact.js` and the fallback address
and directions in `contact.html` together when replacing the demo location.

NestJS and Vercel use `strict-origin-when-cross-origin` referrer policy so HTTPS
tile requests identify the site's origin without including page paths or queries.
Existing CSP permits local Leaflet assets and HTTPS tile images. The existing
`geolocation=(self)` permissions policy allows the browser permission prompt.

## Visitor distance and directions

Location is requested only after clicking the distance button. On success, the
map shows a blue visitor marker and a dashed line to the company, fits both points,
and calculates an approximate straight-line distance using `LatLng.distanceTo`.
The line is not a driving route and the distance is not road distance or travel time.
Denial, unsupported browsers, unavailable positions, and timeout keep the company
map and contact form usable. Browser geolocation requires HTTPS or localhost.

**Directions** opens Google Maps for a road route; Maps URLs need no API key.
Once permission succeeds, opening that link shares the visitor and company
coordinates with Google. Without permission, the visitor can enter a starting
point there. Coordinates remain in page memory and are not included in contact
submissions or stored in this application's database/local storage. External map
providers receive tile requests and IP addresses, so map viewing is not completely
on-device.

## Hosting and verification

OpenStreetMap tiles are appropriate for modest interactive student-demo use under
their usage policy. Keep attribution visible, retain browser referrers and normal
HTTP caching, and do not bulk download or prefetch offline maps. Tile service is
best-effort, with no availability guarantee. Reassess the provider for heavy traffic.

Browser checks in `Backend/e2e/contact-location.spec.ts` cover the initial company
map, distance calculation, directions endpoints, and denied location permission.

## Official references

- [Leaflet](https://leafletjs.com/examples/quick-start/)
- [Leaflet distance calculations](https://leafletjs.com/reference.html#latlng-distanceto)
- [OpenStreetMap tile policy](https://operations.osmfoundation.org/policies/tiles/)
- [Browser geolocation](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation/getCurrentPosition)
- [Google Maps URLs](https://developers.google.com/maps/documentation/urls/get-started)
