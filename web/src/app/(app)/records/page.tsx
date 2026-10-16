import Link from "next/link";
import { getProfile } from "@/lib/supabase/server";
import { getZones, queryRecords } from "@/lib/data";
import { PageHeader, TypePill, StatusBadge, SeverityBadge, EmptyState } from "@/components/ui";
import { formatDate, recordSubtitle } from "@/lib/format";
import { RecordsFilters } from "@/components/RecordsFilters";
import { ExportButtons } from "@/components/ExportButtons";
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
  const exportQuery = new URLSearchParams(
    Object.entries({
      q: params.q ?? "",
      type: params.type ?? "",
      status: params.status ?? "",
      severity: params.severity ?? "",
      zone: params.zone ?? "",
    }).filter(([, v]) => v)
  ).toString();

  return (
    <div>
      <PageHeader
        title="Records"
        subtitle={`${records.length} record${records.length === 1 ? "" : "s"} shown`}
        actions={<ExportButtons query={exportQuery} />}
      />

      <RecordsFilters zones={zones} />

      {records.length === 0 ? (
        <EmptyState
          title="No records match those filters"
          hint="Try clearing the search box or picking another zone."
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-line bg-white">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-page text-left text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3 font-semibold">Record</th>
                  <th className="px-4 py-3 font-semibold">Type</th>
                  <th className="px-4 py-3 font-semibold">Zone</th>
                  <th className="px-4 py-3 font-semibold">Observed</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Submitted by</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.id} className="border-t border-line hover:bg-page">
                    <td className="px-4 py-3">
                      <Link href={`/records/${r.id}`} className="font-semibold text-ink hover:underline">
                        {r.title}
                      </Link>
                      <div className="mt-0.5 flex items-center gap-2 text-xs text-muted">
                        <span>{recordSubtitle(r)}</span>
                        {r.type === "hazard" ? <SeverityBadge severity={r.severity as HazardSeverity | null} /> : null}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <TypePill type={r.type} />
                    </td>
                    <td className="px-4 py-3 text-muted">{r.zone?.name ?? "-"}</td>
                    <td className="px-4 py-3 text-muted">{formatDate(r.observed_date)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="px-4 py-3 text-muted">{r.submitter?.full_name ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!isReviewer ? (
        <p className="mt-3 text-xs text-muted">
          You are signed in as a field worker - open a record to view it, but only supervisors and
          administrators can approve or reject.
        </p>
      ) : null}
    </div>
  );
}
