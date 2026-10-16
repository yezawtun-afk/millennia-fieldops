import type { ReactNode } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import type { HazardSeverity, RecordStatus, RecordType, UserRole } from "@/lib/types";
import {
  SEVERITY_LABELS,
  SEVERITY_STYLES,
  STATUS_LABELS,
  STATUS_STYLES,
  TYPE_DOT_CLASSES,
  TYPE_LABELS,
  TYPE_STYLES,
} from "@/lib/format";

// ---- Small pills / badges -------------------------------------------------

function Pill({ className, children }: { className: string; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${className}`}
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
  if (!severity) return <span className="text-muted">-</span>;
  return <Pill className={SEVERITY_STYLES[severity]}>{SEVERITY_LABELS[severity]}</Pill>;
}

// The small coloured dot that stands in for a photo.
export function TypeDot({ type }: { type: RecordType }) {
  return <span className={`inline-block h-2.5 w-2.5 rounded-full ${TYPE_DOT_CLASSES[type]}`} />;
}

const ROLE_STYLES: Record<UserRole, string> = {
  field_worker: "bg-primary-soft text-primary-dark",
  supervisor: "bg-water-soft text-water",
  admin: "bg-forest-soft text-white",
};

export const ROLE_LABELS: Record<UserRole, string> = {
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
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-[26px]">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-muted">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-lg border border-line bg-white p-4 ${className}`}>{children}</div>;
}

export function StatCard({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: number | string;
  icon: ReactNode;
  tone: string;
}) {
  return (
    <div className="rounded-lg border border-line bg-white p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted">{label}</p>
        <span className={`flex h-9 w-9 items-center justify-center rounded-md ${tone}`}>{icon}</span>
      </div>
      <p className="mt-2 text-2xl font-bold text-ink">{value ?? 0}</p>
    </div>
  );
}

// ---- State blocks ---------------------------------------------------------

export function LoadingState({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 rounded-lg border border-line bg-white px-4 py-10 text-sm text-muted">
      <Loader2 className="h-4 w-4 animate-spin" />
      {label}
    </div>
  );
}

export function ErrorState({ message, action }: { message?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-rejected/30 bg-rejected-soft px-4 py-8 text-center">
      <AlertTriangle className="h-6 w-6 text-rejected" />
      <p className="text-sm font-medium text-rejected">{message || "Something went wrong."}</p>
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
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-line bg-white px-4 py-10 text-center">
      <p className="text-sm font-semibold text-ink">{title}</p>
      {hint ? <p className="max-w-sm text-sm text-muted">{hint}</p> : null}
      {action}
    </div>
  );
}
