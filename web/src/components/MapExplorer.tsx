"use client";

// The site map with its filter row. Filtering happens here, on the client, so a
// chip never reloads the page and never remounts Leaflet: what you were looking
// at stays where it was.

import { useMemo, useState } from "react";
import { MapView } from "@/components/MapView";
import type { MapMarker, MapZone } from "@/components/MapView";
import { TYPE_CHART_COLORS } from "@/lib/format";
import { useI18n } from "@/i18n";
import type { RecordType } from "@/lib/types";

const TYPES: RecordType[] = ["flora", "soil_water", "hazard"];

export function MapExplorer({
  markers,
  zones,
  canManageZones = false,
}: {
  markers: MapMarker[];
  zones: MapZone[];
  canManageZones?: boolean;
}) {
  const { t } = useI18n();
  const [type, setType] = useState<"all" | RecordType>("all");

  const visible = useMemo(
    () => (type === "all" ? markers : markers.filter((marker) => marker.type === type)),
    [markers, type]
  );

  const options: { key: "all" | RecordType; label: string; colour?: string }[] = [
    { key: "all", label: t("All records") },
    ...TYPES.map((entry) => ({
      key: entry,
      label:
        entry === "flora" ? t("Flora") : entry === "soil_water" ? t("Soil & water") : t("Hazard"),
      colour: TYPE_CHART_COLORS[entry],
    })),
  ];

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {options.map((option) => {
          const active = type === option.key;
          return (
            <button
              key={option.key}
              type="button"
              onClick={() => setType(option.key)}
              aria-pressed={active}
              className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12px] font-medium transition-colors ${
                active
                  ? "border-accent bg-accent-soft text-accent"
                  : "border-control bg-sheet text-muted hover:border-accent/50 hover:text-ink"
              }`}
            >
              {option.colour ? (
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: option.colour }}
                  aria-hidden="true"
                />
              ) : null}
              {option.label}
            </button>
          );
        })}

        <span className="ml-auto whitespace-nowrap text-[12px] text-muted">
          {t("Showing {count} of {total} records", {
            count: visible.length,
            total: markers.length,
          })}
        </span>
      </div>

      <div className="overflow-hidden rounded-card border border-line bg-sheet">
        <MapView markers={visible} zones={zones} canManageZones={canManageZones} />
      </div>
    </>
  );
}
