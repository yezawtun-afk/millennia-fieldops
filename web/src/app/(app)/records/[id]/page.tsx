import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getProfile } from "@/lib/supabase/server";
import { getRecord } from "@/lib/data";
import { signPhotoUrls } from "@/lib/photos";
import { Card, StatusBadge, TypePill, SeverityBadge } from "@/components/ui";
import { formatDate, formatDateTime } from "@/lib/format";
import { ReviewPanel } from "@/components/ReviewPanel";
import { MapView } from "@/components/MapView";
import type { HazardSeverity } from "@/lib/types";

export default async function RecordDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [record, profile] = await Promise.all([getRecord(id), getProfile()]);
  if (!record || !profile) notFound();

  const photoUrls = Object.values(await signPhotoUrls(record.photos ?? []));

  const isReviewer = profile.role === "supervisor" || profile.role === "admin";

  const facts: { label: string; value: string | null }[] =
    record.type === "flora"
      ? [
          { label: "Species", value: record.species_name },
          { label: "Growth stage", value: record.growth_stage },
          { label: "Health condition", value: record.health_condition },
          { label: "Estimated count", value: record.estimated_count != null ? String(record.estimated_count) : null },
        ]
      : record.type === "hazard"
        ? [
            { label: "Hazard type", value: record.hazard_type },
            { label: "Severity", value: record.severity },
          ]
        : [
            { label: "Reading type", value: record.reading_type },
            { label: "Value", value: record.reading_value != null ? String(record.reading_value) : null },
            { label: "Unit", value: record.reading_unit },
          ];

  return (
    <div>
      <Link
        href="/records"
        className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
      >
        <ArrowLeft className="h-4 w-4" /> Back to records
      </Link>

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-[26px]">{record.title}</h1>
          <p className="mt-1 text-sm text-muted">
            {record.zone?.name ?? "No zone"} - observed {formatDate(record.observed_date)} - submitted by{" "}
            {record.submitter?.full_name ?? "unknown"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <TypePill type={record.type} />
          <StatusBadge status={record.status} />
          {record.type === "hazard" ? (
            <SeverityBadge severity={record.severity as HazardSeverity | null} />
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <h2 className="mb-3 text-sm font-semibold text-ink">Details</h2>
            <div className="grid gap-x-6 sm:grid-cols-2">
              {facts
                .filter((f) => f.value)
                .map((f) => (
                  <DetailRow key={f.label} label={f.label} value={f.value} />
                ))}
              <DetailRow label="Observed" value={formatDate(record.observed_date)} />
              <DetailRow label="Zone" value={record.zone?.name ?? "No zone"} />
              {record.latitude != null && record.longitude != null ? (
                <DetailRow
                  label="Coordinates"
                  value={`${record.latitude.toFixed(5)}, ${record.longitude.toFixed(5)}`}
                />
              ) : null}
            </div>
          </Card>

          {record.notes ? (
            <Card>
              <h2 className="mb-3 text-sm font-semibold text-ink">Notes</h2>
              <p className="whitespace-pre-wrap text-sm text-ink">{record.notes}</p>
            </Card>
          ) : null}

          {photoUrls.length > 0 ? (
            <Card>
              <h2 className="mb-3 text-sm font-semibold text-ink">Photos</h2>
              <div className="flex flex-wrap gap-2">
                {photoUrls.map((url, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={url}
                    src={url}
                    alt={`Record photo ${i + 1}`}
                    className="photo-thumb h-28 w-28 rounded-lg border border-line"
                  />
                ))}
              </div>
            </Card>
          ) : null}

          {record.latitude != null && record.longitude != null ? (
            <div className="overflow-hidden rounded-lg border border-line bg-white">
              <h2 className="border-b border-line px-4 py-3 text-sm font-semibold text-ink">Location</h2>
              <MapView
                markers={[
                  {
                    id: record.id,
                    lat: record.latitude,
                    lng: record.longitude,
                    color: record.type === "hazard" ? "#dc2626" : "#1f6b4a",
                    label: record.title,
                  },
                ]}
                height={260}
              />
            </div>
          ) : null}
        </div>

        <div className="space-y-4">
          <Card>
            <h2 className="mb-3 text-sm font-semibold text-ink">Review</h2>
            {record.status === "pending" ? (
              isReviewer ? (
                <ReviewPanel recordId={record.id} />
              ) : (
                <p className="text-sm text-muted">Awaiting review by a supervisor.</p>
              )
            ) : (
              <div className="text-sm">
                <p className="text-ink">
                  This record was <span className="font-semibold">{record.status}</span>
                  {record.reviewed_at ? ` on ${formatDateTime(record.reviewed_at)}` : ""}.
                </p>
                <p className="mt-1 text-muted">Reviewed by {record.reviewer?.full_name ?? "a reviewer"}.</p>
                {record.supervisor_feedback ? (
                  <p className="mt-3 rounded-md border border-line bg-page px-3 py-2 text-ink">
                    {record.supervisor_feedback}
                  </p>
                ) : null}
              </div>
            )}
          </Card>

          <Card>
            <h2 className="mb-3 text-sm font-semibold text-ink">Summary</h2>
            <DetailRow label="Submitted by" value={record.submitter?.full_name ?? "unknown"} />
            <DetailRow label="Created" value={formatDateTime(record.created_at)} />
            <DetailRow label="Reviewed by" value={record.reviewer?.full_name ?? null} />
          </Card>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="border-b border-line py-2 last:border-b-0">
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-ink">{value || "-"}</p>
    </div>
  );
}
