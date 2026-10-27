// The repair queue: what a supervisor still has to hand out, and what is fixed
// and waiting for a decision. It sits on the dashboard because a closed job is
// the only thing that moves the health score, so an unverified fix is work the
// supervisor is holding up.
import Link from "next/link";
import type { ServerTranslate } from "@/i18n/server";

export interface RepairRow {
  id: string;
  title: string;
  worker: string | null;
  /** e.g. "2h ago", already translated. */
  finishedLabel: string;
}

export function RemediationQueue({
  toAssign,
  inProgress,
  awaiting,
  overdue,
  rows,
  t,
}: {
  toAssign: number;
  inProgress: number;
  awaiting: number;
  overdue: number;
  rows: RepairRow[];
  t: ServerTranslate;
}) {
  const cells = [
    {
      key: "toAssign",
      label: t("To assign"),
      value: toAssign,
      href: "/records?completion=open",
      tone: toAssign > 0 ? "warning" : "neutral",
    },
    {
      key: "inProgress",
      label: t("In progress"),
      value: inProgress,
      href: "/records?completion=open",
      tone: "neutral",
    },
    {
      key: "awaiting",
      label: t("Awaiting verification"),
      value: awaiting,
      href: "/records?completion=verify",
      tone: awaiting > 0 ? "accent" : "neutral",
    },
  ] as const;

  return (
    <div>
      <div className="grid grid-cols-3 divide-x divide-rule border-b border-rule">
        {cells.map((cell) => (
          <Link
            key={cell.key}
            href={cell.href}
            className="block px-4 py-3 transition-colors hover:bg-panel"
          >
            <span className="num block text-[22px] font-semibold leading-none tracking-[-0.02em] text-ink">
              {cell.value}
            </span>
            <span className="mt-1 block text-[11px] leading-4 text-muted">{cell.label}</span>
          </Link>
        ))}
      </div>

      {overdue > 0 ? (
        <p className="border-b border-rule bg-negative-soft/60 px-4 py-2 text-[12px] text-negative-ink">
          {overdue === 1
            ? t("1 job is past its due date.")
            : t("{count} jobs are past their due date.", { count: overdue })}
        </p>
      ) : null}

      {rows.length === 0 ? (
        <p className="px-4 py-5 text-[13px] text-muted">
          {t("Nothing is waiting for verification.")}
        </p>
      ) : (
        <ul className="divide-y divide-rule">
          {rows.map((row) => (
            <li key={row.id}>
              <Link
                href={`/records/${row.id}`}
                className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-panel"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium leading-5 text-ink">
                    {row.title}
                  </span>
                  <span className="mt-0.5 block truncate text-[11px] leading-4 text-faint">
                    {(row.worker ?? t("a field worker")) +
                      (row.finishedLabel ? ` · ${t("fixed {when}", { when: row.finishedLabel })}` : "")}
                  </span>
                </span>
                <span className="shrink-0 text-[12px] font-medium text-accent">
                  {t("Verify")}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
