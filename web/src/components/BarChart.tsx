// Two small chart primitives drawn from the same rules: one hue per chart,
// straight bars, three shallow gridlines, no axis line, no legend, no library
// defaults. Built from divs so type stays crisp at every width.
import Link from "next/link";

export interface BarDatum {
  label: string;
  value: number;
}

function niceStep(value: number): number {
  const magnitude = 10 ** Math.floor(Math.log10(Math.max(value, 1)));
  for (const step of [1, 2, 2.5, 5, 10]) {
    const candidate = step * magnitude;
    if (candidate >= value) return candidate;
  }
  return value;
}

// Three gridlines above zero, labelled with round numbers.
function axisTop(value: number): { top: number; ticks: number[] } {
  const step = niceStep(value / 3);
  const top = step * 3;
  return { top, ticks: [top, step * 2, step, 0] };
}

export function BarChart({
  data,
  height = 180,
  unit = "records",
}: {
  data: BarDatum[];
  height?: number;
  unit?: string;
}) {
  const { top: max, ticks } = axisTop(Math.max(...data.map((d) => d.value), 0));
  const hasValues = data.some((d) => d.value > 0);

  return (
    <div>
      <div className="relative" style={{ height }}>
        {/* Gridlines sit behind the bars, hairline weight, labelled in grey. */}
        <div className="absolute inset-0 flex flex-col justify-between" aria-hidden="true">
          {ticks.map((tick) => (
            <div key={tick} className="flex items-center gap-2">
              <span className="w-7 shrink-0 text-right text-[10px] tabular-nums text-faint">
                {Number.isInteger(tick) ? tick : tick.toFixed(1)}
              </span>
              <span className="h-px flex-1 bg-rule" />
            </div>
          ))}
        </div>

        <div className="absolute inset-y-0 left-9 right-0 flex items-end gap-[3%]">
          {data.map((datum) => {
            const ratio = max === 0 ? 0 : datum.value / max;
            return (
              <div key={datum.label} className="flex h-full flex-1 items-end">
                <div
                  role="img"
                  aria-label={`${datum.label}: ${datum.value} ${unit}`}
                  title={`${datum.label}: ${datum.value} ${unit}`}
                  className={`w-full rounded-t-[2px] ${datum.value > 0 ? "bg-accent" : "bg-control"}`}
                  style={{
                    height: datum.value > 0 ? `${Math.max(ratio * 100, 2)}%` : "2px",
                  }}
                />
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-2 flex gap-[3%] pl-9">
        {data.map((datum) => (
          <span key={datum.label} className="flex-1 truncate text-center text-[10px] text-faint">
            {datum.label}
          </span>
        ))}
      </div>

      {!hasValues ? (
        <p className="mt-2 pl-9 text-[12px] text-muted">Nothing submitted in this window yet.</p>
      ) : null}
    </div>
  );
}

export interface StackedSegment {
  label: string;
  value: number;
  color: string;
}

export interface StackedDatum {
  label: string;
  segments: StackedSegment[];
}

// The same frame as BarChart, but each column is split by status. Segment order
// is the caller's: the first segment sits at the bottom of the column.
export function StackedBarChart({
  data,
  height = 180,
  unit = "records",
  labelStep = 1,
}: {
  data: StackedDatum[];
  height?: number;
  unit?: string;
  /** Show every nth axis label, so a 14-day chart stays readable on a phone. */
  labelStep?: number;
}) {
  const totals = data.map((datum) => datum.segments.reduce((sum, segment) => sum + segment.value, 0));
  const { top: max, ticks } = axisTop(Math.max(...totals, 0));
  const hasValues = totals.some((total) => total > 0);
  const legend = data[0]?.segments ?? [];

  return (
    <div>
      <div className="relative" style={{ height }}>
        <div className="absolute inset-0 flex flex-col justify-between" aria-hidden="true">
          {ticks.map((tick) => (
            <div key={tick} className="flex items-center gap-2">
              <span className="w-7 shrink-0 text-right text-[10px] tabular-nums text-faint">
                {Number.isInteger(tick) ? tick : tick.toFixed(1)}
              </span>
              <span className="h-px flex-1 bg-rule" />
            </div>
          ))}
        </div>

        <div className="absolute inset-y-0 left-9 right-0 flex items-end gap-[3%]">
          {data.map((datum, index) => {
            const total = totals[index];
            const reading = datum.segments
              .filter((segment) => segment.value > 0)
              .map((segment) => `${segment.value} ${segment.label}`)
              .join(", ");

            return (
              <div key={datum.label} className="flex h-full flex-1 items-end">
                <div
                  role="img"
                  aria-label={`${datum.label}: ${reading || `0 ${unit}`}`}
                  title={`${datum.label}: ${reading || `0 ${unit}`}`}
                  className="flex w-full flex-col-reverse"
                  style={{ height: total > 0 ? `${Math.max((total / max) * 100, 2)}%` : "2px" }}
                >
                  {total > 0 ? (
                    datum.segments.map((segment) => (
                      <span
                        key={segment.label}
                        style={{
                          height: `${(segment.value / total) * 100}%`,
                          background: segment.color,
                        }}
                      />
                    ))
                  ) : (
                    <span className="h-full w-full bg-control" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-2 flex gap-[3%] pl-9">
        {data.map((datum, index) => (
          <span
            key={datum.label}
            className="flex-1 truncate text-center text-[10px] text-faint"
          >
            {index % labelStep === 0 ? datum.label : ""}
          </span>
        ))}
      </div>

      <ul className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 pl-9">
        {legend.map((item) => (
          <li key={item.label} className="flex items-center gap-1.5 text-[11px] text-muted">
            <span className="h-2 w-2 rounded-[2px]" style={{ background: item.color }} />
            {item.label}
          </li>
        ))}
      </ul>

      {!hasValues ? (
        <p className="mt-2 pl-9 text-[12px] text-muted">Nothing submitted in this window yet.</p>
      ) : null}
    </div>
  );
}

// A ranked list with a thin proportional bar: the label and count carry the
// reading, the bar only shows the order. A row can link to the filtered records
// list, which turns a chart into a way in.
export interface RankBarDatum extends BarDatum {
  href?: string;
  /** Extra words after the number, e.g. "open". */
  suffix?: string;
}

export function RankBars({
  data,
  emptyLabel = "Nothing recorded yet",
  unit,
}: {
  data: RankBarDatum[];
  emptyLabel?: string;
  unit?: string;
}) {
  const max = Math.max(...data.map((d) => d.value), 0);
  if (max === 0) return <p className="px-4 py-6 text-[13px] text-muted">{emptyLabel}</p>;

  return (
    <ul className="divide-y divide-rule">
      {data.map((datum) => {
        const content = (
          <>
            <span className="w-28 shrink-0 truncate text-[12px] text-muted">{datum.label}</span>
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-panel">
              <span
                className="block h-full rounded-full bg-accent"
                style={{
                  width: `${Math.round((datum.value / max) * 100)}%`,
                  opacity: 0.35 + (0.65 * datum.value) / max,
                }}
              />
            </span>
            <span className="w-7 shrink-0 text-right text-[12px] tabular-nums text-ink">
              {datum.value}
            </span>
            {datum.suffix || unit ? (
              <span className="w-12 shrink-0 text-right text-[11px] text-faint">
                {datum.suffix ?? unit}
              </span>
            ) : null}
          </>
        );

        return (
          <li key={datum.label}>
            {datum.href ? (
              <Link
                href={datum.href}
                className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-panel"
                title={`${datum.label}: ${datum.value} ${unit ?? ""}`.trim()}
              >
                {content}
              </Link>
            ) : (
              <div className="flex items-center gap-3 px-4 py-2.5">{content}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
