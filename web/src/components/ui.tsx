import type { ReactNode } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import type { RecordType } from "@/lib/types";
import { TYPE_DOT_CLASSES } from "@/lib/format";

// ---- Shared control classes -----------------------------------------------
// One shape and one height for every control; pages use these instead of
// inventing their own buttons.

export const btnPrimary =
  "inline-flex h-9 items-center justify-center gap-2 rounded-control bg-primary px-3.5 text-[13px] font-medium text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50";

export const btnSecondary =
  "inline-flex h-9 items-center justify-center gap-2 rounded-control border border-control bg-sheet px-3.5 text-[13px] font-medium text-ink transition-colors hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-50";

export const btnGhost =
  "inline-flex h-9 items-center justify-center gap-2 rounded-control px-2.5 text-[13px] font-medium text-muted transition-colors hover:bg-panel hover:text-ink";

export const inputClass =
  "h-9 w-full rounded-control border border-control bg-sheet px-3 text-[13px] text-ink placeholder:text-faint focus:border-accent focus:outline-none";

export const selectClass =
  "h-9 w-full rounded-control border border-control bg-sheet px-2.5 text-[13px] text-ink focus:border-accent focus:outline-none";

export const textareaClass =
  "w-full rounded-control border border-control bg-sheet px-3 py-2 text-[13px] text-ink placeholder:text-faint focus:border-accent focus:outline-none";

export const thClass = "whitespace-nowrap px-4 py-2.5 text-left text-[12px] font-medium text-muted";
export const tdClass = "px-4 py-3 align-middle text-[14px] text-ink";

// ---- Small pills / badges -------------------------------------------------

// The small coloured dot that stands in for a photo or a zone colour.
export function TypeDot({ type }: { type: RecordType }) {
  return <span className={`inline-block h-2 w-2 rounded-full ${TYPE_DOT_CLASSES[type]}`} />;
}

// ---- Layout helpers -------------------------------------------------------

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-[24px] font-semibold leading-8 tracking-[-0.02em] text-ink">{title}</h1>
        {subtitle ? <p className="mt-1 max-w-[78ch] text-[13px] leading-relaxed text-muted">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2 sm:pt-1">{actions}</div> : null}
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-card border border-line bg-sheet ${className}`}>{children}</div>;
}

// A card with a hairline header, used for every grouped block on a page.
export function SectionCard({
  title,
  hint,
  action,
  children,
  className = "",
  bodyClassName = "p-4",
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={`rounded-card border border-line bg-sheet ${className}`}>
      <header className="flex items-start justify-between gap-3 border-b border-rule px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-[14px] font-semibold leading-5 text-ink">{title}</h2>
          {hint ? <p className="mt-0.5 text-[12px] leading-snug text-muted">{hint}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </header>
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

// ---- The KPI strip --------------------------------------------------------
// One panel split by hairlines, never a row of identical tiles: the label, then
// the figure set in the mono face so a column of numbers lines up digit for
// digit, then the one sentence that gives the figure its baseline.

export function KpiStrip({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-card border border-line bg-line sm:grid-cols-4">
      {children}
    </div>
  );
}

export function Kpi({
  label,
  value,
  unit,
  sub,
  badge,
}: {
  label: string;
  value: number | string | null;
  /** A smaller grey suffix, e.g. "/100". */
  unit?: string;
  /** One sentence under the figure, naming what it is measured against. */
  sub?: string;
  badge?: ReactNode;
}) {
  const missing = value === null || value === undefined;

  return (
    <div className="bg-sheet px-4 py-3.5 sm:px-5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[12px] font-medium leading-4 text-muted">{label}</p>
        {badge}
      </div>
      <p className="mt-2 flex items-baseline gap-1">
        <span className={`font-mono text-[26px] leading-none tracking-[-0.03em] ${missing ? "text-faint" : "text-ink"}`}>
          {missing ? "—" : value}
        </span>
        {unit && !missing ? <span className="text-[12px] text-faint">{unit}</span> : null}
      </p>
      {sub ? <p className="mt-1.5 text-[11px] leading-snug text-faint">{sub}</p> : null}
    </div>
  );
}

// A small tinted label inside a row or beside a value. Sentence case, 11px.
export function KpiBadge({ tone = "neutral", children }: { tone?: "neutral" | "warning" | "negative" | "positive"; children: ReactNode }) {
  const tones = {
    neutral: "bg-panel text-muted",
    warning: "bg-warning-soft text-warning-ink",
    negative: "bg-negative-soft text-negative-ink",
    positive: "bg-positive-soft text-positive-ink",
  };
  return (
    <span className={`shrink-0 whitespace-nowrap rounded-[4px] px-1.5 py-0.5 text-[11px] font-medium leading-4 ${tones[tone]}`}>
      {children}
    </span>
  );
}

// ---- State blocks ---------------------------------------------------------

export function LoadingState({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 rounded-card border border-line bg-sheet px-4 py-10 text-[13px] text-muted">
      <Loader2 className="h-4 w-4 animate-spin" />
      {label}
    </div>
  );
}

export function ErrorState({ message, action }: { message?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-card border border-negative/25 bg-negative-soft px-4 py-8 text-center">
      <AlertTriangle className="h-5 w-5 text-negative" />
      <p className="text-[13px] font-medium text-negative-ink">{message || "Something went wrong."}</p>
      {action}
    </div>
  );
}

export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-card border border-dashed border-control bg-sheet px-4 py-10 text-center">
      <p className="text-[14px] font-medium text-ink">{title}</p>
      {hint ? <p className="max-w-sm text-[13px] text-muted">{hint}</p> : null}
      {action}
    </div>
  );
}
