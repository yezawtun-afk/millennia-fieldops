// The zones board: the one block that could only belong to this product. Each
// row carries the zone's own colour from the map, how long since anyone reported
// from it, and how many open issues sit there - as a count and a thin bar, so the
// order is seen as well as read.
import Link from "next/link";
import type { ServerTranslate } from "@/i18n/server";

export interface ZoneRow {
  id: string;
  name: string;
  color: string;
  open: number;
  /** e.g. "Last report 2 days ago", already translated. */
  lastLabel: string;
  idle: boolean;
}

export function ZoneBoard({
  rows,
  t,
  emptyLabel,
}: {
  rows: ZoneRow[];
  t: ServerTranslate;
  emptyLabel: string;
}) {
  if (rows.length === 0) {
    return <p className="px-4 py-6 text-[13px] text-muted">{emptyLabel}</p>;
  }

  const max = Math.max(...rows.map((row) => row.open), 0);

  return (
    <ul className="divide-y divide-rule">
      {rows.map((row) => (
        <li key={row.id}>
          <Link
            href={`/records?zone=${row.id}`}
            title={`${row.name}: ${row.open}`}
            className="block px-4 py-2.5 transition-colors hover:bg-panel"
          >
            <span className="flex items-center gap-2">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ background: row.color }}
                aria-hidden="true"
              />
              <span className="min-w-0 truncate text-[13px] font-medium text-ink">{row.name}</span>
              {row.idle ? (
                <span className="shrink-0 rounded-[3px] bg-warning-soft px-1.5 py-0.5 text-[10px] font-medium leading-4 text-warning-ink">
                  {t("Quiet")}
                </span>
              ) : null}
              <span className="ml-auto shrink-0 font-mono text-[13px] leading-5 text-ink">
                {row.open}
              </span>
            </span>

            <span className="mt-1.5 block h-[2px] overflow-hidden rounded-full bg-panel">
              <span
                className={`block h-full rounded-full ${row.open > 0 ? "bg-ink/50" : ""}`}
                style={{ width: `${max > 0 ? (row.open / max) * 100 : 0}%` }}
              />
            </span>

            <span className="mt-1 block text-[11px] leading-4 text-faint">{row.lastLabel}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
