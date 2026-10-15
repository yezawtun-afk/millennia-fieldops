import Link from "next/link";
import { getZones, queryRecords } from "@/lib/data";
import { PageHeader, StatCard, StatusBadge, TypePill, SeverityBadge, Card, EmptyState } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { DashboardCharts } from "./DashboardCharts";
import type { HazardSeverity, RecordStatus, RecordType } from "@/lib/types";

export default async function DashboardPage() {
  const [records, zones] = await Promise.all([queryRecords(), getZones()]);

  const total = records.length;
  const pending = records.filter((r) => r.status === "pending").length;
  const approved = records.filter((r) => r.status === "approved").length;
  const rejected = records.filter((r) => r.status === "rejected").length;
  const activeHazards = records.filter((r) => r.type === "hazard" && r.status !== "rejected").length;

  // Counts by type.
  const byType: Record<RecordType, number> = { flora: 0, soil_water: 0, hazard: 0 };
  for (const r of records) byType[r.type] += 1;

  // Counts by status (for the chart).
  const byStatus: Record<RecordStatus, number> = { pending: 0, approved: 0, rejected: 0 };
  for (const r of records) byStatus[r.status] += 1;

  // Counts by severity for hazards.
  const bySeverity: Record<string, number> = { low: 0, medium: 0, high: 0, critical: 0, unrated: 0 };
  for (const r of records) {
    if (r.type !== "hazard") continue;
    bySeverity[r.severity ?? "unrated"] += 1;
  }

  // THE BY-ZONE BREAKDOWN: one bar per monitoring zone.
  const byZone = zones.map((zone) => {
    const zoneRecords = records.filter((r) => r.zone_id === zone.id);
    return {
      name: zone.name,
      color: zone.color,
      flora: zoneRecords.filter((r) => r.type === "flora").length,
      soil_water: zoneRecords.filter((r) => r.type === "soil_water").length,
      hazard: zoneRecords.filter((r) => r.type === "hazard").length,
      total: zoneRecords.length,
    };
  });
  const unzoned = records.filter((r) => !r.zone_id).length;

  const recent = records.slice(0, 8);

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Overview of field records across Millennia Village."
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        <StatCard label="Total records" value={total} />
        <StatCard label="Pending review" value={pending} accent="#f59e0b" />
        <StatCard label="Approved" value={approved} accent="#16a34a" />
        <StatCard label="Rejected" value={rejected} accent="#dc2626" />
        <StatCard label="Active hazards" value={activeHazards} accent="#dc2626" />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <DashboardCharts byType={byType} byStatus={byStatus} bySeverity={bySeverity} />
      </div>

      {/* By-zone breakdown */}
      <Card className="mt-4">
        <h2 className="mb-3 text-sm font-semibold text-ink">Records by monitoring zone</h2>
        {zones.length === 0 ? (
          <EmptyState title="No zones yet" hint="Add monitoring zones from the Zones page." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                  <th className="py-2 pr-4 font-medium">Zone</th>
                  <th className="py-2 pr-4 font-medium">Flora</th>
                  <th className="py-2 pr-4 font-medium">Soil/Water</th>
                  <th className="py-2 pr-4 font-medium">Hazard</th>
                  <th className="py-2 pr-4 font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {byZone.map((z) => (
                  <tr key={z.name} className="border-b border-line/60 last:border-0">
                    <td className="py-2 pr-4">
                      <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full" style={{ background: z.color }} />
                      {z.name}
                    </td>
                    <td className="py-2 pr-4 text-flora">{z.flora}</td>
                    <td className="py-2 pr-4 text-water">{z.soil_water}</td>
                    <td className="py-2 pr-4 text-hazard">{z.hazard}</td>
                    <td className="py-2 pr-4 font-semibold">{z.total}</td>
                  </tr>
                ))}
                {unzoned > 0 ? (
                  <tr className="text-muted">
                    <td className="py-2 pr-4">No zone</td>
                    <td className="py-2 pr-4">-</td>
                    <td className="py-2 pr-4">-</td>
                    <td className="py-2 pr-4">-</td>
                    <td className="py-2 pr-4 font-semibold">{unzoned}</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Recent submissions */}
      <Card className="mt-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">Recent submissions</h2>
          <Link href="/records" className="text-xs font-medium text-primary hover:underline">
            View all records
          </Link>
        </div>
        {recent.length === 0 ? (
          <EmptyState title="No records yet" hint="Records captured on the mobile app appear here." />
        ) : (
          <ul className="divide-y divide-line">
            {recent.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-3 py-3">
                <TypePill type={r.type} />
                <Link href={`/records/${r.id}`} className="flex-1 text-sm font-medium text-ink hover:underline">
                  {r.title}
                </Link>
                {r.type === "hazard" ? <SeverityBadge severity={r.severity as HazardSeverity | null} /> : null}
                <StatusBadge status={r.status} />
                <span className="w-28 text-right text-xs text-muted">{formatDate(r.observed_date)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
