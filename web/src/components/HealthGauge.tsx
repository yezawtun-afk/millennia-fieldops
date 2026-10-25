// The Village Ecological Health Index, shown as a half-ring. The number is the
// headline; the four rows underneath say exactly which signals produced it, so
// nobody has to trust an unexplained score.
import { SCORE_BAND_COLORS } from "@/lib/format";
import {
  BACKLOG_DAYS,
  HEALTH_BAND_LABELS,
  HEALTH_WEIGHTS,
  WATER_THRESHOLDS,
  type HealthScore,
} from "@/lib/health";
import type { ServerTranslate } from "@/i18n/server";

const RADIUS = 70;
const ARC = Math.PI * RADIUS;

export function HealthGauge({ result, t }: { result: HealthScore; t: ServerTranslate }) {
  const { score, band, inputs, penalties } = result;
  const colour = SCORE_BAND_COLORS[band] ?? SCORE_BAND_COLORS.unknown;
  const filled = score === null ? 0 : (score / 100) * ARC;

  const rows: { label: string; detail: string; points: number }[] = [
    {
      label: t("Critical hazards still open"),
      detail: t("{open} of {total}", { open: inputs.openCritical, total: inputs.hazards }),
      points: penalties.critical,
    },
    {
      label: t("Medium hazards still open"),
      detail: t("{open} of {total}", { open: inputs.openMedium, total: inputs.hazards }),
      points: penalties.medium,
    },
    {
      label: t("Abnormal water tests"),
      detail: t("{open} of {total}", { open: inputs.abnormalWater, total: inputs.waterTests }),
      points: penalties.water,
    },
    {
      label: t("Waiting more than {days} days", { days: BACKLOG_DAYS }),
      detail: t("{open} of {total}", { open: inputs.backlog, total: inputs.pending }),
      points: penalties.backlog,
    },
  ];

  return (
    <div>
      <div className="relative mx-auto w-full max-w-[230px]">
        <svg
          viewBox="0 0 180 100"
          className="w-full"
          role="img"
          aria-label={
            score === null
              ? t("Not enough data to score the village yet.")
              : t("Village health {score} out of 100, {band}.", {
                  score,
                  band: t(HEALTH_BAND_LABELS[band]),
                })
          }
        >
          <path
            d={`M 20 86 A ${RADIUS} ${RADIUS} 0 0 1 160 86`}
            fill="none"
            stroke="var(--color-panel)"
            strokeWidth="14"
            strokeLinecap="round"
          />
          {score !== null ? (
            <path
              d={`M 20 86 A ${RADIUS} ${RADIUS} 0 0 1 160 86`}
              fill="none"
              stroke={colour}
              strokeWidth="14"
              strokeLinecap="round"
              strokeDasharray={`${filled} ${ARC}`}
            />
          ) : null}
        </svg>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 text-center">
          <p className="kpi-value text-[30px] font-normal leading-8 text-ink">
            {score === null ? "-" : score}
            {score === null ? null : (
              <span className="ml-0.5 text-[13px] text-faint">/100</span>
            )}
          </p>
          <p className="text-[12px] font-medium" style={{ color: colour }}>
            {t(HEALTH_BAND_LABELS[band])}
          </p>
        </div>
      </div>

      <ul className="mt-3 divide-y divide-rule border-t border-rule">
        {rows.map((row) => (
          <li key={row.label} className="flex items-center justify-between gap-3 py-2">
            <span className="min-w-0">
              <span className="block truncate text-[12px] text-muted">{row.label}</span>
              <span className="block text-[11px] text-faint">{row.detail}</span>
            </span>
            <span
              className={`shrink-0 text-[12px] tabular-nums ${
                row.points > 0 ? "text-negative-ink" : "text-faint"
              }`}
            >
              {row.points > 0 ? `-${row.points.toFixed(1)}` : "0"}
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-2 text-[11px] leading-relaxed text-faint">
        {t(
          "Only pH and turbidity can be judged without a local baseline: pH {min}-{max}, turbidity up to {turbidity} NTU. Weights {critical}/{medium}/{water}/{backlog}.",
          {
            min: WATER_THRESHOLDS.phMin,
            max: WATER_THRESHOLDS.phMax,
            turbidity: WATER_THRESHOLDS.turbidityMaxNtu,
            critical: HEALTH_WEIGHTS.critical,
            medium: HEALTH_WEIGHTS.medium,
            water: HEALTH_WEIGHTS.water,
            backlog: HEALTH_WEIGHTS.backlog,
          }
        )}
      </p>
    </div>
  );
}
