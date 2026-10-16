"use client";

// One record line, used by the dashboard lists.
import { useRouter } from "next/navigation";
import { Camera, ChevronRight, Leaf, Droplets, TriangleAlert } from "lucide-react";
import { formatDate, recordSubtitle } from "@/lib/format";
import { SeverityBadge, StatusBadge } from "@/components/ui";
import type { FieldRecord } from "@/lib/types";

const TYPE_ICONS = { flora: Leaf, soil_water: Droplets, hazard: TriangleAlert };
const TYPE_TILE: Record<string, string> = {
  flora: "bg-flora-soft text-flora",
  soil_water: "bg-water-soft text-water",
  hazard: "bg-hazard-soft text-hazard",
};

export function RecordRow({ record }: { record: FieldRecord }) {
  const router = useRouter();
  const Icon = TYPE_ICONS[record.type] || Camera;
  const photo = record.photos?.[0];

  return (
    <button
      type="button"
      onClick={() => router.push(`/records/${record.id}`)}
      className="flex w-full items-center gap-3 border-b border-line px-4 py-3 text-left last:border-b-0 hover:bg-page"
    >
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo} alt="" className="photo-thumb h-10 w-10 shrink-0 rounded-md border border-line" />
      ) : (
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md ${
            TYPE_TILE[record.type] || "bg-page text-muted"
          }`}
        >
          <Icon className="h-5 w-5" />
        </span>
      )}

      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-ink">{record.title}</span>
        <span className="block truncate text-xs text-muted">
          {recordSubtitle(record)}
          {record.zone?.name ? ` - ${record.zone.name}` : ""} - {formatDate(record.observed_date)}
        </span>
      </span>

      <span className="flex shrink-0 flex-col items-end gap-1">
        <StatusBadge status={record.status} />
        {record.type === "hazard" ? <SeverityBadge severity={record.severity} /> : null}
      </span>

      <ChevronRight className="h-4 w-4 shrink-0 text-muted" />
    </button>
  );
}
