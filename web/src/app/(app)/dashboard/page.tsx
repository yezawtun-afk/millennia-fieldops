import Link from "next/link";
import { CheckCircle2, Clock, Layers, TriangleAlert, XCircle } from "lucide-react";
import { getZones, queryRecords } from "@/lib/data";
import { PageHeader, StatCard, EmptyState } from "@/components/ui";
import { RecordRow } from "@/components/RecordRow";
import { DashboardCharts } from "./DashboardCharts";
import type { RecordStatus, RecordType } from "@/lib/types";

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

  // One row per monitoring zone.
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

  const recent = records.slice(0, 6);

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Overview of field records across Millennia Village."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard
          label="Total records"
          value={total}
          tone="bg-primary-soft text-primary"
          icon={<Layers className="h-4 w-4" />}
        />
        <StatCard
          label="Pending review"
          value={pending}
          tone="bg-pending-soft text-pending"
          icon={<Clock className="h-4 w-4" />}
        />
        <StatCard
          label="Approved"
          value={approved}
          tone="bg-approved-soft text-approved"
          icon={<CheckCircle2 className="h-4 w-4" />}
        />
        <StatCard
          label="Rejected"
          value={rejected}
          tone="bg-rejected-soft text-rejected"
          icon={<XCircle className="h-4 w-4" />}
        />
        <StatCard
          label="Active hazards"
          value={activeHazards}
          tone="bg-rejected-soft text-rejected"
          icon={<TriangleAlert className="h-4 w-4" />}
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
        <DashboardCharts byType={byType} byStatus={byStatus} bySeverity={bySeverity} />
      </div>

      {/* By-zone breakdown */}
      <div className="mt-4 rounded-lg border border-line bg-white">
        <h2 className="border-b border-line px-4 py-3 text-sm font-semibold text-ink">
          Records by monitoring zone
        </h2>
        {zones.length === 0 ? (
          <div className="p-4">
            <EmptyState title="No zones yet" hint="Add monitoring zones from the Zones page." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-page text-left text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3 font-semibold">Zone</th>
                  <th className="px-4 py-3 font-semibold">Flora</th>
                  <th className="px-4 py-3 font-semibold">Soil/Water</th>
                  <th className="px-4 py-3 font-semibold">Hazard</th>
                  <th className="px-4 py-3 font-semibold">Total</th>
                </tr>
              </thead>
              <tbody>
                {byZone.map((z) => (
                  <tr key={z.name} className="border-t border-line">
                    <td className="px-4 py-3">
                      <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full" style={{ background: z.color }} />
                      {z.name}
                    </td>
                    <td className="px-4 py-3 text-flora">{z.flora}</td>
                    <td className="px-4 py-3 text-water">{z.soil_water}</td>
                    <td className="px-4 py-3 text-hazard">{z.hazard}</td>
                    <td className="px-4 py-3 font-semibold">{z.total}</td>
                  </tr>
                ))}
                {unzoned > 0 ? (
                  <tr className="border-t border-line text-muted">
                    <td className="px-4 py-3">No zone</td>
                    <td className="px-4 py-3">-</td>
                    <td className="px-4 py-3">-</td>
                    <td className="px-4 py-3">-</td>
                    <td className="px-4 py-3 font-semibold">{unzoned}</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent submissions */}
      <div className="mt-4 rounded-lg border border-line bg-white">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="text-sm font-semibold text-ink">
            Recent submissions{recent.length ? ` (${recent.length})` : ""}
          </h2>
          <Link href="/records" className="text-xs font-semibold text-primary hover:underline">
            View all
          </Link>
        </div>
        {recent.length === 0 ? (
          <div className="p-4">
            <EmptyState title="No records yet" hint="Records captured on the mobile app appear here." />
          </div>
        ) : (
          <div>
            {recent.map((r) => (
              <RecordRow key={r.id} record={r} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
