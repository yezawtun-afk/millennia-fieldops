import { getZones, queryRecords } from "@/lib/data";
import { getProfile } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui";
import { MapView } from "@/components/MapView";
import { STATUS_LABELS, TYPE_CHART_COLORS } from "@/lib/format";
import { getT } from "@/i18n/server";
import type { MapMarker } from "@/components/MapView";

export default async function MapPage() {
  const t = await getT();
  const [records, zones, profile] = await Promise.all([queryRecords(), getZones(), getProfile()]);

  const markers: MapMarker[] = records
    .filter((r) => r.latitude != null && r.longitude != null)
    .map((r) => ({
      id: r.id,
      lat: r.latitude as number,
      lng: r.longitude as number,
      color: TYPE_CHART_COLORS[r.type],
      label: r.title,
      sub: `${r.zone?.name ?? t("No zone")} - ${t(STATUS_LABELS[r.status])}`,
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
        title={t("Site map")}
        subtitle={t("{count} records plotted across {zones} monitoring zones.", {
          count: markers.length,
          zones: zones.length,
        })}
      />

      <div className="overflow-hidden rounded-card border border-line bg-sheet">
        <MapView
          markers={markers}
          zones={zoneShapes}
          canAddZone={profile?.role === "admin"}
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-[12px]">
        <span className="text-muted">{t("Zones and record types:")}</span>
        <LegendChip color={TYPE_CHART_COLORS.flora} label={t("Flora")} />
        <LegendChip color={TYPE_CHART_COLORS.soil_water} label={t("Soil & water")} />
        <LegendChip color={TYPE_CHART_COLORS.hazard} label={t("Hazard")} />
        <span className="text-muted">{t("Circles show the monitoring zones.")}</span>
      </div>
    </div>
  );
}

function LegendChip({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-sheet px-2.5 py-1 font-medium text-ink">
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}
