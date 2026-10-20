"use client";

import dynamic from "next/dynamic";
import type { MapMarker, MapZone } from "./LeafletMap";

// The map is as tall as the page has room for, between a floor and a ceiling:
// a fixed pixel height left a band of empty sheet below the legend.
const MAP_HEIGHT = "clamp(420px, calc(100vh - 15rem), 760px)";

// Load Leaflet only in the browser (it needs `window`).
const LeafletMap = dynamic(() => import("./LeafletMap").then((m) => m.LeafletMap), {
  ssr: false,
  loading: () => (
    <div
      className="flex items-center justify-center bg-panel text-[13px] text-muted"
      style={{ height: MAP_HEIGHT }}
    >
      Loading map...
    </div>
  ),
});

export function MapView({
  markers,
  zones = [],
  height = MAP_HEIGHT,
}: {
  markers: MapMarker[];
  zones?: MapZone[];
  height?: number | string;
}) {
  return <LeafletMap markers={markers} zones={zones} height={height} />;
}

export type { MapMarker, MapZone };
