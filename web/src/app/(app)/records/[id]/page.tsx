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

  const photoUrls = Object.values(
    await signPhotoUrls(record.photos ?? [])
  );

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
      <Link href="/records" className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ArrowLeft size={15} /> Back to records
      </Link>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <div className="flex flex-wrap items-center gap-3">
              <TypePill type={record.type} />
              <StatusBadge status={record.status} />
              {record.type === "hazard" ? (
                <SeverityBadge severity={record.severity as HazardSeverity | null} />
              ) : null}
            </div>
            <h1 className="mt-3 text-xl font-semibold text-ink">{record.title}</h1>
            <p className="mt-1 text-sm text-muted">
              {record.zone?.name ?? "No zone"} - observed {formatDate(record.observed_date)} - submitted by{" "}
              {record.submitter?.full_name ?? "unknown"}
            </p>

            {record.notes ? (
              <p className="mt-4 whitespace-pre-wrap text-sm text-ink">{record.notes}</p>
            ) : null}

            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
              {facts
                .filter((f) => f.value)
                .map((f) => (
                  <div key={f.label}>
                    <dt className="text-xs uppercase tracking-wide text-muted">{f.label}</dt>
                    <dd className="text-sm font-medium text-ink">{f.value}</dd>
                  </div>
                ))}
              {record.latitude != null && record.longitude != null ? (
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted">Coordinates</dt>
                  <dd className="text-sm font-medium text-ink">
                    {record.latitude.toFixed(5)}, {record.longitude.toFixed(5)}
                  </dd>
                </div>
              ) : null}
            </dl>
          </Card>

          {photoUrls.length > 0 ? (
            <Card className="mt-4">
              <h2 className="mb-3 text-sm font-semibold text-ink">Photos</h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {photoUrls.map((url, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={url}
                    src={url}
                    alt={`Record photo ${i + 1}`}
                    className="h-40 w-full rounded-lg border border-line object-cover"
                  />
                ))}
              </div>
            </Card>
          ) : null}

          {record.latitude != null && record.longitude != null ? (
            <Card className="mt-4">
              <h2 className="mb-3 text-sm font-semibold text-ink">Location</h2>
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
            </Card>
          ) : null}
        </div>

        <div>
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
                <p className="mt-1 text-muted">
                  Reviewed by {record.reviewer?.full_name ?? "a reviewer"}.
                </p>
                {record.supervisor_feedback ? (
                  <p className="mt-3 rounded-lg bg-page px-3 py-2 text-ink">{record.supervisor_feedback}</p>
                ) : null}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
