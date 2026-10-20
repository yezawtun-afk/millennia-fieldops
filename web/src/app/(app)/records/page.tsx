import Link from "next/link";
import { getProfile } from "@/lib/supabase/server";
import { getZones, queryRecords } from "@/lib/data";
import {
  PageHeader,
  TypePill,
  StatusBadge,
  SeverityBadge,
  EmptyState,
  tdClass,
  thClass,
} from "@/components/ui";
import { formatDate, recordSubtitle } from "@/lib/format";
import { RecordsFilters } from "@/components/RecordsFilters";
import { ExportButtons } from "@/components/ExportButtons";
import { DeleteRecordButton } from "@/components/DeleteRecordButton";
import type { HazardSeverity } from "@/lib/types";

type SearchParams = Promise<{
  q?: string;
  type?: string;
  status?: string;
  severity?: string;
  zone?: string;
}>;

export default async function RecordsPage({ searchParams }: { searchParams: SearchParams }) {
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

  return (
    <div>
      <PageHeader
        title="Records"
        subtitle={
          records.length === 0
            ? "No records match the current filters."
            : `${records.length} record${records.length === 1 ? "" : "s"} shown${pendingShown > 0 ? `, ${pendingShown} still waiting review` : ""}.`
        }
        actions={<ExportButtons query={exportQuery} />}
      />

      <RecordsFilters zones={zones} />

      {records.length === 0 ? (
        <EmptyState
          title="No records match those filters"
          hint="Clear the search box, or pick another type, status or zone."
        />
      ) : (
        <div className="overflow-hidden rounded-card border border-line bg-sheet">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-rule">
                  <th className={thClass}>Record</th>
                  <th className={thClass}>Type</th>
                  <th className={thClass}>Zone</th>
                  <th className={`${thClass} text-right`}>Observed</th>
                  <th className={thClass}>Status</th>
                  <th className={`${thClass} hidden 2xl:table-cell`}>Submitted by</th>
                  {isAdmin ? <th className={`${thClass} text-right`}>Actions</th> : null}
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
          Deleting a record also removes its photos and review notifications. Field workers can
          delete their own records only while they are still pending.
        </p>
      ) : null}

      {!isReviewer ? (
        <p className="mt-3 max-w-[85ch] text-[12px] leading-relaxed text-muted">
          You are signed in as a field worker. Open a record to view it; only supervisors and
          administrators can approve or reject.
        </p>
      ) : null}
    </div>
  );
}
