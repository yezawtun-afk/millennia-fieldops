"use client";

import dynamic from "next/dynamic";
import type { MapMarker, MapZone } from "./LeafletMap";

// Load Leaflet only in the browser (it needs `window`).
const LeafletMap = dynamic(() => import("./LeafletMap").then((m) => m.LeafletMap), {
  ssr: false,
  loading: () => (
    <div className="flex h-72 items-center justify-center rounded-lg border border-line bg-white text-sm text-muted">
      Loading map...
    </div>
  ),
});

export function MapView({
  markers,
  zones = [],
  height = 520,
}: {
  markers: MapMarker[];
  zones?: MapZone[];
  height?: number;
}) {
  return <LeafletMap markers={markers} zones={zones} height={height} />;
}

export type { MapMarker, MapZone };
