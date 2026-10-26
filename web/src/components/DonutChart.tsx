// A share ring built from one SVG circle per slice, so it renders on the server
// and ships no charting library. The stroke is thin and the legend carries the
// numbers: the ring shows proportion, the table carries the truth.

export interface DonutSlice {
  label: string;
  value: number;
  color: string;
}

const RADIUS = 40;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const SEAM = 2;

export function DonutChart({
  data,
  centerValue,
  centerLabel,
  unit = "records",
  emptyLabel = "Nothing recorded yet.",
  size = 132,
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
    return <p className="px-4 py-6 text-[13px] text-muted">{emptyLabel}</p>;
  }

  let offset = 0;

  return (
    <div className="flex flex-col items-center gap-4 px-4 py-4 sm:flex-row sm:items-center">
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
          <circle cx="50" cy="50" r={RADIUS} fill="none" stroke="var(--color-panel)" strokeWidth="9" />
          {data.map((slice) => {
            if (slice.value <= 0) return null;
            const length = (slice.value / total) * CIRCUMFERENCE;
            const visible = Math.max(length - SEAM, 1);
            const element = (
              <circle
                key={slice.label}
                cx="50"
                cy="50"
                r={RADIUS}
                fill="none"
                stroke={slice.color}
                strokeWidth="9"
                strokeDasharray={`${visible} ${CIRCUMFERENCE - visible}`}
                strokeDashoffset={-offset}
              />
            );
            offset += length;
            return element;
          })}
        </svg>

        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="kpi-value num text-[22px] leading-none text-ink">
            {centerValue ?? total}
          </span>
          {centerLabel ? (
            <span className="mt-1 text-[11px] leading-none text-faint">{centerLabel}</span>
          ) : null}
        </div>
      </div>

      <ul className="w-full min-w-0 space-y-1">
        {data.map((slice) => {
          const percent = Math.round((slice.value / total) * 100);
          return (
            <li
              key={slice.label}
              className="flex items-center gap-2 py-0.5 text-[12px]"
              title={`${slice.label}: ${slice.value} ${unit} (${percent}%)`}
            >
              <span
                className="h-2 w-2 shrink-0 rounded-[2px]"
                style={{ background: slice.color }}
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1 truncate text-muted">{slice.label}</span>
              <span className="num shrink-0 text-[12px] font-medium text-ink">{slice.value}</span>
              <span className="num w-8 shrink-0 text-right text-[11px] text-faint">
                {percent}%
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
