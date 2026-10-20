// Two small chart primitives drawn from the same rules: one hue per chart,
// straight bars, three shallow gridlines, no axis line, no legend, no library
// defaults. Built from divs so type stays crisp at every width.

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

// A ranked list with a thin proportional bar: the label and count carry the
// reading, the bar only shows the order.
export function RankBars({
  data,
  emptyLabel = "Nothing recorded yet",
}: {
  data: BarDatum[];
  emptyLabel?: string;
}) {
  const max = Math.max(...data.map((d) => d.value), 0);
  if (max === 0) return <p className="px-4 py-6 text-[13px] text-muted">{emptyLabel}</p>;

  return (
    <ul className="divide-y divide-rule">
      {data.map((datum) => (
        <li key={datum.label} className="flex items-center gap-3 px-4 py-2.5">
          <span className="w-20 shrink-0 text-[12px] text-muted">{datum.label}</span>
          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-panel">
            <span
              className="block h-full rounded-full bg-accent"
              style={{ width: `${Math.round((datum.value / max) * 100)}%`, opacity: 0.35 + (0.65 * datum.value) / max }}
            />
          </span>
          <span className="w-7 shrink-0 text-right text-[12px] tabular-nums text-ink">{datum.value}</span>
        </li>
      ))}
    </ul>
  );
}
