// The repair queue, as four numbers. The individual fixes that are ready to be
// checked live in "Waiting on you", where the supervisor can close them without
// leaving the overview; this strip is the shape of the whole loop: what has not
// been handed out, what is in the field, and what is sitting on a decision.
import Link from "next/link";
import type { ServerTranslate } from "@/i18n/server";

export function RemediationQueue({
  toAssign,
  inProgress,
  awaiting,
  overdue,
  t,
}: {
  toAssign: number;
  inProgress: number;
  awaiting: number;
  overdue: number;
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
      <div className="grid grid-cols-3 divide-x divide-rule">
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
        <p className="border-t border-rule bg-negative-soft/60 px-4 py-2 text-[12px] text-negative-ink">
          {overdue === 1
            ? t("1 job is past its due date.")
            : t("{count} jobs are past their due date.", { count: overdue })}
        </p>
      ) : null}
    </div>
  );
}
