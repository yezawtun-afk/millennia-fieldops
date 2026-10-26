import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getProfile } from "@/lib/supabase/server";
import { getRecord } from "@/lib/data";
import { signPhotoUrls } from "@/lib/photos";
import { Card, PageHeader } from "@/components/ui";
import { SeverityBadge, StatusBadge, TypePill, CompletedBadge } from "@/components/Pills";
import { formatDate, formatDateTime } from "@/lib/format";
import { ReviewPanel } from "@/components/ReviewPanel";
import { DeleteRecordButton } from "@/components/DeleteRecordButton";
import { MapView } from "@/components/MapView";
import { getT } from "@/i18n/server";
import type { HazardSeverity } from "@/lib/types";

export default async function RecordDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const t = await getT();
  const { id } = await params;
  const [record, profile] = await Promise.all([getRecord(id), getProfile()]);
  if (!record || !profile) notFound();

  const photoUrls = Object.values(await signPhotoUrls(record.photos ?? []));
  const completionUrls = Object.values(
    await signPhotoUrls(record.completion_photos ?? [])
  );

  const isReviewer = profile.role === "supervisor" || profile.role === "admin";
  const isAdmin = profile.role === "admin";

  const facts: { label: string; value: string | null }[] =
    record.type === "flora"
      ? [
          { label: "Species", value: record.species_name },
          { label: "Growth stage", value: record.growth_stage },
          { label: "Health condition", value: record.health_condition },
          {
            label: "Estimated count",
            value: record.estimated_count != null ? String(record.estimated_count) : null,
          },
        ]
      : record.type === "hazard"
        ? [
            { label: "Hazard type", value: record.hazard_type },
            { label: "Severity", value: record.severity },
          ]
        : [
            { label: "Reading type", value: record.reading_type },
            {
              label: "Value",
              value:
                record.reading_value != null
                  ? `${record.reading_value}${record.reading_unit ? ` ${record.reading_unit}` : ""}`
                  : null,
            },
          ];

  return (
    <div>
      <Link
        href="/records"
        className="mb-3 inline-flex items-center gap-1 text-[12px] font-medium text-muted transition-colors hover:text-ink"
      >
        <ChevronLeft className="h-3.5 w-3.5" strokeWidth={1.8} /> {t("Records")}
      </Link>

      <PageHeader
        title={record.title}
        subtitle={`${record.zone?.name ?? t("No zone")} · ${t("Observed").toLowerCase()} ${formatDate(
          record.observed_date
        )} · ${t("Submitted by").toLowerCase()} ${record.submitter?.full_name ?? t("unknown")}`}
        actions={
          <>
            <TypePill type={record.type} />
            <StatusBadge status={record.status} />
            {record.completed_at ? <CompletedBadge /> : null}
            {record.type === "hazard" ? (
              <SeverityBadge severity={record.severity as HazardSeverity | null} />
            ) : null}
            {isAdmin ? (
              <DeleteRecordButton
                recordId={record.id}
                title={record.title}
                photos={[...(record.photos ?? []), ...(record.completion_photos ?? [])]}
                redirectTo="/records"
              />
            ) : null}
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <Card>
            <h2 className="border-b border-rule px-4 py-3 text-[14px] font-semibold text-ink">
              {t("Details")}
            </h2>
            <dl className="grid grid-cols-1 gap-x-6 px-4 py-1 sm:grid-cols-2">
              {facts
                .filter((fact) => fact.value)
                .map((fact) => (
                  <DetailRow key={fact.label} label={t(fact.label)} value={fact.value} />
                ))}
              <DetailRow label={t("Observed")} value={formatDate(record.observed_date)} />
              <DetailRow label={t("Zone")} value={record.zone?.name ?? t("No zone")} />
              {record.latitude != null && record.longitude != null ? (
                <DetailRow
                  label={t("Coordinates")}
                  value={`${record.latitude.toFixed(5)}, ${record.longitude.toFixed(5)}`}
                  mono
                />
              ) : null}
            </dl>
          </Card>

          {record.notes ? (
            <Card>
              <h2 className="border-b border-rule px-4 py-3 text-[14px] font-semibold text-ink">
                {t("Notes")}
              </h2>
              <p className="whitespace-pre-wrap px-4 py-3 text-[14px] leading-relaxed text-ink">
                {record.notes}
              </p>
            </Card>
          ) : null}

          {photoUrls.length > 0 ? (
            <Card>
              <h2 className="border-b border-rule px-4 py-3 text-[14px] font-semibold text-ink">
                {t("Photos")}
                <span className="ml-1.5 font-normal text-muted">({photoUrls.length})</span>
              </h2>
              <div className="flex flex-wrap gap-2 p-4">
                {photoUrls.map((url, index) => (
                  <a
                    key={url}
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="block overflow-hidden rounded-[6px] border border-line"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt={t("Record photo {number}", { number: index + 1 })}
                      className="photo-thumb h-32 w-32 transition-transform hover:scale-[1.02]"
                    />
                  </a>
                ))}
              </div>
            </Card>
          ) : null}

          {record.latitude != null && record.longitude != null ? (
            <Card className="overflow-hidden">
              <h2 className="border-b border-rule px-4 py-3 text-[14px] font-semibold text-ink">
                {t("Location")}
              </h2>
              <MapView
                markers={[
                  {
                    id: record.id,
                    lat: record.latitude,
                    lng: record.longitude,
                    color: record.type === "hazard" ? "#C4242A" : "#1F6B4A",
                    label: record.title,
                  },
                ]}
                height={260}
              />
            </Card>
          ) : null}
        </div>

        <div className="space-y-4">
          <Card>
            <h2 className="border-b border-rule px-4 py-3 text-[14px] font-semibold text-ink">
              {t("Review")}
            </h2>
            <div className="p-4">
              {record.status === "pending" ? (
                isReviewer ? (
                  <ReviewPanel recordId={record.id} />
                ) : (
                  <p className="text-[13px] text-muted">
                    {t("Waiting for a supervisor. You will see the decision here.")}
                  </p>
                )
              ) : (
                <div className="text-[13px]">
                  <p className="text-ink">
                    {t("This record was {status} on {date}.", {
                      status:
                        record.status === "approved" ? t("approved") : t("rejected"),
                      date: record.reviewed_at ? formatDateTime(record.reviewed_at) : "-",
                    })}
                  </p>
                  <p className="mt-1 text-muted">
                    {t("Reviewed by {name}.", {
                      name: record.reviewer?.full_name ?? t("a reviewer"),
                    })}
                  </p>
                  {record.supervisor_feedback ? (
                    <p className="mt-3 rounded-control border border-rule bg-panel px-3 py-2 text-[13px] text-ink">
                      {record.supervisor_feedback}
                    </p>
                  ) : null}
                </div>
              )}
            </div>
          </Card>

          {record.type === "hazard" && record.status === "approved" ? (
            <Card>
              <h2 className="border-b border-rule px-4 py-3 text-[14px] font-semibold text-ink">
                {t("Work")}
              </h2>
              <div className="p-4 text-[13px]">
                {record.completed_at ? (
                  <>
                    <p className="text-ink">
                      {t("Completed by {name} on {date}.", {
                        name: record.completer?.full_name ?? t("the field worker"),
                        date: formatDateTime(record.completed_at),
                      })}
                    </p>
                    {record.completion_note ? (
                      <p className="mt-3 whitespace-pre-wrap rounded-control border border-rule bg-panel px-3 py-2 text-[13px] text-ink">
                        {record.completion_note}
                      </p>
                    ) : null}
                    {completionUrls.length > 0 ? (
                      <div className="mt-3">
                        <p className="text-[12px] text-muted">{t("After photos")}</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {completionUrls.map((url, index) => (
                            <a
                              key={url}
                              href={url}
                              target="_blank"
                              rel="noreferrer"
                              className="block overflow-hidden rounded-[6px] border border-line"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={url}
                                alt={t("After photo {number}", { number: index + 1 })}
                                className="photo-thumb h-24 w-24 transition-transform hover:scale-[1.02]"
                              />
                            </a>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </>
                ) : (
                  <p className="text-muted">{t("Waiting for the worker to finish the job.")}</p>
                )}
              </div>
            </Card>
          ) : null}

          <Card>
            <h2 className="border-b border-rule px-4 py-3 text-[14px] font-semibold text-ink">
              {t("Submission")}
            </h2>
            <dl className="px-4 py-1">
              <DetailRow
                label={t("Submitted by")}
                value={record.submitter?.full_name ?? t("unknown")}
              />
              <DetailRow label={t("Received")} value={formatDateTime(record.created_at)} />
              <DetailRow label={t("Reviewed by")} value={record.reviewer?.full_name ?? null} />
            </dl>
          </Card>
        </div>
      </div>
    </div>
  );
}

function DetailRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string | null;
  mono?: boolean;
}) {
  return (
    <div className="border-b border-rule py-2.5 last:border-b-0">
      <dt className="text-[12px] text-muted">{label}</dt>
      <dd className={`mt-0.5 text-[14px] text-ink ${mono ? "num text-[13px]" : ""}`}>
        {value || <span className="text-faint">-</span>}
      </dd>
    </div>
  );
}
