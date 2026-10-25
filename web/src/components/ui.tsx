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
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-[22px] font-semibold leading-7 tracking-[-0.01em] text-ink">{title}</h1>
        {subtitle ? <p className="mt-1 max-w-[70ch] text-[14px] text-muted">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2 sm:pt-0.5">{actions}</div> : null}
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
        <div>
          <h2 className="text-[14px] font-semibold text-ink">{title}</h2>
          {hint ? <p className="mt-0.5 text-[12px] text-muted">{hint}</p> : null}
        </div>
        {action}
      </header>
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

// One readout. No icon, no tinted square: the number is the point.
export function Stat({
  label,
  value,
  hint,
  tone = "text-ink",
  className = "",
}: {
  label: string;
  value: number | string;
  hint?: string;
  tone?: string;
  className?: string;
}) {
  return (
    <div
      className={`rounded-card border border-line bg-sheet p-4 sm:rounded-none sm:border-0 sm:px-5 sm:py-4 ${className}`}
    >
      <p className="text-[12px] font-medium text-muted">{label}</p>
      <p className={`kpi-value mt-1 text-[28px] font-normal leading-8 tracking-[-0.02em] ${tone}`}>
        {value ?? 0}
      </p>
      {hint ? <p className="mt-0.5 text-[12px] text-faint">{hint}</p> : null}
    </div>
  );
}

// The KPI row: one container split by hairlines on wide screens, separate
// tiles on phones where a five-column strip would not fit.
export function StatStrip({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-5 sm:gap-0 sm:divide-x sm:divide-rule sm:overflow-hidden sm:rounded-card sm:border sm:border-line sm:bg-sheet">
      {children}
    </div>
  );
}

// Kept for the pages that still want a single boxed figure.
export function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: number | string;
  hint?: string;
}) {
  return <Stat label={label} value={value} hint={hint} />;
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
