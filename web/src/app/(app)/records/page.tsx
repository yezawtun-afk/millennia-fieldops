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
        title="Field records"
        subtitle={`${records.length} record(s) match the current filters.`}
        actions={<ExportButtons query={exportQuery} />}
      />

      <RecordsFilters zones={zones} />

      {records.length === 0 ? (
        <EmptyState title="No records found" hint="Try clearing the filters." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-white shadow-sm">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Record</th>
                <th className="px-4 py-3 font-medium">Zone</th>
                <th className="px-4 py-3 font-medium">Observed</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Submitted by</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id} className="border-b border-line/60 last:border-0 hover:bg-page">
                  <td className="px-4 py-3 align-top">
                    <TypePill type={r.type} />
                  </td>
                  <td className="px-4 py-3 align-top">
                    <Link href={`/records/${r.id}`} className="font-medium text-ink hover:underline">
                      {r.title}
                    </Link>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-muted">
                      <span>{recordSubtitle(r)}</span>
                      {r.type === "hazard" ? <SeverityBadge severity={r.severity as HazardSeverity | null} /> : null}
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top text-muted">{r.zone?.name ?? "-"}</td>
                  <td className="px-4 py-3 align-top text-muted">{formatDate(r.observed_date)}</td>
                  <td className="px-4 py-3 align-top">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="px-4 py-3 align-top text-muted">{r.submitter?.full_name ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
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
