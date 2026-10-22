"use client";

// One record line, used by the dashboard lists. Photo paths come in as
// short-lived signed URLs from the server, because the bucket is private.
import { useRouter } from "next/navigation";
import { Camera, ChevronRight, Leaf, Droplets, TriangleAlert } from "lucide-react";
import { formatDate, recordSubtitle } from "@/lib/format";
import { SeverityBadge, StatusBadge } from "@/components/Pills";
import { useI18n } from "@/i18n";
import type { FieldRecord } from "@/lib/types";

const TYPE_ICONS = { flora: Leaf, soil_water: Droplets, hazard: TriangleAlert };
const TYPE_TILE: Record<string, string> = {
  flora: "bg-flora-soft text-flora",
  soil_water: "bg-water-soft text-water",
  hazard: "bg-hazard-soft text-hazard",
};

export function RecordRow({
  record,
  photoUrl,
}: {
  record: FieldRecord;
  photoUrl?: string | null;
}) {
  const router = useRouter();
  const Icon = TYPE_ICONS[record.type] || Camera;
  const photo = photoUrl ?? (record.photos?.[0]?.startsWith("http") ? record.photos[0] : null);

  return (
    <button
      type="button"
      onClick={() => router.push(`/records/${record.id}`)}
      className="flex w-full items-center gap-3 border-b border-rule px-4 py-2.5 text-left transition-colors last:border-b-0 hover:bg-panel"
    >
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo} alt="" className="photo-thumb h-9 w-9 shrink-0 rounded-[6px] border border-line" />
      ) : (
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[6px] ${
            TYPE_TILE[record.type] || "bg-panel text-muted"
          }`}
        >
          <Icon className="h-4 w-4" strokeWidth={1.7} />
        </span>
      )}

      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium text-ink">{record.title}</span>
        <span className="block truncate text-[12px] text-muted">
          {recordSubtitle(record)}
          {record.zone?.name ? ` · ${record.zone.name}` : ""} · {formatDate(record.observed_date)}
        </span>
      </span>

      <span className="flex shrink-0 flex-col items-end gap-1">
        <StatusBadge status={record.status} />
        {record.type === "hazard" ? <SeverityBadge severity={record.severity} /> : null}
      </span>

      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-faint" />
    </button>
  );
}
