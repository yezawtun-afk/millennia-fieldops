import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { countRecords, getPendingQueue, getZones, queryRecords } from "@/lib/data";
import { getProfile } from "@/lib/supabase/server";
import { signPhotoUrls, stripBucket } from "@/lib/photos";
import {
  EmptyState,
  PageHeader,
  SectionCard,
  Stat,
  StatStrip,
  StatusBadge,
  TypeDot,
  btnPrimary,
  btnSecondary,
  tdClass,
  thClass,
} from "@/components/ui";
import { BarChart, RankBars } from "@/components/BarChart";
import { RecordRow } from "@/components/RecordRow";
import { formatDateTime } from "@/lib/format";
import type { HazardSeverity, RecordType } from "@/lib/types";

const BUCKET = "record-photos";

function startOfWeek(date: Date): Date {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const offset = (start.getDay() + 6) % 7; // Monday first
  start.setDate(start.getDate() - offset);
  return start;
}

function ageLabel(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "1 day";
  return `${days} days`;
}

export default async function DashboardPage() {
  const [total, pending, approved, rejected, hazards, rejectedHazards, zones, records, queue, profile] =
    await Promise.all([
      countRecords(),
      countRecords({ status: "pending" }),
      countRecords({ status: "approved" }),
      countRecords({ status: "rejected" }),
      countRecords({ type: "hazard" }),
      countRecords({ type: "hazard", status: "rejected" }),
      getZones(),
      queryRecords(),
      getPendingQueue(3),
      getProfile(),
    ]);

  const activeHazards = Math.max(hazards - rejectedHazards, 0);
  const isReviewer = profile?.role === "supervisor" || profile?.role === "admin";
  const oldestPending = queue[0]?.created_at ? ageLabel(queue[0].created_at) : null;

  // Eight weeks of submissions, Monday to Sunday.
  const thisWeek = startOfWeek(new Date());
  const weeks = Array.from({ length: 8 }, (_, index) => {
    const start = new Date(thisWeek);
    start.setDate(start.getDate() - (7 - index) * 7);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    return { start, end };
  });
  const weekly = weeks.map((week) => ({
    label: week.start.toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
    value: records.filter((record) => {
      const created = new Date(record.created_at);
      return created >= week.start && created < week.end;
    }).length,
  }));

  // Type mix per zone.
  const byZone = zones.map((zone) => {
    const zoneRecords = records.filter((record) => record.zone_id === zone.id);
    return {
      id: zone.id,
      name: zone.name,
      color: zone.color,
      flora: zoneRecords.filter((record) => record.type === "flora").length,
      soil_water: zoneRecords.filter((record) => record.type === "soil_water").length,
      hazard: zoneRecords.filter((record) => record.type === "hazard").length,
      total: zoneRecords.length,
    };
  });
  const byType: Record<RecordType, number> = { flora: 0, soil_water: 0, hazard: 0 };
  for (const record of records) byType[record.type] += 1;
  const unzoned = records.filter((record) => !record.zone_id).length;

  const bySeverity: Record<string, number> = { low: 0, medium: 0, critical: 0, unrated: 0 };
  for (const record of records) {
    if (record.type !== "hazard") continue;
    bySeverity[record.severity ?? "unrated"] += 1;
  }

  const recent = records.slice(0, 5);
  const signed = await signPhotoUrls(
    recent.flatMap((record) => (record.photos?.[0] ? [record.photos[0]] : []))
  );
  const photoUrl = (path: string | undefined) => {
    if (!path) return null;
    if (path.startsWith("http")) return path;
    return signed[`${BUCKET}/${stripBucket(path)}`] ?? null;
  };

  const finding =
    pending > 0
      ? `${pending} record${pending === 1 ? "" : "s"} waiting on a decision${oldestPending ? `, the oldest for ${oldestPending}` : ""}.`
      : "Nothing is waiting for review. Everything captured has a decision.";

  return (
    <div>
      <PageHeader
        title="Overview"
        subtitle={finding}
        actions={
          pending > 0 ? (
            <Link href="/records?status=pending" className={btnPrimary}>
              {isReviewer ? "Review pending" : "View pending"}
              <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
            </Link>
          ) : null
        }
      />

      <StatStrip>
        <Stat label="Records" value={total.toLocaleString("en-GB")} />
        <Stat
          label="Waiting review"
          value={pending.toLocaleString("en-GB")}
          hint={oldestPending ? `oldest ${oldestPending}` : undefined}
          tone={pending > 0 ? "text-warning-ink" : "text-ink"}
        />
        <Stat label="Approved" value={approved.toLocaleString("en-GB")} />
        <Stat label="Rejected" value={rejected.toLocaleString("en-GB")} />
        <Stat
          label="Active hazards"
          value={activeHazards.toLocaleString("en-GB")}
          hint="not rejected"
          tone={activeHazards > 0 ? "text-negative-ink" : "text-ink"}
        />
      </StatStrip>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          <SectionCard
            title="Submissions per week"
            hint="Records created in the last eight weeks"
            action={
              <span className="text-[12px] text-muted">
                {weekly.reduce((sum, week) => sum + week.value, 0)} total
              </span>
            }
          >
            <BarChart data={weekly} height={180} />
          </SectionCard>

          <SectionCard
            title="By monitoring zone"
            hint={
              records.length >= 1000
                ? "Counted across the latest 1,000 submissions"
                : `${zones.length} zones · ${byType.flora} flora, ${byType.soil_water} soil & water, ${byType.hazard} hazard`
            }
            bodyClassName=""
          >
            {zones.length === 0 ? (
              <div className="p-4">
                <EmptyState title="No zones yet" hint="Add monitoring zones from the Zones page." />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[420px]">
                  <thead>
                    <tr className="border-b border-rule">
                      <th className={thClass}>Zone</th>
                      <th className={`${thClass} text-right`}>Flora</th>
                      <th className={`${thClass} text-right`}>Soil &amp; water</th>
                      <th className={`${thClass} text-right`}>Hazard</th>
                      <th className={`${thClass} text-right`}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byZone.map((zone) => (
                      <tr key={zone.id} className="border-b border-rule last:border-b-0">
                        <td className={tdClass}>
                          <span className="flex items-center gap-2">
                            <span
                              className="inline-block h-2 w-2 shrink-0 rounded-full"
                              style={{ background: zone.color }}
                            />
                            {zone.name}
                          </span>
                        </td>
                        <td className={`${tdClass} text-right tabular-nums text-muted`}>{zone.flora}</td>
                        <td className={`${tdClass} text-right tabular-nums text-muted`}>{zone.soil_water}</td>
                        <td className={`${tdClass} text-right tabular-nums text-muted`}>{zone.hazard}</td>
                        <td className={`${tdClass} text-right font-medium tabular-nums`}>{zone.total}</td>
                      </tr>
                    ))}
                    {unzoned > 0 ? (
                      <tr className="text-muted">
                        <td className={tdClass}>No zone</td>
                        <td className={`${tdClass} text-right`}>-</td>
                        <td className={`${tdClass} text-right`}>-</td>
                        <td className={`${tdClass} text-right`}>-</td>
                        <td className={`${tdClass} text-right font-medium tabular-nums`}>{unzoned}</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        </div>

        <div className="space-y-4">
          <SectionCard
            title="Review queue"
            hint={pending > 0 ? "Oldest first" : "Up to date"}
            bodyClassName="p-0"
          >
            {queue.length === 0 ? (
              <p className="px-4 py-5 text-[13px] text-muted">No records are waiting for review.</p>
            ) : (
              <ul className="divide-y divide-rule">
                {queue.map((record) => (
                  <li key={record.id}>
                    <Link href={`/records/${record.id}`} className="block px-4 py-3 hover:bg-panel">
                      <span className="flex items-start justify-between gap-2">
                        <span className="min-w-0">
                          <span className="block truncate text-[13px] font-medium text-ink">
                            {record.title}
                          </span>
                          <span className="mt-0.5 block truncate text-[12px] text-muted">
                            {record.zone?.name ?? "No zone"} · {ageLabel(record.created_at)} old
                          </span>
                        </span>
                        <TypeDot type={record.type} />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <div className="border-t border-rule p-3">
              <Link href="/records?status=pending" className={`${btnSecondary} w-full`}>
                {isReviewer ? "Open the queue" : "View pending records"}
              </Link>
            </div>
          </SectionCard>

          <SectionCard title="Hazard severity" hint="All hazard records" bodyClassName="p-0">
            <RankBars
              data={(["critical", "medium", "low"] as HazardSeverity[]).map((severity) => ({
                label: severity[0].toUpperCase() + severity.slice(1),
                value: bySeverity[severity],
              }))}
              emptyLabel="No hazards recorded yet."
            />
            {bySeverity.unrated > 0 ? (
              <p className="border-t border-rule px-4 py-2 text-[12px] text-muted">
                {bySeverity.unrated} hazard{bySeverity.unrated === 1 ? "" : "s"} without a severity
              </p>
            ) : null}
          </SectionCard>

          <SectionCard
            title="Recent submissions"
            action={
              <Link href="/records" className="text-[12px] font-medium text-accent hover:underline">
                All records
              </Link>
            }
            bodyClassName=""
          >
            {recent.length === 0 ? (
              <div className="p-4">
                <EmptyState
                  title="No records yet"
                  hint="Records captured in the mobile app appear here once they sync."
                />
              </div>
            ) : (
              <div>
                {recent.map((record) => (
                  <RecordRow key={record.id} record={record} photoUrl={photoUrl(record.photos?.[0])} />
                ))}
              </div>
            )}
          </SectionCard>

          <p className="px-1 text-[12px] leading-relaxed text-muted">
            Last record received {records[0] ? formatDateTime(records[0].created_at) : "never"}.
          </p>
        </div>
      </div>

      {pending > 0 ? (
        <div className="mt-4 flex items-center gap-2 text-[12px] text-muted lg:hidden">
          <StatusBadge status="pending" />
          <span>{pending} waiting for a decision</span>
        </div>
      ) : null}
    </div>
  );
}
