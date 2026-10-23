#!/usr/bin/env node
// Regenerates mobile/src/lib/markerClusterBundle.ts: Leaflet.markercluster's
// CSS and JS, inlined so the phone map can cluster pins without a CDN.
//
// Run from the repo root:
//   node tools/build-markercluster-bundle.js
//
// Leaflet.markercluster is MIT licensed. The copyright banner in the JavaScript
// travels with the code inside the bundle.
const fs = require("node:fs");
const path = require("node:path");

const VERSION = "1.5.3";
const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "mobile", "src", "lib", "markerClusterBundle.ts");
const BASE = `https://unpkg.com/leaflet.markercluster@${VERSION}/dist/`;

async function get(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response.text();
}

async function main() {
  const [baseCss, defaultCss, js] = await Promise.all([
    get(`${BASE}MarkerCluster.css`),
    get(`${BASE}MarkerCluster.Default.css`),
    get(`${BASE}leaflet.markercluster.js`),
  ]);
  const css = `${baseCss}\n${defaultCss}`;

  if (/<\/script/i.test(js)) throw new Error("markercluster.js contains </script and cannot be inlined");
  if (/<\/style/i.test(css)) throw new Error("markercluster.css contains </style and cannot be inlined");

  const header = `// Generated file - do not edit by hand.
//
// Leaflet.markercluster ${VERSION}, inlined so the phone does not need a CDN to
// group crowded record pins. MIT licensed: https://github.com/Leaflet/Leaflet.markercluster/blob/master/MIT-LICENCE.txt
// Source files: ${BASE}MarkerCluster.css, ${BASE}MarkerCluster.Default.css and ${BASE}leaflet.markercluster.js
//
// Regenerate with: node tools/build-markercluster-bundle.js
/* eslint-disable */

`;

  const body =
    `export const MARKER_CLUSTER_CSS: string = ${JSON.stringify(css)};\n\n` +
    `export const MARKER_CLUSTER_JS: string = ${JSON.stringify(js)};\n`;

  fs.writeFileSync(OUT, header + body, "utf8");
  console.log(`wrote ${path.relative(ROOT, OUT)} (${(header + body).length} bytes)`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
