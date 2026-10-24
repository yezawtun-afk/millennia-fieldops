import Link from "next/link";
import { ArrowRight } from "lucide-react";
import {
  countRecords,
  getPendingQueue,
  getUrgentQueue,
  getZones,
  queryRecords,
} from "@/lib/data";
import { getProfile } from "@/lib/supabase/server";
import { signPhotoUrls, stripBucket } from "@/lib/photos";
import {
  EmptyState,
  PageHeader,
  SectionCard,
  Stat,
  StatStrip,
  TypeDot,
  btnPrimary,
  btnSecondary,
  tdClass,
  thClass,
} from "@/components/ui";
import { SeverityBadge, StatusBadge } from "@/components/Pills";
import { RankBars, StackedBarChart } from "@/components/BarChart";
import { RecordRow } from "@/components/RecordRow";
import { formatDateTime, HAZARD_TYPES, STATUS_CHART_COLORS } from "@/lib/format";
import { getT, type ServerTranslate } from "@/i18n/server";
import type { HazardSeverity, RecordType } from "@/lib/types";

const BUCKET = "record-photos";

function startOfWeek(date: Date): Date {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const offset = (start.getDay() + 6) % 7; // Monday first
  start.setDate(start.getDate() - offset);
  return start;
}

function ageLabel(t: ServerTranslate, iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return t("today");
  if (days === 1) return t("1 day");
  return t("{count} days", { count: days });
}

export default async function DashboardPage() {
  const t = await getT();
  const [
    total,
    pending,
    approved,
    rejected,
    hazards,
    rejectedHazards,
    zones,
    records,
    queue,
    urgent,
    urgentTotal,
    profile,
  ] = await Promise.all([
    countRecords(),
    countRecords({ status: "pending" }),
    countRecords({ status: "approved" }),
    countRecords({ status: "rejected" }),
    countRecords({ type: "hazard" }),
    countRecords({ type: "hazard", status: "rejected" }),
    getZones(),
    queryRecords(),
    getPendingQueue(3),
    getUrgentQueue(3),
    countRecords({ status: "pending", severity: "critical" }),
    getProfile(),
  ]);

  const activeHazards = Math.max(hazards - rejectedHazards, 0);
  const isReviewer = profile?.role === "supervisor" || profile?.role === "admin";
  const oldestPending = queue[0]?.created_at ? ageLabel(t, queue[0].created_at) : null;

  // Eight weeks of submissions, Monday to Sunday.
  const thisWeek = startOfWeek(new Date());
  const weeks = Array.from({ length: 8 }, (_, index) => {
    const start = new Date(thisWeek);
    start.setDate(start.getDate() - (7 - index) * 7);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    return { start, end };
  });
  const weekly = weeks.map((week) => {
    const inWeek = records.filter((record) => {
      const created = new Date(record.created_at);
      return created >= week.start && created < week.end;
    });
    return {
      label: week.start.toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
      segments: [
        {
          label: t("Approved"),
          value: inWeek.filter((record) => record.status === "approved").length,
          color: STATUS_CHART_COLORS.approved,
        },
        {
          label: t("Pending review"),
          value: inWeek.filter((record) => record.status === "pending").length,
          color: STATUS_CHART_COLORS.pending,
        },
        {
          label: t("Rejected"),
          value: inWeek.filter((record) => record.status === "rejected").length,
          color: STATUS_CHART_COLORS.rejected,
        },
      ],
    };
  });
  const weeklyTotal = weekly.reduce(
    (sum, week) => sum + week.segments.reduce((weekSum, segment) => weekSum + segment.value, 0),
    0
  );

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

  // The five fixed hazard categories, in the order the form offers them.
  const byCategory = HAZARD_TYPES.map((name) => ({
    label: t(name),
    value: records.filter((record) => record.type === "hazard" && record.hazard_type === name)
      .length,
  }));
  const uncategorisedHazards = records.filter(
    (record) => record.type === "hazard" && !record.hazard_type
  ).length;

  // Three honest signals instead of a single invented score. They are computed
  // from the same sample the rest of the page uses, so the card says so.
  const openCritical = records.filter(
    (record) =>
      record.type === "hazard" &&
      record.severity === "critical" &&
      record.status !== "rejected" &&
      !record.completed_at
  );
  // records arrive newest first, so the last match is the one waiting longest.
  const oldestOpenCritical = openCritical.at(-1)?.created_at ?? null;

  const decided = records.filter((record) => record.reviewed_at);
  const decidedWithinDay = decided.filter(
    (record) =>
      new Date(record.reviewed_at as string).getTime() - new Date(record.created_at).getTime() <=
      86_400_000
  );
  const decidedWithinDayPercent = decided.length
    ? Math.round((decidedWithinDay.length / decided.length) * 100)
    : null;

  const idleCutoff = Date.now() - 14 * 86_400_000;
  const idleZones = zones.filter(
    (zone) =>
      !records.some(
        (record) =>
          record.zone_id === zone.id && new Date(record.created_at).getTime() >= idleCutoff
      )
  );
  const sampleHint =
    records.length >= 1000
      ? t("Counted across the latest 1,000 submissions")
      : t("All records");

  const recent = records.slice(0, 5);
  const signed = await signPhotoUrls(
    [...recent, ...urgent].flatMap((record) =>
      record.photos?.[0] ? [record.photos[0]] : []
    )
  );
  const photoUrl = (path: string | undefined) => {
    if (!path) return null;
    if (path.startsWith("http")) return path;
    return signed[`${BUCKET}/${stripBucket(path)}`] ?? null;
  };

  const finding =
    pending > 0
      ? `${t("{count} records waiting on a decision", { count: pending })}${
          oldestPending ? t(", the oldest for {age}", { age: oldestPending }) : ""
        }.`
      : t("Nothing is waiting for review. Everything captured has a decision.");

  return (
    <div>
      <PageHeader
        title={t("Overview")}
        subtitle={finding}
        actions={
          pending > 0 ? (
            <Link href="/records?status=pending" className={btnPrimary}>
              {isReviewer ? t("Review pending") : t("View pending")}
              <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
            </Link>
          ) : null
        }
      />

      {urgentTotal > 0 ? (
        <SectionCard
          className="mb-4 border-negative/25"
          title={t("Needs attention now")}
          hint={t("{count} critical hazards are waiting for a decision.", { count: urgentTotal })}
          bodyClassName="p-0"
          action={
            <Link href="/records?status=pending&severity=critical" className={btnSecondary}>
              {t("Open the queue")}
            </Link>
          }
        >
          <ul className="divide-y divide-rule">
            {urgent.map((record) => (
              <li key={record.id}>
                <Link
                  href={`/records/${record.id}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-panel"
                >
                  {photoUrl(record.photos?.[0]) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={photoUrl(record.photos?.[0]) as string}
                      alt=""
                      className="h-11 w-11 shrink-0 rounded-[8px] object-cover"
                    />
                  ) : (
                    <span className="h-11 w-11 shrink-0 rounded-[8px] bg-panel" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-ink">
                      {record.title}
                    </span>
                    <span className="mt-0.5 block truncate text-[12px] text-muted">
                      {record.zone?.name ?? t("No zone")} ·{" "}
                      {t("{age} old", { age: ageLabel(t, record.created_at) })}
                    </span>
                  </span>
                  <SeverityBadge severity={record.severity} />
                  <span className="shrink-0 text-[12px] font-medium text-accent">
                    {t("Review")}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </SectionCard>
      ) : null}

      <StatStrip>
        <Stat label={t("Records")} value={total.toLocaleString("en-GB")} />
        <Stat
          label={t("Waiting review")}
          value={pending.toLocaleString("en-GB")}
          hint={oldestPending ? t("oldest {age}", { age: oldestPending }) : undefined}
          tone={pending > 0 ? "text-warning-ink" : "text-ink"}
        />
        <Stat label={t("Approved")} value={approved.toLocaleString("en-GB")} />
        <Stat label={t("Rejected")} value={rejected.toLocaleString("en-GB")} />
        <Stat
          label={t("Active hazards")}
          value={activeHazards.toLocaleString("en-GB")}
          hint={t("not rejected")}
          tone={activeHazards > 0 ? "text-negative-ink" : "text-ink"}
        />
      </StatStrip>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          <SectionCard
            title={t("Submissions per week")}
            hint={t("Records created in the last eight weeks")}
            action={
              <span className="text-[12px] text-muted">
                {t("{count} total", { count: weeklyTotal })}
              </span>
            }
          >
            <StackedBarChart data={weekly} height={180} unit={t("records")} />
          </SectionCard>

          <SectionCard
            title={t("Hazard categories")}
            hint={t("The five hazard types recorded")}
            bodyClassName="p-0"
          >
            <RankBars data={byCategory} emptyLabel={t("No hazards recorded yet.")} />
            {uncategorisedHazards > 0 ? (
              <p className="border-t border-rule px-4 py-2 text-[12px] text-muted">
                {t("{count} hazards without a category", { count: uncategorisedHazards })}
              </p>
            ) : null}
          </SectionCard>

          <SectionCard
            title={t("By monitoring zone")}
            hint={
              records.length >= 1000
                ? t("Counted across the latest 1,000 submissions")
                : t("{zones} zones · {flora} flora, {water} soil & water, {hazard} hazard", {
                    zones: zones.length,
                    flora: byType.flora,
                    water: byType.soil_water,
                    hazard: byType.hazard,
                  })
            }
            bodyClassName=""
          >
            {zones.length === 0 ? (
              <div className="p-4">
                <EmptyState
                  title={t("No zones yet")}
                  hint={t("Add monitoring zones from the site map.")}
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[420px]">
                  <thead>
                    <tr className="border-b border-rule">
                      <th className={thClass}>{t("Zone")}</th>
                      <th className={`${thClass} text-right`}>{t("Flora")}</th>
                      <th className={`${thClass} text-right`}>{t("Soil & water")}</th>
                      <th className={`${thClass} text-right`}>{t("Hazard")}</th>
                      <th className={`${thClass} text-right`}>{t("Total")}</th>
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
                        <td className={tdClass}>{t("No zone")}</td>
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
            title={t("Review queue")}
            hint={pending > 0 ? t("Oldest first") : t("Up to date")}
            bodyClassName="p-0"
          >
            {queue.length === 0 ? (
              <p className="px-4 py-5 text-[13px] text-muted">{t("No records are waiting for review.")}</p>
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
                            {record.zone?.name ?? t("No zone")} · {t("{age} old", { age: ageLabel(t, record.created_at) })}
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
                {isReviewer ? t("Open the queue") : t("View pending records")}
              </Link>
            </div>
          </SectionCard>

          <SectionCard
            title={t("Hazard severity")}
            hint={t("All hazard records")}
            bodyClassName="p-0"
          >
            <RankBars
              data={(["critical", "medium", "low"] as HazardSeverity[]).map((severity) => ({
                label: t(severity[0].toUpperCase() + severity.slice(1)),
                value: bySeverity[severity],
              }))}
              emptyLabel={t("No hazards recorded yet.")}
            />
            {bySeverity.unrated > 0 ? (
              <p className="border-t border-rule px-4 py-2 text-[12px] text-muted">
                {t("{count} hazards without a severity", { count: bySeverity.unrated })}
              </p>
            ) : null}
          </SectionCard>

          <SectionCard title={t("Operational health")} hint={sampleHint} bodyClassName="p-0">
            <ul className="divide-y divide-rule">
              <li className="flex items-start justify-between gap-3 px-4 py-3">
                <span className="text-[13px] text-muted">{t("Open critical hazards")}</span>
                <span className="text-right">
                  <span
                    className={`block text-[15px] font-medium tabular-nums ${
                      openCritical.length > 0 ? "text-negative-ink" : "text-ink"
                    }`}
                  >
                    {openCritical.length}
                  </span>
                  <span className="block text-[11px] text-faint">
                    {oldestOpenCritical
                      ? t("oldest {age}", { age: ageLabel(t, oldestOpenCritical) })
                      : t("None open")}
                  </span>
                </span>
              </li>
              <li className="flex items-start justify-between gap-3 px-4 py-3">
                <span className="text-[13px] text-muted">{t("Reviewed within 24 hours")}</span>
                <span className="text-right">
                  <span className="block text-[15px] font-medium tabular-nums text-ink">
                    {decidedWithinDayPercent === null ? "-" : `${decidedWithinDayPercent}%`}
                  </span>
                  <span className="block text-[11px] text-faint">
                    {t("Based on {count} decided records", { count: decided.length })}
                  </span>
                </span>
              </li>
              <li className="flex items-start justify-between gap-3 px-4 py-3">
                <span className="text-[13px] text-muted">
                  {t("Zones with no submission in 14 days")}
                </span>
                <span className="text-right">
                  <span
                    className={`block text-[15px] font-medium tabular-nums ${
                      idleZones.length > 0 ? "text-warning-ink" : "text-ink"
                    }`}
                  >
                    {idleZones.length}
                  </span>
                  <span className="block max-w-[150px] truncate text-[11px] text-faint">
                    {idleZones.length > 0
                      ? idleZones
                          .slice(0, 2)
                          .map((zone) => zone.name)
                          .join(", ")
                      : t("Every zone reported recently")}
                  </span>
                </span>
              </li>
            </ul>
          </SectionCard>

          <SectionCard
            title={t("Recent submissions")}
            action={
              <Link href="/records" className="text-[12px] font-medium text-accent hover:underline">
                {t("All records")}
              </Link>
            }
            bodyClassName=""
          >
            {recent.length === 0 ? (
              <div className="p-4">
                <EmptyState
                  title={t("No records yet")}
                  hint={t("Records captured in the mobile app appear here once they sync.")}
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
            {t("Last record received {when}.", {
              when: records[0] ? formatDateTime(records[0].created_at) : t("never"),
            })}
          </p>
        </div>
      </div>

      {pending > 0 ? (
        <div className="mt-4 flex items-center gap-2 text-[12px] text-muted lg:hidden">
          <StatusBadge status="pending" />
          <span>{t("{count} records waiting on a decision", { count: pending })}</span>
        </div>
      ) : null}
    </div>
  );
}
