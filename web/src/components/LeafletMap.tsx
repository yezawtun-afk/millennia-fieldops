"use client";

import { useEffect, useState } from "react";
import { Circle, CircleMarker, MapContainer, Popup, TileLayer, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { ZoneDrawTool } from "./ZoneDrawTool";
import { ZonePopupActions } from "./ZonePopupActions";

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
  /** How many field records point at this zone. A zone with records cannot be deleted. */
  records: number;
}

// Millennia Village: the map opens on the site itself, not on whatever happens
// to be the average of the pins, so one far-away GPS reading cannot drag it off.
export const SITE_CENTER: [number, number] = [2.752615639977973, 101.90646329852517];
const SITE_ZOOM = 16;

export function LeafletMap({
  markers,
  zones,
  height,
  canManageZones = false,
}: {
  markers: MapMarker[];
  zones: MapZone[];
  height: number | string;
  canManageZones?: boolean;
}) {
  // The zone tool's own little state. It lives here because the preview circle
  // is drawn on the map, next to the real zones.
  const [drawing, setDrawing] = useState(false);
  const [centre, setCentre] = useState<{ lat: number; lng: number } | null>(null);
  const [radius, setRadius] = useState(150);
  const [colour, setColour] = useState("#1f6b4a");

  function endDrawing() {
    setDrawing(false);
    setCentre(null);
  }

  return (
    <div className="relative overflow-hidden" style={{ height }}>
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
              <div className="text-[12px] text-muted">{z.radius} m</div>
              {canManageZones ? <ZonePopupActions zoneId={z.id} records={z.records} /> : null}
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

        {drawing ? <PlacementClicks onPlace={setCentre} /> : null}

        {drawing && centre ? (
          <>
            <Circle
              center={[centre.lat, centre.lng]}
              radius={radius}
              pathOptions={{
                color: colour,
                weight: 2,
                dashArray: "6 6",
                fillColor: colour,
                fillOpacity: 0.12,
              }}
            />
            <CircleMarker
              center={[centre.lat, centre.lng]}
              radius={5}
              pathOptions={{ color: "#ffffff", weight: 2, fillColor: colour, fillOpacity: 1 }}
            />
          </>
        ) : null}
      </MapContainer>

      {canManageZones ? (
        <ZoneDrawTool
          drawing={drawing}
          centre={centre}
          radius={radius}
          colour={colour}
          onStart={() => {
            setDrawing(true);
            setCentre(null);
          }}
          onCancel={endDrawing}
          onRadiusChange={setRadius}
          onColourChange={setColour}
          onSaved={endDrawing}
        />
      ) : null}
    </div>
  );
}

// While the tool is open, a click anywhere on the map places the centre. The
// class on the container turns the cursor into a crosshair and lets clicks pass
// through the record markers, which would otherwise open a popup instead.
function PlacementClicks({
  onPlace,
}: {
  onPlace: (point: { lat: number; lng: number }) => void;
}) {
  const map = useMapEvents({
    click(event) {
      onPlace({ lat: event.latlng.lat, lng: event.latlng.lng });
    },
  });

  useEffect(() => {
    const container = map.getContainer();
    container.classList.add("zone-draw");
    return () => container.classList.remove("zone-draw");
  }, [map]);

  return null;
}
