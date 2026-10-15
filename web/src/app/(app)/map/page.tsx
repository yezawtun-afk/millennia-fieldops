import { getZones, queryRecords } from "@/lib/data";
import { PageHeader } from "@/components/ui";
import { MapView } from "@/components/MapView";
import { TYPE_CHART_COLORS } from "@/lib/format";
import type { MapMarker } from "@/components/MapView";

export default async function MapPage() {
  const [records, zones] = await Promise.all([queryRecords(), getZones()]);

  const markers: MapMarker[] = records
    .filter((r) => r.latitude != null && r.longitude != null)
    .map((r) => ({
      id: r.id,
      lat: r.latitude as number,
      lng: r.longitude as number,
      color: TYPE_CHART_COLORS[r.type],
      label: r.title,
      sub: `${r.zone?.name ?? "No zone"} - ${r.status}`,
      href: `/records/${r.id}`,
    }));

  const zoneShapes = zones.map((z) => ({
    id: z.id,
    lat: z.center_lat,
    lng: z.center_lng,
    radius: z.radius_m,
    color: z.color,
    name: z.name,
  }));

  return (
    <div>
      <PageHeader
        title="Site map"
        subtitle={`${markers.length} geotagged record(s) across ${zones.length} monitoring zone(s).`}
      />
      <MapView markers={markers} zones={zoneShapes} height={560} />

      <div className="mt-4 flex flex-wrap items-center gap-4 text-sm">
        <span className="font-medium text-ink">Legend:</span>
        <span className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full" style={{ background: TYPE_CHART_COLORS.flora }} /> Flora
        </span>
        <span className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full" style={{ background: TYPE_CHART_COLORS.soil_water }} /> Soil/Water
        </span>
        <span className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full" style={{ background: TYPE_CHART_COLORS.hazard }} /> Hazard
        </span>
        <span className="text-muted">Circles show the monitoring zones.</span>
      </div>
    </div>
  );
}
