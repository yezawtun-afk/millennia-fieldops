import type { ReactNode } from "react";
import type { HazardSeverity, RecordStatus, RecordType, UserRole } from "@/lib/types";
import {
  SEVERITY_LABELS,
  SEVERITY_STYLES,
  STATUS_LABELS,
  STATUS_STYLES,
  TYPE_LABELS,
  TYPE_STYLES,
} from "@/lib/format";

// ---- Small pills / badges -------------------------------------------------

function Pill({ className, children }: { className: string; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${className}`}
    >
      {children}
    </span>
  );
}

export function TypePill({ type }: { type: RecordType }) {
  return <Pill className={TYPE_STYLES[type]}>{TYPE_LABELS[type]}</Pill>;
}

export function StatusBadge({ status }: { status: RecordStatus }) {
  return <Pill className={STATUS_STYLES[status]}>{STATUS_LABELS[status]}</Pill>;
}

export function SeverityBadge({ severity }: { severity: HazardSeverity | null }) {
  if (!severity) return <span className="text-xs text-muted">-</span>;
  return <Pill className={SEVERITY_STYLES[severity]}>{SEVERITY_LABELS[severity]}</Pill>;
}

const ROLE_STYLES: Record<UserRole, string> = {
  field_worker: "bg-primary-soft text-primary-dark",
  supervisor: "bg-water-soft text-water",
  admin: "bg-forest-soft text-white",
};

const ROLE_LABELS: Record<UserRole, string> = {
  field_worker: "Field worker",
  supervisor: "Supervisor",
  admin: "Administrator",
};

export function RolePill({ role }: { role: UserRole }) {
  return <Pill className={ROLE_STYLES[role]}>{ROLE_LABELS[role]}</Pill>;
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
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold text-ink">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-muted">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-line bg-white p-4 shadow-sm ${className}`}>
      {children}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  accent = "#1f6b4a",
}: {
  label: string;
  value: number | string;
  hint?: string;
  accent?: string;
}) {
  return (
    <Card className="flex flex-col gap-1">
      <span className="text-xs font-medium uppercase tracking-wide text-muted">{label}</span>
      <span className="text-2xl font-semibold" style={{ color: accent }}>
        {value}
      </span>
      {hint ? <span className="text-xs text-muted">{hint}</span> : null}
    </Card>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-dashed border-line bg-white/60 px-6 py-12 text-center">
      <p className="text-sm font-medium text-ink">{title}</p>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}
