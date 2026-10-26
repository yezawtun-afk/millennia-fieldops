// The Village Ecological Health Index, opened up. The strip gives the headline
// number; this panel shows the arithmetic behind it, so nobody has to trust a
// score they cannot audit.
import { SCORE_BAND_COLORS } from "@/lib/format";
import {
  BACKLOG_DAYS,
  HEALTH_BAND_LABELS,
  WATER_THRESHOLDS,
  type HealthScore,
} from "@/lib/health";
import type { ServerTranslate } from "@/i18n/server";

export function HealthBreakdown({
  result,
  review,
  t,
}: {
  result: HealthScore;
  /** How fast decisions are made, shown as the one signal outside the formula. */
  review: { percent: number | null; decided: number };
  t: ServerTranslate;
}) {
  const { score, band, inputs, penalties } = result;
  const colour = SCORE_BAND_COLORS[band] ?? SCORE_BAND_COLORS.unknown;
  const removed = score === null ? null : 100 - score;

  const rows: { label: string; detail: string; points: number }[] = [
    {
      label: t("Critical hazards still open"),
      detail: t("{open} of {total} rated hazards", { open: inputs.openCritical, total: inputs.hazards }),
      points: penalties.critical,
    },
    {
      label: t("Medium hazards still open"),
      detail: t("{open} of {total} rated hazards", { open: inputs.openMedium, total: inputs.hazards }),
      points: penalties.medium,
    },
    {
      label: t("Abnormal water tests"),
      detail: t("{open} of {total} pH and turbidity readings", {
        open: inputs.abnormalWater,
        total: inputs.waterTests,
      }),
      points: penalties.water,
    },
    {
      label: t("Waiting more than {days} days", { days: BACKLOG_DAYS }),
      detail: t("{open} of {total} waiting", { open: inputs.backlog, total: inputs.pending }),
      points: penalties.backlog,
    },
  ];

  return (
    <div className="px-4 py-4">
      <ul className="divide-y divide-rule">
        {rows.map((row) => (
          <li key={row.label} className="flex items-start justify-between gap-3 py-2.5 first:pt-0">
            <span className="min-w-0">
              <span className="block text-[13px] leading-5 text-ink">{row.label}</span>
              <span className="block text-[11px] leading-4 text-faint">{row.detail}</span>
            </span>
            <span
              className={`num shrink-0 text-[12px] leading-5 ${
                row.points >= 0.05 ? "text-negative-ink" : "text-faint"
              }`}
            >
              {row.points >= 0.05 ? `−${row.points.toFixed(1)}` : "0"}
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-2 flex items-baseline justify-between gap-3 border-t border-rule pt-2.5 text-[12px]">
        <span className="text-muted">{t("100 minus these points")}</span>
        <span className="num text-[12px] text-ink">
          {score === null ? "—" : `100 − ${removed} = ${score}`}
          {score === null ? null : (
            <span className="ml-2 text-[11px]" style={{ color: colour }}>
              {t(HEALTH_BAND_LABELS[band])}
            </span>
          )}
        </span>
      </p>

      <p className="mt-3 flex items-baseline justify-between gap-3 border-t border-rule pt-2.5 text-[12px]">
        <span className="text-muted">{t("Reviewed within 24 hours")}</span>
        <span className="num text-[12px] text-ink">
          {review.percent === null ? "—" : `${review.percent}%`}
          <span className="ml-2 font-sans text-[11px] text-faint">
            {review.decided === 0
              ? t("no decisions yet")
              : t("{count} decided", { count: review.decided })}
          </span>
        </span>
      </p>

      <p className="mt-3 border-t border-rule pt-2.5 text-[11px] leading-relaxed text-faint">
        {t(
          "Every term is a rate, so a bigger village is never punished for having more records. Only pH and turbidity can be judged without a local baseline: pH {min}-{max}, turbidity up to {turbidity} NTU.",
          {
            min: WATER_THRESHOLDS.phMin,
            max: WATER_THRESHOLDS.phMax,
            turbidity: WATER_THRESHOLDS.turbidityMaxNtu,
          }
        )}
      </p>
    </div>
  );
}
