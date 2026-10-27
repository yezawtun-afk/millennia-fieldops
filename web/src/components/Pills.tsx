"use client";

// The four status pills, translated on the client. They live in their own file
// so ui.tsx (used by server pages for layout and buttons) stays a server module.
import {
  ROLE_LABELS,
  SEVERITY_LABELS,
  SEVERITY_STYLES,
  STATUS_LABELS,
  STATUS_STYLES,
  TYPE_LABELS,
  TYPE_STYLES,
  type WorkStage,
} from "@/lib/format";
import { useI18n } from "@/i18n";
import type { HazardSeverity, RecordStatus, RecordType, UserRole } from "@/lib/types";

function Pill({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium leading-5 ${className}`}
    >
      {children}
    </span>
  );
}

export function TypePill({ type }: { type: RecordType }) {
  const { t } = useI18n();
  return <Pill className={TYPE_STYLES[type]}>{t(TYPE_LABELS[type])}</Pill>;
}

export function StatusBadge({ status }: { status: RecordStatus }) {
  const { t } = useI18n();
  return <Pill className={STATUS_STYLES[status]}>{t(STATUS_LABELS[status])}</Pill>;
}

// Completion is separate from the review status: an approved record can also be
// a finished job. Shown next to the status badge, never instead of it.
export function CompletedBadge() {
  const { t } = useI18n();
  return <Pill className="bg-positive-soft text-positive-ink">{t("Completed")}</Pill>;
}

// The repair loop, shown beside the review status. "Closed" is the only state
// that removes the hazard from the health score.
export function WorkPill({ stage }: { stage: WorkStage }) {
  const { t } = useI18n();
  if (stage === "none") return null;

  const label =
    stage === "unassigned"
      ? "To assign"
      : stage === "assigned"
        ? "Assigned"
        : stage === "verify"
          ? "Awaiting verification"
          : "Closed";

  const style =
    stage === "unassigned"
      ? "bg-panel text-muted"
      : stage === "assigned"
        ? "bg-water-soft text-water"
        : stage === "verify"
          ? "bg-warning-soft text-warning-ink"
          : "bg-positive-soft text-positive-ink";

  return <Pill className={style}>{t(label)}</Pill>;
}

export function SeverityBadge({ severity }: { severity: HazardSeverity | null }) {
  const { t } = useI18n();
  if (!severity) return <span className="text-muted">-</span>;
  return <Pill className={SEVERITY_STYLES[severity]}>{t(SEVERITY_LABELS[severity])}</Pill>;
}

const ROLE_STYLES: Record<UserRole, string> = {
  field_worker: "bg-accent-soft text-accent",
  supervisor: "bg-water-soft text-water",
  admin: "bg-ink text-white",
};

export function RolePill({ role }: { role: UserRole }) {
  const { t } = useI18n();
  return <Pill className={ROLE_STYLES[role]}>{t(ROLE_LABELS[role])}</Pill>;
}
