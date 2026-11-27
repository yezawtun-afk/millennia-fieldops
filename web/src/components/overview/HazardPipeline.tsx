// The hazard pipeline: one funnel and five threat cards, replacing the old
// category donut. A supervisor does not need to know what share of hazards are
// "Silt runoff"; they need to know which threat is stuck, and where. Every
// hazard sits in exactly one stage, so the five counts add up to the total.
import Link from "next/link";
import type { HazardSeverity } from "@/lib/types";
import { SEVERITY_CHART_COLORS, SEVERITY_LABELS } from "@/lib/format";
import type { ServerTranslate } from "@/i18n/server";

export type PipelineStage = "pending" | "toAssign" | "inRepair" | "verify" | "closed";

export interface PipelineStageRow {
  key: PipelineStage;
  value: number;
  /** The records page, already narrowed to this stage. */
  href: string;
}

export interface PipelineTypeRow {
  key: string;
  /** The English source name, translated inside the component. */
  name: string;
  total: number;
  /** Approved and not yet closed: the hazards that can still hurt someone. */
  open: number;
  critical: number;
  /** The worst severity still open, or null when nothing is open. */
  worst: HazardSeverity | null;
  closed: number;
  /** The zone holding most of this type's open hazards. */
  zone: string | null;
  extraZones: number;
  uncategorised?: boolean;
}

// Neutral -> amber -> deep green as work progresses. The amber is the one stage
// that is waiting on the supervisor, so it is the only warm segment.
const STAGE_CLASS: Record<PipelineStage, string> = {
  pending: "bg-control",
  toAssign: "bg-warning/70",
  inRepair: "bg-accent/40",
  verify: "bg-accent/70",
  closed: "bg-accent",
};

const STAGE_LABELS: Record<PipelineStage, string> = {
  pending: "Awaiting review",
  toAssign: "To assign",
  inRepair: "In repair",
  verify: "To verify",
  closed: "Closed",
};

export function HazardPipeline({
  stages,
  rows,
  total,
  overdue,
  t,
}: {
  stages: PipelineStageRow[];
  rows: PipelineTypeRow[];
  total: number;
  /** Jobs past their due date; 0 for anyone who cannot act on them. */
  overdue: number;
  t: ServerTranslate;
}) {
  if (total === 0) {
    return <p className="px-4 py-6 text-[13px] text-muted">{t("No hazards recorded yet.")}</p>;
  }

  const share = (value: number) => `${(value / total) * 100}%`;

  // The three counts a supervisor acts on, and the two that are context.
  const workStages: PipelineStage[] = ["toAssign", "inRepair", "verify"];
  const contextStages: PipelineStage[] = ["pending", "closed"];
  const stageByKey = (key: PipelineStage) => stages.find((stage) => stage.key === key);

  return (
    <div>
      {/* The old remediation strip's numbers, kept at the size they read at.
          "Awaiting review" and "Closed" say what the whole loop holds, not what
          to do next, so they sit small under the bar. */}
      <div className="grid grid-cols-3 divide-x divide-rule border-b border-rule">
        {workStages.map((key) => {
          const stage = stageByKey(key);
          if (!stage) return null;
          return (
            <Link
              key={key}
              href={stage.href}
              className="block px-4 py-3 transition-colors hover:bg-panel"
            >
              <span className="num block text-[22px] font-semibold leading-none tracking-[-0.02em] text-ink">
                {stage.value}
              </span>
              <span className="mt-1 block text-[11px] leading-4 text-muted">
                {t(STAGE_LABELS[key])}
              </span>
            </Link>
          );
        })}
      </div>

      {overdue > 0 ? (
        <p className="border-b border-rule bg-negative-soft/60 px-4 py-2 text-[12px] text-negative-ink">
          {overdue === 1
            ? t("1 job is past its due date.")
            : t("{count} jobs are past their due date.", { count: overdue })}
        </p>
      ) : null}

      {/* The funnel is one picture, so it is not a row of tab stops; the counts
          beside it carry the labels and the links. */}
      <div className="flex items-center gap-3 px-4 py-3">
        <div
          className="flex h-2 min-w-0 flex-1 gap-[3px] overflow-hidden rounded-full bg-panel"
          aria-hidden="true"
        >
          {stages
            .filter((stage) => stage.value > 0)
            .map((stage) => (
              <span
                key={stage.key}
                className={STAGE_CLASS[stage.key]}
                style={{ width: share(stage.value) }}
                title={`${t(STAGE_LABELS[stage.key])}: ${stage.value}`}
              />
            ))}
        </div>

        {contextStages.map((key) => {
          const stage = stageByKey(key);
          if (!stage) return null;
          return (
            <Link
              key={key}
              href={stage.href}
              className="shrink-0 whitespace-nowrap text-[11px] leading-4 text-faint transition-colors hover:text-accent"
            >
              {t(STAGE_LABELS[key])} <span className="num text-muted">{stage.value}</span>
            </Link>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-2 px-4 pb-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
        {rows.map((row) => (
          <TypeCard key={row.key} row={row} t={t} />
        ))}
      </div>
    </div>
  );
}

function TypeCard({ row, t }: { row: PipelineTypeRow; t: ServerTranslate }) {
  const closedPercent = row.total > 0 ? Math.round((row.closed / row.total) * 100) : 0;
  const where = row.zone
    ? row.extraZones > 0
      ? `${row.zone} +${row.extraZones}`
      : row.zone
    : null;

  // "Critical · Quarry North Face +1", or a plain apology when nothing is open.
  const detail =
    row.open === 0
      ? t("No open hazards")
      : [row.worst ? t(SEVERITY_LABELS[row.worst]) : t("No severity"), where]
          .filter(Boolean)
          .join(" · ");

  return (
    <Link
      href="/records?type=hazard"
      className="group flex flex-col rounded-card border border-line bg-sheet p-3 transition-colors hover:border-control hover:bg-panel"
    >
      <span className="flex min-w-0 items-center gap-1.5">
        <span
          className="h-1.5 w-1.5 shrink-0 rounded-full"
          style={{
            background: row.worst ? SEVERITY_CHART_COLORS[row.worst] : "var(--color-control)",
          }}
          aria-hidden="true"
        />
        <span
          className={`truncate text-[12px] font-medium ${
            row.uncategorised ? "text-muted" : "text-ink"
          }`}
        >
          {t(row.name)}
        </span>
      </span>

      <span className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span
          className={`num text-[18px] font-semibold leading-none tracking-[-0.02em] ${
            row.open > 0 ? "text-ink" : "text-faint"
          }`}
        >
          {row.open}
        </span>
        <span className="text-[11px] leading-4 text-muted">
          {row.open === 1 ? t("open hazard") : t("open hazards")}
        </span>
        {row.critical > 0 ? (
          <span className="rounded-[3px] bg-negative-soft px-1.5 py-0.5 text-[10px] font-medium leading-4 text-negative-ink">
            {row.critical === 1 ? t("1 critical") : t("{count} critical", { count: row.critical })}
          </span>
        ) : null}
      </span>

      <span
        className="mt-1 flex min-w-0 items-baseline gap-1 text-[11px] leading-4 text-faint"
        title={detail}
      >
        {row.open === 0 ? (
          <span className="truncate">{t("No open hazards")}</span>
        ) : (
          <>
            {/* The severity never truncates; the zone name gives way instead. */}
            <span className="shrink-0">
              {row.worst ? t(SEVERITY_LABELS[row.worst]) : t("No severity")}
            </span>
            {where ? <span className="truncate">· {where}</span> : null}
          </>
        )}
      </span>

      <span className="mt-auto block pt-3">
        <span className="flex items-baseline justify-between gap-2 text-[10px] leading-4 text-faint">
          <span>{t("{closed} of {total} closed", { closed: row.closed, total: row.total })}</span>
          <span className="num">{closedPercent}%</span>
        </span>
        <span className="mt-1 block h-1 overflow-hidden rounded-full bg-panel">
          <span
            className="block h-full rounded-full bg-accent/80"
            style={{ width: `${closedPercent}%` }}
          />
        </span>
      </span>
    </Link>
  );
}
