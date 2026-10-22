// Builds the Leaflet page shown inside the map WebView. Kept free of React
// Native imports so it can be rendered and inspected on its own.
//
// Records are handed to the page as JSON; the page posts a message back when a
// pin's "Open record" link is tapped. Labels arrive already translated, because
// the HTML is built once per language rather than re-running t() inside the
// page.
import { colors } from "../theme";

export interface MapPoint {
  id: string;
  lat: number;
  lng: number;
  color: string;
  label: string;
  sub: string;
}

export interface MapZone {
  id: string;
  lat: number;
  lng: number;
  radius: number;
  color: string;
  name: string;
}

export interface MapLabels {
  openRecord: string;
}

// The village itself, used when there is nothing to plot yet.
const SITE_CENTER = { lat: 2.752615639977973, lng: 101.90646329852517, zoom: 15 };

// Leaflet, pinned. The integrity hashes come from leafletjs.com's download page.
const LEAFLET_VERSION = "1.9.4";
const LEAFLET_CSS = `https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/leaflet.css`;
const LEAFLET_JS = `https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/leaflet.js`;
const LEAFLET_CSS_INTEGRITY = "sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=";
const LEAFLET_JS_INTEGRITY = "sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=";

// JSON is safe inside <script> once the characters that could close the tag
// (or break a line in an old parser) are escaped.
function toScriptJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

export function buildMapHtml(points: MapPoint[], zones: MapZone[], labels: MapLabels): string {
  const data = {
    points,
    zones,
    center: SITE_CENTER,
    openLabel: labels.openRecord,
  };

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<link rel="stylesheet" href="${LEAFLET_CSS}" integrity="${LEAFLET_CSS_INTEGRITY}" crossorigin="" />
<script src="${LEAFLET_JS}" integrity="${LEAFLET_JS_INTEGRITY}" crossorigin=""></script>
<style>
  html, body { margin: 0; padding: 0; height: 100%; background: ${colors.page}; }
  #map { position: absolute; top: 0; right: 0; bottom: 0; left: 0; background: ${colors.line}; }
  .leaflet-container { font-family: -apple-system, "Segoe UI", Roboto, sans-serif; }
  .leaflet-popup-content { margin: 10px 12px; font-size: 13px; line-height: 1.35; color: ${colors.ink}; }
  .leaflet-popup-content strong { font-weight: 600; }
  .popup-sub { color: ${colors.muted}; margin-top: 2px; }
  .popup-open { display: inline-block; margin-top: 8px; color: ${colors.primary}; font-weight: 600; text-decoration: none; }
  .leaflet-control-attribution { font-size: 10px; }
  .leaflet-control-zoom a { width: 34px; height: 34px; line-height: 32px; font-size: 20px; }
</style>
</head>
<body>
<div id="map"></div>
<script>
  var DATA = ${toScriptJson(data)};

  function post(message) {
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify(message));
    }
  }

  function openRecord(id) {
    post({ type: "open", id: id });
  }

  // A blocked CDN or a broken tile host would otherwise leave the app on a
  // spinner forever; the wrapper shows its "try again" state instead.
  window.onerror = function () {
    post({ type: "error", message: "map failed to start" });
    return true;
  };

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  var map = L.map("map", { zoomControl: false });
  L.control.zoom({ position: "bottomright" }).addTo(map);

  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    minZoom: 4,
    attribution: "&copy; OpenStreetMap contributors"
  }).addTo(map);

  var bounds = [];

  DATA.zones.forEach(function (zone) {
    L.circle([zone.lat, zone.lng], {
      radius: zone.radius,
      color: zone.color,
      weight: 1.5,
      opacity: 0.85,
      fillColor: zone.color,
      fillOpacity: 0.1,
      dashArray: "5 4"
    })
      .bindPopup('<strong>' + escapeHtml(zone.name) + '</strong>')
      .addTo(map);
    bounds.push([zone.lat, zone.lng]);
  });

  DATA.points.forEach(function (point) {
    L.circleMarker([point.lat, point.lng], {
      radius: 7,
      color: "#FFFFFF",
      weight: 2,
      fillColor: point.color,
      fillOpacity: 1
    })
      .bindPopup(
        '<strong>' + escapeHtml(point.label) + '</strong>' +
        '<div class="popup-sub">' + escapeHtml(point.sub) + '</div>' +
        '<a class="popup-open" href="#" onclick="openRecord(\\'' + escapeHtml(point.id) + '\\');return false;">' +
        escapeHtml(DATA.openLabel) + '</a>'
      )
      .addTo(map);
    bounds.push([point.lat, point.lng]);
  });

  if (bounds.length > 0) {
    map.fitBounds(bounds, { padding: [28, 28], maxZoom: 17 });
  } else {
    map.setView([DATA.center.lat, DATA.center.lng], DATA.center.zoom);
  }
</script>
</body>
</html>`;
}
