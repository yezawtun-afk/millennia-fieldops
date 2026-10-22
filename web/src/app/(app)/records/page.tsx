import Link from "next/link";
import { getProfile } from "@/lib/supabase/server";
import { getZones, queryRecords } from "@/lib/data";
import { EmptyState, PageHeader, tdClass, thClass } from "@/components/ui";
import { SeverityBadge, StatusBadge, TypePill } from "@/components/Pills";
import { formatDate, recordSubtitle } from "@/lib/format";
import { RecordsFilters } from "@/components/RecordsFilters";
import { ExportButtons } from "@/components/ExportButtons";
import { DeleteRecordButton } from "@/components/DeleteRecordButton";
import { getT } from "@/i18n/server";
import type { HazardSeverity } from "@/lib/types";

type SearchParams = Promise<{
  q?: string;
  type?: string;
  status?: string;
  severity?: string;
  zone?: string;
}>;

export default async function RecordsPage({ searchParams }: { searchParams: SearchParams }) {
  const t = await getT();
  const params = await searchParams;
  const filters = {
    q: params.q,
    type: params.type,
    status: params.status,
    severity: params.severity,
    zoneId: params.zone,
  };

  const [records, zones, profile] = await Promise.all([
    queryRecords(filters),
    getZones(),
    getProfile(),
  ]);

  const isReviewer = profile?.role === "supervisor" || profile?.role === "admin";
  const isAdmin = profile?.role === "admin";
  const exportQuery = new URLSearchParams(
    Object.entries({
      q: params.q ?? "",
      type: params.type ?? "",
      status: params.status ?? "",
      severity: params.severity ?? "",
      zone: params.zone ?? "",
    }).filter(([, v]) => v)
  ).toString();

  const pendingShown = records.filter((record) => record.status === "pending").length;

  const subtitle =
    records.length === 0
      ? t("No records match the current filters.")
      : `${t("{count} records shown", { count: records.length })}${
          pendingShown > 0 ? t(", {count} still waiting review", { count: pendingShown }) : ""
        }.`;

  return (
    <div>
      <PageHeader title={t("Records")} subtitle={subtitle} actions={<ExportButtons query={exportQuery} />} />

      <RecordsFilters zones={zones} />

      {records.length === 0 ? (
        <EmptyState
          title={t("No records match those filters")}
          hint={t("Clear the search box, or pick another type, status or zone.")}
        />
      ) : (
        <div className="overflow-hidden rounded-card border border-line bg-sheet">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-rule">
                  <th className={thClass}>{t("Record")}</th>
                  <th className={thClass}>{t("Type")}</th>
                  <th className={thClass}>{t("Zone")}</th>
                  <th className={`${thClass} text-right`}>{t("Observed")}</th>
                  <th className={thClass}>{t("Status")}</th>
                  <th className={`${thClass} hidden 2xl:table-cell`}>{t("Submitted by")}</th>
                  {isAdmin ? <th className={`${thClass} text-right`}>{t("Actions")}</th> : null}
                </tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <tr
                    key={record.id}
                    className="border-b border-rule transition-colors last:border-b-0 hover:bg-panel"
                  >
                    <td className={tdClass}>
                      <Link
                        href={`/records/${record.id}`}
                        className="font-medium text-ink hover:text-accent"
                      >
                        {record.title}
                      </Link>
                      <span className="mt-0.5 flex items-center gap-2 text-[12px] text-muted">
                        <span className="truncate">{recordSubtitle(record)}</span>
                        {record.type === "hazard" ? (
                          <SeverityBadge severity={record.severity as HazardSeverity | null} />
                        ) : null}
                      </span>
                    </td>
                    <td className={tdClass}>
                      <TypePill type={record.type} />
                    </td>
                    <td className={`${tdClass} text-muted`}>{record.zone?.name ?? "-"}</td>
                    <td className={`${tdClass} whitespace-nowrap text-right tabular-nums text-muted`}>
                      {formatDate(record.observed_date)}
                    </td>
                    <td className={tdClass}>
                      <StatusBadge status={record.status} />
                    </td>
                    <td className={`${tdClass} hidden whitespace-nowrap text-muted 2xl:table-cell`}>
                      {record.submitter?.full_name ?? "-"}
                    </td>
                    {isAdmin ? (
                      <td className={`${tdClass} text-right`}>
                        <DeleteRecordButton
                          compact
                          recordId={record.id}
                          title={record.title}
                          photos={record.photos ?? []}
                        />
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {isAdmin ? (
        <p className="mt-3 max-w-[85ch] text-[12px] leading-relaxed text-muted">
          {t(
            "Deleting a record also removes its photos and review notifications. Field workers can delete their own records only while they are still pending."
          )}
        </p>
      ) : null}

      {!isReviewer ? (
        <p className="mt-3 max-w-[85ch] text-[12px] leading-relaxed text-muted">
          {t(
            "You are signed in as a field worker. Open a record to view it; only supervisors and administrators can approve or reject."
          )}
        </p>
      ) : null}
    </div>
  );
}
