import Link from "next/link";
import { ArrowRight, TriangleAlert } from "lucide-react";
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
} from "@/components/ui";
import { SeverityBadge } from "@/components/Pills";
import { RankBars, StackedBarChart } from "@/components/BarChart";
import { DonutChart } from "@/components/DonutChart";
import { HealthGauge } from "@/components/HealthGauge";
import { MapView } from "@/components/MapView";
import { ReviewDialog } from "@/components/ReviewDialog";
import { RecordRow } from "@/components/RecordRow";
import {
  formatDateTime,
  HAZARD_TYPE_COLORS,
  HAZARD_TYPES,
  SCORE_BAND_COLORS,
  SEVERITY_CHART_COLORS,
  STATUS_CHART_COLORS,
} from "@/lib/format";
import { HEALTH_BAND_LABELS, scoreVillage } from "@/lib/health";
import { getT, type ServerTranslate } from "@/i18n/server";
import type { FieldRecord, HazardSeverity } from "@/lib/types";

const BUCKET = "record-photos";
const TREND_DAYS = 14;

function startOfDay(date: Date): Date {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start;
}

function ageLabel(t: ServerTranslate, iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return t("today");
  if (days === 1) return t("1 day");
  return t("{count} days", { count: days });
}

// An open issue is anything a reviewer still has to act on: a record waiting for
// a decision, or an approved hazard job that has not been finished in the field.
function isOpenIssue(record: FieldRecord): boolean {
  if (record.status === "pending") return true;
  return record.type === "hazard" && record.status === "approved" && !record.completed_at;
}

const BAND_TONES: Record<string, string> = {
  good: "text-positive-ink",
  warning: "text-warning-ink",
  critical: "text-negative-ink",
  unknown: "text-ink",
};

export default async function DashboardPage() {
  const t = await getT();
  const [total, pending, urgentTotal, zones, records, queue, urgent, profile] = await Promise.all([
    countRecords(),
    countRecords({ status: "pending" }),
    countRecords({ status: "pending", severity: "critical" }),
    getZones(),
    queryRecords(),
    getPendingQueue(3),
    getUrgentQueue(3),
    getProfile(),
  ]);

  const isReviewer = profile?.role === "supervisor" || profile?.role === "admin";
  const oldestPending = queue[0]?.created_at ? ageLabel(t, queue[0].created_at) : null;

  // ---- Health -----------------------------------------------------------------
  const health = scoreVillage(records);

  // ---- Activity over the last 14 days, one column per day ----------------------
  const today = startOfDay(new Date());
  const days = Array.from({ length: TREND_DAYS }, (_, index) => {
    const start = new Date(today);
    start.setDate(start.getDate() - (TREND_DAYS - 1 - index));
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { start, end };
  });
  const daily = days.map((day) => {
    const inDay = records.filter((record) => {
      const created = new Date(record.created_at);
      return created >= day.start && created < day.end;
    });
    return {
      label: String(day.start.getDate()),
      segments: [
        {
          label: t("Approved"),
          value: inDay.filter((record) => record.status === "approved").length,
          color: STATUS_CHART_COLORS.approved,
        },
        {
          label: t("Pending review"),
          value: inDay.filter((record) => record.status === "pending").length,
          color: STATUS_CHART_COLORS.pending,
        },
        {
          label: t("Rejected"),
          value: inDay.filter((record) => record.status === "rejected").length,
          color: STATUS_CHART_COLORS.rejected,
        },
      ],
    };
  });
  const dailyTotal = daily.reduce(
    (sum, day) => sum + day.segments.reduce((daySum, segment) => daySum + segment.value, 0),
    0
  );
  const trendRange = `${days[0].start.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  })} - ${days[days.length - 1].start.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  })}`;

  // ---- Zones ------------------------------------------------------------------
  const activeCutoff = Date.now() - TREND_DAYS * 86_400_000;
  const activeZones = zones.filter((zone) =>
    records.some(
      (record) =>
        record.zone_id === zone.id && new Date(record.created_at).getTime() >= activeCutoff
    )
  ).length;
  const idleZones = zones.filter(
    (zone) =>
      !records.some(
        (record) =>
          record.zone_id === zone.id && new Date(record.created_at).getTime() >= activeCutoff
      )
  );

  const zoneRisk = zones
    .map((zone) => ({
      label: zone.name,
      value: records.filter((record) => record.zone_id === zone.id && isOpenIssue(record)).length,
      href: `/records?zone=${zone.id}`,
    }))
    .sort((a, b) => b.value - a.value);
  const unzonedOpen = records.filter((record) => !record.zone_id && isOpenIssue(record)).length;
  if (unzonedOpen > 0) {
    zoneRisk.push({ label: t("No zone"), value: unzonedOpen, href: "/records" });
  }
  const openIssuesTotal = zoneRisk.reduce((sum, zone) => sum + zone.value, 0);

  // ---- Hazard mix -------------------------------------------------------------
  const hazards = records.filter((record) => record.type === "hazard");
  const byCategory = HAZARD_TYPES.map((name) => ({
    label: t(name),
    value: hazards.filter((record) => record.hazard_type === name).length,
    color: HAZARD_TYPE_COLORS[name] ?? "#9CA3A0",
  }));
  const uncategorisedHazards = hazards.filter((record) => !record.hazard_type).length;
  if (uncategorisedHazards > 0) {
    byCategory.push({
      label: t("No category"),
      value: uncategorisedHazards,
      color: "#9CA3A0",
    });
  }
  const severityCounts: Record<HazardSeverity | "unrated", number> = {
    low: 0,
    medium: 0,
    critical: 0,
    unrated: 0,
  };
  for (const record of hazards) severityCounts[record.severity ?? "unrated"] += 1;

  // ---- Triage and the map -----------------------------------------------------
  const openCritical = records.filter(
    (record) =>
      record.type === "hazard" &&
      record.severity === "critical" &&
      record.status !== "rejected" &&
      !record.completed_at
  );
  const openCriticalIds = new Set(openCritical.map((record) => record.id));
  const oldestOpenCritical = openCritical.at(-1)?.created_at ?? null;

  // Every open critical hazard earns a pin; recent submissions fill the rest, so
  // the pulse count on the map is always the whole truth.
  const geotagged = records.filter(
    (record) => record.latitude != null && record.longitude != null
  );
  const markerRecords = [
    ...geotagged.filter((record) => openCriticalIds.has(record.id)),
    ...geotagged.filter((record) => !openCriticalIds.has(record.id)),
  ].slice(0, 12);
  const mapMarkers = markerRecords
    .map((record) => ({
      id: record.id,
      lat: record.latitude as number,
      lng: record.longitude as number,
      color: record.type === "hazard" ? "#C4242A" : "#1F6B4A",
      label: record.title,
      sub: `${record.zone?.name ?? t("No zone")} · ${ageLabel(t, record.created_at)}`,
      href: `/records/${record.id}`,
      pulse: openCriticalIds.has(record.id),
    }));
  const pulsingOnMap = mapMarkers.filter((marker) => marker.pulse).length;
  const mapZones = zones.map((zone) => ({
    id: zone.id,
    lat: zone.center_lat,
    lng: zone.center_lng,
    radius: zone.radius_m,
    color: zone.color,
    name: zone.name,
    records: records.filter((record) => record.zone_id === zone.id).length,
  }));

  // ---- Review speed -----------------------------------------------------------
  const decided = records.filter((record) => record.reviewed_at);
  const decidedWithinDay = decided.filter(
    (record) =>
      new Date(record.reviewed_at as string).getTime() - new Date(record.created_at).getTime() <=
      86_400_000
  );
  const decidedWithinDayPercent = decided.length
    ? Math.round((decidedWithinDay.length / decided.length) * 100)
    : null;

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
              <li key={record.id} className="flex items-center gap-3 px-4 py-3">
                <Link
                  href={`/records/${record.id}`}
                  className="flex min-w-0 flex-1 items-center gap-3"
                >
                  {photoUrl(record.photos?.[0]) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={photoUrl(record.photos?.[0]) as string}
                      alt=""
                      className="h-11 w-11 shrink-0 rounded-[8px] object-cover"
                    />
                  ) : (
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[8px] bg-hazard-soft text-hazard">
                      <TriangleAlert className="h-5 w-5" strokeWidth={1.7} />
                    </span>
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
                </Link>
                {/* The list is critical-only, so the badge adds nothing on a phone. */}
                <span className="hidden sm:block">
                  <SeverityBadge severity={record.severity} />
                </span>
                {isReviewer ? (
                  <ReviewDialog
                    record={{
                      id: record.id,
                      title: record.title,
                      zoneName: record.zone?.name ?? null,
                      severity: record.severity,
                      notes: record.notes,
                      photoUrl: photoUrl(record.photos?.[0]),
                      ageLabel: t("{age} old", { age: ageLabel(t, record.created_at) }),
                    }}
                  />
                ) : (
                  <Link
                    href={`/records/${record.id}`}
                    className="shrink-0 text-[12px] font-medium text-accent hover:underline"
                  >
                    {t("Open")}
                  </Link>
                )}
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
        <Stat
          label={t("Active zones")}
          value={activeZones}
          hint={t("of {total} zones", { total: zones.length })}
        />
        <Stat
          label={t("Village health")}
          value={health.score === null ? "-" : `${health.score}/100`}
          hint={t(HEALTH_BAND_LABELS[health.band])}
          tone={BAND_TONES[health.band]}
        />
        <Stat
          label={t("Open critical hazards")}
          value={openCritical.length}
          hint={oldestOpenCritical ? t("oldest {age}", { age: ageLabel(t, oldestOpenCritical) }) : t("None open")}
          tone={openCritical.length > 0 ? "text-negative-ink" : "text-ink"}
          className="col-span-2 sm:col-span-1"
        />
      </StatStrip>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          <SectionCard
            title={t("Submissions per day")}
            hint={t("Records created in the last 14 days")}
            action={<span className="text-[12px] text-muted">{t("{count} total", { count: dailyTotal })}</span>}
          >
            <StackedBarChart data={daily} height={180} unit={t("records")} labelStep={2} />
            <p className="mt-1 text-[11px] text-faint">{trendRange}</p>
          </SectionCard>

          <SectionCard
            title={t("Hazard distribution")}
            hint={t("The five hazard types recorded")}
            bodyClassName=""
          >
            <DonutChart
              data={byCategory}
              centerValue={hazards.length}
              centerLabel={t("hazards")}
              unit={t("hazards")}
              emptyLabel={t("No hazards recorded yet.")}
            />
            <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-rule px-4 py-2.5">
              {(["critical", "medium", "low"] as HazardSeverity[]).map((severity) => (
                <li
                  key={severity}
                  className="flex items-center gap-1.5 text-[11px] text-muted"
                  title={`${t(severity[0].toUpperCase() + severity.slice(1))}: ${severityCounts[severity]}`}
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: SEVERITY_CHART_COLORS[severity] }}
                    aria-hidden="true"
                  />
                  {t(severity[0].toUpperCase() + severity.slice(1))}
                  <span className="tabular-nums text-ink">{severityCounts[severity]}</span>
                </li>
              ))}
              {severityCounts.unrated > 0 ? (
                <li className="text-[11px] text-muted">
                  {t("{count} hazards without a severity", { count: severityCounts.unrated })}
                </li>
              ) : null}
            </ul>
          </SectionCard>

          <SectionCard
            title={t("Site map")}
            hint={t("Every open critical hazard, plus the latest submissions")}
            bodyClassName="p-0"
            action={
              <Link
                href="/map"
                className="inline-flex items-center gap-1 text-[12px] font-medium text-accent hover:underline"
              >
                {t("Expand")}
                <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.8} />
              </Link>
            }
          >
            <div className="h-[280px] overflow-hidden">
              <MapView
                markers={mapMarkers}
                zones={mapZones}
                height={280}
                fitZones
                scrollWheelZoom={false}
              />
            </div>
            {pulsingOnMap > 0 ? (
              <p className="flex items-center gap-1.5 border-t border-rule px-4 py-2 text-[11px] text-muted">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: SCORE_BAND_COLORS.critical }}
                  aria-hidden="true"
                />
                {pulsingOnMap === 1
                  ? t("1 open critical hazard pulses on the map")
                  : t("{count} open critical hazards pulse on the map", {
                      count: pulsingOnMap,
                    })}
              </p>
            ) : null}
          </SectionCard>
        </div>

        <div className="space-y-4">
          <SectionCard title={t("Village health")}>
            <HealthGauge result={health} t={t} />
          </SectionCard>

          <SectionCard
            title={t("Review queue")}
            hint={pending > 0 ? t("Oldest first") : t("Up to date")}
            bodyClassName="p-0"
          >
            {queue.length === 0 ? (
              <p className="px-4 py-5 text-[13px] text-muted">
                {t("No records are waiting for review.")}
              </p>
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
                            {record.zone?.name ?? t("No zone")} ·{" "}
                            {t("{age} old", { age: ageLabel(t, record.created_at) })}
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

          <SectionCard title={t("Operational health")} bodyClassName="p-0">
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
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SectionCard
          title={t("Open issues per zone")}
          hint={t("Pending reviews plus approved hazards that are not finished yet")}
          bodyClassName="pt-1"
          action={
            <span className="text-[12px] text-muted">
              {t("{count} open", { count: openIssuesTotal })}
            </span>
          }
        >
          <RankBars data={zoneRisk} emptyLabel={t("No open issues. Every zone is clear.")} />
        </SectionCard>

        <SectionCard
          title={t("Recent submissions")}
          action={
            <Link href="/records" className="text-[12px] font-medium text-accent hover:underline">
              {t("All records")}
            </Link>
          }
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
                <RecordRow
                  key={record.id}
                  record={record}
                  photoUrl={photoUrl(record.photos?.[0])}
                />
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      <p className="mt-3 px-1 text-[12px] leading-relaxed text-muted">
        {t("Last record received {when}.", {
          when: records[0] ? formatDateTime(records[0].created_at) : t("never"),
        })}
      </p>
    </div>
  );
}
