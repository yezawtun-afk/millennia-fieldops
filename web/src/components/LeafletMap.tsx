"use client";

import { MapContainer, TileLayer, CircleMarker, Circle, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  color: string;
  label: string;
  sub?: string;
  href?: string;
}

export interface MapZone {
  id: string;
  lat: number;
  lng: number;
  radius: number;
  color: string;
  name: string;
}

// Millennia Village: the map opens on the site itself, not on whatever happens
// to be the average of the pins, so one far-away GPS reading cannot drag it off.
export const SITE_CENTER: [number, number] = [2.752615639977973, 101.90646329852517];
const SITE_ZOOM = 16;

export function LeafletMap({
  markers,
  zones,
  height,
}: {
  markers: MapMarker[];
  zones: MapZone[];
  height: number | string;
}) {
  return (
    <div className="overflow-hidden" style={{ height }}>
      <MapContainer
        center={SITE_CENTER}
        zoom={SITE_ZOOM}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {zones.map((z) => (
          <Circle
            key={z.id}
            center={[z.lat, z.lng]}
            radius={z.radius}
            pathOptions={{ color: z.color, fillColor: z.color, fillOpacity: 0.12, weight: 2 }}
          >
            <Popup>
              <strong>{z.name}</strong>
            </Popup>
          </Circle>
        ))}

        {markers.map((m) => (
          <CircleMarker
            key={m.id}
            center={[m.lat, m.lng]}
            radius={8}
            pathOptions={{ color: "#ffffff", weight: 3, fillColor: m.color, fillOpacity: 0.9 }}
          >
            <Popup>
              <strong>{m.label}</strong>
              {m.sub ? <div>{m.sub}</div> : null}
              {m.href ? (
                <a href={m.href} style={{ color: "#1f6b4a" }}>
                  Open record
                </a>
              ) : null}
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}
