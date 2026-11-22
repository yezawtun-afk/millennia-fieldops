import Link from "next/link";
import { ArrowRight, Check, TriangleAlert } from "lucide-react";
import {
  countRecords,
  countRemediation,
  getPendingQueue,
  getUrgentQueue,
  getVerificationQueue,
  getZones,
  queryRecords,
} from "@/lib/data";
import { getProfile } from "@/lib/supabase/server";
import { signPhotoUrls, stripBucket } from "@/lib/photos";
import {
  Kpi,
  KpiBadge,
  KpiStrip,
  PageHeader,
  SectionCard,
  btnPrimary,
} from "@/components/ui";
import { DonutChart } from "@/components/DonutChart";
import { MapView } from "@/components/MapView";
import { ReviewDialog } from "@/components/ReviewDialog";
import { FreshRow } from "@/components/FreshRow";
import { FreshRows } from "@/components/FreshRows";
import { HealthBreakdown } from "@/components/overview/HealthBreakdown";
import { MarkFixedButton } from "@/components/overview/MarkFixedButton";
import { RemediationQueue } from "@/components/overview/RemediationQueue";
import { ScoreInfo } from "@/components/overview/ScoreInfo";
import { WeekBars } from "@/components/overview/WeekBars";
import { ZoneBoard, type ZoneRow } from "@/components/overview/ZoneBoard";
import {
  HAZARD_MIX_RAMP,
  HAZARD_TYPES,
  MAP_MARKER_COLORS,
  SEVERITY_CHART_COLORS,
  SEVERITY_LABELS,
  TYPE_CHART_COLORS,
  UNCATEGORISED_COLOR,
  formatDateTime,
} from "@/lib/format";
import { HEALTH_BAND_LABELS, WATER_THRESHOLDS, scoreVillage } from "@/lib/health";
import { getLocale, getT, type ServerTranslate } from "@/i18n/server";
import type { FieldRecord } from "@/lib/types";

const BUCKET = "record-photos";
const WEEK_DAYS = 7;
const QUIET_DAYS = 14;

// The weekday labels and the day arithmetic follow the chosen language, not the
// server's locale, so a Malay reader sees "Is" rather than "Mon".
const LOCALE_TAGS: Record<string, string> = { en: "en-GB", ms: "ms-MY", zh: "zh-CN" };

function startOfDay(date: Date): Date {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start;
}

// Compact elapsed time: "12m", "3h 12m", "2d 5h", "83d". Minutes are dropped
// after the first hour, but hours are kept for the first week so "when was the
// last report?" is never rounded away to a bare day.
function elapsedLabel(t: ServerTranslate, iso: string): string {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60_000));
  if (minutes < 1) return t("Just now");
  if (minutes < 60) return t("{count}m", { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    const rest = minutes % 60;
    return rest > 0
      ? t("{hours}h {minutes}m", { hours, minutes: rest })
      : t("{count}h", { count: hours });
  }
  const days = Math.floor(hours / 24);
  const restHours = hours % 24;
  if (days < 7 && restHours > 0) {
    return t("{days}d {hours}h", { days, hours: restHours });
  }
  return t("{count}d", { count: days });
}

function agoLabel(t: ServerTranslate, iso: string): string {
  const elapsed = elapsedLabel(t, iso);
  return elapsed === t("Just now") ? elapsed : t("{age} ago", { age: elapsed });
}

function ageLabel(t: ServerTranslate, iso: string): string {
  const elapsed = elapsedLabel(t, iso);
  return elapsed === t("Just now") ? elapsed : t("{age} old", { age: elapsed });
}

// An open issue is anything a reviewer still has to act on: a record waiting for
// a decision, or an approved hazard job that has not been closed. A fixed but
// unverified job is still open: the score does not move until it is closed.
function isOpenIssue(record: FieldRecord): boolean {
  if (record.status === "pending") return true;
  return record.type === "hazard" && record.status === "approved" && !record.closed_at;
}

const BAND_BADGE: Record<string, "neutral" | "warning" | "negative" | "positive"> = {
  good: "positive",
  warning: "warning",
  critical: "negative",
  unknown: "neutral",
};

// The comparison always names its baseline: "3 more than last week", never a
// bare "+3". Two empty weeks are not a change.
function deltaLabel(t: ServerTranslate, current: number, previous: number): string {
  if (previous === 0) return current === 0 ? t("nothing this week") : t("new this week");
  if (current === previous) return t("level with last week");
  if (current > previous) {
    return t("{count} more than last week", { count: current - previous });
  }
  return t("{count} fewer than last week", { count: previous - current });
}

export default async function DashboardPage() {
  const [
    t,
    locale,
    total,
    pending,
    urgentTotal,
    zones,
    records,
    queue,
    urgent,
    profile,
    repairs,
    verification,
  ] = await Promise.all([
    getT(),
    getLocale(),
    countRecords(),
    countRecords({ status: "pending" }),
    countRecords({ status: "pending", severity: "critical" }),
    getZones(),
    queryRecords(),
    getPendingQueue(3),
    getUrgentQueue(3),
    getProfile(),
    countRemediation(),
    getVerificationQueue(3),
  ]);

  const isReviewer = profile?.role === "supervisor" || profile?.role === "admin";
  const oldestPending = queue[0]?.created_at ? elapsedLabel(t, queue[0].created_at) : null;
  const dayTag = LOCALE_TAGS[locale] ?? "en-GB";

  // ---- Health -----------------------------------------------------------------
  const health = scoreVillage(records);

  // ---- Seven days of submissions, and the week before for the delta ------------
  const today = startOfDay(new Date());
  const days = Array.from({ length: WEEK_DAYS }, (_, index) => {
    const start = new Date(today);
    start.setDate(start.getDate() - (WEEK_DAYS - 1 - index));
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { start, end };
  });
  const countBetween = (from: Date, to: Date) =>
    records.filter((record) => {
      const created = new Date(record.created_at);
      return created >= from && created < to;
    }).length;

  const week = days.map((day, index) => ({
    label: day.start.toLocaleDateString(dayTag, { weekday: "short" }),
    value: countBetween(day.start, day.end),
    today: index === WEEK_DAYS - 1,
  }));
  const thisWeek = week.reduce((sum, day) => sum + day.value, 0);

  const priorStart = new Date(today);
  priorStart.setDate(priorStart.getDate() - WEEK_DAYS * 2);
  const priorEnd = new Date(today);
  priorEnd.setDate(priorEnd.getDate() - WEEK_DAYS);
  const lastWeek = countBetween(priorStart, priorEnd);

  const weekDelta = deltaLabel(t, thisWeek, lastWeek);
  // ---- Zones ------------------------------------------------------------------
  const quietCutoff = Date.now() - QUIET_DAYS * 86_400_000;
  const zoneRows: ZoneRow[] = zones
    .map((zone) => {
      const zoneRecords = records.filter((record) => record.zone_id === zone.id);
      const last = zoneRecords[0]?.created_at ?? null;
      return {
        id: zone.id,
        name: zone.name,
        color: zone.color,
        open: zoneRecords.filter(isOpenIssue).length,
        lastLabel: last ? t("Last report {when}", { when: agoLabel(t, last) }) : t("No report yet"),
        idle: !last || new Date(last).getTime() < quietCutoff,
      };
    })
    .sort((a, b) => b.open - a.open || a.name.localeCompare(b.name));

  const activeZones = zoneRows.filter((row) => !row.idle).length;
  const quietZones = zones.length - activeZones;
  const openIssuesTotal = zoneRows.reduce((sum, zone) => sum + zone.open, 0);

  // ---- Hazard mix -------------------------------------------------------------
  // A rejected record is not a hazard (the same rule the health score uses), so
  // the ring, the severity strip and the KPI all count the same 18 records.
  const hazards = records.filter(
    (record) => record.type === "hazard" && record.status !== "rejected"
  );
  // Ranked biggest-share-first, so the darkest ink is always the category that
  // dominates the mix; an uncategorised remainder stays pale and last in tone.
  const categoryCounts = HAZARD_TYPES.map((name) => ({
    label: t(name),
    value: hazards.filter((record) => record.hazard_type === name).length,
    uncategorised: false,
  })).filter((slice) => slice.value > 0);
  const uncategorisedHazards = hazards.filter((record) => !record.hazard_type).length;
  if (uncategorisedHazards > 0) {
    categoryCounts.push({
      label: t("No category"),
      value: uncategorisedHazards,
      uncategorised: true,
    });
  }
  let rampStep = 0;
  const byCategory = categoryCounts
    .sort((a, b) => b.value - a.value)
    .map((slice) => ({
      label: slice.label,
      value: slice.value,
      color: slice.uncategorised
        ? UNCATEGORISED_COLOR
        : HAZARD_MIX_RAMP[Math.min(rampStep++, HAZARD_MIX_RAMP.length - 1)],
    }));

  // The second cut of the same records: how bad they are. A hazard with no
  // severity yet is shown rather than hidden, so the strip adds up to the ring.
  const bySeverity = (["critical", "medium", "low"] as const)
    .map((severity) => ({
      label: t(SEVERITY_LABELS[severity]),
      value: hazards.filter((record) => record.severity === severity).length,
      color: SEVERITY_CHART_COLORS[severity],
    }))
    .filter((slice) => slice.value > 0);
  const unratedHazards = hazards.filter((record) => !record.severity).length;
  const ratedHazards = hazards.length - unratedHazards;
  if (unratedHazards > 0) {
    bySeverity.push({
      label: t("No severity"),
      value: unratedHazards,
      color: UNCATEGORISED_COLOR,
    });
  }

  // ---- Triage and the map -----------------------------------------------------
  const openCritical = records.filter(
    (record) =>
      record.type === "hazard" &&
      record.severity === "critical" &&
      record.status !== "rejected" &&
      !record.completed_at
  );
  const openCriticalIds = new Set(openCritical.map((record) => record.id));

  // The panel leads with critical hazards; if there are none it falls back to the
  // oldest records still waiting, so the block is never empty while work exists.
  const triage = urgent.length > 0 ? urgent : queue;
  const triageIsCritical = urgent.length > 0;

  // The block shows at most two review rows, so the subtitle says what it is
  // leaving out rather than implying two rows are the whole queue.
  const reviewShown = Math.min(triage.length, 2);
  const triageHint =
    reviewShown === 0
      ? ""
      : triageIsCritical
        ? urgentTotal > reviewShown
          ? t("Showing {shown} of {total} critical hazards", {
              shown: reviewShown,
              total: urgentTotal,
            })
          : t("{count} critical hazards need a decision", { count: urgentTotal })
        : pending > reviewShown
          ? t("Showing {shown} of {total} records waiting", {
              shown: reviewShown,
              total: pending,
            })
          : t("{count} records need a decision", { count: pending });

  // Every open critical hazard earns a pin; recent submissions fill the rest, so
  // the pulse count on the map is always the whole truth.
  const geotagged = records.filter(
    (record) => record.latitude != null && record.longitude != null
  );
  const markerRecords = [
    ...geotagged.filter((record) => openCriticalIds.has(record.id)),
    ...geotagged.filter((record) => !openCriticalIds.has(record.id)),
  ].slice(0, 12);
  const mapMarkers = markerRecords.map((record) => ({
    id: record.id,
    lat: record.latitude as number,
    lng: record.longitude as number,
    // The same three type hues as the Site map page; severity is carried by the
    // pulse and the legend, so the two maps never disagree.
    color: MAP_MARKER_COLORS[record.type],
    label: record.title,
    sub: `${record.zone?.name ?? t("No zone")} · ${elapsedLabel(t, record.created_at)}`,
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

  // Two sets of photos are signed on the server: the first photo of each record
  // in the review queue, and the after photo of each fix waiting to be checked.
  // "Mark fixed" shows that evidence in its dialog, so closing a job never asks
  // a supervisor to trust a thumbnail.
  const signed = await signPhotoUrls([
    ...triage.flatMap((record) => (record.photos?.[0] ? [record.photos[0]] : [])),
    ...verification.flatMap((record) =>
      record.completion_photos?.[0] ? [record.completion_photos[0]] : []
    ),
  ]);
  const photoUrl = (path: string | undefined) => {
    if (!path) return null;
    if (path.startsWith("http")) return path;
    return signed[`${BUCKET}/${stripBucket(path)}`] ?? null;
  };

  // What sits in "Waiting on you": fixes the supervisor can close right now,
  // then the review queue. Two of each, so neither kind can crowd out the other
  // (the header still shows the true totals, and "View all" reaches the rest).
  const waiting = [
    ...verification.slice(0, 2).map((record) => ({ record, kind: "verify" as const })),
    ...triage.slice(0, 2).map((record) => ({ record, kind: "review" as const })),
  ];

  // The review sentence above only counts decisions; a fix that is waiting to
  // be checked is also work the supervisor is holding, so it is named too.
  const verifyShort =
    repairs.awaiting === 1
      ? t("1 fix to verify")
      : t("{count} fixes to verify", { count: repairs.awaiting });
  const verifyLong =
    repairs.awaiting === 1
      ? t("1 fix waiting for verification")
      : t("{count} fixes waiting for verification", { count: repairs.awaiting });
  const waitingHint =
    repairs.awaiting > 0
      ? triageHint
        ? `${triageHint} · ${verifyShort}`
        : verifyLong
      : triageHint;

  // The sentence that used to sit under the score as fine print, kept word for
  // word but moved behind the [?] in the card header.
  const scoreHelp = t(
    "Every term is a rate, so a bigger village is never punished for having more records. Only pH and turbidity can be judged without a local baseline: pH {min}-{max}, turbidity up to {turbidity} NTU.",
    {
      min: WATER_THRESHOLDS.phMin,
      max: WATER_THRESHOLDS.phMax,
      turbidity: WATER_THRESHOLDS.turbidityMaxNtu,
    }
  );

  const finding =
    pending > 0
      ? `${t("{count} records waiting on a decision", { count: pending })}${
          oldestPending ? t(", the oldest for {age}", { age: oldestPending }) : ""
        }.`
      : t("Nothing is waiting for review. Everything captured has a decision.");

  const lastRecord = records[0]?.created_at ?? null;

  return (
    <div>
      <PageHeader
        title={t("Overview")}
        subtitle={finding}
        actions={
          <>
            <span
              className="hidden items-center gap-1.5 text-[11px] text-faint tabular-nums sm:inline-flex"
              title={lastRecord ? formatDateTime(lastRecord) : undefined}
            >
              {lastRecord ? t("Last record {when}", { when: agoLabel(t, lastRecord) }) : t("No records yet")}
            </span>
            {pending > 0 ? (
              <Link href="/records?status=pending" className={btnPrimary}>
                {isReviewer ? t("Review pending") : t("View pending")}
                <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
              </Link>
            ) : null}
          </>
        }
      />

      <KpiStrip>
        <Kpi
          label={t("Records")}
          value={total.toLocaleString("en-GB")}
          sub={weekDelta}
          href="/records"
        />
        <Kpi
          label={t("Waiting review")}
          value={pending}
          sub={oldestPending ? t("oldest waiting {age}", { age: oldestPending }) : t("Nothing waiting")}
          href="/records?status=pending"
        />
        <Kpi
          label={t("Zones reporting")}
          value={activeZones}
          unit={t("of {total} zones", { total: zones.length })}
          sub={
            quietZones > 0
              ? t("{count} quiet for {days} days", { count: quietZones, days: QUIET_DAYS })
              : t("Every zone reported this week")
          }
          href="/map"
        />
        <Kpi
          label={t("Village health")}
          value={health.score}
          unit="/100"
          badge={
            <KpiBadge tone={BAND_BADGE[health.band] ?? "neutral"}>
              {t(HEALTH_BAND_LABELS[health.band])}
            </KpiBadge>
          }
          sub={t("{open} critical of {total} rated", {
            open: health.inputs.openCritical,
            total: health.inputs.hazards,
          })}
          href="/records?type=hazard"
        />
      </KpiStrip>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.75fr)_minmax(0,1fr)]">
        <SectionCard
          title={t("Submissions")}
          hint={t("Records received in the last {days} days", { days: WEEK_DAYS })}
          action={
            <span className="whitespace-nowrap num text-[12px] text-muted">
              {thisWeek}
              <span className="ml-1.5 font-sans text-[11px] text-faint">{t("this week")}</span>
            </span>
          }
        >
          <WeekBars
            data={week}
            height={168}
            unit={t("records")}
            emptyLabel={t("Nothing has been submitted in the last seven days.")}
          />
        </SectionCard>

        {/* The one block with a job in it: its rows stretch to close the row.
            Each row carries the action that retires it, so a fix can be closed
            and a pending record reviewed without opening anything else. */}
        <section className="flex h-full flex-col rounded-card border border-line bg-sheet">
          <header className="flex items-start justify-between gap-3 border-b border-rule px-4 py-3">
            <div className="min-w-0">
              <h2 className="text-[14px] font-semibold leading-5 text-ink">{t("Waiting on you")}</h2>
              <p className="mt-0.5 text-[12px] leading-snug text-muted">{waitingHint}</p>
            </div>
            {pending > 0 || repairs.awaiting > 0 ? (
              <Link
                href={pending > 0 ? "/records?status=pending" : "/records?completion=verify"}
                className="shrink-0 whitespace-nowrap text-[12px] font-medium text-accent hover:underline"
              >
                {t("View all")}
              </Link>
            ) : null}
          </header>

          {waiting.length === 0 ? (
            <div className="flex flex-1 items-center px-4 py-6">
              <p className="text-[13px] text-muted">
                {t("Nothing is waiting for review. Everything captured has a decision.")}
              </p>
            </div>
          ) : (
            <FreshRows ids={waiting.map((row) => row.record.id)}>
              <ul className="flex flex-1 flex-col divide-y divide-rule">
                {waiting.map(({ record, kind }) => {
                  const isFix = kind === "verify";
                  // A fix shows the after photo: it is the evidence for closing.
                  const photo = isFix
                    ? (photoUrl(record.completion_photos?.[0]) ?? photoUrl(record.photos?.[0]))
                    : photoUrl(record.photos?.[0]);
                  const finishedLabel = record.completed_at
                    ? agoLabel(t, record.completed_at)
                    : "";

                  return (
                    <li key={record.id} className="flex flex-1 flex-col">
                      <FreshRow id={record.id} className="flex flex-1 items-center gap-3 px-4 py-3">
                        <Link
                          href={`/records/${record.id}`}
                          className="flex min-w-0 flex-1 items-center gap-3"
                        >
                          {photo ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={photo}
                              alt=""
                              className="h-10 w-10 shrink-0 rounded-[6px] border border-line object-cover"
                            />
                          ) : (
                            <span
                              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[6px] ${
                                isFix
                                  ? "bg-positive-soft text-positive-ink"
                                  : "bg-negative-soft text-negative-ink"
                              }`}
                            >
                              {isFix ? (
                                <Check className="h-[18px] w-[18px]" strokeWidth={2} />
                              ) : (
                                <TriangleAlert className="h-[18px] w-[18px]" strokeWidth={1.7} />
                              )}
                            </span>
                          )}
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13px] font-medium leading-5 text-ink">
                              {record.title}
                            </span>
                            <span className="mt-0.5 block truncate text-[11px] leading-4 text-faint">
                              {isFix
                                ? t("Fixed {when} by {name}", {
                                    when: finishedLabel,
                                    name: record.completer?.full_name ?? t("a field worker"),
                                  })
                                : `${record.zone?.name ?? t("No zone")} · ${ageLabel(
                                    t,
                                    record.created_at
                                  )}`}
                            </span>
                          </span>
                        </Link>
                        {isReviewer ? (
                          isFix ? (
                            <MarkFixedButton
                              recordId={record.id}
                              title={record.title}
                              worker={record.completer?.full_name ?? null}
                              finishedLabel={finishedLabel}
                              photoUrl={photo}
                            />
                          ) : (
                            <ReviewDialog
                              tone={triageIsCritical ? "critical" : "neutral"}
                              record={{
                                id: record.id,
                                title: record.title,
                                zoneName: record.zone?.name ?? null,
                                severity: record.severity,
                                notes: record.notes,
                                photoUrl: photo,
                                ageLabel: ageLabel(t, record.created_at),
                              }}
                            />
                          )
                        ) : (
                          <Link
                            href={`/records/${record.id}`}
                            className="shrink-0 text-[12px] font-medium text-accent hover:underline"
                          >
                            {t("Open")}
                          </Link>
                        )}
                      </FreshRow>
                    </li>
                  );
                })}
              </ul>
            </FreshRows>
          )}
        </section>
      </div>

      {isReviewer ? (
        <div className="mt-4">
          <SectionCard
            title={t("Remediation")}
            hint={t("Work in the field, and fixes waiting for your decision")}
            bodyClassName="p-0"
            action={
              <Link
                href="/records?completion=verify"
                className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-[12px] font-medium text-accent hover:underline"
              >
                {t("Review fixes")}
                <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.8} />
              </Link>
            }
          >
            <RemediationQueue
              toAssign={repairs.unassigned}
              inProgress={repairs.assigned}
              awaiting={repairs.awaiting}
              overdue={repairs.overdue}
              t={t}
            />
          </SectionCard>
        </div>
      ) : null}

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="flex h-full flex-col rounded-card border border-line bg-sheet">
          <header className="flex items-start justify-between gap-3 border-b border-rule px-4 py-3">
            <div className="min-w-0">
              <h2 className="text-[14px] font-semibold leading-5 text-ink">{t("Site map")}</h2>
              <p className="mt-0.5 text-[12px] leading-snug text-muted">
                {t("{zones} zones and {pins} pins", { zones: mapZones.length, pins: mapMarkers.length })}
              </p>
            </div>
            <Link
              href="/map"
              className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-[12px] font-medium text-accent hover:underline"
            >
              {t("Open map")}
              <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.8} />
            </Link>
          </header>
          <div className="relative min-h-[240px] flex-1 overflow-hidden">
            <div className="absolute inset-0">
              <MapView
                markers={mapMarkers}
                zones={mapZones}
                height="100%"
                fitZones
                scrollWheelZoom={false}
              />
            </div>
          </div>
          <p className="flex items-center gap-2 border-t border-rule px-4 py-2 text-[11px] text-muted">
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: SEVERITY_CHART_COLORS.critical }}
              aria-hidden="true"
            />
            {pulsingOnMap === 1
              ? t("1 open critical hazard pulses on the map")
              : t("{count} open critical hazards pulse on the map", { count: pulsingOnMap })}
          </p>
        </section>

        <SectionCard
          title={t("How the score reads")}
          hint={t("What takes points away")}
          bodyClassName="p-0"
          action={<ScoreInfo label={t("How the score reads")} body={scoreHelp} />}
        >
          <HealthBreakdown
            result={health}
            review={{ percent: decidedWithinDayPercent, decided: decided.length }}
            t={t}
          />
        </SectionCard>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SectionCard
          title={t("Zones")}
          hint={t("Open issues and the last report from each zone")}
          bodyClassName="p-0"
          action={
            <span className="whitespace-nowrap num text-[12px] text-muted">
              {openIssuesTotal}
              <span className="ml-1.5 font-sans text-[11px] text-faint">{t("open")}</span>
            </span>
          }
        >
          <ZoneBoard rows={zoneRows} t={t} emptyLabel={t("No zones are drawn on the map yet.")} />
        </SectionCard>

        <SectionCard
          title={t("Hazard mix")}
          hint={t("By category, most common first")}
          bodyClassName="p-0"
          action={
            <span className="whitespace-nowrap num text-[12px] text-muted">
              {hazards.length}
              <span className="ml-1.5 font-sans text-[11px] text-faint">{t("hazards")}</span>
            </span>
          }
        >
          <DonutChart
            data={byCategory}
            centerValue={hazards.length}
            centerLabel={t("hazards")}
            unit={t("hazards")}
            emptyLabel={t("No hazards recorded yet.")}
            size={160}
          />

          {hazards.length > 0 ? (
            <div className="border-t border-rule px-4 py-3">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-[12px] text-muted">{t("How bad they are")}</p>
                <p className="num text-[11px] text-faint">
                  {ratedHazards} / {hazards.length} {t("rated")}
                </p>
              </div>

              <div className="mt-2 flex h-[6px] gap-[2px] overflow-hidden rounded-full bg-panel">
                {bySeverity.map((slice) => (
                  <span
                    key={slice.label}
                    style={{
                      background: slice.color,
                      width: `${(slice.value / hazards.length) * 100}%`,
                    }}
                    title={`${slice.label}: ${slice.value}`}
                    aria-hidden="true"
                  />
                ))}
              </div>

              <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] leading-4">
                {bySeverity.map((slice) => (
                  <li key={slice.label} className="flex items-center gap-1.5">
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ background: slice.color }}
                      aria-hidden="true"
                    />
                    <span className="text-muted">{slice.label}</span>
                    <span className="num text-ink">{slice.value}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </SectionCard>
      </div>

      {/* The overview stops at the trends; the full list lives on its own page
          (the sidebar's Records), so the end here is one door to it rather than
          five rows that only repeat that page. */}
      <Link
        href="/records"
        className="mt-4 flex items-center justify-between gap-3 rounded-card border border-line bg-sheet px-4 py-3 text-[13px] font-medium text-ink transition-colors hover:border-control hover:bg-panel"
      >
        <span>{t("View all {count} records", { count: total.toLocaleString("en-GB") })}</span>
        <ArrowRight className="h-4 w-4 shrink-0 text-accent" strokeWidth={1.8} />
      </Link>
    </div>
  );
}
