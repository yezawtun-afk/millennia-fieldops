// A donut built from one SVG circle per slice, so it renders on the server and
// ships no charting library. Colours come from the caller; the legend carries
// the numbers, so the ring only has to show proportion.

export interface DonutSlice {
  label: string;
  value: number;
  color: string;
}

const RADIUS = 40;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function DonutChart({
  data,
  centerValue,
  centerLabel,
  unit = "records",
  emptyLabel = "Nothing recorded yet.",
  size = 148,
}: {
  data: DonutSlice[];
  centerValue?: number | string;
  centerLabel?: string;
  unit?: string;
  emptyLabel?: string;
  size?: number;
}) {
  const total = data.reduce((sum, slice) => sum + slice.value, 0);
  const summary = data
    .filter((slice) => slice.value > 0)
    .map((slice) => `${slice.label}: ${slice.value} ${unit}`)
    .join(", ");

  if (total === 0) {
    return (
      <p className="px-4 py-6 text-[13px] text-muted">{emptyLabel}</p>
    );
  }

  let offset = 0;

  return (
    <div className="flex flex-col items-center gap-4 p-4 sm:flex-row sm:items-center">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg
          viewBox="0 0 100 100"
          width={size}
          height={size}
          role="img"
          aria-label={summary}
          className="-rotate-90"
        >
          <title>{summary}</title>
          <circle
            cx="50"
            cy="50"
            r={RADIUS}
            fill="none"
            stroke="var(--color-panel)"
            strokeWidth="14"
          />
          {data.map((slice) => {
            if (slice.value <= 0) return null;
            const length = (slice.value / total) * CIRCUMFERENCE;
            const dash = `${length} ${CIRCUMFERENCE - length}`;
            const element = (
              <circle
                key={slice.label}
                cx="50"
                cy="50"
                r={RADIUS}
                fill="none"
                stroke={slice.color}
                strokeWidth="14"
                strokeDasharray={dash}
                strokeDashoffset={-offset}
              />
            );
            offset += length;
            return element;
          })}
        </svg>

        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="kpi-value text-[24px] font-normal leading-7 text-ink">
            {centerValue ?? total}
          </span>
          {centerLabel ? (
            <span className="mt-0.5 text-[11px] text-muted">{centerLabel}</span>
          ) : null}
        </div>
      </div>

      <ul className="w-full min-w-0 space-y-1.5">
        {data.map((slice) => {
          const percent = Math.round((slice.value / total) * 100);
          return (
            <li
              key={slice.label}
              className="flex items-center gap-2 text-[12px]"
              title={`${slice.label}: ${slice.value} ${unit} (${percent}%)`}
            >
              <span
                className="h-2 w-2 shrink-0 rounded-[2px]"
                style={{ background: slice.color }}
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1 truncate text-muted">{slice.label}</span>
              <span className="shrink-0 tabular-nums text-ink">{slice.value}</span>
              <span className="w-8 shrink-0 text-right tabular-nums text-faint">
                {percent}%
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
