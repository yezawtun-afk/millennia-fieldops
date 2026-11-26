// Seven columns, one series. The bar for today is the one full-strength mark;
// every other day is the same hue held back, so "today" needs no caption.
// Motionless and server-rendered: no chart library, no client JavaScript.

export interface WeekBar {
  /** Short weekday, already localised by the caller. */
  label: string;
  value: number;
  today?: boolean;
  /** A fuller name for the tooltip when the axis label is only a number. */
  full?: string;
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
  dense = false,
  labelEvery = 1,
}: {
  data: WeekBar[];
  height?: number;
  unit?: string;
  emptyLabel?: string;
  /** Thirty columns instead of seven: narrower bars, tighter gaps. */
  dense?: boolean;
  /** Print the axis label every Nth bar, plus the last one. */
  labelEvery?: number;
}) {
  const { top, ticks } = scale(Math.max(...data.map((day) => day.value), 0));
  const empty = data.every((day) => day.value === 0);
  const barMax = dense ? 18 : 38;

  return (
    <div>
      <div className="relative" style={{ height }}>
        {/* Gridlines first, so the bars sit on top of them. The rules are dashed
            because a row of solid lines over near-zero bars reads as a chart
            that failed to draw; a dotted rule reads as graph paper. */}
        <div className="absolute inset-0 flex flex-col justify-between" aria-hidden="true">
          {ticks.map((tick) => (
            <div key={tick} className="flex items-center gap-2.5">
              <span className="num w-5 shrink-0 text-right text-[10px] leading-none text-faint">
                {tick}
              </span>
              <span
                className={`h-px flex-1 ${tick === 0 ? "bg-control" : ""}`}
                style={
                  tick === 0
                    ? undefined
                    : {
                        backgroundImage:
                          "repeating-linear-gradient(to right, var(--color-rule) 0 3px, transparent 3px 6px)",
                      }
                }
              />
            </div>
          ))}
        </div>

        {/* The top padding is the room the count labels need above the tallest
            bar; percentage heights resolve against the padded content box, so
            the bars still grow from the baseline. */}
        <div
          className={`absolute inset-y-0 left-7 right-0 flex items-end pt-4 ${
            dense ? "gap-[3px]" : "gap-1.5 sm:gap-2"
          }`}
        >
          {data.map((day, index) => {
            const ratio = top === 0 ? 0 : day.value / top;
            const reading = `${day.full ?? day.label}: ${day.value} ${unit}`;
            return (
              <div
                key={`${day.label}-${index}`}
                className="flex h-full flex-1 items-end justify-center"
              >
                <div
                  className="relative w-full"
                  style={{
                    height: day.value === 0 ? 10 : `${Math.max(ratio * 100, 3)}%`,
                    maxWidth: barMax,
                  }}
                >
                  <span
                    aria-hidden="true"
                    className={`num absolute -top-4 left-1/2 -translate-x-1/2 leading-none ${
                      dense ? "text-[9px]" : "text-[10px]"
                    } ${day.today ? "font-semibold text-ink" : "text-muted"}`}
                  >
                    {day.value}
                  </span>
                  {day.value === 0 ? (
                    // A zero day keeps its slot: a faint dashed stub on the
                    // baseline says "measured, nothing here" instead of leaving
                    // a bare rule that looks like a missing bar.
                    <span
                      role="img"
                      aria-label={reading}
                      title={reading}
                      className={`block h-full w-full rounded-t-[3px] border border-dashed ${
                        day.today
                          ? "border-accent/45 bg-accent-soft/70"
                          : "border-control/80 bg-panel/70"
                      }`}
                    />
                  ) : (
                    <span
                      role="img"
                      aria-label={reading}
                      title={reading}
                      className={`block h-full w-full rounded-t-[3px] ${
                        day.today ? "bg-accent" : "bg-accent/75"
                      }`}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className={`mt-2 flex pl-7 ${dense ? "gap-[3px]" : "gap-1.5 sm:gap-2"}`}>
        {data.map((day, index) => {
          const show = index % labelEvery === 0 || index === data.length - 1;
          return (
            <span
              key={`${day.label}-${index}`}
              className={`flex-1 truncate text-center ${
                dense ? "text-[9px]" : "text-[11px]"
              } ${day.today ? "font-medium text-ink" : "text-faint"}`}
            >
              {show ? day.label : "\u00a0"}
            </span>
          );
        })}
      </div>

      {empty && emptyLabel ? (
        <p className="mt-3 pl-7 text-[12px] text-muted">{emptyLabel}</p>
      ) : null}
    </div>
  );
}
