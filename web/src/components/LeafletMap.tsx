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

const DEFAULT_CENTER: [number, number] = [2.9125, 101.8435];

export function LeafletMap({
  markers,
  zones,
  height,
}: {
  markers: MapMarker[];
  zones: MapZone[];
  height: number | string;
}) {
  const points: [number, number][] = [
    ...markers.map((m) => [m.lat, m.lng] as [number, number]),
    ...zones.map((z) => [z.lat, z.lng] as [number, number]),
  ];
  const center: [number, number] =
    points.length > 0
      ? [
          points.reduce((s, p) => s + p[0], 0) / points.length,
          points.reduce((s, p) => s + p[1], 0) / points.length,
        ]
      : DEFAULT_CENTER;

  return (
    <div className="overflow-hidden" style={{ height }}>
      <MapContainer center={center} zoom={15} style={{ height: "100%", width: "100%" }} scrollWheelZoom>
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
