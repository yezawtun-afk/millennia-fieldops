"use client";

import dynamic from "next/dynamic";
import { useI18n } from "@/i18n";
import type { MapMarker, MapZone } from "./LeafletMap";

// The map is as tall as the page has room for, between a floor and a ceiling:
// a fixed pixel height left a band of empty sheet below the legend.
const MAP_HEIGHT = "clamp(420px, calc(100vh - 15rem), 760px)";

// A component (not an inline arrow) so the hook can read the current language
// while the map bundle loads.
function MapLoading() {
  const { t } = useI18n();
  return (
    <div
      className="flex items-center justify-center bg-panel text-[13px] text-muted"
      style={{ height: MAP_HEIGHT }}
    >
      {t("Loading map...")}
    </div>
  );
}

// Load Leaflet only in the browser (it needs `window`).
const LeafletMap = dynamic(() => import("./LeafletMap").then((m) => m.LeafletMap), {
  ssr: false,
  loading: () => <MapLoading />,
});

export function MapView({
  markers,
  zones = [],
  height = MAP_HEIGHT,
  canManageZones = false,
}: {
  markers: MapMarker[];
  zones?: MapZone[];
  height?: number | string;
  canManageZones?: boolean;
}) {
  return (
    <LeafletMap
      markers={markers}
      zones={zones}
      height={height}
      canManageZones={canManageZones}
    />
  );
}

export type { MapMarker, MapZone };
