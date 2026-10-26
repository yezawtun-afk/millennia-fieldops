// Seven columns, one series. The bar for today is the one full-strength mark;
// every other day is the same hue held back, so "today" needs no caption.
// Motionless and server-rendered: no chart library, no client JavaScript.

export interface WeekBar {
  /** Short weekday, already localised by the caller. */
  label: string;
  value: number;
  today?: boolean;
}

// Three gridlines at round numbers, with the top one above the tallest bar.
function scale(maxValue: number): { top: number; ticks: number[] } {
  const rough = Math.max(maxValue, 1) / 3;
  const magnitude = 10 ** Math.floor(Math.log10(Math.max(rough, 1)));
  const step =
    [1, 2, 5, 10].map((factor) => factor * magnitude).find((candidate) => candidate >= rough) ??
    magnitude * 10;
  return { top: step * 3, ticks: [step * 3, step * 2, step, 0] };
}

export function WeekBars({
  data,
  height = 168,
  unit = "records",
  emptyLabel,
}: {
  data: WeekBar[];
  height?: number;
  unit?: string;
  emptyLabel?: string;
}) {
  const { top, ticks } = scale(Math.max(...data.map((day) => day.value), 0));
  const empty = data.every((day) => day.value === 0);

  return (
    <div>
      <div className="relative" style={{ height }}>
        {/* Gridlines first, so the bars sit on top of them. */}
        <div className="absolute inset-0 flex flex-col justify-between" aria-hidden="true">
          {ticks.map((tick) => (
            <div key={tick} className="flex items-center gap-2.5">
              <span className="num w-5 shrink-0 text-right text-[10px] leading-none text-faint">
                {tick}
              </span>
              <span className={`h-px flex-1 ${tick === 0 ? "bg-control" : "bg-rule"}`} />
            </div>
          ))}
        </div>

        <div className="absolute inset-y-0 left-7 right-0 flex items-end gap-1.5 sm:gap-2">
          {data.map((day) => {
            const ratio = top === 0 ? 0 : day.value / top;
            const reading = `${day.label}: ${day.value} ${unit}`;
            return (
              <div key={day.label} className="flex h-full flex-1 items-end justify-center">
                {day.value === 0 ? (
                  <span
                    role="img"
                    aria-label={reading}
                    title={reading}
                    className="h-px w-full max-w-[38px] bg-control"
                  />
                ) : (
                  <span
                    role="img"
                    aria-label={reading}
                    title={reading}
                    className={`w-full max-w-[38px] rounded-t-[3px] ${
                      day.today ? "bg-accent" : "bg-accent/75"
                    }`}
                    style={{ height: `${Math.max(ratio * 100, 3)}%` }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-2 flex gap-1.5 pl-7 sm:gap-2">
        {data.map((day) => (
          <span
            key={day.label}
            className={`flex-1 truncate text-center text-[11px] ${
              day.today ? "font-medium text-ink" : "text-faint"
            }`}
          >
            {day.label}
          </span>
        ))}
      </div>

      {empty && emptyLabel ? (
        <p className="mt-3 pl-7 text-[12px] text-muted">{emptyLabel}</p>
      ) : null}
    </div>
  );
}
