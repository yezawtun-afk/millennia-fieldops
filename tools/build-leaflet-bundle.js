#!/usr/bin/env node
// Regenerates mobile/src/lib/leafletBundle.ts: Leaflet's CSS and JS, inlined so
// the phone map works without a CDN.
//
// Run from the repo root:
//   node tools/build-leaflet-bundle.js
//
// Leaflet is BSD-2-Clause. The copyright banner in the JavaScript travels with
// the code inside the bundle.
const fs = require("node:fs");
const path = require("node:path");

const VERSION = "1.9.4";
const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "mobile", "src", "lib", "leafletBundle.ts");
const BASE = `https://unpkg.com/leaflet@${VERSION}/dist/`;

async function get(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response.text();
}

async function main() {
  const [css, js] = await Promise.all([get(`${BASE}leaflet.css`), get(`${BASE}leaflet.js`)]);

  if (/<\/script/i.test(js)) throw new Error("leaflet.js contains </script and cannot be inlined");
  if (/<\/style/i.test(css)) throw new Error("leaflet.css contains </style and cannot be inlined");

  const header = `// Generated file - do not edit by hand.
//
// Leaflet ${VERSION}, inlined so the phone does not need a CDN to draw the map.
// Leaflet is BSD-2-Clause: https://github.com/Leaflet/Leaflet/blob/main/LICENSE
// Source files: ${BASE}leaflet.js and leaflet.css
//
// Regenerate with: node tools/build-leaflet-bundle.js
/* eslint-disable */

`;

  const body =
    `export const LEAFLET_CSS: string = ${JSON.stringify(css)};\n\n` +
    `export const LEAFLET_JS: string = ${JSON.stringify(js)};\n`;

  fs.writeFileSync(OUT, header + body, "utf8");
  console.log(`wrote ${path.relative(ROOT, OUT)} (${(header + body).length} bytes)`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
