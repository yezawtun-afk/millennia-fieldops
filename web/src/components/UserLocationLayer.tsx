"use client";

// The phone's blue-gold "you are here" dot, repeated on the website.
//
// Same shape as the app: an 18 px gold dot with a dark ring and a white halo,
// over a translucent accuracy circle in metres. The colours are the mobile
// theme's location tokens (theme.ts); Leaflet writes SVG presentation
// attributes, where a CSS variable would not resolve, so they are literals.
//
// The heading cone is deliberately missing: it needs DeviceOrientation, which
// asks for a second permission on iOS. Dot plus accuracy ring says the same
// thing without another prompt.
import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import { Circle, Marker, useMap } from "react-leaflet";
import type { UserFix } from "@/hooks/useUserLocation";

const DOT_COLOR = "#FFD400";
const DOT_INK = "#7A5D00";

/** Bumping `request` flies the map to the newest fix. */
export function FlyToUser({ location, request }: { location: UserFix | null; request: number }) {
  const map = useMap();
  const handledRef = useRef(0);

  useEffect(() => {
    if (!location || request === 0 || handledRef.current === request) return;
    handledRef.current = request;
    map.flyTo([location.lat, location.lng], Math.max(map.getZoom(), 17), { duration: 0.8 });
  }, [map, location, request]);

  return null;
}

export function UserLocationLayer({ location }: { location: UserFix | null }) {
  const icon = useMemo(
    () =>
      L.divIcon({
        className: "map-user-location",
        iconSize: [18, 18],
        iconAnchor: [9, 9],
        html: '<div class="map-user-dot"></div>',
      }),
    []
  );

  if (!location) return null;

  return (
    <>
      {location.accuracy != null && location.accuracy > 0 ? (
        <Circle
          center={[location.lat, location.lng]}
          radius={location.accuracy}
          pathOptions={{
            color: DOT_INK,
            weight: 1,
            opacity: 0.5,
            fillColor: DOT_COLOR,
            fillOpacity: 0.12,
            interactive: false,
          }}
        />
      ) : null}
      <Marker
        position={[location.lat, location.lng]}
        icon={icon}
        interactive={false}
        keyboard={false}
        zIndexOffset={1000}
      />
    </>
  );
}
